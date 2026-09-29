/**
 * And-inverter graph (AIG): the representation synthesis works on.
 *
 * A **literal** is `2 * node + complemented`. Node 0 is the constant false (literal 0 = false, 1 = true). Every
 * other node is a primary input (PI: a device input, a register output, a block RAM output, …) or a two-input AND
 * whose fanins are literals, always created after its fanins, so ascending node ids are a topological order.
 *
 * Building is **structurally hashed** (an AND of the same two literals exists once) with **constant propagation**
 * and a few local rewriting rules (`and()` below), so the graph is already partly optimised while it is built.
 *
 * ## Provenance (for cross-probing)
 *
 * While `cur` is set, every node that `and()` returns or reuses records the source elements in `cur`
 * (indices into the design's `sources`). `origins[node]` is therefore the set of source elements a node came
 * from, unioned whenever nodes are merged by hashing, rewriting or balancing.
 */

export const lit = (node: number, compl = 0): number => (node << 1) | compl;
export const nodeOf = (l: number): number => l >> 1;
export const isCompl = (l: number): number => l & 1;
export const notLit = (l: number): number => l ^ 1;
export const FALSE = 0;
export const TRUE = 1;

export class Aig {
  fan0: Int32Array;
  fan1: Int32Array;
  level: Int32Array;
  /** Number of nodes, including the constant. */
  n = 1;
  readonly origins: (number[] | undefined)[] = [undefined];
  /** Source elements to attribute new nodes to. */
  cur: number[] | undefined;
  private readonly strash = new Map<number, number>();

  constructor(capacity = 1024) {
    this.fan0 = new Int32Array(capacity).fill(-1);
    this.fan1 = new Int32Array(capacity).fill(-1);
    this.level = new Int32Array(capacity);
  }

  private grow(): void {
    if (this.n < this.fan0.length) return;
    const cap = this.fan0.length * 2;
    for (const key of ['fan0', 'fan1', 'level'] as const) {
      const a = new Int32Array(cap);
      a.set(this[key]);
      if (key !== 'level') a.fill(-1, this.n);
      this[key] = a;
    }
  }

  isPi(node: number): boolean {
    return node > 0 && this.fan0[node] === -1;
  }
  isAnd(node: number): boolean {
    return node > 0 && this.fan0[node]! >= 0;
  }

  /** Attribute a node to the current source elements. */
  private mark(node: number): void {
    const cur = this.cur;
    if (!cur || node === 0) return;
    let o = this.origins[node];
    if (!o) o = this.origins[node] = [];
    for (const c of cur) if (!o.includes(c)) o.push(c);
  }

  addOrigins(node: number, srcs: readonly number[] | undefined): void {
    if (!srcs || node === 0) return;
    let o = this.origins[node];
    if (!o) o = this.origins[node] = [];
    for (const c of srcs) if (!o.includes(c)) o.push(c);
  }

  /** A new primary input; returns its (positive) literal. */
  addPi(): number {
    this.grow();
    const id = this.n++;
    this.origins.push(undefined);
    this.mark(id);
    return id << 1;
  }

  and(a: number, b: number): number {
    if (a > b) [a, b] = [b, a];
    if (a === 0) return 0;
    if (a === 1) return b;
    if (a === b) return a;
    if (a === (b ^ 1)) return 0;
    // Two-level rules on the fanins of AND nodes.
    const r = this.rewrite(a, b) ?? this.rewrite(b, a);
    if (r !== undefined) return r;
    return this.make(a, b);
  }

  private make(a: number, b: number): number {
    if (a > b) [a, b] = [b, a];
    const key = a * 8388608 + b;
    const hit = this.strash.get(key);
    if (hit !== undefined) {
      this.mark(hit);
      return hit << 1;
    }
    this.grow();
    const id = this.n++;
    this.fan0[id] = a;
    this.fan1[id] = b;
    this.level[id] = 1 + Math.max(this.level[a >> 1]!, this.level[b >> 1]!);
    this.origins.push(undefined);
    this.strash.set(key, id);
    this.mark(id);
    return id << 1;
  }

