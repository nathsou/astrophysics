import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assembleOrThrow } from '../../src/lib/sim/cpu/rv32i/assembler';
import type { Logger, Runner } from './common';
import { ElfError, buildElf32, parseElf32 } from './elf';
import { buildTests, findCompiler, findTests, judgeTest, loadTest, main, runCore, runInterpreter } from './rv32i';
import { compareSignatures, formatSignature, parseSignature } from './signature';

const collect = (): Logger & { lines: string[] } => {
  const lines: string[] = [];
  return { lines, log: (l) => void lines.push(l), error: (l) => void lines.push(l) };
};

/** A little test in the shape of an architecture test: results into the signature area, then a write to tohost. */
const SOURCE = `
_start:
  addi x1, x0, 5
  addi x2, x0, -3
  add  x3, x1, x2
  sub  x4, x2, x1
  slli x5, x1, 4
  la   x10, begin_signature
  sw   x3, 0(x10)
  sw   x4, 4(x10)
  sw   x5, 8(x10)
  lw   x6, 0(x10)
  addi x6, x6, 100
  sw   x6, 12(x10)
  sb   x6, 16(x10)
  lbu  x7, 16(x10)
  sw   x7, 20(x10)
  li   x11, 1
  la   x12, tohost
  sw   x11, 0(x12)
done:
  j done
  .align 4
begin_signature:
  .word 0, 0, 0, 0, 0, 0
end_signature:
  .align 2
tohost:
  .word 0
`;
const EXPECTED = [2, 0xfffffff8, 80, 102, 102, 102];

function elfOf(source = SOURCE, vaddr = 0): Uint8Array {
  const p = assembleOrThrow(source);
  return buildElf32({ vaddr, image: p.image, entry: p.entry + vaddr, symbols: { begin_signature: p.symbols.begin_signature! + vaddr, end_signature: p.symbols.end_signature! + vaddr, tohost: p.symbols.tohost! + vaddr, _start: p.entry + vaddr } });
}

describe('signatures', () => {
  it('are one word per line, eight hexadecimal digits', () => {
    expect(formatSignature([1, 0xdeadbeef, -1])).toBe('00000001\ndeadbeef\nffffffff\n');
    expect(parseSignature('00000001\r\nDEADBEEF\n\nffffffff\n')).toEqual([1, 0xdeadbeef, 0xffffffff]);
    expect(() => parseSignature('0x1\n')).toThrow(/not a signature line/);
  });

  it('are compared word by word', () => {
    expect(compareSignatures([1, 2], [1, 2])).toBeUndefined();
    expect(compareSignatures([1, 3], [1, 2])).toBe('word 1: got 00000003, expected 00000002');
    expect(compareSignatures([1], [1, 2])).toMatch(/word 1: got <missing>, expected 00000002 \(1 words against 2\)/);
  });
});

describe('ELF files', () => {
  it('round-trip through the builder and the reader', () => {
    const bytes = elfOf(SOURCE, 0x80000000);
    const elf = parseElf32(bytes);
    expect(elf.entry).toBe(0x80000000);
    expect(elf.segments).toHaveLength(1);
    expect(elf.segments[0]!.vaddr).toBe(0x80000000);
    expect([...elf.symbols.keys()].sort()).toEqual(['_start', 'begin_signature', 'end_signature', 'tohost']);
  });

  it('are refused when they are something else', () => {
    expect(() => parseElf32(new Uint8Array(100))).toThrow(ElfError);
    const b = elfOf().slice();
    b[18] = 0x3e; // x86-64
    expect(() => parseElf32(b)).toThrow(/not a RISC-V ELF/);
    const c = elfOf().slice();
    c[4] = 2;
    expect(() => parseElf32(c)).toThrow(/not a 32-bit/);
  });

  it('are loaded at the lowest address, which becomes 0', () => {
    const t = loadTest(parseElf32(elfOf(SOURCE, 0x80000000)));
    expect(t.base).toBe(0x80000000);
    expect(t.entry).toBe(0);
    expect(t.begin).toBeLessThan(t.end);
    expect(t.end - t.begin).toBe(24);
    expect(t.memory.length).toBeGreaterThanOrEqual(0x10000);
  });

  it('need the signature symbols', () => {
    const p = assembleOrThrow('_start:\n  j _start\n');
    const b = buildElf32({ vaddr: 0, image: p.image, entry: 0, symbols: { _start: 0 } });
    expect(() => loadTest(parseElf32(b))).toThrow(/begin_signature/);
  });
});

