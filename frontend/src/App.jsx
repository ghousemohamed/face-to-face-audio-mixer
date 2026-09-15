import { useMemo, useState } from 'react';

import { useMicCapture } from './audio/useMicCapture.js';
import { useDeviceSocket } from './transport/useDeviceSocket.js';
import { CallScreen } from './components/CallScreen.jsx';
import { Lobby } from './components/Lobby.jsx';

function createDevice() {
  const suffix = Math.random().toString(16).slice(2, 6).toUpperCase();
  return { id: `device-${suffix}`, name: `Device ${suffix}` };
}

export function App() {
  const [session, setSession] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const device = useMemo(createDevice, []);

  const mic = useMicCapture();

  const socket = useDeviceSocket({
    roomId: session?.roomId,
    deviceId: device.id,
    participantName: session?.name,
    sampleRate: mic.format?.sampleRate,
    onTelemetry: setTelemetry,
  });

  mic.setFrameSink(socket.sendFrame);

  const participants = useMemo(() => {
    const others = (telemetry?.devices ?? [])
      .filter((entry) => entry.id !== device.id)
      .map((entry) => ({
        id: entry.id,
        name: entry.participantName ?? entry.id,
        level: entry.level ?? entry.voiceProbability ?? 0,
        selected: entry.selected,
      }));

    return [
      {
        id: device.id,
        name: session?.name ?? 'You',
        isSelf: true,
        selected: telemetry?.selection?.deviceId === device.id,
      },
      ...others,
    ];
  }, [telemetry, device.id, session?.name]);

  const leave = () => {
    setSession(null);
    setTelemetry(null);
  };

  return (
    <div className="app" data-screen={session ? 'call' : 'lobby'}>
      {session ? (
        <CallScreen
          roomId={session.roomId}
          deviceId={device.id}
          participants={participants}
          muted={mic.muted}
          onToggleMute={mic.toggleMute}
          onLeave={leave}
          levelRef={mic.levelRef}
          format={mic.format}
          connection={socket.status}
          telemetry={telemetry}
        />
      ) : (
        <Lobby
          status={mic.status}
          muted={mic.muted}
          onToggleMute={mic.toggleMute}
          levelRef={mic.levelRef}
          deviceName={device.name}
          onJoin={setSession}
        />
      )}
    </div>
  );
}
