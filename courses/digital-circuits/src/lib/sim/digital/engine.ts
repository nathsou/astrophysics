import type { ElementState, Engine, EngineMessage, EngineOptions, Recorder } from '../engine';
import type { FlatElement, FlatNetlist, Logic, ParamValue } from '../netlist/types';
import { LX, LZ } from '../netlist/types';
import { getDef, pinsOf } from '../netlist/catalog';
import { getDigitalModel, nsToTicks, TICKS_PER_SECOND, type DigitalModel, type DigitalSim, type ModelInit, type PinDir } from './model';
import { EventQueue } from './queue';
import { DigitalRecorder } from './recorder';
import './models';

/**
 * The event-driven digital engine.
 *
 * - Nets carry 0, 1, X (2) or Z (3). Every output pin is a *driver*; a net's value is the
 *   resolution of its drivers: Z yields to any driven value, disagreeing drivers (0 against 1) or
 *   any X give X. A net nobody drives is Z. The ground net is driven 0 by the engine.
 * - Time is an integer number of picoseconds (see model.ts). Output changes are events in a binary
 *   heap; events at the same time are processed in delta cycles: first every change due now is
 *   applied to its net, then every element whose inputs changed is evaluated, which may schedule
 *   zero-delay changes for the next delta cycle.
 * - Inertial delay by default (a new output value cancels the pending ones, so pulses shorter than
 *   the delay vanish), transport delay as an option.
 * - A zero-delay loop that is still changing after `maxDeltaCycles` delta cycles at one time is
 *   reported as an error, and the outputs of the elements involved are forced to X.
 * - Power-up (construction and reset()): every output starts at X; storage elements then drive
 *   their `init` value, sources their parameter, and every element is evaluated once at t = 0.
 *   Feedback loops of combinational gates (rings of inverters, latches built from gates) would
 *   stay X for ever, which is not what hardware does: with `powerUp: 'random'` (the default) the
 *   engine walks each loop once and gives every output that is still X a consistent value, picking
 *   a seeded random bit where the inputs do not decide it. An odd ring then oscillates with one
 *   travelling edge, an even ring or a latch settles in one of its stable states.
 */

export type DelayModel = 'inertial' | 'transport';

export type DigitalEngineOptions = EngineOptions & {
  /** 'inertial' (default) swallows pulses shorter than a gate's delay; 'transport' passes them. */
  delayModel?: DelayModel;
  /** Start feedback loops of gates in a random consistent state ('random', default) or leave them X. */
  powerUp?: 'random' | 'x';
  /** Delta cycles at one time point before a zero-delay loop is declared unsettled (default 10 000). */
  maxDeltaCycles?: number;
};

/** The digital engine's extras beyond the Engine interface. */
export interface DigitalEngine extends Engine {
  readonly kind: 'digital';
  readonly delayModel: DelayModel;
  /** Events processed since construction (output changes and wake-ups that were not cancelled). */
  readonly eventCount: number;
  /** Contents of a RAM or ROM element (the live array: read it, or change it with writeMemory). */
  memory(id: string): Uint8Array | Uint32Array | undefined;
  /** Write one word of a RAM or ROM element and update its outputs. */
  writeMemory(id: string, address: number, value: number): void;
  /** Two drivers disagree on this net right now (drawn as contention). */
  contended(net: number): boolean;
}

const NONE = 255;
const MAX_MESSAGES = 500;

class DigitalEngineImpl implements DigitalEngine, DigitalSim {
  readonly kind = 'digital' as const;
  readonly netlist: FlatNetlist;
  readonly messages: EngineMessage[] = [];
  /** Messages about the netlist itself (kept across resets). */
  private readonly setupMessages: EngineMessage[] = [];
  readonly delayModel: DelayModel;
  readonly defaultDelay: number;
  /** Net values. */
  readonly nets: Uint8Array;
  /** Current time in ticks. */
  now = 0;
  eventCount = 0;

  private readonly inertial: boolean;
  private readonly seed: number;
  private rng = 0;
  private readonly powerUpMode: 'random' | 'x';
  private readonly maxDeltas: number;

  private readonly elements: FlatElement[];
  private readonly models: (DigitalModel | undefined)[];
  private readonly index = new Map<string, number>();
  /** Driver slots of element e are outStart[e] … outStart[e + 1] − 1. */
  private readonly outStart: Int32Array;

