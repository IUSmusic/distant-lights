"""Generate publication-style figures for the Distant Lights repository."""

from pathlib import Path
import sys
import numpy as np
import matplotlib.pyplot as plt
from scipy.fft import rfft, rfftfreq

ROOT = Path(__file__).resolve().parents[1]
PY_DIR = ROOT / 'python'
if str(PY_DIR) not in sys.path:
    sys.path.insert(0, str(PY_DIR))
import models  # type: ignore

OUT = ROOT / 'data' / 'figures'
OUT.mkdir(parents=True, exist_ok=True)
FS = 48_000

# Spectral overlay figure ----------------------------------------------------
preset_a = models.PRESETS[0].clone()
preset_b = models.PRESETS[1].clone()
a = models.synthesize(preset_a, 1.0, FS)
b = models.synthesize(preset_b, 1.0, FS)
fa = rfftfreq(len(a), 1 / FS)
Aa = np.abs(rfft(a))
Ab = np.abs(rfft(b))
plt.figure(figsize=(7, 4))
plt.semilogx(fa[1:], 20 * np.log10(Aa[1:] + 1e-12), label=preset_a.label)
plt.semilogx(fa[1:], 20 * np.log10(Ab[1:] + 1e-12), label=preset_b.label)
plt.xlabel('Frequency (Hz)')
plt.ylabel('Magnitude (dB)')
plt.title('Spectral overlay')
plt.grid(True, which='both', alpha=0.25)
plt.legend()
plt.tight_layout()
plt.savefig(OUT / 'spectral_overlay.png', dpi=180)
plt.close()

# Time-domain overlay --------------------------------------------------------
plt.figure(figsize=(7, 3.5))
window = 2500
plt.plot(a[:window], label=preset_a.label, linewidth=1.2)
plt.plot(b[:window], label=preset_b.label, linewidth=1.2)
plt.xlabel('Sample index')
plt.ylabel('Amplitude')
plt.title('Time-domain overlay')
plt.grid(True, alpha=0.25)
plt.legend()
plt.tight_layout()
plt.savefig(OUT / 'time_overlay.png', dpi=180)
plt.close()

# Parameter sensitivity heatmap ---------------------------------------------
base_freqs = np.linspace(60, 260, 24)
qs = np.linspace(0.5, 8.0, 24)
heat = np.zeros((len(qs), len(base_freqs)))
for i, q in enumerate(qs):
    for j, f0 in enumerate(base_freqs):
        p = models.PRESETS[0].clone()
        p.baseFreq = float(f0)
        p.resonanceQ = float(q)
        signal = models.synthesize(p, 0.5, FS)
        spectrum = np.abs(rfft(signal))
        freqs = rfftfreq(len(signal), 1 / FS)
        band = (freqs >= 80) & (freqs <= 1500)
        heat[i, j] = float(np.max(spectrum[band]))
plt.figure(figsize=(7, 4.5))
plt.imshow(heat, aspect='auto', origin='lower', extent=[base_freqs.min(), base_freqs.max(), qs.min(), qs.max()])
plt.colorbar(label='Peak spectral magnitude')
plt.xlabel('Base frequency (Hz)')
plt.ylabel('Resonance Q')
plt.title('Parameter sensitivity heatmap')
plt.tight_layout()
plt.savefig(OUT / 'parameter_sensitivity_heatmap.png', dpi=180)
plt.close()

print(f'Wrote figures to {OUT}')
