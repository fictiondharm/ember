import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

// Dark Mode Map Styles for FleetGrid
const DARK_MAP_STYLES = [
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

// Custom vector truck marker icon generator
function createTruckMarkerIcon(heading = 0, isMoving = true) {
  return {
    path: 'M -8 -14 L 8 -14 L 8 4 L 6 4 L 6 12 L -6 12 L -6 4 L -8 4 Z',
    fillColor: isMoving ? '#10b981' : '#f59e0b',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 1.8,
    rotation: heading,
    anchor: new window.google.maps.Point(0, 0),
  };
}

// Fallback Radar Map projecting Bangalore-Chennai corridor coordinates to SVG
function FallbackCorridorMap({ trucks, selectedTruckId, onSelectTruck }) {
  // Bounding box for corridor: Lat: [12.45, 13.15], Lng: [77.50, 80.35]
  const minLat = 12.45, maxLat = 13.15;
  const minLng = 77.50, maxLng = 80.35;
  const width = 1000, height = 550;

  const project = (lat, lng) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * (width - 160) + 80;
    const y = ((maxLat - lat) / (maxLat - minLat)) * (height - 140) + 70;
    return { x, y };
  };

  const waypoints = [
    { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
    { name: 'Electronic City', lat: 12.8452, lng: 77.6602 },
    { name: 'Hosur', lat: 12.7409, lng: 77.8253 },
    { name: 'Krishnagiri', lat: 12.5186, lng: 78.2138 },
    { name: 'Vellore', lat: 12.9165, lng: 79.1325 },
    { name: 'Sriperumbudur', lat: 12.9675, lng: 79.9439 },
    { name: 'Chennai', lat: 13.0674, lng: 80.2376 },
  ];

  const pathPoints = waypoints.map(w => {
    const pt = project(w.lat, w.lng);
    return `${pt.x},${pt.y}`;
  }).join(' L ');

  return (
    <div className="radar-map-wrapper">
      <div className="radar-top-banner">
        <div className="api-key-hint">
          <span>ℹ️ Google Maps JavaScript API:</span>
          <span>Set <code className="key-tag">VITE_GOOGLE_MAPS_API_KEY</code> in <code className="key-tag">frontend/.env</code> to enable Google Maps satellite/vector tiles.</span>
        </div>
        <div style={{ color: 'var(--emerald-400)', fontWeight: 600 }}>
          ⚡ Live Corridor Telemetry Engine Active
        </div>
      </div>

      <svg className="svg-corridor-map" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="corridorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid pattern background */}
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        </pattern>
        <rect width={width} height={height} fill="url(#grid)" />

        {/* Highway Corridor Polyline */}
        <path
          d={`M ${pathPoints}`}
          fill="none"
          stroke="url(#corridorGradient)"
          strokeWidth="4"
          strokeDasharray="8 4"
          filter="url(#glow)"
        />

        {/* Waypoint nodes */}
        {waypoints.map((wp, idx) => {
          const pt = project(wp.lat, wp.lng);
          return (
            <g key={idx}>
              <circle cx={pt.x} cy={pt.y} r="5" fill="#38bdf8" />
              <circle cx={pt.x} cy={pt.y} r="9" fill="none" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1.5" />
              <text
                x={pt.x}
                y={pt.y - 14}
                fill="#94a3b8"
                fontSize="11"
                fontWeight="600"
                textAnchor="middle"
                fontFamily="Inter, sans-serif"
              >
                {wp.name}
              </text>
            </g>
          );
        })}

        {/* Live Moving Trucks */}
        {Object.values(trucks).map(truck => {
          if (truck.latitude == null || truck.longitude == null) return null;
          const pos = project(truck.latitude, truck.longitude);
          const isSelected = selectedTruckId === truck.id;
          const speed = Math.round(truck.speed_kmph ?? 0);
          const isMoving = speed > 0;
          const heading = truck.heading ?? 0;

          return (
            <g
              key={truck.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={() => onSelectTruck(truck.id)}
              style={{ cursor: 'pointer', transition: 'transform 0.4s ease-out' }}
            >
              {/* Selection Halo */}
              {isSelected && (
                <circle r="26" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4">
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0"
                    to="360"
                    dur="10s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Pulsing signal ring */}
              {isMoving && (
                <circle r="18" fill="rgba(16, 185, 129, 0.15)">
                  <animate attributeName="r" values="14;22;14" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Rotated Truck Icon */}
              <g transform={`rotate(${heading})`}>
                <rect x="-9" y="-14" width="18" height="28" rx="4" fill={isMoving ? '#10b981' : '#f59e0b'} stroke="#ffffff" strokeWidth="2" />
                <rect x="-7" y="-12" width="14" height="8" rx="2" fill="#0f172a" />
                <line x1="0" y1="-14" x2="0" y2="-20" stroke="#10b981" strokeWidth="2" />
              </g>

              {/* Truck ID Tag */}
              <rect
                x="-30"
                y="18"
                width="60"
                height="18"
                rx="4"
                fill="rgba(15, 23, 42, 0.9)"
                stroke={isSelected ? '#10b981' : 'rgba(255,255,255,0.2)'}
                strokeWidth="1"
              />
              <text
                x="0"
                y="31"
                fill="#f8fafc"
                fontSize="10"
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

export default function GoogleMapView({ trucks, selectedTruckId, onSelectTruck }) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({}); // markers[truckId]
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Initialize Google Maps JavaScript API if API key is provided
  useEffect(() => {
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY' || apiKey.trim() === '') {
      return;
    }

    const loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places', 'geometry'],
    });

    loader
      .load()
      .then((google) => {
        if (!mapElementRef.current) return;

        // Centered on Bengaluru-Chennai freight corridor
        const map = new google.maps.Map(mapElementRef.current, {
          center: { lat: 12.8600, lng: 78.5000 },
          zoom: 8,
          styles: DARK_MAP_STYLES,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        mapRef.current = map;
        setGoogleMapsReady(true);
      })
      .catch((err) => {
        console.warn('Google Maps API failed to load:', err);
        setLoadError(err.message || 'Google Maps failed to load');
      });
  }, [apiKey]);

  // Maintain markers by truck ID: markersRef.current[truckId]
  // On WebSocket or initial state update:
  //   truck ID exists? -> update existing marker
  //   NO -> create marker
  useEffect(() => {
    if (!googleMapsReady || !mapRef.current || !window.google) return;

    const currentTruckIds = new Set();

    Object.values(trucks).forEach((truck) => {
      if (truck.latitude == null || truck.longitude == null) return;
      currentTruckIds.add(truck.id);

      const pos = new window.google.maps.LatLng(truck.latitude, truck.longitude);
      const isMoving = (truck.speed_kmph ?? 0) > 0;
      const heading = truck.heading ?? 0;
      const icon = createTruckMarkerIcon(heading, isMoving);

      if (markersRef.current[truck.id]) {
        // Update existing marker in-place (do not recreate)
        const marker = markersRef.current[truck.id];
        marker.setPosition(pos);
        marker.setIcon(icon);
        marker.setTitle(`${truck.id} — ${Math.round(truck.speed_kmph ?? 0)} km/h`);
      } else {
        // Create new marker
        const marker = new window.google.maps.Marker({
          position: pos,
          map: mapRef.current,
          title: `${truck.id} — ${Math.round(truck.speed_kmph ?? 0)} km/h`,
          icon,
          label: {
            text: truck.id,
            color: '#f8fafc',
            fontSize: '11px',
            fontWeight: 'bold',
            className: 'truck-map-label',
          },
        });

        marker.addListener('click', () => {
          onSelectTruck(truck.id);
        });

        markersRef.current[truck.id] = marker;
      }
    });

    // Remove obsolete markers if any
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentTruckIds.has(id)) {
        markersRef.current[id].setMap(null);
        delete markersRef.current[id];
      }
    });
  }, [trucks, googleMapsReady, onSelectTruck]);

  // Center/Pan when selectedTruckId changes
  useEffect(() => {
    if (!googleMapsReady || !mapRef.current || !selectedTruckId) return;
    const selected = trucks[selectedTruckId];
    if (selected && selected.latitude != null && selected.longitude != null) {
      mapRef.current.panTo({ lat: selected.latitude, lng: selected.longitude });
      if (mapRef.current.getZoom() < 10) {
        mapRef.current.setZoom(10);
      }
    }
  }, [selectedTruckId, trucks, googleMapsReady]);

  // If no Google Maps API Key or failed, show interactive corridor fallback
  const isGoogleMapsAvailable = Boolean(apiKey && apiKey !== 'YOUR_GOOGLE_MAPS_API_KEY' && !loadError);

  if (!isGoogleMapsAvailable) {
    return (
      <FallbackCorridorMap
        trucks={trucks}
        selectedTruckId={selectedTruckId}
        onSelectTruck={onSelectTruck}
      />
    );
  }

  return (
    <div className="map-container">
      <div ref={mapElementRef} className="google-map-element" />
    </div>
  );
}