  // Drivers.
  private readonly drvNet: Int32Array;
  private readonly drvElem: Int32Array;
  private readonly drvValue: Uint8Array;
  private readonly drvSerial: Int32Array;
  private readonly drvPending: Int32Array;
  private readonly drvPendVal: Uint8Array;
  private readonly groundSlot: number;

  // Nets: drivers and fan-out in compressed rows.
  private readonly netDrvStart: Int32Array;
  private readonly netDrvList: Int32Array;
  private readonly netFanStart: Int32Array;
  private readonly netFanList: Int32Array;
  /** Bit 0: contention. */
  private readonly netFlags: Uint8Array;
  private readonly watched: Uint16Array;
  private readonly recorders: DigitalRecorder[] = [];

  // Evaluation lists.
  private readonly dirty: Uint8Array;
  private dirtyList: Int32Array;
  private dirtyList2: Int32Array;
  private dirtyCount = 0;
  private readonly wakeSerial: Int32Array;
  private readonly wakeElem: Int32Array;
  private readonly wakeTag: Int32Array;
  private wakeCount = 0;

  private readonly queue = new EventQueue();

  // Power-up of feedback loops.
  private capturing = false;
  private readonly capVal: Uint8Array;
  private loops: number[][] | undefined;
  /** Elements evaluated in the last delta cycles before a runaway zero-delay loop is declared. */
  private loopSuspects: Set<number> | undefined;

  constructor(netlist: FlatNetlist, options: DigitalEngineOptions = {}) {
    this.netlist = netlist;
    this.delayModel = options.delayModel ?? 'inertial';
    this.inertial = this.delayModel === 'inertial';
    this.defaultDelay = options.step !== undefined && options.step >= 0 ? Math.round(options.step * TICKS_PER_SECOND) : nsToTicks(1);
    this.seed = (options.seed ?? 0x5eed) | 0;
    this.powerUpMode = options.powerUp ?? 'random';
    this.maxDeltas = Math.max(16, options.maxDeltaCycles ?? 10_000);

    const netCount = netlist.netCount;
    this.nets = new Uint8Array(netCount);
    this.elements = netlist.elements;
    const E = this.elements.length;

    // Pin directions and driver slots.
    const drvNet: number[] = [];
    const drvElem: number[] = [];
    const fanPairs: number[] = []; // net, element
    const outStart = new Int32Array(E + 1);
    const inits: { init: ModelInit; reg: ReturnType<typeof getDigitalModel> }[] = [];
    this.elements.forEach((el, e) => {
      if (this.index.has(el.id)) this.message('warning', `Two elements are called ${el.id}.`, el.id);
      this.index.set(el.id, e);
      outStart[e] = drvNet.length;
      const reg = getDigitalModel(el.type);
      const dirs = pinDirections(el, reg?.pinDirs);
      const slots = new Int32Array(el.pins.length).fill(-1);
      el.pins.forEach((net, i) => {
        if (dirs[i] !== 'in') {
          slots[i] = drvNet.length;
          drvNet.push(net);
          drvElem.push(e);
        }
      });
      const nets = Int32Array.from(el.pins);
      const init: ModelInit = {
        element: el,
        index: e,
        nets,
        slots,
        pin: (name) => el.pinNames.indexOf(name),
        defaultDelay: this.defaultDelay,
      };
      inits.push({ init, reg });
      // Fan-out is added once the model is known (models without evaluate() need none).
      el.pins.forEach((net, i) => {
        if (dirs[i] !== 'out') fanPairs.push(net, e);
      });
    });
    outStart[E] = drvNet.length;
    this.groundSlot = netlist.ground !== undefined ? drvNet.length : -1;
    if (netlist.ground !== undefined) {
      drvNet.push(netlist.ground);
      drvElem.push(-1);
    }
    this.outStart = outStart;
    const D = drvNet.length;
    this.drvNet = Int32Array.from(drvNet);
    this.drvElem = Int32Array.from(drvElem);
    this.drvValue = new Uint8Array(D);
    this.drvSerial = new Int32Array(D);
    this.drvPending = new Int32Array(D);
    this.drvPendVal = new Uint8Array(D).fill(NONE);
    this.capVal = new Uint8Array(D);

    // Models.
    this.models = inits.map(({ init, reg }) => {
      const el = init.element;
      if (!reg) {
        const def = getDef(el.type);
        this.message('warning', `${def?.name ?? el.type} ${el.id} cannot be simulated at the logic level; it is left out.`, el.id);
        return undefined;
      }
      try {
        return reg.factory(init);
      } catch (err) {
        this.message('error', `${el.id}: ${(err as Error).message}`, el.id);
        return undefined;
      }
    });

    // Net → drivers.
    this.netDrvStart = new Int32Array(netCount + 1);
    for (let d = 0; d < D; d++) this.netDrvStart[this.drvNet[d]! + 1]!++;
    for (let n = 0; n < netCount; n++) this.netDrvStart[n + 1] = this.netDrvStart[n + 1]! + this.netDrvStart[n]!;
    this.netDrvList = new Int32Array(D);
    {
      const fill = this.netDrvStart.slice(0, netCount);
      for (let d = 0; d < D; d++) this.netDrvList[fill[this.drvNet[d]!]!++] = d;
    }
    // Net → elements to evaluate (each element once per net).
    const fan: number[][] = Array.from({ length: netCount }, () => []);
    for (let i = 0; i < fanPairs.length; i += 2) {
      const n = fanPairs[i]!;
      const e = fanPairs[i + 1]!;
      if (!this.models[e]?.evaluate) continue;
      const list = fan[n]!;
      // Pairs come in element order, so an element's repeats on one net are adjacent.
      if (list[list.length - 1] !== e) list.push(e);
    }
    this.netFanStart = new Int32Array(netCount + 1);
    for (let n = 0; n < netCount; n++) this.netFanStart[n + 1] = this.netFanStart[n]! + fan[n]!.length;
    this.netFanList = Int32Array.from(fan.flat());

    this.netFlags = new Uint8Array(netCount);
    this.watched = new Uint16Array(netCount);
    this.dirty = new Uint8Array(E);
    this.dirtyList = new Int32Array(E);
    this.dirtyList2 = new Int32Array(E);
    this.wakeSerial = new Int32Array(E);
    this.wakeElem = new Int32Array(E);
    this.wakeTag = new Int32Array(E);

    this.setupMessages.push(...this.messages);
    this.reset();
  }

