import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check, elaborate } from '../index';
import { constructs, formatCounts, totalsByKind } from './cost';
import { lowerToNetlist } from './index';
import { elementsAt, elementsOnLine, spansOfElement } from './probe';

const load = (f: string) => readFileSync(new URL(`../../../../content/designs/${f}`, import.meta.url), 'utf8');

function lowered(f: string, top: string) {
  const source = load(f);
  const { program } = check(source, { file: f, tests: false });
  return { source, l: lowerToNetlist(elaborate(program, top)) };
}

describe('constructs', () => {
  it('names each expression of the counter and counts what it cost', () => {
    const { source, l } = lowered('counter.dcl', 'Counter');
    const cs = constructs(l);
    const add = cs.find((c) => c.kind === 'add')!;
    expect(add.title).toBe('4-bit incrementer (adds a constant)');
    expect(source.slice(add.from, add.to)).toBe('value + 1');
    expect(add.counts).toEqual({ xor: 3, not: 1, and: 2 });
    expect(add.text).toContain('3 XOR gates');
    const reg = cs.find((c) => c.kind === 'reg')!;
    expect(reg.counts).toEqual({ dff: 4 });
    expect(formatCounts(reg.counts)).toBe('4 flip-flops');
    expect(totalsByKind(cs).find((t) => t.kind === 'reg')!.total).toBe(4);
  });

  it('cross-probes from an offset to gates and back', () => {
    const { source, l } = lowered('counter.dcl', 'Counter');
    const offset = source.indexOf('value + 1') + 6;
    const hit = elementsAt(l, offset);
    expect(source.slice(hit.range!.from, hit.range!.to)).toBe('value + 1');
    expect(hit.ids.length).toBeGreaterThan(3);
    for (const id of hit.ids) expect(spansOfElement(l, id).some((s) => s.from <= offset && offset <= s.to)).toBe(true);
    // A keyword falls back to the line.
    const line = source.slice(0, source.indexOf('next value')).split('\n').length;
    expect(elementsAt(l, source.indexOf('next value') + 1, line).ids.length).toBeGreaterThan(3);
    expect(elementsOnLine(l, line).ids.length).toBeGreaterThan(3);
  });

  it('shares identical gates between constructs', () => {
    const { l } = lowered('traffic-light.dcl', 'TrafficLight');
    // `state == Light.RedAmber` is written twice; the comparison is built once.
    expect(Object.values(l.elements).some((e) => (e.shared ?? []).length > 0)).toBe(true);
    expect(l.stats.gates).toBeLessThan(22);
  });
});
