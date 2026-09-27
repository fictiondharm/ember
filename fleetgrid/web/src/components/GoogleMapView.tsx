import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ROUTE_CORRIDOR } from '../lib/geo';
import type { Truck } from '../lib/types';

// Alternate Bypass Route for Rerouting System (SH-17 Denkanikottai bypass around Hosur blockade)
export const DETOUR_COORDINATES: Array<[number, number]> = [
  [12.9716, 77.5946], // Bengaluru
  [12.8399, 77.6770], // Electronic City
  [12.7800, 77.7200], // Detour Start (Bypass junction before Hosur)
  [12.6300, 77.7900], // SH-17 Denkanikottai bypass
  [12.5800, 77.9200], // Rayakottai connector
  [12.5186, 78.2137], // Rejoin NH-48 at Krishnagiri
  [12.6825, 78.6234], // Vaniyambadi
  [12.7904, 78.7166], // Ambur
  [12.9165, 79.1325], // Vellore
  [12.9249, 79.3326], // Walajapet
  [12.9675, 79.9404], // Sriperumbudur
  [13.0827, 80.2707], // Chennai Port
];

interface GoogleMapViewProps {
  trucks: Truck[];
  selectedTruckId?: string | null;
  onSelectTruck?: (truckId: string) => void;
  height?: string | number;
  showRerouteDetour?: boolean;
}

type MapLayerType = 'google-roadmap' | 'google-satellite' | 'dark-matter';

