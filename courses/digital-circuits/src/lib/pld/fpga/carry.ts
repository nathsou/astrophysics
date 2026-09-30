/**
 * Carry-chain inference.
 *
 * A ripple-carry adder, whatever gates it was written with (an `adder` block, XOR/MAJ full adders, a DCL `+`), is
 * recognised on the AIG by *function*, not by structure:
 *
 * - a **carry node** has a 3-leaf cut {a, b, c} whose truth table is the majority function (up to complementing
 *   the node's value, and the carry input's polarity),
 * - its **sum node** is a node with a cut on the same three leaves whose function is their parity,
 * - stage i + 1 is linked to stage i when its carry-input leaf is stage i's carry node.
 *
 * A chain starts with either a 2-leaf pair (AND and XOR of a, b: a carry-in of constant 0; OR and XNOR: constant
 * 1) or a 3-leaf stage whose carry-in is any node. A link is accepted only when nothing outside stage i + 1 reads
 * the carry node of stage i and nothing outside the stage reads the intermediate nodes that depend on it,
 * because the carry between logic cells is a dedicated wire that only the next cell can see.
 *
 * Each chain becomes logic cells in a column: cell i has I1 = a, I2 = b, its carry input from cell i − 1, and the
 * LUT computes the sum from (I1, I2, carry); a start with a signal as carry-in adds one cell that injects the
 * signal (I1 = I2 = the signal, so MAJ gives it back); a carry-out that something reads adds one cell that
 * reads the carry through its LUT.
 *
 * Operands and carry-in may appear inverted in the AIG (the polarity of a node is arbitrary: an XOR is stored
 * as the complement of an AND): a stage records its operands as *literals*, and the mapper gives the cell the
 * polarity it needs (a LUT that feeds only the chain is simply stored in the right polarity).
 */
import type { Aig } from './aig';
import { mergeCuts, dominates, type Cut } from './cuts';

export interface CarryStage {
  /** Operand literals: their values are the I1 and I2 pins of the cell. */
  a: number;
  b: number;
  /** Sum node: the node's value = a ⊕ b ⊕ carry-in ⊕ sumPol. */
  sum: number;
  sumPol: 0 | 1;
  /** Carry node: the node's value = carry-out ⊕ carryPol. −1 for a final stage whose carry-out nobody reads. */
  carry: number;
  carryPol: 0 | 1;
}

export interface CarryChain {
  stages: CarryStage[];
  cin: { kind: 'const'; value: 0 | 1 } | { kind: 'lit'; lit: number };
  /** Something reads the last stage's carry-out: a readout cell follows the chain. */
  readout: boolean;
}

export interface CarryPlan {
  chains: CarryChain[];
  /** Nodes provided by chain cells (sum nodes and read-out carries): the mapper treats them as inputs. */
  leaf: Uint8Array;
  /** Literals the chains need as signals (operands and carry-in signals), in addition to the design's sinks. */
  extraRoots: number[];
  /** Stages found before filtering by length and the validity of links. */
  candidates: number;
}

const popcount3 = (x: number) => (x & 1) + ((x >> 1) & 1) + ((x >> 2) & 1);

/** tt (8 bits) → the two ways to write it as MAJ(x0^pv0, x1^pv1, x2^pv2) ^ po (complementing everything gives the second). */
const MAJ_FAMILY = new Map<number, { pv: number; po: 0 | 1 }[]>();
for (let pv = 0; pv < 8; pv++) {
  for (let po = 0; po < 2; po++) {
    let tt = 0;
    for (let r = 0; r < 8; r++) {
      const x0 = (r & 1) ^ (pv & 1);
      const x1 = ((r >> 1) & 1) ^ ((pv >> 1) & 1);
      const x2 = ((r >> 2) & 1) ^ ((pv >> 2) & 1);
      tt |= (((x0 + x1 + x2) >= 2 ? 1 : 0) ^ po) << r;
    }
    const list = MAJ_FAMILY.get(tt) ?? [];
    list.push({ pv, po: po as 0 | 1 });
    MAJ_FAMILY.set(tt, list);
  }
}

