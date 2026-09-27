// Requires external tools; paths can be overridden with environment variables.
// macOS on Apple Silicon only: assembles kiln's Darwin-flavoured AArch64 output with clang,
// links it against a tiny C runtime, runs it natively and compares with the IR interpreter.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { compile } from '../src/compiler/pipeline';
import { EXAMPLES } from '../src/examples';
import { listingText } from '../src/compiler/listing';
import { runModule } from '../src/compiler/ir/interp';
const D = 'build/validate/a64-native';
import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync(D, { recursive: true });
copyFileSync('scripts/emu/darwin_runtime.c', `${D}/runtime.c`);
let ok = 0, bad = 0;
const only = process.argv[2];
for (const ex of EXAMPLES) for (const opts of [{ opt: 2 }, { opt: 0 }, { opt: 1, maxRegs: 5 }, { opt: 2, regalloc: 'linear' as const }]) {
  if (only && ex.id !== only) continue;
  const r = compile(ex.src, { target: 'aarch64', darwin: true, asmOnly: true, ...opts });
  const tag = `${ex.id}-${JSON.stringify(opts).replace(/\W+/g, '')}`;
  if (!r.ok) { console.log('compile error', tag, r.error); bad++; continue; }
  writeFileSync(`${D}/${tag}.s`, listingText(r.asm) + '\n');
  try {
    execSync(`clang -arch arm64 ${D}/${tag}.s ${D}/runtime.c -o ${D}/${tag}.out 2>&1`, { encoding: 'utf8' });
    const out = execSync(`${D}/${tag}.out; echo "exit=$?"`, { encoding: 'utf8' });
    const ref = runModule(r.lowered!);
    const expect = ref.output + `exit=${Number(BigInt.asUintN(8, ref.exitCode))}\n`;
    if (out === expect) ok++; else { bad++; console.log('MISMATCH', tag, JSON.stringify(out), JSON.stringify(expect)); }
  } catch (e: any) { bad++; console.log('FAIL', tag, (e.stdout ?? '') + (e.message ?? '')); }
}
console.log({ ok, bad });
