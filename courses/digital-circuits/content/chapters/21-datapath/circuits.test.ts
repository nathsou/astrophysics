import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine, type DigitalEngine } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';
import { OctetMachine } from '$lib/sim/cpu/octet';

/**
 * The live circuits of Chapter 21 do what the text and the captions say: they load and run without messages, and each
 * behaves as its caption describes (the flag logic is checked against the interpreter's own flags on real additions,
 * subtractions and shifts).
 */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;

function bench(c: Circuit) {
  const flat = flatten(c);
  const e: DigitalEngine = createDigitalEngine(flat);
  const pin = (id: string) => flat.elements.find((x) => x.id === id)!.pins[0]!;
  return {
    e,
    flat,
    /** Set a logic switch (id `in_X`) or hold a button. */
    set(id: string, v: number) {
      e.setParam(`in_${id}`, 'on', !!v);
    },
    press(id: string, ns = 50) {
      e.setParam(`in_${id}`, 'pressed', true);
      e.advance(ns * 1e-9);
      e.setParam(`in_${id}`, 'pressed', false);
      e.advance(ns * 1e-9);
    },
    settle(ns = 100) {
      e.advance(ns * 1e-9);
    },
    /** The logic value on the net of a component's first pin. */
    at: (id: string) => e.logic(pin(id)),
  };
}
const problems = (b: ReturnType<typeof bench>) => b.e.messages.filter((m) => m.level !== 'info');

describe('the circuits load and run', () => {
  for (const name of ['bus-window', 'regfile', 'flags']) {
    test(name, () => {
      const b = bench(load(name));
      b.settle(1000);
      expect(problems(b)).toEqual([]);
    });
  }
});

describe('Figure 21.2: three drivers on one wire', () => {
  const Z = 3;
  const X = 2;
  test('nothing enabled: the wire floats; one driver: it carries that driver’s data', () => {
    const b = bench(load('bus-window'));
    b.settle();
    expect(b.at('bus')).toBe(Z);
    b.set('E1', 1);
    b.settle();
    expect(b.at('bus')).toBe(1);
    b.set('D1', 0);
    b.settle();
    expect(b.at('bus')).toBe(0);
    expect(problems(b)).toEqual([]);
  });
  test('two drivers that agree are harmless; two that disagree give X and a warning', () => {
    const b = bench(load('bus-window'));
    b.set('E1', 1);
    b.set('E2', 1);
    b.settle();
    expect(b.at('bus')).toBe(1); // Data 1 and Data 2 are both 1
    expect(problems(b)).toEqual([]);
    b.set('D2', 0);
    b.settle();
    expect(b.at('bus')).toBe(X);
    expect(problems(b).some((m) => /Contention/.test(m.text))).toBe(true);
  });
  test('with BUSWIN off nothing can drive, whatever is enabled', () => {
    const b = bench(load('bus-window'));
    b.set('E1', 1);
    b.set('E3', 1); // Data 1 = 1 and Data 3 = 0 would fight
    b.set('WIN', 0);
    b.settle();
    expect(b.at('bus')).toBe(Z);
    expect(problems(b)).toEqual([]);
  });
});

describe('Figure 21.3: the register file', () => {
  const read = (b: ReturnType<typeof bench>) => b.at('out1') * 2 + b.at('out0');
  function write(b: ReturnType<typeof bench>, reg: number, value: number) {
    b.set('WA1', reg >> 1);
    b.set('WA0', reg & 1);
    b.set('WD1', value >> 1);
    b.set('WD0', value & 1);
    b.set('WE', 1);
    b.settle();
    b.press('CLK');
    b.set('WE', 0);
    b.settle();
  }
  function select(b: ReturnType<typeof bench>, reg: number) {
    b.set('RA1', reg >> 1);
    b.set('RA0', reg & 1);
    b.settle();
  }
  test('a written value can be read back, and each register keeps its own', () => {
    const b = bench(load('regfile'));
    const values = [2, 1, 3, 0];
    // Start from a known state: write zeros, then the values.
    for (let r = 0; r < 4; r++) write(b, r, 0);
    for (let r = 0; r < 4; r++) write(b, r, values[r]!);
    for (let r = 0; r < 4; r++) {
      select(b, r);
      expect(read(b), `R${r}`).toBe(values[r]);
    }
    expect(problems(b)).toEqual([]);
  });
  test('nothing is stored while WE is 0, even on a clock edge', () => {
    const b = bench(load('regfile'));
    write(b, 1, 3);
    select(b, 1);
    b.set('WA1', 0);
    b.set('WA0', 1);
    b.set('WD1', 0);
    b.set('WD0', 0);
    b.settle();
    b.press('CLK');
    expect(read(b)).toBe(3);
  });
});

