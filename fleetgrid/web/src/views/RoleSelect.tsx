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
    id: 'LANDING',
    label: 'Landing Page',
    kicker: 'Public',
    description: 'Corporate overview with embedded interactive Google Maps corridor & agent loops.',
    points: ['Corridor showcase', 'Live highway engine', 'Architecture blueprint'],
  },
  {
    id: 'CONTROL_TOWER',
    label: 'Control Tower',
    kicker: 'Operations',
    description: 'Network-wide operational picture with the incident and autonomous recovery desk.',
    points: ['Live network corridor', 'Fleet + capacity counters', 'Incident → approve → execute'],
  },
  {
    id: 'LIVE_MAP',
    label: 'Live Google Map',
    kicker: 'Telematics',
    description: 'Fullscreen interactive Google Maps slippy engine with live GPS vehicle heading & detours.',
    points: ['Google Road & Satellite', 'Active vehicle rotations', 'Bypass rerouting corridor'],
  },
  {
    id: 'PAYMENTS',
    label: 'Dodo Payments Hub',
    kicker: 'Escrow',
    description: 'Carrier freight settlement via Dodo Payments gateway, instant receipts & audit ledger.',
    points: ['Dodo live checkout', 'Instant escrow release', 'Verifiable crypt receipts'],
  },
  {
    id: 'BUSINESS',
    label: 'Business Shipper',
    kicker: 'Shipper',
    description: 'Find spare capacity on the corridor, reserve it, and track shipments in real time.',
    points: ['Capacity search & split-loads', 'Atomic reservation', 'Shipment timeline'],
  },
  {
    id: 'DRIVER',
    label: 'Driver Cab & SOS',
    kicker: 'Driver',
    description: 'In-cab dashboard with assigned load, emergency SOS panic beacon & ElevenLabs AI voice.',
    points: ['Start journey', 'Critical Emergency SOS', 'ElevenLabs Voice Booking'],
  },
];

/** Demo role selector. One application, three modes — open it on three laptops. */
export function RoleSelect() {
  const { setMode, connection, error } = useFleet();
  const [busy, setBusy] = useState<Mode | null>(null);

  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-11 w-11 place-items-center rounded-md border border-healthy/30 bg-healthy/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-healthy" fill="none" aria-hidden="true">
              <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M3 12.5 12 17l9-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" opacity="0.55" />
              <path d="M3 17 12 21l9-4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" opacity="0.3" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink-50">FleetGrid</h1>
          <p className="mt-1.5 text-2xs font-medium uppercase tracking-[0.2em] text-ink-500">
            Autonomous Freight Operating System
          </p>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-400">
            Unified multi-portal platform connected to the live corridor state engine. Select a portal to begin.
          </p>
        </div>

        {error && (
          <div className="mx-auto mt-6 max-w-2xl rounded-md border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-xs text-danger">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                'group flex flex-col rounded-lg border border-base-600 bg-base-800/80 p-4 text-left transition-all',
                'hover:border-base-500 hover:bg-base-750/70 disabled:opacity-50',
                busy === option.id && 'border-healthy/50',
              )}
            >
              <span className="eyebrow">{option.kicker}</span>
              <span className="mt-1.5 text-base font-semibold tracking-tight text-ink-50">{option.label}</span>
              <span className="mt-1.5 text-xs leading-relaxed text-ink-400">{option.description}</span>
              <ul className="mt-3 space-y-1 border-t border-base-700 pt-3">
                {option.points.map((point) => (
                  <li key={point} className="flex items-center gap-1.5 text-[10px] text-ink-500">
                    <span className="h-1 w-1 rounded-full bg-base-500" />
                    {point}
                  </li>
                ))}
              </ul>
              <span className="mt-4 text-2xs font-semibold uppercase tracking-[0.14em] text-healthy opacity-0 transition-opacity group-hover:opacity-100">
                {busy === option.id ? 'Entering…' : 'Enter →'}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-600">
          <button
            type="button"
            onClick={() => void setMode('REGISTER')}
            className="flex items-center gap-1.5 text-healthy/80 transition-colors hover:text-healthy"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-healthy" />
            Create an account — driver or business
          </button>
          <span>·</span>
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                connection === 'live' ? 'bg-healthy' : connection === 'offline' ? 'bg-danger' : 'bg-warn',
              )}
            />
            {connection}
          </span>
          <span>·</span>
          <span className="font-mono normal-case tracking-normal">{BACKEND_LABEL}</span>
          <span>·</span>
          <span>Server-authoritative state</span>
        </div>
      </div>
    </div>
  );
}
