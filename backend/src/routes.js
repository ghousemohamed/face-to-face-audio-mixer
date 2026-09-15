import { RecordingsController } from './controllers/recordings-controller.js';
import { DeviceChannel } from './channels/device-channel.js';
import { MonitorChannel } from './channels/monitor-channel.js';

export function registerRoutes(app, { rooms, recordings, logger }) {
  const controller = new RecordingsController(recordings);

  app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size }));
  app.get('/api/rooms/:roomId/recordings', (req, res) => controller.index(req, res));
  app.get('/recordings/:roomId/:name', (req, res) => controller.show(req, res));

  app.ws('/ws/device', (socket, req) =>
    new DeviceChannel(socket, rooms, logger).connect(req.query),
  );
  app.ws('/ws/monitor', (socket, req) =>
    new MonitorChannel(socket, rooms, logger).connect(req.query),
  );
}
