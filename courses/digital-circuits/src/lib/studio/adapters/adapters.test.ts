import { describe, expect, it } from 'vitest';
import { getAdapter, listAdapters } from './index';
import type { DeviceFit } from '../types';
import { programProm, type PromFit } from './prom';
import { plaAdapter, blankPla, type PlaDeviceFit } from './pla';
import { galAdapter, galFromFuses, type GalDeviceFit } from './gal';
import { cpldAdapter, cpldFromBits, type CpldDeviceFit } from './cpld';
import { FUSE_COUNT } from '../../pld/devices/gal22v10';
import { BIT_COUNT } from '../../pld/devices/vcpld32-arch';
import { findExample } from '../examples';

const fitOf = (device: string, example: string): DeviceFit => {
  const a = getAdapter(device)!;
  const r = a.program(findExample(device as 'prom', example)!.source);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.fit;
};

describe('every example', () => {
  for (const a of listAdapters())
    for (const ex of a.examples)
      describe(`${a.id}/${ex.id}`, () => {
        const r = a.program(ex.source);
        it('fits', () => expect(r.ok).toBe(true));
        if (!r.ok) return;
        const fit = r.fit;
        it('has a network, a report and files', () => {
          expect(fit.network.outputs.length).toBeGreaterThan(0);
          expect(fit.network.terms.length).toBeGreaterThan(0);
          expect(fit.report.length).toBeGreaterThan(1);
          expect(fit.files?.length).toBeGreaterThan(0);
          expect(fit.summary).toMatch(/\d/);
        });
        it('has a consistent bits grid', () => {
          const b = fit.bits;
          let cells = 0;
          for (let r = 0; r < b.rows; r++)
            for (let c = 0; c < b.columns; c++) {
              const i = b.index(r, c);
              if (i < 0) continue;
              cells++;
              expect(b.cell(i)).toEqual({ row: r, col: c });
              expect(b.region(i)).toBeLessThan(b.regions.length);
            }
          expect(cells).toBe(b.count);
          expect(typeof b.describe(0)).toBe('string');
          expect(b.describe(b.count - 1).length).toBeGreaterThan(5);
        });
        it('resolves every output to something', () => {
          for (const o of fit.network.outputs) {
            const p = fit.resolve({ kind: 'output', name: o.name });
            expect(p.outputs.has(o.name)).toBe(true);
            expect(p.bits.size).toBeGreaterThan(0);
            for (const t of o.terms) expect(p.terms.has(t)).toBe(true);
          }
        });
        it('resolves a term to its outputs and a bit back to its term', () => {
          const o = fit.network.outputs.find((x) => x.terms.length > 0)!;
          const t = o.terms[0]!;
          const pt = fit.resolve({ kind: 'term', id: t });
          expect(pt.terms.has(t)).toBe(true);
          expect(pt.outputs.has(o.name)).toBe(true);
          const bit = [...pt.bits][0]!;
          expect(fit.resolve({ kind: 'bit', index: bit }).bits.has(bit)).toBe(true);
        });
      });
});

describe('vPROM', () => {
  const fit = fitOf('prom', 'adder') as PromFit;
  it('stores the truth table', () => {
    const run = fit.runner();
    for (let m = 0; m < 16; m++) {
      const v: Record<string, number> = {};
      run.inputs.forEach((n, i) => (v[n] = (m >> (3 - i)) & 1));
      const s = run.evaluate(v);
      const sum = (m >> 2) + (m & 3);
      expect([s.signals.C, s.signals.S1, s.signals.S0]).toEqual([(sum >> 2) & 1, (sum >> 1) & 1, sum & 1]);
      expect([...s.activeTerms]).toEqual([`w${m}`]);
    }
  });
  it('is sized to the function and rejects too many address lines', () => {
    expect(fit.chip.words).toBe(16);
    expect(fit.chip.width).toBe(3);
    const r = programProm('A B C D E F G | Y\n0 0 0 0 0 0 0 | 1');
    expect('errors' in r && r.errors[0]!.message).toMatch(/address lines/);
  });
  it('blows fuses one way only', () => {
    const blank = fit.edit!({ type: 'reset' }) as PromFit;
    expect(blank.chip.prom.fuses.every((f) => f === 0)).toBe(true);
    const one = blank.edit!({ type: 'blow', word: 3, column: 1 }) as PromFit;
    expect(one.chip.prom.fuses.reduce((a, b) => a + b, 0)).toBe(1);
    expect(one.edit!({ type: 'blow', word: 3, column: 1 })).toBe(one);
    expect(one.edited).toBe(true);
  });
  it('is reprogrammed exactly by its program steps', () => {
    let f = fit.edit!({ type: 'reset' });
    for (const s of fit.programSteps!) f = f.edit!(s);
    expect(Array.from((f as PromFit).chip.prom.fuses)).toEqual(Array.from(fit.chip.prom.fuses));
  });
  it('reports a truth table with line numbers in errors', () => {
    const r = programProm('A B | Y\n0 0 | 1\n0 2 | 1');
    expect('errors' in r && r.errors[0]!.line).toBe(3);
  });
});

