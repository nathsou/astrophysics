/**
 * Parton shower: pT-ordered final-state radiation with the Sudakov veto algorithm, simplified initial-state radiation,
 * and the analytic ingredients (splitting functions, Sudakov form factor) for the chapter widgets.
 * See README.md.
 */
import type { TruthEvent } from '../event/index.ts';
import type { Rng } from '../random/index.ts';
import { showerFsr, type ShowerOptions } from './fsr.ts';
import { showerIsr } from './isr.ts';

export type { ShowerOptions, EmissionConfig, Emission, BranchKind } from './fsr.ts';
export { nextEmission, showerFsr } from './fsr.ts';
export { showerIsr, isrRecords, type IsrRecord } from './isr.ts';
export { showerHistory, type Branching, type BranchingKind } from './history.ts';
export { rescaleToTarget } from './rescale.ts';
export {
  CA, CF, TR, splitting, sudakov, emissionRate, activeFlavours, alphaSShower, alphaSOver, overestimateFactor, LAMBDA2, B0_NF5,
  type SudakovOptions, type ShowerParton,
} from './splitting.ts';

/**
 * Shower the event in place: first the initial-state radiation (if `opts.isr !== false` and the event has coloured
 * incoming partons recorded as status 'hard' with beam mothers), then the final-state shower of every outgoing coloured
 * parton (status 'final', or 'hard' with no daughters). Partons that branch become 'intermediate' and get daughters;
 * the final partons have status 'final' and carry colour labels. Four-momentum is conserved exactly.
 */
export function shower(ev: TruthEvent, rng: Rng, opts: ShowerOptions = {}): void {
  if (opts.isr !== false) showerIsr(ev, rng, opts);
  if (opts.fsr !== false) showerFsr(ev, rng, opts);
}
