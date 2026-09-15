import { deviceFrom, rejectConnection, roomIdFrom } from './connection.js';

export class DeviceChannel {
  constructor(socket, rooms, logger) {
    this.socket = socket;
    this.rooms = rooms;
    this.logger = logger;
    this.device = null;
  }

  connect(query) {
    this.socket.on('error', (error) => this.logger.error('[device]', error));
    this.socket.on('message', (audio, isBinary) => this.receive(audio, isBinary));
    this.socket.once('close', () => this.disconnect());

    try {
      const roomId = roomIdFrom(query);
      const { deviceId, ...options } = deviceFrom(query);
      this.room = this.rooms.getOrCreate(roomId);
      this.joining = this.room.addDevice(deviceId, { ...options, socket: this.socket });
      this.joining
        .then((device) => {
          this.device = device;
          if (this.socket.readyState === this.socket.OPEN) {
            this.socket.send(
              JSON.stringify({ type: 'ready', room: roomId, deviceId, ...this.room.audioFormat }),
            );
          }
        })
        .catch((error) => {
          this.logger.error('[device] join failed', error);
          rejectConnection(this.socket, 'Unable to join device. Check its ID and try again.');
        });
    } catch (error) {
      rejectConnection(this.socket, error.message);
    }
  }

  receive(audio, isBinary = typeof audio !== 'string') {
    if (!isBinary || !this.device) return;
    if (audio.byteLength % 2 !== 0)
      return rejectConnection(this.socket, 'Audio must contain complete PCM16 samples.');
    try {
      this.device.push(audio);
    } catch (error) {
      this.logger.error('[device] audio rejected', error);
      rejectConnection(this.socket, 'Invalid PCM audio.');
    }
  }

  async disconnect() {
    try {
      const device = await this.joining;
      if (device) await this.room.removeDevice(device.id, this.socket);
    } catch (error) {
      this.logger.error('[device] disconnect', error);
    }
  }
}