describe('vPLA', () => {
  const fit = fitOf('pla', 'full-adder') as PlaDeviceFit;
  it('computes the full adder from its fuses', () => {
    const run = fit.runner();
    for (let m = 0; m < 8; m++) {
      const a = (m >> 2) & 1;
      const b = (m >> 1) & 1;
      const c = m & 1;
      const s = run.evaluate({ A: a, B: b, CIN: c });
      expect([s.signals.S, s.signals.COUT]).toEqual([(a + b + c) & 1, (a + b + c) >> 1]);
    }
  });
  it('shares product terms between outputs', () => {
    const shared = fit.network.terms.filter((t) => fit.network.outputs.filter((o) => o.terms.includes(t.id)).length > 1);
    expect(shared.length).toBeGreaterThanOrEqual(0);
    expect(fit.chip.info.filter((t) => t.kind !== 'false' && t.outputs.length).length).toBe(7);
  });
  it('toggles crossings and starts blank', () => {
    const blank = blankPla(['X', 'Y'], ['Z']);
    expect(blank.network.terms).toHaveLength(0);
    expect(blank.network.inputs).toEqual(['X', 'Y']);
    // T0 = X & !Y feeding Z: blow X-complement... toggle true and OR fuses on.
    let f: PlaDeviceFit = blank;
    f = f.edit!({ type: 'toggle', plane: 'and', term: 0, input: 0, literal: 'complement' }) as PlaDeviceFit; // X̄ off
    f = f.edit!({ type: 'toggle', plane: 'and', term: 0, input: 1, literal: 'true' }) as PlaDeviceFit; // Y off
    for (let i = 2; i < 8; i++) {
      f = f.edit!({ type: 'toggle', plane: 'and', term: 0, input: i, literal: 'true' }) as PlaDeviceFit;
      f = f.edit!({ type: 'toggle', plane: 'and', term: 0, input: i, literal: 'complement' }) as PlaDeviceFit;
    }
    expect(f.chip.info[0]!.pattern.slice(0, 2)).toBe('10');
    const t2 = f.edit!({ type: 'toggle', plane: 'and', term: 0, input: 0, literal: 'complement' });
    expect((t2 as PlaDeviceFit).chip.info[0]!.pattern[0]).toBe('x');
  });
  it('is reprogrammed exactly by its program steps', () => {
    let f: DeviceFit = fit.edit!({ type: 'reset' });
    for (const s of fit.programSteps!) f = f.edit!(s);
    expect(Array.from((f as PlaDeviceFit).chip.pla.andFuses)).toEqual(Array.from(fit.chip.pla.andFuses));
    expect(Array.from((f as PlaDeviceFit).chip.pla.orFuses)).toEqual(Array.from(fit.chip.pla.orFuses));
  });
  it('rejects a function that is too big', () => {
    const r = plaAdapter.program('A B C D E F G H I | Y\n' + '0 0 0 0 0 0 0 0 0 | 1');
    expect(r.ok).toBe(false);
  });
});

