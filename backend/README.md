# Backend

WebSocket host for `@glot/core-audio-mixer`. Devices stream microphone audio into a room; the
mixed result is recorded to disk and fanned out to anyone monitoring.

One mixer per room. Rooms are created on demand and released when the last connection leaves.

## Run

```bash
npm run dev --workspace backend     # watch mode
npm start --workspace backend       # plain
```

Listens on `http://localhost:8080`.

| Variable | Default | Effect |
| --- | --- | --- |
| `PORT` | `8080` | HTTP and WebSocket port. |
| `VAD` | `silero` | Set to `energy` to skip the neural detector. |

Audio is fixed at 48 kHz mono, 20 ms frames, in `select` mode.

## HTTP

| Method and path | Returns |
| --- | --- |
| `GET /health` | `{ ok: true, rooms: <count> }` |
| `GET /api/rooms/:roomId/recordings` | Recording metadata for a room, newest first |
| `GET /recordings/:roomId/:name` | The WAV file. Supports `HEAD` and single byte ranges. |

A recording is playable while it is still being written — the response rebuilds the WAV
lengths from the current file size, so you can seek into a take that is still in progress.

## Streaming audio in

```
WS /ws/device?room=<room>&device=<id>&name=<label>&sampleRate=48000
```

| Parameter | Required | Notes |
| --- | --- | --- |
| `room` | yes | Lowercase letters, digits, `_`, `-`. Up to 64 chars. Trimmed and lowercased. |
| `device` | yes | Same, plus uppercase. Must be unique within the room. |
| `name` | no | Display label reported in telemetry. |
| `sampleRate` | no | Your capture rate. Defaults to 48000; resampled server-side. |

Wait for the JSON `ready` message, then send **binary little-endian PCM16 mono** at the rate
you declared. Text frames are ignored.

```js
const socket = new WebSocket('ws://localhost:8080/ws/device?room=demo&device=alice');
socket.binaryType = 'arraybuffer';

socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.type === 'ready') startSendingPcm();
  if (message.type === 'telemetry') render(message.snapshot);
};

socket.send(pcm16Buffer);
```

Devices also receive periodic `telemetry`. Audio sent before `ready` is dropped.

## Monitoring the mix

```
WS /ws/monitor?room=<room>
```

Receives `ready`, then binary mixed PCM16 plus JSON telemetry. Monitors do not create
recordings — a room with only monitors in it records nothing.

Both `ready` messages declare the output audio format, so a client never has to hard-code it.

## Errors

Invalid connections get an error message and close with **1008**. A message above the 256 KiB
limit closes with **1009**. Audio that is not a whole number of PCM16 samples is rejected.

Output to a monitor is skipped while more than 512 KiB is queued on that socket, so one slow
listener cannot stall the room.

## Recordings

Written to `backend/recordings/<room>/<timestamp>.wav`.

A take opens when a room goes from empty to having its first device, and closes when the last
device leaves. A device joining after that starts a new take under a new name. If the disk
falls more than 1 MiB behind, recording stops and reports the failure while live monitoring
keeps running.

## Before deploying this

It is a single-process demo host: rooms live in memory, recordings on local disk. It has open
CORS, no authentication, no room quotas, no retention policy and no dead-peer heartbeat.
Running it for real needs those, plus HTTPS/WSS, shared storage, and a way to route every
device in a room to the process that owns that room.
