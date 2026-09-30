import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';
import { checkAsm, type AsmInput } from '$lib/components/exercise/asm/run';

/**
 * The `asm` exercises of Chapter 23: every block must be solvable (its own `solution` passes every test within the
 * limits), and the starting text must fail (an exercise that passes before you start is not an exercise). The tests
 * also try plausible wrong programs.
 */
const md = readFileSync(fileURLToPath(new URL('./index.md', import.meta.url)), 'utf8');
const blocks = [...md.matchAll(/```asm\n([\s\S]*?)```/g)].map((m) => YAML.parse(m[1]!) as AsmInput);

describe('the asm exercises', () => {
  test('the chapter has the four programs', () => {
    expect(blocks.map((b) => b.id)).toEqual(['run/sum-list', 'run/max', 'run/multiply', 'run/bcd']);
  });
  for (const b of blocks) {
    test(`${b.id}: the solution passes every test`, () => {
      expect(b.solution).toBeDefined();
      const r = checkAsm(b, b.solution!);
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(r.violations).toEqual([]);
      expect(r.results.filter((x) => !x.pass).map((x) => [x.name, x.failures])).toEqual([]);
      expect(r.pass).toBe(true);
    });
    test(`${b.id}: the starting text fails`, () => {
      const r = checkAsm(b, b.start!);
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(r.pass).toBe(false);
    });
    test(`${b.id}: every test has an expectation, and prompt and hints are there`, () => {
      expect(b.tests.length).toBeGreaterThanOrEqual(4);
      for (const t of b.tests) expect(Object.keys(t.expect ?? {}).length).toBeGreaterThan(0);
      expect(b.prompt).toBeTruthy();
      expect((b.hints ?? []).length).toBeGreaterThanOrEqual(2);
    });
  }

  test('multiply: the cycle limit rules out repeated addition, and the shift-and-add solution has room to spare', () => {
    const b = blocks.find((x) => x.id === 'run/multiply')!;
    const slow = `
        LD   R1, [x]
        LD   R2, [y]
        LDI  R0, 0
        LDI  R3, 1
        OR   R2, R2
        JZ   done
loop:   ADD  R0, R1
        SUB  R2, R3
        JNZ  loop
done:   HLT
x:      .byte 0
y:      .byte 0
`;
    const r = checkAsm(b, slow);
    expect(r.results.filter((x) => x.pass).length).toBeGreaterThan(0);
    expect(r.pass).toBe(false);
    expect(r.results.find((x) => x.name.startsWith('1 x 255'))!.pass).toBe(false);
    const good = checkAsm(b, b.solution!);
    expect(Math.max(...good.results.map((x) => x.cycles))).toBeLessThan(b.maxCycles! * 0.8);
  });

  test('max: a program that compares as signed numbers fails on 255', () => {
    const b = blocks.find((x) => x.id === 'run/max')!;
    const signed = b.solution!.replace('JNC  skip', 'JGE  skip');
    const r = checkAsm(b, signed);
    expect(r.pass).toBe(false);
  });

  test('sum: forgetting the empty list fails, and a sum that does not wrap would fail too', () => {
    const b = blocks.find((x) => x.id === 'run/sum-list')!;
    const noEmpty = b.solution!.replace('        CMP  R1, R2\n        JZ   done           ; empty list\n', '');
    expect(noEmpty).not.toBe(b.solution);
    const r = checkAsm(b, noEmpty);
    expect(r.pass).toBe(false);
    expect(r.results.find((x) => x.name === 'empty list')!.pass).toBe(false);
  });

  test('bcd: writing the number itself, not its digits, fails', () => {
    const b = blocks.find((x) => x.id === 'run/bcd')!;
    const wrong = '        LD R0, [n]\n        ST [HEX], R0\n        HLT\nn: .byte 0\n';
    expect(checkAsm(b, wrong).pass).toBe(false);
  });
});
