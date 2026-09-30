import { describe, expect, test } from 'vitest';
import { addEdge, addVertex, buildDiagram, emptyDiagram, parseProcess, removeEdge, setEdgeParticle, type Diagram } from '../hep/diagrams/index.ts';
import { analyse, buildKey, connectNodes, DEFAULT_CANVAS, freeSpot, nodeAt, PRESETS, tidyPositions, vertexName } from './sketch.ts';

function draw(d: Diagram, a: number, b: number, pdg: number): Diagram {
  const r = connectNodes(d, a, b, pdg);
  if ('error' in r) throw new Error(r.error);
  return addEdge(d, r.edge.from, r.edge.to, r.edge.pdg).diagram;
}

describe('the answer key', () => {
  test('presets all have a non-empty key', () => {
    for (const p of PRESETS) {
      const proc = parseProcess(p.process);
      const k = buildKey(proc, { forces: p.forces });
      expect(k.key.length, p.label).toBeGreaterThan(0);
      expect(k.broad.length).toBeGreaterThanOrEqual(k.key.length);
    }
  });
});

describe('drawing e+ e- > mu+ mu- step by step', () => {
  const proc = parseProcess('e+ e- > mu+ mu-');
  const k = buildKey(proc, { forces: ['qed', 'weak'] });
  let d = emptyDiagram(proc.initial, proc.final);
  test('empty, then vertices, then done', () => {
    expect(analyse(d, k, []).tone).toBe('empty');
    const v1 = addVertex(d);
    const v2 = addVertex(v1.diagram);
    d = v2.diagram;
    d = draw(d, 0, v1.id, 0); // incoming e+
    let fb = analyse(d, k, []);
    expect(fb.tone).toBe('todo');
    expect(fb.headline).toMatch(/Not finished/);
    d = draw(d, 1, v1.id, 0);
    d = draw(d, v1.id, v2.id, 22);
    d = draw(d, 2, v2.id, 0);
    d = draw(d, 3, v2.id, 0);
    fb = analyse(d, k, []);
    expect(fb.tone).toBe('ok');
    expect(fb.isNew).toBe(true);
    expect(fb.headline).toMatch(/Found 1 of 2/);
    expect(fb.order!.rate).toBe('α²');
    expect(fb.details.filter((x) => x.tone === 'ok')).toHaveLength(2);
    // The same again: a duplicate. With the Z: the second diagram.
    expect(analyse(d, k, [fb.matchIndex]).tone).toBe('dup');
    const z = setEdgeParticle(d, d.edges.find((e) => e.pdg === 22)!.id, 23);
    const fz = analyse(z, k, [fb.matchIndex]);
    expect(fz.tone).toBe('ok');
    expect(fz.headline).toMatch(/Found 2 of 2/);
  });
  test('a photon drawn between an electron and a neutrino is refused with the reason', () => {
    const p2 = parseProcess('e+ e- > nu_e nu_e~');
    const k2 = buildKey(p2, { forces: ['qed', 'weak'] });
    let x = emptyDiagram(p2.initial, p2.final);
    const v1 = addVertex(x);
    const v2 = addVertex(v1.diagram);
    x = v2.diagram;
    x = draw(x, 0, v1.id, 0);
    x = draw(x, 1, v1.id, 0);
    x = draw(x, v1.id, v2.id, 22);
    x = draw(x, 2, v2.id, 0);
    x = draw(x, 3, v2.id, 0);
    const fb = analyse(x, k2, []);
    expect(fb.tone).toBe('bad');
    expect(fb.headline).toBe('Vertex 2 is not allowed: A photon cannot couple to a neutrino: neutrinos have no electric charge.');
    expect(fb.badNodes).toEqual([v2.id]);
    // Through the Z it is fine.
    x = setEdgeParticle(x, x.edges.find((e) => e.pdg === 22)!.id, 23);
    expect(analyse(x, k2, []).tone).toBe('ok');
  });
  test('a charge-violating vertex', () => {
    let x = emptyDiagram(proc.initial, proc.final);
    const v1 = addVertex(x);
    const v2 = addVertex(v1.diagram);
    x = v2.diagram;
    x = draw(x, 0, v1.id, 0);
    x = draw(x, 1, v1.id, 0);
    x = draw(x, v1.id, v2.id, 24); // W+ from vertex 1: e+ e- -> W+ is not charge conserving
    const fb = analyse(x, k, []);
    expect(fb.tone).toBe('bad');
    expect(fb.headline).toMatch(/Vertex 1 is not allowed: Charge is not conserved at this vertex/);
  });
  test('interaction left out of the key, loops, unmatched', () => {
    const kq = buildKey(proc, { forces: ['qed'] });
    const z = buildDiagram(proc, [['v0', 'in0', 11], ['in1', 'v0', 11], ['v0', 'v1', 23], ['out0', 'v1', 13], ['v1', 'out1', 13]]);
    const fb = analyse(z, kq, []);
    expect(fb.tone).toBe('note');
    expect(fb.headline).toMatch(/weak interaction, which this exercise leaves out/);
  });
  test('connecting legs: automatic typing and refusals', () => {
    let x = emptyDiagram(proc.initial, proc.final);
    const v = addVertex(x);
    x = v.diagram;
    expect(connectNodes(x, 0, 1, 22)).toHaveProperty('error');
    expect(connectNodes(x, 0, v.id, 22)).toEqual({ edge: { from: 0, to: v.id, pdg: -11 } });
    expect(connectNodes(x, 3, v.id, 22)).toEqual({ edge: { from: v.id, to: 3, pdg: 13 } });
    x = draw(x, 0, v.id, 22);
    expect(connectNodes(x, 0, v.id, 22)).toHaveProperty('error');
    expect(connectNodes(x, v.id, v.id, 22)).toHaveProperty('error');
    expect(removeEdge(x, x.edges[0]!.id).edges).toHaveLength(0);
    expect(vertexName(x, v.id)).toBe('Vertex 1');
  });
  test('positions', () => {
    const x = emptyDiagram(proc.initial, proc.final);
    const pos = tidyPositions(x);
    expect(Object.keys(pos)).toHaveLength(4);
    expect(pos[1]!.x).toBeLessThan(pos[2]!.x);
    expect(nodeAt(x, pos, { x: pos[0]!.x + 3, y: pos[0]!.y }, 10)).toBe(0);
    expect(nodeAt(x, pos, { x: 320, y: 180 }, 10)).toBeUndefined();
    const f = freeSpot(x, pos);
    expect(f.x).toBeGreaterThan(DEFAULT_CANVAS.margin.l);
  });
});
