class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.frameSamples = options?.processorOptions?.frameSamples ?? 960;
    this.buffer = new Float32Array(this.frameSamples);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i += 1) {
      this.buffer[this.offset] = channel[i];
      this.offset += 1;

      if (this.offset === this.frameSamples) {
        this.emitFrame();
        this.offset = 0;
      }
    }

    return true;
  }

  emitFrame() {
    const frame = this.buffer;
    const pcm16 = new Int16Array(frame.length);

    let sumOfSquares = 0;
    for (let i = 0; i < frame.length; i += 1) {
      const sample = frame[i] < -1 ? -1 : frame[i] > 1 ? 1 : frame[i];
      sumOfSquares += sample * sample;
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    this.port.postMessage(
      { pcm16, rms: Math.sqrt(sumOfSquares / frame.length), sampleRate },
      [pcm16.buffer],
    );
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor);
