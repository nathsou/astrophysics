/** Tiny synthesised feedback sounds (no files): a two-note chime and a soft low bump. */
let ctx: AudioContext | null = null;

function note(freq: number, start: number, dur: number, type: OscillatorType, gain: number): void {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function sfx(kind: 'right' | 'wrong' | 'done', enabled = true): void {
  if (!enabled || typeof window === 'undefined') return;
  try {
    ctx ??= new AudioContext();
    if (kind === 'right') {
      note(880, 0, 0.18, 'sine', 0.12);
      note(1318.5, 0.08, 0.3, 'sine', 0.1);
    } else if (kind === 'wrong') {
      note(196, 0, 0.22, 'triangle', 0.12);
    } else {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.09, 0.35, 'sine', 0.09));
    }
  } catch {
    /* audio unavailable */
  }
}
