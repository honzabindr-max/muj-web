"use client";

let _ctx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  return _ctx;
}

export function resumeAudio(): void {
  const c = ctx();
  if (c.state === "suspended") c.resume();
}

// ── Level-up arpeggio — E major, triangle+sine layered, chord punch at end ──
export function playNewMarket(delayS = 0): void {
  const c = ctx();
  if (c.state !== "running") return;

  const freqs = [659, 830, 988, 1319]; // E5 G#5 B5 E6

  freqs.forEach((freq, i) => {
    const t = c.currentTime + delayS + i * 0.085;

    // Triangle — retro character
    const o1 = c.createOscillator();
    const g1 = c.createGain();
    o1.connect(g1); g1.connect(c.destination);
    o1.type = "triangle";
    o1.frequency.value = freq;
    g1.gain.setValueAtTime(0, t);
    g1.gain.linearRampToValueAtTime(0.15, t + 0.010);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o1.start(t); o1.stop(t + 0.18);

    // Sine layer — warmth
    const o2 = c.createOscillator();
    const g2 = c.createGain();
    o2.connect(g2); g2.connect(c.destination);
    o2.type = "sine";
    o2.frequency.value = freq;
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(0.07, t + 0.010);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o2.start(t); o2.stop(t + 0.28);
  });

  // Final chord punch — E5 + B5 together
  const tEnd = c.currentTime + delayS + 4 * 0.085;
  [659, 988].forEach((freq) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, tEnd);
    g.gain.linearRampToValueAtTime(0.11, tEnd + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, tEnd + 0.40);
    o.start(tEnd); o.stop(tEnd + 0.45);
  });
}

// ── Coin collect — square wave glide 440→1100 Hz + sparkle ping ──
export function playStarted(delayS = 0): void {
  const c = ctx();
  if (c.state !== "running") return;
  const t = c.currentTime + delayS;

  // Square sweep (classic 8-bit coin)
  const o = c.createOscillator();
  const g = c.createGain();
  o.connect(g); g.connect(c.destination);
  o.type = "square";
  o.frequency.setValueAtTime(440, t);
  o.frequency.exponentialRampToValueAtTime(1100, t + 0.07);
  g.gain.setValueAtTime(0.10, t);
  g.gain.setValueAtTime(0.10, t + 0.07);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  o.start(t); o.stop(t + 0.17);

  // Sparkle ping — A6
  const t2 = t + 0.09;
  const o2 = c.createOscillator();
  const g2 = c.createGain();
  o2.connect(g2); g2.connect(c.destination);
  o2.type = "sine";
  o2.frequency.value = 1760;
  g2.gain.setValueAtTime(0, t2);
  g2.gain.linearRampToValueAtTime(0.08, t2 + 0.006);
  g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.14);
  o2.start(t2); o2.stop(t2 + 0.16);
}

// ── Achievement bell — two chime hits with harmonics ──
export function playDone(delayS = 0): void {
  const c = ctx();
  if (c.state !== "running") return;

  function bell(t: number, fund: number, vol: number, decay: number) {
    // Fundamental + octave + fifth above octave (natural bell partials)
    [
      [fund,       vol,        decay],
      [fund * 2,   vol * 0.45, decay * 0.75],
      [fund * 3,   vol * 0.20, decay * 0.55],
    ].forEach(([freq, v, d]) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.start(t); o.stop(t + d + 0.05);
    });
  }

  const now = c.currentTime + delayS;
  bell(now,        740, 0.13, 0.85); // F#5 — první úder
  bell(now + 0.18, 988, 0.13, 0.75); // B5  — druhý úder (kvinta výš)
}
