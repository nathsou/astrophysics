/**
 * Static CMOS cells: every logic gate as a list of *stages*. A stage is one complementary CMOS
 * gate: a pull-up network of pMOS transistors between the +5 V rail and the stage's output node,
 * and a pull-down network of nMOS transistors between the output node and ground. A network is a
 * series–parallel tree whose leaves are transistors named after the signal on their gate.
 *
 *   not      1 stage:  the inverter (2 transistors)
 *   nand n   1 stage:  pMOS in parallel, nMOS in series (2n transistors)
 *   nor n    1 stage:  pMOS in series, nMOS in parallel (2n)
 *   and n    NAND + inverter (2n + 2);  or n: NOR + inverter (2n + 2)
 *   buffer   two inverters (4)
 *   xor 2    the classic 12-transistor static gate: two inverters make A' and B', then one stage
 *            Y = ¬(A·B + A'·B') with pull-down (A series B) ∥ (A' series B') and the dual pull-up
 *            (A ∥ B) series (A' ∥ B'). It is restoring (every output is driven from a rail) and it is
 *            built from the same series–parallel networks as every other gate; the 8-transistor
 *            transmission-gate version is smaller but passes the input through to the output, which
 *            switch-level strengths and analog loading would show as a weaker output.
 *   xor n    a chain of n − 1 two-input XORs; xnor n: the same with the last stage inverted (Y = ¬(…))
 *   tristate an inverter for EN, an inverter for A, and a *clocked inverter*
 *            (series pull-up ENb, A'; series pull-down A', EN): 8 transistors. With EN = 0 both
 *            networks are open and Y floats.
 */

/** A series–parallel transistor network. A leaf is a transistor whose gate is the named signal. */
export type Net = { leaf: string } | { series: Net[] } | { parallel: Net[] };

export interface Stage {
  /** The signal this stage drives: 'Y' for the last stage, else an internal name ('m', 'An', …). */
  out: string;
  /** Pull-up (pMOS): +5 V to the output. */
  pun: Net;
  /** Pull-down (nMOS): the output to ground. */
  pdn: Net;
}

export interface Cell {
  /** Input pin names of the gate ('A', 'B', … and 'EN' for a tri-state buffer). */
  inputs: string[];
  stages: Stage[];
}

export const GATE_TYPES = ['not', 'buffer', 'and', 'or', 'nand', 'nor', 'xor', 'xnor', 'tristate'] as const;
export type GateType = (typeof GATE_TYPES)[number];

export const isGateType = (type: string): type is GateType => (GATE_TYPES as readonly string[]).includes(type);

const leaf = (sig: string): Net => ({ leaf: sig });
const series = (nets: Net[]): Net => (nets.length === 1 ? nets[0]! : { series: nets });
const parallel = (nets: Net[]): Net => (nets.length === 1 ? nets[0]! : { parallel: nets });
const names = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));

const inverter = (input: string, out: string): Stage => ({ out, pun: leaf(input), pdn: leaf(input) });
const nandStage = (ins: string[], out: string): Stage => ({ out, pun: parallel(ins.map(leaf)), pdn: series(ins.map(leaf)) });
const norStage = (ins: string[], out: string): Stage => ({ out, pun: series(ins.map(leaf)), pdn: parallel(ins.map(leaf)) });

/** Number of inputs of a gate, clamped like the catalog does (1 – 8). */
export const gateInputs = (type: string, params?: Record<string, unknown>): number => {
  if (type === 'not' || type === 'buffer') return 1;
  if (type === 'tristate') return 1;
  return Math.max(1, Math.min(8, Math.round(Number(params?.inputs ?? 2))));
};

