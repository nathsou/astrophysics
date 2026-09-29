/**
 * The switch-level engine: transistors as bidirectional switches, node values 0/1/X with
 * strengths (supply > driven > weak > charged), charge storage and sharing. See engine.ts for the
 * model, solve.ts for the steady-state algorithm.
 */
export {
  createSwitchEngine,
  netStrength,
  isSwitchEngine,
  transistorSize,
  type SwitchEngine,
  type SwitchEngineOptions,
  type SwitchMode,
  type NodeSize,
  type TransistorSize,
  type StrengthKind,
  type StrengthLevels,
} from './engine';
export { SwitchBuilder } from './builder';
export { SwitchRecorder, TICKS_PER_SECOND } from './recorder';
export { ComponentSolver, type SwitchGraph } from './solve';
