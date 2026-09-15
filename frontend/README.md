# Frontend

Test simulator for the mixer

## Run

```bash
npm start                  # from the repo root — backend, frontend and a public URL
npm run dev -w frontend    # this alone, on http://localhost:5173
```

Running it alone expects a backend on `http://localhost:8080`.

To test with two real phones you need `npm start` from the root. The root script opens a public tunnel
and prints a single link that works everywhere.

| Variable | Effect |
| --- | --- |
| `BACKEND_ORIGIN` | Moves the dev-server proxy target. Default `http://localhost:8080`. |
| `VITE_BACKEND_URL` | Bypasses the proxy and talks to a backend directly. |

The dev server proxies `/api`, `/ws`, `/recordings` and `/health` to the backend, so the app
only ever talks to its own origin — the same build works on localhost, on a LAN, or behind a
tunnel with no address to keep in sync.

## Using the simulator

1. Open the app and allow microphone access. The lobby shows a live level preview, so you can
   confirm the mic works before joining.
2. Enter a room ID, or press **Generate a room ID**, then **Join now**.
3. Open the same room on another device.
4. Press the **waveform button**, bottom right, to open the monitor panel.

`?room=<id>` in the URL prefills the room — that is how one shared link gets two devices into
the same room with a single tap.

**In the call:** your tile shows your level, mute is ⌘D / Ctrl+D, and the tile is outlined and
badged **Live source** whenever the mixer is currently listening to your device.

**In the monitor panel:** *Live* streams the mixed output back and shows every measurement the
mixer used per device — score, VAD, SNR, level, noise floor — and which device is selected.
*Recordings* lists the WAV files written for this room and plays them back.

> **Use headphones when monitoring.** Playing the room out of a speaker feeds the mix straight
> back into the microphone recording it.

## Build

```bash
npm run build -w frontend
npm run preview -w frontend
```
