#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { promises as dns } from 'node:dns';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const FRONTEND_PORT = Number(process.env.PORT_FRONTEND ?? 5173);
const BACKEND_PORT = Number(process.env.PORT_BACKEND ?? 8080);

const argv = process.argv.slice(2);
const roomFlag = argv.indexOf('--room');

function randomRoomId() {
  const letters = 'abcdefghijkmnopqrstuvwxyz';
  const group = (n) =>
    Array.from({ length: n }, () => letters[(Math.random() * letters.length) | 0]).join('');
  return `${group(3)}-${group(4)}-${group(3)}`;
}

const ROOM = roomFlag === -1 ? randomRoomId() : argv[roomFlag + 1];

const colour = process.stdout.isTTY && !process.env.NO_COLOR;
const ESC = String.fromCharCode(27);
const paint = (code, text) => (colour ? `${ESC}[${code}m${text}${ESC}[0m` : text);
const dim = (text) => paint('2', text);
const bold = (text) => paint('1', text);

const PALETTE = { backend: '36', frontend: '35', tunnel: '33', system: '90' };

function write(name, line) {
  const stamp = new Date().toTimeString().slice(0, 8);
  process.stdout.write(
    `${dim(stamp)} ${paint(PALETTE[name] ?? '37', name.padEnd(8))} ${dim('|')} ${line}\n`,
  );
}

const log = (line) => write('system', line);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const running = new Map();
let shuttingDown = false;

function start(name, command, args, { onLine, env, optional = false, ...options } = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
    env: { ...process.env, FORCE_COLOR: colour ? '1' : '0', ...env },
  });

  running.set(name, child);

  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on('line', (line) => {
      if (line.trim()) write(name, line);
      onLine?.(line);
    });
  }

  child.on('exit', (code, signal) => {
    running.delete(name);
    if (shuttingDown) return;
    write(name, dim(`exited (${signal ?? `code ${code}`})`));
    if (!optional) shutdown(code ?? 1);
  });

  child.on('error', (error) => {
    write(name, `failed to start: ${error.message}`);
    if (!shuttingDown) shutdown(1);
  });

  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const [name, child] of running) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
    write(name, dim('stopped'));
  }

  setTimeout(() => {
    for (const child of running.values()) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {}
    }
    process.exit(code);
  }, 2000).unref();

  setTimeout(() => process.exit(code), 500).unref();
}

process.on('SIGINT', () => {
  process.stdout.write('\n');
  shutdown(0);
});
process.on('SIGTERM', () => shutdown(0));

async function waitFor(label, check, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await sleep(250);
  }
  log(`${label} did not come up in time`);
  return false;
}

const isUp = async (url) => {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok;
  } catch {
    return false;
  }
};

const resolves = async (host) => {
  try {
    const resolver = new dns.Resolver({ timeout: 2500, tries: 1 });
    resolver.setServers(['1.1.1.1', '8.8.8.8']);
    return (await resolver.resolve4(host)).length > 0;
  } catch {
    return false;
  }
};

async function openTunnel() {
  if (spawnSync('which', ['cloudflared']).status !== 0) {
    log(bold('cloudflared is required and is not installed.'));
    log('  install it with:  brew install cloudflared');
    return shutdown(1);
  }

  log('opening a Cloudflare tunnel...');

  const url = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 30_000);
    const done = (value) => {
      clearTimeout(timer);
      resolve(value);
    };

    const child = start(
      'tunnel',
      'cloudflared',
      ['tunnel', '--url', `http://localhost:${FRONTEND_PORT}`],
      {
        optional: true,
        onLine: (line) => {
          const match = /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/.exec(line);
          if (match) done(match[0]);
        },
      },
    );

    child.once('exit', () => done(null));
  });

  if (!url) {
    log(bold('the tunnel did not come up; continuing on localhost only'));
    log(dim('two tabs on this machine will work, phones will not'));
    return null;
  }

  const host = new URL(url).host;
  log(`tunnel ready at ${url}`);

  log('waiting for the hostname to resolve...');
  if (!(await waitFor('hostname', () => resolves(host), 45_000))) {
    log(dim('Cloudflare has not published it yet — opening the link may fail at first'));
  }

  return host;
}

async function main() {
  log(`room id ${bold(ROOM)}`);

  start('backend', process.execPath, [join(ROOT, 'backend/src/server.js')]);
  if (!(await waitFor('backend', () => isUp(`http://localhost:${BACKEND_PORT}/health`), 20_000))) {
    return shutdown(1);
  }

  const tunnelHost = await openTunnel();
  if (shuttingDown) return;

  start('frontend', join(ROOT, 'node_modules/.bin/vite'), ['--port', String(FRONTEND_PORT)], {
    cwd: join(ROOT, 'frontend'),
    env: {
      BACKEND_ORIGIN: `http://localhost:${BACKEND_PORT}`,
      ...(tunnelHost ? { VITE_HMR_HOST: tunnelHost } : {}),
    },
  });

  if (!(await waitFor('frontend', () => isUp(`http://localhost:${FRONTEND_PORT}/`), 20_000))) {
    return shutdown(1);
  }

  const query = `?room=${encodeURIComponent(ROOM)}`;
  const joinUrl = tunnelHost
    ? `https://${tunnelHost}/${query}`
    : `http://localhost:${FRONTEND_PORT}/${query}`;
  const rule = dim('-'.repeat(Math.max(joinUrl.length + 4, 52)));

  process.stdout.write(`\n${rule}\n`);
  process.stdout.write(
    `  ${bold(tunnelHost ? 'Join from both devices:' : 'Open on this machine:')}\n\n`,
  );
  process.stdout.write(`  ${bold(paint('32', joinUrl))}\n\n`);
  process.stdout.write(`  ${dim(`room "${ROOM}" is prefilled`)}\n`);
  process.stdout.write(`  ${dim('use headphones if you open the monitor panel')}\n`);
  process.stdout.write(`${rule}\n\n`);
}

main().catch((error) => {
  log(`failed: ${error.message}`);
  shutdown(1);
});
