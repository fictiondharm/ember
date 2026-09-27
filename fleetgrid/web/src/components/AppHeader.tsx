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
  offline: { label: 'OFFLINE', dot: 'bg-swiss-red', text: 'text-swiss-red' },
};

const MODES: Array<{ id: Mode; label: string; short: string }> = [
  { id: 'CONTROL_TOWER', label: 'Control Tower', short: 'Tower' },
  { id: 'LIVE_MAP', label: 'Live GPS Map', short: 'Live Map' },
  { id: 'PAYMENTS', label: 'Dodo Payments', short: 'Payments' },
  { id: 'BUSINESS', label: 'Business', short: 'Business' },
  { id: 'DRIVER', label: 'Driver', short: 'Driver' },
];

interface AppHeaderProps {
  children?: ReactNode;
}

export function AppHeader({ children }: AppHeaderProps) {
  const { connection, mode, setMode, lastEvent, theme, toggleTheme } = useFleet();
  const [switching, setSwitching] = useState(false);
  const copy = CONNECTION_COPY[connection];

  return (
    <header className="sticky top-0 z-30 border-b-2 border-base-600 bg-base-950/95 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          <FleetMark />
          <div className="leading-none">
            <div className="text-sm font-black tracking-[0.14em] text-white uppercase font-sans">FLEETGRID</div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-swiss-red font-mono">
              AI Logistics Network
            </div>
          </div>
        </div>

        <div className={cn('flex items-center gap-2 text-2xs font-mono font-bold uppercase tracking-[0.16em]', copy.text)}>
          <span className="relative flex h-2 w-2">
            {connection === 'live' && (
              <span className={cn('absolute inline-flex h-full w-full opacity-70', copy.dot, 'animate-pulse-ring')} />
            )}
            <span className={cn('relative inline-flex h-2 w-2', copy.dot)} />
          </span>
          {copy.label}
        </div>

        <div className="hidden font-mono text-[10px] text-ink-400 uppercase tracking-[0.08em] lg:block" title="Authoritative backend origin">
          {BACKEND_LABEL}
        </div>

        {lastEvent && (
          <div className="hidden font-mono text-[10px] text-ink-400 uppercase tracking-[0.08em] xl:block" title="Most recent realtime event">
            LAST · {lastEvent.type}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 border-2 border-base-600 bg-base-900 px-3 py-1.5 text-2xs font-mono font-bold uppercase tracking-[0.14em] transition-colors hover:border-swiss-red hover:text-swiss-red text-ink-50 rounded-none"
            title="Toggle Swiss Light / Dark Theme"
          >
            {theme === 'dark' ? '☀️ SWISS LIGHT' : '🌙 SWISS DARK'}
          </button>

          <div className="flex items-center border-2 border-base-600 bg-base-900 p-0.5 rounded-none">

          {MODES.map((m) => {
            const active = mode === m.id;
            const isMap = m.id === 'LIVE_MAP';
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSwitching(true);
                  void setMode(m.id).finally(() => setSwitching(false));
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-2xs font-bold uppercase tracking-[0.12em] transition-colors rounded-none border',
                  active
                    ? isMap
                      ? 'border-healthy bg-healthy text-base-950 font-black'
                      : 'border-swiss-red bg-swiss-red text-white font-black'
                    : isMap
                      ? 'border-transparent text-healthy hover:bg-healthy/10'
                      : 'border-transparent text-ink-300 hover:text-ink-50 hover:bg-base-750',
                  switching && !active && 'opacity-60',
                )}
              >
                {isMap && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping bg-healthy opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 bg-healthy" />
                  </span>
                )}
                {m.short}
              </button>
            );
          })}
        </div>
        </div>
      </div>
      {children}
    </header>

  );
}

function FleetMark() {
  return (
    <span className="relative grid h-8 w-8 place-items-center border-2 border-swiss-red bg-swiss-red text-white rounded-none">
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" aria-hidden="true">
        <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" />
        <path d="M3 12.5 12 17l9-4.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" opacity="0.8" />
        <path d="M3 17 12 21l9-4" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" opacity="0.5" />
      </svg>
    </span>
  );
}

