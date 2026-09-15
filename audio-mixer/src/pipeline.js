import { Crossfade } from './selection/crossfade.js';
import { Analyser } from './analysis/analyser.js';
import { Selector } from './selection/selector.js';
import { toInt16 } from './input/pcm.js';
import { createVad } from './vad/index.js';

export class MixingPipeline {
  constructor({ sampleRate, frameDurationMs, vad = 'silero', mode = 'select' }) {
    this.sampleRate = sampleRate;
    this.frameDurationMs = frameDurationMs;
    this.vad = vad;
    this.mode = mode;
    this.frameSamples = Math.round((sampleRate * frameDurationMs) / 1000);

    this.analysers = new Map();
    this.selector = new Selector(frameDurationMs);

    this.crossfade = new Crossfade(sampleRate);

    this.sequence = 0;
    this.elapsedMs = 0;
  }

  process(devices) {
    const sources = this.readSources(devices);

    if (this.mode === 'mix') return this.mixSources(devices, sources);

    const metrics = this.measureSources(devices, sources);
    const selectedId = this.selector.choose(metrics);
    const mixed = this.crossfade.render(selectedId, sources, new Float32Array(this.frameSamples));
    const frame = this.createFrame(mixed);

    return { frame, metrics, selectedId, reason: this.selector.reason };
  }

  readSources(devices) {
    const sources = new Map();

    for (const device of devices) {
      sources.set(device.id, device.read(this.frameSamples));
    }

    return sources;
  }

  measureSources(devices, sources) {
    const metrics = new Map();

    for (const device of devices) {
      let analyser = this.analysers.get(device.id);
      if (!analyser) {
        analyser = new Analyser(
          this.frameDurationMs,
          this.sampleRate,
          createVad(this.vad, { sampleRate: this.sampleRate }),
        );
        this.analysers.set(device.id, analyser);
      }

      metrics.set(device.id, analyser.measure(sources.get(device.id), device.received === 0));
    }

    return metrics;
  }

  mixSources(devices, sources) {
    const samples = new Float32Array(this.frameSamples);
    const metrics = new Map();

    const contributing = devices.filter((device) => device.received > 0).length;
    const gain = 1 / Math.max(1, contributing);

    for (const [id, source] of sources) {
      let sumOfSquares = 0;
      for (let i = 0; i < source.length; i += 1) {
        samples[i] += source[i] * gain;
        sumOfSquares += source[i] * source[i];
      }
      const rms = Math.sqrt(sumOfSquares / source.length);
      const rmsDb = rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100;
      metrics.set(id, {
        rmsDb,
        level: Math.max(0, Math.min(1, (rmsDb + 60) / 60)),
        voiceProbability: null,
        envelopeVariance: null,
        isSpeech: null,
        noiseFloorDb: null,
        snrDb: null,
      });
    }

    return { frame: this.createFrame(samples), metrics, selectedId: null, reason: 'mix' };
  }

  createFrame(samples) {
    let peak = 0;

    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[i] < -1 ? -1 : samples[i] > 1 ? 1 : samples[i];
      samples[i] = sample;

      const magnitude = sample < 0 ? -sample : sample;
      if (magnitude > peak) peak = magnitude;
    }

    let encoded = null;

    const frame = {
      data: samples,
      sampleRate: this.sampleRate,
      timestamp: this.elapsedMs,
      sequence: this.sequence,
      peak,

      get pcm16() {
        encoded ??= toInt16(samples);
        return encoded;
      },
    };

    this.sequence += 1;
    this.elapsedMs += this.frameDurationMs;

    return frame;
  }

  scoreOf(deviceId) {
    return this.selector.scoreOf(deviceId);
  }

  forget(deviceId) {
    this.analysers.delete(deviceId);
    this.selector.forget(deviceId);
  }
}
