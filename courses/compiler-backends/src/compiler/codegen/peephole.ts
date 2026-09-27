// Peephole optimisation (McKeeman, "Peephole Optimization", CACM 1965):
// slide a small window over the final instruction stream and replace
// recognisable wasteful patterns. Runs after register allocation and frame
// lowering, when the exact registers and layout are known.

import type { Target } from '../target/target';
import type { MFunc } from './mir';

export interface PeepholeLog {
  rule: string;
  block: string;
  msg: string;
  instr: number;
}

export function runPeepholes(f: MFunc, t: Target, enabled?: Set<string>): PeepholeLog[] {
  const log: PeepholeLog[] = [];
  for (let changed = true, guard = 0; changed && guard < 50; guard++) {
    changed = false;
    f.blocks.forEach((b, bi) => {
      const next = f.blocks[bi + 1];
      for (let k = 0; k < b.instrs.length; k++) {
        for (const p of t.peepholes) {
          if (enabled && !enabled.has(p.name)) continue;
          const id = b.instrs[k]?.id;
          const msg = p.apply(f, b, k, next);
          if (msg) {
            log.push({ rule: p.name, block: b.name, msg, instr: id });
            changed = true;
          }
        }
      }
    });
    // drop blocks that became unreachable and empty? (never: labels may be targets)
  }
  f.computeCFG();
  return log;
}
