# Lighto

Pioneer CDJ–style spectrum light visualizer for iPhone Safari. Uses the device microphone, analyzes live audio, and draws cyan/orange frequency bars, a beat-synced wave pulse, heavy 808 kick boom, jog-platter glow, live BPM, DDJ-FLX4-style amber channel LED meters, and a Serato-style scrolling spectral waveform panel.

## One-command local preview

```bash
npx --yes serve -l 3000
```

Then open `http://localhost:3000` on the same machine.

## Open on iPhone Safari (mic requires HTTPS)

**Live:** https://ewanders1-web.github.io/lighto-cdj/

1. Open the Pages URL in **Safari**
2. Tap **Tap to listen**
3. Allow microphone access when prompted

### Add to Home Screen (fullscreen PWA)

1. Open the site in **Safari** (not Chrome/in-app browsers)
2. Tap the **Share** button
3. Tap **Add to Home Screen**
4. Open **Lighto** from your home screen for a fullscreen, standalone display

A service worker caches the app shell for basic offline loading (mic still needs a network permission prompt on first use in a session as usual).

### Local LAN + tunnel

```bash
npx --yes serve -l 3000
# other terminal:
npx --yes ngrok http 3000
```

Open the `https://…` tunnel URL in iPhone Safari.

## Safari notes

- Mic start requires a **user gesture** (Tap to listen).
- Allow **Microphone** for the site.
- AudioContext may suspend when backgrounded; Lighto resumes on return.

## Controls

| Control | Action |
|--------|--------|
| **Tap to listen** | Start mic + visualizer |
| **Stop** | Stop mic |
| **Party** | Hide chrome for max display (or auto-hides after ~3.5s while listening). Tap the display to bring controls back |
| **Sens** | Sensitivity |
| **BPM** | Live tempo estimate from kick/beat gaps (`--.-` until confident) |
| **CH1 / CH2 meters** | FLX4-style amber LED stacks with red CLIP tip + peak hold |

## Tech

Vanilla HTML / CSS / JS. PWA manifest + service worker. No backend.

```
index.html / styles.css / app.js
manifest.webmanifest / sw.js / icons/
```

## Privacy

Audio stays on-device. Nothing is uploaded.
