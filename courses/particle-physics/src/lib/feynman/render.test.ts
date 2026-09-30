import { describe, expect, test } from 'vitest';
import { enumerateTreeDiagrams, enumerateOneLoopDiagrams, parseProcess, loopInducedDiagrams, type Diagram } from '../hep/diagrams/index.ts';
import { Curve, coilPath, wavyPath, baseCurve } from './geometry.ts';
import { countCrossings, layoutDiagram } from './layout.ts';
import { diagramToSVG, overlappingLabels, renderDiagram, modelToSVG } from './render.ts';
import { withSubscripts } from './fmt.ts';

const trees = (text: string, opts = {}): Diagram[] => {
  const p = parseProcess(text);
  return enumerateTreeDiagrams(p.initial, p.final, opts);
};

const STANDARD: [string, object][] = [
  ['e+ e- > mu+ mu-', {}], ['e+ e- > e+ e-', {}], ['e- e- > e- e-', {}], ['e- gamma > e- gamma', {}], ['e+ e- > gamma gamma', {}], ['gamma gamma > e+ e-', {}],
  ['e+ e- > mu+ mu- gamma', {}], ['u u~ > g g', {}], ['g g > g g', {}], ['e+ e- > W+ W-', {}], ['e+ e- > Z H', {}], ['u d~ > e+ nu_e', {}], ['mu- > e- nu_e~ nu_mu', {}],
  ['d > u e- nu_e~', {}], ['u u~ > g g g', {}], ['e+ e- > mu+ mu- gamma gamma', { forces: ['qed'] }],
];

describe('layout', () => {
  test('deterministic: the same diagram always gets the same positions', () => {
    for (const [text, o] of STANDARD) {
      for (const d of trees(text, o)) {
        const a = layoutDiagram(d);
        const b = layoutDiagram(d);
        expect([...a.pos.entries()]).toEqual([...b.pos.entries()]);
      }
    }
  });
  test('time runs left to right: incoming legs on the left, outgoing on the right', () => {
    for (const [text, o] of STANDARD) {
      for (const d of trees(text, o)) {
        const { pos } = layoutDiagram(d);
        for (const n of d.nodes) {
          if (n.kind === 'in') expect(pos.get(n.id)!.x).toBe(0);
          if (n.kind === 'out') expect(pos.get(n.id)!.x).toBe(1);
          if (n.kind === 'vertex') {
            expect(pos.get(n.id)!.x).toBeGreaterThan(0);
            expect(pos.get(n.id)!.x).toBeLessThan(1);
          }
        }
      }
    }
  });
  test('no two lines cross in the standard 2 → 2 and 2 → 3 tree diagrams', () => {
    for (const [text, o] of STANDARD) {
      for (const d of trees(text, o)) {
        const l = layoutDiagram(d);
        expect(l.crossings, `${text}: ${d.edges.length} edges`).toBe(0);
        expect(countCrossings(d, l.pos)).toBe(0);
      }
    }
  });
  test('vertices never coincide', () => {
    for (const [text, o] of STANDARD) {
      for (const d of trees(text, o)) {
        const { pos } = layoutDiagram(d);
        const v = d.nodes.filter((n) => n.kind === 'vertex').map((n) => pos.get(n.id)!);
        for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) expect(Math.hypot(v[i]!.x - v[j]!.x, v[i]!.y - v[j]!.y)).toBeGreaterThan(0.07);
      }
    }
  });
  test('the e+ e- > mu+ mu- s-channel has the electron above the positron', () => {
    const d = trees('e+ e- > mu+ mu-')[0]!;
    const { pos } = layoutDiagram(d);
    const leg = (kind: 'in' | 'out', pdg: number) => d.nodes.find((n) => n.kind === kind && n.pdg === pdg)!;
    expect(pos.get(leg('in', 11).id)!.y).toBeLessThan(pos.get(leg('in', -11).id)!.y);
    expect(pos.get(leg('out', 13).id)!.y).toBeLessThan(pos.get(leg('out', -13).id)!.y);
  });
});

