// Schematic (labelled-approximate) post-main-sequence evolutionary tracks for Chapter 15.
//
// We tabulate seven phases at five "anchor" masses (0.8 alone is not tabulated; we use
// 1, 2, 5, 15, 25 M☉) and interpolate log-linearly in mass between anchors, and
// log-linearly in duration within a phase. The numbers reproduce the qualitative and
// rough quantitative shape of real stellar-evolution tracks (Sun ~10 Gyr on the main
// sequence, RGB tip ~170 R☉ / logT~3.60, red clump, AGB tip ~a few 100 R☉, PN ~1e4 yr,
// massive stars supergiant radii ~500-1000 R☉, core-collapse in ~1 day) but are NOT the
// output of a stellar-evolution code — see the chapter text and the <Hood> for how a
// real code (MESA) differs.

export type PhaseId = 'ms' | 'subgiant' | 'rgb' | 'flash' | 'hb' | 'agb' | 'final';

export interface PhasePoint {
  logL: number; // log10 (L / Lsun)
  logT: number; // log10 (Teff / K)
  R: number; // R / Rsun
  Mcore: number; // Msun, "central processed core" (He core, then CO core, then Fe core / remnant)
}

export interface PhaseSpec {
  id: PhaseId;
  /** Duration in years, at this mass anchor. */
  duration: number;
  start: PhasePoint;
  end: PhasePoint;
}

export interface MassTrack {
  mass: number; // Msun
  phases: PhaseSpec[];
}

export const PHASE_LABELS: Record<PhaseId, { lowMass: string; highMass: string }> = {
  ms: { lowMass: 'Main sequence (core H burning)', highMass: 'Main sequence (core H burning)' },
  subgiant: { lowMass: 'Subgiant branch (shell H ignites)', highMass: 'Subgiant branch (shell H ignites)' },
  rgb: { lowMass: 'Red giant branch (mirror expansion)', highMass: 'Red supergiant ascent' },
  flash: { lowMass: 'Helium flash (degenerate ignition)', highMass: 'He ignition (non-degenerate)' },
  hb: { lowMass: 'Horizontal branch / red clump (core He burning)', highMass: 'Blue loops, Wolf–Rayet, LBV' },
  agb: { lowMass: 'AGB: double-shell burning, thermal pulses', highMass: 'Onion-shell advanced burning (C→Ne→O→Si)' },
  final: { lowMass: 'Planetary nebula → white dwarf', highMass: 'Core-collapse supernova → remnant' },
};

// He-flash boundary: below ~2.2-2.3 M☉ the He core is degenerate at ignition.
export const FLASH_THRESHOLD_MSUN = 2.3;

