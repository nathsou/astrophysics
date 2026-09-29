// The dependency graph of the Elements, read off the citations Heath prints in brackets.
// Porisms and lemmas are folded into the proposition they belong to.

import { byId, index } from '../text';

export const cites = new Map<string, string[]>(index.map((e) => [e.id, e.cites.filter((c) => c !== e.id && byId.has(c))]));
export const citedBy = new Map<string, string[]>();
for (const [id, cs] of cites) for (const c of cs) (citedBy.get(c) ?? citedBy.set(c, []).get(c)!).push(id);

const order = new Map(index.map((e, i) => [e.id, i]));
export const orderOf = (id: string) => order.get(id) ?? -1;

function closure(id: string, next: (id: string) => string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...next(id)];
  while (stack.length) {
    const x = stack.pop()!;
    if (seen.has(x)) continue;
    seen.add(x);
    stack.push(...next(x));
  }
  return seen;
}

const ancCache = new Map<string, Set<string>>();
export function ancestors(id: string): Set<string> {
  let s = ancCache.get(id);
  if (!s) ancCache.set(id, (s = closure(id, (x) => cites.get(x) ?? [])));
  return s;
}
export const descendants = (id: string) => closure(id, (x) => citedBy.get(x) ?? []);

export const PARALLEL_POSTULATE = '1.post.5';
/** Whether a proposition rests, directly or not, on the parallel postulate. */
export const usesParallelPostulate = (id: string) => ancestors(id).has(PARALLEL_POSTULATE);

const depthCache = new Map<string, number>();
/** Length of the longest chain of propositions below this one (a proposition citing only first principles has depth 1). */
export function depth(id: string): number {
  const hit = depthCache.get(id);
  if (hit !== undefined) return hit;
  depthCache.set(id, 0); // guards against cycles
  const e = byId.get(id);
  const own = e?.kind === 'prop' ? 1 : 0;
  const d = own + Math.max(0, ...(cites.get(id) ?? []).map(depth));
  depthCache.set(id, d);
  return d;
}

/** A longest chain of citations from this proposition down to first principles. */
export function longestChain(id: string): string[] {
  const chain = [id];
  let cur = id;
  for (;;) {
    const cs = (cites.get(cur) ?? []).filter((c) => byId.get(c)?.kind === 'prop');
    if (!cs.length) break;
    cur = cs.reduce((a, b) => (depth(b) > depth(a) ? b : a));
    chain.push(cur);
  }
  return chain;
}

/** Citations that point forward in the book (should not happen in a deductive order). */
export function forwardCitations(): [string, string][] {
  const out: [string, string][] = [];
  for (const [id, cs] of cites) for (const c of cs) if (byId.get(c)?.kind === 'prop' && orderOf(c) > orderOf(id)) out.push([id, c]);
  return out;
}
