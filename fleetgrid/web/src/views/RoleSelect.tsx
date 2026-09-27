import { useState } from 'react';
import { useFleet } from '../store/FleetContext';
import { cn } from '../lib/format';
import { BACKEND_LABEL } from '../lib/config';
import type { Mode } from '../lib/types';

const OPTIONS: Array<{
  id: Mode;
  label: string;
  kicker: string;
  description: string;
  points: string[];
}> = [
  {
    id: 'CONTROL_TOWER',
    label: 'Control Tower',
    kicker: '01. OPERATIONS',
    description: 'Network-wide operational picture with the incident and recovery desk.',
    points: ['Live network corridor', 'Fleet + capacity counters', 'Incident → analyze → approve → execute'],
  },
  {
    id: 'BUSINESS',
    label: 'Business',
    kicker: '02. SHIPPER',
    description: 'Find spare capacity on the corridor, reserve it, and track the shipment.',
    points: ['Capacity search', 'Atomic reservation', 'Shipment timeline'],
  },
  {
    id: 'DRIVER',
    label: 'Driver',
    kicker: '03. CAB',
    description: 'Assigned truck, start the journey, and report a breakdown from the road.',
    points: ['Start journey', 'Report incident', 'Status from server only'],
  },
];

/** Demo role selector. One application, three modes — open it on three laptops. */
export function RoleSelect() {
  const { setMode, connection, error } = useFleet();
  const [busy, setBusy] = useState<Mode | null>(null);

  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10 swiss-grid-pattern">
      <div className="w-full max-w-4xl border-2 border-base-600 bg-base-850 p-6 md:p-10 rounded-none shadow-none">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-12 w-12 place-items-center border-2 border-swiss-red bg-swiss-red text-white rounded-none">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" aria-hidden="true">
              <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" />
              <path d="M3 12.5 12 17l9-4.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" opacity="0.8" />
              <path d="M3 17 12 21l9-4" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" opacity="0.5" />
            </svg>
          </div>
          <div className="mt-4 text-3xs font-mono font-bold uppercase tracking-[0.24em] text-swiss-red">SWISS INTERNATIONAL SYSTEM</div>
          <h1 className="mt-1 text-3xl font-black uppercase tracking-tight text-white font-sans">FLEETGRID NETWORK</h1>
          <p className="mt-1.5 text-xs font-mono font-bold uppercase tracking-[0.2em] text-ink-300">
            AI LOGISTICS OPERATING SYSTEM
          </p>
          <p className="mt-4 max-w-md font-mono text-xs leading-relaxed text-ink-400">
            One authoritative server state powering Control Tower, Shipper, and Driver surfaces. Open across multiple devices for live synchronization.
          </p>
        </div>

        {error && (
          <div className="mx-auto mt-6 max-w-2xl border-2 border-swiss-red bg-swiss-red/10 px-4 py-3 text-xs font-mono font-bold uppercase text-swiss-red rounded-none">
            [ERROR] {error}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={busy !== null}
              onClick={() => {
                setBusy(option.id);
                void setMode(option.id).finally(() => setBusy(null));
              }}
              className={cn(
                'group flex flex-col border-2 border-base-600 bg-base-900 p-5 text-left transition-all rounded-none',
                'hover:border-swiss-red hover:bg-base-750 disabled:opacity-50',
                busy === option.id && 'border-swiss-red bg-base-750',
              )}
            >
              <span className="eyebrow text-swiss-red text-3xs tracking-[0.2em] font-bold">{option.kicker}</span>
              <span className="mt-1.5 text-lg font-black uppercase tracking-wide text-white font-sans">{option.label}</span>
              <span className="mt-2 text-xs font-mono leading-relaxed text-ink-300">{option.description}</span>
              <ul className="mt-4 space-y-1.5 border-t-2 border-base-700 pt-3">
                {option.points.map((point) => (
                  <li key={point} className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-ink-400">
                    <span className="h-1.5 w-1.5 bg-swiss-red" />
                    {point}
                  </li>
                ))}
              </ul>
              <span className="mt-5 text-2xs font-mono font-bold uppercase tracking-[0.16em] text-swiss-red opacity-100 group-hover:text-white transition-colors">
                {busy === option.id ? 'ENTERING…' : 'SELECT MODE →'}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-3xs font-bold uppercase tracking-[0.16em] text-ink-400 border-t-2 border-base-600 pt-5">
          <button
            type="button"
            onClick={() => void setMode('REGISTER')}
            className="flex items-center gap-2 text-swiss-red transition-colors hover:text-white font-bold"
          >
            <span className="h-2 w-2 bg-swiss-red" />
            CREATE ACCOUNT — DRIVER / BUSINESS
          </button>
          <span>·</span>
          <span className="flex items-center gap-2">
            <span
              className={cn(
                'h-2 w-2',
                connection === 'live' ? 'bg-healthy' : connection === 'offline' ? 'bg-swiss-red' : 'bg-warn',
              )}
            />
            STATUS: {connection}
          </span>
          <span>·</span>
          <span className="normal-case tracking-normal">{BACKEND_LABEL}</span>
          <span>·</span>
          <span>AUTHORITATIVE LOGISTICS ENGINE</span>
        </div>
      </div>
    </div>
  );
}

