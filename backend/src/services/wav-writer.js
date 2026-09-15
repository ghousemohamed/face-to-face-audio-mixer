import { createWriteStream } from 'node:fs';
import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { wavHeader } from './wav-header.js';

const MAX_PENDING_BYTES = 1024 * 1024;

export class WavWriter {
  constructor(filePath, { sampleRate = 48_000, channels = 1 } = {}) {
    this.filePath = filePath;
    this.format = { sampleRate, channels };
    this.bytesWritten = 0;
    this.stream = null;
    this.error = null;
    this.closing = null;
  }

  get durationSeconds() {
    return this.bytesWritten / (this.format.sampleRate * this.format.channels * 2);
  }

  async open() {
    await mkdir(dirname(this.filePath), { recursive: true });
    this.stream = createWriteStream(this.filePath, { flags: 'wx' });
    this.stream.on('error', (error) => {
      this.error = error;
    });
    await once(this.stream, 'open');
    this.stream.write(wavHeader(0, this.format));
    return this;
  }

  write(samples) {
    if (this.error || !this.stream || this.closing) return;
    if (this.stream.writableLength + samples.byteLength > MAX_PENDING_BYTES) {
      this.error = new Error('Recording disk cannot keep up with audio.');
      this.stream.destroy(this.error);
      throw this.error;
    }
    const bytes = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
    this.stream.write(Buffer.from(bytes));
    this.bytesWritten += bytes.byteLength;
  }

  close() {
    this.closing ??= this.finalize();
    return this.closing;
  }

  async finalize() {
    if (!this.stream) return null;
    this.stream.end();
    await finished(this.stream);
    if (this.error) throw this.error;
    const handle = await open(this.filePath, 'r+');
    try {
      await handle.write(wavHeader(this.bytesWritten, this.format), 0, 44, 0);
    } finally {
      await handle.close();
    }
    return { path: this.filePath, bytes: this.bytesWritten, durationSeconds: this.durationSeconds };
  }
}
