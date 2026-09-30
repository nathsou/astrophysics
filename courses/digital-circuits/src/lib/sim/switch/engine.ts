import type { ElementState, Engine, EngineMessage, EngineOptions, Recorder } from '../engine';
import type { FlatElement, FlatNetlist, Logic, ParamValue, Params } from '../netlist/types';
import { LZ } from '../netlist/types';
import { ComponentSolver, MAYBE, OFF, ON, V0, V1, VX, type SwitchGraph } from './solve';
import { SwitchRecorder, TICKS_PER_SECOND } from './recorder';

/**
 * The switch-level engine (Bryant's MOSSIM II model).
 *
 * Nodes (nets) carry 0, 1 or X. Transistors are bidirectional switches: an nMOS conducts when its
 * gate is 1, a pMOS when it is 0, and either *may* conduct when its gate is X. Resistors, lamps and
 * relay coils always conduct, weakly; switch and relay contacts conduct like wires when closed.
 *
 * Strengths, weakest first (see solve.ts for how they combine):
 *
 *   charge   small < normal < large    a node cut off from every supply keeps its value; when
 *                                      isolated nodes are joined, the larger wins (equal sizes
 *                                      that disagree give X). A net touching a `capacitor` is
 *                                      large; larger capacitances are larger still.
 *   weak     resistor, lamp, relay coil      a pull-up resistor loses to any transistor.
 *   driven   weak < normal < strong          transistor sizes, from the `strength` parameter
 *                                      ('weak' | 'normal' | 'strong') or a relative width `w`
 *                                      (< 1 weak, ≥ 2 strong); default normal.
 *   wire     closed switch or relay contact
 *   supply   rails, ground, toggles, buttons, clocks, constants (input nodes)
 *
 * Transistor sizes decide ratioed circuits: a pseudo-nMOS load or a pull-up must be weaker than the
 * pull-down network; an SRAM cell is written because its access transistors (normal) overpower
 * its pull-ups (weak), and read without upset because its pull-downs (strong) overpower the
 * charged bit line.
 *
 * Simulation proceeds in *rounds*. A round re-evaluates every transistor whose gate changed in the
 * previous round, then re-solves every channel-connected component that one of those changes (or
 * an input, or a switch) touched. Components are found afresh each round by walking conducting and
 * maybe-conducting links from the touched nodes, stopping at input nodes.
 *
 *  - Settle mode (default): after every change, rounds run at the same instant until nothing
 *    changes. A circuit that is still changing after `maxRounds` rounds oscillates: the nodes
 *    still changing are set to X (which then usually spreads around the loop and stays), and an
 *    error message says so.
 *  - Unit-delay mode: each round takes `unitDelay` seconds of simulated time, so each transistor
 *    stage adds one delay. Rings oscillate; animations can show a change rippling through.
 *
 * Power-up: every node starts X (a floating node that has never been driven reads Z). With
 * `powerUp: 'random'` (default), feedback loops that are still X after the first settle (latches,
 * SRAM cells, rings) get a seeded random bit deposited on one node at a time, as real hardware
 * picks one at random.
 *
 * States (`state(id)`):
 *  - nmos, pmos: `{ on }`, 1 conducting, 0 off, 2 unknown (gate X); `size` ('weak' | 'normal' | 'strong').
 *  - switch: `{ closed }`; pushbutton: `{ closed, pressed }`; spdt: `{ throw }`.
 *  - relay: `{ energised, closed, throw }` (closed/throw 1: COM–NO; `unknown` while the coil is X).
 *  - lamp: `{ brightness }`, 1 when its ends are at different known values.
 *  - toggle `{ on, value }`, button `{ pressed, value }`, const `{ value }`, clock `{ value, frequency }`,
 *    rail `{ value }`; indicator `{ lit, brightness, value }`; probe `{ value }`;
 *    seven-seg `{ segments, unknown }`; hex-display `{ value }` (undefined when an input is X or Z).
 *
 * Work per advance(): capped by `maxEventsPerAdvance` (default 10 000: clock edges, relay moves and
 * rounds) and optionally by a wall-clock `budgetMs`, both checked between instants. When a cap stops
 * the call, `lagging` is set, `speed` is < 1, an info message is posted and simulated time stops at the
 * last instant processed, so the next call carries on from there. At least one instant is processed per
 * call, so a `while (time < end)` loop always makes progress. A call that is not lagging ends exactly on
 * its target time. settle() and step() are not part of an advance() allowance.
 */

export type SwitchMode = 'settle' | 'unit-delay';
export type NodeSize = 'small' | 'normal' | 'large';
export type TransistorSize = 'weak' | 'normal' | 'strong';
/** How a net got its value: from a supply, through transistors or switches, through a resistor, stored charge, or never driven. */
export type StrengthKind = 'supply' | 'driven' | 'weak' | 'charged' | 'floating';

export interface SwitchEngineOptions extends EngineOptions {
  /** 'settle' (zero delay, default) or 'unit-delay'. */
  mode?: SwitchMode;
  /** Delay of one transistor stage in unit-delay mode, in seconds (default `step`, else 1 ns). */
  unitDelay?: number;
  /** Rounds at one instant before the circuit is declared oscillating (default: 1000, or 4 × the number of nets if larger). */
  maxRounds?: number;
  /** 'random' (default): resolve X feedback loops at power-up; 'x': leave them X. */
  powerUp?: 'random' | 'x';
  /** Size class of nets, by net index or net name (nets touching a capacitor are large anyway). */
  nodeSize?: Record<string, NodeSize>;
  /**
   * Cap on the events one advance() call processes (default 10 000): every clock edge, relay move and
   * unit-delay round counts one, and so does each extra round a settle-mode instant needs. A fast clock or
   * a ring oscillator with a large `dt` then cannot freeze a frame. Deterministic. Tests that settle a
   * long interval in one call pass a larger value.
   */
  maxEventsPerAdvance?: number;
  /** Optional wall-clock budget for one advance() call, in ms (default: none). Machine dependent: tests should not use it. */
  budgetMs?: number;
}

