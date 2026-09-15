# Face-to-Face Audio Mixer

Two people sit across a table, each recording on their own phone. Both phones pick up both
voices. This turns those overlapping microphone streams into one conversational audio
stream, ready for a translation backend.

Summing the two microphones does not work. The same voice reaches each phone a few
milliseconds apart, so the streams comb-filter against each other and every speaker is
duplicated. Instead the mixer tracks which microphone is currently carrying speech, emits
that one, and crossfades when the answer changes.

| Folder | What it is |
| --- | --- |
| [`audio-mixer/`](audio-mixer/README.md) | The npm package, `@glot/core-audio-mixer`. All the mixing logic. One export, transport-agnostic, no build step, bundled Silero model. |
| [`backend/`](backend/README.md) | WebSocket host. Devices stream in, the mixed stream is recorded to disk and fanned out to listeners. |
| [`frontend/`](frontend/README.md) | The test simulator. Join a room, stream your mic, monitor the mix. |

The package is the deliverable. The backend and frontend exist to prove it works and to
show what integrating it looks like.

## Setup

Requires Node 18+ and [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

```bash
brew install cloudflared
npm install
npm start
```

`npm start` brings up the backend and the frontend, opens a public Cloudflare tunnel, and
prints one link to open on both devices. Logs from all three are interleaved and prefixed.
Ctrl+C stops them together.

```
09:41:02 system   | room id qbn-tkwd-lps
09:41:02 backend  | [http] listening on http://localhost:8080
09:41:03 system   | opening a Cloudflare tunnel...
09:41:08 system   | tunnel ready at https://four-random-words.trycloudflare.com
09:41:08 frontend |   VITE v5.4.21  ready in 84 ms

  Join from both devices:

  https://four-random-words.trycloudflare.com/?room=qbn-tkwd-lps
```

| Command | What it does |
| --- | --- |
| `npm start` | Everything, with a public URL. |
| `node dev.mjs --room my-room` | Pick the room id in the link. |
| `npm run dev:backend` | Backend alone, on port 8080. |
| `npm run dev:frontend` | Frontend alone, on port 5173, proxying to 8080. |

Browsers only grant microphone access in a secure context, so a phone pointed at
`http://192.168.x.x:5173` is refused. localhost is the one exception, which is why your
laptop works without a tunnel and your phone does not. The frontend proxies the backend,
so a single tunnel covers the page, the API, the recordings and both WebSockets.

## Running the simulator

1. Open the link and allow microphone access.
2. Enter a room ID, or press **Generate a room ID**, then **Join now**.
3. Open the same room on a second device, or in a second tab, to play the other person.
   Each tab is one device.
4. Press the **waveform button**, bottom right, to open the monitor panel.
   - **Live** streams the mixed output back and shows every measurement behind the
     decision per device: score, VAD, SNR, level, noise floor, and which device is
     selected.
   - **Recordings** lists the WAV files written for this room and plays them back.

Devices can join and leave at any time. The room reflows, and the mixer starts scoring a
new microphone from its first frame.

> **Use headphones when monitoring.** Playing the room out of a speaker feeds the mix
> straight back into the microphone recording it.

A recording opens when a room goes from empty to occupied and closes when the last device
leaves, at `backend/recordings/<room>/<timestamp>.wav`. It is playable while it is still
being written.

## Integrating the mixer into your own project

The package knows nothing about this server, or about WebSocket, WebRTC or HTTP. You push
PCM in and you get mixed frames out, so any transport works.

Build an installable tarball:

```bash
npm pack --workspace audio-mixer
npm install /path/to/glot-core-audio-mixer-0.1.0.tgz
```

Then wire your own source and destination:

```js
import { CoreAudioMixer } from '@glot/core-audio-mixer';

const mixer = new CoreAudioMixer();

mixer.onAudio((frame) => downstream.write(Buffer.from(frame.pcm16.buffer)));

const alice = mixer.addDevice('alice', { sampleRate: 48000 });
const bob = mixer.addDevice('bob', { sampleRate: 16000 });

alice.push(chunk);
bob.push(chunk);

alice.remove();
```

Devices can declare different capture rates and get resampled for you. The clock starts
with the first device and stops with the last, and missing audio becomes silence, so the
output stays continuous through network jitter.

`onTelemetry` reports which device is selected, which gives you speaker attribution
alongside the audio. [`audio-mixer/README.md`](audio-mixer/README.md) has the full API,
every option, and worked examples for a WebSocket server, an ffmpeg pipe, and a streaming
transcription client.

For a working host, read [`backend/src/routes.js`](backend/src/routes.js), then
[`Room`](backend/src/models/room.js), which owns one mixer and its recording.

## How it works

```
browser mic ─ 20 ms PCM frames ─→ WebSocket ─→ room's CoreAudioMixer
                                                      │
                            take → vad → select → crossfade → unify → destination
                                                      │
                                       ┌──────────────┴──────────────┐
                                   WAV on disk                 every listener
```

Each device gets a Silero voice-activity detector. The mixer scores every microphone on
speech probability, per-band envelope variance relative to the others, and how recently it
carried speech. Envelope variance is what separates the person speaking into their own
phone from the same voice bleeding into the other one across the table. A challenger has
to win across three smoothed windows before it takes over, which stops a cough or a chair
scrape from stealing the stream.

Set `vad: 'energy'` to skip the neural model, or `mode: 'mix'` to average all inputs
instead, which is useful as a baseline to compare against.

## Current limits

- **Overlapping speech.** One microphone is emitted at a time, so a genuine interruption
  keeps only the selected phone, which still contains both voices but favours whoever is
  nearer. Solving it properly means synchronised multi-source mixing. The selector is
  isolated behind one interface so it can be replaced without touching the rest.
- **Devices are not time-aligned.** Selection avoids continuously summing delayed copies,
  but a handover can repeat or drop a moment of audio when two phones have different input
  latency.
- **Capture processing is unverified across hardware.** The simulator turns on automatic
  gain control and echo cancellation and turns off noise suppression. Those choices move
  the measurements the selector reads, and they need testing on real devices.
- **Storage is local disk.** Rooms live in memory and recordings live on the filesystem of
  whichever process served them, which is fine for a simulator and not for anything
  shared.
