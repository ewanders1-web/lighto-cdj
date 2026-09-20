# Lighto

Pioneer CDJ–style spectrum light visualizer for iPhone Safari. Uses the device microphone, analyzes live audio, and draws cyan/orange frequency bars plus a beat-synced wave pulse and heavy 808 kick boom — like a DJ deck display.

## One-command local preview

```bash
npx --yes serve -l 3000
```

Then open `http://localhost:3000` on the same machine.

## Open on iPhone Safari (mic requires HTTPS)

Safari only grants microphone access over **HTTPS** (or `localhost`). Options:

### A) GitHub Pages (recommended)

**Live:** https://ewanders1-web.github.io/lighto-cdj/

Open that HTTPS URL on your iPhone (repo is public so Pages works on the free plan).

1. Open the Pages URL in **Safari**
2. Tap **Tap to listen**
3. Allow microphone access when prompted

### B) Local LAN + tunnel

On your computer:

```bash
npx --yes serve -l 3000
```

In another terminal, expose it with a tunnel (HTTPS):

```bash
npx --yes ngrok http 3000
# or: cloudflared tunnel --url http://localhost:3000
```

Open the `https://…` tunnel URL in iPhone Safari, then tap **Tap to listen**.

### C) Same Mac + localhost

If you open the page on the Mac that is serving it at `http://localhost:…`, Safari treats localhost as a secure context. That does **not** help a remote iPhone on the LAN over plain `http://`.

## Safari notes

- Mic start requires a **user gesture** (the Tap to listen button).
- You must **allow microphone** permission for the site.
- If denied: Settings → Safari → (or site settings) → enable Microphone, then reload.
- AudioContext may suspend when the tab is backgrounded; Lighto resumes it when you return.

## Controls

| Control | Action |
|--------|--------|
| **Tap to listen** | Start mic + visualizer |
| **Stop** | Stop mic and freeze idle display |
| **Sens** | Sensitivity of spectrum / energy response |

## Tech

Vanilla HTML / CSS / JS. No build step, no backend.

```
index.html   — shell + controls
styles.css   — black chassis, safe-area, mobile layout
app.js       — getUserMedia → AnalyserNode → canvas spectrum
```

## Privacy

Audio stays on-device. Nothing is uploaded.
