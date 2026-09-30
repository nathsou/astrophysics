/**
 * The data behind Figure 32.1, the scaling explorer: real processors from 1971 to 2024, with the numbers the
 * chapter reasons about (transistors, process name, clock, die area, power) and the course's own designs on the
 * same axes.
 *
 * Every number carries a `source`, the key of an entry in `content/bibliography.yaml`, and the test checks that
 * the key exists. The figures are the ones the makers or the standard references give for the *launch* part;
 * where a chip was sold in many speeds the one named in `name` is meant. Power is thermal design power (TDP) or,
 * for the two chips of the 1990s, the datasheet's maximum, so power density is only good to a few tens of per cent:
 * enough to see a trend that spans a factor of a hundred.
 */

export type Family = 'x86' | 'other' | 'soc' | 'accelerator';
export type Metric = 'transistors' | 'node' | 'clock' | 'power' | 'powerDensity' | 'density';

export interface Chip {
  id: string;
  name: string;
  year: number;
  family: Family;
  /** Transistors on the die (whole package for a multi-die part, as the maker states it). */
  transistors: number;
  /** The process name in nanometres. From about 1997 it is a name, not a measurement (see `isNodeName`). */
  nodeNm?: number;
  /** Clock in MHz: the clock the chip was launched at, or its highest boost clock for a phone or laptop chip. */
  clockMHz?: number;
  areaMm2?: number;
  powerW?: number;
  /** Key in `content/bibliography.yaml`. */
  source: string;
  /** Further keys, for numbers the main source does not give. */
  extra?: string[];
  note?: string;
}

export const CHIPS: Chip[] = [
  { id: '4004', name: 'Intel 4004', year: 1971, family: 'x86', transistors: 2300, nodeNm: 10000, clockMHz: 0.74, areaMm2: 12, source: 'wiki-intel-4004', note: 'The first commercial microprocessor: 4 bits, 46 instructions.' },
  { id: '6502', name: 'MOS 6502', year: 1975, family: 'other', transistors: 3510, nodeNm: 8000, clockMHz: 1, source: 'visual6502', note: 'Counted from the netlist of the Visual 6502 project.' },
  { id: '8086', name: 'Intel 8086', year: 1978, family: 'x86', transistors: 29000, nodeNm: 3000, clockMHz: 5, source: 'wiki-intel-8086' },
  { id: '68000', name: 'Motorola 68000', year: 1979, family: 'other', transistors: 68000, nodeNm: 3500, clockMHz: 8, source: 'wiki-motorola-68000' },
  { id: '80286', name: 'Intel 80286', year: 1982, family: 'x86', transistors: 134000, nodeNm: 1500, clockMHz: 6, source: 'wiki-intel-80286' },
  { id: '80386', name: 'Intel 80386', year: 1985, family: 'x86', transistors: 275000, nodeNm: 1500, clockMHz: 16, source: 'wiki-i386' },
  { id: '80486', name: 'Intel 80486', year: 1989, family: 'x86', transistors: 1180000, nodeNm: 1000, clockMHz: 25, source: 'wiki-i486' },
  { id: 'alpha21064', name: 'DEC Alpha 21064', year: 1992, family: 'other', transistors: 1680000, nodeNm: 750, clockMHz: 200, areaMm2: 233.5, powerW: 30, source: 'wiki-alpha-21064' },
  { id: 'pentium', name: 'Intel Pentium (60 MHz)', year: 1993, family: 'x86', transistors: 3100000, nodeNm: 800, clockMHz: 60, areaMm2: 294, powerW: 14.6, source: 'wiki-pentium-original', note: 'Power is the datasheet maximum.' },
  { id: 'willamette', name: 'Pentium 4 (Willamette, 1.5 GHz)', year: 2000, family: 'x86', transistors: 42000000, nodeNm: 180, clockMHz: 1500, areaMm2: 217, powerW: 55, source: 'wiki-pentium-4' },
  { id: 'prescott', name: 'Pentium 4 (Prescott, 3.8 GHz)', year: 2004, family: 'x86', transistors: 125000000, nodeNm: 90, clockMHz: 3800, areaMm2: 112, powerW: 115, source: 'wiki-pentium-4', note: 'Intel’s fastest Pentium 4, the chip of Chapter 10’s history card.' },
  { id: 'conroe', name: 'Core 2 Duo E6700 (Conroe)', year: 2006, family: 'x86', transistors: 291000000, nodeNm: 65, clockMHz: 2660, areaMm2: 143, powerW: 65, source: 'wiki-conroe' },
  { id: 'i7-920', name: 'Core i7-920 (Bloomfield)', year: 2008, family: 'x86', transistors: 731000000, nodeNm: 45, clockMHz: 2660, areaMm2: 263, powerW: 130, source: 'wiki-bloomfield' },
  { id: 'i7-2600k', name: 'Core i7-2600K (Sandy Bridge)', year: 2011, family: 'x86', transistors: 1160000000, nodeNm: 32, clockMHz: 3400, areaMm2: 216, powerW: 95, source: 'wiki-sandy-bridge' },
  { id: 'i7-4770k', name: 'Core i7-4770K (Haswell)', year: 2013, family: 'x86', transistors: 1400000000, nodeNm: 22, clockMHz: 3500, areaMm2: 177, powerW: 84, source: 'wiki-haswell' },
  { id: 'a11', name: 'Apple A11 Bionic', year: 2017, family: 'soc', transistors: 4300000000, nodeNm: 10, clockMHz: 2390, areaMm2: 87.66, source: 'wiki-apple-a11' },
  { id: 'm1', name: 'Apple M1', year: 2020, family: 'soc', transistors: 16000000000, nodeNm: 5, clockMHz: 3200, areaMm2: 120.5, source: 'apple-m1', extra: ['wiki-apple-m1'] },
  { id: 'h100', name: 'NVIDIA H100 (GH100)', year: 2022, family: 'accelerator', transistors: 80000000000, nodeNm: 4, areaMm2: 814, powerW: 700, source: 'nvidia-hopper', extra: ['wiki-hopper'], note: 'The 700 W is the SXM module, which includes its memory stacks.' },
  { id: 'm2-ultra', name: 'Apple M2 Ultra', year: 2023, family: 'soc', transistors: 134000000000, nodeNm: 5, source: 'apple-m2-ultra', note: 'Two dies joined in one package.' },
  { id: 'wse3', name: 'Cerebras WSE-3', year: 2024, family: 'accelerator', transistors: 4000000000000, nodeNm: 5, areaMm2: 46225, source: 'cerebras-wse3', note: 'One chip the size of a whole wafer.' },
];

