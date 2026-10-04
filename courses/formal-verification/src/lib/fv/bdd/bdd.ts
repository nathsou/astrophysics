/**
 * Reduced ordered binary decision diagrams (Bryant, 1986), for chapter 11.
 *
 * A BDD node tests one variable and has a low child (the variable is false) and a high child (true); the leaves are
 * 0 and 1. Two rules keep it *reduced*: no node has equal children, and no two nodes have the same variable and
 * children (a unique table enforces it). With a fixed variable order, every Boolean function then has exactly one
 * BDD: equivalence is pointer equality.
 *
 * Nodes are integers: 0 and 1 are the leaves. Operations go through `ite` (if-then-else) with a computed table, so
 * every Boolean operation costs at most the product of the operands' sizes.
 */
import type { Formula } from '../sat/encode';

export type Node = number;

export class Bdd {
  /** Per node: the level of its variable (leaves: Infinity), and its children. */
  private lvl: number[] = [Infinity, Infinity];
  private lo: number[] = [0, 1];
  private hi: number[] = [0, 1];
  private unique = new Map<string, Node>();
  private iteCache = new Map<string, Node>();
  /** Variable at each level, and the level of each variable. */
  readonly varAt: number[] = [];
  readonly levelOf = new Map<number, number>();
  /** Display names of variables. */
  names = new Map<number, string>();

  constructor(order: number[] = []) {
    for (const v of order) this.addVar(v);
  }

  /** Append a variable at the bottom of the order (if it is new). */
  addVar(v: number, name?: string): void {
    if (!this.levelOf.has(v)) {
      this.levelOf.set(v, this.varAt.length);
      this.varAt.push(v);
    }
    if (name) this.names.set(v, name);
  }

  get nodeCount(): number {
    return this.lvl.length;
  }

  level(n: Node): number {
    return this.lvl[n]!;
  }
  low(n: Node): Node {
    return this.lo[n]!;
  }
  high(n: Node): Node {
    return this.hi[n]!;
  }
  varOf(n: Node): number {
    return this.varAt[this.lvl[n]!]!;
  }

  /** The node (level, lo, hi), shared through the unique table, or lo when both children are equal. */
  mk(level: number, lo: Node, hi: Node): Node {
    if (lo === hi) return lo;
    const k = `${level},${lo},${hi}`;
    const e = this.unique.get(k);
    if (e !== undefined) return e;
    const n = this.lvl.length;
    this.lvl.push(level);
    this.lo.push(lo);
    this.hi.push(hi);
    this.unique.set(k, n);
    return n;
  }

  variable(v: number): Node {
    this.addVar(v);
    return this.mk(this.levelOf.get(v)!, 0, 1);
  }

  /** if f then g else h: the one operation every other is built from. */
  ite(f: Node, g: Node, h: Node): Node {
    if (f === 1) return g;
    if (f === 0) return h;
    if (g === h) return g;
    if (g === 1 && h === 0) return f;
    const k = `${f},${g},${h}`;
    const c = this.iteCache.get(k);
    if (c !== undefined) return c;
    const top = Math.min(this.lvl[f]!, this.lvl[g]!, this.lvl[h]!);
    const cof = (n: Node, b: boolean) => (this.lvl[n] === top ? (b ? this.hi[n]! : this.lo[n]!) : n);
    const r = this.mk(top, this.ite(cof(f, false), cof(g, false), cof(h, false)), this.ite(cof(f, true), cof(g, true), cof(h, true)));
    this.iteCache.set(k, r);
    return r;
  }

  not(f: Node): Node {
    return this.ite(f, 0, 1);
  }
  and(f: Node, g: Node): Node {
    return this.ite(f, g, 0);
  }
  or(f: Node, g: Node): Node {
    return this.ite(f, 1, g);
  }
  xor(f: Node, g: Node): Node {
    return this.ite(f, this.not(g), g);
  }
  imp(f: Node, g: Node): Node {
    return this.ite(f, g, 1);
  }
  iff(f: Node, g: Node): Node {
    return this.ite(f, g, this.not(g));
  }
  andAll(xs: Node[]): Node {
    return xs.reduce((a, b) => this.and(a, b), 1);
  }
  orAll(xs: Node[]): Node {
    return xs.reduce((a, b) => this.or(a, b), 0);
  }

