/**
 * The flyback experiment: energise a relay coil, then open the switch that carries its current and
 * record the voltage at the coil's switched end. Used by the scope figure and its test.
 */
import type { Engine } from '$lib/sim/engine';
import { peakBetween } from './scope';

export interface FlybackTrace {
  /** Sample times in seconds relative to the moment the switch opened (negative: before it). */
  t: Float64Array;
  /** Voltage at the switched end of the coil (V, relative to ground). */
  v: Float64Array;
  /** Highest voltage after the switch opened. */
  peak: number;
  /** Warnings the engine gave (the relay reports a spike). */
  messages: string[];
}

/** Net of pin `pin` of element `id`. */
export function pinNet(e: Engine, id: string, pin: string): number {
  const el = e.netlist.elements.find((x) => x.id === id);
  const k = el?.pinNames.indexOf(pin) ?? -1;
  if (!el || k < 0) throw new Error(`no pin ${id}.${pin}`);
  return el.pins[k]!;
}

/** Let the coil reach full current, then open the switch `SW` and record. */
export function openSwitch(e: Engine, opts: { warm?: number; pre?: number; post?: number } = {}): FlybackTrace {
  const { warm = 0.03, pre = 1e-3, post = 0.02 } = opts;
  e.advance(warm);
  const net = pinNet(e, 'K1', 'B');
  const rec = e.watch([net]);
  e.advance(pre);
  const tOpen = e.time;
  const before = e.messages.length;
  e.setParam('SW', 'closed', false);
  e.advance(post);
  const t = rec.times().map((x) => x - tOpen);
  const v = rec.values()[0]!;
  rec.close();
  return { t, v, peak: peakBetween(t, v, 0, post), messages: e.messages.slice(before).map((m) => m.text) };
}

/** Put the switch back and let things settle, ready for another run. */
export function closeSwitch(e: Engine): void {
  e.setParam('SW', 'closed', true);
  e.advance(0.03);
}
