const explicit = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '');

export const HTTP_BASE = explicit ?? '';

export const WS_BASE = explicit
  ? explicit.replace(/^http/, 'ws')
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
