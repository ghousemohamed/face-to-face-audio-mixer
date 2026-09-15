import { useLevelMeter } from '../audio/useLevelMeter.js';
import { MicBars } from './MicBars.jsx';
import { MicOffIcon } from './Icons.jsx';

function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts.at(-1)[0]).toUpperCase();
}

export function ParticipantTile({ name, muted, selected, levelRef, level = 0, variant = 'call' }) {
  const meterRef = useLevelMeter(levelRef);

  return (
    <div
      ref={levelRef ? meterRef : undefined}
      className={`tile tile--${variant}`}
      style={levelRef ? undefined : { '--level': muted ? 0 : level }}
      data-muted={muted || undefined}
      data-selected={selected || undefined}
    >
      <div className="tile__glow" aria-hidden="true" />

      <div className="tile__avatar">
        <span className="tile__ring" aria-hidden="true" />
        <span className="tile__ring tile__ring--outer" aria-hidden="true" />
        <span className="tile__avatar-face">{initials(name)}</span>
      </div>

      <div className="tile__label">
        {muted ? <MicOffIcon size={15} /> : <MicBars />}
        <span>{name}</span>
      </div>

      {selected && (
        <div className="tile__selected" title="The mixer is currently using this microphone">
          Live source
        </div>
      )}

      {muted && (
        <div className="tile__badge" title="Microphone off">
          <MicOffIcon size={17} />
        </div>
      )}
    </div>
  );
}
