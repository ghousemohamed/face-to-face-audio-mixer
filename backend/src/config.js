import { fileURLToPath } from 'node:url';

export const PORT = Number(process.env.PORT ?? 8080);

export const RECORDINGS_DIR = fileURLToPath(new URL('../recordings/', import.meta.url));

export const MIXER_OPTIONS = {
  sampleRate: 48_000,
  frameDurationMs: 20,
  mode: 'select',

  vad: process.env.VAD ?? 'silero',
};

export const MAX_MONITOR_BACKLOG_BYTES = 512 * 1024;

export const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
