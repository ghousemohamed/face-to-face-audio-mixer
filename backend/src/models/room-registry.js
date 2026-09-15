import { Room } from './room.js';

export class RoomRegistry {
  constructor(options) {
    this.options = options;
    this.rooms = new Map();
    this.closed = false;
  }

  get size() {
    return this.rooms.size;
  }

  getOrCreate(id) {
    if (this.closed) throw new Error('Server is shutting down.');
    if (!this.rooms.has(id)) {
      const room = new Room(id, {
        ...this.options,
        onEmpty: (empty) => {
          if (this.rooms.get(id) === empty) this.rooms.delete(id);
        },
      });
      this.rooms.set(id, room);
    }
    return this.rooms.get(id);
  }

  async close() {
    this.closed = true;
    const results = await Promise.allSettled([...this.rooms.values()].map((room) => room.close()));
    this.rooms.clear();
    const errors = results
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason);
    if (errors.length) throw new AggregateError(errors, 'Rooms failed to close.');
  }
}
