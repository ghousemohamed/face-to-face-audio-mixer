# @glot/core-audio-mixer

Merge live PCM from several microphones in the same room into one mono stream.

When two people sit across a table and each records on their own device, both devices
capture both voices. Summing them comb-filters and duplicates every speaker. This package
instead tracks which microphone is currently carrying speech and emits that one, crossfading
on handover, so downstream you get a single clean conversational stream.

Transport-agnostic: you push PCM in, you get frames out. It knows nothing about WebSocket,
WebRTC, files or HTTP.

Node.js 18+, ESM, no build step.

## Install

```bash
npm install @glot/core-audio-mixer
```

From a checkout of this repository:

```bash
npm ci
npm pack --workspace audio-mixer
npm install /path/to/glot-core-audio-mixer-0.1.0.tgz
```

## Quick start

```js
import { CoreAudioMixer } from '@glot/core-audio-mixer';

const mixer = new CoreAudioMixer();

mixer.onAudio((frame) => {
  downstream.write(Buffer.from(frame.pcm16.buffer));
});

const alice = mixer.addDevice('alice', { sampleRate: 48000 });
const bob = mixer.addDevice('bob', { sampleRate: 16000 });

alice.push(chunkFromAlice);
bob.push(chunkFromBob);

alice.remove();
bob.remove();
```

The clock starts when the first device is added and stops when the last one leaves. While
devices are connected, missing audio is emitted as silence, so the output is continuous
regardless of network jitter.

## Constructor

```js
new CoreAudioMixer({ sampleRate, frameDurationMs, mode, vad });
```

| Option | Default | Accepts |
| --- | --- | --- |
| `sampleRate` | `48000` | Integer 8000–192000. The rate of the output stream. |
| `frameDurationMs` | `20` | Up to 1000 ms, and must divide into a whole number of samples. |
| `mode` | `'select'` | `'select'` to emit one microphone at a time; `'mix'` to average all inputs. |
| `vad` | `'silero'` | `'silero'` or `'energy'`. |

Invalid values throw on construction rather than failing later.

`'select'` is the mode this package exists for. `'mix'` is an equal-gain average of every
connected input with a clipping guard — useful as a baseline to compare against, not for
co-located devices.

`'silero'` runs a bundled ONNX voice-activity model through `onnxruntime-node`. `'energy'`
skips inference entirely, which is faster and dependency-light but noticeably less accurate
in a noisy room. The algorithm is tuned for the default 20 ms frames.

## Devices

### `addDevice(id, options?)`

Registers a microphone and returns a handle.

```js
const handle = mixer.addDevice('alice', { sampleRate: 44100, format: 'int16' });
```

| Option | Default | Notes |
| --- | --- | --- |
| `sampleRate` | the mixer's output rate | Declare the rate you actually capture at; resampling is handled for you. |
| `format` | `'int16'` | `'int16'` or `'float32'`. Only consulted for raw byte input. |

IDs must be nonempty strings and unique among currently connected devices. Re-using the ID
of a *removed* device is fine.

The handle is `{ id, push, remove }`:

- **`push(audio)`** accepts a `Buffer`, `ArrayBuffer`, `DataView`, `Int16Array` or
  `Float32Array`. Typed sample arrays carry their own format, so `format` is ignored for
  those. Input must be **mono**. The data is copied, so you may reuse your capture buffer as
  soon as `push` returns.
- **`remove()`** disconnects the device.

Handles are bound to one device instance. If a device is removed and a new one is later added
with the same ID, the stale handle is inert — it will not push into or remove the new device.

### `removeDevice(id)`

Removes by ID. Returns `true` if a device was connected under that ID.

### `deviceIds`

Array of currently connected IDs.

## Output

### `onAudio(callback)`

Called once per frame. Returns an unsubscribe function.

```js
const unsubscribe = mixer.onAudio((frame) => { /* ... */ });
unsubscribe();
```

| Frame field | Type | Meaning |
| --- | --- | --- |
| `data` | `Float32Array` | One mono frame, clipped to `[-1, 1]`. |
| `pcm16` | `Int16Array` | The same frame as PCM16. Encoded on first access and cached. |
| `sampleRate` | `number` | Output rate. |
| `sequence` | `number` | Frame counter from 0. |
| `timestamp` | `number` | Stream time in milliseconds. |
| `peak` | `number` | Largest absolute sample in the frame. |

