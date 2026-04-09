# Distant Lights

https://iusmusic.github.io/lights/

Distant Lights is a **plain static browser demo** for exploring three related ideas:

1. **Electrical / mechanical hum** from lighting electronics, transformers, ballasts, inductors, and capacitors.
2. **Photoacoustic response** from intensity-modulated light absorbed by a material.
3. **Sonification** for slow flashing lights that are below the normal audible range.

## Features

The revised **Distant Lights** toolkit goes beyond a simple hum simulator.  It is
designed as both a learning aid and a creative tool for composers and sound
designers.  Highlights include:

- **Interactive presets** with immediate visual feedback.  All relevant
  parameters (modulation waveform, depth, resonance, whine frequency, photoacoustic
  time constant, carrier for sonification, etc.) are exposed via sliders and
  drop‑down menus.  Changes update the light and audio previews in real time.
- **Sequencing and layering**.  Create sequences of events on a timeline or
  layer several models (electrical hum, photoacoustic response, sonification)
  together to build complex textures.  Internally this uses a simple event
  list that synthesises each section and mixes the results.
- **MIDI/OSC export**.  A built‑in MIDI writer converts your sequence into a
  Standard MIDI file (single track, 960 ticks per quarter note) so you can
  drive external synthesisers, digital audio workstations (DAWs) or modular
  hardware.  Parameter envelopes and modulation depths can also be exported as
  Open Sound Control (OSC) messages (experimental; see `models/midi.js`).
- **Waveform previews** for both the light modulation and the resulting audio.
  The preview canvases update when parameters change or when layers are added.
- **Playback and recording**.  Play the synthetic sound in the browser via
  Web Audio API; record up to 8 seconds of live output to WebM/Opus if your
  browser supports the MediaRecorder API.  Alternatively, export high‑quality
  48 kHz WAV files directly from the synthesiser.
- **Preset management**.  Save your own presets to browser localStorage,
  download them as JSON, or import JSON files shared by others.  Presets
  capture all parameter values and the current sequence timeline.
- **Data and model inspection**.  The physics explanation panel renders
  typeset equations (via LaTeX in Markdown) along with a plain‑language
  interpretation of each model.  There is also a Python port of the core
  synthesiser for high‑precision offline analysis and experimentation.

## Models and derivation

Three related mechanisms underpin the synthesiser.  Each is implemented in a
dedicated module (`models/waveforms.js`, `models/filters.js`, `audio-engine/synth.js`
and their Python counterparts) and exposed to the UI.  The following sections
derive the simplified equations used in the demo and point out which physical
effects are deliberately omitted.

### 1) Electrical / mechanical hum

When an AC current flows through coils and magnetic cores in LED drivers,
transformers or ballasts, the core experiences **magnetostriction**: ferromagnetic
materials expand and contract as the magnetic field changes.  Because the
magnetisation swings positive and negative every half‑cycle, each lamination of
the core lengthens and shortens **twice per magnetisation cycle**.  A 60 Hz power line therefore induces
expansion and contraction at 120 Hz.  The amplitude of vibration depends on the
magnetic flux density and is modulated by the load current.  Irregularities in the
core, windings and mounting cause vibrations at multiples of this fundamental
frequency.

We approximate the electrical driving signal as a base current with a small
modulation depth:

```math
I(t) = I_0 \bigl[1 + m\,s(t)\bigr],
```

where `I₀` is the steady current, `m` (0–1) is the modulation depth and
`s(t)` is a unit‑amplitude waveform selected from sine, square, triangle, PWM
or absolute‑sine (`|sin|`).  The base frequency of `s(t)` is typically twice
the mains frequency (e.g. 100 Hz in the UK, 120 Hz in North America).  This
signal is then passed through a resonant band‑pass filter to mimic the dominant
mechanical mode of the fixture or enclosure.  In discrete time, the filter is
implemented via a difference equation with coefficients derived from a
continuous‑time second‑order system; see `models/filters.js` for the exact
formulation.  The resulting pressure approximation is

