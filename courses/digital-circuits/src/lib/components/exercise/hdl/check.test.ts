import { describe, expect, test } from 'vitest';
import { checkHdl, show, summary, type HdlInput } from './check';

const priority: HdlInput = {
  id: 't/pe',
  top: 'PriorityEncoder',
  start: `module PriorityEncoder(req: bits<4>) -> (valid: bit, index: bits<2>) {
  valid = 0
  index = 0
}`,
  reference: `module PriorityEncoder(req: bits<4>) -> (valid: bit, index: bits<2>) {
  valid = any(req)
  index = if req[3] { 3 } else if req[2] { 2 } else if req[1] { 1 } else { 0 }
}`,
  tests: `test "highest wins" {
  let e = sim PriorityEncoder(req: 0b0110)
  expect e.valid == 1 && e.index == 2
}
test "none" {
  let e = sim PriorityEncoder(req: 0)
  expect e.valid == 0
}`,
};

const counter: HdlInput = {
  id: 't/sat',
  top: 'Sat',
  start: `module Sat(clk: clock, en: bit, up: bit) -> (count: bits<4>) {
  reg v: bits<4> = 0
  next v = if !en { v } else if up { v + 1 } else { v - 1 }
  count = v
}`,
  reference: `module Sat(clk: clock, en: bit, up: bit) -> (count: bits<4>) {
  reg v: bits<4> = 0
  next v = if !en { v } else if up { if v == 15 { v } else { v + 1 } } else { if v == 0 { v } else { v - 1 } }
  count = v
}`,
};

describe('checkHdl', () => {
  test('the reference passes its own exercise', () => {
    const r = checkHdl(priority, priority.reference!);
    expect(r.pass).toBe(true);
    expect(r.tests.map((t) => t.passed)).toEqual([true, true]);
    expect(r.equivalence).toMatchObject({ pass: true, kind: 'exhaustive', vectors: 16 });
  });

  test('a wrong design fails the hidden tests and comes back as a table of counterexamples', () => {
    const r = checkHdl(priority, priority.start);
    expect(r.pass).toBe(false);
    expect(r.tests.some((t) => !t.passed && /expected e\.valid == 1/.test(t.message))).toBe(true);
    const eq = r.equivalence!;
    expect(eq.pass).toBe(false);
    expect(eq.mismatches).toBe(15);
    expect(eq.rows.length).toBeLessThanOrEqual(6);
    expect(eq.rows[0]).toEqual({ inputs: { req: '0b0001' }, expected: { valid: '1', index: '0b00' }, got: { valid: '0', index: '0b00' }, differ: ['valid'] });
  });

  test('a design that matches the tests but not the reference is caught by the equivalence check', () => {
    // Right for every input the tests try, wrong for 0b0101.
    const sneaky = priority.reference!.replace('valid = any(req)', 'valid = any(req) && req != 0b0101');
    const r = checkHdl(priority, sneaky);
    expect(r.tests.every((t) => t.passed)).toBe(true);
    expect(r.pass).toBe(false);
    expect(r.equivalence!.rows[0]!.inputs.req).toBe('0b0101');
  });

  test('errors in the source are reported and nothing else runs', () => {
    const r = checkHdl(priority, 'module PriorityEncoder(req: bits<4>) -> (valid: bit, index: bits<2>) { valid = req }');
    expect(r.pass).toBe(false);
    expect(r.diagnostics.some((d) => d.severity === 'error')).toBe(true);
    expect(r.tests).toEqual([]);
    expect(summary(r)).toMatch(/error/);
  });

  test('the module must exist and keep its ports', () => {
    expect(checkHdl(priority, 'module Other(req: bits<4>) -> (valid: bit, index: bits<2>) {\n valid = 0\n index = 0\n}').problems[0]).toMatch(/no module named `PriorityEncoder`/);
    const widened = 'module PriorityEncoder(req: bits<5>) -> (valid: bit, index: bits<2>) {\n valid = 0\n index = 0\n}';
    expect(checkHdl(priority, widened).problems[0]).toMatch(/ports must not change/);
  });

  test('a clocked design is compared from power-up, and the mismatch shows the cycles that led to it', () => {
    expect(checkHdl(counter, counter.reference!)).toMatchObject({ pass: true, equivalence: { kind: 'sequences', sequential: true } });
    const r = checkHdl(counter, counter.start);
    expect(r.pass).toBe(false);
    const eq = r.equivalence!;
    expect(eq.sequential).toBe(true);
    const last = eq.rows[eq.rows.length - 1]!;
    expect(last.differ).toEqual(['count']);
    // The shortest counterexample: counting down from 0 wraps to 15 after one cycle.
    expect(last.inputs).toEqual({ en: '1', up: '0' });
    expect(last.expected.count).toBe('0b0000');
    expect(last.got.count).toBe('0b1111');
    expect(last.cycle).toBe(0);
    expect(last.phase).toBe('after');
  });

  test('wide designs are compared on random vectors, and `equivalence: false` leaves it to the tests', () => {
    const wide: HdlInput = { id: 't/w', top: 'Xor16', start: 'module Xor16(a: bits<16>, b: bits<16>) -> (y: bits<16>) {\n y = 0\n}', reference: 'module Xor16(a: bits<16>, b: bits<16>) -> (y: bits<16>) {\n y = a ^ b\n}' };
    const r = checkHdl(wide, wide.reference!);
    expect(r.equivalence).toMatchObject({ pass: true, kind: 'random', vectors: 4096 });
    expect(checkHdl(wide, wide.start).pass).toBe(false);
    expect(checkHdl({ ...wide, equivalence: false }, wide.start).pass).toBe(true);
  });

  test('values are shown in binary up to 8 bits and in hex above', () => {
    expect([show(5n, 1), show(5n, 4), show(0xabn, 8), show(0xabcn, 12)]).toEqual(['5', '0b0101', '0b10101011', '0xABC']);
  });
});
