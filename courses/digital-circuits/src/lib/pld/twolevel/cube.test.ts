import { describe, expect, test } from 'vitest';
import {
  DC,
  ONE,
  ZERO,
  cofactorCube,
  contains,
  coverFromStrings,
  coverMinterms,
  cubeFromString,
  cubeHasMinterm,
  cubeMinterms,
  cubeToString,
  distance,
  embedCubes,
  getVar,
  intersectOrNull,
  isUniversal,
  isVoid,
  literalCount,
  mintermCube,
  mintermCount,
  projectCubes,
  scc,
  supercube,
  supportOf,
  universe,
} from './cube';

describe('cubes in positional notation', () => {
  test('string round trip and fields', () => {
    const c = cubeFromString('10-1');
    expect(cubeToString(c, 4)).toBe('10-1');
    expect(getVar(c, 0)).toBe(ONE);
    expect(getVar(c, 1)).toBe(ZERO);
    expect(getVar(c, 2)).toBe(DC);
    expect(literalCount(c, 4)).toBe(3);
    expect(mintermCount(c, 4)).toBe(2);
    // Variable 0 is the most significant bit of a minterm index.
    expect(cubeMinterms(c, 4)).toEqual([0b1001, 0b1011]);
  });

  test('intersection, supercube, containment, distance', () => {
    const a = cubeFromString('1--0');
    const b = cubeFromString('-1-0');
    const ab = intersectOrNull(a, b, 4)!;
    expect(cubeToString(ab, 4)).toBe('11-0');
    expect(cubeToString(supercube(cubeFromString('1100'), cubeFromString('1110')), 4)).toBe('11-0');
    expect(contains(a, ab)).toBe(true);
    expect(contains(ab, a)).toBe(false);
    expect(intersectOrNull(cubeFromString('1---'), cubeFromString('0---'), 4)).toBeNull();
    expect(distance(cubeFromString('10--'), cubeFromString('01--'), 4)).toBe(2);
    expect(isVoid(cubeFromString('1~--'), 4)).toBe(true);
  });

  test('works across word boundaries (40 variables)', () => {
    const n = 40;
    const s = '1'.repeat(17) + '-'.repeat(20) + '010';
    const c = cubeFromString(s);
    expect(c.length).toBe(3);
    expect(cubeToString(c, n)).toBe(s);
    expect(literalCount(c, n)).toBe(20);
    expect(isUniversal(universe(n), n)).toBe(true);
    const d = cubeFromString('0' + '1'.repeat(16) + '-'.repeat(20) + '010');
    expect(distance(c, d, n)).toBe(1);
    expect(intersectOrNull(c, d, n)).toBeNull();
  });

  test('cofactor of a cube with respect to a cube', () => {
    const c = cubeFromString('1-0-');
    const p = cubeFromString('1---');
    expect(cubeToString(cofactorCube(c, p, 4)!, 4)).toBe('--0-');
    expect(cofactorCube(c, cubeFromString('0---'), 4)).toBeNull();
  });

  test('minterm cubes', () => {
    for (let m = 0; m < 16; m++) {
      const c = mintermCube(m, 4);
      expect(cubeMinterms(c, 4)).toEqual([m]);
      expect(cubeHasMinterm(c, m, 4)).toBe(true);
    }
  });

  test('single-cube containment and projection', () => {
    const F = coverFromStrings(['1-0', '110', '1-0', '0--', '01-']);
    expect(scc(F.cubes, 3).map((c) => cubeToString(c, 3))).toEqual(['1-0', '0--']);
    expect(supportOf(5, [cubeFromString('1---0'), cubeFromString('--1--')])).toEqual([0, 2, 4]);
    const p = projectCubes([cubeFromString('1-1-0')], [0, 2, 4]);
    expect(cubeToString(p[0]!, 3)).toBe('110');
    expect(cubeToString(embedCubes(p, [0, 2, 4], 5)[0]!, 5)).toBe('1-1-0');
    expect(coverMinterms(coverFromStrings(['1-', '-1']))).toEqual([1, 2, 3]);
  });
});