  get time(): number {
    return this.now / TICKS_PER_SECOND;
  }

  // ─── Engine ────────────────────────────────────────────────────────────────

  advance(dt: number): void {
    this.settle();
    if (!(dt > 0)) return;
    const target = this.now + Math.round(dt * TICKS_PER_SECOND);
    const q = this.queue;
    while (q.size > 0 && q.time[0]! <= target) this.step(q.time[0]!);
    this.now = target;
  }

  settle(): void {
    this.step(this.now);
  }

  reset(): void {
    this.now = 0;
    this.queue.clear();
    this.messages.length = 0;
    this.messages.push(...this.setupMessages);
    this.rng = this.seed;
    this.drvValue.fill(LX);
    this.drvPending.fill(0);
    this.drvPendVal.fill(NONE);
    if (this.groundSlot >= 0) this.drvValue[this.groundSlot] = 0;
    this.wakeCount = 0;
    for (let e = 0; e < this.wakeSerial.length; e++) this.wakeSerial[e] = this.wakeSerial[e]! + 1;
    this.dirty.fill(0);
    this.dirtyCount = 0;
    this.netFlags.fill(0);
    this.nets.fill(NONE);
    for (let n = 0; n < this.nets.length; n++) this.resolve(n);
    for (let e = 0; e < this.models.length; e++) {
      if (this.models[e]?.evaluate && this.dirty[e] === 0) this.markDirty(e);
    }
    for (const m of this.models) m?.reset?.(this);
    this.step(0);
    if (this.powerUpMode === 'random') {
      this.powerUp();
      this.step(0);
    }
    for (const r of this.recorders) {
      r.clear();
      r.push(0, this.nets);
    }
  }

  logic(net: number): Logic {
    return (this.nets[net] ?? LZ) as Logic;
  }

