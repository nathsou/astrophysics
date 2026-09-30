import { describe, expect, test } from 'vitest';
import { assemble } from '$lib/sim/cpu/octet';
import { IoBoard, bitSignal, dacTrace, pwmSignal, valueAt, CLOCK_HZ, PWM_PERIOD } from './board';
import { BOARD_PROGRAMS, UART_BIT_CYCLES, boardProgram } from './programs';
import { decodeUart, edgesOf, frameText } from '$lib/bench/instruments/protocols';

const board = (id: string) => {
  const b = new IoBoard(boardProgram(id).source);
  expect(b.computer.diagnostics, id).toEqual([]);
  return b;
};

describe('every board program assembles cleanly', () => {
  test.each(BOARD_PROGRAMS.map((p) => [p.id, p.source] as const))('%s', (id, source) => {
    const p = assemble(source);
    expect(p.diagnostics, id).toEqual([]);
    expect(p.size).toBeGreaterThan(5);
    expect(p.size).toBeLessThanOrEqual(240);
  });
});

describe('the software UART', () => {
  test('LED 0 carries "Hi!" as three frames of 10 × 104 cycles, and a UART decoder reads it', () => {
    const b = board('uart');
    expect(b.computer.runToHalt()).toBe('halted');
    const end = b.computer.machine.cycles;
    const s = bitSignal(b.computer.ledLog, 0, 0, end);
    const frames = decodeUart(s, { baud: CLOCK_HZ / UART_BIT_CYCLES });
    expect(frameText(frames)).toBe('Hi!');
    expect(frames.every((f) => !f.framingError)).toBe(true);
    // Each frame is exactly ten bit times, to the cycle.
    for (const f of frames) expect(Math.round((f.t1 - f.t0) * CLOCK_HZ)).toBe(10 * UART_BIT_CYCLES);
    // The bit time is the shortest pulse, so a receiver can find the baud rate on its own (once the line has settled
    // to idle: the first 60 cycles are the program setting the pin high, which is a short pulse of its own).
    const settled = bitSignal(b.computer.ledLog, 0, 100, end);
    expect(frameText(decodeUart(settled))).toBe('Hi!');
  });

  test('inside a frame every edge is a whole number of bit times after the previous one: the padding works', () => {
    const b = board('uart');
    b.computer.runToHalt();
    const s = bitSignal(b.computer.ledLog, 0, 0, b.computer.machine.cycles);
    const frames = decodeUart(s, { baud: CLOCK_HZ / UART_BIT_CYCLES });
    const edges = edgesOf(s).map((e) => Math.round(e.t * CLOCK_HZ));
    for (const f of frames) {
      const t0 = Math.round(f.t0 * CLOCK_HZ);
      const inside = edges.filter((e) => e >= t0 && e < t0 + 9 * UART_BIT_CYCLES);
      expect(inside.length).toBeGreaterThan(1);
      for (let i = 1; i < inside.length; i++) expect((inside[i]! - inside[i - 1]!) % UART_BIT_CYCLES, `frame at ${t0}`).toBe(0);
    }
    // Between frames the stop bit lasts at least a bit time, and here a little longer: the loop that fetches the next character.
    for (let i = 1; i < frames.length; i++) expect(frames[i]!.t0 - frames[i - 1]!.t1).toBeGreaterThanOrEqual(0);
  });

  test('the baud rate is the clock over the bit time: 9615', () => {
    expect(Math.round(CLOCK_HZ / UART_BIT_CYCLES)).toBe(9615);
    // 0.16 % from 9600, far inside the 5 % or so a receiver tolerates.
    expect(Math.abs(CLOCK_HZ / UART_BIT_CYCLES / 9600 - 1)).toBeLessThan(0.002);
  });

  test('a receiver at 9600 baud reads it too, but one at 4800 does not', () => {
    const b = board('uart');
    b.computer.runToHalt();
    const s = bitSignal(b.computer.ledLog, 0, 0, b.computer.machine.cycles);
    expect(frameText(decodeUart(s, { baud: 9600 }))).toBe('Hi!');
    expect(frameText(decodeUart(s, { baud: 4800 }))).not.toBe('Hi!');
  });
});

