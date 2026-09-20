(() => {
  "use strict";

  const CYAN = [0, 229, 255];
  const ORANGE = [255, 106, 0];
  const BAR_COUNT = 48;

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
  let smoothed = new Float32Array(BAR_COUNT);
  let peakHold = 0;
  let peakDecay = 0;
  let lastBeat = 0;
  let energySmooth = 0;
  let dpr = 1;

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

    for (let i = 0; i < BAR_COUNT; i++) {
      const x = padX + i * (barW + gap);
      const idleH = h * 0.03;
      const t = i / (BAR_COUNT - 1);
      const [r, g, b] = lerpColor(CYAN, ORANGE, t);
      ctx2d.fillStyle = `rgba(${r},${g},${b},0.25)`;
      ctx2d.fillRect(x, baseY - idleH, barW, idleH);
    }

    // Center grid line
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

    // Soft fade trail
    ctx2d.fillStyle = "rgba(5,6,8,0.35)";
    ctx2d.fillRect(0, 0, w, h);

    const padX = w * 0.04;
    const padY = h * 0.08;
    const gap = Math.max(2, w * 0.005);
    const barW = (w - padX * 2 - gap * (BAR_COUNT - 1)) / BAR_COUNT;
    const baseY = h - padY;
    const usable = h - padY * 2;

    // Map analyser bins (more weight on lows/mids like DJ displays)
    const binCount = freqData.length;
    let energy = 0;
    let bass = 0;

    for (let i = 0; i < BAR_COUNT; i++) {
      const t0 = Math.pow(i / BAR_COUNT, 1.55);
      const t1 = Math.pow((i + 1) / BAR_COUNT, 1.55);
      const i0 = Math.floor(t0 * (binCount - 1));
      const i1 = Math.max(i0 + 1, Math.floor(t1 * (binCount - 1)));

      let sum = 0;
      for (let j = i0; j <= i1; j++) sum += freqData[j];
      let v = (sum / (i1 - i0 + 1)) / 255;

      // Mild perceptual boost for mid/high so spectrum looks lively
      const boost = 0.75 + 0.55 * (i / (BAR_COUNT - 1));
      v = Math.min(1, v * sens * boost);

      smoothed[i] = smoothed[i] * 0.55 + v * 0.45;
      energy += smoothed[i];
      if (i < 6) bass += smoothed[i];
    }

    energy /= BAR_COUNT;
    bass /= 6;
    energySmooth = energySmooth * 0.7 + energy * 0.3;

    // Beat / energy flash
    const now = performance.now();
    if (bass > 0.55 && bass > energySmooth * 1.35 && now - lastBeat > 180) {
      lastBeat = now;
      els.display.classList.add("flash");
      setTimeout(() => els.display.classList.remove("flash"), 90);
    }

    for (let i = 0; i < BAR_COUNT; i++) {
      const level = smoothed[i];
      const barH = Math.max(usable * 0.02, level * usable);
      const x = padX + i * (barW + gap);
      const y = baseY - barH;
      const t = i / (BAR_COUNT - 1);
      const [r, g, b] = lerpColor(CYAN, ORANGE, t);

      // Glow body
      const grad = ctx2d.createLinearGradient(x, y, x, baseY);
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
      grad.addColorStop(0.45, `rgba(${r},${g},${b},0.85)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0.2)`);
      ctx2d.fillStyle = grad;
      ctx2d.fillRect(x, y, barW, barH);

      // Cap
      ctx2d.fillStyle = `rgba(255,255,255,${0.35 + level * 0.45})`;
      ctx2d.fillRect(x, y, barW, Math.max(1.5 * dpr, barH * 0.04));
    }

    // Subtle mirrored reflection
    ctx2d.save();
    ctx2d.globalAlpha = 0.18;
    ctx2d.scale(1, -1);
    ctx2d.drawImage(
      els.canvas,
      padX,
      padY,
      w - padX * 2,
      usable * 0.35,
      padX,
      -baseY - usable * 0.12,
      w - padX * 2,
      usable * 0.12
    );
    ctx2d.restore();

    // VU / peak
    const peak = Math.min(1, energy * 1.4);
    peakHold = Math.max(peak, peakHold - 0.012);
    peakDecay = peakHold;
    els.vuFill.style.width = `${(peak * 100).toFixed(1)}%`;
    els.vuPeak.style.left = `calc(${(peakDecay * 100).toFixed(1)}% - 1px)`;

    rafId = requestAnimationFrame(drawFrame);
  }

  async function buildAudioConstraints() {
    // Prefer music pickup: disable voice processing when supported
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
      // Fallback if some constraints are rejected
      if (err && (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError")) {
        return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
      // Some Safari versions dislike boolean false on AGC etc.
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
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.72;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -20;

      sourceNode = audioCtx.createMediaStreamSource(mediaStream);
      sourceNode.connect(analyser);

      freqData = new Uint8Array(analyser.frequencyBinCount);
      smoothed.fill(0);

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

  // Boot
  resize();
  drawIdle();
})();
