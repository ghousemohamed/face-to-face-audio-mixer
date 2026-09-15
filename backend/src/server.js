import { createApplication } from './app.js';
import { PORT, RECORDINGS_DIR } from './config.js';

const application = createApplication();

application.server.listen(PORT, () => {
  console.log(`[http] listening on http://localhost:${PORT}`);
  console.log(`[recordings] ${RECORDINGS_DIR}`);
});

async function shutdown() {
  try {
    await application.close();
  } catch (error) {
    console.error('[server] shutdown failed', error);
    process.exitCode = 1;
  }
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