/** tt (4 bits) of a 2-leaf function → how to see it as a carry-out of a stage with constant carry-in. */
const CARRY2 = new Map<number, { pa: number; pb: number; po: 0 | 1; cin: 0 | 1 }>();
for (const cin of [0, 1] as const) {
  for (let pa = 0; pa < 2; pa++) {
    for (let pb = 0; pb < 2; pb++) {
      for (let po = 0; po < 2; po++) {
        let tt = 0;
        for (let r = 0; r < 4; r++) {
          const a = (r & 1) ^ pa;
          const b = ((r >> 1) & 1) ^ pb;
          tt |= ((cin ? a | b : a & b) ^ po) << r;
        }
        const old = CARRY2.get(tt);
        if (!old || pa + pb < old.pa + old.pb) CARRY2.set(tt, { pa, pb, po: po as 0 | 1, cin });
      }
    }
  }
}

interface Candidate {
  v: number;
  leaves: number[];
  /** The ways to write the function as a majority (3 leaves). */
  reps: { pv: number; po: 0 | 1 }[];
  /** For 2-leaf starts: the constant carry-in and the polarities of the operands and of the result. */
  two?: { pa: number; pb: number; po: 0 | 1; cin: 0 | 1 };
  sum: number;
  sumTt: number;
}

