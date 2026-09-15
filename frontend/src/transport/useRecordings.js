import { useCallback, useEffect, useState } from 'react';

import { HTTP_BASE } from '../config.js';

export function useRecordings(roomId, { enabled }) {
  const [recordings, setRecordings] = useState([]);
  const [status, setStatus] = useState('idle');

  const refresh = useCallback(async () => {
    if (!roomId) return;
    setStatus('loading');

    try {
      const response = await fetch(`${HTTP_BASE}/api/rooms/${encodeURIComponent(roomId)}/recordings`);
      const body = await response.json();
      setRecordings(body.recordings ?? []);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [roomId]);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  return { recordings, status, refresh };
}