/**
 * The course's own designs, measured with the course's own tools (see `scaling.test.ts`). They have no year: the
 * figure draws them as horizontal lines and asks in which year the trend reached the same value.
 */
export interface Yours {
  id: string;
  name: string;
  /** Transistors of the design as gates. */
  transistors: number;
  clockMHz: number;
  /** How the numbers were obtained. */
  how: string;
  where: string;
}

/** Octet, gate by gate, with its 256 bytes of RAM: `costOfFlat` on `buildCpu({ control: 'hardwired', level: 'parts', memory: 'ram' })`. */
export const OCTET_TRANSISTORS = 24856;
/** The same without the RAM. */
export const OCTET_LOGIC_TRANSISTORS = 12568;
/** The RAM alone: 256 × 8 bits, 6 transistors a bit. */
export const OCTET_RAM_TRANSISTORS = 256 * 8 * 6;
/** The gate-level simulation of Chapter 22 runs with 1 ns gates and works with a half period of 40 ns. */
export const OCTET_CLOCK_MHZ = 12.5;

/** The RV32I core of Chapter 31, `content/designs/rv32i.dcl`, through the FPGA flow on vFPGA-L (a snapshot, 2026-09-30). */
export const RV32I_SNAPSHOT = { ands: 10420, flipFlops: 1089, cells: 4537, cellsOnDevice: 8192, fmaxMHz: 11.9 };

/** The cost model of `src/lib/sim/check/cost.ts`: an AND2 is 6 transistors, a D flip-flop 20. */
export function gateTransistors(ands: number, flipFlops: number): number {
  return ands * 6 + flipFlops * 20;
}

export const YOURS: Yours[] = [
  {
    id: 'octet',
    name: 'Octet (your CPU, with its 256 bytes)',
    transistors: OCTET_TRANSISTORS,
    clockMHz: OCTET_CLOCK_MHZ,
    how: 'Chapter 22’s gate-level Octet, counted with the cost model of gate golf; the clock is the fastest that the simulation runs correctly with 1 ns gates.',
    where: 'cpus-on-a-chip',
  },
  {
    id: 'rv32i',
    name: 'RV32I core (as gates, and on vFPGA-L)',
    transistors: gateTransistors(RV32I_SNAPSHOT.ands, RV32I_SNAPSHOT.flipFlops),
    clockMHz: RV32I_SNAPSHOT.fmaxMHz,
    how: 'The synthesised and-inverter graph counted at 6 transistors an AND and 20 a flip-flop; the clock is the fmax that the course’s timing analysis reports on vFPGA-L.',
    where: 'cpus-on-a-chip',
  },
];

