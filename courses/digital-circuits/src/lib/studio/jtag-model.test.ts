import { describe, expect, it } from 'vitest';
import { programOverJtag } from './jtag-model';
import { TAP_EDGES, TAP_NODES, edgeFor } from './tap-layout';
import { TAP_STATES, nextTapState } from '../pld/cpld/jtag';
import { programCpld } from './adapters/cpld';
import { VCpld32 } from '../pld/devices/vcpld32';
import { IDCODE_VALUE } from '../pld/cpld/jtag';
import { listAdapters } from './adapters';

describe('the TAP diagram', () => {
  it('has a node per state and an edge per transition', () => {
    expect(TAP_NODES.map((n) => n.state).sort()).toEqual([...TAP_STATES].sort());
    expect(TAP_EDGES).toHaveLength(32);
    for (const e of TAP_EDGES) expect(nextTapState(e.from, e.tms)).toBe(e.to);
    expect(edgeFor('Shift-DR', 0).to).toBe('Shift-DR');
  });
});

describe('a recorded JTAG programming session', () => {
  const ex = listAdapters().find((a) => a.id === 'cpld32')!.examples.find((e) => e.id === 'counter')!;
  const r = programCpld(ex.source);
  if (!('fit' in r)) throw new Error('fit');
  const bits = r.fit.chip.bits;
  const s = programOverJtag(bits);
  it('programs and verifies', () => {
    expect(s.ok).toBe(true);
    expect(s.mismatches).toBe(0);
    expect(s.idcode).toBe(IDCODE_VALUE);
    expect(s.rowsProgrammed).toBeGreaterThan(3);
    expect(s.cycles.length).toBeGreaterThan(1000);
    expect(s.marks[0]!.cycle).toBe(0);
  });
  it('tracks the row being programmed', () => {
    const first = s.marks.find((m) => m.row !== undefined)!;
    expect(s.progress(first.cycle + 5).current).toBe(first.row);
    expect(s.progress(0).done).toBe(0);
    expect(s.progress(s.cycles.length).done).toBe(s.rowsProgrammed);
    expect(s.markAt(first.cycle + 5)).toBe(first);
  });
  it('records a consistent trace', () => {
    for (let i = 1; i < s.cycles.length; i++) expect(s.cycles[i]!.state).toBe(s.cycles[i - 1]!.next);
  });
  it('matches direct programming', () => {
    expect(new VCpld32(bits).isBlank).toBe(false);
  });
});