const T: MassTrack[] = [
  {
    mass: 1,
    phases: [
      { id: 'ms', duration: 1.0e10, start: { logL: -0.1, logT: 3.762, R: 1.0, Mcore: 0.0 }, end: { logL: 0.3, logT: 3.712, R: 1.6, Mcore: 0.05 } },
      { id: 'subgiant', duration: 1.5e9, start: { logL: 0.3, logT: 3.712, R: 1.6, Mcore: 0.05 }, end: { logL: 0.55, logT: 3.68, R: 3.0, Mcore: 0.22 } },
      { id: 'rgb', duration: 6.0e8, start: { logL: 0.55, logT: 3.68, R: 3.0, Mcore: 0.22 }, end: { logL: 3.4, logT: 3.60, R: 170, Mcore: 0.48 } },
      { id: 'flash', duration: 1.0e4, start: { logL: 3.4, logT: 3.60, R: 170, Mcore: 0.48 }, end: { logL: 1.7, logT: 3.72, R: 10, Mcore: 0.48 } },
      { id: 'hb', duration: 1.0e8, start: { logL: 1.7, logT: 3.72, R: 10, Mcore: 0.48 }, end: { logL: 1.75, logT: 3.74, R: 9, Mcore: 0.52 } },
      { id: 'agb', duration: 2.0e7, start: { logL: 1.75, logT: 3.74, R: 9, Mcore: 0.52 }, end: { logL: 3.5, logT: 3.56, R: 220, Mcore: 0.54 } },
      { id: 'final', duration: 3.0e4, start: { logL: 3.5, logT: 3.56, R: 220, Mcore: 0.54 }, end: { logL: -3.0, logT: 4.3, R: 0.011, Mcore: 0.54 } },
    ],
  },
  {
    mass: 2,
    phases: [
      { id: 'ms', duration: 1.2e9, start: { logL: 1.0, logT: 3.98, R: 1.6, Mcore: 0.0 }, end: { logL: 1.5, logT: 3.90, R: 2.3, Mcore: 0.1 } },
      { id: 'subgiant', duration: 5.0e7, start: { logL: 1.5, logT: 3.90, R: 2.3, Mcore: 0.1 }, end: { logL: 1.7, logT: 3.78, R: 5.0, Mcore: 0.28 } },
      { id: 'rgb', duration: 4.5e8, start: { logL: 1.7, logT: 3.78, R: 5.0, Mcore: 0.28 }, end: { logL: 3.2, logT: 3.58, R: 55, Mcore: 0.47 } },
      { id: 'flash', duration: 1.0e4, start: { logL: 3.2, logT: 3.58, R: 55, Mcore: 0.47 }, end: { logL: 1.9, logT: 3.83, R: 9, Mcore: 0.47 } },
      { id: 'hb', duration: 6.0e7, start: { logL: 1.9, logT: 3.83, R: 9, Mcore: 0.47 }, end: { logL: 2.0, logT: 3.80, R: 10, Mcore: 0.55 } },
      { id: 'agb', duration: 1.2e7, start: { logL: 2.0, logT: 3.80, R: 10, Mcore: 0.55 }, end: { logL: 3.6, logT: 3.55, R: 170, Mcore: 0.62 } },
      { id: 'final', duration: 1.5e4, start: { logL: 3.6, logT: 3.55, R: 170, Mcore: 0.62 }, end: { logL: -2.5, logT: 4.4, R: 0.011, Mcore: 0.62 } },
    ],
  },
  {
    mass: 5,
    phases: [
      { id: 'ms', duration: 1.0e8, start: { logL: 2.55, logT: 4.15, R: 2.5, Mcore: 0.0 }, end: { logL: 2.85, logT: 4.02, R: 4.0, Mcore: 0.3 } },
      { id: 'subgiant', duration: 3.0e6, start: { logL: 2.85, logT: 4.02, R: 4.0, Mcore: 0.3 }, end: { logL: 2.95, logT: 3.88, R: 8.0, Mcore: 0.55 } },
      { id: 'rgb', duration: 2.0e6, start: { logL: 2.95, logT: 3.88, R: 8.0, Mcore: 0.55 }, end: { logL: 3.3, logT: 3.64, R: 55, Mcore: 0.85 } },
      { id: 'flash', duration: 2.0e5, start: { logL: 3.3, logT: 3.64, R: 55, Mcore: 0.85 }, end: { logL: 3.0, logT: 3.92, R: 18, Mcore: 0.85 } },
      { id: 'hb', duration: 2.0e7, start: { logL: 3.0, logT: 3.92, R: 18, Mcore: 0.85 }, end: { logL: 3.4, logT: 3.65, R: 70, Mcore: 0.95 } },
      { id: 'agb', duration: 1.0e6, start: { logL: 3.4, logT: 3.65, R: 70, Mcore: 0.95 }, end: { logL: 4.0, logT: 3.50, R: 380, Mcore: 1.0 } },
      { id: 'final', duration: 3.0e4, start: { logL: 4.0, logT: 3.50, R: 380, Mcore: 1.0 }, end: { logL: -2.0, logT: 4.6, R: 0.009, Mcore: 0.9 } },
    ],
  },
  {
    mass: 15,
    phases: [
      { id: 'ms', duration: 1.3e7, start: { logL: 4.0, logT: 4.45, R: 5.0, Mcore: 0.0 }, end: { logL: 4.4, logT: 4.35, R: 9.0, Mcore: 3.0 } },
      { id: 'subgiant', duration: 3.0e5, start: { logL: 4.4, logT: 4.35, R: 9.0, Mcore: 3.0 }, end: { logL: 4.5, logT: 4.0, R: 30, Mcore: 4.0 } },
      { id: 'rgb', duration: 6.0e5, start: { logL: 4.5, logT: 4.0, R: 30, Mcore: 4.0 }, end: { logL: 4.9, logT: 3.55, R: 500, Mcore: 5.0 } },
      { id: 'flash', duration: 1.0e4, start: { logL: 4.9, logT: 3.55, R: 500, Mcore: 5.0 }, end: { logL: 4.7, logT: 3.9, R: 200, Mcore: 5.0 } },
      { id: 'hb', duration: 1.0e6, start: { logL: 4.7, logT: 3.9, R: 200, Mcore: 5.0 }, end: { logL: 5.0, logT: 3.6, R: 800, Mcore: 5.5 } },
      { id: 'agb', duration: 5.0e3, start: { logL: 5.0, logT: 3.6, R: 800, Mcore: 5.5 }, end: { logL: 5.3, logT: 3.5, R: 1000, Mcore: 1.5 } },
      { id: 'final', duration: 1.0, start: { logL: 5.3, logT: 3.5, R: 1000, Mcore: 1.5 }, end: { logL: 9.3, logT: 4.0, R: 1.4e-5, Mcore: 1.4 } },
    ],
  },
  {
    mass: 25,
    phases: [
      { id: 'ms', duration: 7.0e6, start: { logL: 5.1, logT: 4.55, R: 7.0, Mcore: 0.0 }, end: { logL: 5.4, logT: 4.45, R: 12, Mcore: 5.0 } },
      { id: 'subgiant', duration: 2.0e5, start: { logL: 5.4, logT: 4.45, R: 12, Mcore: 5.0 }, end: { logL: 5.5, logT: 4.1, R: 40, Mcore: 6.5 } },
      { id: 'rgb', duration: 3.0e5, start: { logL: 5.5, logT: 4.1, R: 40, Mcore: 6.5 }, end: { logL: 5.9, logT: 3.6, R: 800, Mcore: 8.0 } },
      { id: 'flash', duration: 5.0e3, start: { logL: 5.9, logT: 3.6, R: 800, Mcore: 8.0 }, end: { logL: 5.7, logT: 4.7, R: 15, Mcore: 8.0 } },
      { id: 'hb', duration: 3.0e5, start: { logL: 5.7, logT: 4.7, R: 15, Mcore: 8.0 }, end: { logL: 6.1, logT: 4.5, R: 30, Mcore: 9.0 } },
      { id: 'agb', duration: 2.0e3, start: { logL: 6.1, logT: 4.5, R: 30, Mcore: 9.0 }, end: { logL: 6.3, logT: 4.4, R: 40, Mcore: 2.0 } },
      { id: 'final', duration: 1.0, start: { logL: 6.3, logT: 4.4, R: 40, Mcore: 2.0 }, end: { logL: 9.5, logT: 4.0, R: 5e-6, Mcore: 8.0 } },
    ],
  },
];

