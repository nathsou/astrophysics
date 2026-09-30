import { describe, expect, test } from 'vitest';
import { DEFAULT_GATE, IMPLANT_DEPTH, K1_LIMIT, SCANNERS, SURFACE, WIDTH, buildSteps, layersOf, resolution } from './litho';

describe('the process steps', () => {
  const steps = buildSteps();
  const byId = (id: string) => steps.find((s) => s.id === id)!;

  test('eight steps, in the order of the text, each with a picture', () => {
    expect(steps.map((s) => s.id)).toEqual(['wafer', 'deposit', 'resist', 'expose', 'develop', 'etch', 'implant', 'metal']);
    for (const s of steps) {
      expect(s.layers.length).toBeGreaterThan(0);
      expect(s.text.length).toBeGreaterThan(60);
    }
  });
  test('every layer lies inside the picture and has positive size', () => {
    for (const s of steps) for (const l of s.layers) {
      expect(l.x1, s.id + l.kind).toBeGreaterThan(l.x0);
      expect(l.y1).toBeGreaterThan(l.y0);
      expect(l.x0).toBeGreaterThanOrEqual(0);
      expect(l.x1).toBeLessThanOrEqual(WIDTH);
      expect(l.y0).toBeGreaterThanOrEqual(0);
    }
  });
  test('the mask has chrome exactly where the gate will be, and only the shadowed resist survives development', () => {
    const chrome = layersOf(byId('expose'), 'chrome');
    expect(chrome).toHaveLength(1);
    expect([chrome[0]!.x0, chrome[0]!.x1]).toEqual([DEFAULT_GATE.x0, DEFAULT_GATE.x1]);
    const exposed = layersOf(byId('expose'), 'exposed');
    const kept = layersOf(byId('expose'), 'resist');
    expect(kept).toHaveLength(1);
    expect(kept[0]!.x0).toBe(chrome[0]!.x0);
    expect(kept[0]!.x1).toBe(chrome[0]!.x1);
    // exposed + kept tile the whole width without gaps or overlaps
    const all = [...exposed, ...kept].sort((a, b) => a.x0 - b.x0);
    expect(all[0]!.x0).toBe(0);
    expect(all[all.length - 1]!.x1).toBe(WIDTH);
    for (let i = 1; i < all.length; i++) expect(all[i]!.x0).toBe(all[i - 1]!.x1);
    expect(layersOf(byId('develop'), 'exposed')).toHaveLength(0);
    expect(layersOf(byId('develop'), 'resist')).toEqual(kept);
    expect(byId('expose').light).toBe(true);
    expect(byId('expose').mask).toBe(true);
  });
  test('after the etch, polysilicon and oxide remain only under the resist', () => {
    const s = byId('etch');
    for (const k of ['poly', 'oxide'] as const) {
      const l = layersOf(s, k);
      expect(l).toHaveLength(1);
      expect([l[0]!.x0, l[0]!.x1]).toEqual([DEFAULT_GATE.x0, DEFAULT_GATE.x1]);
    }
  });
  test('self-alignment: the implants end under the gate’s edges, for any position of the gate', () => {
    for (const g of [DEFAULT_GATE, { x0: 25, x1: 45 }, { x0: 55, x1: 80 }, { x0: 30, x1: 40 }]) {
      const s = buildSteps(g).find((x) => x.id === 'implant')!;
      const imp = layersOf(s, 'implant').sort((a, b) => a.x0 - b.x0);
      expect(imp).toHaveLength(2);
      // the channel is what remains between them: the anneal pushes each implant a little under the gate,
      // by the same amount on both sides
      const under = IMPLANT_DEPTH / 2;
      expect(imp[0]!.x1 - g.x0).toBe(under);
      expect(g.x1 - imp[1]!.x0).toBe(under);
      expect(imp[0]!.y0).toBe(SURFACE);
    }
  });
  test('the last step has metal reaching down to the source and the drain, and not to the gate', () => {
    const s = byId('metal');
    const contacts = layersOf(s, 'metal').filter((m) => m.y1 === SURFACE);
    expect(contacts).toHaveLength(2);
    const gate = layersOf(s, 'poly')[0]!;
    for (const c of contacts) expect(c.x1 <= gate.x0 || c.x0 >= gate.x1).toBe(true);
  });
});

describe('the Rayleigh equation', () => {
  test('resolution = k1 λ / NA', () => {
    expect(resolution(193, 1.35, 0.25)).toBeCloseTo(35.7, 1);
    expect(resolution(13.5, 0.33, 0.32)).toBeCloseTo(13.1, 1);
    expect(resolution(13.5, 0.55, 0.32)).toBeCloseTo(7.85, 1);
  });
  test('with k1 = 0.32 the EUV machines print the half-pitches ASML quotes: about 13 nm and about 8 nm', () => {
    const euv = SCANNERS.find((s) => s.id === 'euv')!;
    const hi = SCANNERS.find((s) => s.id === 'hina')!;
    expect(Math.round(resolution(euv.wavelengthNm, euv.na, 0.32))).toBe(13);
    expect(Math.round(resolution(hi.wavelengthNm, hi.na, 0.32))).toBe(8);
  });
  test('ArF immersion at the k1 limit prints 36 nm half-pitch lines with 193 nm light', () => {
    const s = SCANNERS.find((x) => x.id === 'arfi')!;
    expect(resolution(s.wavelengthNm, s.na, K1_LIMIT)).toBeGreaterThan(35);
    expect(resolution(s.wavelengthNm, s.na, K1_LIMIT)).toBeLessThan(37);
  });
  test('machines are listed from coarse to fine', () => {
    const res = SCANNERS.map((s) => resolution(s.wavelengthNm, s.na, 0.3));
    for (let i = 1; i < res.length; i++) expect(res[i]).toBeLessThan(res[i - 1]!);
  });
});
