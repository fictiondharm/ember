import { useMemo } from 'react';
import { cn, formatT } from '../lib/format';
import { progressFor, ROUTE_CORRIDOR } from '../lib/geo';
import { truckTone } from '../lib/tone';
import { StatusPill } from './Primitives';
import type { Incident, Truck } from '../lib/types';
import { flashClassFor, type FlashKind } from '../lib/flash';

const TONE_DOT: Record<string, string> = {
  healthy: 'bg-healthy',
  warn: 'bg-warn',
  danger: 'bg-danger',
  accent: 'bg-accent',
  neutral: 'bg-ink-500',
};

interface NetworkMapProps {
  trucks: Truck[];
  incidents: Incident[];
  flashIds: string[];
  flashTone: FlashKind;
  onSelectTruck?: (truckId: string) => void;
}

const LANE_HEIGHT = 62;

/**
 * LIVE NETWORK — schematic corridor diagram.
 *
 * Positions come from each truck's server-side coordinates projected onto the
 * Bengaluru → Hosur → Chennai corridor. This is intentionally a diagram, not a
 * map: no external map provider, and nothing here can break the demo.
 */
export function NetworkMap({ trucks, incidents, flashIds, flashTone, onSelectTruck }: NetworkMapProps) {
  const openIncidents = useMemo(
    () => incidents.filter((i) => i.status === 'OPEN' || i.status === 'ANALYZING' || i.status === 'ESCALATED'),
    [incidents],
  );

  const placed = useMemo(() => {
    const items = trucks
      .map((truck) => ({
        truck,
        progress: progressFor(truck.lat, truck.lng, truck.origin, truck.destination),
      }))
      .sort((a, b) => a.progress - b.progress);

    let lastProgress = -1;
    let lane = 0;
    return items.map((item) => {
      if (lastProgress >= 0 && item.progress - lastProgress < 0.09) lane += 1;
      else lane = 0;
      lastProgress = item.progress;
      return { ...item, lane };
    });
  }, [trucks]);

  const laneCount = Math.max(1, ...placed.map((p) => p.lane + 1));

  return (
    <div className="relative h-full min-h-[220px] w-full">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div
        className="absolute inset-x-0"
        style={{ top: `${Math.max(52, 108 - (laneCount - 1) * 16)}px` }}
      >
        <svg className="h-2 w-full" viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="fg-route" x1="0" x2="1">
              <stop offset="0%" stopColor="#343845" />
              <stop offset="45%" stopColor="#4C5361" />
              <stop offset="100%" stopColor="#343845" />
            </linearGradient>
          </defs>
          <line x1="0" y1="1" x2="100" y2="1" stroke="url(#fg-route)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      {/* City anchors with all corridor nodes */}
      {ROUTE_CORRIDOR.map((node, idx) => {
        const isMajor = ['Bengaluru', 'Hosur', 'Krishnagiri', 'Ambur', 'Vellore', 'Sriperumbudur', 'Chennai'].includes(node.city);
        const yOffset = idx % 2 === 0 ? '10px' : '25px';
        return (
          <div
            key={node.city}
            className="group absolute -translate-x-1/2 transition-opacity"
            style={{ left: `${node.progress * 100}%`, top: `calc(50% + ${yOffset})` }}
            title={`${node.city} (km ${Math.round(node.progress * 335)})`}
          >
            <div className="flex flex-col items-center gap-1">
              <span className={`h-1.5 w-1.5 rotate-45 border ${isMajor ? 'border-accent bg-base-900' : 'border-base-600 bg-base-800'}`} />
              <span className={`font-mono text-[8px] uppercase tracking-[0.08em] whitespace-nowrap ${isMajor ? 'text-ink-200 font-semibold' : 'text-ink-500 group-hover:text-ink-300'}`}>
                {node.city}
              </span>
            </div>
          </div>
        );
      })}

      {/* Trucks */}
      {placed.map(({ truck, progress, lane }) => {
        const tone = truckTone(truck.status);
        const hasIncident = openIncidents.some((i) => i.truckId === truck.id);
        const top = `calc(50% - ${(laneCount - 1) * 16}px - ${lane * LANE_HEIGHT}px - 30px)`;
        const isFlashed = flashIds.includes(truck.id);

        return (
          <button
            key={truck.id}
            type="button"
            onClick={() => onSelectTruck?.(truck.id)}
            className={cn(
              'group absolute z-10 -translate-x-1/2 rounded-md border bg-base-800/95 px-2.5 py-1.5 text-left backdrop-blur transition-all',
              isFlashed ? flashClassFor(flashTone, truck.id, flashIds) : '',
              hasIncident
                ? 'border-danger/60 shadow-incident'
                : 'border-base-600 hover:border-base-500',
            )}
            style={{ left: `${Math.min(96, Math.max(4, progress * 100))}%`, top }}
          >
            <div className="flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[tone])} />
              <span className="font-mono text-[11px] font-medium tracking-tight text-ink-50">{truck.id}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-ink-400">
              <span className="tabular">{formatT(truck.availableT)} free</span>
              <span className="text-ink-600">/</span>
              <span className="tabular">{formatT(truck.capacityT)}</span>
            </div>
            <div className="mt-1 h-px w-full bg-base-700">
              <div
                className={cn('h-px', TONE_DOT[tone])}
                style={{ width: `${(truck.availableT / Math.max(truck.capacityT, 0.001)) * 100}%` }}
              />
            </div>
            <div className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2">
              <span className="h-4 w-px bg-base-600" />
            </div>
            {hasIncident && (
              <div className="mt-1">
                <StatusPill status="incident" tone="danger" pulse />
              </div>
            )}
          </button>
        );
      })}

      {trucks.length === 0 && (
        <div className="absolute inset-0 grid place-items-center text-2xs text-ink-500">
          No trucks in the network.
        </div>
      )}

      <div className="absolute bottom-2 left-3 flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-ink-600">
        <span>Corridor schematic</span>
        <span className="h-2 w-px bg-base-600" />
        <span>Positions simulated</span>
      </div>
    </div>
  );
}
