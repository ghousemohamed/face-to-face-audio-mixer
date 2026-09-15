import { fileURLToPath } from 'node:url';
import { Resampler } from '../input/resampler.js';
import { EnergyVad } from './energy.js';

const SILERO_RATE = 16_000;
const SILERO_CHUNK = 256;

const TARGET_RMS = 0.05;
const MAX_GAIN = 40;

const LOUDNESS_WINDOW = 100;
const LOUDNESS_PERCENTILE = 0.9;

const MODEL_PATH = fileURLToPath(new URL('../../models/silero_vad.onnx', import.meta.url));

let sharedSession = null;

async function loadSession() {
  if (!sharedSession) {
    sharedSession = (async () => {
      const ort = await import('onnxruntime-node');
      const session = await ort.InferenceSession.create(MODEL_PATH);
      return { ort, session };
    })();
  }

  return sharedSession;
}

export class SileroVad {
  constructor({ sampleRate = 48_000 } = {}) {
    this.antiAlias =
      sampleRate > SILERO_RATE
        ? [lowpass(SILERO_RATE / 2.2, sampleRate), lowpass(SILERO_RATE / 2.2, sampleRate)]
        : [];
    this.resampler = new Resampler(sampleRate, SILERO_RATE);
    this.pending = new Float32Array(SILERO_CHUNK);
    this.filled = 0;

    this.probability = 0;
    this.loudest = 0;
    this.recentRms = [];
    this.rmsScratch = [];
    this.ready = false;
    this.unavailable = false;
    this.inFlight = false;

    this.inferences = 0;
    this.skipped = 0;

    this.session = null;
    this.ort = null;
    this.state = null;
    this.sampleRateTensor = null;

    this.fallback = new EnergyVad();
    this.load();
  }

  async load() {
    try {
      const { ort, session } = await loadSession();

      this.ort = ort;
      this.session = session;
      this.state = new ort.Tensor('float32', new Float32Array(2 * 128), [2, 1, 128]);
      this.sampleRateTensor = new ort.Tensor(
        'int64',
        BigInt64Array.from([BigInt(SILERO_RATE)]),
        [1],
      );
      this.ready = true;
    } catch (error) {
      this.unavailable = true;
      console.warn(
        '[core-audio-mixer] Silero VAD unavailable, falling back to the energy detector:',
        error.message,
      );
    }
  }

  process(samples, context) {
    if (this.unavailable) return this.fallback.process(samples, context);

    this.collect(this.resampler.process(this.bandLimit(samples)));

    return this.ready ? this.probability : this.fallback.process(samples, context);
  }

  collect(samples) {
    for (let i = 0; i < samples.length; i += 1) {
      this.pending[this.filled] = samples[i];
      this.filled += 1;

      if (this.filled === SILERO_CHUNK) {
        this.filled = 0;

        this.infer(this.normalise(this.pending));
      }
    }
  }

  bandLimit(samples) {
    let current = samples;
    for (const stage of this.antiAlias) current = stage(current);
    return current;
  }

  normalise(chunk) {
    let sumOfSquares = 0;
    for (let i = 0; i < chunk.length; i += 1) sumOfSquares += chunk[i] * chunk[i];
    const rms = Math.sqrt(sumOfSquares / chunk.length);

    this.recentRms.push(rms);
    if (this.recentRms.length > LOUDNESS_WINDOW) this.recentRms.shift();

    this.rmsScratch.length = 0;
    for (let i = 0; i < this.recentRms.length; i += 1) this.rmsScratch.push(this.recentRms[i]);
    this.rmsScratch.sort((left, right) => left - right);

    this.loudest =
      this.rmsScratch[Math.min(
        this.rmsScratch.length - 1,
        Math.floor(this.rmsScratch.length * LOUDNESS_PERCENTILE),
      )] ?? 0;

    const gain = this.loudest > 0 ? Math.min(TARGET_RMS / this.loudest, MAX_GAIN) : 1;
    const scaled = new Float32Array(chunk.length);

    for (let i = 0; i < chunk.length; i += 1) {
      const value = chunk[i] * (gain > 1 ? gain : 1);
      scaled[i] = value < -1 ? -1 : value > 1 ? 1 : value;
    }

    return scaled;
  }

  stats() {
    return {
      ready: this.ready,
      unavailable: this.unavailable,
      inferences: this.inferences,
      skipped: this.skipped,
    };
  }

  async infer(chunk) {
    if (!this.ready) return;

    if (this.inFlight) {
      this.skipped += 1;
      return;
    }

    this.inFlight = true;

    try {
      const output = await this.session.run({
        input: new this.ort.Tensor('float32', chunk, [1, SILERO_CHUNK]),
        state: this.state,
        sr: this.sampleRateTensor,
      });

      this.state = output.stateN;
      this.probability = output.output.data[0];
      this.inferences += 1;
    } catch (error) {
      this.unavailable = true;
      console.warn('[core-audio-mixer] Silero VAD inference failed:', error.message);
    } finally {
      this.inFlight = false;
    }
  }
}

function lowpass(cutoffHz, sampleRate) {
  const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * 0.707);
  const a0 = 1 + alpha;

  const b0 = (1 - cos) / 2 / a0;
  const b1 = (1 - cos) / a0;
  const b2 = b0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  return (samples) => {
    const out = new Float32Array(samples.length);

    for (let i = 0; i < samples.length; i += 1) {
      const x0 = samples[i];
      const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;

      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
      out[i] = y0;
    }

    return out;
  };
}