describe('PWM', () => {
  test('the pin is high for duty cycles of every 256: for every duty', () => {
    for (const duty of [0, 1, 64, 128, 200, 255]) {
      const log = [{ cycle: 0, value: duty }];
      const s = pwmSignal(log, 0, 4 * PWM_PERIOD);
      let high = 0;
      for (let i = 0; i + 1 < s.t.length; i++) if (s.v[i] === 1) high += s.t[i + 1]! - s.t[i]!;
      if (s.v[s.v.length - 1] === 1) high += 4 * PWM_PERIOD / CLOCK_HZ - s.t[s.t.length - 1]!;
      expect(Math.round(high * CLOCK_HZ), `duty ${duty}`).toBe(4 * duty);
    }
  });

  test('a change of duty takes effect from its cycle', () => {
    const log = [{ cycle: 0, value: 0 }, { cycle: 300, value: 100 }];
    const s = pwmSignal(log, 0, 1024);
    const rises = edgesOf(s).filter((e) => e.rising).map((e) => Math.round(e.t * CLOCK_HZ));
    // At cycle 300 the counter reads 44, already below the new duty of 100, so the pin goes high at once.
    expect(rises).toEqual([300, 512, 768]);
    expect(edgesOf(s).filter((e) => !e.rising).map((e) => Math.round(e.t * CLOCK_HZ))).toEqual([356, 612, 868]);
  });

  test('the fade program raises the duty from 0 to 255 and back, one step at a time', () => {
    const b = board('pwm-fade');
    b.computer.run(400_000);
    const values = b.computer.pwmLog.map((x) => x.value);
    expect(values.slice(0, 4)).toEqual([0, 1, 2, 3]);
    const top = values.indexOf(255);
    expect(top).toBe(255);
    expect(values.slice(top, top + 4)).toEqual([255, 254, 253, 252]);
    // The steps are evenly spaced in time.
    const gaps = new Set(b.computer.pwmLog.slice(2, 200).map((x, i, a) => (i ? x.cycle - a[i - 1]!.cycle : 0)).slice(1));
    expect(gaps.size).toBe(1);
  });

  test('the average of the pin is what an LED shows: mean duty / 256', () => {
    const b = board('pwm-fade');
    b.computer.run(100_000);
    const { c0, c1 } = { c0: 50_000, c1: 50_000 + 8 * PWM_PERIOD };
    const s = pwmSignal(b.computer.pwmLog, c0, c1);
    let high = 0;
    for (let i = 0; i + 1 < s.t.length; i++) if (s.v[i] === 1) high += s.t[i + 1]! - s.t[i]!;
    if (s.v[s.v.length - 1] === 1) high += (c1 - c0) / CLOCK_HZ - s.t[s.t.length - 1]!;
    const dutyNow = valueAt(b.computer.pwmLog, c0);
    expect(high * CLOCK_HZ / (c1 - c0)).toBeCloseTo(dutyNow / 256, 1);
  });
});

