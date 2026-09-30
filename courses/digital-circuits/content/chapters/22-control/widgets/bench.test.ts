import { describe, expect, test } from 'vitest';
import { PROGRAMS, ControlBench, STEP_LABELS, referenceResult } from './bench';
import { Microprogram } from './microprogram';
import { addDec, DEC_BYTES } from './verify';

describe.each(['hardwired', 'microcoded'] as const)('the viewer’s machine, %s', (kind) => {
  const b = new ControlBench(kind, { level: 'blocks' });

  test('starts at the first fetch step, with the lines for MAR ← PC set', () => {
    b.load('LDI R1, 5\nHLT\n');
    expect(b.step()).toBe(0);
    const l = b.lines();
    expect(l.OE_PC).toBe(1);
    expect(l.LD_MAR).toBe(1);
    expect(l.OE_MEM).toBe(0);
  });

  test('walks F1 F2 D then the execute steps of an instruction, and the counts match the ISA spec', () => {
    b.load('LDI R1, 5\nLDI R2, 9\nADD R1, R2\nHLT\n');
    const seen: string[] = [];
    let cycles = 0;
    while (!b.halted && cycles < 40) {
      seen.push(`${STEP_LABELS[b.step()]}`);
      b.cycle();
      cycles++;
    }
    expect(seen.join(' ')).toBe('F1 F2 D X1 X2 F1 F2 D X1 X2 F1 F2 D X1 X2 X3 F1 F2 D');
    expect(b.state().r).toEqual([0, 14, 9, 0]);
  });

  test('instruction() runs to the start of the next one', () => {
    b.load('LDI R1, 5\nADD R1, R1\nHLT\n');
    expect(b.instruction()).toBe(5);
    expect(b.state().r[1]).toBe(5);
    expect(b.instruction()).toBe(6);
    expect(b.state().r[1]).toBe(10);
  });

  test.each(PROGRAMS.map((p) => [p.id, p] as const))('program %s ends where the interpreter ends', (_id, p) => {
    expect(b.load(p.source)).toEqual([]);
    let n = 0;
    while (!b.halted && n < 400) {
      b.cycle();
      n++;
    }
    const want = referenceResult(p.source)!;
    expect(b.halted).toBe(true);
    expect(b.state().r).toEqual(want.r);
    // The machine stops as HLT's own cycle is about to run: three cycles into it.
    expect(b.gate.cycles).toBe(want.cycles - 1);
    expect(b.gate.problems()).toEqual([]);
  });

  test('assembler errors are reported, not run', () => {
    expect(b.load('FROB R1\n').length).toBeGreaterThan(0);
  });
});

test('an edited microprogram runs on the viewer’s machine', () => {
  const b = new ControlBench('microcoded', { level: 'blocks' });
  const mp = new Microprogram();
  addDec(mp);
  expect(b.applyMicroprogram(mp)).toBeUndefined();
  b.mp.routines = mp.routines;
  b.load(`LDI R2, 9\n.byte 0x${DEC_BYTES[1]!.toString(16)}\nHLT\n`);
  let n = 0;
  while (!b.halted && n < 40) (b.cycle(), n++);
  expect(b.state().r[2]).toBe(8);
});