describe('the machines', () => {
  const t = loadTest(parseElf32(elfOf()));

  it('the interpreter produces the expected signature', () => {
    const r = runInterpreter(t, 10_000);
    expect(r.error).toBeUndefined();
    expect(r.signature).toEqual(EXPECTED);
  });

  it('the DCL core, on the RTL simulator, produces the same signature', () => {
    const r = runCore(t, 20_000);
    expect(r.error).toBeUndefined();
    expect(r.signature).toEqual(EXPECTED);
  });

  it('a program that never writes tohost is reported', () => {
    const p = assembleOrThrow('_start:\n  j _start\n  .align 4\nbegin_signature:\n  .word 0\nend_signature:\n  .word 0\ntohost:\n  .word 0\n');
    const loop = loadTest(parseElf32(buildElf32({ vaddr: 0, image: p.image, entry: 0, symbols: { begin_signature: p.symbols.begin_signature!, end_signature: p.symbols.end_signature!, tohost: p.symbols.tohost! } })));
    expect(runInterpreter(loop, 3000).error).toMatch(/no write to tohost/);
    expect(runCore(loop, 500).error).toMatch(/no write to tohost/);
  });

  it('an illegal instruction is a trap', () => {
    const p = assembleOrThrow('_start:\n  .word 0\n  .align 4\nbegin_signature:\n  .word 0\nend_signature:\n  .word 0\ntohost:\n  .word 0\n');
    const bad = loadTest(parseElf32(buildElf32({ vaddr: 0, image: p.image, entry: 0, symbols: { begin_signature: p.symbols.begin_signature!, end_signature: p.symbols.end_signature!, tohost: p.symbols.tohost! } })));
    expect(runInterpreter(bad, 100).error).toMatch(/^trap: /);
    expect(runCore(bad, 100).error).toMatch(/illegal instruction/);
  });
});

