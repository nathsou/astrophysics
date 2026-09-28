// Computable functions that are not primitive recursive (section "Non-Primitive Recursive
// Functions"). The book defines the hierarchy
//
//   g₀(x) = x + 1,   g_{n+1}(x) = gₙˣ(x)   (gₙ applied x times to x)
//
// with g₁(x) = 2x and g₂(x) = 2ˣ · x, and says the Ackermann–Péter function is essentially
// G(x) = gₓ(x), which grows faster than every primitive recursive function. The usual
// two-argument Ackermann–Péter function
//
//   A(0, n) = n + 1,   A(m + 1, 0) = A(m, 1),   A(m + 1, n + 1) = A(m, A(m + 1, n))
//
// is included too. Both are evaluated by plain rewriting, one step at a time, with a step budget
// ("fuel"): the values explode so quickly that most inputs exhaust any budget. Running out of
// fuel says nothing about the value except that it takes more steps than that.

export type FuelResult<T> =
  | { status: 'ok'; value: bigint; steps: number; trace: T[]; traceTruncated: boolean }
  | { status: 'out-of-fuel'; steps: number; trace: T[]; traceTruncated: boolean };

export interface HierarchyOptions {
  /** maximum number of applications of any gₖ (default 100 000) */
  fuel?: number;
  /** maximum number of trace entries kept (default 200) */
  maxTrace?: number;
}

export interface HierarchyStep {
  /** nesting depth of the call */
  depth: number;
  /** the level k of gₖ */
  n: number;
  x: bigint;
  /** set once the call returns */
  value?: bigint;
  /** e.g. "g₂(3) = g₁(g₁(g₁(3)))" */
  note: string;
}

class Exhausted extends Error {}

const sub = (n: number) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]);

/** gₙ(x), unfolding g_{k+1}(x) into x applications of gₖ, down to g₀(x) = x + 1. */
export function gHierarchy(n: number, x: bigint | number, opt: HierarchyOptions = {}): FuelResult<HierarchyStep> {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('the level n must be a natural number');
  const x0 = BigInt(x);
  if (x0 < 0n) throw new RangeError('x must be a natural number');
  let fuel = opt.fuel ?? 100_000;
  const maxTrace = opt.maxTrace ?? 200;
  const trace: HierarchyStep[] = [];
  let truncated = false;
  let steps = 0;

  const g = (k: number, v: bigint, depth: number): bigint => {
    if (--fuel < 0) throw new Exhausted();
    steps++;
    const note =
      k === 0
        ? `g₀(${v}) = ${v} + 1`
        : v === 0n
          ? `g${sub(k)}(0) = 0 (g${sub(k - 1)} applied 0 times)`
          : `g${sub(k)}(${v}) = ${v <= 4n ? Array.from({ length: Number(v) }, () => `g${sub(k - 1)}(`).join('') + v + ')'.repeat(Number(v)) : `g${sub(k - 1)}(g${sub(k - 1)}(… g${sub(k - 1)}(${v}) …)), ${v} times`}`;
    const entry: HierarchyStep | null = trace.length < maxTrace ? { depth, n: k, x: v, note } : null;
    if (entry) trace.push(entry);
    else truncated = true;
    let r: bigint;
    if (k === 0) r = v + 1n;
    else {
      r = v;
      for (let i = 0n; i < v; i++) r = g(k - 1, r, depth + 1);
    }
    if (entry) entry.value = r;
    return r;
  };

  try {
    const value = g(n, x0, 0);
    return { status: 'ok', value, steps, trace, traceTruncated: truncated };
  } catch (e) {
    if (e instanceof Exhausted) return { status: 'out-of-fuel', steps, trace, traceTruncated: truncated };
    throw e;
  }
}

/** G(x) = gₓ(x). G(0) = 1, G(1) = 2, G(2) = 8; G(3) = g₂(g₂(24)) is already beyond reach. */
export function bigG(x: number, opt: HierarchyOptions = {}): FuelResult<HierarchyStep> {
  return gHierarchy(x, x, opt);
}

// ------------------------------------------------------------------ Ackermann–Péter

export type AckermannRule = 'A(0, n) = n + 1' | 'A(m + 1, 0) = A(m, 1)' | 'A(m + 1, n + 1) = A(m, A(m + 1, n))';

export interface AckermannStep {
  /** the expression before this rewriting step, e.g. "A(1, A(2, 0))" */
  expr: string;
  rule: AckermannRule;
}

export interface AckermannOptions {
  /** maximum number of rewriting steps (default 100 000) */
  fuel?: number;
  /** maximum number of trace entries kept (default 200) */
  maxTrace?: number;
}

/**
 * A(m, n) by rewriting the innermost call, one equation at a time. The pending outer calls are
 * kept on a stack, so the expression is A(m_k, A(m_{k-1}, … A(m_0, n) …)).
 */
export function ackermann(m: bigint | number, n: bigint | number, opt: AckermannOptions = {}): FuelResult<AckermannStep> & { final?: string } {
  let fuel = opt.fuel ?? 100_000;
  const maxTrace = opt.maxTrace ?? 200;
  const stack: bigint[] = [BigInt(m)]; // stack[0] is outermost
  let arg = BigInt(n);
  if (stack[0] < 0n || arg < 0n) throw new RangeError('A is defined on natural numbers');
  const trace: AckermannStep[] = [];
  let truncated = false;
  let steps = 0;
  const show = () => stack.map((k) => `A(${k}, `).join('') + arg + ')'.repeat(stack.length);
  while (stack.length > 0) {
    if (--fuel < 0) return { status: 'out-of-fuel', steps, trace, traceTruncated: truncated, final: show() };
    steps++;
    const top = stack[stack.length - 1];
    const rule: AckermannRule = top === 0n ? 'A(0, n) = n + 1' : arg === 0n ? 'A(m + 1, 0) = A(m, 1)' : 'A(m + 1, n + 1) = A(m, A(m + 1, n))';
    if (trace.length < maxTrace) trace.push({ expr: show(), rule });
    else truncated = true;
    stack.pop();
    if (top === 0n) arg += 1n;
    else if (arg === 0n) {
      stack.push(top - 1n);
      arg = 1n;
    } else {
      stack.push(top - 1n, top);
      arg -= 1n;
    }
  }
  return { status: 'ok', value: arg, steps, trace, traceTruncated: truncated, final: String(arg) };
}