export function GoogleMapView({
  trucks,
  selectedTruckId,
  onSelectTruck,
  height = '100%',
  showRerouteDetour = false,
}: GoogleMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const corridorLineRef = useRef<L.Polyline | null>(null);
  const detourLineRef = useRef<L.Polyline | null>(null);

  const [activeLayer, setActiveLayer] = useState<MapLayerType>('google-roadmap');
  const [mapInitialized, setMapInitialized] = useState(false);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || leafletMapRef.current) return;

    // Centered along Bengaluru - Chennai freight corridor
    const map = L.map(mapContainerRef.current, {
      center: [12.8600, 78.8500],
      zoom: 8,
      minZoom: 6,
      maxZoom: 18,
      zoomControl: false,
    });

    // Custom Zoom Control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    leafletMapRef.current = map;

    // 1. Draw Freight Corridor Polyline (Cyan Glow)
    const corridorLatLngs: [number, number][] = ROUTE_CORRIDOR.map((wp) => [wp.lat, wp.lng]);
    const corridorPolyline = L.polyline(corridorLatLngs, {
      color: '#38bdf8',
      weight: 4.5,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    corridorLineRef.current = corridorPolyline;

    // 2. Add Waypoint City Markers
    ROUTE_CORRIDOR.forEach((wp) => {
      const isMajor = ['Bengaluru', 'Hosur', 'Krishnagiri', 'Ambur', 'Vellore', 'Sriperumbudur', 'Chennai'].includes(wp.city);
      if (isMajor) {
        const wpIcon = L.divIcon({
          className: 'custom-wp-icon',
          html: `
            <div style="display: flex; flex-direction: column; align-items: center; pointer-events: none;">
              <div style="width: 10px; height: 10px; border-radius: 50%; background: #38bdf8; border: 2px solid #ffffff; box-shadow: 0 0 10px rgba(56,189,248,0.8);"></div>
              <div style="margin-top: 4px; font-family: monospace; font-size: 10px; font-weight: 700; color: #f8fafc; background: rgba(15,23,42,0.85); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); white-space: nowrap;">
                ${wp.city}
              </div>
            </div>
          `,
          iconSize: [60, 32],
          iconAnchor: [30, 5],
        });
        L.marker([wp.lat, wp.lng], { icon: wpIcon, interactive: false }).addTo(map);
      }
    });

    setMapInitialized(true);

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  // Switch Tile Layer (Google Roadmap / Google Satellite / Dark Logistics)
  useEffect(() => {
    if (!leafletMapRef.current) return;
    const map = leafletMapRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    let attribution = 'Map data &copy; <a href="https://maps.google.com">Google</a>';
    let maxZoom = 19;

    if (activeLayer === 'google-satellite') {
      url = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      attribution = 'Imagery &copy; <a href="https://maps.google.com">Google</a>';
    } else if (activeLayer === 'dark-matter') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      attribution = '&copy; <a href="https://carto.com/">CARTO</a>';
      maxZoom = 20;
    }

    const tileLayer = L.tileLayer(url, {
      attribution,
      maxZoom,
      subdomains: ['a', 'b', 'c', 'd'],
    });

    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;
  }, [activeLayer, mapInitialized]);

  // Render or toggle Detour / Reroute Corridor Polyline
  const hasIncidentTruck = trucks.some((t) => t.status === 'INCIDENT');
  const shouldShowDetour = showRerouteDetour || hasIncidentTruck;

  useEffect(() => {
    if (!leafletMapRef.current) return;
    const map = leafletMapRef.current;

    if (shouldShowDetour) {
      if (!detourLineRef.current) {
        const detourLine = L.polyline(DETOUR_COORDINATES, {
          color: '#f59e0b', // warning amber
          weight: 4,
          opacity: 0.95,
          dashArray: '8, 8',
          lineCap: 'round',
        }).addTo(map);

        detourLine.bindTooltip('<b>AI DETOUR ACTIVE:</b> SH-17 Denkanikottai Bypass around Hosur (+24 km)', {
          sticky: true,
          className: 'detour-tooltip',
        });

        detourLineRef.current = detourLine;
      }
    } else {
      if (detourLineRef.current) {
        map.removeLayer(detourLineRef.current);
        detourLineRef.current = null;
      }
    }
  }, [shouldShowDetour, mapInitialized]);

  // Synchronize Live Trucks Telemetry Markers
  useEffect(() => {
    if (!leafletMapRef.current || !mapInitialized) return;
    const map = leafletMapRef.current;
    const currentTruckIds = new Set<string>();

    trucks.forEach((truck) => {
      if (truck.lat == null || truck.lng == null) return;
      currentTruckIds.add(truck.id);

      const isSelected = selectedTruckId === truck.id;
      const speed = Math.round(truck.speedKmph ?? 0);
      const heading = truck.heading ?? 0;
      const isIncident = truck.status === 'INCIDENT';
      const isMoving = speed > 0;

      let color = '#3ddc97'; // emerald healthy
      let statusLabel = 'ACTIVE';
      if (isIncident) {
        color = '#ef4444'; // danger red
        statusLabel = 'SOS / INCIDENT';
      } else if (!isMoving) {
        color = '#f59e0b'; // amber stopped
        statusLabel = 'IDLE';
      }

      // Custom animated rotating truck vehicle marker
      const htmlContent = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: scale(${isSelected ? '1.18' : '1'}); transition: transform 0.2s ease;">
          <!-- Radar Ping Wave -->
          <div style="
            position: absolute;
            top: 7px;
            width: ${isIncident ? '44px' : '36px'};
            height: ${isIncident ? '44px' : '36px'};
            border-radius: 50%;
            background: ${color}26;
            border: 1px solid ${color}88;
            transform: translate(0, -50%);
            animation: ${isIncident ? 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' : 'pulse 2s infinite'};
          "></div>

          <!-- Rotating Vehicle Cab Icon -->
          <div style="
            transform: rotate(${heading}deg);
            transition: transform 0.4s ease-out;
            background: ${color};
            border: 2px solid #ffffff;
            border-radius: 4px;
            width: 18px;
            height: 28px;
            box-shadow: 0 0 14px ${color}aa;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding-top: 3px;
          ">
            <!-- Windshield -->
            <div style="width: 12px; height: 6px; background: #0f172a; border-radius: 2px;"></div>
            <!-- Headlights Indicator -->
            <div style="width: 2px; height: 6px; background: #ffffff; margin-top: 2px;"></div>
          </div>

          <!-- ID Badge Pill -->
          <div style="
            margin-top: 4px;
            font-family: monospace;
            font-size: 10px;
            font-weight: 700;
            color: #ffffff;
            background: rgba(15, 23, 42, 0.95);
            padding: 2px 7px;
            border-radius: 4px;
            border: 1.5px solid ${isSelected ? '#38bdf8' : color};
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            ${isIncident ? '<span style="color: #ef4444; font-size: 11px;">🚨</span>' : ''}
            <span>${truck.id}</span>
            <span style="color: #94a3b8; font-size: 9px;">${speed}km/h</span>
          </div>
        </div>
      `;

      const truckIcon = L.divIcon({
        className: `truck-marker-${truck.id}`,
        html: htmlContent,
        iconSize: [70, 60],
        iconAnchor: [35, 14],
      });

      const popupContent = `
        <div style="min-width: 220px; font-family: sans-serif; color: #0f172a; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
            <strong style="font-size: 14px; color: #0369a1; font-family: monospace;">${truck.id}</strong>
            <span style="font-size: 10px; font-weight: bold; background: ${color}20; color: ${color}; border: 1px solid ${color}60; padding: 2px 6px; border-radius: 4px;">
              ${statusLabel}
            </span>
          </div>
          <div style="font-size: 11px; line-height: 1.5; color: #334155;">
            <div><strong>Plate:</strong> ${truck.registrationNo}</div>
            <div><strong>Corridor:</strong> ${truck.origin} &rarr; ${truck.destination}</div>
            <div><strong>Speed:</strong> ${speed} km/h (Heading ${heading}&deg;)</div>
            <div><strong>GPS:</strong> ${truck.lat.toFixed(4)}, ${truck.lng.toFixed(4)}</div>
            <div><strong>Available Capacity:</strong> ${truck.availableT}T / ${truck.capacityT}T</div>
          </div>
          ${
            isIncident
              ? `<div style="margin-top: 8px; padding: 6px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; font-size: 11px; color: #991b1b;">
                  <strong>🚨 CRITICAL EMERGENCY SOS:</strong> Truck immobilized. AI Reroute & Detour in progress.
                </div>`
              : ''
          }
        </div>
      `;

      const existingMarker = markersRef.current[truck.id];
      if (existingMarker) {
        existingMarker.setLatLng([truck.lat, truck.lng]);
        existingMarker.setIcon(truckIcon);
        existingMarker.setPopupContent(popupContent);
      } else {
        const marker = L.marker([truck.lat, truck.lng], { icon: truckIcon })
          .bindPopup(popupContent)
          .addTo(map);

        marker.on('click', () => {
          onSelectTruck?.(truck.id);
        });

        markersRef.current[truck.id] = marker;
      }
    });

    // Cleanup decommissioned markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentTruckIds.has(id)) {
        const markerToRemove = markersRef.current[id];
        if (markerToRemove) map.removeLayer(markerToRemove);
        delete markersRef.current[id];
      }
    });
  }, [trucks, selectedTruckId, mapInitialized, onSelectTruck]);

  // Center on selected truck
  useEffect(() => {
    if (!leafletMapRef.current || !selectedTruckId) return;
    const selected = trucks.find((t) => t.id === selectedTruckId);
    if (selected && selected.lat != null && selected.lng != null) {
      leafletMapRef.current.panTo([selected.lat, selected.lng], { animate: true, duration: 0.8 });
    }
  }, [selectedTruckId, trucks]);

  const fitCorridor = () => {
    if (!leafletMapRef.current) return;
    leafletMapRef.current.setView([12.8600, 78.8500], 8, { animate: true });
  };

  const focusIncidentTruck = () => {
    const inc = trucks.find((t) => t.status === 'INCIDENT');
    if (inc && inc.lat != null && inc.lng != null && leafletMapRef.current) {
      leafletMapRef.current.setView([inc.lat, inc.lng], 12, { animate: true });
      onSelectTruck?.(inc.id);
    }
  };

  return (
    <div
      style={{ position: 'relative', width: '100%', height }}
      className="overflow-hidden rounded-lg border border-base-600 bg-base-950 shadow-2xl"
    >
      {/* Map Canvas */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

      {/* Floating Tactical Control Toolbar */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2">
        {/* Layer Switcher Pills */}
        <div className="flex items-center rounded-lg border border-base-600 bg-base-900/90 p-1 shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={() => setActiveLayer('google-roadmap')}
            className={`rounded px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              activeLayer === 'google-roadmap'
                ? 'bg-accent text-white shadow-sm'
                : 'text-ink-400 hover:text-ink-100'
            }`}
          >
            🗺️ Google Roads
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('google-satellite')}
            className={`rounded px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              activeLayer === 'google-satellite'
                ? 'bg-accent text-white shadow-sm'
                : 'text-ink-400 hover:text-ink-100'
            }`}
          >
            🛰️ Satellite
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('dark-matter')}
            className={`rounded px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              activeLayer === 'dark-matter'
                ? 'bg-healthy text-base-950 shadow-sm'
                : 'text-ink-400 hover:text-ink-100'
            }`}
          >
            🌃 Ops Dark
          </button>
        </div>

        {/* Corridor Reset Button */}
        <button
          type="button"
          onClick={fitCorridor}
          className="rounded-lg border border-base-600 bg-base-900/90 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-200 shadow-lg backdrop-blur-md hover:bg-base-800 hover:text-ink-50 cursor-pointer"
        >
          Corridor View
        </button>

        {/* SOS Alert Quick-Zoom Button */}
        {hasIncidentTruck && (
          <button
            type="button"
            onClick={focusIncidentTruck}
            className="flex items-center gap-1.5 rounded-lg border border-danger/60 bg-danger/20 px-3 py-1.5 text-2xs font-bold uppercase tracking-wider text-danger shadow-lg backdrop-blur-md animate-pulse hover:bg-danger/30 cursor-pointer"
          >
            <span>🚨</span>
            <span>Zoom SOS Incident</span>
          </button>
        )}
      </div>

      {/* Floating Status Badge (Bottom Left) */}
      <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2 rounded-md border border-base-700 bg-base-950/85 px-3 py-1.5 backdrop-blur-md">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-healthy opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-healthy" />
        </span>
        <span className="font-mono text-[10px] text-ink-300">
          Google Maps Live Engine &bull; {trucks.length} Trucks Monitored
        </span>
        {shouldShowDetour && (
          <span className="ml-1 rounded bg-warn/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-warn border border-warn/40">
            DETOUR ACTIVE
          </span>
        )}
      </div>
    </div>
  );
}

// Fallback Radar Map projecting Bangalore-Chennai corridor coordinates to SVG (kept for backward compatibility)
export function FallbackCorridorMap({
  trucks,
  selectedTruckId,
  onSelectTruck,
}: {
  trucks: Truck[];
  selectedTruckId?: string | null;
  onSelectTruck?: (truckId: string) => void;
}) {
  return (
    <GoogleMapView
      trucks={trucks}
      selectedTruckId={selectedTruckId}
      onSelectTruck={onSelectTruck}
    />
  );
}
