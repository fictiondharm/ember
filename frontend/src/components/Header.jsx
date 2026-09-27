import React from 'react';

export default function Header({ wsStatus, trucks }) {
  const truckList = Object.values(trucks);
  const activeCount = truckList.filter(t => (t.location_status === 'ACTIVE' || (t.speed_kmph && t.speed_kmph > 0))).length;
  const avgSpeed = activeCount > 0
    ? Math.round(truckList.reduce((acc, t) => acc + (t.speed_kmph || 0), 0) / (truckList.length || 1))
    : 0;

  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo">
          <div className="brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
          <span>FLEETGRID</span>
        </div>
        <span className="brand-badge">TELEMETRY</span>
      </div>

      <div className="header-stats">
        <div className="stat-item">
          <span className="stat-label">Active Fleet</span>
          <span className="stat-value">{activeCount} / {truckList.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Fleet Avg Speed</span>
          <span className="stat-value">{avgSpeed} km/h</span>
        </div>

        {/* Live WebSocket Connection Pill */}
        <div className={`connection-pill ${wsStatus === 'connected' ? 'live' : 'reconnecting'}`}>
          <span className="status-dot"></span>
          <span>{wsStatus === 'connected' ? '● LIVE' : '● RECONNECTING'}</span>
        </div>
      </div>
    </header>
  );
}
