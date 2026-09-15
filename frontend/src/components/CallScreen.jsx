import { useEffect, useState } from 'react';

import { ControlBar } from './ControlBar.jsx';
import { MonitorPanel } from './MonitorPanel.jsx';
import { ParticipantTile } from './ParticipantTile.jsx';

export function CallScreen({
  roomId,
  participants,
  muted,
  onToggleMute,
  onLeave,
  levelRef,
  format,
  connection,
  telemetry,
}) {
  const [monitorOpen, setMonitorOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        onToggleMute();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleMute]);

  return (
    <div className="call" data-panel={monitorOpen || undefined}>
      <main className="call__stage">
        <div className="call__grid" data-count={Math.min(participants.length, 5)}>
          {participants.map((participant) => (
            <ParticipantTile
              key={participant.id}
              name={participant.name}
              selected={participant.selected}
              muted={participant.isSelf ? muted : undefined}
              levelRef={participant.isSelf ? levelRef : undefined}
              level={participant.level}
            />
          ))}
        </div>
      </main>

      {monitorOpen && (
        <MonitorPanel roomId={roomId} telemetry={telemetry} onClose={() => setMonitorOpen(false)} />
      )}

      <ControlBar
        roomId={roomId}
        muted={muted}
        onToggleMute={onToggleMute}
        onLeave={onLeave}
        format={format}
        connection={connection}
        participantCount={participants.length}
        monitorOpen={monitorOpen}
        onToggleMonitor={() => setMonitorOpen((open) => !open)}
      />
    </div>
  );
}
