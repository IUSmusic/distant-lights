/**
 * @module ui/storage
 *
 * Persistence helpers for user‑defined presets.  All browser state is stored
 * under a single key defined in {@link module:presets/index}.  These
 * functions wrap `localStorage` access with JSON parsing and error handling.
 */

import { STORAGE_KEY } from '../presets/index.js';

/**
 * Read the array of user‑defined presets from localStorage.  If parsing
 * fails or no data is stored, an empty array is returned.  Each preset
 * should have at least a `label` and `params` property.  This helper
 * decouples the rest of the code from direct `localStorage` calls.
 *
 * @returns {Array<{label: string, params: object}>}
 */
export function loadSavedPresets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Persist an array of presets to localStorage.  The entire array is
 * serialised as JSON and stored under the key defined by
 * {@link STORAGE_KEY}.  Existing data is overwritten.
 *
 * @param {Array<{label: string, params: object}>} presets Preset entries to
 *  store.
 */
export function writeSavedPresets(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}