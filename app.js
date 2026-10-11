(() => {
  "use strict";

  const THEME_KEY = "lighto-theme";
  const MODE_KEY = "lighto-mode";
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
    modeBtn: document.getElementById("modeBtn"),
    modeToast: document.getElementById("modeToast"),
    themeSheet: document.getElementById("themeSheet"),
    themeChips: document.getElementById("themeChips"),
    sensitivity: document.getElementById("sensitivity"),
    status: document.getElementById("status"),
    display: document.getElementById("display"),
    flxMeters: document.getElementById("flxMeters"),
    ch1Well: document.getElementById("ch1Well"),
    ch2Well: document.getElementById("ch2Well"),
    seratoWellL: document.getElementById("seratoWellL"),
    seratoWellR: document.getElementById("seratoWellR"),
    bpmValue: document.getElementById("bpmValue"),
    bpmCornerValue: document.getElementById("bpmCornerValue"),
    beatCounter: document.getElementById("beatCounter"),
    secDots: document.getElementById("secDots"),
  };

  const LED_COUNT = 12;
  const AMBER_HOT_FROM = 9;
  const SERATO_LED_COUNT = 16;
  // Serato segment bands (index from bottom): green / yellow / red
  const SERATO_YELLOW_FROM = 9;  // ~56%
  const SERATO_RED_FROM = 13;    // ~81%

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

  // ---- Visual modes (Lighto 2.0): switchable canvas visualizers ----
  // classic = the original full CDJ view; the rest are alternate takes
  // that reuse the same beat/kick/energy analysis + DOM chrome.
  const MODES = [
    { id: "classic", name: "Classic" },
    { id: "orbit", name: "Orbit" },
    { id: "scope", name: "Scope" },
    { id: "nebula", name: "Nebula" },
    { id: "strobe", name: "Strobe" },
  ];
  let modeIndex = 0;
  let modeToastTimer = 0;

  function currentMode() {
    return MODES[modeIndex].id;
  }

  function syncModeBtn() {
    if (els.modeBtn) els.modeBtn.textContent = "Mode: " + MODES[modeIndex].name;
  }

  function showModeToast() {
    if (!els.modeToast) return;
    els.modeToast.textContent = MODES[modeIndex].name;
    els.modeToast.classList.add("show");
    window.clearTimeout(modeToastTimer);
    modeToastTimer = window.setTimeout(() => {
      els.modeToast.classList.remove("show");
    }, 1200);
  }

  function setMode(id, persist) {
    const i = MODES.findIndex((m) => m.id === id);
    if (i >= 0) modeIndex = i;
    syncModeBtn();
    if (persist !== false) {
      try {
        localStorage.setItem(MODE_KEY, MODES[modeIndex].id);
      } catch (_) {}
    }
  }

  function cycleMode() {
    modeIndex = (modeIndex + 1) % MODES.length;
    setMode(MODES[modeIndex].id, true);
    showModeToast();
  }

  function restoreMode() {
    let id = "classic";
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved && MODES.some((m) => m.id === saved)) id = saved;
    } catch (_) {}
    setMode(id, false);
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

  // Lighto 2.0 mode state: nebula particle pool + strobe panel levels
  const nebulaParts = []; // { x, y, vx, vy, life, maxLife, size, heat }
  const NEBULA_MAX = 240;
  const STROBE_COLS = 4;
  const STROBE_ROWS = 6;
  const strobeVals = new Float32Array(STROBE_COLS * STROBE_ROWS);
  const strobePhase = new Float32Array(STROBE_COLS * STROBE_ROWS);
  for (let si = 0; si < strobePhase.length; si++) strobePhase[si] = Math.random();

  // BPM / jog / party
  const beatGaps = [];
  let bpmDisplay = 0;
  let bpmConfident = false;
  let jogAngle = 0;
  let jogPulse = 0;
  let partyMode = false;
  let partyTimer = 0;
  const PARTY_HIDE_MS = 3500;

  // CDJ-style 1–4 beat counter (advances on kick/beat)
  let beatCount = 0; // 0 = idle/soft, 1–4 active
  let beatPads = [];
  let beatFlashToken = 0;

  let ch1Leds = [];
  let ch2Leds = [];
  let seratoLedsL = [];
  let seratoLedsR = [];
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

  // Lighthouse pulse waves (beat-synced rings + beam flares under the Serato wave)
  let lhAngle = -Math.PI / 2; // faint slow accent drift
  let lhLastMs = 0;
  let lhStep = 0;
  let lhFlash = 0; // 0..1 beat punch
  const lhPulses = []; // { t0, strength, is808, angle, ring, beam }
  const LH_MAX_PULSES = 8;
  const LH_PULSE_MS = 1100;
  const lhRays = []; // { t0, angle, color, len, width, life }
  const LH_MAX_RAYS = 48;

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
    softResetBeatCounter();
  }

  function initBeatCounter() {
    beatPads = els.beatCounter
      ? Array.from(els.beatCounter.querySelectorAll(".beat-pad"))
      : [];
  }

  function softResetBeatCounter() {
    beatCount = 0;
    if (!els.beatCounter) return;
    els.beatCounter.classList.remove("live");
    els.beatCounter.classList.add("soft");
    els.beatCounter.setAttribute("aria-hidden", "true");
    for (const pad of beatPads) {
      pad.classList.remove("active", "blink", "downbeat");
    }
  }

  function paintBeatCounter(flash) {
    if (!els.beatCounter || !beatPads.length) return;
    const live = beatCount >= 1;
    els.beatCounter.classList.toggle("live", live);
    els.beatCounter.classList.toggle("soft", !live);
    els.beatCounter.setAttribute("aria-hidden", live ? "false" : "true");
    for (const pad of beatPads) {
      const n = Number(pad.dataset.beat);
      const on = live && n === beatCount;
      pad.classList.toggle("active", on);
      pad.classList.toggle("downbeat", on && beatCount === 1);
      if (flash && on) {
        pad.classList.remove("blink");
        // Force reflow so blink restarts each beat
        void pad.offsetWidth;
        pad.classList.add("blink");
        const token = ++beatFlashToken;
        window.setTimeout(() => {
          if (token === beatFlashToken) pad.classList.remove("blink");
        }, beatCount === 1 ? 260 : 200);
      } else if (!on) {
        pad.classList.remove("blink");
      }
    }
  }

  // —— Steady 1-second 4-count dots (bottom). Clock-driven, NOT beat-driven. ——
  // Runs all the time on its own rAF loop; index derived from performance.now()
  // so it never drifts (dropped frames / backgrounding just skip to the right dot).
  let secDots = [];
  let secAnchor = performance.now();
  let secIdx = -1;
  let secRaf = 0;

  function initSecDots() {
    secDots = els.secDots ? Array.from(els.secDots.querySelectorAll(".sec-dot")) : [];
  }

  function anchorSecDots() {
    secAnchor = performance.now();
    secIdx = -1;
  }

  function tickSecDots() {
    secRaf = requestAnimationFrame(tickSecDots);
    if (!secDots.length) return;
    const idx = Math.floor((performance.now() - secAnchor) / 1000) % 4;
    if (idx === secIdx) return;
    secIdx = idx;
    for (let i = 0; i < secDots.length; i++) {
      const d = secDots[i];
      const on = i === idx;
      d.classList.toggle("on", on);
      d.classList.toggle("down", on && i === 0);
      d.classList.remove("blink");
      if (on) {
        void d.offsetWidth; // restart blink animation each second
        d.classList.add("blink");
      }
    }
  }

  function advanceBeatCounter() {
    beatCount = beatCount <= 0 ? 1 : (beatCount % 4) + 1;
    paintBeatCounter(true);
  }

  function tickBeatCounterSoft(now) {
    if (beatCount <= 0) return;
    const stale = Math.max(900, beatInterval * 2.4);
    if (now - lastBeat > stale) softResetBeatCounter();
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

  function buildSeratoWell(well) {
    if (!well) return [];
    well.innerHTML = "";
    const leds = [];
    for (let i = 0; i < SERATO_LED_COUNT; i++) {
      const el = document.createElement("div");
      el.className = "serato-led";
      if (i >= SERATO_RED_FROM) el.classList.add("red");
      else if (i >= SERATO_YELLOW_FROM) el.classList.add("yellow");
      else el.classList.add("green");
      well.appendChild(el);
      leds.push(el);
    }
    return leds;
  }

  function updateSeratoStack(leds, level, peak) {
    const n = leds.length;
    if (!n) return;
    const lit = Math.round(Math.min(1, Math.max(0, level)) * n);
    const peakIdx = Math.min(n - 1, Math.max(0, Math.round(peak * n) - 1));
    for (let i = 0; i < n; i++) {
      const on = i < lit;
      leds[i].classList.toggle("on", on);
      const isPeak = !on && i === peakIdx && peak > 0.04;
      leds[i].classList.toggle("peak-hold", isPeak);
    }
  }

  function initMeters() {
    ch1Leds = buildLedWell(els.ch1Well);
    ch2Leds = buildLedWell(els.ch2Well);
    seratoLedsL = buildSeratoWell(els.seratoWellL);
    seratoLedsR = buildSeratoWell(els.seratoWellR);
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
    updateSeratoStack(seratoLedsL, meterCh1, peakCh1);
    updateSeratoStack(seratoLedsR, meterCh2, peakCh2);
  }


  function spawnPulse(strength, now) {
    const hueMix = strength > 0.75 ? 0.85 : strength > 0.55 ? 0.45 : 0.15;
    pulses.push({ t0: now, strength: Math.min(1, strength), hueMix });
    while (pulses.length > MAX_PULSES) pulses.shift();
    pulseFlash = Math.min(1, pulseFlash + 0.55 + strength * 0.45);
    jogPulse = Math.min(1, jogPulse + 0.55 + strength * 0.4);
    triggerLighthouse(strength, false, now);
    els.display.classList.add("flash");
    window.setTimeout(() => els.display.classList.remove("flash"), 110);
  }

  function spawn808(strength, now) {
    const s = Math.min(1.2, Math.max(0.55, strength));
    booms.push({ t0: now, strength: Math.min(1, s) });
    while (booms.length > MAX_BOOMS) booms.shift();
    boomFlash = Math.min(1, boomFlash + 0.85 + s * 0.55);
    jogPulse = Math.min(1, jogPulse + 0.9 + s * 0.5);
    triggerLighthouse(s, true, now);
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
      advanceBeatCounter();
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
      advanceBeatCounter();
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
      advanceBeatCounter();
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

  // --- Lighthouse pulse waves ----------------------------------------------
  // Beat-synced: every beat / 808 fires an expanding Serato-colored ring with
  // twin opposite beam flares riding it + short spectral rays at the hit.
  // A very faint slow rotation only sets which way each new beam pair points.
  function lhBandColor(bass, mid, high) {
    const sp = currentTheme.spectral;
    const tot = bass + mid + high + 0.0001;
    const r = Math.random() * tot;
    if (r < bass) return Math.random() < 0.5 ? sp.bass : lerpColor(sp.bass, ORANGE, 0.5);
    if (r < bass + mid) return Math.random() < 0.5 ? sp.mid : lerpColor(sp.mid, CYAN, 0.5);
    return Math.random() < 0.4 ? [255, 255, 255] : sp.high;
  }

  function triggerLighthouse(strength, is808, now) {
    const s = Math.min(1.2, Math.max(0.2, strength || 0));
    lhFlash = Math.min(1, lhFlash + (is808 ? 0.7 : 0.4) + s * 0.25);

    // 808 also calls spawnPulse -> merge near-simultaneous hits into one wave
    const prev = lhPulses[lhPulses.length - 1];
    if (prev && now - prev.t0 < 45) {
      prev.strength = Math.min(1.2, Math.max(prev.strength, s));
      prev.is808 = prev.is808 || is808;
      return;
    }

    const last = waveHist[(waveWrite - 1 + WAVE_COLS) % WAVE_COLS] || { bass: 0.4, mid: 0.3, high: 0.2 };
    const bass = 0.15 + (last.bass || 0) + (is808 ? 0.6 : 0);
    const mid = 0.12 + (last.mid || 0);
    const high = 0.1 + (last.high || 0);
    const sp = currentTheme.spectral;
    // Ring color: Serato cyan->orange by strength (808 leans bass/orange)
    const hue = is808 ? 0.9 : s > 0.75 ? 0.7 : s > 0.5 ? 0.4 : 0.12;
    const ring = lerpColor(CYAN, ORANGE, hue);
    // Beam pair steps around the dial each beat (quarter-ish turn + drift)
    lhStep = (lhStep + 1) % 8;
    const angle = lhAngle + lhStep * (Math.PI / 4);
    lhPulses.push({
      t0: now, strength: s, is808, angle, ring,
      beam: lerpColor(is808 ? sp.bass : sp.mid, [255, 255, 255], 0.3),
    });
    while (lhPulses.length > LH_MAX_PULSES) lhPulses.shift();

    // Short Serato spectral rays on the hit, spread all around the ring
    const n = Math.round((is808 ? 10 : 6) + s * (is808 ? 8 : 5));
    for (let i = 0; i < n; i++) {
      const nearBeam = i % 3 === 0;
      lhRays.push({
        t0: now,
        angle: nearBeam
          ? angle + (i % 2 ? Math.PI : 0) + (Math.random() - 0.5) * 0.5
          : Math.random() * Math.PI * 2,
        color: lhBandColor(bass, mid, high),
        len: 0.05 + Math.random() * 0.08 + s * 0.05,
        width: 1.1 + Math.random() * 1.8 + (is808 ? 1.2 : 0),
        life: 300 + Math.random() * 240 + (is808 ? 160 : 0),
      });
    }
    while (lhRays.length > LH_MAX_RAYS) lhRays.shift();
  }

  function drawLighthouse(w, h, cx, cy, now) {
    // Faint accent drift: one revolution every 8 bars (doesn't fight pulses)
    const bpm = bpmConfident && bpmDisplay > 0 ? bpmDisplay : 120;
    const revMs = (60000 / bpm) * 32;
    const dt = lhLastMs ? Math.min(80, now - lhLastMs) : 16;
    lhLastMs = now;
    lhAngle = (lhAngle + (dt / revMs) * Math.PI * 2) % (Math.PI * 2);

    const minDim = Math.min(w, h);
    const maxR = Math.hypot(w, h) * 0.5;
    const flash = lhFlash;

    ctx2d.save();
    ctx2d.globalCompositeOperation = "lighter";
    ctx2d.lineCap = "round";

    // Ghost beam accent (very dim, slow) — just a hint of a lighthouse
    for (let lamp = 0; lamp < 2; lamp++) {
      const a = lhAngle + lamp * Math.PI;
      const g = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.9);
      g.addColorStop(0, rgbaOf(CYAN, 0.05 + ambientGlow * 0.03));
      g.addColorStop(0.6, rgbaOf(CYAN, 0.015));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx2d.fillStyle = g;
      ctx2d.beginPath();
      ctx2d.moveTo(cx, cy);
      ctx2d.arc(cx, cy, maxR * 0.9, a - 0.09, a + 0.09);
      ctx2d.closePath();
      ctx2d.fill();
    }

    // Expanding beat waves
    for (let i = lhPulses.length - 1; i >= 0; i--) {
      const p = lhPulses[i];
      const life = p.is808 ? LH_PULSE_MS * 1.25 : LH_PULSE_MS;
      const age = (now - p.t0) / life;
      if (age >= 1) { lhPulses.splice(i, 1); continue; }
      const ease = 1 - Math.pow(1 - age, 2.2);
      const fade = 1 - age;
      const k = 0.55 + Math.min(1, p.strength) * 0.45;
      const radius = (0.05 + ease * 0.95) * maxR * (0.8 + p.strength * 0.25);
      const lineW = Math.max(1.5 * dpr, (p.is808 ? 9 : 6) * dpr * (1 - age * 0.75) * k);

      // Ring: soft glow + crisp core
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx2d.strokeStyle = rgbaOf(p.ring, fade * 0.16 * k);
      ctx2d.lineWidth = lineW * 3.4;
      ctx2d.stroke();
      ctx2d.strokeStyle = rgbaOf(p.ring, fade * 0.5 * k);
      ctx2d.lineWidth = lineW;
      ctx2d.stroke();

      // Twin opposite beam wedges flaring outward with the ring
      const halfW = 0.22 + (1 - ease) * 0.18 + (p.is808 ? 0.08 : 0);
      for (let lamp = 0; lamp < 2; lamp++) {
        const a = p.angle + lamp * Math.PI;
        const inner = Math.max(0, radius * 0.25);
        const g = ctx2d.createRadialGradient(cx, cy, inner, cx, cy, radius * 1.04);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(0.55, rgbaOf(CYAN, fade * fade * 0.08 * k));
        g.addColorStop(0.92, rgbaOf(p.beam, fade * fade * 0.32 * k));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx2d.fillStyle = g;
        ctx2d.beginPath();
        ctx2d.moveTo(cx, cy);
        ctx2d.arc(cx, cy, radius * 1.04, a - halfW, a + halfW);
        ctx2d.closePath();
        ctx2d.fill();
        // Bright arc where the beam meets the wave front
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, radius, a - halfW * 0.7, a + halfW * 0.7);
        ctx2d.strokeStyle = rgbaOf(lerpColor(p.beam, [255, 255, 255], 0.4), fade * 0.7 * k);
        ctx2d.lineWidth = lineW * 1.3;
        ctx2d.stroke();
      }
    }

    // Short Serato spectral rays bursting from the hit
    for (let i = lhRays.length - 1; i >= 0; i--) {
      const ray = lhRays[i];
      const age = (now - ray.t0) / ray.life;
      if (age >= 1) { lhRays.splice(i, 1); continue; }
      const ease = 1 - Math.pow(1 - age, 2);
      const r0 = minDim * (0.04 + ease * 0.3);
      const r1 = r0 + minDim * ray.len * (1 - age * 0.6);
      const cos = Math.cos(ray.angle);
      const sin = Math.sin(ray.angle);
      ctx2d.strokeStyle = rgbaOf(ray.color, 0.6 * (1 - age));
      ctx2d.lineWidth = ray.width * dpr * (1 - age * 0.4);
      ctx2d.beginPath();
      ctx2d.moveTo(cx + cos * r0, cy + sin * r0);
      ctx2d.lineTo(cx + cos * r1, cy + sin * r1);
      ctx2d.stroke();
    }

    // Lamp glow at the center, punches on each hit
    const lampR = minDim * (0.04 + flash * 0.06);
    const lg = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, lampR);
    lg.addColorStop(0, `rgba(255,255,255,${0.12 + flash * 0.5})`);
    lg.addColorStop(0.5, rgbaOf(CYAN, 0.08 + flash * 0.28));
    lg.addColorStop(1, "rgba(0,0,0,0)");
    ctx2d.fillStyle = lg;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, lampR, 0, Math.PI * 2);
    ctx2d.fill();

    ctx2d.restore();
    lhFlash *= 0.86;
  }

  function drawJogPlatter(w, h, energy, kick, now) {
    const cx = w * 0.5;
    const cy = h * 0.055;
    const baseR = Math.min(w, h) * 0.065;
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

  // ============ Lighto 2.0 visual modes ============

  function roundRectPath(x, y, w, h, rad) {
    const r = Math.min(rad, w / 2, h / 2);
    ctx2d.beginPath();
    ctx2d.moveTo(x + r, y);
    ctx2d.arcTo(x + w, y, x + w, y + h, r);
    ctx2d.arcTo(x + w, y + h, x, y + h, r);
    ctx2d.arcTo(x, y + h, x, y, r);
    ctx2d.arcTo(x, y, x + w, y, r);
    ctx2d.closePath();
  }

  // Orbit: circular spectrum radiating around a big central jog platter.
  function drawOrbitMode(w, h, now, kick, bass, energy) {
    const cx = w * 0.5;
    const cy = h * 0.44;
    const minDim = Math.min(w, h);
    const baseR = minDim * 0.16;

    const spin = (bpmConfident ? bpmDisplay : 120) / 60;
    jogAngle += (0.008 + energy * 0.02 + kick * 0.03) * (0.7 + spin * 0.15);
    jogPulse *= 0.9;
    const breath = 1 + ambientGlow * 0.06 + jogPulse * 0.12;

    const wash = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, minDim * 0.7);
    wash.addColorStop(0, rgbaOf(CYAN, 0.05 + kick * 0.12));
    wash.addColorStop(0.6, rgbaOf(ORANGE, 0.04 + energy * 0.06));
    wash.addColorStop(1, "rgba(0,0,0,0)");
    ctx2d.fillStyle = wash;
    ctx2d.fillRect(0, 0, w, h);

    // Radial spectrum bars
    const r0 = baseR * breath;
    const maxLen = minDim * 0.3;
    const barW = Math.max(2 * dpr, ((Math.PI * 2 * r0) / BAR_COUNT) * 0.62);
    for (let i = 0; i < BAR_COUNT; i++) {
      const a = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
      const level = Math.min(1, smoothed[i] * (1 + kick * 0.4));
      const len = Math.max(2 * dpr, level * maxLen);
      const [r, g, b] = lerpColor(CYAN, ORANGE, i / (BAR_COUNT - 1));
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      ctx2d.beginPath();
      ctx2d.moveTo(cx + cos * r0, cy + sin * r0);
      ctx2d.lineTo(cx + cos * (r0 + len), cy + sin * (r0 + len));
      ctx2d.strokeStyle = `rgba(${r},${g},${b},${0.25 + level * 0.75})`;
      ctx2d.lineWidth = barW;
      ctx2d.lineCap = "round";
      ctx2d.stroke();
    }

    // Beat rings expanding outward
    const maxR = minDim * 0.62;
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      const age = (now - p.t0) / PULSE_LIFE_MS;
      if (age >= 1) continue;
      const ease = 1 - Math.pow(1 - age, 2.2);
      const alpha = (1 - age) * (0.5 + p.strength * 0.5);
      const [r, g, b] = lerpColor(CYAN, ORANGE, p.hueMix);
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, r0 + ease * (maxR - r0), 0, Math.PI * 2);
      ctx2d.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx2d.lineWidth = Math.max(2 * dpr, (8 - age * 6) * dpr);
      ctx2d.stroke();
    }

    // 808 shockwave ring
    for (let i = booms.length - 1; i >= 0; i--) {
      const k = booms[i];
      const age = (now - k.t0) / BOOM_LIFE_MS;
      if (age >= 1) continue;
      const expand = 1 - Math.pow(1 - Math.min(1, age * 1.15), 1.6);
      const alpha = (1 - age) * (0.6 + k.strength * 0.4);
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, r0 + expand * (maxR - r0) * 1.05, 0, Math.PI * 2);
      ctx2d.strokeStyle = `rgba(${BOOM[0]},${BOOM[1]},${BOOM[2]},${alpha})`;
      ctx2d.lineWidth = Math.max(4 * dpr, (20 - age * 12) * dpr);
      ctx2d.stroke();
    }

    // Central jog platter
    const pr = r0 * 0.82;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx2d.strokeStyle = rgbaOf(CYAN, 0.25 + jogPulse * 0.45 + kick * 0.2);
    ctx2d.lineWidth = Math.max(2 * dpr, (3 + jogPulse * 4) * dpr);
    ctx2d.stroke();
    ctx2d.save();
    ctx2d.translate(cx, cy);
    ctx2d.rotate(jogAngle);
    const ticks = 24;
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2;
      const major = i % 6 === 0;
      ctx2d.beginPath();
      ctx2d.moveTo(Math.cos(a) * pr * 0.88, Math.sin(a) * pr * 0.88);
      ctx2d.lineTo(Math.cos(a) * pr * 1.04, Math.sin(a) * pr * 1.04);
      ctx2d.strokeStyle = major ? rgbaOf(CYAN, 0.4 + jogPulse * 0.4) : rgbaOf(ORANGE, 0.22 + energy * 0.25);
      ctx2d.lineWidth = (major ? 2 : 1.2) * dpr;
      ctx2d.stroke();
    }
    ctx2d.restore();
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, pr * 0.14, 0, Math.PI * 2);
    ctx2d.fillStyle = rgbaOf(ORANGE, 0.4 + jogPulse * 0.4);
    ctx2d.fill();
  }

  // Scope: big phosphor oscilloscope trace of the live mic signal.
  function drawScopeMode(w, h, now, kick, energy) {
    if (!timeData) return;
    const midY = h * 0.44;
    const amp = Math.min(1, 0.25 + energy * 1.6 + kick * 0.9);

    ctx2d.strokeStyle = "rgba(120,140,160,0.10)";
    ctx2d.lineWidth = 1;
    for (let gy = 0.2; gy < 0.9; gy += 0.175) {
      ctx2d.beginPath();
      ctx2d.moveTo(0, h * gy);
      ctx2d.lineTo(w, h * gy);
      ctx2d.stroke();
    }
    ctx2d.beginPath();
    ctx2d.moveTo(0, midY);
    ctx2d.lineTo(w, midY);
    ctx2d.strokeStyle = rgbaOf(CYAN, 0.25);
    ctx2d.stroke();

    const n = timeData.length;
    const glow = 0.55 + kick * 0.45;
    const passes = [
      { width: 7 * dpr, alpha: 0.22 * glow },
      { width: 2.2 * dpr, alpha: 0.95 * glow },
    ];
    for (const pass of passes) {
      ctx2d.beginPath();
      for (let x = 0; x <= w; x += 2 * dpr) {
        const idx = Math.floor((x / w) * (n - 1));
        const v = (timeData[idx] - 128) / 128;
        const y = midY + v * amp * h * 0.32;
        if (x === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
      }
      ctx2d.strokeStyle = `rgba(${CYAN[0]},${CYAN[1]},${CYAN[2]},${Math.min(1, pass.alpha)})`;
      ctx2d.lineWidth = pass.width;
      ctx2d.lineJoin = "round";
      ctx2d.stroke();
    }

    if (kick > 0.12) {
      ctx2d.fillStyle = rgbaOf(ORANGE, Math.min(0.8, kick));
      const tickW = w * 0.02;
      ctx2d.fillRect(w * 0.5 - tickW / 2, h * 0.86, tickW, h * 0.05);
    }
  }

  // Nebula: additive particle bursts fired from center on kick/energy.
  function drawNebulaMode(w, h, now, kick, bass, energy) {
    const cx = w * 0.5;
    const cy = h * 0.44;

    const spawnN = Math.min(14, Math.round(kick * 9 + energy * 3));
    for (let s = 0; s < spawnN; s++) {
      if (nebulaParts.length >= NEBULA_MAX) nebulaParts.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = (0.6 + Math.random() * 2.4) * dpr * (0.7 + kick * 1.6);
      nebulaParts.push({
        x: cx + (Math.random() - 0.5) * 8 * dpr,
        y: cy + (Math.random() - 0.5) * 8 * dpr,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        maxLife: 50 + Math.random() * 70,
        size: (1 + Math.random() * 2.6) * dpr,
        heat: Math.min(1, kick * 1.2 + Math.random() * 0.35),
      });
    }

    ctx2d.save();
    ctx2d.globalCompositeOperation = "lighter";
    for (let i = nebulaParts.length - 1; i >= 0; i--) {
      const p = nebulaParts[i];
      p.life++;
      if (p.life >= p.maxLife) {
        nebulaParts.splice(i, 1);
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.985;
      p.vy *= 0.985;
      const t = p.life / p.maxLife;
      const alpha = (1 - t) * 0.75;
      const [r, g, b] = lerpColor(CYAN, ORANGE, Math.min(1, p.heat * (1 - t * 0.4)));
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, Math.max(0.5, p.size * (1 - t * 0.5)), 0, Math.PI * 2);
      ctx2d.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx2d.fill();
    }
    ctx2d.restore();

    if (kick > 0.03) {
      const cr = 90 * dpr;
      const core = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, cr);
      core.addColorStop(0, rgbaOf(BOOM_CORE, 0.5 * kick));
      core.addColorStop(1, "rgba(0,0,0,0)");
      ctx2d.fillStyle = core;
      ctx2d.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
    }
  }

  // Strobe: beat-reactive light panel grid, each panel on its own phase.
  function drawStrobeMode(w, h, now, kick, bass, energy) {
    const pad = 10 * dpr;
    const gap = 8 * dpr;
    const top = h * 0.06;
    const gw = w - pad * 2;
    const gh = h * 0.78 - pad;
    const cw = (gw - gap * (STROBE_COLS - 1)) / STROBE_COLS;
    const ch = (gh - gap * (STROBE_ROWS - 1)) / STROBE_ROWS;

    for (let r = 0; r < STROBE_ROWS; r++) {
      for (let c = 0; c < STROBE_COLS; c++) {
        const i = r * STROBE_COLS + c;
        const drive = Math.min(1, kick * (0.75 + strobePhase[i] * 0.5) + energy * 0.55 + bass * 0.3);
        strobeVals[i] = Math.max(strobeVals[i] * 0.86, drive);
        const v = Math.min(1, strobeVals[i]);
        if (v < 0.02) continue;
        const x = pad + c * (cw + gap);
        const y = top + r * (ch + gap);
        const mix = (c / (STROBE_COLS - 1)) * 0.7 + (r / (STROBE_ROWS - 1)) * 0.3;
        const [cr, cg, cb] = lerpColor(CYAN, ORANGE, mix);
        ctx2d.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(0.88, v) * 0.9})`;
        roundRectPath(x, y, cw, ch, 8 * dpr);
        ctx2d.fill();
        if (v > 0.55) {
          ctx2d.fillStyle = `rgba(255,255,255,${Math.min(0.75, (v - 0.55) * 1.1)})`;
          roundRectPath(x + cw * 0.28, y + ch * 0.28, cw * 0.44, ch * 0.44, 5 * dpr);
          ctx2d.fill();
        }
      }
    }
  }

  // Thin spectrum bar footer (classic mode only; the wave stays dominant).
  function drawSpectrumFooter(w, h, padX, padY, barW, gap, kick) {
    const usable = h - padY * 2;
    const punch = 1 + kick * 0.35 + ambientGlow * 0.2;
    const specUsable = usable * 0.08;
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
    // Primary visual band — dominant Serato stack
    const panelTop = h * 0.09;
    const panelH = h * 0.74;
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

    // Lighthouse sweep: over the black well, under every wave layer
    drawLighthouse(w, h, playX, panelTop + panelH * 0.5, performance.now());

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

    // Grid / bar lines across all tiers, mirrored about the playhead
    const barPx = Math.max(18 * dpr, innerW * 0.07);
    ctx2d.font = `${Math.max(8, 9 * dpr)}px -apple-system, sans-serif`;
    ctx2d.textAlign = "center";
    ctx2d.strokeStyle = "rgba(80,90,100,0.28)";
    ctx2d.lineWidth = 1 * dpr;
    ctx2d.beginPath();
    for (let gx = playX; gx >= padX; gx -= barPx) {
      ctx2d.moveTo(gx, panelTop);
      ctx2d.lineTo(gx, panelBot);
      const rx = playX * 2 - gx;
      if (rx > playX) {
        ctx2d.moveTo(rx, panelTop);
        ctx2d.lineTo(rx, panelBot);
      }
    }
    ctx2d.stroke();

    // Draw history columns mirrored about the playhead: newest at the center,
    // older samples spreading outward both left and right. Colors are computed
    // once per column and reused for both halves.
    const mirX = playX * 2;
    const fr2 = (rx, ry, rw, rh) => {
      ctx2d.fillRect(rx, ry, rw, rh);
      ctx2d.fillRect(mirX - rx - rw, ry, rw, rh);
    };
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
      fr2(x, midTop - lowHalf, cw, lowHalf * 2);
      // Mid layer — spectral overlay
      const midHalf = half * (0.4 + s.mid * 0.55);
      ctx2d.fillStyle = `rgba(${Math.max(0, cr - 30)},${Math.min(255, cg + 50)},${Math.min(255, cb)},0.9)`;
      fr2(x + cw * 0.12, midTop - midHalf, Math.max(1, cw * 0.76), midHalf * 2);
      // High tips
      const htip = currentTheme.highTip;
      const hiHalf = half * (0.4 + s.high * 0.7);
      const tipH = Math.max(2 * dpr, hiHalf * 0.28);
      ctx2d.fillStyle = `rgba(${Math.min(255, htip.r0 + s.high * htip.rS)},${Math.min(255, htip.g0 + s.high * htip.gS)},${Math.min(255, htip.b0 + s.high * htip.bS)},1)`;
      fr2(x, midTop - hiHalf, Math.max(1, cw * 0.7), tipH);
      fr2(x, midTop + hiHalf - tipH, Math.max(1, cw * 0.7), tipH);
      if (s.high > 0.35) {
        const he = currentTheme.highEdge;
        ctx2d.fillStyle = rgbaOf(he, 0.4 + s.high * 0.5);
        fr2(x, midTop - hiHalf - 1 * dpr, Math.max(1, cw * 0.45), 2 * dpr);
        fr2(x, midTop + hiHalf - 1 * dpr, Math.max(1, cw * 0.45), 2 * dpr);
      }

      // --- Mid tier: transient ribbon ---
      const mr = currentTheme.midRibbon;
      const onsetH = Math.max(2 * dpr, s.onset * midH * 0.98);
      ctx2d.fillStyle = `rgba(${Math.min(255, mr.r0 + s.onset * mr.rS)},${Math.min(255, mr.g0 + s.onset * mr.gS)},${mr.b},${0.45 + s.onset * 0.55})`;
      fr2(x, midY + midH - onsetH, Math.max(1, cw * 0.9), onsetH);
      if (s.onset > 0.4) {
        ctx2d.fillStyle = `rgba(255,255,255,${s.onset})`;
        fr2(x, midY + 1, Math.max(1, cw * 0.75), 2.5 * dpr);
      }

      // --- Bottom tier: overview ---
      const ov = currentTheme.overview;
      const midBot = botY + botH * 0.5;
      const botHalf = Math.max(2 * dpr, s.amp * botH * 0.58);
      const br = Math.min(255, ov.br0 + s.bass * ov.brBass + s.amp * ov.brAmp);
      const bg = Math.min(255, ov.bg0 + s.mid * ov.bgMid + s.amp * ov.bgAmp);
      const bb = Math.min(255, ov.bb0 + s.high * ov.bbHigh + s.amp * ov.bbAmp);
      ctx2d.fillStyle = `rgba(${br},${bg},${bb},0.95)`;
      fr2(x, midBot - botHalf, cw, botHalf * 2);
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
      const label = String(((barNum - k - 1 + 64) % 16) + 1);
      ctx2d.fillText(label, gx, botY + 10 * dpr);
      if (k > 0) ctx2d.fillText(label, playX * 2 - gx, botY + 10 * dpr); // mirrored right side
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
    tickBeatCounterSoft(now);

    // Lighto 2.0: route the canvas visual through the active mode.
    // Analysis (kick/bass/energy/beat/meters) above stays identical.
    const vm = currentMode();
    if (vm === "orbit") {
      drawOrbitMode(w, h, now, kick, bass, energy);
    } else if (vm === "scope") {
      drawScopeMode(w, h, now, kick, energy);
    } else if (vm === "nebula") {
      drawNebulaMode(w, h, now, kick, bass, energy);
    } else if (vm === "strobe") {
      drawStrobeMode(w, h, now, kick, bass, energy);
    } else {
      // Classic: the original full CDJ view.
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

      // Spectrum bars along the bottom (thin footer; wave stays dominant)
      drawSpectrumFooter(w, h, padX, padY, barW, gap, kick);
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
    // Serato green/yellow/red L/R readouts live in DOM outside CH1/CH2 (see .serato-meter)

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
      lhPulses.length = 0;
      lhRays.length = 0;
      pulseFlash = 0;
      boomFlash = 0;
      ambientGlow = 0;
      statusTick = 0;
      jogAngle = 0;
      jogPulse = 0;
      initBeatCounter();
      resetBpm();
      anchorSecDots();

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
    lhPulses.length = 0;
    lhRays.length = 0;
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
    updateSeratoStack(seratoLedsL, 0, 0);
    updateSeratoStack(seratoLedsR, 0, 0);
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

  if (els.modeBtn) {
    els.modeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      cycleMode();
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
      navigator.serviceWorker.register("./sw.js?v=16", { updateViaCache: "none" }).catch(() => {});
    });
  }

  buildThemeChips();
  restoreTheme();
  restoreMode();
  initMeters();
  initBeatCounter();
  softResetBeatCounter();
  initSecDots();
  cancelAnimationFrame(secRaf);
  secRaf = requestAnimationFrame(tickSecDots);
  resize();
  drawIdle();
  setBpmText("--.-");
})();
