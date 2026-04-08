const SAMPLE_RATE = 48000;
const LOOP_SECONDS = 4;
const EXPORT_SECONDS = 8;
const RECORD_SECONDS = 8;
const STORAGE_KEY = "distant-lights-saved-presets-v1";

const DEFAULT_PARAMS = {
  label: "Custom",
  mode: "electrical",
  baseFreq: 100,
  waveform: "abs-sine",
  duty: 0.3,
  depth: 0.8,
  thermalCutoff: 80,
  resonanceHz: 180,
  resonanceQ: 1.2,
  resonanceMix: 0.28,
  whineFreq: 0,
  whineLevel: 0,
  noiseLevel: 0.01,
  gain: 2.2,
  lowFreqSonify: false,
  carrierFreq: 220,
};

const PRESETS = [
  {
    name: "UK LED mains ripple (100 Hz)",
    params: { ...DEFAULT_PARAMS, label: "UK LED mains ripple (100 Hz)", mode: "electrical", baseFreq: 100, waveform: "abs-sine", depth: 0.85, resonanceHz: 180, resonanceQ: 1.2, resonanceMix: 0.28, noiseLevel: 0.008, gain: 2.4 },
  },
  {
    name: "Fluorescent / ballast hum",
    params: { ...DEFAULT_PARAMS, label: "Fluorescent / ballast hum", mode: "electrical", baseFreq: 100, waveform: "triangle", depth: 0.7, resonanceHz: 120, resonanceQ: 2.2, resonanceMix: 0.45, noiseLevel: 0.006, gain: 2.6 },
  },
  {
    name: "PWM LED dimmer + driver whine",
    params: { ...DEFAULT_PARAMS, label: "PWM LED dimmer + driver whine", mode: "electrical", baseFreq: 240, waveform: "pwm", duty: 0.18, depth: 1, resonanceHz: 900, resonanceQ: 2.5, resonanceMix: 0.34, whineFreq: 7800, whineLevel: 0.15, noiseLevel: 0.008, gain: 1.8 },
  },
  {
    name: "Photoacoustic chopped light",
    params: { ...DEFAULT_PARAMS, label: "Photoacoustic chopped light", mode: "photoacoustic", baseFreq: 440, waveform: "square", duty: 0.5, depth: 1, thermalCutoff: 120, resonanceHz: 440, resonanceQ: 6, resonanceMix: 0.5, noiseLevel: 0.004, gain: 5 },
  },
  {
    name: "Slow collision beacon (sonified)",
    params: { ...DEFAULT_PARAMS, label: "Slow collision beacon (sonified)", mode: "electrical", baseFreq: 1.2, waveform: "pwm", duty: 0.18, depth: 1, lowFreqSonify: true, carrierFreq: 330, resonanceHz: 330, resonanceQ: 3.5, resonanceMix: 0.2, noiseLevel: 0.003, gain: 2.5 },
  },
];

