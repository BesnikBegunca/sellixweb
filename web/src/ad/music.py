"""Synthesises the 30 s soundtrack for the SelliX ad (no samples, no licences).

Timing matches src/ad/Ad.jsx: scene cuts, product taps, the payment and the
phone notification all land on their own sound.

    python music.py out.wav
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 30.0
N = int(SR * DUR)
BPM = 120
BEAT = 60 / BPM

# Keep in sync with Ad.jsx
SCENES = [3.1, 6.3, 13.4, 19.0, 24.0, 27.2]
TAPS = [7.5, 8.15, 8.7, 9.3, 9.95]
PRINT_T, PAY_T, BANNER_T = 10.9, 12.3, 14.7

t_all = np.arange(N) / SR
L = np.zeros(N)
R = np.zeros(N)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def place(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    L[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 - pan))
    R[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))


def env(n, a, d, s=0.0, r=0.0, hold=0.0):
    """Linear ADSR over n samples (times in seconds)."""
    e = np.zeros(n)
    ai, di, hi, ri = (int(x * SR) for x in (a, d, hold, r))
    k = 0
    seg = min(ai, n - k); e[k:k + seg] = np.linspace(0, 1, ai)[:seg]; k += seg
    seg = min(di, n - k); e[k:k + seg] = np.linspace(1, s, di)[:seg]; k += seg
    seg = min(hi, n - k); e[k:k + seg] = s; k += seg
    seg = min(ri, n - k); e[k:k + seg] = np.linspace(s, 0, ri)[:seg]; k += seg
    return e


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)


def saw(freq, dur, harmonics=10, detune=(0.0,)):
    tt = np.arange(int(dur * SR)) / SR
    out = np.zeros_like(tt)
    for dt in detune:
        f = freq * (1 + dt)
        for h in range(1, harmonics + 1):
            if f * h > SR / 2.2:
                break
            out += np.sin(2 * np.pi * f * h * tt + h) / h
    return out / len(detune)


rng = np.random.default_rng(7)

# ── Chords: C – G – Am – F, one bar (2 s) each ─────────────────────────────
PROG = [(48, [60, 64, 67, 72]), (43, [59, 62, 67, 71]), (45, [57, 60, 64, 69]), (41, [57, 60, 65, 69])]
BAR = 4 * BEAT
bars = int(np.ceil(DUR / BAR))

for b in range(bars):
    start = b * BAR
    root, notes = PROG[b % 4]
    # Warm pad
    pad = sum(saw(midi(n), BAR + 0.6, 8, (-0.004, 0.0, 0.005)) for n in notes) / len(notes)
    pad = lp(pad, 1400 if start < 6.3 else 2200) * env(len(pad), 0.35, 0.2, 0.85, 0.6, BAR - 0.55)
    place(pad, start, 0.20, -0.2)
    place(np.roll(pad, 220), start, 0.20, 0.2)

    # Bass from the hook onwards: eighth-note pulse on the root
    if start >= 3.0:
        for k in range(8):
            ts = start + k * BEAT / 2
            if ts < 3.1 or ts > 28.9:
                continue
            n = int(0.24 * SR)
            tt = np.arange(n) / SR
            f = midi(root)
            note = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * tt)) * env(n, 0.004, 0.22, 0.0)
            place(lp(note, 900), ts, 0.30 if ts >= 6.3 else 0.18)

    # Pluck arpeggio over the phone / dashboard scenes
    if 13.4 <= start + BAR and start < 24.0:
        seq = [notes[0], notes[1], notes[2], notes[3], notes[2], notes[1], notes[2], notes[3]] * 2
        for k, nn in enumerate(seq):
            ts = start + k * BEAT / 4
            if ts < 13.4 or ts >= 24.0:
                continue
            n = int(0.3 * SR)
            tt = np.arange(n) / SR
            f = midi(nn + 12)
            pl = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 3 * f * tt)) * np.exp(-tt * 14)
            place(pl, ts, 0.07, 0.35 if k % 2 else -0.35)

# ── Drums ────────────────────────────────────────────────────────────────
def kick():
    n = int(0.32 * SR)
    tt = np.arange(n) / SR
    f = 45 + 95 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 9) + 0.15 * np.exp(-tt * 200) * rng.standard_normal(n)


def hat():
    n = int(0.05 * SR)
    return hp(rng.standard_normal(n), 7000) * np.exp(-np.arange(n) / SR * 90)


def clap():
    n = int(0.18 * SR)
    tt = np.arange(n) / SR
    return bp(rng.standard_normal(n), 900, 3500) * (np.exp(-tt * 22) + 0.4 * np.exp(-np.maximum(tt - 0.012, 0) * 30) * (tt > 0.012))


beats = np.arange(0, DUR, BEAT)
for i, bt in enumerate(beats):
    if 3.1 <= bt < 6.3:  # soft heartbeat under the hook
        if i % 2 == 0:
            place(kick(), bt, 0.35)
    elif 6.3 <= bt < 28.9:
        place(kick(), bt, 0.7)
        place(hat(), bt + BEAT / 2, 0.12, 0.3)
        if i % 2 == 1:
            place(clap(), bt, 0.22, -0.1)
        if bt >= 13.4:
            place(hat(), bt + BEAT / 4, 0.05, -0.3)
            place(hat(), bt + 3 * BEAT / 4, 0.05, -0.3)

# ── FX ───────────────────────────────────────────────────────────────────
def whoosh(dur=0.7):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    chunks = 24
    for c in range(chunks):
        a, b = c * n // chunks, (c + 1) * n // chunks
        f = 400 + 6000 * (c / chunks) ** 2
        out[a:b] = bp(noise, f * 0.6, min(f * 1.4, SR / 2.2))[a:b]
    return out * np.sin(np.linspace(0, np.pi, n)) ** 2


for s in SCENES:
    place(whoosh(), s - 0.45, 0.16)


def blip(f=1900, dur=0.035):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * tt) * np.exp(-tt * 120)


for tp in TAPS + [PRINT_T]:
    place(blip(), tp, 0.35)


def bell(freqs, dur=1.0, decay=5):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt * decay * (1 + i * 0.4)) for i, f in enumerate(freqs))


place(bell([1318.5, 2637], 0.9, 6), PAY_T, 0.20)             # till "ding"
place(bell([1661.2, 3322], 0.8, 6), PAY_T + 0.12, 0.16)
for k, f in enumerate([1175, 1480, 1760]):                     # phone alert
    place(bell([f, f * 2], 0.5, 9), BANNER_T + k * 0.11, 0.17)

# Intro swell and final hit
riser = lp(rng.standard_normal(int(1.6 * SR)), 3000) * np.linspace(0, 1, int(1.6 * SR)) ** 2
place(riser, 4.75, 0.10)
place(kick(), 27.2, 0.8)
final = sum(saw(midi(n), 3.0, 8, (-0.004, 0.005)) for n in [48, 60, 64, 67, 72]) / 5
place(lp(final, 2400) * env(len(final), 0.01, 0.3, 0.6, 2.2, 0.5), 27.2, 0.32)

# ── Master ───────────────────────────────────────────────────────────────
mix = np.stack([L, R], axis=1)
mix *= np.minimum(1, t_all / 0.3)[:, None]
mix *= np.clip((DUR - t_all) / 1.4, 0, 1)[:, None]
mix = np.tanh(mix * 1.4)
mix /= np.max(np.abs(mix)) / 0.89
wavfile.write(sys.argv[1] if len(sys.argv) > 1 else 'ad-music.wav', SR, (mix * 32767).astype(np.int16))
print('ok')