export function detectCarryChains(aig: Aig, roots: readonly number[], opts: { minStages?: number } = {}): CarryPlan {
  const minStages = opts.minStages ?? 2;
  const n = aig.n;
  const empty: CarryPlan = { chains: [], leaf: new Uint8Array(n), extraRoots: [], candidates: 0 };
  const need = aig.reachable(roots);
  // References among needed nodes (fanins of needed AND nodes and roots).
  const refs = new Int32Array(n);
  for (let v = 1; v < n; v++) {
    if (need[v] && aig.isAnd(v)) {
      refs[aig.fan0[v]! >> 1]!++;
      refs[aig.fan1[v]! >> 1]!++;
    }
  }
  for (const r of roots) refs[r >> 1]!++;

  // 3-cuts of every needed node.
  const cuts: Cut[][] = new Array(n);
  for (let v = 1; v < n; v++) {
    if (!need[v]) continue;
    if (!aig.isAnd(v)) {
      cuts[v] = [{ leaves: [v], tt: 2 }];
      continue;
    }
    const f0 = aig.fan0[v]!;
    const f1 = aig.fan1[v]!;
    const list: Cut[] = [];
    for (const x of cuts[f0 >> 1]!) {
      for (const y of cuts[f1 >> 1]!) {
        const m = mergeCuts(x, f0 & 1, y, f1 & 1, 3);
        if (!m) continue;
        if (list.some((e) => dominates(e.leaves, m.leaves))) continue;
        for (let i = list.length - 1; i >= 0; i--) if (dominates(m.leaves, list[i]!.leaves)) list.splice(i, 1);
        list.push(m);
      }
    }
    list.sort((p, q) => p.leaves.length - q.leaves.length);
    if (list.length > 16) list.length = 16;
    cuts[v] = [...list, { leaves: [v], tt: 2 }];
  }

  // Sum nodes by leaf set.
  const key = (leaves: number[]) => leaves.join(',');
  const sumBy = new Map<string, { node: number; tt: number }>();
  /** 3-leaf sums by each of their leaves, for chains whose last carry is never read. */
  const sumsWith = new Map<number, { node: number; tt: number; leaves: number[] }[]>();
  for (let v = 1; v < n; v++) {
    if (!need[v] || !aig.isAnd(v)) continue;
    for (const c of cuts[v]!) {
      if ((c.leaves.length === 3 && (c.tt === 0x96 || c.tt === 0x69)) || (c.leaves.length === 2 && (c.tt === 0x6 || c.tt === 0x9))) {
        const k = key(c.leaves);
        if (!sumBy.has(k)) sumBy.set(k, { node: v, tt: c.tt });
        if (c.leaves.length === 3) {
          for (const l of c.leaves) {
            const list = sumsWith.get(l) ?? [];
            list.push({ node: v, tt: c.tt, leaves: c.leaves });
            sumsWith.set(l, list);
          }
        }
      }
    }
  }
  if (sumBy.size === 0) return empty;

  // Candidate stages, one per carry node.
  const cand = new Map<number, Candidate>();
  for (let v = 1; v < n; v++) {
    if (!need[v] || !aig.isAnd(v)) continue;
    for (const c of cuts[v]!) {
      const s = sumBy.get(key(c.leaves));
      if (!s || s.node === v) continue;
      if (c.leaves.length === 3) {
        const reps = MAJ_FAMILY.get(c.tt);
        if (reps) {
          cand.set(v, { v, leaves: c.leaves, reps, sum: s.node, sumTt: s.tt });
          break;
        }
      } else if (c.leaves.length === 2) {
        const two = CARRY2.get(c.tt);
        if (two) {
          cand.set(v, { v, leaves: c.leaves, reps: [], two, sum: s.node, sumTt: s.tt });
          break;
        }
      }
    }
  }
  if (cand.size === 0) return empty;

  // Region check for linking stage `x` to the stage whose carry node is `u`.
  const linkValid = (rootNodes: number[], leaves: number[], u: number): boolean => {
    const leafSet = new Set(leaves);
    const region: number[] = [];
    const inRegion = new Set<number>();
    const stack = [...rootNodes];
    while (stack.length) {
      const w = stack.pop()!;
      if (inRegion.has(w) || leafSet.has(w)) continue;
      if (!aig.isAnd(w)) return false;
      inRegion.add(w);
      region.push(w);
      stack.push(aig.fan0[w]! >> 1, aig.fan1[w]! >> 1);
    }
    region.sort((p, q) => p - q);
    // Edges into each node from inside the region.
    const inEdges = new Map<number, number>();
    for (const w of region) {
      for (const f of [aig.fan0[w]! >> 1, aig.fan1[w]! >> 1]) inEdges.set(f, (inEdges.get(f) ?? 0) + 1);
    }
    if ((inEdges.get(u) ?? 0) !== refs[u]) return false;
    // Nodes of the region that depend on u must be read only inside it (except the two roots).
    const dep = new Set<number>();
    for (const w of region) {
      const a = aig.fan0[w]! >> 1;
      const b = aig.fan1[w]! >> 1;
      if (a === u || b === u || dep.has(a) || dep.has(b)) dep.add(w);
    }
    for (const w of dep) {
      if (rootNodes.includes(w)) continue;
      if ((inEdges.get(w) ?? 0) !== refs[w]) return false;
    }
    return true;
  };

  const pred = new Map<number, { u: number; j: number }>();
  const succ = new Map<number, number>();
  for (const v of [...cand.keys()].sort((p, q) => p - q)) {
    const x = cand.get(v)!;
    if (x.two) continue;
    for (let j = 0; j < 3; j++) {
      const u = x.leaves[j]!;
      const y = cand.get(u);
      if (!y || succ.has(u) || u === v) continue;
      if (!linkValid([x.v, x.sum], x.leaves, u)) continue;
      pred.set(v, { u, j });
      succ.set(u, v);
      break;
    }
  }

  const chains: CarryChain[] = [];
  const leaf = new Uint8Array(n);
  const extra: number[] = [];
  const claimed = new Set<number>();
  for (const v of [...cand.keys()].sort((p, q) => p - q)) {
    if (pred.has(v)) continue;
    const stages: CarryStage[] = [];
    let cin: CarryChain['cin'];
    let curV: number | undefined = v;
    /** Polarity of the previous carry node relative to the logical carry. */
    let prevPo = 0;
    let first = true;
    while (curV !== undefined) {
      const x = cand.get(curV)!;
      let a: number;
      let b: number;
      let carryPol: 0 | 1;
      let sumPol: number;
      const sumRaw = (x.two ? (x.sumTt === 0x9 ? 1 : 0) : x.sumTt === 0x69 ? 1 : 0) as number;
      if (x.two) {
        // Only a chain start has two leaves.
        a = (x.leaves[0]! << 1) | x.two.pa;
        b = (x.leaves[1]! << 1) | x.two.pb;
        cin = { kind: 'const', value: x.two.cin };
        carryPol = x.two.po;
        sumPol = sumRaw ^ x.two.pa ^ x.two.pb ^ x.two.cin;
      } else if (first) {
        // The carry-in is the leaf that arrives last; choose the way of writing the majority with fewer inverted operands.
        const order = [0, 1, 2].sort((p, q) => aig.level[x.leaves[q]!]! - aig.level[x.leaves[p]!]! || x.leaves[q]! - x.leaves[p]!);
        const jc = order[0]!;
        const others = [0, 1, 2].filter((i) => i !== jc);
        const flips = (r: { pv: number }) => others.reduce((s, i) => s + ((r.pv >> i) & 1), 0);
        const rep = x.reps.slice().sort((p, q) => flips(p) - flips(q))[0]!;
        const pa = (rep.pv >> others[0]!) & 1;
        const pb = (rep.pv >> others[1]!) & 1;
        const pc = (rep.pv >> jc) & 1;
        a = (x.leaves[others[0]!]! << 1) | pa;
        b = (x.leaves[others[1]!]! << 1) | pb;
        cin = { kind: 'lit', lit: (x.leaves[jc]! << 1) | pc };
        carryPol = rep.po;
        sumPol = sumRaw ^ pa ^ pb ^ pc;
      } else {
        const p = pred.get(curV)!;
        const others = [0, 1, 2].filter((i) => i !== p.j);
        const rep = x.reps.find((r) => ((r.pv >> p.j) & 1) === prevPo)!;
        const pa = (rep.pv >> others[0]!) & 1;
        const pb = (rep.pv >> others[1]!) & 1;
        a = (x.leaves[others[0]!]! << 1) | pa;
        b = (x.leaves[others[1]!]! << 1) | pb;
        carryPol = rep.po;
        sumPol = sumRaw ^ pa ^ pb ^ prevPo;
      }
      first = false;
      stages.push({ a, b, sum: x.sum, sumPol: sumPol as 0 | 1, carry: x.v, carryPol });
      prevPo = carryPol;
      curV = succ.get(curV);
    }
    // A last stage whose carry-out nobody reads has no carry node: only its sum exists.
    {
      const lastCarry = stages[stages.length - 1]!.carry;
      for (const w of sumsWith.get(lastCarry) ?? []) {
        if (claimed.has(w.node) || stages.some((s) => s.sum === w.node)) continue;
        const others = w.leaves.filter((l) => l !== lastCarry);
        if (!linkValid([w.node], w.leaves, lastCarry)) continue;
        // The operands are the other two leaves in positive form; the sum polarity absorbs the difference.
        stages.push({ a: others[0]! << 1, b: others[1]! << 1, sum: w.node, sumPol: ((w.tt === 0x69 ? 1 : 0) ^ prevPo) as 0 | 1, carry: -1, carryPol: 0 });
        break;
      }
    }
    if (stages.length < minStages) continue;
    // Operands and sums must not be claimed by another chain as carry/sum nodes.
    if (stages.some((s) => claimed.has(s.sum) || (s.carry >= 0 && claimed.has(s.carry)))) continue;
    for (const s of stages) {
      claimed.add(s.sum);
      if (s.carry >= 0) claimed.add(s.carry);
    }
    const last = stages[stages.length - 1]!;
    const readout = last.carry >= 0 && refs[last.carry]! > 0;
    chains.push({ stages, cin: cin!, readout });
  }

  for (const c of chains) {
    for (const s of c.stages) {
      leaf[s.sum] = 1;
      extra.push(s.a, s.b);
    }
    if (c.readout) leaf[c.stages[c.stages.length - 1]!.carry] = 1;
    if (c.cin.kind === 'lit') extra.push(c.cin.lit);
  }
  return { chains, leaf, extraRoots: extra, candidates: cand.size };
}
