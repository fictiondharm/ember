import { cn, formatRelative, formatTime, humanizeEventType } from '../lib/format';
import { EmptyState } from './Panel';
import type { ShipmentEvent } from '../lib/types';

const AGENT_PREFIXES = ['recovery.', 'incident.', 'capacity.', 'truck.incident', 'truck.recovery'];

function isAgentEvent(type: string): boolean {
  return AGENT_PREFIXES.some((p) => type.startsWith(p));
}

interface EventFeedProps {
  events: ShipmentEvent[];
  limit?: number;
  filter?: 'all' | 'agent';
  emptyHint?: string;
}

/** AGENT ACTIVITY / RECENT EVENTS — the append-only log, newest first. */
export function EventFeed({ events, limit = 40, filter = 'all', emptyHint }: EventFeedProps) {
  const rows = events
    .filter((e) => (filter === 'agent' ? isAgentEvent(e.eventType) : true))
    .slice()
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, limit);

  if (rows.length === 0) {
    return (
      <EmptyState
        title={filter === 'agent' ? 'No agent activity yet' : 'No events yet'}
        hint={emptyHint ?? 'Every state change is appended to the server-side event log.'}
      />
    );
  }

  return (
    <ol className="scrollbar-thin h-full space-y-0 overflow-auto">
      {rows.map((event, index) => (
        <li
          key={event.id}
          className={cn(
            'relative flex gap-3 px-4 py-2.5 transition-colors hover:bg-base-750/40',
            index < rows.length - 1 && 'border-b border-base-700/60',
          )}
        >
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-base-500" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-medium text-ink-100">
                {humanizeEventType(event.eventType)}
              </span>
              <span className="tabular shrink-0 font-mono text-[10px] text-ink-500">
                {formatTime(event.timestamp)}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-ink-500">
              <span className="uppercase tracking-[0.1em]">{event.actorType.toLowerCase()}</span>
              {event.truckId && <span className="font-mono">{event.truckId}</span>}
              {event.shipmentId && <span className="font-mono">{event.shipmentId}</span>}
              {event.proofStatus === 'CONFIRMED' && (
                <span className="text-healthy">proof confirmed</span>
              )}
              {event.proofStatus === 'NOT_ANCHORED' && (
                <span title="Hash only. No blockchain anchoring in this phase." className="text-ink-600">
                  hash only
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-ink-600">
              <span className="font-mono">{event.hash.slice(0, 10)}</span>
              <span>·</span>
              <span>{formatRelative(event.timestamp)}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
