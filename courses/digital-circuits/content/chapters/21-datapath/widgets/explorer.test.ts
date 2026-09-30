import { describe, expect, test } from 'vitest';
import { CHALLENGES, Explorer, playSolution } from './explorer';

// The datapath of the explorer is the one Chapter 22's control units drive: 3,000 gates from the parts bin.
const e = new Explorer({ level: 'parts' });

describe('the explorer', () => {
  test('starts reset: PC = 0, SP = 0xF0, registers 0, bus floating', () => {
    e.reset();
    const s = e.state();
    expect(s.pc).toBe(0);
    expect(s.sp).toBe(0xf0);
    expect(s.r).toEqual([0, 0, 0, 0]);
    expect(s.bus).toBe('zzzzzzzz');
    expect(s.contention).toBe(false);
  });

  test('the front panel drives the bus, and a register listens on the clock edge', () => {
    e.reset();
    e.setSwitches(0x5a);
    e.apply({ OE_SW: 1, LD_A: 1 });
    expect(e.state().busValue).toBe(0x5a);
    expect(e.state().a).toBe(0); // nothing has moved yet
    e.tick();
    expect(e.state().a).toBe(0x5a);
    e.allOff();
    expect(e.state().bus).toBe('zzzzzzzz');
  });

  test('two drivers with different bytes fight: the bus is unknown and the engine says so', () => {
    e.setup({ pc: 0x33 });
    e.setSwitches(0xcc);
    e.apply({ OE_SW: 1, OE_PC: 1 });
    const s = e.state();
    expect(s.contention).toBe(true);
    expect(s.busValue).toBeUndefined();
    expect(e.rig.engine.messages.some((m) => /Contention/.test(m.text))).toBe(true);
    e.allOff();
  });

  test('a register that listens to a floating bus loads unknown bits', () => {
    e.setup({});
    e.apply({ LD_A: 1 });
    e.tick();
    expect(e.state().a).toBeUndefined();
    e.allOff();
  });

  test('the ALU computes continuously; nothing is stored until a load line is on', () => {
    e.setup({ a: 200, b: 100 });
    e.apply(Explorer.aluLines('ADD'));
    expect(e.state().alu).toBe(44);
    e.apply(Explorer.aluLines('SUB'));
    expect(e.state().alu).toBe(100);
    e.apply(Explorer.aluLines('ADD', 'ONE'));
    expect(e.state().alu).toBe(201);
    e.allOff();
  });
});

describe('the challenges', () => {
  for (const c of CHALLENGES) {
    test(`${c.title}: not solved at the start, solved by the reference solution in ${c.par} clocks`, () => {
      e.setup(c.preset);
      expect(c.goal(e.state()), 'goal at start').toBe(false);
      playSolution(e, c);
      expect(c.goal(e.state())).toBe(true);
      expect(e.clocks).toBe(c.par);
      expect(c.solution).toHaveLength(c.par);
    });
  }

  test('the presets really set what the task says', () => {
    e.setup(CHALLENGES[2]!.preset);
    const s = e.state();
    expect(s.ir).toBe(0x86);
    expect(s.r).toEqual([0, 5, 9, 0]);
    expect(s.sp).toBe(0xf0);
  });
});
