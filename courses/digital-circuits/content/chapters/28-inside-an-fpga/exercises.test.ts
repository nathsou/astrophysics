import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';

/**
 * The quiz, parsons and bug blocks of Chapter 28 must be valid YAML of the shape the exercise components read (a stray
 * unquoted “: ” in an option breaks the build for every chapter), and their answers must be well formed.
 */
const md = readFileSync(fileURLToPath(new URL('./index.md', import.meta.url)), 'utf8');
const blocks = [...md.matchAll(/```(quiz|parsons|bug)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1]!, spec: YAML.parse(m[2]!) as Record<string, unknown> }));

describe('exercise blocks', () => {
  test('there are quizzes, a parsons problem and a bug hunt', () => {
    const kinds = blocks.map((b) => b.kind);
    expect(kinds.filter((k) => k === 'quiz').length).toBeGreaterThanOrEqual(5);
    expect(kinds).toContain('parsons');
    expect(kinds).toContain('bug');
  });
  for (const [i, b] of blocks.entries()) {
    test(`block ${i + 1} (${b.kind}) is well formed`, () => {
      if (b.kind === 'quiz') {
        const options = b.spec.options as { text: string; correct?: boolean; why: string }[];
        expect(typeof b.spec.q).toBe('string');
        expect(options.length).toBeGreaterThanOrEqual(3);
        expect(options.filter((o) => o.correct).length).toBe(1);
        for (const o of options) {
          expect(typeof o.text).toBe('string');
          expect(typeof o.why).toBe('string');
        }
      } else if (b.kind === 'parsons') {
        expect((b.spec.lines as string[]).length).toBeGreaterThan(3);
        expect((b.spec.lines as string[]).every((l) => typeof l === 'string')).toBe(true);
        expect((b.spec.distractors as string[]).every((l) => typeof l === 'string')).toBe(true);
      } else {
        const lines = b.spec.lines as string[];
        expect(lines.every((l) => typeof l === 'string')).toBe(true);
        expect(b.spec.wrong).toBeGreaterThanOrEqual(0);
        expect(b.spec.wrong as number).toBeLessThan(lines.length);
        expect(typeof b.spec.why).toBe('string');
        for (const k of Object.keys(b.spec.notes as Record<string, string>)) expect(Number(k)).toBeLessThan(b.spec.wrong as number);
      }
    });
  }
});

describe('the arithmetic of the exercises', () => {
  test('an AND table and an XOR table over two inputs, repeated over two more, differ in 12 of 16 places: 96 for eight cells', () => {
    const and = 0x8888;
    const xor = 0x6666;
    let d = 0;
    for (let i = 0; i < 16; i++) d += ((and ^ xor) >> i) & 1;
    expect(d).toBe(12);
    expect(8 * d).toBe(96);
  });

  test('a LUT6 has 64 bits, seven LUT4s hold 112, and a LUT4 has 2^16 = 65,536 functions', () => {
    expect(2 ** 6).toBe(64);
    expect(7 * 2 ** 4).toBe(112);
    expect(2 ** 16).toBe(65536);
  });

  test('sixteen SRAM cells of six transistors are 96, against eight for a 4-input NAND: twelve times', () => {
    expect((16 * 6) / 8).toBe(12);
  });

  test('the iCE40 HX1K loads 34,112 bytes in 23 ms at one bit per clock of 12 MHz', () => {
    expect(Math.round(((34112 * 8) / 12e6) * 1000)).toBe(23);
  });

  test('a logic tile of the iCE40: 54 × 16 = 864 bits, of which 8 cells × 20 = 160 are the cells’ (a fifth)', () => {
    expect(54 * 16).toBe(864);
    expect(Math.round((100 * 160) / 864)).toBe(19);
  });
});
