export class AudioBuffer {
  constructor(maxSamples) {
    this.maxSamples = maxSamples;
    this.chunks = [];
    this.offset = 0;
    this.length = 0;
  }

  write(samples) {
    if (samples.length === 0) return;

    if (samples.length >= this.maxSamples) {
      this.chunks = [samples.slice(-this.maxSamples)];
      this.offset = 0;
      this.length = this.maxSamples;
      return;
    }

    this.chunks.push(samples.slice());
    this.length += samples.length;

    while (this.length > this.maxSamples && this.chunks.length > 1) {
      this.length -= this.chunks[0].length - this.offset;
      this.chunks.shift();
      this.offset = 0;
    }
  }

  read(target) {
    let written = 0;

    while (written < target.length && this.chunks.length > 0) {
      const chunk = this.chunks[0];
      const take = Math.min(target.length - written, chunk.length - this.offset);

      target.set(chunk.subarray(this.offset, this.offset + take), written);
      written += take;
      this.offset += take;

      if (this.offset === chunk.length) {
        this.chunks.shift();
        this.offset = 0;
      }
    }

    this.length -= written;
    if (written < target.length) target.fill(0, written);

    return written;
  }
}
