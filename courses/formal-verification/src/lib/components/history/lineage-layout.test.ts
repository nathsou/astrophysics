import { describe, expect, it } from 'vitest';
import { layoutLineage, NODE_H } from './lineage-layout';
import type { LineageNode } from './types';

const n = (id: string, year: number, lane: LineageNode['lane'] = 'sat'): LineageNode => ({ id, name: id, year, kind: 'tool', lane });

describe('layoutLineage', () => {
  it('orders nodes by year along x and never overlaps nodes in a band', () => {
    const nodes = [n('grasp', 1996), n('chaff', 2001), n('minisat', 2003), n('glucose', 2009), n('kissat', 2020), n('z3', 2008, 'smt')];
    const l = layoutLineage(nodes, [{ from: 'grasp', to: 'chaff', type: 'influenced' }, { from: 'chaff', to: 'minisat', type: 'influenced' }]);
    const sat = l.nodes.filter((p) => p.lane === 'sat');
    for (const a of sat)
      for (const b of sat) {
        if (a === b) continue;
        const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
        const overlapY = a.y < b.y + NODE_H && b.y < a.y + NODE_H;
        expect(overlapX && overlapY).toBe(false);
      }
    expect(l.nodes.find((p) => p.id === 'chaff')!.x).toBeGreaterThan(l.nodes.find((p) => p.id === 'grasp')!.x);
    expect(l.edges).toHaveLength(2);
    expect(l.bands.map((b) => b.lane)).toEqual(['sat', 'smt']);
  });
  it('drops edges to unknown nodes', () => {
    expect(layoutLineage([n('a', 2000)], [{ from: 'a', to: 'b', type: 'descends' }]).edges).toHaveLength(0);
  });
});