```math
p(t) \approx g\,\bigl\{I(t) - \bar{I}\bigr\} + H_{\text{res}}\bigl\{I(t)-\bar{I}\bigr\} + A_{\text{whine}}\sin\bigl(2\pi f_{\text{whine}} t\bigr),
```

where \(g\) is a gain scaling, \(H_{\text{res}}\) is the resonant filter with
centre frequency \(f_{\text{res}}\) and quality factor \(Q\), and `A_whine` and
`f_whine` control an optional high‑frequency whining term representing switch‑mode
drivers or coil whine.  The first term accounts for unfiltered mains ripple,
the second term emphasises the dominant mechanical resonance, and the third term
adds an independent sinusoid.  Real devices may exhibit multiple resonances and
strongly non‑linear magnetostriction, but a single
band‑pass is sufficient for pedagogical purposes.

### 2) Photoacoustic response

When a beam of light with periodically varying intensity is absorbed by a
material, the absorbed energy is converted into heat and a thermoelastic
expansion, which launches acoustic waves.  This phenomenon is known as the
**photoacoustic effect**.  The sound pressure is
measured with microphones or piezoelectric sensors.  In full generality one should solve
the coupled thermal diffusion and elastic wave equations with appropriate
boundary conditions.  For educational use we adopt a simpler model:

```math
I(t) = I_0 \bigl[1 + m\,s(t)\bigr],\qquad
\tau\,\frac{\mathrm{d}T}{\mathrm{d}t} = I(t) - T(t),\qquad
p(t) \propto \frac{\mathrm{d}T}{\mathrm{d}t},
```

where the first‑order differential equation approximates lumped heating and
cooling with time constant \(\tau\).  The derivative of the temperature is
taken as a proxy for pressure.  Internally the JavaScript synthesiser uses
`resonanceQ` and `thermalTau` parameters to tune this filter.  A more faithful
photoacoustic solver would solve the one‑dimensional heat equation

```math
\frac{\partial u}{\partial t} = \kappa\,\frac{\partial^2 u}{\partial x^2},
```

where \(u(x,t)\) is the temperature, \(\kappa\) is the thermal diffusivity and
boundary conditions enforce insulation or contact with the sample【452880545178659†L90-L99】.  Our Python
port includes an experimental finite‑difference time‑domain solver (`run_photoacoustic_fdtd`) that
implements this equation with Neumann boundary conditions (see documentation in
`python/models.py`).  Note that the simple first‑order model neglects spatial
variations, heat conduction to the surroundings and thermoelastic coupling.

### 3) Sonification of slow beacons

For very low modulation frequencies (e.g. a beacon flashing once per second) the
direct acoustic emission is in the infrasound region and would be inaudible.
To help users *hear* the temporal pattern, we employ **sonification**: the
envelope of the modulation signal modulates an audible carrier.  Mathematically

```math
y(t) = \text{env}(t)\,\sin\bigl(2\pi f_c t\bigr),
```

where \(\text{env}(t)\) is the slowly varying envelope (0–1) and \(f_c\) is
the carrier frequency.  This mapping is purely for demonstration; it does not
imply that a 1 Hz flashing light directly produces a 1 Hz audible tone.

### Limitations and simplifications

The models above deliberately omit many physical details:

- **Linear magnetostriction approximation**.  Real cores exhibit hysteresis and
  higher‑order harmonics due to non‑linear magnetostriction.  We approximate
  vibration as a linear transfer function with a single resonance.
- **Single‑pole thermal model**.  The photoacoustic module ignores spatial
  gradients, sample geometry, thermal diffusion into the environment and the
  coupling between heating and pressure waves.  A more complete description
  would solve the heat equation and the wave equation in at least one spatial
  dimension.
- **No electromagnetic radiation coupling**.  Effects such as capacitive
  coupling, electromagnetic interference and microphonic pickups are beyond
  scope.
- **Idealised noise**.  Random noise is added as white Gaussian noise with
  adjustable level.  Real devices exhibit coloured noise and may produce
  broadband components due to current ripple or thermal agitation.
