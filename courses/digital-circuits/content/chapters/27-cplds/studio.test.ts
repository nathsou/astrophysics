import { describe, expect, test } from 'vitest';
import { EXAMPLES } from '$lib/studio/examples';
import { cpldAdapter, type CpldChip } from '$lib/studio/adapters/cpld';
import { programOverJtag } from '$lib/studio/jtag-model';
import { counter4Design, fitCpld, fitCpldEquations, type CpldFit } from '$lib/pld/cpld';
import {
  BSR_LENGTH,
  CpldJtag,
  IDCODE_VALUE,
  INSTRUCTIONS,
  IR_LENGTH,
  JtagHost,
  ROW_REGISTER_LENGTH,
  TAP_STATES,
  tapPath,
  nextTapState,
  ERASE_CYCLES,
  PROGRAM_CYCLES,
} from '$lib/pld/cpld/jtag';
import { T_CO, T_PD, T_PTA, T_FB, T_SU } from '$lib/pld/cpld/timing';
import { BIT_COUNT, FB_INPUTS, FB_BITS, LITERAL_COLUMNS, MACROCELLS, MACROCELLS_PER_FB, FUNCTION_BLOCKS, ROW_BITS, ROW_COUNT, SOURCE_COUNT, TERMS_PER_FB, TERMS_PER_MC, MAX_TERMS_PER_MC } from '$lib/pld/devices/vcpld32-arch';

/** The numbers of Chapter 27's text about the vCPLD-32, its fitter and its JTAG port. */
const example = (id: string) => EXAMPLES.cpld32.find((e) => e.id === id)!.source;
const fitOf = (id: string): CpldFit => {
  const r = cpldAdapter.program(example(id));
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return (r.fit.chip as CpldChip).fit!;
};

describe('the device', () => {
  test('four blocks of eight macrocells; 24 inputs, 48 columns and 40 terms per block; a 64-way multiplexer for each input', () => {
    expect(FUNCTION_BLOCKS * MACROCELLS_PER_FB).toBe(MACROCELLS);
    expect(MACROCELLS).toBe(32);
    expect(FB_INPUTS).toBe(24);
    expect(LITERAL_COLUMNS).toBe(48);
    expect(TERMS_PER_FB).toBe(40);
    expect(TERMS_PER_MC).toBe(5);
    expect(SOURCE_COUNT).toBe(64);
    expect(MAX_TERMS_PER_MC).toBe(15);
  });

  test('9,024 configuration bits: 141 rows of 64', () => {
    expect(ROW_COUNT * ROW_BITS).toBe(9024);
    expect(BIT_COUNT).toBe(9024);
    expect(FB_BITS).toBe(2240);
  });

  test('the timing constants quoted in the text', () => {
    expect([T_PD, T_SU, T_CO, T_PTA, T_FB]).toEqual([7.5, 4.5, 4.5, 1, 5]);
  });
});

describe('what the fitter does with the examples', () => {
  test('a counter bit on D flip-flops needs one more term than the bit below it; on T flip-flops every bit is two terms (with the clear)', () => {
    const f = fitCpld(counter4Design());
    const alt = (name: string, label: string) => f.outputs.find((o) => o.name === name)!.alternatives.find((a) => a.label === label)!.terms;
    expect(['Q0', 'Q1', 'Q2', 'Q3'].map((q) => alt(q, 'D flip-flop, active high'))).toEqual([2, 3, 4, 5]);
    expect(['Q0', 'Q1', 'Q2', 'Q3'].map((q) => alt(q, 'T flip-flop, active high'))).toEqual([2, 2, 2, 2]);
    expect(f.outputs.every((o) => o.ff === 'T' && o.terms === 2)).toBe(true);
    expect(f.utilisation.productTerms).toBe(8);
  });

  test('without the clear, a T-flip-flop counter bit is a single product term (Figure 27.2)', () => {
    const f = fitCpldEquations('Q0.R = Q0 ^ EN\nQ1.R = Q1 ^ (EN & Q0)\nQ2.R = Q2 ^ (EN & Q0 & Q1)', { inputs: ['EN'] });
    expect(f.outputs.map((o) => [o.ff, o.terms])).toEqual([['T', 1], ['T', 1], ['T', 1]]);
  });

  test('the traffic light: ten terms in eight macrocells, all in block 0, the same ten as the GAL22V10 needed', () => {
    const f = fitOf('traffic-light');
    expect(f.utilisation.productTerms).toBe(10);
    expect(f.utilisation.macrocells).toBe(8);
    expect(f.fbs.map((b) => b.macrocellsUsed)).toEqual([8, 0, 0, 0]);
    expect(f.utilisation.borrowedTerms).toBe(0);
  });

  test('the seven-segment decoder: fifteen terms in seven macrocells, every segment stored active low', () => {
    const f = fitOf('seven-segment');
    expect(f.utilisation.productTerms).toBe(15);
    expect(f.outputs.every((o) => o.polarity === 'low')).toBe(true);
    expect(Math.max(...f.outputs.map((o) => o.terms))).toBe(3);
  });

  test('four-input parity needs eight terms and borrows three, which costs a nanosecond', () => {
    const f = fitOf('parity');
    const p = f.outputs[0]!;
    expect(p.terms).toBe(8);
    expect(p.borrowed).toBe(3);
    expect(f.timing.worstTpd).toBe(8.5);
    expect(p.capacity).toBe(10);
  });

  test('the 4-bit adder with buried carries: 22.5 ns from the first input to the last carry', () => {
    const f = fitOf('adder');
    expect(f.timing.worstTpd).toBe(22.5);
    expect(f.outputs.filter((o) => o.buried).map((o) => o.name)).toEqual(['C1', 'C2', 'C3']);
  });

  test('a counter runs at 125 MHz, whatever the fitter chose: 8 ns register to register', () => {
    const f = fitOf('counter');
    expect(f.timing.fmaxMHz).toBe(125);
    expect(f.timing.worstTsu).toBe(4.5);
    expect(f.timing.worstTco).toBe(4.5);
  });
});

