/**
 * LUT mapping: cover an AIG with 4-input lookup tables.
 *
 * 1. **Cut enumeration** with priority cuts: for every AND node the cuts of its two fanins are merged (at most
 *    k = 4 leaves), dominated cuts are dropped and only the best `maxCuts` are kept, ordered by depth, then area
 *    flow, then size.
 * 2. **Depth-optimal labelling** (FlowMap-style): label(v) = 1 + min over cuts of the largest label among the
 *    cut's leaves. It is the smallest number of LUT levels that node v can have. FlowMap finds these labels with
 *    a max-flow computation; the cut enumeration here reaches the same labels whenever the best-depth cut is among
 *    the kept ones, which holds for every design in the tests (the kept set always contains the best-depth cut of
 *    every node, since depth is the first sort key and a best-depth cut of a node uses best-depth cuts of leaves).
 * 3. **Area recovery** with the depth of the deepest output as the required time: two passes of *area flow* (a
 *    cut costs 1 plus the area flow of its leaves divided by their fanout), then two passes of *exact local area*
 *    (dereference the node's cone, count what each candidate cut would newly reference, keep the smallest).
 *
 * Nodes marked as leaves (`isLeaf`) are treated like primary inputs: they are provided by something else (carry
 * chain outputs). Complemented edges cost nothing: the truth table of a LUT absorbs them.
 */
import type { Aig } from './aig';
import { dominates, mergeCuts, type Cut } from './cuts';

export interface MapOptions {
  k?: number;
  maxCuts?: number;
  /** Passes of area flow and of exact area after the depth-optimal mapping. */
  flowPasses?: number;
  exactPasses?: number;
}

export interface MapCut extends Cut {
  depth: number;
  aflow: number;
}

export interface MappedLut {
  node: number;
  /** Leaf nodes (sorted) and the truth table of `node` over them (positive polarity of the node). */
  leaves: number[];
  tt: number;
}

export interface MapTrace {
  passes: { name: string; luts: number; depth: number }[];
  /** Depth-optimal label of the deepest root. */
  optimalDepth: number;
}

export interface MapResult {
  luts: MappedLut[];
  /** Index into `luts` for each node, −1 if the node has no LUT. */
  lutOf: Int32Array;
  depth: number;
  trace: MapTrace;
}

