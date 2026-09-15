import { useCallback, useEffect, useRef, useState } from 'react';

import { WS_BASE } from '../config.js';

export function useDeviceSocket({ roomId, deviceId, participantName, sampleRate, onTelemetry }) {
  const [status, setStatus] = useState('idle');
  const [format, setFormat] = useState(null);

  const socketRef = useRef(null);
  const onTelemetryRef = useRef(onTelemetry);
  onTelemetryRef.current = onTelemetry;

  useEffect(() => {
    if (!roomId || !deviceId) {
      setStatus('idle');
      return undefined;
    }

    const query = new URLSearchParams({ room: roomId, device: deviceId });
    if (participantName) query.set('name', participantName);
    if (sampleRate) query.set('sampleRate', String(sampleRate));

    const socket = new WebSocket(`${WS_BASE}/ws/device?${query}`);
    socketRef.current = socket;
    setStatus('connecting');

    socket.addEventListener('open', () => setStatus('connected'));

    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      const message = JSON.parse(event.data);

      if (message.type === 'ready') setFormat(message);
      else if (message.type === 'telemetry') onTelemetryRef.current?.(message);
      else if (message.type === 'error') setStatus('rejected');
    });

    socket.addEventListener('close', () => {
      socketRef.current = null;
      setStatus((current) => (current === 'rejected' ? current : 'closed'));
    });

    socket.addEventListener('error', () => setStatus('error'));

    return () => {
      socketRef.current = null;
      if (socket.readyState <= WebSocket.OPEN) socket.close(1000, 'left');
    };
  }, [roomId, deviceId, participantName, sampleRate]);

  const sendFrame = useCallback(({ pcm16 }) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(pcm16.buffer);
  }, []);

  return { status, format, sendFrame };
}
