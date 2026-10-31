(() => {
  "use strict";

  const THEME_KEY = "lighto-theme";
  const MODE_KEY = "lighto-mode";
  const SCALE_KEY = "lighto-scale";
  const SCALE_DEFAULT = 1.3;
  // v20: Wave mode controls
  const WAVE_H_KEY = "lighto-wave-h";
  const WAVE_W_KEY = "lighto-wave-w";
  const WAVE_HUE_KEY = "lighto-wave-hue";
  const WAVE_H_DEFAULT = 1.0; // amplitude multiplier (0.4 - 2.0)
  const WAVE_W_DEFAULT = 3; // column thickness in CSS px (1 - 10)
  const WAVE_HUE_DEFAULT = 0; // palette hue rotation in degrees (0 - 360)
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
    modesBtn: document.getElementById("modesBtn"),
    modeMenu: document.getElementById("modeMenu"),
    modeToast: document.getElementById("modeToast"),
    themeSheet: document.getElementById("themeSheet"),
    themeChips: document.getElementById("themeChips"),
    bassPick: document.getElementById("bassPick"),
    midPick: document.getElementById("midPick"),
    highPick: document.getElementById("highPick"),
    sensitivity: document.getElementById("sensitivity"),
    scaleCtl: document.getElementById("scaleCtl"),
    scaleVal: document.getElementById("scaleVal"),
    waveHCtl: document.getElementById("waveHCtl"),
    waveHVal: document.getElementById("waveHVal"),
    waveWCtl: document.getElementById("waveWCtl"),
    waveWVal: document.getElementById("waveWVal"),
    waveHueCtl: document.getElementById("waveHueCtl"),
    waveHueVal: document.getElementById("waveHueVal"),
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
  const THEMES = window.LIGHTO_THEMES;

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

  // ---- Custom waveform colors: Bass / Mid / High pickers drive the
  // "Custom" theme's spectral palette live, persisted to localStorage. ----
  const CUSTOM_KEY = "lighto-custom-colors";
  const customDefault = { bass: "#ff3c14", mid: "#14ff9c", high: "#4da6ff" };

  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return [255, 255, 255];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function syncCustomChipSwatch(map) {
    const sw = els.themeChips && els.themeChips.querySelector('[data-theme="custom"] .theme-swatch');
    if (!sw) return;
    const bars = sw.querySelectorAll("i");
    [map.bass, map.mid, map.high].forEach((hex, k) => {
      if (bars[k]) bars[k].style.background = hex;
    });
  }

  function applyCustomColors(map, persist) {
    const t = THEMES.custom;
    const b = hexToRgb(map.bass), m = hexToRgb(map.mid), hh = hexToRgb(map.high);
    t.spectral.bass = b;
    t.spectral.mid = m;
    t.spectral.high = hh;
    t.spectral.highAdd = hh.map((v) => Math.round(v * 0.28));
    t.spectral.midAdd = m.map((v) => Math.round(v * 0.22));
    t.swatches = [map.bass, map.mid, map.high];
    if (persist !== false) {
      try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(map)); } catch (_) {}
    }
    syncCustomChipSwatch(map);
    if (currentTheme.id === "custom") applyTheme("custom", true);
  }

  function restoreCustomColors() {
    let map = { ...customDefault };
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "null");
      if (saved && saved.bass && saved.mid && saved.high) map = saved;
    } catch (_) {}
    if (els.bassPick) els.bassPick.value = map.bass;
    if (els.midPick) els.midPick.value = map.mid;
    if (els.highPick) els.highPick.value = map.high;
    applyCustomColors(map, false);
  }

  function initCustomPickers() {
    const read = () => ({
      bass: els.bassPick.value,
      mid: els.midPick.value,
      high: els.highPick.value,
    });
    ["bassPick", "midPick", "highPick"].forEach((id) => {
      if (els[id]) els[id].addEventListener("input", () => {
        applyCustomColors(read(), true);
        // Jump to Custom so the new colors show immediately
        if (currentTheme.id !== "custom") applyTheme("custom", true);
      });
    });
  }

  // ---- Visual modes (Lighto 2.0): switchable canvas visualizers ----
  // classic = the original full CDJ view; the rest are alternate takes
  // that reuse the same beat/kick/energy analysis + DOM chrome.
  const MODES = [
    { id: "classic", name: "Classic" },
    { id: "wave", name: "Wave" },
    { id: "djay", name: "Djay" },
    { id: "orbit", name: "Orbit" },
    { id: "scope", name: "Scope" },
    { id: "nebula", name: "Nebula" },
    { id: "strobe", name: "Strobe" },
    { id: "nodes", name: "Nodes" },
    { id: "sonar", name: "Sonar" },
    { id: "evolve", name: "Evolve" },
    { id: "vertical", name: "Vertical" },
    { id: "stems", name: "Stems" },
    { id: "decks", name: "Decks" },
    { id: "scratchglitch", name: "Scratch Glitch" },
    { id: "scratchplatter", name: "Scratch Platter" },
    { id: "vhs", name: "VHS Glitch" },
    { id: "split", name: "Split Screen" },
    { id: "lighttrails", name: "Light Trails" },
    { id: "skratchbastid", name: "Skratch Bastid" },
    { id: "blackhole", name: "Black Hole" },
    { id: "warp", name: "Warp" },
    { id: "hyperspace", name: "Hyperspace" },
    { id: "pulsar", name: "Pulsar" },
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
    try { syncPulsarChips(); } catch (_) {}
    if (persist !== false) {
      try {
        localStorage.setItem(MODE_KEY, MODES[modeIndex].id);
      } catch (_) {}
    }
  }

  function cycleMode(step) {
    modeIndex = (modeIndex + (step || 1) + MODES.length) % MODES.length;
    setMode(MODES[modeIndex].id, true);
    showModeToast();
  }

  // v24: mode menu (grid of every mode)
  let modeMenuOpen = false;
  function buildModeMenu() {
    if (!els.modeMenu) return;
    els.modeMenu.innerHTML = "";
    MODES.forEach((m, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "mode-item"; b.textContent = m.name; b.dataset.mode = m.id;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        setMode(m.id, true); showModeToast(); setModeMenu(false);
      });
      els.modeMenu.appendChild(b);
    });
  }
  function setModeMenu(open) {
    if (!els.modeMenu) return;
    modeMenuOpen = !!open;
    els.modeMenu.hidden = !modeMenuOpen;
    if (els.modesBtn) els.modesBtn.setAttribute("aria-expanded", String(modeMenuOpen));
    if (modeMenuOpen) {
      els.modeMenu.querySelectorAll(".mode-item").forEach((b) => b.classList.toggle("active", b.dataset.mode === MODES[modeIndex].id));
      const a = els.modeMenu.querySelector(".active"); if (a && a.scrollIntoView) a.scrollIntoView({ block: "nearest" });
    }
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
  // v20 Wave mode: long history so thin columns can fill a full-screen band
  const WV_COLS = 1400;
  const wvAmp = new Float32Array(WV_COLS);
  const wvBass = new Float32Array(WV_COLS);
  const wvMid = new Float32Array(WV_COLS);
  const wvHigh = new Float32Array(WV_COLS);
  const wvOnset = new Float32Array(WV_COLS);
  const wvKick = new Float32Array(WV_COLS);
  const wvT = new Float64Array(WV_COLS);
  let wvWrite = 0;
  let wvFilled = 0;
  let wvFlash = 0;

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

  // ---- v19: user Scale (drives Nodes size/intensity, gently Sonar ring size) ----
  let userScale = SCALE_DEFAULT;
  function setUserScale(v, persist) {
    const n = Math.min(2, Math.max(0.5, parseFloat(v)));
    userScale = isFinite(n) ? n : SCALE_DEFAULT;
    if (els.scaleCtl && parseFloat(els.scaleCtl.value) !== userScale) els.scaleCtl.value = String(userScale);
    if (els.scaleVal) els.scaleVal.textContent = userScale.toFixed(2);
    if (persist) {
      try { localStorage.setItem(SCALE_KEY, String(userScale)); } catch (_) {}
    }
  }
  function restoreUserScale() {
    let v = SCALE_DEFAULT;
    try {
      const saved = parseFloat(localStorage.getItem(SCALE_KEY));
      if (isFinite(saved)) v = saved;
    } catch (_) {}
    setUserScale(v, false);
  }
  // Hotter Serato color: push saturation away from luma, then gain.
  function punchColor(c, gain) {
    const l = (c[0] + c[1] + c[2]) / 3;
    const sat = 1.35;
    return [
      Math.max(0, Math.min(255, Math.round((l + (c[0] - l) * sat) * gain))),
      Math.max(0, Math.min(255, Math.round((l + (c[1] - l) * sat) * gain))),
      Math.max(0, Math.min(255, Math.round((l + (c[2] - l) * sat) * gain))),
    ];
  }

  // ---- Lighto v17: Nodes + Sonar modes ----
  const NODE_RING_LIFE = 1700;
  const NODE_MAX_RINGS = 10;
  const SONAR_RING_LIFE = 2800;
  const SONAR_MAX_RINGS = 12;
  const SNAP_N = 48;
  const nodeRings = []; // { t0, side: 0|1, strength, snap, boom }
  const sonarRings = []; // { t0, strength, snap, boom }
  const sonarBlips = []; // { t0, a, r, col, size }
  let nodesSeenPulse = 0;
  let nodesSeenBoom = 0;
  let sonarSeenPulse = 0;
  let sonarSeenBoom = 0;
  let sonarSweep = 0;
  let nodeGlowL = 0;
  let nodeGlowR = 0;

  // Serato-style color for a position t (0 = low, 1 = high) along the spectrum.
  function bandColorAt(t, amp) {
    const b = Math.max(0, 1 - t * 2);
    const m = Math.max(0, 1 - Math.abs(t - 0.5) * 2);
    const hi = Math.max(0, t * 2 - 1);
    return spectralColor(b + 0.15, m, hi, amp);
  }

  // Sample a slice [lo, hi) of the smoothed spectrum into SNAP_N points.
  function spectrumSnap(lo, hi) {
    const out = new Float32Array(SNAP_N);
    const a = Math.floor(lo * BAR_COUNT);
    const span = Math.max(1, Math.floor(hi * BAR_COUNT) - a);
    for (let i = 0; i < SNAP_N; i++) {
      const idx = Math.min(BAR_COUNT - 1, a + Math.floor((i / SNAP_N) * span));
      out[i] = smoothed[idx];
    }
    return out;
  }

  function bandLevels() {
    const third = Math.floor(BAR_COUNT / 3);
    let lo = 0, md = 0, hi = 0;
    for (let i = 0; i < BAR_COUNT; i++) {
      if (i < third) lo += smoothed[i];
      else if (i < third * 2) md += smoothed[i];
      else hi += smoothed[i];
    }
    return [lo / third, md / third, hi / Math.max(1, BAR_COUNT - third * 2)];
  }

  // Newest-unseen pulse/boom since last check (returns strength or 0).
  function newestSince(list, seen) {
    let best = null;
    for (let i = 0; i < list.length; i++) if (list[i].t0 > seen && (!best || list[i].t0 > best.t0)) best = list[i];
    return best;
  }

  // Closed spectral blob: radius modulated by a snapshot, mirrored so it's seamless.
  function traceSpectralRing(cx, cy, r, snap, depth, sx, sy, rot) {
    const steps = SNAP_N * 2;
    ctx2d.beginPath();
    for (let i = 0; i <= steps; i++) {
      const k = i % steps;
      const si = k < SNAP_N ? k : steps - 1 - k;
      const a = (k / steps) * Math.PI * 2 + rot;
      const rr = r + snap[si] * depth;
      const x = cx + Math.cos(a) * rr * sx;
      const y = cy + Math.sin(a) * rr * sy;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.closePath();
  }

  // Nodes (v19 "harder"): two big wave nodes, left = CH1 / bass, right = CH2 / mid-high.
  // userScale (0.5-2) drives size + intensity; kick/808 add squash-bounce.
  let nodeBounceL = 0;
  let nodeBounceR = 0;
  function drawNodesMode(w, h, now, kick, bass, energy) {
    const [lo, md, hi] = bandLevels();
    const S = userScale;
    const I = 0.55 + S * 0.45; // intensity multiplier (1.0 at scale 1, ~1.14 at 1.3)
    const cy = h * 0.45;
    const nodes = [
      { cx: w * 0.27, lvl: Math.min(1, (meterCh1 * 0.6 + lo * 0.7 + kick * 0.65) * I), lo: 0, hi: 0.45, rot: Math.PI },
      { cx: w * 0.73, lvl: Math.min(1, (meterCh2 * 0.6 + (md + hi) * 0.5 + energy * 0.35 + kick * 0.25) * I), lo: 0.35, hi: 1, rot: 0 },
    ];
    nodeGlowL = Math.max(nodeGlowL * 0.88, nodes[0].lvl);
    nodeGlowR = Math.max(nodeGlowR * 0.88, nodes[1].lvl);
    // Kick bounce: fast attack, springy decay. 808 booms slam harder (set below).
    nodeBounceL = Math.max(nodeBounceL * 0.86, kick * kick * 0.9 + bass * 0.2);
    nodeBounceR = Math.max(nodeBounceR * 0.86, kick * kick * 0.55 + energy * 0.15);
    // Bigger default body (was min(w*.16,h*.2)); scale grows it, capped so dual nodes never fully merge.
    const baseR = Math.min(w * 0.205, h * 0.27) * Math.min(1.45, 0.62 + S * 0.38);
    const sy = Math.min(1.25, Math.max(0.85, (h * 0.5) / (w * 0.5)));
    const maxR = Math.max(w * 0.55, h * 0.55) * (0.85 + S * 0.15);

    // Spawn rings: both nodes ring on a beat, the hotter side rings stronger.
    const p = newestSince(pulses, nodesSeenPulse);
    if (p) {
      nodesSeenPulse = p.t0;
      for (let s = 0; s < 2; s++) {
        const n = nodes[s];
        const bias = s === 0 ? 0.75 + lo * 0.7 : 0.65 + (md + hi) * 0.6;
        nodeRings.push({ t0: now, side: s, strength: Math.min(1.25, (p.strength * bias + n.lvl * 0.4) * I), snap: spectrumSnap(n.lo, n.hi), boom: false });
      }
      nodeBounceL = Math.max(nodeBounceL, 0.55 * p.strength);
      nodeBounceR = Math.max(nodeBounceR, 0.4 * p.strength);
    }
    const b = newestSince(booms, nodesSeenBoom);
    if (b) {
      nodesSeenBoom = b.t0;
      nodeRings.push({ t0: now, side: 0, strength: 1.3, snap: spectrumSnap(0, 0.45), boom: true });
      nodeRings.push({ t0: now, side: 1, strength: 1.05, snap: spectrumSnap(0.35, 1), boom: true });
      nodeBounceL = 1.15;
      nodeBounceR = 0.9;
    }
    while (nodeRings.length > NODE_MAX_RINGS * 2) nodeRings.shift();
    const bounces = [nodeBounceL, nodeBounceR];
    const bAmp = 0.22 * I; // how far a full kick swells the body

    // Ambient wash behind each node + link glow between them (hotter)
    const glows = [nodeGlowL, nodeGlowR];
    for (let s = 0; s < 2; s++) {
      const n = nodes[s];
      const col = s === 0 ? CYAN : ORANGE;
      const wr = baseR * (3.2 + bounces[s] * 0.8);
      const g = ctx2d.createRadialGradient(n.cx, cy, 0, n.cx, cy, wr);
      g.addColorStop(0, rgbaOf(col, Math.min(0.6, (0.14 + glows[s] * 0.3 + bounces[s] * 0.12) * I)));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx2d.fillStyle = g;
      ctx2d.fillRect(n.cx - wr, cy - wr, wr * 2, wr * 2);
    }
    const link = ctx2d.createLinearGradient(nodes[0].cx, 0, nodes[1].cx, 0);
    link.addColorStop(0, rgbaOf(CYAN, 0.2 + nodeGlowL * 0.45));
    link.addColorStop(0.5, `rgba(255,255,255,${0.08 + kick * 0.4})`);
    link.addColorStop(1, rgbaOf(ORANGE, 0.2 + nodeGlowR * 0.45));
    ctx2d.fillStyle = link;
    const lh = Math.max(2 * dpr, (3 + energy * 12 + kick * 8) * S * dpr);
    ctx2d.fillRect(nodes[0].cx, cy - lh / 2, nodes[1].cx - nodes[0].cx, lh);
    // center playhead
    ctx2d.fillStyle = `rgba(255,255,255,${0.35 + kick * 0.6})`;
    ctx2d.fillRect(w * 0.5 - 1 * dpr, cy - baseR * 1.4, 2 * dpr, baseR * 2.8);

    ctx2d.save();
    ctx2d.globalCompositeOperation = "lighter";

    // Expanding spectral wave rings from each node (thicker, brighter, punchier color)
    for (let i = nodeRings.length - 1; i >= 0; i--) {
      const ring = nodeRings[i];
      const life = ring.boom ? NODE_RING_LIFE * 1.25 : NODE_RING_LIFE;
      const age = (now - ring.t0) / life;
      if (age >= 1) { nodeRings.splice(i, 1); continue; }
      const n = nodes[ring.side];
      const ease = 1 - Math.pow(1 - age, 2.6);
      const r = baseR + ease * (maxR - baseR);
      const depth = baseR * (0.6 + ring.strength * 1.1) * (1 - age * 0.45);
      const alpha = Math.min(1, (1 - age) * (0.45 + ring.strength * 0.6));
      const segs = SNAP_N;
      const lw = Math.max(2.5 * dpr, (ring.boom ? 26 : 15) * (0.75 + S * 0.25) * (1 - age * 0.65) * dpr);
      const flashAge = age < 0.12 ? 1 - age / 0.12 : 0; // white-hot leading edge on birth
      for (let k = 0; k < segs; k++) {
        const t = ring.side === 0 ? (k / segs) * 0.45 : 0.35 + (k / segs) * 0.65;
        const v = ring.snap[k];
        const base = ring.boom ? BOOM : bandColorAt(t, v + 0.45);
        const [cr, cg, cb] = punchColor(base, 1.1 + v * 0.35 + flashAge * 0.3);
        ctx2d.strokeStyle = `rgba(${cr},${cg},${cb},${Math.min(1, alpha * (0.55 + v * 0.6))})`;
        ctx2d.lineWidth = lw * (0.55 + v * 1.1);
        for (const dir of [1, -1]) {
          const a0 = n.rot + dir * (k / segs) * Math.PI;
          const a1 = n.rot + dir * ((k + 1) / segs) * Math.PI;
          const rr = r + v * depth;
          ctx2d.beginPath();
          ctx2d.ellipse(n.cx, cy, rr, rr * sy, 0, Math.min(a0, a1), Math.max(a0, a1));
          ctx2d.stroke();
        }
      }
      // thin bright core line riding each ring for a sharper "hit"
      ctx2d.beginPath();
      ctx2d.ellipse(n.cx, cy, r, r * sy, 0, 0, Math.PI * 2);
      ctx2d.strokeStyle = ring.boom ? rgbaOf(BOOM, alpha * 0.7) : `rgba(255,255,255,${alpha * (0.18 + flashAge * 0.5)})`;
      ctx2d.lineWidth = Math.max(1.5, (ring.boom ? 4 : 2) * dpr);
      ctx2d.stroke();
    }

    // Live node bodies: spectral blob + time-domain wave ring, with kick squash-bounce
    for (let s = 0; s < 2; s++) {
      const n = nodes[s];
      const bo = bounces[s];
      const snap = spectrumSnap(n.lo, n.hi);
      const swell = 1 + bo * bAmp;
      const r0 = baseR * (0.86 + n.lvl * 0.42) * swell;
      const bsy = sy * (1 - bo * 0.07); // slight vertical squash on the hit
      const rot = n.rot - Math.PI / 2;
      traceSpectralRing(n.cx, cy, r0 * 0.75, snap, baseR * (1.0 + bo * 0.35) * I, 1 + bo * 0.04, bsy, rot);
      const fill = ctx2d.createRadialGradient(n.cx, cy, 0, n.cx, cy, r0 * 1.6);
      const cA = punchColor(bandColorAt(s === 0 ? 0.1 : 0.85, 1), 1.2);
      const cB = punchColor(bandColorAt(s === 0 ? 0.35 : 0.55, 0.85), 1.1);
      fill.addColorStop(0, `rgba(255,255,255,${Math.min(0.85, 0.22 + n.lvl * 0.35 + bo * 0.25)})`);
      fill.addColorStop(0.35, `rgba(${cA[0]},${cA[1]},${cA[2]},${Math.min(0.95, 0.45 + n.lvl * 0.45)})`);
      fill.addColorStop(1, `rgba(${cB[0]},${cB[1]},${cB[2]},0.14)`);
      ctx2d.fillStyle = fill;
      ctx2d.fill();
      ctx2d.strokeStyle = rgbaOf(s === 0 ? CYAN : ORANGE, Math.min(1, 0.6 + n.lvl * 0.5));
      ctx2d.lineWidth = (2.5 + bo * 2) * dpr;
      ctx2d.stroke();

      // oscilloscope ring from that channel's time data (thicker, double-stroked glow)
      const td = stereoMode && timeL && timeR ? (s === 0 ? timeL : timeR) : timeData;
      if (td) {
        const steps = 96;
        const rr = r0 * 1.25;
        ctx2d.beginPath();
        for (let i = 0; i <= steps; i++) {
          const k = i % steps;
          const idx = Math.floor((k / steps) * (td.length - 1));
          const v = (td[idx] - 128) / 128;
          const a = (k / steps) * Math.PI * 2;
          const rad = rr + v * baseR * (0.8 + n.lvl * 1.8 + bo * 0.6) * I;
          const x = n.cx + Math.cos(a) * rad;
          const y = cy + Math.sin(a) * rad * bsy;
          if (i === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
        }
        ctx2d.closePath();
        const oc = s === 0 ? CYAN : ORANGE;
        ctx2d.strokeStyle = rgbaOf(oc, Math.min(0.5, 0.12 + n.lvl * 0.3));
        ctx2d.lineWidth = Math.max(4, (7 + bo * 6) * dpr);
        ctx2d.stroke();
        ctx2d.strokeStyle = rgbaOf(oc, Math.min(1, 0.5 + n.lvl * 0.5));
        ctx2d.lineWidth = Math.max(2, (3 + bo * 2) * dpr);
        ctx2d.stroke();
      }

      // core (pops on kick)
      ctx2d.beginPath();
      ctx2d.arc(n.cx, cy, baseR * (0.13 + n.lvl * 0.12 + bo * 0.08), 0, Math.PI * 2);
      ctx2d.fillStyle = `rgba(255,255,255,${Math.min(1, 0.5 + n.lvl * 0.5)})`;
      ctx2d.fill();
    }
    ctx2d.restore();
  }

  // Sonar: top-down PPI with beat pings, spectral arcs, sweep wedge, blips.
  function drawSonarMode(w, h, now, kick, bass, energy) {
    const cx = w * 0.5;
    const cy = h * 0.46;
    const minDim = Math.min(w, h);
    const sonarS = 0.8 + userScale * 0.2; // gentle: 0.9 .. 1.2
    const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) * 0.92 * sonarS;
    const gridR = minDim * 0.48 * Math.min(1.08, sonarS);

    // Spawn pings
    const p = newestSince(pulses, sonarSeenPulse);
    if (p) {
      sonarSeenPulse = p.t0;
      sonarRings.push({ t0: now, strength: p.strength, snap: spectrumSnap(0, 1), boom: false });
      const nb = 2 + Math.round(p.strength * 3);
      for (let i = 0; i < nb; i++) {
        const t = Math.random();
        sonarBlips.push({
          t0: now,
          a: Math.random() * Math.PI * 2,
          r: gridR * (0.2 + Math.random() * 0.8),
          col: bandColorAt(t, 0.9),
          size: (2 + Math.random() * 3 + p.strength * 3) * dpr,
        });
      }
      while (sonarBlips.length > 40) sonarBlips.shift();
    }
    const b = newestSince(booms, sonarSeenBoom);
    if (b) {
      sonarSeenBoom = b.t0;
      sonarRings.push({ t0: now, strength: 1, snap: spectrumSnap(0, 1), boom: true });
    }
    while (sonarRings.length > SONAR_MAX_RINGS) sonarRings.shift();

    // Dark well
    const well = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    well.addColorStop(0, rgbaOf(CYAN, 0.08 + kick * 0.1));
    well.addColorStop(0.55, "rgba(4,10,14,0.25)");
    well.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx2d.fillStyle = well;
    ctx2d.fillRect(0, 0, w, h);

    // Static grid: range rings + crosshair + bearing ticks
    ctx2d.strokeStyle = rgbaOf(CYAN, 0.14);
    ctx2d.lineWidth = 1 * dpr;
    for (let i = 1; i <= 4; i++) {
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, (gridR * i) / 4, 0, Math.PI * 2);
      ctx2d.stroke();
    }
    ctx2d.beginPath();
    ctx2d.moveTo(cx - gridR, cy); ctx2d.lineTo(cx + gridR, cy);
    ctx2d.moveTo(cx, cy - gridR); ctx2d.lineTo(cx, cy + gridR);
    ctx2d.stroke();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const t0 = i % 3 === 0 ? 0.94 : 0.97;
      ctx2d.beginPath();
      ctx2d.moveTo(cx + Math.cos(a) * gridR * t0, cy + Math.sin(a) * gridR * t0);
      ctx2d.lineTo(cx + Math.cos(a) * gridR, cy + Math.sin(a) * gridR);
      ctx2d.stroke();
    }

    // Rotating sweep wedge (sonar brush)
    const spin = (bpmConfident ? bpmDisplay : 120) / 60;
    sonarSweep += (0.012 + energy * 0.01) * (0.6 + spin * 0.2);
    const wedge = 0.9;
    const wSteps = 18;
    for (let i = 0; i < wSteps; i++) {
      const a1 = sonarSweep - (i / wSteps) * wedge;
      const a0 = sonarSweep - ((i + 1) / wSteps) * wedge;
      ctx2d.beginPath();
      ctx2d.moveTo(cx, cy);
      ctx2d.arc(cx, cy, gridR, a0, a1);
      ctx2d.closePath();
      ctx2d.fillStyle = rgbaOf(CYAN, (1 - i / wSteps) * (0.07 + energy * 0.08));
      ctx2d.fill();
    }
    ctx2d.beginPath();
    ctx2d.moveTo(cx, cy);
    ctx2d.lineTo(cx + Math.cos(sonarSweep) * gridR, cy + Math.sin(sonarSweep) * gridR);
    ctx2d.strokeStyle = rgbaOf(CYAN, 0.55 + kick * 0.4);
    ctx2d.lineWidth = 2 * dpr;
    ctx2d.stroke();

    ctx2d.save();
    ctx2d.globalCompositeOperation = "lighter";

    // Ping rings with spectral arcs + rays
    const segs = SNAP_N;
    for (let i = sonarRings.length - 1; i >= 0; i--) {
      const ring = sonarRings[i];
      const life = ring.boom ? SONAR_RING_LIFE * 1.1 : SONAR_RING_LIFE;
      const age = (now - ring.t0) / life;
      if (age >= 1) { sonarRings.splice(i, 1); continue; }
      const ease = 1 - Math.pow(1 - age, 1.8);
      const r = minDim * 0.04 + ease * maxR;
      const fade = Math.pow(1 - age, 1.3);
      const alpha = fade * (0.4 + ring.strength * 0.6);
      // thin base ring
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, r, 0, Math.PI * 2);
      ctx2d.strokeStyle = ring.boom ? rgbaOf(BOOM, alpha * 0.9) : rgbaOf(CYAN, alpha * 0.45);
      ctx2d.lineWidth = Math.max(1.5, (ring.boom ? 10 : 2.5) * (1 - age * 0.6) * dpr);
      ctx2d.stroke();
      // spectral arcs (spectrum wraps around the ring, mirrored L/R)
      const lw = Math.max(1.5, 6 * sonarS * (1 - age * 0.7) * dpr);
      for (let k = 0; k < segs; k++) {
        const v = ring.snap[k];
        if (v < 0.06) continue;
        const t = k / segs;
        const [cr, cg, cb] = bandColorAt(t, v + 0.25);
        const span = (Math.PI / segs) * 0.8;
        for (const dir of [1, -1]) {
          const ac = -Math.PI / 2 + dir * (t * Math.PI + span / 2);
          ctx2d.beginPath();
          ctx2d.arc(cx, cy, r, ac - span / 2, ac + span / 2);
          ctx2d.strokeStyle = `rgba(${cr},${cg},${cb},${alpha * (0.4 + v * 0.6)})`;
          ctx2d.lineWidth = lw * (0.6 + v * 1.2);
          ctx2d.stroke();
          // outward ray on hot bins
          if (v > 0.35) {
            const len = v * minDim * 0.09 * (1 - age * 0.5);
            ctx2d.beginPath();
            ctx2d.moveTo(cx + Math.cos(ac) * r, cy + Math.sin(ac) * r);
            ctx2d.lineTo(cx + Math.cos(ac) * (r + len), cy + Math.sin(ac) * (r + len));
            ctx2d.strokeStyle = `rgba(${cr},${cg},${cb},${alpha * v * 0.8})`;
            ctx2d.lineWidth = Math.max(1, 2 * dpr);
            ctx2d.stroke();
          }
        }
      }
    }

    // Contacts: blips glow brightest as the sweep passes them
    for (let i = sonarBlips.length - 1; i >= 0; i--) {
      const bl = sonarBlips[i];
      const age = (now - bl.t0) / 4000;
      if (age >= 1) { sonarBlips.splice(i, 1); continue; }
      let d = (sonarSweep - bl.a) % (Math.PI * 2);
      if (d < 0) d += Math.PI * 2;
      const lit = Math.max(0, 1 - d / 1.6);
      const a = (1 - age) * (0.25 + lit * 0.75);
      const x = cx + Math.cos(bl.a) * bl.r;
      const y = cy + Math.sin(bl.a) * bl.r;
      const g = ctx2d.createRadialGradient(x, y, 0, x, y, bl.size * 3);
      g.addColorStop(0, `rgba(${bl.col[0]},${bl.col[1]},${bl.col[2]},${a})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx2d.fillStyle = g;
      ctx2d.fillRect(x - bl.size * 3, y - bl.size * 3, bl.size * 6, bl.size * 6);
    }

    // Live center transducer: small spectral rosette
    const live = spectrumSnap(0, 1);
    traceSpectralRing(cx, cy, minDim * 0.035, live, minDim * 0.06, 1, 1, -Math.PI / 2);
    ctx2d.fillStyle = rgbaOf(ORANGE, 0.25 + energy * 0.4);
    ctx2d.fill();
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, minDim * (0.012 + kick * 0.012), 0, Math.PI * 2);
    ctx2d.fillStyle = `rgba(255,255,255,${0.6 + kick * 0.4})`;
    ctx2d.fill();
    ctx2d.restore();
  }

  // ---- Lighto v18: Evolve mode ----
  // "What they just struck... what the fuck... they just shrug."
  // Nested polygon strata that strain inward between beats (tension), snap
  // taut on every beat ("struck"), glitch-stutter on loud mid/high spikes,
  // then droop in a soft shrug. Consecutive kicks grow new layers; silence
  // collapses the outer half.
  const EVO_MAX_LAYERS = 9;
  const evoLayers = []; // { born, sides, rot, spin, disp, vel, t, dying }
  let evoSeenPulse = 0;
  let evoSeenBoom = 0;
  let evoLastPulse = 0;
  let evoStreak = 0;
  let evoTension = 0;
  let evoSnap = 0;
  let evoShrug = 0;
  let evoCollapsed = true;
  let evoMhAvg = 0;
  let evoGlitchUntil = 0;
  let evoGlitchAmt = 0;
  let evoGlitchSeed = 0;
  let evoGlitchStep = 0;
  let evoLastNow = 0;

  function evoAddLayer(now) {
    const n = evoLayers.filter((l) => !l.dying).length;
    if (n >= EVO_MAX_LAYERS) return;
    evoLayers.push({
      born: now,
      sides: 3 + (n % 5),
      rot: Math.random() * Math.PI * 2,
      spin: (n % 2 ? -1 : 1) * (0.0012 + n * 0.0004),
      disp: 0.6,
      vel: 0,
      t: n / (EVO_MAX_LAYERS - 1),
      dying: 0,
      fade: 0,
      fall: 0,
    });
  }

  function drawEvolveMode(w, h, now, kick, bass, energy) {
    const [lo, md, hi] = bandLevels();
    const dt = Math.min(0.05, Math.max(0.001, (now - (evoLastNow || now - 16)) / 1000));
    evoLastNow = now;
    const f60 = dt * 60;
    const cx = w * 0.5;
    const cy = h * 0.45;
    const minDim = Math.min(w, h);
    const unit = minDim * 0.05;

    // --- events: struck (beats) ---
    const p = newestSince(pulses, evoSeenPulse);
    if (p) {
      evoSeenPulse = p.t0;
      evoStreak = now - evoLastPulse < 1150 ? evoStreak + 1 : 1;
      evoLastPulse = now;
      evoCollapsed = false;
      evoSnap = Math.max(evoSnap, 0.55 + p.strength * 0.45);
      evoShrug = Math.max(evoShrug, 0.25 + p.strength * 0.15);
      const live = evoLayers.filter((l) => !l.dying).length;
      const target = Math.min(EVO_MAX_LAYERS, 1 + Math.floor(evoStreak / 2));
      if (live < target) evoAddLayer(now);
      for (const l of evoLayers) l.vel += (0.9 + p.strength * 1.4) * (0.6 + l.t * 0.8);
    }
    const b = newestSince(booms, evoSeenBoom);
    if (b) {
      evoSeenBoom = b.t0;
      evoLastPulse = now;
      evoCollapsed = false;
      evoSnap = 1;
      evoShrug = Math.max(evoShrug, 0.5);
      evoAddLayer(now);
      for (const l of evoLayers) l.vel += 2.6;
    }
    if (!evoLayers.length) evoAddLayer(now);

    // --- tension builds with the streak, bleeds off otherwise ---
    const tensionTarget = Math.min(1, evoStreak / 14 + energy * 0.35);
    evoTension += (tensionTarget - evoTension) * Math.min(1, 0.03 * f60);

    // --- silence: partial collapse + big shrug ---
    if (!evoCollapsed && now - evoLastPulse > 1700 && energy < 0.14) {
      evoCollapsed = true;
      const live = evoLayers.filter((l) => !l.dying);
      const drop = Math.ceil(live.length / 2);
      for (let i = live.length - drop; i < live.length; i++) if (i > 0) live[i].dying = now;
      evoStreak = Math.floor(evoStreak / 3);
      evoShrug = 1;
    }

    // --- "what the fuck": glitch stutter on loud mid/high spikes ---
    const mh = md * 0.55 + hi * 0.45;
    evoMhAvg += (mh - evoMhAvg) * Math.min(1, 0.04 * f60);
    if (mh > 0.32 && mh > evoMhAvg * 1.3 + 0.03 && now > evoGlitchUntil - 60) {
      evoGlitchUntil = now + 160 + Math.random() * 180;
      evoGlitchAmt = Math.min(1, 0.5 + (mh - evoMhAvg) * 3);
    }
    const glitching = now < evoGlitchUntil;
    if (!glitching) evoGlitchAmt *= Math.pow(0.8, f60);
    const step = Math.floor(now / 55); // stutter quantum
    if (step !== evoGlitchStep) { evoGlitchStep = step; evoGlitchSeed = Math.random() * 1000; }

    evoSnap *= Math.pow(0.84, f60);
    evoShrug *= Math.pow(0.972, f60);

    // --- background: tension field (vertical strain lines) ---
    const bg = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
    bg.addColorStop(0, rgbaOf(ORANGE, 0.03 + evoTension * 0.08 + evoSnap * 0.1));
    bg.addColorStop(0.6, rgbaOf(CYAN, 0.02 + evoTension * 0.04));
    bg.addColorStop(1, "rgba(0,0,0,0.3)");
    ctx2d.fillStyle = bg;
    ctx2d.fillRect(0, 0, w, h);

    const droop = evoShrug * unit * 1.6; // whole structure sinks on the shrug
    const ccy = cy + droop;

    ctx2d.save();
    ctx2d.globalCompositeOperation = "lighter";

    // strain lines: pulled toward center as tension rises, straighten on snap
    const lines = 14;
    for (let i = 0; i < lines; i++) {
      const x = (w * (i + 0.5)) / lines;
      const pull = (cx - x) * evoTension * 0.18 * (1 - evoSnap);
      ctx2d.beginPath();
      ctx2d.moveTo(x, 0);
      ctx2d.quadraticCurveTo(x + pull, ccy + evoShrug * unit * 2, x, h);
      const t = i / (lines - 1);
      const [cr, cg, cb] = bandColorAt(t, 0.5);
      ctx2d.strokeStyle = `rgba(${cr},${cg},${cb},${0.03 + evoTension * 0.07 + evoSnap * 0.12})`;
      ctx2d.lineWidth = Math.max(1, dpr);
      ctx2d.stroke();
    }

    // --- strata ---
    for (let i = evoLayers.length - 1; i >= 0; i--) {
      const l = evoLayers[i];
      // damped spring: snaps out, settles back
      const acc = -38 * l.disp - 7.5 * l.vel;
      l.vel += acc * dt;
      l.disp += l.vel * dt;
      l.rot += l.spin * f60 * (1 + evoTension * 2.5) * (1 - evoShrug * 0.6);
      let fade = Math.min(1, (now - l.born) / 500);
      let fall = 0;
      if (l.dying) {
        const da = (now - l.dying) / 1300;
        if (da >= 1) { evoLayers.splice(i, 1); continue; }
        fade *= 1 - da;
        fall = da * da * h * 0.25;
      }
      l.fade = fade;
      l.fall = fall;
    }

    const live = evoLayers.length;
    const layerPts = [];
    for (let i = 0; i < live; i++) {
      const l = evoLayers[i];
      const fade = l.fade;
      const fall = l.fall;
      const slot = i + 1;
      const r = unit * (1.2 + slot * 1.05) * (1 + l.disp * 0.12) * (1 + bass * 0.08);
      const strain = evoTension * (1 - evoSnap) * 0.32; // edges bow inward
      const yC = ccy + fall + evoShrug * unit * 0.4 * slot * 0.3;
      const verts = [];
      for (let k = 0; k < l.sides; k++) {
        const a = l.rot + (k / l.sides) * Math.PI * 2 - Math.PI / 2;
        // shrug: sides lift ("shoulders") while the bottom sags
        const sh = evoShrug * unit * 0.5 * (-Math.abs(Math.cos(a)) + Math.max(0, Math.sin(a)));
        verts.push([cx + Math.cos(a) * r, yC + Math.sin(a) * r * 0.92 + sh]);
      }
      layerPts.push({ verts, yC, fade, l });

      const [cr, cg, cb] = bandColorAt(l.t, 0.6 + evoTension * 0.4);
      const jit = glitching ? evoGlitchAmt * unit * 0.25 : 0;
      const passes = glitching ? [[-jit, CYAN], [jit, ORANGE]] : [[0, null]];
      for (const [ox, gc] of passes) {
        ctx2d.beginPath();
        for (let k = 0; k <= l.sides; k++) {
          const v = verts[k % l.sides];
          if (k === 0) { ctx2d.moveTo(v[0] + ox, v[1]); continue; }
          const pv = verts[k - 1];
          const mx = (pv[0] + v[0]) / 2;
          const my = (pv[1] + v[1]) / 2;
          const qx = mx + (cx - mx) * strain;
          const qy = my + (yC - my) * strain + evoShrug * unit * 0.6;
          ctx2d.quadraticCurveTo(qx + ox, qy, v[0] + ox, v[1]);
        }
        const a = fade * (0.35 + evoTension * 0.35 + evoSnap * 0.3);
        ctx2d.strokeStyle = gc ? rgbaOf(gc, a * 0.8) : `rgba(${cr},${cg},${cb},${a})`;
        ctx2d.lineWidth = Math.max(1.5, (1.5 + evoSnap * 4 + evoTension * 2) * dpr * (0.7 + l.t * 0.5));
        ctx2d.stroke();
      }
      // vertex knots, white-hot on the strike
      for (const v of verts) {
        const s = (2 + evoSnap * 5 + evoTension * 2) * dpr;
        ctx2d.fillStyle = `rgba(255,255,255,${fade * (0.25 + evoSnap * 0.7)})`;
        ctx2d.fillRect(v[0] - s / 2, v[1] - s / 2, s, s);
      }
    }

    // tendons between adjacent strata: taut with tension, slack on shrug
    for (let i = 1; i < layerPts.length; i++) {
      const A = layerPts[i - 1];
      const B = layerPts[i];
      const fade = Math.min(A.fade, B.fade);
      for (let k = 0; k < B.verts.length; k++) {
        const vb = B.verts[k];
        const va = A.verts[k % A.verts.length];
        const sag = evoShrug * unit * 1.2 + (1 - evoTension) * unit * 0.4;
        ctx2d.beginPath();
        ctx2d.moveTo(va[0], va[1]);
        ctx2d.quadraticCurveTo((va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2 + sag, vb[0], vb[1]);
        ctx2d.strokeStyle = evoSnap > 0.4
          ? `rgba(255,255,255,${fade * evoSnap * 0.5})`
          : rgbaOf(ORANGE, fade * (0.06 + evoTension * 0.22));
        ctx2d.lineWidth = Math.max(1, dpr);
        ctx2d.stroke();
      }
    }

    // core: a vertical slit that opens on the strike
    const coreH = unit * (0.6 + evoSnap * 2.2 + kick * 0.8);
    const coreW = unit * (0.12 + evoTension * 0.25);
    const cg = ctx2d.createLinearGradient(cx, ccy - coreH, cx, ccy + coreH);
    cg.addColorStop(0, "rgba(0,0,0,0)");
    cg.addColorStop(0.5, `rgba(255,255,255,${0.35 + evoSnap * 0.6})`);
    cg.addColorStop(1, "rgba(0,0,0,0)");
    ctx2d.fillStyle = cg;
    ctx2d.beginPath();
    ctx2d.moveTo(cx, ccy - coreH);
    ctx2d.lineTo(cx + coreW, ccy);
    ctx2d.lineTo(cx, ccy + coreH);
    ctx2d.lineTo(cx - coreW, ccy);
    ctx2d.closePath();
    ctx2d.fill();

    // shrug horizon: shoulders lift at the edges, then settle
    const hy = h * 0.82;
    const lift = evoShrug * h * 0.12;
    ctx2d.beginPath();
    const hs = 60;
    for (let i = 0; i <= hs; i++) {
      const t = i / hs;
      const x = t * w;
      const e = Math.pow(Math.abs(t - 0.5) * 2, 2.2);
      const y = hy - e * lift + Math.sin(t * Math.PI) * evoShrug * unit * 0.5;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    const hg = ctx2d.createLinearGradient(0, 0, w, 0);
    hg.addColorStop(0, rgbaOf(CYAN, 0.15 + evoShrug * 0.5));
    hg.addColorStop(0.5, `rgba(255,255,255,${0.08 + evoSnap * 0.3})`);
    hg.addColorStop(1, rgbaOf(ORANGE, 0.15 + evoShrug * 0.5));
    ctx2d.strokeStyle = hg;
    ctx2d.lineWidth = Math.max(1.5, 2 * dpr);
    ctx2d.stroke();

    // streak tally (layers earned) along the horizon
    const marks = Math.min(16, evoStreak);
    for (let i = 0; i < marks; i++) {
      const x = cx + (i - (marks - 1) / 2) * unit * 0.45;
      const [cr, cg2, cb] = bandColorAt(i / 15, 0.8);
      ctx2d.fillStyle = `rgba(${cr},${cg2},${cb},${0.35 + evoTension * 0.5})`;
      ctx2d.fillRect(x - 1 * dpr, hy + unit * 0.35, 2 * dpr, unit * (0.25 + (i / 16) * 0.5));
    }
    ctx2d.restore();

    // --- glitch stutter: displaced horizontal slices + chroma blocks ---
    if (evoGlitchAmt > 0.04) {
      let seed = evoGlitchSeed;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      const n = 3 + Math.floor(evoGlitchAmt * 7);
      for (let i = 0; i < n; i++) {
        const sy = Math.floor(rnd() * h);
        const sh = Math.max(2, Math.floor((0.01 + rnd() * 0.06) * h));
        const dx = Math.round((rnd() - 0.5) * w * 0.12 * evoGlitchAmt);
        if (sy + sh > h) continue;
        ctx2d.drawImage(els.canvas, 0, sy, w, sh, dx, sy, w, sh);
        if (rnd() < 0.5) {
          ctx2d.fillStyle = rgbaOf(rnd() < 0.5 ? CYAN : ORANGE, 0.12 * evoGlitchAmt);
          ctx2d.fillRect(rnd() * w, sy, w * (0.05 + rnd() * 0.25), sh);
        }
      }
    }
  }

  // ---- v20: Wave controls (Height / Width / Hue) ----
  let waveHeight = WAVE_H_DEFAULT;
  let waveWidth = WAVE_W_DEFAULT;
  let waveHue = WAVE_HUE_DEFAULT;
  let classicHGain = 1; // gentle Height carry-over into Classic's wave panel
  let hueM = null; // 3x3 hue-rotate matrix (null = identity)

  function clampNum(v, lo, hi, def) {
    const n = parseFloat(v);
    return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
  }
  function setWaveHeight(v, persist) {
    waveHeight = clampNum(v, 0.4, 2, WAVE_H_DEFAULT);
    classicHGain = 0.8 + waveHeight * 0.2; // 0.88 .. 1.2
    if (els.waveHCtl && parseFloat(els.waveHCtl.value) !== waveHeight) els.waveHCtl.value = String(waveHeight);
    if (els.waveHVal) els.waveHVal.textContent = waveHeight.toFixed(2);
    if (persist) { try { localStorage.setItem(WAVE_H_KEY, String(waveHeight)); } catch (_) {} }
  }
  function setWaveWidth(v, persist) {
    waveWidth = clampNum(v, 1, 10, WAVE_W_DEFAULT);
    if (els.waveWCtl && parseFloat(els.waveWCtl.value) !== waveWidth) els.waveWCtl.value = String(waveWidth);
    if (els.waveWVal) els.waveWVal.textContent = waveWidth.toFixed(1);
    if (persist) { try { localStorage.setItem(WAVE_W_KEY, String(waveWidth)); } catch (_) {} }
  }
  function setWaveHue(v, persist) {
    waveHue = Math.round(clampNum(v, 0, 360, WAVE_HUE_DEFAULT)) % 360;
    if (waveHue === 0) {
      hueM = null;
    } else {
      // Same matrix as CSS filter: hue-rotate()
      const a = (waveHue * Math.PI) / 180;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      hueM = [
        0.213 + c * 0.787 - sn * 0.213, 0.715 - c * 0.715 - sn * 0.715, 0.072 - c * 0.072 + sn * 0.928,
        0.213 - c * 0.213 + sn * 0.143, 0.715 + c * 0.285 + sn * 0.140, 0.072 - c * 0.072 - sn * 0.283,
        0.213 - c * 0.213 - sn * 0.787, 0.715 - c * 0.715 + sn * 0.715, 0.072 + c * 0.928 + sn * 0.072,
      ];
    }
    if (els.waveHueCtl && Math.round(parseFloat(els.waveHueCtl.value)) % 360 !== waveHue) els.waveHueCtl.value = String(waveHue);
    if (els.waveHueVal) els.waveHueVal.textContent = waveHue + "\u00b0";
    if (persist) { try { localStorage.setItem(WAVE_HUE_KEY, String(waveHue)); } catch (_) {} }
  }
  function restoreWaveCtls() {
    let hv = WAVE_H_DEFAULT, wv = WAVE_W_DEFAULT, uv = WAVE_HUE_DEFAULT;
    try {
      const a = parseFloat(localStorage.getItem(WAVE_H_KEY));
      const b = parseFloat(localStorage.getItem(WAVE_W_KEY));
      const c = parseFloat(localStorage.getItem(WAVE_HUE_KEY));
      if (isFinite(a)) hv = a;
      if (isFinite(b)) wv = b;
      if (isFinite(c)) uv = c;
    } catch (_) {}
    setWaveHeight(hv, false);
    setWaveWidth(wv, false);
    setWaveHue(uv, false);
  }
  // rgba() string with the user's hue rotation applied
  function hueRgba(r, g, b, a) {
    if (hueM) {
      const m = hueM;
      const nr = m[0] * r + m[1] * g + m[2] * b;
      const ng = m[3] * r + m[4] * g + m[5] * b;
      const nb = m[6] * r + m[7] * g + m[8] * b;
      r = nr; g = ng; b = nb;
    }
    r = r < 0 ? 0 : r > 255 ? 255 : r | 0;
    g = g < 0 ? 0 : g > 255 ? 255 : g | 0;
    b = b < 0 ? 0 : b > 255 ? 255 : b | 0;
    return `rgba(${r},${g},${b},${a})`;
  }

  // ---- v20: Wave mode — full-screen Classic Serato spectral waveform ----
  // Same 3-tier Serato stack as Classic's panel (spectral main wave / transient
  // ribbon / overview), but it IS the screen: edge-to-edge, taller, user Height,
  // Width (px per column = scroll density) and Hue. No jog/booms/footer.
  function drawWaveMode(w, h, now, kick) {
    ctx2d.fillStyle = "#020304";
    ctx2d.fillRect(0, 0, w, h);

    const p = newestSince(pulses, wvSeenPulse);
    if (p) { wvSeenPulse = p.t0; wvFlash = Math.max(wvFlash, Math.min(1, 0.5 + (p.strength || 0.5) * 0.5)); }
    const bm = newestSince(booms, wvSeenBoom);
    if (bm) { wvSeenBoom = bm.t0; wvFlash = 1; }
    wvFlash *= 0.9;

    const top = h * 0.05;
    const bot = h * 0.95;
    const panelH = bot - top;
    const padX = w * 0.015;
    const innerW = w - padX * 2;
    const playX = padX + innerW * 0.5;
    const mirX = playX * 2;

    const mainH = panelH * 0.7;
    const ribH = panelH * 0.07;
    const ovH = panelH * 0.23;
    const mainY = top;
    const ribY = mainY + mainH;
    const ovY = ribY + ribH;
    const midMain = mainY + mainH * 0.5;
    const midOv = ovY + ovH * 0.5;
    const H = waveHeight;

    // Beat grid
    const barPx = Math.max(24 * dpr, innerW * 0.06);
    ctx2d.strokeStyle = `rgba(90,100,112,${0.22 + wvFlash * 0.25})`;
    ctx2d.lineWidth = 1 * dpr;
    ctx2d.beginPath();
    for (let gx = playX; gx >= padX; gx -= barPx) {
      ctx2d.moveTo(gx, top); ctx2d.lineTo(gx, bot);
      const rx = mirX - gx;
      if (rx > playX) { ctx2d.moveTo(rx, top); ctx2d.lineTo(rx, bot); }
    }
    ctx2d.stroke();

    const colPx = Math.max(1, waveWidth * dpr);
    const gap = colPx >= 3 * dpr ? Math.max(0.5, colPx * 0.12) : 0; // crisp column separation when thick
    const cw = Math.max(1, colPx - gap);
    const maxCols = Math.min(wvFilled, Math.ceil((innerW * 0.5) / colPx) + 1);
    const fr2 = (rx, ry, rw, rh) => {
      ctx2d.fillRect(rx, ry, rw, rh);
      ctx2d.fillRect(mirX - rx - rw, ry, rw, rh);
    };
    const bbod = currentTheme.bassBody;
    const htip = currentTheme.highTip;
    const he = currentTheme.highEdge;
    const mr = currentTheme.midRibbon;
    const ov = currentTheme.overview;

    for (let i = 0; i < maxCols; i++) {
      const idx = (wvWrite - 1 - i + WV_COLS * 2) % WV_COLS;
      const amp = wvAmp[idx], sb = wvBass[idx], sm = wvMid[idx], sh = wvHigh[idx], so = wvOnset[idx];
      const x = playX - (i + 1) * colPx;
      if (x < padX - colPx) break;
      const fresh = i < 3 ? wvFlash * 0.35 : 0;

      // Main tier: bass body / spectral mid / high tips (Serato stack)
      const half = Math.min(mainH * 0.5, Math.max(1.5 * dpr, amp * mainH * 0.46 * H));
      const lowHalf = half * (0.5 + sb * 0.55);
      ctx2d.fillStyle = hueRgba(bbod.r0 + sb * bbod.rS, bbod.g0 + sb * bbod.gBass + sm * bbod.gMid, bbod.b, 0.95);
      fr2(x, midMain - lowHalf, cw, lowHalf * 2);

      const [cr, cg, cb] = spectralColor(sb, sm, sh, amp);
      const midHalf = Math.min(mainH * 0.5, half * (0.4 + sm * 0.6));
      ctx2d.fillStyle = hueRgba(cr - 30, cg + 50, cb, 0.9);
      fr2(x + cw * 0.12, midMain - midHalf, Math.max(1, cw * 0.76), midHalf * 2);

      const hiHalf = Math.min(mainH * 0.5, half * (0.4 + sh * 0.75));
      const tipH = Math.max(1.5 * dpr, hiHalf * 0.26);
      ctx2d.fillStyle = hueRgba(htip.r0 + sh * htip.rS + fresh * 255, htip.g0 + sh * htip.gS + fresh * 255, htip.b0 + sh * htip.bS + fresh * 255, 1);
      fr2(x, midMain - hiHalf, Math.max(1, cw * 0.8), tipH);
      fr2(x, midMain + hiHalf - tipH, Math.max(1, cw * 0.8), tipH);
      if (sh > 0.35) {
        ctx2d.fillStyle = hueRgba(he[0], he[1], he[2], 0.4 + sh * 0.5);
        fr2(x, midMain - hiHalf - 1 * dpr, Math.max(1, cw * 0.5), 2 * dpr);
        fr2(x, midMain + hiHalf - 1 * dpr, Math.max(1, cw * 0.5), 2 * dpr);
      }

      // Transient ribbon
      const oh = Math.max(1.5 * dpr, Math.min(1, so * Math.sqrt(H)) * ribH * 0.95);
      ctx2d.fillStyle = hueRgba(mr.r0 + so * mr.rS, mr.g0 + so * mr.gS, mr.b, 0.45 + so * 0.55);
      fr2(x, ribY + ribH - oh, Math.max(1, cw * 0.9), oh);

      // Overview tier
      const oHalf = Math.min(ovH * 0.48, Math.max(1.5 * dpr, amp * ovH * 0.46 * H));
      ctx2d.fillStyle = hueRgba(
        ov.br0 + sb * ov.brBass + amp * ov.brAmp,
        ov.bg0 + sm * ov.bgMid + amp * ov.bgAmp,
        ov.bb0 + sh * ov.bbHigh + amp * ov.bbAmp,
        0.95
      );
      fr2(x, midOv - oHalf, cw, oHalf * 2);
    }

    // Centerlines + tier separators
    ctx2d.strokeStyle = hueRgba(0, 200, 220, 0.14);
    ctx2d.lineWidth = 1 * dpr;
    ctx2d.beginPath();
    ctx2d.moveTo(padX, midMain); ctx2d.lineTo(padX + innerW, midMain);
    ctx2d.moveTo(padX, midOv); ctx2d.lineTo(padX + innerW, midOv);
    ctx2d.stroke();
    ctx2d.strokeStyle = "rgba(50,60,70,0.75)";
    ctx2d.beginPath();
    ctx2d.moveTo(padX, ribY); ctx2d.lineTo(padX + innerW, ribY);
    ctx2d.moveTo(padX, ovY); ctx2d.lineTo(padX + innerW, ovY);
    ctx2d.stroke();

    // Bar numbers on overview tier
    ctx2d.font = `${Math.max(8, 9 * dpr)}px -apple-system, sans-serif`;
    ctx2d.textAlign = "center";
    ctx2d.fillStyle = "rgba(220,230,240,0.7)";
    for (let gx = playX, k = 0; gx >= padX && k < 10; gx -= barPx, k++) {
      const label = String(((waveBarCounter - k - 1 + 64) % 16) + 1);
      ctx2d.fillText(label, gx, ovY + 10 * dpr);
      if (k > 0) ctx2d.fillText(label, mirX - gx, ovY + 10 * dpr);
    }

    // Playhead (flares on beats)
    ctx2d.strokeStyle = `rgba(255,255,255,${0.85 + wvFlash * 0.15})`;
    ctx2d.lineWidth = (2 + wvFlash * 2) * dpr;
    ctx2d.shadowColor = "rgba(255,255,255,0.7)";
    ctx2d.shadowBlur = (6 + wvFlash * 14) * dpr;
    ctx2d.beginPath();
    ctx2d.moveTo(playX, top); ctx2d.lineTo(playX, bot);
    ctx2d.stroke();
    ctx2d.shadowBlur = 0;
    ctx2d.fillStyle = "#fff";
    ctx2d.beginPath();
    ctx2d.moveTo(playX, top); ctx2d.lineTo(playX - 4 * dpr, top + 6 * dpr); ctx2d.lineTo(playX + 4 * dpr, top + 6 * dpr);
    ctx2d.closePath(); ctx2d.fill();
    ctx2d.beginPath();
    ctx2d.moveTo(playX, bot); ctx2d.lineTo(playX - 4 * dpr, bot - 6 * dpr); ctx2d.lineTo(playX + 4 * dpr, bot - 6 * dpr);
    ctx2d.closePath(); ctx2d.fill();
  }

  // ---- Djay mode: dual-deck stacked RGB waveforms, djay Pro style ----
  // Two horizontal scrolling waveform strips (Deck A top, Deck B bottom),
  // frequency-colored like djay/Serato RGB waveforms, center playheads,
  // beat grid + bar numbers. Deck B trails Deck A by a few bars so the
  // pair reads as two decks riding the same live input.
  function drawDjayMode(w, h, now, kick, bass, energy) {
    ctx2d.fillStyle = "#07090d";
    ctx2d.fillRect(0, 0, w, h);

    const padX = w * 0.02;
    const innerW = w - padX * 2;
    const stripGap = Math.max(8 * dpr, h * 0.045);
    const stripH = (h - stripGap) / 2;
    const playX = padX + innerW * 0.5;
    const H = waveHeight;
    const colPx = Math.max(2 * dpr, waveWidth * dpr);
    const cw = Math.max(1 * dpr, colPx * 0.84);
    const flash = Math.min(1, kick * 1.25);
    const barPx = Math.max(30 * dpr, innerW * 0.055);

    const strips = [
      { y: 0, label: "A", delay: 0 },
      { y: stripH + stripGap, label: "B", delay: 200 },
    ];

    for (const s of strips) {
      const top = s.y;
      const midY = top + stripH * 0.5;
      const maxHalf = stripH * 0.40;

      // Strip backdrop tint (deck B a touch dimmer)
      ctx2d.fillStyle = s.delay ? "rgba(10,13,18,0.55)" : "rgba(12,15,21,0.55)";
      ctx2d.fillRect(padX, top + 2 * dpr, innerW, stripH - 4 * dpr);

      // Beat grid
      ctx2d.strokeStyle = `rgba(110,120,135,${0.20 + flash * 0.18})`;
      ctx2d.lineWidth = 1 * dpr;
      ctx2d.beginPath();
      for (let gx = playX; gx >= padX - barPx; gx -= barPx) {
        ctx2d.moveTo(gx, top + 4 * dpr); ctx2d.lineTo(gx, top + stripH - 4 * dpr);
        const rx = playX + (playX - gx);
        if (rx <= padX + innerW + barPx) { ctx2d.moveTo(rx, top + 4 * dpr); ctx2d.lineTo(rx, top + stripH - 4 * dpr); }
      }
      ctx2d.stroke();

      // Waveform columns, newest at playhead scrolling left
      const avail = Math.max(0, wvFilled - s.delay);
      const maxCols = Math.min(avail, Math.ceil((innerW * 0.5) / colPx) + 2);
      for (let i = 0; i < maxCols; i++) {
        const idx = (wvWrite - 1 - i - s.delay + WV_COLS * 4) % WV_COLS;
        const amp = wvAmp[idx], sb = wvBass[idx], sm = wvMid[idx], sh = wvHigh[idx];
        const x = playX - (i + 1) * colPx;
        if (x < padX - colPx) break;
        const half = Math.min(maxHalf, Math.max(1.2 * dpr, amp * maxHalf * 0.94 * H));
        const [cr, cg, cb] = spectralColor(sb, sm, sh, amp);
        // djay-style body: vivid spectral fill
        ctx2d.fillStyle = hueRgba(cr, cg, cb, s.delay ? 0.82 : 0.95);
        ctx2d.fillRect(x, midY - half, cw, half * 2);
        // Sheen: lighter top edge like djay's 3D waveform look
        const sheen = Math.max(1 * dpr, cw * 0.9);
        ctx2d.fillStyle = hueRgba(Math.min(255, cr + 70), Math.min(255, cg + 70), Math.min(255, cb + 70), 0.75);
        ctx2d.fillRect(x, midY - half, sheen, Math.max(1 * dpr, half * 0.16));
      }

      // Centerline
      ctx2d.strokeStyle = "rgba(140,150,165,0.16)";
      ctx2d.lineWidth = 1 * dpr;
      ctx2d.beginPath();
      ctx2d.moveTo(padX, midY); ctx2d.lineTo(padX + innerW, midY);
      ctx2d.stroke();

      // Playhead (flares with kick)
      ctx2d.strokeStyle = `rgba(255,255,255,${0.8 + flash * 0.2})`;
      ctx2d.lineWidth = (1.6 + flash * 2.2) * dpr;
      ctx2d.shadowColor = "rgba(120,200,255,0.8)";
      ctx2d.shadowBlur = (4 + flash * 16) * dpr;
      ctx2d.beginPath();
      ctx2d.moveTo(playX, top + 3 * dpr); ctx2d.lineTo(playX, top + stripH - 3 * dpr);
      ctx2d.stroke();
      ctx2d.shadowBlur = 0;

      // Deck badge
      const bs = Math.max(14 * dpr, stripH * 0.20);
      ctx2d.font = `700 ${bs}px -apple-system, sans-serif`;
      ctx2d.textAlign = "left";
      ctx2d.fillStyle = s.delay ? "rgba(150,170,195,0.5)" : "rgba(170,200,235,0.75)";
      ctx2d.fillText(s.label, padX + 6 * dpr, top + bs + 6 * dpr);

      // Bar numbers (djay-style 1..16 cycling)
      ctx2d.font = `${Math.max(8, 8.5 * dpr)}px -apple-system, sans-serif`;
      ctx2d.textAlign = "center";
      ctx2d.fillStyle = "rgba(200,212,228,0.55)";
      for (let gx = playX, k = 0; gx >= padX && k < 8; gx -= barPx, k++) {
        const label = String(((waveBarCounter - k - 1 + 64) % 16) + 1);
        ctx2d.fillText(label, gx, top + stripH - 6 * dpr);
      }
    }

    // Divider between decks
    const dy = stripH + stripGap / 2;
    ctx2d.strokeStyle = "rgba(90,110,140,0.35)";
    ctx2d.lineWidth = 1 * dpr;
    ctx2d.beginPath();
    ctx2d.moveTo(padX, dy); ctx2d.lineTo(padX + innerW, dy);
    ctx2d.stroke();
  }

  // ---- v22: Vertical / Stems / Decks (Serato iOS inspired) ----
  function sxBpm() { return bpmConfident && bpmDisplay > 0 ? bpmDisplay : 120; }
  function sxFrameMs() {
    const n = Math.min(wvFilled, 60);
    if (n < 3) return 16.7;
    const a = wvT[(wvWrite - 1 + WV_COLS) % WV_COLS];
    const b = wvT[(wvWrite - n + WV_COLS) % WV_COLS];
    const f = (a - b) / (n - 1);
    return f > 4 && f < 100 ? f : 16.7;
  }
  // Calls fn(offsetPx, isDownbeat) for beats in the past window of `spanPx` pixels.
  function sxBeatGrid(now, colPx, spanPx, fn) {
    const beatMs = 60000 / sxBpm();
    const anchor = lastBeat > 0 ? lastBeat : 0;
    const pxPerMs = colPx / sxFrameMs();
    const k0 = Math.floor((now - anchor) / beatMs);
    for (let k = k0; k > k0 - 64; k--) {
      const off = (now - (anchor + k * beatMs)) * pxPerMs;
      if (off > spanPx) break;
      if (off >= 0) fn(off, ((k % 4) + 4) % 4 === 0);
    }
  }
  let sxFlash = 0, sxSeenP = 0, sxSeenB = 0;
  function sxTickFlash() {
    const p = newestSince(pulses, sxSeenP);
    if (p) { sxSeenP = p.t0; sxFlash = Math.max(sxFlash, 0.6 + (p.strength || 0.5) * 0.4); }
    const bm = newestSince(booms, sxSeenB);
    if (bm) { sxSeenB = bm.t0; sxFlash = 1; }
    sxFlash *= 0.9;
  }
  function wvAt(i) { return (wvWrite - 1 - i + WV_COLS * 2) % WV_COLS; }

  // ---- v23: Decks beat clock (per-deck onset detectors, phase-locked) ----
  function mkDeck() { return { beats: [], count: 0, intervals: [], interval: 500, lastT: 0, flash: 0, down: false, angFrom: 0, angTo: 0, stepT: 0, avg: 0, prev: 0, seenMain: 0 }; }
  const decks = [mkDeck(), mkDeck()];
  function deckBeat(d, now) {
    if (d.lastT > 0) {
      const gap = now - d.lastT;
      if (gap < 250) return;
      if (gap < 1500) {
        d.intervals.push(gap); if (d.intervals.length > 12) d.intervals.shift();
        const s = d.intervals.slice().sort((a, b) => a - b);
        d.interval = s[s.length >> 1];
      } else { d.intervals.length = 0; d.count = 0; }
    }
    d.lastT = now;
    d.count = (d.count % 4) + 1;
    d.down = d.count === 1;
    d.beats.push({ t: now, down: d.down });
    while (d.beats.length && now - d.beats[0].t > 20000) d.beats.shift();
    d.angFrom = deckAngle(d, now); d.angTo = (d.count - 1) * Math.PI / 2; d.stepT = now;
    d.flash = d.down ? 1 : 0.75;
  }
  function deckBpm(d, now) {
    if (now - d.lastT > 2000 || d.intervals.length < 3) return 0;
    const s = d.intervals, med = d.interval;
    let ok = 0; for (const g of s) if (Math.abs(g - med) < med * 0.15) ok++;
    return ok / s.length >= 0.5 ? 60000 / med : 0;
  }
  function deckAngle(d, now) {
    if (!d.stepT) return 0;
    const e = Math.min(1, (now - d.stepT) / 90);
    const ease = 1 - Math.pow(1 - e, 3);
    let to = d.angTo, from = d.angFrom;
    while (to - from > Math.PI) from += Math.PI * 2;
    while (from - to > Math.PI) from -= Math.PI * 2;
    let a = from + (to - from) * ease;
    // interpolate toward next quarter using measured interval; stop when stale
    const since = now - d.stepT;
    if (since < 2000 && d.intervals.length >= 2) a += Math.min(0.95, since / d.interval) * (Math.PI / 2) * ease;
    return a;
  }
  function deckDetect(now) {
    const j = wvAt(0);
    // deck 1: kick/bass flux
    const v1 = wvKick[j] * 0.7 + wvBass[j] * 0.5 + wvOnset[j] * 0.3;
    // deck 2: mid/high flux
    const v2 = wvMid[j] * 0.6 + wvHigh[j] * 0.8;
    [v1, v2].forEach((v, i) => {
      const d = decks[i];
      const rise = v - d.prev; d.prev = v;
      d.avg = d.avg * 0.95 + v * 0.05;
      const thr = i === 0 ? 0.06 : 0.05;
      const minGap = Math.max(250, d.interval * 0.6);
      if (v > 0.06 && rise > thr && v > d.avg * 1.25 && now - d.lastT > minGap) deckBeat(d, now);
    });
    // Fallback: if the main detector fires and a deck has been silent >1.2s, use it.
    if (lastBeat > 0 && lastBeat !== decks[0].seenMain) {
      for (const d of decks) { if (now - d.lastT > 1200 && now - lastBeat < 100) deckBeat(d, lastBeat); d.seenMain = lastBeat; }
    }
    for (const d of decks) d.flash *= 0.88;
  }
  function vivid(r, g, b, boost) {
    const mx = Math.max(r, g, b, 1), mn = Math.min(r, g, b);
    const s = 1.6; // push saturation
    const avg = (r + g + b) / 3;
    r = avg + (r - avg) * s; g = avg + (g - avg) * s; b = avg + (b - avg) * s;
    const k = (255 / Math.max(mx, 1)) * boost;
    return [Math.max(0, Math.min(255, r * k)), Math.max(0, Math.min(255, g * k)), Math.max(0, Math.min(255, b * k))];
  }

  // Horizontal Serato spectral strip (used by Decks)
  function sxStrip(x0, y0, sw, sh, now, which) {
    ctx2d.fillStyle = "rgba(10,12,16,0.97)";
    ctx2d.fillRect(x0, y0, sw, sh);
    const playX = x0 + sw * 0.5, mid = y0 + sh / 2;
    const colPx = Math.max(2 * dpr, waveWidth * dpr * 1.2);
    const pxPerMs = colPx / sxFrameMs();
    const cols = Math.min(wvFilled, Math.ceil(sw / 2 / colPx) + 1);
    ctx2d.save();
    ctx2d.beginPath(); ctx2d.rect(x0, y0, sw, sh); ctx2d.clip();
    ctx2d.globalCompositeOperation = "lighter";
    for (let i = 0; i < cols; i++) {
      const j = wvAt(i);
      const b = wvBass[j], m = wvMid[j], hi = wvHigh[j];
      const v = which === 0 ? Math.min(1, b * 0.8 + wvKick[j] * 0.45 + wvAmp[j] * 0.35) : Math.min(1, m * 0.65 + hi * 0.65 + wvAmp[j] * 0.25);
      const x = playX - (i + 1) * colPx, xr = 2 * playX - x - colPx;
      const H = sh * 0.48 * waveHeight;
      // layered full-spectrum: bass body, mid band, high tips
      const wB = which === 0 ? 1.0 : 0.6, wH = which === 0 ? 0.7 : 1.15;
      const layers = [
        [Math.min(1, v * (0.55 + b * 0.6) * wB), spectralColor(1, b * 0.25, 0, 1)],
        [Math.min(1, v * (0.35 + m * 0.55)), spectralColor(b * 0.15, 1, hi * 0.2, 1)],
        [Math.min(1, v * (0.18 + hi * 0.5) * wH), spectralColor(0, m * 0.3, 1, 1)],
      ];
      for (let L = 0; L < 3; L++) {
        const [lv, c] = layers[L];
        const hh = Math.max(dpr * 0.5, lv * H);
        const [r, g, bl] = vivid(c[0], c[1], c[2], 0.55 + v * 0.5);
        ctx2d.fillStyle = hueRgba(r, g, bl, L === 2 ? 0.8 : 0.9);
        ctx2d.fillRect(x, mid - hh, colPx - 0.3 * dpr, hh * 2);
        ctx2d.fillRect(xr, mid - hh, colPx - 0.3 * dpr, hh * 2);
      }
      if (hi > 0.55) { // white sparkle on hot highs
        ctx2d.fillStyle = `rgba(255,255,255,${(hi - 0.55) * 1.2})`;
        const hh = v * H * 0.25;
        ctx2d.fillRect(x, mid - hh, colPx, hh * 2); ctx2d.fillRect(xr, mid - hh, colPx, hh * 2);
      }
    }
    ctx2d.globalCompositeOperation = "source-over";
    // beat grid at real detected beat times for this deck
    const d = decks[which];
    for (let k = d.beats.length - 1; k >= 0; k--) {
      const bt = d.beats[k], off = (now - bt.t) * pxPerMs;
      if (off > sw / 2) break;
      ctx2d.fillStyle = bt.down ? "rgba(255,170,40,0.95)" : "rgba(255,255,255,0.45)";
      const t = bt.down ? 2.5 * dpr : dpr;
      ctx2d.fillRect(playX - off - t / 2, y0, t, sh);
    }
    ctx2d.restore();
    const g = which === 0 ? "255,120,40" : "60,200,255";
    ctx2d.strokeStyle = `rgba(${g},${0.3 + d.flash * 0.6})`;
    ctx2d.lineWidth = dpr;
    ctx2d.strokeRect(x0, y0, sw, sh);
    ctx2d.fillStyle = "#fff";
    ctx2d.shadowColor = "rgba(255,255,255,0.9)"; ctx2d.shadowBlur = 8 * dpr;
    ctx2d.fillRect(playX - dpr, y0 - 2 * dpr, 2 * dpr, sh + 4 * dpr);
    ctx2d.shadowBlur = 0;
    ctx2d.font = `700 ${Math.max(9, 10 * dpr)}px -apple-system, sans-serif`;
    ctx2d.textAlign = "left";
    ctx2d.fillStyle = `rgba(${g},0.95)`;
    ctx2d.fillText(which === 0 ? "1 · KICK" : "2 · HATS", x0 + 5 * dpr, y0 + 12 * dpr);
  }

  function drawVerticalMode(w, h, now) {
    sxTickFlash();
    ctx2d.fillStyle = "#020304";
    ctx2d.fillRect(0, 0, w, h);
    const cx = w / 2, playY = h * 0.5;
    const maxHalf = w * 0.46;
    const rowPx = Math.max(1, waveWidth * dpr);
    const rows = Math.min(wvFilled, Math.ceil(h / 2 / rowPx) + 1);
    const bb = currentTheme.bassBody, ht = currentTheme.highTip;
    for (let i = 0; i < rows; i++) {
      const j = wvAt(i);
      const amp = wvAmp[j], b = wvBass[j], m = wvMid[j], hi = wvHigh[j];
      const half = Math.min(maxHalf, Math.max(1.5 * dpr, amp * maxHalf * 0.95 * waveHeight));
      const yA = playY - (i + 1) * rowPx; // above playhead (older -> top), scroll downward
      const yB = playY + i * rowPx;       // mirrored below
      const lw = half * (0.5 + b * 0.5);
      ctx2d.fillStyle = hueRgba(bb.r0 + b * bb.rS, bb.g0 + b * bb.gBass + m * bb.gMid, bb.b, 0.95);
      ctx2d.fillRect(cx - lw, yA, lw * 2, rowPx); ctx2d.fillRect(cx - lw, yB, lw * 2, rowPx);
      const [r, g, bl] = spectralColor(b, m, hi, amp);
      const mw = half * (0.35 + m * 0.6);
      ctx2d.fillStyle = hueRgba(r - 30, g + 50, bl, 0.9);
      ctx2d.fillRect(cx - mw, yA, mw * 2, rowPx); ctx2d.fillRect(cx - mw, yB, mw * 2, rowPx);
      const hw = half * (0.4 + hi * 0.75), tip = Math.max(1.5 * dpr, hw * 0.22);
      ctx2d.fillStyle = hueRgba(ht.r0 + hi * ht.rS, ht.g0 + hi * ht.gS, ht.b0 + hi * ht.bS, 1);
      ctx2d.fillRect(cx - hw, yA, tip, rowPx); ctx2d.fillRect(cx + hw - tip, yA, tip, rowPx);
      ctx2d.fillRect(cx - hw, yB, tip, rowPx); ctx2d.fillRect(cx + hw - tip, yB, tip, rowPx);
    }
    sxBeatGrid(now, rowPx, h / 2, (off, down) => {
      ctx2d.fillStyle = down ? `rgba(255,255,255,${0.6 + sxFlash * 0.3})` : "rgba(160,170,185,0.28)";
      const t = down ? 2 * dpr : dpr;
      ctx2d.fillRect(0, playY - off, w, t);
      ctx2d.fillRect(0, playY + off, w, t);
    });
    ctx2d.strokeStyle = "rgba(0,200,220,0.15)";
    ctx2d.lineWidth = dpr;
    ctx2d.beginPath(); ctx2d.moveTo(cx, 0); ctx2d.lineTo(cx, h); ctx2d.stroke();
    ctx2d.fillStyle = `rgba(255,255,255,${0.85 + sxFlash * 0.15})`;
    ctx2d.shadowColor = "rgba(255,255,255,0.7)";
    ctx2d.shadowBlur = (6 + sxFlash * 14) * dpr;
    const ph = (2 + sxFlash * 2) * dpr;
    ctx2d.fillRect(0, playY - ph / 2, w, ph);
    ctx2d.shadowBlur = 0;
  }

  const STEM_LANES = [
    { label: "HI", rgb: [70, 140, 255], val: (j) => wvHigh[j] },
    { label: "MID", rgb: [255, 70, 190], val: (j) => wvMid[j] },
    { label: "BASS", rgb: [255, 50, 50], val: (j) => wvBass[j] },
    { label: "KICK", rgb: [255, 180, 40], val: (j) => Math.max(wvKick[j] * 0.9, wvOnset[j] * 0.8) },
  ];
  function drawStemsMode(w, h, now) {
    sxTickFlash();
    ctx2d.fillStyle = "#020304";
    ctx2d.fillRect(0, 0, w, h);
    const top = h * 0.08, bot = h * 0.92, laneH = (bot - top) / STEM_LANES.length;
    const playX = w * 0.5;
    const colPx = Math.max(1, waveWidth * dpr);
    const cols = Math.min(wvFilled, Math.ceil(w / 2 / colPx) + 1);
    ctx2d.font = `600 ${Math.max(9, 10 * dpr)}px -apple-system, sans-serif`;
    ctx2d.textAlign = "left";
    for (let L = 0; L < STEM_LANES.length; L++) {
      const lane = STEM_LANES[L], y0 = top + L * laneH, mid = y0 + laneH / 2;
      ctx2d.fillStyle = L % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.045)";
      ctx2d.fillRect(0, y0, w, laneH);
      ctx2d.fillStyle = hueRgba(lane.rgb[0], lane.rgb[1], lane.rgb[2], 0.95);
      for (let i = 0; i < cols; i++) {
        const j = wvAt(i);
        const v = Math.min(1, lane.val(j) * (0.6 + wvAmp[j] * 0.6));
        const hh = Math.min(laneH * 0.46, Math.max(dpr, v * laneH * 0.46 * waveHeight));
        const x = playX - (i + 1) * colPx;
        ctx2d.fillRect(x, mid - hh, colPx, hh * 2);
        ctx2d.fillRect(2 * playX - x - colPx, mid - hh, colPx, hh * 2);
      }
      ctx2d.fillStyle = "rgba(255,255,255,0.75)";
      ctx2d.fillText(lane.label, 8 * dpr, y0 + 14 * dpr);
      ctx2d.fillStyle = "rgba(60,70,80,0.8)";
      ctx2d.fillRect(0, y0, w, dpr);
    }
    sxBeatGrid(now, colPx, w / 2, (off, down) => {
      ctx2d.fillStyle = down ? `rgba(255,255,255,${0.55 + sxFlash * 0.3})` : "rgba(255,255,255,0.18)";
      const t = down ? 2 * dpr : dpr;
      ctx2d.fillRect(playX - off, top, t, bot - top);
      ctx2d.fillRect(playX + off, top, t, bot - top);
    });
    ctx2d.fillStyle = "#fff";
    ctx2d.shadowColor = "rgba(255,255,255,0.7)";
    ctx2d.shadowBlur = (6 + sxFlash * 12) * dpr;
    ctx2d.fillRect(playX - dpr, top, 2 * dpr, bot - top);
    ctx2d.shadowBlur = 0;
  }

  function sxPlatter(cx, cy, r, now, label, d) {
    const bpm = deckBpm(d, now);
    const ang = deckAngle(d, now) - Math.PI / 2;
    const f = d.flash, rgb = d.down && f > 0.05 ? "255,150,30" : "0,230,255";
    ctx2d.fillStyle = "#0b0d11";
    ctx2d.beginPath(); ctx2d.arc(cx, cy, r, 0, Math.PI * 2); ctx2d.fill();
    ctx2d.strokeStyle = "rgba(255,255,255,0.08)";
    ctx2d.lineWidth = dpr;
    for (let k = 1; k <= 3; k++) { ctx2d.beginPath(); ctx2d.arc(cx, cy, r * (0.3 + k * 0.17), 0, Math.PI * 2); ctx2d.stroke(); }
    // quarter ticks
    for (let q = 0; q < 4; q++) {
      const a = q * Math.PI / 2 - Math.PI / 2;
      ctx2d.fillStyle = q === 0 ? "rgba(255,150,30,0.9)" : "rgba(255,255,255,0.4)";
      ctx2d.beginPath(); ctx2d.arc(cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97, (q === 0 ? 3 : 2) * dpr, 0, Math.PI * 2); ctx2d.fill();
    }
    ctx2d.strokeStyle = `rgba(${rgb},${0.3 + f * 0.7})`;
    ctx2d.lineWidth = (2 + f * (d.down ? 7 : 4)) * dpr;
    ctx2d.shadowColor = `rgba(${rgb},0.95)`;
    ctx2d.shadowBlur = f * (d.down ? 34 : 22) * dpr;
    ctx2d.beginPath(); ctx2d.arc(cx, cy, r, 0, Math.PI * 2); ctx2d.stroke();
    ctx2d.shadowBlur = 0;
    const ex = cx + Math.cos(ang) * r * 0.9, ey = cy + Math.sin(ang) * r * 0.9;
    ctx2d.strokeStyle = "#fff";
    ctx2d.lineWidth = 3 * dpr;
    ctx2d.beginPath(); ctx2d.moveTo(cx + Math.cos(ang) * r * 0.35, cy + Math.sin(ang) * r * 0.35); ctx2d.lineTo(ex, ey); ctx2d.stroke();
    ctx2d.fillStyle = "#fff";
    ctx2d.beginPath(); ctx2d.arc(ex, ey, 5 * dpr, 0, Math.PI * 2); ctx2d.fill();
    ctx2d.textAlign = "center";
    // big beat digit
    const live = now - d.lastT < 2000 && d.count > 0;
    ctx2d.font = `800 ${Math.max(18, r * 0.34)}px -apple-system, sans-serif`;
    ctx2d.fillStyle = live ? (d.count === 1 ? `rgba(255,160,40,${0.7 + f * 0.3})` : `rgba(255,255,255,${0.7 + f * 0.3})`) : "rgba(255,255,255,0.25)";
    ctx2d.fillText(live ? String(d.count) : "–", cx, cy - r * 0.02);
    ctx2d.font = `700 ${Math.max(12, r * 0.15)}px -apple-system, sans-serif`;
    ctx2d.fillStyle = "rgba(255,255,255,0.92)";
    ctx2d.fillText(bpm ? bpm.toFixed(1) : "--", cx, cy + r * 0.2);
    ctx2d.font = `600 ${Math.max(9, r * 0.08)}px -apple-system, sans-serif`;
    ctx2d.fillStyle = "rgba(255,255,255,0.5)";
    ctx2d.fillText(label + " · BPM", cx, cy + r * 0.32);
    // 4 beat pads under platter
    const pw = r * 0.36, ph = Math.max(8 * dpr, r * 0.13), gap = r * 0.08;
    const px0 = cx - (pw * 4 + gap * 3) / 2, py = cy + r + 10 * dpr;
    for (let q = 1; q <= 4; q++) {
      const on = live && q === d.count;
      const c = q === 1 ? "255,150,30" : "0,220,255";
      ctx2d.fillStyle = on ? `rgba(${c},${0.65 + f * 0.35})` : `rgba(${c},0.14)`;
      if (on) { ctx2d.shadowColor = `rgba(${c},0.9)`; ctx2d.shadowBlur = (6 + f * 16) * dpr; }
      ctx2d.fillRect(px0 + (q - 1) * (pw + gap), py, pw, ph);
      ctx2d.shadowBlur = 0;
    }
  }
  function drawDecksMode(w, h, now) {
    sxTickFlash();
    deckDetect(now);
    ctx2d.fillStyle = "#030405";
    ctx2d.fillRect(0, 0, w, h);
    const padX = w * 0.03;
    const stripH = Math.max(40 * dpr, h * 0.14);
    const sy = h * 0.08;
    sxStrip(padX, sy, w - padX * 2, stripH, now, 0);
    sxStrip(padX, sy + stripH + 6 * dpr, w - padX * 2, stripH, now, 1);
    const areaTop = sy + stripH * 2 + 14 * dpr, areaBot = h * 0.9;
    const r = Math.max(20, Math.min(w * 0.21, (areaBot - areaTop) * 0.4));
    const cy = (areaTop + areaBot) / 2 - 8 * dpr;
    sxPlatter(w * 0.27, cy, r, now, "DECK 1", decks[0]);
    sxPlatter(w * 0.73, cy, r, now, "DECK 2", decks[1]);
  }
  let wvSeenPulse = 0;
  let wvSeenBoom = 0;

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
    wvAmp[wvWrite] = amp;
    wvBass[wvWrite] = bass;
    wvMid[wvWrite] = mid;
    wvHigh[wvWrite] = high;
    wvOnset[wvWrite] = onset;
    wvWrite = (wvWrite + 1) % WV_COLS;
    if (wvFilled < WV_COLS) wvFilled++;

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

    wvKick[wvWrite] = kick;
    wvT[wvWrite] = now;
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
      const half = Math.min(topH * 0.5, Math.max(2 * dpr, s.amp * topH * 0.62 * classicHGain));
      // Bass body — theme bass core
      const bbod = currentTheme.bassBody;
      const lowHalf = half * (0.5 + s.bass * 0.55);
      const bassR = Math.min(255, bbod.r0 + s.bass * bbod.rS);
      const bassG = Math.min(255, bbod.g0 + s.bass * bbod.gBass + s.mid * bbod.gMid);
      ctx2d.fillStyle = hueRgba(bassR, bassG, bbod.b, 0.95);
      fr2(x, midTop - lowHalf, cw, lowHalf * 2);
      // Mid layer — spectral overlay
      const midHalf = half * (0.4 + s.mid * 0.55);
      ctx2d.fillStyle = hueRgba(Math.max(0, cr - 30), Math.min(255, cg + 50), Math.min(255, cb), 0.9);
      fr2(x + cw * 0.12, midTop - midHalf, Math.max(1, cw * 0.76), midHalf * 2);
      // High tips
      const htip = currentTheme.highTip;
      const hiHalf = half * (0.4 + s.high * 0.7);
      const tipH = Math.max(2 * dpr, hiHalf * 0.28);
      ctx2d.fillStyle = hueRgba(Math.min(255, htip.r0 + s.high * htip.rS), Math.min(255, htip.g0 + s.high * htip.gS), Math.min(255, htip.b0 + s.high * htip.bS), 1);
      fr2(x, midTop - hiHalf, Math.max(1, cw * 0.7), tipH);
      fr2(x, midTop + hiHalf - tipH, Math.max(1, cw * 0.7), tipH);
      if (s.high > 0.35) {
        const he = currentTheme.highEdge;
        ctx2d.fillStyle = hueRgba(he[0], he[1], he[2], 0.4 + s.high * 0.5);
        fr2(x, midTop - hiHalf - 1 * dpr, Math.max(1, cw * 0.45), 2 * dpr);
        fr2(x, midTop + hiHalf - 1 * dpr, Math.max(1, cw * 0.45), 2 * dpr);
      }

      // --- Mid tier: transient ribbon ---
      const mr = currentTheme.midRibbon;
      const onsetH = Math.max(2 * dpr, s.onset * midH * 0.98);
      ctx2d.fillStyle = hueRgba(Math.min(255, mr.r0 + s.onset * mr.rS), Math.min(255, mr.g0 + s.onset * mr.gS), mr.b, 0.45 + s.onset * 0.55);
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
      ctx2d.fillStyle = hueRgba(br, bg, bb, 0.95);
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

  // ---- v24: Scratch / battle-DJ modes (shared scratch + vocal analysis) ----
  const SK = { hiPrev: null, hiAvg: 0, fluxAvg: 0, scratch: 0, scratchT: 0, scratchN: 0, dir: 1,
    midSlow: 0, hiSlow: 0, kickSlow: 0, vocal: 0, kickFlash: 0, seenK: 0, seenB: 0, drop: 0, last: 0, dt: 16.7 };
  function skAnalyze(now, kick, energy, sens) {
    SK.dt = SK.last ? Math.min(50, now - SK.last) : 16.7; SK.last = now;
    deckDetect(now);
    const n = freqData.length;
    const hz = (audioCtx ? audioCtx.sampleRate : 48000) / (analyser ? analyser.fftSize : 2048);
    const b = (f) => Math.max(1, Math.min(n - 1, Math.round(f / hz)));
    const h0 = b(2000), h1 = b(12000), m0 = b(300), m1 = b(3000);
    if (!SK.hiPrev || SK.hiPrev.length !== n) SK.hiPrev = new Float32Array(n);
    let hs = 0, flux = 0, ms = 0;
    for (let j = h0; j <= h1; j++) { const v = freqData[j] / 255; hs += v; const d = v - SK.hiPrev[j]; if (d > 0) flux += d; SK.hiPrev[j] = v; }
    for (let j = m0; j <= m1; j++) ms += freqData[j] / 255;
    const hiE = Math.min(1, (hs / (h1 - h0 + 1)) * sens * 1.6);
    const midE = Math.min(1, (ms / (m1 - m0 + 1)) * sens * 1.2);
    flux = (flux / (h1 - h0 + 1)) * sens * 4;
    const live = energy > 0.025; // never fire on silence
    const isScr = live && now - SK.scratchT > 55 &&
      ((hiE > 0.07 && hiE > SK.hiAvg * 1.45 && hiE - SK.hiAvg > 0.03) || (flux > 0.05 && flux > SK.fluxAvg * 2.3));
    SK.hiAvg = SK.hiAvg * 0.94 + hiE * 0.06;
    SK.fluxAvg = SK.fluxAvg * 0.92 + flux * 0.08;
    if (isScr) {
      SK.scratchT = now; SK.scratchN++; SK.dir = Math.random() < 0.5 ? -1 : 1;
      SK.scratch = Math.min(1, Math.max(SK.scratch, 0.55 + flux * 2 + (hiE - SK.hiAvg) * 3));
    }
    SK.scratch *= 0.88;
    SK.midSlow = SK.midSlow * 0.96 + midE * 0.04;
    SK.hiSlow = SK.hiSlow * 0.96 + hiE * 0.04;
    SK.kickSlow = SK.kickSlow * 0.96 + kick * 0.04;
    const voc = live && SK.midSlow > 0.12 && SK.midSlow > SK.hiSlow * 1.35 && SK.midSlow > SK.kickSlow * 0.85 && SK.scratch < 0.25;
    SK.vocal += ((voc ? 1 : 0) - SK.vocal) * 0.04;
    SK.midE = midE; SK.hiE = hiE;
    // Kicks: reuse deck-1 (kick/bass) detector + main 808 detector
    const d0 = decks[0];
    if (d0.lastT && d0.lastT !== SK.seenK) { SK.seenK = d0.lastT; SK.kickFlash = Math.max(SK.kickFlash, d0.down ? 1 : 0.8); SK.kickEv = now; }
    const bm = newestSince(booms, SK.seenB);
    if (bm) { SK.seenB = bm.t0; SK.kickFlash = 1; if ((bm.strength || 0) > 0.75 && now - (SK.dropT || 0) > 4000) { SK.drop = 1; SK.dropT = now; } }
    if (!live) { SK.kickFlash *= 0.8; SK.scratch *= 0.7; }
    SK.kickFlash *= 0.9; SK.drop *= 0.93;
  }
  const skLand = (w, h) => w > h;
  const skHot = (now) => now - SK.scratchT < 140;
  function skBpmText(now) {
    const b = deckBpm(decks[0], now) || (bpmConfident && bpmDisplay > 0 ? bpmDisplay : 0);
    return b ? b.toFixed(1) : "--.-";
  }
  function skCol(i) { const j = wvAt(i); return spectralColor(wvBass[j] + 0.1, wvMid[j], wvHigh[j], wvAmp[j] + 0.3); }
  // Circular overview waveform wrapped around a ring (rotates with ang)
  function skRingWave(cx, cy, r, depth, ang, segs) {
    const step = Math.max(1, Math.floor(Math.min(wvFilled, 360) / segs));
    ctx2d.lineWidth = Math.max(1.5 * dpr, (Math.PI * 2 * r) / segs * 0.8);
    for (let i = 0; i < segs; i++) {
      const j = wvAt(i * step), a = ang - (i / segs) * Math.PI * 2;
      const amp = Math.min(1, wvAmp[j] * 1.6), [cr, cg, cb] = skCol(i * step);
      const c = Math.cos(a), s = Math.sin(a), r0 = r - amp * depth * 0.45, r1 = r + amp * depth * 0.55;
      ctx2d.strokeStyle = hueRgba(cr, cg, cb, 0.35 + amp * 0.65);
      ctx2d.beginPath(); ctx2d.moveTo(cx + c * r0, cy + s * r0); ctx2d.lineTo(cx + c * r1, cy + s * r1); ctx2d.stroke();
    }
  }
  function skPlatterBody(cx, cy, r, ang, glow) {
    ctx2d.fillStyle = "#0a0b0e";
    ctx2d.beginPath(); ctx2d.arc(cx, cy, r, 0, Math.PI * 2); ctx2d.fill();
    ctx2d.strokeStyle = "rgba(255,255,255,0.07)"; ctx2d.lineWidth = dpr;
    for (let k = 1; k <= 4; k++) { ctx2d.beginPath(); ctx2d.arc(cx, cy, r * (0.25 + k * 0.17), 0, Math.PI * 2); ctx2d.stroke(); }
    ctx2d.strokeStyle = rgbaOf(CYAN, 0.25 + glow * 0.6); ctx2d.lineWidth = (1.5 + glow * 3) * dpr;
    ctx2d.beginPath(); ctx2d.arc(cx, cy, r, 0, Math.PI * 2); ctx2d.stroke();
    ctx2d.strokeStyle = "rgba(255,255,255,0.18)"; ctx2d.lineWidth = 2 * dpr;
    ctx2d.beginPath(); ctx2d.moveTo(cx + Math.cos(ang) * r * 0.2, cy + Math.sin(ang) * r * 0.2); ctx2d.lineTo(cx + Math.cos(ang) * r * 0.85, cy + Math.sin(ang) * r * 0.85); ctx2d.stroke();
  }
  function skPlayhead(cx, cy, r) {
    ctx2d.fillStyle = "#fff"; ctx2d.shadowColor = "#fff"; ctx2d.shadowBlur = 10 * dpr;
    ctx2d.fillRect(cx - 1.5 * dpr, cy - r * 1.16, 3 * dpr, r * 0.32); ctx2d.shadowBlur = 0;
  }
  // Platter physics: steady beat spin, jerks back & forth on scratches
  function mkSpin() { return { ang: 0, vel: 0, jerkT: 0 }; }
  function skSpin(sp, now, gain) {
    const base = (sxBpm() / 90) * 0.0021 * (energyLive ? 1 : 0.15); // rad/ms (~33rpm-ish)
    if (SK.scratchT > sp.jerkT) { sp.jerkT = SK.scratchT; sp.vel = SK.dir * (0.012 + SK.scratch * 0.03) * (gain || 1); }
    sp.vel += (base - sp.vel) * 0.08;
    sp.ang += sp.vel * SK.dt;
    return sp.ang;
  }
  let energyLive = false;
  function skBg(a) { ctx2d.fillStyle = `rgba(3,4,6,${a})`; ctx2d.fillRect(0, 0, els.canvas.width, els.canvas.height); }
  function skKickGlow(w, h, amt) {
    if (amt < 0.02) return;
    const g = ctx2d.createRadialGradient(w / 2, h * 1.05, 0, w / 2, h * 1.05, Math.max(w, h) * (0.45 + amt * 0.55));
    g.addColorStop(0, rgbaOf(ORANGE, 0.75 * amt)); g.addColorStop(0.45, rgbaOf(BOOM || ORANGE, 0.3 * amt)); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx2d.fillStyle = g; ctx2d.fillRect(0, 0, w, h);
  }
  // One low-res snapshot per frame (self-drawImage is costly on mobile)
  let skSnapCv = null, skSnapT = -1;
  function skSnap(w, h, now) {
    if (!skSnapCv) skSnapCv = document.createElement("canvas");
    const sw = Math.max(1, Math.round(w / 3)), sh = Math.max(1, Math.round(h / 3));
    if (skSnapCv.width !== sw || skSnapCv.height !== sh) { skSnapCv.width = sw; skSnapCv.height = sh; skSnapT = -1; }
    if (skSnapT !== now) { skSnapCv.getContext("2d").drawImage(els.canvas, 0, 0, sw, sh); skSnapT = now; }
    return skSnapCv;
  }
  function skTears(w, h, amt, n) {
    if (amt < 0.15 || n < 1) return;
    const sn = skSnap(w, h, SK.last), k = sn.width / w;
    for (let i = 0; i < Math.min(n, 4); i++) {
      const y = Math.random() * h, hh = (4 + Math.random() * 30) * dpr, dx = (Math.random() - 0.5) * amt * 60 * dpr;
      ctx2d.drawImage(sn, 0, y * k, sn.width, Math.max(1, hh * k), dx, y, w, hh);
    }
  }
  let skNoise = null;
  function skStatic(w, h, amt) {
    if (amt < 0.05) return;
    if (!skNoise) {
      skNoise = document.createElement("canvas"); skNoise.width = skNoise.height = 128;
      const c = skNoise.getContext("2d"), id = c.createImageData(128, 128);
      for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
      c.putImageData(id, 0, 0);
    }
    ctx2d.save(); ctx2d.globalAlpha = Math.min(0.45, amt * 0.45); ctx2d.globalCompositeOperation = "lighter";
    const s = 2 * dpr, bands = 1 + Math.floor(amt * 4);
    for (let b = 0; b < bands; b++) {
      const y = Math.random() * h, bh = (20 + Math.random() * 80) * dpr;
      ctx2d.translate(-Math.random() * 128 * s, y);
      ctx2d.fillStyle = ctx2d.createPattern(skNoise, "repeat"); ctx2d.scale(s, s);
      ctx2d.fillRect(0, 0, (w + 256 * s) / s, bh / s);
      ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx2d.restore();
  }
  let skScan = null;
  function skScanlines(w, h, a) {
    if (!skScan) { skScan = document.createElement("canvas"); skScan.width = 1; skScan.height = 4; const c = skScan.getContext("2d"); c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(0, 0, 1, 2); }
    ctx2d.save(); ctx2d.globalAlpha = a; ctx2d.fillStyle = ctx2d.createPattern(skScan, "repeat"); ctx2d.fillRect(0, 0, w, h); ctx2d.restore();
  }
  // Scrolling Serato waveform (newest at right), returns nothing
  function skWave(x0, y0, ww, hh, colPx, alpha, ox, tint) {
    const cols = Math.min(wvFilled, Math.floor(ww / colPx));
    const mid = y0 + hh / 2;
    for (let i = 0; i < cols; i++) {
      const j = wvAt(i), amp = Math.min(1, wvAmp[j] * 1.5), x = x0 + ww - (i + 1) * colPx + (ox || 0);
      const half = Math.max(dpr * 0.5, amp * hh * 0.48);
      if (tint) ctx2d.fillStyle = tint; else { const [r, g, b] = skCol(i); ctx2d.fillStyle = hueRgba(r, g, b, alpha); }
      ctx2d.fillRect(x, mid - half, Math.max(1, colPx - 0.3), half * 2);
    }
  }

  // 1) Scratch Glitch
  const sgSpin = mkSpin(); const sgStreaks = [];
  function drawScratchGlitchMode(w, h, now) {
    skBg(0.5);
    const m = Math.min(w, h), land = skLand(w, h);
    skKickGlow(w, h, SK.kickFlash);
    const hot = SK.scratch, calm = SK.vocal;
    const cx = w / 2 + (hot > 0.2 ? (Math.random() - 0.5) * hot * 22 * dpr : 0);
    const cy = h * (land ? 0.48 : 0.42) + (hot > 0.2 ? (Math.random() - 0.5) * hot * 14 * dpr : 0);
    const r = m * (land ? 0.3 : 0.34) * (1 + SK.kickFlash * 0.04);
    const ang = skSpin(sgSpin, now, 1.4) + (hot > 0.2 ? (Math.random() - 0.5) * hot * 0.5 : 0);
    const plat = (dx, tintR) => {
      if (tintR) { ctx2d.strokeStyle = tintR; ctx2d.lineWidth = 4 * dpr; ctx2d.beginPath(); ctx2d.arc(cx + dx, cy, r, 0, Math.PI * 2); ctx2d.stroke();
        ctx2d.beginPath(); ctx2d.moveTo(cx + dx, cy); ctx2d.lineTo(cx + dx + Math.cos(ang) * r, cy + Math.sin(ang) * r); ctx2d.stroke(); return; }
      skPlatterBody(cx, cy, r * (1 - calm * 0.25), ang, SK.kickFlash);
      skRingWave(cx, cy, r * (1 - calm * 0.25) * 1.08, r * 0.28, ang, 96);
    };
    ctx2d.globalAlpha = 1 - calm * 0.65; plat(0); ctx2d.globalAlpha = 1;
    if (hot > 0.12) {
      const off = hot * 16 * dpr;
      ctx2d.save(); ctx2d.globalCompositeOperation = "lighter";
      plat(-off, `rgba(255,30,50,${0.7 * hot})`); plat(off, `rgba(40,90,255,${0.7 * hot})`);
      ctx2d.restore();
    }
    // light streaks
    if (skHot(now) && sgStreaks.length < 40) for (let k = 0; k < 4; k++) sgStreaks.push({ y: Math.random() * h, x: Math.random() * w, v: (SK.dir * (20 + Math.random() * 50)) * dpr, l: (60 + Math.random() * 220) * dpr, a: 1, c: Math.random() < 0.5 ? "255,40,60" : Math.random() < 0.5 ? "60,120,255" : "255,255,255" });
    ctx2d.save(); ctx2d.globalCompositeOperation = "lighter";
    for (let i = sgStreaks.length - 1; i >= 0; i--) {
      const s = sgStreaks[i]; s.x += s.v; s.a *= 0.86;
      if (s.a < 0.04) { sgStreaks.splice(i, 1); continue; }
      const g = ctx2d.createLinearGradient(s.x - s.l * Math.sign(s.v), 0, s.x, 0);
      g.addColorStop(0, `rgba(${s.c},0)`); g.addColorStop(1, `rgba(${s.c},${s.a})`);
      ctx2d.fillStyle = g; ctx2d.fillRect(Math.min(s.x, s.x - s.l * Math.sign(s.v)), s.y, s.l, 2 * dpr);
    }
    ctx2d.restore();
    // vocals: mirrored center wave
    if (calm > 0.05 && timeData) {
      const amp = h * 0.16 * (0.5 + (SK.midE || 0) * 1.4), N = 160, step = Math.floor(timeData.length / N);
      for (const mir of [1, -1]) {
        ctx2d.beginPath();
        for (let i = 0; i <= N; i++) {
          const v = Math.abs((timeData[Math.min(timeData.length - 1, i * step)] - 128) / 128);
          const x = (i / N) * w, y = h / 2 - mir * v * amp * Math.sin((i / N) * Math.PI);
          i ? ctx2d.lineTo(x, y) : ctx2d.moveTo(x, y);
        }
        ctx2d.strokeStyle = hueRgba(...bandColorAt(0.5, 1), calm * 0.9); ctx2d.lineWidth = 2.5 * dpr;
        ctx2d.shadowColor = rgbaOf(CYAN, 0.8); ctx2d.shadowBlur = 12 * dpr * calm; ctx2d.stroke(); ctx2d.shadowBlur = 0;
      }
    }
    if (hot > 0.35) skTears(w, h, hot, 3);
  }

  // 2) Scratch Platter
  const spSpin = mkSpin();
  function drawScratchPlatterMode(w, h, now) {
    skBg(1);
    const land = skLand(w, h), m = Math.min(w, h);
    const r = m * (land ? 0.36 : 0.38), cx = w / 2, cy = land ? h * 0.5 : h * 0.44;
    const ang = skSpin(spSpin, now, 1.6);
    ctx2d.fillStyle = rgbaOf(CYAN, 0.05 + SK.kickFlash * 0.08); ctx2d.beginPath(); ctx2d.arc(cx, cy, r * 1.35, 0, Math.PI * 2); ctx2d.fill();
    skPlatterBody(cx, cy, r * 0.82, ang, SK.kickFlash);
    skRingWave(cx, cy, r, r * 0.3, ang - Math.PI / 2, 160);
    // dot marker on vinyl
    ctx2d.fillStyle = rgbaOf(ORANGE, 0.95);
    ctx2d.beginPath(); ctx2d.arc(cx + Math.cos(ang) * r * 0.7, cy + Math.sin(ang) * r * 0.7, 5 * dpr, 0, Math.PI * 2); ctx2d.fill();
    skPlayhead(cx, cy, r);
    // Serato BPM readout
    ctx2d.textAlign = "center";
    ctx2d.font = `800 ${Math.round(r * 0.26)}px -apple-system, sans-serif`; ctx2d.fillStyle = "#fff";
    ctx2d.fillText(skBpmText(now), cx, cy + r * 0.06);
    ctx2d.font = `700 ${Math.round(r * 0.08)}px -apple-system, sans-serif`; ctx2d.fillStyle = "rgba(255,255,255,0.55)";
    ctx2d.fillText("BPM", cx, cy + r * 0.2);
    const scr = skHot(now) ? (SK.dir > 0 ? "▶▶ SCRATCH" : "◀◀ SCRATCH") : "";
    ctx2d.fillStyle = `rgba(255,60,80,${Math.min(1, SK.scratch * 1.5)})`;
    ctx2d.fillText(scr, cx, cy - r * 0.22);
    const wy = land ? h * 0.9 : cy + r * 1.3;
    skWave(w * 0.05, wy, w * 0.9, Math.min(h * 0.08, 60 * dpr), 2 * dpr, 0.9);
  }

  // 3) VHS Glitch
  function drawVhsMode(w, h, now) {
    skBg(1);
    const g = Math.min(1, SK.scratch + SK.drop * 0.8);
    const land = skLand(w, h);
    const sy = h * (land ? 0.12 : 0.2), sh = h * (land ? 0.5 : 0.38);
    const draw = (ox, tint) => {
      skWave(0, sy, w, sh, 3 * dpr, 0.95, ox, tint);
      const bw = w / BAR_COUNT, base = h * 0.94;
      for (let i = 0; i < BAR_COUNT; i++) {
        const v = smoothed[i], bh = v * h * 0.28;
        if (tint) ctx2d.fillStyle = tint; else { const [r, gg, b] = bandColorAt(i / BAR_COUNT, v + 0.3); ctx2d.fillStyle = hueRgba(r, gg, b, 0.9); }
        ctx2d.fillRect(i * bw + 1 + (ox || 0), base - bh, bw - 2, bh);
      }
    };
    if (g > 0.08) {
      ctx2d.save(); ctx2d.globalCompositeOperation = "lighter";
      draw(-g * 14 * dpr, "rgba(255,0,40,0.55)"); draw(g * 14 * dpr, "rgba(0,80,255,0.55)");
      ctx2d.restore();
    }
    draw(0);
    skTears(w, h, g, Math.floor(g * 5));
    skStatic(w, h, g);
    // rolling tracking bar
    const ty = ((now * 0.12) % (h * 1.4)) - h * 0.2;
    ctx2d.fillStyle = `rgba(255,255,255,${0.04 + g * 0.08})`; ctx2d.fillRect(0, ty, w, 18 * dpr);
    skScanlines(w, h, 0.6);
    ctx2d.font = `700 ${Math.round(14 * dpr)}px Menlo, monospace`; ctx2d.textAlign = "left";
    ctx2d.fillStyle = `rgba(255,255,255,${0.6 + (Math.floor(now / 500) % 2) * 0.3})`;
    ctx2d.fillText("▶ PLAY  SP  " + skBpmText(now) + " BPM", 14 * dpr, h * 0.07);
  }

  // 4) Split Screen
  const SPLIT_LAYOUTS = {
    land: [[[0.03, 0.06, 0.3, 0.88], [0.35, 0.06, 0.62, 0.56], [0.35, 0.66, 0.4, 0.28], [0.77, 0.66, 0.2, 0.28]],
           [[0.03, 0.06, 0.62, 0.56], [0.67, 0.06, 0.3, 0.88], [0.03, 0.66, 0.2, 0.28], [0.25, 0.66, 0.4, 0.28]],
           [[0.35, 0.06, 0.3, 0.6], [0.03, 0.06, 0.3, 0.88], [0.67, 0.06, 0.3, 0.6], [0.35, 0.7, 0.62, 0.24]]],
    port: [[[0.05, 0.05, 0.9, 0.36], [0.05, 0.44, 0.9, 0.26], [0.05, 0.73, 0.6, 0.22], [0.68, 0.73, 0.27, 0.22]],
           [[0.05, 0.05, 0.9, 0.26], [0.05, 0.34, 0.9, 0.36], [0.38, 0.73, 0.57, 0.22], [0.05, 0.73, 0.3, 0.22]],
           [[0.05, 0.38, 0.55, 0.3], [0.05, 0.05, 0.9, 0.3], [0.63, 0.38, 0.32, 0.3], [0.05, 0.71, 0.9, 0.24]]] };
  const SP = { lay: 0, order: [0, 1, 2, 3], cur: null, downs: 0, seenDown: 0, spec: null, spin: mkSpin() };
  function drawSplitMode(w, h, now) {
    const land = skLand(w, h), set = SPLIT_LAYOUTS[land ? "land" : "port"];
    const d0 = decks[0];
    if (d0.down && d0.lastT !== SP.seenDown) {
      SP.seenDown = d0.lastT; SP.downs++;
      if (SP.downs % 4 === 0) { SP.lay = (SP.lay + 1) % set.length; SP.order.sort(() => Math.random() - 0.5); }
    }
    // blurred dim backdrop (soft color blobs)
    skBg(1);
    const lv = bandLevels();
    [[0.2, 0.3, lv[0], 0.1], [0.75, 0.6, lv[1], 0.5], [0.5, 0.9, lv[2], 0.9]].forEach(([x, y, v, t]) => {
      const gr = ctx2d.createRadialGradient(w * x, h * y, 0, w * x, h * y, Math.max(w, h) * 0.5);
      const [r, g, b] = bandColorAt(t, 1); gr.addColorStop(0, hueRgba(r, g, b, 0.08 + v * 0.25)); gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx2d.fillStyle = gr; ctx2d.fillRect(0, 0, w, h);
    });
    const tgt = set[SP.lay % set.length];
    if (!SP.cur || SP.cur.length !== 4 || SP.land !== land) { SP.cur = tgt.map((r) => r.slice()); SP.land = land; }
    for (let p = 0; p < 4; p++) {
      const t = tgt[SP.order[p]], c = SP.cur[p];
      for (let k = 0; k < 4; k++) c[k] += (t[k] - c[k]) * 0.12;
      const x = c[0] * w, y = c[1] * h, pw = c[2] * w, ph = c[3] * h, rad = 14 * dpr;
      ctx2d.fillStyle = "rgba(10,12,16,0.82)"; roundRectPath(x, y, pw, ph, rad); ctx2d.fill();
      ctx2d.strokeStyle = rgbaOf(CYAN, 0.25 + SK.kickFlash * 0.4); ctx2d.lineWidth = 1.5 * dpr; ctx2d.stroke();
      ctx2d.save(); roundRectPath(x, y, pw, ph, rad); ctx2d.clip();
      if (p === 0) { // platter
        const r = Math.min(pw, ph) * 0.36, cx = x + pw / 2, cy = y + ph / 2, a = skSpin(SP.spin, now, 1.2);
        skPlatterBody(cx, cy, r * 0.8, a, SK.kickFlash); skRingWave(cx, cy, r, r * 0.3, a, 90); skPlayhead(cx, cy, r);
      } else if (p === 1) { // big scrolling spectrum (spectrogram)
        const cw = Math.max(2, Math.round(2 * dpr));
        if (!SP.spec) { SP.spec = document.createElement("canvas"); SP.spec.width = 600; SP.spec.height = BAR_COUNT; }
        const sc = SP.spec.getContext("2d");
        sc.drawImage(SP.spec, -2, 0);
        for (let i = 0; i < BAR_COUNT; i++) { const v = smoothed[i], [r, g, b] = bandColorAt(i / BAR_COUNT, v + 0.2); sc.fillStyle = hueRgba(r, g, b, Math.min(1, v * 1.4)); sc.clearRect(598, BAR_COUNT - 1 - i, 2, 1); sc.fillRect(598, BAR_COUNT - 1 - i, 2, 1); }
        ctx2d.imageSmoothingEnabled = true; ctx2d.drawImage(SP.spec, x, y, pw, ph); void cw;
      } else if (p === 2) { // beat grid 1-4
        const live = now - d0.lastT < 2000 && d0.count > 0, n = live ? d0.count : 0;
        const cw = (pw - 10 * dpr * 5) / 4;
        for (let q = 1; q <= 4; q++) {
          const on = q === n, col = q === 1 ? ORANGE : CYAN;
          ctx2d.fillStyle = rgbaOf(col, on ? 0.6 + d0.flash * 0.4 : 0.12);
          roundRectPath(x + 10 * dpr + (q - 1) * (cw + 10 * dpr), y + ph * 0.2, cw, ph * 0.6, 8 * dpr); ctx2d.fill();
          ctx2d.fillStyle = on ? "#000" : "rgba(255,255,255,0.5)"; ctx2d.textAlign = "center";
          ctx2d.font = `800 ${Math.round(Math.min(cw, ph) * 0.4)}px -apple-system, sans-serif`;
          ctx2d.fillText(String(q), x + 10 * dpr + (q - 1) * (cw + 10 * dpr) + cw / 2, y + ph * 0.5 + Math.min(cw, ph) * 0.14);
        }
        ctx2d.font = `700 ${Math.round(11 * dpr)}px -apple-system, sans-serif`; ctx2d.fillStyle = "rgba(255,255,255,0.6)";
        ctx2d.fillText(skBpmText(now) + " BPM", x + pw / 2, y + ph * 0.14);
      } else { // level meter
        const segs = 16, lvl = Math.min(1, Math.max(meterCh1, meterCh2, (lv[0] + lv[1]) * 0.8));
        const vert = ph > pw * 0.6, sw = vert ? pw * 0.5 : (pw - 20 * dpr) / segs, shh = vert ? (ph - 20 * dpr) / segs : ph * 0.5;
        for (let s = 0; s < segs; s++) {
          const on = s / segs < lvl, col = s > segs * 0.85 ? [255, 40, 40] : s > segs * 0.65 ? [255, 170, 30] : [40, 230, 120];
          ctx2d.fillStyle = `rgba(${col},${on ? 0.95 : 0.12})`;
          if (vert) ctx2d.fillRect(x + pw * 0.25, y + ph - 10 * dpr - (s + 1) * shh + 1, sw, shh - 2);
          else ctx2d.fillRect(x + 10 * dpr + s * sw, y + ph * 0.25, sw - 2, shh);
        }
      }
      ctx2d.restore();
    }
  }

  // 5) Light Trails
  let ltCv = null; const ltP = [];
  function drawLightTrailsMode(w, h, now) {
    if (!ltCv || ltCv.width !== w || ltCv.height !== h) { ltCv = document.createElement("canvas"); ltCv.width = w; ltCv.height = h; }
    const c = ltCv.getContext("2d");
    c.globalCompositeOperation = "source-over"; c.fillStyle = "rgba(2,3,5,0.06)"; c.fillRect(0, 0, w, h);
    const cap = Math.round(Math.min(420, (w * h) / (dpr * dpr) / 900));
    const cols = ["255,40,60", "60,130,255", "255,255,255"];
    const N = 64, base = h * 0.94;
    const peaks = [];
    for (let i = 0; i < N; i++) { const v = smoothed[Math.floor((i / N) * BAR_COUNT)]; peaks.push(v); }
    const emit = (x, y, vx, vy, smear) => { if (ltP.length < cap) ltP.push({ x, y, vx, vy, l: 1, s: smear, c: cols[(Math.random() * 3) | 0] }); };
    for (let i = 0; i < N; i++) if (energyLive && peaks[i] > 0.3 && Math.random() < peaks[i] * 0.12) emit((i + 0.5) / N * w, base - peaks[i] * h * 0.15, (Math.random() - 0.5) * 0.3 * dpr, -(0.6 + peaks[i] * 1.6) * dpr, 0);
    if (skHot(now)) for (let k = 0; k < 10; k++) emit(Math.random() * w, base - Math.random() * h * 0.3, SK.dir * (8 + Math.random() * 14) * dpr, -(0.5 + Math.random()) * dpr, 1);
    if (SK.kickFlash > 0.75 && now - (SK.kickEv || 0) < 20) for (let k = 0; k < 30; k++) { const a = -Math.PI * Math.random(); const v = (2 + Math.random() * 4) * dpr; emit(w / 2, base, Math.cos(a) * v, Math.sin(a) * v, 0); }
    c.globalCompositeOperation = "lighter";
    for (let i = ltP.length - 1; i >= 0; i--) {
      const p = ltP[i], ox = p.x, oy = p.y;
      p.x += p.vx; p.y += p.vy; p.vx *= p.s ? 0.93 : 0.99; p.vy *= 0.995; p.l -= p.s ? 0.02 : 0.006;
      if (p.l <= 0 || p.y < -20) { ltP.splice(i, 1); continue; }
      c.strokeStyle = `rgba(${p.c},${p.l * 0.8})`; c.lineWidth = (p.s ? 2 : 2.5) * dpr;
      c.beginPath(); c.moveTo(ox, oy); c.lineTo(p.x, p.y); c.stroke();
    }
    ctx2d.drawImage(ltCv, 0, 0);
    // live bottom waveform
    ctx2d.beginPath(); ctx2d.moveTo(0, base);
    for (let i = 0; i < N; i++) ctx2d.lineTo((i + 0.5) / N * w, base - peaks[i] * h * 0.15);
    ctx2d.lineTo(w, base); ctx2d.closePath();
    const [r, g, b] = bandColorAt(0.5, 1); ctx2d.fillStyle = hueRgba(r, g, b, 0.35); ctx2d.fill();
    ctx2d.strokeStyle = "rgba(255,255,255,0.8)"; ctx2d.lineWidth = 1.5 * dpr; ctx2d.stroke();
  }

  // 6) Skratch Bastid (Serato DJ iOS landscape tribute)
  const sbSpin = [mkSpin(), mkSpin()]; const sbPad = new Float32Array(16);
  const SB_PADS = ["255,40,60", "255,140,0", "255,220,0", "40,230,90", "0,220,255", "40,90,255", "170,60,255", "255,60,190"];
  let sbSeen = [0, 0], sbScrSeen = 0;
  function drawSkratchBastidMode(w, h, now) {
    skBg(1);
    const land = skLand(w, h);
    for (let d = 0; d < 2; d++) if (decks[d].lastT !== sbSeen[d]) { sbSeen[d] = decks[d].lastT; sbPad[d * 8 + ((decks[d].count || 1) - 1)] = 1; }
    if (SK.scratchT !== sbScrSeen && SK.scratchT) { sbScrSeen = SK.scratchT; sbPad[((Math.random() * 2) | 0) * 8 + 4 + ((Math.random() * 4) | 0)] = 1; }
    for (let i = 0; i < 16; i++) sbPad[i] *= 0.9;
    const top = h * 0.04, platH = land ? h * 0.42 : h * 0.3;
    const r = Math.min(platH * 0.46, w * (land ? 0.16 : 0.22));
    for (let d = 0; d < 2; d++) {
      const cx = w * (d ? 0.75 : 0.25), cy = top + platH / 2, a = skSpin(sbSpin[d], now, d ? 0.6 : 1.4);
      skPlatterBody(cx, cy, r * 0.78, a, decks[d].flash);
      skRingWave(cx, cy, r, r * 0.28, a, 80); skPlayhead(cx, cy, r);
      const b = deckBpm(decks[d], now) || (bpmConfident ? bpmDisplay : 0);
      ctx2d.textAlign = "center"; ctx2d.fillStyle = "#fff";
      ctx2d.font = `800 ${Math.round(r * 0.28)}px -apple-system, sans-serif`; ctx2d.fillText(b ? b.toFixed(1) : "--.-", cx, cy + r * 0.1);
      ctx2d.font = `700 ${Math.round(Math.max(9 * dpr, r * 0.1))}px -apple-system, sans-serif`;
      ctx2d.fillStyle = d ? rgbaOf(CYAN, 0.9) : rgbaOf(ORANGE, 0.9);
      ctx2d.fillText("DECK " + (d + 1), cx + (d ? 1 : -1) * r * 1.55, cy - r * 0.8);
    }
    // middle scrolling waveform w/ beat grid
    const wy = top + platH + h * 0.02, wh = land ? h * 0.2 : h * 0.22;
    ctx2d.fillStyle = "#08090c"; ctx2d.fillRect(0, wy, w, wh);
    const colPx = 2 * dpr;
    skWave(0, wy, w * 0.5, wh / 2, colPx, 0.95); // past to center
    ctx2d.save(); ctx2d.translate(w, 0); ctx2d.scale(-1, 1); skWave(0, wy + wh / 2, w * 0.5, wh / 2, colPx, 0.6); ctx2d.restore();
    sxBeatGrid(now, colPx, w * 0.5, (off, down) => { ctx2d.fillStyle = down ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)"; ctx2d.fillRect(w * 0.5 - off, wy, down ? 2 * dpr : dpr, wh / 2); ctx2d.fillRect(w * 0.5 + off, wy + wh / 2, down ? 2 * dpr : dpr, wh / 2); });
    ctx2d.fillStyle = "#fff"; ctx2d.fillRect(w * 0.5 - dpr, wy, 2 * dpr, wh);
    // pads 2x4 per deck
    const py = wy + wh + h * 0.03, pAreaH = h - py - h * 0.04, gap = 6 * dpr;
    const halfW = w * 0.46, ph = (pAreaH - gap) / 2, pw = (halfW - gap * 3) / 4;
    for (let d = 0; d < 2; d++) {
      const x0 = d ? w - w * 0.02 - halfW : w * 0.02;
      for (let i = 0; i < 8; i++) {
        const v = sbPad[d * 8 + i], col = SB_PADS[i], x = x0 + (i % 4) * (pw + gap), y = py + Math.floor(i / 4) * (ph + gap);
        ctx2d.fillStyle = `rgba(${col},${0.15 + v * 0.85})`;
        roundRectPath(x, y, pw, ph, 6 * dpr); ctx2d.fill();
        if (v > 0.3) { ctx2d.strokeStyle = `rgba(255,255,255,${v * 0.8})`; ctx2d.lineWidth = 2 * dpr; ctx2d.stroke(); }
      }
    }
    // kaleidoscope flash on big drops
    if (SK.drop > 0.1) {
      ctx2d.save(); ctx2d.globalAlpha = SK.drop * 0.5; ctx2d.globalCompositeOperation = "lighter";
      const sn = skSnap(w, h, now);
      ctx2d.translate(w, 0); ctx2d.scale(-1, 1); ctx2d.drawImage(sn, 0, 0, w, h);
      ctx2d.setTransform(1, 0, 0, -1, 0, h); ctx2d.drawImage(sn, 0, 0, w, h);
      ctx2d.restore();
    }
    // VHS flicker on scratches
    if (SK.scratch > 0.3) { skTears(w, h, SK.scratch, 4); skScanlines(w, h, SK.scratch * 0.6); if (SK.scratch > 0.6) skStatic(w, h, SK.scratch * 0.5); }
  }
  // ---- v26: Space modes (Sonar v2, Black Hole, Warp, Hyperspace, Pulsar) ----
  const SPC = { act: 0, spin: 0, shock: 0, seenP: 0, seenB: 0, seenK: 0, hatT: 0, jump: 0, jumpT: 0, flash: 0,
    bh: [], sparks: [], stars: [], hrings: [], hlines: [], ps: [], sonR: [], sonB: [], sweep: 0, w: 0, h: 0, hueRot: 0, pAng: 0 };
  const TAU = Math.PI * 2;
  function spCap(w, h, per, lo, hi) { return Math.max(lo, Math.min(hi, Math.round((w * h) / (dpr * dpr) / per))); }
  function spCol(c, a) { return hueRgba(c[0], c[1], c[2], a); }
  function spMix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  const SP_WHITE = [255, 255, 255];
  function spBpm(now) { const b = deckBpm(decks[0], now) || (bpmConfident && bpmDisplay > 0 ? bpmDisplay : 0); return b > 40 && b < 200 ? b : 90; }
  // shared per-frame analysis: returns events this frame (no events on silence)
  function spAnalyze(now, kick, bass, energy, sens) {
    sampleAndPushWave(kick, bass, energy, sens, now);
    skAnalyze(now, kick, energy, sens);
    const live = energy > 0.025;
    SPC.act += ((live ? Math.min(1, energy * 3 + 0.25) : 0) - SPC.act) * 0.05;
    const ev = { beat: null, boom: null, down: false, hat: false, kickEv: false, live };
    const p = newestSince(pulses, SPC.seenP);
    if (p) { SPC.seenP = p.t0; if (live) { ev.beat = p; if (beatCount === 1) ev.down = true; } }
    const b = newestSince(booms, SPC.seenB);
    if (b) { SPC.seenB = b.t0; if (live) { ev.boom = b; ev.kickEv = true; } }
    if (SK.kickEv && SK.kickEv !== SPC.seenK) { SPC.seenK = SK.kickEv; if (live) { ev.kickEv = true; if (decks[0].down) ev.down = true; } }
    const hiE = SK.hiE || 0;
    if (live && now - SPC.hatT > 110 && hiE > 0.06 && hiE > SK.hiSlow * 1.3 && hiE - SK.hiSlow > 0.02) { SPC.hatT = now; ev.hat = true; }
    const bpm = spBpm(now);
    SPC.spin = (bpm / 90) * (0.15 + SPC.act * 0.85);
    SPC.shock *= 0.9; SPC.flash *= 0.88;
    const mid = SK.midE || 0;
    SPC.hueRot = SPC.hueRot * 0.97 + (hiE - SK.kickSlow) * 0.03;
    return Object.assign(ev, { bpm, mid, hi: hiE, kick, bass, energy, kf: SK.kickFlash, scr: SK.scratch, I: 0.75 + userScale * 0.25 });
  }
  function spFeedback(w, h, zoom, alpha, rot) {
    ctx2d.save();
    ctx2d.globalAlpha = alpha;
    ctx2d.translate(w / 2, h / 2); if (rot) ctx2d.rotate(rot); ctx2d.scale(zoom, zoom); ctx2d.translate(-w / 2, -h / 2);
    ctx2d.drawImage(els.canvas, 0, 0, w, h);
    ctx2d.restore();
  }
  function spGlow(x, y, r, c, a) {
    const g = ctx2d.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, spCol(c, a)); g.addColorStop(1, spCol(c, 0));
    ctx2d.fillStyle = g; ctx2d.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ===== Sonar v2 =====
  function drawSonarModeV2(w, h, now, kick, bass, energy, sens) {
    const E = spAnalyze(now, kick, bass, energy, sens);
    const cx = w * 0.5, cy = h * (w > h ? 0.5 : 0.46), minDim = Math.min(w, h);
    const S = 0.8 + userScale * 0.2;
    const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) * 0.95 * S;
    const gridR = minDim * 0.47 * Math.min(1.08, S);
    // depth: zooming feedback + downbeat warp
    spFeedback(w, h, 1.01 + SPC.shock * 0.05, 0.12 + SPC.act * 0.08, SPC.shock * 0.02);
    const sp = currentTheme.spectral;
    const push = (o) => { SPC.sonR.push(o); while (SPC.sonR.length > 18) SPC.sonR.shift(); };
    if (E.kickEv || (E.beat && E.beat.strength > 0.6)) push({ t0: now, life: 2600, w: 7, col: sp.bass, str: E.boom ? 1 : 0.8, snap: spectrumSnap(0, 1) });
    else if (E.beat) push({ t0: now, life: 2300, w: 4, col: E.mid > E.hi ? sp.mid : sp.high, str: 0.6, snap: spectrumSnap(0, 1) });
    if (E.hat) push({ t0: now, life: 1100, w: 1.3, col: sp.high, str: 0.5, snap: null });
    if (E.down) { SPC.shock = 1; push({ t0: now, life: 1800, w: 22, col: BOOM || sp.bass, str: 1, deep: true, snap: null }); }
    // well
    const well = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    well.addColorStop(0, spCol(CYAN, 0.06 + E.kf * 0.1)); well.addColorStop(0.6, "rgba(3,8,12,0.3)"); well.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx2d.fillStyle = well; ctx2d.fillRect(0, 0, w, h);
    // radar grid with degree ticks
    ctx2d.save();
    ctx2d.strokeStyle = spCol(CYAN, 0.13); ctx2d.lineWidth = dpr;
    for (let i = 1; i <= 4; i++) { ctx2d.beginPath(); ctx2d.arc(cx, cy, (gridR * i) / 4, 0, TAU); ctx2d.stroke(); }
    ctx2d.beginPath();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx2d.moveTo(cx + Math.cos(a) * gridR * 0.08, cy + Math.sin(a) * gridR * 0.08); ctx2d.lineTo(cx + Math.cos(a) * gridR, cy + Math.sin(a) * gridR); }
    ctx2d.strokeStyle = spCol(CYAN, 0.06); ctx2d.stroke();
    ctx2d.beginPath();
    for (let i = 0; i < 72; i++) { const a = (i / 72) * TAU, t0 = i % 9 === 0 ? 0.93 : i % 3 === 0 ? 0.955 : 0.975; ctx2d.moveTo(cx + Math.cos(a) * gridR * t0, cy + Math.sin(a) * gridR * t0); ctx2d.lineTo(cx + Math.cos(a) * gridR, cy + Math.sin(a) * gridR); }
    ctx2d.strokeStyle = spCol(CYAN, 0.28); ctx2d.stroke();
    ctx2d.fillStyle = spCol(CYAN, 0.35); ctx2d.font = `${Math.round(9 * dpr)}px ui-monospace,monospace`; ctx2d.textAlign = "center"; ctx2d.textBaseline = "middle";
    for (let d = 0; d < 360; d += 30) { const a = (d / 180) * Math.PI - Math.PI / 2; ctx2d.fillText(String(d).padStart(3, "0"), cx + Math.cos(a) * gridR * 1.06, cy + Math.sin(a) * gridR * 1.06); }
    ctx2d.restore();
    // sweep with afterglow
    SPC.sweep += (0.008 + E.energy * 0.012) * (0.5 + SPC.spin * 0.6) * (SK.dt / 16.7);
    const sw = SPC.sweep;
    ctx2d.save(); ctx2d.globalCompositeOperation = "lighter";
    const wedge = 0.9, steps = 14;
    for (let i = 0; i < steps; i++) {
      const a1 = sw - (i / steps) * wedge, a0 = sw - ((i + 1) / steps) * wedge;
      ctx2d.beginPath(); ctx2d.moveTo(cx, cy); ctx2d.arc(cx, cy, gridR, a0, a1); ctx2d.closePath();
      ctx2d.fillStyle = spCol(CYAN, 0.12 * Math.pow(1 - i / steps, 2) * (0.6 + SPC.act * 0.6)); ctx2d.fill();
    }
    ctx2d.beginPath(); ctx2d.moveTo(cx, cy); ctx2d.lineTo(cx + Math.cos(sw) * gridR, cy + Math.sin(sw) * gridR);
    ctx2d.strokeStyle = spCol(CYAN, 0.85); ctx2d.lineWidth = 2 * dpr; ctx2d.stroke();
    // rings (ripple with mids)
    const rip = E.mid * 0.06 * E.I;
    for (let k = SPC.sonR.length - 1; k >= 0; k--) {
      const R = SPC.sonR[k], age = (now - R.t0) / R.life;
      if (age >= 1) { SPC.sonR.splice(k, 1); continue; }
      const ease = 1 - Math.pow(1 - age, R.deep ? 2.2 : 1.6);
      const r = ease * maxR * (R.deep ? 1.15 : 1), a = (1 - age) * (0.35 + R.str * 0.65);
      const N = 96;
      ctx2d.beginPath();
      for (let i = 0; i <= N; i++) {
        const t = (i % N) / N, ang = t * TAU;
        let rr = r * (1 + Math.sin(ang * 6 + now * 0.004 + k) * rip + Math.sin(ang * 11 - now * 0.006) * rip * 0.5);
        if (R.snap) { const si = Math.floor((t < 0.5 ? t * 2 : (1 - t) * 2) * (SNAP_N - 1)); rr += R.snap[si] * minDim * 0.03 * (1 - age); }
        const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
        i ? ctx2d.lineTo(x, y) : ctx2d.moveTo(x, y);
      }
      ctx2d.strokeStyle = spCol(R.col, a * (R.deep ? 0.35 : 1)); ctx2d.lineWidth = Math.max(1, R.w * S * (1 - age * 0.6) * dpr); ctx2d.stroke();
      if (R.w > 3) { ctx2d.strokeStyle = spCol(R.col, a * 0.1); ctx2d.lineWidth = R.w * 3 * S * dpr; ctx2d.stroke(); }
      // contact: sweep crossing ring -> blip
      if (!R.deep && r < gridR && (!R.lastB || now - R.lastB > 140)) {
        R.lastB = now;
        SPC.sonB.push({ t0: now, a: sw, r, col: R.col, size: (2 + R.w) * dpr });
        if (SPC.sonB.length > 50) SPC.sonB.shift();
      }
    }
    // ring-ring contacts (where neighbouring ripple rings intersect) on beats
    if (E.beat && SPC.sonR.length > 1) for (let i = 0; i < 3; i++) SPC.sonB.push({ t0: now, a: Math.random() * TAU, r: gridR * (0.25 + Math.random() * 0.7), col: bandColorAt(Math.random(), 0.9), size: (3 + E.beat.strength * 4) * dpr });
    for (let i = SPC.sonB.length - 1; i >= 0; i--) {
      const bl = SPC.sonB[i], age = (now - bl.t0) / 2200;
      if (age >= 1) { SPC.sonB.splice(i, 1); continue; }
      let d = (sw - bl.a) % TAU; if (d < 0) d += TAU;
      const lit = d < 0.25 ? 1 - d / 0.25 : 0;
      const x = cx + Math.cos(bl.a) * bl.r, y = cy + Math.sin(bl.a) * bl.r;
      spGlow(x, y, bl.size * (3 + lit * 2), bl.col, (1 - age) * (0.35 + lit * 0.65));
    }
    // downbeat bass glow
    if (SPC.shock > 0.05) spGlow(cx, cy, maxR * 0.7, BOOM || CYAN, SPC.shock * 0.25);
    // transducer
    traceSpectralRing(cx, cy, minDim * 0.035, spectrumSnap(0, 1), minDim * 0.06, 1, 1, -Math.PI / 2);
    ctx2d.fillStyle = spCol(ORANGE, 0.25 + E.energy * 0.4); ctx2d.fill();
    ctx2d.beginPath(); ctx2d.arc(cx, cy, minDim * (0.012 + E.kf * 0.014), 0, TAU); ctx2d.fillStyle = `rgba(255,255,255,${0.6 + E.kf * 0.4})`; ctx2d.fill();
    ctx2d.restore();
  }

  // ===== Black Hole =====
  function bhSpawn(o, R, outer, fresh) {
    o.r = R * (1.6 + Math.random() * (outer - 1.6)); o.a = Math.random() * TAU; o.z = (Math.random() - 0.5) * 0.08;
    o.t = Math.random(); o.fall = 0; o.sz = 0.6 + Math.random() * 1.6; o.fresh = fresh;
  }
  function drawBlackHoleMode(w, h, now, kick, bass, energy, sens) {
    const E = spAnalyze(now, kick, bass, energy, sens);
    const dt = SK.dt / 16.7, cx = w / 2, cy = h * 0.5, minDim = Math.min(w, h);
    const land = w > h, S = E.I;
    const R0 = minDim * (land ? 0.1 : 0.095);
    const R = R0 * (1 + E.bass * 0.18 * S + E.kf * 0.08);
    const outer = (land ? 4.8 : 4.4) * Math.min(1.25, 0.85 + S * 0.15);
    const tilt = land ? 0.2 : 0.3;
    const N = spCap(w, h, 900, 160, 520);
    const P = SPC.bh;
    while (P.length < N) { const o = {}; bhSpawn(o, R0, outer, false); P.push(o); }
    if (P.length > N) P.length = N;
    ctx2d.fillStyle = "rgba(0,0,0,0.25)"; ctx2d.fillRect(0, 0, w, h);
    spFeedback(w, h, 0.996, 0.25, 0.004 * SPC.spin);
    if (E.kickEv) for (const o of P) o.r -= (o.r - R) * 0.08 * S;
    const base = 0.035 * SPC.spin + 0.004;
    const proj = (r, a, z) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r * tilt + z * r];
    const sp = currentTheme.spectral;
    const drawHalf = (front) => {
      ctx2d.globalCompositeOperation = "lighter";
      ctx2d.lineCap = "round";
      for (const o of P) {
        const sa = Math.sin(o.a);
        if ((sa > 0) !== front) continue;
        const rn = o.r / R0;
        const om = base * Math.pow(1.6 / Math.max(1, rn), 1.4);
        const heat = Math.max(0, Math.min(1, 1.25 - rn / outer * 1.2));
        const col = spMix(spMix(sp.bass, ORANGE, o.t), spMix(sp.high, SP_WHITE, 0.5), heat * heat);
        const tail = om * (6 + E.energy * 10) * (1 + o.fall * 6);
        const [x0, y0] = proj(o.r * (1 + o.fall * 0.15), o.a - tail, o.z);
        const [x1, y1] = proj(o.r, o.a, o.z);
        const dop = 0.55 + 0.45 * Math.cos(o.a); // brighter on approaching side
        ctx2d.strokeStyle = spCol(col, Math.min(1, (0.25 + heat * 0.7) * dop * (1 - o.fall) * (0.5 + SPC.act * 0.5 + E.kf * 0.4)));
        ctx2d.lineWidth = Math.max(0.6, o.sz * dpr * (1 + heat) * (1 - o.fall * 0.7));
        ctx2d.beginPath(); ctx2d.moveTo(x0, y0); ctx2d.lineTo(x1, y1); ctx2d.stroke();
      }
    };
    // update
    for (const o of P) {
      const rn = o.r / R0;
      o.a += base * Math.pow(1.6 / Math.max(1, rn), 1.4) * dt;
      o.r -= (0.0008 + SPC.act * 0.0025) * R0 * dt * (2.5 / Math.max(0.6, rn));
      if (o.r < R * 1.35) o.fall = Math.min(1, o.fall + 0.05 * dt);
      if (o.fall >= 1 || o.r < R * 0.9) bhSpawn(o, R0, outer, true);
    }
    ctx2d.save();
    // back disc
    drawHalf(false);
    // lensed band arcing over the top
    ctx2d.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      ctx2d.beginPath();
      ctx2d.ellipse(cx, cy, R * (1.35 + i * 0.25), R * (1.2 + i * 0.2), 0, Math.PI, TAU);
      ctx2d.strokeStyle = spCol(spMix(ORANGE, SP_WHITE, 0.3 - i * 0.1), (0.35 - i * 0.1) * (0.5 + SPC.act * 0.5 + E.kf * 0.4));
      ctx2d.lineWidth = R * (0.16 - i * 0.04) * (1 + E.mid * 0.6); ctx2d.stroke();
      ctx2d.beginPath();
      ctx2d.ellipse(cx, cy, R * (1.3 + i * 0.2), R * (1.08 + i * 0.12), 0, 0, Math.PI);
      ctx2d.strokeStyle = spCol(ORANGE, (0.18 - i * 0.05) * (0.5 + SPC.act * 0.5)); ctx2d.lineWidth = R * 0.06; ctx2d.stroke();
    }
    // horizon
    ctx2d.globalCompositeOperation = "source-over";
    const hz = ctx2d.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.25);
    hz.addColorStop(0, "rgba(0,0,0,1)"); hz.addColorStop(0.8, "rgba(0,0,0,1)"); hz.addColorStop(1, "rgba(0,0,0,0)");
    ctx2d.fillStyle = hz; ctx2d.beginPath(); ctx2d.arc(cx, cy, R * 1.25, 0, TAU); ctx2d.fill();
    // photon ring
    ctx2d.globalCompositeOperation = "lighter";
    ctx2d.beginPath(); ctx2d.arc(cx, cy, R * 1.02, 0, TAU);
    ctx2d.strokeStyle = spCol(spMix(ORANGE, SP_WHITE, 0.6), 0.55 + E.kf * 0.45); ctx2d.lineWidth = Math.max(1.2 * dpr, R * (0.025 + E.kf * 0.05)); ctx2d.stroke();
    ctx2d.strokeStyle = spCol(ORANGE, 0.15 + E.kf * 0.3); ctx2d.lineWidth = R * (0.1 + E.kf * 0.2); ctx2d.stroke();
    // front disc
    drawHalf(true);
    // jets + sparks from highs
    const jetA = 0.08 + E.hi * 0.4 + SPC.act * 0.05;
    for (const s of [-1, 1]) {
      const g = ctx2d.createLinearGradient(cx, cy, cx, cy + s * minDim * 0.6);
      g.addColorStop(0, spCol(spMix(CYAN, SP_WHITE, 0.4), jetA)); g.addColorStop(1, spCol(CYAN, 0));
      ctx2d.fillStyle = g; ctx2d.beginPath(); ctx2d.moveTo(cx - R * 0.08, cy); ctx2d.lineTo(cx - R * 0.35, cy + s * minDim * 0.6); ctx2d.lineTo(cx + R * 0.35, cy + s * minDim * 0.6); ctx2d.lineTo(cx + R * 0.08, cy); ctx2d.fill();
    }
    const SPK = SPC.sparks, nsp = E.live ? Math.round(E.hi * 8 * S + (E.hat ? 10 : 0) + E.scr * 10) : 0;
    for (let i = 0; i < nsp && SPK.length < 220; i++) { const s = Math.random() < 0.5 ? -1 : 1; SPK.push({ x: cx + (Math.random() - 0.5) * R * 0.2, y: cy + s * R * 0.9, vx: (Math.random() - 0.5) * 3 * dpr, vy: s * (4 + Math.random() * 8) * dpr, l: 1, c: Math.random() < 0.5 ? CYAN : SP_WHITE }); }
    for (let i = SPK.length - 1; i >= 0; i--) {
      const k = SPK[i]; k.x += k.vx * dt; k.y += k.vy * dt; k.l -= 0.025 * dt;
      if (k.l <= 0) { SPK.splice(i, 1); continue; }
      ctx2d.strokeStyle = spCol(k.c, k.l); ctx2d.lineWidth = 1.4 * dpr; ctx2d.beginPath(); ctx2d.moveTo(k.x, k.y); ctx2d.lineTo(k.x - k.vx * 2, k.y - k.vy * 2); ctx2d.stroke();
    }
    ctx2d.restore();
  }

  // ===== Warp =====
  function drawWarpMode(w, h, now, kick, bass, energy, sens) {
    const E = spAnalyze(now, kick, bass, energy, sens);
    const dt = SK.dt / 16.7, cx = w / 2, cy = h / 2, F = Math.max(w, h) * 0.5;
    const N = spCap(w, h, 700, 200, 650), st = SPC.stars;
    const spawn = (o, far) => { o.x = (Math.random() - 0.5) * 2; o.y = (Math.random() - 0.5) * 2; o.z = far ? 1 : 0.05 + Math.random(); o.pz = o.z; o.t = Math.random(); };
    while (st.length < N) { const o = {}; spawn(o, false); st.push(o); }
    if (st.length > N) st.length = N;
    if (SK.drop > 0.95 && now - SPC.jumpT > 3000) { SPC.jumpT = now; SPC.flash = 1; }
    const jt = (now - SPC.jumpT) / 900, jump = jt < 1 ? Math.sin(jt * Math.PI) : 0;
    let spd = 0.002 + SPC.act * 0.006 * (E.bpm / 90) + E.energy * 0.012 * E.I + E.kf * 0.018 * E.I + jump * 0.06;
    ctx2d.fillStyle = `rgba(0,0,0,${0.35 - Math.min(0.25, spd * 4)})`; ctx2d.fillRect(0, 0, w, h);
    ctx2d.save(); ctx2d.globalCompositeOperation = "lighter"; ctx2d.lineCap = "round";
    spGlow(cx, cy, F * (0.35 + E.kf * 0.15 + jump * 0.4), [120, 170, 255], 0.15 + E.energy * 0.25 + jump * 0.3);
    spGlow(cx, cy, F * 0.08, SP_WHITE, 0.3 + E.kf * 0.4);
    const stretch = 1 + spd * 60 + jump * 4;
    for (const o of st) {
      o.pz = o.z; o.z -= spd * dt * (0.6 + o.t * 0.8);
      if (o.z <= 0.01) { spawn(o, true); continue; }
      const x1 = cx + (o.x / o.z) * F, y1 = cy + (o.y / o.z) * F;
      if (x1 < -20 || x1 > w + 20 || y1 < -20 || y1 > h + 20) { spawn(o, true); continue; }
      const zt = Math.min(1, o.z + (o.pz - o.z) * stretch);
      const x0 = cx + (o.x / zt) * F, y0 = cy + (o.y / zt) * F;
      const near = 1 - o.z;
      const col = spMix(o.t < 0.5 ? CYAN : ORANGE, SP_WHITE, 0.35 + near * 0.4);
      ctx2d.strokeStyle = spCol(col, Math.min(1, near * 1.2));
      ctx2d.lineWidth = Math.max(0.7, near * 2.6 * dpr);
      ctx2d.beginPath(); ctx2d.moveTo(x0, y0); ctx2d.lineTo(x1 + 0.1, y1); ctx2d.stroke();
    }
    ctx2d.restore();
    if (SPC.flash > 0.03) { ctx2d.fillStyle = `rgba(255,255,255,${SPC.flash * 0.85})`; ctx2d.fillRect(0, 0, w, h); }
  }

  // ===== Hyperspace =====
  function drawHyperspaceMode(w, h, now, kick, bass, energy, sens) {
    const E = spAnalyze(now, kick, bass, energy, sens);
    const dt = SK.dt / 16.7, minDim = Math.min(w, h), F = Math.max(w, h) * 0.55;
    const wob = E.scr * minDim * 0.08;
    const cx = w / 2 + Math.sin(now * 0.03) * wob + Math.sin(now * 0.0005) * minDim * 0.03;
    const cy = h / 2 + Math.cos(now * 0.037) * wob + Math.cos(now * 0.0004) * minDim * 0.03;
    const spd = 0.004 + SPC.act * 0.008 * (E.bpm / 90) + E.energy * 0.01 * E.I + E.kf * 0.012;
    ctx2d.fillStyle = "rgba(0,2,10,0.45)"; ctx2d.fillRect(0, 0, w, h);
    const col = spectralColor(E.bass + 0.2, E.mid + 0.1, E.hi, 0.9);
    const twist = SPC.spin * 0.6 + E.mid * 1.2;
    SPC.pAng += (0.004 + SPC.spin * 0.01) * dt;
    // rings spawn on beats (+ idle slow ones)
    const R = SPC.hrings;
    if (E.beat || E.kickEv) R.push({ z: 1, s: E.kickEv ? 1 : 0.6, c: col.slice() });
    if (!R.length || R[R.length - 1].z < 0.75) R.push({ z: 1, s: 0.25, c: col.slice() });
    while (R.length > 24) R.shift();
    ctx2d.save(); ctx2d.globalCompositeOperation = "lighter"; ctx2d.lineCap = "round";
    const sides = 10, pts = [];
    for (let k = R.length - 1; k >= 0; k--) { const r = R[k]; r.z -= spd * 1.4 * dt; if (r.z <= 0.03) R.splice(k, 1); }
    for (const r of R) {
      const rad = (minDim * 0.42) / r.z, rot = SPC.pAng + r.z * twist * 3;
      const arr = [];
      for (let i = 0; i < sides; i++) { const a = rot + (i / sides) * TAU; arr.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
      pts.push(arr);
      const a = Math.min(1, (1 - r.z) * 1.4) * (0.3 + r.s * 0.7);
      ctx2d.beginPath(); arr.forEach((p, i) => (i ? ctx2d.lineTo(p[0], p[1]) : ctx2d.moveTo(p[0], p[1]))); ctx2d.closePath();
      ctx2d.strokeStyle = spCol(r.c, a); ctx2d.lineWidth = Math.max(1, (1 + r.s * 3) * dpr / Math.max(0.3, r.z) * 0.4); ctx2d.stroke();
    }
    // longitudinal grid lines
    ctx2d.strokeStyle = spCol(col, 0.18); ctx2d.lineWidth = dpr;
    for (let i = 0; i < sides; i++) { ctx2d.beginPath(); pts.forEach((arr, j) => (j ? ctx2d.lineTo(arr[i][0], arr[i][1]) : ctx2d.moveTo(arr[i][0], arr[i][1]))); ctx2d.stroke(); }
    // long light lines rushing past
    const L = SPC.hlines, N = spCap(w, h, 1400, 90, 300);
    while (L.length < N) L.push({ a: Math.random() * TAU, z: Math.random(), len: 0.3 + Math.random() * 0.5, t: Math.random() });
    if (L.length > N) L.length = N;
    for (const l of L) {
      l.z -= spd * 2.2 * dt;
      if (l.z <= 0.02) { l.z = 1; l.a = Math.random() * TAU; l.t = Math.random(); }
      const z0 = Math.min(1.2, l.z + l.len * (0.4 + spd * 40)), r0 = (minDim * 0.08) / z0, r1 = (minDim * 0.08) / l.z;
      const a = l.a + SPC.pAng * 0.3;
      const c = spMix(spMix([170, 200, 255], col, 0.4), SP_WHITE, l.t * 0.6);
      ctx2d.strokeStyle = spCol(c, Math.min(0.8, (1 - l.z) * 0.9)); ctx2d.lineWidth = Math.max(0.8, (1 - l.z) * 2.2 * dpr);
      ctx2d.beginPath(); ctx2d.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx2d.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx2d.stroke();
    }
    spGlow(cx, cy, minDim * (0.12 + E.kf * 0.08), spMix(col, SP_WHITE, 0.6), 0.35 + E.energy * 0.3);
    ctx2d.restore();
    // scratch glitch slices
    if (E.scr > 0.35) {
      const n = 2 + Math.round(E.scr * 5);
      for (let i = 0; i < n; i++) { const y = Math.random() * h, hh = Math.max(4, Math.random() * h * 0.05), dx = (Math.random() - 0.5) * minDim * 0.12 * E.scr; ctx2d.drawImage(els.canvas, 0, y, w, hh, dx, y, w, hh); }
    }
  }

  // ===== Pulsar (original) =====
  function drawPulsarMode(w, h, now, kick, bass, energy, sens) {
    const E = spAnalyze(now, kick, bass, energy, sens);
    const dt = SK.dt / 16.7, cx = w / 2, cy = h / 2, minDim = Math.min(w, h), S = E.I;
    const core = minDim * 0.045 * (1 + E.kf * 0.5 * S + E.bass * 0.15);
    spFeedback(w, h, 1.008, 0.2 + SPC.act * 0.1, 0);
    ctx2d.fillStyle = "rgba(0,0,6,0.3)"; ctx2d.fillRect(0, 0, w, h);
    // rotation: BPM-locked (2 beams per beat), scratches stutter/reverse
    const dir = E.scr > 0.4 ? SK.dir : 1;
    SPC.pAng += dir * (TAU / 2) * (SPC.spin * (E.bpm / 60000) * SK.dt * 0.5 + 0.0015 * dt) * (E.scr > 0.6 ? 2.5 : 1);
    const ang = SPC.pAng + (E.scr > 0.5 ? (Math.random() - 0.5) * 0.3 : 0);
    const tilt = 0.35;
    ctx2d.save(); ctx2d.globalCompositeOperation = "lighter";
    // spectrum halo (galaxy of bars around the star)
    const snap = spectrumSnap(0, 1), bars = 96, hr = minDim * 0.16;
    for (let i = 0; i < bars; i++) {
      const t = i / bars, si = Math.floor((t < 0.5 ? t * 2 : (1 - t) * 2) * (SNAP_N - 1)), v = snap[si];
      const a = t * TAU - ang * 0.15, l = minDim * (0.02 + v * 0.22 * S);
      const c = bandColorAt(si / SNAP_N, 0.8);
      ctx2d.strokeStyle = spCol(c, 0.25 + v * 0.7); ctx2d.lineWidth = Math.max(1, (TAU * hr / bars) * 0.55);
      ctx2d.beginPath(); ctx2d.moveTo(cx + Math.cos(a) * hr, cy + Math.sin(a) * hr); ctx2d.lineTo(cx + Math.cos(a) * (hr + l), cy + Math.sin(a) * (hr + l)); ctx2d.stroke();
    }
    // magnetic field loops wobble with mids
    for (let k = 0; k < 6; k++) {
      const s = 0.06 + k * 0.035, wob = 1 + Math.sin(now * 0.003 + k) * E.mid * 0.25 * S;
      ctx2d.beginPath();
      ctx2d.ellipse(cx, cy, minDim * s * 1.6 * wob, minDim * s * wob * 0.7, ang * 0.5 + Math.PI / 2, 0, TAU);
      ctx2d.strokeStyle = spCol(CYAN, 0.06 + E.mid * 0.25); ctx2d.lineWidth = dpr * 1.2; ctx2d.stroke();
    }
    // twin lighthouse beams (width from mids, brightness from kick)
    const BL = Math.hypot(w, h);
    for (const s of [0, Math.PI]) {
      const a = ang + s, wd = 0.05 + E.mid * 0.12 * S + E.kf * 0.05;
      const g = ctx2d.createRadialGradient(cx, cy, core, cx, cy, BL * 0.6);
      const bc = s ? ORANGE : CYAN;
      g.addColorStop(0, spCol(spMix(bc, SP_WHITE, 0.6), 0.4 + E.kf * 0.5 + SPC.act * 0.1)); g.addColorStop(0.35, spCol(bc, 0.15 + E.kf * 0.2)); g.addColorStop(1, spCol(bc, 0));
      ctx2d.fillStyle = g;
      ctx2d.beginPath(); ctx2d.moveTo(cx, cy);
      const p = (aa) => [cx + Math.cos(aa) * BL, cy + Math.sin(aa) * BL * (1 - tilt * 0.4)];
      const [x0, y0] = p(a - wd), [x1, y1] = p(a + wd);
      ctx2d.lineTo(x0, y0); ctx2d.lineTo(x1, y1); ctx2d.closePath(); ctx2d.fill();
    }
    // kick shock rings + highs sparkle crown
    const P = SPC.ps;
    if (E.kickEv) P.push({ k: "ring", t0: now, s: E.boom ? 1 : 0.7 });
    const nsp = E.live ? Math.round(E.hi * 6 * S + (E.hat ? 6 : 0) + E.scr * 8) : 0;
    for (let i = 0; i < nsp && P.length < 260; i++) { const a = Math.random() * TAU, v = (2 + Math.random() * 6) * dpr; P.push({ k: "sp", x: cx + Math.cos(a) * core, y: cy + Math.sin(a) * core, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c: E.scr > 0.4 ? ORANGE : SP_WHITE }); }
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i];
      if (q.k === "ring") {
        const age = (now - q.t0) / 1400; if (age >= 1) { P.splice(i, 1); continue; }
        ctx2d.beginPath(); ctx2d.arc(cx, cy, core + age * minDim * 0.6, 0, TAU);
        ctx2d.strokeStyle = spCol(spMix(BOOM || CYAN, SP_WHITE, 0.3), (1 - age) * 0.6 * q.s); ctx2d.lineWidth = (1 - age) * 8 * dpr * q.s; ctx2d.stroke();
      } else {
        q.x += q.vx * dt; q.y += q.vy * dt; q.l -= 0.03 * dt; if (q.l <= 0) { P.splice(i, 1); continue; }
        ctx2d.strokeStyle = spCol(q.c, q.l); ctx2d.lineWidth = 1.3 * dpr; ctx2d.beginPath(); ctx2d.moveTo(q.x, q.y); ctx2d.lineTo(q.x - q.vx * 2, q.y - q.vy * 2); ctx2d.stroke();
      }
    }
    // neutron star
    spGlow(cx, cy, core * (4 + E.kf * 4), spMix(CYAN, SP_WHITE, 0.5), 0.35 + E.kf * 0.5);
    ctx2d.globalCompositeOperation = "source-over";
    ctx2d.beginPath(); ctx2d.arc(cx, cy, core, 0, TAU); ctx2d.fillStyle = `rgba(255,255,255,${0.85 + E.kf * 0.15})`; ctx2d.fill();
    ctx2d.restore();
    if (E.scr > 0.5) skTears(w, h, E.scr * 0.6, 3);
  }
  // ===== v27: Pulsar sub-modes =====
  const PULSAR_SUBS = [
    { id: "classic", name: "Classic" }, { id: "twin", name: "Twin" }, { id: "split", name: "Split Beam" },
    { id: "magnetar", name: "Magnetar" }, { id: "quasar", name: "Quasar" }, { id: "supernova", name: "Supernova" }];
  const PSUB_KEY = "lighto-pulsar-sub";
  let pulsarSub = 0;
  try { const s = localStorage.getItem(PSUB_KEY); const i = PULSAR_SUBS.findIndex((m) => m.id === s); if (i >= 0) pulsarSub = i; } catch (_) {}
  const PS = { fast: 0, slow: 0, build: 0, drop: 0, orbit: 0, sep: 1, flare: 0, nb: 1, nbT: 0, strobe: 0, cracks: [], cT: 0,
    arcs: [], loopsSnap: 0, disc: [], tension: 0, nova: 0, novaT: 0, lastNova: 0, shell: [], reform: 1 };
  // shared: energy trend (build-up) + drop detection — only from real detector events
  function psTrend(E, now) {
    PS.fast += (E.energy - PS.fast) * 0.08; PS.slow += (E.energy - PS.slow) * 0.008;
    const rising = E.live ? Math.max(0, Math.min(1, (PS.fast - PS.slow) * 8)) : 0;
    PS.build += (rising - PS.build) * 0.03;
    PS.drop *= 0.93;
    if (E.boom && (PS.build > 0.25 || E.down || E.kf > 0.7)) PS.drop = 1;
    else if (E.kickEv && E.down) PS.drop = Math.max(PS.drop, 0.7);
  }
  function psCtx(E) { const dir = E.scr > 0.4 ? SK.dir : 1; return dir; }
  function psSpin(E, mult) {
    const dir = psCtx(E), dt = SK.dt / 16.7;
    SPC.pAng += dir * (TAU / 2) * (SPC.spin * (E.bpm / 60000) * SK.dt * 0.5 + 0.0015 * dt) * (E.scr > 0.6 ? 2.5 : 1) * (mult || 1);
    return SPC.pAng + (E.scr > 0.5 ? (Math.random() - 0.5) * 0.3 : 0);
  }
  function psBeam(cx, cy, a, wd, core, BL, bc, alpha, squash) {
    const g = ctx2d.createRadialGradient(cx, cy, core, cx, cy, BL * 0.6);
    g.addColorStop(0, spCol(spMix(bc, SP_WHITE, 0.6), Math.min(1, alpha))); g.addColorStop(0.35, spCol(bc, alpha * 0.35)); g.addColorStop(1, spCol(bc, 0));
    ctx2d.fillStyle = g; ctx2d.beginPath(); ctx2d.moveTo(cx, cy);
    const sq = squash == null ? 0.86 : squash;
    ctx2d.lineTo(cx + Math.cos(a - wd) * BL, cy + Math.sin(a - wd) * BL * sq);
    ctx2d.lineTo(cx + Math.cos(a + wd) * BL, cy + Math.sin(a + wd) * BL * sq); ctx2d.closePath(); ctx2d.fill();
  }
  function psStar(cx, cy, core, E, tint, extra) {
    spGlow(cx, cy, core * (4 + E.kf * 4 + (extra || 0) * 6), spMix(tint || CYAN, SP_WHITE, 0.5), Math.min(1, 0.35 + E.kf * 0.5 + (extra || 0) * 0.5));
    ctx2d.save(); ctx2d.globalCompositeOperation = "source-over";
    ctx2d.beginPath(); ctx2d.arc(cx, cy, core, 0, TAU); ctx2d.fillStyle = `rgba(255,255,255,${Math.min(1, 0.85 + E.kf * 0.15)})`; ctx2d.fill(); ctx2d.restore();
  }
  // particles: rings + sparks (capped by screen size)
  function psParticles(E, now, cx, cy, core, minDim, w, h, ringCol) {
    const P = SPC.ps, cap = spCap(w, h, 3500, 60, 260), dt = SK.dt / 16.7, S = E.I;
    if (E.kickEv) P.push({ k: "ring", t0: now, s: E.boom ? 1 : 0.7, x: cx, y: cy });
    const nsp = E.live ? Math.round(E.hi * 6 * S + (E.hat ? 6 : 0) + E.scr * 8) : 0;
    for (let i = 0; i < nsp && P.length < cap; i++) { const a = Math.random() * TAU, v = (2 + Math.random() * 6) * dpr; P.push({ k: "sp", x: cx + Math.cos(a) * core, y: cy + Math.sin(a) * core, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c: E.scr > 0.4 ? ORANGE : SP_WHITE }); }
    psRun(P, now, core, minDim, dt, ringCol);
  }
  function psRun(P, now, core, minDim, dt, ringCol) {
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i];
      if (q.k === "knot") continue;
      if (q.k === "ring") {
        const age = (now - q.t0) / 1400; if (age >= 1) { P.splice(i, 1); continue; }
        ctx2d.beginPath(); ctx2d.arc(q.x, q.y, core + age * minDim * 0.6, 0, TAU);
        ctx2d.strokeStyle = spCol(spMix(ringCol || BOOM || CYAN, SP_WHITE, 0.3), (1 - age) * 0.6 * q.s); ctx2d.lineWidth = (1 - age) * 8 * dpr * q.s; ctx2d.stroke();
      } else {
        q.x += q.vx * dt; q.y += q.vy * dt; q.l -= 0.03 * dt; if (q.l <= 0) { P.splice(i, 1); continue; }
        ctx2d.strokeStyle = spCol(q.c, q.l); ctx2d.lineWidth = 1.3 * dpr; ctx2d.beginPath(); ctx2d.moveTo(q.x, q.y); ctx2d.lineTo(q.x - q.vx * 2, q.y - q.vy * 2); ctx2d.stroke();
      }
    }
  }
  function psBg(E, zoom) { spFeedback(els.canvas.width, els.canvas.height, zoom || 1.008, 0.2 + SPC.act * 0.1, 0); ctx2d.fillStyle = "rgba(0,0,6,0.3)"; ctx2d.fillRect(0, 0, els.canvas.width, els.canvas.height); }
  const MAGENTA_C = [255, 60, 200], BLUE_C = [70, 130, 255];

  // --- Twin: binary pulsar ---
  function drawPulsarTwin(w, h, now, kick, bass, energy, sens) {
    const E = spAnalyze(now, kick, bass, energy, sens); psTrend(E, now);
    const cx = w / 2, cy = h / 2, minDim = Math.min(w, h), S = E.I, dt = SK.dt / 16.7;
    psBg(E);
    const ang = psSpin(E, 1.2);
    // orbit: one revolution per 2 bars (8 beats), BPM-locked; idles slowly
    PS.orbit += (TAU / 8) * (E.bpm / 60000) * SK.dt * (0.15 + SPC.act * 0.85) * (E.scr > 0.6 ? -SK.dir * 0 + 1 : 1);
    const sepT = 0.24 - PS.build * 0.12 + PS.drop * 0.06;
    PS.sep += (sepT - PS.sep) * 0.05; if (PS.sep > 0.4) PS.sep = sepT;
    PS.flare = Math.max(PS.flare * 0.94, PS.drop > 0.95 ? 1 : 0);
    const r = minDim * PS.sep * (0.9 + userScale * 0.1);
    const stars = [0, Math.PI].map((o) => [cx + Math.cos(PS.orbit + o) * r, cy + Math.sin(PS.orbit + o) * r * 0.55]);
    const core = minDim * 0.032 * (1 + E.kf * 0.5 * S + E.bass * 0.15 + PS.flare * 0.8);
    ctx2d.save(); ctx2d.globalCompositeOperation = "lighter";
    // orbit trail
    ctx2d.beginPath(); ctx2d.ellipse(cx, cy, r, r * 0.55, 0, 0, TAU); ctx2d.strokeStyle = spCol(CYAN, 0.06 + SPC.act * 0.08); ctx2d.lineWidth = dpr; ctx2d.stroke();
    // gravitational ripples from barycentre on kicks
    const P = SPC.ps;
    if (E.kickEv) P.push({ k: "ring", t0: now, s: E.boom ? 1 : 0.6, x: cx, y: cy });
    const BL = Math.hypot(w, h), wd = 0.04 + E.mid * 0.1 * S + E.kf * 0.04 + PS.flare * 0.08;
    const pals = [[CYAN, BLUE_C], [ORANGE, MAGENTA_C]];
    stars.forEach(([x, y], i) => {
      const a = ang * (i ? -1.15 : 1) + i * 1.1;
      psBeam(x, y, a, wd, core, BL, pals[i][0], 0.35 + E.kf * 0.45 + PS.flare * 0.4 + SPC.act * 0.1);
      psBeam(x, y, a + Math.PI, wd, core, BL, pals[i][1], 0.3 + E.kf * 0.4 + PS.flare * 0.4);
    });
    // tidal bridge between stars
    ctx2d.beginPath(); ctx2d.moveTo(stars[0][0], stars[0][1]);
    ctx2d.quadraticCurveTo(cx + Math.sin(now * 0.002) * r * 0.3 * E.mid, cy, stars[1][0], stars[1][1]);
    ctx2d.strokeStyle = spCol(spMix(CYAN, ORANGE, 0.5), 0.1 + E.mid * 0.4 + PS.build * 0.3); ctx2d.lineWidth = (1 + E.bass * 3) * dpr; ctx2d.stroke();
    const cap = spCap(w, h, 3500, 60, 260);
    const nsp = E.live ? Math.round(E.hi * 4 * S + (E.hat ? 4 : 0) + E.scr * 6 + PS.flare * 10) : 0;
    for (let i = 0; i < nsp && P.length < cap; i++) { const s = stars[i & 1], a = Math.random() * TAU, v = (2 + Math.random() * 6) * dpr; P.push({ k: "sp", x: s[0], y: s[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c: i & 1 ? ORANGE : CYAN }); }
    psRun(P, now, core, minDim, dt, spMix(CYAN, ORANGE, 0.5));
    stars.forEach(([x, y], i) => psStar(x, y, core, E, i ? ORANGE : CYAN, PS.flare));
    ctx2d.restore();
    if (E.scr > 0.5) skTears(w, h, E.scr * 0.6, 3);
  }

  // --- Split Beam: disco lighthouse ---
  function drawPulsarSplit(w, h, now, kick, bass, energy, sens) {
    const E = spAnalyze(now, kick, bass, energy, sens); psTrend(E, now);
    const cx = w / 2, cy = h / 2, minDim = Math.min(w, h), S = E.I;
    psBg(E);
    const ang = psSpin(E, 1);
    // target split count: drops/high energy fan out, quiet collapses back
    let tgt = 1;
    if (E.live) { if (PS.drop > 0.6 || PS.fast > 0.45) tgt = 4; else if (PS.fast > 0.28 || PS.drop > 0.3) tgt = 2; }
    if (PS.drop > 0.95) tgt = 4;
    if (tgt > PS.nb) { PS.nb = tgt; PS.nbT = now; } else if (tgt < PS.nb && now - PS.nbT > 2500) { PS.nb = Math.max(tgt, PS.nb / 2); PS.nbT = now; }
    PS.fan = (PS.fan || 1) + (PS.nb - (PS.fan || 1)) * 0.08;
    const pairs = PS.fan; // 1..4 pairs → 2..8 beams
    const core = minDim * 0.045 * (1 + E.kf * 0.5 * S + E.bass * 0.15);
    const strobe = E.scr > 0.35 ? ((now / 45) | 0) % 2 : 1;
    ctx2d.save(); ctx2d.globalCompositeOperation = "lighter";
    const BL = Math.hypot(w, h), n = Math.ceil(pairs - 0.01), spread = 0.55 * Math.min(1, pairs / 2);
    if (strobe) for (let j = 0; j < n; j++) {
      const vis = Math.min(1, pairs - j + 0.0001);
      const off = n > 1 ? (j / (n - 1) - 0.5) * spread * 2 * Math.min(1, (pairs - 1) / 1) : 0;
      const wd = (0.045 + E.mid * 0.08 * S + E.kf * 0.04) / Math.sqrt(n);
      for (const s of [0, Math.PI]) {
        const bc = bandColorAt((j / Math.max(1, n)) * 0.8 + (s ? 0.1 : 0), 0.8);
        psBeam(cx, cy, ang + s + off, wd, core, BL, spMix(s ? ORANGE : CYAN, bc, n > 1 ? 0.5 : 0), (0.35 + E.kf * 0.5 + SPC.act * 0.1) * vis);
      }
    }
    // mirror-ball dots on the fan
    const dots = Math.round(n * 6);
    for (let i = 0; i < dots && E.live; i++) {
      const a = ang + (i / dots) * TAU * 3 + now * 0.0004, rr = minDim * (0.2 + ((i * 37) % 50) / 100);
      ctx2d.fillStyle = spCol(i & 1 ? CYAN : ORANGE, 0.15 + E.hi * 0.6); ctx2d.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.86, 2 * dpr, 2 * dpr);
    }
    psParticles(E, now, cx, cy, core, minDim, w, h);
    psStar(cx, cy, core, E, CYAN, PS.drop * 0.3);
    ctx2d.restore();
    if (E.scr > 0.5) skTears(w, h, E.scr * 0.5, 2);
  }

  // --- Magnetar: magnetic storm ---
  function drawPulsarMagnetar(w, h, now, kick, bass, energy, sens) {
    const E = spAnalyze(now, kick, bass, energy, sens); psTrend(E, now);
    const cx = w / 2, cy = h / 2, minDim = Math.min(w, h), S = E.I, dt = SK.dt / 16.7;
    psBg(E, 1.004);
    const ang = psSpin(E, 0.6);
    const core = minDim * 0.06 * (1 + E.kf * 0.4 * S + E.bass * 0.12);
    if (E.kickEv) PS.loopsSnap = 1; PS.loopsSnap *= 0.9;
    ctx2d.save(); ctx2d.globalCompositeOperation = "lighter";
    // dipole field loops: r = L sin^2(theta)
    const nL = 7, pts = 40, loops = [];
    for (let k = 0; k < nL; k++) {
      const L = minDim * (0.12 + k * 0.05) * (1 + E.mid * 0.2 * S), loop = [];
      const snap = PS.loopsSnap * (k % 2 ? 1 : -1) * 0.35;
      for (const side of [1, -1]) for (let i = 0; i <= pts; i++) {
        const th = 0.15 + (i / pts) * (Math.PI - 0.3);
        let rr = L * Math.sin(th) ** 2;
        // snap: loops break open at apex then reconnect
        if (Math.abs(th - Math.PI / 2) < 0.4 * PS.loopsSnap) rr *= 1 + snap;
        const lx = side * rr * Math.sin(th), ly = rr * Math.cos(th);
        const ca = Math.cos(ang * 0.3), sa = Math.sin(ang * 0.3);
        loop.push([cx + lx * ca - ly * sa, cy + lx * sa + ly * ca]);
      }
      loops.push(loop);
      const c = spMix(k % 2 ? CYAN : MAGENTA_C, SP_WHITE, PS.loopsSnap * 0.4);
      ctx2d.strokeStyle = spCol(c, 0.12 + E.mid * 0.3 + PS.loopsSnap * 0.35 + SPC.act * 0.05);
      ctx2d.lineWidth = (1.2 + PS.loopsSnap * 3) * dpr;
      ctx2d.beginPath(); loop.forEach((p, i) => (i % (pts + 1) === 0 ? ctx2d.moveTo(p[0], p[1]) : ctx2d.lineTo(p[0], p[1]))); ctx2d.stroke();
    }
    // lightning along field lines on highs
    if (E.live && (E.hat || E.hi > 0.12) && PS.arcs.length < 6) {
      const lp = loops[(Math.random() * nL) | 0], st = (Math.random() * (lp.length - 12)) | 0;
      PS.arcs.push({ lp, st, len: 8 + ((Math.random() * 10) | 0), l: 1 });
    }
    for (let i = PS.arcs.length - 1; i >= 0; i--) {
      const a = PS.arcs[i]; a.l -= 0.12 * dt; if (a.l <= 0) { PS.arcs.splice(i, 1); continue; }
      ctx2d.beginPath();
      for (let j = 0; j < a.len && a.st + j < a.lp.length; j++) { const p = a.lp[a.st + j], jt = (Math.random() - 0.5) * 8 * dpr; j ? ctx2d.lineTo(p[0] + jt, p[1] + jt) : ctx2d.moveTo(p[0], p[1]); }
      ctx2d.strokeStyle = spCol(spMix(CYAN, SP_WHITE, 0.7), a.l); ctx2d.lineWidth = 2 * dpr; ctx2d.stroke();
    }
    // narrow beams
    const BL = Math.hypot(w, h);
    psBeam(cx, cy, ang, 0.03 + E.mid * 0.05, core, BL, CYAN, 0.3 + E.kf * 0.4);
    psBeam(cx, cy, ang + Math.PI, 0.03 + E.mid * 0.05, core, BL, MAGENTA_C, 0.3 + E.kf * 0.4);
    psParticles(E, now, cx, cy, core, minDim, w, h, MAGENTA_C);
    psStar(cx, cy, core, E, MAGENTA_C, PS.drop * 0.4);
    // starquake cracks on drops
    if (PS.drop > 0.95 && now - PS.cT > 400) {
      PS.cT = now; PS.cracks.length = 0;
      for (let c = 0; c < 7; c++) { let a = Math.random() * TAU, rr = 0; const seg = []; for (let s = 0; s < 6; s++) { a += (Math.random() - 0.5) * 0.9; rr += core * 0.25; seg.push([Math.cos(a) * rr, Math.sin(a) * rr]); } PS.cracks.push(seg); }
      PS.crackL = 1;
    }
    PS.crackL = (PS.crackL || 0) * 0.96;
    if (PS.crackL > 0.03) {
      ctx2d.globalCompositeOperation = "source-over";
      ctx2d.strokeStyle = spCol(spMix(ORANGE, MAGENTA_C, 0.3), PS.crackL); ctx2d.lineWidth = 1.6 * dpr;
      for (const seg of PS.cracks) { ctx2d.beginPath(); ctx2d.moveTo(cx, cy); for (const [x, y] of seg) ctx2d.lineTo(cx + Math.min(core, Math.hypot(x, y)) * Math.cos(Math.atan2(y, x)), cy + Math.min(core, Math.hypot(x, y)) * Math.sin(Math.atan2(y, x))); ctx2d.stroke(); }
    }
    ctx2d.restore();
    if (E.scr > 0.5) skTears(w, h, E.scr * 0.6, 3);
  }

  // --- Quasar: accretion disc + relativistic jets ---
  function drawPulsarQuasar(w, h, now, kick, bass, energy, sens) {
    const E = spAnalyze(now, kick, bass, energy, sens); psTrend(E, now);
    const cx = w / 2, cy = h / 2, minDim = Math.min(w, h), S = E.I, dt = SK.dt / 16.7;
    psBg(E, 1.006);
    const ang = psSpin(E, 1.4);
    const core = minDim * 0.035 * (1 + E.kf * 0.5 * S + E.bass * 0.15);
    const D = PS.disc, cap = spCap(w, h, 4000, 80, 320);
    while (D.length < cap) D.push({ r: 0.08 + Math.random() * 0.32, a: Math.random() * TAU, s: 0.5 + Math.random() });
    if (D.length > cap) D.length = cap;
    ctx2d.save(); ctx2d.globalCompositeOperation = "lighter";
    // jets (behind disc): length from energy, width/brightness from bass
    const jl = Math.max(h, w) * (0.25 + SPC.act * 0.25 + E.energy * 0.6 * S + PS.drop * 0.2);
    for (const sgn of [-1, 1]) {
      const jw = minDim * (0.012 + E.bass * 0.03 + E.kf * 0.02);
      const g = ctx2d.createLinearGradient(cx, cy, cx, cy + sgn * jl);
      const jc = sgn < 0 ? CYAN : ORANGE;
      g.addColorStop(0, spCol(spMix(jc, SP_WHITE, 0.6), 0.6 + E.kf * 0.4)); g.addColorStop(0.5, spCol(jc, 0.25 + E.bass * 0.3)); g.addColorStop(1, spCol(jc, 0));
      ctx2d.fillStyle = g; ctx2d.beginPath();
      const wob = Math.sin(now * 0.004) * jw * 0.5;
      ctx2d.moveTo(cx - jw * 0.4, cy); ctx2d.lineTo(cx - jw * 1.6 + wob, cy + sgn * jl); ctx2d.lineTo(cx + jw * 1.6 + wob, cy + sgn * jl); ctx2d.lineTo(cx + jw * 0.4, cy); ctx2d.fill();
      // knots travelling up the jet on beats
      if (E.beat || E.kickEv) SPC.ps.push({ k: "knot", t0: now, sgn, jc });
    }
    // disc
    const tilt = 0.28, spinR = (E.bpm / 60000) * SK.dt * (0.2 + SPC.act) * 1.2;
    for (const p of D) {
      p.a += spinR * p.s / (p.r * 6);
      const rr = p.r * minDim * (1 + E.mid * 0.15 * S), x = cx + Math.cos(p.a) * rr, y = cy + Math.sin(p.a) * rr * tilt;
      const heat = 1 - (p.r - 0.08) / 0.32, c = spMix(ORANGE, spMix(CYAN, SP_WHITE, 0.4), heat);
      ctx2d.fillStyle = spCol(c, 0.25 + heat * 0.4 + E.bass * 0.3); const sz = (1 + heat * 1.5) * dpr; ctx2d.fillRect(x, y, sz * 2, sz);
    }
    // pulsar beams inside disc
    const BL = minDim * 0.5;
    psBeam(cx, cy, ang, 0.05 + E.mid * 0.08, core, BL, CYAN, 0.25 + E.kf * 0.4, 0.5);
    psBeam(cx, cy, ang + Math.PI, 0.05 + E.mid * 0.08, core, BL, ORANGE, 0.25 + E.kf * 0.4, 0.5);
    const P = SPC.ps;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i]; if (q.k !== "knot") continue;
      const age = (now - q.t0) / 900; if (age >= 1) { P.splice(i, 1); continue; }
      spGlow(cx, cy + q.sgn * age * jl, minDim * 0.03 * (1 - age * 0.5), q.jc, (1 - age) * 0.7);
    }
    psParticles(E, now, cx, cy, core, minDim, w, h);
    psStar(cx, cy, core, E, CYAN, PS.drop * 0.3);
    ctx2d.restore();
    if (E.scr > 0.5) skTears(w, h, E.scr * 0.6, 3);
  }

  // --- Supernova: tension → explosion on real drop/downbeat → re-form ---
  function drawPulsarSupernova(w, h, now, kick, bass, energy, sens) {
    const E = spAnalyze(now, kick, bass, energy, sens); psTrend(E, now);
    const cx = w / 2, cy = h / 2, minDim = Math.min(w, h), S = E.I, dt = SK.dt / 16.7;
    psBg(E, 1.01);
    const ang = psSpin(E, 1);
    PS.reform = Math.min(1, PS.reform + 0.006 * dt);
    // tension accumulates only while live and building
    PS.tension = Math.max(0, Math.min(1, PS.tension + (E.live ? (0.002 + PS.build * 0.01 + E.energy * 0.003) * PS.reform : -0.01) * dt));
    const ready = PS.tension > 0.55 && PS.reform >= 1 && now - PS.lastNova > 4000;
    // explode only on a real detected big kick / downbeat — never on a timer
    if (ready && E.live && (E.boom || (E.kickEv && E.down))) {
      PS.lastNova = now; PS.nova = 1; PS.reform = 0;
      const cap = spCap(w, h, 3000, 80, 340), T = PS.tension;
      PS.shell.length = 0;
      for (let i = 0; i < cap; i++) { const a = (i / cap) * TAU + Math.random() * 0.05, v = (3 + Math.random() * 5 + T * 6) * dpr; PS.shell.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c: bandColorAt(Math.random(), 1) }); }
      SPC.ps.push({ k: "ring", t0: now, s: 1.4, x: cx, y: cy });
      PS.tension = 0;
    }
    PS.nova *= 0.96;
    const T = PS.tension, tremble = T * T * minDim * 0.006 * (E.live ? 1 : 0);
    const sx = cx + (Math.random() - 0.5) * tremble, sy = cy + (Math.random() - 0.5) * tremble;
    const core = minDim * 0.04 * (0.4 + PS.reform * 0.6) * (1 + E.kf * 0.4 * S + T * 0.8);
    ctx2d.save(); ctx2d.globalCompositeOperation = "lighter";
    // trembling shell
    if (PS.reform > 0.3) {
      ctx2d.beginPath();
      const rr = core * (2.2 + T), n = 48;
      for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, j = 1 + (Math.random() - 0.5) * T * 0.25 + Math.sin(a * 6 + now * 0.01) * E.mid * 0.1; const x = sx + Math.cos(a) * rr * j, y = sy + Math.sin(a) * rr * j; i ? ctx2d.lineTo(x, y) : ctx2d.moveTo(x, y); }
      ctx2d.strokeStyle = spCol(spMix(ORANGE, SP_WHITE, T), 0.15 + T * 0.6); ctx2d.lineWidth = (1 + T * 2) * dpr; ctx2d.stroke();
    }
    // explosion shell debris
    for (let i = PS.shell.length - 1; i >= 0; i--) {
      const q = PS.shell[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.99; q.vy *= 0.99; q.l -= 0.006 * dt;
      if (q.l <= 0) { PS.shell.splice(i, 1); continue; }
      ctx2d.strokeStyle = spCol(q.c, q.l * 0.9); ctx2d.lineWidth = 2 * dpr; ctx2d.beginPath(); ctx2d.moveTo(q.x, q.y); ctx2d.lineTo(q.x - q.vx * 3, q.y - q.vy * 3); ctx2d.stroke();
    }
    if (PS.nova > 0.05) spGlow(cx, cy, minDim * (0.2 + (1 - PS.nova) * 0.6), spMix(ORANGE, SP_WHITE, PS.nova), PS.nova * 0.8);
    const BL = Math.hypot(w, h) * PS.reform;
    if (PS.reform > 0.2) {
      psBeam(sx, sy, ang, 0.04 + E.mid * 0.08 * S + T * 0.04, core, BL, CYAN, (0.3 + E.kf * 0.4 + T * 0.3) * PS.reform);
      psBeam(sx, sy, ang + Math.PI, 0.04 + E.mid * 0.08 * S + T * 0.04, core, BL, ORANGE, (0.3 + E.kf * 0.4 + T * 0.3) * PS.reform);
    }
    psParticles(E, now, sx, sy, core, minDim, w, h);
    psStar(sx, sy, core, E, spMix(CYAN, ORANGE, T), T);
    ctx2d.restore();
    if (E.scr > 0.5) skTears(w, h, E.scr * 0.6, 3);
  }
  const PULSAR_FNS = [drawPulsarMode, drawPulsarTwin, drawPulsarSplit, drawPulsarMagnetar, drawPulsarQuasar, drawPulsarSupernova];
  let psLastSub = -1;
  function drawPulsarDispatch(w, h, now, kick, bass, energy, sens) {
    if (psLastSub !== pulsarSub) { psLastSub = pulsarSub; SPC.ps.length = 0; PS.shell.length = 0; PS.arcs.length = 0; PS.nb = 1; PS.fan = 1; PS.tension = 0; PS.reform = 1; }
    PULSAR_FNS[pulsarSub](w, h, now, kick, bass, energy, sens);
  }
  const SPACE_MODES = { sonar: drawSonarModeV2, blackhole: drawBlackHoleMode, warp: drawWarpMode, hyperspace: drawHyperspaceMode, pulsar: drawPulsarDispatch };

  const SK_MODES = { scratchglitch: drawScratchGlitchMode, scratchplatter: drawScratchPlatterMode, vhs: drawVhsMode,
    split: drawSplitMode, lighttrails: drawLightTrailsMode, skratchbastid: drawSkratchBastidMode };

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
    if (SPACE_MODES[vm]) {
      energyLive = energy > 0.025;
      SPACE_MODES[vm](w, h, now, kick, bass, energy, sens);
    } else if (SK_MODES[vm]) {
      energyLive = energy > 0.025;
      sampleAndPushWave(kick, bass, energy, sens, now);
      skAnalyze(now, kick, energy, sens);
      SK_MODES[vm](w, h, now);
    } else if (vm === "orbit") {
      drawOrbitMode(w, h, now, kick, bass, energy);
    } else if (vm === "scope") {
      drawScopeMode(w, h, now, kick, energy);
    } else if (vm === "nebula") {
      drawNebulaMode(w, h, now, kick, bass, energy);
    } else if (vm === "strobe") {
      drawStrobeMode(w, h, now, kick, bass, energy);
    } else if (vm === "wave") {
      sampleAndPushWave(kick, bass, energy, sens, now);
      drawWaveMode(w, h, now, kick);
    } else if (vm === "djay") {
      sampleAndPushWave(kick, bass, energy, sens, now);
      drawDjayMode(w, h, now, kick, bass, energy);
    } else if (vm === "nodes") {
      drawNodesMode(w, h, now, kick, bass, energy);
    } else if (vm === "sonar") {
      drawSonarMode(w, h, now, kick, bass, energy);
    } else if (vm === "vertical" || vm === "stems" || vm === "decks") {
      sampleAndPushWave(kick, bass, energy, sens, now);
      if (vm === "vertical") drawVerticalMode(w, h, now);
      else if (vm === "stems") drawStemsMode(w, h, now);
      else drawDecksMode(w, h, now);
    } else if (vm === "evolve") {
      drawEvolveMode(w, h, now, kick, bass, energy);
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

  buildModeMenu();
  if (els.modesBtn) {
    els.modesBtn.addEventListener("click", (e) => { e.stopPropagation(); setModeMenu(!modeMenuOpen); });
  }
  document.addEventListener("click", (e) => {
    if (modeMenuOpen && !e.target.closest("#modeMenu") && !e.target.closest("#modesBtn")) setModeMenu(false);
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setModeMenu(false); });
  // v27: Pulsar sub-mode chips
  const psChips = document.getElementById("pulsarSubs");
  function syncPulsarChips() {
    if (!psChips) return;
    const on = MODES[modeIndex] && MODES[modeIndex].id === "pulsar";
    psChips.hidden = !on;
    psChips.querySelectorAll("button").forEach((b, i) => b.classList.toggle("on", i === pulsarSub));
  }
  function setPulsarSub(i) {
    pulsarSub = (i + PULSAR_SUBS.length) % PULSAR_SUBS.length;
    try { localStorage.setItem(PSUB_KEY, PULSAR_SUBS[pulsarSub].id); } catch (_) {}
    syncPulsarChips();
    if (els.modeToast) {
      els.modeToast.textContent = "Pulsar · " + PULSAR_SUBS[pulsarSub].name;
      els.modeToast.classList.add("show"); window.clearTimeout(modeToastTimer);
      modeToastTimer = window.setTimeout(() => els.modeToast.classList.remove("show"), 1200);
    }
  }
  if (psChips) {
    PULSAR_SUBS.forEach((m, i) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = m.name; b.dataset.sub = m.id;
      b.addEventListener("click", (e) => { e.stopPropagation(); setPulsarSub(i); });
      b.addEventListener("touchend", (e) => e.stopPropagation(), { passive: true });
      psChips.appendChild(b);
    });
    syncPulsarChips();
  }
  window.lightoPulsar = { set: setPulsarSub, subs: PULSAR_SUBS, get: () => pulsarSub };
  let psTapT = 0;
  // Swipe left/right on the canvas: next/prev mode
  let swX = 0, swY = 0, swT = 0, swUsed = false;
  els.display.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) { swT = 0; return; }
    swX = e.touches[0].clientX; swY = e.touches[0].clientY; swT = Date.now();
  }, { passive: true });
  els.display.addEventListener("touchend", (e) => {
    if (!swT || modeMenuOpen) return;
    const t = e.changedTouches[0], dx = t.clientX - swX, dy = t.clientY - swY;
    if (Date.now() - swT < 700 && Math.abs(dx) > 50 && Math.abs(dy) < Math.abs(dx) * 0.6) {
      swUsed = true; setTimeout(() => (swUsed = false), 400);
      cycleMode(dx < 0 ? 1 : -1);
    }
    swT = 0;
  }, { passive: true });
  document.addEventListener("click", (e) => {
    if (!themeSheetOpen) return;
    if (e.target.closest("#themeSheet") || e.target.closest("#colorsBtn")) return;
    setThemeSheet(false);
  });

  els.display.addEventListener("click", (e) => {
    if (!running || swUsed) return;
    if (e.target.closest("#modeMenu")) return;
    if (e.target.closest(".tap-btn") || e.target.closest(".overlay") || e.target.closest(".denied")) return;
    if (e.target.closest("#pulsarSubs")) return;
    if (currentMode() === "pulsar" && e.target === els.canvas) {
      const t = Date.now();
      if (t - psTapT < 320) { psTapT = 0; setPulsarSub(pulsarSub + 1); return; }
      psTapT = t;
    }
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
      navigator.serviceWorker.register("./sw.js?v=27", { updateViaCache: "none" }).catch(() => {});
    });
  }

  restoreCustomColors();
  buildThemeChips();
  restoreTheme();
  restoreMode();
  initCustomPickers();
  restoreUserScale();
  if (els.scaleCtl) {
    els.scaleCtl.addEventListener("input", () => setUserScale(els.scaleCtl.value, true));
  }
  restoreWaveCtls();
  if (els.waveHCtl) els.waveHCtl.addEventListener("input", () => setWaveHeight(els.waveHCtl.value, true));
  if (els.waveWCtl) els.waveWCtl.addEventListener("input", () => setWaveWidth(els.waveWCtl.value, true));
  if (els.waveHueCtl) els.waveHueCtl.addEventListener("input", () => setWaveHue(els.waveHueCtl.value, true));
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
