/**
 * The Octet I/O board as a page shows it: an OctetComputer whose devices are wired to pins, and a logic analyser's view of
 * those pins over simulated time.
 *
 * The board has a 1 MHz clock, which gives every clock cycle a time (1 µs) so that waveforms can be measured. The pins:
 *
 *  - the eight bits of the LEDS register are output pins, each with an LED on it (LED 0 is also the "TX" pin of the software
 *    UART);
 *  - PWM is a pin driven by an 8-bit counter that counts clock cycles and a comparator: it is high while the counter is
 *    below the PWM register, so the duty cycle is n/256 and the period is 256 µs (3.9 kHz);
 *  - DAC is an analogue output of n/256 of 5 V, held until the next write;
 *  - BTN0 is a real switch, with contact bounce (1–5 ms of it, from the same generator as the analogue engine's push
 *    button), and the ADC input is a voltage the reader sets.
 *
 * Everything the analyser shows is computed from the logs the OctetComputer keeps of its output registers.
 */
import { Prng } from '$lib/sim/cpu/common/prng';
import { bounceBurst } from '$lib/sim/analog/models/switches';
import { OctetComputer, type OutputChange } from '../../23-running-programs/widgets/computer';
import { makeSignal, setLevel, type Signal } from './protocols';

export const CLOCK_HZ = 1e6;
export const PWM_PERIOD = 256;
export const VREF = 5;

/** The level of a register log at `cycle`: the last change at or before it. */
export function valueAt(log: OutputChange[], cycle: number): number {
  let lo = 0;
  let hi = log.length - 1;
  if (hi < 0 || cycle < log[0]!.cycle) return log[0]?.value ?? 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (log[mid]!.cycle <= cycle) lo = mid;
    else hi = mid - 1;
  }
  return log[lo]!.value;
}

/** One bit of the LEDS register over the window [c0, c1) cycles, as a signal in seconds from c0. */
export function bitSignal(log: OutputChange[], bit: number, c0: number, c1: number, hz = CLOCK_HZ): Signal {
  const s = makeSignal((valueAt(log, c0) >> bit) & 1, [], 0);
  for (const ch of log) {
    if (ch.cycle <= c0 || ch.cycle >= c1) continue;
    setLevel(s, (ch.cycle - c0) / hz, (ch.value >> bit) & 1);
  }
  return s;
}

/** The PWM pin over [c0, c1): high while (cycle mod 256) < duty. */
export function pwmSignal(log: OutputChange[], c0: number, c1: number, hz = CLOCK_HZ): Signal {
  const at = (c: number) => (c - c0) / hz;
  const s = makeSignal(0, [], 0);
  const edges: [number, number][] = [];
  // Cut the window into stretches of constant duty.
  const cuts = [c0, ...log.filter((x) => x.cycle > c0 && x.cycle < c1).map((x) => x.cycle), c1];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i]!;
    const b = cuts[i + 1]!;
    const duty = valueAt(log, a);
    if (duty === 0) {
      edges.push([at(a), 0]);
      continue;
    }
    for (let k = Math.floor(a / PWM_PERIOD); k * PWM_PERIOD < b; k++) {
      const rise = Math.max(a, k * PWM_PERIOD);
      const fall = Math.min(b, k * PWM_PERIOD + duty);
      if (fall > rise) {
        edges.push([at(rise), 1]);
        if (fall < b) edges.push([at(fall), 0]);
      } else edges.push([at(rise), 0]);
    }
  }
  for (const [t, v] of edges) setLevel(s, Math.max(t, s.t[s.t.length - 1]!), v);
  return s;
}

/** The DAC output over [c0, c1) as a staircase of volts: sample times (s from c0) and values. */
export function dacTrace(log: OutputChange[], c0: number, c1: number, hz = CLOCK_HZ): { t: number[]; v: number[] } {
  const volts = (n: number) => (VREF * n) / 256;
  const t = [0];
  const v = [volts(valueAt(log, c0))];
  for (const ch of log) {
    if (ch.cycle <= c0 || ch.cycle >= c1) continue;
    const x = (ch.cycle - c0) / hz;
    t.push(x, x);
    v.push(v[v.length - 1]!, volts(ch.value));
  }
  t.push((c1 - c0) / hz);
  v.push(v[v.length - 1]!);
  return { t, v };
}

