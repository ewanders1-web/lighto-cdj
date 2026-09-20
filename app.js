(() => {
  "use strict";

  const CYAN = [0, 229, 255];
  const ORANGE = [255, 106, 0];
  // Deep TR-808 kick heat (still in CDJ orange family)
  const BOOM = [255, 72, 0];
  const BOOM_CORE = [255, 140, 40];
  const BAR_COUNT = 48;
  const MAX_PULSES = 6;
  const PULSE_LIFE_MS = 720;
  const MAX_BOOMS = 4;
  const BOOM_LIFE_MS = 1250;

  const els = {
    canvas: document.getElementById("viz"),
    overlay: document.getElementById("overlay"),
    denied: document.getElementById("denied"),
    startBtn: document.getElementById("startBtn"),
    toggleBtn: document.getElementById("toggleBtn"),
    sensitivity: document.getElementById("sensitivity"),
    status: document.getElementById("status"),
    display: document.getElementById("display"),
    vuFill: document.getElementById("vuFill"),
    vuPeak: document.getElementById("vuPeak"),
  };

  const ctx2d = els.canvas.getContext("2d", { alpha: false });

  let audioCtx = null;
  let analyser = null;
  let mediaStream = null;
  let sourceNode = null;
  let running = false;
  let rafId = 0;
  let freqData = null;
  let timeData = null;
  let smoothed = new Float32Array(BAR_COUNT);
  let peakHold = 0;
  let peakDecay = 0;
  let dpr = 1;

  // Beat detection state
  let bassHistory = [];
  let bassAvg = 0.08;
  let subHistory = [];
  let subAvg = 0.06;
  let lastBeat = 0;
  let last808 = 0;
  let beatInterval = 500; // ms, adapts toward detected tempo
  let pulseFlash = 0; // 0..1 screen bloom residual
  let boomFlash = 0; // heavy 808 residual
  const pulses = []; // { t0, strength, hueMix }
  const booms = []; // { t0, strength } — fat 808 kicks

  function setStatus(text, mode) {
    els.status.textContent = text;
    els.status.classList.remove("live", "error");
    if (mode) els.status.classList.add(mode);
  }

  function resize() {
    const rect = els.canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    els.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    els.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  }

  function lerpColor(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ];
  }

  function spawnPulse(strength, now) {
    const hueMix = strength > 0.75 ? 0.85 : strength > 0.55 ? 0.45 : 0.15;
    pulses.push({ t0: now, strength: Math.min(1, strength), hueMix });
    while (pulses.length > MAX_PULSES) pulses.shift();
    pulseFlash = Math.min(1, pulseFlash + 0.55 + strength * 0.45);
    els.display.classList.add("flash");
    window.setTimeout(() => els.display.classList.remove("flash"), 110);
  }

  function spawn808(strength, now) {
    const s = Math.min(1, strength);
    booms.push({ t0: now, strength: s });
    while (booms.length > MAX_BOOMS) booms.shift();
    boomFlash = Math.min(1, boomFlash + 0.7 + s * 0.5);
    // Also kick a lighter ring so waves stay in sync
    spawnPulse(0.45 + s * 0.4, now);
    els.display.classList.add("flash-808");
    window.setTimeout(() => els.display.classList.remove("flash-808"), 220);
  }

  function detect808(sub, bass, energy, sens, now) {
    subHistory.push(sub);
    if (subHistory.length > 40) subHistory.shift();

    let sum = 0;
    for (let i = 0; i < subHistory.length; i++) sum += subHistory[i];
    const mean = sum / Math.max(1, subHistory.length);
    subAvg = subAvg * 0.9 + mean * 0.1;

    // 808: deep sub onset, heavier than general bass tick
    const thr = Math.max(0.1, subAvg * (1.55 - sens * 0.1) + 0.035);
    const minGap = Math.max(220, Math.min(520, beatInterval * 0.7));
    const isThump =
      sub > thr &&
      sub > 0.16 &&
      sub >= bass * 0.72 && // sub carries the hit
      sub > energy * 0.85;

    if (isThump && now - last808 > minGap) {
      const gap = now - last808;
      if (last808 > 0 && gap > 280 && gap < 1600) {
        beatInterval = beatInterval * 0.65 + gap * 0.35;
      }
      last808 = now;
      lastBeat = now; // suppress double general-beat flash
      const strength = Math.min(
        1.15,
        ((sub - thr) / Math.max(0.06, thr)) * 0.5 + sub * 1.15
      ) * Math.min(1.25, sens * 0.9);
      spawn808(strength, now);
      return true;
    }
    return false;
  }

  function detectBeat(bass, energy, sens, now) {
    bassHistory.push(bass);
    if (bassHistory.length > 48) bassHistory.shift();

    let sum = 0;
    for (let i = 0; i < bassHistory.length; i++) sum += bassHistory[i];
    const mean = sum / bassHistory.length;
    bassAvg = bassAvg * 0.92 + mean * 0.08;

    // Adaptive threshold: onset above recent average
    const threshold = Math.max(0.12, bassAvg * (1.45 - sens * 0.12) + 0.04);
    const minGap = Math.max(160, Math.min(420, beatInterval * 0.55));
    const onset = bass > threshold && bass > energy * 0.95 && bass > 0.14;

    if (onset && now - lastBeat > minGap) {
      const gap = now - lastBeat;
      if (lastBeat > 0 && gap > 250 && gap < 1400) {
        beatInterval = beatInterval * 0.7 + gap * 0.3;
      }
      lastBeat = now;
      const strength = Math.min(1, (bass - threshold) / Math.max(0.08, threshold) * 0.55 + bass);
      spawnPulse(strength * Math.min(1.3, sens * 0.85), now);
      return true;
    }

    // Soft energy peaks for quieter tracks (secondary pulses)
    if (
      energy > bassAvg * 1.8 &&
      energy > 0.28 * sens &&
      now - lastBeat > Math.max(280, beatInterval * 0.85)
    ) {
      lastBeat = now;
      spawnPulse(Math.min(0.7, energy * 1.1), now);
      return true;
    }

    return false;
  }

  function draw808Booms(w, h, now) {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxR = Math.hypot(w, h) * 0.7;

    // Lingering sub bloom — slow fat decay like an 808 tail
    if (boomFlash > 0.008) {
      const rBloom = maxR * (0.42 + boomFlash * 0.35);
      const bloom = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, rBloom);
      bloom.addColorStop(0, `rgba(${BOOM_CORE[0]},${BOOM_CORE[1]},${BOOM_CORE[2]},${0.55 * boomFlash})`);
      bloom.addColorStop(0.22, `rgba(${BOOM[0]},${BOOM[1]},${BOOM[2]},${0.38 * boomFlash})`);
      bloom.addColorStop(0.55, `rgba(255,106,0,${0.14 * boomFlash})`);
      bloom.addColorStop(0.78, `rgba(0,229,255,${0.06 * boomFlash})`);
      bloom.addColorStop(1, "rgba(0,0,0,0)");
      ctx2d.fillStyle = bloom;
      ctx2d.fillRect(0, 0, w, h);
      boomFlash *= 0.935; // slower than ring pulse flash
    }

    for (let i = booms.length - 1; i >= 0; i--) {
      const k = booms[i];
      const age = (now - k.t0) / BOOM_LIFE_MS;
      if (age >= 1) {
        booms.splice(i, 1);
        continue;
      }

      // Fast attack, long ease-out (thump then rumble)
      const attack = Math.min(1, age / 0.08);
      const body = age < 0.12 ? attack : Math.pow(1 - (age - 0.12) / 0.88, 1.35);
      const expand = 1 - Math.pow(1 - Math.min(1, age * 1.15), 1.6);
      const alpha = body * (0.65 + k.strength * 0.5);
      const radius = (0.12 + expand * 0.88) * maxR * (0.85 + k.strength * 0.4);

      // Fat filled disc (the boom)
      const disc = ctx2d.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius);
      disc.addColorStop(0, `rgba(255,200,120,${0.45 * alpha})`);
      disc.addColorStop(0.18, `rgba(${BOOM_CORE[0]},${BOOM_CORE[1]},${BOOM_CORE[2]},${0.5 * alpha})`);
      disc.addColorStop(0.45, `rgba(${BOOM[0]},${BOOM[1]},${BOOM[2]},${0.32 * alpha})`);
      disc.addColorStop(0.72, `rgba(255,106,0,${0.12 * alpha})`);
      disc.addColorStop(1, "rgba(0,0,0,0)");
      ctx2d.fillStyle = disc;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx2d.fill();

      // Thick shockwave ring
      const ringR = radius * (0.55 + expand * 0.4);
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx2d.strokeStyle = `rgba(${BOOM[0]},${BOOM[1]},${BOOM[2]},${alpha * 0.85})`;
      ctx2d.lineWidth = Math.max(4 * dpr, (22 - age * 14) * dpr * (0.9 + k.strength));
      ctx2d.stroke();

      // Outer cyan rim (CDJ accent on the thump)
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, ringR * 1.08, 0, Math.PI * 2);
      ctx2d.strokeStyle = `rgba(0,229,255,${alpha * 0.35})`;
      ctx2d.lineWidth = Math.max(2 * dpr, 5 * dpr * (1 - age));
      ctx2d.stroke();

      // Horizontal sub pressure band — wide and soft
      const bandH = (40 + k.strength * 70) * dpr * body;
      const bandGrad = ctx2d.createLinearGradient(0, cy - bandH, 0, cy + bandH);
      bandGrad.addColorStop(0, "rgba(0,0,0,0)");
      bandGrad.addColorStop(0.4, `rgba(${BOOM[0]},${BOOM[1]},${BOOM[2]},${0.28 * alpha})`);
      bandGrad.addColorStop(0.5, `rgba(255,180,80,${0.4 * alpha})`);
      bandGrad.addColorStop(0.6, `rgba(${BOOM[0]},${BOOM[1]},${BOOM[2]},${0.28 * alpha})`);
      bandGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx2d.fillStyle = bandGrad;
      const spread = w * 0.55 * (0.5 + expand * 0.55) * (0.75 + k.strength * 0.35);
      ctx2d.fillRect(cx - spread, cy - bandH, spread * 2, bandH * 2);
    }
  }

  function drawPulses(w, h, now) {
    const cx = w * 0.5;
    const cy = h * 0.48;
    const maxR = Math.hypot(w, h) * 0.55;

    // Residual center bloom
    if (pulseFlash > 0.01) {
      const bloom = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.55);
      bloom.addColorStop(0, `rgba(0,229,255,${0.18 * pulseFlash})`);
      bloom.addColorStop(0.35, `rgba(255,106,0,${0.1 * pulseFlash})`);
      bloom.addColorStop(1, "rgba(0,0,0,0)");
      ctx2d.fillStyle = bloom;
      ctx2d.fillRect(0, 0, w, h);
      pulseFlash *= 0.88;
    }

    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      const age = (now - p.t0) / PULSE_LIFE_MS;
      if (age >= 1) {
        pulses.splice(i, 1);
        continue;
      }

      // Ease-out expansion
      const ease = 1 - Math.pow(1 - age, 2.2);
      const alpha = (1 - age) * (0.55 + p.strength * 0.45);
      const [r, g, b] = lerpColor(CYAN, ORANGE, p.hueMix);
      const radius = (0.08 + ease * 0.92) * maxR * (0.75 + p.strength * 0.35);
      const lineW = Math.max(2 * dpr, (10 - age * 8) * dpr * (0.7 + p.strength));

      // Outer ring
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx2d.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx2d.lineWidth = lineW;
      ctx2d.stroke();

      // Soft glow ring (wider, dimmer)
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx2d.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.35})`;
      ctx2d.lineWidth = lineW * 3.2;
      ctx2d.stroke();

      // Inner secondary ring (slightly ahead timing feel)
      if (age < 0.7) {
        const r2 = radius * 0.62;
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, r2, 0, Math.PI * 2);
        const [r2c, g2c, b2c] = lerpColor(ORANGE, CYAN, p.hueMix);
        ctx2d.strokeStyle = `rgba(${r2c},${g2c},${b2c},${alpha * 0.55})`;
        ctx2d.lineWidth = Math.max(1.5 * dpr, lineW * 0.55);
        ctx2d.stroke();
      }

      // Horizontal waveform pulse band (CDJ jog-area vibe)
      const bandY = cy;
      const bandH = (18 + p.strength * 28) * dpr * (1 - age * 0.5);
      const bandGrad = ctx2d.createLinearGradient(0, bandY - bandH, 0, bandY + bandH);
      bandGrad.addColorStop(0, "rgba(0,0,0,0)");
      bandGrad.addColorStop(0.45, `rgba(${r},${g},${b},${alpha * 0.22})`);
      bandGrad.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.35})`);
      bandGrad.addColorStop(0.55, `rgba(${r},${g},${b},${alpha * 0.22})`);
      bandGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx2d.fillStyle = bandGrad;
      const spread = ease * w * 0.48 * (0.7 + p.strength * 0.4);
      ctx2d.fillRect(cx - spread, bandY - bandH, spread * 2, bandH * 2);
    }
  }

  function drawWaveformRibbon(w, h, energy) {
    if (!timeData) return;
    analyser.getByteTimeDomainData(timeData);

    const midY = h * 0.48;
    const amp = h * 0.07 * (0.35 + energy * 1.4);
    const padX = w * 0.06;

    ctx2d.beginPath();
    const n = timeData.length;
    const step = Math.max(1, Math.floor(n / 128));
    for (let i = 0, x = 0; i < n; i += step, x++) {
      const t = i / (n - 1);
      const px = padX + t * (w - padX * 2);
      const v = (timeData[i] - 128) / 128;
      const py = midY + v * amp;
      if (x === 0) ctx2d.moveTo(px, py);
      else ctx2d.lineTo(px, py);
    }
    ctx2d.strokeStyle = `rgba(0,229,255,${0.18 + energy * 0.35})`;
    ctx2d.lineWidth = Math.max(1.2 * dpr, 1.5 * dpr);
    ctx2d.stroke();

    // Orange ghost offset
    ctx2d.beginPath();
    for (let i = 0, x = 0; i < n; i += step, x++) {
      const t = i / (n - 1);
      const px = padX + t * (w - padX * 2);
      const v = (timeData[i] - 128) / 128;
      const py = midY + v * amp * 0.7 + 3 * dpr;
      if (x === 0) ctx2d.moveTo(px, py);
      else ctx2d.lineTo(px, py);
    }
    ctx2d.strokeStyle = `rgba(255,106,0,${0.1 + energy * 0.22})`;
    ctx2d.lineWidth = Math.max(1 * dpr, 1.2 * dpr);
    ctx2d.stroke();
  }

  function drawIdle() {
    const w = els.canvas.width;
    const h = els.canvas.height;
    ctx2d.fillStyle = "#050608";
    ctx2d.fillRect(0, 0, w, h);

    const padX = w * 0.04;
    const padY = h * 0.08;
    const gap = Math.max(2, w * 0.005);
    const barW = (w - padX * 2 - gap * (BAR_COUNT - 1)) / BAR_COUNT;
    const baseY = h - padY;

    // Idle center ring hint
    const cx = w * 0.5;
    const cy = h * 0.48;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, Math.min(w, h) * 0.12, 0, Math.PI * 2);
    ctx2d.strokeStyle = "rgba(0,229,255,0.12)";
    ctx2d.lineWidth = 2 * dpr;
    ctx2d.stroke();
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, Math.min(w, h) * 0.2, 0, Math.PI * 2);
    ctx2d.strokeStyle = "rgba(255,106,0,0.08)";
    ctx2d.lineWidth = 1.5 * dpr;
    ctx2d.stroke();

    for (let i = 0; i < BAR_COUNT; i++) {
      const x = padX + i * (barW + gap);
      const idleH = h * 0.03;
      const t = i / (BAR_COUNT - 1);
      const [r, g, b] = lerpColor(CYAN, ORANGE, t);
      ctx2d.fillStyle = `rgba(${r},${g},${b},0.25)`;
      ctx2d.fillRect(x, baseY - idleH, barW, idleH);
    }

    ctx2d.strokeStyle = "rgba(0,229,255,0.08)";
    ctx2d.lineWidth = 1 * dpr;
    ctx2d.beginPath();
    ctx2d.moveTo(padX, h * 0.5);
    ctx2d.lineTo(w - padX, h * 0.5);
    ctx2d.stroke();
  }

  function drawFrame() {
    if (!running || !analyser) return;

    analyser.getByteFrequencyData(freqData);

    const w = els.canvas.width;
    const h = els.canvas.height;
    const sens = parseFloat(els.sensitivity.value) || 1.1;
    const now = performance.now();

    // Soft fade trail
    ctx2d.fillStyle = "rgba(5,6,8,0.38)";
    ctx2d.fillRect(0, 0, w, h);

    const padX = w * 0.04;
    const padY = h * 0.08;
    const gap = Math.max(2, w * 0.005);
    const barW = (w - padX * 2 - gap * (BAR_COUNT - 1)) / BAR_COUNT;
    const baseY = h - padY;
    const usable = h - padY * 2;

    const binCount = freqData.length;
    let energy = 0;
    let bass = 0;
    let sub = 0;

    // Sub / 808 territory: lowest bins (~20–80 Hz at typical sample rates)
    const subBins = Math.max(2, Math.min(6, Math.floor(binCount * 0.03)));
    // Weight lowest bins harder (true 808 sub ~20–80 Hz)
    let subSum = freqData[0] * 1.6;
    if (binCount > 1) subSum += freqData[1] * 1.3;
    for (let j = 2; j < subBins; j++) subSum += freqData[j];
    const subWeight = 1.6 + (binCount > 1 ? 1.3 : 0) + Math.max(0, subBins - 2);
    sub = Math.min(1, (subSum / subWeight / 255) * sens * 1.15);

    // Bass from lowest ~8% of bins (kick-focused, broader than sub)
    const bassBins = Math.max(4, Math.floor(binCount * 0.08));
    let bassSum = 0;
    for (let j = 0; j < bassBins; j++) bassSum += freqData[j];
    bass = Math.min(1, ((bassSum / bassBins) / 255) * sens);

    for (let i = 0; i < BAR_COUNT; i++) {
      const t0 = Math.pow(i / BAR_COUNT, 1.55);
      const t1 = Math.pow((i + 1) / BAR_COUNT, 1.55);
      const i0 = Math.floor(t0 * (binCount - 1));
      const i1 = Math.max(i0 + 1, Math.floor(t1 * (binCount - 1)));

      let sum = 0;
      for (let j = i0; j <= i1; j++) sum += freqData[j];
      let v = (sum / (i1 - i0 + 1)) / 255;
      const boost = 0.75 + 0.55 * (i / (BAR_COUNT - 1));
      v = Math.min(1, v * sens * boost);

      smoothed[i] = smoothed[i] * 0.55 + v * 0.45;
      energy += smoothed[i];
    }

    energy /= BAR_COUNT;

    // 808 sub-thump first; general beat fills non-808 hits
    if (!detect808(sub, bass, energy, sens, now)) {
      detectBeat(bass, energy, sens, now);
    }

    // Layer 0: heavy 808 boom (behind everything for weight)
    draw808Booms(w, h, now);

    // Layer 1: beat wave pulses (behind bars so spectrum stays readable)
    drawPulses(w, h, now);

    // Layer 2: live waveform ribbon through the pulse center
    drawWaveformRibbon(w, h, energy);

    // Layer 3: spectrum bars
    for (let i = 0; i < BAR_COUNT; i++) {
      const level = smoothed[i];
      const barH = Math.max(usable * 0.02, level * usable);
      const x = padX + i * (barW + gap);
      const y = baseY - barH;
      const t = i / (BAR_COUNT - 1);
      const [r, g, b] = lerpColor(CYAN, ORANGE, t);

      const grad = ctx2d.createLinearGradient(x, y, x, baseY);
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
      grad.addColorStop(0.45, `rgba(${r},${g},${b},0.85)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0.2)`);
      ctx2d.fillStyle = grad;
      ctx2d.fillRect(x, y, barW, barH);

      ctx2d.fillStyle = `rgba(255,255,255,${0.35 + level * 0.45})`;
      ctx2d.fillRect(x, y, barW, Math.max(1.5 * dpr, barH * 0.04));
    }

    // Subtle mirrored reflection of bar region only (avoid full-canvas copy glitches)
    ctx2d.save();
    ctx2d.globalAlpha = 0.16;
    for (let i = 0; i < BAR_COUNT; i++) {
      const level = smoothed[i];
      const barH = Math.max(usable * 0.015, level * usable * 0.22);
      const x = padX + i * (barW + gap);
      const t = i / (BAR_COUNT - 1);
      const [r, g, b] = lerpColor(CYAN, ORANGE, t);
      ctx2d.fillStyle = `rgba(${r},${g},${b},0.7)`;
      ctx2d.fillRect(x, baseY + 4 * dpr, barW, barH);
    }
    ctx2d.restore();

    // VU / peak
    const peak = Math.min(1, Math.max(energy * 1.25, bass * 1.05, sub * 1.1));
    peakHold = Math.max(peak, peakHold - 0.012);
    peakDecay = peakHold;
    els.vuFill.style.width = `${(peak * 100).toFixed(1)}%`;
    els.vuPeak.style.left = `calc(${(peakDecay * 100).toFixed(1)}% - 1px)`;

    rafId = requestAnimationFrame(drawFrame);
  }

  async function buildAudioConstraints() {
    return {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
      video: false,
    };
  }

  async function getMicStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia not supported");
    }

    const preferred = await buildAudioConstraints();
    try {
      return await navigator.mediaDevices.getUserMedia(preferred);
    } catch (err) {
      if (err && (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError")) {
        return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: { ideal: false },
            noiseSuppression: { ideal: false },
            autoGainControl: { ideal: false },
          },
          video: false,
        });
      } catch (_) {
        return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
    }
  }

  async function start() {
    try {
      setStatus("Requesting…");
      mediaStream = await getMicStream();

      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.55;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -20;

      sourceNode = audioCtx.createMediaStreamSource(mediaStream);
      sourceNode.connect(analyser);

      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Uint8Array(analyser.fftSize);
      smoothed.fill(0);
      bassHistory = [];
      bassAvg = 0.08;
      subHistory = [];
      subAvg = 0.06;
      lastBeat = 0;
      last808 = 0;
      pulses.length = 0;
      booms.length = 0;
      pulseFlash = 0;
      boomFlash = 0;

      running = true;
      els.overlay.hidden = true;
      els.denied.hidden = true;
      els.toggleBtn.disabled = false;
      els.toggleBtn.textContent = "Stop";
      els.toggleBtn.classList.add("running");
      setStatus("Listening", "live");

      resize();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(drawFrame);
    } catch (err) {
      console.error(err);
      const denied =
        err &&
        (err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError" ||
          /permission|denied|not allowed/i.test(String(err.message || err)));

      if (denied) {
        els.overlay.hidden = true;
        els.denied.hidden = false;
        setStatus("Denied", "error");
      } else {
        setStatus("Error", "error");
        els.overlay.hidden = false;
      }
      stop(false);
    }
  }

  function stop(showOverlay = true) {
    running = false;
    cancelAnimationFrame(rafId);
    rafId = 0;

    if (sourceNode) {
      try { sourceNode.disconnect(); } catch (_) {}
      sourceNode = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    analyser = null;
    freqData = null;
    timeData = null;
    pulses.length = 0;
    booms.length = 0;
    pulseFlash = 0;
    boomFlash = 0;
    els.display.classList.remove("flash", "flash-808");

    els.toggleBtn.textContent = "Stop";
    els.toggleBtn.classList.remove("running");
    els.toggleBtn.disabled = true;
    els.vuFill.style.width = "0%";
    els.vuPeak.style.left = "0%";
    peakHold = 0;

    if (showOverlay) {
      els.denied.hidden = true;
      els.overlay.hidden = false;
      setStatus("Ready");
    }

    resize();
    drawIdle();
  }

  async function resumeIfNeeded() {
    if (!audioCtx || !running) return;
    if (audioCtx.state === "suspended") {
      try {
        await audioCtx.resume();
        setStatus("Listening", "live");
      } catch (_) {}
    }
  }

  els.startBtn.addEventListener("click", () => {
    if (!running) start();
  });

  els.toggleBtn.addEventListener("click", () => {
    if (running) stop(true);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resumeIfNeeded();
  });

  window.addEventListener("pageshow", resumeIfNeeded);
  window.addEventListener("resize", () => {
    resize();
    if (!running) drawIdle();
  });
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      resize();
      if (!running) drawIdle();
    }, 120);
  });

  resize();
  drawIdle();
})();
