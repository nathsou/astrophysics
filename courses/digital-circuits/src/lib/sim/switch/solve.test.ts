import { describe, expect, test } from 'vitest';
import { ComponentSolver, MAYBE, OFF, ON, VX, type SwitchGraph } from './solve';

/**
 * The solver against a brute-force reference that follows Bryant's definition literally: a node's
 * strength is the strongest path reaching it (a path is as strong as its source and its weakest
 * link); its value is the combination of every path of that strength that is not blocked, where a
 * path is blocked at an intermediate node that is stronger than the path so far. X-gated links are
 * enumerated: the exact ternary answer is the merge over every on/off combination.
 */

const SUPPLY = 9;

interface Case {
  k: number; // internal nodes 0 … k−1
  inputs: number[]; // values of input nodes k, k+1, …
  size: number[];
  charge: number[];
  links: { a: number; b: number; level: number; state: number }[];
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomCase(r: () => number, maybeLinks: boolean): Case {
  const k = 2 + Math.floor(r() * 4);
  const m = 1 + Math.floor(r() * 2);
  const n = k + m;
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
  const links: Case['links'] = [];
  const count = k + Math.floor(r() * (k + 2));
  for (let i = 0; i < count; i++) {
    const a = Math.floor(r() * k);
    let b = Math.floor(r() * n);
    if (b === a) b = (a + 1) % n;
    const state = maybeLinks ? pick([ON, ON, OFF, MAYBE]) : pick([ON, ON, ON, OFF]);
    links.push({ a, b, level: pick([4, 5, 6, 7, 8]), state });
  }
  return {
    k,
    inputs: Array.from({ length: m }, () => pick([0, 1, 1, 0, VX])),
    size: Array.from({ length: k }, () => pick([1, 2, 3])),
    charge: Array.from({ length: k }, () => pick([0, 1, VX])),
    links,
  };
}

const lub = (a: number, b: number) => (a < 0 ? b : a === b ? a : VX);

/** Bryant's definition by path enumeration, for links that are all ON or OFF. */
function reference(c: Case, on: boolean[]): number[] {
  const { k } = c;
  const n = k + c.inputs.length;
  const isInput = (x: number) => x >= k;
  const adj: [number, number][][] = Array.from({ length: n }, () => []);
  c.links.forEach((l, i) => {
    if (!on[i]) return;
    adj[l.a]!.push([l.b, l.level]);
    adj[l.b]!.push([l.a, l.level]);
  });
  // Every simple path: source, nodes, strengths of each prefix.
  type Path = { nodes: number[]; prefix: number[] };
  const paths: Path[] = [];
  const srcStrength = (s: number) => (isInput(s) ? SUPPLY : c.size[s]!);
  for (let s = 0; s < n; s++) {
    const walk = (nodes: number[], prefix: number[]) => {
      paths.push({ nodes: [...nodes], prefix: [...prefix] });
      const last = nodes[nodes.length - 1]!;
      if (nodes.length > 1 && isInput(last)) return;
      for (const [m, lv] of adj[last]!) {
        if (nodes.includes(m) || isInput(m)) continue;
        nodes.push(m);
        prefix.push(Math.min(prefix[prefix.length - 1]!, lv));
        walk(nodes, prefix);
        nodes.pop();
        prefix.pop();
      }
    };
    walk([s], [srcStrength(s)]);
  }
  const S = Array.from({ length: k }, (_, x) => Math.max(...paths.filter((p) => p.nodes[p.nodes.length - 1] === x).map((p) => p.prefix[p.prefix.length - 1]!)));
  const value = (s: number) => (isInput(s) ? c.inputs[s - k]! : c.charge[s]!);
  return Array.from({ length: k }, (_, x) => {
    let v = -1;
    for (const p of paths) {
      const len = p.nodes.length;
      if (p.nodes[len - 1] !== x || p.prefix[len - 1] !== S[x]) continue;
      let blocked = false;
      for (let j = 1; j < len - 1; j++) if (p.prefix[j]! < S[p.nodes[j]!]!) blocked = true;
      if (!blocked) v = lub(v, value(p.nodes[0]!));
    }
    return v < 0 ? VX : v;
  });
}

/** Exact ternary answer: merge the reference over every on/off choice of the MAYBE links. */
function exact(c: Case): number[] {
  const maybe = c.links.map((l, i) => (l.state === MAYBE ? i : -1)).filter((i) => i >= 0);
  let out: number[] | undefined;
  for (let mask = 0; mask < 1 << maybe.length; mask++) {
    const on = c.links.map((l) => l.state === ON);
    maybe.forEach((i, j) => (on[i] = ((mask >> j) & 1) === 1));
    const r = reference(c, on);
    out = out ? out.map((v, i) => lub(v, r[i]!)) : r;
  }
  return out!;
}

function solve(c: Case): number[] {
  const n = c.k + c.inputs.length;
  const deg = new Int32Array(n + 1);
  c.links.forEach((l) => {
    deg[l.a + 1] = deg[l.a + 1]! + 1;
    deg[l.b + 1] = deg[l.b + 1]! + 1;
  });
  for (let i = 0; i < n; i++) deg[i + 1] = deg[i + 1]! + deg[i]!;
  const adjLink = new Int32Array(deg[n]!);
  const fill = deg.slice(0, n);
  c.links.forEach((l, i) => {
    adjLink[fill[l.a]!++] = i;
    adjLink[fill[l.b]!++] = i;
  });
  const g: SwitchGraph = {
    n,
    isInput: Uint8Array.from({ length: n }, (_, i) => (i >= c.k ? 1 : 0)),
    size: Uint8Array.from({ length: n }, (_, i) => (i < c.k ? c.size[i]! : SUPPLY)),
    adjStart: deg,
    adjLink,
    linkA: Int32Array.from(c.links.map((l) => l.a)),
    linkB: Int32Array.from(c.links.map((l) => l.b)),
    linkLevel: Uint8Array.from(c.links.map((l) => l.level)),
    linkState: Uint8Array.from(c.links.map((l) => l.state)),
  };
  const val = Uint8Array.from({ length: n }, (_, i) => (i < c.k ? c.charge[i]! : c.inputs[i - c.k]!));
  const out = new Uint8Array(n);
  const solver = new ComponentSolver(g, SUPPLY, 5);
  solver.solve(
    Array.from({ length: c.k }, (_, i) => i),
    val,
    c.links.some((l) => l.state === MAYBE),
    out,
    new Uint8Array(n),
    new Uint8Array(n),
  );
  return Array.from(out.subarray(0, c.k));
}

describe('steady-state solver', () => {
  test('matches the path definition exactly when no gate is X (2000 random graphs)', () => {
    const r = rng(7);
    for (let i = 0; i < 2000; i++) {
      const c = randomCase(r, false);
      const want = reference(
        c,
        c.links.map((l) => l.state === ON),
      );
      expect(solve(c), JSON.stringify(c)).toEqual(want);
    }
  });

  test('with X gates, never claims a value some on/off combination contradicts (2000 random graphs)', () => {
    const r = rng(11);
    let nodes = 0;
    let pessimistic = 0;
    for (let i = 0; i < 2000; i++) {
      const c = randomCase(r, true);
      const want = exact(c);
      const got = solve(c);
      got.forEach((v, j) => {
        nodes++;
        if (v !== VX) expect(v, JSON.stringify(c)).toBe(want[j]);
        else if (want[j] !== VX) pessimistic++;
      });
    }
    // Conservative, and exact for the vast majority of nodes.
    expect(pessimistic / nodes).toBeLessThan(0.01);
  });
});