describe('rendering', () => {
  test('no overlapping labels in the standard examples', () => {
    for (const [text, o] of STANDARD) {
      for (const d of trees(text, o)) {
        const m = renderDiagram(d);
        const bad = overlappingLabels(m).map(([a, b]) => `${a.label.text}/${b.label.text}`);
        expect(bad, `${text}`).toEqual([]);
      }
    }
  });
  test('every label is inside the drawing', () => {
    for (const [text, o] of STANDARD) {
      for (const d of trees(text, o)) {
        const m = renderDiagram(d);
        for (const l of m.labels) {
          expect(l.box.x0, `${text} ${l.label.text}`).toBeGreaterThanOrEqual(-2);
          expect(l.box.x1).toBeLessThanOrEqual(m.width + 2);
          expect(l.box.y0).toBeGreaterThanOrEqual(-2);
          expect(l.box.y1).toBeLessThanOrEqual(m.height + 2);
        }
      }
    }
  });
  test('line styles: straight with arrow, wavy, coil, dashed', () => {
    const z = renderDiagram(trees('e+ e- > Z H')[0]!);
    const kinds = z.lines.map((l) => l.kind).sort();
    expect(kinds).toEqual(['Z', 'fermion', 'fermion', 'higgs', 'Z'].sort());
    expect(z.lines.find((l) => l.kind === 'higgs')!.dash).toBeTruthy();
    expect(z.lines.filter((l) => l.kind === 'fermion').every((l) => !!l.arrow)).toBe(true);
    expect(z.lines.find((l) => l.kind === 'Z')!.arrow).toBeUndefined();
    const g = renderDiagram(trees('u u~ > g g')[0]!);
    expect(g.lines.filter((l) => l.kind === 'gluon')).toHaveLength(3);
    // A wavy path has many more points than a straight one; a coil more still.
    const wavy = z.lines.find((l) => l.kind === 'Z')!.path.length;
    const straight = z.lines.find((l) => l.kind === 'fermion')!.path.length;
    expect(wavy).toBeGreaterThan(straight * 5);
    expect(g.lines.find((l) => l.kind === 'gluon')!.path.length).toBeGreaterThan(straight * 5);
  });
  test('arrows follow the flow of charge: an antifermion\'s arrow points against the flow of time', () => {
    const d = trees('e+ e- > mu+ mu-', { forces: ['qed'] })[0]!;
    const m = renderDiagram(d);
    const legId = (kind: 'in' | 'out', pdg: number) => d.nodes.find((n) => n.kind === kind && n.pdg === pdg)!.id;
    const arrowOf = (kind: 'in' | 'out', pdg: number) => {
      const id = legId(kind, pdg);
      const e = d.edges.find((x) => x.from === id || x.to === id)!;
      return m.lines.find((l) => l.id === e.id)!.arrow!;
    };
    const cosx = (a: number) => Math.cos((a * Math.PI) / 180);
    expect(cosx(arrowOf('in', 11).angle)).toBeGreaterThan(0); // e⁻ in: to the right
    expect(cosx(arrowOf('in', -11).angle)).toBeLessThan(0); // e⁺ in: to the left
    expect(cosx(arrowOf('out', 13).angle)).toBeGreaterThan(0); // μ⁻ out: to the right
    expect(cosx(arrowOf('out', -13).angle)).toBeLessThan(0); // μ⁺ out: to the left
  });
  test('the SVG string is well-formed and self-contained', () => {
    for (const [text, o] of STANDARD) {
      for (const d of trees(text, o)) {
        const svg = diagramToSVG(d, { mono: true });
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
        expect(svg.endsWith('</svg>')).toBe(true);
        expect(svg).not.toMatch(/<script|javascript:|onload=|NaN|undefined|Infinity/);
        // Tags balance.
        const stack: string[] = [];
        for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
          if (m[4] === '/') continue;
          if (m[1] === '/') expect(stack.pop()).toBe(m[2]);
          else stack.push(m[2]!);
        }
        expect(stack).toEqual([]);
        expect(svg.match(/<path /g)!.length).toBeGreaterThanOrEqual(d.edges.length);
        expect(svg).toContain('<title>');
      }
    }
  });
  test('labels are escaped and show the particle symbols', () => {
    const svg = diagramToSVG(trees('e+ e- > W+ W-')[0]!);
    expect(svg).toContain('>W<');
    expect(svg).toContain('>e<');
    expect(svg).toContain('>+<');
    expect(svg).toContain('>γ<');
    const titled = diagramToSVG(trees('e+ e- > mu+ mu-')[0]!, { title: 'a < b & "c"' });
    expect(titled).toContain('a &lt; b &amp; &quot;c&quot;');
  });
  test('loop diagrams render with parallel lines as bows', () => {
    const p = parseProcess('e+ e- > mu+ mu-');
    const ds = enumerateOneLoopDiagrams(p.initial, p.final, { forces: ['qed'], loopParticles: [11, 13] });
    expect(ds.length).toBeGreaterThan(3);
    for (const d of ds) {
      const m = renderDiagram(d);
      expect(m.lines).toHaveLength(d.edges.length);
      expect(modelToSVG(m)).not.toMatch(/NaN/);
      expect(overlappingLabels(m).map(([a, b]) => `${a.label.text}/${b.label.text}`)).toEqual([]);
    }
    const tri = loopInducedDiagrams([21, 21], [25]);
    for (const d of tri) expect(renderDiagram(d).lines.every((l) => !l.path.includes('NaN'))).toBe(true);
  });
  test('positions can be given in pixels (the sketchpad)', () => {
    const d = trees('e+ e- > mu+ mu-', { forces: ['qed'] })[0]!;
    const pixels = new Map(d.nodes.map((n, i) => [n.id, { x: 50 + 40 * i, y: 100 }]));
    const m = renderDiagram(d, { pixels, width: 400, height: 200 });
    expect(m.pos.get(d.nodes[1]!.id)).toEqual({ x: 90, y: 100 });
  });
});

describe('geometry', () => {
  test('wavy and coil paths start and end on the line', () => {
    const c = new Curve([{ x: 10, y: 50 }, { x: 110, y: 50 }]);
    for (const path of [wavyPath(c), coilPath(c)]) {
      const nums = [...path.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
      expect(nums[0]).toEqual([10, 50]);
      expect(nums[nums.length - 1]![0]).toBeCloseTo(110, 0);
      expect(nums[nums.length - 1]![1]).toBeCloseTo(50, 0);
      expect(Math.max(...nums.map((n) => Math.abs(n[1] - 50)))).toBeGreaterThan(3);
      expect(Math.max(...nums.map((n) => Math.abs(n[1] - 50)))).toBeLessThan(12);
    }
  });
  test('bowed curves bulge to one side and keep their ends', () => {
    const c = baseCurve({ x: 0, y: 0 }, { x: 100, y: 0 }, 20);
    expect(c.pts[0]).toEqual({ x: 0, y: 0 });
    expect(c.pts[c.pts.length - 1]!.x).toBeCloseTo(100);
    expect(Math.abs(c.at(c.length / 2).y)).toBeGreaterThan(15);
  });
  test('subscripts in text', () => {
    expect(withSubscripts('t-channel ν_e and ν̄_μ')).toBe('t-channel ν<sub>e</sub> and ν̄<sub>μ</sub>');
    expect(withSubscripts('a < b')).toBe('a &lt; b');
  });
});