/** Default cap on the events one advance() call processes (a round costs far more here than an event in the digital engine). */
export const DEFAULT_MAX_EVENTS_PER_ADVANCE = 10_000;

/** Strength levels of an engine instance (they depend on how many capacitor sizes there are). */
export interface StrengthLevels {
  small: number;
  normal: number;
  large: number;
  /** Strongest charge level (the largest capacitor). */
  maxCharge: number;
  weak: number;
  transistor: Record<TransistorSize, number>;
  wire: number;
  supply: number;
}

export interface SwitchEngine extends Engine {
  readonly kind: 'switch';
  readonly mode: SwitchMode;
  readonly levels: StrengthLevels;
  /** Rounds run since construction (a measure of work done). */
  readonly roundCount: number;
  /** True when the last advance() hit its event cap (or `budgetMs`) before reaching the requested time. */
  readonly lagging: boolean;
  /** Simulated time covered by the last advance() divided by the time requested (1 = on time). */
  readonly speed: number;
  /** Numeric strength of a net's value (see `levels`); 0 for an unknown net. */
  strength(net: number): number;
  /** What kind of source holds a net at its value. */
  strengthKind(net: number): StrengthKind;
  /** Two driven signals disagree on this net (a short through transistors or switches). */
  contended(net: number): boolean;
  /**
   * One round. Unit-delay mode: advance to the next pending round (one stage delay). Settle mode:
   * one round at the current instant (for animating how a change settles). Returns false when
   * nothing was pending.
   */
  step(): boolean;
}

/** Strength of a net, if `engine` is a switch-level engine. */
export function netStrength(engine: Engine, net: number): StrengthKind | undefined {
  return isSwitchEngine(engine) ? engine.strengthKind(net) : undefined;
}

export function isSwitchEngine(engine: Engine): engine is SwitchEngine {
  return engine.kind === 'switch' && typeof (engine as Partial<SwitchEngine>).strengthKind === 'function';
}

/** A transistor's size class from its parameters. */
export function transistorSize(params: Params): TransistorSize {
  const s = params.strength;
  if (s === 'weak' || s === 'normal' || s === 'strong') return s;
  const w = Number(params.w ?? params.width);
  if (Number.isFinite(w) && w > 0) return w < 1 ? 'weak' : w >= 2 ? 'strong' : 'normal';
  return 'normal';
}

export function createSwitchEngine(netlist: FlatNetlist, options: SwitchEngineOptions = {}): SwitchEngine {
  return new SwitchEngineImpl(netlist, options);
}

// ─── Internals ───────────────────────────────────────────────────────────────

const MAX_MESSAGES = 500;
const truthy = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';