  /**
   * Rules for an AND of `x` (an AND node's literal) with `y`:
   *  - x&y where y is a fanin of positive x: x (absorption); where ¬y is: 0;
   *  - ¬(p&q) & y where ¬y is p or q: y; where y is p: y & ¬q.
   */
  private rewrite(x: number, y: number): number | undefined {
    const vx = x >> 1;
    if (!this.isAnd(vx)) return undefined;
    const p = this.fan0[vx]!;
    const q = this.fan1[vx]!;
    if ((x & 1) === 0) {
      if (y === p || y === q) return x;
      if (y === (p ^ 1) || y === (q ^ 1)) return 0;
      // Both positive ANDs with contradicting fanins.
      const vy = y >> 1;
      if ((y & 1) === 0 && this.isAnd(vy)) {
        const r = this.fan0[vy]!;
        const s = this.fan1[vy]!;
        if (p === (r ^ 1) || p === (s ^ 1) || q === (r ^ 1) || q === (s ^ 1)) return 0;
      } else if ((y & 1) === 1 && this.isAnd(vy)) {
        // x & ¬(r&s), where x implies ¬r or ¬s: x.
        const r = this.fan0[vy]!;
        const s = this.fan1[vy]!;
        if (r === (p ^ 1) || r === (q ^ 1) || s === (p ^ 1) || s === (q ^ 1)) return x;
      }
    } else {
      if (y === (p ^ 1) || y === (q ^ 1)) return y;
      if (y === p) return this.and(p, q ^ 1);
      if (y === q) return this.and(q, p ^ 1);
    }
    return undefined;
  }

  or(a: number, b: number): number {
    return this.and(a ^ 1, b ^ 1) ^ 1;
  }
  xor(a: number, b: number): number {
    const sign = (a ^ b) & 1;
    a &= ~1;
    b &= ~1;
    if (a === 0) return b ^ sign;
    if (b === 0) return a ^ sign;
    if (a === b) return sign;
    return (this.or(this.and(a, b ^ 1), this.and(a ^ 1, b)) ^ sign);
  }
  xnor(a: number, b: number): number {
    return this.xor(a, b) ^ 1;
  }
  /** s ? b : a */
  mux(s: number, a: number, b: number): number {
    if (a === b) return a;
    if (s === 0) return a;
    if (s === 1) return b;
    if (a === (b ^ 1)) return this.xor(s, a);
    return this.or(this.and(s ^ 1, a), this.and(s, b));
  }
  maj(a: number, b: number, c: number): number {
    return this.or(this.and(a, b), this.and(c, this.or(a, b)));
  }
  andN(lits: number[]): number {
    return this.tree(lits, 1, (a, b) => this.and(a, b));
  }
  orN(lits: number[]): number {
    return this.tree(lits, 0, (a, b) => this.or(a, b));
  }
  xorN(lits: number[]): number {
    return this.tree(lits, 0, (a, b) => this.xor(a, b));
  }
  private tree(lits: number[], empty: number, f: (a: number, b: number) => number): number {
    if (lits.length === 0) return empty;
    let cur = lits.slice();
    while (cur.length > 1) {
      const next: number[] = [];
      for (let i = 0; i + 1 < cur.length; i += 2) next.push(f(cur[i]!, cur[i + 1]!));
      if (cur.length & 1) next.push(cur[cur.length - 1]!);
      cur = next;
    }
    return cur[0]!;
  }

  /** Number of references (AND fanins plus `roots`) to each node. */
  refCounts(roots: readonly number[]): Int32Array {
    const refs = new Int32Array(this.n);
    for (let v = 1; v < this.n; v++) {
      if (this.fan0[v]! >= 0) {
        refs[this.fan0[v]! >> 1]!++;
        refs[this.fan1[v]! >> 1]!++;
      }
    }
    for (const r of roots) refs[r >> 1]!++;
    return refs;
  }

  /** Nodes reachable from the roots (marks in a Uint8Array). */
  reachable(roots: readonly number[]): Uint8Array {
    const mark = new Uint8Array(this.n);
    for (const r of roots) mark[r >> 1] = 1;
    for (let v = this.n - 1; v >= 1; v--) {
      if (mark[v] && this.fan0[v]! >= 0) {
        mark[this.fan0[v]! >> 1] = 1;
        mark[this.fan1[v]! >> 1] = 1;
      }
    }
    return mark;
  }

  /** Number of AND nodes reachable from the roots. */
  andCount(roots: readonly number[]): number {
    const mark = this.reachable(roots);
    let c = 0;
    for (let v = 1; v < this.n; v++) if (mark[v] && this.fan0[v]! >= 0) c++;
    return c;
  }

  /** Depth (levels of AND) of the deepest root. */
  depth(roots: readonly number[]): number {
    let d = 0;
    for (const r of roots) d = Math.max(d, this.level[r >> 1]!);
    return d;
  }