  /** f with variable v set to b. */
  restrict(f: Node, v: number, b: boolean): Node {
    const lv = this.levelOf.get(v);
    if (lv === undefined) return f;
    const memo = new Map<Node, Node>();
    const go = (n: Node): Node => {
      if (this.lvl[n]! > lv) return n;
      const m = memo.get(n);
      if (m !== undefined) return m;
      const r = this.lvl[n] === lv ? (b ? this.hi[n]! : this.lo[n]!) : this.mk(this.lvl[n]!, go(this.lo[n]!), go(this.hi[n]!));
      memo.set(n, r);
      return r;
    };
    return go(f);
  }

  /** ∃ vars. f */
  exists(f: Node, vars: Set<number>): Node {
    const levels = new Set([...vars].map((v) => this.levelOf.get(v)).filter((l): l is number => l !== undefined));
    const memo = new Map<Node, Node>();
    const go = (n: Node): Node => {
      if (n <= 1) return n;
      const m = memo.get(n);
      if (m !== undefined) return m;
      const l = go(this.lo[n]!);
      const h = go(this.hi[n]!);
      const r = levels.has(this.lvl[n]!) ? this.or(l, h) : this.mk(this.lvl[n]!, l, h);
      memo.set(n, r);
      return r;
    };
    return go(f);
  }

  /** ∃ vars. f ∧ g, without building f ∧ g first (the relational product of image computation). */
  andExists(f: Node, g: Node, vars: Set<number>): Node {
    const levels = new Set([...vars].map((v) => this.levelOf.get(v)).filter((l): l is number => l !== undefined));
    const memo = new Map<string, Node>();
    const go = (a: Node, b: Node): Node => {
      if (a === 0 || b === 0) return 0;
      if (a === 1 && b === 1) return 1;
      if (a === 1) return this.existsLevels(b, levels);
      if (b === 1) return this.existsLevels(a, levels);
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      const m = memo.get(k);
      if (m !== undefined) return m;
      const top = Math.min(this.lvl[a]!, this.lvl[b]!);
      const cof = (n: Node, x: boolean) => (this.lvl[n] === top ? (x ? this.hi[n]! : this.lo[n]!) : n);
      const l = go(cof(a, false), cof(b, false));
      let r: Node;
      if (levels.has(top)) r = l === 1 ? 1 : this.or(l, go(cof(a, true), cof(b, true)));
      else r = this.mk(top, l, go(cof(a, true), cof(b, true)));
      memo.set(k, r);
      return r;
    };
    return go(f, g);
  }
  private existsMemo = new Map<string, Node>();
  private existsLevels(f: Node, levels: Set<number>): Node {
    if (f <= 1) return f;
    const vars = new Set([...levels].map((l) => this.varAt[l]!));
    const k = `${f}|${[...levels].sort((a, b) => a - b).join(',')}`;
    const c = this.existsMemo.get(k);
    if (c !== undefined) return c;
    const r = this.exists(f, vars);
    this.existsMemo.set(k, r);
    return r;
  }

  /** Rename variables (any mapping; correct whatever the order, by rebuilding with ite). */
  rename(f: Node, map: Map<number, number>): Node {
    const memo = new Map<Node, Node>();
    const go = (n: Node): Node => {
      if (n <= 1) return n;
      const m = memo.get(n);
      if (m !== undefined) return m;
      const v = this.varOf(n);
      const w = map.get(v) ?? v;
      const r = this.ite(this.variable(w), go(this.hi[n]!), go(this.lo[n]!));
      memo.set(n, r);
      return r;
    };
    return go(f);
  }

  /** Number of nodes reachable from f, leaves included. */
  size(f: Node): number {
    const seen = new Set<Node>();
    const stack = [f];
    while (stack.length) {
      const n = stack.pop()!;
      if (seen.has(n)) continue;
      seen.add(n);
      if (n > 1) stack.push(this.lo[n]!, this.hi[n]!);
    }
    return seen.size;
  }

