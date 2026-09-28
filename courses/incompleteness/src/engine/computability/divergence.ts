// Certain divergence: a few simple, sound tests that show a partial recursive definition is
// undefined at an input. Added for this edition, to keep three things apart in the workbenches:
//
//   a value (the computation halted), "undefined" (known for certain, with a reason), and
//   "no answer within N steps" (nothing is known).
//
// The tests are syntactic and deliberately weak. They are *sound* — when they say "undefined",
// the function is undefined there — but most divergent computations escape them, as they must:
// no algorithm recognises all of them (that is the undecidability of the halting problem).

import { arity, evaluate, type RF } from '../recursive/rf.ts';

const unwrap = (f: RF): RF => (f.k === 'def' ? unwrap(f.body) : f);

/** f never takes the value 0 where it is defined (its last step is a successor). */
export function neverZero(f: RF): boolean {
  f = unwrap(f);
  switch (f.k) {
    case 'succ':
      return true;
    case 'comp':
      return neverZero(f.f);
    case 'rec':
      // h(x⃗, 0) = f(x⃗) and h(x⃗, y + 1) = g(…): both nonzero where defined.
      return neverZero(f.f) && neverZero(f.g);
    default:
      return false;
  }
}

/** f is undefined for every argument. */
export function nowhereDefined(f: RF): boolean {
  f = unwrap(f);
  switch (f.k) {
    case 'min':
      // μx f(x, z⃗): no x with f(x, z⃗) = 0, or already f(0, z⃗) undefined.
      return neverZero(f.f) || nowhereDefined(f.f);
    case 'comp':
      // f(g₀(x⃗), …) is defined only if every gᵢ(x⃗) is, and f is at those values.
      return nowhereDefined(f.f) || f.gs.some(nowhereDefined);
    case 'rec':
      // h(x⃗, 0) = f(x⃗) undefined, and each h(x⃗, y + 1) needs h(x⃗, y).
      return nowhereDefined(f.f);
    default:
      return false;
  }
}

/** Neither the value nor the definedness of f depends on its i-th argument. */
export function ignoresArg(f: RF, i: number): boolean {
  f = unwrap(f);
  switch (f.k) {
    case 'zero':
      return true;
    case 'succ':
      return false;
    case 'proj':
      return f.i !== i;
    case 'basic':
      return false;
    case 'comp':
      return f.gs.every((g) => ignoresArg(g, i));
    case 'rec': {
      const a = arity(f);
      if (!a.ok || i === a.arity - 1) return false; // the recursion variable
      return ignoresArg(f.f, i) && ignoresArg(f.g, i);
    }
    case 'min':
      return ignoresArg(f.f, i + 1);
    case 'def':
      return ignoresArg(f.body, i);
  }
}

function valueWithin(f: RF, args: bigint[], fuel: number): bigint | null {
  const r = evaluate(f, args, { fuel, maxTraceDepth: -1 });
  return r.status === 'ok' && r.value !== undefined ? r.value : null;
}

/**
 * A reason why f(args) is certainly undefined, or null when these tests cannot tell (which is
 * NOT evidence that it is defined). Values of parts are computed with at most `fuel` calls.
 */
export function certainlyUndefined(f: RF, args: bigint[], fuel = 2_000): string | null {
  f = unwrap(f);
  switch (f.k) {
    case 'zero':
    case 'succ':
    case 'proj':
    case 'basic':
      return null;
    case 'min': {
      if (neverZero(f.f)) return 'the search looks for a 0, but the searched function never takes the value 0 (its last step is always a successor)';
      if (nowhereDefined(f.f)) return 'the searched function is undefined everywhere, so the first test never returns';
      const first = certainlyUndefined(f.f, [0n, ...args], fuel);
      if (first) return `the first test f(0, …) is undefined (${first}), so the search never gets past 0`;
      if (ignoresArg(f.f, 0)) {
        const v = valueWithin(f.f, [0n, ...args], fuel);
        if (v !== null && v !== 0n) return `the searched function does not depend on the search variable, and its value here is ${v} ≠ 0 for every x`;
      }
      return null;
    }
    case 'comp': {
      const ys: bigint[] = [];
      for (const g of f.gs) {
        const why = certainlyUndefined(g, args, fuel);
        if (why) return `an inner function is undefined here (${why})`;
      }
      for (const g of f.gs) {
        const v = valueWithin(g, args, fuel);
        if (v === null) return null;
        ys.push(v);
      }
      const why = certainlyUndefined(f.f, ys, fuel);
      return why ? `the outer function is undefined at (${ys.join(', ')}) (${why})` : null;
    }
    case 'rec': {
      const xs = args.slice(0, -1);
      const y = args[args.length - 1];
      const base = certainlyUndefined(f.f, xs, fuel);
      if (base) return `the base case h(x⃗, 0) is undefined (${base}), and every later value needs it`;
      if (y > 0n && nowhereDefined(f.g)) return 'the step function is undefined everywhere, so no value past h(x⃗, 0) exists';
      return null;
    }
    case 'def':
      return certainlyUndefined(f.body, args, fuel);
  }
}
