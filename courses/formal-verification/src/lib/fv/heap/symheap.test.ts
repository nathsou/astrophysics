import { describe, expect, it } from 'vitest';
import { parse } from '../vouch/syntax/parser';
import { check } from '../vouch/check/checker';
import { HeapVerifier } from './symheap';

const NODE = `class Node {
  val: int
  next: ref Node?
}
`;
function verify(src: string, fn: string) {
  const full = NODE + src;
  const p = parse(full);
  const c = check(p.program);
  const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
  if (errs.length) throw new Error(errs.map((e) => e.message).join('; '));
  return new HeapVerifier(c, full).verify(fn);
}

const REVERSE = `
fn reverse(x: ref Node?) -> ref Node?
  requires list(x)
  ensures list(result)
{
  var prev: ref Node? = null
  var cur = x
  while cur != null
    invariant list(prev) ** list(cur)
  {
    let n = cur.next
    cur.next = prev
    prev = cur
    cur = n
  }
  return prev
}`;

describe('the heap verifier', () => {
  it('verifies list reversal', () => {
    const r = verify(REVERSE, 'reverse');
    expect(r.errors).toEqual([]);
    expect(r.steps.some((s) => s.event === 'unfold')).toBe(true);
  });
  it('finds a null dereference when the loop condition is wrong', () => {
    const r = verify(REVERSE.replace('while cur != null', 'while true'), 'reverse');
    expect(r.errors.map((e) => e.kind)).toContain('null');
  });
  it('rejects an invariant that loses the reversed part (a leak inside the loop)', () => {
    const r = verify(REVERSE.replace('invariant list(prev) ** list(cur)', 'invariant list(cur)'), 'reverse');
    expect(r.verified).toBe(false);
  });
  it('verifies push and allocation, and finds leaks and use-after-free', () => {
    expect(verify(`
fn push(x: ref Node?, v: int) -> ref Node
  requires list(x)
  ensures list(result)
{
  let n = new Node { val: v, next: x }
  return n
}`, 'push').errors).toEqual([]);
    const leak = verify(`
fn drop_head(x: ref Node) -> ref Node?
  requires x.next |-> null ** x.val |-> 0
  ensures emp
{
  return null
}`, 'drop_head');
    expect(leak.errors.map((e) => e.kind)).toEqual(['leak']);
    const uaf = verify(`
fn use_after_free(x: ref Node)
  requires x.next |-> null ** x.val |-> 0
  ensures emp
{
  free x
  x.val = 3
}`, 'use_after_free');
    expect(uaf.errors.map((e) => e.kind)).toEqual(['freed']);
  });
  it('swaps field values and uses the frame rule at calls', () => {
    const src = `
fn swap(a: ref Node, b: ref Node)
  requires a.val |-> 1 ** b.val |-> 2
  ensures a.val |-> 2 ** b.val |-> 1
{
  let t = a.val
  a.val = b.val
  b.val = t
}

fn caller(a: ref Node, b: ref Node, c: ref Node)
  requires a.val |-> 1 ** b.val |-> 2 ** c.val |-> 7
  ensures a.val |-> 2 ** b.val |-> 1 ** c.val |-> 7
{
  swap(a, b)
}`;
    expect(verify(src, 'swap').errors).toEqual([]);
    const caller = verify(src, 'caller');
    expect(caller.errors).toEqual([]);
    expect(caller.steps.some((s) => s.event === 'call')).toBe(true);
    // Aliasing: the same object twice cannot satisfy a.val ↦ 1 ∗ a.val ↦ 2.
    const alias = verify(src.replace('  swap(a, b)', '  swap(a, a)'), 'caller');
    expect(alias.errors.map((e) => e.kind)).toEqual(['precondition']);
  });
});

describe('heap verdicts', () => {
  it('replays a null dereference on a concrete list', async () => {
    const { heapVerdicts } = await import('./verdicts');
    const src = NODE + REVERSE.replace('while cur != null', 'while true');
    const c = check(parse(src).program);
    const { verdicts } = heapVerdicts(c, c.fns.get('reverse')!, src);
    expect(verdicts.some((v) => v.status === 'violated' && v.badge.kind === 'violated' && v.badge.replayed)).toBe(true);
    const ok = NODE + REVERSE;
    const c2 = check(parse(ok).program);
    expect(heapVerdicts(c2, c2.fns.get('reverse')!, ok).verdicts[0]!.status).toBe('verified');
  });
});
