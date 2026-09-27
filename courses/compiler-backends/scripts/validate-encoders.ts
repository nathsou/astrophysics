// Requires external tools; paths can be overridden with environment variables.
// Compares kiln's AArch64 and x86-64 encoders byte-for-byte (and relocations) with llvm-mc.
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { compile } from '../src/compiler/pipeline';
import { EXAMPLES } from '../src/examples';
import { listingText } from '../src/compiler/listing';
import { parseElf } from '../src/compiler/obj/elf';
const LLVM = process.env.LLVM_BIN ?? '/opt/homebrew/opt/llvm/bin';
let ok = 0, bad = 0;
for (const target of ['aarch64', 'x86_64'] as const) {
  const triple = target === 'x86_64' ? 'x86_64-linux-gnu' : 'aarch64-linux-gnu';
  const D = `build/validate/enc/${target}`; mkdirSync(D, { recursive: true });
  for (const ex of EXAMPLES) for (const opts of [{ opt: 2 }, { opt: 0 }, { opt: 1, maxRegs: 5 }] as const) {
    const tag = `${ex.id}-${JSON.stringify(opts).replace(/\W+/g, '')}`;
    const r = compile(ex.src, { target, run: false, ...opts });
    if (!r.ok) { console.log('ERR', target, tag, r.error); bad++; continue; }
    writeFileSync(`${D}/${tag}.s`, listingText(r.asm) + '\n');
    writeFileSync(`${D}/${tag}.o`, r.objBytes!);
    execSync(`${LLVM}/llvm-mc -triple=${triple} -filetype=obj ${D}/${tag}.s -o ${D}/${tag}.ref.o`);
    const ours = parseElf(readFileSync(`${D}/${tag}.o`)), ref = parseElf(readFileSync(`${D}/${tag}.ref.o`));
    const ot = ours.sections.find(s => s.name === '.text')!.data, rt = ref.sections.find(s => s.name === '.text')!.data;
    let good = true;
    for (const s of ref.symbols.filter(s => s.type === 'FUNC')) {
      const os = ours.symbols.find(x => x.name === s.name)!;
      const a = rt.subarray(s.value, s.value + s.size), b = ot.subarray(os.value, os.value + os.size);
      if (a.length !== b.length || a.some((x, i) => x !== b[i])) { good = false; console.log('MISMATCH', target, tag, s.name); }
    }
    // relocations: same types against the same symbols
    const rs = (e: typeof ours) => e.relocs.filter(x => x.target === '.text').map(x => `${x.typeName}:${x.symName}:${x.addend}`).sort().join(',');
    if (rs(ours) !== rs(ref)) { good = false; console.log('RELOC MISMATCH', target, tag, '\n ours', rs(ours), '\n ref ', rs(ref)); }
    try { execSync(`${process.env.RISCV_BINUTILS ?? '/opt/homebrew/opt/riscv64-elf-binutils/bin/riscv64-elf-'}readelf -a -W ${D}/${tag}.o >/dev/null 2>&1`); } catch { good = false; console.log('readelf failed', tag); }
    if (good) ok++; else { bad++; if (bad < 3) { console.log(execSync(`${LLVM}/llvm-objdump -d ${D}/${tag}.ref.o`).toString().slice(0, 3000)); console.log(execSync(`${LLVM}/llvm-objdump -d ${D}/${tag}.o`).toString().slice(0, 3000)); } }
  }
}
console.log({ ok, bad });
