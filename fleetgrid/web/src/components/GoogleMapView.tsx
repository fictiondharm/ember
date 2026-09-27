import { useEffect, useRef, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { ROUTE_CORRIDOR } from '../lib/geo';
import type { Truck } from '../lib/types';

// Dark Mode Map Styles for FleetGrid Control Tower
const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#38bdf8' }, { weight: 1.5 }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#080d1a' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#475569' }],
  },
];

function createTruckMarkerIcon(heading = 0, isMoving = true, status = 'AVAILABLE'): google.maps.Symbol {
  let fillColor = '#10b981'; // healthy emerald
  if (status === 'INCIDENT') {
    fillColor = '#ef4444'; // danger red
  } else if (!isMoving) {
    fillColor = '#f59e0b'; // warn amber
  }

  return {
    path: 'M -8 -14 L 8 -14 L 8 4 L 6 4 L 6 12 L -6 12 L -6 4 L -8 4 Z',
    fillColor,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 1.6,
    rotation: heading,
    anchor: new google.maps.Point(0, 0),
  };
}

interface GoogleMapViewProps {
  trucks: Truck[];
  selectedTruckId?: string | null;
  onSelectTruck?: (truckId: string) => void;
  height?: string | number;
}

// Fallback Radar Map projecting Bangalore-Chennai corridor coordinates to SVG
export function FallbackCorridorMap({
  trucks,
  selectedTruckId,
  onSelectTruck,
}: {
  trucks: Truck[];
  selectedTruckId?: string | null;
  onSelectTruck?: (truckId: string) => void;
}) {
  const minLat = 12.45, maxLat = 13.15;
  const minLng = 77.50, maxLng = 80.35;
  const width = 1000, height = 500;

  const project = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * (width - 160) + 80;
    const y = ((maxLat - lat) / (maxLat - minLat)) * (height - 140) + 70;
    return { x, y };
  };

  const pathPoints = ROUTE_CORRIDOR.map((w) => {
    const pt = project(w.lat, w.lng);
    return `${pt.x},${pt.y}`;
  }).join(' L ');

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-base-600 bg-base-950">
      {/* Background Radar Grid */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(56, 189, 248, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="absolute top-3 left-4 z-10 flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-300">
          Corridor Radar Telemetry (16 Physical Waypoints)
        </span>
      </div>

      <svg className="h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#3ddc97" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Freight Corridor Path */}
        <path
          d={`M ${pathPoints}`}
          fill="none"
          stroke="url(#routeGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />

        {/* 16 Waypoint Markers */}
        {ROUTE_CORRIDOR.map((wp, idx) => {
          const pt = project(wp.lat, wp.lng);
          const isMajor = ['Bengaluru', 'Hosur', 'Krishnagiri', 'Ambur', 'Vellore', 'Sriperumbudur', 'Chennai'].includes(wp.city);
          const yLabelOffset = idx % 2 === 0 ? -14 : 20;

          return (
            <g key={wp.city} className="transition-all">
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isMajor ? 5 : 3.5}
                fill={isMajor ? '#38bdf8' : '#1e293b'}
                stroke={isMajor ? '#ffffff' : '#64748b'}
                strokeWidth={isMajor ? 2 : 1}
              />
              <text
                x={pt.x}
                y={pt.y + yLabelOffset}
                fill={isMajor ? '#f8fafc' : '#94a3b8'}
                fontSize={isMajor ? 10 : 8.5}
                fontWeight={isMajor ? '600' : '400'}
                textAnchor="middle"
                fontFamily="JetBrains Mono, monospace"
              >
                {wp.city}
              </text>
            </g>
          );
        })}

        {/* Active Moving Trucks */}
        {trucks.map((truck: Truck) => {
          if (!truck.lat || !truck.lng) return null;
          const pt = project(truck.lat, truck.lng);
          const isSelected = selectedTruckId === truck.id;
          const speed = truck.speedKmph ?? 0;
          const isMoving = speed > 0;
          const heading = truck.heading ?? 0;

          let color = '#3ddc97'; // emerald
          if (truck.status === 'INCIDENT') color = '#ef4444';
          else if (!isMoving) color = '#f59e0b';

          return (
            <g
              key={truck.id}
              transform={`translate(${pt.x}, ${pt.y})`}
              className="cursor-pointer transition-transform"
              onClick={() => onSelectTruck?.(truck.id)}
            >
              {/* Radar Ping Animation */}
              <circle r="16" fill={`${color}22`}>
                <animate attributeName="r" values="12;24;12" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0.1;0.7" dur="2s" repeatCount="indefinite" />
              </circle>

              {/* Truck Marker Icon */}
              <g transform={`rotate(${heading})`}>
                <rect x="-8" y="-13" width="16" height="26" rx="3" fill={color} stroke="#ffffff" strokeWidth="2" />
                <rect x="-6" y="-11" width="12" height="7" rx="2" fill="#0f172a" />
                <line x1="0" y1="-13" x2="0" y2="-19" stroke={color} strokeWidth="2" />
              </g>

              {/* Truck Badge Tag */}
              <rect
                x="-30"
                y="16"
                width="60"
                height="18"
                rx="4"
                fill="rgba(15, 23, 42, 0.95)"
                stroke={isSelected ? '#3ddc97' : 'rgba(255,255,255,0.2)'}
                strokeWidth="1.2"
              />
              <text
                x="0"
                y="29"
                fill="#f8fafc"
                fontSize="9.5"
                fontWeight="700"
                textAnchor="middle"
                fontFamily="JetBrains Mono, monospace"
              >
                {truck.id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function GoogleMapView({
  trucks,
  selectedTruckId,
  onSelectTruck,
  height = '100%',
}: GoogleMapViewProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Record<string, google.maps.Marker>>({});
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const corridorLineRef = useRef<google.maps.Polyline | null>(null);

  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  // Initialize Google Maps JavaScript API
  useEffect(() => {
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY' || apiKey.trim() === '') {
      return;
    }

    try {
      setOptions({ key: apiKey, v: 'weekly' });
      importLibrary('maps')
        .then((mapsLib) => {
          if (!mapElementRef.current) return;
          const { Map } = mapsLib as google.maps.MapsLibrary;

          // Centered along Bengaluru - Chennai freight corridor
          const map = new Map(mapElementRef.current, {
            center: { lat: 12.8600, lng: 78.5000 },
            zoom: 8,
            styles: DARK_MAP_STYLES,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });

          // Add 16 corridor waypoint markers and polyline
          const corridorPath = ROUTE_CORRIDOR.map((wp) => ({ lat: wp.lat, lng: wp.lng }));
          const polyline = new google.maps.Polyline({
            path: corridorPath,
            geodesic: true,
            strokeColor: '#38bdf8',
            strokeOpacity: 0.85,
            strokeWeight: 4,
          });
          polyline.setMap(map);
          corridorLineRef.current = polyline;

          // City Waypoint Markers
          ROUTE_CORRIDOR.forEach((wp) => {
            const isMajor = ['Bengaluru', 'Hosur', 'Krishnagiri', 'Ambur', 'Vellore', 'Sriperumbudur', 'Chennai'].includes(wp.city);
            if (isMajor) {
              new google.maps.Marker({
                position: { lat: wp.lat, lng: wp.lng },
                map,
                title: wp.city,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 5,
                  fillColor: '#38bdf8',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 1.5,
                },
              });
            }
          });

          infoWindowRef.current = new google.maps.InfoWindow();
          mapRef.current = map;
          setGoogleMapsReady(true);
        })
        .catch((err: Error) => {
          console.warn('Google Maps API failed to load:', err);
          setLoadError(err.message || 'Google Maps failed to load');
        });
    } catch (e: unknown) {
      setLoadError((e as Error).message || 'Google Maps failed to load');
    }

    return () => {
      if (corridorLineRef.current) corridorLineRef.current.setMap(null);
    };
  }, [apiKey]);

  // Sync Truck Markers on state changes
  useEffect(() => {
    if (!googleMapsReady || !mapRef.current || !window.google) return;

    const currentTruckIds = new Set<string>();

    trucks.forEach((truck: Truck) => {
      if (truck.lat == null || truck.lng == null) return;
      currentTruckIds.add(truck.id);

      const pos = new google.maps.LatLng(truck.lat, truck.lng);
      const isMoving = (truck.speedKmph ?? 0) > 0;
      const heading = truck.heading ?? 0;
      const icon = createTruckMarkerIcon(heading, isMoving, truck.status);

      const infoContent = `
        <div style="color: #0f172a; padding: 6px 8px; font-family: sans-serif; font-size: 12px; line-height: 1.4;">
          <div style="font-weight: 700; font-size: 13px; color: #0284c7; margin-bottom: 4px;">${truck.id} (${truck.registrationNo})</div>
          <div><strong>Status:</strong> ${truck.status}</div>
          <div><strong>Speed:</strong> ${Math.round(truck.speedKmph ?? 0)} km/h</div>
          <div><strong>Route:</strong> ${truck.origin} → ${truck.destination}</div>
          <div><strong>Coordinates:</strong> ${truck.lat.toFixed(4)}, ${truck.lng.toFixed(4)}</div>
        </div>
      `;

      const existingMarker = markersRef.current[truck.id];
      if (existingMarker) {
        existingMarker.setPosition(pos);
        existingMarker.setIcon(icon);
        existingMarker.setTitle(`${truck.id} (${Math.round(truck.speedKmph ?? 0)} km/h)`);
      } else {
        const marker = new google.maps.Marker({
          position: pos,
          map: mapRef.current,
          title: `${truck.id} (${Math.round(truck.speedKmph ?? 0)} km/h)`,
          icon,
          label: {
            text: truck.id,
            color: '#f8fafc',
            fontSize: '10px',
            fontWeight: 'bold',
          },
        });

        marker.addListener('click', () => {
          onSelectTruck?.(truck.id);
          if (infoWindowRef.current && mapRef.current) {
            infoWindowRef.current.setContent(infoContent);
            infoWindowRef.current.open(mapRef.current, marker);
          }
        });

        markersRef.current[truck.id] = marker;
      }
    });

    // Cleanup decommissioned markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentTruckIds.has(id)) {
        const toRemove = markersRef.current[id];
        if (toRemove) toRemove.setMap(null);
        delete markersRef.current[id];
      }
    });
  }, [trucks, googleMapsReady, onSelectTruck]);

  // Center on selected truck
  useEffect(() => {
    if (!googleMapsReady || !mapRef.current || !selectedTruckId) return;
    const selected = trucks.find((t: Truck) => t.id === selectedTruckId);
    if (selected && selected.lat != null && selected.lng != null) {
      mapRef.current.panTo({ lat: selected.lat, lng: selected.lng });
      const currentZoom = mapRef.current.getZoom();
      if (currentZoom !== undefined && currentZoom < 10) {
        mapRef.current.setZoom(10);
      }
    }
  }, [selectedTruckId, trucks, googleMapsReady]);

  // Gracefully fallback to SVG Radar Map if Google Maps API key is absent or failing
  const isGoogleMapsAvailable = Boolean(apiKey && apiKey !== 'YOUR_GOOGLE_MAPS_API_KEY' && !loadError);

  if (!isGoogleMapsAvailable) {
    return (
      <div style={{ position: 'relative', width: '100%', height }}>
        <FallbackCorridorMap
          trucks={trucks}
          selectedTruckId={selectedTruckId}
          onSelectTruck={onSelectTruck}
        />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height }} className="overflow-hidden rounded-lg border border-base-600 bg-base-950">
      <div ref={mapElementRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