const PHASE_IDS: PhaseId[] = ['ms', 'subgiant', 'rgb', 'flash', 'hb', 'agb', 'final'];
const ANCHOR_MASSES = T.map((t) => t.mass);

function bracket(mass: number): [MassTrack, MassTrack, number] {
  const m = Math.min(Math.max(mass, ANCHOR_MASSES[0]), ANCHOR_MASSES[ANCHOR_MASSES.length - 1]);
  let i = 0;
  while (i < T.length - 2 && ANCHOR_MASSES[i + 1] < m) i++;
  const lo = T[i], hi = T[i + 1];
  const t = (Math.log(m) - Math.log(lo.mass)) / (Math.log(hi.mass) - Math.log(lo.mass));
  return [lo, hi, Math.min(1, Math.max(0, t))];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpLog = (a: number, b: number, t: number) => Math.exp(lerp(Math.log(Math.max(a, 1e-30)), Math.log(Math.max(b, 1e-30)), t));

/** Full interpolated track (7 phases) for an arbitrary mass in [1, 25] Msun. */
export function trackForMass(mass: number): PhaseSpec[] {
  const [lo, hi, t] = bracket(mass);
  return PHASE_IDS.map((id) => {
    const pl = lo.phases.find((p) => p.id === id)!;
    const ph = hi.phases.find((p) => p.id === id)!;
    const mix = (a: PhasePoint, b: PhasePoint): PhasePoint => ({
      logL: lerp(a.logL, b.logL, t),
      logT: lerp(a.logT, b.logT, t),
      R: lerpLog(a.R, b.R, t),
      Mcore: lerp(a.Mcore, b.Mcore, t),
    });
    return { id, duration: lerpLog(pl.duration, ph.duration, t), start: mix(pl.start, ph.start), end: mix(pl.end, ph.end) };
  });
}

export interface EvolState extends PhasePoint {
  phase: PhaseId;
  age: number; // years since ZAMS
  phaseFrac: number; // 0..1 progress within the current phase
}

/**
 * Evaluate the track at a "phase-weighted" scrubber position s in [0,1].
 * Each of the 7 phases gets an EQUAL share of the slider (1/7 each), regardless of its
 * true duration — see the chapter's <Hood> for why. Returns the physical state and the
 * true elapsed age (which is highly non-uniform in s: the main sequence alone consumes
 * a huge fraction of the real years but only 1/7 of the slider).
 */
export function stateAt(mass: number, s: number): EvolState {
  const phases = trackForMass(mass);
  const n = phases.length;
  const clamped = Math.min(0.999999, Math.max(0, s));
  const idx = Math.min(n - 1, Math.floor(clamped * n));
  const frac = clamped * n - idx;
  const spec = phases[idx];
  let age = 0;
  for (let i = 0; i < idx; i++) age += phases[i].duration;
  age += spec.duration * frac;
  return {
    phase: spec.id,
    phaseFrac: frac,
    age,
    logL: lerp(spec.start.logL, spec.end.logL, frac),
    logT: lerp(spec.start.logT, spec.end.logT, frac),
    R: lerpLog(spec.start.R, spec.end.R, frac),
    Mcore: lerp(spec.start.Mcore, spec.end.Mcore, frac),
  };
}

export function totalAge(mass: number): number {
  return trackForMass(mass).reduce((a, p) => a + p.duration, 0);
}

export function phaseLabel(id: PhaseId, mass: number): string {
  const l = PHASE_LABELS[id];
  return mass < FLASH_THRESHOLD_MSUN ? l.lowMass : l.highMass;
}

/** Sample the full HR track (many points) for drawing the curve underneath the marker. */
export function hrCurve(mass: number, samplesPerPhase = 24): { logT: number; logL: number }[] {
  const phases = trackForMass(mass);
  const pts: { logT: number; logL: number }[] = [];
  for (const p of phases) {
    for (let i = 0; i <= samplesPerPhase; i++) {
      const f = i / samplesPerPhase;
      pts.push({ logT: lerp(p.start.logT, p.end.logT, f), logL: lerp(p.start.logL, p.end.logL, f) });
    }
  }
  return pts;
}