describe('non-volatile and instant-on', () => {
  test('the configuration survives a power cycle, and the registers come back at their power-up values', () => {
    const f = fitOf('counter');
    const dev = f.device();
    const before = Array.from(dev.bits);
    const step = { inputs: { EN: 1, CLR: 0 } };
    const [a] = f.simulate([step, step, step]).slice(-1);
    expect(a!.values['Q0']).toBe(1); // three clocks: 3 = 0b0011
    expect(a!.values['Q1']).toBe(1);
    dev.powerCycle();
    expect(Array.from(dev.bits)).toEqual(before);
    const snap = dev.evaluate({ pins: [] });
    expect(Array.from(snap.mc.slice(0, 4))).toEqual([0, 0, 0, 0]);
  });

  test('an erased device is inert: no product term enabled and no pin driven', () => {
    const tap = new CpldJtag();
    expect(tap.device.isBlank).toBe(true);
    const snap = tap.evaluate();
    expect(snap.driven.every((d) => !d)).toBe(true);
  });
});

describe('JTAG', () => {
  test('sixteen states; five ones from anywhere reach Test-Logic-Reset', () => {
    expect(TAP_STATES).toHaveLength(16);
    for (const s of TAP_STATES) {
      let cur = s;
      for (let i = 0; i < 5; i++) cur = nextTapState(cur, 1);
      expect(cur).toBe('Test-Logic-Reset');
    }
  });

  test('the sequences the widget suggests: 0,1,0,0 to Shift-DR and 0,1,1,0,0 to Shift-IR', () => {
    expect(tapPath('Test-Logic-Reset', 'Shift-DR')).toEqual([0, 1, 0, 0]);
    expect(tapPath('Test-Logic-Reset', 'Shift-IR')).toEqual([0, 1, 1, 0, 0]);
  });

  test('the registers: 8-bit instruction register, 99-cell boundary register, 72-bit row register, and the IDCODE', () => {
    expect(IR_LENGTH).toBe(8);
    expect(BSR_LENGTH).toBe(99);
    expect(ROW_REGISTER_LENGTH).toBe(72);
    expect(IDCODE_VALUE.toString(16)).toBe('1c0321ff');
    expect(INSTRUCTIONS.ISC_ERASE).toBe(0xec);
    expect(ERASE_CYCLES).toBe(8);
    expect(PROGRAM_CYCLES).toBe(3);
  });

  test('reset selects IDCODE: after reset the first 32 bits out are the identification, least significant bit first', () => {
    const host = new JtagHost(new CpldJtag());
    expect(host.readIdcode()).toBe(IDCODE_VALUE);
  });

  test('programming the counter over JTAG: ten rows written, about twelve thousand TCK cycles, read back and verified', () => {
    const f = fitOf('counter');
    const s = programOverJtag(f.bits);
    expect(s.ok).toBe(true);
    expect(s.mismatches).toBe(0);
    expect(s.rowsProgrammed).toBe(10);
    expect(s.cycles.length).toBeGreaterThan(11000);
    expect(s.cycles.length).toBeLessThan(13000);
    // The verify pass reads all 141 rows and is most of the time.
    const verifyAt = s.marks.find((m) => m.label.startsWith('ISC_VERIFY'))!.cycle;
    expect(s.cycles.length - verifyAt).toBeGreaterThan(0.8 * s.cycles.length);
  });

  test('the programmed device has the same behaviour as the fitter said: the read-back bits equal the fitted bits', () => {
    const f = fitOf('bcd-display');
    const tap = new CpldJtag();
    const host = new JtagHost(tap, { trace: false });
    const r = host.programDevice(f.bits);
    expect(r.ok).toBe(true);
    expect(Array.from(tap.device.bits)).toEqual(Array.from(f.bits));
  });
});
