import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { check } from './check';
import { elaborate } from './elaborate';
import { createRtlSim } from './rtlsim';
import { findStd, loadStd } from './std/index';
import { renderTestResult, runTests } from './testbench';

describe('standard library', () => {
  it('lists every file and the modules they declare', () => {
    expect(loadStd().map((f) => [f.file, f.modules])).toEqual([
      ['std/synchronizer.dcl', ['Synchronizer']],
      ['std/debouncer.dcl', ['Debouncer']],
      ['std/edge-detect.dcl', ['EdgeDetect']],
      ['std/fifo.dcl', ['Fifo']],
      ['std/seven-seg.dcl', ['SevenSeg']],
      ['std/uart-tx.dcl', ['UartTx']],
      ['std/uart-rx.dcl', ['UartRx']],
    ]);
    const onDisk = readdirSync(new URL('./std/', import.meta.url)).filter((f) => f.endsWith('.dcl'));
    expect(onDisk.sort()).toEqual(loadStd().map((f) => f.file.slice(4)).sort());
    expect(findStd('Fifo')?.file).toBe('std/fifo.dcl');
    expect(findStd('Nothing')).toBeUndefined();
  });

  for (const f of loadStd()) {
    it(`${f.file}: checks without warnings and passes its tests`, () => {
      const r = runTests(f.source, { file: f.file });
      expect(r.diagnostics).toEqual([]);
      expect(r.results.length).toBeGreaterThan(0);
      for (const t of r.results) expect(t.passed, renderTestResult(r.source, t)).toBe(true);
      // The file on disk is the one bundled.
      expect(readFileSync(new URL(`./${f.file}`, import.meta.url), 'utf8')).toBe(f.source);
    });
  }

  it('Fifo behaves like a queue under random pushes and pops', () => {
    const r = check('module Top(clk: clock, push: bit, data_in: bits<8>, pop: bit) -> (data_out: bits<8>, empty: bit, full: bit, count: bits<3>) {\n  inst f: Fifo<8, 5>(clk: clk, push: push, data_in: data_in, pop: pop)\n  data_out = f.data_out\n  empty = f.empty\n  full = f.full\n  count = f.count\n}');
    expect(r.diagnostics).toEqual([]);
    const sim = createRtlSim(elaborate(r.program, 'Top'));
    const model: number[] = [];
    let seed = 42;
    const rnd = (n: number) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return (seed >>> 8) % n;
    };
    for (let i = 0; i < 2000; i++) {
      const push = rnd(3) ? 1 : 0;
      const pop = rnd(2);
      const data = rnd(256);
      sim.set('push', push);
      sim.set('pop', pop);
      sim.set('data_in', data);
      expect(sim.get('empty')).toBe(model.length === 0 ? 1 : 0);
      expect(sim.get('full')).toBe(model.length === 5 ? 1 : 0);
      expect(sim.get('count')).toBe(model.length);
      if (model.length) expect(sim.get('data_out')).toBe(model[0]);
      const canPop = pop && model.length > 0;
      const canPush = push && model.length < 5;
      if (canPop) model.shift();
      if (canPush) model.push(data);
      sim.step();
    }
  });

  it('UartTx and UartRx carry random bytes at several speeds', () => {
    for (const clks of [2, 3, 8]) {
      const r = check(`module Link(clk: clock, start: bit, data: bits<8>) -> (busy: bit, received: bits<8>, valid: bit) {
  inst tx: UartTx<${clks}>(clk: clk, start: start, data: data)
  inst rx: UartRx<${clks}>(clk: clk, rx: tx.tx)
  busy = tx.busy
  received = rx.data
  valid = rx.valid
}`);
      expect(r.diagnostics).toEqual([]);
      const sim = createRtlSim(elaborate(r.program, 'Link'));
      const sent = [0x00, 0xff, 0x55, 0xa3, 0x01, 0x80, 0x7e];
      const got: number[] = [];
      for (const byte of sent) {
        sim.set('data', byte);
        sim.set('start', 1);
        sim.step();
        sim.set('start', 0);
        for (let c = 0; c < clks * 12 + 6; c++) {
          if (sim.get('valid')) got.push(sim.get('received'));
          sim.step();
        }
      }
      expect(got).toEqual(sent);
    }
  });

  it('Debouncer never changes on bounces shorter than its window', () => {
    const r = check('module Top(clk: clock, raw: bit) -> (clean: bit) {\n  inst d: Debouncer<5>(clk: clk, raw: raw)\n  clean = d.clean\n}');
    const sim = createRtlSim(elaborate(r.program, 'Top'));
    let seed = 1;
    let changes = 0;
    let last = 0;
    for (let i = 0; i < 500; i++) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      // Pulses of at most 4 cycles.
      sim.set('raw', (i % 9 < ((seed >>> 8) % 5)) ? 1 : 0);
      sim.step();
      if (sim.get('clean') !== last) changes++;
      last = sim.get('clean');
    }
    expect(changes).toBe(0);
  });

  it('SevenSeg draws all sixteen digits distinctly', () => {
    const r = check('module Top(v: bits<4>) -> (s: bits<7>) {\n  inst d: SevenSeg(value: v)\n  s = d.segments\n}');
    const sim = createRtlSim(elaborate(r.program, 'Top'));
    const patterns = new Set<number>();
    for (let v = 0; v < 16; v++) {
      sim.set('v', v);
      patterns.add(sim.get('s'));
    }
    expect(patterns.size).toBe(16);
  });
});
