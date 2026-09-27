// Requires external tools; paths can be overridden with environment variables.
// Validates RISC-V output against GNU binutils: byte-identical .text vs riscv64-elf-as,
// readelf-clean objects/executables, and GNU ld-linked programs running in kiln's emulator.
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { compile } from '../src/compiler/pipeline';
import { EXAMPLES } from '../src/examples';
import { listingText } from '../src/compiler/listing';
import { runtimeObject, RUNTIME_ASM } from '../src/compiler/obj/runtime';
import { parseElf } from '../src/compiler/obj/elf';
import { runExecutable } from '../src/compiler/sim/rv64';
const BIN = process.env.RISCV_BINUTILS ?? '/opt/homebrew/opt/riscv64-elf-binutils/bin/riscv64-elf-';
const D = 'build/validate/rv64'; mkdirSync(D, { recursive: true });
const sh = (c: string) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
writeFileSync(`${D}/runtime.o`, runtimeObject());
writeFileSync(`${D}/runtime.s`, RUNTIME_ASM);
sh(`${BIN}as -march=rv64im -mno-relax ${D}/runtime.s -o ${D}/runtime.gnu.o`);
const cmpText = (a: string, b: string, what: string) => {
  const ta = parseElf(readFileSync(a)).sections.find(s => s.name === '.text')!.data;
  const tb = parseElf(readFileSync(b)).sections.find(s => s.name === '.text')!.data;
  const same = ta.length === tb.length && ta.every((x, i) => x === tb[i]);
  if (!same) { console.log(`MISMATCH ${what}`); console.log(sh(`${BIN}objdump -d ${a}`).split('\n').slice(6, 400).join('\n')); console.log(sh(`${BIN}objdump -d ${b}`).split('\n').slice(6, 400).join('\n')); }
  return same;
};
console.log('runtime text identical:', cmpText(`${D}/runtime.o`, `${D}/runtime.gnu.o`, 'runtime'));
let ok = 0, bad = 0;
for (const ex of EXAMPLES) for (const opts of [{ opt: 2 }, { opt: 0 }, { opt: 2, zba: true, zicond: true }, { opt: 1, mExt: false, maxRegs: 5 }] as const) {
  const r = compile(ex.src, { target: 'rv64', ...opts });
  if (!r.ok) { console.log('compile error', ex.id, r.error); bad++; continue; }
  const tag = `${ex.id}-${JSON.stringify(opts).replace(/\W+/g, '')}`;
  writeFileSync(`${D}/${tag}.s`, listingText(r.asm) + '\n');
  writeFileSync(`${D}/${tag}.o`, r.objBytes!);
  try { sh(`${BIN}as -march=rv64im_zba_zicond -mno-relax ${D}/${tag}.s -o ${D}/${tag}.gnu.o`); } catch (e: any) { console.log('GAS failed', tag, e.stderr); bad++; continue; }
  const same = cmpText(`${D}/${tag}.o`, `${D}/${tag}.gnu.o`, tag);
  const re = sh(`${BIN}readelf -a -W ${D}/${tag}.o 2>&1`);
  if (/warning|error/i.test(re)) { console.log('readelf complains', tag, re.split('\n').filter(l => /warn|err/i.test(l))); bad++; }
  // link with GNU ld and run the result in our emulator
  sh(`${BIN}ld -m elf64lriscv --no-relax -o ${D}/${tag}.gnu.exe ${D}/${tag}.o ${D}/runtime.o`);
  const out = runExecutable(readFileSync(`${D}/${tag}.gnu.exe`));
  writeFileSync(`${D}/${tag}.exe`, r.link!.exe);
  const re2 = sh(`${BIN}readelf -a -W ${D}/${tag}.exe 2>&1`);
  if (/warning|error/i.test(re2)) { console.log('readelf complains (exe)', tag, re2.split('\n').filter(l => /warn|err/i.test(l))); bad++; }
  const good = same && out.output === r.emu!.output && !out.error;
  if (good) ok++; else { bad++; console.log('FAIL', tag, { same, gnuOut: out.output, ours: r.emu!.output, err: out.error }); }
}
console.log({ ok, bad });
