import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { config } from '../config.js';
import { nowIso } from '../lib/ids.js';
import type { RealtimeEventType, RealtimeMessage } from '../types.js';

interface TrackedClient {
  socket: WebSocket;
  alive: boolean;
  clientId: string;
}

const REALTIME_PATH = '/realtime';

/**
 * Realtime fan-out hub.
 *
 * `ws` is used instead of Socket.IO to keep the browser bundle free of a realtime
 * library — the client needs ~40 lines of reconnect logic, which also lets us obey
 * Master PRD §15: on every reconnect the client re-fetches authoritative state
 * instead of trusting missed events.
 */
class RealtimeHub {
  private wss: WebSocketServer | null = null;
  private clients = new Map<WebSocket, TrackedClient>();
  private heartbeat: NodeJS.Timeout | null = null;
  private counter = 0;

  attach(server: HttpServer): void {
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      if (pathname !== REALTIME_PATH) {
        socket.destroy();
        return;
      }
      this.wss?.handleUpgrade(req, socket, head, (ws) => {
        this.wss?.emit('connection', ws, req);
      });
    });

    this.wss.on('connection', (socket: WebSocket) => {
      this.counter += 1;
      const clientId = `client-${this.counter}`;
      this.clients.set(socket, { socket, alive: true, clientId });

      socket.on('pong', () => {
        const tracked = this.clients.get(socket);
        if (tracked) tracked.alive = true;
      });

      socket.on('message', (raw) => {
        // The only inbound message we honour is an explicit state resync request.
        try {
          const parsed = JSON.parse(raw.toString()) as { type?: string };
          if (parsed.type === 'ping') {
            this.send(socket, { type: 'connected', payload: { pong: true, ts: nowIso() }, ts: nowIso() });
          }
        } catch {
          /* ignore malformed client frames */
        }
      });

      socket.on('close', () => this.clients.delete(socket));
      socket.on('error', () => this.clients.delete(socket));

      this.send(socket, {
        type: 'connected',
        payload: { clientId, message: 'Connected to FleetGrid realtime. State is authoritative on the server.' },
        ts: nowIso(),
      });
    });

    this.heartbeat = setInterval(() => {
      for (const [socket, tracked] of this.clients) {
        if (!tracked.alive) {
          socket.terminate();
          this.clients.delete(socket);
          continue;
        }
        tracked.alive = false;
        try {
          socket.ping();
        } catch {
          this.clients.delete(socket);
        }
      }
    }, config.heartbeatMs);
    this.heartbeat.unref?.();
  }

  private send(socket: WebSocket, message: RealtimeMessage): void {
    if (socket.readyState !== socket.OPEN) return;
    socket.send(JSON.stringify(message));
  }

  /** Broadcast to every connected client. Called only after state is committed. */
  broadcast(type: RealtimeEventType, payload: unknown): void {
    const message: RealtimeMessage = { type, payload, ts: nowIso() };
    const serialised = JSON.stringify(message);
    for (const [socket, tracked] of this.clients) {
      if (socket.readyState === socket.OPEN) {
        socket.send(serialised);
        tracked.alive = true;
      }
    }
  }

  clientCount(): number {
    return this.clients.size;
  }

  async close(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    for (const socket of this.clients.keys()) socket.close();
    this.clients.clear();
    await new Promise<void>((resolve) => {
      if (!this.wss) return resolve();
      this.wss.close(() => resolve());
    });
  }
}

export const hub = new RealtimeHub();
export { REALTIME_PATH };