describe('Figure 21.4: the flag logic', () => {
  const setInputs = (b: ReturnType<typeof bench>, v: Record<string, number>) => {
    for (const [k, x] of Object.entries(v)) b.set(k, x);
    b.settle(60);
  };
  const flags = (b: ReturnType<typeof bench>) => ({ z: b.at('out_Z') === 1, c: b.at('out_C') === 1, n: b.at('out_N') === 1, v: b.at('out_V') === 1 });

  test('all 512 input combinations agree with the equations in the text', () => {
    const b = bench(load('flags'));
    const names = ['OP2', 'OP1', 'OP0', 'COUT', 'A0', 'A7', 'B7', 'Y7', 'YZ'];
    for (let m = 0; m < 512; m++) {
      const x: Record<string, number> = {};
      names.forEach((n, i) => (x[n] = (m >> (8 - i)) & 1));
      setInputs(b, x);
      const arith = !x.OP1! && !x.OP2!;
      const sub = !!x.OP0 && arith;
      const shr = !!x.OP2 && !!x.OP1 && !x.OP0;
      const c = (!!x.COUT !== sub) || (shr && !!x.A0);
      const v = arith && !(x.A7! ^ (x.B7! ^ +sub)) && !!(x.Y7! ^ x.A7!);
      expect(flags(b), names.map((n) => x[n]).join('')).toEqual({ z: !!x.YZ, c, n: !!x.Y7, v });
    }
  });

  test('driven with the ALU’s real signals, it gives the flags the interpreter gives', () => {
    const b = bench(load('flags'));
    const ref = (byte: number, a: number, bv: number) => {
      const m = new OctetMachine();
      m.memory[0] = byte;
      m.r[0] = a;
      m.r[1] = bv;
      m.step();
      return m.flags;
    };
    const operations: { op: number; byte: number; second: (a: number, b: number) => number; y: (a: number, b: number) => number; cout: (a: number, b: number) => number }[] = [
      { op: 0, byte: 0x81, second: (_a, x) => x, y: (a, x) => (a + x) & 255, cout: (a, x) => +(a + x > 255) },
      { op: 1, byte: 0x91, second: (_a, x) => x, y: (a, x) => (a - x) & 255, cout: (a, x) => +(a >= x) },
      { op: 0, byte: 0xe0, second: (a) => a, y: (a) => (a + a) & 255, cout: (a) => +(a + a > 255) },
      { op: 0, byte: 0xe3, second: () => 1, y: (a) => (a + 1) & 255, cout: (a) => +(a + 1 > 255) },
      { op: 6, byte: 0xe1, second: () => 0, y: (a) => a >> 1, cout: () => 0 },
      { op: 2, byte: 0xa1, second: (_a, x) => x, y: (a, x) => a & x, cout: () => 0 },
      { op: 7, byte: 0xe2, second: () => 0, y: (a) => ~a & 255, cout: () => 0 },
    ];
    const values = [0, 1, 2, 0x3f, 0x7e, 0x7f, 0x80, 0x81, 0xc0, 0xfe, 0xff, 0x55, 0xaa];
    for (const o of operations)
      for (const a of values)
        for (const x of values) {
          const sec = o.second(a, x);
          const y = o.y(a, sec);
          setInputs(b, { OP2: o.op >> 2, OP1: (o.op >> 1) & 1, OP0: o.op & 1, COUT: o.cout(a, sec), A0: a & 1, A7: a >> 7, B7: sec >> 7, Y7: y >> 7, YZ: +(y === 0) });
          expect(flags(b), `op ${o.op} byte 0x${o.byte.toString(16)}: ${a}, ${x}`).toEqual(ref(o.byte, a, x));
        }
  });
});