Treat frames as read-only and do not retain them. Callbacks run **synchronously** on the
mixing tick: a slow callback delays mixing. Hand work off to a queue or stream and manage
your own backpressure. A callback that throws is logged and isolated — it will not take down
the mixer or other sinks.

Access `pcm16` only if you need it; the encode is skipped otherwise.

### `onTelemetry(callback)` and `snapshot()`

Telemetry is published at most every 100 ms. `snapshot()` returns the latest value on demand.
Both give the same object:

```js
{
  timestamp, sampleRate, frameDurationMs,
  outputPeak,
  selection: { deviceId, changed, reason },   // reason: 'speech' | 'failsafe' | 'silence' | 'mix'
  devices: [{
    id, selected, mixed,
    level, score, voiceProbability, envelopeVariance, isSpeech,
    rmsDb, noiseFloorDb, snrDb,
    starved, bufferedMs,
    vad,                                      // detector stats, or null
  }],
}
```

`selection.deviceId` is `null` when nothing is being emitted. `starved` and `bufferedMs` are
the ones to watch in production — they tell you a device's audio is not arriving fast enough.

### `start()` / `stop()` / `tick()`

`stop()` pauses the clock without disconnecting devices; `start()` resumes. Both return the
mixer.

`tick()` produces exactly one frame synchronously and returns it. Combined with `stop()`, this
drives the mixer deterministically in tests without waiting on real time:

```js
mixer.stop();
alice.push(samples);
const frame = mixer.tick();
```

## Recipes

### Behind a WebSocket server

```js
import { WebSocketServer } from 'ws';
import { CoreAudioMixer } from '@glot/core-audio-mixer';

const mixer = new CoreAudioMixer();
const listeners = new Set();

mixer.onAudio((frame) => {
  const payload = Buffer.from(frame.pcm16.buffer);
  for (const socket of listeners) {
    if (socket.bufferedAmount < 512 * 1024) socket.send(payload);
  }
});

new WebSocketServer({ port: 8080 }).on('connection', (socket, request) => {
  const id = new URL(request.url, 'http://x').searchParams.get('device');
  const device = mixer.addDevice(id, { sampleRate: 48000 });

  socket.on('message', (data) => device.push(data));
  socket.on('close', () => device.remove());
});
```

### Piping into a file or an encoder

```js
import { spawn } from 'node:child_process';

const ffmpeg = spawn('ffmpeg', [
  '-f', 's16le', '-ar', '48000', '-ac', '1', '-i', 'pipe:0', 'out.wav',
]);

mixer.onAudio((frame) => ffmpeg.stdin.write(Buffer.from(frame.pcm16.buffer)));
```

### Feeding a streaming transcription client

```js
mixer.onAudio((frame) => transcription.sendAudio(frame.pcm16));
mixer.onTelemetry(({ selection }) => transcription.setSpeaker(selection.deviceId));
```

Telemetry gives you speaker attribution for free: `selection.deviceId` is the device that
produced the audio you just forwarded.

### Devices at different capture rates

Declare each device's real rate and push natively — no resampling on your side.

```js
mixer.addDevice('laptop', { sampleRate: 48000 });
mixer.addDevice('phone', { sampleRate: 16000 });
```

### Raw float input

```js
const device = mixer.addDevice('alice', { format: 'float32' });
device.push(float32Buffer);
device.push(new Float32Array(samples));
```

## Things to know

- **Input must be mono** and contain finite values. A trailing incomplete sample in raw bytes
  is discarded.
- **One microphone is emitted at a time** in `select` mode. A genuine interruption — both
  people talking at once — keeps only the selected microphone, which still contains both
  voices but favours the nearer speaker. There is no source separation.
- **Devices are not time-aligned.** Selection avoids continuously summing delayed copies, but
  a handover can repeat or drop a moment of audio when two devices have different input
  latency.
- **At most 400 ms is buffered per device.** Beyond that the oldest audio is dropped to bound
  latency. There is no jitter target or drift correction.
- **Little-endian hosts only** — PCM byte conversion uses the platform's typed-array order.
- `onnxruntime-node` is a hard dependency even when `vad: 'energy'` is used.
