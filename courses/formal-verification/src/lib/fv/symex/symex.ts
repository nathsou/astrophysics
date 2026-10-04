/**
 * Symbolic execution (chapter 15; King 1976): run a function on symbolic inputs, forking at every branch, and build
 * the execution tree. Each node carries its path condition; the solver decides which directions are feasible; each
 * finished path yields a test input (a model of its path condition), which the reference interpreter replays to
 * confirm the outcome and to measure the lines it covers. Every check the interpreter would make on the way (array
 * bounds, division, overflow, assertions, the postcondition) is a query of its own: can it fail on this path?
 *
 * Implementation: the verification-condition generator's executor with a fork oracle (vc/gen.ts). The explorer
 * re-executes the function from the start for each node, following a recorded list of decisions, and stops at the
 * first undecided branch. Loops are unrolled up to a bound; beyond it, only the exit direction is explored and the
 * path that would continue is marked as cut.
 */
import type { Span } from '../vouch/syntax/lexer';
import type * as A from '../vouch/syntax/ast';
import type { Checked, FnInfo } from '../vouch/check/checker';
import { generate, type Obligation } from '../vouch/vc/gen';
import { toValue } from '../vouch/vc/verify';
import { Runner } from '../vouch/interp/exec';
import { show, type Value } from '../vouch/interp/values';
import { checkSat } from '../smt/solver';
import { mapTerm, not, pretty, TRUE, v, type Model, type Term } from '../logic/term';

export interface Failure {
  kind: string;
  message: string;
  span: Span;
  /** The input that makes it fail, and the interpreter's confirmation. */
  input: string;
  replayed: boolean;
}

export interface SymNode {
  id: number;
  parent?: number;
  /** The decision on the edge into this node: the branch condition as written, and which way. */
  edge?: { text: string; dir: boolean; kind: 'if' | 'loop' | 'case'; iteration: number };
  kind: 'branch' | 'leaf' | 'infeasible' | 'cut' | 'unknown';
  /** For branch nodes: the condition and where it is. */
  branch?: { text: string; span: Span; kind: 'if' | 'loop' | 'case'; iteration: number };
  children: number[];
  /** The path condition (conjuncts added since the root, pretty-printed). */
  path: string[];
  depth: number;
  /** For leaves: a test input that follows this path, replayed. */
  test?: { input: string; values: Value[]; outcome: string; replayed: boolean; lines: number[] };
  /** Checks that can fail on this path (found at this leaf or branch). */
  failures: Failure[];
  reason?: string;
}

export interface SymexOptions {
  /** Loop iterations to unroll before cutting. */
  maxUnroll?: number;
  /** Nodes in the tree before stopping. */
  maxNodes?: number;
  /** Solver time per query (ms). */
  timeout?: number;
}

class Stop extends Error {
  constructor(
    readonly cond: Term,
    readonly span: Span,
    readonly kind: 'if' | 'loop' | 'case',
    readonly path: readonly Term[],
    readonly iteration: number,
  ) {
    super('branch');
  }
}

/** Truncating division by a constant k > 0, as the VC generator writes it: ite(a ≥ 0, div(a, k), −div(−a, k)). */
function truncDivParts(t: Term): [Term, Term] | undefined {
  if (t.op !== 'ite') return undefined;
  const [c, x, y] = t.args as [Term, Term, Term];
  if (c.op !== 'ge' || c.args[1]!.op !== 'num' || c.args[1]!.value !== 0n || x.op !== 'div' || y.op !== 'neg') return undefined;
  const a = c.args[0]!;
  const inner = y.args[0]!;
  if (x.args[0] !== a || inner.op !== 'div' || inner.args[1] !== x.args[1] || inner.args[0]!.op !== 'neg' || inner.args[0]!.args[0] !== a) return undefined;
  return [a, x.args[1]!];
}

const clean = (s: string) => s.replace(/!\d+/g, '').replace(/len_(\w+)/g, '|$1|');

/** Show a term with the solver's fresh names (x!12) as the program's names, and integer division as a / k. */
export const showCond = (t: Term) =>
  clean(
    pretty(
      mapTerm(t, (x) => {
        const d = truncDivParts(x);
        if (!d) return undefined;
        const a = clean(pretty(d[0]));
        return v(`${/\s/.test(a) ? `(${a})` : a} / ${pretty(d[1])}`, x.sort);
      }),
    ),
  );

