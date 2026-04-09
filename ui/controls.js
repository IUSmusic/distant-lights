/**
 * @module ui/controls
 *
 * Build and update interactive controls for the Distant Lights demo.  The
 * exported functions are designed to be called from the main entry point
 * (`main.js`) and accept callbacks so that the business logic can be
 * separated from the DOM manipulation.  All control values are bound to
 * properties of a shared `params` object.
 */

/**
 * Create parameter controls inside the given container element.  The
 * configuration defines the type of widget (select, range or checkbox) and
 * the range or options for each parameter.  When the user interacts with a
 * control, the `onChange` callback is invoked with the key and new value.
 *
 * @param {HTMLElement} container   The DOM element into which controls are
 *  inserted.
 * @param {Array} config            Control definitions from
 *  {@link module:presets/index~CONTROL_CONFIG}.
 * @param {Object} params           Current parameter values.  Used to set
 *  initial control positions.
 * @param {(key: string, value: any, commit: boolean) => void} onChange
 *  Callback invoked when a control changes.  `commit` is true on change
 *  events (mouseup) and false on input events (mousemove) for range sliders.
 */
export function buildControls(container, config, params, onChange) {
  container.innerHTML = '';
  config.forEach((item) => {
    if (item.type === 'checkbox') {
      const wrapper = document.createElement('label');
      wrapper.className = 'control-card checkbox-card';
      wrapper.innerHTML = `
        <input type="checkbox" id="control-${item.key}" />
        <div>
          <div class="control-label">${item.label}</div>
        </div>
      `;
      const input = /** @type {HTMLInputElement} */ (wrapper.querySelector('input'));
      input.checked = !!params[item.key];
      input.addEventListener('change', () => onChange(item.key, input.checked, true));
      container.appendChild(wrapper);
      return;
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'control-card';
    if (item.type === 'select') {
      wrapper.innerHTML = `
        <div class="control-top">
          <div><div class="control-label">${item.label}</div></div>
        </div>
        <select id="control-${item.key}">
          ${item.options.map((option) => `<option value="${option}">${option}</option>`).join('')}
        </select>
      `;
      const select = /** @type {HTMLSelectElement} */ (wrapper.querySelector('select'));
      select.value = params[item.key];
      select.addEventListener('change', () => onChange(item.key, select.value, true));
    } else if (item.type === 'range') {
      wrapper.innerHTML = `
        <div class="control-top">
          <div><div class="control-label">${item.label}</div></div>
          <div class="control-value" id="value-${item.key}"></div>
        </div>
        <input id="control-${item.key}" type="range" min="${item.min}" max="${item.max}" step="${item.step}" />
      `;
      const input = /** @type {HTMLInputElement} */ (wrapper.querySelector('input'));
      const valueDisplay = /** @type {HTMLElement} */ (wrapper.querySelector(`#value-${item.key}`));
      input.value = params[item.key];
      valueDisplay.textContent = String(params[item.key]);
      input.addEventListener('input', () => {
        const val = Number(input.value);
        valueDisplay.textContent = val.toString();
        onChange(item.key, val, false);
      });
      input.addEventListener('change', () => {
        const val = Number(input.value);
        valueDisplay.textContent = val.toString();
        onChange(item.key, val, true);
      });
    }
    container.appendChild(wrapper);
  });
}

/**
 * Populate a `<select>` element with the built‑in presets.  When the user
 * selects a preset, the `onSelect` callback is invoked with the preset
 * object.  The current preset is indicated by setting the select’s value to
 * `params.label`.
 *
 * @param {HTMLSelectElement} select  The select element to populate.
 * @param {Array<{name: string, params: Object}>} presets  Presets to list.
 * @param {Object} params           Current parameter values; used to set
 *  initial selection.
 * @param {(preset: {name: string, params: Object}) => void} onSelect
 *  Callback invoked when a preset is chosen.
 */
export function populatePresetSelect(select, presets, params, onSelect) {
  select.innerHTML = presets.map((preset) => `<option value="${preset.params.label}">${preset.name}</option>`).join('');
  select.value = params.label;
  select.addEventListener('change', () => {
    const chosen = presets.find((p) => p.params.label === select.value);
    if (chosen) onSelect(chosen);
  });
}

/**
 * Update the saved presets select element.  If there are no saved presets
 * the select is disabled and a placeholder is shown.  Otherwise the options
 * display the user‑assigned label for each preset.  The caller is
 * responsible for updating the current selection.
 *
 * @param {HTMLSelectElement} select  Target select element.
 * @param {Array<{label: string, params: Object}>} saved Saved preset objects.
 */
export function refreshSavedPresetSelect(select, saved) {
  if (!saved.length) {
    select.innerHTML = '<option value="">No saved presets</option>';
    select.disabled = true;
    return;
  }
  select.disabled = false;
  select.innerHTML = saved.map((item, idx) => `<option value="${idx}">${item.label}</option>`).join('');
}