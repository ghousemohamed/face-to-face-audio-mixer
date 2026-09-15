import { DEVICE_ID_PATTERN, ROOM_ID_PATTERN } from '../config.js';

export function roomIdFrom(query) {
  const roomId = typeof query.room === 'string' ? query.room.trim().toLowerCase() : '';
  if (!ROOM_ID_PATTERN.test(roomId)) throw new Error('A valid room query parameter is required.');
  return roomId;
}

export function deviceFrom(query) {
  const deviceId = typeof query.device === 'string' ? query.device.trim() : '';
  if (!DEVICE_ID_PATTERN.test(deviceId))
    throw new Error('A valid device query parameter is required.');
  const sampleRate = query.sampleRate === undefined ? 48_000 : Number(query.sampleRate);
  if (
    typeof query.sampleRate === 'object' ||
    !Number.isInteger(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 192000
  ) {
    throw new Error('sampleRate must be an integer between 8000 and 192000.');
  }
  return {
    deviceId,
    sampleRate,
    participantName: typeof query.name === 'string' ? query.name.trim().slice(0, 100) : deviceId,
  };
}

export function rejectConnection(socket, message, code = 1008) {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify({ type: 'error', error: message }));
  socket.close(code, message.slice(0, 100));
}