  /** Number of satisfying assignments over `vars` (f must depend only on them). */
  satCount(f: Node, vars: number[]): bigint {
    const levels = vars.map((v) => this.levelOf.get(v) ?? Infinity).sort((a, b) => a - b);
    // rank[l] = how many of the counted levels are strictly above level l.
    const below = (l: number) => {
      let lo = 0;
      let hi = levels.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (levels[mid]! < l) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };
    const memo = new Map<Node, bigint>();
    // count(n): assignments to the counted levels at or below n's level.
    const count = (n: Node): bigint => {
      if (n === 0) return 0n;
      if (n === 1) return 1n;
      const m = memo.get(n);
      if (m !== undefined) return m;
      const here = below(this.lvl[n]!);
      const sub = (c: Node) => count(c) << BigInt((c <= 1 ? levels.length : below(this.lvl[c]!)) - here - 1);
      const r = sub(this.lo[n]!) + sub(this.hi[n]!);
      memo.set(n, r);
      return r;
    };
    if (f <= 1) return f === 0 ? 0n : 1n << BigInt(levels.length);
    return count(f) << BigInt(below(this.lvl[f]!));
  }

  /** One satisfying assignment (variables not on the path are omitted). */
  anySat(f: Node): Map<number, boolean> | undefined {
    if (f === 0) return undefined;
    const out = new Map<number, boolean>();
    let n = f;
    while (n > 1) {
      if (this.lo[n] !== 0) {
        out.set(this.varOf(n), false);
        n = this.lo[n]!;
      } else {
        out.set(this.varOf(n), true);
        n = this.hi[n]!;
      }
    }
    return out;
  }

  evaluate(f: Node, value: (v: number) => boolean): boolean {
    let n = f;
    while (n > 1) n = value(this.varOf(n)) ? this.hi[n]! : this.lo[n]!;
    return n === 1;
  }

  /** Build the BDD of a propositional formula (shared subformulas are built once). */
  fromFormula(f: Formula): Node {
    const memo = new Map<Formula, Node>();
    const go = (g: Formula): Node => {
      const m = memo.get(g);
      if (m !== undefined) return m;
      let r: Node;
      switch (g.k) {
        case 'const':
          r = g.value ? 1 : 0;
          break;
        case 'var':
          r = this.variable(g.v);
          break;
        case 'not':
          r = this.not(go(g.a));
          break;
        case 'and': {
          r = 1;
          for (const a of g.args) {
            r = this.and(r, go(a));
            if (r === 0) break;
          }
          break;
        }
        case 'or': {
          r = 0;
          for (const a of g.args) {
            r = this.or(r, go(a));
            if (r === 1) break;
          }
          break;
        }
        case 'imp':
          r = this.imp(go(g.a), go(g.b));
          break;
        case 'iff':
          r = this.iff(go(g.a), go(g.b));
          break;
        case 'xor':
          r = this.xor(go(g.a), go(g.b));
          break;
      }
      memo.set(g, r);
      return r;
    };
    return go(f);
  }

  /** The function of a node as a propositional formula (one ite per node; shared nodes are shared objects). */
  toFormula(f: Node): Formula {
    const memo = new Map<Node, Formula>();
    const go = (n: Node): Formula => {
      if (n === 0) return { k: 'const', value: false };
      if (n === 1) return { k: 'const', value: true };
      const m = memo.get(n);
      if (m) return m;
      const x: Formula = { k: 'var', v: this.varOf(n) };
      const r: Formula = { k: 'or', args: [{ k: 'and', args: [x, go(this.hi[n]!)] }, { k: 'and', args: [{ k: 'not', a: x }, go(this.lo[n]!)] }] };
      memo.set(n, r);
      return r;
    };
    return go(f);
  }

  /** The nodes reachable from f, for drawing: level, variable, children. */
  graph(f: Node): { id: Node; level: number; v: number; lo: Node; hi: Node }[] {
    const out: { id: Node; level: number; v: number; lo: Node; hi: Node }[] = [];
    const seen = new Set<Node>();
    const stack = [f];
    while (stack.length) {
      const n = stack.pop()!;
      if (seen.has(n) || n <= 1) continue;
      seen.add(n);
      out.push({ id: n, level: this.lvl[n]!, v: this.varOf(n), lo: this.lo[n]!, hi: this.hi[n]! });
      stack.push(this.lo[n]!, this.hi[n]!);
    }
    return out.sort((a, b) => a.level - b.level || a.id - b.id);
  }
}
