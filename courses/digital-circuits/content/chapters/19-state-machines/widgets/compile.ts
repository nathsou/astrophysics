/**
 * What the DCL compiler makes of the generated text: the flip-flops, gates and depth of the netlist it lowers to
 * (`lowerToNetlist`). It does not minimise (it turns a `match` into a decoder and AND–OR gates, as the manual
 * says); the two-level minimiser of `synth.ts` and the fitters of Chapter 26 do that.
 */
import { check, elaborate } from '$lib/hdl';
import { lowerToNetlist } from '$lib/hdl/lower';
import { moduleName } from './dcl';
import type { Fsm } from './fsm';

export interface CompileResult {
  ok: boolean;
  problems: string[];
  flipFlops: number;
  gates: number;
  /** Two-input gate equivalents. */
  gateEquivalents: number;
  depth: number;
}

export function compileStats(code: string, fsm: Fsm): CompileResult {
  const r = check(code, { file: 'fsm.dcl' });
  const errors = r.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message);
  if (errors.length) return { ok: false, problems: errors, flipFlops: 0, gates: 0, gateEquivalents: 0, depth: 0 };
  try {
    const low = lowerToNetlist(elaborate(r.program, moduleName(fsm.title)), undefined, { muxes: 'gates' });
    const s = low.stats;
    return { ok: true, problems: [], flipFlops: s.flipFlops, gates: s.gates, gateEquivalents: s.gateEquivalents, depth: s.depth };
  } catch (e) {
    return { ok: false, problems: [e instanceof Error ? e.message : String(e)], flipFlops: 0, gates: 0, gateEquivalents: 0, depth: 0 };
  }
}
