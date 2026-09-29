import { describe, expect, test } from 'vitest';
import { LX } from '../netlist/types';
import { SwitchBuilder, createSwitchEngine, netStrength, type SwitchEngine, type TransistorSize } from './index';

/**
 * Memory cells at transistor level. The 6T SRAM cell relies on transistor sizes: pull-downs
 * (strong) > access transistors (normal) > pull-ups (weak). A write overpowers the pull-up on the
 * side being pulled to 0; a read cannot upset the cell because the pull-down beats the charged bit
 * line.
 */

interface Sizes {
  pu: TransistorSize;
  ax: TransistorSize;
  pd: TransistorSize;
}
const SIZED: Sizes = { pu: 'weak', ax: 'normal', pd: 'strong' };

function sramCell(b: SwitchBuilder, id: string, wl: number, bl: number, blb: number, s: Sizes = SIZED) {
  const q = b.net(`${id}.Q`);
  const qb = b.net(`${id}.Qb`);
  b.pmos(`${id}.pu1`, qb, b.vdd(), q, s.pu);
  b.nmos(`${id}.pd1`, qb, q, b.gnd(), s.pd);
  b.pmos(`${id}.pu2`, q, b.vdd(), qb, s.pu);
  b.nmos(`${id}.pd2`, q, qb, b.gnd(), s.pd);
  b.nmos(`${id}.ax1`, wl, bl, q, s.ax);
  b.nmos(`${id}.ax2`, wl, blb, qb, s.ax);
  return { q, qb };
}

/** Bit-line pair with a precharge (PREb = 0 precharges) and a write driver (WE = 1 drives D). */
function column(b: SwitchBuilder, c: number, preb: number, we: number) {
  const bl = b.net(`BL${c}`);
  const blb = b.net(`BLb${c}`);
  const d = b.input(`D${c}`);
  const db = b.net(`Db${c}`);
  b.inv(`DI${c}`, d, db);
  b.pmos(`PRE${c}`, preb, b.vdd(), bl);
  b.pmos(`PREb${c}`, preb, b.vdd(), blb);
  b.nmos(`WD${c}`, we, d, bl, 'strong');
  b.nmos(`WDb${c}`, we, db, blb, 'strong');
  return { bl, blb };
}

class Sram {
  readonly e: SwitchEngine;
  readonly cells: { q: number; qb: number }[][];
  readonly cols: { bl: number; blb: number }[];

  constructor(
    readonly rows: number,
    readonly width: number,
    sizes: Sizes = SIZED,
  ) {
    const b = new SwitchBuilder();
    const preb = b.input('PREb');
    const we = b.input('WE');
    this.cols = Array.from({ length: width }, (_, c) => column(b, c, preb, we));
    this.cells = Array.from({ length: rows }, (_, r) => {
      const wl = b.input(`WL${r}`);
      return this.cols.map((col, c) => sramCell(b, `M${r}_${c}`, wl, col.bl, col.blb, sizes));
    });
    this.e = createSwitchEngine(b.build());
  }

  write(r: number, bits: number[]): void {
    const e = this.e;
    e.setParam('PREb', 'on', true);
    bits.forEach((v, c) => e.setParam(`D${c}`, 'on', v === 1));
    e.setParam('WE', 'on', true);
    e.setParam(`WL${r}`, 'on', true);
    e.setParam(`WL${r}`, 'on', false);
    e.setParam('WE', 'on', false);
  }

  read(r: number): number[] {
    const e = this.e;
    e.setParam('WE', 'on', false);
    e.setParam('PREb', 'on', false);
    e.setParam('PREb', 'on', true);
    e.setParam(`WL${r}`, 'on', true);
    const out = this.cols.map((col) => e.logic(col.bl));
    // The complementary bit line agrees.
    this.cols.forEach((col, c) => expect(e.logic(col.blb)).toBe(out[c] === 1 ? 0 : out[c] === 0 ? 1 : LX));
    e.setParam(`WL${r}`, 'on', false);
    return out;
  }

  stored(r: number): number[] {
    return this.cells[r]!.map((cell) => this.e.logic(cell.q));
  }
}

