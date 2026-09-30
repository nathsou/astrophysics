import { describe, expect, test } from 'vitest';
import { OCTET_PROGRAMS, compareStates } from '$lib/sim/cpu/octet';
import { OctetComputer } from './computer';

const SUM = `        LDI  R0, 0
        LDI  R1, 5
        LDI  R2, 1
loop:   ADD  R0, R1
        SUB  R1, R2
        JNZ  loop
        ST   [LEDS], R0
        HLT
`;
const source = (id: string) => OCTET_PROGRAMS.find((p) => p.id === id)!.source;

describe('OctetComputer', () => {
  test('assembles live and loads on request', () => {
    const c = new OctetComputer(SUM);
    expect(c.ok).toBe(true);
    expect(c.program.size).toBe(13);
    expect(c.machine.memory[0]).toBe(0x20);
    c.setSource(SUM.replace('LDI  R1, 5', 'LDI  R1, 4'));
    expect(c.stale).toBe(true);
    expect(c.machine.memory[3]).toBe(5);
    c.load();
    expect(c.stale).toBe(false);
    expect(c.machine.memory[3]).toBe(4);
  });

  test('a program with errors does not load, and says where', () => {
    const c = new OctetComputer(SUM);
    c.setSource('        DEC R0\n');
    expect(c.ok).toBe(false);
    expect(c.diagnostics[0]!.line).toBe(1);
    expect(c.load()).toBe(false);
  });

  test('the sum program: 110 clock cycles for 22 instructions, 15 on the LEDs', () => {
    const c = new OctetComputer(SUM);
    expect(c.run(10_000).reason).toBe('halted');
    expect(c.machine.cycles).toBe(110);
    expect(c.machine.steps).toBe(3 + 5 * 3 + 2);
    expect(c.board.leds).toBe(15);
    expect(c.cpi).toBeCloseTo(110 / 20, 5);
    // The log stamps a change with the cycle count at the end of the instruction that made it (the ST; HLT takes 4 more).
    expect(c.ledLog.at(-1)).toEqual({ cycle: 106, value: 15 });
  });

  test('a cycle at a time, an instruction at a time and a budget at a time all reach the same state', () => {
    const a = new OctetComputer(SUM);
    while (a.stepCycle());
    const b = new OctetComputer(SUM);
    while (b.stepInstruction());
    const c = new OctetComputer(SUM);
    for (let i = 0; i < 30; i++) c.run(7);
    c.run(1000);
    for (const x of [b, c]) expect(compareStates(a.machine.snapshot(), x.machine.snapshot(), { timing: true })).toEqual([]);
  });

  test('a budget is never exceeded', () => {
    const c = new OctetComputer(source('blink'));
    for (const budget of [1, 3, 8, 9, 50, 1001]) {
      const before = c.machine.cycles;
      const r = c.run(budget);
      expect(r.ran).toBe(budget);
      expect(c.machine.cycles - before).toBe(budget);
    }
  });

  test('breakpoints stop before the instruction runs, and running again steps over them', () => {
    const c = new OctetComputer(SUM);
    const jnz = SUM.split('\n').findIndex((l) => l.includes('JNZ')) + 1;
    expect(c.toggleBreakpoint(jnz)).toBe(true);
    expect(c.toggleBreakpoint(1000)).toBe(false);
    const first = c.run(10_000);
    expect(first.reason).toBe('breakpoint');
    expect(c.machine.pc).toBe(8);
    expect(c.machine.r[1]).toBe(4);
    expect(c.currentLine).toBe(jnz);
    const again = c.run(10_000);
    expect(again.reason).toBe('breakpoint');
    expect(c.machine.r[1]).toBe(3);
    // Five trips round the loop: the fifth stop is the last, then it runs to the end.
    for (let i = 0; i < 3; i++) expect(c.run(10_000).reason).toBe('breakpoint');
    expect(c.run(10_000).reason).toBe('halted');
    expect(c.board.leds).toBe(15);
    expect(c.toggleBreakpoint(jnz)).toBe(false);
    expect(c.breakpoints.size).toBe(0);
  });

  test('breakpoints only go on lines that hold an instruction', () => {
    const c = new OctetComputer(SUM);
    expect(c.isInstructionLine(1)).toBe(true);
    expect(c.isInstructionLine(4)).toBe(true);
    const c2 = new OctetComputer('; a comment\nx: .byte 7\n        HLT\n');
    expect(c2.isInstructionLine(1)).toBe(false);
    expect(c2.isInstructionLine(2)).toBe(false);
    expect(c2.isInstructionLine(3)).toBe(true);
  });

  test('the history keeps the last instructions with their addresses and cycles', () => {
    const c = new OctetComputer(SUM);
    c.run(10_000);
    const h = c.history;
    expect(h).toHaveLength(8);
    expect(h.at(-1)).toMatchObject({ address: 12, text: 'HLT', cycles: 4 });
    expect(h.at(-2)).toMatchObject({ address: 10, text: 'ST [LEDS], R0', cycles: 6 });
    expect(h.at(-3)!.text).toBe('JNZ loop');
  });

  test('memory writes are stamped with the cycle they happened in', () => {
    const c = new OctetComputer('        LDI R0, 7\n        ST [0x80], R0\n        HLT\n');
    c.run(1000);
    expect(c.machine.memory[0x80]).toBe(7);
    // Whole instructions stamp the cycle the instruction began in (5); cycle by cycle it is the write cycle itself (10).
    expect(c.machine.stamps[0x80]).toBeGreaterThanOrEqual(5);
    expect(c.machine.stamps[0x80]).toBeLessThanOrEqual(10);
    c.reset();
    expect(c.machine.stamps[0x80]).toBe(-1);
    expect(c.machine.memory[0x80]).toBe(0);
  });

  test('reset undoes what the program did to its own memory', () => {
    const c = new OctetComputer(source('sort'));
    const before = [...c.machine.memory];
    c.run(1_000_000);
    expect([...c.machine.memory]).not.toEqual(before);
    c.reset();
    expect([...c.machine.memory]).toEqual(before);
    expect(c.machine.cycles).toBe(0);
  });

  test('a stopped machine reports it, and an odd instruction can be finished cycle by cycle', () => {
    const c = new OctetComputer('        HLT\n');
    expect(c.stepCycle()!.phase).toBe('fetch');
    expect(c.halted).toBe(false);
    c.stepInstruction();
    expect(c.halted).toBe(true);
    expect(c.stepCycle()).toBeNull();
    expect(c.stepInstruction()).toBe(0);
    expect(c.run(10).reason).toBe('halted');
  });

  test('the console and the buttons are wired to the board', () => {
    const c = new OctetComputer(source('hello'));
    c.runToHalt();
    expect(c.board.consoleText).toBe('HELLO, WORLD\n');
  });
});
