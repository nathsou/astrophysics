import { describe, expect, it } from 'vitest';
import { track } from './perm';

const errOf = (src: string) => track(src.trim().split('\n')).find((l) => l.error);

describe('the permission model', () => {
  it('accepts shared reads and a later write once the borrow is dead', () => {
    expect(errOf(`let a = new
let r = &a
read r
read a
write a`)).toBeUndefined();
  });
  it('rejects a write while a shared borrow is alive', () => {
    const e = errOf(`let a = new
let r = &a
write a
read r`);
    expect(e?.text).toBe('write a');
  });
  it('rejects two mutable borrows, use after move, and drop while borrowed', () => {
    expect(errOf(`let a = new
let m = &mut a
let n = &mut a
write m`)?.text).toBe('let n = &mut a');
    expect(errOf(`let a = new
let b = a
read a`)?.text).toBe('read a');
    expect(errOf(`let a = new
let r = &a
drop a
read r`)?.text).toBe('drop a');
  });
  it('splits shared permission into fractions', () => {
    const t = track(['let a = new', 'let r = &a', 'let s = &a', 'read r', 'read s']);
    const h = t[2]!.holdings;
    expect(h.find((x) => x.name === 'a')!.amount).toBe(0.25);
    expect(h.find((x) => x.name === 'r')!.amount).toBe(0.5);
    expect(h.find((x) => x.name === 's')!.amount).toBe(0.25);
  });
});