  voltage(net: number): number {
    const v = this.nets[net];
    return v === 1 ? 5 : v === 0 ? 0 : NaN;
  }

  current(): number {
    return 0;
  }

  state(id: string): ElementState {
    const e = this.index.get(id);
    if (e === undefined) return {};
    return this.models[e]?.state?.(this) ?? {};
  }

  setParam(id: string, key: string, value: ParamValue): void {
    const e = this.index.get(id);
    if (e === undefined) return;
    this.elements[e]!.params[key] = value;
    const m = this.models[e];
    if (!m) return;
    m.setParam?.(this, key, value);
    if (m.evaluate && this.dirty[e] === 0) this.markDirty(e);
    this.settle();
  }

  watch(nets: number[]): Recorder {
    const r = new DigitalRecorder(nets, this.nets.length, () => this.now, (rec) => {
      const i = this.recorders.indexOf(rec);
      if (i < 0) return;
      this.recorders.splice(i, 1);
      for (const n of rec.nets) if (n >= 0 && n < this.watched.length) this.watched[n] = this.watched[n]! - 1;
    });
    for (const n of r.nets) if (n >= 0 && n < this.watched.length) this.watched[n] = this.watched[n]! + 1;
    this.recorders.push(r);
    r.push(this.now, this.nets);
    return r;
  }

  memory(id: string): Uint8Array | Uint32Array | undefined {
    const e = this.index.get(id);
    return e === undefined ? undefined : this.models[e]?.memory?.();
  }

  writeMemory(id: string, address: number, value: number): void {
    const e = this.index.get(id);
    const m = e === undefined ? undefined : this.models[e];
    if (!m?.poke) return;
    m.poke(this, address, value);
    if (m.evaluate && this.dirty[e!] === 0) this.markDirty(e!);
    this.settle();
  }

  contended(net: number): boolean {
    return ((this.netFlags[net] ?? 0) & 1) !== 0;
  }

  // ─── DigitalSim (for models) ───────────────────────────────────────────────

  drive(slot: number, value: number, delay: number): void {
    if (this.capturing) {
      this.capVal[slot] = value;
      return;
    }
    const pend = this.drvPending[slot]!;
    if (this.inertial) {
      if (pend !== 0) {
        // Same value already on its way: keep the earlier change.
        if (this.drvPendVal[slot] === value) return;
        this.drvSerial[slot] = this.drvSerial[slot]! + 1;
        this.drvPending[slot] = 0;
        this.drvPendVal[slot] = NONE;
      }
      if (this.drvValue[slot] === value) return;
    } else if ((pend !== 0 ? this.drvPendVal[slot] : this.drvValue[slot]) === value) return;
    this.queue.push(this.now + delay, slot, value, this.drvSerial[slot]!);
    this.drvPending[slot] = this.drvPending[slot]! + 1;
    this.drvPendVal[slot] = value;
  }

  output(slot: number): number {
    return this.drvValue[slot]!;
  }

  cancel(slot: number): void {
    this.drvSerial[slot] = this.drvSerial[slot]! + 1;
    this.drvPending[slot] = 0;
    this.drvPendVal[slot] = NONE;
  }

  wakeAt(element: number, delay: number, tag: number): void {
    const s = (this.wakeSerial[element] = this.wakeSerial[element]! + 1);
    this.queue.push(this.now + Math.max(0, Math.round(delay)), ~element, tag, s);
  }

  cancelWake(element: number): void {
    this.wakeSerial[element] = this.wakeSerial[element]! + 1;
  }

