/**
 * Synthesis: optimise the AIG of a design.
 *
 * The front end already hashes structurally and propagates constants while it builds. This stage copies the
 * graph (dropping everything no output needs) and rebalances it: chains of ANDs become trees that combine the
 * shallowest operands first, which lowers the depth the LUT mapper starts from. Each pass keeps the source
 * elements each node came from.
 */
import { rebuild } from './aig';
import { mapLiterals, sinkLiterals, type Design } from './design';

export interface SynthPass {
  name: string;
  ands: number;
  depth: number;
}

export interface SynthTrace {
  passes: SynthPass[];
}

export interface SynthOptions {
  /** Balancing passes (default 2). */
  balancePasses?: number;
}

export function synthesise(d: Design, opts: SynthOptions = {}): { design: Design; trace: SynthTrace } {
  const passes: SynthPass[] = [];
  const measure = (name: string, dd: Design) => {
    const roots = sinkLiterals(dd);
    passes.push({ name, ands: dd.aig.andCount(roots), depth: dd.aig.depth(roots) });
  };
  measure('front end', d);
  let cur = d;
  const sweep = rebuild(cur.aig, sinkLiterals(cur), false);
  cur = mapLiterals(cur, sweep.aig, sweep.map);
  measure('sweep and rewrite', cur);
  for (let i = 0; i < (opts.balancePasses ?? 2); i++) {
    const r = rebuild(cur.aig, sinkLiterals(cur), true);
    cur = mapLiterals(cur, r.aig, r.map);
    measure(`balance ${i + 1}`, cur);
  }
  return { design: cur, trace: { passes } };
}
