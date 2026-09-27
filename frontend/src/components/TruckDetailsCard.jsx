import React, { useState, useEffect } from 'react';

export default function TruckDetailsCard({ truck, onClose }) {
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    if (!truck) return;

    const calcAgo = () => {
      if (!truck.last_location_update) {
        setSecondsAgo(0);
        return;
      }
      const updateTime = new Date(truck.last_location_update).getTime();
      const diffSec = Math.max(0, Math.floor((Date.now() - updateTime) / 1000));
      setSecondsAgo(diffSec);
    };

    calcAgo();
    const interval = setInterval(calcAgo, 1000);
    return () => clearInterval(interval);
  }, [truck, truck?.last_location_update]);

  if (!truck) return null;

  const route = truck.origin && truck.destination
    ? `${truck.origin} → ${truck.destination}`
    : 'Bengaluru → Chennai';

  const status = (truck.location_status || truck.status || 'ACTIVE').toUpperCase();
  const speed = Math.round(truck.speed_kmph ?? 0);
  const heading = truck.heading ?? 0;

  return (
    <div className="truck-details-overlay">
      <div className="details-header">
        <div className="details-title-row">
          <div className="details-truck-id">
            <span>🚛</span>
            <span>{truck.id}</span>
          </div>
          <div className="details-reg">
            {truck.registration_number || truck.registration_no || 'KA01AB1234'}
          </div>
        </div>
        <button
          className="details-close-btn"
          onClick={onClose}
          aria-label="Close details"
        >
          ✕
        </button>
      </div>

      <div className="details-route-box">
        <div className="details-route-label">Active Route</div>
        <div className="details-route-value">{route}</div>
      </div>

      <div className="details-grid">
        <div className="detail-item">
          <span className="detail-label">Status</span>
          <span className="detail-value">{status}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Speed</span>
          <span className="detail-value speed">{speed} km/h</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Heading</span>
          <span className="detail-value">{heading}°</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Coordinates</span>
          <span className="detail-value" style={{ fontSize: '0.75rem' }}>
            {truck.latitude?.toFixed(4)}, {truck.longitude?.toFixed(4)}
          </span>
        </div>
      </div>

      <div className="detail-footer">
        <span>Last update:</span>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {secondsAgo === 0 ? 'just now' : `${secondsAgo} sec ago`}
        </span>
      </div>
    </div>
  );
}
