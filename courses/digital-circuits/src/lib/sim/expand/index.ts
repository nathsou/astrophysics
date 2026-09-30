/**
 * The abstraction dial's engine room: opening a circuit of gates up into its transistors (switch
 * level) and into device models with parasitic capacitance (analog). See expand.ts.
 */
export {
  expandToSwitch,
  expandToAnalog,
  expand,
  canExpand,
  expandCheck,
  cellCircuit,
  TRANSISTOR_BUDGET,
  ANALOG,
  type Expansion,
  type ExpandCheck,
  type ExpandLevel,
  type Frame,
} from './expand';
export { cellFor, gateTransistors, isGateType, GATE_TYPES, type Cell, type GateType, type Net, type Stage } from './cells';
export { registerFrame } from './frame';
