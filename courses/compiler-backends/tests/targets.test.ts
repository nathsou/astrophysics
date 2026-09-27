// AArch64 and x86-64: every example must compile, encode, and produce a
// well-formed ELF object. (Native/emulated execution of these targets is
// validated by scripts/validate-*.ts, which need LLVM and binutils installed.)
import { describe, expect, it } from 'vitest';
import { compile } from '../src/compiler/pipeline';
import { EXAMPLES } from '../src/examples';
import { parseElf } from '../src/compiler/obj/elf';

describe('aarch64 / x86-64 compile + encode', () => {
  for (const target of ['aarch64', 'x86_64'] as const) {
    for (const ex of EXAMPLES) {
      for (const o of [{ opt: 0 }, { opt: 2 }, { opt: 2, maxRegs: 4, regalloc: 'linear' }] as const) {
        it(`${target} ${ex.id} ${JSON.stringify(o)}`, () => {
          const r = compile(ex.src, { target, run: false, ...o });
          expect(r.error?.msg).toBeUndefined();
          const elf = parseElf(r.objBytes!);
          expect(elf.machine).toBe(target === 'aarch64' ? 183 : 62);
          for (const f of r.optimized!.funcs) {
            const s = elf.symbols.find((x) => x.name === f.name);
            expect(s?.type).toBe('FUNC');
            expect(s!.size).toBeGreaterThan(0);
          }
        });
      }
    }
  }
});

describe('encoders', () => {
  it('RISC-V constant materialisation round-trips through the emulator', () => {
    const consts = [0n, 1n, -1n, 2047n, 2048n, -2049n, 0x7fffffffn, 0x80000000n, -(1n << 31n), 0x123456789abcdef0n, -0x123456789abcdefn, 1n << 63n];
    for (const c of consts) {
      const r = compile(`fn main() { print(${BigInt.asIntN(64, c)}); return 0; }`, { target: 'rv64' });
      expect(r.emu!.output).toBe(`${BigInt.asIntN(64, c)}\n`);
    }
  });
});
