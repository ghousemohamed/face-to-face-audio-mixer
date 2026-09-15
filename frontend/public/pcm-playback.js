class PcmPlaybackProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const settings = options?.processorOptions ?? {};
    this.prebufferSamples = settings.prebufferSamples ?? 4800;
    this.maxSamples = settings.maxSamples ?? 48000;

    this.queue = [];
    this.offset = 0;
    this.queued = 0;
    this.playing = false;
    this.underruns = 0;
    this.quantaSinceReport = 0;
    this.peak = 0;

    this.port.onmessage = (event) => {
      if (event.data.type === 'reset') {
        this.queue = [];
        this.offset = 0;
        this.queued = 0;
        this.playing = false;
        return;
      }

      const frame = this.toFloat32(event.data.pcm16);
      this.queue.push(frame);
      this.queued += frame.length;

      while (this.queued > this.maxSamples && this.queue.length > 1) {
        const dropped = this.queue.shift();
        this.queued -= dropped.length - this.offset;
        this.offset = 0;
      }
    };
  }

  toFloat32(pcm16) {
    const frame = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i += 1) {
      frame[i] = pcm16[i] < 0 ? pcm16[i] / 0x8000 : pcm16[i] / 0x7fff;
    }
    return frame;
  }

  process(_inputs, outputs) {
    const output = outputs[0][0];
    if (!output) return true;

    if (!this.playing && this.queued >= this.prebufferSamples) this.playing = true;

    if (!this.playing) {
      output.fill(0);
    } else {
      for (let i = 0; i < output.length; i += 1) {
        if (this.queue.length === 0) {
          output.fill(0, i);
          this.underruns += 1;
          this.playing = false;
          break;
        }

        const head = this.queue[0];
        const sample = head[this.offset];
        output[i] = sample;
        this.offset += 1;
        this.queued -= 1;

        const magnitude = sample < 0 ? -sample : sample;
        if (magnitude > this.peak) this.peak = magnitude;

        if (this.offset >= head.length) {
          this.queue.shift();
          this.offset = 0;
        }
      }
    }

    this.quantaSinceReport += 1;
    if (this.quantaSinceReport >= 4) {
      this.port.postMessage({
        peak: this.peak,
        queuedMs: (this.queued / sampleRate) * 1000,
        underruns: this.underruns,
        playing: this.playing,
      });
      this.quantaSinceReport = 0;
      this.peak = 0;
    }

    return true;
  }
}

registerProcessor('pcm-playback', PcmPlaybackProcessor);
