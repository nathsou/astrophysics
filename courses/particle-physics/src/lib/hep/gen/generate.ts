/**
 * `generate`: hard process → parton shower → hadronisation → decays, with pile-up overlaid.
 *
 *   hard process (this module)            matrix-element level, resonance decays included
 *   shower(ev, rng)        ../shower      initial- and final-state radiation of the coloured partons
 *   hadronise(ev, rng)     ../hadronise   toy Lund strings
 *   decayAll(ev, rng)      ../decay       particle-table decays of everything unstable
 *   pile-up                this module    `pileup` extra minimum-bias collisions, each hadronised-by-construction and decayed separately
 *
 * The vertices: the primary vertex of the hard scatter and of every pile-up collision is drawn from the luminous region (z Gaussian with
 * σ = 50 mm, x and y Gaussian with σ = 15 µm); the vertex of every particle of a collision is shifted to its primary vertex (the decay
 * module has placed secondary vertices relative to the production point), `TruthParticle.collision` is 0 for the hard scatter and 1, 2, … for
 * the pile-up collisions, and `TruthEvent.primaryVertices[k]` is the vertex of collision k.
 */
import type { TruthEvent, TruthParticle } from '../event/index.ts';
import type { Rng } from '../random/index.ts';
import { normal, poisson, rng as makeRng } from '../random/index.ts';
import { decayAll } from '../decay/index.ts';
import { hadronise } from '../hadronise/index.ts';
import { shower } from '../shower/index.ts';
import { getProcess, type Process } from './process.ts';
import { minimumBiasEvent } from './minbias.ts';

export interface GenerateConfig {
  /** Centre-of-mass energy in GeV. */
  sqrtS: number;
  /** Run the parton shower (default true). */
  shower?: boolean;
  /** Run the hadronisation (default true). */
  hadronise?: boolean;
  /** Decay the unstable particles (default true). */
  decay?: boolean;
  /** Number of extra minimum-bias collisions to overlay (default 0). */
  pileup?: number;
  /** Instead of a fixed number: the mean of a Poisson distribution for the number of extra collisions (used if `pileup` is not given). */
  pileupMean?: number;
  /** Seed for the generator if no `rng` is passed (default 1). */
  seed?: number;
  /** e⁺e⁻ processes: radiate initial-state photons. */
  isr?: boolean;
  /** Event number written to the record. */
  eventNumber?: number;
  /** Luminous region, mm: σz (default 50) and σxy (default 0.015, i.e. 15 µm). */
  beamSpot?: { sigmaZ?: number; sigmaXY?: number };
  /** Passed to `decayAll`: decay only particles with a mean lab decay length up to this many mm (default: the decay module's policy). */
  maxCtauMm?: number;
  /** Return the weight of the hard process (pb) instead of unit weight. */
  weighted?: boolean;
}

function shift(ev: TruthEvent, pv: [number, number, number], collision: number): void {
  for (const p of ev.particles) {
    p.vertex = [p.vertex[0] + pv[0], p.vertex[1] + pv[1], p.vertex[2] + pv[2]];
    if (p.endVertex) p.endVertex = [p.endVertex[0] + pv[0], p.endVertex[1] + pv[1], p.endVertex[2] + pv[2]];
    p.collision = collision;
  }
}

/** Append the particles of `src` to `dst`, renumbering ids, mothers and daughters. */
function merge(dst: TruthEvent, src: TruthEvent): void {
  const off = dst.particles.length;
  for (const p of src.particles) {
    const q: TruthParticle = { ...p, id: p.id + off, mothers: p.mothers.map((m) => m + off), daughters: p.daughters.map((d) => d + off) };
    dst.particles.push(q);
  }
}

/**
 * Generate one event. `process` is a `Process` or the name of a registered one ('ee->mumu', 'pp->Z->mumu', 'pp->H->ZZ->4l',
 * 'pp->ttbar', …; see `listProcesses()`). The random numbers come from `rng` (or, if omitted, from `rng(cfg.seed ?? 1)`), so the same seed
 * gives the same event.
 */
export function generate(process: Process | string, cfg: GenerateConfig, rng?: Rng): TruthEvent {
  const r = rng ?? makeRng(cfg.seed ?? 1);
  const proc = typeof process === 'string' ? getProcess(process) : process;
  const { event: ev } = proc.generate(r, { sqrtS: cfg.sqrtS, weighted: cfg.weighted, eventNumber: cfg.eventNumber, isr: cfg.isr });
  ev.number = cfg.eventNumber ?? ev.number;

  if (cfg.shower !== false) shower(ev, r);
  if (cfg.hadronise !== false) hadronise(ev, r);
  if (cfg.decay !== false) decayAll(ev, r, cfg.maxCtauMm === undefined ? {} : { maxCtauMm: cfg.maxCtauMm });

  const sz = cfg.beamSpot?.sigmaZ ?? 50;
  const sxy = cfg.beamSpot?.sigmaXY ?? 0.015;
  const newPv = (): [number, number, number] => [normal(r, 0, sxy), normal(r, 0, sxy), normal(r, 0, sz)];
  const pv0 = newPv();
  shift(ev, pv0, 0);
  ev.primaryVertices = [pv0];

  const nPu = cfg.pileup ?? (cfg.pileupMean !== undefined ? poisson(r, cfg.pileupMean) : 0);
  for (let k = 1; k <= nPu; k++) {
    const mb = minimumBiasEvent(r, cfg.sqrtS);
    if (cfg.decay !== false) decayAll(mb, r, cfg.maxCtauMm === undefined ? {} : { maxCtauMm: cfg.maxCtauMm });
    const pv = newPv();
    shift(mb, pv, k);
    merge(ev, mb);
    ev.primaryVertices.push(pv);
  }
  return ev;
}
