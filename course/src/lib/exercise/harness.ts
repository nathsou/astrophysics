/**
 * `@lm/test` — a tiny Vitest-compatible test harness used by in-browser exercises.
 *
 * Exercise tests are written against this subset so they run both here (in a worker, against the
 * learner's code) and under Vitest (against the reference solution, via an alias to `vitest`).
 */

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  ms: number;
}

type TestFn = () => void | Promise<void>;
interface Registered {
  name: string;
  fn: TestFn;
}

let registry: Registered[] = [];
let prefix: string[] = [];

export function describe(name: string, fn: () => void): void {
  prefix.push(name);
  try {
    fn();
  } finally {
    prefix.pop();
  }
}

export function test(name: string, fn: TestFn): void {
  registry.push({ name: [...prefix, name].join(' › '), fn });
}
export const it = test;

/** Run and clear all registered tests. */
export async function runRegistered(format: (e: unknown) => string = (e) => (e instanceof Error ? e.message : String(e))): Promise<TestResult[]> {
  const tests = registry;
  registry = [];
  prefix = [];
  const results: TestResult[] = [];
  for (const t of tests) {
    const start = performance.now();
    try {
      await t.fn();
      results.push({ name: t.name, passed: true, ms: performance.now() - start });
    } catch (e) {
      results.push({ name: t.name, passed: false, error: format(e), ms: performance.now() - start });
    }
  }
  return results;
}

// ───────────── formatting & equality ─────────────

export function show(v: unknown, depth = 0): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
  if (typeof v === 'bigint') return `${v}n`;
  if (v === null || v === undefined || typeof v === 'boolean') return String(v);
  if (typeof v === 'function') return `[Function ${v.name || 'anonymous'}]`;
  if (depth > 2) return '…';
  if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
    const arr = Array.from(v as unknown as ArrayLike<number>);
    const body = arr.slice(0, 16).map((x) => show(x)).join(', ');
    return `${v.constructor.name}(${arr.length}) [${body}${arr.length > 16 ? ', …' : ''}]`;
  }
  if (Array.isArray(v)) {
    const body = v.slice(0, 16).map((x) => show(x, depth + 1)).join(', ');
    return `[${body}${v.length > 16 ? `, … (${v.length} items)` : ''}]`;
  }
  if (v instanceof Map) return `Map(${v.size}) {${[...v].slice(0, 8).map(([k, x]) => `${show(k, depth + 1)} => ${show(x, depth + 1)}`).join(', ')}${v.size > 8 ? ', …' : ''}}`;
  if (v instanceof Set) return `Set(${v.size}) {${[...v].slice(0, 8).map((x) => show(x, depth + 1)).join(', ')}}`;
  const entries = Object.entries(v as object);
  return `{ ${entries.slice(0, 10).map(([k, x]) => `${k}: ${show(x, depth + 1)}`).join(', ')}${entries.length > 10 ? ', …' : ''} }`;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || a.constructor !== b.constructor) return false;
    const x = a as unknown as ArrayLike<unknown>, y = b as unknown as ArrayLike<unknown>;
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) if (!Object.is(x[i], y[i])) return false;
    return true;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map && b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set && b instanceof Set) || a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  return true;
}

/** First index where two array-likes differ (for friendlier messages). */
function firstDiff(a: unknown, b: unknown): string {
  if (!(Array.isArray(a) || ArrayBuffer.isView(a)) || !(Array.isArray(b) || ArrayBuffer.isView(b))) return '';
  const x = a as ArrayLike<unknown>, y = b as ArrayLike<unknown>;
  if (x.length !== y.length) return ` (length ${x.length} vs ${y.length})`;
  for (let i = 0; i < x.length; i++) if (!deepEqual(x[i], y[i])) return ` (first difference at index ${i}: ${show(x[i])} vs ${show(y[i])})`;
  return '';
}

// ───────────── expect ─────────────

