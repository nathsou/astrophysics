/**
 * What a scanner can work out about one track: its length, how heavily it ionises, the radius of curvature and the
 * momentum on each side of a plate, and the sense of the curve. Measured on the track's points with a little noise
 * (the droplets are scattered about the true path), not read off the truth.
 *
 * The sense of the curve depends on which way the particle moved, which a photograph does not say. So the sense is
 * given for travel from end ① to end ②, where ① is the end with the smaller x (or, for a vertical track, the higher y);
 * the reader chooses the direction of travel and the charge sign follows.
 */
import { rng as makeRng, normal } from '$lib/hep/random';
import { measureTrack, chargeSign, type Material, type MediumName, type Track } from '$lib/hep/chamber';

export interface SegmentInfo {
  /** Mean y of the segment (mm), to tell "below the plate" from "above". */
  yMid: number;
  layer: number;
  length: number;
  /** Radius of curvature (mm); null if the segment is too straight to tell. */
  R: number | null;
  /** Transverse momentum (GeV/c) for |q| = 1, from the radius; null if straight or no field. */
  pT: number | null;
  /** Sense of rotation when travelling ① → ②: +1 anticlockwise, −1 clockwise, 0 straight. */
  sense: 1 | -1 | 0;
  /** Centre of the fitted circle (mm), if curved. */
  centre: { x: number; y: number } | null;
  /** Sagitta (mm) and chord (mm) of the segment. */
  sagitta: number;
  chord: number;
  points: number;
}

export interface SelectionInfo {
  id: number;
  length: number;
  ionisation: number;
  segments: SegmentInfo[];
  /** Ends inside the picture (a finite range), or leaves it. */
  stops: boolean;
  kinks: { angleDeg: number; kind: string }[];
  /** End ① and ② in world coordinates. */
  end1: { x: number; y: number };
  end2: { x: number; y: number };
  /** Was the canonical order the reverse of the simulation's (for code that needs the truth)? */
  reversed: boolean;
}

/** Positional scatter of the droplets about the path (mm), 1σ. */
export const MEASUREMENT_NOISE_MM = { cloud: 0.18, bubble: 0.25 } as const;

export function selectionInfo(track: Track, B: number, medium: MediumName | Material, kind: 'cloud' | 'bubble' = 'cloud'): SelectionInfo {
  const pts = track.points;
  const vis = pts.filter((p) => p.visible);
  const first = vis[0] ?? pts[0]!;
  const last = vis[vis.length - 1] ?? pts[pts.length - 1]!;
  // End ① is the one with the smaller x; for a (nearly) vertical track the higher y.
  const vertical = Math.abs(last.x - first.x) < 0.15 * Math.hypot(last.x - first.x, last.y - first.y);
  const reversed = vertical ? last.y > first.y : last.x < first.x;
  const r = makeRng(1000 + track.id);
  const sigma = MEASUREMENT_NOISE_MM[kind];
  const noise: [number, number][] = pts.map(() => [normal(r, 0, sigma), normal(r, 0, sigma)]);
  const m = measureTrack(track, B, medium, (i) => noise[i]!);
  const segs: SegmentInfo[] = m.segments.map((s) => {
    const fit = s.fit;
    const straight = !fit || fit.straight || !Number.isFinite(fit.R);
    // The fit orientation is along the simulated direction of travel; convert to ① → ②.
    const sense = straight ? 0 : ((reversed ? -fit!.orientation : fit!.orientation) as 1 | -1);
    const slice = pts.slice(s.from, s.to + 1);
    return {
      yMid: slice.reduce((a, p) => a + p.y, 0) / Math.max(1, slice.length),
      layer: s.layer,
      length: s.length,
      R: straight ? null : fit!.R,
      pT: straight || !Number.isFinite(s.pT) ? null : s.pT,
      sense,
      centre: straight ? null : { x: fit!.cx, y: fit!.cy },
      sagitta: fit?.sagitta ?? 0,
      chord: fit?.chord ?? 0,
      points: fit?.n ?? 0,
    };
  });
  if (reversed) segs.reverse();
  return {
    id: track.id,
    length: m.length,
    ionisation: m.ionisation,
    segments: segs,
    stops: track.end === 'range',
    kinks: track.kinks.filter((k) => k.angle > 0.08).slice(0, 4).map((k) => ({ angleDeg: (k.angle * 180) / Math.PI, kind: k.kind })),
    end1: reversed ? { x: last.x, y: last.y } : { x: first.x, y: first.y },
    end2: reversed ? { x: first.x, y: first.y } : { x: last.x, y: last.y },
    reversed,
  };
}

/** The sign of the charge implied by a sense of rotation, for travel ① → ② (`forward`) or ② → ①. */
export function inferredCharge(sense: 1 | -1 | 0, B: number, forward: boolean): 1 | -1 | null {
  if (sense === 0 || B === 0) return null;
  const along = (forward ? sense : -sense) as 1 | -1;
  return chargeSign(along, B);
}

/** Format a momentum in GeV/c as "63 MeV/c" or "1.4 GeV/c". */
export function fmtMomentum(p: number): string {
  if (!Number.isFinite(p)) return '—';
  return p >= 1 ? `${p.toFixed(2)} GeV/c` : `${(p * 1000).toFixed(p < 0.1 ? 1 : 0)} MeV/c`;
}

/** "×4.3" style ionisation text. */
export function fmtIonisation(x: number): string {
  return x >= 10 ? `${Math.round(x)}×` : `${x.toFixed(1)}×`;
}
