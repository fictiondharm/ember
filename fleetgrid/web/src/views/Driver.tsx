import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { flashClassFor } from '../lib/flash';
import { useFleet } from '../store/FleetContext';
import { AppHeader } from '../components/AppHeader';
import { Panel, Placeholder } from '../components/Panel';
import { StatusPill } from '../components/Primitives';
import { ElevenLabsVoiceAssistant } from '../components/ElevenLabsVoiceAssistant';
import { cn, formatT, formatRelative } from '../lib/format';
import { incidentTypeLabel, shipmentTone, truckTone } from '../lib/tone';
import type { IncidentType, Driver as DriverType } from '../lib/types';

const INCIDENT_TYPES: Array<{ value: IncidentType; label: string; defaultLocation: string; defaultDescription: string }> = [
  {
    value: 'TRUCK_BREAKDOWN',
    label: 'Truck Breakdown',
    defaultLocation: 'Hosur (NH-48 km 42)',
    defaultDescription: 'Engine failure / truck unable to continue',
  },
  { value: 'ACCIDENT', label: 'Accident', defaultLocation: 'Hosur (NH-48 km 42)', defaultDescription: 'Highway collision / road hazard' },
  { value: 'DELAY', label: 'Delay', defaultLocation: 'Hosur (NH-48 km 42)', defaultDescription: 'Traffic bottleneck / running behind schedule' },
  { value: 'ROUTE_BLOCKED', label: 'Route Blocked', defaultLocation: 'Hosur (NH-48 km 42)', defaultDescription: 'Road closure / detour required' },
  { value: 'CARGO_DAMAGE', label: 'Cargo Damage', defaultLocation: 'Hosur (NH-48 km 42)', defaultDescription: 'Cargo seal damaged or shifted' },
  { value: 'OTHER', label: 'Other', defaultLocation: 'Hosur (NH-48 km 42)', defaultDescription: 'Other road emergency' },
];

const EMERGENCY_REASONS = [
  { id: 'engine_fire', label: '🔥 Engine Failure / Smoke', desc: 'Critical mechanical breakdown; vehicle immobilized on highway shoulder' },
  { id: 'accident', label: '💥 Highway Collision / Accident', desc: 'Involved in collision; medical & tow support requested' },
  { id: 'hijack_hazard', label: '🚨 Road Blockade / Cargo Threat', desc: 'Hostile obstruction or unauthorized vehicle stoppage' },
  { id: 'medical', label: '🏥 Driver Medical Emergency', desc: 'Sudden illness or fatigue; immediate relief driver required' },
];

// Seeded roster stats for enriched driver experience
const DRIVER_METRICS: Record<string, { safetyScore: number; completedHauls: number; license: string }> = {
  drv_ravi_kumar: { safetyScore: 99.4, completedHauls: 184, license: 'DL-04-2018-992144' },
  drv_imran_sheikh: { safetyScore: 98.8, completedHauls: 156, license: 'DL-09-2019-441029' },
  drv_suresh_naidu: { safetyScore: 97.9, completedHauls: 142, license: 'DL-03-2020-881240' },
  drv_anita_fernandes: { safetyScore: 99.8, completedHauls: 210, license: 'DL-04-2017-331902' },
  drv_vikram_reddy: { safetyScore: 98.2, completedHauls: 129, license: 'DL-21-2021-771804' },
  drv_meena_subramanian: { safetyScore: 99.1, completedHauls: 167, license: 'DL-22-2019-552199' },
  drv_harish_gowda: { safetyScore: 96.5, completedHauls: 98, license: 'DL-51-2022-114402' },
  drv_divya_pillai: { safetyScore: 99.6, completedHauls: 175, license: 'DL-07-2018-662391' },
  drv_ganesh_murthy: { safetyScore: 98.5, completedHauls: 133, license: 'DL-10-2020-994411' },
};

