/** A path from a RAM's read data to its own address is legal (reads are synchronous), so it must get through the whole flow. */
import { describe, expect, it } from 'vitest';
import { check, elaborate } from '../../hdl';
import { lowerToNetlist } from '../../hdl/lower';
import { runFpgaFlow } from '../../studio/fpga/result';

describe('a RAM whose read data feeds its own address', () => {
  const src = `module Chase(clk: clock) -> (q: bits<4>) {
  mem store: [bits<4>; 16] = [3; 16]
  let data: bits<4> = store.read(ptr)
  let ptr: bits<4> = data
  q = data
}`;

  it('is accepted by the checker, lowers to gates and fits', () => {
    const r = check(src, { file: 'chase.dcl' });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const design = elaborate(r.program, 'Chase');
    expect(() => lowerToNetlist(design, undefined, { io: true })).not.toThrow();
    const result = runFpgaFlow(design, {});
    expect(result.bits.length).toBeGreaterThan(0);
  });
});
