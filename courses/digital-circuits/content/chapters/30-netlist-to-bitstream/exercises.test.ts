import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { describe, expect, test } from 'vitest';

/**
 * The quiz, parsons and bug blocks of Chapter 30 must be valid YAML of the shape the exercise components read (a stray
 * unquoted “: ” in an option breaks the build for every chapter), and the arithmetic of the exercises must be right.
 */
const md = readFileSync(fileURLToPath(new URL('./index.md', import.meta.url)), 'utf8');
const blocks = [...md.matchAll(/```(quiz|parsons|bug)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1]!, spec: YAML.parse(m[2]!) as Record<string, unknown> }));

describe('exercise blocks', () => {
  test('there are quizzes (the predict questions among them), a parsons problem and a bug hunt', () => {
    const kinds = blocks.map((b) => b.kind);
    expect(kinds.filter((k) => k === 'quiz').length).toBeGreaterThanOrEqual(6);
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
  test('the bug hunt: 8.0 ns is 125 MHz; 4 LUTs of 0.5 ns and 0.5 ns of flip-flop leave 5.5 ns of wire (69 %); halving the LUTs gains 14 %', () => {
    expect(1000 / 8.0).toBe(125);
    expect(8.0 - 4 * 0.5 - 0.5).toBeCloseTo(5.5, 9);
    expect(Math.round((100 * 5.5) / 8.0)).toBe(69);
    const gain = 8.0 / (8.0 - 1.0) - 1;
    expect(Math.round(gain * 100)).toBe(14);
  });

  test('the challenge: 4.1 ns is 244 MHz; with two LUTs merged 3.2 ns is 312.5 MHz', () => {
    const before = 0.3 + 0.4 + 0.5 + 0.9 + 0.5 + 0.4 + 0.5 + 0.4 + 0.2;
    const after = before - 0.4 - 0.5;
    expect(before).toBeCloseTo(4.1, 9);
    expect(Math.round(1000 / before)).toBe(244);
    expect(after).toBeCloseTo(3.2, 9);
    expect(1000 / after).toBeCloseTo(312.5, 9);
  });

  test('the counter’s critical path: 0.3 + 0.1 + 0.5 + 0.1 + 0.5 + 0.4 + 0.8 = 2.7 ns, 370 MHz', () => {
    const p = 0.3 + 0.1 + 0.5 + 0.1 + 0.5 + 0.4 + 0.8;
    expect(p).toBeCloseTo(2.7, 9);
    expect(Math.round(1000 / p)).toBe(370);
  });

  test('PathFinder’s sharing factor: 0.5 × 1.4^15 = 78 at the sixteenth iteration', () => {
    expect(0.5 * 1.4 ** 15).toBeCloseTo(77.8, 0);
    expect([0, 1, 2, 3].map((i) => +(0.5 * 1.4 ** i).toFixed(2))).toEqual([0.5, 0.7, 0.98, 1.37]);
  });

  test('a prescaler of 22 bits at 12 MHz ticks every 0.35 s, and a 24-bit counter’s top bit blinks at 0.7 Hz', () => {
    expect(+((2 ** 22) / 12e6).toFixed(2)).toBe(0.35);
    expect(+(12e6 / 2 ** 24).toFixed(1)).toBe(0.7);
  });
});