export interface ButtonEvent {
  cycle: number;
  closed: boolean;
}

/** An I/O board around an OctetComputer. */
export class IoBoard {
  readonly computer: OctetComputer;
  readonly clockHz = CLOCK_HZ;
  /** Whether BTN0 bounces when pressed (the other buttons are clean). */
  bouncy = true;
  /** The analogue input, in volts. */
  private volts = 2.5;
  private base = 0;
  private events: ButtonEvent[] = [];
  private rng = new Prng(20260930);

  constructor(source: string) {
    this.computer = new OctetComputer(source);
    const board = this.computer.board;
    board.hooks = {
      buttons: () => (board.buttons & 0x0e) | (this.button0(this.computer.machine.cycles) ? 1 : 0),
      adc: () => this.adcCode(),
    };
  }

  /** Forget button and bounce state (with the machine's reset). */
  reset(): void {
    this.computer.reset();
    this.events = [];
    this.base = 0;
    this.computer.board.buttons = 0;
  }

  get adcVolts(): number {
    return this.volts;
  }
  set adcVolts(v: number) {
    this.volts = Math.min(VREF, Math.max(0, v));
  }
  /** The ADC's reading of the input: 0–255. */
  adcCode(): number {
    return Math.min(255, Math.floor((this.volts / VREF) * 256));
  }

  /** The level of BTN0 (1 = pressed) at a clock cycle. */
  private button0(cycle: number): boolean {
    let level = this.base === 1;
    for (const e of this.events) if (e.cycle <= cycle) level = e.closed;
    return level;
  }

  /** Press or release a button. BTN0 bounces (if `bouncy`): the contact opens and closes again for a few milliseconds. */
  press(n: number, down: boolean): void {
    const now = this.computer.machine.cycles;
    if (n !== 0) {
      const b = this.computer.board;
      b.buttons = down ? b.buttons | (1 << n) : b.buttons & ~(1 << n);
      return;
    }
    // The contact makes (or breaks) at once; then, if it bounces, it chatters.
    this.events = this.events.filter((e) => e.cycle <= now);
    this.events.push({ cycle: now, closed: down });
    if (this.bouncy) {
      for (const e of bounceBurst(() => this.rng.float(), 0, down)) this.events.push({ cycle: now + Math.round(e.t * this.clockHz), closed: e.closed });
    }
    this.base = 0;
  }

  /** Cycles of contact bounce so far (for display): how many times BTN0's level changed since the last reset. */
  get bounces(): number {
    return this.events.length;
  }

  // ---- What an analyser attached to the pins sees over the last `windowSeconds`.

  /** The window [c0, c1) in cycles ending now. */
  window(windowSeconds: number): { c0: number; c1: number } {
    const c1 = this.computer.machine.cycles;
    return { c0: Math.max(0, c1 - Math.round(windowSeconds * this.clockHz)), c1 };
  }
  /** BTN0's contact over the window: what an analyser clipped to the button's pin shows, bounce and all. */
  button(windowSeconds: number): Signal {
    const { c0, c1 } = this.window(windowSeconds);
    const s = makeSignal(this.button0(c0) ? 1 : 0, [], 0);
    for (const e of this.events) if (e.cycle > c0 && e.cycle < c1) setLevel(s, (e.cycle - c0) / this.clockHz, e.closed ? 1 : 0);
    return s;
  }
  led(bit: number, windowSeconds: number): Signal {
    const { c0, c1 } = this.window(windowSeconds);
    return bitSignal(this.computer.ledLog, bit, c0, Math.max(c1, c0 + 1), this.clockHz);
  }
  pwm(windowSeconds: number): Signal {
    const { c0, c1 } = this.window(windowSeconds);
    return pwmSignal(this.computer.pwmLog, c0, Math.max(c1, c0 + 1), this.clockHz);
  }
  dac(windowSeconds: number): { t: number[]; v: number[] } {
    const { c0, c1 } = this.window(windowSeconds);
    return dacTrace(this.computer.dacLog, c0, Math.max(c1, c0 + 1), this.clockHz);
  }
}
