import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import type { Circuit } from '$lib/sim/netlist/types';
import { captureDigital } from './widgets/capture';
import { decodeSpi, decodeUart, edgesOf, frameText, levelAt } from '$lib/bench/instruments/protocols';

/**
 * Every live circuit of Chapter 24 must do what the text says. Each test loads the JSON as the page does, drives it through
 * `setParam` (as a click does) and reads what it puts on its wires: the serial circuits are decoded by the same decoders
 * that the figures use.
 */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;
const setData = (bits: number) => (e: { setParam(id: string, key: string, v: boolean): void }) => {
  for (let i = 0; i < 8; i++) e.setParam(`in_D${i}`, 'on', !!((bits >> i) & 1));
};

describe('Figure: the UART transmitter', () => {
  const c = load('uart-tx');
  test('it runs without messages', () => {
    const cap = captureDigital(c, ['TX'], 1e-3);
    expect(cap.missing).toEqual([]);
    expect(cap.engine.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });

  test('with 0x41 set it sends frame after frame of 0x41 at 9600 baud, LSB first, start bit low, stop bit high', () => {
    const cap = captureDigital(c, ['TX', 'CLK'], 8e-3);
    const tx = cap.signals[0]!;
    const frames = decodeUart(tx, { baud: 9600 });
    expect(frames.length).toBeGreaterThanOrEqual(3);
    expect(frames.map((f) => f.byte)).toEqual(frames.map(() => 0x41));
    expect(frames.some((f) => f.framingError)).toBe(false);
    // The frames repeat every 16 bit times, and the bit time is one clock period.
    expect(frames[1]!.t0 - frames[0]!.t0).toBeCloseTo(16 / 9600, 6);
    // The start bit is one bit time wide.
    const fall = edgesOf(tx).find((e) => !e.rising)!;
    const rise = edgesOf(tx).find((e) => e.rising && e.t > fall.t)!;
    expect(rise.t - fall.t).toBeCloseTo(1 / 9600, 6);
    // The line is idle high between the frames.
    expect(levelAt(tx, frames[0]!.t1 + 0.5 / 9600)).toBe(1);
  });

  test('any byte set on the eight switches is sent', () => {
    for (const byte of [0x00, 0xff, 0x55, 0xaa, 0x48, 0x69, 0x80, 0x01]) {
      const cap = captureDigital(c, ['TX'], 5e-3, setData(byte));
      const frames = decodeUart(cap.signals[0]!, { baud: 9600 });
      expect(frames.length, `0x${byte.toString(16)}`).toBeGreaterThanOrEqual(2);
      for (const f of frames.slice(0, 2)) expect(f.byte).toBe(byte);
    }
  });

  test('a UART needs no clock wire: the decoder finds the bit time from the edges alone', () => {
    const cap = captureDigital(c, ['TX'], 6e-3, setData(0x55));
    expect(frameText(decodeUart(cap.signals[0]!).slice(0, 2))).toBe('UU');
  });
});

describe('Figure: an SPI master and a 74HC595', () => {
  const c = load('spi-595');
  test('it runs without messages and every name resolves', () => {
    const cap = captureDigital(c, ['SCK', 'MOSI', 'CS', 'CLK'], 20e-6);
    expect(cap.missing).toEqual([]);
    expect(cap.engine.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });

  test('eight clock pulses inside each chip-select window, and the byte is decoded in SPI mode 0, MSB first', () => {
    const cap = captureDigital(c, ['SCK', 'MOSI', 'MISO', 'CS'].filter((n) => n !== 'MISO'), 40e-6, setData(0xa5));
    const [sck, mosi, cs] = cap.signals as [typeof cap.signals[0], typeof cap.signals[0], typeof cap.signals[0]];
    const { bytes, selects } = decodeSpi(sck, mosi, cs, { mode: 0 });
    expect(bytes.length).toBeGreaterThanOrEqual(2);
    expect(bytes.every((b) => b.byte === 0xa5)).toBe(true);
    expect(selects.length).toBeGreaterThanOrEqual(2);
    // Clean edges: SCK never pulses outside the window.
    for (const e of edgesOf(sck)) {
      const inside = selects.some((w) => e.t >= w.t0 - 1e-9 && e.t <= w.t1 + 1e-9);
      expect(inside, `edge at ${e.t}`).toBe(true);
    }
  });

  test('the storage register shows the byte on its eight outputs after the chip select goes high', () => {
    for (const byte of [0xa5, 0x0f, 0xf0, 0x01, 0x80, 0x00, 0xff]) {
      const cap = captureDigital(c, ['SCK'], 20e-6, setData(byte));
      const out = (i: number) => cap.engine.logic(cap.flat.elements.find((x) => x.id === `out_Q${i}`)!.pins[0]!);
      let v = 0;
      for (let i = 0; i < 8; i++) v |= out(i) << i;
      expect(v, `0x${byte.toString(16)}`).toBe(byte);
    }
  });

  test('the 74HC595 latches only on the rising edge of chip select: the outputs hold while the next byte is shifted in', () => {
    const cap = captureDigital(c, ['CS'], 5e-6, setData(0xa5));
    const lit = () => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => cap.engine.logic(cap.flat.elements.find((x) => x.id === `out_Q${i}`)!.pins[0]!));
    cap.engine.advance(20e-6);
    const before = lit();
    // Change the data byte mid-frame: the outputs must not follow until the next latch.
    setData(0x5a)(cap.engine);
    cap.engine.advance(1e-6);
    expect(lit()).toEqual(before);
  });
});

// ── The analog circuits ──────────────────────────────────────────────────────────────────────────────

import { createAnalogEngine } from '$lib/sim/analog';
import { flatten } from '$lib/sim/netlist/flatten';
import { OCTET_IO, OCTET_MEMORY } from '$lib/sim/cpu/octet';
import { createDigitalEngine } from '$lib/sim/digital';

const analog = (name: string) => {
  const flat = flatten(load(name));
  return { e: createAnalogEngine(flat), flat };
};
const volts = (e: ReturnType<typeof createAnalogEngine>, id: string) => Number(e.state(id).value);

describe('Figure: the address decoder', () => {
  const c = load('address-decoder');
  const flat = flatten(c);
  const e = createDigitalEngine(flat);
  const lit = (id: string) => e.logic(flat.elements.find((x) => x.id === `out_${id}`)!.pins[0]!);
  const NAMES = ['RAM', 'MATRIX', 'LEDS', 'SWITCHES', 'BUTTONS', 'HEX', 'CONSOLE', 'RANDOM', 'PWM', 'DAC'];
  const setAddress = (a: number) => {
    for (let i = 0; i < 8; i++) e.setParam(`in_A${i}`, 'on', !!((a >> i) & 1));
    e.advance(200e-9);
  };

  test('it runs without a message', () => {
    setAddress(0);
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });

  test('for all 256 addresses exactly one line is selected, and it is the one the memory map says', () => {
    for (let a = 0; a < 256; a++) {
      setAddress(a);
      const on = NAMES.filter((n) => lit(n) === 1);
      let want: string;
      if (a < OCTET_MEMORY.ioBase) want = 'RAM';
      else if (a < OCTET_IO.LEDS) want = 'MATRIX';
      else {
        // The device registers by address; ADC and DAC share 0xFF.
        const byAddress: Record<number, string> = { [OCTET_IO.LEDS]: 'LEDS', [OCTET_IO.SWITCHES]: 'SWITCHES', [OCTET_IO.BUTTONS]: 'BUTTONS', [OCTET_IO.HEX]: 'HEX', [OCTET_IO.CONSOLE]: 'CONSOLE', [OCTET_IO.RANDOM]: 'RANDOM', [OCTET_IO.PWM]: 'PWM', [OCTET_IO.DAC]: 'DAC' };
        want = byAddress[a]!;
      }
      expect(on, `address 0x${a.toString(16)}`).toEqual([want]);
    }
  });

  test('the 16 device bytes of the memory map are the 16 addresses of region F', () => {
    expect(OCTET_MEMORY.ioBase).toBe(0xf0);
    const c2 = c.components.filter((x) => x.type === 'indicator').map((x) => x.id);
    expect(c2).toHaveLength(NAMES.length);
  });
});

describe('Figure: PWM, the generator', () => {
  const c = load('pwm-generator');
  const flat = flatten(c);
  test('over one period of 16 clocks the output is high for exactly duty/16 of them, for every duty', () => {
    const e = createDigitalEngine(flat);
    const pwm = flat.elements.find((x) => x.id === 'PWM')!.pins[0]!;
    for (let duty = 0; duty < 16; duty++) {
      for (let i = 0; i < 4; i++) e.setParam(`in_B${i}`, 'on', !!((duty >> i) & 1));
      e.advance(0.5e-3);
      // Sample once per clock (1 ms) over one period, half-way between edges.
      let high = 0;
      for (let k = 0; k < 16; k++) {
        e.advance(1e-3);
        high += e.logic(pwm);
      }
      expect(high, `duty ${duty}`).toBe(duty);
    }
  });
});

describe('Figure: PWM through an RC filter', () => {
  /** Advance in as many calls as the engine needs (one call does at most a frame's worth of work). */
  const run = (e: ReturnType<typeof createAnalogEngine>, seconds: number) => {
    const end = e.time + seconds;
    while (e.time < end - 1e-12) e.advance(end - e.time);
  };
  test('the output settles to the duty cycle times 5 V, with a ripple much smaller than the step', () => {
    const { e } = analog('pwm-filter');
    for (const [duty, want] of [[0.25, 1.25], [0.5, 2.5], [0.9, 4.5]] as const) {
      e.setParam('SRC', 'duty', duty);
      run(e, 0.15);
      const samples: number[] = [];
      for (let k = 0; k < 20; k++) {
        run(e, 0.0001);
        samples.push(volts(e, 'V1'));
      }
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      expect(Math.abs(mean - want), `duty ${duty}`).toBeLessThan(0.08);
      expect(Math.max(...samples) - Math.min(...samples)).toBeLessThan(0.2);
    }
    expect(e.messages.filter((m) => m.level === 'error')).toEqual([]);
  });

  test('the ripple falls as the frequency rises (1 / f) and as the capacitor grows', () => {
    const ripple = (f: number, C: number) => {
      const { e } = analog('pwm-filter');
      e.setParam('SRC', 'frequency', f);
      e.setParam('C1', 'capacitance', C);
      e.setParam('SRC', 'duty', 0.5);
      run(e, Math.max(0.15, 6 * 1000 * C));
      const rec = e.watch([e.netlist.netNames.indexOf('OUT')]);
      run(e, 1 / f);
      const v = rec.values()[0]!;
      rec.close();
      return Math.max(...v) - Math.min(...v);
    };
    const slow = ripple(500, 1e-5);
    const fast = ripple(2000, 1e-5);
    expect(slow / fast).toBeGreaterThan(3.2);
    expect(slow / fast).toBeLessThan(4.8);
    expect(ripple(1000, 1e-4)).toBeLessThan(ripple(1000, 1e-5) / 5);
  });
});

describe('Figure: an R-2R ladder', () => {
  test('all 16 codes give code/16 of 5 V, within a millivolt', () => {
    const { e } = analog('r2r-dac');
    for (let code = 0; code < 16; code++) {
      for (let i = 0; i < 4; i++) e.setParam(`in_B${i}`, 'on', !!((code >> i) & 1));
      e.advance(1e-6);
      expect(volts(e, 'V1'), `code ${code}`).toBeCloseTo((5 * code) / 16, 3);
    }
  });
  test('it is 4 resistors R, 5 of 2R and 4 switches: 2 resistances only', () => {
    const c = load('r2r-dac');
    const rs = c.components.filter((x) => x.type === 'resistor').map((x) => x.params!.resistance);
    expect(rs.filter((r) => r === 1000)).toHaveLength(3);
    expect(rs.filter((r) => r === 2000)).toHaveLength(5);
  });
});

describe('Figure: a comparator, a DAC and an unknown voltage', () => {
  test('the comparator says whether Vin is above the DAC, and a binary search finds 11 of 16', () => {
    const { e } = analog('sar-adc');
    const cmp = () => Number(e.state('out_CMP').lit ?? 0) || Number(e.state('K1').value);
    const set = (code: number) => {
      for (let i = 0; i < 4; i++) e.setParam(`in_B${i}`, 'on', !!((code >> i) & 1));
      e.advance(1e-6);
    };
    // The unknown input is 3.5 V: codes up to 11 (3.4375 V) are below it, 12 (3.75 V) is above.
    for (let code = 0; code < 16; code++) {
      set(code);
      expect(Number(e.state('K1').value), `code ${code}`).toBe((5 * code) / 16 < 3.5 ? 1 : 0);
    }
    let found = 0;
    for (let bit = 3; bit >= 0; bit--) {
      set(found | (1 << bit));
      if (cmp()) found |= 1 << bit;
    }
    expect(found).toBe(11);
    expect(Math.floor((3.5 / 5) * 16)).toBe(11);
  });
});

describe('Figure: a button on a GPIO pin', () => {
  test('open: 5 V; pressed: about 0 V; with bounce it flickers between them for a few milliseconds and then stays low', () => {
    const { e, flat } = analog('gpio-button');
    e.advance(1e-3);
    expect(volts(e, 'V1')).toBeGreaterThan(4.99);
    e.setParam('SW', 'pressed', true);
    const pin = flat.netNames.indexOf('PIN');
    expect(pin).toBeGreaterThanOrEqual(0);
    const rec = e.watch([pin]);
    e.advance(20e-3);
    const v = rec.values()[0]!;
    const t = rec.times();
    rec.close();
    let edges = 0;
    for (let i = 1; i < v.length; i++) if ((v[i]! > 2.5) !== (v[i - 1]! > 2.5)) edges++;
    expect(edges).toBeGreaterThanOrEqual(3);
    expect(t[t.length - 1]!).toBeGreaterThan(5e-3);
    expect(volts(e, 'V1')).toBeLessThan(0.05);
  });
});

describe('Figure: an I²C line', () => {
  test('the line is high only when nobody pulls it low: a wired AND', () => {
    const { e } = analog('i2c-bus');
    e.advance(20e-6);
    expect(volts(e, 'V1')).toBeGreaterThan(4.99);
    for (const [m, s, high] of [[false, false, true], [true, false, false], [false, true, false], [true, true, false]] as const) {
      e.setParam('in_MASTER', 'on', m);
      e.setParam('in_SLAVE', 'on', s);
      e.advance(20e-6);
      expect(volts(e, 'V1') > 2.5, `master ${m} device ${s}`).toBe(high);
    }
  });

  test('falling is fast (the driver pulls hard), rising is slow (the pull-up has to charge 200 pF): about 0.85 R C from 30 % to 70 %', () => {
    const { e, flat } = analog('i2c-bus');
    const sda = flat.netNames.indexOf('SDA');
    e.setParam('in_MASTER', 'on', true);
    e.advance(20e-6);
    const rec = e.watch([sda]);
    e.setParam('in_MASTER', 'on', false);
    e.advance(10e-6);
    const t = rec.times();
    const v = rec.values()[0]!;
    rec.close();
    const cross = (level: number) => {
      for (let i = 1; i < v.length; i++) if (v[i - 1]! < level && v[i]! >= level) return t[i - 1]! + ((level - v[i - 1]!) / (v[i]! - v[i - 1]!)) * (t[i]! - t[i - 1]!);
      return NaN;
    };
    const rise = cross(3.5) - cross(1.5);
    expect(rise).toBeGreaterThan(0.7e-6);
    expect(rise).toBeLessThan(0.95e-6);
    // The specification allows 1000 ns for standard mode.
    expect(rise).toBeLessThan(1e-6);
    // The fall through the driver is more than ten times faster.
    const rec2 = e.watch([sda]);
    e.setParam('in_MASTER', 'on', true);
    e.advance(2e-6);
    const t2 = rec2.times();
    const v2 = rec2.values()[0]!;
    rec2.close();
    const fall = (() => {
      let a = NaN;
      let b = NaN;
      for (let i = 1; i < v2.length; i++) {
        if (Number.isNaN(a) && v2[i - 1]! > 3.5 && v2[i]! <= 3.5) a = t2[i]!;
        if (Number.isNaN(b) && v2[i - 1]! > 1.5 && v2[i]! <= 1.5) b = t2[i]!;
      }
      return b - a;
    })();
    expect(fall).toBeLessThan(rise / 10);
  });
});
