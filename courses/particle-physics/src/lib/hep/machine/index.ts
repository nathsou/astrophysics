/**
 * Stage 1: the machine. Accelerator physics as a toolkit: beam optics (transfer matrices, Twiss parameters, tunes, tracking),
 * rigidity and field (with the LHC as a preset), longitudinal dynamics (the RF bucket), synchrotron radiation, luminosity and
 * pile-up, and machine protection. See README.md.
 *
 * Hooks for the reader's code: `machine.trackThroughLattice`, `machine.luminosity`, `machine.trackLongitudinal`.
 */
export * from './optics.ts';
export * from './fields.ts';
export * from './longitudinal.ts';
export * from './radiation.ts';
export * from './luminosity.ts';
export * from './protection.ts';
export * from './lhcCell.ts';
