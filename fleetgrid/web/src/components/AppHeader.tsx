import { useState, type ReactNode } from 'react';
import { cn } from '../lib/format';
import { BACKEND_LABEL } from '../lib/config';
import { useFleet } from '../store/FleetContext';
import type { ConnectionStatus } from '../lib/realtime';
import type { Mode } from '../lib/types';

const CONNECTION_COPY: Record<ConnectionStatus, { label: string; dot: string; text: string }> = {
  connecting: { label: 'CONNECTING', dot: 'bg-warn', text: 'text-warn' },
  live: { label: 'NETWORK LIVE', dot: 'bg-healthy', text: 'text-healthy' },
  reconnecting: { label: 'RECONNECTING', dot: 'bg-warn', text: 'text-warn' },
  offline: { label: 'OFFLINE', dot: 'bg-danger', text: 'text-danger' },
};

const MODES: Array<{ id: Mode; label: string; short: string }> = [
  { id: 'CONTROL_TOWER', label: 'Control Tower', short: 'Tower' },
  { id: 'BUSINESS', label: 'Business', short: 'Business' },
  { id: 'DRIVER', label: 'Driver', short: 'Driver' },
];

interface AppHeaderProps {
  children?: ReactNode;
}

export function AppHeader({ children }: AppHeaderProps) {
  const { connection, mode, setMode, lastEvent } = useFleet();
  const [switching, setSwitching] = useState(false);
  const copy = CONNECTION_COPY[connection];

  return (
    <header className="sticky top-0 z-30 border-b border-base-600 bg-base-950/90 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 lg:px-6">
        <div className="flex items-center gap-2.5">
          <FleetMark />
          <div className="leading-none">
            <div className="text-sm font-semibold tracking-[0.02em] text-ink-50">FLEETGRID</div>
            <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.18em] text-ink-500">
              AI Logistics Network
            </div>
          </div>
        </div>

        <div className={cn('flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.14em]', copy.text)}>
          <span className="relative flex h-1.5 w-1.5">
            {connection === 'live' && (
              <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-70', copy.dot, 'animate-pulse-ring')} />
            )}
            <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', copy.dot)} />
          </span>
          {copy.label}
        </div>

        <div className="hidden font-mono text-[10px] text-ink-500 lg:block" title="Authoritative backend origin">
          {BACKEND_LABEL}
        </div>

        {lastEvent && (
          <div className="hidden font-mono text-[10px] text-ink-500 xl:block" title="Most recent realtime event">
            last · {lastEvent.type}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1 rounded-md border border-base-600 bg-base-850 p-0.5">
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSwitching(true);
                  void setMode(m.id).finally(() => setSwitching(false));
                }}
                className={cn(
                  'rounded px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-[0.1em] transition-colors',
                  active ? 'bg-ink-50 text-base-950' : 'text-ink-400 hover:text-ink-100',
                  switching && !active && 'opacity-60',
                )}
              >
                {m.short}
              </button>
            );
          })}
        </div>
      </div>
      {children}
    </header>
  );
}

function FleetMark() {
  return (
    <span className="relative grid h-7 w-7 place-items-center rounded border border-healthy/30 bg-healthy/10">
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-healthy" fill="none" aria-hidden="true">
        <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M3 12.5 12 17l9-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" opacity="0.55" />
        <path d="M3 17 12 21l9-4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" opacity="0.3" />
      </svg>
    </span>
  );
}
