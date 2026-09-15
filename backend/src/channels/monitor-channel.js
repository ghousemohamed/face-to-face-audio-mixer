import { rejectConnection, roomIdFrom } from './connection.js';

export class MonitorChannel {
  constructor(socket, rooms, logger) {
    this.socket = socket;
    this.rooms = rooms;
    this.logger = logger;
  }

  connect(query) {
    this.socket.on('error', (error) => this.logger.error('[monitor]', error));
    this.socket.once('close', () => this.room?.removeMonitor(this.socket));
    try {
      this.room = this.rooms.getOrCreate(roomIdFrom(query));
      this.room.addMonitor(this.socket);
    } catch (error) {
      rejectConnection(this.socket, error.message);
    }
  }
}
