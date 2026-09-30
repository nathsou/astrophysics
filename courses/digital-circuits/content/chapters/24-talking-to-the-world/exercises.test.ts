import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';
import { checkAsm, type AsmInput } from '$lib/components/exercise/asm/run';

/**
 * The `asm` exercises of Chapter 24: every block must be solvable (its own `solution` passes every test), and the starting
 * text must fail. Plausible wrong programs are tried too: a program that ignores the mask, or compares as signed.
 */
const md = readFileSync(fileURLToPath(new URL('./index.md', import.meta.url)), 'utf8');
const blocks = [...md.matchAll(/```asm\n([\s\S]*?)```/g)].map((m) => YAML.parse(m[1]!) as AsmInput);
const by = (id: string) => blocks.find((b) => b.id === id)!;

describe('the asm exercises', () => {
  test('the chapter has the four programs', () => {
    expect(blocks.map((b) => b.id)).toEqual(['io/wait-button', 'io/popcount', 'io/upper', 'io/sar']);
  });
  for (const id of ['io/wait-button', 'io/popcount', 'io/upper', 'io/sar']) {
    test(`${id}: the solution passes every test and the starting text does not`, () => {
      const b = by(id);
      const r = checkAsm(b, b.solution!);
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(r.results.filter((x) => !x.pass).map((x) => [x.name, x.failures])).toEqual([]);
      expect(r.pass).toBe(true);
      const start = checkAsm(b, b.start!);
      expect(start.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(start.pass).toBe(false);
      expect(b.tests.length).toBeGreaterThanOrEqual(4);
      expect((b.hints ?? []).length).toBeGreaterThanOrEqual(2);
      expect(b.prompt).toBeTruthy();
      expect(b.explain).toBeTruthy();
    });
  }

  test('wait-button: ignoring the mask (looking at the whole register) is caught by the BTN1-only test', () => {
    const b = by('io/wait-button');
    const sloppy = `
wait:   LD   R0, [BUTTONS]
        OR   R0, R0
        JZ   wait
        LD   R0, [SWITCHES]
        ST   [LEDS], R0
        HLT
`;
    const r = checkAsm(b, sloppy);
    expect(r.pass).toBe(false);
    expect(r.results.find((x) => x.name.startsWith('only BTN1'))!.pass).toBe(false);
    expect(r.results.find((x) => x.name.startsWith('BTN0 pressed'))!.pass).toBe(true);
  });

  test('wait-button: not waiting at all is caught too', () => {
    const b = by('io/wait-button');
    const eager = 'LD R0, [SWITCHES]\nST [LEDS], R0\nHLT\n';
    const r = checkAsm(b, eager);
    expect(r.pass).toBe(false);
    expect(r.results.find((x) => x.name === 'no button: keeps waiting')!.pass).toBe(false);
  });

  test('upper: the characters next to the letters are left alone, and a program that shifts everything by 32 fails', () => {
    const b = by('io/upper');
    const naive = `
loop:   LD   R0, [CONSOLE]
        OR   R0, R0
        JZ   done
        LDI  R1, 32
        SUB  R0, R1
        ST   [CONSOLE], R0
        JMP  loop
done:   HLT
`;
    expect(checkAsm(b, naive).pass).toBe(false);
    // A program with the inclusive upper bound wrongly includes '{'.
    const off = b.solution!.replace("LDI  R1, 'z' + 1", "LDI  R1, 'z' + 2");
    expect(off).not.toBe(b.solution);
    expect(checkAsm(b, off).pass).toBe(false);
  });

  test('sar: the last comparison matters: without it the result is one short (and 0 and 1 are confused)', () => {
    const b = by('io/sar');
    const first = b.solution!.indexOf('ST   [DAC], R0');
    expect(first).toBeGreaterThan(0);
    const short = b.solution!.slice(0, first) + '        HLT\n';
    const r = checkAsm(b, short);
    expect(r.pass).toBe(false);
    expect(r.results.find((x) => x.name === '100')!.failures[0]).toContain('99');
  });

  test('sar: it really does use the DAC and the comparator, in eight or nine steps: under 600 cycles', () => {
    const b = by('io/sar');
    const r = checkAsm(b, b.solution!);
    expect(Math.max(...r.results.map((x) => x.cycles))).toBeLessThan(600);
  });

  test('popcount: reading the switches twice or counting the wrong bits fails', () => {
    const b = by('io/popcount');
    const wrong = b.solution!.replace('JNC  loop', 'JC   loop');
    expect(checkAsm(b, wrong).pass).toBe(false);
  });
});
