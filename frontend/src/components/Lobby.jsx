import { useState } from 'react';

import { ParticipantTile } from './ParticipantTile.jsx';
import { MicIcon, MicOffIcon, SpinnerIcon } from './Icons.jsx';

const ALPHABET = 'abcdefghijkmnopqrstuvwxyz';

function generateRoomId() {
  const group = (length) =>
    Array.from({ length }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
  return `${group(3)}-${group(4)}-${group(3)}`;
}

const normalizeRoomId = (value) => value.trim().toLowerCase().replace(/\s+/g, '-');

const MIC_STATUS_TEXT = {
  idle: 'Starting microphone…',
  requesting: 'Waiting for microphone permission…',
  denied: 'Microphone blocked. Allow access in your browser to join.',
  error: 'Could not open the microphone.',
};

const readStoredName = () => {
  try {
    return window.localStorage.getItem('participant-name') ?? '';
  } catch {
    return '';
  }
};

export function Lobby({ status, muted, onToggleMute, levelRef, deviceName, onJoin }) {
  const [name, setName] = useState(readStoredName);
  const [roomId, setRoomId] = useState(
    () => new URLSearchParams(window.location.search).get('room') ?? '',
  );
  const [touched, setTouched] = useState(false);

  const ready = status === 'ready';
  const room = normalizeRoomId(roomId);
  const trimmedName = name.trim();

  const missingName = touched && trimmedName.length === 0;
  const missingRoom = touched && room.length === 0;

  const submit = (event) => {
    event.preventDefault();
    setTouched(true);
    if (trimmedName.length === 0 || room.length === 0) return;

    try {
      window.localStorage.setItem('participant-name', trimmedName);
    } catch {
    }

    onJoin({ roomId: room, name: trimmedName });
  };

  return (
    <div className="lobby">
      <header className="lobby__brand">
        <span className="lobby__mark" aria-hidden="true" />
        <span>Face&#8209;to&#8209;Face Mixer</span>
      </header>

      <div className="lobby__body">
        <section className="lobby__preview" aria-label="Microphone preview">
          <ParticipantTile
            name={trimmedName || 'You'}
            muted={muted}
            levelRef={levelRef}
            variant="preview"
          />

          <div className="lobby__preview-controls">
            <button
              type="button"
              className="ctl ctl--toggle ctl--sm"
              data-active={muted || undefined}
              aria-pressed={muted}
              aria-label={muted ? 'Turn on microphone' : 'Turn off microphone'}
              onClick={onToggleMute}
              disabled={!ready}
            >
              {muted ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
            </button>
          </div>

          {!ready && (
            <p className="lobby__status" role="status">
              {status === 'requesting' || status === 'idle' ? <SpinnerIcon /> : null}
              {MIC_STATUS_TEXT[status]}
            </p>
          )}
        </section>

        <section className="lobby__join">
          <h1>Ready to join?</h1>
          <p className="lobby__hint">
            Open this room on a second device — or a second tab — to simulate two people
            sitting across from each other.
          </p>

          <form className="lobby__form" onSubmit={submit} noValidate>
            <label className="field" data-invalid={missingName || undefined}>
              <span className="field__label">Your name</span>
              <input
                className="field__input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Alex Morgan"
                autoComplete="name"
                maxLength={40}
                aria-invalid={missingName || undefined}
              />
            </label>
            {missingName && <p className="field__error">Enter your name so others can see you.</p>}

            <label className="field" data-invalid={missingRoom || undefined}>
              <span className="field__label">Room ID</span>
              <input
                className="field__input"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                placeholder="abc-defg-hij"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck="false"
                aria-invalid={missingRoom || undefined}
              />
            </label>
            {missingRoom && <p className="field__error">Enter a room ID to join.</p>}

            <p className="lobby__device">
              Joining as <strong>{deviceName}</strong> — assigned automatically to this tab.
            </p>

            <div className="lobby__actions">
              <button type="submit" className="btn btn--primary" disabled={!ready}>
                Join now
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setRoomId(generateRoomId());
                  setTouched(false);
                }}
              >
                Generate a room ID
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
