import { describe, expect, it } from 'vitest';
import { dependsOn, hex4, lutExpression, lutRow, LutExpressionError, muxTree, truthFromExpression } from './lut';

describe('LUT4', () => {
  it('turns expressions into truth tables', () => {
    expect(truthFromExpression('I0 ^ I1')).toBe(0x6666);
    expect(truthFromExpression('I0 & I1')).toBe(0x8888);
    expect(truthFromExpression('a | b')).toBe(0xeeee);
    expect(truthFromExpression('!I3')).toBe(0x00ff);
    expect(truthFromExpression('I0 ^ I1 ^ I2 ^ I3')).toBe(0x6996);
    expect(truthFromExpression('0')).toBe(0);
    expect(truthFromExpression('1')).toBe(0xffff);
    expect(truthFromExpression('(I0 & I1) | (I2 & I3)')).toBe(0xf888);
  });

  it('rejects unknown inputs and syntax errors with a message', () => {
    expect(() => truthFromExpression('I0 & X')).toThrow(LutExpressionError);
    expect(() => truthFromExpression('I0 &')).toThrow(LutExpressionError);
    expect(() => truthFromExpression('I4')).toThrow(/not an input/);
  });

  it('finds what the output depends on', () => {
    expect(dependsOn(0x6666)).toEqual([0, 1]);
    expect(dependsOn(0x00ff)).toEqual([3]);
    expect(dependsOn(0)).toEqual([]);
    expect(dependsOn(0x6996)).toEqual([0, 1, 2, 3]);
  });

  it('writes a truth table back as an expression that means the same', () => {
    expect(lutExpression(0x6666)).toBe('I0 ^ I1');
    expect(lutExpression(0x9999)).toBe('!(I0 ^ I1)');
    expect(lutExpression(0)).toBe('0');
    expect(lutExpression(0xffff)).toBe('1');
    expect(lutExpression(0x00ff)).toBe('!I3');
    expect(lutExpression(0xaaaa)).toBe('I0');
    expect(lutExpression(0x8888, ['a', 'b', 'c', 'd'])).toBe('a & b');
    // Round trip over many tables (including ones that need a sum of products).
    for (let t = 0; t < 0x10000; t += 257) {
      const e = lutExpression(t);
      expect(truthFromExpression(e), `${hex4(t)} ${e}`).toBe(t);
    }
    for (const t of [0xf888, 0xe8e8, 0xcaca, 0x1234, 0xfffe]) expect(truthFromExpression(lutExpression(t))).toBe(t);
  });

  it('walks the multiplexer tree to the stored bit', () => {
    const truth = 0x6666;
    for (let r = 0; r < 16; r++) {
      const inputs = [r & 1, (r >> 1) & 1, (r >> 2) & 1, (r >> 3) & 1] as (0 | 1)[];
      const t = muxTree(truth, inputs);
      expect(t.output).toBe((truth >> r) & 1);
      expect(t.levels.map((l) => l.length)).toEqual([16, 8, 4, 2, 1]);
      expect(lutRow(inputs)).toBe(r);
    }
    // An unknown input matters only where the pair disagrees.
    expect(muxTree(0x6666, [-1, 0, 0, 0]).output).toBe(-1);
    expect(muxTree(0x8888, [-1, 0, 0, 0]).output).toBe(0);
    expect(lutRow([1, -1, 0, 0])).toBe(-1);
  });
});
