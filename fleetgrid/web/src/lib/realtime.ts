import { useCallback, useEffect, useRef, useState } from 'react';
import { WS_URL } from './config';
import type { RealtimeMessage } from './types';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

interface UseRealtimeOptions {
  onMessage: (message: RealtimeMessage) => void;
  /** Called after a successful (re)connect so the client can refetch server state. */
  onOpen: () => void;
}

const MAX_BACKOFF_MS = 8000;

/**
 * Realtime client.
 *
 * Master PRD §15: realtime is a notification channel, never the source of truth.
 * On every open — first connect or reconnect — we ask the caller to refetch
 * authoritative state from the server, so a dropped event can never leave a
 * device showing stale data.
 */
export function useRealtime({ onMessage, onOpen }: UseRealtimeOptions): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const retryRef = useRef<number | null>(null);
  const closedRef = useRef(false);

  // Keep the latest callbacks without reconnecting on every render.
  const handlers = useRef({ onMessage, onOpen });
  handlers.current = { onMessage, onOpen };

  const connect = useCallback(() => {
    if (closedRef.current) return;
    setStatus(attemptRef.current === 0 ? 'connecting' : 'reconnecting');

    let socket: WebSocket;
    try {
      socket = new WebSocket(WS_URL);
    } catch {
      scheduleRetry();
      return;
    }
    socketRef.current = socket;

    socket.onopen = () => {
      attemptRef.current = 0;
      setStatus('live');
      handlers.current.onOpen();
    };

    socket.onmessage = (event) => {
      try {
        handlers.current.onMessage(JSON.parse(event.data) as RealtimeMessage);
      } catch {
        /* ignore malformed frames */
      }
    };

    socket.onerror = () => {
      /* onclose handles the retry */
    };

    socket.onclose = () => {
      socketRef.current = null;
      if (closedRef.current) return;
      setStatus('reconnecting');
      scheduleRetry();
    };

    function scheduleRetry() {
      if (closedRef.current) return;
      attemptRef.current += 1;
      const delay = Math.min(MAX_BACKOFF_MS, 400 * 2 ** (attemptRef.current - 1));
      retryRef.current = window.setTimeout(connect, delay);
    }
  }, []);

  useEffect(() => {
    closedRef.current = false;
    connect();
    return () => {
      closedRef.current = true;
      if (retryRef.current) window.clearTimeout(retryRef.current);
      socketRef.current?.close();
    };
  }, [connect]);

  return status;
}
