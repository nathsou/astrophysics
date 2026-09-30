import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine, type DigitalEngine } from '$lib/sim/digital';
import { createSwitchEngine, type SwitchEngine } from '$lib/sim/switch';
import { canExpand, expandCheck, expandToSwitch } from '$lib/sim/expand';
import type { Circuit } from '$lib/sim/netlist/types';

/**
 * Every live circuit of Chapter 20 must show what the text says. Each test loads the JSON exactly as the page does,
 * clicks switches through `setParam`, lets the circuit settle and reads the lamps.
 */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;

describe('Figure 20.1: a memory bit from gates (four NANDs and an inverter)', () => {
  const setup = () => {
    const e: DigitalEngine = createDigitalEngine(flatten(load('latch-cell')));
    e.advance(50e-9);
    const on = (id: string, v: boolean) => {
      e.setParam(id, 'on', v);
      e.advance(50e-9);
    };
    const q = () => [+!!e.state('Q').lit, +!!e.state('QB').lit];
    return { e, on, q };
  };
  test('while the word line is high the cell follows D; when it falls the cell keeps the last value', () => {
    const { on, q } = setup();
    // It starts with WL and D on: a 1 is already stored.
    expect(q()).toEqual([1, 0]);
    on('D', false);
    expect(q()).toEqual([0, 1]);
    on('D', true);
    expect(q()).toEqual([1, 0]);
    on('WL', false);
    on('D', false);
    expect(q()).toEqual([1, 0]);
    on('WL', true);
    expect(q()).toEqual([0, 1]);
    on('WL', false);
    on('D', true);
    expect(q()).toEqual([0, 1]);
  });
  test('it is four NANDs and an inverter: 18 transistors at the level below', () => {
    const c = load('latch-cell');
    const types = c.components.map((x) => x.type).filter((t) => ['nand', 'not'].includes(t));
    expect(types.sort()).toEqual(['nand', 'nand', 'nand', 'nand', 'not']);
    const x = expandCheck(c, 'switch');
    expect(x.ok).toBe(true);
    expect(x.transistors).toBe(18);
    expect(canExpand(c, 'switch')).toBe(true);
    expect(canExpand(c, 'analog')).toBe(true);
  });
  test('opened up into transistors and run at switch level it stores and holds too', () => {
    const c = load('latch-cell');
    const ex = expandToSwitch(c);
    const e: SwitchEngine = createSwitchEngine(ex.netlist());
    const on = (id: string, v: boolean) => {
      e.setParam(id, 'on', v);
      e.settle();
    };
    const lit = (id: string) => !!e.state(id).lit;
    e.settle();
    expect([lit('Q'), lit('QB')]).toEqual([true, false]);
    on('WL', false);
    on('D', false);
    expect([lit('Q'), lit('QB')]).toEqual([true, false]);
    on('WL', true);
    expect([lit('Q'), lit('QB')]).toEqual([false, true]);
    on('WL', false);
    on('D', true);
    expect([lit('Q'), lit('QB')]).toEqual([false, true]);
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });
});

describe('Figure 20.2: the six-transistor SRAM cell', () => {
  const setup = () => {
    const e: SwitchEngine = createSwitchEngine(flatten(load('sram-cell')));
    const on = (id: string, v: boolean) => {
      e.setParam(id, 'on', v);
      e.settle();
    };
    const lit = (id: string) => !!e.state(id).lit;
    /** Drive both bit lines to complementary values, open the word line, close it, let the drivers go. */
    const write = (bit: number) => {
      on('D', !!bit);
      on('DB', !bit);
      on('WE', true);
      on('WL', true);
      on('WL', false);
      on('WE', false);
    };
    return { e, on, lit, write };
  };
  test('it powers up in some state (never in between) and is written both ways', () => {
    const { e, lit, write } = setup();
    e.settle();
    expect(lit('IQ')).not.toBe(lit('IQB'));
    for (const v of [1, 0, 0, 1, 1, 0]) {
      write(v);
      expect([lit('IQ'), lit('IQB')]).toEqual([!!v, !v]);
    }
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });
  test('it holds while the word line is low, whatever the bit lines do', () => {
    const { on, lit, write } = setup();
    write(1);
    on('D', false);
    on('DB', true);
    on('WE', true);
    expect([lit('IQ'), lit('IQB')]).toEqual([true, false]);
    on('WE', false);
    expect([lit('IQ'), lit('IQB')]).toEqual([true, false]);
  });
  test('a read: with the bit lines precharged and let go, the cell pulls down the line on its 0 side and is not upset', () => {
    const { on, lit, write } = setup();
    for (const v of [1, 0]) {
      write(v);
      // Precharge both lines high through the drivers, then release them.
      on('D', true);
      on('DB', true);
      on('WE', true);
      on('WE', false);
      expect([lit('IBL'), lit('IBLB')]).toEqual([true, true]);
      on('WL', true);
      expect([lit('IBL'), lit('IBLB')]).toEqual([!!v, !v]);
      expect([lit('IQ'), lit('IQB')]).toEqual([!!v, !v]);
      on('WL', false);
      expect([lit('IQ'), lit('IQB')]).toEqual([!!v, !v]);
    }
  });
  test('driving only one bit line is not enough to write a 1 into a cell that holds a 0', () => {
    const { on, lit, write } = setup();
    write(0);
    // Try to write a 1 through BL alone, with D̄ also high (nothing pulls the other side down).
    on('D', true);
    on('DB', true);
    on('WE', true);
    on('WL', true);
    on('WL', false);
    on('WE', false);
    expect([lit('IQ'), lit('IQB')]).toEqual([false, true]);
  });
  test('writing with both bit lines low pulls both sides down: the cell ends undefined (X) and the engine says it oscillates', () => {
    const { e, on, lit, write } = setup();
    write(1);
    on('D', false);
    on('DB', false);
    on('WE', true);
    on('WL', true);
    on('WL', false);
    expect(e.state('IQ').value).toBe(2);
    expect(e.state('IQB').value).toBe(2);
    expect(lit('IQ')).toBe(false);
    expect(e.messages.some((m) => /oscillat/.test(m.text))).toBe(true);
  });
  test('it has six transistors in the cell, and two write drivers', () => {
    const types = load('sram-cell').components.map((c) => c.type);
    expect(types.filter((t) => t === 'nmos')).toHaveLength(6);
    expect(types.filter((t) => t === 'pmos')).toHaveLength(2);
  });
});

