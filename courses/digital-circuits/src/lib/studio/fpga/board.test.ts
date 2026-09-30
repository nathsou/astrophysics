import { describe, expect, it } from 'vitest';
import { HEX_SEGMENTS, bindBoard, boardOutputs, digitOfMask, emptyBoardInputs, inputLevel, type BoardPort } from './board';

const inp = (name: string, width = 1, clock = false): BoardPort => ({ name, dir: 'in', width, clock });
const out = (name: string, width = 1): BoardPort => ({ name, dir: 'out', width, clock: false });

describe('board binding', () => {
  it('binds the standard names by name and type', () => {
    const b = bindBoard([inp('clk', 1, true), inp('rst'), inp('btn', 4), inp('sw', 8), out('led', 8), out('seg0', 7), out('seg3', 8)]);
    expect(b.errors).toEqual([]);
    expect(b.uses).toMatchObject({ clock: true, reset: true, buttons: true, switches: true, leds: true, digits: [0, 3], multiplexed: false });
    expect(b.bound.find((x) => x.port === 'sw[5]')).toEqual({ port: 'sw[5]', resource: 'sw', index: 5 });
    expect(b.bound.find((x) => x.port === 'clk')?.resource).toBe('clk');
    expect(b.bound.filter((x) => x.resource === 'seg0')).toHaveLength(7);
  });

  it('makes every other port a free pin, named as the flow names it', () => {
    const b = bindBoard([inp('clk', 1, true), inp('enable'), inp('data', 2), out('count', 4), out('wrapped')]);
    expect(b.errors).toEqual([]);
    expect(b.freeInputs).toEqual(['enable', 'data[0]', 'data[1]']);
    expect(b.freeOutputs).toEqual(['count[0]', 'count[1]', 'count[2]', 'count[3]', 'wrapped']);
  });

  it('reports a width, direction or clock mismatch as a type error', () => {
    const wrongWidth = bindBoard([inp('sw', 4)]);
    expect(wrongWidth.errors[0]).toMatch(/`sw`.*8 switches/);
    expect(wrongWidth.bound).toHaveLength(0);
    expect(wrongWidth.freeInputs).toHaveLength(4);
    expect(bindBoard([out('sw', 8)]).errors[0]).toMatch(/input of the design/);
    expect(bindBoard([inp('clk', 1, false)]).errors[0]).toMatch(/type clock/);
    expect(bindBoard([inp('rst', 1, true)]).errors[0]).toMatch(/is a clock/);
    expect(bindBoard([out('led', 4)]).errors).toHaveLength(1);
  });

  it('checks the multiplexed display pair and does not mix the two display styles', () => {
    expect(bindBoard([out('seg', 7), out('an', 4)]).errors).toEqual([]);
    expect(bindBoard([out('seg', 7), out('an', 4)]).uses.multiplexed).toBe(true);
    expect(bindBoard([out('seg', 7)]).errors[0]).toMatch(/needs `an`/);
    expect(bindBoard([out('an', 4)]).errors[0]).toMatch(/needs the shared segments/);
    expect(bindBoard([out('seg', 7), out('an', 4), out('seg1', 7)]).errors.join(' ')).toMatch(/either/);
  });

  it('gives inputs the levels the board has', () => {
    const b = bindBoard([inp('clk', 1, true), inp('rst'), inp('btn', 4), inp('sw', 8)]);
    const i = emptyBoardInputs();
    i.switches[3] = true;
    i.buttons[1] = true;
    i.reset = true;
    const lv = Object.fromEntries(b.bound.map((x) => [x.port, inputLevel(x, i)]));
    expect(lv['sw[3]']).toBe(true);
    expect(lv['sw[2]']).toBe(false);
    expect(lv['btn[1]']).toBe(true);
    expect(lv['rst']).toBe(true);
    expect(lv['clk']).toBeUndefined();
  });

  it('shows LEDs and digits from output levels, and multiplexes with a latch', () => {
    const b = bindBoard([out('led', 8), out('seg0', 7), out('seg1', 7)]);
    const levels: Record<string, 0 | 1> = { 'led[0]': 1, 'led[7]': 1 };
    for (let s = 0; s < 7; s++) {
      levels[`seg0[${s}]`] = ((HEX_SEGMENTS[10]! >> s) & 1) as 0 | 1;
      levels[`seg1[${s}]`] = ((HEX_SEGMENTS[3]! >> s) & 1) as 0 | 1;
    }
    const o = boardOutputs(b, (n) => levels[n] ?? 0);
    expect(o.leds).toEqual([1, 0, 0, 0, 0, 0, 0, 1]);
    expect(digitOfMask(o.digits[0]!)).toBe(10);
    expect(digitOfMask(o.digits[1]!)).toBe(3);
    expect(o.digitLit).toEqual([true, true, false, false]);

    const m = bindBoard([out('seg', 7), out('an', 4)]);
    let latch = [0, 0, 0, 0];
    for (const d of [0, 1, 2, 3]) {
      const lv: Record<string, 0 | 1> = {};
      for (let s = 0; s < 7; s++) lv[`seg[${s}]`] = ((HEX_SEGMENTS[d + 4]! >> s) & 1) as 0 | 1;
      for (let a = 0; a < 4; a++) lv[`an[${a}]`] = a === d ? 1 : 0;
      latch = boardOutputs(m, (n) => lv[n] ?? 0, latch).digits;
    }
    expect(latch.map(digitOfMask)).toEqual([4, 5, 6, 7]);
  });

  it('has a hex table whose masks are distinct and decode back', () => {
    expect(new Set(HEX_SEGMENTS).size).toBe(16);
    HEX_SEGMENTS.forEach((m, d) => expect(digitOfMask(m)).toBe(d));
    expect(digitOfMask(0)).toBe(-1);
  });
});
