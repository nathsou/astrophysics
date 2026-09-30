import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { check, createRtlSim, elaborate, format, renderTestResult, runTests } from '$lib/hdl';
import { OctetMachine } from '$lib/sim/cpu/octet';

/**
 * The DCL of Chapter 21 — the ALU with its flags, and the register file — compiles, is formatted in the course's style,
 * passes its own tests, and gives, for every operation, the results and flags that the reference interpreter gives.
 */
const read = (name: string) => readFileSync(new URL(`./designs/${name}`, import.meta.url), 'utf8');

describe.each(['octet-alu.dcl', 'octet-regs.dcl'])('%s', (file) => {
  const src = read(file);
  test('compiles cleanly and is in the standard format', () => {
    expect(check(src, { file }).diagnostics).toEqual([]);
    expect(format(src).trim()).toBe(src.trim());
  });
  test('its own tests pass', () => {
    const r = runTests(src, { file });
    expect(r.results.length).toBeGreaterThanOrEqual(2);
    for (const t of r.results) expect(t.passed, renderTestResult(r.source, t)).toBe(true);
  });
});

describe('the ALU in DCL against the interpreter', () => {
  const sim = createRtlSim(elaborate(check(read('octet-alu.dcl')).program, 'OctetAlu'));
  /** Run one instruction on the interpreter with R0 = a and R1 = b. */
  const ref = (byte: number, a: number, b: number) => {
    const m = new OctetMachine();
    m.memory[0] = byte;
    m.r[0] = a;
    m.r[1] = b;
    m.step();
    return { y: m.r[0]!, f: m.flags };
  };
  const dcl = (op: number, a: number, b: number) => {
    sim.set('a', a);
    sim.set('b', b);
    sim.set('op', op);
    return { y: sim.get('y'), f: { z: !!sim.get('z'), c: !!sim.get('c'), n: !!sim.get('n'), v: !!sim.get('v') } };
  };
  const values = [...Array(256).keys()];
  const bs = [0, 1, 2, 3, 0x0f, 0x10, 0x3f, 0x40, 0x7e, 0x7f, 0x80, 0x81, 0xc0, 0xf0, 0xfe, 0xff, 0x55, 0xaa, 0x96];

  test.each([
    ['ADD', 0, 0x81, true],
    ['SUB', 1, 0x91, true],
    ['CMP', 1, 0xd1, false],
    ['AND', 2, 0xa1, true],
    ['OR', 3, 0xb1, true],
    ['XOR', 4, 0xc1, true],
  ] as const)('%s: every A against nineteen Bs', (_n, op, byte, stores) => {
    for (const a of values)
      for (const b of bs) {
        const want = ref(byte, a, b);
        const got = dcl(op, a, b);
        expect(got.f, `${a}, ${b}`).toEqual(want.f);
        if (stores) expect(got.y, `${a}, ${b}`).toBe(want.y);
      }
  });

  test.each([
    ['SHL (ADD A, A)', 0xe0, (a: number) => dcl(0, a, a)],
    ['INC (ADD A, 1)', 0xe3, (a: number) => dcl(0, a, 1)],
    ['SHR', 0xe1, (a: number) => dcl(6, a, 0)],
    ['NOT', 0xe2, (a: number) => dcl(7, a, 0)],
  ] as const)('%s: every A', (_n, byte, run) => {
    for (const a of values) {
      const want = ref(byte, a, 0);
      const got = run(a);
      expect(got.y, `${a}`).toBe(want.y);
      expect(got.f, `${a}`).toEqual(want.f);
    }
  });
});

describe('the DCL shown in the chapter is the DCL of the design files', () => {
  test('every line of every ```dcl block appears, unchanged, in a design file', () => {
    const md = readFileSync(new URL('./index.md', import.meta.url), 'utf8');
    const sources = ['octet-alu.dcl', 'octet-regs.dcl'].map((f) => read(f).split('\n').map((l) => l.trim()));
    const all = new Set(sources.flat());
    const blocks = [...md.matchAll(/```dcl\n([\s\S]*?)```/g)].map((m) => m[1]!);
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks)
      for (const line of b.split('\n').map((l) => l.trim()).filter((l) => l && l !== '…'))
        expect(all.has(line), line).toBe(true);
  });
});
