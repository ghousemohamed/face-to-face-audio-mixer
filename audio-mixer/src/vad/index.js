import { EnergyVad } from './energy.js';
import { SileroVad } from './silero.js';

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);

export function voiceProbabilityOf(value) {
  return Number.isFinite(value) ? clamp01(value) : 0;
}

export function createVad(vad = 'silero', { sampleRate } = {}) {
  if (vad === 'silero') return new SileroVad({ sampleRate });
  if (vad === 'energy') return new EnergyVad();

  throw new RangeError(`Unknown vad "${vad}". Use 'silero' or 'energy'.`);
}