describe('judging a test', () => {
  const test = { name: 'mini-01', elf: '/x/mini-01.elf' };
  const opts = { core: true, maxSteps: 10_000 };

  it('passes when both machines give the reference signature', () => {
    expect(judgeTest(test, elfOf(), opts, EXPECTED)).toMatchObject({ status: 'pass', problems: [] });
  });

  it('fails, saying which machine and which word, on a wrong reference', () => {
    const bad = [...EXPECTED];
    bad[2] = 81;
    const r = judgeTest(test, elfOf(), opts, bad);
    expect(r.status).toBe('fail');
    expect(r.problems.join('\n')).toMatch(/interpreter signature differs from the reference: word 2: got 00000050, expected 00000051/);
    expect(r.problems.join('\n')).toMatch(/DCL core signature differs from the reference: word 2/);
  });

  it('compares the machines with each other when there is no reference, and notices a difference', () => {
    expect(judgeTest(test, elfOf(), opts, undefined)).toMatchObject({ status: 'pass', note: expect.stringContaining('no reference_output') });
    const r = judgeTest(test, elfOf(), opts, undefined, {
      interpreter: (t, n) => ({ ...runInterpreter(t, n), signature: [9, 9, 9, 9, 9, 9] }),
      core: runCore,
    });
    expect(r.problems.join('')).toMatch(/DCL core signature differs from the interpreter's: word 0/);
  });

  it('skips the core on request and fails on an unreadable file', () => {
    expect(judgeTest(test, elfOf(), { ...opts, core: false }, EXPECTED).status).toBe('pass');
    expect(judgeTest(test, new Uint8Array(10), opts, undefined).problems[0]).toMatch(/cannot load mini-01\.elf: not an ELF file/);
  });
});

/** A checkout-shaped directory holding ELF files and their references. */
function checkout(tests: Record<string, number[]>, withElf = true): string {
  const root = mkdtempSync(path.join(tmpdir(), 'arch-test-'));
  mkdirSync(path.join(root, 'build'), { recursive: true });
  mkdirSync(path.join(root, 'riscv-test-suite/rv32i_m/I/references'), { recursive: true });
  for (const [name, sig] of Object.entries(tests)) {
    if (withElf) writeFileSync(path.join(root, 'build', `${name}.elf`), elfOf());
    writeFileSync(path.join(root, `riscv-test-suite/rv32i_m/I/references/${name}.reference_output`), formatSignature(sig));
  }
  return root;
}

describe('validate:rv32i', () => {
  it('skips when RISCV_ARCH_TEST is not set', async () => {
    const log = collect();
    expect(await main({ env: { PATH: '' }, log })).toBe(0);
    expect(log.lines).toHaveLength(1);
    expect(log.lines[0]).toMatch(/^skipped: riscv-arch-test not found — install .* or set RISCV_ARCH_TEST=/);
  });

  it('exits 1 when RISCV_ARCH_TEST is not a directory', async () => {
    expect(await main({ env: { PATH: '', RISCV_ARCH_TEST: '/no/such/dir' }, log: collect() })).toBe(1);
  });

  it('skips when there are no ELF files and no toolchain, naming the toolchain', async () => {
    const log = collect();
    expect(await main({ env: { PATH: '', RISCV_ARCH_TEST: checkout({}) }, log })).toBe(0);
    expect(log.lines[0]).toMatch(/^skipped: a RISC-V toolchain not found — install riscv64-unknown-elf-gcc .* or set RISCV_PREFIX=/);
  });

  it('finds tests and their references', () => {
    const root = checkout({ 'add-01': EXPECTED, 'sub-01': EXPECTED });
    expect(findTests(root).map((t) => [t.name, !!t.reference])).toEqual([['add-01', true], ['sub-01', true]]);
  });

  it('exits 0 when every signature matches, skipping the tests that need traps', async () => {
    const root = checkout({ 'add-01': EXPECTED, 'sub-01': EXPECTED, 'misalign-lw-01': [0], 'ecall-01': [0] });
    const log = collect();
    expect(await main({ env: { PATH: '', RISCV_ARCH_TEST: root }, log })).toBe(0);
    expect(log.lines.filter((l) => l.startsWith('  ok')).length).toBe(2);
    expect(log.lines.filter((l) => l.startsWith('  skip')).length).toBe(2);
    expect(log.lines.at(-1)).toBe('validate:rv32i: 2 passed, 0 failed, 2 skipped, of 4 tests');
  });

  it('exits 1 on a mismatch, and --only and --skip select tests', async () => {
    const bad = [...EXPECTED];
    bad[0] = 3;
    const root = checkout({ 'add-01': EXPECTED, 'sub-01': bad });
    const log = collect();
    expect(await main({ env: { PATH: '', RISCV_ARCH_TEST: root }, log })).toBe(1);
    expect(log.lines.join('\n')).toMatch(/FAIL {2}sub-01\n\s+interpreter signature differs from the reference: word 0: got 00000002, expected 00000003/);
    expect(await main({ env: { PATH: '', RISCV_ARCH_TEST: root }, log: collect(), args: ['--only', 'add', '--no-core'] })).toBe(0);
    expect(await main({ env: { PATH: '', RISCV_ARCH_TEST: root }, log: collect(), args: ['--skip', 'sub'] })).toBe(0);
    expect(await main({ env: { PATH: '', RISCV_ARCH_TEST: root }, log: collect(), args: ['--bogus'] })).toBe(2);
  });

  it('compiles with the documented command line', () => {
    const root = checkout({ 'add-01': EXPECTED }, false);
    mkdirSync(path.join(root, 'riscv-test-suite/rv32i_m/I/src'), { recursive: true });
    writeFileSync(path.join(root, 'riscv-test-suite/rv32i_m/I/src/add-01.S'), '');
    writeFileSync(path.join(root, 'riscv-test-suite/rv32i_m/I/src/bad-01.S'), '');
    const commands: string[][] = [];
    const run: Runner = (command, args) => {
      commands.push([command, ...args]);
      if (args[args.length - 1]!.endsWith('bad-01.S')) return { status: 1, stdout: '', stderr: 'Error: unknown opcode' };
      writeFileSync(args[args.indexOf('-o') + 1]!, elfOf());
      return { status: 0, stdout: '', stderr: '' };
    };
    const work = mkdtempSync(path.join(tmpdir(), 'arch-build-'));
    const built = buildTests(root, 'riscv64-unknown-elf-gcc', work, {}, run);
    expect(built.tests.map((t) => [t.name, !!t.reference])).toEqual([['add-01', true]]);
    expect(built.failures).toEqual([{ name: 'bad-01', message: 'Error: unknown opcode' }]);
    const cmd = commands[0]!.join(' ');
    expect(cmd).toMatch(/^riscv64-unknown-elf-gcc -march=rv32i_zicsr -mabi=ilp32 -static -mcmodel=medany -fvisibility=hidden -nostdlib -nostartfiles -T \S+riscv-target\/spike\/link\.ld -I \S+riscv-test-suite\/env -I \S+riscv-target\/spike -DXLEN=32 -DTEST_CASE_1=True -o \S+add-01\.elf \S+add-01\.S$/);
    // The built test then runs like a precompiled one.
    expect(judgeTest(built.tests[0]!, readFileSync(built.tests[0]!.elf), { core: true, maxSteps: 10_000 }, EXPECTED).status).toBe('pass');
  });

  it('finds a compiler by prefix', () => {
    expect(findCompiler({ PATH: '' })).toBeUndefined();
    const dir = mkdtempSync(path.join(tmpdir(), 'fake-gcc-'));
    writeFileSync(path.join(dir, 'riscv64-unknown-elf-gcc'), '#!/bin/sh\n', { mode: 0o755 });
    expect(findCompiler({ PATH: dir })).toBe(path.join(dir, 'riscv64-unknown-elf-gcc'));
    expect(findCompiler({ PATH: '', RISCV_PREFIX: path.join(dir, 'riscv64-unknown-elf-') })).toBe(path.join(dir, 'riscv64-unknown-elf-gcc'));
  });
});