export interface Matchers {
  not: Matchers;
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toStrictEqual(expected: unknown): void;
  toBeCloseTo(expected: number, digits?: number): void;
  toBeGreaterThan(n: number): void;
  toBeGreaterThanOrEqual(n: number): void;
  toBeLessThan(n: number): void;
  toBeLessThanOrEqual(n: number): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toBeNaN(): void;
  toHaveLength(n: number): void;
  toContain(item: unknown): void;
  toBeInstanceOf(cls: abstract new (...args: never[]) => unknown): void;
  toThrow(match?: string | RegExp): void;
}

function makeMatchers(actual: unknown, negate: boolean): Matchers {
  const check = (ok: boolean, msg: () => string) => {
    if (ok === negate) throw new Error((negate ? 'Expected NOT: ' : '') + msg());
  };
  const m: Omit<Matchers, 'not'> = {
    toBe: (e) => check(Object.is(actual, e), () => `expected ${show(e)}, received ${show(actual)}`),
    toEqual: (e) => check(deepEqual(actual, e), () => `expected ${show(e)}, received ${show(actual)}${firstDiff(actual, e)}`),
    toStrictEqual: (e) => check(deepEqual(actual, e), () => `expected ${show(e)}, received ${show(actual)}${firstDiff(actual, e)}`),
    toBeCloseTo: (e, digits = 2) =>
      check(typeof actual === 'number' && Math.abs(actual - e) < 10 ** -digits / 2, () => `expected ≈ ${e} (±${10 ** -digits / 2}), received ${show(actual)}`),
    toBeGreaterThan: (n) => check((actual as number) > n, () => `expected > ${n}, received ${show(actual)}`),
    toBeGreaterThanOrEqual: (n) => check((actual as number) >= n, () => `expected ≥ ${n}, received ${show(actual)}`),
    toBeLessThan: (n) => check((actual as number) < n, () => `expected < ${n}, received ${show(actual)}`),
    toBeLessThanOrEqual: (n) => check((actual as number) <= n, () => `expected ≤ ${n}, received ${show(actual)}`),
    toBeTruthy: () => check(!!actual, () => `expected a truthy value, received ${show(actual)}`),
    toBeFalsy: () => check(!actual, () => `expected a falsy value, received ${show(actual)}`),
    toBeUndefined: () => check(actual === undefined, () => `expected undefined, received ${show(actual)}`),
    toBeDefined: () => check(actual !== undefined, () => `expected a defined value`),
    toBeNaN: () => check(Number.isNaN(actual), () => `expected NaN, received ${show(actual)}`),
    toHaveLength: (n) => check((actual as { length?: number })?.length === n, () => `expected length ${n}, received ${show((actual as { length?: number })?.length)}`),
    toContain: (item) =>
      check(
        typeof actual === 'string' ? actual.includes(item as string) : Array.from(actual as Iterable<unknown>).some((x) => Object.is(x, item)),
        () => `expected ${show(actual)} to contain ${show(item)}`,
      ),
    toBeInstanceOf: (cls) => check(actual instanceof cls, () => `expected an instance of ${cls.name}, received ${show(actual)}`),
    toThrow: (match) => {
      let threw = false;
      let message = '';
      try {
        (actual as () => unknown)();
      } catch (e) {
        threw = true;
        message = e instanceof Error ? e.message : String(e);
      }
      const ok = threw && (match === undefined || (typeof match === 'string' ? message.includes(match) : match.test(message)));
      check(ok, () => (threw ? `expected error matching ${String(match)}, got "${message}"` : 'expected the function to throw'));
    },
  };
  // A lazy getter (Object.assign would evaluate it eagerly and recurse forever).
  Object.defineProperty(m, 'not', { get: () => makeMatchers(actual, !negate) });
  return m as Matchers;
}

export function expect(actual: unknown): Matchers {
  return makeMatchers(actual, false);
}