export function mapLuts(aig: Aig, roots: readonly number[], isLeaf: Uint8Array | undefined, opts: MapOptions = {}): MapResult {
  const K = opts.k ?? 4;
  const C = opts.maxCuts ?? 8;
  const flowPasses = opts.flowPasses ?? 2;
  const exactPasses = opts.exactPasses ?? 2;
  const n = aig.n;
  const leafNode = (v: number) => !aig.isAnd(v) || (isLeaf !== undefined && isLeaf[v] === 1);

  // Nodes needed: from roots down through AND nodes that are not leaves.
  const need = new Uint8Array(n);
  for (const r of roots) need[r >> 1] = 1;
  for (let v = n - 1; v >= 1; v--) {
    if (need[v] && !leafNode(v)) {
      need[aig.fan0[v]! >> 1] = 1;
      need[aig.fan1[v]! >> 1] = 1;
    }
  }
  // Fanout estimate (within the needed subgraph).
  const fanout = new Int32Array(n);
  for (let v = 1; v < n; v++) {
    if (need[v] && !leafNode(v)) {
      fanout[aig.fan0[v]! >> 1]!++;
      fanout[aig.fan1[v]! >> 1]!++;
    }
  }
  for (const r of roots) fanout[r >> 1]!++;

  const label = new Int32Array(n);
  const aflow = new Float64Array(n);
  const cutsAll: MapCut[][] = new Array(n);
  const cutsSel: MapCut[][] = new Array(n);
  const choice: (MapCut | undefined)[] = new Array(n);

  const better = (a: MapCut, b: MapCut) => a.depth - b.depth || a.aflow - b.aflow || a.leaves.length - b.leaves.length;

  for (let v = 1; v < n; v++) {
    if (!need[v]) continue;
    if (leafNode(v)) {
      cutsAll[v] = [{ leaves: [v], tt: 2, depth: 0, aflow: 0 }];
      continue;
    }
    const f0 = aig.fan0[v]!;
    const f1 = aig.fan1[v]!;
    const list: MapCut[] = [];
    for (const x of cutsAll[f0 >> 1]!) {
      for (const y of cutsAll[f1 >> 1]!) {
        const m = mergeCuts(x, f0 & 1, y, f1 & 1, K);
        if (!m) continue;
        // Dominance: skip if an existing cut's leaves are a subset; drop cuts this one dominates.
        let dominated = false;
        for (const e of list) {
          if (dominates(e.leaves, m.leaves)) {
            dominated = true;
            break;
          }
        }
        if (dominated) continue;
        let depth = 0;
        let af = 1;
        for (const l of m.leaves) {
          if (label[l]! > depth) depth = label[l]!;
          af += aflow[l]! / Math.max(1, fanout[l]!);
        }
        const c: MapCut = { leaves: m.leaves, tt: m.tt, depth, aflow: af };
        for (let i = list.length - 1; i >= 0; i--) if (dominates(c.leaves, list[i]!.leaves)) list.splice(i, 1);
        list.push(c);
      }
    }
    list.sort(better);
    if (list.length > C) list.length = C;
    cutsSel[v] = list;
    const best = list[0]!;
    choice[v] = best;
    label[v] = best.depth + 1;
    aflow[v] = best.aflow;
    cutsAll[v] = [...list, { leaves: [v], tt: 2, depth: label[v]!, aflow: best.aflow }];
  }

  const nodes: number[] = [];
  for (let v = 1; v < n; v++) if (need[v] && !leafNode(v)) nodes.push(v);
  let Dmax = 0;
  for (const r of roots) if (!leafNode(r >> 1) && need[r >> 1]) Dmax = Math.max(Dmax, label[r >> 1]!);

  // Mapping state.
  const ref = new Int32Array(n);
  const arr = new Int32Array(n);
  const req = new Int32Array(n);
  const trace: MapTrace = { passes: [], optimalDepth: Dmax };

  const cover = () => {
    ref.fill(0);
    const stack: number[] = [];
    for (const r of roots) {
      const v = r >> 1;
      if (!leafNode(v) && need[v] && ref[v]!++ === 0) stack.push(v);
    }
    while (stack.length) {
      const v = stack.pop()!;
      for (const l of choice[v]!.leaves) if (!leafNode(l) && ref[l]!++ === 0) stack.push(l);
    }
  };
  const arrivals = () => {
    for (const v of nodes) {
      let a = 0;
      for (const l of choice[v]!.leaves) if (arr[l]! > a) a = arr[l]!;
      arr[v] = a + 1;
    }
  };
  const required = (D: number) => {
    req.fill(0x3fffffff);
    for (const r of roots) if (!leafNode(r >> 1)) req[r >> 1] = Math.min(req[r >> 1]!, D);
    for (let i = nodes.length - 1; i >= 0; i--) {
      const v = nodes[i]!;
      if (ref[v] === 0) continue;
      for (const l of choice[v]!.leaves) if (!leafNode(l)) req[l] = Math.min(req[l]!, req[v]! - 1);
    }
  };
  const count = () => {
    let c = 0;
    let d = 0;
    for (const v of nodes) if (ref[v]! > 0) c++;
    for (const r of roots) if (!leafNode(r >> 1) && need[r >> 1]) d = Math.max(d, arr[r >> 1]!);
    return { c, d };
  };
  const record = (name: string) => {
    const { c, d } = count();
    trace.passes.push({ name, luts: c, depth: d });
  };

  cover();
  arrivals();
  record('depth-optimal');

  // Area flow passes.
  for (let pass = 0; pass < flowPasses; pass++) {
    required(Dmax);
    for (const v of nodes) {
      let bestCut: MapCut | undefined;
      let bestAf = Infinity;
      const flow = (c: MapCut) => {
        let af = 1;
        for (const l of c.leaves) af += aflow[l]! / Math.max(1, ref[l]! > 0 ? ref[l]! : fanout[l]!);
        return af;
      };
      for (const c of cutsSel[v]!) {
        let a = 0;
        for (const l of c.leaves) if (arr[l]! > a) a = arr[l]!;
        if (a + 1 > req[v]!) continue;
        const af = flow(c);
        if (!bestCut || af < bestAf - 1e-9 || (Math.abs(af - bestAf) < 1e-9 && c.leaves.length < bestCut.leaves.length)) {
          bestAf = af;
          bestCut = c;
        }
      }
      if (!bestCut) {
        bestCut = cutsSel[v]![0]!;
        bestAf = flow(bestCut);
      }
      choice[v] = bestCut!;
      aflow[v] = bestAf;
      let a = 0;
      for (const l of bestCut!.leaves) if (arr[l]! > a) a = arr[l]!;
      arr[v] = a + 1;
    }
    cover();
    arrivals();
    record(`area flow ${pass + 1}`);
  }

  // Exact local area passes.
  const refNode = (v: number): number => {
    let a = 1;
    for (const l of choice[v]!.leaves) if (!leafNode(l) && ref[l]!++ === 0) a += refNode(l);
    return a;
  };
  const derefNode = (v: number): number => {
    let a = 1;
    for (const l of choice[v]!.leaves) if (!leafNode(l) && --ref[l]! === 0) a += derefNode(l);
    return a;
  };
  const refCut = (c: MapCut): number => {
    let a = 1;
    for (const l of c.leaves) if (!leafNode(l) && ref[l]!++ === 0) a += refNode(l);
    return a;
  };
  const derefCut = (c: MapCut): number => {
    let a = 1;
    for (const l of c.leaves) if (!leafNode(l) && --ref[l]! === 0) a += derefNode(l);
    return a;
  };
  for (let pass = 0; pass < exactPasses; pass++) {
    required(Dmax);
    for (const v of nodes) {
      if (ref[v] === 0) continue;
      const cur = choice[v]!;
      derefCut(cur);
      let bestCut = cur;
      let bestArea = Infinity;
      for (const c of cutsSel[v]!) {
        let a = 0;
        for (const l of c.leaves) if (arr[l]! > a) a = arr[l]!;
        if (a + 1 > req[v]!) continue;
        const area = refCut(c);
        derefCut(c);
        if (area < bestArea || (area === bestArea && c.leaves.length < bestCut.leaves.length)) {
          bestArea = area;
          bestCut = c;
        }
      }
      refCut(bestCut);
      choice[v] = bestCut;
      let a = 0;
      for (const l of bestCut.leaves) if (arr[l]! > a) a = arr[l]!;
      arr[v] = a + 1;
    }
    cover();
    arrivals();
    record(`exact area ${pass + 1}`);
  }

  const luts: MappedLut[] = [];
  const lutOf = new Int32Array(n).fill(-1);
  for (const v of nodes) {
    if (ref[v]! > 0) {
      const c = choice[v]!;
      lutOf[v] = luts.length;
      luts.push({ node: v, leaves: c.leaves, tt: c.tt });
    }
  }
  return { luts, lutOf, depth: count().d, trace };
}
