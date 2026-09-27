import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useFleet } from '../store/FleetContext';
import { AppHeader } from '../components/AppHeader';
import { Panel, Placeholder } from '../components/Panel';
import { StatusPill } from '../components/Primitives';
import { EventFeed } from '../components/EventFeed';
import { cn, formatMoney, formatT, formatTime } from '../lib/format';
import { shipmentTone, truckTone } from '../lib/tone';
import type { CapacityMatch, Shipment, ShipmentEvent } from '../lib/types';

type Step = 'SEARCH' | 'SELECTED' | 'CONFIRMED';

/**
 * BUSINESS — shipper console.
 * Find compatible spare capacity, reserve it, and watch the shipment move.
 */
export function Business() {
  const { snapshot, session, refresh, connection, error: fleetError, flashIds } = useFleet();

  const [origin, setOrigin] = useState('Bengaluru');
  const [destination, setDestination] = useState('Chennai');
  const [weight, setWeight] = useState('1.0');
  const [cargoName, setCargoName] = useState('ABC Electronics');
  const [deadline, setDeadline] = useState('');

  const [matches, setMatches] = useState<CapacityMatch[] | null>(null);
  const [selected, setSelected] = useState<CapacityMatch | null>(null);
  const [confirmed, setConfirmed] = useState<Shipment | null>(null);
  const [step, setStep] = useState<Step>('SEARCH');
  // Other trucks near the selected one, so surplus capacity is visible up front.
  const [nearby, setNearby] = useState<Awaited<ReturnType<typeof api.nearbyCapacity>> | null>(null);
  const [nearbyNote, setNearbyNote] = useState<string | null>(null);

  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delivering, setDelivering] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [timelineFor, setTimelineFor] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<ShipmentEvent[]>([]);

  const shipperId = session?.organization?.id ?? snapshot.organizations.find((o) => o.type === 'SHIPPER')?.id ?? '';
  const myShipments = useMemo(
    () => snapshot.shipments.filter((s) => s.shipperId === shipperId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [snapshot.shipments, shipperId],
  );
  const activeShipment = useMemo(
    () => myShipments.find((s) => s.status !== 'DELIVERED') ?? null,
    [myShipments],
  );

  useEffect(() => {
    if (timelineFor) {
      let cancelled = false;
      api
        .timeline(timelineFor)
        .then((res) => {
          if (!cancelled) setTimeline(res.events);
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }
    setTimeline([]);
    return undefined;
  }, [timelineFor, snapshot.generatedAt]);

  async function findCapacity(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmed(null);
    setSelected(null);
    setStep('SEARCH');
    const weightT = Number(weight);
    if (!Number.isFinite(weightT) || weightT <= 0) {
      setError('Enter a valid shipment weight in tonnes, e.g. 1.0');
      return;
    }
    setSearching(true);
    try {
      const res = await api.capacity({ origin, destination, weightT });
      setMatches(res.matches);
      setStep('SEARCH');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function createShipment() {
    if (!selected) return;
    const weightT = Number(weight);
    if (!cargoName.trim()) {
      setError('Cargo name is required, e.g. "ABC Electronics".');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await api.createShipment({
        shipperId,
        cargoName: cargoName.trim(),
        origin,
        destination,
        weightT,
        capacityOfferId: selected.offer.id,
        ...(session?.user.id ? { actorId: session.user.id } : {}),
      });
      setConfirmed(res.shipment);
      setStep('CONFIRMED');
      setSelected(null);
      await refresh();    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
      setMatches(null);
    } finally {
      setCreating(false);
    }
  }

  function reset() {
    setStep('SEARCH');
    setSelected(null);
    setConfirmed(null);
    setMatches(null);
    setNearby(null);
    setNearbyNote(null);
    setError(null);
    setDeliveryError(null);
  }

  /**
   * Once a truck is picked, ask the server which other trucks are closest and how much
   * spare tonnage they still have. Distance is real great-circle arithmetic over stored
   * coordinates, and the response says so, so the UI never implies a routing provider.
   */
  async function loadNearby(match: CapacityMatch) {
    setNearby(null);
    setNearbyNote(null);
    try {
      const weightT = Number(weight);
      const res = await api.nearbyCapacity(match.truck.id, {
        origin: match.offer.origin,
        destination: match.offer.destination,
        ...(Number.isFinite(weightT) && weightT > 0 ? { weightT } : {}),
      });
      setNearby(res);
      setNearbyNote(res.note);
    } catch {
      // Suggestions are an aid, not a blocker: if this fails the booking still works.
      setNearby(null);
    }
  }

  /**
   * The business is the party that confirms receipt, so this is the only place the
   * delivery transition is triggered. It is a real server call: the backend
   * validates the state machine, records a hashed event, and broadcasts, so the
   * other devices see the delivered status without this client deciding anything.
   */
  async function confirmDelivery(shipment: Shipment) {
    setDelivering(shipment.id);
    setDeliveryError(null);
    try {
      await api.confirmDelivery(shipment.id, session?.user.id);
      await refresh();
    } catch (err) {
      setDeliveryError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setDelivering(null);
    }
  }

  return (
    <div className="relative z-10 min-h-screen">
      <AppHeader />

      <main className="px-4 py-4 lg:px-6">
        <div className="mx-auto max-w-[1400px] space-y-4">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-ink-50">Ship a load</h1>
              <p className="mt-0.5 text-xs text-ink-400">
                Reserve spare capacity already running on the Bengaluru → Chennai corridor.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-base-600 bg-base-850 px-3 py-1.5 text-2xs text-ink-400">
              <span className="text-ink-200">{session?.user.name ?? 'Business user'}</span>
              <span className="text-ink-600">·</span>
              <span>{session?.organization?.name ?? 'Shipper'}</span>
            </div>
          </header>

          {fleetError && (
            <div className="rounded-md border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-xs text-danger">
              {fleetError}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <div className="space-y-4">
              <Panel
                eyebrow="Step 1"
                title="Find transport capacity"
                actions={
                  step !== 'SEARCH' ? (
                    <button type="button" className="btn-quiet text-2xs" onClick={reset}>
                      Start over
                    </button>
                  ) : null
                }
              >
                <form onSubmit={findCapacity} className="grid gap-3 sm:grid-cols-4">
                  <Field label="Origin">
                    <input className="field" value={origin} onChange={(e) => setOrigin(e.target.value)} />
                  </Field>
                  <Field label="Destination">
                    <input className="field" value={destination} onChange={(e) => setDestination(e.target.value)} />
                  </Field>
                  <Field label="Weight (tonnes)">
                    <input
                      className="field tabular"
                      inputMode="decimal"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </Field>
                  <div className="flex items-end">
                    <button type="submit" className="btn-primary w-full" disabled={searching}>
                      {searching ? 'Searching…' : 'Find Capacity'}
                    </button>
                  </div>
                </form>

                {error && (
                  <div className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                    {error}
                  </div>
                )}

                {matches && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="eyebrow">
                        {matches.length} compatible truck{matches.length === 1 ? '' : 's'}
                      </span>
                      <span className="text-[10px] text-ink-500">Prices and ETAs are demo estimates</span>
                    </div>

                    {matches.length === 0 ? (
                      <div className="rounded-md border border-dashed border-base-600 px-4 py-6 text-center text-xs text-ink-400">
                        No compatible spare capacity for {weight}T on {origin} → {destination} right now.
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {matches.map((match) => {
                          const isSelected = selected?.offer.id === match.offer.id;
                          return (
                            <li
                              key={match.offer.id}
                              className={cn(
                                'flex flex-wrap items-center justify-between gap-3 rounded-md border px-3.5 py-3 transition-colors',
                                isSelected
                                  ? 'border-healthy/45 bg-healthy/[0.07]'
                                  : 'border-base-600 bg-base-900/50 hover:border-base-500',
                              )}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-semibold text-ink-50">{match.truck.id}</span>
                                  <StatusPill status={match.truck.status} tone={truckTone(match.truck.status)} />
                                </div>
                                <div className="mt-1 text-[11px] text-ink-400">
                                  {match.route} · ETA {match.etaLabel}
                                  {match.driverName ? ` · ${match.driverName}` : ''}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="tabular text-sm font-semibold text-healthy">
                                    {formatT(match.truck.availableT)}
                                  </div>
                                  <div className="text-[9px] uppercase tracking-[0.1em] text-ink-500">available</div>
                                </div>
                                <div className="text-right">
                                  <div className="tabular text-sm font-semibold text-ink-50">
                                    {formatMoney(match.truck.availableT * match.offer.pricePerT, match.currency)}
                                  </div>
                                  <div className="text-[9px] uppercase tracking-[0.1em] text-ink-500">
                                    {formatMoney(match.offer.pricePerT, match.currency)}/t
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={isSelected ? 'btn-ghost' : 'btn-primary'}
                                  onClick={() => {
                                    setSelected(match);
                                    setConfirmed(null);
                                    setError(null);
                                    setStep('SELECTED');
                                    setOrigin(match.offer.origin);
                                    setDestination(match.offer.destination);
                                    void loadNearby(match);
                                  }}
                                >
                                  {isSelected ? 'Selected' : 'Select Capacity'}
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </Panel>

              {step === 'SELECTED' && selected && (
                <Panel eyebrow="Step 2" title="Shipment summary">
                  <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                    <SummaryRow label="Cargo" value={cargoName || '—'} />
                    <SummaryRow label="Weight" value={`${formatT(Number(weight))}`} />
                    <SummaryRow label="Route" value={`${origin} → ${destination}`} />
                    <SummaryRow label="Truck" value={selected.truck.id} mono />
                    <SummaryRow
                      label="Capacity after booking"
                      value={`${formatT(Math.max(0, selected.truck.availableT - Number(weight)))} free`}
                    />
                    <SummaryRow
                      label="Demo price"
                      value={formatMoney(Number(weight) * selected.offer.pricePerT, selected.currency)}
                    />
                  </dl>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
                    <Field label="Cargo name">
                      <input
                        className="field"
                        value={cargoName}
                        onChange={(e) => setCargoName(e.target.value)}
                        placeholder="ABC Electronics"
                      />
                    </Field>
                    <Field label="Deadline (optional)">
                      <input
                        type="datetime-local"
                        className="field"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                      />
                    </Field>
                  </div>

                  <button
                    type="button"
                    className="btn-primary mt-4 w-full sm:w-auto"
                    onClick={createShipment}
                    disabled={creating}
                  >
                    {creating ? 'Reserving capacity…' : 'Reserve capacity & request driver'}
                  </button>
                  <p className="mt-2 text-[10px] leading-relaxed text-ink-500">
                    One server call reserves the capacity atomically and holds the load as{' '}
                    <span className="font-medium text-ink-400">CAPACITY_RESERVED</span>. It is not confirmed until the{' '}
                    {selected.truck.id} driver accepts it on their screen — until then the truck will not be allowed
                    to depart, and declining puts the tonnage back for you to rebook.
                  </p>
                </Panel>
              )}

              {step === 'SELECTED' && selected && nearby && nearby.suggestions.length > 0 && (
                <Panel
                  eyebrow="Nearby"
                  title="Other trucks close to this one"
                  bodyClassName="p-0"
                >
                  <ul className="divide-y divide-base-700">
                    {nearby.suggestions.map((s) => (
                      <li key={s.offer.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="font-mono text-xs font-semibold text-ink-100">{s.truck.id}</span>
                          <span className="truncate text-[10px] text-ink-500">{s.truck.registrationNo}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="tabular text-[11px] text-ink-300">{formatT(s.truck.availableT)} spare</span>
                          {s.canAlsoCarry && Number(weight) > 0 && (
                            <span className="rounded border border-healthy/35 bg-healthy/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-healthy">
                              can take this
                            </span>
                          )}
                          <span className="tabular w-20 text-right text-[10px] text-ink-500">
                            {s.proximityLabel}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {nearbyNote && (
                    <p className="border-t border-base-700 px-4 py-2 text-[10px] leading-relaxed text-ink-600">
                      {nearbyNote}
                    </p>
                  )}
                </Panel>
              )}

              {step === 'CONFIRMED' && confirmed && (
                <div
                  className={cn(
                    'rounded-lg border p-4',
                    confirmed.status === 'CAPACITY_RESERVED'
                      ? 'border-warn/45 bg-warn/[0.06]'
                      : 'border-healthy/40 bg-healthy/[0.06]',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'grid h-5 w-5 place-items-center rounded-full border text-[11px]',
                        confirmed.status === 'CAPACITY_RESERVED'
                          ? 'border-warn/50 text-warn'
                          : 'border-healthy/50 text-healthy',
                      )}
                    >
                      {confirmed.status === 'CAPACITY_RESERVED' ? '⏳' : '✓'}
                    </span>
                    <span
                      className={cn(
                        'text-2xs font-semibold uppercase tracking-[0.18em]',
                        confirmed.status === 'CAPACITY_RESERVED' ? 'text-warn' : 'text-healthy',
                      )}
                    >
                      {confirmed.status === 'CAPACITY_RESERVED'
                        ? 'Capacity reserved — waiting for the driver'
                        : 'Shipment Confirmed'}
                    </span>
                  </div>

                  {confirmed.status === 'CAPACITY_RESERVED' && (
                    <p className="mt-2.5 text-[11px] leading-relaxed text-ink-400">
                      The tonnage is held on {confirmed.truckId} and no other shipper can take it, but the load is
                      not confirmed yet. Switch to the <span className="text-ink-200">Driver</span> screen and
                      accept it — the truck cannot depart until you do.
                    </p>
                  )}

                  <dl className="tabular mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-3">
                    <SummaryRow label="Shipment ID" value={confirmed.id} mono />
                    <SummaryRow label="Truck ID" value={confirmed.truckId ?? '—'} mono />
                    <SummaryRow label="Current status" value={confirmed.status} />
                    <SummaryRow label="Cargo" value={confirmed.cargoName} />
                    <SummaryRow label="Weight" value={formatT(confirmed.weightT)} />
                    <SummaryRow
                      label="Route"
                      value={`${confirmed.origin} → ${confirmed.destination}`}
                    />
                  </dl>
                  <div className="mt-3">
                    <Placeholder>
                      Payment capture is a phase-2 integration. This build stops at a reserved, capacity-held
                      shipment — nothing claims a payment was taken.
                    </Placeholder>
                  </div>
                </div>
              )}

              <Panel eyebrow="My shipments" title="Tracking" bodyClassName="p-0" className="min-h-[200px]">
                {myShipments.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-ink-400">No shipments yet.</div>
                ) : (
                  <ul className="divide-y divide-base-700">
                    {myShipments.map((s) => {
                      const truck = snapshot.trucks.find((t) => t.id === s.truckId);
                      const open = timelineFor === s.id;
                      return (
                        <li key={s.id} className={cn(flashIds.includes(s.id) && 'animate-flash-row')}>
                          <button
                            type="button"
                            className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-base-750/50"
                            onClick={() => setTimelineFor(open ? null : s.id)}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-ink-50">{s.id}</span>
                                <span className="truncate text-xs text-ink-300">{s.cargoName}</span>
                              </div>
                              <div className="mt-0.5 text-[10px] text-ink-500">
                                {formatT(s.weightT)} · {s.origin} → {s.destination} ·{' '}
                                <span className="font-mono">{s.truckId ?? 'unassigned'}</span>
                                {truck ? ` · ${formatT(truck.availableT)} free` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusPill
                                status={s.status}
                                tone={shipmentTone(s.status)}
                                pulse={s.status === 'AT_RISK'}
                              />
                              <span className="font-mono text-[10px] text-ink-500">
                                {formatTime(s.updatedAt)}
                              </span>
                            </div>
                          </button>
                          {open && (
                            <div className="max-h-[260px] overflow-auto border-t border-base-700 bg-base-900/40">
                              <EventFeed events={timeline} limit={20} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel eyebrow="Network capacity" title="Spare tonnage right now" bodyClassName="p-3.5">
                <ul className="space-y-2">
                  {snapshot.trucks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 rounded border border-base-600 bg-base-900/50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-ink-50">{t.id}</span>
                        <StatusPill status={t.status} tone={truckTone(t.status)} />
                      </div>
                      <span className="tabular font-mono text-[11px] text-ink-300">
                        {formatT(t.availableT)} / {formatT(t.capacityT)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-[10px] leading-relaxed text-ink-500">
                  Live from the server. A reservation on any device reduces these numbers for every other device
                  immediately.
                </p>
              </Panel>

              {activeShipment && (
                <Panel eyebrow="Active shipment" title={activeShipment.id} bodyClassName="p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-ink-50">{activeShipment.cargoName}</span>
                    <StatusPill
                      status={activeShipment.status}
                      tone={shipmentTone(activeShipment.status)}
                      pulse={activeShipment.status === 'AT_RISK'}
                    />
                  </div>
                  <div className="tabular mt-1.5 text-[11px] text-ink-400">
                    {formatT(activeShipment.weightT)} · {activeShipment.origin} → {activeShipment.destination} ·{' '}
                    <span className="font-mono">{activeShipment.truckId ?? 'unassigned'}</span>
                  </div>
                  {activeShipment.status === 'AT_RISK' && (
                    <div className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[11px] text-danger">
                      Disruption reported on {activeShipment.truckId}. The Control Tower owns the recovery decision —
                      a revised ETA appears here once an operator executes an approved plan.
                    </div>
                  )}
                  {activeShipment.status === 'IN_TRANSIT' && (
                    <div className="mt-3 space-y-2.5">
                      <div className="rounded-md border border-accent/35 bg-accent/[0.08] px-3 py-2 text-[11px] text-[#8FB4FF]">
                        In transit. Confirm receipt once the load reaches {activeShipment.destination}.
                      </div>
                      <button
                        type="button"
                        className="btn-primary w-full"
                        disabled={delivering === activeShipment.id}
                        onClick={() => confirmDelivery(activeShipment)}
                      >
                        {delivering === activeShipment.id ? 'Confirming…' : 'Confirm Delivery'}
                      </button>
                      <p className="text-[10px] leading-relaxed text-ink-500">
                        The server validates the state machine, records a hashed delivery event, and releases the
                        truck once it has no cargo left. No other device can mark this shipment delivered.
                      </p>
                    </div>
                  )}
                  {deliveryError && (
                    <div className="mt-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[11px] text-danger">
                      {deliveryError}
                    </div>
                  )}
                </Panel>
              )}

              <Placeholder>
                Realtime is {connection}. ElevenLabs voice intake for drivers and disruption notifications land in a
                later phase.
              </Placeholder>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className={cn('mt-0.5 text-sm text-ink-50', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  );
}