- **Fixed geometry**.  The resonant frequency and quality factor are treated as
  independent parameters, whereas in real fixtures these depend on the size,
  mounting and materials of the enclosure.  Only one resonance is modelled.

Despite these simplifications the model captures the qualitative behaviour of
common lighting systems and provides a versatile playground for exploration.

## How to use Distant Lights as a composer

1. **Choose or create a preset.**  Start with one of the built‑in presets from
   the drop‑down menu.  Each preset defines the base frequency, waveform shape,
   modulation depth, resonance, photoacoustic time constant and gain.  You can
   modify any parameter via the sliders.  Use the waveform preview at the top to
   see the current light modulation pattern and the resulting audio waveform.
2. **Build a sequence.**  Click the “Add Event” button (if available) to append a
   new segment to the timeline.  Specify its start time, duration and which
   preset to use.  The editor mixes events automatically using the
   `models/sequencer.js` and `models/layering.js` modules.  Overlapping events
   will layer the models together; use this to add a photoacoustic click on top
   of an electrical hum, for example.
3. **Adjust the resonance and time constants.**  The
   **resonance Hz** and **resonance Q** sliders control the band‑pass filter
   frequency and quality factor; increasing \(Q\) narrows the resonance and
   emphasises the hum.  The **thermal τ** slider sets the time constant of the
   photoacoustic low‑pass; lower values produce sharper pulses while higher
   values smooth the heating and emphasise low frequencies.
4. **Introduce whine and noise.**  Use the **whine amplitude** and **whine
   frequency** controls to add a high‑frequency sinusoid representing driver
   switching noise.  Adjust **noise level** to add broadband randomness; this
   helps simulate real electrical noise.
5. **Sonify very slow patterns.**  Enable the **sonification** checkbox when
   working with modulation frequencies below about 10 Hz.  Set the **carrier
   frequency** to your desired note (e.g. 220 Hz = A3).  The envelope will
   modulate this carrier, allowing you to hear the pattern.  Remember that
   sonification is an artistic translation and not part of the physical model.
6. **Export your work.**  Click **Play** to audition your design.  When
   satisfied, press **Download WAV** to export a high‑quality audio file.  Use
   **Record** to capture up to 8 seconds of browser playback as WebM/Opus.  If
   you created a sequence, click **Download MIDI** to generate a Standard MIDI
   file containing note‑on and note‑off events corresponding to your events.
   The MIDI exporter uses a 960 ticks‑per‑quarter‑note resolution and maps
   frequencies to nearest MIDI notes (A4 = 440 Hz).  You can import this file
   into a DAW or hardware sequencer.
7. **Save and share presets.**  Use **Save Preset** to store your current
   parameters in the browser (localStorage).  **Download Preset** writes a
   JSON file which you can email or upload; **Import Preset** loads a JSON
   file.  Saved presets include sequence events.

## Python port and data generation

To facilitate high‑precision simulation, parameter sweeps and comparison to
measurements, the core synthesiser has been ported to Python (`python/models.py`).
The Python module exposes a `Params` dataclass and functions `synthesize`,
`bandpass_filter`, `run_magnetostriction_model` and `run_photoacoustic_fdtd`.
It depends on **NumPy**, **SciPy**, **soundfile** and **matplotlib**.  Example
usage:

```python
from python import models
preset = models.PRESETS[0]      # Use the first built‑in preset
samples = models.synthesize(preset, seconds=1.5)  # Returns a NumPy array
models.export_wav(samples, 'output.wav')  # Write to 16‑bit WAV

# Run the experimental FDTD photoacoustic solver
light = preset.depth * models.wave_sample(preset.waveform,
                                          preset.baseFreq,
                                          48000,
                                          1.5) + 1.0
fdtd_signal = models.run_photoacoustic_fdtd(light, 48000)
```

A helper script `data/generate_examples.py` runs through all built‑in presets
and writes example WAV files and logarithmic FFT plots into `data/examples`.
Invoke it from the repository root via

```sh
PYTHONPATH=python python data/generate_examples.py --seconds 2 --out data/examples
```

