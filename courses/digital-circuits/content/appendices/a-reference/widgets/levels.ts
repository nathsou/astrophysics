/**
 * Logic levels of common families, for Appendix A. Worst-case guaranteed values from the
 * manufacturers' data sheets and from the JEDEC interface standards; a real part is usually better,
 * so treat these as the numbers a design may rely on.
 */

export interface Family {
  id: string;
  name: string;
  /** Nominal supply for these numbers, volts. */
  vcc: number;
  /** Lowest input voltage guaranteed to be read as 1, volts. */
  vih: number;
  /** Highest input voltage guaranteed to be read as 0. */
  vil: number;
  /** Lowest output voltage of a 1 at the rated load (the figure to design with). */
  voh: number;
  /** Highest output voltage of a 0 at the rated load. */
  vol: number;
  /** The output currents at which `voh` and `vol` are guaranteed, milliamps. */
  ioh: number;
  iol: number;
  /** The levels with only CMOS inputs to drive (microamps of load): a 1 at least `vohLight`, a 0 at most `volLight`. */
  vohLight: number;
  volLight: number;
  /** The highest voltage an input may be taken to without damage risk (absolute maximum, rounded). */
  vinMax: number;
  where: string;
  note: string;
}

export const FAMILIES: Family[] = [
  {
    id: 'ttl',
    name: 'TTL (7400, 74LS)',
    vcc: 5,
    vih: 2.0,
    vil: 0.8,
    voh: 2.4,
    vol: 0.4,
    ioh: 0.4,
    iol: 8,
    vohLight: 2.4,
    volLight: 0.4,
    vinMax: 7,
    where: '1960s–80s logic; some old equipment',
    note: 'The numbers are for the 74LS series (output currents 0.4 mA high, 8 mA low). A TTL input passes about 0.4 mA when low, so TTL outputs are always loaded.',
  },
  {
    id: 'hc',
    name: '74HC',
    vcc: 5,
    vih: 3.5,
    vil: 1.5,
    voh: 3.84,
    vol: 0.33,
    ioh: 4,
    iol: 4,
    vohLight: 4.9,
    volLight: 0.1,
    vinMax: 5.5,
    where: 'the parts of the labs',
    note: 'The data sheet gives 4.5 V and 6 V: VIH = 3.15 V and 4.2 V, VIL = 1.35 V and 1.8 V, that is 70 % and 30 % of the supply. At 5 V the same rule gives 3.5 V and 1.5 V. Outputs: 4.4 V and 0.1 V at 20 µA; 3.84 V and 0.33 V at 4 mA (4.5 V, over −40 to 85 °C).',
  },
  {
    id: 'hct',
    name: '74HCT',
    vcc: 5,
    vih: 2.0,
    vil: 0.8,
    voh: 3.84,
    vol: 0.33,
    ioh: 4,
    iol: 4,
    vohLight: 4.9,
    volLight: 0.1,
    vinMax: 5.5,
    where: 'level shifting; driving HC from TTL or 3.3 V parts',
    note: 'CMOS inside and CMOS outputs, but TTL-compatible inputs: the input stage is redesigned to switch at about 1.4 V. Only specified for a 5 V supply.',
  },
  {
    id: 'lvcmos33',
    name: 'LVCMOS 3.3 V',
    vcc: 3.3,
    vih: 2.0,
    vil: 0.8,
    voh: 2.4,
    vol: 0.4,
    ioh: 2,
    iol: 2,
    vohLight: 3.1,
    volLight: 0.2,
    vinMax: 3.6,
    where: 'microcontrollers, FPGAs, memories, most modern I/O',
    note: 'JEDEC JESD8C: 2.0 V and 0.8 V inputs. Outputs: within 0.2 V of the rails at ±100 µA, 2.4 V and 0.4 V at a few milliamps (the older LVTTL figures). Some parts are 5 V tolerant; most are not.',
  },
  {
    id: 'lvcmos18',
    name: 'LVCMOS 1.8 V',
    vcc: 1.8,
    vih: 1.17,
    vil: 0.63,
    voh: 1.35,
    vol: 0.45,
    ioh: 2,
    iol: 2,
    vohLight: 1.6,
    volLight: 0.2,
    vinMax: 2.1,
    where: 'memory interfaces, low-power I/O',
    note: 'JEDEC JESD8-7A: 65 % and 35 % of the supply for inputs, VDD − 0.45 V and 0.45 V for outputs at 2 mA; within 0.2 V of the rails at ±100 µA.',
  },
];

export const family = (id: string): Family => {
  const f = FAMILIES.find((x) => x.id === id);
  if (!f) throw new Error(`no family ${id}`);
  return f;
};

export interface Link {
  /** Noise margin for a 1, driver VOH − receiver VIH, volts (negative: not read as a 1). */
  nmh: number;
  /** Noise margin for a 0, receiver VIL − driver VOL. */
  nml: number;
  /** The driver's high level is above what the receiver's input may see. */
  overvoltage: boolean;
  ok: boolean;
  /** One line for the reader. */
  verdict: string;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Can `driver` feed `receiver` directly? Uses the light-load output levels, which is right for CMOS
 * inputs (they take microamps) and, for TTL drivers, the only levels there are.
 */
export function link(driver: Family, receiver: Family): Link {
  const voh = driver.vohLight;
  const vol = driver.volLight;
  const nmh = r2(voh - receiver.vih);
  const nml = r2(receiver.vil - vol);
  const overvoltage = voh > receiver.vinMax;
  const ok = nmh > 0 && nml > 0 && !overvoltage;
  let verdict: string;
  if (overvoltage) verdict = `No: a ${voh} V output would exceed the ${receiver.vinMax} V an input may take.`;
  else if (nmh <= 0) verdict = `No: a 1 (at least ${voh} V) may be below the ${receiver.vih} V the receiver needs.`;
  else if (nml <= 0) verdict = `No: a 0 (at most ${vol} V) may be above the ${receiver.vil} V the receiver allows.`;
  else verdict = `Yes, with margins of ${nmh} V (1) and ${nml} V (0).`;
  return { nmh, nml, overvoltage, ok, verdict };
}
