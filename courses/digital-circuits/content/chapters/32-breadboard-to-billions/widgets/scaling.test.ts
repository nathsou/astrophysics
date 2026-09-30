import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import YAML from 'yaml';
import '$lib/sim/netlist/catalog';
import { costOfFlat } from '$lib/sim/check/cost';
import { Rig } from '../../21-datapath/hardware/rig';
import { buildCpu } from '../../22-control/hardware/cpu';
import {
  CHIPS,
  METRICS,
  OCTET_LOGIC_TRANSISTORS,
  OCTET_RAM_TRANSISTORS,
  OCTET_TRANSISTORS,
  RV32I_SNAPSHOT,
  YOURS,
  biggestBy,
  everyTwoYears,
  fitTrend,
  fitValue,
  formatValue,
  gateTransistors,
  isNodeName,
  moore1965,
  points,
  valueOf,
  yearWhen,
} from './scaling';

const bib = YAML.parse(readFileSync(new URL('../../../bibliography.yaml', import.meta.url), 'utf8')) as Record<string, { title: string; url?: string; year: unknown }>;

describe('the data', () => {
  test('every chip cites sources that exist in the bibliography', () => {
    for (const c of CHIPS) {
      for (const k of [c.source, ...(c.extra ?? [])]) expect(bib[k], `${c.id}: ${k}`).toBeDefined();
    }
  });
  test('ids are unique, years run in order, and every chip has a transistor count', () => {
    expect(new Set(CHIPS.map((c) => c.id)).size).toBe(CHIPS.length);
    for (let i = 1; i < CHIPS.length; i++) expect(CHIPS[i]!.year, CHIPS[i]!.id).toBeGreaterThanOrEqual(CHIPS[i - 1]!.year);
    for (const c of CHIPS) expect(c.transistors).toBeGreaterThan(1000);
  });
  test('the headline numbers are the ones the chapter quotes', () => {
    const by = (id: string) => CHIPS.find((c) => c.id === id)!;
    expect(by('4004')).toMatchObject({ transistors: 2300, year: 1971, nodeNm: 10000, clockMHz: 0.74 });
    expect(by('m2-ultra').transistors).toBe(134e9);
    expect(by('prescott')).toMatchObject({ clockMHz: 3800, powerW: 115, areaMm2: 112 });
    expect(by('wse3').transistors).toBe(4e12);
  });
  test('Octet against the 4004: 58 million times the transistors, about 26 doublings, one every two years', () => {
    const ratio = 134e9 / 2300;
    expect(ratio).toBeGreaterThan(5.8e7);
    expect(ratio).toBeLessThan(5.9e7);
    expect(Math.log2(ratio)).toBeCloseTo(25.8, 1);
    expect((2023 - 1971) / Math.log2(ratio)).toBeCloseTo(2.0, 1);
  });
  test('every metric has at least six chips with data, and the units formatter never says NaN', () => {
    for (const m of METRICS) {
      const pts = points(m.id);
      expect(pts.length, m.id).toBeGreaterThanOrEqual(6);
      for (const p of pts) expect(formatValue(p.value, m.id)).not.toMatch(/NaN|undefined/);
    }
  });
  test('formatting', () => {
    expect(formatValue(2300, 'transistors')).toBe('2,300');
    expect(formatValue(1.34e11, 'transistors')).toBe('134 billion');
    expect(formatValue(4e12, 'transistors')).toBe('4 trillion');
    expect(formatValue(10000, 'node')).toBe('10 µm');
    expect(formatValue(0.74, 'clock')).toBe('740 kHz');
    expect(formatValue(3800, 'clock')).toBe('3.8 GHz');
  });
  test('the process name stops being a length in 1997', () => {
    expect(isNodeName(CHIPS.find((c) => c.id === 'pentium')!)).toBe(false);
    expect(isNodeName(CHIPS.find((c) => c.id === 'willamette')!)).toBe(true);
  });
});

