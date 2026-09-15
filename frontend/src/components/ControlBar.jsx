import { useEffect, useState } from 'react';

import { HangUpIcon, MicIcon, MicOffIcon, PeopleIcon, WaveIcon } from './Icons.jsx';

function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function ControlBar({
  roomId,
  muted,
  onToggleMute,
  onLeave,
  format,
  connection,
  participantCount,
  monitorOpen,
  onToggleMonitor,
}) {
  const time = useClock();

  return (
    <footer className="controls">
      <div className="controls__meta">
        <span className="controls__time">{time}</span>
        <span className="controls__divider" aria-hidden="true" />
        <span className="controls__room" title="Room ID">
          {roomId}
        </span>
        {format && (
          <span className="controls__format">
            {(format.sampleRate / 1000).toFixed(0)} kHz · mono · {format.frameDurationMs} ms
          </span>
        )}
      </div>

      <div className="controls__actions">
        <button
          type="button"
          className="ctl ctl--toggle"
          data-active={muted || undefined}
          aria-pressed={muted}
          aria-label={muted ? 'Turn on microphone' : 'Turn off microphone'}
          data-tooltip={`${muted ? 'Turn on' : 'Turn off'} microphone (⌘D)`}
          onClick={onToggleMute}
        >
          {muted ? <MicOffIcon /> : <MicIcon />}
        </button>

        <button
          type="button"
          className="ctl ctl--leave"
          aria-label="Leave call"
          data-tooltip="Leave call"
          onClick={onLeave}
        >
          <HangUpIcon />
        </button>

        <button
          type="button"
          className="ctl ctl--panel"
          data-active={monitorOpen || undefined}
          aria-pressed={monitorOpen}
          aria-label="Monitor mixed output"
          data-tooltip="Monitor mixed output"
          onClick={onToggleMonitor}
        >
          <WaveIcon />
        </button>
      </div>

      <div className="controls__status">
        <span className="controls__people" title={`${participantCount} in the room`}>
          <PeopleIcon size={17} />
          <span>{participantCount}</span>
        </span>
        <span className="controls__connection" data-status={connection}>
          {connection}
        </span>
      </div>
    </footer>
  );
}
