// Requires external tools; paths can be overridden with environment variables.
// Assembles x86-64 / AArch64 (Linux flavour) output with llvm-mc, links with ld.lld, and runs the
// executables under the Unicorn CPU emulator (UNICORN_PYTHON = a python with `pip install unicorn`).
// usage: npx tsx scripts/validate-emulated.ts x86_64|aarch64 [example]
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { compile } from '../src/compiler/pipeline';
import { EXAMPLES } from '../src/examples';
import { listingText } from '../src/compiler/listing';
import { runModule } from '../src/compiler/ir/interp';
const LLVM = process.env.LLVM_BIN ?? '/opt/homebrew/opt/llvm/bin', LLD = process.env.LLD ?? '/opt/homebrew/opt/lld/bin/ld.lld';
const PY = process.env.UNICORN_PYTHON ?? 'python3';
const target = (process.argv[2] ?? 'x86_64') as 'x86_64' | 'aarch64';
const triple = target === 'x86_64' ? 'x86_64-linux-gnu' : 'aarch64-linux-gnu';
const D = `build/validate/emu/${target}`; mkdirSync(D, { recursive: true });
execSync(`${LLVM}/llvm-mc -triple=${triple} -filetype=obj scripts/emu/rt_${target === 'x86_64' ? 'x86' : 'a64'}.s -o ${D}/rt.o`);
let ok = 0, bad = 0;
const only = process.argv[3];
const configs: any[] = [{ opt: 2 }, { opt: 0 }, { opt: 1, maxRegs: 5 }, { opt: 2, regalloc: 'linear' }, { opt: 2, maxRegs: 4, regalloc: 'linear' }, { opt: 2, sched: 'post', coalesce: false }];
for (const ex of EXAMPLES) for (const opts of configs) {
  if (only && ex.id !== only) continue;
  const tag = `${ex.id}-${JSON.stringify(opts).replace(/\W+/g, '')}`;
  const r = compile(ex.src, { target, asmOnly: true, ...opts });
  if (!r.ok) { console.log('compile error', tag, r.error); bad++; continue; }
  writeFileSync(`${D}/${tag}.s`, listingText(r.asm) + '\n');
  try {
    execSync(`${LLVM}/llvm-mc -triple=${triple} -filetype=obj ${D}/${tag}.s -o ${D}/${tag}.o 2>&1`);
    execSync(`${LLD} -static -o ${D}/${tag}.exe ${D}/${tag}.o ${D}/rt.o 2>&1`);
    const out = execSync(`${PY} scripts/emu/run_elf.py ${D}/${tag}.exe`, { encoding: 'utf8' });
    const ref = runModule(r.lowered!);
    const expect = ref.output + `exit=${Number(BigInt.asUintN(8, ref.exitCode))}\n`;
    if (out === expect) ok++; else { bad++; console.log('MISMATCH', tag, JSON.stringify(out), JSON.stringify(expect)); }
  } catch (e: any) { bad++; console.log('FAIL', tag, e.stdout?.toString(), e.message); }
}
console.log(target, { ok, bad });
