/**
 * The digital engine: event-driven four-valued logic simulation (engine.ts), its model registry
 * (model.ts) and built-in models (models/), and a netlist builder for code-generated circuits.
 */
export { createDigitalEngine, type DigitalEngine, type DigitalEngineOptions, type DelayModel } from './engine';
export {
  registerDigitalModel,
  getDigitalModel,
  digitalModelTypes,
  nsToTicks,
  TICKS_PER_SECOND,
  TICKS_PER_NS,
  type DigitalModel,
  type DigitalModelFactory,
  type DigitalSim,
  type ModelInit,
  type ModelRegistration,
  type PinDir,
} from './model';
export { NetlistBuilder } from './builder';
export { DigitalRecorder } from './recorder';
/** Four-valued logic helpers for models (Z reads as X on inputs; buses read without allocating). */
export { input, control, not4, and4, or4, xor4, maj4, merge, parseInit, readBus, bus } from './logic';
