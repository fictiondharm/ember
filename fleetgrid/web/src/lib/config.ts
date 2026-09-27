declare const __FLEETGRID_BACKEND__: string;

const rawBackend =
  typeof __FLEETGRID_BACKEND__ === 'string' && __FLEETGRID_BACKEND__
    ? __FLEETGRID_BACKEND__
    : typeof import.meta.env.VITE_API_URL === 'string' && import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL
      : typeof window !== 'undefined' && window.location.port !== '5173'
        ? window.location.origin
        : `${window.location.protocol}//${window.location.hostname}:4000`;

/** Backend origin, e.g. http://192.168.1.20:4000 */
export const API_BASE: string = rawBackend.replace(/\/$/, '');

export const WS_URL: string = `${API_BASE.replace(/^http/, 'ws')}/realtime`;

/** Displayed in the header so judges can see which backend is live. */
export const BACKEND_LABEL: string = API_BASE;
