/**
 * A successive-approximation ADC: a comparator, an R-2R DAC and a register that does a binary search.
 *
 * The analogue half is real: `buildSar` makes the netlist of an n-bit R-2R ladder driven by n logic outputs, a comparator that
 * compares the unknown input Vin with the ladder's output, and a supply that plays the unknown input, and the analogue engine
 * solves it every time the search sets a bit. The digital half, the search itself, is a dozen lines (`search`): try the top
 * bit; if the input is still above the DAC, keep it; move to the next bit.
 */
import '$lib/sim/netlist/catalog';
import { createAnalogEngine, type AnalogEngine } from '$lib/sim/analog';
import { NetlistBuilder } from '$lib/sim/digital';
import type { FlatNetlist } from '$lib/sim/netlist/types';

export const VREF = 5;

/** An n-bit R-2R DAC (bits driven by toggles B0…B(n−1), 5 V when on), a comparator K1 and a supply VIN as the unknown input. */
export function buildSar(bits: number, R = 1000): FlatNetlist {
  const b = new NetlistBuilder();
  const gnd = b.ground();
  const vin = b.net('VIN');
  const dac = b.net('DAC');
  const cmp = b.net('CMP');
  const nodes = Array.from({ length: bits }, (_, k) => (k === bits - 1 ? dac : b.net(`N${k}`)));
  // The terminating 2R at the LSB end.
  b.add('resistor', 'Rt', { '1': nodes[0]!, '2': gnd }, { resistance: 2 * R });
  for (let k = 0; k < bits; k++) {
    if (k < bits - 1) b.add('resistor', `R${k}`, { '1': nodes[k]!, '2': nodes[k + 1]! }, { resistance: R });
    const sw = b.net(`S${k}`);
    b.add('toggle', `B${k}`, { Y: sw });
    b.add('resistor', `S${k}r`, { '1': sw, '2': nodes[k]! }, { resistance: 2 * R });
  }
  b.add('supply', 'VIN', { '-': gnd, '+': vin }, { voltage: 0, limit: 1 });
  b.add('comparator', 'K1', { '+': vin, '-': dac, Y: cmp });
  return b.build();
}

/** The analogue half of the converter, as a small interface. */
export class SarBench {
  readonly engine: AnalogEngine;
  private readonly dac: number;
  constructor(readonly bits: number) {
    const flat = buildSar(bits);
    this.engine = createAnalogEngine(flat);
    this.dac = flat.netNames.indexOf('DAC');
  }
  setVin(v: number): void {
    this.engine.setParam('VIN', 'voltage', v);
  }
  /** Put a code on the DAC, let it settle, and read the DAC's voltage and the comparator (1 when Vin is above the DAC). */
  setCode(code: number): { vdac: number; above: boolean } {
    for (let i = 0; i < this.bits; i++) this.engine.setParam(`B${i}`, 'on', !!((code >> i) & 1));
    const end = this.engine.time + 2e-6;
    while (this.engine.time < end - 1e-12) this.engine.advance(end - this.engine.time);
    return { vdac: this.engine.voltage(this.dac), above: Number(this.engine.state('K1').value) === 1 };
  }
}

export interface SarStep {
  /** Which bit is being tried (bits − 1 first). */
  bit: number;
  /** The code on the DAC: the bits decided so far, plus this one. */
  trial: number;
  vdac: number;
  /** The comparator: Vin is above the DAC. */
  above: boolean;
  /** The register after this step. */
  result: number;
}

/** The binary search. `test` puts a code on the DAC and says whether Vin is above it. */
export function search(bits: number, test: (code: number) => { vdac: number; above: boolean }): SarStep[] {
  const steps: SarStep[] = [];
  let result = 0;
  for (let bit = bits - 1; bit >= 0; bit--) {
    const trial = result | (1 << bit);
    const { vdac, above } = test(trial);
    if (above) result = trial;
    steps.push({ bit, trial, vdac, above, result });
  }
  return steps;
}

/** What an ideal converter gives: the number of whole steps of Vref / 2^n below Vin. */
export const idealCode = (vin: number, bits: number) => Math.max(0, Math.min((1 << bits) - 1, Math.floor((vin / VREF) * (1 << bits))));
