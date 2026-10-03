/**
 * Pitch tracking with the YIN algorithm (de Cheveigné & Kawahara, 2002), tuned for speech:
 * fundamental frequencies between 60 and 500 Hz, one estimate every `hop` samples.
 */

export interface PitchOptions {
  sampleRate: number;
  minHz?: number;
  maxHz?: number;
  /** Cumulative-mean-normalised-difference threshold; lower = stricter about voicing. */
  threshold?: number;
  /** Frames quieter than this RMS are treated as silence. */
  minRms?: number;
}

/** The fundamental frequency of one frame in Hz, or null if the frame is unvoiced. */
export function yin(frame: Float32Array, opts: PitchOptions): number | null {
  const { sampleRate, minHz = 60, maxHz = 500, threshold = 0.15, minRms = 0.01 } = opts;
  let energy = 0;
  for (const x of frame) energy += x * x;
  if (Math.sqrt(energy / frame.length) < minRms) return null;

  const maxLag = Math.min(Math.floor(sampleRate / minHz), Math.floor(frame.length / 2));
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const W = frame.length - maxLag;
  const d = new Float32Array(maxLag + 1);
  for (let tau = 1; tau <= maxLag; tau++) {
    let sum = 0;
    for (let i = 0; i < W; i++) {
      const diff = frame[i]! - frame[i + tau]!;
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  // Cumulative mean normalised difference.
  const cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxLag; tau++) {
    running += d[tau]!;
    cmnd[tau] = running ? (d[tau]! * tau) / running : 1;
  }
  let tau = -1;
  for (let t = minLag; t <= maxLag; t++) {
    if (cmnd[t]! < threshold) {
      while (t + 1 <= maxLag && cmnd[t + 1]! < cmnd[t]!) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // Parabolic interpolation around the minimum for sub-sample precision.
  const a = cmnd[tau - 1] ?? cmnd[tau]!;
  const b = cmnd[tau]!;
  const c = cmnd[tau + 1] ?? cmnd[tau]!;
  const denom = a - 2 * b + c;
  const shift = denom ? (a - c) / (2 * denom) : 0;
  return sampleRate / (tau + shift);
}

/** Track pitch through a whole recording: one value (Hz or null) per hop. */
export function track(samples: Float32Array, opts: PitchOptions & { frame?: number; hop?: number }): (number | null)[] {
  const frame = opts.frame ?? Math.round(opts.sampleRate * 0.04);
  const hop = opts.hop ?? Math.round(opts.sampleRate * 0.01);
  const out: (number | null)[] = [];
  for (let start = 0; start + frame <= samples.length; start += hop) {
    out.push(yin(samples.subarray(start, start + frame), opts));
  }
  return out;
}
