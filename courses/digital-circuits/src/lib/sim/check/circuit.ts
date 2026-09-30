/**
 * Driving a drawn circuit as a black box on the digital engine: find its named inputs and outputs,
 * set inputs, let the circuit settle, read outputs.
 *
 * Inputs are `toggle`s and `button`s (named by label, else id) and input/io `port`s (named by the port's
 * `name`); outputs are `indicator`s, `probe`s (name, else label, else id) and output `port`s.
 * A circuit drawn as a subcircuit (ports) is driven by attaching a logic switch to each input port.
 */
import type { Circuit, EngineKind, FlatElement, Logic, Placed } from '../netlist/types';
import type { Engine } from '../engine';
import { flatten, topLevelNets } from '../netlist/flatten';
import type { SubResolver } from '../netlist/connect';
import { createDigitalEngine } from '../digital';
import { createSwitchEngine } from '../switch';
import { createAnalogEngine } from '../analog';

/** The pin name every clocked component of the catalog uses for its clock. */
const CLOCK_PIN = 'CLK';

export interface PinRef {
  name: string;
  kind: 'toggle' | 'button' | 'port' | 'indicator' | 'probe';
  id: string;
  /** Flat net of the pin. */
  net: number;
}

/** The name a checker knows a component by. */
export function pinNameOf(c: Placed): string {
  const label = c.label && c.label.trim() ? c.label.trim() : undefined;
  switch (c.type) {
    case 'port':
      return String(c.params?.name ?? c.id);
    case 'probe':
      return String(c.params?.name || label || c.id);
    default:
      return label ?? c.id;
  }
}

export interface Discovered {
  inputs: PinRef[];
  outputs: PinRef[];
  problems: string[];
}

/** Find the circuit's named inputs and outputs (nets are flat-netlist nets of the top level). */
export function discover(circuit: Circuit, parts?: SubResolver): Discovered {
  const conn = topLevelNets(circuit, parts);
  const flat = flatten(circuit, parts);
  const net = (id: string, pin: string) => {
    const n = conn.pinNet.get(`${id}.${pin}`)!;
    return flat.alias?.[n] ?? n;
  };
  const inputs: PinRef[] = [];
  const outputs: PinRef[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  const add = (list: PinRef[], ref: PinRef) => {
    const key = `${list === inputs ? 'in' : 'out'}:${ref.name}`;
    if (seen.has(key)) {
      problems.push(`Two ${list === inputs ? 'inputs' : 'outputs'} are called ${ref.name}.`);
      return;
    }
    seen.add(key);
    list.push(ref);
  };
  // Top to bottom, then left to right: the order the reader sees them in.
  const order = [...circuit.components].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const c of order) {
    const name = pinNameOf(c);
    if (c.type === 'toggle' || c.type === 'button') add(inputs, { name, kind: c.type, id: c.id, net: net(c.id, 'Y') });
    else if (c.type === 'port') {
      const dir = String(c.params?.dir ?? 'in');
      add(dir === 'out' ? outputs : inputs, { name, kind: 'port', id: c.id, net: net(c.id, 'p') });
    } else if (c.type === 'indicator') add(outputs, { name, kind: 'indicator', id: c.id, net: net(c.id, 'A') });
    else if (c.type === 'probe') add(outputs, { name, kind: 'probe', id: c.id, net: net(c.id, 'A') });
  }
  return { inputs, outputs, problems };
}

/** Upper bound on the time (ns) a feedback-free circuit needs to settle: the sum of every delay in it. */
function settleNs(flat: { elements: FlatElement[] }): number {
  let sum = 0;
  for (const e of flat.elements) {
    const d = Math.max(Number(e.params.delay ?? 0), Number(e.params.clkToQ ?? 0), 0);
    sum += Number.isFinite(d) ? d : 0;
  }
  return Math.max(10, sum * 1.5 + 5);
}

export interface BenchOptions {
  parts?: SubResolver;
  seed?: number;
  /** Which engine runs the circuit (default: the circuit's own `engine`, else digital). */
  engine?: EngineKind;
  /** Simulated seconds allowed for the circuit to settle after an input change (default: from the delays; 20 µs for analog circuits). */
  settleSeconds?: number;
}

