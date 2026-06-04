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

// Ascending 4-tone arpeggio — level-up feel
export function playNewMarket(delayS = 0): void {
  const c = ctx();
  if (c.state !== "running") return;
  const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  freqs.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = "triangle";
    osc.frequency.value = freq;
    const t = c.currentTime + delayS + i * 0.10;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.start(t);
    osc.stop(t + 0.20);
  });
}

// Short two-tone coin
export function playStarted(delayS = 0): void {
  const c = ctx();
  if (c.state !== "running") return;
  [660, 880].forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = c.currentTime + delayS + i * 0.08;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.010);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.start(t);
    osc.stop(t + 0.16);
  });
}

// Single clean ding with slow decay
export function playDone(delayS = 0): void {
  const c = ctx();
  if (c.state !== "running") return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = "sine";
  osc.frequency.value = 880; // A5
  const t = c.currentTime + delayS;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.12, t + 0.010);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
  osc.start(t);
  osc.stop(t + 0.70);
}
