import { Device } from './input/device.js';

import { MixingPipeline } from './pipeline.js';

import { FrameClock } from './output/clock.js';
import { Destinations } from './output/destinations.js';
import { Telemetry } from './output/telemetry.js';

const DEFAULTS = { sampleRate: 48_000, frameDurationMs: 20, vad: 'silero', mode: 'select' };

export class CoreAudioMixer {
  constructor(options = {}) {
    const { sampleRate, frameDurationMs, vad, mode } = { ...DEFAULTS, ...options };

    if (mode !== 'mix' && mode !== 'select') throw new RangeError('mode must be mix or select.');

    validateSampleRate(sampleRate);
    if (
      !Number.isFinite(frameDurationMs) ||
      frameDurationMs <= 0 ||
      frameDurationMs > 1000 ||
      !Number.isInteger((sampleRate * frameDurationMs) / 1000)
    ) {
      throw new RangeError(
        'frameDurationMs must produce a whole number of samples and be at most 1000 ms.',
      );
    }
    if (vad !== 'silero' && vad !== 'energy') {
      throw new RangeError('vad must be silero or energy.');
    }

    this.sampleRate = sampleRate;
    this.frameDurationMs = frameDurationMs;

    this.devices = new Map();
    this.pipeline = new MixingPipeline({ sampleRate, frameDurationMs, vad, mode });
    this.destinations = new Destinations();
    this.telemetry = new Telemetry(sampleRate, frameDurationMs);
    this.clock = new FrameClock(frameDurationMs, () => this.tick());
  }

  get frameSamples() {
    return this.pipeline.frameSamples;
  }

  get running() {
    return this.clock.running;
  }

  get deviceIds() {
    return [...this.devices.keys()];
  }

  addDevice(id, { sampleRate, format = 'int16' } = {}) {
    if (typeof id !== 'string' || id.trim() === '')
      throw new TypeError('Device ID must be a nonempty string.');
    if (this.devices.has(id)) throw new Error(`Device "${id}" is already connected.`);
    validateSampleRate(sampleRate ?? this.sampleRate);

    if (format !== 'int16' && format !== 'float32') {
      throw new RangeError('format must be int16 or float32.');
    }

    const device = new Device(id, {
      captureSampleRate: sampleRate ?? this.sampleRate,
      mixerSampleRate: this.sampleRate,
      format,
    });
    this.devices.set(id, device);

    this.start();

    return {
      id,
      push: (audio) => {
        if (this.devices.get(id) === device) device.push(audio);
      },
      remove: () => this.devices.get(id) === device && this.removeDevice(id),
    };
  }

  removeDevice(id) {
    const existed = this.devices.delete(id);

    this.pipeline.forget(id);
    if (this.devices.size === 0) this.stop();

    return existed;
  }

  onAudio(sink) {
    return this.destinations.add(sink);
  }

  onTelemetry(listener) {
    return this.telemetry.subscribe(listener);
  }

  snapshot() {
    return this.telemetry.snapshot;
  }

  start() {
    this.clock.start();
    return this;
  }

  stop() {
    this.clock.stop();
    return this;
  }

  tick() {
    const devices = [...this.devices.values()];
    const { frame, metrics, selectedId, reason } = this.pipeline.process(devices);

    this.destinations.emit(frame);
    this.telemetry.publish({
      frame,
      metrics,
      selectedId,
      reason,
      devices,
      scoreOf: (id) => this.pipeline.scoreOf(id),
    });

    return frame;
  }
}

function validateSampleRate(sampleRate) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new RangeError('sampleRate must be an integer between 8000 and 192000.');
  }
}
