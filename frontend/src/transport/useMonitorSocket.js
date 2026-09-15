import { useEffect, useRef, useState } from 'react';

import { WS_BASE } from '../config.js';

export function useMonitorSocket({ roomId, enabled, onAudio, onTelemetry }) {
  const [status, setStatus] = useState('idle');
  const [format, setFormat] = useState(null);

  const onAudioRef = useRef(onAudio);
  const onTelemetryRef = useRef(onTelemetry);
  onAudioRef.current = onAudio;
  onTelemetryRef.current = onTelemetry;

  useEffect(() => {
    if (!enabled || !roomId) {
      setStatus('idle');
      return undefined;
    }

    const socket = new WebSocket(`${WS_BASE}/ws/monitor?room=${encodeURIComponent(roomId)}`);
    socket.binaryType = 'arraybuffer';
    setStatus('connecting');

    socket.addEventListener('open', () => setStatus('connected'));

    socket.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        const message = JSON.parse(event.data);
        if (message.type === 'ready') setFormat(message);
        else if (message.type === 'telemetry') onTelemetryRef.current?.(message);
        return;
      }

      onAudioRef.current?.(new Int16Array(event.data));
    });

    socket.addEventListener('close', () => setStatus('closed'));
    socket.addEventListener('error', () => setStatus('error'));

    return () => {
      if (socket.readyState <= WebSocket.OPEN) socket.close(1000, 'unsubscribed');
    };
  }, [roomId, enabled]);

  return { status, format };
}
