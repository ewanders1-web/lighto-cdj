(() => {
  "use strict";

  const THEME_KEY = "lighto-theme";
  const BAR_COUNT = 48;
  const MAX_PULSES = 6;
  const PULSE_LIFE_MS = 720;
  const MAX_BOOMS = 4;
  const BOOM_LIFE_MS = 1250;

  const els = {
    app: document.getElementById("app"),
    canvas: document.getElementById("viz"),
    overlay: document.getElementById("overlay"),
    denied: document.getElementById("denied"),
    startBtn: document.getElementById("startBtn"),
    toggleBtn: document.getElementById("toggleBtn"),
    partyBtn: document.getElementById("partyBtn"),
    partyHint: document.getElementById("partyHint"),
    colorsBtn: document.getElementById("colorsBtn"),
    themeSheet: document.getElementById("themeSheet"),
    themeChips: document.getElementById("themeChips"),
    sensitivity: document.getElementById("sensitivity"),
    status: document.getElementById("status"),
    display: document.getElementById("display"),
    flxMeters: document.getElementById("flxMeters"),
    ch1Well: document.getElementById("ch1Well"),
    ch2Well: document.getElementById("ch2Well"),
    bpmValue: document.getElementById("bpmValue"),
    bpmCornerValue: document.getElementById("bpmCornerValue"),
  };

  const LED_COUNT = 12;
  const AMBER_HOT_FROM = 9;

  // Visual themes: CSS accents + spectral coeffs canvas reads each frame
  const THEMES = {
    serato: {
      id: "serato",
      name: "Serato",
      swatches: ["#ff3b1a", "#1aff9c", "#ff80ff"],
      css: { cyan: "#00e5ff", cyanDim: "#0088a0", orange: "#ff6a00", orangeDim: "#a04000" },
      cyan: [0, 229, 255],
      orange: [255, 106, 0],
      boom: [255, 72, 0],
      boomCore: [255, 140, 40],
      spectral: {
        bass: [255, 60, 10],
        mid: [20, 255, 200],
        high: [220, 120, 255],
        highAdd: [80, 0, 0],
        midAdd: [0, 40, 0],
      },
      bassBody: { r0: 40, rS: 215, g0: 20, gBass: 90, gMid: 40, b: 20 },
      highTip: { r0: 200, rS: 55, g0: 180, gS: 40, b0: 220, bS: 35 },
      highEdge: [255, 80, 255],
      midRibbon: { r0: 30, rS: 100, g0: 160, gS: 95, b: 220 },
      overview: {
        br0: 30, brBass: 200, brAmp: 40,
        bg0: 40, bgMid: 180, bgAmp: 50,
        bb0: 90, bbHigh: 165, bbAmp: 50,
      },
    },
    classic: {
      id: "classic",
      name: "Classic CDJ",
      swatches: ["#00e5ff", "#ff6a00", "#0088a0"],
      css: { cyan: "#00e5ff", cyanDim: "#0088a0", orange: "#ff6a00", orangeDim: "#a04000" },
      cyan: [0, 229, 255],
      orange: [255, 106, 0],
      boom: [255, 72, 0],
      boomCore: [255, 140, 40],
      spectral: {
        bass: [255, 100, 0],
        mid: [0, 200, 220],
        high: [180, 240, 255],
        highAdd: [40, 20, 0],
        midAdd: [0, 20, 30],
      },
      bassBody: { r0: 40, rS: 200, g0: 20, gBass: 70, gMid: 30, b: 5 },
      highTip: { r0: 180, rS: 40, g0: 220, gS: 35, b0: 240, bS: 15 },
      highEdge: [0, 229, 255],
      midRibbon: { r0: 0, rS: 40, g0: 180, gS: 50, b: 230 },
      overview: {
        br0: 40, brBass: 200, brAmp: 40,
        bg0: 50, bgMid: 100, bgAmp: 40,
        bb0: 80, bbHigh: 150, bbAmp: 50,
      },
    },
    neon: {
      id: "neon",
      name: "Neon",
      swatches: ["#ff00aa", "#00fff0", "#b8ff00"],
      css: { cyan: "#00fff0", cyanDim: "#00a090", orange: "#ff00aa", orangeDim: "#a00060" },
      cyan: [0, 255, 240],
      orange: [255, 0, 170],
      boom: [255, 0, 120],
      boomCore: [255, 80, 200],
      spectral: {
        bass: [255, 0, 160],
        mid: [0, 255, 200],
        high: [180, 255, 0],
        highAdd: [60, 40, 0],
        midAdd: [0, 40, 20],
      },
      bassBody: { r0: 50, rS: 205, g0: 0, gBass: 40, gMid: 80, b: 80 },
      highTip: { r0: 160, rS: 60, g0: 220, gS: 35, b0: 40, bS: 20 },
      highEdge: [200, 255, 0],
      midRibbon: { r0: 200, rS: 55, g0: 40, gS: 80, b: 220 },
      overview: {
        br0: 40, brBass: 180, brAmp: 40,
        bg0: 20, bgMid: 200, bgAmp: 40,
        bb0: 60, bbHigh: 120, bbAmp: 50,
      },
    },
    ice: {
      id: "ice",
      name: "Ice",
      swatches: ["#7ec8ff", "#ffffff", "#00d4ff"],
      css: { cyan: "#00d4ff", cyanDim: "#007a99", orange: "#7ec8ff", orangeDim: "#3a6a90" },
      cyan: [0, 212, 255],
      orange: [126, 200, 255],
      boom: [40, 140, 255],
      boomCore: [160, 220, 255],
      spectral: {
        bass: [40, 100, 255],
        mid: [100, 220, 255],
        high: [240, 250, 255],
        highAdd: [20, 20, 30],
        midAdd: [0, 30, 40],
      },
      bassBody: { r0: 10, rS: 50, g0: 40, gBass: 80, gMid: 60, b: 180 },
      highTip: { r0: 220, rS: 35, g0: 235, gS: 20, b0: 255, bS: 0 },
      highEdge: [200, 240, 255],
      midRibbon: { r0: 40, rS: 60, g0: 180, gS: 50, b: 255 },
      overview: {
        br0: 20, brBass: 60, brAmp: 30,
        bg0: 60, bgMid: 140, bgAmp: 40,
        bb0: 120, bbHigh: 135, bbAmp: 40,
      },
    },
    fire: {
      id: "fire",
      name: "Fire",
      swatches: ["#8b0000", "#ff8c00", "#ffd700"],
      css: { cyan: "#ffb020", cyanDim: "#a06010", orange: "#ff3b00", orangeDim: "#8b1500" },
      cyan: [255, 176, 32],
      orange: [255, 59, 0],
      boom: [200, 30, 0],
      boomCore: [255, 120, 20],
      spectral: {
        bass: [180, 20, 0],
        mid: [255, 120, 0],
        high: [255, 220, 60],
        highAdd: [40, 20, 0],
        midAdd: [30, 20, 0],
      },
      bassBody: { r0: 60, rS: 180, g0: 10, gBass: 40, gMid: 50, b: 5 },
      highTip: { r0: 255, rS: 0, g0: 200, gS: 55, b0: 40, bS: 40 },
      highEdge: [255, 220, 80],
      midRibbon: { r0: 200, rS: 55, g0: 80, gS: 100, b: 20 },
      overview: {
        br0: 50, brBass: 200, brAmp: 40,
        bg0: 30, bgMid: 120, bgAmp: 50,
        bb0: 10, bbHigh: 40, bbAmp: 20,
      },
    },
    mono: {
      id: "mono",
      name: "Mono",
      swatches: ["#ffffff", "#888888", "#333333"],
      css: { cyan: "#d0d4d8", cyanDim: "#6a7078", orange: "#a8adb4", orangeDim: "#50555c" },
      cyan: [208, 212, 216],
      orange: [168, 173, 180],
      boom: [180, 180, 180],
      boomCore: [240, 240, 240],
      spectral: {
        bass: [120, 120, 120],
        mid: [200, 200, 200],
        high: [255, 255, 255],
        highAdd: [20, 20, 20],
        midAdd: [10, 10, 10],
      },
      bassBody: { r0: 40, rS: 100, g0: 40, gBass: 100, gMid: 40, b: 40 },
      highTip: { r0: 220, rS: 35, g0: 220, gS: 35, b0: 220, bS: 35 },
      highEdge: [255, 255, 255],
      midRibbon: { r0: 160, rS: 80, g0: 160, gS: 80, b: 160 },
      overview: {
        br0: 50, brBass: 120, brAmp: 40,
        bg0: 50, bgMid: 120, bgAmp: 40,
        bb0: 50, bbHigh: 120, bbAmp: 40,
      },
    },
  };

  // Live accents — canvas code reads these each frame (no reload)
  let currentTheme = THEMES.serato;
  let CYAN = currentTheme.cyan;
  let ORANGE = currentTheme.orange;
  let BOOM = currentTheme.boom;
  let BOOM_CORE = currentTheme.boomCore;
  let themeSheetOpen = false;

  function rgbaOf(c, a) {
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  }

  function applyTheme(id, persist) {
    const theme = THEMES[id] || THEMES.serato;
    currentTheme = theme;
    CYAN = theme.cyan;
    ORANGE = theme.orange;
    BOOM = theme.boom;
    BOOM_CORE = theme.boomCore;

    const root = document.documentElement;
    root.style.setProperty("--cyan", theme.css.cyan);
    root.style.setProperty("--cyan-dim", theme.css.cyanDim);
    root.style.setProperty("--orange", theme.css.orange);
    root.style.setProperty("--orange-dim", theme.css.orangeDim);
    root.style.setProperty("--cyan-rgb", `${theme.cyan[0]}, ${theme.cyan[1]}, ${theme.cyan[2]}`);
    root.style.setProperty("--orange-rgb", `${theme.orange[0]}, ${theme.orange[1]}, ${theme.orange[2]}`);

    if (persist !== false) {
      try { localStorage.setItem(THEME_KEY, theme.id); } catch (_) {}
    }
    syncThemeChips();
    if (!running) drawIdle();
  }

  function syncThemeChips() {
    if (!els.themeChips) return;
    const chips = els.themeChips.querySelectorAll(".theme-chip");
    chips.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.theme === currentTheme.id);
      btn.setAttribute("aria-selected", btn.dataset.theme === currentTheme.id ? "true" : "false");
    });
  }

  function buildThemeChips() {
    if (!els.themeChips) return;
    els.themeChips.innerHTML = "";
    Object.values(THEMES).forEach((theme) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "theme-chip";
      btn.dataset.theme = theme.id;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", theme.name);
      const sw = document.createElement("span");
      sw.className = "theme-swatch";
      sw.setAttribute("aria-hidden", "true");
      theme.swatches.forEach((hex) => {
        const i = document.createElement("i");
        i.style.background = hex;
        sw.appendChild(i);
      });
      const label = document.createElement("span");
      label.textContent = theme.name;
      btn.appendChild(sw);
      btn.appendChild(label);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        applyTheme(theme.id, true);
      });
      els.themeChips.appendChild(btn);
    });
    syncThemeChips();
  }

  function setThemeSheet(open) {
    themeSheetOpen = !!open;
    if (els.themeSheet) els.themeSheet.hidden = !themeSheetOpen;
    if (els.colorsBtn) {
      els.colorsBtn.classList.toggle("open", themeSheetOpen);
      els.colorsBtn.setAttribute("aria-expanded", themeSheetOpen ? "true" : "false");
    }
  }

  function restoreTheme() {
    let id = "serato";
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved && THEMES[saved]) id = saved;
    } catch (_) {}
    applyTheme(id, false);
  }

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

  // Beat detection state (phone-mic friendly: onset vs recent avg)
  let bassHistory = [];
  let bassAvg = 0.04;
  let kickHistory = [];
  let kickAvg = 0.04;
  let prevKick = 0;
  let lastBeat = 0;
  let last808 = 0;
  let beatInterval = 500; // ms, adapts toward detected tempo
  let pulseFlash = 0; // 0..1 screen bloom residual
  let boomFlash = 0; // heavy 808 residual
  let ambientGlow = 0; // continuous energy-driven bloom
  let statusTick = 0;
  const pulses = []; // { t0, strength, hueMix }
  const booms = []; // { t0, strength } — fat 808 kicks

  // BPM / jog / party
  const beatGaps = [];
  let bpmDisplay = 0;
  let bpmConfident = false;
  let jogAngle = 0;
  let jogPulse = 0;
  let partyMode = false;
  let partyTimer = 0;
  const PARTY_HIDE_MS = 3500;

  let ch1Leds = [];
  let ch2Leds = [];
  let meterCh1 = 0;
  let meterCh2 = 0;
  let peakCh1 = 0;
  let peakCh2 = 0;
  let peakHoldT1 = 0;
  let peakHoldT2 = 0;
  let stereoMode = false;
  let splitter = null;
  let analyserL = null;
  let analyserR = null;
  let freqL = null;
  let freqR = null;
  let timeL = null;
  let timeR = null;

  // Serato-style spectral waveform history (live mic scroll)
  const WAVE_COLS = 220;
  const waveHist = new Array(WAVE_COLS);
  for (let i = 0; i < WAVE_COLS; i++) {
    waveHist[i] = { amp: 0, bass: 0, mid: 0, high: 0, onset: 0 };
  }
  let waveWrite = 0;
  let waveFilled = 0;
  let waveBarCounter = 7;
  let lastWaveBarMs = 0;
  let prevWaveAmp = 0;

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

  function setBpmText(text) {
    if (els.bpmValue) els.bpmValue.textContent = text;
    if (els.bpmCornerValue) els.bpmCornerValue.textContent = text;
  }

  function noteBeatGap(gapMs) {
    if (!(gapMs > 250 && gapMs < 1500)) return;
    beatGaps.push(gapMs);
    if (beatGaps.length > 10) beatGaps.shift();
    if (beatGaps.length < 3) {
      bpmConfident = false;
      setBpmText("--.-");
      return;
    }
    const sorted = beatGaps.slice().sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length / 2)];
    const instant = 60000 / mid;
    if (instant < 60 || instant > 200) return;
    bpmDisplay = bpmDisplay > 0 ? bpmDisplay * 0.72 + instant * 0.28 : instant;
    const spread = sorted[sorted.length - 1] - sorted[0];
    bpmConfident = beatGaps.length >= 4 && spread < mid * 0.35;
    if (bpmConfident) setBpmText(bpmDisplay.toFixed(1));
    else if (beatGaps.length >= 3) setBpmText("~" + bpmDisplay.toFixed(0));
    else setBpmText("--.-");
  }

  function resetBpm() {
    beatGaps.length = 0;
    bpmDisplay = 0;
    bpmConfident = false;
    setBpmText("--.-");
  }

  function setParty(on) {
    partyMode = !!on;
    els.app.classList.toggle("party", partyMode);
    if (els.partyBtn) {
      els.partyBtn.classList.toggle("party-on", partyMode);
      els.partyBtn.setAttribute("aria-pressed", partyMode ? "true" : "false");
    }
    if (els.partyHint) els.partyHint.hidden = !partyMode;
    if (partyMode) {
      clearTimeout(partyTimer);
      partyTimer = 0;
      setThemeSheet(false);
    } else {
      schedulePartyHide();
    }
    resize();
  }

  function schedulePartyHide() {
    clearTimeout(partyTimer);
    if (!running || partyMode) return;
    partyTimer = window.setTimeout(() => {
      if (running) setParty(true);
    }, PARTY_HIDE_MS);
  }

  function revealChrome() {
    if (partyMode) setParty(false);
    schedulePartyHide();
  }

  function buildLedWell(well) {
    if (!well) return [];
    well.innerHTML = "";
    const leds = [];
    for (let i = 0; i < LED_COUNT; i++) {
      const el = document.createElement("div");
      el.className = "flx-led";
      if (i === LED_COUNT - 1) el.classList.add("clip");
      else if (i >= AMBER_HOT_FROM) el.classList.add("amber-hot");
      else el.classList.add("amber");
      well.appendChild(el);
      leds.push(el);
    }
    return leds;
  }

  function initMeters() {
    ch1Leds = buildLedWell(els.ch1Well);
    ch2Leds = buildLedWell(els.ch2Well);
  }

  function rmsFromTime(buf) {
    if (!buf || !buf.length) return 0;
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  }

  function updateLedStack(leds, level, peak) {
    const lit = Math.round(Math.min(1, Math.max(0, level)) * LED_COUNT);
    const peakIdx = Math.min(LED_COUNT - 1, Math.max(0, Math.round(peak * LED_COUNT) - 1));
    for (let i = 0; i < leds.length; i++) {
      const on = i < lit;
      leds[i].classList.toggle("on", on);
      const isPeak = !on && i === peakIdx && peak > 0.04;
      leds[i].classList.toggle("peak-hold", isPeak);
    }
  }

  function updateChannelMeters(level1, level2, now) {
    meterCh1 = level1 > meterCh1 ? meterCh1 * 0.25 + level1 * 0.75 : meterCh1 * 0.82 + level1 * 0.18;
    meterCh2 = level2 > meterCh2 ? meterCh2 * 0.25 + level2 * 0.75 : meterCh2 * 0.82 + level2 * 0.18;

    if (meterCh1 >= peakCh1) {
      peakCh1 = meterCh1;
      peakHoldT1 = now;
    } else if (now - peakHoldT1 > 450) {
      peakCh1 = Math.max(meterCh1, peakCh1 - 0.012);
    }

    if (meterCh2 >= peakCh2) {
      peakCh2 = meterCh2;
      peakHoldT2 = now;
    } else if (now - peakHoldT2 > 450) {
      peakCh2 = Math.max(meterCh2, peakCh2 - 0.012);
    }

    updateLedStack(ch1Leds, meterCh1, peakCh1);
    updateLedStack(ch2Leds, meterCh2, peakCh2);
  }

  function drawSeratoEdgeMeters(w, h, l, r) {
    const stripW = Math.max(4 * dpr, w * 0.012);
    const pad = h * 0.08;
    const usable = h - pad * 2;
    const segs = 16;
    const gap = 1.5 * dpr;
    const segH = (usable - gap * (segs - 1)) / segs;

    function colorFor(i) {
      const t = i / (segs - 1);
      if (t < 0.55) return [40, 220, 80];
      if (t < 0.82) return [255, 200, 40];
      return [255, 40, 40];
    }

    function drawStrip(x, level) {
      const lit = Math.round(Math.min(1, level) * segs);
      for (let i = 0; i < segs; i++) {
        const y = h - pad - (i + 1) * segH - i * gap;
        const [cr, cg, cb] = colorFor(i);
        if (i < lit) {
          ctx2d.fillStyle = `rgba(${cr},${cg},${cb},0.85)`;
          ctx2d.shadowColor = `rgba(${cr},${cg},${cb},0.55)`;
          ctx2d.shadowBlur = 4 * dpr;
        } else {
          ctx2d.fillStyle = "rgba(20,24,28,0.55)";
          ctx2d.shadowBlur = 0;
        }
        ctx2d.fillRect(x, y, stripW, segH);
      }
      ctx2d.shadowBlur = 0;
    }

    drawStrip(w * 0.015, l);
    drawStrip(w - w * 0.015 - stripW, r);
  }

  function spawnPulse(strength, now) {
    const hueMix = strength > 0.75 ? 0.85 : strength > 0.55 ? 0.45 : 0.15;
    pulses.push({ t0: now, strength: Math.min(1, strength), hueMix });
    while (pulses.length > MAX_PULSES) pulses.shift();
    pulseFlash = Math.min(1, pulseFlash + 0.55 + strength * 0.45);
    jogPulse = Math.min(1, jogPulse + 0.55 + strength * 0.4);
    els.display.classList.add("flash");
    window.setTimeout(() => els.display.classList.remove("flash"), 110);
  }

  function spawn808(strength, now) {
    const s = Math.min(1.2, Math.max(0.55, strength));
    booms.push({ t0: now, strength: Math.min(1, s) });
    while (booms.length > MAX_BOOMS) booms.shift();
    boomFlash = Math.min(1, boomFlash + 0.85 + s * 0.55);
    jogPulse = Math.min(1, jogPulse + 0.9 + s * 0.5);
    // Ring rides with the boom
    spawnPulse(0.55 + s * 0.4, now);
    els.display.classList.add("flash-808");
    window.setTimeout(() => els.display.classList.remove("flash-808"), 260);
  }

  // Phone mics hear kick body ~60–200 Hz, not true 20 Hz sub.
  // 808 boom = strong kick/bass *onset* vs recent average.
  function detect808(kick, bass, energy, sens, now) {
    kickHistory.push(kick);
    if (kickHistory.length > 36) kickHistory.shift();

    let sum = 0;
    for (let i = 0; i < kickHistory.length; i++) sum += kickHistory[i];
    const mean = sum / Math.max(1, kickHistory.length);
    kickAvg = kickAvg * 0.88 + mean * 0.12;

    const rise = kick - prevKick;
    prevKick = kick;

    // Low absolute floor; mainly onset vs local average (sens lowers multiplier)
    const thr = Math.max(0.025, kickAvg * (1.22 - sens * 0.1) + 0.012);
    const minGap = Math.max(180, Math.min(480, beatInterval * 0.62));
    const clearKick =
      kick > thr &&
      kick > 0.035 &&
      (kick > kickAvg * 1.18 || rise > 0.02) &&
      kick >= energy * 0.55;

    if (clearKick && now - last808 > minGap) {
      const gap = now - last808;
      if (last808 > 0 && gap > 260 && gap < 1600) {
        beatInterval = beatInterval * 0.65 + gap * 0.35;
        noteBeatGap(gap);
      }
      last808 = now;
      lastBeat = now;
      const strength =
        Math.min(1.25, ((kick - thr) / Math.max(0.04, thr)) * 0.55 + kick * 1.35 + rise * 2) *
        Math.min(1.35, sens * 0.95);
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
    const mean = sum / Math.max(1, bassHistory.length);
    bassAvg = bassAvg * 0.9 + mean * 0.1;

    const threshold = Math.max(0.03, bassAvg * (1.28 - sens * 0.12) + 0.01);
    const minGap = Math.max(140, Math.min(400, beatInterval * 0.5));
    const onset = bass > threshold && bass > 0.03 && (bass > energy * 0.5 || bass > bassAvg * 1.15);

    if (onset && now - lastBeat > minGap) {
      const gap = now - lastBeat;
      if (lastBeat > 0 && gap > 240 && gap < 1400) {
        beatInterval = beatInterval * 0.7 + gap * 0.3;
        noteBeatGap(gap);
      }
      lastBeat = now;
      const strength = Math.min(1, (bass - threshold) / Math.max(0.04, threshold) * 0.6 + bass);
      // Stronger phone-mic hits still get the heavy boom
      if (bass > bassAvg * 1.35 && bass > 0.06) {
        last808 = now;
        spawn808(strength * Math.min(1.3, sens * 0.9), now);
      } else {
        spawnPulse(strength * Math.min(1.4, sens * 0.95), now);
      }
      return true;
    }

    // Soft energy peaks (distant speakers / quiet mix)
    if (
      energy > Math.max(0.05, bassAvg * 1.35) &&
      energy > 0.06 &&
      now - lastBeat > Math.max(240, beatInterval * 0.8)
    ) {
      const gap = now - lastBeat;
      if (lastBeat > 0) noteBeatGap(gap);
      lastBeat = now;
      spawnPulse(Math.min(0.85, energy * 1.4 * sens * 0.7), now);
      return true;
    }

    return false;
  }

  function drawAmbientEnergy(w, h, energy, kick) {
    const target = Math.min(1, energy * 1.1 + kick * 0.85);
    ambientGlow = ambientGlow * 0.82 + target * 0.18;
    if (ambientGlow < 0.02) return;

    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = Math.min(w, h) * (0.22 + ambientGlow * 0.28);
    const g = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgbaOf(CYAN, 0.14 * ambientGlow));
    g.addColorStop(0.45, rgbaOf(ORANGE, 0.1 * ambientGlow));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx2d.fillStyle = g;
    ctx2d.fillRect(0, 0, w, h);
  }

  function drawJogPlatter(w, h, energy, kick, now) {
    const cx = w * 0.5;
    const cy = h * 0.175;
    const baseR = Math.min(w, h) * 0.14;
    const spin = (bpmConfident ? bpmDisplay : 120) / 60;
    jogAngle += (0.008 + energy * 0.02 + kick * 0.03) * (0.7 + spin * 0.15);
    jogPulse *= 0.9;
    const breath = 1 + ambientGlow * 0.06 + jogPulse * 0.12;
    const r = baseR * breath;

    ctx2d.beginPath();
    ctx2d.arc(cx, cy, r, 0, Math.PI * 2);
    ctx2d.strokeStyle = rgbaOf(CYAN, 0.22 + ambientGlow * 0.35 + jogPulse * 0.4);
    ctx2d.lineWidth = Math.max(2 * dpr, (3.5 + jogPulse * 4) * dpr);
    ctx2d.stroke();

    ctx2d.beginPath();
    ctx2d.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
    ctx2d.strokeStyle = rgbaOf(ORANGE, 0.16 + kick * 0.35 + jogPulse * 0.35);
    ctx2d.lineWidth = Math.max(1.5 * dpr, (2.2 + jogPulse * 3) * dpr);
    ctx2d.stroke();

    const ticks = 24;
    ctx2d.save();
    ctx2d.translate(cx, cy);
    ctx2d.rotate(jogAngle);
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2;
      const major = i % 6 === 0;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const r0 = r * (major ? 0.88 : 0.92);
      const r1 = r * (major ? 1.05 : 1.02);
      ctx2d.beginPath();
      ctx2d.moveTo(cos * r0, sin * r0);
      ctx2d.lineTo(cos * r1, sin * r1);
      if (major) {
        ctx2d.strokeStyle = rgbaOf(CYAN, 0.35 + jogPulse * 0.4);
        ctx2d.lineWidth = 2 * dpr;
      } else {
        ctx2d.strokeStyle = rgbaOf(ORANGE, 0.2 + energy * 0.25);
        ctx2d.lineWidth = 1.2 * dpr;
      }
      ctx2d.stroke();
    }
    ctx2d.beginPath();
    ctx2d.arc(0, 0, r * 0.12, 0, Math.PI * 2);
    ctx2d.fillStyle = rgbaOf(CYAN, 0.15 + jogPulse * 0.45);
    ctx2d.fill();
    ctx2d.beginPath();
    ctx2d.arc(0, 0, r * 0.06, 0, Math.PI * 2);
    ctx2d.fillStyle = rgbaOf(ORANGE, 0.35 + jogPulse * 0.4);
    ctx2d.fill();
    ctx2d.restore();

    const disc = ctx2d.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
    disc.addColorStop(0, `rgba(0,40,50,${0.12 + ambientGlow * 0.1})`);
    disc.addColorStop(0.7, `rgba(0,0,0,0.05)`);
    disc.addColorStop(1, "rgba(0,0,0,0)");
    ctx2d.fillStyle = disc;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, r, 0, Math.PI * 2);
    ctx2d.fill();
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
      bloom.addColorStop(0.55, rgbaOf(ORANGE, 0.14 * boomFlash));
      bloom.addColorStop(0.78, rgbaOf(CYAN, 0.06 * boomFlash));
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
      disc.addColorStop(0, rgbaOf(BOOM_CORE, 0.45 * alpha));
      disc.addColorStop(0.18, `rgba(${BOOM_CORE[0]},${BOOM_CORE[1]},${BOOM_CORE[2]},${0.5 * alpha})`);
      disc.addColorStop(0.45, `rgba(${BOOM[0]},${BOOM[1]},${BOOM[2]},${0.32 * alpha})`);
      disc.addColorStop(0.72, rgbaOf(ORANGE, 0.12 * alpha));
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
      ctx2d.strokeStyle = rgbaOf(CYAN, alpha * 0.35);
      ctx2d.lineWidth = Math.max(2 * dpr, 5 * dpr * (1 - age));
      ctx2d.stroke();

      // Horizontal sub pressure band — wide and soft
      const bandH = (40 + k.strength * 70) * dpr * body;
      const bandGrad = ctx2d.createLinearGradient(0, cy - bandH, 0, cy + bandH);
      bandGrad.addColorStop(0, "rgba(0,0,0,0)");
      bandGrad.addColorStop(0.4, `rgba(${BOOM[0]},${BOOM[1]},${BOOM[2]},${0.28 * alpha})`);
      bandGrad.addColorStop(0.5, rgbaOf(BOOM_CORE, 0.4 * alpha));
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
      bloom.addColorStop(0, rgbaOf(CYAN, 0.18 * pulseFlash));
      bloom.addColorStop(0.35, rgbaOf(ORANGE, 0.1 * pulseFlash));
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

  function spectralColor(bass, mid, high, amp) {
    const sp = currentTheme.spectral;
    const b = Math.min(1, bass);
    const m = Math.min(1, mid);
    const hi = Math.min(1, high);
    const a = Math.min(1, Math.max(0.15, amp));
    let r = b * sp.bass[0] + m * sp.mid[0] + hi * sp.high[0];
    let g = b * sp.bass[1] + m * sp.mid[1] + hi * sp.high[1];
    let bl = b * sp.bass[2] + m * sp.mid[2] + hi * sp.high[2];
    r = Math.min(255, r + hi * sp.highAdd[0] + m * sp.midAdd[0]);
    g = Math.min(255, g + hi * sp.highAdd[1] + m * sp.midAdd[1]);
    bl = Math.min(255, bl + hi * sp.highAdd[2] + m * sp.midAdd[2]);
    const glow = 0.55 + a * 0.7;
    return [
      Math.min(255, Math.round(r * glow)),
      Math.min(255, Math.round(g * glow)),
      Math.min(255, Math.round(bl * glow)),
    ];
  }

  function pushWaveSample(amp, bass, mid, high, onset, now) {
    waveHist[waveWrite] = { amp, bass, mid, high, onset };
    waveWrite = (waveWrite + 1) % WAVE_COLS;
    if (waveFilled < WAVE_COLS) waveFilled++;

    // Advance fake bar numbers on confident beat gaps
    const barMs = bpmConfident && bpmDisplay > 0 ? (60000 / bpmDisplay) * 4 : beatInterval * 4;
    if (onset > 0.35 && now - lastWaveBarMs > barMs * 0.85) {
      lastWaveBarMs = now;
      waveBarCounter = (waveBarCounter % 16) + 1;
      if (waveBarCounter < 7) waveBarCounter = 7;
    }
  }

  function sampleAndPushWave(kick, bass, energy, sens, now) {
    if (!timeData || !freqData) return;
    // RMS amp from time domain
    let sum = 0;
    const n = timeData.length;
    const step = Math.max(1, (n / 64) | 0);
    for (let i = 0; i < n; i += step) {
      const v = (timeData[i] - 128) / 128;
      sum += v * v;
    }
    let amp = Math.sqrt(sum / Math.max(1, n / step));
    amp = Math.min(1, amp * sens * 4.4);

    const bc = freqData.length;
    const bHi = Math.max(3, (bc * 0.06) | 0);
    const mHi = Math.max(bHi + 1, (bc * 0.25) | 0);
    const hHi = Math.max(mHi + 1, (bc * 0.55) | 0);
    let bs = 0, ms = 0, hs = 0, bn = 0, mn = 0, hn = 0;
    for (let j = 1; j < bHi; j++) { bs += freqData[j]; bn++; }
    for (let j = bHi; j < mHi; j++) { ms += freqData[j]; mn++; }
    for (let j = mHi; j < hHi; j++) { hs += freqData[j]; hn++; }
    const bassB = Math.min(1, (bs / Math.max(1, bn) / 255) * sens * 1.55);
    const midB = Math.min(1, (ms / Math.max(1, mn) / 255) * sens * 1.45);
    const highB = Math.min(1, (hs / Math.max(1, hn) / 255) * sens * 1.5);

    const rise = amp - prevWaveAmp;
    prevWaveAmp = amp;
    const onset = Math.min(1, Math.max(0, rise * 4 + kick * 0.55 + (amp > 0.2 && rise > 0.015 ? 0.35 : 0)));

    pushWaveSample(amp, Math.max(bassB, bass * 0.7), midB, highB, onset, now);
  }

  function drawSeratoWavePanel(w, h) {
    // Primary visual band — tall Serato stack
    const panelTop = h * 0.20;
    const panelH = h * 0.58;
    const panelBot = panelTop + panelH;
    const padX = w * 0.03;
    const innerW = w - padX * 2;
    const playX = padX + innerW * 0.5;

    // Deep black well for contrast
    ctx2d.fillStyle = "rgba(0,0,0,0.88)";
    ctx2d.fillRect(padX - 2 * dpr, panelTop - 2 * dpr, innerW + 4 * dpr, panelH + 4 * dpr);
    ctx2d.strokeStyle = "rgba(40,50,60,0.95)";
    ctx2d.lineWidth = 1 * dpr;
    ctx2d.strokeRect(padX - 2 * dpr, panelTop - 2 * dpr, innerW + 4 * dpr, panelH + 4 * dpr);

    const topH = panelH * 0.56;
    const midH = panelH * 0.11;
    const botH = panelH * 0.33;
    const topY = panelTop;
    const midY = panelTop + topH;
    const botY = midY + midH;

    const cols = Math.min(waveFilled, WAVE_COLS);
    if (cols < 2) {
      // idle placeholder centerline
      ctx2d.strokeStyle = "rgba(0,180,200,0.15)";
      ctx2d.beginPath();
      ctx2d.moveTo(padX, topY + topH * 0.5);
      ctx2d.lineTo(padX + innerW, topY + topH * 0.5);
      ctx2d.stroke();
      // playhead
      ctx2d.strokeStyle = "rgba(255,255,255,0.85)";
      ctx2d.lineWidth = Math.max(1.5 * dpr, 2 * dpr);
      ctx2d.beginPath();
      ctx2d.moveTo(playX, panelTop);
      ctx2d.lineTo(playX, panelBot);
      ctx2d.stroke();
      return;
    }

    const colW = Math.max(1, (innerW * 0.5) / Math.max(1, cols - 1));

    // Grid / bar lines across all tiers (left of playhead = history)
    const barPx = Math.max(18 * dpr, innerW * 0.07);
    ctx2d.font = `${Math.max(8, 9 * dpr)}px -apple-system, sans-serif`;
    ctx2d.textAlign = "center";
    for (let gx = playX; gx >= padX; gx -= barPx) {
      ctx2d.strokeStyle = "rgba(80,90,100,0.28)";
      ctx2d.lineWidth = 1 * dpr;
      ctx2d.beginPath();
      ctx2d.moveTo(gx, panelTop);
      ctx2d.lineTo(gx, panelBot);
      ctx2d.stroke();
    }
    // Future-side faint grid
    for (let gx = playX + barPx; gx <= padX + innerW; gx += barPx) {
      ctx2d.strokeStyle = "rgba(60,70,80,0.15)";
      ctx2d.beginPath();
      ctx2d.moveTo(gx, panelTop);
      ctx2d.lineTo(gx, panelBot);
      ctx2d.stroke();
    }

    // Draw history columns: newest at playhead, older to the left
    for (let i = 0; i < cols; i++) {
      const idx = (waveWrite - 1 - i + WAVE_COLS * 4) % WAVE_COLS;
      const s = waveHist[idx];
      const x = playX - i * colW;
      if (x < padX - colW) break;

      const [cr, cg, cb] = spectralColor(s.bass, s.mid, s.high, s.amp);
      const cw = Math.max(1.5 * dpr, colW * 1.05);

      // --- Top tier: bold spectral waveform (symmetric) ---
      const midTop = topY + topH * 0.5;
      const half = Math.max(2 * dpr, s.amp * topH * 0.62);
      // Bass body — theme bass core
      const bbod = currentTheme.bassBody;
      const lowHalf = half * (0.5 + s.bass * 0.55);
      const bassR = Math.min(255, bbod.r0 + s.bass * bbod.rS);
      const bassG = Math.min(255, bbod.g0 + s.bass * bbod.gBass + s.mid * bbod.gMid);
      ctx2d.fillStyle = `rgba(${bassR},${bassG},${bbod.b},0.95)`;
      ctx2d.fillRect(x, midTop - lowHalf, cw, lowHalf * 2);
      // Mid layer — spectral overlay
      const midHalf = half * (0.4 + s.mid * 0.55);
      ctx2d.fillStyle = `rgba(${Math.max(0, cr - 30)},${Math.min(255, cg + 50)},${Math.min(255, cb)},0.9)`;
      ctx2d.fillRect(x + cw * 0.12, midTop - midHalf, Math.max(1, cw * 0.76), midHalf * 2);
      // High tips
      const htip = currentTheme.highTip;
      const hiHalf = half * (0.4 + s.high * 0.7);
      const tipH = Math.max(2 * dpr, hiHalf * 0.28);
      ctx2d.fillStyle = `rgba(${Math.min(255, htip.r0 + s.high * htip.rS)},${Math.min(255, htip.g0 + s.high * htip.gS)},${Math.min(255, htip.b0 + s.high * htip.bS)},1)`;
      ctx2d.fillRect(x, midTop - hiHalf, Math.max(1, cw * 0.7), tipH);
      ctx2d.fillRect(x, midTop + hiHalf - tipH, Math.max(1, cw * 0.7), tipH);
      if (s.high > 0.35) {
        const he = currentTheme.highEdge;
        ctx2d.fillStyle = rgbaOf(he, 0.4 + s.high * 0.5);
        ctx2d.fillRect(x, midTop - hiHalf - 1 * dpr, Math.max(1, cw * 0.45), 2 * dpr);
        ctx2d.fillRect(x, midTop + hiHalf - 1 * dpr, Math.max(1, cw * 0.45), 2 * dpr);
      }

      // --- Mid tier: transient ribbon ---
      const mr = currentTheme.midRibbon;
      const onsetH = Math.max(2 * dpr, s.onset * midH * 0.98);
      ctx2d.fillStyle = `rgba(${Math.min(255, mr.r0 + s.onset * mr.rS)},${Math.min(255, mr.g0 + s.onset * mr.gS)},${mr.b},${0.45 + s.onset * 0.55})`;
      ctx2d.fillRect(x, midY + midH - onsetH, Math.max(1, cw * 0.9), onsetH);
      if (s.onset > 0.4) {
        ctx2d.fillStyle = `rgba(255,255,255,${s.onset})`;
        ctx2d.fillRect(x, midY + 1, Math.max(1, cw * 0.75), 2.5 * dpr);
      }

      // --- Bottom tier: overview ---
      const ov = currentTheme.overview;
      const midBot = botY + botH * 0.5;
      const botHalf = Math.max(2 * dpr, s.amp * botH * 0.58);
      const br = Math.min(255, ov.br0 + s.bass * ov.brBass + s.amp * ov.brAmp);
      const bg = Math.min(255, ov.bg0 + s.mid * ov.bgMid + s.amp * ov.bgAmp);
      const bb = Math.min(255, ov.bb0 + s.high * ov.bbHigh + s.amp * ov.bbAmp);
      ctx2d.fillStyle = `rgba(${br},${bg},${bb},0.95)`;
      ctx2d.fillRect(x, midBot - botHalf, cw, botHalf * 2);
    }

    // Centerlines
    ctx2d.strokeStyle = "rgba(0,200,220,0.12)";
    ctx2d.lineWidth = 1 * dpr;
    ctx2d.beginPath();
    ctx2d.moveTo(padX, topY + topH * 0.5);
    ctx2d.lineTo(padX + innerW, topY + topH * 0.5);
    ctx2d.stroke();
    ctx2d.beginPath();
    ctx2d.moveTo(padX, botY + botH * 0.5);
    ctx2d.lineTo(padX + innerW, botY + botH * 0.5);
    ctx2d.stroke();

    // Tier separators
    ctx2d.strokeStyle = "rgba(50,60,70,0.7)";
    ctx2d.beginPath();
    ctx2d.moveTo(padX, midY);
    ctx2d.lineTo(padX + innerW, midY);
    ctx2d.moveTo(padX, botY);
    ctx2d.lineTo(padX + innerW, botY);
    ctx2d.stroke();

    // Bar numbers on bottom tier (left of playhead)
    ctx2d.fillStyle = "rgba(220,230,240,0.75)";
    let barNum = waveBarCounter;
    for (let gx = playX, k = 0; gx >= padX && k < 8; gx -= barPx, k++) {
      const label = ((barNum - k - 1 + 64) % 16) + 1;
      ctx2d.fillText(String(label), gx, botY + 10 * dpr);
    }

    // Bright white playhead through all tiers
    ctx2d.strokeStyle = "rgba(255,255,255,0.95)";
    ctx2d.lineWidth = Math.max(1.5 * dpr, 2 * dpr);
    ctx2d.shadowColor = "rgba(255,255,255,0.6)";
    ctx2d.shadowBlur = 6 * dpr;
    ctx2d.beginPath();
    ctx2d.moveTo(playX, panelTop);
    ctx2d.lineTo(playX, panelBot);
    ctx2d.stroke();
    ctx2d.shadowBlur = 0;
    // playhead tip diamonds
    ctx2d.fillStyle = "#fff";
    ctx2d.beginPath();
    ctx2d.moveTo(playX, panelTop);
    ctx2d.lineTo(playX - 3 * dpr, panelTop + 5 * dpr);
    ctx2d.lineTo(playX + 3 * dpr, panelTop + 5 * dpr);
    ctx2d.closePath();
    ctx2d.fill();
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
    ctx2d.strokeStyle = rgbaOf(CYAN, 0.12);
    ctx2d.lineWidth = 2 * dpr;
    ctx2d.stroke();
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, Math.min(w, h) * 0.2, 0, Math.PI * 2);
    ctx2d.strokeStyle = rgbaOf(ORANGE, 0.08);
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

    ctx2d.strokeStyle = rgbaOf(CYAN, 0.08);
    ctx2d.lineWidth = 1 * dpr;
    ctx2d.beginPath();
    ctx2d.moveTo(padX, h * 0.5);
    ctx2d.lineTo(w - padX, h * 0.5);
    ctx2d.stroke();
  }

  function drawFrame() {
    if (!running || !analyser) return;

    analyser.getByteFrequencyData(freqData);
    if (timeData) analyser.getByteTimeDomainData(timeData);

    const w = els.canvas.width;
    const h = els.canvas.height;
    const sens = parseFloat(els.sensitivity.value) || 1.7;
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
    let kick = 0;

    // Kick body phones can hear: ~60–200 Hz (skip DC/bin0 noise, cover mid-bass)
    // At 48kHz / fft 2048, bin ≈ 23 Hz → bins ~3..9
    const kickLo = Math.max(2, Math.floor(binCount * 0.005));
    const kickHi = Math.max(kickLo + 4, Math.floor(binCount * 0.045));
    let kickSum = 0;
    let kickN = 0;
    for (let j = kickLo; j <= kickHi && j < binCount; j++) {
      kickSum += freqData[j];
      kickN++;
    }
    kick = Math.min(1, ((kickSum / Math.max(1, kickN)) / 255) * sens * 1.35);

    // Broader low end for general bass (~40–250 Hz-ish)
    const bassLo = Math.max(1, Math.floor(binCount * 0.002));
    const bassHi = Math.max(bassLo + 6, Math.floor(binCount * 0.08));
    let bassSum = 0;
    let bassN = 0;
    for (let j = bassLo; j <= bassHi && j < binCount; j++) {
      bassSum += freqData[j];
      bassN++;
    }
    bass = Math.min(1, ((bassSum / Math.max(1, bassN)) / 255) * sens * 1.2);

    for (let i = 0; i < BAR_COUNT; i++) {
      const t0 = Math.pow(i / BAR_COUNT, 1.55);
      const t1 = Math.pow((i + 1) / BAR_COUNT, 1.55);
      const i0 = Math.floor(t0 * (binCount - 1));
      const i1 = Math.max(i0 + 1, Math.floor(t1 * (binCount - 1)));

      let sum = 0;
      for (let j = i0; j <= i1; j++) sum += freqData[j];
      let v = (sum / (i1 - i0 + 1)) / 255;
      const boost = 0.9 + 0.65 * (i / (BAR_COUNT - 1));
      v = Math.min(1, v * sens * boost * 1.15);

      smoothed[i] = smoothed[i] * 0.48 + v * 0.52;
      energy += smoothed[i];
    }

    energy /= BAR_COUNT;

    // Kick/808 boom first; lighter beat fills the rest
    if (!detect808(kick, bass, energy, sens, now)) {
      detectBeat(bass, energy, sens, now);
    }

    // Always-on energy glow so the screen moves between beats
    drawAmbientEnergy(w, h, energy, kick);

    // CDJ jog platter (under pulses so booms/rings stay on top)
    drawJogPlatter(w, h, energy, kick, now);

    // Layer 0: heavy 808 boom
    draw808Booms(w, h, now);

    // Layer 1: beat wave pulses
    drawPulses(w, h, now);

    // Serato spectral waveform panel (lower-middle band)
    sampleAndPushWave(kick, bass, energy, sens, now);
    drawSeratoWavePanel(w, h);

    // Spectrum bars along the bottom (shorter so panel stays readable)
    const punch = 1 + kick * 0.35 + ambientGlow * 0.2;
    const specUsable = usable * 0.16;
    const specBase = h - padY;
    for (let i = 0; i < BAR_COUNT; i++) {
      const level = Math.min(1, smoothed[i] * punch);
      const barH = Math.max(specUsable * 0.04, level * specUsable);
      const x = padX + i * (barW + gap);
      const y = specBase - barH;
      const t = i / (BAR_COUNT - 1);
      const [r, g, b] = lerpColor(CYAN, ORANGE, t);

      const grad = ctx2d.createLinearGradient(x, y, x, specBase);
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
      grad.addColorStop(0.45, `rgba(${r},${g},${b},0.85)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0.2)`);
      ctx2d.fillStyle = grad;
      ctx2d.fillRect(x, y, barW, barH);

      ctx2d.fillStyle = `rgba(255,255,255,${0.35 + level * 0.45})`;
      ctx2d.fillRect(x, y, barW, Math.max(1.5 * dpr, barH * 0.04));
    }

    // FLX4 channel meters + Serato edge strips
    let lvl1 = 0;
    let lvl2 = 0;
    if (stereoMode && analyserL && analyserR && timeL && timeR) {
      analyserL.getByteTimeDomainData(timeL);
      analyserR.getByteTimeDomainData(timeR);
      analyserL.getByteFrequencyData(freqL);
      analyserR.getByteFrequencyData(freqR);
      const rmsL = rmsFromTime(timeL);
      const rmsR = rmsFromTime(timeR);
      let lowL = 0, lowR = 0, n = 0;
      const hi = Math.min(12, freqL.length);
      for (let j = 1; j < hi; j++) {
        lowL += freqL[j];
        lowR += freqR[j];
        n++;
      }
      lowL = (lowL / Math.max(1, n)) / 255;
      lowR = (lowR / Math.max(1, n)) / 255;
      lvl1 = Math.min(1, (rmsL * 2.8 + lowL * 0.9) * sens * 0.85);
      lvl2 = Math.min(1, (rmsR * 2.8 + lowR * 0.9) * sens * 0.85);
    } else {
      const tRms = rmsFromTime(timeData);
      lvl1 = Math.min(1, (tRms * 2.6 + energy * 0.7) * sens * 0.9);
      lvl2 = Math.min(1, (tRms * 2.2 + kick * 1.05 + bass * 0.45) * sens * 0.9);
      const wobble = 0.045 * Math.sin(now * 0.008);
      lvl1 = Math.min(1, Math.max(0, lvl1 + wobble));
      lvl2 = Math.min(1, Math.max(0, lvl2 - wobble));
    }

    updateChannelMeters(lvl1, lvl2, now);
    drawSeratoEdgeMeters(w, h, meterCh1, meterCh2);

    const peak = Math.min(1, Math.max(energy * 1.35, bass * 1.15, kick * 1.25, meterCh1, meterCh2));
    peakHold = Math.max(peak, peakHold - 0.012);

    statusTick++;
    if (statusTick % 8 === 0) {
      setStatus(`LIVE · ${Math.round(peak * 100)}%`, "live");
    }

    rafId = requestAnimationFrame(drawFrame);
  }

  async function buildAudioConstraints() {
    return {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 2 },
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
      analyser.smoothingTimeConstant = 0.35;
      analyser.minDecibels = -95;
      analyser.maxDecibels = -25;

      sourceNode = audioCtx.createMediaStreamSource(mediaStream);
      sourceNode.connect(analyser);

      // Optional stereo split for true CH1/CH2 meters
      stereoMode = false;
      splitter = null;
      analyserL = analyserR = null;
      freqL = freqR = timeL = timeR = null;
      try {
        const tracks = mediaStream.getAudioTracks();
        const settings = tracks[0] && tracks[0].getSettings ? tracks[0].getSettings() : {};
        const chans = settings.channelCount || 1;
        if (chans >= 2) {
          splitter = audioCtx.createChannelSplitter(2);
          sourceNode.connect(splitter);
          analyserL = audioCtx.createAnalyser();
          analyserR = audioCtx.createAnalyser();
          [analyserL, analyserR].forEach((a) => {
            a.fftSize = 2048;
            a.smoothingTimeConstant = 0.3;
            a.minDecibels = -95;
            a.maxDecibels = -25;
          });
          splitter.connect(analyserL, 0);
          splitter.connect(analyserR, 1);
          freqL = new Uint8Array(analyserL.frequencyBinCount);
          freqR = new Uint8Array(analyserR.frequencyBinCount);
          timeL = new Uint8Array(analyserL.fftSize);
          timeR = new Uint8Array(analyserR.fftSize);
          stereoMode = true;
        }
      } catch (_) {
        stereoMode = false;
      }

      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Uint8Array(analyser.fftSize);
      smoothed.fill(0);
      meterCh1 = meterCh2 = peakCh1 = peakCh2 = 0;
      peakHoldT1 = peakHoldT2 = 0;
      waveWrite = 0;
      waveFilled = 0;
      prevWaveAmp = 0;
      waveBarCounter = 7;
      lastWaveBarMs = 0;
      for (let i = 0; i < WAVE_COLS; i++) {
        waveHist[i] = { amp: 0, bass: 0, mid: 0, high: 0, onset: 0 };
      }
      initMeters();
      bassHistory = [];
      bassAvg = 0.04;
      kickHistory = [];
      kickAvg = 0.04;
      prevKick = 0;
      lastBeat = 0;
      last808 = 0;
      pulses.length = 0;
      booms.length = 0;
      pulseFlash = 0;
      boomFlash = 0;
      ambientGlow = 0;
      statusTick = 0;
      jogAngle = 0;
      jogPulse = 0;
      resetBpm();

      running = true;
      els.overlay.hidden = true;
      els.denied.hidden = true;
      els.toggleBtn.disabled = false;
      els.toggleBtn.textContent = "Stop";
      els.toggleBtn.classList.add("running");
      setStatus("LIVE · listening", "live");
      schedulePartyHide();

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
    ambientGlow = 0;
    els.display.classList.remove("flash", "flash-808");

    els.toggleBtn.textContent = "Stop";
    els.toggleBtn.classList.remove("running");
    els.toggleBtn.disabled = true;
    peakHold = 0;
    meterCh1 = meterCh2 = peakCh1 = peakCh2 = 0;
    updateLedStack(ch1Leds, 0, 0);
    updateLedStack(ch2Leds, 0, 0);
    if (splitter) {
      try { splitter.disconnect(); } catch (_) {}
      splitter = null;
    }
    analyserL = analyserR = null;
    stereoMode = false;

    clearTimeout(partyTimer);
    partyTimer = 0;
    if (partyMode) setParty(false);
    resetBpm();

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
        setStatus("LIVE · listening", "live");
      } catch (_) {}
    }
  }

  els.startBtn.addEventListener("click", () => {
    if (!running) start();
  });

  els.toggleBtn.addEventListener("click", () => {
    if (running) stop(true);
  });

  if (els.partyBtn) {
    els.partyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setParty(!partyMode);
    });
  }

  if (els.colorsBtn) {
    els.colorsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setThemeSheet(!themeSheetOpen);
    });
  }

  document.addEventListener("click", (e) => {
    if (!themeSheetOpen) return;
    if (e.target.closest("#themeSheet") || e.target.closest("#colorsBtn")) return;
    setThemeSheet(false);
  });

  els.display.addEventListener("click", (e) => {
    if (!running) return;
    if (e.target.closest(".tap-btn") || e.target.closest(".overlay") || e.target.closest(".denied")) return;
    if (partyMode) revealChrome();
    else schedulePartyHide();
  });

  els.app.addEventListener("touchstart", () => {
    if (running && !partyMode) schedulePartyHide();
  }, { passive: true });

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

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js?v=7").catch(() => {});
    });
  }

  buildThemeChips();
  restoreTheme();
  initMeters();
  resize();
  drawIdle();
  setBpmText("--.-");
})();