describe('Figure 20.3: the one-transistor DRAM cell', () => {
  const setup = () => {
    const e: SwitchEngine = createSwitchEngine(flatten(load('dram-cell')));
    const on = (id: string, v: boolean) => {
      e.setParam(id, 'on', v);
      e.settle();
    };
    const lit = (id: string) => !!e.state(id).lit;
    const write = (bit: number) => {
      on('D', !!bit);
      on('WE', true);
      on('WL', true);
      on('WL', false);
      on('WE', false);
    };
    const precharge = (bit: number) => {
      on('D', !!bit);
      on('WE', true);
      on('WE', false);
    };
    return { on, lit, write, precharge };
  };
  test('the capacitor holds the bit with the word line low, whatever the bit line does', () => {
    const { on, lit, write } = setup();
    for (const v of [1, 0, 1]) {
      write(v);
      expect(lit('ICELL')).toBe(!!v);
      on('D', !v);
      on('WE', true);
      on('WE', false);
      expect(lit('ICELL')).toBe(!!v);
    }
  });
  test('reading destroys it: a bit line precharged low, much bigger than the cell, drags a stored 1 down', () => {
    const { on, lit, write, precharge } = setup();
    write(1);
    precharge(0);
    expect(lit('ICELL')).toBe(true);
    on('WL', true);
    expect([lit('IBL'), lit('ICELL')]).toEqual([false, false]);
    on('WL', false);
    expect(lit('ICELL')).toBe(false);
    // Writing it back restores it.
    write(1);
    expect(lit('ICELL')).toBe(true);
  });
  test('the bit line is ten times the cell: 300 fF and 30 fF', () => {
    const c = load('dram-cell');
    const f = (id: string) => c.components.find((x) => x.id === id)!.params!.capacitance as number;
    expect(f('CBL') / f('CS')).toBeCloseTo(10, 9);
  });
});

describe('Figure 20.6: a register file of four words of two bits', () => {
  const setup = () => {
    const e: DigitalEngine = createDigitalEngine(flatten(load('register-file')));
    e.advance(50e-9);
    const on = (id: string, v: boolean) => {
      e.setParam(`T_${id}`, 'on', v);
      e.advance(20e-9);
    };
    const address = (a: number) => {
      on('A1', !!(a & 2));
      on('A0', !!(a & 1));
    };
    const write = (a: number, w: number) => {
      address(a);
      on('D1', !!(w & 2));
      on('D0', !!(w & 1));
      on('WE', true);
      e.setParam('CLK', 'pressed', true);
      e.advance(20e-9);
      e.setParam('CLK', 'pressed', false);
      e.advance(20e-9);
      on('WE', false);
    };
    const read = (a: number) => {
      address(a);
      return +!!e.state('OUT1').lit * 2 + +!!e.state('OUT0').lit;
    };
    return { e, write, read, on };
  };
  test('every word can be written and read back, and writing one word disturbs no other', () => {
    const { write, read } = setup();
    const words = [2, 0, 3, 1];
    words.forEach((w, a) => write(a, w));
    words.forEach((w, a) => expect(read(a)).toBe(w));
    write(1, 3);
    expect([0, 1, 2, 3].map(read)).toEqual([2, 3, 3, 1]);
  });
  test('with the write enable off, the clock changes nothing', () => {
    const { e, write, read, on } = setup();
    write(2, 3);
    on('A1', true);
    on('A0', false);
    on('D1', false);
    on('D0', false);
    e.setParam('CLK', 'pressed', true);
    e.advance(20e-9);
    e.setParam('CLK', 'pressed', false);
    e.advance(20e-9);
    expect(read(2)).toBe(3);
  });
  test('it has a decoder, four registers and two multiplexers', () => {
    const types = load('register-file').components.map((c) => c.type);
    expect(types.filter((t) => ['decoder', 'register', 'mux'].includes(t)).sort()).toEqual(['decoder', 'mux', 'mux', 'register', 'register', 'register', 'register']);
  });
});
