/**
 * Geiger-counter clicks through the Web Audio API. Off by default; the choice is remembered in localStorage under
 * 'particle-physics:sound' (a per-viewer convenience: everything works without it).
 */
export const SOUND_KEY = 'particle-physics:sound';

export function readSoundPreference(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSoundPreference(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  } catch {
    /* storage unavailable: the choice lasts for this visit only */
  }
}

const RATES = [0.92, 1.08, 1.0, 0.96, 1.12, 0.88, 1.04, 0.98];

/** A tiny click generator. Create after a user gesture (the sound toggle) so that browsers allow audio. */
export class Geiger {
  private ctx: AudioContext | null = null;
  private buf: AudioBuffer | null = null;
  private n = 0;

  /** Must be called from a user gesture the first time. Returns false if Web Audio is not available. */
  enable(): boolean {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
      }
      void this.ctx.resume();
      if (!this.buf) {
        // 6 ms of noise with a fast exponential decay and a few ringing samples: the tick of a Geiger–Müller tube.
        const n = Math.floor(this.ctx.sampleRate * 0.006);
        const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
        const d = b.getChannelData(0);
        let s = 12345;
        for (let i = 0; i < n; i++) {
          s = (s * 1664525 + 1013904223) >>> 0;
          const white = s / 2147483648 - 1;
          d[i] = white * Math.exp(-i / (n * 0.18)) * (i % 7 < 3 ? 1 : 0.6);
        }
        this.buf = b;
      }
      return true;
    } catch {
      return false;
    }
  }

  click(volume = 0.25): void {
    if (!this.ctx || !this.buf || this.ctx.state === 'closed') return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buf;
      // a fixed cycle of slightly different pitches, so that the clicks do not sound mechanical
      src.playbackRate.value = RATES[this.n++ % RATES.length]!;
      const g = this.ctx.createGain();
      g.gain.value = volume;
      src.connect(g).connect(this.ctx.destination);
      src.start();
    } catch {
      /* ignore */
    }
  }

  close(): void {
    try {
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.buf = null;
  }
}