export const METRICS: { id: Metric; label: string; unit: string; blurb: string }[] = [
  { id: 'transistors', label: 'Transistors', unit: '', blurb: 'Transistors on one chip.' },
  { id: 'node', label: 'Process name', unit: 'nm', blurb: 'The name of the manufacturing process, in nanometres (smaller is better).' },
  { id: 'clock', label: 'Clock', unit: 'MHz', blurb: 'The clock the chip was launched at.' },
  { id: 'power', label: 'Power', unit: 'W', blurb: 'Thermal design power (or the datasheet maximum) of the chip.' },
  { id: 'powerDensity', label: 'Power per cm²', unit: 'W/cm²', blurb: 'Power divided by die area: how hard the cooling has to work.' },
  { id: 'density', label: 'Transistors per mm²', unit: '/mm²', blurb: 'Transistors divided by die area: how tightly they are packed.' },
];

/** The value of a metric for a chip, or undefined if the chip lacks the numbers. */
export function valueOf(c: Chip, m: Metric): number | undefined {
  switch (m) {
    case 'transistors':
      return c.transistors;
    case 'node':
      return c.nodeNm;
    case 'clock':
      return c.clockMHz;
    case 'power':
      return c.powerW;
    case 'powerDensity':
      return c.powerW !== undefined && c.areaMm2 !== undefined ? c.powerW / (c.areaMm2 / 100) : undefined;
    case 'density':
      return c.areaMm2 !== undefined ? c.transistors / c.areaMm2 : undefined;
  }
}

export function points(m: Metric, chips: Chip[] = CHIPS): { chip: Chip; value: number }[] {
  const out: { chip: Chip; value: number }[] = [];
  for (const chip of chips) {
    const value = valueOf(chip, m);
    if (value !== undefined) out.push({ chip, value });
  }
  return out;
}

/** From about 1997 the process name is a label chosen by the maker, not a length on the die. */
export const NODE_NAME_YEAR = 1997;
export const isNodeName = (c: Chip) => c.year >= NODE_NAME_YEAR;

export interface Fit {
  /** log2(value) = intercept + slope × (year − 1971). */
  slope: number;
  intercept: number;
  /** Years for the quantity to double (Infinity if flat, negative if it halves). */
  doublingYears: number;
  r2: number;
  n: number;
}

/** Least-squares line through log2(value) against year: the "doubling time". */
export function fitTrend(pts: { chip: Chip; value: number }[]): Fit {
  const n = pts.length;
  const xs = pts.map((p) => p.chip.year - 1971);
  const ys = pts.map((p) => Math.log2(p.value));
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i]! - mx) ** 2;
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    syy += (ys[i]! - my) ** 2;
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  return { slope, intercept, doublingYears: slope === 0 ? Infinity : 1 / slope, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy), n };
}

export const fitValue = (f: Fit, year: number) => 2 ** (f.intercept + f.slope * (year - 1971));

/** The year in which a fitted trend reaches `value`. */
export const yearWhen = (f: Fit, value: number) => 1971 + (Math.log2(value) - f.intercept) / f.slope;

/** The reference line of the chapter: a doubling every two years, starting from the 4004. */
export const everyTwoYears = (year: number) => 2300 * 2 ** ((year - 1971) / 2);

/** Moore's forecast of 1965 (65,000 components by 1975 from about 64 in 1965: a doubling every year). */
export const moore1965 = (year: number) => 64 * 2 ** (year - 1965);

/** The largest of the chips whose year is at most `year`, by transistors. */
export function biggestBy(year: number, chips: Chip[] = CHIPS): Chip | undefined {
  return chips.filter((c) => c.year <= year).sort((a, b) => b.transistors - a.transistors)[0];
}

export function formatValue(v: number, m: Metric): string {
  const sig = (x: number, d = 3) => Number(x.toPrecision(d)).toString();
  if (m === 'transistors') {
    if (v >= 1e12) return `${sig(v / 1e12)} trillion`;
    if (v >= 1e9) return `${sig(v / 1e9)} billion`;
    if (v >= 1e6) return `${sig(v / 1e6)} million`;
    return Math.round(v).toLocaleString('en-GB');
  }
  if (m === 'node') return v >= 1000 ? `${sig(v / 1000)} µm` : `${sig(v)} nm`;
  if (m === 'clock') return v >= 1000 ? `${sig(v / 1000)} GHz` : v < 1 ? `${Math.round(v * 1000)} kHz` : `${sig(v)} MHz`;
  if (m === 'power') return `${sig(v)} W`;
  if (m === 'powerDensity') return `${sig(v)} W/cm²`;
  return v >= 1e6 ? `${sig(v / 1e6)} million/mm²` : v >= 1e3 ? `${sig(v / 1e3)} thousand/mm²` : `${sig(v)}/mm²`;
}