const CONTROL_CONFIG = [
  { key: "mode", type: "select", label: "Mode", options: ["electrical", "photoacoustic"] },
  { key: "waveform", type: "select", label: "Waveform", options: ["sine", "square", "triangle", "pwm", "abs-sine"] },
  { key: "baseFreq", type: "range", label: "Base frequency (Hz)", min: 0.2, max: 2000, step: 0.1, hint: "100 Hz is common in UK mains ripple lighting." },
  { key: "depth", type: "range", label: "Modulation depth", min: 0, max: 1, step: 0.01, hint: "How strongly the light or current varies over time." },
  { key: "duty", type: "range", label: "PWM duty", min: 0.02, max: 0.98, step: 0.01, hint: "Only matters for PWM-style waveforms." },
  { key: "thermalCutoff", type: "range", label: "Thermal cutoff (Hz)", min: 1, max: 1000, step: 1, hint: "Mainly for photoacoustic mode." },
  { key: "resonanceHz", type: "range", label: "Resonance center (Hz)", min: 20, max: 12000, step: 1, hint: "Mechanical body or enclosure resonance." },
  { key: "resonanceQ", type: "range", label: "Resonance Q", min: 0.2, max: 20, step: 0.1, hint: "Higher Q means a narrower ring." },
  { key: "resonanceMix", type: "range", label: "Resonance mix", min: 0, max: 1, step: 0.01, hint: "Blend between dry signal and resonant body." },
  { key: "whineFreq", type: "range", label: "Driver whine frequency (Hz)", min: 0, max: 16000, step: 1, hint: "For electronic driver or capacitor whine." },
  { key: "whineLevel", type: "range", label: "Driver whine level", min: 0, max: 0.5, step: 0.001, hint: "Adds a higher-frequency squeal." },
  { key: "noiseLevel", type: "range", label: "Noise floor", min: 0, max: 0.1, step: 0.001, hint: "Broadband roughness from room or electronics." },
  { key: "gain", type: "range", label: "Gain", min: 0.1, max: 8, step: 0.1, hint: "Useful for subtle modeled signals." },
  { key: "carrierFreq", type: "range", label: "Sonification carrier (Hz)", min: 50, max: 2000, step: 1, hint: "Only used for low-frequency sonification." },
  { key: "lowFreqSonify", type: "checkbox", label: "Enable low-frequency sonification", hint: "Use an audible carrier for slow flashes rather than pretending they are already audible." },
];

const state = {
  params: cloneParams(PRESETS[0].params),
  isPlaying: false,
  isRecording: false,
  audioContext: null,
  source: null,
  gainNode: null,
  mediaDest: null,
  recorder: null,
  recordChunks: [],
  recordTimeout: null,
};

