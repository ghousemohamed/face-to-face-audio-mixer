import { CoreAudioMixer } from '@glot/core-audio-mixer';
import { MAX_MONITOR_BACKLOG_BYTES, MIXER_OPTIONS } from '../config.js';

export class Room {
  constructor(id, { recordings, mixerOptions = MIXER_OPTIONS, onEmpty, logger = console }) {
    this.id = id;
    this.recordings = recordings;
    this.onEmpty = onEmpty;
    this.logger = logger;
    this.mixer = new CoreAudioMixer(mixerOptions);
    this.devices = new Map();
    this.monitors = new Set();
    this.recorder = null;
    this.pending = 0;
    this.operations = Promise.resolve();
    this.closed = false;
    this.mixer.onAudio((frame) => this.publishAudio(frame));
    this.mixer.onTelemetry((snapshot) => this.publishTelemetry(snapshot));
  }

  get audioFormat() {
    return {
      sampleRate: this.mixer.sampleRate,
      channels: 1,
      bitsPerSample: 16,
      frameDurationMs: this.mixer.frameDurationMs,
    };
  }

  get isEmpty() {
    return this.devices.size === 0 && this.monitors.size === 0 && this.pending === 0;
  }

  addDevice(id, { socket, participantName, sampleRate }) {
    return this.enqueue(async () => {
      if (this.closed) throw new Error('Room is closed.');
      if (this.devices.has(id)) throw new Error('Device is already connected.');
      this.recorder ??= await this.recordings.create(this.id, this.audioFormat);
      const microphone = this.mixer.addDevice(id, { sampleRate, format: 'int16' });
      this.devices.set(id, { microphone, socket, participantName: participantName || id });
      return microphone;
    });
  }

  removeDevice(id, socket) {
    return this.enqueue(async () => {
      if (this.devices.get(id)?.socket !== socket) return;
      this.mixer.removeDevice(id);
      this.devices.delete(id);
      if (this.devices.size === 0) await this.stopRecording();
    });
  }

  addMonitor(socket) {
    if (this.closed) throw new Error('Room is closed.');
    this.monitors.add(socket);
    socket.send(JSON.stringify({ type: 'ready', room: this.id, ...this.audioFormat }));
  }

  removeMonitor(socket) {
    this.monitors.delete(socket);
    this.releaseIfEmpty();
  }

  publishAudio(frame) {
    try {
      this.recorder?.write(frame.pcm16);
    } catch (error) {
      this.logger.error('[recording] write failed', error);
    }
    const bytes = Buffer.from(frame.pcm16.buffer, frame.pcm16.byteOffset, frame.pcm16.byteLength);
    this.broadcast(this.monitors, bytes);
  }

  publishTelemetry(snapshot) {
    const message = JSON.stringify({
      type: 'telemetry',
      room: this.id,
      ...snapshot,
      devices: snapshot.devices.map((device) => ({
        ...device,
        participantName: this.devices.get(device.id)?.participantName ?? null,
      })),
    });
    this.broadcast(
      [...this.monitors, ...[...this.devices.values()].map((device) => device.socket)],
      message,
    );
  }

  broadcast(sockets, payload) {
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN && socket.bufferedAmount <= MAX_MONITOR_BACKLOG_BYTES)
        socket.send(payload);
    }
  }

  async stopRecording() {
    const recorder = this.recorder;
    this.recorder = null;
    await recorder?.close();
  }

  enqueue(operation) {
    this.pending += 1;
    const result = this.operations.then(operation).finally(() => {
      this.pending -= 1;
      this.releaseIfEmpty();
    });
    this.operations = result.catch(() => {});
    return result;
  }

  releaseIfEmpty() {
    if (this.isEmpty) {
      this.mixer.stop();
      this.onEmpty?.(this);
    }
  }

  close() {
    this.closed = true;
    return this.enqueue(async () => {
      this.mixer.stop();
      for (const id of this.devices.keys()) this.mixer.removeDevice(id);
      this.devices.clear();
      this.monitors.clear();
      await this.stopRecording();
    });
  }
}