  random(): number {
    // mulberry32
    let t = (this.rng = (this.rng + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  message(level: EngineMessage['level'], text: string, element?: string): void {
    if (this.messages.length >= MAX_MESSAGES) this.messages.splice(0, this.messages.length - MAX_MESSAGES + 1);
    this.messages.push({ level, text, element, time: this.now / TICKS_PER_SECOND });
  }

  // ─── Simulation core ──────────────────────────────────────────────────────

  private markDirty(e: number): void {
    this.dirty[e] = 1;
    this.dirtyList[this.dirtyCount++] = e;
  }

  /** Process every delta cycle at time t. */
  private step(t: number): void {
    this.now = t;
    const q = this.queue;
    let deltas = 0;
    for (;;) {
      while (q.size > 0 && q.time[0] === t) {
        q.pop();
        const target = q.pTarget;
        if (target >= 0) {
          if (q.pSerial !== this.drvSerial[target]) continue;
          const pend = this.drvPending[target]! - 1;
          this.drvPending[target] = pend;
          if (pend === 0) this.drvPendVal[target] = NONE;
          this.eventCount++;
          const v = q.pValue;
          if (this.drvValue[target] !== v) {
            this.drvValue[target] = v;
            this.resolve(this.drvNet[target]!);
          }
        } else {
          const e = ~target;
          if (q.pSerial !== this.wakeSerial[e]) continue;
          this.eventCount++;
          this.wakeElem[this.wakeCount] = e;
          this.wakeTag[this.wakeCount++] = q.pValue;
        }
      }
      if (this.dirtyCount === 0 && this.wakeCount === 0) break;
      deltas++;
      if (deltas > this.maxDeltas - 64) {
        this.loopSuspects ??= new Set();
        for (let i = 0; i < this.dirtyCount; i++) this.loopSuspects.add(this.dirtyList[i]!);
        if (deltas > this.maxDeltas && !this.breakLoop(t, deltas)) break;
      }
      this.evaluate();
    }
    this.loopSuspects = undefined;
  }

  /** Evaluate the elements woken up or whose inputs changed in this delta cycle. */
  private evaluate(): void {
    const models = this.models;
    const wn = this.wakeCount;
    if (wn !== 0) {
      this.wakeCount = 0;
      for (let i = 0; i < wn; i++) models[this.wakeElem[i]!]?.wake?.(this, this.wakeTag[i]!);
    }
    const n = this.dirtyCount;
    if (n !== 0) {
      const list = this.dirtyList;
      this.dirtyList = this.dirtyList2;
      this.dirtyList2 = list;
      this.dirtyCount = 0;
      const dirty = this.dirty;
      for (let i = 0; i < n; i++) {
        const e = list[i]!;
        dirty[e] = 0;
        models[e]!.evaluate!(this);
      }
    }
  }

  /** Recompute a net from its drivers; on a change, schedule its fan-out and record it. */
  private resolve(n: number): void {
    const s = this.netDrvStart[n]!;
    const end = this.netDrvStart[n + 1]!;
    const v = end - s === 1 ? this.drvValue[this.netDrvList[s]!]! : this.resolveMany(n, s, end);
    const nets = this.nets;
    if (nets[n] === v) return;
    nets[n] = v;
    const fe = this.netFanStart[n + 1]!;
    const dirty = this.dirty;
    for (let i = this.netFanStart[n]!; i < fe; i++) {
      const e = this.netFanList[i]!;
      if (dirty[e] === 0) {
        dirty[e] = 1;
        this.dirtyList[this.dirtyCount++] = e;
      }
    }
    if (this.watched[n] !== 0) {
      for (const r of this.recorders) if (r.mask[n] === 1) r.push(this.now, nets);
    }
  }

  private resolveMany(n: number, s: number, end: number): number {
    let has0 = false;
    let has1 = false;
    let hasX = false;
    for (let i = s; i < end; i++) {
      const v = this.drvValue[this.netDrvList[i]!];
      if (v === 0) has0 = true;
      else if (v === 1) has1 = true;
      else if (v === LX) hasX = true;
    }
    const contention = has0 && has1;
    if (contention) {
      if ((this.netFlags[n]! & 1) === 0) {
        this.netFlags[n] = this.netFlags[n]! | 1;
        this.reportContention(n, s, end);
      }
    } else if ((this.netFlags[n]! & 1) !== 0) this.netFlags[n] = this.netFlags[n]! & ~1;
    return hasX || contention ? LX : has0 ? 0 : has1 ? 1 : LZ;
  }

  private reportContention(n: number, s: number, end: number): void {
    const who = (value: number) => {
      const ids: string[] = [];
      for (let i = s; i < end; i++) {
        const d = this.netDrvList[i]!;
        if (this.drvValue[d] !== value) continue;
        const e = this.drvElem[d]!;
        ids.push(e < 0 ? 'ground' : this.elements[e]!.id);
      }
      return ids.join(', ');
    };
    const name = this.netlist.netNames[n];
    const zeros = who(0);
    const onesBy = who(1);
    this.message('warning', `Contention on ${name ? `net ${name}` : `net ${n}`}: ${zeros} drive${zeros.includes(',') ? '' : 's'} 0 while ${onesBy} drive${onesBy.includes(',') ? '' : 's'} 1. The net is X, and real chips would be fighting (and heating up).`, this.firstDriverId(s, end));
  }

  private firstDriverId(s: number, end: number): string | undefined {
    for (let i = s; i < end; i++) {
      const e = this.drvElem[this.netDrvList[i]!]!;
      if (e >= 0) return this.elements[e]!.id;
    }
    return undefined;
  }

  /**
   * A zero-delay loop has not settled after maxDeltas delta cycles. The first time, report it and
   * force the outputs of the elements involved to X (which is where such a loop ends up). If that
   * still does not settle it, drop every event at this time point. Returns false to stop.
   */
  private breakLoop(t: number, deltas: number): boolean {
    const suspectList = () => [...(this.loopSuspects ?? [])].sort((a, b) => a - b);
    if (deltas === this.maxDeltas + 1) {
      const suspects = suspectList();
      const ids = suspects.map((e) => this.elements[e]!.id);
      const shown = ids.length > 6 ? `${ids.slice(0, 6).join(', ')} and ${ids.length - 6} more` : ids.join(', ');
      this.message(
        'error',
        `A loop with no delay through ${shown} does not settle: after ${this.maxDeltas} steps at t = ${fmtTime(t)} it is still changing. Its wires are set to X; give a gate in the loop a delay.`,
        ids[0],
      );
      for (const e of suspects) {
        for (let s = this.outStart[e]!; s < this.outStart[e + 1]!; s++) {
          this.cancel(s);
          if (this.drvValue[s] !== LX) {
            this.drvValue[s] = LX;
            this.resolve(this.drvNet[s]!);
          }
        }
      }
      return true;
    }
    if (deltas > 2 * this.maxDeltas) {
      const suspects = suspectList();
      this.message('error', `Gave up settling the loop at t = ${fmtTime(t)}; its pending changes were dropped.`, suspects[0] === undefined ? undefined : this.elements[suspects[0]]!.id);
      for (let i = 0; i < this.dirtyCount; i++) this.dirty[this.dirtyList[i]!] = 0;
      this.dirtyCount = 0;
      this.wakeCount = 0;
      const q = this.queue;
      while (q.size > 0 && q.time[0] === t) {
        q.pop();
        if (q.pTarget >= 0 && q.pSerial === this.drvSerial[q.pTarget]) this.cancel(q.pTarget);
      }
      return false;
    }
    return true;
  }

  // ─── Power-up of feedback loops ───────────────────────────────────────────

  private powerUp(): void {
    this.loops ??= this.findLoops();
    for (const loop of this.loops) {
      let picked = false;
      for (const e of loop) {
        const m = this.models[e]!;
        const s0 = this.outStart[e]!;
        const s1 = this.outStart[e + 1]!;
        let unknown = false;
        for (let s = s0; s < s1; s++) {
          this.capVal[s] = NONE;
          if (this.drvValue[s] === LX) unknown = true;
        }
        if (!unknown) continue;
        this.capturing = true;
        try {
          m.evaluate!(this);
        } finally {
          this.capturing = false;
        }
        for (let s = s0; s < s1; s++) {
          if (this.drvValue[s] !== LX) continue;
          let v = this.capVal[s]!;
          if (v === NONE || v === LZ) continue;
          if (v === LX) {
            v = this.random() < 0.5 ? 0 : 1;
            picked = true;
          }
          this.cancel(s);
          this.drvValue[s] = v;
          this.resolve(this.drvNet[s]!);
        }
      }
      if (picked) {
        const ids = loop.map((e) => this.elements[e]!.id);
        const shown = ids.length > 6 ? `${ids.slice(0, 6).join(', ')} and ${ids.length - 6} more` : ids.join(', ');
        this.message('info', `The feedback loop through ${shown} powered up in a random state, as real hardware does.`, ids[0]);
      }
    }
  }

  /**
   * Strongly connected groups of combinational elements (Tarjan's algorithm, iterative), each in
   * breadth-first order from its first element, sorted by first element.
   */
  private findLoops(): number[][] {
    const E = this.elements.length;
    const comb = (e: number) => this.models[e]?.combinational === true && this.models[e]!.evaluate !== undefined;
    const succ = (e: number): number[] => {
      const out: number[] = [];
      for (let s = this.outStart[e]!; s < this.outStart[e + 1]!; s++) {
        const n = this.drvNet[s]!;
        for (let i = this.netFanStart[n]!; i < this.netFanStart[n + 1]!; i++) {
          const f = this.netFanList[i]!;
          if (comb(f)) out.push(f);
        }
      }
      return out;
    };
    const idx = new Int32Array(E).fill(-1);
    const low = new Int32Array(E);
    const onStack = new Uint8Array(E);
    const stack: number[] = [];
    const sccs: number[][] = [];
    let counter = 0;
    for (let root = 0; root < E; root++) {
      if (idx[root] !== -1 || !comb(root)) continue;
      const work: { v: number; next: number[]; i: number }[] = [{ v: root, next: succ(root), i: 0 }];
      idx[root] = low[root] = counter++;
      stack.push(root);
      onStack[root] = 1;
      while (work.length) {
        const top = work[work.length - 1]!;
        if (top.i < top.next.length) {
          const w = top.next[top.i++]!;
          if (idx[w] === -1) {
            idx[w] = low[w] = counter++;
            stack.push(w);
            onStack[w] = 1;
            work.push({ v: w, next: succ(w), i: 0 });
          } else if (onStack[w]) low[top.v] = Math.min(low[top.v]!, idx[w]!);
          continue;
        }
        work.pop();
        const v = top.v;
        if (work.length) {
          const p = work[work.length - 1]!.v;
          low[p] = Math.min(low[p]!, low[v]!);
        }
        if (low[v] === idx[v]) {
          const comp: number[] = [];
          let w: number;
          do {
            w = stack.pop()!;
            onStack[w] = 0;
            comp.push(w);
          } while (w !== v);
          if (comp.length > 1 || succ(v).includes(v)) sccs.push(comp);
        }
      }
    }
    return sccs
      .map((comp) => {
        const inComp = new Set(comp);
        const first = Math.min(...comp);
        const order = [first];
        const seen = new Set(order);
        for (let i = 0; i < order.length; i++) {
          for (const w of succ(order[i]!)) {
            if (inComp.has(w) && !seen.has(w)) {
              seen.add(w);
              order.push(w);
            }
          }
        }
        return order;
      })
      .sort((a, b) => a[0]! - b[0]!);
  }
}

/** Pin directions from the model registration, else from the catalog (pins without `dir` are inputs). */
function pinDirections(el: FlatElement, fromModel?: (el: FlatElement) => PinDir[]): PinDir[] {
  let dirs: PinDir[] | undefined = fromModel?.(el);
  if (!dirs) {
    const def = getDef(el.type);
    if (def) {
      const pins = pinsOf(def, el.params);
      const byName = new Map(pins.map((p) => [p.name, p.dir ?? 'in']));
      dirs = el.pinNames.map((name) => byName.get(name) ?? 'in');
    }
  }
  return el.pins.map((_, i) => dirs?.[i] ?? 'in');
}

function fmtTime(ticks: number): string {
  const s = ticks / TICKS_PER_SECOND;
  if (s === 0) return '0 s';
  const abs = Math.abs(s);
  if (abs < 1e-6) return `${+(s * 1e9).toPrecision(4)} ns`;
  if (abs < 1e-3) return `${+(s * 1e6).toPrecision(4)} µs`;
  if (abs < 1) return `${+(s * 1e3).toPrecision(4)} ms`;
  return `${+s.toPrecision(4)} s`;
}

/**
 * Create a digital engine for a flat netlist. The engine starts powered up at t = 0 (see the
 * module comment). `options` may add `delayModel`, `powerUp` and `maxDeltaCycles` to the common
 * EngineOptions (`seed` seeds metastability and power-up choices; `step` is the default delay of
 * models without a delay parameter, 1 ns if omitted).
 */
export function createDigitalEngine(netlist: FlatNetlist, options?: DigitalEngineOptions): DigitalEngine {
  return new DigitalEngineImpl(netlist, options);
}
