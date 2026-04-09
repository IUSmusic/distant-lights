/**
 * Distant Lights – browser entry point.
 *
 * This file now wires together not only the single-preset demo, but also the
 * timeline editor, multi-model layering, LFO automation, MIDI export and OSC-
 * style project export requested for the full composer workflow.
 */

import {
  SAMPLE_RATE,
  LOOP_SECONDS,
  EXPORT_SECONDS,
  RECORD_SECONDS,
  PRESETS,
  CONTROL_CONFIG,
} from './presets/index.js';
import { synthesize } from './audio-engine/synth.js';
import { synthesizeProjectPreview, renderProjectSequence } from './audio-engine/project.js';
import { sequenceToOscBundle } from './audio-engine/osc.js';
import { floatToWav, downloadBlob, safeName } from './audio-engine/export.js';
import { sequenceToMidi } from './models/midi.js';
import { physicsSummary } from './models/physics.js';
import { buildControls, populatePresetSelect, refreshSavedPresetSelect } from './ui/controls.js';
import { drawSeries } from './ui/draw.js';
import { loadSavedPresets, writeSavedPresets } from './ui/storage.js';
import { renderAutomationLanes } from './ui/automation.js';
import { drawTimeline, renderSequenceEditor } from './ui/timeline.js';

/** Deep clone helper for plain JSON data. */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Basic waveform helper for the visual light preview. */
function wavePreview(t, freq, waveform, duty) {
  const phase = (t * freq) % 1;
  const s = Math.sin(2 * Math.PI * freq * t);
  switch (waveform) {
    case 'sine': return s;
    case 'square': return s >= 0 ? 1 : -1;
    case 'triangle': return 1 - 4 * Math.abs(phase - 0.5);
    case 'pwm': return phase < duty ? 1 : -1;
    case 'abs-sine': return Math.abs(s) * 2 - 1;
    default: return s;
  }
}

/** Default automation lane factory. */
function makeAutomationLane(target = 'depth') {
  return {
    enabled: true,
    target,
    waveform: 'sine',
    mode: 'add',
    rateHz: 0.5,
    depth: 0.08,
    phaseDegrees: 0,
  };
}

/** Initial multi-model layer settings. */
function defaultLayerSettings() {
  return {
    electricalEnabled: true,
    electricalGain: 1,
    photoacousticEnabled: false,
    photoacousticGain: 0.8,
    sonificationEnabled: false,
    sonificationGain: 0.8,
  };
}

const state = {
  params: clone(PRESETS[0].params),
  layerSettings: defaultLayerSettings(),
  automationLanes: [makeAutomationLane('depth')],
  sequenceEvents: [],
  sequenceBpm: 120,
  isPlaying: false,
  isRecording: false,
  audioContext: null,
  source: null,
  gainNode: null,
  mediaDest: null,
  recorder: null,
  recordChunks: [],
  recordTimeout: null,
  selectedSequenceIndex: -1,
};

