import { randomUUID } from 'node:crypto';
import { open, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { RECORDINGS_DIR, ROOM_ID_PATTERN } from '../config.js';
import { HEADER_BYTES } from './wav-header.js';
import { WavWriter } from './wav-writer.js';

const RECORDING_NAME = /^[0-9T:.-]+Z(?:-[a-f0-9-]{36})?\.wav$/;

export class RecordingStore {
  constructor(directory = RECORDINGS_DIR) {
    this.directory = directory;
  }

  roomDirectory(roomId) {
    if (typeof roomId !== 'string' || !ROOM_ID_PATTERN.test(roomId)) {
      throw Object.assign(new Error('Invalid room ID.'), { status: 400 });
    }
    return join(this.directory, roomId);
  }

  async create(roomId, format) {
    const name = `${new Date().toISOString().replace(/:/g, '-')}-${randomUUID()}.wav`;
    return new WavWriter(join(this.roomDirectory(roomId), name), format).open();
  }

  async find(roomId, name) {
    const directory = this.roomDirectory(roomId);
    if (typeof name !== 'string' || !RECORDING_NAME.test(name)) {
      throw Object.assign(new Error('Invalid recording name.'), { status: 400 });
    }
    const path = join(directory, name);
    try {
      const stats = await stat(path);
      if (!stats.isFile() || stats.size < HEADER_BYTES) return null;
      const handle = await open(path, 'r');
      try {
        const header = Buffer.alloc(HEADER_BYTES);
        await handle.read(header, 0, HEADER_BYTES, 0);
        const format = { sampleRate: header.readUInt32LE(24), channels: header.readUInt16LE(22) };
        return { path, stats, format };
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async list(roomId) {
    const directory = this.roomDirectory(roomId);
    let names;
    try {
      names = await readdir(directory);
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    const recordings = await Promise.all(
      names
        .filter((name) => RECORDING_NAME.test(name))
        .map(async (name) => {
          const recording = await this.find(roomId, name);
          if (!recording) return null;
          const { stats, format } = recording;
          return {
            name,
            url: `/recordings/${encodeURIComponent(roomId)}/${encodeURIComponent(name)}`,
            bytes: stats.size,
            durationSeconds:
              (stats.size - HEADER_BYTES) / (format.sampleRate * format.channels * 2),
            createdAt: stats.birthtime.toISOString(),
          };
        }),
    );
    return recordings.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
