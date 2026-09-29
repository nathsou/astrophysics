import { describe, expect, it } from 'vitest';
import * as dcl from './index';

describe('public API', () => {
  it('goes from source to simulation', () => {
    const source = 'module Counter(clk: clock, enable: bit) -> (count: bits<4>) {\n  reg value: bits<4> = 0\n  next value = if enable { value + 1 } else { value }\n  count = value\n}\n\ntest "counts" {\n  let c = sim Counter(enable: 1)\n  step 3\n  expect c.count == 3\n}\n';
    expect(dcl.parse(source).diagnostics).toEqual([]);
    expect(dcl.format(source)).toBe(source);
    const { diagnostics, program } = dcl.check(source, { file: 'counter.dcl' });
    expect(diagnostics).toEqual([]);
    const design = dcl.elaborate(program, 'Counter');
    expect(dcl.flattenRtl(design).cells.some((c) => c.kind === 'reg')).toBe(true);
    const sim = dcl.createRtlSim(design);
    sim.set('enable', 1);
    sim.step(3);
    expect(sim.get('count')).toBe(3);
    expect(dcl.runTests(source).passed).toBe(true);
    expect(dcl.loadStd().length).toBe(7);
    expect(dcl.tokenize('let x = 1').map((t) => t.kind)).toEqual(['keyword', 'identifier', 'operator', 'number']);
  });
});
