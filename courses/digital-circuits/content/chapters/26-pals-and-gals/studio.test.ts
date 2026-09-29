import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '$lib/studio/examples';
import { galAdapter } from '$lib/studio/adapters/gal';
import { ARRAY_FUSES, CONFIG_BASE, FUSE_COUNT, PRODUCT_TERMS, ROWS, COLUMNS, SIGNATURE_BASE } from '$lib/pld/devices/gal22v10';
import { fitGal22v10Equations } from '$lib/pld/devices/gal22v10-fit';
import { assemblePld } from '$lib/pld/devices/gal22v10-pld';

/** The numbers of Chapter 26's text about the GAL22V10 and the Studio. */
const example = (id: string) => EXAMPLES.gal22v10.find((e) => e.id === id)!.source;
const fitOf = (source: string) => {
  const r = galAdapter.program(source);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return (r.fit as unknown as { chip: { fit: ReturnType<typeof fitGal22v10Equations> } }).chip.fit;
};

describe('the device', () => {
  test('5,892 fuses: 132 rows of 44, then 20 configuration fuses and 64 signature fuses', () => {
    expect(ROWS * COLUMNS).toBe(5808);
    expect(ARRAY_FUSES).toBe(5808);
    expect(CONFIG_BASE).toBe(5808);
    expect(SIGNATURE_BASE).toBe(5828);
    expect(FUSE_COUNT).toBe(5892);
    expect(5808 + 20 + 64).toBe(5892);
  });

  test('120 product terms in the ten macrocells, plus 10 output-enable rows, AR and SP: 132 rows', () => {
    const per = [23, 22, 21, 20, 19, 18, 17, 16, 15, 14].map((p) => PRODUCT_TERMS[p]!);
    expect(per).toEqual([8, 10, 12, 14, 16, 16, 14, 12, 10, 8]);
    expect(per.reduce((a, b) => a + b, 0)).toBe(120);
    expect(120 + 10 + 2).toBe(132);
  });
});

describe('the traffic light (Figure 26.3)', () => {
  const fit = fitOf(example('traffic-light'));
  test('ten product terms in eight macrocells; the two registers take two terms each and every lamp one', () => {
    expect(fit.termsUsed).toBe(10);
    expect(fit.outputs).toHaveLength(8);
    const terms = Object.fromEntries(fit.outputs.map((o) => [o.name, o.terms]));
    expect(terms).toEqual({ Q1: 2, Q0: 2, MG: 1, MA: 1, MR: 1, SG: 1, SA: 1, SR: 1 });
    expect(fit.outputs.filter((o) => o.registered).map((o) => o.name).sort()).toEqual(['Q0', 'Q1']);
  });

  test('the pinout quoted in the build-it-for-real box', () => {
    expect(fit.pinOf).toMatchObject({ CLK: 1, CAR: 2, T: 3, RST: 4, Q1: 14, Q0: 15, MG: 16, MA: 17, MR: 18, SG: 19, SA: 20, SR: 21 });
  });

  test('the reset is a single AR term wired to RST', () => {
    expect(fit.ar).toBe('RST');
  });

  test('galette would accept the .pld file and assemble the same fuses', () => {
    const asm = assemblePld(fit.pld());
    expect(Array.from(asm.fuses)).toEqual(Array.from(fit.fuses));
  });
});

describe('the seven-segment decoder', () => {
  test('with the unused codes as don’t cares: 15 terms, every segment active low (25 terms active high)', () => {
    const fit = fitOf(example('seven-segment'));
    expect(fit.outputs.reduce((a, o) => a + o.terms, 0)).toBe(15);
    expect(fit.outputs.reduce((a, o) => a + o.highTerms, 0)).toBe(25);
    expect(fit.outputs.every((o) => o.polarity === 'low')).toBe(true);
    expect(Math.max(...fit.outputs.map((o) => o.terms))).toBe(3);
  });

  test('without them (all sixteen codes specified): 26 terms', () => {
    const src = example('seven-segment').replace(/^# @dc.*$/m, '');
    const fit = fitOf(src);
    expect(fit.outputs.reduce((a, o) => a + o.terms, 0)).toBe(26);
  });

  test('adding a 6-input parity output overflows every macrocell, and the message says why', () => {
    const r = galAdapter.program(example('seven-segment') + 'P = A ^ B ^ C ^ D ^ E ^ F\n');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.message).toContain('Output P needs 32 product terms (32 active high, 32 active low)');
      expect(r.errors[0]!.message).toContain('the largest, pins 18 and 19, have 16');
    }
  });

  test('a 5-input parity output needs exactly 16 terms and takes a 16-term macrocell; the segments move over', () => {
    const fit = fitOf(example('seven-segment') + 'P = A ^ B ^ C ^ D ^ E\n');
    const p = fit.outputs.find((o) => o.name === 'P')!;
    expect(p.terms).toBe(16);
    expect([18, 19]).toContain(p.pin);
    expect(fit.outputs.reduce((a, o) => a + o.terms, 0)).toBe(31);
  });
});

describe('the exercises', () => {
  test('Z = !(A | B & C & D | E & F): 6 terms active high, 3 active low, and 4 terms are enough', () => {
    const fit = fitGal22v10Equations('Z = !(A | B & C & D | E & F)', { pins: { Z: 23 } });
    const z = fit.outputs[0]!;
    expect(z.highTerms).toBe(6);
    expect(z.lowTerms).toBe(3);
    expect(z.polarity).toBe('low');
    expect(z.sum).toBe('A + B * C * D + E * F');
  });

  test('the traffic light steps main green, main amber, side green, side amber while CAR and T are high', () => {
    const r = galAdapter.program(example('traffic-light'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const run = r.fit.runner();
    const lamps = (s: Record<string, unknown>) => ['MG', 'MA', 'SG', 'SA'].find((n) => s[n] === 1);
    const held = { CAR: 1, T: 1, RST: 0 };
    let st = run.evaluate({ CAR: 1, T: 1, RST: 1 });
    expect(lamps(st.signals)).toBe('MG');
    st = run.evaluate(held);
    const seen: (string | undefined)[] = [lamps(st.signals)];
    for (let i = 0; i < 4; i++) {
      st = run.clock(held);
      seen.push(lamps(st.signals));
    }
    expect(seen).toEqual(['MG', 'MA', 'SG', 'SA', 'MG']);
  });
});
