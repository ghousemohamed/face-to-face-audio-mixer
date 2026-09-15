import { createReadStream } from 'node:fs';
import { HEADER_BYTES, wavHeader } from '../services/wav-header.js';

export class RecordingsController {
  constructor(recordings) {
    this.recordings = recordings;
  }

  async index(req, res) {
    const room = req.params.roomId;
    const recordings = await this.recordings.list(room);
    res.json({ room, recordings });
  }

  async show(req, res) {
    const { roomId, name } = req.params;
    const recording = await this.recordings.find(roomId, name);
    if (!recording) return res.status(404).json({ error: 'not_found' });
    const { path, stats, format } = recording;

    const size = stats.size;
    const header = wavHeader(Math.max(0, size - HEADER_BYTES), format);

    const headers = {
      'content-type': 'audio/wav',
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
    };

    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');

    let start = 0;
    let end = size - 1;

    if (range) {
      start = range[1] === '' ? Math.max(0, size - Number(range[2])) : Number(range[1]);
      end = range[1] === '' || range[2] === '' ? size - 1 : Math.min(Number(range[2]), size - 1);

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
        res.writeHead(416, { ...headers, 'content-range': `bytes */${size}` });
        return void res.end();
      }

      res.writeHead(206, {
        ...headers,
        'content-range': `bytes ${start}-${end}/${size}`,
        'content-length': end - start + 1,
      });
    } else {
      res.writeHead(200, { ...headers, 'content-length': size });
    }

    if (req.method === 'HEAD') return void res.end();

    if (start < HEADER_BYTES) {
      res.write(header.subarray(start, Math.min(end + 1, HEADER_BYTES)));
    }

    if (end < HEADER_BYTES) return void res.end();

    const stream = createReadStream(path, { start: Math.max(start, HEADER_BYTES), end });
    stream.on('error', (error) => res.destroy(error));
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }
}
