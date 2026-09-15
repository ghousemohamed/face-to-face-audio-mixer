import { createServer } from 'node:http';
import express from 'express';
import expressWs from 'express-ws';

import { RoomRegistry } from './models/room-registry.js';
import { RecordingStore } from './services/recording-store.js';
import { cors, handleError } from './middleware/http.js';
import { registerRoutes } from './routes.js';

export function createApplication({
  recordings = new RecordingStore(),
  mixerOptions,
  logger = console,
} = {}) {
  const app = express();
  const server = createServer(app);
  const sockets = expressWs(app, server, {
    leaveRouterUntouched: true,
    wsOptions: { maxPayload: 256 * 1024, perMessageDeflate: false },
  }).getWss();
  const rooms = new RoomRegistry({ recordings, mixerOptions, logger });

  app.disable('x-powered-by');
  app.use(cors);
  registerRoutes(app, { rooms, recordings, logger });
  app.use((req, res) => res.status(404).json({ error: 'not_found' }));
  app.use(handleError(logger));

  let closing;
  function close() {
    closing ??= (async () => {
      const stopped = new Promise((resolve, reject) => {
        server.close((error) =>
          error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve(),
        );
      });
      for (const socket of sockets.clients) socket.terminate();
      sockets.close();
      await Promise.all([rooms.close(), stopped]);
    })();
    return closing;
  }

  return { app, server, rooms, close };
}
