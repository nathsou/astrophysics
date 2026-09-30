/**
 * The routing to draw, as a flat list of connections between routing nodes: from the flow's route trees (design mode,
 * with the net each belongs to) or from the multiplexer selections in the bits (by hand).
 */
import { NK, type VFpgaDevice } from '../../pld/devices/vfpga';
import { readSelect } from '../../pld/devices/vfpga-config';
import type { FpgaResult } from './types';

export interface RouteEdges {
  /** Triples [driver node, driven node, net] (net −1 when unknown). */
  edges: Int32Array;
  count: number;
}

/** From the route trees of a flow result: one edge per node with a parent. */
export function edgesFromResult(r: FpgaResult): RouteEdges {
  let n = 0;
  for (const t of r.route.nets) n += t.nodes.length;
  const edges = new Int32Array(n * 3);
  let k = 0;
  for (const t of r.route.nets) {
    for (let i = 1; i < t.nodes.length; i++) {
      const p = t.parents[i]!;
      if (p < 0) continue;
      edges[k++] = t.nodes[p]!;
      edges[k++] = t.nodes[i]!;
      edges[k++] = t.index;
    }
  }
  return { edges: edges.subarray(0, k), count: k / 3 };
}

/** From the bits: every configured multiplexer is an edge from the input it selects. Cheap on the small device only. */
export function edgesFromBits(dev: VFpgaDevice, bits: Uint8Array): RouteEdges {
  const list: number[] = [];
  for (let n = 0; n < dev.nodeCount; n++) {
    if (dev.cfgOffset[n]! < 0 || dev.nodeKind[n] === NK.GCLK) continue;
    const { input } = readSelect(dev, bits, n);
    if (input >= 0) list.push(input, n, -1);
  }
  return { edges: Int32Array.from(list), count: list.length / 3 };
}

/** The set of nodes touched by the edges. */
export function nodesOf(e: RouteEdges): Set<number> {
  const s = new Set<number>();
  for (let i = 0; i < e.count; i++) {
    s.add(e.edges[3 * i]!);
    s.add(e.edges[3 * i + 1]!);
  }
  return s;
}
