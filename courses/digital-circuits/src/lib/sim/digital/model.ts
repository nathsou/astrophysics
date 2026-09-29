import type { ElementState, EngineMessage } from '../engine';
import type { FlatElement, ParamValue } from '../netlist/types';

/**
 * The interface between the digital engine and its element models.
 *
 * Time inside the engine is an integer number of **ticks** of one picosecond, held in a double
 * (exact up to 2^53 ps ≈ 2.5 hours of simulated time). Models convert their nanosecond parameters
 * with `nsToTicks`.
 *
 * Logic values are the numbers 0, 1, 2 (X) and 3 (Z) of `netlist/types.ts`.
 */

export const TICKS_PER_SECOND = 1e12;
export const TICKS_PER_NS = 1e3;

/** Convert a delay in nanoseconds (a catalog parameter) to ticks; negative or invalid values give 0. */
export function nsToTicks(ns: unknown, fallback = 0): number {
  const v = Number(ns);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.round(v * TICKS_PER_NS));
}

/** Direction of a pin as the engine sees it: inputs are watched, outputs get a driver. */
export type PinDir = 'in' | 'out' | 'io';

/** What a model sees of the engine while it evaluates. */
export interface DigitalSim {
  /** Current value of every net (0, 1, 2 = X, 3 = Z). Read-only for models. */
  readonly nets: Uint8Array;
  /** Current time in ticks (ps). */
  readonly now: number;
  /** Default delay in ticks, for models without a delay parameter (EngineOptions.step). */
  readonly defaultDelay: number;
  /**
   * Schedule driver `slot` to take `value` after `delay` ticks. With inertial delay (the default)
   * a new value cancels the slot's pending ones, so pulses shorter than the delay are swallowed;
   * with transport delay every change is delivered. A zero delay takes effect in the next delta
   * cycle at the same time.
   */
  drive(slot: number, value: number, delay: number): void;
  /** The value driver `slot` drives now (pending changes not included). */
  output(slot: number): number;
  /** Cancel every pending change of driver `slot`. */
  cancel(slot: number): void;
  /** Call the element's `wake(tag)` after `delay` ticks. Each element has one pending wake-up; a new one replaces it. */
  wakeAt(element: number, delay: number, tag: number): void;
  /** Cancel the element's pending wake-up. */
  cancelWake(element: number): void;
  /** Seeded uniform random number in [0, 1). */
  random(): number;
  /** Post a message for the reader. */
  message(level: EngineMessage['level'], text: string, element?: string): void;
}

/** What a model factory is given about its element. */
export interface ModelInit {
  readonly element: FlatElement;
  /** Index of the element in the netlist (for `wakeAt`). */
  readonly index: number;
  /** Net of each pin, in catalog order. */
  readonly nets: Int32Array;
  /** Driver slot of each output pin, −1 for input pins. */
  readonly slots: Int32Array;
  /** Pin index by name, −1 when the element has no such pin. */
  pin(name: string): number;
  /** Default delay in ticks (EngineOptions.step). */
  readonly defaultDelay: number;
}

export interface DigitalModel {
  /**
   * The outputs are a function of the inputs only (no memory). The engine uses this to start
   * feedback loops of combinational elements in a random but consistent state at power-up.
   */
  readonly combinational?: boolean;
  /**
   * Back to the power-up state. Called at construction and on reset(), with every output at X and
   * time 0; may drive outputs (usually with delay 0) and schedule wake-ups.
   */
  reset?(sim: DigitalSim): void;
  /**
   * An input changed. Also called once for every element after reset(). Models without inputs
   * (sources) drive their value here. Omit it for models that only display their inputs.
   */
  evaluate?(sim: DigitalSim): void;
  /** A wake-up scheduled with `sim.wakeAt` has arrived. */
  wake?(sim: DigitalSim, tag: number): void;
  /**
   * A parameter changed (the element's `params` already hold the new value). The engine calls
   * `evaluate` afterwards. Parameters that change the pin count cannot change while running.
   */
  setParam?(sim: DigitalSim, key: string, value: ParamValue): void;
  /** What the element looks like now (keys documented with each model). */
  state?(sim: DigitalSim): ElementState;
  /** Memory contents, for RAM and ROM models. */
  memory?(): Uint8Array | Uint32Array;
  /** Write one memory word from outside (a widget editing a RAM); the engine re-evaluates afterwards. */
  poke?(sim: DigitalSim, address: number, value: number): void;
}

export type DigitalModelFactory = (init: ModelInit) => DigitalModel;

export interface ModelRegistration {
  factory: DigitalModelFactory;
  /**
   * Direction of each pin. Defaults to the catalog's `dir` (pins without one are inputs); give it
   * for pins the catalog does not mark, e.g. the supply rail's output.
   */
  pinDirs?: (el: FlatElement) => PinDir[];
}

const models = new Map<string, ModelRegistration>();

/**
 * Register the digital model of a component type. Later milestones add models this way (parts-bin
 * cells, DCL-lowered primitives, FPGA fabric). Registering a type again replaces its model.
 */
export function registerDigitalModel(type: string, factory: DigitalModelFactory, options?: Omit<ModelRegistration, 'factory'>): void {
  models.set(type, { factory, ...options });
}

export function getDigitalModel(type: string): ModelRegistration | undefined {
  return models.get(type);
}

export function digitalModelTypes(): string[] {
  return [...models.keys()];
}
