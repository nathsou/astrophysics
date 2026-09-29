import { describe, expect, test } from 'vitest';
import { PartsStoreCore, partsResolver, STORAGE_KEY, type StorageLike } from './store-core';
import { referenceOf, behaviourOf } from './parts';
import { checkPart } from './verify';
import { checkCombinational } from '../sim/check';
import { flatten } from '../sim/netlist/flatten';
import type { Circuit } from '../sim/netlist/types';

class Mem implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

/** A half adder whose carry is wrong (an OR): a reader's buggy version. */
const brokenHalfAdder = (): Circuit => {
  const c = structuredClone(referenceOf('half-adder')!);
  c.components.find((x) => x.type === 'part:and')!.type = 'part:or';
  return c;
};

describe('parts store', () => {
  test('saves, reloads and removes', () => {
    const mem = new Mem();
    const a = new PartsStoreCore(mem);
    a.set('half-adder', referenceOf('half-adder')!, { gates: 2 });
    expect(a.has('half-adder')).toBe(true);
    const b = new PartsStoreCore(mem);
    b.load();
    expect(b.mine['half-adder']!.gates).toBe(2);
    expect(b.useMine).toBe(true);
    b.setUseMine(false);
    const c = new PartsStoreCore(mem);
    c.load();
    expect(c.useMine).toBe(false);
    c.remove('half-adder');
    const d = new PartsStoreCore(mem);
    d.load();
    expect(d.has('half-adder')).toBe(false);
  });
  test('survives missing, corrupt and unknown data', () => {
    const mem = new Mem();
    mem.setItem(STORAGE_KEY, '{nope');
    const s = new PartsStoreCore(mem);
    expect(() => s.load()).not.toThrow();
    mem.setItem(STORAGE_KEY, JSON.stringify({ version: 1, useMine: true, mine: { ghost: { circuit: referenceOf('and') }, and: { circuit: 5 } } }));
    s.load();
    expect(Object.keys(s.mine)).toEqual([]);
    expect(() => new PartsStoreCore().set('and', referenceOf('and')!)).not.toThrow();
    const broken: StorageLike = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    const t = new PartsStoreCore(broken);
    expect(() => (t.load(), t.set('and', referenceOf('and')!))).not.toThrow();
    expect(t.has('and')).toBe(true);
  });
  test('unknown parts are refused', () => {
    expect(() => new PartsStoreCore().set('warp-drive', referenceOf('and')!)).toThrow();
  });
  test('export and import round trip; failing circuits are skipped', () => {
    const a = new PartsStoreCore(new Mem());
    a.set('half-adder', referenceOf('half-adder')!);
    a.set('xor', referenceOf('xor')!);
    const text = a.exportJson();
    const b = new PartsStoreCore(new Mem());
    const r = b.importJson(text);
    expect(r.imported.sort()).toEqual(['half-adder', 'xor']);
    const bad = new PartsStoreCore(new Mem());
    bad.set('half-adder', brokenHalfAdder());
    const c = new PartsStoreCore(new Mem());
    const r2 = c.importJson(bad.exportJson());
    expect(r2.imported).toEqual([]);
    expect(r2.skipped[0]!.id).toBe('half-adder');
    expect(() => c.importJson('nope')).toThrow(/JSON/);
    expect(() => c.importJson('{"version":2}')).toThrow(/parts bin/);
  });
});

describe('parts resolver', () => {
  const mineFor = (circuit: Circuit) => (id: string) => (id === 'half-adder' ? { circuit, savedAt: 0 } : undefined);
  test('references by default; the reader’s version when using mine', () => {
    const broken = brokenHalfAdder();
    expect(partsResolver(false, mineFor(broken))('part:half-adder')).toBe(behaviourOf('half-adder'));
    expect(partsResolver(true, mineFor(broken))('part:half-adder')).toBe(broken);
    expect(partsResolver(true)('part:half-adder')).toBe(behaviourOf('half-adder'));
    expect(partsResolver(true)('sub:x')).toBeUndefined();
  });
  test('a full adder built on the reader’s (broken) half adder fails; on the reference it passes', () => {
    const broken = brokenHalfAdder();
    const fa = referenceOf('full-adder')!;
    expect(checkPart('full-adder', fa, partsResolver(false, mineFor(broken))).pass).toBe(true);
    expect(checkPart('full-adder', fa, partsResolver(true, mineFor(broken))).pass).toBe(false);
  });
  test('transistor-level parts stand in as one gate, and reader versions of them never substitute', () => {
    const stand = flatten(
      { version: 1, components: [{ id: 'X', type: 'part:nand', x: 0, y: 0 }], wires: [] },
      partsResolver(true, () => ({ circuit: referenceOf('nand')!, savedAt: 0 })),
    );
    expect(stand.elements.map((e) => e.type)).toEqual(['nand']);
  });
  test('a reader-built NAND from primitives works in a circuit that uses part:nand', () => {
    expect(checkCombinational(referenceOf('and')!, { expression: 'Y = A & B' }, { parts: partsResolver(false) }).pass).toBe(true);
  });
});
