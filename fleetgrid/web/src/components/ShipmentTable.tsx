import { formatT, humanizeStatus, cn } from '../lib/format';
import { shipmentTone } from '../lib/tone';
import { StatusPill } from './Primitives';
import { EmptyState } from './Panel';
import type { Shipment, Truck } from '../lib/types';

interface ShipmentTableProps {
  shipments: Shipment[];
  trucks: Truck[];
  flashIds: string[];
  emptyHint?: string;
}

const ACTIVE_STATES = new Set(['DRAFT', 'CAPACITY_RESERVED', 'CONFIRMED', 'IN_TRANSIT', 'AT_RISK', 'RECOVERY']);

/** ACTIVE SHIPMENTS — server state only, with the assigned truck resolved from live truck data. */
export function ShipmentTable({ shipments, trucks, flashIds, emptyHint }: ShipmentTableProps) {
  const active = shipments.filter((s) => ACTIVE_STATES.has(s.status));

  if (active.length === 0) {
    return <EmptyState title="No active shipments" hint={emptyHint ?? 'Create one from Business mode to see it here instantly.'} />;
  }

  return (
    <div className="scrollbar-thin h-full overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-base-800">
          <tr className="border-b border-base-600 text-left">
            <Th>Shipment</Th>
            <Th>Cargo</Th>
            <Th>Route</Th>
            <Th align="right">Weight</Th>
            <Th>Truck</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {active.map((s) => {
            const truck = s.truckId ? trucks.find((t) => t.id === s.truckId) : undefined;
            return (
              <tr
                key={s.id}
                className={cn(
                  'border-b border-base-700/70 transition-colors hover:bg-base-750/50',
                  flashIds.includes(s.id) && 'animate-flash-row',
                )}
              >
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span className="font-mono text-xs text-ink-100">{s.id}</span>
                </td>
                <td className="max-w-[180px] truncate px-4 py-2.5 text-ink-200">{s.cargoName}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-300">
                  {s.origin} <span className="text-ink-600">→</span> {s.destination}
                </td>
                <td className="tabular whitespace-nowrap px-4 py-2.5 text-right text-ink-200">{formatT(s.weightT)}</td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  {s.truckId ? (
                    <span className="font-mono text-xs text-ink-200">
                      {s.truckId}
                      {truck && (
                        <span className="ml-2 text-[10px] text-ink-500">{formatT(truck.availableT)} free</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-2xs text-ink-500">unassigned</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <StatusPill
                    status={s.status}
                    tone={shipmentTone(s.status)}
                    pulse={s.status === 'AT_RISK'}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={cn(
        'px-4 py-2 text-2xs font-medium uppercase tracking-[0.12em] text-ink-500',
        align === 'right' && 'text-right',
      )}
    >
      {children}
    </th>
  );
}

export { humanizeStatus };
