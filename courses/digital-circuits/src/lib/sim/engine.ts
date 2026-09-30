import type { EngineKind, FlatNetlist, Logic, ParamValue } from './netlist/types';

/**
 * The contract every simulation engine implements (analog, switch-level, digital). Widgets, the
 * bench and the instruments only talk to engines through it.
 *
 * Units: seconds, volts, amperes, watts, ohms, farads, henries, hertz. Catalog parameters use the
 * same units unless the ParamDef says otherwise (gate delays are in nanoseconds).
 */
export interface Engine {
  readonly kind: EngineKind;
  readonly netlist: FlatNetlist;
  /** Simulated time, in seconds, since the last reset. */
  readonly time: number;

  /**
   * Advance simulated time by `dt` seconds; the engine chooses its internal steps. One call costs at
   * most a fixed allowance of work (each engine has its own caps, see its options): when a cap stops
   * it before `dt` has passed, `lagging` is set, `speed` is below 1, an info message is posted and
   * `time` simply falls behind the requested time. A caller that needs the whole interval (a test
   * settling a long interval in one call) passes larger caps in the engine options, or loops
   * `while (engine.time < end)`, which always makes progress.
   */
  advance(dt: number): void;
  /** Settle the circuit without advancing time (digital: process all zero-time events). */
  settle(): void;
  /** Back to the initial state (parameters keep their current values). */
  reset(): void;

  /**
   * True when the last `advance()` hit a work cap before reaching the requested time. All three
   * engines implement it; optional here so that other Engine implementations (test doubles) stay valid.
   */
  readonly lagging?: boolean;
  /** Simulated time covered by the last `advance()` divided by the time requested (1 = on time). */
  readonly speed?: number;

  /** Logic value of a net. Analog engines derive it from the voltage (thresholds of 5 V CMOS). */
  logic(net: number): Logic;
  /** Voltage of a net relative to ground. Logic engines report 0 V / 5 V, NaN for X and Z. */
  voltage(net: number): number;
  /** Current flowing into pin `pin` (index in the element's pin list) of element `id`, in amperes. 0 in logic engines. */
  current(id: string, pin: number): number;

  /**
   * What an element looks like now, for the renderer: a switch's position, a lamp's brightness
   * (0–1), an LED lit or not, a relay's contacts, a burned part, a display's segments, a
   * register's value. Keys are documented with each model.
   */
  state(id: string): ElementState;

  /** Change a parameter while running: flip a switch, press a button, turn a knob. */
  setParam(id: string, key: string, value: ParamValue): void;

  /**
   * Record every change of the given nets (digital: each event; analog: each internal step) until
   * the recorder is closed. Instruments (scope, logic analyser, timing diagrams) use this rather
   * than sampling once per animation frame, so short glitches are not lost.
   */
  watch(nets: number[]): Recorder;

  /** Problems the reader should know about: a failed convergence, an oscillation, a burned part. */
  readonly messages: EngineMessage[];
}

export interface ElementState {
  /** Burned out (a rating was exceeded for too long). */
  burned?: boolean;
  /** Light output 0–1 (lamps, LEDs). */
  brightness?: number;
  /** A switch or relay's contact is closed (for changeover contacts: throw position 0/1 in `throw`). */
  closed?: boolean;
  throw?: number;
  /** A numeric value to display (hex display, register, counter). */
  value?: number;
  /** Segment bits a–g, dp (7-segment display), as a bit mask with a = bit 0. */
  segments?: number;
  /** Anything else a model wants to expose (documented next to the model). */
  [key: string]: number | boolean | string | undefined;
}

export interface EngineMessage {
  level: 'info' | 'warning' | 'error';
  text: string;
  /** Element the message is about, if any. */
  element?: string;
  time: number;
}

export interface Recorder {
  readonly nets: number[];
  /** Sample times (s), ascending. */
  times(): Float64Array;
  /** One array per watched net: voltages (analog) or logic values (digital), aligned with times(). */
  values(): Float64Array[];
  /** Drop samples older than `t` seconds before the current time (keeps memory bounded). */
  trim(keepSeconds: number): void;
  close(): void;
}

export type EngineFactory = (netlist: FlatNetlist, options?: EngineOptions) => Engine;

export interface EngineOptions {
  /** Analog: maximum internal step (s). Digital: default gate delay when a model has none (s). */
  step?: number;
  /** Seed for anything random (metastability resolution, bounce). */
  seed?: number;
  /**
   * Digital and switch engines: cap on the events (digital: queue entries; switch: clock edges, relay
   * moves and rounds) processed by one `advance()` call, so a fast clock or a ring oscillator with a
   * large `dt` cannot freeze the page. Deterministic. The analog engine has its own caps
   * (`maxStepsPerAdvance`, `maxWorkPerAdvance`).
   */
  maxEventsPerAdvance?: number;
  /**
   * Optional wall-clock budget for one `advance()` call, in milliseconds (default: none; digital, switch
   * and analog engines). A UI loop sets it to a fraction of the frame time. It depends on the machine,
   * so tests must not use it.
   */
  budgetMs?: number;
}
