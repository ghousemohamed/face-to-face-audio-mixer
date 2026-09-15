import { useState } from 'react';

import { HTTP_BASE } from '../config.js';
import { useLevelMeter } from '../audio/useLevelMeter.js';
import { usePlayback } from '../audio/usePlayback.js';
import { useMonitorSocket } from '../transport/useMonitorSocket.js';
import { useRecordings } from '../transport/useRecordings.js';
import { DeviceMeter } from './DeviceMeter.jsx';

const MIXED_SAMPLE_RATE = 48_000;

export function MonitorPanel({ roomId, telemetry, onClose }) {
  const [tab, setTab] = useState('live');

  const playback = usePlayback({ sampleRate: telemetry?.sampleRate ?? MIXED_SAMPLE_RATE });
  const meterRef = useLevelMeter(playback.levelRef);

  const monitor = useMonitorSocket({
    roomId,
    enabled: true,
    onAudio: playback.push,
  });

  const recordings = useRecordings(roomId, { enabled: tab === 'recordings' });
  const playing = playback.status === 'playing';
  const devices = telemetry?.devices ?? [];

  return (
    <aside className="panel">
      <header className="panel__head">
        <h2>Mixed output</h2>
        <button type="button" className="panel__close" onClick={onClose} aria-label="Close monitor">
          ✕
        </button>
      </header>

      <div className="panel__tabs" role="tablist">
        {[
          ['live', 'Live'],
          ['recordings', 'Recordings'],
        ].map(([id, title]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className="panel__tab"
            data-active={tab === id || undefined}
            onClick={() => setTab(id)}
          >
            {title}
          </button>
        ))}
      </div>

      {tab === 'live' ? (
        <div className="panel__body">
          <p className="panel__warning">
            Use headphones. Playing the room back through a speaker feeds the mix
            straight into the microphone recording it.
          </p>

          <div className="panel__transport">
            <button
              type="button"
              className={`btn ${playing ? 'btn--ghost-dark' : 'btn--primary'}`}
              onClick={() => (playing ? playback.stop() : playback.start())}
              disabled={monitor.status !== 'connected'}
            >
              {playing ? 'Stop' : 'Play live mix'}
            </button>

            <span className="panel__status" data-status={monitor.status}>
              {monitor.status}
            </span>
          </div>

          <div ref={meterRef} className="panel__output">
            <span className="panel__output-label">output</span>
            <div className="panel__output-bar">
              <span />
            </div>
          </div>

          {playing && (
            <p className="panel__buffer">
              buffer {Math.round(playback.stats.queuedMs)} ms
              {playback.stats.underruns > 0 && ` · ${playback.stats.underruns} underruns`}
            </p>
          )}

          <h3 className="panel__subhead">
            Sources
            {telemetry?.selection?.reason === 'mix' && (
              <span className="panel__hint">mixing all microphones · VAD off</span>
            )}
            {telemetry?.selection?.deviceId && (
              <span className="panel__hint">listening to {telemetry.selection.deviceId}</span>
            )}
          </h3>

          {devices.length === 0 ? (
            <p className="panel__empty">Waiting for a device to send audio…</p>
          ) : (
            <ul className="panel__meters">
              {devices.map((device) => (
                <DeviceMeter key={device.id} device={device} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="panel__body">
          <div className="panel__transport">
            <button type="button" className="btn btn--ghost-dark" onClick={recordings.refresh}>
              Refresh
            </button>
            <span className="panel__status">{recordings.status}</span>
          </div>

          {recordings.recordings.length === 0 ? (
            <p className="panel__empty">
              No recordings yet. One is written each time a room goes from empty to
              occupied, and closed when the last device leaves.
            </p>
          ) : (
            <ul className="panel__recordings">
              {recordings.recordings.map((recording) => (
                <li key={recording.name}>
                  <div className="panel__recording-meta">
                    <span>{new Date(recording.createdAt).toLocaleTimeString()}</span>
                    <span>{recording.durationSeconds.toFixed(1)}s</span>
                  </div>
                  <audio controls preload="none" src={`${HTTP_BASE}${recording.url}`} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
