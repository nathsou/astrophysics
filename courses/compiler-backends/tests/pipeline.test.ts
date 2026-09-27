import { describe, expect, it } from 'vitest';
import { compile, type PipelineOptions } from '../src/compiler/pipeline';
import { EXAMPLES } from '../src/examples';
import { runModule } from '../src/compiler/ir/interp';

const configs: [string, Partial<PipelineOptions>][] = [
  ['O0', { opt: 0 }],
  ['O1', { opt: 1 }],
  ['O2', { opt: 2 }],
  ['O2 linear-scan', { opt: 2, regalloc: 'linear' }],
  ['O2 no-coalesce', { opt: 2, coalesce: false }],
  ['O2 4 regs', { opt: 2, maxRegs: 4 }],
  ['O2 3 regs linear', { opt: 2, maxRegs: 3, regalloc: 'linear' }],
  ['O1 no-M', { opt: 1, mExt: false }],
  ['O2 zba+zicond+fp', { opt: 2, zba: true, zicond: true, framePointer: true }],
  ['O2 post-sched no-peephole', { opt: 2, sched: 'post', peephole: false }],
  ['O0 no-sched no-remat', { opt: 0, sched: 'none', remat: false }],
];

describe('rv64 end-to-end', () => {
  for (const ex of EXAMPLES) {
    for (const [name, o] of configs) {
      it(`${ex.id} @ ${name}`, () => {
        const r = compile(ex.src, { target: 'rv64', ...o });
        expect(r.error?.msg).toBeUndefined();
        const ref = runModule(r.lowered!);
        expect(ref.error).toBeUndefined();
        if (ex.expect) expect(ref.output).toBe(ex.expect);
        expect(r.interp!.output).toBe(ref.output);
        expect(r.emu!.error).toBeUndefined();
        expect(r.emu!.output).toBe(ref.output);
        expect(BigInt.asUintN(64, r.emu!.exitCode)).toBe(BigInt.asUintN(64, ref.exitCode));
      });
    }
  }
});
