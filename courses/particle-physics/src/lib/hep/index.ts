/**
 * `hep`: the course's physics library. Importable from the reader's exercises as `hep` or `hep/<module>`.
 * See appendix F for the reference and appendix E for what each stage models.
 */
export * as units from './units/index.ts';
export * as random from './random/index.ts';
export * as kinematics from './kinematics/index.ts';
export * as particles from './particles/index.ts';
export * as event from './event/index.ts';
export * as hooks from './hooks.ts';

export { rng, type Rng } from './random/index.ts';
export type { P4 } from './kinematics/index.ts';
export { particle } from './particles/index.ts';
export * as data from './data/index.ts';
export * as diagrams from './diagrams/index.ts';
export * as sm from './sm/index.ts';
export * as gen from './gen/index.ts';
export * as shower from './shower/index.ts';
export * as hadronise from './hadronise/index.ts';
export * as decay from './decay/index.ts';
export * as detector from './detector/index.ts';
export * as reco from './reco/index.ts';
export * as machine from './machine/index.ts';
export * as trigger from './trigger/index.ts';
export * as analysis from './analysis/index.ts';
export * as fields from './fields/index.ts';
export * as chamber from './chamber/index.ts';