describe('6T SRAM', () => {
  test('a sized cell holds, is written both ways, and reads without upset', () => {
    const m = new Sram(1, 1);
    const { e } = m;
    const { q, qb } = m.cells[0]![0]!;
    expect(e.logic(q)).not.toBe(LX); // powered up in a random stable state
    for (const v of [1, 0, 0, 1, 1, 0]) {
      m.write(0, [v]);
      expect([e.logic(q), e.logic(qb)]).toEqual([v, 1 - v]);
      // Holds while the bit lines do anything.
      e.setParam('D0', 'on', v === 0);
      e.setParam('PREb', 'on', false);
      expect(e.logic(q)).toBe(v);
      expect(netStrength(e, q)).toBe('driven');
      expect(m.read(0)).toEqual([v]);
      expect(e.logic(q)).toBe(v);
    }
  });

  test('without sizing (all transistors equal) a write ends in X: the cell must be ratioed', () => {
    const all = (s: TransistorSize): Sizes => ({ pu: s, ax: s, pd: s });
    const m = new Sram(1, 1, all('normal'));
    const { q } = m.cells[0]![0]!;
    const start = m.e.logic(q);
    m.write(0, [1 - start]);
    expect(m.e.logic(q)).toBe(LX);
  });

  test('a 16 × 16 array (1632 transistors): write every row, read every row back', () => {
    const R = 16;
    const W = 16;
    const t0 = performance.now();
    const m = new Sram(R, W);
    const t1 = performance.now();
    const pattern = (r: number, c: number, k: number) => ((r * 7 + c * 3 + ((r * c) >> 2) + k) % 3 === 0 ? 1 : 0);
    for (const k of [0, 1]) {
      for (let r = 0; r < R; r++) m.write(r, Array.from({ length: W }, (_, c) => pattern(r, c, k)));
      for (let r = 0; r < R; r++) {
        const want = Array.from({ length: W }, (_, c) => pattern(r, c, k));
        expect(m.stored(r)).toEqual(want);
        expect(m.read(r)).toEqual(want);
      }
    }
    const t2 = performance.now();
    expect(m.e.messages).toEqual([]);
    console.log(`SRAM 16×16: build + power-up ${(t1 - t0).toFixed(1)} ms; 64 row writes and 64 row reads ${(t2 - t1).toFixed(1)} ms (${m.e.roundCount} rounds)`);
  });
});

describe('1T1C DRAM', () => {
  /** A cell (access nMOS + storage capacitor) on a bit line with a write driver. */
  function dram(cellC: number, bitLineC?: number) {
    const b = new SwitchBuilder();
    const d = b.input('D');
    const we = b.input('WE');
    const wl = b.input('WL');
    const bl = b.net('BL');
    const cell = b.net('CELL');
    b.nmos('WD', we, d, bl, 'strong');
    b.nmos('AX', wl, bl, cell);
    b.add('capacitor', 'Cs', { '1': cell, '2': b.gnd() }, { capacitance: cellC });
    if (bitLineC) b.add('capacitor', 'Cbl', { '1': bl, '2': b.gnd() }, { capacitance: bitLineC });
    const e = createSwitchEngine(b.build());
    const write = (v: number) => {
      e.setParam('D', 'on', v === 1);
      e.setParam('WE', 'on', true);
      e.setParam('WL', 'on', true);
      e.setParam('WL', 'on', false);
      e.setParam('WE', 'on', false);
    };
    /** Leave the bit line floating at `v`. */
    const precharge = (v: number) => {
      e.setParam('D', 'on', v === 1);
      e.setParam('WE', 'on', true);
      e.setParam('WE', 'on', false);
    };
    return { e, bl, cell, write, precharge };
  }

  test('the cell holds its charge while the word line is off', () => {
    const { e, cell, write } = dram(30e-15, 30e-15);
    expect(netStrength(e, cell)).toBe('floating');
    for (const v of [1, 0, 1]) {
      write(v);
      expect(e.logic(cell)).toBe(v);
      expect(netStrength(e, cell)).toBe('charged');
      // Activity on the bit line does not reach it.
      e.setParam('D', 'on', v === 0);
      e.setParam('WE', 'on', true);
      e.setParam('WE', 'on', false);
      expect(e.logic(cell)).toBe(v);
    }
  });

  test('reading shares the cell charge with the bit line and destroys the stored value', () => {
    const { e, bl, cell, write, precharge } = dram(30e-15, 30e-15);
    // Bit line already at the stored value: nothing changes.
    write(1);
    precharge(1);
    e.setParam('WL', 'on', true);
    expect([e.logic(bl), e.logic(cell)]).toEqual([1, 1]);
    e.setParam('WL', 'on', false);
    // Bit line at the other value, same capacitance: the charge is split, neither node is a clean
    // 0 or 1 any more (a sense amplifier must decide), and the cell has lost its value.
    precharge(0);
    e.setParam('WL', 'on', true);
    expect([e.logic(bl), e.logic(cell)]).toEqual([LX, LX]);
    e.setParam('WL', 'on', false);
    expect(e.logic(cell)).toBe(LX);
    // Writing back restores it.
    write(1);
    expect(e.logic(cell)).toBe(1);
  });

  test('a bit line much larger than the cell overwrites it; a smaller one takes its value', () => {
    const big = dram(30e-15, 300e-15);
    big.write(1);
    big.precharge(0);
    big.e.setParam('WL', 'on', true);
    expect([big.e.logic(big.bl), big.e.logic(big.cell)]).toEqual([0, 0]);

    const small = dram(30e-15); // bit line with no capacitor: a normal node, smaller than the cell
    small.write(1);
    small.precharge(0);
    small.e.setParam('WL', 'on', true);
    expect([small.e.logic(small.bl), small.e.logic(small.cell)]).toEqual([1, 1]);
    expect(small.e.levels.maxCharge).toBe(small.e.levels.large);
    expect(big.e.levels.maxCharge).toBe(big.e.levels.large + 1);
  });
});
