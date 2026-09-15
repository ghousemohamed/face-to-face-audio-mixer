import { toFloat32 } from './pcm.js';
import { AudioBuffer } from './audio-buffer.js';
import { Resampler } from './resampler.js';

const MAX_BUFFERED_MS = 400;

export class Device {
  constructor(id, { captureSampleRate, mixerSampleRate, format }) {
    this.id = id;
    this.format = format;
    this.sampleRate = mixerSampleRate;

    this.resampler = new Resampler(captureSampleRate, mixerSampleRate);
    this.queue = new AudioBuffer(Math.round((mixerSampleRate * MAX_BUFFERED_MS) / 1000));

    this.frame = null;
    this.received = 0;
    this.starved = false;
  }

  get bufferedMs() {
    return (this.queue.length / this.sampleRate) * 1000;
  }

  push(audio) {
    const samples = toFloat32(audio, this.format);
    if (samples.some((sample) => !Number.isFinite(sample))) {
      throw new TypeError('Audio samples must be finite numbers.');
    }
    this.queue.write(this.resampler.process(samples));
  }

  read(frameSamples) {
    if (this.frame?.length !== frameSamples) this.frame = new Float32Array(frameSamples);

    this.received = this.queue.read(this.frame);
    this.starved = this.received < frameSamples;

    return this.frame;
  }
}
