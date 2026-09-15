export const HEADER_BYTES = 44;
const SAMPLE_RATE = 48_000;

export function wavHeader(dataBytes, { sampleRate = SAMPLE_RATE, channels = 1 } = {}) {
  const blockAlign = channels * 2;
  const header = Buffer.alloc(HEADER_BYTES);

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(HEADER_BYTES - 8 + dataBytes, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataBytes, 40);

  return header;
}
