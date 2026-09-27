import React from 'react';

export default function ActiveTrucksSidebar({ trucks, selectedTruckId, onSelectTruck }) {
  const truckList = Object.values(trucks);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span>Active Trucks</span>
          <span className="truck-count-badge">{truckList.length}</span>
        </div>
      </div>

      <div className="truck-list">
        {truckList.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Waiting for truck locations...
          </div>
        ) : (
          truckList.map((truck) => {
            const isSelected = selectedTruckId === truck.id;
            const speed = Math.round(truck.speed_kmph ?? 0);
            const status = (truck.location_status || truck.status || 'ACTIVE').toUpperCase();
            const isActive = status === 'ACTIVE' || speed > 0;
            const heading = truck.heading ?? 0;
            const route = truck.origin && truck.destination
              ? `${truck.origin} → ${truck.destination}`
              : 'Bengaluru → Chennai';

            return (
              <div
                key={truck.id}
                className={`truck-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectTruck(truck.id)}
              >
                <div className="truck-card-top">
                  <div className="truck-id-group">
                    <span className="truck-icon-badge">🚛</span>
                    <span className="truck-id-text">{truck.id}</span>
                  </div>
                  <span className={`truck-status-tag ${isActive ? 'active' : 'idle'}`}>
                    {status}
                  </span>
                </div>

                <div className="truck-route-text">
                  <span>{route}</span>
                </div>

                <div className="truck-metrics-row">
                  <div className="speed-metric">
                    <span>⚡</span>
                    <span>{speed} km/h</span>
                  </div>
                  <div className="heading-metric">
                    <span
                      className="heading-arrow"
                      style={{ transform: `rotate(${heading}deg)` }}
                    >
                      ▲
                    </span>
                    <span>{heading}°</span>
                  </div>
                  <div className="last-update-metric">
                    {truck.registration_number || truck.registration_no || ''}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