export class SymbolicExplorer {
  nodes: SymNode[] = [];
  /** Work list of nodes still to expand: their decision lists. */
  private frontier: { node: number; decisions: boolean[] }[] = [];
  private seenFailures = new Set<string>();
  readonly opts: Required<SymexOptions>;
  queries = 0;
  done = false;
  /** Lines reached by the replayed tests. */
  covered = new Set<number>();

  /** Line starts of the source, to report coverage by line. */
  private lineStarts: number[];

  constructor(
    private checked: Checked,
    private info: FnInfo,
    source: string,
    opts: SymexOptions = {},
  ) {
    this.lineStarts = [0];
    for (let i = 0; i < source.length; i++) if (source[i] === '\n') this.lineStarts.push(i + 1);
    this.opts = { maxUnroll: opts.maxUnroll ?? 6, maxNodes: opts.maxNodes ?? 120, timeout: opts.timeout ?? 3000 };
    this.nodes.push({ id: 0, kind: 'branch', children: [], path: [], depth: 0, failures: [] });
    this.frontier.push({ node: 0, decisions: [] });
  }

  private sat(fs: Term[]): { status: 'sat' | 'unsat' | 'unknown'; model?: Model } {
    this.queries++;
    const r = checkSat(fs, { timeout: this.opts.timeout });
    return { status: r.status, model: r.model };
  }

  /** Run the function along the decisions; returns the stop point, or the finished run. */
  private run(decisions: boolean[]): { stop?: Stop; vcs?: ReturnType<typeof generate>; error?: string } {
    let i = 0;
    try {
      const vcs = generate(this.checked, this.info, {
        fork: (cond, span, kind, path, iteration) => {
          if (i < decisions.length) return decisions[i++]!;
          throw new Stop(cond, span, kind, [...path], iteration);
        },
      });
      return { vcs };
    } catch (e) {
      if (e instanceof Stop) return { stop: e };
      return { error: (e as Error).message };
    }
  }

  /** Expand one node of the frontier (depth first). Returns false when there is nothing left to do. */
  step(): boolean {
    if (this.done) return false;
    const item = this.frontier.pop();
    if (!item || this.nodes.length >= this.opts.maxNodes) {
      for (const f of this.frontier) {
        const n = this.nodes[f.node]!;
        n.kind = 'cut';
        n.reason = 'not explored: the tree reached its size limit';
      }
      this.frontier = [];
      this.done = true;
      return false;
    }
    const node = this.nodes[item.node]!;
    const r = this.run(item.decisions);
    if (r.error) {
      node.kind = 'unknown';
      node.reason = r.error;
      return true;
    }
    if (r.vcs) {
      this.leaf(node, r.vcs);
      return true;
    }
    const stop = r.stop!;
    const text = (dir: boolean) => (dir ? showCond(stop.cond) : showCond(not(stop.cond)));
    node.kind = 'branch';
    node.branch = { text: showCond(stop.cond), span: stop.span, kind: stop.kind, iteration: stop.iteration };
    // Checks that may fail before this branch are found at the leaves below it (each run records them again).
    const kids: { dir: boolean; node: SymNode }[] = [];
    for (const dir of [true, false]) {
      const c = dir ? stop.cond : not(stop.cond);
      const child: SymNode = { id: this.nodes.length, parent: node.id, edge: { text: text(dir), dir, kind: stop.kind, iteration: stop.iteration }, kind: 'branch', children: [], path: [...node.path, text(dir)], depth: node.depth + 1, failures: [] };
      this.nodes.push(child);
      node.children.push(child.id);
      const q = this.sat([...stop.path, c]);
      if (q.status === 'unsat') child.kind = 'infeasible';
      else if (q.status === 'unknown') {
        child.kind = 'unknown';
        child.reason = 'the solver could not decide whether this direction is feasible';
      } else if (dir && stop.kind === 'loop' && stop.iteration >= this.opts.maxUnroll) {
        child.kind = 'cut';
        child.reason = `more than ${this.opts.maxUnroll} iterations: the unrolling stops here`;
      } else kids.push({ dir, node: child });
    }
    // Depth first, the true direction first.
    for (const k of kids.reverse()) this.frontier.push({ node: k.node.id, decisions: [...item.decisions, k.dir] });
    return true;
  }

