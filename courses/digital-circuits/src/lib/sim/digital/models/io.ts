import type { ElementState } from '../../engine';
import { X, Z, input, parseInit } from '../logic';
import { registerDigitalModel, TICKS_PER_SECOND, type DigitalModel, type DigitalSim, type ModelInit } from '../model';
import { outputSlot } from './gates';

/**
 * Inputs, outputs and supply rails.
 *
 * Sources drive their output with no delay. States:
 *  - toggle: `{ on, value }`; button: `{ pressed, value }`; const: `{ value }`; rail: `{ value }`.
 *  - rail: 1 when its voltage is positive, else 0.
 *  - clock: `{ value, frequency }`. The output is 0 at t = 0 and rises after (1 − duty) of a period
 *    (half a period at the default duty cycle), so the first rising edge comes at T/2 and later ones
 *    every T. Changing the frequency or duty cycle keeps the phase within the current period.
 *  - indicator (logic LED): `{ lit, brightness (0 or 1), value }`.
 *  - probe: `{ value }` (0, 1, 2 = X, 3 = Z).
 *  - seven-seg: `{ segments, unknown }`, segments a = bit 0 … dp = bit 7; X or Z segments are drawn
 *    off and set `unknown`.
 *  - hex-display: `{ value }`, 0–15, or undefined while any input is X or Z.
 */

const truthy = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';

/** A source whose value comes from one parameter. */
class Source implements DigitalModel {
  private readonly out: number;
  constructor(
    private readonly init: ModelInit,
    private readonly read: (params: Record<string, unknown>) => number,
    private readonly stateKey?: string,
  ) {
    this.out = outputSlot(init);
  }
  evaluate(sim: DigitalSim): void {
    sim.drive(this.out, this.read(this.init.element.params), 0);
  }
  state(sim: DigitalSim): ElementState {
    const value = this.read(this.init.element.params);
    const s: ElementState = { value: sim.output(this.out) };
    if (this.stateKey) s[this.stateKey] = value === 1;
    return s;
  }
}

const RISE = 1;
const FALL = 0;

class Clock implements DigitalModel {
  private readonly out: number;
  /** Time (ticks, fractional) at which the current train of periods started. */
  private origin = 0;
  private period = 0;
  private duty = 0.5;
  private level = 0;

  constructor(private readonly init: ModelInit) {
    this.out = outputSlot(init);
  }

  private read(): void {
    const f = Number(this.init.element.params.frequency);
    this.period = f > 0 && Number.isFinite(f) ? TICKS_PER_SECOND / f : 0;
    const d = Number(this.init.element.params.duty ?? 0.5);
    this.duty = Number.isFinite(d) ? Math.min(0.99, Math.max(0.01, d)) : 0.5;
  }

  reset(sim: DigitalSim): void {
    this.read();
    this.origin = 0;
    this.level = 0;
    sim.drive(this.out, 0, 0);
    this.schedule(sim);
  }

  /** Wake up at the next edge after now. */
  private schedule(sim: DigitalSim): void {
    const T = this.period;
    if (!(T > 0)) {
      sim.cancelWake(this.init.index);
      return;
    }
    const now = sim.now;
    const c = Math.floor((now - this.origin) / T);
    let best = Infinity;
    let tag = RISE;
    for (let k = c - 1; k <= c + 1; k++) {
      const rise = Math.round(this.origin + (k + 1 - this.duty) * T);
      const fall = Math.round(this.origin + (k + 1) * T);
      if (rise > now && rise < best) {
        best = rise;
        tag = RISE;
      }
      if (fall > now && fall < best) {
        best = fall;
        tag = FALL;
      }
    }
    sim.wakeAt(this.init.index, best - now, tag);
  }

  wake(sim: DigitalSim, tag: number): void {
    this.level = tag === RISE ? 1 : 0;
    sim.drive(this.out, this.level, 0);
    this.schedule(sim);
  }

  setParam(sim: DigitalSim, key: string): void {
    if (key !== 'frequency' && key !== 'duty') return;
    const oldT = this.period;
    const now = sim.now;
    // Where we are within the current period, from 0 to 1.
    let phase = oldT > 0 ? ((now - this.origin) / oldT) % 1 : this.level ? 1 - this.duty : 0;
    if (phase < 0) phase += 1;
    this.read();
    if (this.period > 0) {
      this.origin = now - phase * this.period;
      const level = phase >= 1 - this.duty ? 1 : 0;
      if (level !== this.level) {
        this.level = level;
        sim.drive(this.out, level, 0);
      }
    }
    this.schedule(sim);
  }

  state(sim: DigitalSim): ElementState {
    return { value: sim.output(this.out), frequency: Number(this.init.element.params.frequency) };
  }
}

/** Elements that only show their inputs: the state is read from the nets when asked. */
class Display implements DigitalModel {
  constructor(
    private readonly init: ModelInit,
    private readonly show: (values: number[]) => ElementState,
  ) {}
  state(sim: DigitalSim): ElementState {
    return this.show(Array.from(this.init.nets, (n) => sim.nets[n]!));
  }
}

registerDigitalModel('toggle', (init) => new Source(init, (p) => (truthy(p.on) ? 1 : 0), 'on'));
registerDigitalModel('button', (init) => new Source(init, (p) => (truthy(p.pressed) ? 1 : 0), 'pressed'));
registerDigitalModel('const', (init) => new Source(init, (p) => parseInit(p.value, 1)));
registerDigitalModel('clock', (init) => new Clock(init));
registerDigitalModel('rail', (init) => new Source(init, (p) => (Number(p.voltage ?? 5) > 0 ? 1 : 0)), { pinDirs: () => ['out'] });
// flatten() drops ground symbols, labels and ports (FlatNetlist.ground is driven 0 by the engine);
// these cover netlists built by hand that keep them.
registerDigitalModel('ground', (init) => new Source(init, () => 0), { pinDirs: () => ['out'] });
registerDigitalModel('label', () => ({}));
registerDigitalModel('port', () => ({}));

registerDigitalModel('indicator', (init) =>
  new Display(init, ([v]) => ({ lit: v === 1, brightness: v === 1 ? 1 : 0, value: v })),
);
registerDigitalModel('probe', (init) => new Display(init, ([v]) => ({ value: v ?? Z })));
registerDigitalModel('seven-seg', (init) =>
  new Display(init, (vs) => {
    let segments = 0;
    let unknown = false;
    vs.forEach((v, i) => {
      if (v === 1) segments |= 1 << i;
      else if (v !== 0) unknown = true;
    });
    return { segments, unknown };
  }),
);
registerDigitalModel('hex-display', (init) =>
  new Display(init, (vs) => {
    let value: number | undefined = 0;
    vs.forEach((v, i) => {
      if (value === undefined) return;
      if (input(v) === X) value = undefined;
      else value += v << i;
    });
    return { value };
  }),
);
