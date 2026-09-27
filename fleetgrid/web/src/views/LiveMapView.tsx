import { useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { GoogleMapView } from '../components/GoogleMapView';
import { NetworkMap } from '../components/NetworkMap';
import { useFleet } from '../store/FleetContext';
import { cn, formatT } from '../lib/format';
import type { Truck } from '../lib/types';

export function LiveMapView() {
  const { snapshot, flashIds, flashTone } = useFleet();
  const { trucks, incidents } = snapshot;
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(trucks[0]?.id ?? null);
  const [viewMode, setViewMode] = useState<'google' | 'schematic'>('google');

  const selectedTruck = trucks.find((t: Truck) => t.id === selectedTruckId) ?? trucks[0] ?? null;

  const activeCount = trucks.filter(
    (t: Truck) => t.status === 'IN_TRANSIT' || (t.speedKmph !== undefined && t.speedKmph > 0),
  ).length;

  const avgSpeed =
    activeCount > 0
      ? Math.round(
          trucks.reduce((acc: number, t: Truck) => acc + (t.speedKmph ?? 0), 0) / (trucks.length || 1),
        )
      : 0;

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-base-950 text-ink-100">
      <AppHeader />

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Active Trucks Telemetry */}
        <aside className="flex w-80 flex-col border-r border-base-600 bg-base-900/95 backdrop-blur-md">
          {/* Header Stats */}
          <div className="border-b border-base-600 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xs font-semibold uppercase tracking-wider text-ink-400">
                Live GPS Fleet
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-healthy/40 bg-healthy/10 px-2 py-0.5 font-mono text-[10px] text-healthy">
                <span className="h-1.5 w-1.5 rounded-full bg-healthy animate-pulse" />
                {activeCount} Active
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded border border-base-700 bg-base-850 p-2">
                <div className="font-mono text-[9px] uppercase tracking-wider text-ink-500">Avg Speed</div>
                <div className="mt-0.5 font-mono text-base font-semibold text-ink-100">{avgSpeed} km/h</div>
              </div>
              <div className="rounded border border-base-700 bg-base-850 p-2">
                <div className="font-mono text-[9px] uppercase tracking-wider text-ink-500">Monitored</div>
                <div className="mt-0.5 font-mono text-base font-semibold text-accent">{trucks.length} Trucks</div>
              </div>
            </div>
          </div>

          {/* Truck List */}
          <div className="flex-1 divide-y divide-base-700/60 overflow-y-auto">
            {trucks.map((truck: Truck) => {
              const isSelected = selectedTruck?.id === truck.id;
              const isMoving = (truck.speedKmph ?? 0) > 0;
              const speed = Math.round(truck.speedKmph ?? 0);

              return (
                <div
                  key={truck.id}
                  onClick={() => setSelectedTruckId(truck.id)}
                  className={cn(
                    'cursor-pointer p-3.5 transition-colors hover:bg-base-800/80',
                    isSelected && 'border-l-2 border-accent bg-base-800',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-ink-50">{truck.id}</span>
                        <span className="rounded bg-base-700 px-1.5 py-0.5 font-mono text-[9px] text-ink-400">
                          {truck.registrationNo}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-ink-400">
                        {truck.origin} → {truck.destination}
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={cn(
                          'font-mono text-xs font-semibold',
                          isMoving ? 'text-healthy' : 'text-ink-500',
                        )}
                      >
                        {speed} km/h
                      </div>
                      <span
                        className={cn(
                          'mt-1 inline-block rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase',
                          truck.status === 'INCIDENT'
                            ? 'bg-danger/20 text-danger border border-danger/40'
                            : truck.status === 'IN_TRANSIT'
                              ? 'bg-accent/20 text-accent border border-accent/40'
                              : 'bg-base-700 text-ink-300',
                        )}
                      >
                        {truck.status}
                      </span>
                    </div>
                  </div>

                  {truck.lat != null && truck.lng != null && (
                    <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-ink-500">
                      <span>
                        GPS: {truck.lat.toFixed(4)}, {truck.lng.toFixed(4)}
                      </span>
                      <span>Heading {truck.heading ?? 0}°</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center / Right: Map Area */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Top Floating Map Controls */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 rounded-lg border border-base-600 bg-base-900/90 p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setViewMode('google')}
              className={cn(
                'rounded px-3 py-1.5 font-mono text-xs font-semibold tracking-wider uppercase transition-colors',
                viewMode === 'google'
                  ? 'bg-accent text-base-950'
                  : 'text-ink-300 hover:text-ink-100',
              )}
            >
              🗺️ Google Maps
            </button>
            <button
              type="button"
              onClick={() => setViewMode('schematic')}
              className={cn(
                'rounded px-3 py-1.5 font-mono text-xs font-semibold tracking-wider uppercase transition-colors',
                viewMode === 'schematic'
                  ? 'bg-accent text-base-950'
                  : 'text-ink-300 hover:text-ink-100',
              )}
            >
              ⚡ Schematic Corridor
            </button>
          </div>

          {/* Map Display */}
          <div className="h-full w-full p-3">
            {viewMode === 'google' ? (
              <GoogleMapView
                trucks={trucks}
                selectedTruckId={selectedTruckId}
                onSelectTruck={setSelectedTruckId}
                height="100%"
                showRerouteDetour={incidents.some((i) => i.status !== 'RESOLVED') || trucks.some((t) => t.status === 'INCIDENT')}
              />
            ) : (
              <div className="h-full w-full rounded-lg border border-base-600 bg-base-900 p-4">
                <NetworkMap
                  trucks={trucks}
                  incidents={incidents}
                  flashIds={flashIds}
                  flashTone={flashTone}
                  onSelectTruck={setSelectedTruckId}
                />
              </div>
            )}
          </div>

          {/* Floating Selected Truck HUD Card */}
          {selectedTruck && (
            <div className="absolute bottom-6 left-6 z-20 max-w-sm rounded-lg border border-base-600 bg-base-900/95 p-4 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between gap-3 border-b border-base-700 pb-2">
                <div>
                  <span className="font-mono text-xs font-bold text-accent">{selectedTruck.id}</span>
                  <span className="ml-2 font-mono text-2xs text-ink-400">{selectedTruck.registrationNo}</span>
                </div>
                <span
                  className={cn(
                    'rounded px-2 py-0.5 font-mono text-[9px] font-semibold uppercase',
                    selectedTruck.status === 'INCIDENT'
                      ? 'bg-danger/20 text-danger border border-danger/40'
                      : 'bg-healthy/20 text-healthy border border-healthy/40',
                  )}
                >
                  {selectedTruck.status}
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 font-mono text-2xs">
                <div>
                  <div className="text-ink-500">LANE</div>
                  <div className="mt-0.5 text-ink-200">
                    {selectedTruck.origin} → {selectedTruck.destination}
                  </div>
                </div>
                <div>
                  <div className="text-ink-500">SPEED / HEADING</div>
                  <div className="mt-0.5 text-ink-200">
                    {Math.round(selectedTruck.speedKmph ?? 0)} km/h · {selectedTruck.heading ?? 0}°
                  </div>
                </div>
                <div>
                  <div className="text-ink-500">CAPACITY / SPARE</div>
                  <div className="mt-0.5 text-ink-200">
                    {formatT(selectedTruck.availableT)} / {formatT(selectedTruck.capacityT)}
                  </div>
                </div>
                <div>
                  <div className="text-ink-500">COORDINATES</div>
                  <div className="mt-0.5 text-ink-200">
                    {selectedTruck.lat.toFixed(4)}, {selectedTruck.lng.toFixed(4)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
