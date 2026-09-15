import { SpeechEnvelope } from './speech-envelope.js';
import { voiceProbabilityOf } from '../vad/index.js';

const SILENCE_DB = -100;

const FLOOR_FALL = 0.25;
const FLOOR_RISE = 0.0008;

const WARMUP_FRAMES = 25;
const WARMUP_RISE = 0.15;

const SPEECH_THRESHOLD = 0.5;
const HANGOVER_MS = 200;

const MAX_ZERO_CROSSING_RATE = 0.35;

const SPEECH_HOLD_MS = 400;
const RECENCY_FLOOR = 0.2;

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);

export class Analyser {
  constructor(frameDurationMs, sampleRate, vad) {
    this.frameDurationMs = frameDurationMs;
    this.sampleRate = sampleRate;
    this.vad = vad;
    this.elapsedMs = 0;
    this.frames = 0;

    this.noiseFloorDb = -60;
    this.rmsDb = SILENCE_DB;
    this.snrDb = 0;
    this.voiceProbability = 0;
    this.isSpeech = false;
    this.recency = 0;
    this.lastSpeechMs = -Infinity;

    this.envelope = new SpeechEnvelope(sampleRate);
  }

  get bandVariance() {
    return this.envelope.bandVariance;
  }

  get envelopeVariance() {
    return this.envelope.envelopeVariance;
  }

  measure(samples, silent = false) {
    this.elapsedMs += this.frameDurationMs;

    if (silent) {
      this.rmsDb = SILENCE_DB;
      this.snrDb = 0;
      this.voiceProbability = 0;
      this.isSpeech = false;
      this.recency = 0;
      this.envelope.track(samples, this.elapsedMs, false);
      return this;
    }

    this.frames += 1;

    const level = rms(samples);
    this.rmsDb = toDb(level);

    const rise = this.frames <= WARMUP_FRAMES ? WARMUP_RISE : FLOOR_RISE;
    const alpha = this.rmsDb < this.noiseFloorDb ? FLOOR_FALL : rise;
    this.noiseFloorDb += (this.rmsDb - this.noiseFloorDb) * alpha;
    this.snrDb = this.rmsDb - this.noiseFloorDb;

    const crossingRate = zeroCrossingRate(samples);
    const tonality =
      crossingRate <= MAX_ZERO_CROSSING_RATE
        ? 1
        : clamp01(1 - (crossingRate - MAX_ZERO_CROSSING_RATE) / (1 - MAX_ZERO_CROSSING_RATE));

    this.voiceProbability = voiceProbabilityOf(
      this.vad.process(samples, {
        sampleRate: this.sampleRate,
        rmsDb: this.rmsDb,
        noiseFloorDb: this.noiseFloorDb,
        snrDb: this.snrDb,
        tonality,
      }),
    );

    const voiced = this.voiceProbability >= SPEECH_THRESHOLD;
    if (voiced) this.lastSpeechMs = this.elapsedMs;

    this.envelope.track(samples, this.elapsedMs, voiced && tonality === 1);

    const sinceSpeechMs = this.elapsedMs - this.lastSpeechMs;
    this.isSpeech = sinceSpeechMs <= HANGOVER_MS;
    this.recency =
      sinceSpeechMs >= SPEECH_HOLD_MS
        ? 0
        : RECENCY_FLOOR + (1 - RECENCY_FLOOR) * (1 - sinceSpeechMs / SPEECH_HOLD_MS);

    return this;
  }
}

function rms(samples) {
  if (samples.length === 0) return 0;

  let sumOfSquares = 0;
  for (let i = 0; i < samples.length; i += 1) sumOfSquares += samples[i] * samples[i];

  return Math.sqrt(sumOfSquares / samples.length);
}

function toDb(amplitude) {
  return amplitude <= 0 ? SILENCE_DB : Math.max(SILENCE_DB, 20 * Math.log10(amplitude));
}

function zeroCrossingRate(samples) {
  if (samples.length < 2) return 0;

  let crossings = 0;
  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i - 1] < 0 !== samples[i] < 0) crossings += 1;
  }

  return crossings / (samples.length - 1);
}
