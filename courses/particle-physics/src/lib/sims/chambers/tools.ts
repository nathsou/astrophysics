/**
 * The scanning-table tools: a ruler (length), a three-point circle (curvature → radius → momentum) and an angle
 * tool. Pure geometry on points in millimetres; the drawing and the pointer handling are in ChamberView.svelte.
 */
import { angleAt, circleThrough, distance, momentumFromRadiusMm, chargeSign, type Pt } from '$lib/hep/chamber';

export type ToolName = 'none' | 'ruler' | 'circle' | 'angle';
export type MeasureTool = Exclude<ToolName, 'none'>;

export const POINTS_NEEDED: Record<MeasureTool, number> = { ruler: 2, circle: 3, angle: 3 };

export const TOOL_HELP: Record<MeasureTool, string> = {
  ruler: 'Click the two ends of the stretch you want to measure.',
  circle: 'Click three points along one track, well spaced: the circle through them gives the radius of curvature.',
  angle: 'Click the vertex first, then a point on each of the two tracks.',
};

export interface Measurement {
  id: number;
  tool: MeasureTool;
  points: Pt[];
  /** mm for ruler and circle (the radius), degrees for angle. */
  value: number;
  unit: 'mm' | '°';
  /** Human label, e.g. "length 84.2 mm". */
  text: string;
  /** Circle tool: centre, transverse momentum for |q| = 1 (GeV/c) and sense of rotation along the clicked order. */
  centre?: Pt;
  pT?: number;
  orientation?: 1 | -1;
  /** Sagitta of the arc through the first and last point (mm). */
  sagitta?: number;
  /** The track id the clicked points lie on, if any. */
  track?: number | null;
}

const f = (x: number, d = 1) => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(d));

/** Turn the clicked points into a measurement. `B` is the field in tesla (for the momentum). */
export function makeMeasurement(tool: MeasureTool, points: Pt[], B: number, id: number): Measurement | null {
  if (points.length < POINTS_NEEDED[tool]) return null;
  if (tool === 'ruler') {
    const L = distance(points[0]!, points[1]!);
    return { id, tool, points: points.slice(0, 2), value: L, unit: 'mm', text: `length ${f(L)} mm` };
  }
  if (tool === 'angle') {
    const a = angleAt(points[0]!, points[1]!, points[2]!);
    return { id, tool, points: points.slice(0, 3), value: a, unit: '°', text: `angle ${a.toFixed(1)}°` };
  }
  const c = circleThrough(points[0]!, points[1]!, points[2]!);
  if (!c) return { id, tool, points: points.slice(0, 3), value: Infinity, unit: 'mm', text: 'the three points are in a straight line: no curvature you can measure' };
  const pT = B !== 0 ? momentumFromRadiusMm(c.R, B) : undefined;
  const chord = distance(points[0]!, points[2]!);
  const sag = c.R - Math.sqrt(Math.max(0, c.R * c.R - (chord * chord) / 4));
  return {
    id,
    tool,
    points: points.slice(0, 3),
    value: c.R,
    unit: 'mm',
    centre: { x: c.cx, y: c.cy },
    pT,
    orientation: c.orientation,
    sagitta: sag,
    text: `radius ${f(c.R)} mm` + (pT !== undefined ? `, p⊥ = 0.29979·B·R = ${pT >= 1 ? pT.toFixed(2) + ' GeV/c' : (pT * 1000).toFixed(0) + ' MeV/c'}` : ''),
  };
}

/** The charge sign that follows from a measured sense of rotation, given the direction of travel chosen by the reader. */
export function chargeFromSense(orientationAlongTravel: 1 | -1, B: number): string {
  if (B === 0) return 'no field: no curvature to read';
  return chargeSign(orientationAlongTravel, B) > 0 ? 'positive' : 'negative';
}

/** A "nice" length for a scale bar (1, 2, 5 × 10ⁿ mm) near `target` mm. */
export function niceLength(target: number): number {
  const e = Math.pow(10, Math.floor(Math.log10(target)));
  const m = target / e;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * e;
}
