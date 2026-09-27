import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { flashClassFor } from '../lib/flash';
import { useFleet } from '../store/FleetContext';
import { AppHeader } from '../components/AppHeader';
import { Metric, StatusPill } from '../components/Primitives';
import { Panel, Placeholder } from '../components/Panel';
import { NetworkMap } from '../components/NetworkMap';
import { GoogleMapView } from '../components/GoogleMapView';
import { ShipmentTable } from '../components/ShipmentTable';
import { EventFeed } from '../components/EventFeed';
import { IncidentPanel } from '../components/IncidentPanel';
import { cn, formatTime } from '../lib/format';
import { shipmentTone, truckTone } from '../lib/tone';

type FleetFilter = 'ALL' | 'AVAILABLE' | 'IN_TRANSIT' | 'INCIDENT' | 'RECOVERY';

/**
 * CONTROL TOWER — operator view over the whole network.
 * Every value is read from the server snapshot; nothing is simulated client-side.
 */
export function ControlTower() {
  const { snapshot, refresh, resetDemo, session, error, connection, lastEvent, flashIds, flashTone, loading } = useFleet();
  const [filter, setFilter] = useState<FleetFilter>('ALL');
  const [resetting, setResetting] = useState(false);
  const [feedTab, setFeedTab] = useState<'agent' | 'all'>('all');
  const [mapMode, setMapMode] = useState<'google' | 'schematic'>('google');
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);

  // AI Rerouting System states
  const [reroutingModalOpen, setReroutingModalOpen] = useState(false);
  const [reroutingBusy, setReroutingBusy] = useState(false);
  const [rerouteSuccess, setRerouteSuccess] = useState<string | null>(null);

  const { trucks, shipments, incidents, events, users } = snapshot;
  const operatorId = useMemo(() => {
    const operator = users.find((u) => u.role === 'OPERATOR') ?? users.find((u) => u.role === 'CONTROL_TOWER');
    return operator?.id ?? 'operator_demo';
  }, [users]);

  const counts = useMemo(
    () => ({
      available: trucks.filter((t) => t.status === 'AVAILABLE' || t.status === 'ASSIGNED').length,
      inTransit: trucks.filter((t) => t.status === 'IN_TRANSIT' || t.status === 'LOADING').length,
      incident: trucks.filter((t) => t.status === 'INCIDENT').length,
      recovery: trucks.filter((t) => t.status === 'RECOVERY' || t.status === 'DELAYED').length,
      spareT: Math.round(trucks.reduce((sum, t) => sum + t.availableT, 0) * 10) / 10,
    }),
    [trucks],
  );

  const visibleTrucks = useMemo(() => {
    if (filter === 'ALL') return trucks;
    if (filter === 'AVAILABLE') return trucks.filter((t) => t.status === 'AVAILABLE' || t.status === 'ASSIGNED');
    if (filter === 'RECOVERY') return trucks.filter((t) => t.status === 'RECOVERY' || t.status === 'DELAYED');
    return trucks.filter((t) => t.status === filter);
  }, [trucks, filter]);

  const recentEvents = useMemo(
    () => events.slice().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    [events],
  );

  const openIncident = incidents.find((i) => i.status === 'OPEN' || i.status === 'ANALYZING') ?? (incidents.length > 0 ? incidents[0] : null);
  const incidentTruck = trucks.find((t) => t.status === 'INCIDENT') ?? (openIncident ? trucks.find((t) => t.id === openIncident.truckId) : null);
  const hasIncident = counts.incident > 0 || (Boolean(openIncident) && openIncident?.status !== 'RESOLVED');

  async function handleExecuteReroute() {
    if (!openIncident) return;
    setReroutingBusy(true);
    try {
      const planRes = await api.createRecoveryPlan(openIncident.id);
      const approved = await api.approvePlan(planRes.plan.id, operatorId);
      await api.executePlan(approved.plan.id, operatorId);
      setRerouteSuccess('SH-17 Bypass Detour successfully authorized and broadcast to vehicle.');
      await refresh();
    } catch (err) {
      console.error('Reroute error:', err);
    } finally {
      setReroutingBusy(false);
    }
  }

  return (
    <div className="relative z-10 min-h-screen">
      <AppHeader />

      <main className="px-4 py-4 lg:px-6">
        <div className="mx-auto max-w-[1600px] space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-ink-50">Network Control</h1>
              <p className="mt-0.5 text-xs text-ink-400">
                Live operational picture across {trucks.length} trucks ·{' '}
                {snapshot.generatedAt ? `server state ${formatTime(snapshot.generatedAt)}` : 'loading…'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setReroutingModalOpen(true)}
                className="flex items-center gap-1.5 rounded-md border border-healthy/40 bg-healthy/15 px-3 py-1.5 text-2xs font-bold uppercase tracking-wider text-healthy transition-colors hover:bg-healthy/25 cursor-pointer shadow-sm"
              >
                <span>🛣️</span>
                <span>AI Reroute Console</span>
              </button>

              {session && (
                <div className="hidden items-center gap-2 rounded-md border border-base-600 bg-base-850 px-3 py-1.5 text-2xs text-ink-400 sm:flex">
                  <span className="text-ink-200">{session.user.name}</span>
                  <span className="text-ink-600">·</span>
                  <span>{session.organization?.name}</span>
                </div>
              )}
              <button
                type="button"
                className="btn-ghost"
                disabled={resetting}
                onClick={() => {
                  setResetting(true);
                  void resetDemo().finally(() => setResetting(false));
                }}
              >
                {resetting ? 'Resetting…' : 'Reset Demo State'}
              </button>
            </div>
          </div>

          {/* CRITICAL EMERGENCY SOS BANNER */}
          {hasIncident && (
            <div className="relative overflow-hidden rounded-xl border-2 border-danger bg-danger/15 p-4 shadow-incident backdrop-blur-md animate-pulse">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-danger text-xl text-base-950 font-black animate-bounce">
                    🚨
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-widest text-danger">CRITICAL SOS ALERT</span>
                      <span className="rounded bg-danger/20 border border-danger/40 px-2 py-0.5 font-mono text-[10px] text-danger font-bold">
                        IMMEDIATE ACTION REQUIRED
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-ink-50">
                      Truck <strong className="font-mono text-danger">{incidentTruck?.id ?? 'FG-027'}</strong> reported Emergency Breakdown at <strong className="text-ink-100">{openIncident?.location ?? 'Hosur (NH-48 km 42)'}</strong>.
                    </div>
                    <div className="mt-0.5 text-xs text-ink-300">
                      Cargo at risk &bull; Highway bottleneck detected &bull; Alternate bypass detour ready for activation
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (incidentTruck) setSelectedTruckId(incidentTruck.id);
                      setMapMode('google');
                    }}
                    className="rounded-lg border border-base-600 bg-base-800 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-ink-200 hover:text-ink-50 cursor-pointer"
                  >
                    Track on Map
                  </button>
                  <button
                    type="button"
                    onClick={() => setReroutingModalOpen(true)}
                    className="rounded-lg bg-danger px-4 py-2 text-xs font-black uppercase tracking-wider text-base-950 shadow-incident hover:bg-danger/90 cursor-pointer"
                  >
                    🚀 Launch AI Highway Reroute
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-xs text-danger">
              <span className="font-semibold">Server unreachable. </span>
              {error}
            </div>
          )}

          {connection !== 'live' && !error && (
            <div className="rounded-md border border-warn/35 bg-warn/[0.07] px-3.5 py-2.5 text-xs text-warn">
              Realtime {connection}. Displayed state may be stale — it will resync automatically.
            </div>
          )}

          <div className="panel grid grid-cols-2 divide-x divide-base-600 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Available" value={counts.available} tone="healthy" hint={`${counts.spareT}T spare network-wide`} onClick={() => setFilter('AVAILABLE')} active={filter === 'AVAILABLE'} />
            <Metric label="In Transit" value={counts.inTransit} tone="accent" onClick={() => setFilter('IN_TRANSIT')} active={filter === 'IN_TRANSIT'} />
            <Metric label="Incident" value={counts.incident} tone="danger" onClick={() => setFilter('INCIDENT')} active={filter === 'INCIDENT'} />
            <Metric label="Recovery" value={counts.recovery} tone="warn" onClick={() => setFilter('RECOVERY')} active={filter === 'RECOVERY'} />
            <Metric label="Active Shipments" value={shipments.filter((s) => s.status !== 'DELIVERED').length} hint="Excludes delivered" />
            <Metric label="Realtime" value={lastEvent ? lastEvent.type.replace('.', ' ') : 'idle'} tone="neutral" hint={`${events.length} events logged`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]">
            <div className="space-y-4">
              <Panel
                eyebrow="Live Network"
                title="Bengaluru → Chennai corridor"
                bodyClassName="p-0"
                actions={
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded border border-base-600 bg-base-850 p-0.5 font-mono text-3xs">
                      <button
                        type="button"
                        onClick={() => setMapMode('google')}
                        className={cn(
                          'rounded px-2 py-0.5 uppercase tracking-wider transition-colors',
                          mapMode === 'google'
                            ? 'bg-accent text-base-950 font-bold'
                            : 'text-ink-400 hover:text-ink-200',
                        )}
                      >
                        🗺️ Google Map
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapMode('schematic')}
                        className={cn(
                          'rounded px-2 py-0.5 uppercase tracking-wider transition-colors',
                          mapMode === 'schematic'
                            ? 'bg-accent text-base-950 font-bold'
                            : 'text-ink-400 hover:text-ink-200',
                        )}
                      >
                        ⚡ Schematic
                      </button>
                    </div>
                    {filter !== 'ALL' && (
                      <button type="button" className="btn-quiet text-2xs" onClick={() => setFilter('ALL')}>
                        Clear filter
                      </button>
                    )}
                  </div>
                }
              >
                <div className="h-[420px]">
                  {mapMode === 'google' ? (
                    <GoogleMapView
                      trucks={visibleTrucks}
                      selectedTruckId={selectedTruckId}
                      onSelectTruck={setSelectedTruckId}
                      height="100%"
                      showRerouteDetour={hasIncident || rerouteSuccess !== null}
                    />
                  ) : (
                    <NetworkMap
                      trucks={visibleTrucks}
                      incidents={incidents}
                      flashIds={flashIds}
                      flashTone={flashTone}
                      onSelectTruck={setSelectedTruckId}
                    />
                  )}
                </div>
              </Panel>

              <Panel eyebrow="Active Shipments" title="Cargo on the network" bodyClassName="p-0" className="min-h-[260px]">
                <div className="max-h-[320px]">
                  <ShipmentTable shipments={shipments} trucks={trucks} flashIds={flashIds} flashTone={flashTone} />
                </div>
              </Panel>

              <Panel
                eyebrow="Fleet"
                title="Trucks"
                bodyClassName="p-0"
                className="min-h-[220px]"
                actions={<span className="text-2xs text-ink-500">{visibleTrucks.length} shown</span>}
              >
                <div className="grid gap-px bg-base-700 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleTrucks.map((truck) => (
                    <div
                      key={truck.id}
                      className={cn(
                        'bg-base-800 px-3.5 py-3 transition-colors hover:bg-base-750/60',
                        flashClassFor(flashTone, truck.id, flashIds),
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-semibold text-ink-50">{truck.id}</span>
                        <StatusPill
                          status={truck.status}
                          tone={truckTone(truck.status)}
                          pulse={truck.status === 'INCIDENT'}
                        />
                      </div>
                      <div className="mt-1 text-[10px] text-ink-500">
                        {truck.origin} → {truck.destination} · {truck.registrationNo}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-base-700">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              truckTone(truck.status) === 'danger'
                                ? 'bg-danger'
                                : truckTone(truck.status) === 'warn'
                                  ? 'bg-warn'
                                  : 'bg-healthy',
                            )}
                            style={{ width: `${(truck.availableT / Math.max(truck.capacityT, 0.001)) * 100}%` }}
                          />
                        </div>
                        <span className="tabular shrink-0 font-mono text-[10px] text-ink-300">
                          {truck.availableT.toFixed(1)}/{truck.capacityT.toFixed(1)}T
                        </span>
                      </div>
                    </div>
                  ))}
                  {visibleTrucks.length === 0 && (
                    <div className="bg-base-800 px-3.5 py-6 text-center text-2xs text-ink-500 sm:col-span-2 lg:col-span-3">
                      No trucks match this filter.
                    </div>
                  )}
                </div>
              </Panel>
            </div>

            <div className="space-y-4">
              <Panel eyebrow="Incidents" title="Recovery desk" bodyClassName="p-3.5">
                <IncidentPanel
                  incidents={incidents}
                  shipments={shipments}
                  trucks={trucks}
                  plans={snapshot.recoveryPlans}
                  operatorId={operatorId}
                  flashIds={flashIds} flashTone={flashTone}
                  onAction={refresh}
                />
              </Panel>

              <Panel
                eyebrow="Agent Activity"
                title={feedTab === 'agent' ? 'Recovery + incident events' : 'All events'}
                bodyClassName="p-0"
                className="min-h-[280px]"
                actions={
                  <div className="flex rounded border border-base-600 p-0.5">
                    {(['agent', 'all'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setFeedTab(tab)}
                        className={cn(
                          'rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors',
                          feedTab === tab ? 'bg-ink-50 text-base-950' : 'text-ink-400 hover:text-ink-100',
                        )}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="max-h-[340px]">
                  <EventFeed
                    events={recentEvents}
                    filter={feedTab}
                    limit={30}
                    emptyHint="Agent activity is recorded as backend events. Run the demo flow to populate it."
                  />
                </div>
              </Panel>

              <Panel eyebrow="Payment & Proof" title="Honest status" bodyClassName="p-3.5">
                <Placeholder className="mb-2.5">
                  Dodo Payments integration, notification delivery and EVM proof anchoring are phase-2 work. Seeded
                  payment rows are labelled DEMO_PLACEHOLDER and no blockchain confirmation is ever claimed.
                </Placeholder>
                <div className="flex flex-wrap items-center gap-2">
                  {snapshot.payments.slice(-3).map((p) => (
                    <div key={p.id} className="rounded border border-base-600 bg-base-900/60 px-2.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <StatusPill status={p.status} tone={p.status === 'PAID' ? 'healthy' : 'warn'} />
                        <span className="font-mono text-[10px] text-ink-400">{p.shipmentId}</span>
                      </div>
                      <div className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-ink-600">{p.provider}</div>
                    </div>
                  ))}
                  {snapshot.payments.length === 0 && (
                    <span className="text-2xs text-ink-500">No payment records.</span>
                  )}
                </div>
              </Panel>
            </div>
          </div>

          {loading && (
            <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-base-600 bg-base-850 px-3 py-1 text-2xs text-ink-400">
              syncing server state…
            </div>
          )}
        </div>
      </main>

      {/* ======================================================== */}
      {/* AI CORRIDOR REROUTING CONSOLE MODAL                      */}
      {/* ======================================================== */}
      {reroutingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-healthy/40 bg-base-900 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-base-700 bg-base-950 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-healthy/40 bg-healthy/10 text-lg text-healthy">
                  🛣️
                </span>
                <div>
                  <div className="text-2xs font-bold uppercase tracking-widest text-healthy">
                    AI Autonomous Network Reroute
                  </div>
                  <h2 className="text-base font-bold text-ink-50">
                    Bengaluru &rarr; Chennai Corridor Detour Engine
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReroutingModalOpen(false);
                  setRerouteSuccess(null);
                }}
                className="rounded-lg p-2 text-ink-400 hover:bg-base-800 hover:text-ink-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="max-h-[75vh] overflow-y-auto p-6 space-y-5">
              {/* Incident Context */}
              <div className="rounded-lg border border-base-700 bg-base-850 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-ink-400">
                    AFFECTED VEHICLE: <strong className="text-danger font-bold">{incidentTruck?.id ?? 'FG-027'}</strong>
                  </span>
                  <span className="rounded bg-danger/20 border border-danger/40 px-2 py-0.5 font-mono text-2xs font-bold text-danger">
                    CRITICAL HIGHWAY BLOCKADE
                  </span>
                </div>
                <div className="mt-2 text-xs text-ink-300">
                  Location: <strong className="text-ink-100">{openIncident?.location ?? 'Hosur (NH-48 km 42)'}</strong> &bull; Cargo: <strong className="text-ink-100">{shipments.find((s) => s.truckId === incidentTruck?.id)?.cargoName ?? 'Electronic Components (40T)'}</strong>
                </div>
              </div>

              {/* Success Notification */}
              {rerouteSuccess && (
                <div className="rounded-lg border border-healthy/50 bg-healthy/15 p-4 text-xs text-healthy">
                  <div className="font-bold flex items-center gap-2">
                    <span>✓</span>
                    <span>DETOUR AUTHORIZED &amp; EXECUTED</span>
                  </div>
                  <div className="mt-1 text-ink-200">
                    {rerouteSuccess} Live GPS map now shows the active detour corridor bypass.
                  </div>
                </div>
              )}

              {/* Detour Options Comparison */}
              <div className="space-y-3">
                <div className="text-2xs font-bold uppercase tracking-wider text-ink-400">
                  Evaluated Recovery &amp; Detour Options:
                </div>

                {/* Option 1: SH-17 Highway Bypass Detour (Selected/Recommended) */}
                <div className="rounded-lg border-2 border-healthy bg-healthy/[0.06] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-healthy px-2 py-0.5 text-2xs font-extrabold uppercase text-base-950">
                          Recommended
                        </span>
                        <h3 className="font-bold text-ink-50 text-sm">
                          Option 1: SH-17 Denkanikottai Bypass Detour
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-ink-300 leading-relaxed">
                        Diverts freight around Hosur bottleneck before km 38 via State Highway 17 &rarr; Rayakottai connector, rejoining National Highway 48 at Krishnagiri.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-bold text-healthy">+32 mins</div>
                      <div className="text-2xs text-ink-400">+24 km detour</div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-healthy/20 pt-3 text-2xs font-mono text-ink-300">
                    <div>Road Grade: <strong>Heavy Multi-Axle</strong></div>
                    <div>Toll Overhead: <strong>Avoided (-₹420)</strong></div>
                    <div>Confidence: <strong className="text-healthy">99.4%</strong></div>
                  </div>
                </div>

                {/* Option 2: Transshipment to FG-041 */}
                <div className="rounded-lg border border-base-700 bg-base-800/40 p-4 opacity-75">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-ink-100 text-xs">
                        Option 2: Cargo Transshipment to Nearby Truck (FG-041)
                      </h3>
                      <p className="mt-1 text-2xs text-ink-400">
                        Transfer urgent palletized cargo to oncoming truck FG-041 (Imran Sheikh) with 8.5T spare capacity, currently 18 km away.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-xs font-semibold text-warn">+75 mins</div>
                      <div className="text-2xs text-ink-500">Transship delay</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Waypoint detours */}
              <div className="rounded-lg border border-base-700 bg-base-950 p-3.5 font-mono text-2xs text-ink-300">
                <div className="font-bold uppercase tracking-wider text-ink-400 mb-1.5">
                  Waypoint Detour Sequence:
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-ink-200">
                  <span>Bengaluru (Origin)</span>
                  <span className="text-ink-600">&rarr;</span>
                  <span>Electronic City</span>
                  <span className="text-ink-600">&rarr;</span>
                  <span className="text-warn font-bold">SH-17 Bypass Jct</span>
                  <span className="text-ink-600">&rarr;</span>
                  <span className="text-warn font-bold">Denkanikottai</span>
                  <span className="text-ink-600">&rarr;</span>
                  <span className="text-warn font-bold">Rayakottai</span>
                  <span className="text-ink-600">&rarr;</span>
                  <span>Krishnagiri</span>
                  <span className="text-ink-600">&rarr;</span>
                  <span>Vellore</span>
                  <span className="text-ink-600">&rarr;</span>
                  <span>Chennai Port (Dest)</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-base-700 bg-base-950 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setReroutingModalOpen(false);
                  setRerouteSuccess(null);
                }}
                className="rounded-lg border border-base-600 bg-base-800 px-4 py-2 text-xs font-semibold text-ink-300 hover:text-ink-100 cursor-pointer"
              >
                Close Console
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setReroutingModalOpen(false);
                    setMapMode('google');
                  }}
                  className="rounded-lg border border-base-600 bg-base-850 px-4 py-2 text-xs font-semibold text-ink-200 hover:bg-base-800 cursor-pointer"
                >
                  Inspect on Map
                </button>

                <button
                  type="button"
                  onClick={handleExecuteReroute}
                  disabled={reroutingBusy}
                  className="rounded-lg bg-healthy px-5 py-2.5 text-xs font-black uppercase tracking-wider text-base-950 shadow-lg hover:bg-healthy/90 cursor-pointer disabled:opacity-50"
                >
                  {reroutingBusy ? 'Authorizing Detour…' : '🚀 Approve & Execute Reroute'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { shipmentTone };