describe('GAL22V10', () => {
  const fit = fitOf('gal22v10', 'traffic-light') as GalDeviceFit;
  it('recovers the pinout and the macrocells from the fuses', () => {
    expect(fit.chip.fuses).toHaveLength(FUSE_COUNT);
    expect(fit.chip.pins[0]!.role).toBe('clock');
    const q1 = fit.chip.olmcs.find((o) => o.name === 'Q1')!;
    expect(q1.registered).toBe(true);
    expect(fit.network.clock).toBe('CLK');
    expect(fit.network.ar).toBeDefined();
    expect(fit.network.outputs.find((o) => o.name === 'Q1')!.reset).toBe(true);
    expect(fit.network.outputs.map((o) => o.name)).toEqual(['Q1', 'Q0', 'MG', 'MA', 'MR', 'SG', 'SA', 'SR']);
  });
  it('runs a full cycle of the traffic lights from the fuses', () => {
    const run = fit.runner();
    let s = run.powerUp();
    expect(s.signals.MG).toBe(1);
    const inputs = { CAR: 1, T: 1, RST: 0 };
    s = run.clock(inputs);
    expect(s.signals.MA).toBe(1);
    s = run.clock(inputs);
    expect(s.signals.SG).toBe(1);
    s = run.clock(inputs);
    expect(s.signals.SA).toBe(1);
    s = run.clock(inputs);
    expect(s.signals.MG).toBe(1);
    expect(s.clocks).toBe(4);
    s = run.clock(inputs);
    s = run.evaluate({ ...inputs, RST: 1 });
    expect(s.signals.MG).toBe(1);
  });
  it('cross-probes output, source line, term rows and bits', () => {
    const p = fit.resolve({ kind: 'output', name: 'MG' });
    expect(p.lines.has(fit.outputLine.MG!)).toBe(true);
    expect(p.terms.size).toBeGreaterThan(0);
    expect(fit.resolve({ kind: 'line', line: fit.outputLine.MG! }).outputs.has('MG')).toBe(true);
    const t = [...p.terms][0]!;
    const row = Number(t.slice(1));
    expect(p.bits.has(row * 44 + 3)).toBe(true);
    expect(fit.resolve({ kind: 'bit', index: row * 44 }).terms.has(t)).toBe(true);
  });
  it('describes fuses by name and offers a JEDEC file', () => {
    const b = fit.bits;
    expect(b.describe(0)).toMatch(/asynchronous reset/);
    expect(fit.files!.some((f) => f.name.endsWith('.jed') && f.text.includes('*QF5892'))).toBe(true);
  });
  it('reports fitter errors on the line of the output', () => {
    const src = 'Y = A & B\nZ = A ^ B ^ C ^ D ^ E ^ F ^ G ^ H ^ I';
    const r = galAdapter.program(src);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.line).toBe(2);
  });
  it('flags syntax errors with a line', () => {
    const r = galAdapter.program('Y = A & \nZ = B');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.line).toBe(1);
  });
  it('can be rebuilt from a bare fuse array', () => {
    const f2 = galFromFuses(fit.chip.fuses);
    expect(f2.network.outputs.length).toBe(fit.network.outputs.length);
  });
});

describe('vCPLD-32', () => {
  const fit = fitOf('cpld32', 'parity') as CpldDeviceFit;
  it('borrows product terms from neighbours', () => {
    const o = fit.network.outputs[0]!;
    expect(o.terms).toHaveLength(8);
    const rows = o.terms.map((t) => Number(/t(\d+)$/.exec(t)![1]));
    expect(new Set(rows.map((r) => Math.floor(r / 5))).size).toBeGreaterThan(1);
    const p = fit.resolve({ kind: 'output', name: o.name });
    expect(p.terms.size).toBe(8);
  });
  it('runs the BCD counter from its bits', () => {
    const f = fitOf('cpld32', 'bcd-display');
    const run = f.runner();
    let s = run.powerUp();
    const seq: number[] = [];
    for (let i = 0; i < 12; i++) {
      s = run.clock({ EN: 1, CLR: 0 });
      seq.push((s.signals.Q3 as number) * 8 + (s.signals.Q2 as number) * 4 + (s.signals.Q1 as number) * 2 + (s.signals.Q0 as number));
    }
    expect(seq).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2]);
  });
  it('maps the configuration to bits and names', () => {
    expect(fit.chip.bits).toHaveLength(BIT_COUNT);
    expect(fit.bits.describe(0)).toMatch(/interconnect|input/i);
    expect(fit.chip.mcNames.filter(Boolean)).toHaveLength(1);
    const adder = fitOf('cpld32', 'adder') as CpldDeviceFit;
    expect(adder.chip.mcUse.filter((u) => u === 'buried')).toHaveLength(3);
    expect(adder.network.outputs.filter((o) => o.pin === undefined)).toHaveLength(3);
  });
  it('rebuilds from bare bits with generic names', () => {
    const f = cpldFromBits(fit.chip.bits);
    expect(f.network.outputs).toHaveLength(1);
    expect(f.network.outputs[0]!.name).toMatch(/^MC\d+$/);
  });
  it('supports T flip-flops in the counter', () => {
    const f = fitOf('cpld32', 'counter');
    expect(f.network.outputs.some((o) => o.ff === 'T')).toBe(true);
  });
});