describe('trends', () => {
  const t = fitTrend(points('transistors'));
  test('transistors double about every two years (Moore’s revised law), with a very good fit', () => {
    expect(t.doublingYears).toBeGreaterThan(1.8);
    expect(t.doublingYears).toBeLessThan(2.3);
    expect(t.r2).toBeGreaterThan(0.97);
  });
  test('the line from the 4004 lands on the biggest chips of today', () => {
    expect(everyTwoYears(1971)).toBe(2300);
    const ratio = everyTwoYears(2023) / 134e9;
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(2);
    expect(everyTwoYears(2022) / 80e9).toBeGreaterThan(0.5);
    expect(everyTwoYears(2022) / 80e9).toBeLessThan(2);
  });
  test('the fit and its inverse agree', () => {
    for (const y of [1975, 1990, 2010]) expect(yearWhen(t, fitValue(t, y))).toBeCloseTo(y, 6);
  });
  test('Moore’s forecast of 1965: 64 components then, about 65,000 in 1975', () => {
    expect(moore1965(1965)).toBe(64);
    expect(moore1965(1975)).toBe(65536);
  });
  test('clock: rises about 30 % a year until 2004, then almost stops', () => {
    const before = fitTrend(points('clock').filter((p) => p.chip.year <= 2004));
    expect(2 ** before.slope).toBeGreaterThan(1.25);
    expect(2 ** before.slope).toBeLessThan(1.45);
    const after = points('clock').filter((p) => p.chip.year > 2004);
    expect(after.length).toBeGreaterThanOrEqual(5);
    for (const p of after) expect(p.value, p.chip.id).toBeLessThan(4000);
    expect(Math.max(...after.map((p) => p.value))).toBeLessThan(1.1 * 3800);
  });
  test('power density: about 100 W/cm² at Prescott, a peak that no later chip reaches', () => {
    const pd = points('powerDensity');
    const top = pd.reduce((a, b) => (b.value > a.value ? b : a));
    expect(top.chip.id).toBe('prescott');
    expect(top.value).toBeGreaterThan(100);
    expect(top.value).toBeLessThan(107);
    for (const p of pd.filter((q) => q.chip.year > 2004)) expect(p.value, p.chip.id).toBeLessThan(0.9 * top.value);
    const early = pd.filter((q) => q.chip.year <= 1993);
    for (const p of early) expect(p.value).toBeLessThan(15);
  });
  test('the process name falls by about 30 % every two years, on the way to 4 nm', () => {
    const f = fitTrend(points('node'));
    expect(f.doublingYears).toBeLessThan(0);
    const halving = -f.doublingYears;
    expect(halving).toBeGreaterThan(3);
    expect(halving).toBeLessThan(5.5);
  });
  test('density: transistors per mm² rise faster than the process name alone suggests', () => {
    expect(valueOf(CHIPS.find((c) => c.id === 'a11')!, 'density')).toBeCloseTo(4.3e9 / 87.66, 0);
    const f = fitTrend(points('density'));
    expect(f.doublingYears).toBeGreaterThan(1.5);
    expect(f.doublingYears).toBeLessThan(3);
  });
  test('biggestBy', () => {
    expect(biggestBy(1980)?.id).toBe('68000');
    expect(biggestBy(2024)?.id).toBe('wse3');
  });
});

describe('the course’s designs on the same axes', () => {
  test('Octet: the numbers of the chapter match a gate-level count of the real circuit', () => {
    const cost = (memory: 'ram' | 'external') => costOfFlat(new Rig(buildCpu({ control: 'hardwired', level: 'parts', memory })).flat);
    const withRam = cost('ram');
    const logic = cost('external');
    expect(withRam.transistors).toBe(OCTET_TRANSISTORS);
    expect(logic.transistors).toBe(OCTET_LOGIC_TRANSISTORS);
    expect(OCTET_TRANSISTORS - OCTET_LOGIC_TRANSISTORS).toBe(OCTET_RAM_TRANSISTORS);
    expect(OCTET_RAM_TRANSISTORS).toBe(12288);
  }, 60_000);
  test('the RV32I estimate follows the cost model: 6 an AND, 20 a flip-flop', () => {
    expect(gateTransistors(10, 2)).toBe(100);
    const est = gateTransistors(RV32I_SNAPSHOT.ands, RV32I_SNAPSHOT.flipFlops);
    expect(est).toBeGreaterThan(68000);
    expect(est).toBeLessThan(100000);
    expect(YOURS.find((y) => y.id === 'rv32i')!.transistors).toBe(est);
    expect(RV32I_SNAPSHOT.cells).toBeLessThan(RV32I_SNAPSHOT.cellsOnDevice);
  });
  test('Octet is as big as a mid-1970s to late-1970s chip by the fitted trend; the RV32I core is a 68000', () => {
    const f = fitTrend(points('transistors'));
    const octet = yearWhen(f, OCTET_TRANSISTORS);
    expect(octet).toBeGreaterThan(1976);
    expect(octet).toBeLessThan(1982);
    const logic = yearWhen(f, OCTET_LOGIC_TRANSISTORS);
    expect(logic).toBeGreaterThan(1973);
    expect(logic).toBeLessThan(1979);
    const rv = yearWhen(f, YOURS[1]!.transistors);
    expect(rv).toBeGreaterThan(1979);
    expect(rv).toBeLessThan(1984);
    // ...and against actual chips: more than a 6502 and an 8086, fewer than an 80286.
    expect(OCTET_LOGIC_TRANSISTORS).toBeGreaterThan(CHIPS.find((c) => c.id === '6502')!.transistors);
    expect(OCTET_TRANSISTORS).toBeLessThan(CHIPS.find((c) => c.id === '8086')!.transistors);
    expect(YOURS[1]!.transistors).toBeGreaterThan(CHIPS.find((c) => c.id === '68000')!.transistors);
    expect(YOURS[1]!.transistors).toBeLessThan(CHIPS.find((c) => c.id === '80286')!.transistors);
  });
  test('clocks: both designs run at about 12 MHz, a 300th of a modern chip’s clock', () => {
    for (const y of YOURS) {
      expect(y.clockMHz).toBeGreaterThan(10);
      expect(y.clockMHz).toBeLessThan(13);
    }
    expect(3800 / YOURS[0]!.clockMHz).toBeGreaterThan(250);
  });
});