/** The CMOS cell of a gate with `inputs` inputs. */
export function cellFor(type: GateType, inputs: number): Cell {
  const ins = names(inputs);
  switch (type) {
    case 'not':
      return { inputs: ['A'], stages: [inverter('A', 'Y')] };
    case 'buffer':
      return { inputs: ['A'], stages: [inverter('A', 'm'), inverter('m', 'Y')] };
    case 'nand':
      return { inputs: ins, stages: [nandStage(ins, 'Y')] };
    case 'nor':
      return { inputs: ins, stages: [norStage(ins, 'Y')] };
    case 'and':
      return { inputs: ins, stages: [nandStage(ins, 'm'), inverter('m', 'Y')] };
    case 'or':
      return { inputs: ins, stages: [norStage(ins, 'm'), inverter('m', 'Y')] };
    case 'xor':
    case 'xnor': {
      if (inputs === 1) return cellFor(type === 'xor' ? 'buffer' : 'not', 1);
      const stages: Stage[] = [];
      let acc = 'A';
      for (let i = 1; i < inputs; i++) {
        const x = ins[i]!;
        const last = i === inputs - 1;
        const out = last ? 'Y' : `x${i}`;
        const an = `${acc}n`;
        const xn = `${x}n`;
        stages.push(inverter(acc, an), inverter(x, xn));
        // XOR: ¬(a·b + a'·b'). XNOR (last stage only): ¬(a·b' + a'·b).
        const invert = type === 'xnor' && last;
        const [p, q] = invert ? [xn, x] : [x, xn];
        stages.push({
          out,
          pdn: parallel([series([leaf(acc), leaf(p)]), series([leaf(an), leaf(q)])]),
          pun: series([parallel([leaf(acc), leaf(p)]), parallel([leaf(an), leaf(q)])]),
        });
        acc = out;
      }
      return { inputs: ins, stages };
    }
    case 'tristate':
      return {
        inputs: ['A', 'EN'],
        stages: [
          inverter('EN', 'ENb'),
          inverter('A', 'An'),
          { out: 'Y', pun: series([leaf('ENb'), leaf('An')]), pdn: series([leaf('An'), leaf('EN')]) },
        ],
      };
  }
}

/** Leaves of a network in drawing order (top to bottom, left to right). */
export function leavesOf(net: Net): string[] {
  if ('leaf' in net) return [net.leaf];
  return ('series' in net ? net.series : net.parallel).flatMap(leavesOf);
}

/** The number of transistors a stage needs: one pMOS and one nMOS per signal use. */
export const stageTransistors = (s: Stage): number => leavesOf(s.pun).length + leavesOf(s.pdn).length;

export const cellTransistors = (c: Cell): number => c.stages.reduce((n, s) => n + stageTransistors(s), 0);

/** How many transistors expanding a gate costs. */
export const gateTransistors = (type: GateType, inputs: number): number => cellTransistors(cellFor(type, inputs));

/** Does the network conduct, given each transistor's gate signal → logic value? (pMOS conduct on 0, nMOS on 1.) */
export function conducts(net: Net, value: (sig: string) => number, p: boolean): boolean {
  if ('leaf' in net) return value(net.leaf) === (p ? 0 : 1);
  if ('series' in net) return net.series.every((n) => conducts(n, value, p));
  return net.parallel.some((n) => conducts(n, value, p));
}

/** Longest chain of leaves stacked one above the other (the number of gate-lead tracks a column needs). */
export function depthOf(net: Net): number {
  if ('leaf' in net) return 1;
  if ('series' in net) return net.series.reduce((s, n) => s + depthOf(n), 0);
  return Math.max(...net.parallel.map(depthOf));
}

/** One transistor of a cell, with the symbolic node each terminal sits on. */
export interface TransistorSpec {
  p: boolean;
  stage: number;
  /** Gate signal. */
  g: string;
  /** Node names: 'VDD', 'GND', a stage's output signal, or an inner node of a series stack. */
  d: string;
  s: string;
}

/**
 * The cell as a netlist: for each stage, the pull-up's transistors then the pull-down's, in the
 * order they are drawn (series top to bottom, parallel left to right). The layout is tested
 * against this: whatever is drawn must connect exactly these nodes.
 */
export function transistorsOf(cell: Cell): TransistorSpec[] {
  const out: TransistorSpec[] = [];
  cell.stages.forEach((st, stage) => {
    for (const p of [true, false]) {
      let k = 0;
      const walk = (net: Net, top: string, bottom: string): void => {
        if ('leaf' in net) out.push(p ? { p, stage, g: net.leaf, s: top, d: bottom } : { p, stage, g: net.leaf, d: top, s: bottom });
        else if ('parallel' in net) for (const n of net.parallel) walk(n, top, bottom);
        else {
          const nodes = [top, ...net.series.slice(1).map(() => `s${stage}${p ? 'p' : 'n'}${++k}`), bottom];
          net.series.forEach((n, i) => walk(n, nodes[i]!, nodes[i + 1]!));
        }
      };
      if (p) walk(st.pun, 'VDD', st.out);
      else walk(st.pdn, st.out, 'GND');
    }
  });
  return out;
}