/** Parse a constant: 0, 1, X (Z reads as X: a floating input). */
function parseLogic(v: unknown, dflt: number): number {
  if (v === undefined || v === '') return dflt;
  if (v === true) return 1;
  if (v === false) return 0;
  const s = String(v).trim().toUpperCase();
  if (s === 'X' || s === 'Z') return VX;
  const n = Number(s);
  return n === 0 || n === 1 ? n : n === 2 || n === 3 ? VX : dflt;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SourceKind = 'ground' | 'rail' | 'toggle' | 'button' | 'const' | 'clock';

interface Source {
  el: number;
  kind: SourceKind;
  net: number;
}

interface Clock {
  el: number;
  net: number;
  /** Tick at which the current train of periods started. */
  origin: number;
  period: number;
  duty: number;
  level: number;
  /** Next edge time (ticks) or Infinity, and the level after it. */
  next: number;
  nextLevel: number;
}

interface Relay {
  el: number;
  a: number;
  b: number;
  /** Links COM–NO and COM–NC. */
  no: number;
  nc: number;
  /** Contact position: 0 released (COM–NC), 1 operated (COM–NO), 2 unknown. */
  pos: number;
  /** Where the contacts are heading and when they get there (Infinity: nothing pending). */
  target: number;
  at: number;
}

const DISPLAY_TYPES = new Set(['indicator', 'probe', 'seven-seg', 'hex-display']);
const IGNORED_TYPES = new Set(['label', 'port']);
const SOURCE_TYPES = new Set(['ground', 'rail', 'toggle', 'button', 'const', 'clock']);

class SwitchEngineImpl implements SwitchEngine {
  readonly kind = 'switch' as const;
  readonly netlist: FlatNetlist;
  readonly mode: SwitchMode;
  readonly levels: StrengthLevels;
  readonly messages: EngineMessage[] = [];
  roundCount = 0;
  lagging = false;
  speed = 1;
  private laggingPosted = false;
  private readonly maxEvents: number;
  private readonly budgetMs: number;

  private readonly setupMessages: EngineMessage[] = [];
  private readonly n: number;
  private readonly elements: FlatElement[];
  private readonly index = new Map<string, number>();

  // Graph (links: transistor channels, resistors, lamps, coils, switch contacts).
  private readonly graph: SwitchGraph;
  private readonly isInput: Uint8Array;
  private readonly inputVal: Uint8Array;
  private readonly linkA: Int32Array;
  private readonly linkB: Int32Array;
  private readonly linkLevel: Uint8Array;
  private readonly linkState: Uint8Array;
  /** Per element: its first link, or −1. */
  private readonly elLink: Int32Array;

  // Transistors.
  private readonly tLink: Int32Array;
  private readonly tGate: Int32Array;
  private readonly tP: Uint8Array;
  private readonly tEl: Int32Array;
  private readonly gatedStart: Int32Array;
  private readonly gatedList: Int32Array;

  // Sources, clocks, relays, lamps.
  private readonly sources: Source[] = [];
  private readonly sourcesOfNet = new Map<number, Source[]>();
  private readonly clocks: Clock[] = [];
  private readonly clockOfEl = new Map<number, Clock>();
  private readonly relays: Relay[] = [];
  private readonly relayOfEl = new Map<number, Relay>();

  // Node state.
  private readonly val: Uint8Array;
  private readonly str: Uint8Array;
  private readonly known: Uint8Array;
  private readonly cont: Uint8Array;
  private readonly solver: ComponentSolver;
  private readonly outVal: Uint8Array;
  private readonly outStr: Uint8Array;
  private readonly outCont: Uint8Array;

  // Pending work.
  private changed: number[] = [];
  private changedFlag: Uint8Array;
  private dirty: number[] = [];
  private dirtyFlag: Uint8Array;
  private readonly visit: Int32Array;
  private gen = 0;
  private readonly comp: number[] = [];
  private readonly stack: number[] = [];

  // Time.
  private now = 0;
  private nextRound = Infinity;
  private readonly unitTicks: number;
  private readonly maxRounds: number;
  private readonly powerUp: 'random' | 'x';
  private readonly seed: number;
  private rng: () => number;
  /** Nodes set to X by the oscillation rule during power-up: never given a random value. */
  private readonly oscillated: Uint8Array;

  private readonly recorders: SwitchRecorder[] = [];
  private readonly watched: Int32Array;
  private watchedChanged = false;

  constructor(netlist: FlatNetlist, options: SwitchEngineOptions) {
    this.netlist = netlist;
    this.mode = options.mode ?? 'settle';
    // A change can legitimately ripple through every node in turn (a long inverter chain), so the
    // default limit grows with the circuit.
    this.maxRounds = Math.max(8, options.maxRounds ?? Math.max(1000, 4 * netlist.netCount));
    this.maxEvents = Math.max(1, options.maxEventsPerAdvance ?? DEFAULT_MAX_EVENTS_PER_ADVANCE);
    this.budgetMs = options.budgetMs && options.budgetMs > 0 ? options.budgetMs : 0;
    this.powerUp = options.powerUp ?? 'random';
    this.seed = options.seed ?? 1;
    this.rng = mulberry32(this.seed);
    const unit = options.unitDelay ?? options.step ?? 1e-9;
    this.unitTicks = Math.max(1, Math.round(unit * TICKS_PER_SECOND));

    const n = (this.n = netlist.netCount);
    this.elements = netlist.elements;
    this.elements.forEach((e, i) => this.index.set(e.id, i));

    // ── Node sizes ──
    // Supply nets have no size; do not let them count as a capacitor size.
    const supplyNet = new Uint8Array(n);
    if (netlist.ground !== undefined && netlist.ground < n) supplyNet[netlist.ground] = 1;
    for (const e of this.elements) if (SOURCE_TYPES.has(e.type) && e.pins[0]! >= 0 && e.pins[0]! < n) supplyNet[e.pins[0]!] = 1;
    const capacitance = new Float64Array(n);
    for (const e of this.elements) {
      if (e.type !== 'capacitor') continue;
      const c = Math.abs(Number(e.params.capacitance));
      for (const p of e.pins) if (p >= 0 && p < n && !supplyNet[p]) capacitance[p] = capacitance[p]! + (Number.isFinite(c) && c > 0 ? c : 1e-12);
    }
    const caps = [...new Set(Array.from(capacitance).filter((c) => c > 0))].sort((a, b) => a - b);
    const SMALL = 1;
    const NORMAL = 2;
    const LARGE = 3;
    const maxCharge = LARGE + Math.max(0, caps.length - 1);
    const WEAK = maxCharge + 1;
    const levels: StrengthLevels = {
      small: SMALL,
      normal: NORMAL,
      large: LARGE,
      maxCharge,
      weak: WEAK,
      transistor: { weak: WEAK + 1, normal: WEAK + 2, strong: WEAK + 3 },
      wire: WEAK + 4,
      supply: WEAK + 5,
    };
    this.levels = levels;
    if (levels.supply > 255) throw new Error('switch engine: too many different capacitor sizes');
    const size = new Uint8Array(n).fill(NORMAL);
    const named = new Map<string, number>();
    netlist.netNames.forEach((name, i) => name !== undefined && !named.has(name) && named.set(name, i));
    for (const [key, s] of Object.entries(options.nodeSize ?? {})) {
      const net = /^\d+$/.test(key) ? Number(key) : named.get(key);
      if (net !== undefined && net < n) size[net] = s === 'small' ? SMALL : s === 'large' ? LARGE : NORMAL;
    }
    for (let i = 0; i < n; i++) if (capacitance[i]! > 0) size[i] = LARGE + caps.indexOf(capacitance[i]!);

    // ── Elements → links, transistors, sources ──
    this.isInput = new Uint8Array(n);
    this.inputVal = new Uint8Array(n).fill(VX);
    const la: number[] = [];
    const lb: number[] = [];
    const lLevel: number[] = [];
    const lState: number[] = [];
    const addLink = (a: number, b: number, level: number, state: number) => {
      la.push(a);
      lb.push(b);
      lLevel.push(level);
      lState.push(state);
      return la.length - 1;
    };
    this.elLink = new Int32Array(this.elements.length).fill(-1);
    const tLink: number[] = [];
    const tGate: number[] = [];
    const tP: number[] = [];
    const tEl: number[] = [];
    const unsupported = new Set<string>();
    const pin = (e: FlatElement, name: string, fallback: number) => {
      const i = e.pinNames.indexOf(name);
      return e.pins[i >= 0 ? i : fallback] ?? -1;
    };
    const addSource = (el: number, kind: SourceKind, net: number) => {
      if (net < 0 || net >= n) return;
      const s: Source = { el, kind, net };
      this.sources.push(s);
      const list = this.sourcesOfNet.get(net) ?? [];
      list.push(s);
      this.sourcesOfNet.set(net, list);
      this.isInput[net] = 1;
    };
    if (netlist.ground !== undefined) addSource(-1, 'ground', netlist.ground);

    this.elements.forEach((e, i) => {
      switch (e.type) {
        case 'nmos':
        case 'pmos': {
          const l = addLink(pin(e, 'D', e.type === 'nmos' ? 1 : 2), pin(e, 'S', e.type === 'nmos' ? 2 : 1), levels.transistor[transistorSize(e.params)], VX);
          this.elLink[i] = l;
          tLink.push(l);
          tGate.push(pin(e, 'G', 0));
          tP.push(e.type === 'pmos' ? 1 : 0);
          tEl.push(i);
          break;
        }
        case 'resistor':
        case 'lamp':
          this.elLink[i] = addLink(e.pins[0]!, e.pins[1]!, WEAK, ON);
          break;
        case 'switch':
        case 'pushbutton':
          this.elLink[i] = addLink(e.pins[0]!, e.pins[1]!, levels.wire, OFF);
          break;
        case 'spdt':
          this.elLink[i] = addLink(pin(e, 'C', 0), pin(e, '0', 1), levels.wire, OFF);
          addLink(pin(e, 'C', 0), pin(e, '1', 2), levels.wire, OFF);
          break;
        case 'relay': {
          const a = pin(e, 'A', 0);
          const b = pin(e, 'B', 1);
          this.elLink[i] = addLink(a, b, WEAK, ON);
          const no = addLink(pin(e, 'COM', 3), pin(e, 'NO', 2), levels.wire, OFF);
          const nc = addLink(pin(e, 'COM', 3), pin(e, 'NC', 4), levels.wire, ON);
          const r: Relay = { el: i, a, b, no, nc, pos: 0, target: 0, at: Infinity };
          this.relays.push(r);
          this.relayOfEl.set(i, r);
          break;
        }
        case 'ground':
          addSource(i, 'ground', e.pins[0]!);
          break;
        case 'rail':
        case 'toggle':
        case 'button':
        case 'const':
        case 'clock':
          addSource(i, e.type, e.pins[0]!);
          if (e.type === 'clock') {
            const c: Clock = { el: i, net: e.pins[0]!, origin: 0, period: 0, duty: 0.5, level: 0, next: Infinity, nextLevel: 1 };
            this.clocks.push(c);
            this.clockOfEl.set(i, c);
          }
          break;
        case 'capacitor':
          break; // only makes its nets large (DC: an open circuit)
        default:
          if (!DISPLAY_TYPES.has(e.type) && !IGNORED_TYPES.has(e.type)) unsupported.add(e.type);
      }
    });
    for (const t of unsupported) {
      const ids = this.elements.filter((e) => e.type === t).map((e) => e.id);
      this.setupMessages.push({
        level: 'warning',
        text: `The switch-level engine does not simulate "${t}" (${ids.slice(0, 3).join(', ')}${ids.length > 3 ? ', …' : ''}); it is left out.`,
        element: ids[0],
        time: 0,
      });
    }

    const L = la.length;
    this.linkA = Int32Array.from(la);
    this.linkB = Int32Array.from(lb);
    this.linkLevel = Uint8Array.from(lLevel);
    this.linkState = Uint8Array.from(lState);
    // Adjacency (CSR). Links with a bad or repeated end are left out.
    const deg = new Int32Array(n + 1);
    const okLink = (l: number) => {
      const a = this.linkA[l]!;
      const b = this.linkB[l]!;
      return a >= 0 && b >= 0 && a < n && b < n && a !== b;
    };
    for (let l = 0; l < L; l++) {
      if (!okLink(l)) continue;
      deg[this.linkA[l]! + 1] = deg[this.linkA[l]! + 1]! + 1;
      deg[this.linkB[l]! + 1] = deg[this.linkB[l]! + 1]! + 1;
    }
    for (let i = 0; i < n; i++) deg[i + 1] = deg[i + 1]! + deg[i]!;
    const adjStart = Int32Array.from(deg);
    const adjLink = new Int32Array(deg[n]!);
    const fill = adjStart.slice(0, n);
    for (let l = 0; l < L; l++) {
      if (!okLink(l)) continue;
      adjLink[fill[this.linkA[l]!]!++] = l;
      adjLink[fill[this.linkB[l]!]!++] = l;
    }

    this.tLink = Int32Array.from(tLink);
    this.tGate = Int32Array.from(tGate);
    this.tP = Uint8Array.from(tP);
    this.tEl = Int32Array.from(tEl);
    const gd = new Int32Array(n + 1);
    for (const g of tGate) if (g >= 0 && g < n) gd[g + 1] = gd[g + 1]! + 1;
    for (let i = 0; i < n; i++) gd[i + 1] = gd[i + 1]! + gd[i]!;
    this.gatedStart = Int32Array.from(gd);
    this.gatedList = new Int32Array(gd[n]!);
    const gf = this.gatedStart.slice(0, n);
    tGate.forEach((g, t) => {
      if (g >= 0 && g < n) this.gatedList[gf[g]!++] = t;
    });

    this.graph = {
      n,
      isInput: this.isInput,
      size,
      adjStart,
      adjLink,
      linkA: this.linkA,
      linkB: this.linkB,
      linkLevel: this.linkLevel,
      linkState: this.linkState,
    };
    this.val = new Uint8Array(n);
    this.str = new Uint8Array(n);
    this.known = new Uint8Array(n);
    this.cont = new Uint8Array(n);
    this.outVal = new Uint8Array(n);
    this.outStr = new Uint8Array(n);
    this.outCont = new Uint8Array(n);
    this.changedFlag = new Uint8Array(n);
    this.dirtyFlag = new Uint8Array(n);
    this.visit = new Int32Array(n);
    this.oscillated = new Uint8Array(n);
    this.watched = new Int32Array(n);
    this.solver = new ComponentSolver(this.graph, levels.supply, levels.transistor.weak);

    this.reset();
  }

  get time(): number {
    return this.now / TICKS_PER_SECOND;
  }

  // ─── Engine API ────────────────────────────────────────────────────────────

  reset(): void {
    const n = this.n;
    this.now = 0;
    this.lagging = false;
    this.speed = 1;
    this.laggingPosted = false;
    this.nextRound = Infinity;
    this.messages.length = 0;
    this.messages.push(...this.setupMessages);
    this.rng = mulberry32(this.seed);
    this.val.fill(VX);
    this.known.fill(0);
    this.cont.fill(0);
    this.oscillated.fill(0);
    this.str.set(this.graph.size);
    this.changed = [];
    this.changedFlag.fill(0);
    this.dirty = [];
    this.dirtyFlag.fill(0);

    for (const c of this.clocks) this.resetClock(c);
    for (let i = 0; i < n; i++) {
      if (!this.isInput[i]) continue;
      this.val[i] = this.inputVal[i] = this.sourceValue(i, true);
      this.str[i] = this.levels.supply;
      this.known[i] = 1;
    }
    for (const r of this.relays) {
      r.pos = 0;
      r.target = 0;
      r.at = Infinity;
      this.linkState[r.no] = OFF;
      this.linkState[r.nc] = ON;
    }
    this.elements.forEach((e, i) => this.applySwitchParams(i, e, false));
    for (let t = 0; t < this.tLink.length; t++) this.linkState[this.tLink[t]!] = this.gateState(t);
    for (let i = 0; i < n; i++) if (!this.isInput[i]) this.markDirty(i);

    // Power-up: settle from all-X, then break X feedback loops one node at a time.
    this.powerUpRounds();
    if (this.powerUp === 'random') {
      for (let i = 0; i < n; i++) {
        if (this.isInput[i] || this.oscillated[i] || this.val[i] !== VX || this.str[i]! <= this.levels.maxCharge) continue;
        this.oscillated[i] = 1; // tried
        this.val[i] = this.rng() < 0.5 ? V0 : V1;
        this.markChanged(i);
        this.powerUpRounds();
        // Let the node's own drivers have their say (an X input feeding it keeps it X).
        this.markDirty(i);
        this.powerUpRounds();
      }
    }
    this.checkRelays();
    if (this.mode === 'unit-delay' && this.pending()) this.nextRound = this.unitTicks;
    for (const r of this.recorders) {
      r.clear();
      r.push(this.now, (net) => this.logic(net));
    }
    this.watchedChanged = false;
  }

  advance(dt: number): void {
    if (this.mode === 'settle') this.settleNow();
    if (!(dt > 0)) return;
    this.lagging = false;
    const start = this.now;
    const target = start + Math.round(dt * TICKS_PER_SECOND);
    this.advanceTo(target, this.maxEvents, this.budgetMs);
    this.speed = target > start ? (this.now - start) / (target - start) : 1;
    if (this.lagging && !this.laggingPosted) {
      this.laggingPosted = true;
      this.message('info', 'The circuit has more events than a frame allows: the simulation is running slower than real time.');
    }
  }

  /**
   * Process instants up to `target` (ticks), at most `maxEvents` events or `budgetMs` of real time; the
   * caps are checked between instants and at least one instant is processed. Stopping early sets
   * `lagging` and leaves `now` at the last instant processed.
   */
  private advanceTo(target: number, maxEvents: number, budgetMs: number): void {
    const deadline = budgetMs ? performance.now() + budgetMs : Infinity;
    let events = 0;
    let instants = 0;
    for (;;) {
      let t = this.nextRound;
      for (const c of this.clocks) if (c.next < t) t = c.next;
      for (const r of this.relays) if (r.at < t) t = r.at;
      if (t > target) break;
      if (instants > 0 && (events >= maxEvents || (deadline !== Infinity && (instants & 7) === 0 && performance.now() > deadline))) {
        this.lagging = true;
        return;
      }
      const rounds = this.roundCount;
      this.now = t;
      if (this.nextRound === t) this.unitRound();
      for (const c of this.clocks) if (c.next === t) this.clockEdge(c);
      for (const r of this.relays) if (r.at === t) this.relayMove(r);
      this.afterInputChange();
      instants++;
      events += 1 + this.roundCount - rounds;
    }
    this.now = target;
  }

  settle(): void {
    if (this.mode === 'settle') {
      this.settleNow();
      return;
    }
    // Unit-delay: run the pending rounds (time moves on by one delay per round) until quiet. Not part of an
    // advance() call: its allowance does not apply (the loop is bounded by maxRounds).
    for (let k = 0; k < this.maxRounds && this.nextRound < Infinity; k++) this.advanceTo(this.nextRound, Infinity, 0);
  }

  step(): boolean {
    if (this.mode === 'unit-delay') {
      if (this.nextRound === Infinity) return false;
      this.advanceTo(this.nextRound, Infinity, 0);
      return true;
    }
    if (!this.pending()) return false;
    this.round();
    this.flushRecorders();
    return true;
  }

  logic(net: number): Logic {
    if (!(net >= 0 && net < this.n)) return LZ;
    const v = this.val[net]!;
    if (v === VX && !this.known[net] && this.str[net]! <= this.levels.maxCharge) return LZ;
    return v as Logic;
  }

  voltage(net: number): number {
    const v = this.logic(net);
    return v === 1 ? 5 : v === 0 ? 0 : NaN;
  }

  current(): number {
    return 0;
  }

  strength(net: number): number {
    return net >= 0 && net < this.n ? this.str[net]! : 0;
  }

  strengthKind(net: number): StrengthKind {
    if (!(net >= 0 && net < this.n)) return 'floating';
    if (this.isInput[net]) return 'supply';
    const s = this.str[net]!;
    const lv = this.levels;
    if (s >= lv.supply) return 'supply';
    if (s > lv.weak) return 'driven';
    if (s === lv.weak) return 'weak';
    return this.logic(net) === LZ ? 'floating' : 'charged';
  }

  contended(net: number): boolean {
    return this.cont[net] === 1;
  }

  state(id: string): ElementState {
    const i = this.index.get(id);
    if (i === undefined) return {};
    const e = this.elements[i]!;
    const p = e.params;
    const v = (k: number) => this.logic(e.pins[k] ?? -1);
    switch (e.type) {
      case 'nmos':
      case 'pmos': {
        const st = this.linkState[this.elLink[i]!]!;
        return { on: st === ON ? 1 : st === OFF ? 0 : 2, size: transistorSize(p) };
      }
      case 'switch':
        return { closed: truthy(p.closed) };
      case 'pushbutton':
        return { closed: truthy(p.pressed), pressed: truthy(p.pressed) };
      case 'spdt':
        return { throw: Number(p.throw) === 1 ? 1 : 0 };
      case 'relay': {
        const r = this.relayOfEl.get(i)!;
        const a = this.val[r.a]!;
        const b = this.val[r.b]!;
        const s: ElementState = { energised: a < 2 && b < 2 && a !== b, closed: r.pos === 1, throw: r.pos === 1 ? 1 : 0 };
        if (r.pos === 2) s.unknown = true;
        return s;
      }
      case 'lamp': {
        const a = v(0);
        const b = v(1);
        return { brightness: a < 2 && b < 2 && a !== b ? 1 : 0 };
      }
      case 'toggle':
        return { on: truthy(p.on), value: v(0) };
      case 'button':
        return { pressed: truthy(p.pressed), value: v(0) };
      case 'const':
      case 'rail':
        return { value: v(0) };
      case 'clock':
        return { value: v(0), frequency: Number(p.frequency) };
      case 'indicator': {
        const x = v(0);
        return { lit: x === 1, brightness: x === 1 ? 1 : 0, value: x };
      }
      case 'probe':
        return { value: v(0) };
      case 'seven-seg': {
        let segments = 0;
        let unknown = false;
        e.pins.forEach((_, k) => {
          const x = v(k);
          if (x === 1) segments |= 1 << k;
          else if (x !== 0) unknown = true;
        });
        return { segments, unknown };
      }
      case 'hex-display': {
        let value: number | undefined = 0;
        e.pins.forEach((_, k) => {
          const x = v(k);
          if (value === undefined) return;
          if (x > 1) value = undefined;
          else value += x << k;
        });
        return { value };
      }
      default:
        return {};
    }
  }

  setParam(id: string, key: string, value: ParamValue): void {
    const i = this.index.get(id);
    if (i === undefined) return;
    const e = this.elements[i]!;
    e.params[key] = value;
    switch (e.type) {
      case 'toggle':
      case 'button':
      case 'const':
      case 'rail':
        this.updateInput(e.pins[0]!);
        break;
      case 'clock': {
        const c = this.clockOfEl.get(i)!;
        if (key === 'frequency' || key === 'duty') this.retimeClock(c);
        break;
      }
      case 'switch':
      case 'pushbutton':
      case 'spdt':
        this.applySwitchParams(i, e, true);
        break;
      case 'nmos':
      case 'pmos':
        if (key === 'strength' || key === 'w' || key === 'width') {
          const l = this.elLink[i]!;
          this.linkLevel[l] = this.levels.transistor[transistorSize(e.params)];
          this.markLink(l);
        }
        break;
    }
    this.afterInputChange();
  }

  watch(nets: number[]): Recorder {
    const r = new SwitchRecorder(nets, () => this.now, (rec) => {
      const k = this.recorders.indexOf(rec);
      if (k < 0) return;
      this.recorders.splice(k, 1);
      for (const net of rec.nets) if (net >= 0 && net < this.n) this.watched[net] = this.watched[net]! - 1;
    });
    for (const net of r.nets) if (net >= 0 && net < this.n) this.watched[net] = this.watched[net]! + 1;
    this.recorders.push(r);
    r.push(this.now, (net) => this.logic(net));
    return r;
  }

  // ─── Rounds ────────────────────────────────────────────────────────────────

  private pending(): boolean {
    return this.changed.length > 0 || this.dirty.length > 0;
  }

  private markChanged(net: number): void {
    if (this.changedFlag[net]) return;
    this.changedFlag[net] = 1;
    this.changed.push(net);
  }

  private markDirty(net: number): void {
    if (net < 0 || net >= this.n || this.isInput[net] || this.dirtyFlag[net]) return;
    this.dirtyFlag[net] = 1;
    this.dirty.push(net);
  }

  /** A link changed state or strength: re-solve the nodes at both ends. */
  private markLink(l: number): void {
    this.markDirty(this.linkA[l]!);
    this.markDirty(this.linkB[l]!);
  }

  private gateState(t: number): number {
    const g = this.tGate[t]!;
    const v = g >= 0 && g < this.n ? this.val[g]! : VX;
    if (v === VX) return MAYBE;
    return (v === V1) !== (this.tP[t] === 1) ? ON : OFF;
  }

  /**
   * One round: transistors whose gate changed switch; then every component touched is solved
   * again. Nodes that change feed the next round.
   */
  private round(): void {
    this.roundCount++;
    const changed = this.changed;
    this.changed = [];
    for (const g of changed) {
      this.changedFlag[g] = 0;
      for (let k = this.gatedStart[g]!; k < this.gatedStart[g + 1]!; k++) {
        const t = this.gatedList[k]!;
        const st = this.gateState(t);
        const l = this.tLink[t]!;
        if (st !== this.linkState[l]) {
          this.linkState[l] = st;
          this.markLink(l);
        }
      }
    }
    const dirty = this.dirty;
    this.dirty = [];
    for (const d of dirty) this.dirtyFlag[d] = 0;
    for (const d of dirty) {
      if (this.visit[d] === this.gen + 1) continue;
      this.solveComponentOf(d);
    }
    this.gen++;
    if (this.relays.length) this.checkRelays();
  }

  /** Collect the component containing `start` (through ON and MAYBE links, not crossing inputs) and solve it. */
  private solveComponentOf(start: number): void {
    const g = this.graph;
    const mark = this.gen + 1;
    const comp = this.comp;
    const stack = this.stack;
    comp.length = 0;
    stack.length = 0;
    stack.push(start);
    this.visit[start] = mark;
    let hasMaybe = false;
    while (stack.length) {
      const n = stack.pop()!;
      comp.push(n);
      for (let k = g.adjStart[n]!; k < g.adjStart[n + 1]!; k++) {
        const l = g.adjLink[k]!;
        const st = this.linkState[l]!;
        if (st === OFF) continue;
        if (st === MAYBE) hasMaybe = true;
        const m = this.linkA[l] === n ? this.linkB[l]! : this.linkA[l]!;
        if (this.isInput[m] || this.visit[m] === mark) continue;
        this.visit[m] = mark;
        stack.push(m);
      }
    }
    this.solver.solve(comp, this.val, hasMaybe, this.outVal, this.outStr, this.outCont);
    const maxCharge = this.levels.maxCharge;
    for (const n of comp) {
      const v = this.outVal[n]!;
      const s = this.outStr[n]!;
      this.str[n] = s;
      this.cont[n] = this.outCont[n]!;
      const wasKnown = this.known[n];
      if (v !== VX || s > maxCharge) this.known[n] = 1;
      if (v !== this.val[n]) {
        this.val[n] = v;
        this.markChanged(n);
        if (this.watched[n]) this.watchedChanged = true;
      } else if (wasKnown !== this.known[n] && this.watched[n]) this.watchedChanged = true;
    }
  }

  /** Settle mode: rounds at this instant until quiet; oscillating nodes become X. */
  private settleNow(): void {
    let rounds = 0;
    let phases = 0;
    while (this.pending()) {
      if (rounds >= this.maxRounds) {
        if (phases >= 8) {
          this.message('error', `The circuit still has not settled after ${phases * this.maxRounds} rounds; simulation of this instant was stopped.`);
          break;
        }
        phases++;
        rounds = 0;
        const osc = this.changed.filter((x) => !this.isInput[x]);
        for (const x of osc) {
          this.val[x] = VX;
          this.oscillated[x] = 1;
          if (this.watched[x]) this.watchedChanged = true;
        }
        const names = osc.slice(0, 4).map((x) => this.netlist.netNames[x] ?? `net ${x}`);
        this.message(
          'error',
          `The circuit does not settle: it oscillates (${osc.length} node${osc.length === 1 ? '' : 's'} still changing after ${this.maxRounds} rounds: ${names.join(', ')}${osc.length > 4 ? ', …' : ''}). They are shown as X; unit-delay mode shows the oscillation.`,
        );
      }
      this.round();
      rounds++;
      this.flushRecorders();
    }
  }

  /** Unit-delay mode: one round at this instant, then schedule the next one a delay later. */
  private unitRound(): void {
    this.round();
    this.flushRecorders();
    this.nextRound = this.pending() ? this.now + this.unitTicks : Infinity;
  }

  private powerUpRounds(): void {
    if (this.mode === 'settle') {
      this.settleNow();
      return;
    }
    for (let k = 0; k < this.maxRounds && this.pending(); k++) this.round();
  }

  /** After inputs, clocks, switches or contacts changed at this instant. */
  private afterInputChange(): void {
    if (this.mode === 'settle') this.settleNow();
    else if (this.pending() && this.nextRound === Infinity) this.nextRound = this.now + this.unitTicks;
    this.flushRecorders();
  }

  private flushRecorders(): void {
    if (!this.watchedChanged) return;
    this.watchedChanged = false;
    for (const r of this.recorders) r.push(this.now, (net) => this.logic(net));
  }

  private message(level: EngineMessage['level'], text: string, element?: string): void {
    const last = this.messages[this.messages.length - 1];
    if (last && last.text === text) return;
    if (this.messages.length >= MAX_MESSAGES) return;
    this.messages.push({ level, text, element, time: this.time });
  }

  // ─── Inputs ────────────────────────────────────────────────────────────────

  /** Value a net's sources give it (disagreeing sources: X, with a warning). */
  private sourceValue(net: number, quiet = false): number {
    const list = this.sourcesOfNet.get(net) ?? [];
    let v = -1;
    for (const s of list) {
      const x = this.sourceOf(s);
      v = v < 0 ? x : v === x ? v : VX;
    }
    if (v === VX && list.length > 1 && !quiet) {
      this.message('warning', `Short circuit: ${list.map((s) => (s.el < 0 ? 'ground' : this.elements[s.el]!.id)).join(', ')} drive the same net with different values.`);
    }
    return v < 0 ? VX : v;
  }

  private sourceOf(s: Source): number {
    if (s.el < 0 || s.kind === 'ground') return V0;
    const p = this.elements[s.el]!.params;
    switch (s.kind) {
      case 'rail':
        return Number(p.voltage ?? 5) > 0 ? V1 : V0;
      case 'toggle':
        return truthy(p.on) ? V1 : V0;
      case 'button':
        return truthy(p.pressed) ? V1 : V0;
      case 'const':
        return parseLogic(p.value, 1);
      case 'clock':
        return this.clockOfEl.get(s.el)!.level;
    }
  }

  private updateInput(net: number): void {
    if (net < 0 || net >= this.n || !this.isInput[net]) return;
    const v = this.sourceValue(net);
    if (v === this.inputVal[net]) return;
    this.inputVal[net] = v;
    this.val[net] = v;
    this.markChanged(net);
    if (this.watched[net]) this.watchedChanged = true;
    // Components next to this supply see a new source value.
    const g = this.graph;
    for (let k = g.adjStart[net]!; k < g.adjStart[net + 1]!; k++) {
      const l = g.adjLink[k]!;
      if (this.linkState[l] === OFF) continue;
      this.markDirty(this.linkA[l] === net ? this.linkB[l]! : this.linkA[l]!);
    }
  }

  private setLinkState(l: number, st: number, mark: boolean): void {
    if (l < 0 || this.linkState[l] === st) return;
    this.linkState[l] = st;
    if (mark) this.markLink(l);
  }

  /** Switch contacts from their parameters. */
  private applySwitchParams(i: number, e: FlatElement, mark: boolean): void {
    const l = this.elLink[i]!;
    if (e.type === 'switch') this.setLinkState(l, truthy(e.params.closed) ? ON : OFF, mark);
    else if (e.type === 'pushbutton') this.setLinkState(l, truthy(e.params.pressed) ? ON : OFF, mark);
    else if (e.type === 'spdt') {
      const one = Number(e.params.throw) === 1 || e.params.throw === '1';
      this.setLinkState(l, one ? OFF : ON, mark);
      this.setLinkState(l + 1, one ? ON : OFF, mark);
    }
  }

  // ─── Clocks ────────────────────────────────────────────────────────────────

  private readClock(c: Clock): void {
    const p = this.elements[c.el]!.params;
    const f = Number(p.frequency);
    c.period = f > 0 && Number.isFinite(f) ? TICKS_PER_SECOND / f : 0;
    const d = Number(p.duty ?? 0.5);
    c.duty = Number.isFinite(d) ? Math.min(0.99, Math.max(0.01, d)) : 0.5;
  }

  private resetClock(c: Clock): void {
    this.readClock(c);
    c.origin = 0;
    c.level = 0;
    this.scheduleClock(c);
  }

  /**
   * The output is 0 at the start of each period and rises after (1 − duty) of it, so with the
   * default duty the first rising edge is at T/2 (as in the digital engine).
   */
  private scheduleClock(c: Clock): void {
    const T = c.period;
    if (!(T > 0)) {
      c.next = Infinity;
      return;
    }
    const k0 = Math.floor((this.now - c.origin) / T);
    let best = Infinity;
    let level = 1;
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const rise = Math.round(c.origin + (k + 1 - c.duty) * T);
      const fall = Math.round(c.origin + (k + 1) * T);
      if (rise > this.now && rise < best) {
        best = rise;
        level = 1;
      }
      if (fall > this.now && fall < best) {
        best = fall;
        level = 0;
      }
    }
    c.next = best;
    c.nextLevel = level;
  }

  private clockEdge(c: Clock): void {
    c.level = c.nextLevel;
    this.updateInput(c.net);
    this.scheduleClock(c);
  }

  private retimeClock(c: Clock): void {
    const oldT = c.period;
    let phase = oldT > 0 ? ((this.now - c.origin) / oldT) % 1 : c.level ? 1 - c.duty : 0;
    if (phase < 0) phase += 1;
    this.readClock(c);
    if (c.period > 0) {
      c.origin = this.now - phase * c.period;
      const level = phase >= 1 - c.duty ? 1 : 0;
      if (level !== c.level) {
        c.level = level;
        this.updateInput(c.net);
      }
    }
    this.scheduleClock(c);
  }

  // ─── Relays ────────────────────────────────────────────────────────────────

  /** Coil energised when its ends are at different known values; contacts follow after operateTime. */
  private checkRelays(): void {
    for (const r of this.relays) {
      const a = r.a >= 0 ? this.val[r.a]! : VX;
      const b = r.b >= 0 ? this.val[r.b]! : VX;
      const want = a === VX || b === VX ? 2 : a !== b ? 1 : 0;
      if (want === r.pos) {
        r.at = Infinity;
        r.target = want;
      } else if (want !== r.target || r.at === Infinity) {
        const op = Number(this.elements[r.el]!.params.operateTime);
        r.target = want;
        r.at = this.now + Math.max(1, Math.round((Number.isFinite(op) && op > 0 ? op : 0.005) * TICKS_PER_SECOND));
      }
    }
  }

  private relayMove(r: Relay): void {
    r.pos = r.target;
    r.at = Infinity;
    this.setLinkState(r.no, r.pos === 1 ? ON : r.pos === 2 ? MAYBE : OFF, true);
    this.setLinkState(r.nc, r.pos === 0 ? ON : r.pos === 2 ? MAYBE : OFF, true);
  }
}
