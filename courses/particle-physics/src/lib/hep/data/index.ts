/**
 * Loaders for the datasets shipped with the course (static/data, prepared by scripts/data/).
 * Every dataset has a manifest with its source, licence and checksum.
 */
import type { P4 } from '../kinematics/index.ts';

export interface DimuonEvents {
  n: number;
  /** Muon four-vectors, as flat arrays: muon 1 and muon 2 of event i. */
  mu1: (i: number) => P4;
  mu2: (i: number) => P4;
  /** Charges (±1). */
  q1: (i: number) => number;
  q2: (i: number) => number;
  /** The raw Float32 array, 10 values per event. */
  raw: Float32Array;
}

const STRIDE = 10;

/** Decode the bytes of static/data/dimuon.f32. */
export function parseDimuon(buffer: ArrayBuffer): DimuonEvents {
  const raw = new Float32Array(buffer);
  const n = raw.length / STRIDE;
  const get = (i: number, o: number): P4 => ({ E: raw[i * STRIDE + o]!, px: raw[i * STRIDE + o + 1]!, py: raw[i * STRIDE + o + 2]!, pz: raw[i * STRIDE + o + 3]! });
  return { n, raw, mu1: (i) => get(i, 0), mu2: (i) => get(i, 5), q1: (i) => raw[i * STRIDE + 4]!, q2: (i) => raw[i * STRIDE + 9]! };
}

/** Fetch and decode the dimuon sample. `base` is the site's base path (SvelteKit's `base`). */
export async function loadDimuon(base = ''): Promise<DimuonEvents> {
  const res = await fetch(`${base}/data/dimuon.f32`);
  if (!res.ok) throw new Error(`could not load the dimuon sample (${res.status})`);
  return parseDimuon(await res.arrayBuffer());
}

/** The masses the reader's code should reproduce, computed from the four-vectors with the library (muon mass re-imposed). */
export function dimuonMasses(d: DimuonEvents): Float64Array {
  const m = new Float64Array(d.n);
  for (let i = 0; i < d.n; i++) {
    const a = d.mu1(i), b = d.mu2(i);
    const E = a.E + b.E, px = a.px + b.px, py = a.py + b.py, pz = a.pz + b.pz;
    const p = Math.hypot(px, py, pz);
    m[i] = Math.sqrt(Math.max(0, (E - p) * (E + p)));
  }
  return m;
}