const els = {
  presetSelect: document.getElementById("presetSelect"),
  labelInput: document.getElementById("labelInput"),
  controlsContainer: document.getElementById("controlsContainer"),
  savedPresetSelect: document.getElementById("savedPresetSelect"),
  statusText: document.getElementById("statusText"),
  capabilityText: document.getElementById("capabilityText"),
  lightCanvas: document.getElementById("lightCanvas"),
  audioCanvas: document.getElementById("audioCanvas"),
  modelTitle: document.getElementById("modelTitle"),
  modelLine1: document.getElementById("modelLine1"),
  modelLine2: document.getElementById("modelLine2"),
  formula1: document.getElementById("formula1"),
  formula2: document.getElementById("formula2"),
  literalStatus: document.getElementById("literalStatus"),
  numericSummary: document.getElementById("numericSummary"),
  warningBox: document.getElementById("warningBox"),
  chainText: document.getElementById("chainText"),
  playBtn: document.getElementById("playBtn"),
  stopBtn: document.getElementById("stopBtn"),
  exportWavBtn: document.getElementById("exportWavBtn"),
  recordBtn: document.getElementById("recordBtn"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  saveBrowserBtn: document.getElementById("saveBrowserBtn"),
  loadBrowserBtn: document.getElementById("loadBrowserBtn"),
  deleteBrowserBtn: document.getElementById("deleteBrowserBtn"),
  importPresetInput: document.getElementById("importPresetInput"),
};

function cloneParams(params) {
  return JSON.parse(JSON.stringify(params));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function waveSample(t, freq, waveform, duty) {
  const phase = (t * freq) % 1;
  const s = Math.sin(2 * Math.PI * freq * t);
  switch (waveform) {
    case "sine": return s;
    case "square": return s >= 0 ? 1 : -1;
    case "triangle": return 1 - 4 * Math.abs(phase - 0.5);
    case "pwm": return phase < duty ? 1 : -1;
    case "abs-sine": return Math.abs(s) * 2 - 1;
    default: return s;
  }
}

function makeBandPassCoefficients(sampleRate, f0, q) {
  const safeF0 = clamp(f0, 20, sampleRate / 2 - 100);
  const safeQ = clamp(q, 0.2, 30);
  const w0 = (2 * Math.PI * safeF0) / sampleRate;
  const alpha = Math.sin(w0) / (2 * safeQ);
  const cosw0 = Math.cos(w0);
  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function applyBandPass(samples, sampleRate, f0, q) {
  const c = makeBandPassCoefficients(sampleRate, f0, q);
  const out = new Float32Array(samples.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const x0 = samples[i];
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    out[i] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  return out;
}

function synthesize(params, seconds, sampleRate = SAMPLE_RATE) {
  const total = Math.floor(seconds * sampleRate);
  const dry = new Float32Array(total);
  const alpha = 1 - Math.exp((-2 * Math.PI * Math.max(0.1, params.thermalCutoff)) / sampleRate);
  let thermal = 0;
  let prevThermal = 0;
  let seed = 1337;

  for (let i = 0; i < total; i += 1) {
    const t = i / sampleRate;
    const rawWave = waveSample(t, params.baseFreq, params.waveform, params.duty);
    const light = clamp(0.5 + 0.5 * params.depth * rawWave, 0, 1);
    let x = 0;

    if (params.lowFreqSonify || params.baseFreq < 20) {
      const carrier = Math.sin(2 * Math.PI * params.carrierFreq * t);
      x = (light - 0.5) * carrier * 2;
    } else if (params.mode === "photoacoustic") {
      thermal += alpha * (light - thermal);
      x = (thermal - prevThermal) * sampleRate * 0.01;
      prevThermal = thermal;
    } else {
      x = light - 0.5;
    }

    if (params.whineFreq > 0 && params.whineLevel > 0) {
      x += params.whineLevel * Math.sin(2 * Math.PI * params.whineFreq * t);
    }

    if (params.noiseLevel > 0) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      const noise = (seed / 0xffffffff) * 2 - 1;
      x += noise * params.noiseLevel;
    }

    dry[i] = x;
  }

  const wet = applyBandPass(dry, sampleRate, params.resonanceHz, params.resonanceQ);
  const mixed = new Float32Array(total);
  const mix = clamp(params.resonanceMix, 0, 1);
  let peak = 1e-6;
  for (let i = 0; i < total; i += 1) {
    const y = (1 - mix) * dry[i] + mix * wet[i];
    mixed[i] = y;
    peak = Math.max(peak, Math.abs(y));
  }
  const normalize = Math.min(1, 0.95 / peak);
  for (let i = 0; i < total; i += 1) {
    mixed[i] = clamp(mixed[i] * normalize * params.gain, -1, 1);
  }
  return mixed;
}

function floatToWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeString = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const s = clamp(samples[i], -1, 1);
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(text) {
  return String(text || "distant-lights").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "distant-lights";
}

function physicsSummary(params) {
  if (params.mode === "photoacoustic") {
    return {
      title: "Photoacoustic approximation",
      line1: "Absorbed light becomes heat, and periodic heating drives periodic pressure changes.",
      line2: "This demo uses a thermal low-pass plus a derivative-like pressure estimate, then an acoustic resonance stage.",
      formula1: "I(t) = I₀ [1 + m·s(t)]",
      formula2: "τ·dT/dt = I(t) - T,   p(t) ∝ dT/dt",
      chain: ["Modulated light", "Thermal response", "Pressure estimate", "Resonant body", "Audio output"],
    };
  }
  return {
    title: "Electrical / mechanical hum model",
    line1: "The audible sound comes from electronics or magnetic parts vibrating under periodic current and voltage.",
    line2: "This demo uses the modulation as a source, then colors it with a resonant body and optional driver whine.",
    formula1: "I(t) = I₀ [1 + m·s(t)]",
    formula2: "p(t) ≈ dry(t) + Hres{dry(t)} + Awhine·sin(2π fwhine t)",
    chain: ["Current/light modulation", "Dry source", "Resonant filter", "Optional whine", "Audio output"],
  };
}

function getPreviewData(params) {
  const points = 240;
  const light = [];
  const audio = [];
  const preview = synthesize({ ...params, gain: 1 }, 0.06, 4000);
  for (let i = 0; i < points; i += 1) {
    const t = i / points;
    const wave = waveSample(t, Math.max(params.baseFreq, 1), params.waveform, params.duty);
    const intensity = clamp(0.5 + 0.5 * params.depth * wave, 0, 1);
    light.push({ x: i, y: intensity });
    const idx = Math.floor((i / points) * preview.length);
    audio.push({ x: i, y: preview[idx] || 0 });
  }
  return { light, audio };
}

function drawSeries(canvas, series, color, center = false) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "rgba(18,34,59,0.92)");
  bg.addColorStop(1, "rgba(8,13,25,0.92)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  if (center) {
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  series.forEach((p, i) => {
    const x = (p.x / Math.max(1, series.length - 1)) * width;
    const yVal = center ? (0.5 - p.y * 0.45) : (1 - p.y);
    const y = yVal * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function buildControls() {
  els.controlsContainer.innerHTML = "";
  CONTROL_CONFIG.forEach((config) => {
    if (config.type === "checkbox") {
      const wrapper = document.createElement("label");
      wrapper.className = "control-card checkbox-card";
      wrapper.innerHTML = `
        <input type="checkbox" id="control-${config.key}" />
        <div>
          <div class="control-label">${config.label}</div>
          <div class="control-hint">${config.hint || ""}</div>
        </div>
      `;
      const input = wrapper.querySelector("input");
      input.checked = !!state.params[config.key];
      input.addEventListener("change", () => updateParam(config.key, input.checked));
      els.controlsContainer.appendChild(wrapper);
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "control-card";
    if (config.type === "select") {
      wrapper.innerHTML = `
        <div class="control-top">
          <div><div class="control-label">${config.label}</div></div>
        </div>
        <select id="control-${config.key}">
          ${config.options.map((option) => `<option value="${option}">${option}</option>`).join("")}
        </select>
      `;
      const select = wrapper.querySelector("select");
      select.value = state.params[config.key];
      select.addEventListener("change", () => updateParam(config.key, select.value));
    } else {
      wrapper.innerHTML = `
        <div class="control-top">
          <div>
            <div class="control-label">${config.label}</div>
            <div class="control-hint">${config.hint || ""}</div>
          </div>
          <div class="control-value" id="value-${config.key}"></div>
        </div>
        <input id="control-${config.key}" type="range" min="${config.min}" max="${config.max}" step="${config.step}" />
      `;
      const input = wrapper.querySelector("input");
      input.value = state.params[config.key];
      input.addEventListener("input", () => updateParam(config.key, Number(input.value), false));
      input.addEventListener("change", () => updateParam(config.key, Number(input.value), true));
    }
    els.controlsContainer.appendChild(wrapper);
  });
}

function populatePresetSelect() {
  els.presetSelect.innerHTML = PRESETS.map((preset) => `<option value="${preset.params.label}">${preset.name}</option>`).join("");
  els.presetSelect.value = state.params.label;
}

function loadSavedPresets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeSavedPresets(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

function refreshSavedPresetSelect() {
  const saved = loadSavedPresets();
  if (!saved.length) {
    els.savedPresetSelect.innerHTML = `<option value="">No saved presets yet</option>`;
    els.savedPresetSelect.disabled = true;
    return;
  }
  els.savedPresetSelect.disabled = false;
  els.savedPresetSelect.innerHTML = saved.map((item, idx) => `<option value="${idx}">${item.label}</option>`).join("");
}

function setStatus(text) {
  els.statusText.textContent = text;
}

function syncControlValues() {
  CONTROL_CONFIG.forEach((config) => {
    const input = document.getElementById(`control-${config.key}`);
    if (!input) return;
    if (config.type === "checkbox") {
      input.checked = !!state.params[config.key];
    } else {
      input.value = state.params[config.key];
    }
    const valueEl = document.getElementById(`value-${config.key}`);
    if (valueEl) valueEl.textContent = formatValue(state.params[config.key], config.step);
  });
}

function formatValue(value, step = 1) {
  if (typeof value === "boolean") return value ? "on" : "off";
  const decimals = String(step).includes(".") ? String(step).split(".")[1].length : 0;
  return Number(value).toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function updateParam(key, value, rerenderAudio = true) {
  state.params[key] = value;
  if (key !== "label") {
    els.presetSelect.value = PRESETS.some((preset) => preset.params.label === state.params.label) ? state.params.label : "";
  }
  els.labelInput.value = state.params.label;
  render();
  if (rerenderAudio && state.isPlaying) startAudio();
}

function setParams(nextParams) {
  state.params = { ...cloneParams(DEFAULT_PARAMS), ...cloneParams(nextParams) };
  els.labelInput.value = state.params.label;
  render();
  if (state.isPlaying) startAudio();
}

async function ensureAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Web Audio is not available in this browser.");
  if (!state.audioContext) {
    state.audioContext = new AudioContextClass();
    state.gainNode = state.audioContext.createGain();
    state.gainNode.gain.value = 0.22;
    state.mediaDest = state.audioContext.createMediaStreamDestination();
    state.gainNode.connect(state.audioContext.destination);
    state.gainNode.connect(state.mediaDest);
  }
  if (state.audioContext.state === "suspended") await state.audioContext.resume();
  return state.audioContext;
}

function stopAudio() {
  try { state.source && state.source.stop(); } catch {}
  try { state.source && state.source.disconnect(); } catch {}
  state.source = null;
  state.isPlaying = false;
  if (!state.isRecording) setStatus("Stopped");
}

async function startAudio() {
  try {
    const ctx = await ensureAudioContext();
    stopAudio();
    const samples = synthesize(state.params, LOOP_SECONDS, ctx.sampleRate || SAMPLE_RATE);
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate || SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(state.gainNode);
    source.start();
    state.source = source;
    state.isPlaying = true;
    const literal = !state.params.lowFreqSonify && state.params.baseFreq >= 20;
    setStatus(literal ? "Playing literal audio-range estimate." : "Playing sonification for a sub-audio or forced-sonified pattern.");
  } catch (err) {
    setStatus(err.message || "Audio playback failed.");
  }
}

async function recordLive() {
  if (state.isRecording) return;
  try {
    await ensureAudioContext();
    if (!window.MediaRecorder || !state.mediaDest) {
      setStatus("Live recording is not supported here. Download WAV instead.");
      return;
    }
    stopAudio();
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    state.recordChunks = [];
    state.recorder = new MediaRecorder(state.mediaDest.stream, mimeType ? { mimeType } : undefined);
    state.recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) state.recordChunks.push(event.data);
    };
    state.recorder.onstop = () => {
      const blob = new Blob(state.recordChunks, { type: state.recorder.mimeType || "audio/webm" });
      downloadBlob(blob, `${safeName(state.params.label)}-live.webm`);
      state.isRecording = false;
      els.recordBtn.textContent = "Record 8s";
      setStatus("Live recording saved.");
    };
    state.recorder.start();
    state.isRecording = true;
    els.recordBtn.textContent = "Recording…";
    setStatus("Recording 8 seconds of the live preview.");
    await startAudio();
    clearTimeout(state.recordTimeout);
    state.recordTimeout = setTimeout(() => {
      stopAudio();
      try { state.recorder && state.recorder.stop(); } catch {}
    }, RECORD_SECONDS * 1000);
  } catch (err) {
    state.isRecording = false;
    els.recordBtn.textContent = "Record 8s";
    setStatus(err.message || "Recording failed.");
  }
}

function exportWav() {
  const samples = synthesize(state.params, EXPORT_SECONDS, SAMPLE_RATE);
  const blob = floatToWav(samples, SAMPLE_RATE);
  downloadBlob(blob, `${safeName(state.params.label)}.wav`);
  setStatus("WAV exported.");
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state.params, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${safeName(state.params.label)}.json`);
  setStatus("Preset JSON exported.");
}

function saveToBrowser() {
  const saved = loadSavedPresets().filter((item) => item.label !== state.params.label);
  saved.push(cloneParams(state.params));
  writeSavedPresets(saved);
  refreshSavedPresetSelect();
  setStatus("Preset saved in this browser.");
}

function loadFromBrowser() {
  const index = Number(els.savedPresetSelect.value);
  const saved = loadSavedPresets();
  if (!saved[index]) return;
  setParams(saved[index]);
  setStatus("Browser preset loaded.");
}

function deleteFromBrowser() {
  const index = Number(els.savedPresetSelect.value);
  const saved = loadSavedPresets();
  if (!saved[index]) return;
  saved.splice(index, 1);
  writeSavedPresets(saved);
  refreshSavedPresetSelect();
  setStatus("Browser preset deleted.");
}

function importPresetFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || "{}"));
      setParams(data);
      setStatus("Preset imported.");
    } catch {
      setStatus("Could not read preset JSON.");
    }
  };
  reader.readAsText(file);
}

function renderModelSummary() {
  const summary = physicsSummary(state.params);
  els.modelTitle.textContent = summary.title;
  els.modelLine1.textContent = summary.line1;
  els.modelLine2.textContent = summary.line2;
  els.formula1.textContent = summary.formula1;
  els.formula2.textContent = summary.formula2;
  els.chainText.innerHTML = summary.chain.map((item) => `<span>${item}</span>`).join("");

  const literal = !state.params.lowFreqSonify && state.params.baseFreq >= 20;
  els.literalStatus.textContent = literal ? "Literal audio-range estimate" : "Carrier-based sonification or sub-audio mapping";
  els.numericSummary.textContent = `${formatValue(state.params.baseFreq, 0.1)} Hz base · ${formatValue(state.params.depth, 0.01)} depth · ${formatValue(state.params.resonanceHz, 1)} Hz resonance`;
  els.warningBox.innerHTML = literal
    ? "This preset is in the audio range, so the model can be interpreted as a literal audio-rate estimate of the chosen mechanism."
    : "If the base pattern is below about 20 Hz, the app is not claiming that the light is directly audible. It is mapping the envelope onto a carrier so the timing pattern can be heard.";
}

function renderCanvases() {
  const preview = getPreviewData(state.params);
  drawSeries(els.lightCanvas, preview.light, "#79e3ff", false);
  drawSeries(
    els.audioCanvas,
    preview.audio.map((p) => ({ x: p.x, y: 0.5 + p.y * 0.45 })),
    "#f093fb",
    true,
  );
}

function render() {
  syncControlValues();
  renderModelSummary();
  renderCanvases();
  populatePresetSelect();
  refreshSavedPresetSelect();
}

function bindEvents() {
  els.presetSelect.addEventListener("change", () => {
    const preset = PRESETS.find((item) => item.params.label === els.presetSelect.value);
    if (preset) {
      setParams(preset.params);
      setStatus(`Preset loaded: ${preset.name}`);
    }
  });
  els.labelInput.addEventListener("input", () => updateParam("label", els.labelInput.value, false));
  els.playBtn.addEventListener("click", () => startAudio());
  els.stopBtn.addEventListener("click", () => stopAudio());
  els.exportWavBtn.addEventListener("click", exportWav);
  els.recordBtn.addEventListener("click", recordLive);
  els.exportJsonBtn.addEventListener("click", exportJson);
  els.saveBrowserBtn.addEventListener("click", saveToBrowser);
  els.loadBrowserBtn.addEventListener("click", loadFromBrowser);
  els.deleteBrowserBtn.addEventListener("click", deleteFromBrowser);
  els.importPresetInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) importPresetFile(file);
    event.target.value = "";
  });
}

function init() {
  buildControls();
  populatePresetSelect();
  refreshSavedPresetSelect();
  bindEvents();
  els.labelInput.value = state.params.label;
  els.capabilityText.textContent = window.AudioContext || window.webkitAudioContext
    ? "Static demo loaded. Play, record, download and save all work in modern Chromium-based browsers and Safari."
    : "This browser does not expose Web Audio. The UI will load, but playback will not work.";
  render();
}

window.addEventListener("beforeunload", () => {
  stopAudio();
  clearTimeout(state.recordTimeout);
  if (state.audioContext && state.audioContext.close) {
    try { state.audioContext.close(); } catch {}
  }
});

init();