export function Driver() {
  const { snapshot, session, refresh, connection, flashIds, flashTone, setMode } = useFleet();

  // Active View Tab: 'CAB' (individual driver cabin) or 'ROSTER' (fleet drivers directory)
  const [activeTab, setActiveTab] = useState<'CAB' | 'ROSTER'>('CAB');

  // Selected driver ID (defaults to logged-in driver or Ravi Kumar FG-027)
  const [selectedDriverId, setSelectedDriverId] = useState<string>(
    session?.driver?.id ?? 'drv_ravi_kumar',
  );

  const activeDriver: DriverType | null = useMemo(() => {
    return (
      snapshot.drivers.find((d) => d.id === selectedDriverId) ??
      snapshot.drivers.find((d) => d.id === (session?.driver?.id ?? 'drv_ravi_kumar')) ??
      snapshot.drivers[0] ??
      null
    );
  }, [snapshot.drivers, selectedDriverId, session?.driver?.id]);

  const truckId = activeDriver?.assignedTruckId ?? session?.driver?.assignedTruckId ?? 'FG-027';
  const truck = snapshot.trucks.find((t) => t.id === truckId) ?? null;

  const assigned = useMemo(
    () =>
      snapshot.shipments
        .filter((s) => s.truckId === truckId && s.status !== 'DELIVERED')
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [snapshot.shipments, truckId],
  );
  const cargo = assigned[0] ?? null;

  const myIncidents = useMemo(
    () =>
      snapshot.incidents
        .filter((i) => i.truckId === truckId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [snapshot.incidents, truckId],
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [selectedSosReason, setSelectedSosReason] = useState(EMERGENCY_REASONS[0]?.id ?? 'engine_fire');

  const [incidentType, setIncidentType] = useState<IncidentType>('TRUCK_BREAKDOWN');
  const [location, setLocation] = useState('Hosur (NH-48 km 42)');
  const [description, setDescription] = useState('Engine failure / truck unable to continue');

  // Offers queue from server
  const [queue, setQueue] = useState<Awaited<ReturnType<typeof api.driverOffers>> | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const driverId = activeDriver?.id ?? session?.driver?.id ?? null;

  useEffect(() => {
    if (!driverId) {
      setQueue(null);
      return;
    }
    let cancelled = false;
    void api
      .driverOffers(driverId)
      .then((res) => {
        if (!cancelled) {
          setQueue(res);
          setQueueError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setQueueError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [driverId, snapshot]);

  const pending = queue?.pending ?? [];
  const accepted = queue?.accepted ?? [];

  async function acceptOffer(shipmentId: string) {
    setActing(shipmentId);
    setError(null);
    try {
      await api.acceptShipment(shipmentId, driverId ?? undefined);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setActing(null);
    }
  }

  async function declineOffer(shipmentId: string) {
    setActing(shipmentId);
    setError(null);
    try {
      await api.declineShipment(shipmentId, 'Driver declined from cab console', driverId ?? undefined);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setActing(null);
    }
  }

  const canDepart =
    !!truck &&
    ['ASSIGNED', 'AVAILABLE', 'DELAYED'].includes(truck.status) &&
    !!cargo &&
    cargo.status !== 'IN_TRANSIT' &&
    pending.length === 0;

  const inTransit = truck?.status === 'IN_TRANSIT';
  const isSosIncident = truck?.status === 'INCIDENT' || myIncidents.some((i) => i.status === 'OPEN' || i.status === 'ANALYZING');

  async function startJourney() {
    if (!truck) return;
    setBusy(true);
    setError(null);
    try {
      await api.depart(truck.id, driverId ?? undefined);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function pickType(value: IncidentType) {
    setIncidentType(value);
    const preset = INCIDENT_TYPES.find((t) => t.value === value);
    if (preset) {
      setLocation(preset.defaultLocation);
      setDescription(preset.defaultDescription);
    }
  }

  // Regular Incident Reporting
  async function reportIncident() {
    if (!truck) return;
    setBusy(true);
    setError(null);
    try {
      await api.createIncident({
        truckId: truck.id,
        type: incidentType,
        location,
        description,
        ...(driverId ? { actorId: driverId } : {}),
      });
      setReporting(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Emergency SOS Dispatch
  async function dispatchEmergencySOS() {
    if (!truck) return;
    setBusy(true);
    setError(null);
    const chosen = EMERGENCY_REASONS.find((r) => r.id === selectedSosReason) ?? EMERGENCY_REASONS[0];
    const loc = truck.lat && truck.lng
      ? `NH-48 Corridor (GPS: ${truck.lat.toFixed(4)}, ${truck.lng.toFixed(4)}) near Hosur`
      : 'NH-48 Corridor near Hosur km 42';

    const reasonText = chosen ? `${chosen.label} - ${chosen.desc}` : 'Mechanical Breakdown';

    try {
      await api.createIncident({
        truckId: truck.id,
        type: 'TRUCK_BREAKDOWN',
        location: loc,
        severity: 'CRITICAL',
        description: `🚨 CRITICAL EMERGENCY SOS: Driver ${activeDriver?.name ?? 'Driver'} triggered panic beacon. ${reasonText}. Vehicle immobilized on highway. AI Corridor Reroute & Emergency Recovery requested immediately.`,
        ...(driverId ? { actorId: driverId } : {}),
      });
      setSosModalOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-4xl px-4 py-4">
        {/* Top Control Bar: View Tabs & Driver Switcher */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-600 bg-base-900/90 p-3 shadow-lg backdrop-blur-md">
          {/* Tab Selector */}
          <div className="flex items-center gap-1 rounded-md border border-base-700 bg-base-950 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('CAB')}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer',
                activeTab === 'CAB' ? 'bg-healthy text-base-950 shadow-sm' : 'text-ink-400 hover:text-ink-100',
              )}
            >
              <span>🚚</span>
              <span>Cab Cockpit</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ROSTER')}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer',
                activeTab === 'ROSTER' ? 'bg-healthy text-base-950 shadow-sm' : 'text-ink-400 hover:text-ink-100',
              )}
            >
              <span>👥</span>
              <span>Fleet Drivers ({snapshot.drivers.length})</span>
            </button>
          </div>

          {/* Quick Driver Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-wider text-ink-400">Active Driver:</span>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="rounded-md border border-base-600 bg-base-800 px-3 py-1.5 font-mono text-xs font-medium text-ink-100 focus:border-healthy focus:outline-none cursor-pointer"
            >
              {snapshot.drivers.map((drv) => (
                <option key={drv.id} value={drv.id} className="bg-base-900 text-ink-100">
                  {drv.name} ({drv.assignedTruckId ?? 'No Truck'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: DRIVER CAB COCKPIT & LIVE JOURNEY                 */}
        {/* ======================================================== */}
        {activeTab === 'CAB' && (
          <div className="mx-auto max-w-lg space-y-4">
            {/* Driver Identity Card */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full border border-base-600 bg-base-800 text-base font-bold text-healthy">
                  {activeDriver?.name.charAt(0) ?? 'D'}
                </div>
                <div>
                  <div className="eyebrow">Licensed Commercial Driver</div>
                  <h1 className="text-lg font-semibold tracking-tight text-ink-50">
                    {activeDriver?.name ?? 'Driver'}
                  </h1>
                  <div className="font-mono text-[11px] text-ink-400">
                    {activeDriver?.phone} &bull; {DRIVER_METRICS[activeDriver?.id ?? '']?.license ?? 'DL-Commercial'}
                  </div>
                </div>
              </div>

              {truck && (
                <StatusPill
                  status={truck.status}
                  tone={truckTone(truck.status)}
                  size="md"
                  pulse={truck.status === 'INCIDENT'}
                />
              )}
            </div>

            {/* CRITICAL SOS ACTIVE BANNER */}
            {isSosIncident && (
              <div className="relative overflow-hidden rounded-lg border-2 border-danger bg-danger/15 p-4 shadow-incident animate-pulse">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl animate-bounce">🚨</span>
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-danger">
                        EMERGENCY SOS BROADCAST ACTIVE
                      </div>
                      <div className="mt-0.5 text-xs text-ink-200">
                        GPS distress beacon transmitting to Control Tower &bull; Tow &amp; Rescue dispatched
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void setMode('LIVE_MAP')}
                    className="shrink-0 rounded bg-danger px-2.5 py-1 text-2xs font-bold uppercase tracking-wider text-base-950 hover:bg-danger/80 cursor-pointer"
                  >
                    View Map
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-danger/30 pt-2.5 font-mono text-[11px] text-ink-300">
                  <span>Coords: {truck?.lat?.toFixed(4)}, {truck?.lng?.toFixed(4)}</span>
                  <span>&bull;</span>
                  <span>Speed: 0 km/h</span>
                  <span>&bull;</span>
                  <span className="text-healthy font-semibold">AI Reroute Engine: STANDBY DETOUR</span>
                </div>
              </div>
            )}

            {/* AI CORRIDOR REROUTE ADVISORY (shown if incident or detour active) */}
            {isSosIncident && (
              <div className="rounded-lg border border-warn/40 bg-warn/10 p-3.5 text-xs text-warn">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
                  <span>⚠️</span>
                  <span>Authorized Highway Detour Route</span>
                </div>
                <div className="mt-1.5 leading-relaxed text-ink-300">
                  NH-48 obstructed at Hosur km 42. Detour via <strong className="text-ink-100">SH-17 Denkanikottai Bypass</strong> is approved by Control Tower. Rejoin NH-48 at Krishnagiri. Expected ETA overhead: +32 mins (+24 km).
                </div>
              </div>
            )}

            {/* Assigned Truck Panel */}
            {truck ? (
              <div
                className={cn(
                  'panel p-4',
                  truck.status === 'INCIDENT' && 'border-danger/45 shadow-incident',
                  flashClassFor(flashTone, truck.id, flashIds),
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="eyebrow">Vehicle Telemetry</div>
                    <div className="mt-1 font-mono text-3xl font-semibold tracking-tight text-ink-50">
                      {truck.id}
                    </div>
                    <div className="mt-1 font-mono text-xs text-ink-400">{truck.registrationNo}</div>
                  </div>
                  <div className="text-right">
                    <div className="eyebrow">Current Speed</div>
                    <div className="mt-1 font-mono text-2xl font-bold text-healthy">
                      {Math.round(truck.speedKmph ?? 0)} <span className="text-xs text-ink-400">km/h</span>
                    </div>
                    <div className="text-[10px] text-ink-500">
                      Heading: {truck.heading ?? 0}&deg;
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink-100">{truck.origin}</span>
                  <span className="font-mono text-xs text-ink-500">&bull;&bull;&bull; NH-48 Corridor &bull;&bull;&bull;&gt;</span>
                  <span className="font-semibold text-ink-100">{truck.destination}</span>
                </div>

                <div className="tabular mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded border border-base-600 bg-base-900/60 px-3 py-2">
                    <div className="eyebrow">Payload Capacity</div>
                    <div className="mt-0.5 text-lg font-semibold text-ink-50">{formatT(truck.capacityT)}</div>
                  </div>
                  <div className="rounded border border-base-600 bg-base-900/60 px-3 py-2">
                    <div className="eyebrow">Available Tonnage</div>
                    <div
                      className={cn(
                        'mt-0.5 text-lg font-semibold',
                        truck.availableT > 0 ? 'text-healthy' : 'text-warn',
                      )}
                    >
                      {formatT(truck.availableT)}
                    </div>
                  </div>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-base-700">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      truckTone(truck.status) === 'danger' ? 'bg-danger' : 'bg-healthy',
                    )}
                    style={{ width: `${(truck.availableT / Math.max(truck.capacityT, 0.001)) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <Panel eyebrow="Truck" title="No Truck Assigned">
                <p className="text-xs text-ink-400">This driver has no truck assigned.</p>
              </Panel>
            )}

            {/* Approval Queue for Loads */}
            <Panel
              eyebrow="Booking Offers"
              title={pending.length > 0 ? `Loads Waiting for Approval (${pending.length})` : 'Loads Waiting for Approval'}
              bodyClassName="p-0"
            >
              {queueError && (
                <p className="border-b border-base-700 px-4 py-2.5 text-[11px] text-danger">{queueError}</p>
              )}

              {pending.length === 0 ? (
                <p className="px-4 py-4 text-xs leading-relaxed text-ink-500">
                  No loads waiting right now. When a shipper books cargo capacity on this vehicle, the load offer appears here for one-click cab acceptance.
                </p>
              ) : (
                <ul className="divide-y divide-base-700">
                  {pending.map((offer) => (
                    <li
                      key={offer.shipment.id}
                      className={cn('px-4 py-3.5', flashClassFor(flashTone, offer.shipment.id, flashIds))}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-ink-50">
                              {offer.shipment.id}
                            </span>
                            <StatusPill status="CAPACITY_RESERVED" tone="warn" size="sm" />
                          </div>
                          <div className="mt-1 truncate text-xs text-ink-300">{offer.shipment.cargoName}</div>
                          <div className="mt-0.5 text-[10px] text-ink-500">
                            {offer.shipperName ?? offer.shipment.shipperId}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="tabular text-base font-semibold text-ink-50">
                            {formatT(offer.shipment.weightT)}
                          </div>
                          <div className="text-[10px] text-ink-500">{offer.currency}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={acting !== null}
                          onClick={() => void acceptOffer(offer.shipment.id)}
                          className="flex-1 rounded-md border border-healthy/40 bg-healthy/15 py-1.5 text-xs font-semibold uppercase tracking-wider text-healthy transition-colors hover:bg-healthy/25 disabled:opacity-50 cursor-pointer"
                        >
                          {acting === offer.shipment.id ? 'Accepting…' : 'Accept Load'}
                        </button>
                        <button
                          type="button"
                          disabled={acting !== null}
                          onClick={() => void declineOffer(offer.shipment.id)}
                          className="flex-1 rounded-md border border-base-600 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400 transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50 cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {accepted.length > 0 && (
                <div className="border-t border-base-700 px-4 py-3">
                  <div className="eyebrow mb-1.5">Already Accepted ({accepted.length})</div>
                  <ul className="space-y-1.5">
                    {accepted.map((offer) => (
                      <li key={offer.shipment.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="font-mono text-ink-300">{offer.shipment.id}</span>
                          <span className="truncate text-ink-500">{offer.shipment.cargoName}</span>
                        </span>
                        <span className="shrink-0 text-ink-400 font-mono">{formatT(offer.shipment.weightT)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>

            {/* Active Load Details */}
            <Panel eyebrow="Current Cargo" title="Assigned Shipment" bodyClassName="p-4">
              {cargo ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-ink-50">{cargo.cargoName}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-ink-500">{cargo.id}</div>
                    </div>
                    <StatusPill
                      status={cargo.status}
                      tone={shipmentTone(cargo.status)}
                      pulse={cargo.status === 'AT_RISK'}
                    />
                  </div>
                  <div className="tabular mt-3 text-xs text-ink-400">
                    {formatT(cargo.weightT)} &bull; {cargo.origin} &rarr; {cargo.destination}
                  </div>
                </>
              ) : (
                <p className="text-xs text-ink-400">
                  No shipment currently assigned. Book a shipment in Business mode or wait for dispatcher assignment.
                </p>
              )}
            </Panel>

            {/* ======================================================== */}
            {/* PRIMARY JOURNEY & EMERGENCY SOS ACTIONS                  */}
            {/* ======================================================== */}
            <div className="space-y-3">
              {/* Depart Button */}
              {canDepart && (
                <button
                  type="button"
                  className="btn-primary w-full py-3.5 text-base font-bold uppercase tracking-wider cursor-pointer"
                  onClick={startJourney}
                  disabled={busy}
                >
                  {busy ? 'Starting Journey…' : '🚀 Start Highway Journey'}
                </button>
              )}

              {/* ELEVENLABS AI VOICE CO-PILOT BUTTON */}
              <button
                type="button"
                onClick={() => setVoiceOpen(true)}
                className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-lg border-2 border-accent/60 bg-accent/15 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-accent shadow-md transition-all duration-200 hover:bg-accent hover:text-base-950 active:scale-[0.99] cursor-pointer"
              >
                <span className="text-lg">🎙️</span>
                <span>AI Voice Assistant (ElevenLabs) — Speak to Book / Report</span>
              </button>

              {/* EMERGENCY SOS PANIC TRIGGER (High visibility pulsing button) */}
              <button
                type="button"
                onClick={() => setSosModalOpen(true)}
                disabled={busy}
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-lg border-2 border-danger bg-danger/20 py-4 font-mono text-sm font-extrabold uppercase tracking-widest text-danger shadow-incident transition-all duration-200 hover:bg-danger hover:text-base-950 active:scale-[0.99] cursor-pointer"
              >
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-danger group-hover:bg-base-950" />
                </span>
                <span>🚨 EMERGENCY SOS / PANIC DISPATCH</span>
              </button>

              {/* Standard Incident Reporting Option */}
              {inTransit && !reporting && !isSosIncident && (
                <button
                  type="button"
                  className="btn-ghost w-full py-2.5 text-xs text-ink-300 hover:text-ink-100 cursor-pointer"
                  onClick={() => setReporting(true)}
                  disabled={busy}
                >
                  Report Non-Emergency Delay / Issue
                </button>
              )}
            </div>

            {/* Non-Emergency Incident Report Form */}
            {reporting && (
              <Panel eyebrow="Incident Form" title="Report Road Issue" bodyClassName="p-4">
                <label className="block">
                  <span className="label">Issue Type</span>
                  <select
                    className="field"
                    value={incidentType}
                    onChange={(e) => pickType(e.target.value as IncidentType)}
                  >
                    {INCIDENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value} className="bg-base-800">
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-3 block">
                  <span className="label">Location</span>
                  <input className="field" value={location} onChange={(e) => setLocation(e.target.value)} />
                </label>

                <label className="mt-3 block">
                  <span className="label">Description</span>
                  <textarea
                    className="field min-h-[80px] resize-y"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>

                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn-ghost flex-1" onClick={() => setReporting(false)} disabled={busy}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-danger flex-1"
                    onClick={reportIncident}
                    disabled={busy || !location.trim()}
                  >
                    {busy ? 'Submitting…' : 'Submit Report'}
                  </button>
                </div>
              </Panel>
            )}

            {error && (
              <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </div>
            )}

            {/* Reported History */}
            {myIncidents.length > 0 && (
              <Panel eyebrow="Incident History" title="Log for this Truck" bodyClassName="p-0">
                <ul className="divide-y divide-base-700">
                  {myIncidents.map((i) => (
                    <li key={i.id} className="px-4 py-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink-100">{incidentTypeLabel[i.type] ?? i.type}</span>
                        <StatusPill status={i.status} tone={i.status === 'OPEN' ? 'danger' : 'neutral'} />
                      </div>
                      <div className="mt-1 text-[11px] text-ink-400">
                        {i.location} &bull; {formatRelative(i.createdAt)} &bull; <span className="font-mono">{i.id}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: FLEET DRIVERS DIRECTORY (ALL 9 DRIVERS)           */}
        {/* ======================================================== */}
        {activeTab === 'ROSTER' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow">Fleet Operations Roster</div>
                <h2 className="text-xl font-bold tracking-tight text-ink-50">
                  Active Commercial Drivers ({snapshot.drivers.length})
                </h2>
              </div>
              <div className="text-right text-xs text-ink-400">
                Authoritative Server Roster &bull; NH-48 Corridor
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {snapshot.drivers.map((drv) => {
                const assignedTruck = snapshot.trucks.find((t) => t.id === drv.assignedTruckId);
                const isCurrent = drv.id === selectedDriverId;
                const metrics = DRIVER_METRICS[drv.id] ?? { safetyScore: 98.0, completedHauls: 120, license: 'DL-Commercial' };

                return (
                  <div
                    key={drv.id}
                    className={cn(
                      'rounded-lg border p-4 transition-all duration-200 backdrop-blur-md',
                      isCurrent
                        ? 'border-healthy bg-healthy/[0.06] shadow-lg ring-1 ring-healthy'
                        : 'border-base-600 bg-base-850 hover:border-base-500 hover:bg-base-800',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-full border border-base-600 bg-base-800 font-bold text-healthy">
                          {drv.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-ink-50">{drv.name}</div>
                          <div className="font-mono text-2xs text-ink-400">{drv.phone}</div>
                        </div>
                      </div>
                      <StatusPill
                        status={assignedTruck?.status ?? drv.status}
                        tone={truckTone(assignedTruck?.status ?? 'AVAILABLE')}
                        size="sm"
                      />
                    </div>

                    <div className="mt-3.5 space-y-1.5 border-t border-base-700/80 pt-3 text-xs text-ink-300">
                      <div className="flex justify-between">
                        <span className="text-ink-500">Assigned Truck:</span>
                        <span className="font-mono font-semibold text-healthy">
                          {drv.assignedTruckId ?? 'None'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-500">Plate:</span>
                        <span className="font-mono text-ink-300">{assignedTruck?.registrationNo ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-500">Safety Score:</span>
                        <span className="font-mono text-ink-100">{metrics.safetyScore}% on-time</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-500">Completed Hauls:</span>
                        <span className="font-mono text-ink-100">{metrics.completedHauls} trips</span>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDriverId(drv.id);
                          setActiveTab('CAB');
                        }}
                        className={cn(
                          'w-full rounded py-2 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer',
                          isCurrent
                            ? 'bg-healthy text-base-950 font-bold'
                            : 'border border-base-600 bg-base-900 text-ink-200 hover:border-healthy/60 hover:text-healthy',
                        )}
                      >
                        {isCurrent ? 'Current Cab Cockpit' : 'Switch to this Cab'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Placeholder className="mt-6">
          Realtime status is {connection}. Emergency SOS dispatches publish directly to the Control Tower AI recovery loop.
        </Placeholder>
      </main>

      {/* ======================================================== */}
      {/* EMERGENCY SOS TRIGGER MODAL                              */}
      {/* ======================================================== */}
      {sosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl border-2 border-danger bg-base-900 shadow-incident">
            <div className="bg-danger px-5 py-4 text-base-950">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                <span>🚨</span>
                <span>CRITICAL INCIDENT PROTOCOL</span>
              </div>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Trigger Emergency SOS Beacon
              </h2>
            </div>

            <div className="p-5">
              <p className="text-xs text-ink-300 leading-relaxed">
                This broadcast alerts the Control Tower, logs an authoritative breakdown incident, and immediately engages the <strong>AI Corridor Reroute Engine</strong>.
              </p>

              <div className="mt-4 space-y-2">
                <div className="text-2xs font-bold uppercase tracking-wider text-ink-400">
                  Select Emergency Reason:
                </div>
                {EMERGENCY_REASONS.map((r) => (
                  <label
                    key={r.id}
                    onClick={() => setSelectedSosReason(r.id)}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                      selectedSosReason === r.id
                        ? 'border-danger bg-danger/10 text-ink-50'
                        : 'border-base-700 bg-base-800/60 text-ink-300 hover:bg-base-800',
                    )}
                  >
                    <input
                      type="radio"
                      name="sos_reason"
                      checked={selectedSosReason === r.id}
                      onChange={() => setSelectedSosReason(r.id)}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-xs font-bold text-ink-100">{r.label}</div>
                      <div className="mt-0.5 text-2xs text-ink-400">{r.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-5 rounded-md border border-base-700 bg-base-950 p-3 font-mono text-[11px] text-ink-400">
                <div>Vehicle: <strong className="text-ink-100">{truck?.id} ({truck?.registrationNo})</strong></div>
                <div>Driver: <strong className="text-ink-100">{activeDriver?.name} ({activeDriver?.phone})</strong></div>
                <div>Telemetry: <strong className="text-healthy">{truck?.lat?.toFixed(4)}, {truck?.lng?.toFixed(4)}</strong></div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSosModalOpen(false)}
                  className="flex-1 rounded-lg border border-base-600 bg-base-800 py-3 text-xs font-semibold text-ink-300 hover:text-ink-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={dispatchEmergencySOS}
                  disabled={busy}
                  className="flex-[1.5] rounded-lg bg-danger py-3 text-xs font-black uppercase tracking-wider text-base-950 shadow-incident hover:bg-danger/90 cursor-pointer disabled:opacity-50"
                >
                  {busy ? 'Broadcasting…' : '🚨 TRANSMIT SOS BEACON'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ElevenLabs AI Voice Assistant Modal */}
      <ElevenLabsVoiceAssistant
        isOpen={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        truckId={truck?.id}
        driverName={activeDriver?.name}
      />
    </div>
  );
}
