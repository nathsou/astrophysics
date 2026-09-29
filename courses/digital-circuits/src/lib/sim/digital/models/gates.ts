import type { ElementState } from '../../engine';
import type { FlatElement, ParamValue } from '../../netlist/types';
import { X, Z, input } from '../logic';
import { nsToTicks, registerDigitalModel, type DigitalModel, type DigitalSim, type ModelInit } from '../model';

/**
 * Logic gates. One class for every gate so the engine's evaluate call stays monomorphic in
 * gate-level circuits.
 *
 * X rules: an AND with any 0 input is 0, whatever the others; an OR with any 1 is 1; XOR with any
 * unknown input is X. Z inputs read as X (a floating CMOS input).
 *
 * State: `{ value }`, the value the gate drives (0, 1, 2 = X, 3 = Z).
 */

const AND = 0;
const OR = 1;
const NAND = 2;
const NOR = 3;
const XOR = 4;
const XNOR = 5;
const NOT = 6;
const BUF = 7;

/** Delay parameter of an element in ticks. */
export const delayOf = (el: FlatElement, dflt: number, key = 'delay'): number => (el.params[key] === undefined ? dflt : nsToTicks(el.params[key], dflt));

/** Input nets (pins that have no driver slot) of an element. */
export function inputNets(init: ModelInit): Int32Array {
  const out: number[] = [];
  init.slots.forEach((s, i) => {
    if (s < 0) out.push(init.nets[i]!);
  });
  return Int32Array.from(out);
}

/** The first output slot of an element. */
export function outputSlot(init: ModelInit, name?: string): number {
  if (name !== undefined) {
    const i = init.pin(name);
    if (i < 0 || init.slots[i]! < 0) throw new Error(`no output pin ${name}`);
    return init.slots[i]!;
  }
  for (const s of init.slots) if (s >= 0) return s;
  throw new Error('no output pin');
}

class Gate implements DigitalModel {
  readonly combinational = true;
  private delay: number;
  private readonly ins: Int32Array;
  private readonly out: number;

  constructor(
    private readonly op: number,
    private readonly init: ModelInit,
  ) {
    this.ins = inputNets(init);
    this.out = outputSlot(init);
    this.delay = delayOf(init.element, init.defaultDelay);
  }

  evaluate(sim: DigitalSim): void {
    const nets = sim.nets;
    const ins = this.ins;
    const n = ins.length;
    const op = this.op;
    let v: number;
    if (op === NOT || op === BUF) {
      const a = nets[ins[0]!]!;
      v = a > 1 ? X : op === NOT ? 1 - a : a;
    } else if (op === AND || op === NAND) {
      // AND, NAND: 0 dominates.
      v = 1;
      for (let i = 0; i < n; i++) {
        const a = nets[ins[i]!]!;
        if (a === 0) {
          v = 0;
          break;
        }
        if (a !== 1) v = X;
      }
      if (op === NAND && v !== X) v = 1 - v;
    } else if (op === OR || op === NOR) {
      // OR, NOR: 1 dominates.
      v = 0;
      for (let i = 0; i < n; i++) {
        const a = nets[ins[i]!]!;
        if (a === 1) {
          v = 1;
          break;
        }
        if (a !== 0) v = X;
      }
      if (op === NOR && v !== X) v = 1 - v;
    } else {
      // XOR, XNOR: parity; any unknown input makes it X.
      v = op === XNOR ? 1 : 0;
      for (let i = 0; i < n; i++) {
        const a = nets[ins[i]!]!;
        if (a > 1) {
          v = X;
          break;
        }
        v ^= a;
      }
    }
    sim.drive(this.out, v, this.delay);
  }

  setParam(_sim: DigitalSim, key: string): void {
    if (key === 'delay') this.delay = delayOf(this.init.element, this.init.defaultDelay);
  }

  state(sim: DigitalSim): ElementState {
    return { value: sim.output(this.out) };
  }
}

/** Tri-state buffer: EN = 1 drives A, EN = 0 lets go (Z), EN unknown gives X. */
class TriState implements DigitalModel {
  readonly combinational = true;
  private delay: number;
  private readonly a: number;
  private readonly en: number;
  private readonly out: number;

  constructor(private readonly init: ModelInit) {
    this.a = init.nets[init.pin('A')]!;
    this.en = init.nets[init.pin('EN')]!;
    this.out = outputSlot(init, 'Y');
    this.delay = delayOf(init.element, init.defaultDelay);
  }

  evaluate(sim: DigitalSim): void {
    const en = sim.nets[this.en]!;
    const v = en === 1 ? input(sim.nets[this.a]!) : en === 0 ? Z : X;
    sim.drive(this.out, v, this.delay);
  }

  setParam(_sim: DigitalSim, key: string, _value: ParamValue): void {
    if (key === 'delay') this.delay = delayOf(this.init.element, this.init.defaultDelay);
  }

  state(sim: DigitalSim): ElementState {
    return { value: sim.output(this.out) };
  }
}

const ops: Record<string, number> = { and: AND, or: OR, nand: NAND, nor: NOR, xor: XOR, xnor: XNOR, not: NOT, buffer: BUF };
for (const [type, op] of Object.entries(ops)) registerDigitalModel(type, (init) => new Gate(op, init));
registerDigitalModel('tristate', (init) => new TriState(init));
