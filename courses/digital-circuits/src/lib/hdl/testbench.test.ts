import { describe, expect, it } from 'vitest';
import { renderTestResult, renderWaveform, runTests } from './testbench';

const COUNTER = `module Counter(clk: clock, enable: bit, clear: bit) -> (count: bits<4>, wrapped: bit) {
  reg value: bits<4> = 0
  next value = if clear { 0 } else if enable { value + 1 } else { value }
  count = value
  wrapped = enable && value == 15
}
`;

describe('runTests', () => {
  it('runs the HDL.md counter test', () => {
    const r = runTests(`${COUNTER}
test "wraps after sixteen steps" {
  let c = sim Counter(enable: 1, clear: 0)
  step 15
  expect c.count == 15 && c.wrapped
  step
  expect c.count == 0
}`);
    expect(r.passed).toBe(true);
    expect(r.results).toHaveLength(1);
    expect(r.results[0]).toMatchObject({ name: 'wraps after sixteen steps', passed: true, cycles: 16, failures: [] });
  });

  it('assigns ports, loops, keeps variables and prints', () => {
    const r = runTests(`${COUNTER}
test "loop" {
  let c = sim Counter(enable: 0, clear: 0)
  let total: bits<8> = 0
  for i in 0..4 {
    c.enable = i & 1
    step
    total = total + zext(c.count, 8)
  }
  print "count", c.count, "total", total
  expect total == 0 + 1 + 1 + 2
}`);
    expect(r.passed).toBe(true);
    expect(r.results[0]!.output).toEqual(['count 2 total 4']);
  });

  it('reports a failing expect with its values and a waveform around it, and goes on', () => {
    const src = `${COUNTER}
test "fails" {
  let c = sim Counter(enable: 1, clear: 0)
  step 6
  expect c.count == 7
  step 5
  expect c.count == 11
  expect c.wrapped
}`;
    const r = runTests(src, { file: 'counter.dcl' });
    expect(r.passed).toBe(false);
    const t = r.results[0]!;
    expect(t.failures.map((f) => [f.text, f.cycle, f.values])).toEqual([
      ['c.count == 7', 6, [{ name: 'c.count', value: '6' }]],
      ['c.wrapped', 11, [{ name: 'c.wrapped', value: '0' }]],
    ]);
    const w = t.failures[0]!.waveform!;
    expect(w.firstCycle).toBe(2);
    expect(w.marker).toBe(6);
    expect(w.signals.map((s) => s.name)).toEqual(['enable', 'clear', 'count', 'wrapped']);
    expect(w.signals[2]!.values).toEqual([2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n]);
    expect(renderWaveform(w)).toBe(
      [
        '    cycle │ 2  3  4  5  [6]  7  8  9',
        ' c.enable │ 1  1  1  1    1  1  1  1',
        '  c.clear │ 0  0  0  0    0  0  0  0',
        '  c.count │ 2  3  4  5    6  7  8  9',
        'c.wrapped │ 0  0  0  0    0  0  0  0',
      ].join('\n'),
    );
    const text = renderTestResult(r.source, t);
    expect(text).toContain('error: expectation failed: c.count == 7');
    expect(text).toContain('counter.dcl:11:10');
    expect(text).toContain('c.count = 6');
  });

  it('draws random values from a seeded generator, reproducibly', () => {
    const src = `module Id(a: bits<16>) -> (y: bits<16>) {
  y = a
}
test "random" {
  let m = sim Id(a: 0)
  for i in 0..3 {
    m.a = random(bits<16>)
    print m.y
  }
}`;
    const a = runTests(src, { seed: 5 }).results[0]!.output;
    const b = runTests(src, { seed: 5 }).results[0]!.output;
    const c = runTests(src, { seed: 6 }).results[0]!.output;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(new Set(a).size).toBe(3);
  });

  it('steps one clock of a design with several clocks', () => {
    const r = runTests(`module Two(a: clock, b: clock) -> (x: bits<4>, y: bits<4>) {
  reg p: bits<4> = 0 on a
  reg q: bits<4> = 0 on b
  next p = p + 1
  next q = q + 1
  x = p
  y = q
}
test "clocks" {
  let t = sim Two()
  step 3 on a
  step on b
  expect t.x == 3 && t.y == 1
  step 2
  expect t.x == 5 && t.y == 3
}`);
    expect(r.passed).toBe(true);
  });

  it('reports run-time errors with their span', () => {
    const r = runTests(`${COUNTER}
test "too big" {
  let c = sim Counter(enable: 0, clear: 0)
  for i in 0..20 {
    c.enable = i
  }
}`);
    const t = r.results[0]!;
    expect(t.passed).toBe(false);
    expect(t.error?.message).toBe('value 2 does not fit bit');
  });

  it('does not run tests when the source has errors, and says why', () => {
    const r = runTests(`${COUNTER}
test "bad" {
  let c = sim Counter(enable: 1, clear: 0)
  expect c.count == 1000
}`);
    expect(r.passed).toBe(false);
    expect(r.diagnostics.map((d) => d.code)).toEqual(['literal-too-wide']);
    expect(r.results[0]).toMatchObject({ skipped: true, passed: false });
    expect(r.results[0]!.error?.message).toMatch(/^not run: literal does not fit/);
  });

  it('checks test statements', () => {
    const r = runTests(`${COUNTER}
test "checks" {
  step
  let c = sim Counter(enable: 1)
  c.count = 3
  c.clk = 1
}`);
    expect(r.diagnostics.map((d) => d.code)).toEqual(['bad-step', 'bad-assignment', 'clock-misuse']);
  });

  it('filters tests by name and stops runaway tests', () => {
    const src = `${COUNTER}
test "a" {
  let c = sim Counter(enable: 1, clear: 0)
  step 100
}
test "b" {
  let c = sim Counter(enable: 1, clear: 0)
  step 1000
}`;
    expect(runTests(src, { filter: 'b' }).results.map((t) => t.name)).toEqual(['b']);
    const r = runTests(src, { maxCycles: 500 });
    expect(r.results.map((t) => t.passed)).toEqual([true, false]);
    expect(r.results[1]!.error?.message).toMatch(/more than 500 cycles/);
  });

  it('runs the same with the interpreter', () => {
    const src = `${COUNTER}
test "t" {
  let c = sim Counter(enable: 1, clear: 0)
  step 20
  expect c.count == 4
}`;
    expect(runTests(src, { mode: 'interpreted' }).passed).toBe(true);
  });
});