const els = {
  presetSelect: document.getElementById('presetSelect'),
  controlsContainer: document.getElementById('controlsContainer'),
  savedPresetSelect: document.getElementById('savedPresetSelect'),
  statusText: document.getElementById('statusText'),
  capabilityText: document.getElementById('capabilityText'),
  lightCanvas: document.getElementById('lightCanvas'),
  audioCanvas: document.getElementById('audioCanvas'),
  timelineCanvas: document.getElementById('timelineCanvas'),
  sequenceContainer: document.getElementById('sequenceContainer'),
  automationContainer: document.getElementById('automationContainer'),
  modelTitle: document.getElementById('modelTitle'),
  formula1: document.getElementById('formula1'),
  formula2: document.getElementById('formula2'),
  literalStatus: document.getElementById('literalStatus'),
  numericSummary: document.getElementById('numericSummary'),
  warningBox: document.getElementById('warningBox'),
  playBtn: document.getElementById('playBtn'),
  playProjectBtn: document.getElementById('playProjectBtn'),
  stopBtn: document.getElementById('stopBtn'),
  exportWavBtn: document.getElementById('exportWavBtn'),
  exportProjectWavBtn: document.getElementById('exportProjectWavBtn'),
  exportMidiBtn: document.getElementById('exportMidiBtn'),
  exportOscBtn: document.getElementById('exportOscBtn'),
  recordBtn: document.getElementById('recordBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  saveBrowserBtn: document.getElementById('saveBrowserBtn'),
  loadBrowserBtn: document.getElementById('loadBrowserBtn'),
  deleteBrowserBtn: document.getElementById('deleteBrowserBtn'),
  importPresetInput: document.getElementById('importPresetInput'),
  addCurrentEventBtn: document.getElementById('addCurrentEventBtn'),
  clearSequenceBtn: document.getElementById('clearSequenceBtn'),
  addAutomationLaneBtn: document.getElementById('addAutomationLaneBtn'),
  sequenceBpmInput: document.getElementById('sequenceBpmInput'),
  layerElectricalEnabled: document.getElementById('layerElectricalEnabled'),
  layerElectricalGain: document.getElementById('layerElectricalGain'),
  layerPhotoEnabled: document.getElementById('layerPhotoEnabled'),
  layerPhotoGain: document.getElementById('layerPhotoGain'),
  layerSonifyEnabled: document.getElementById('layerSonifyEnabled'),
  layerSonifyGain: document.getElementById('layerSonifyGain'),
};

/** Return the list of numeric control keys that automation may target. */
function automationTargets() {
  return CONTROL_CONFIG.filter((config) => config.type === 'range').map((config) => config.key);
}

/** Keep the layer UI and state synchronized. */
function syncLayerUiToState() {
  els.layerElectricalEnabled.checked = !!state.layerSettings.electricalEnabled;
  els.layerElectricalGain.value = state.layerSettings.electricalGain;
  els.layerPhotoEnabled.checked = !!state.layerSettings.photoacousticEnabled;
  els.layerPhotoGain.value = state.layerSettings.photoacousticGain;
  els.layerSonifyEnabled.checked = !!state.layerSettings.sonificationEnabled;
  els.layerSonifyGain.value = state.layerSettings.sonificationGain;
}

/** Read current layer control values into state. */
function syncLayerStateFromUi() {
  state.layerSettings = {
    electricalEnabled: els.layerElectricalEnabled.checked,
    electricalGain: Number(els.layerElectricalGain.value),
    photoacousticEnabled: els.layerPhotoEnabled.checked,
    photoacousticGain: Number(els.layerPhotoGain.value),
    sonificationEnabled: els.layerSonifyEnabled.checked,
    sonificationGain: Number(els.layerSonifyGain.value),
  };
}

/** Serialize the current full project, not just the current preset. */
function serializeProject() {
  return {
    version: 'distant-lights-project-v2',
    label: state.params.label,
    params: clone(state.params),
    layerSettings: clone(state.layerSettings),
    automationLanes: clone(state.automationLanes),
    sequenceBpm: state.sequenceBpm,
    sequenceEvents: clone(state.sequenceEvents),
  };
}

/**
 * Restore either a legacy preset JSON or a full project JSON.
 *
 * @param {Object} payload Parsed JSON payload.
 */
function restoreProject(payload) {
  if (!payload) return;
  if (payload.params) {
    state.params = clone(payload.params);
  }
  if (payload.layerSettings) {
    state.layerSettings = { ...defaultLayerSettings(), ...clone(payload.layerSettings) };
  }
  if (payload.automationLanes) {
    state.automationLanes = clone(payload.automationLanes);
  }
  if (Array.isArray(payload.sequenceEvents)) {
    state.sequenceEvents = clone(payload.sequenceEvents);
  }
  if (payload.sequenceBpm) {
    state.sequenceBpm = Number(payload.sequenceBpm) || 120;
  }
  buildControls(els.controlsContainer, CONTROL_CONFIG, state.params, updateParam);
  els.presetSelect.value = state.params.label;
  syncLayerUiToState();
  els.sequenceBpmInput.value = state.sequenceBpm;
  refreshProjectUi();
}

/** Update all overview UI after data/state changes. */
function refreshProjectUi() {
  updatePreview();
  updateNumericSummary();
  updatePhysicsSummary();
  renderAutomationLanes(els.automationContainer, state.automationLanes, automationTargets(), handleAutomationAction);
  renderSequenceEditor(els.sequenceContainer, state.sequenceEvents, PRESETS, handleSequenceAction);
  drawTimeline(els.timelineCanvas, state.sequenceEvents, state.selectedSequenceIndex);
  els.capabilityText.textContent = `${state.sequenceEvents.length} event${state.sequenceEvents.length === 1 ? '' : 's'} · ${state.automationLanes.length} LFO lane${state.automationLanes.length === 1 ? '' : 's'}`;
}

/** Update numeric summary text. */
function updateNumericSummary() {
  const p = state.params;
  const activeLayers = [
    state.layerSettings.electricalEnabled ? 'elec' : null,
    state.layerSettings.photoacousticEnabled ? 'photo' : null,
    state.layerSettings.sonificationEnabled ? 'sonify' : null,
  ].filter(Boolean).join('+') || 'none';
  els.numericSummary.textContent = `f0=${p.baseFreq.toFixed(2)} Hz, depth=${p.depth.toFixed(2)}, Q=${p.resonanceQ.toFixed(2)}, gain=${p.gain.toFixed(2)}, layers=${activeLayers}`;
}

/** Render human-friendly formula strings. */
function updatePhysicsSummary() {
  const summary = physicsSummary(state.params);
  els.modelTitle.textContent = summary.title;
  els.formula1.textContent = summary.formula1.replaceAll('\\', '');
  els.formula2.textContent = summary.formula2.replaceAll('\\', '');
  if (state.layerSettings.photoacousticEnabled && state.layerSettings.electricalEnabled) {
    els.literalStatus.textContent = 'layered hum + photoacoustic';
  } else if (state.layerSettings.sonificationEnabled) {
    els.literalStatus.textContent = 'layered / sonified';
  } else if (state.params.mode === 'photoacoustic') {
    els.literalStatus.textContent = 'thermal diffusion → pressure';
  } else {
    els.literalStatus.textContent = 'direct modulation / magnetostriction-inspired';
  }
}

/** Update visual previews. */
function updatePreview() {
  const previewDuration = 0.08;
  const preview = synthesizeProjectPreview(state.params, previewDuration, 4000, state.automationLanes, state.layerSettings);
  const points = 180;
  const light = [];
  const audio = [];
  for (let i = 0; i < points; i += 1) {
    const t = i / points;
    const wave = wavePreview(t, Math.max(state.params.baseFreq, 1), state.params.waveform, state.params.duty);
    const intensity = Math.max(0, Math.min(1, 0.5 + 0.5 * state.params.depth * wave));
    light.push({ x: i, y: intensity });
    const idx = Math.floor((i / points) * preview.length);
    audio.push({ x: i, y: preview[idx] || 0 });
  }
  drawSeries(els.lightCanvas, light, '#0ff', false);
  drawSeries(els.audioCanvas, audio, '#ff0', true);
}

/** Update one parameter from the main control surface. */
function updateParam(key, value) {
  state.params[key] = value;
  refreshProjectUi();
}

/** Apply a built-in preset to the current editor state. */
function applyPreset(preset) {
  state.params = clone(preset.params);
  buildControls(els.controlsContainer, CONTROL_CONFIG, state.params, updateParam);
  refreshProjectUi();
  els.presetSelect.value = state.params.label;
}

/** Save the current browser project. */
function saveProjectToBrowser() {
  const saved = loadSavedPresets();
  const project = serializeProject();
  const existingIndex = saved.findIndex((item) => item.label === project.label);
  if (existingIndex >= 0) saved[existingIndex] = project;
  else saved.push(project);
  writeSavedPresets(saved);
  refreshSavedPresetSelect(els.savedPresetSelect, saved);
}

/** Load a browser-saved project by index. */
function loadProjectFromBrowser(index) {
  const saved = loadSavedPresets();
  if (!saved[index]) return;
  restoreProject(saved[index]);
}

/** Delete a browser-saved project by index. */
function deleteProjectFromBrowser(index) {
  const saved = loadSavedPresets();
  if (!saved[index]) return;
  saved.splice(index, 1);
  writeSavedPresets(saved);
  refreshSavedPresetSelect(els.savedPresetSelect, saved);
}

/** Export the current project as JSON. */
function exportProjectJson() {
  const blob = new Blob([JSON.stringify(serializeProject(), null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${safeName(state.params.label)}-project.json`);
}

/** Import a project or legacy preset JSON file. */
function importProjectFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      restoreProject(JSON.parse(String(reader.result)));
    } catch (error) {
      els.warningBox.textContent = `Import failed: ${error.message}`;
    }
  };
  reader.readAsText(file);
}

/** Convert samples to an AudioBuffer and start playback. */
async function playSamples(samples, { loop = false } = {}) {
  stopPlayback();
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioContext.state === 'suspended') {
    await state.audioContext.resume();
  }
  const buffer = state.audioContext.createBuffer(1, samples.length, SAMPLE_RATE);
  buffer.copyToChannel(samples, 0);
  const source = state.audioContext.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;
  const gainNode = state.audioContext.createGain();
  source.connect(gainNode);
  gainNode.connect(state.audioContext.destination);
  if (state.isRecording && state.mediaDest) gainNode.connect(state.mediaDest);
  source.start();
  source.onended = () => {
    if (!source.loop) {
      state.isPlaying = false;
      els.playBtn.disabled = false;
      els.playProjectBtn.disabled = false;
      els.stopBtn.disabled = true;
      els.statusText.textContent = 'Ready';
    }
  };
  state.source = source;
  state.gainNode = gainNode;
  state.isPlaying = true;
  els.playBtn.disabled = loop;
  els.playProjectBtn.disabled = true;
  els.stopBtn.disabled = false;
}

/** Stop playback and release audio nodes. */
function stopPlayback() {
  if (state.source) {
    try { state.source.stop(); } catch {}
    state.source.disconnect();
    state.source = null;
  }
  if (state.gainNode) {
    state.gainNode.disconnect();
    state.gainNode = null;
  }
  if (state.mediaDest && !state.isRecording) {
    state.mediaDest.disconnect();
    state.mediaDest = null;
  }
  state.isPlaying = false;
  els.playBtn.disabled = false;
  els.playProjectBtn.disabled = false;
  els.stopBtn.disabled = true;
  if (!state.isRecording) els.statusText.textContent = 'Stopped';
}

/** Play the current layered sound as a looping preview. */
async function startPlayback() {
  els.statusText.textContent = 'Playing preview';
  const samples = synthesizeProjectPreview(state.params, LOOP_SECONDS, SAMPLE_RATE, state.automationLanes, state.layerSettings);
  await playSamples(samples, { loop: true });
}

/** Play the full project sequence once. */
async function startProjectPlayback() {
  if (!state.sequenceEvents.length) {
    els.warningBox.textContent = 'Add at least one event to the timeline first.';
    return;
  }
  els.statusText.textContent = 'Playing sequence';
  const samples = renderProjectSequence(state.sequenceEvents, SAMPLE_RATE);
  await playSamples(samples, { loop: false });
}

/** Export the current layered preview as WAV. */
function exportCurrentWav() {
  const samples = synthesizeProjectPreview(state.params, EXPORT_SECONDS, SAMPLE_RATE, state.automationLanes, state.layerSettings);
  const blob = floatToWav(samples, SAMPLE_RATE);
  downloadBlob(blob, `${safeName(state.params.label)}.wav`);
}

/** Export the timeline as WAV. */
function exportProjectWav() {
  const samples = state.sequenceEvents.length
    ? renderProjectSequence(state.sequenceEvents, SAMPLE_RATE)
    : synthesizeProjectPreview(state.params, EXPORT_SECONDS, SAMPLE_RATE, state.automationLanes, state.layerSettings);
  const blob = floatToWav(samples, SAMPLE_RATE);
  downloadBlob(blob, `${safeName(state.params.label)}-sequence.wav`);
}

/** Export the timeline as a Standard MIDI file. */
function exportMidi() {
  const events = state.sequenceEvents.length ? state.sequenceEvents : [{
    label: state.params.label,
    start: 0,
    duration: 4,
    params: clone(state.params),
    layerSettings: clone(state.layerSettings),
    automationLanes: clone(state.automationLanes),
  }];
  const midi = sequenceToMidi(events, state.sequenceBpm);
  const blob = new Blob([midi], { type: 'audio/midi' });
  downloadBlob(blob, `${safeName(state.params.label)}.mid`);
}

/** Export an OSC-style JSON bundle. */
function exportOsc() {
  const events = state.sequenceEvents.length ? state.sequenceEvents : [{
    label: state.params.label,
    start: 0,
    duration: 4,
    params: clone(state.params),
    layerSettings: clone(state.layerSettings),
    automationLanes: clone(state.automationLanes),
  }];
  const oscJson = sequenceToOscBundle(events);
  const blob = new Blob([JSON.stringify(oscJson, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${safeName(state.params.label)}-osc.json`);
}

/** Start browser recording of the current preview output. */
async function startRecording() {
  if (state.isRecording) {
    stopRecording();
    return;
  }
  if (typeof MediaRecorder === 'undefined') {
    els.warningBox.textContent = 'MediaRecorder is not available in this browser.';
    return;
  }
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  state.mediaDest = state.audioContext.createMediaStreamDestination();
  state.recordChunks = [];
  const recorder = new MediaRecorder(state.mediaDest.stream);
  state.recorder = recorder;
  state.isRecording = true;
  els.recordBtn.textContent = 'Stop Rec';
  els.statusText.textContent = 'Recording';
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) state.recordChunks.push(event.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(state.recordChunks, { type: recorder.mimeType });
    downloadBlob(blob, `${safeName(state.params.label)}.webm`);
    state.isRecording = false;
    els.recordBtn.textContent = 'Record';
    if (state.mediaDest) {
      state.mediaDest.disconnect();
      state.mediaDest = null;
    }
  };
  recorder.start();
  if (state.isPlaying && state.gainNode && state.mediaDest) {
    state.gainNode.connect(state.mediaDest);
  } else {
    await startPlayback();
  }
  state.recordTimeout = setTimeout(stopRecording, RECORD_SECONDS * 1000);
}

/** Stop browser recording. */
function stopRecording() {
  if (state.recordTimeout) clearTimeout(state.recordTimeout);
  state.recordTimeout = null;
  if (state.recorder && state.isRecording) state.recorder.stop();
}

/** Add the current editor state as a new sequence event. */
function addCurrentEvent() {
  const lastEnd = state.sequenceEvents.reduce((max, event) => Math.max(max, event.start + event.duration), 0);
  state.sequenceEvents.push({
    label: state.params.label,
    start: Number(lastEnd.toFixed(2)),
    duration: 4,
    params: clone(state.params),
    layerSettings: clone(state.layerSettings),
    automationLanes: clone(state.automationLanes),
  });
  state.selectedSequenceIndex = state.sequenceEvents.length - 1;
  refreshProjectUi();
}

/** Handle automation editor actions. */
function handleAutomationAction(action, index, payload) {
  if (action === 'update-field') {
    state.automationLanes[index][payload.field] = payload.value;
  } else if (action === 'remove') {
    state.automationLanes.splice(index, 1);
  }
  refreshProjectUi();
}

/** Handle sequence editor actions. */
function handleSequenceAction(action, index, payload) {
  const event = state.sequenceEvents[index];
  if (!event) return;
  if (action === 'update-field') {
    if (payload.field === 'presetLabel') {
      const preset = PRESETS.find((candidate) => candidate.params.label === payload.value);
      if (preset) {
        event.params = clone(preset.params);
        event.label = preset.name;
      }
    } else {
      event[payload.field] = payload.value;
    }
  } else if (action === 'load') {
    state.params = clone(event.params);
    state.layerSettings = clone(event.layerSettings || defaultLayerSettings());
    state.automationLanes = clone(event.automationLanes || [makeAutomationLane('depth')]);
    buildControls(els.controlsContainer, CONTROL_CONFIG, state.params, updateParam);
    syncLayerUiToState();
    els.presetSelect.value = state.params.label;
    state.selectedSequenceIndex = index;
  } else if (action === 'dup') {
    state.sequenceEvents.splice(index + 1, 0, {
      ...clone(event),
      start: Number((event.start + event.duration).toFixed(2)),
      label: `${event.label} copy`,
    });
  } else if (action === 'remove') {
    state.sequenceEvents.splice(index, 1);
    state.selectedSequenceIndex = -1;
  }
  refreshProjectUi();
}

/** Wire up static event listeners. */
function bindEventListeners() {
  els.playBtn.addEventListener('click', startPlayback);
  els.playProjectBtn.addEventListener('click', startProjectPlayback);
  els.stopBtn.addEventListener('click', () => {
    stopPlayback();
    stopRecording();
  });
  els.exportWavBtn.addEventListener('click', exportCurrentWav);
  els.exportProjectWavBtn.addEventListener('click', exportProjectWav);
  els.exportMidiBtn.addEventListener('click', exportMidi);
  els.exportOscBtn.addEventListener('click', exportOsc);
  els.recordBtn.addEventListener('click', startRecording);
  els.exportJsonBtn.addEventListener('click', exportProjectJson);
  els.saveBrowserBtn.addEventListener('click', saveProjectToBrowser);
  els.loadBrowserBtn.addEventListener('click', () => loadProjectFromBrowser(parseInt(els.savedPresetSelect.value, 10)));
  els.deleteBrowserBtn.addEventListener('click', () => deleteProjectFromBrowser(parseInt(els.savedPresetSelect.value, 10)));
  els.addCurrentEventBtn.addEventListener('click', addCurrentEvent);
  els.clearSequenceBtn.addEventListener('click', () => {
    state.sequenceEvents = [];
    state.selectedSequenceIndex = -1;
    refreshProjectUi();
  });
  els.addAutomationLaneBtn.addEventListener('click', () => {
    state.automationLanes.push(makeAutomationLane(automationTargets()[0]));
    refreshProjectUi();
  });
  els.sequenceBpmInput.addEventListener('change', () => {
    state.sequenceBpm = Number(els.sequenceBpmInput.value) || 120;
  });
  [
    els.layerElectricalEnabled,
    els.layerElectricalGain,
    els.layerPhotoEnabled,
    els.layerPhotoGain,
    els.layerSonifyEnabled,
    els.layerSonifyGain,
  ].forEach((element) => element.addEventListener('input', () => {
    syncLayerStateFromUi();
    refreshProjectUi();
  }));
  els.importPresetInput.addEventListener('change', () => {
    const file = els.importPresetInput.files?.[0];
    if (file) importProjectFile(file);
    els.importPresetInput.value = '';
  });
}

/** Initial boot sequence. */
function init() {
  populatePresetSelect(els.presetSelect, PRESETS, state.params, applyPreset);
  buildControls(els.controlsContainer, CONTROL_CONFIG, state.params, updateParam);
  refreshSavedPresetSelect(els.savedPresetSelect, loadSavedPresets());
  syncLayerUiToState();
  els.sequenceBpmInput.value = state.sequenceBpm;
  els.stopBtn.disabled = true;
  bindEventListeners();
  refreshProjectUi();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