/** A circuit on the digital engine with named inputs and outputs. */
export class CircuitBench {
  readonly inputs: string[];
  /**
   * Inputs that drive the clock pin (`CLK`) of a component (flip-flop, counter, register, memory…), whatever
   * they are called, in reading order. A name never makes an input a clock: an input called `C` or `CLK`
   * that reaches no clock pin is data.
   */
  readonly clockInputs: string[];
  readonly outputs: string[];
  readonly problems: string[];
  readonly engine: Engine;
  readonly kind: EngineKind;
  private readonly drivers = new Map<string, { id: string; key: string }>();
  private readonly outNets = new Map<string, number>();
  private readonly values = new Map<string, number>();
  private readonly windowS: number;
  private readonly elementIds: string[];

  constructor(circuit: Circuit, options: BenchOptions = {}) {
    const found = discover(circuit, options.parts);
    const flat = flatten(circuit, options.parts);
    this.problems = [...found.problems];
    const extra: FlatElement[] = [];
    for (const p of found.inputs) {
      this.drivers.set(p.name, { id: p.kind === 'port' ? `__in:${p.id}` : p.id, key: p.kind === 'button' ? 'pressed' : 'on' });
      if (p.kind === 'port') extra.push({ id: `__in:${p.id}`, type: 'toggle', params: { on: false }, pins: [p.net], pinNames: ['Y'] });
      this.values.set(p.name, 0);
    }
    for (const p of found.outputs) this.outNets.set(p.name, p.net);
    this.inputs = found.inputs.map((p) => p.name);
    const clockNets = new Set<number>();
    for (const e of flat.elements) e.pinNames.forEach((n, i) => n === CLOCK_PIN && clockNets.add(e.pins[i]!));
    this.clockInputs = found.inputs.filter((p) => clockNets.has(p.net)).map((p) => p.name);
    this.outputs = found.outputs.map((p) => p.name);
    const netlist = { ...flat, elements: [...flat.elements, ...extra] };
    this.kind = options.engine ?? circuit.engine ?? 'digital';
    this.windowS = options.settleSeconds ?? (this.kind === 'analog' ? 20e-6 : settleNs(netlist) * 1e-9);
    this.elementIds = netlist.elements.filter((e) => e.type !== 'toggle' && e.type !== 'button').map((e) => e.id);
    const make = this.kind === 'analog' ? createAnalogEngine : this.kind === 'switch' ? createSwitchEngine : createDigitalEngine;
    this.engine = make(netlist, { seed: options.seed ?? 1 });
    for (const [name] of this.drivers) this.write(name, 0);
    this.settle();
  }

  private write(name: string, v: number): void {
    const d = this.drivers.get(name)!;
    this.engine.setParam(d.id, d.key, v ? true : false);
  }

  hasInput(name: string): boolean {
    return this.drivers.has(name);
  }
  hasOutput(name: string): boolean {
    return this.outNets.has(name);
  }

  /** Set an input (no settling: call settle() when all inputs are set). */
  set(name: string, v: number): void {
    if (!this.drivers.has(name)) throw new Error(`no input called ${name}`);
    const bit = v ? 1 : 0;
    if (this.values.get(name) === bit) return;
    this.values.set(name, bit);
    this.write(name, bit);
  }

  get(name: string): Logic {
    const n = this.outNets.get(name);
    if (n === undefined) throw new Error(`no output called ${name}`);
    return this.engine.logic(n);
  }

  /** Let every pending change happen. */
  settle(): void {
    this.engine.advance(this.windowS);
  }

  /** Power-up state again, with every input at 0. */
  reset(): void {
    for (const [name] of this.drivers) {
      this.values.set(name, 0);
      this.write(name, 0);
    }
    this.engine.reset();
    this.settle();
  }

  /** Engine errors (a loop that never settles, a part that cannot be simulated). */
  errors(): string[] {
    return this.engine.messages.filter((m) => m.level === 'error').map((m) => m.text);
  }

  /** The state of the whole circuit as text: every net and every stored value. */
  signature(): string {
    const nl = this.engine.netlist;
    let s = '';
    for (let n = 0; n < nl.netCount; n++) s += this.engine.logic(n);
    for (const id of this.elementIds) {
      const v = this.engine.state(id).value;
      if (v !== undefined) s += `|${v}`;
    }
    return s;
  }
}
