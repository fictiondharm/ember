import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import ActiveTrucksSidebar from './components/ActiveTrucksSidebar';
import GoogleMapView from './components/GoogleMapView';
import TruckDetailsCard from './components/TruckDetailsCard';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const WS_BASE = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';

export default function App() {
  const [trucks, setTrucks] = useState({});
  const [selectedTruckId, setSelectedTruckId] = useState(null);
  const [wsStatus, setWsStatus] = useState('reconnecting'); // 'connected' | 'reconnecting'
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // 1. Initial Load: Fetch current truck locations via REST
  const fetchInitialLocations = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/trucks/locations`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      const map = {};
      data.forEach((truck) => {
        map[truck.id] = truck;
      });
      setTrucks((prev) => ({ ...prev, ...map }));
      // Default select first truck if none selected
      if (data.length > 0 && !selectedTruckId) {
        setSelectedTruckId(data[0].id);
      }
    } catch (err) {
      console.warn('Failed to fetch initial truck locations:', err);
    }
  }, [selectedTruckId]);

  // 2. Connect to WebSocket /ws/tracking for live updates
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = `${WS_BASE.replace(/^http/, 'ws')}/ws/tracking`;
    console.log(`Connecting to tracking WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket connected to /ws/tracking');
      setWsStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'TRUCK_LOCATION_UPDATE') {
          setTrucks((prev) => {
            const existing = prev[msg.truck_id] || {};
            return {
              ...prev,
              [msg.truck_id]: {
                ...existing,
                id: msg.truck_id,
                latitude: msg.latitude,
                longitude: msg.longitude,
                speed_kmph: msg.speed_kmph,
                heading: msg.heading,
                status: msg.status || 'ACTIVE',
                location_status: msg.location_status || 'ACTIVE',
                registration_number: msg.registration_number || existing.registration_number,
                registration_no: msg.registration_no || existing.registration_no,
                origin: msg.origin || existing.origin,
                destination: msg.destination || existing.destination,
                last_location_update: msg.timestamp || new Date().toISOString(),
              },
            };
          });
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      console.warn('⚠️ WebSocket disconnected. Reconnecting in 3 seconds...');
      setWsStatus('reconnecting');
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      ws.close();
    };
  }, []);

  // Setup lifecycle: fetch initial locations, then connect WebSocket
  useEffect(() => {
    fetchInitialLocations();
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [fetchInitialLocations, connectWebSocket]);

  const selectedTruck = selectedTruckId ? trucks[selectedTruckId] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      {/* Header with FLEETGRID brand & Live status pill */}
      <Header wsStatus={wsStatus} trucks={trucks} />

      {/* Main Layout: Active Trucks Sidebar + Map Container */}
      <div className="main-layout">
        <ActiveTrucksSidebar
          trucks={trucks}
          selectedTruckId={selectedTruckId}
          onSelectTruck={(id) => setSelectedTruckId(id)}
        />

        <div className="map-container">
          <GoogleMapView
            trucks={trucks}
            selectedTruckId={selectedTruckId}
            onSelectTruck={(id) => setSelectedTruckId(id)}
          />

          {/* Floating Truck Details Overlay */}
          {selectedTruck && (
            <TruckDetailsCard
              truck={selectedTruck}
              onClose={() => setSelectedTruckId(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
