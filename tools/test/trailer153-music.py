# 20 s synthwave score for the 1.5.3 trailer (GTA VI x Granny x DBD), synthesized here (no samples).
#   python3 trailer153-music.py out.wav
# 120 BPM, Am - F - C - G. 0-3.5 pad + soft arp · 3.5 drums + bass in · 7.5 a tape stop, then a lazy groove (she sits
# down to play) · 11.5 sparkles (the can) · 14.5 build · 17 the big chord on the end card, ringing out.
import sys, wave
import numpy as np

SR = 44100
DUR = 20.0
N = int(SR * DUR)
t = np.arange(N) / SR
out = np.zeros((N, 2))
BEAT = 0.5

def note(n):  # MIDI -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)

def env(n, a, d, s, r, length):
    e = np.ones(n)
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    L = int(length * SR)
    e[:A] = np.linspace(0, 1, A) if A else 1
    if D: e[A:A + D] = np.linspace(1, s, min(D, max(0, n - A)))[: len(e[A:A + D])]
    e[A + D:L] = s
    if L < n: e[L:L + R] = np.linspace(s, 0, len(e[L:L + R])); e[L + R:] = 0
    return e

def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); acc = 0.0
    for i in range(len(x)): acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y

def saw(f, n, det=0.0):
    tt = np.arange(n) / SR
    s = 2 * ((tt * f) % 1) - 1
    if det: s = 0.5 * s + 0.5 * (2 * ((tt * f * (1 + det)) % 1) - 1)
    return s

def add(start, sig, pan=0.0, gain=1.0):
    i = int(start * SR)
    if i >= N: return
    sig = sig[: N - i] * gain
    out[i:i + len(sig), 0] += sig * (1 - max(0, pan))
    out[i:i + len(sig), 1] += sig * (1 + min(0, pan))

CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
ROOT = [45, 41, 36, 43]

# pads (whole piece, chord every 2 beats... every bar = 4 beats = 2 s)
for bar in range(10):
    st = bar * 2.0
    ch = CH[bar % 4]
    if 7.5 <= st < 11.5: ch = [c - 12 for c in ch]
    n = int(2.2 * SR)
    sig = sum(saw(note(c), n, 0.004) for c in ch) / 3
    sig = lowpass(sig, 900 if st < 17 else 1800) * env(n, 0.3, 0.2, 0.8, 0.3, 1.9)
    add(st, sig, 0, 0.16)
# the end chord: big, long tail
n = int(3.2 * SR)
big = sum(saw(note(c), n, 0.006) for c in [57, 60, 64, 69, 45]) / 5
add(17.0, lowpass(big, 2400) * env(n, 0.01, 0.4, 0.55, 1.6, 1.4), 0, 0.35)

# arpeggio (16ths), soft first, brighter later; off during the desk shot
for k in range(int(17.0 / 0.125)):
    st = k * 0.125
    if 7.5 <= st < 11.5: continue
    ch = CH[int(st // 2) % 4]
    pat = [0, 1, 2, 1, 0, 2, 1, 2]
    m = ch[pat[k % 8]] + 12
    n = int(0.12 * SR)
    sig = saw(note(m), n) * np.exp(-np.arange(n) / SR * 22)
    add(st, lowpass(sig, 2200 if st > 3.5 else 1200), 0.35 if k % 2 else -0.35, 0.07 if st < 3.5 else 0.09)

# bass (8ths) from 3.5
for k in range(int(3.5 / 0.25), int(17.0 / 0.25)):
    st = k * 0.25
    r = ROOT[int(st // 2) % 4]
    if 7.5 <= st < 11.5:  # lazy groove: quarter notes, an octave lower
        if k % 2: continue
        r -= 12
    n = int(0.24 * SR)
    sig = lowpass(saw(note(r), n, 0.01), 420) * env(n, 0.005, 0.08, 0.6, 0.05, 0.2)
    add(st, sig, 0, 0.42)

def kick(st, g=1.0):
    n = int(0.35 * SR); tt = np.arange(n) / SR
    f = 50 + 110 * np.exp(-tt * 30)
    add(st, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9), 0, 0.8 * g)
def snare(st, g=1.0):
    n = int(0.25 * SR); tt = np.arange(n) / SR
    s = np.random.uniform(-1, 1, n) * np.exp(-tt * 14) + 0.4 * np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 20)
    add(st, s, 0, 0.32 * g)
def hat(st, g=1.0):
    n = int(0.05 * SR); s = np.random.uniform(-1, 1, n); s = s - lowpass(s, 6000)
    add(st, s * np.exp(-np.arange(n) / SR * 80), 0.3, 0.16 * g)

for b in range(int(3.5 / BEAT), int(17.0 / BEAT)):
    st = b * BEAT
    lazy = 7.5 <= st < 11.5
    if lazy:
        if b % 2 == 0: kick(st, 0.8)
        if b % 4 == 3: snare(st, 0.7)
        continue
    kick(st)
    if b % 2 == 1: snare(st)
    hat(st + 0.25)
    if st >= 14.5: hat(st, 0.8); hat(st + 0.125, 0.5); hat(st + 0.375, 0.5)
# build: snare roll into the end card
for k in range(16):
    snare(16.0 + k * 0.0625, 0.4 + k / 20)
kick(17.0, 1.3)

# tape stop at 7.5 (the arp pitch-dives) and sparkles 11.5-14.5
n = int(0.6 * SR); tt = np.arange(n) / SR
f = note(81) * (1 - tt / 0.65)
add(7.0, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 3) * 0.6, 0, 0.12)
rng = np.random.default_rng(4)
for k in range(30):
    st = 11.5 + k * 0.1
    m = [88, 91, 93, 96, 100][rng.integers(0, 5)]
    n = int(0.3 * SR); tt = np.arange(n) / SR
    add(st, np.sin(2 * np.pi * note(m) * tt) * np.exp(-tt * 10), float(rng.uniform(-0.7, 0.7)), 0.05)

# a simple stereo echo for space, fade in/out, normalize
d = int(0.375 * SR)
echo = np.zeros_like(out); echo[d:, 0] = out[:-d, 1] * 0.25; echo[d:, 1] = out[:-d, 0] * 0.25
out += echo
out[: int(0.6 * SR)] *= np.linspace(0, 1, int(0.6 * SR))[:, None]
out[-int(0.8 * SR):] *= np.linspace(1, 0, int(0.8 * SR))[:, None]
out /= np.max(np.abs(out)) * 1.12
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'trailer153.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype(np.int16).tobytes())
print('ok')
