# Distant Lights

Distant Lights is a **plain static browser demo** for exploring three related ideas:

1. **Electrical / mechanical hum** from lighting electronics, transformers, ballasts, inductors, and capacitors.
2. **Photoacoustic response** from intensity-modulated light absorbed by a material.
3. **Sonification** for slow flashing lights that are below the normal audible range.

This version is deliberately simple:
- no framework install
- no build step
- no GitHub Actions required
- no Vite config required
- runs directly from `index.html`

## What is included

- `index.html` — the demo page
- `styles.css` — styling
- `app.js` — all audio, waveform, preset, save, record, and export logic
- `.nojekyll` — helps GitHub Pages serve the repo root as a static site

## Features

- interactive presets
- waveform preview for light modulation
- waveform preview for audio output
- play / stop
- high-quality 48 kHz WAV export
- live 8-second browser recording to WebM/Opus when supported
- preset download as JSON
- preset import from JSON
- preset save/load in browser localStorage
- model explanation panel with equations and interpretation text

## How to publish on GitHub Pages

### Option A: repo root publish

1. Delete the old project files from the repository root.
2. Upload the contents of this folder to the **repo root**.
3. In GitHub, go to **Settings → Pages**.
4. Set **Source** to **Deploy from a branch**.
5. Choose **Branch: `main`** and **Folder: `/ (root)`**.
6. Save.

Then the demo should be served directly from:

`https://iusmusic.github.io/distant-lights/`

### Option B: keep using GitHub Actions

If the repository is already set to publish from GitHub Actions, either switch it back to **Deploy from a branch**, or create a workflow that uploads the repository root as a Pages artifact. This static version does not need a build.

## Physics model used in the demo

### 1) Electrical / mechanical hum

The demo uses a light/current modulation source signal:

`I(t) = I0 [1 + m·s(t)]`

That source is then shaped with a resonant filter and an optional whine term:

`p(t) ≈ dry(t) + Hres{dry(t)} + Awhine·sin(2π fwhine t)`

This is a compact approximation of:
- 100 Hz / 120 Hz mains-related ripple and hum
- PWM dimming artifacts
- fixture or enclosure resonance
- optional higher-frequency driver whine

### 2) Photoacoustic approximation

The demo uses a simple thermal low-pass and derivative:

`I(t) = I0 [1 + m·s(t)]`

`τ·dT/dt = I(t) − T`

`p(t) ∝ dT/dt`

This is not a laboratory-grade simulation. It is a compact approximation of absorbed light causing heating, then pressure variation.

### 3) Sonification for slow beacons

If the base pattern is very slow, the demo maps the envelope onto an audible carrier:

`y(t) = envelope(t) · sin(2π fc t)`

That is **sonification**. It is not a claim that a 1 Hz flashing light directly makes a 1 Hz audible tone.

## References

These are the sources used to ground the README wording and the model choices.

### Human hearing and infrasound

- NCBI Bookshelf, *Neuroscience – The Audible Spectrum*: humans detect sounds roughly from 20 Hz to 20 kHz.
  - https://www.ncbi.nlm.nih.gov/books/NBK10924/
- Wikipedia, *Perception of infrasound*: sounds below 20 Hz are infrasound and are generally not consciously heard at ordinary levels.
  - https://en.wikipedia.org/wiki/Perception_of_infrasound

### Mains hum, magnetostriction, and transformer/coil vibration

- Wikipedia, *Mains hum*: mains hum is typically at twice line frequency, and transformer hum can arise from magnetostriction and vibration.
  - https://en.wikipedia.org/wiki/Mains_hum
- Electric Power Inc., *Why Do Transformers Hum?*: practical explanation of magnetostriction and audible transformer hum.
  - https://www.electpower.com/why-do-transformers-hum/
- Würth Elektronik application note, *ANP118 Acoustic noise & Coil whine effect*: explains magnetostriction, coil noise, burst-mode effects, and why switching systems can become audible.
  - https://www.we-online.com/components/media/o861473v410%20ANP118a_Acoustic%20noise%20and%20coil%20whine%20effect_EN.pdf
- Analog Devices, *Avoid the Audio Band with PWM LED Dimming at Frequencies Above 20 kHz*: explains why lower PWM frequencies can produce audible vibration and hum in components such as ceramic capacitors.
  - https://www.analog.com/en/resources/technical-articles/avoid-the-audio-band-with-pwm-led-dimming.html

### Photoacoustic effect

- Wikipedia, *Photoacoustic effect*: overview of modulated light absorption producing sound after conversion to heat and pressure changes.
  - https://en.wikipedia.org/wiki/Photoacoustic_effect

## Notes

- WAV export is the highest-quality output in the demo.
- Live recording uses browser support for `MediaRecorder`; if that is unavailable, use WAV export.
- The sound is synthetic and explanatory. It is a **physics-informed demo**, not a proof that humans directly hear steady visible light.