  /** Evaluate the roots for the given values of the PIs (`piValue(node)` is 0 or 1). */
  evaluate(roots: readonly number[], piValue: (node: number) => number): number[] {
    const val = new Uint8Array(this.n);
    for (let v = 1; v < this.n; v++) {
      if (this.fan0[v]! < 0) val[v] = piValue(v);
      else {
        const a = this.fan0[v]!;
        const b = this.fan1[v]!;
        val[v] = (val[a >> 1]! ^ (a & 1)) & (val[b >> 1]! ^ (b & 1));
      }
    }
    return roots.map((r) => val[r >> 1]! ^ (r & 1));
  }
}

export interface RebuildResult {
  aig: Aig;
  /** New literal of an old literal (for nodes reachable from the roots). */
  map: (l: number) => number;
  roots: number[];
}

/**
 * Copy the part of `src` reachable from `roots` into a fresh AIG, keeping the order of the primary inputs (all of
 * them are kept, so PI node numbers are the same as long as PIs come first; use `map`). With `balance`, chains of
 * ANDs are rebuilt as trees that combine the shallowest operands first, which minimises depth; AND nodes shared
 * by several users stay shared. Local rewriting and hashing apply as the copy is built.
 */
export function rebuild(src: Aig, roots: readonly number[], balance: boolean): RebuildResult {
  const dst = new Aig(Math.max(1024, src.n));
  const memo = new Int32Array(src.n).fill(-1);
  memo[0] = 0;
  // PIs keep their order and provenance.
  for (let v = 1; v < src.n; v++) {
    if (src.isPi(v)) {
      const saved = dst.cur;
      dst.cur = undefined;
      const l = dst.addPi();
      dst.cur = saved;
      dst.addOrigins(l >> 1, src.origins[v]);
      memo[v] = l;
    }
  }
  const refs = src.refCounts(roots);
  const need = src.reachable(roots);
  const absorbed = new Uint8Array(src.n);
  if (balance) {
    for (let v = 1; v < src.n; v++) {
      if (!need[v] || !src.isAnd(v)) continue;
      for (const e of [src.fan0[v]!, src.fan1[v]!]) {
        const u = e >> 1;
        if ((e & 1) === 0 && src.isAnd(u) && refs[u] === 1) absorbed[u] = 1;
      }
    }
  }
  const conv = (l: number): number => memo[l >> 1]! ^ (l & 1);
  for (let v = 1; v < src.n; v++) {
    if (!need[v] || !src.isAnd(v) || absorbed[v]) continue;
    if (!balance) {
      dst.cur = src.origins[v];
      memo[v] = dst.and(conv(src.fan0[v]!), conv(src.fan1[v]!));
      continue;
    }
    // Gather the supergate: leaves are literals that are complemented, PIs, shared or already-built nodes.
    const leaves: number[] = [];
    const internal: number[] = [v];
    const stack = [src.fan0[v]!, src.fan1[v]!];
    while (stack.length) {
      const e = stack.pop()!;
      const u = e >> 1;
      if ((e & 1) === 0 && src.isAnd(u) && absorbed[u]) {
        internal.push(u);
        stack.push(src.fan0[u]!, src.fan1[u]!);
      } else if (!leaves.includes(e)) leaves.push(e);
    }
    const cur: number[] = [];
    for (const u of internal) for (const o of src.origins[u] ?? []) if (!cur.includes(o)) cur.push(o);
    dst.cur = cur;
    const items = leaves.map((e) => conv(e));
    // Contradiction: x and ¬x among the leaves.
    let zero = false;
    for (const it of items) if (items.includes(it ^ 1)) zero = true;
    if (zero) {
      memo[v] = 0;
      continue;
    }
    // Combine the two shallowest operands until one is left.
    items.sort((a, b) => dst.level[a >> 1]! - dst.level[b >> 1]!);
    while (items.length > 1) {
      const a = items.shift()!;
      const b = items.shift()!;
      const c = dst.and(a, b);
      // Insert keeping the order by level.
      const lc = dst.level[c >> 1]!;
      let i = 0;
      while (i < items.length && dst.level[items[i]! >> 1]! <= lc) i++;
      items.splice(i, 0, c);
    }
    memo[v] = items[0]!;
  }
  dst.cur = undefined;
  return { aig: dst, map: conv, roots: roots.map(conv) };
}