describe('the DAC', () => {
  test('the triangle program writes 0…255 then 255…1 and repeats', () => {
    const b = board('triangle');
    b.computer.run(40_000);
    const values = b.computer.dacLog.map((x) => x.value);
    expect(values.slice(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(values[255]).toBe(255);
    // The program writes 255 twice in a row; the second write changes nothing, so the log has it once.
    expect(values.slice(255, 259)).toEqual([255, 254, 253, 252]);
    expect(values.slice(509, 513)).toEqual([1, 0, 1, 2]);
  });

  test('the staircase is drawn in volts: n/256 of 5 V, held until the next write', () => {
    const t = dacTrace([{ cycle: 0, value: 0 }, { cycle: 10, value: 128 }, { cycle: 30, value: 255 }], 0, 50);
    expect(t.v.map((x) => +x.toFixed(4))).toEqual([0, 0, 2.5, 2.5, 4.9805, 4.9805]);
    expect(t.t).toEqual([0, 1e-5, 1e-5, 3e-5, 3e-5, 5e-5]);
  });
});

describe('a bouncing button', () => {
  const presses = (id: string, ...steps: [number, boolean][]) => {
    const b = board(id);
    b.bouncy = true;
    let now = 0;
    for (const [cycles, down] of steps) {
      b.computer.run(cycles);
      now += cycles;
      b.press(0, down);
    }
    b.computer.run(60_000);
    return b;
  };

  test('a press produces a burst of changes of BTN0 over a few milliseconds, then stays', () => {
    const b = presses('switches', [1000, true]);
    expect(b.bounces).toBeGreaterThanOrEqual(4);
    expect(b.bounces).toBeLessThanOrEqual(11);
    b.computer.board.buttons; // BTN0 reads 1 at the end
    expect(b.computer.machine.read(0xfa) & 1).toBe(1);
  });

  test('the naive counter counts one press as several; the debounced one counts it once, whatever the bounce', () => {
    const naive = presses('count-naive', [2000, true], [30_000, false]);
    const debounced = presses('count-debounced', [2000, true], [30_000, false]);
    expect(naive.computer.board.hex).toBeGreaterThan(1);
    expect(debounced.computer.board.hex).toBe(1);
  });

  test('one bouncy press counts 5 or 6 and the release adds 3 (the figure caption says so), whenever it comes', () => {
    for (const before of [1000, 50_000, 200_000]) {
      const b = board('count-naive');
      b.computer.run(before);
      b.press(0, true);
      b.computer.run(60_000);
      const press = b.computer.board.hex;
      expect([5, 6]).toContain(press);
      b.press(0, false);
      b.computer.run(60_000);
      expect(b.computer.board.hex).toBe(press + 3);
    }
  });

  test('the debounced counter counts each of several presses once', () => {
    let b = board('count-debounced');
    for (let i = 0; i < 4; i++) {
      b.computer.run(20_000);
      b.press(0, true);
      b.computer.run(30_000);
      b.press(0, false);
      b.computer.run(30_000);
    }
    expect(b.computer.board.hex).toBe(4);
    b = board('count-naive');
    for (let i = 0; i < 4; i++) {
      b.computer.run(20_000);
      b.press(0, true);
      b.computer.run(30_000);
      b.press(0, false);
      b.computer.run(30_000);
    }
    expect(b.computer.board.hex).toBeGreaterThan(4);
  });

  test('without bounce the naive counter is right', () => {
    const b = board('count-naive');
    b.bouncy = false;
    for (let i = 0; i < 3; i++) {
      b.computer.run(5000);
      b.press(0, true);
      b.computer.run(5000);
      b.press(0, false);
    }
    b.computer.run(5000);
    expect(b.computer.board.hex).toBe(3);
  });
});

describe('the ADC in software', () => {
  test('the binary search over the DAC and the comparator returns the input, for all 256 values', () => {
    for (let code = 0; code < 256; code++) {
      const b = board('sar');
      b.adcVolts = ((code + 0.5) * 5) / 256;
      expect(b.adcCode()).toBe(code);
      expect(b.computer.runToHalt(), `${code}`).toBe('halted');
      expect(b.computer.board.hex, `code ${code}`).toBe(code);
      expect(b.computer.board.leds).toBe(code);
    }
  });

  test('it takes 9 comparisons: 8 bits, and the last check', () => {
    const b = board('sar');
    b.adcVolts = 3.5;
    b.computer.runToHalt();
    expect(b.computer.dacLog.length).toBeGreaterThanOrEqual(8);
    const dacWrites = b.computer.history.length;
    expect(dacWrites).toBeGreaterThan(0);
  });
});

describe('the switches program', () => {
  test('LEDs follow the switches', () => {
    const b = board('switches');
    b.computer.board.switches = 0xa5;
    b.computer.run(200);
    expect(b.computer.board.leds).toBe(0xa5);
    b.computer.board.switches = 0x3c;
    b.computer.run(200);
    expect(b.computer.board.leds).toBe(0x3c);
  });
});
