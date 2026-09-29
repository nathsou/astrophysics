import { describe, expect, it } from 'vitest';
import { plaGeom, plaHit } from './pla-geometry';

describe('PLA geometry', () => {
  const g = plaGeom(8, 16, 8);
  it('hit-tests every AND, OR and polarity fuse back to itself', () => {
    for (let t = 0; t < 16; t++) {
      for (let k = 0; k < 16; k++) expect(plaHit(g, g.andX(k), g.rowY(t))).toEqual({ plane: 'and', term: t, input: k >> 1, literal: k & 1 ? 'complement' : 'true' });
      for (let o = 0; o < 8; o++) expect(plaHit(g, g.orX(o), g.rowY(t))).toEqual({ plane: 'or', term: t, output: o });
    }
    for (let o = 0; o < 8; o++) expect(plaHit(g, g.orX(o), g.yPol)).toEqual({ plane: 'polarity', output: o });
    expect(plaHit(g, g.xA1 + 10, g.rowY(0))).toBeNull();
  });
});