This repository includes a Jupyter notebook (`notebooks/validation.ipynb`) that
illustrates an **experimental validation pipeline**:

1. **Record real hardware.**  Use a function generator to drive a cheap LED at
   a known modulation frequency or place a microphone near a transformer or
   ballast.  Record the resulting sound to a WAV file.
2. **Load your recording.**  In the notebook, use `soundfile.read` to load
   the recorded audio.  Trim and normalise as needed.
3. **Simulate the same conditions.**  Set up a corresponding `Params` object in
   `python/models.py` with the same modulation frequency, depth, resonance and
   time constants as the experiment.  Use `models.synthesize` or
   `run_photoacoustic_fdtd` to generate simulated audio.
4. **Compare and analyse.**  Plot the time‑domain signals overlaid; compute
   spectra and spectrograms to visualise differences; compute error metrics such
   as mean squared error.  Adjust parameters to improve the match.  This is the
   only way to actually *support* or *disprove* a particular theory about light
   and sound coupling.

## Publication‑ready figures and citation

The `data/examples` directory contains example WAV files and corresponding FFT
plots for each built‑in preset.  These can be used as publication‑ready
illustrations of the spectral content of different models.  For more
systematic studies, use the Python module to sweep parameters and produce
heatmaps or sensitivity analyses.  When publishing, consider depositing your
final dataset and code on a service like **Zenodo** to obtain a DOI.  A sample
citation for this repository might read:

> *Distant Lights: magnetostriction, photoacoustic and sonification models for
> lighting systems* (2026).  [Dataset and code].  Zenodo.

## References and further reading

The following resources provide background for the models and descriptions
above:

### Human hearing and infrasound

- NCBI Bookshelf, *Neuroscience – The Audible Spectrum*: humans detect sounds
  roughly from 20 Hz to 20 kHz.
  - https://www.ncbi.nlm.nih.gov/books/NBK10924/
- Wikipedia, *Perception of infrasound*: sounds below 20 Hz are infrasound and
  are generally not consciously heard at ordinary levels.
  - https://en.wikipedia.org/wiki/Perception_of_infrasound

### Mains hum, magnetostriction and transformer/coil vibration

- ELSCO Transformers, *Why Do Transformers Hum?*: explains how
  magnetostriction causes core laminations to expand and contract twice per
  magnetisation cycle, producing fundamental noise at twice the line frequency
  and additional harmonics【999855634313556†L107-L116】.
- Würth Elektronik, *ANP118 Acoustic noise & coil whine effect*: describes
  magnetostriction, coil noise, burst‑mode effects and why switching systems
  can become audible.
  - https://www.we-online.com/components/media/o861473v410%20ANP118a_Acoustic%20noise%20and%20coil%20whine%20effect_EN.pdf
- Analog Devices, *Avoid the Audio Band with PWM LED Dimming at Frequencies Above
  20 kHz*: explains why lower PWM frequencies can produce audible vibration
  and hum in components such as ceramic capacitors.
  - https://www.analog.com/en/resources/technical-articles/avoid-the-audio-band-with-pwm-led-dimming.html

### Photoacoustic effect

- Wikipedia, *Photoacoustic effect*: describes how sound waves form following
  light absorption, the need for modulated light and detection by microphones
  or piezoelectric sensors.

### Heat conduction and thermal diffusion

- M. Hancock, *The 1‑D Heat Equation*, MIT OpenCourseWare: derives the heat
  equation from conservation of energy and Fourier’s law and introduces
  thermal diffusivity \(\kappa\).

### Sonification and signal processing

- Gregory Kramer (ed.), *Auditory Display* (1994): foundational text on
  sonification techniques and auditory displays.  See chapters on parameter
  mapping.

### Code reference

- The JavaScript modules in `models/` and `audio-engine/` include extensive
  JSDoc comments explaining every constant (e.g. 2π, resonance **Q**, thermal
  time constant **τ**) and implementation details.  See also the inline
  comments in `python/models.py` for the Python port.

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
