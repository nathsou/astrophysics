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
