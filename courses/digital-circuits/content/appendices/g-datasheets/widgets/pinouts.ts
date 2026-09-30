/**
 * Pin data for Appendix G's package drawings, taken from the device models (never typed in by hand):
 * the GAL22V10's 24 pins from `pld/devices/gal22v10.ts`, and the functional symbols of the vPROM, vPLA and
 * vCPLD-32 from their models.
 */
import { CLOCK_PIN, GND_PIN, INPUT_PINS, OLMC_PINS, PINS, PRODUCT_TERMS, VCC_PIN } from '$lib/pld/devices/gal22v10';
import { defaultAddressNames, defaultDataNames, VPROM_ADDRESS_BITS, VPROM_WIDTH } from '$lib/pld/devices/prom';
import { Pla, VPLA_SIZE } from '$lib/pld/devices/pla';
import { IO_PINS } from '$lib/pld/devices/vcpld32-arch';

export type Role = 'in' | 'out' | 'io' | 'clock' | 'power' | 'ground' | 'control';

export interface Pin {
  /** Pin number in a package (absent for a functional symbol). */
  number?: number;
  name: string;
  role: Role;
  note: string;
  /** Active low: drawn with an overbar. */
  low?: boolean;
}

/** The GAL22V10 in its 24-pin DIP, pin 1 first. */
export function galPins(): Pin[] {
  const pins: Pin[] = [];
  for (let n = 1; n <= PINS; n++) {
    if (n === CLOCK_PIN) pins.push({ number: n, name: 'CLK/I', role: 'clock', note: 'Clock of every registered macrocell, and an input to the AND array' });
    else if (n === GND_PIN) pins.push({ number: n, name: 'GND', role: 'ground', note: 'Ground' });
    else if (n === VCC_PIN) pins.push({ number: n, name: 'VCC', role: 'power', note: 'Supply' });
    else if ((INPUT_PINS as readonly number[]).includes(n)) pins.push({ number: n, name: 'I', role: 'in', note: 'Input to the AND array' });
    else if ((OLMC_PINS as readonly number[]).includes(n))
      pins.push({ number: n, name: 'I/O/Q', role: 'io', note: `Output macrocell with ${PRODUCT_TERMS[n]} product terms; input through its feedback when its output enable is off` });
  }
  return pins;
}

/** A functional symbol: signals on the sides of a box. */
export interface SymbolSpec {
  title: string;
  left: Pin[];
  right: Pin[];
  top: Pin[];
  bottom: Pin[];
}

export function promSymbol(): SymbolSpec {
  return {
    title: 'vPROM',
    left: defaultAddressNames(VPROM_ADDRESS_BITS).map((name) => ({ name, role: 'in' as const, note: 'Address' })),
    right: defaultDataNames(VPROM_WIDTH).map((name) => ({ name, role: 'out' as const, note: 'Data' })),
    top: [],
    bottom: [],
  };
}

export function plaSymbol(): SymbolSpec {
  const pla = new Pla();
  return {
    title: 'vPLA',
    left: pla.inputNames.map((name) => ({ name, role: 'in' as const, note: 'Input' })),
    right: pla.outputNames.map((name) => ({ name, role: 'out' as const, note: 'Output' })),
    top: [],
    bottom: [],
  };
}

export function cpldSymbol(): SymbolSpec {
  const io = (i: number): Pin => ({ name: `IO${i}`, role: 'io', note: `Pad of macrocell ${i}, in function block ${i >> 3}` });
  return {
    title: 'vCPLD-32',
    left: Array.from({ length: IO_PINS / 2 }, (_, i) => io(i)),
    right: Array.from({ length: IO_PINS / 2 }, (_, i) => io(IO_PINS / 2 + i)),
    top: [
      { name: 'GCLK', role: 'clock', note: 'Global clock' },
      { name: 'GSR', role: 'control', note: 'Global set/reset' },
      { name: 'GOE', role: 'control', note: 'Global output enable' },
    ],
    bottom: [
      { name: 'TCK', role: 'clock', note: 'JTAG clock' },
      { name: 'TMS', role: 'control', note: 'JTAG mode select' },
      { name: 'TDI', role: 'in', note: 'JTAG data in' },
      { name: 'TDO', role: 'out', note: 'JTAG data out' },
    ],
  };
}

export { VPLA_SIZE };
