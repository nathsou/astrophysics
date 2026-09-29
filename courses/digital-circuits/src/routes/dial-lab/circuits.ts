/**
 * Circuits for reviewing the abstraction dial: one gate each, a half adder, a 2:1 multiplexer and a
 * six-input parity tree that is too big for the analog level.
 */
import { getDef, pinsOf, transformPoint, withDefaults } from '$lib/sim/netlist/catalog';
import type { Circuit, Params, Placed, Wire } from '$lib/sim/netlist/types';

/** One gate with a switch on every input and an indicator on its output. */
export function single(type: string, inputs = 2): Circuit {
  const def = getDef(type)!;
  const params: Params = ['not', 'buffer', 'tristate'].includes(type) ? {} : { inputs };
  const gate: Placed = { id: 'U1', type, x: 12, y: 0, params };
  const components: Placed[] = [gate];
  const wires: Wire[] = [];
  let out: [number, number] = [0, 0];
  let row = 0;
  for (const p of pinsOf(def, withDefaults(def, params))) {
    const [px, py] = transformPoint(p, gate);
    if (p.dir === 'out') {
      out = [px, py];
      continue;
    }
    if (p.name === 'EN') {
      components.push({ id: 'EN', type: 'toggle', x: px - 3, y: py - 4 });
      wires.push({ points: [[px, py - 4], [px, py]] });
    } else {
      const ty = row * 4;
      components.push({ id: p.name, type: 'toggle', x: 0, y: ty });
      wires.push({ points: ty === py ? [[3, ty], [px, py]] : [[3, ty], [8 - row, ty], [8 - row, py], [px, py]] });
      row++;
    }
  }
  components.push({ id: 'Y', type: 'indicator', x: out[0] + 4, y: out[1] });
  wires.push({ points: [out, [out[0] + 4, out[1]]] });
  return { version: 1, title: `${type.toUpperCase()} gate`, engine: 'digital', components, wires };
}

export const halfAdder: Circuit = {
  version: 1,
  title: 'Half adder',
  engine: 'digital',
  components: [
    { id: 'A', type: 'toggle', x: 0, y: 0 },
    { id: 'B', type: 'toggle', x: 0, y: 4 },
    { id: 'X1', type: 'xor', x: 10, y: 0 },
    { id: 'U1', type: 'and', x: 10, y: 6 },
    { id: 'S', type: 'indicator', x: 20, y: 1, label: 'S (sum)' },
    { id: 'C', type: 'indicator', x: 20, y: 7, label: 'C (carry)' },
  ],
  wires: [
    { points: [[3, 0], [10, 0]] },
    { points: [[5, 0], [5, 8], [10, 8]] },
    { points: [[3, 4], [7, 4], [7, 2], [10, 2]] },
    { points: [[7, 4], [7, 6], [10, 6]] },
    { points: [[16, 1], [20, 1]] },
    { points: [[16, 7], [20, 7]] },
  ],
};

/** Y = S ? B : A, built as (A · ¬S) + (B · S). */
export const mux2: Circuit = {
  version: 1,
  title: '2:1 multiplexer',
  engine: 'digital',
  components: [
    { id: 'S', type: 'toggle', x: 0, y: 0 },
    { id: 'A', type: 'toggle', x: 0, y: 6 },
    { id: 'B', type: 'toggle', x: 0, y: 12 },
    { id: 'N1', type: 'not', x: 8, y: 0 },
    { id: 'G1', type: 'and', x: 18, y: 4 },
    { id: 'G2', type: 'and', x: 18, y: 10 },
    { id: 'O1', type: 'or', x: 28, y: 7 },
    { id: 'Y', type: 'indicator', x: 38, y: 8 },
  ],
  wires: [
    { points: [[3, 0], [8, 0]] },
    { points: [[5, 0], [5, 10], [18, 10]] },
    { points: [[3, 6], [10, 6], [10, 4], [18, 4]] },
    { points: [[13, 0], [15, 0], [15, 6], [18, 6]] },
    { points: [[3, 12], [18, 12]] },
    { points: [[24, 5], [26, 5], [26, 7], [28, 7]] },
    { points: [[24, 11], [26, 11], [26, 9], [28, 9]] },
    { points: [[34, 8], [38, 8]] },
  ],
};

/** Six inputs, a tree of five XORs: 60 transistors, so the analog level is out of reach. */
export const parity6: Circuit = (() => {
  const components: Placed[] = [];
  const wires: Wire[] = [];
  const pin = (x: number, y: number, k: number): [number, number] => [x, y + 2 * k];
  for (let i = 0; i < 6; i++) components.push({ id: `I${i}`, type: 'toggle', x: 0, y: 6 * i });
  // First level: XOR of (I0, I1), (I2, I3), (I4, I5) at x = 12.
  const first = [1, 13, 25];
  first.forEach((y, g) => {
    components.push({ id: `X${g}`, type: 'xor', x: 12, y });
    for (const k of [0, 1]) {
      const src: [number, number] = [3, 6 * (2 * g + k)];
      const dst = pin(12, y, k);
      const mx = 6 + k;
      wires.push({ points: [src, [mx, src[1]], [mx, dst[1]], dst] });
    }
  });
  // Second level: (X0 ^ X1) at x = 26; third level: (… ^ X2) at x = 40.
  components.push({ id: 'X3', type: 'xor', x: 26, y: 7 }, { id: 'X4', type: 'xor', x: 40, y: 13 });
  const link = (from: [number, number], to: [number, number], mx: number) => wires.push({ points: [from, [mx, from[1]], [mx, to[1]], to] });
  link([18, 2], pin(26, 7, 0), 22);
  link([18, 14], pin(26, 7, 1), 24);
  link([32, 8], pin(40, 13, 0), 36);
  link([18, 26], pin(40, 13, 1), 38);
  components.push({ id: 'P', type: 'indicator', x: 50, y: 14, label: 'parity' });
  wires.push({ points: [[46, 14], [50, 14]] });
  return { version: 1, title: 'Parity of six bits', engine: 'digital', components, wires };
})();

export const labCircuits: { key: string; circuit: Circuit; note?: string }[] = [
  { key: 'not', circuit: single('not') },
  { key: 'nand', circuit: single('nand', 2) },
  { key: 'nor', circuit: single('nor', 2) },
  { key: 'xor', circuit: single('xor', 2) },
  { key: 'half-adder', circuit: halfAdder },
  { key: 'mux2', circuit: mux2 },
  { key: 'parity6', circuit: parity6 },
];