  private leaf(node: SymNode, vcs: ReturnType<typeof generate>): void {
    node.kind = 'leaf';
    // 1. Every check on this path: can it fail?
    for (const ob of vcs.obligations) this.checkObligation(node, vcs, ob);
    // 2. A test input for the path: a model of the path condition at the exit (or, for a path that stops at a failing
    // check, of the path up to that check).
    const exit = vcs.exits[0] ?? (vcs.obligations.length ? vcs.obligations[vcs.obligations.length - 1]!.hyps : []);
    const q = this.sat([TRUE, ...vcs.axioms, ...exit]);
    if (q.status !== 'sat' || !q.model) {
      node.reason = 'no test input found for this path';
      return;
    }
    const values = vcs.params.map((p) => toValue(p.value, p.sym.ty, q.model!));
    if (values.some((x) => x === undefined)) {
      node.reason = 'the test input could not be read back from the model';
      return;
    }
    const res = new Runner(this.checked, { fuel: 100_000, trace: 5000 }).run(this.info.decl.name, values as Value[]);
    const lines = [...new Set(res.trace.filter((t) => t.fn === this.info.decl.name).map((t) => this.lineOf(t.span.start)))].sort((a, b) => a - b);
    lines.forEach((l) => this.covered.add(l));
    const outcome = res.discarded ? 'discarded (the precondition does not hold)' : res.failure ? `fails: ${res.failure.message}` : res.result !== undefined ? `returns ${show(res.result)}` : 'returns';
    node.test = { input: this.showInput(values as Value[]), values: values as Value[], outcome, replayed: !res.discarded, lines };
  }

  private checkObligation(node: SymNode, vcs: ReturnType<typeof generate>, ob: Obligation): void {
    const key = `${ob.kind}@${ob.span.start}`;
    if (this.seenFailures.has(key)) return;
    const q = this.sat([...vcs.axioms, ...ob.hyps, not(ob.goal)]);
    if (q.status !== 'sat' || !q.model) return;
    const values = vcs.params.map((p) => toValue(p.value, p.sym.ty, q.model!));
    if (values.some((x) => x === undefined)) return;
    const res = new Runner(this.checked, { fuel: 100_000, trace: 0 }).run(this.info.decl.name, values as Value[]);
    const replayed = !!res.failure && !['internal', 'fuel', 'unbounded-quantifier'].includes(res.failure.kind);
    this.seenFailures.add(key);
    node.failures.push({ kind: ob.kind, message: replayed ? res.failure!.message : ob.message, span: ob.span, input: this.showInput(values as Value[]), replayed });
  }

  lineOf(offset: number): number {
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.lineStarts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }

  /** The lines of the function's simple statements (the ones the interpreter's trace records). */
  statementLines(): number[] {
    const out = new Set<number>();
    const walk = (b: A.Block) => {
      for (const st of b.stmts) {
        if (st.k === 'if') {
          walk(st.then);
          if (st.else) 'stmts' in st.else ? walk(st.else as A.Block) : walk({ stmts: [st.else], span: st.else.span } as A.Block);
        } else if (st.k === 'while' || st.k === 'for' || st.k === 'loop') walk(st.body);
        else if (st.k === 'match') st.arms.forEach((a) => walk(a.body));
        else if (st.k === 'block') walk(st.body);
        else out.add(this.lineOf(st.span.start));
      }
    };
    const body = this.info.decl.body as A.Block | undefined;
    if (body && 'stmts' in body) walk(body);
    return [...out].sort((a, b) => a - b);
  }

  private showInput(values: Value[]): string {
    return this.info.params.map((p, i) => `${p.name} = ${show(values[i]!)}`).join(', ');
  }

  /** Run to completion (or to the limits). */
  all(): this {
    while (this.step()) {
      /* keep going */
    }
    return this;
  }

  get leaves(): SymNode[] {
    return this.nodes.filter((n) => n.kind === 'leaf');
  }
  get failures(): Failure[] {
    return this.nodes.flatMap((n) => n.failures);
  }
}
