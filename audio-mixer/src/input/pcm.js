const clamp = (sample) => (sample < -1 ? -1 : sample > 1 ? 1 : sample);

export function toFloat32(audio, format = 'int16') {
  if (audio instanceof Float32Array) return audio;
  if (audio instanceof Int16Array) return fromInt16(audio);

  const bytes =
    audio instanceof ArrayBuffer
      ? new Uint8Array(audio)
      : ArrayBuffer.isView(audio)
        ? new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength)
        : null;

  if (!bytes) {
    throw new TypeError('push() expects a Buffer, ArrayBuffer, DataView or typed array of PCM.');
  }

  if (format !== 'int16' && format !== 'float32') {
    throw new RangeError(`Unsupported format "${format}". Use int16 or float32.`);
  }

  const width = format === 'float32' ? 4 : 2;
  const count = Math.floor(bytes.byteLength / width);
  if (count === 0) return new Float32Array(0);

  const aligned = bytes.byteOffset % width === 0 ? bytes : bytes.slice(0, count * width);

  return format === 'float32'
    ? new Float32Array(aligned.buffer, aligned.byteOffset, count)
    : fromInt16(new Int16Array(aligned.buffer, aligned.byteOffset, count));
}

export function toInt16(samples) {
  const pcm = new Int16Array(samples.length);

  for (let i = 0; i < samples.length; i += 1) {
    const sample = clamp(samples[i]);

    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return pcm;
}

function fromInt16(pcm) {
  const samples = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) {
    samples[i] = pcm[i] < 0 ? pcm[i] / 0x8000 : pcm[i] / 0x7fff;
  }
  return samples;
}
