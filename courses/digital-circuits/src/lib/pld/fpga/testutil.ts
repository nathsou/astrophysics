/**
 * Helpers for tests and benchmarks: generators for gate-level designs, and drivers that run a design on the
 * digital engine both as written and as configured on the fabric.
 */
import { createDigitalEngine, NetlistBuilder } from '../../sim/digital';
import type { DigitalEngine } from '../../sim/digital';
import type { FlatNetlist } from '../../sim/netlist/types';
import { mulberry32, type Rng } from '../twolevel/random';
import { attachTestbench, decodeBitstream, type DecodedFabric } from './decode';
import type { FlowResult } from './flow';

export interface Bench {
  nl: FlatNetlist;
  inputs: string[];
  outputs: string[];
}

/** A random combinational netlist of `gates` gates over `nIn` inputs with `nOut` outputs. */
export function randomComb(seed: number, nIn: number, gates: number, nOut: number): Bench {
  const rng = mulberry32(seed);
  const b = new NetlistBuilder();
  const nets: number[] = [];
  const inputs: string[] = [];
  for (let i = 0; i < nIn; i++) {
    const n = b.net(`in${i}`);
    b.add('toggle', `in${i}`, { Y: n });
    inputs.push(`in${i}`);
    nets.push(n);
  }
  const types = ['and', 'or', 'nand', 'nor', 'xor', 'xnor', 'not', 'mux', 'and', 'or', 'xor'];
  for (let g = 0; g < gates; g++) {
    const t = types[rng.int(types.length)]!;
    const y = b.net();
    const pick = () => nets[rng.int(nets.length)]!;
    if (t === 'not') b.add('not', `g${g}`, { A: pick(), Y: y });
    else if (t === 'mux') b.add('mux', `g${g}`, { D0: pick(), D1: pick(), S0: pick(), Y: y });
    else {
      const k = 2 + rng.int(3);
      const pins: Record<string, number> = { Y: y };
      for (let i = 0; i < k; i++) pins[String.fromCharCode(65 + i)] = pick();
      b.add(t, `g${g}`, pins, { inputs: k });
    }
    nets.push(y);
  }
  const outputs: string[] = [];
  for (let o = 0; o < nOut; o++) {
    // Prefer late nets so outputs depend on much of the logic.
    const n = nets[nets.length - 1 - rng.int(Math.min(nets.length, Math.max(3, gates)))]!;
    b.add('indicator', `out${o}`, { A: n });
    outputs.push(`out${o}`);
  }
  return { nl: b.build(), inputs, outputs };
}

/** Values of the outputs of a netlist (indicator elements) for every input vector, by the digital engine. */
export function truthOf(bench: Bench): number[][] {
  const eng = createDigitalEngine(bench.nl, { powerUp: 'x' });
  const outs = bench.outputs.map((id) => bench.nl.elements.find((e) => e.id === id)!.pins[0]!);
  const rows: number[][] = [];
  for (let v = 0; v < 1 << bench.inputs.length; v++) {
    bench.inputs.forEach((id, i) => eng.setParam(id, 'on', ((v >> i) & 1) === 1));
    eng.advance(50e-9);
    rows.push(outs.map((n) => eng.logic(n)));
  }
  return rows;
}

/** The configured fabric of a flow result on the digital engine, with switches on the input pads. */
export interface FabricRun {
  fabric: DecodedFabric;
  engine: DigitalEngine;
  padOf: Map<string, string>;
  outNet: Map<string, number>;
}

export function runFabric(res: FlowResult, bench: Pick<Bench, 'inputs' | 'outputs'>): FabricRun {
  const fabric = decodeBitstream(res.device, res.bitgen.bits);
  const padOf = new Map<string, string>();
  const outNet = new Map<string, number>();
  res.netlist.ports.forEach((port, i) => {
    const pad = res.device.pads[res.placement.unitPad[res.packed.portUnit[i]!]!]!.name;
    padOf.set(port.name, pad);
    if (port.dir === 'out') outNet.set(port.name, fabric.fabric.padNets.get(pad)!);
  });
  attachTestbench(
    fabric,
    bench.inputs.map((n) => padOf.get(n)!).filter((p) => p !== undefined && fabric.fabric.padNets.has(p)),
  );
  const engine = createDigitalEngine(fabric, { powerUp: 'x' });
  return { fabric, engine, padOf, outNet };
}

export function setInput(run: FabricRun, name: string, value: boolean): void {
  const pad = run.padOf.get(name);
  if (pad && run.fabric.fabric.padNets.has(pad)) run.engine.setParam(`TB:${pad}`, 'on', value);
}

export { mulberry32 };
export type { Rng };

export interface SeqLike {
  nl: FlatNetlist;
  clock: string;
  inputs: string[];
  outputs: string[];
}

/** Random input stimulus: `cycles` vectors of `n` bits (bit i of vector c is input i). */
export function stimulus(seed: number, cycles: number, n: number, bias: number[] = []): number[][] {
  const rng = mulberry32(seed);
  return Array.from({ length: cycles }, () => Array.from({ length: n }, (_, i) => (rng.next() < (bias[i] ?? 0.5) ? 1 : 0)));
}

const HALF = 100e-9;

/** Outputs after each rising clock edge, for the design as written (digital engine). */
export function traceOriginal(bench: SeqLike, stim: number[][]): number[][] {
  const eng = createDigitalEngine(bench.nl, { powerUp: 'x' });
  const outs = bench.outputs.map((id) => bench.nl.elements.find((e) => e.id === id)!.pins[0]!);
  const trace: number[][] = [];
  eng.setParam(bench.clock, 'on', false);
  for (const v of stim) {
    bench.inputs.forEach((id, i) => eng.setParam(id, 'on', v[i] === 1));
    eng.advance(HALF);
    eng.setParam(bench.clock, 'on', true);
    eng.advance(HALF);
    trace.push(outs.map((n) => eng.logic(n)));
    eng.setParam(bench.clock, 'on', false);
    eng.advance(HALF);
  }
  return trace;
}

/** The same, for the configured fabric. */
export function traceFabric(res: FlowResult, bench: SeqLike, stim: number[][]): number[][] {
  const run = runFabric(res, { inputs: [...bench.inputs, bench.clock], outputs: bench.outputs });
  const trace: number[][] = [];
  setInput(run, bench.clock, false);
  run.engine.advance(HALF);
  for (const v of stim) {
    bench.inputs.forEach((id, i) => setInput(run, id, v[i] === 1));
    run.engine.advance(HALF);
    setInput(run, bench.clock, true);
    run.engine.advance(HALF);
    trace.push(bench.outputs.map((o) => run.engine.logic(run.outNet.get(o)!)));
    setInput(run, bench.clock, false);
    run.engine.advance(HALF);
  }
  return trace;
}
