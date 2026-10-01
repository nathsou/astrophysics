import { describe, expect, test } from 'vitest';
import { REAL_FORMAT, REAL_STRIDE, histogramReal, loadRealData, parseRealManifest, parseRealObjects, presetConfig, realManifestExists, recoObservables, type RealManifest } from './index.ts';

/** Rows: event, kind, pt, eta, phi, E, charge, iso. Two photons from a "125 GeV" decay at rest-ish kinematics, a muon pair, and an event with one photon only. */
function rows(): Float32Array {
  const m = 125;
  const photon = (ev: number, pt: number, eta: number, phi: number) => [ev, 2, pt, eta, phi, pt * Math.cosh(eta), 0, 0.05];
  const muon = (ev: number, pt: number, eta: number, phi: number, q: number) => [ev, 0, pt, eta, phi, pt * Math.cosh(eta), q, 0.01];
  // back-to-back photons at eta 0: m = 2 pt
  const pt = m / 2;
  return Float32Array.from([
    ...photon(0, pt, 0, 0.3), ...photon(0, pt, 0, 0.3 + Math.PI), [0, 4, 20, 0, 1.0, 0, 0, -1].flat(),
    ...muon(3, 45, 0.2, 0.1, -1), ...muon(3, 45, -0.2, 0.1 + Math.PI, 1),
    ...photon(7, 40, 0.5, 2),
  ].flat() as number[]);
}
const manifest = (over: Partial<RealManifest> = {}): RealManifest => ({
  name: 'higgs-gamgam', title: 'Test file', file: 'higgs-gamgam.f32', format: REAL_FORMAT, events: 3, rows: 8, sha256: '0'.repeat(64), sqrtS: 13000, luminosityFb: null,
  observables: ['mgg'], selection: 'none', source: { title: 'synthetic test data', record: 'none' }, licence: 'test only', prepared: '2026-10-01', ...over,
});

describe('the real-data loader contract', () => {
  test('objects are decoded into events with four-vectors, charge, isolation and missing pT', () => {
    const ev = parseRealObjects(rows().buffer as ArrayBuffer);
    expect(ev).toHaveLength(3);
    expect(ev[0]!.objects.map((o) => o.kind)).toEqual(['photon', 'photon']);
    expect(Math.hypot(ev[0]!.met.x, ev[0]!.met.y)).toBeCloseTo(20, 4);
    expect(ev[1]!.objects.map((o) => o.charge)).toEqual([-1, 1]);
    expect(ev[1]!.objects[0]!.isolation).toBeCloseTo(0.01, 6);
    expect(ev[0]!.objects[0]!.truth).toBe(-1);
    expect(rows().length % REAL_STRIDE).toBe(0);
    expect(() => parseRealObjects(new Float32Array(10).buffer)).toThrow(/multiple of 8/);
  });

  test('the same observables run on real events as on simulated ones: the diphoton mass of the first event is 125 GeV', () => {
    const ev = parseRealObjects(rows().buffer as ArrayBuffer);
    const cfg = presetConfig('higgs-gamgam');
    expect(recoObservables(ev[0]!, cfg.analysis.selection, ['mgg'])[0]!).toBeCloseTo(125, 3);
    expect(recoObservables(ev[2]!, cfg.analysis.selection, ['mgg'])[0]).toBeNull();
    const h = histogramReal(ev, cfg);
    expect(h.selected).toBe(1);
    expect(h.acc.counts.reduce((a, b) => a + b, 0)).toBe(1);
    expect(h.edges[0]).toBe(105);
  });

  test('manifest validation names the missing field and the unsupported format', () => {
    expect(parseRealManifest(manifest()).name).toBe('higgs-gamgam');
    const { licence: _l, ...noLicence } = manifest();
    void _l;
    expect(() => parseRealManifest(noLicence)).toThrow(/licence/);
    expect(() => parseRealManifest(manifest({ format: 'csv' }))).toThrow(/unsupported/);
    expect(() => parseRealManifest(null)).toThrow();
  });

  test('loading is 404-safe: no manifest means no real data, not an error, and nothing is invented', async () => {
    const notFound = (async () => new Response('', { status: 404 })) as typeof fetch;
    expect(await realManifestExists('', 'higgs-gamgam', notFound)).toBeNull();
    expect(await loadRealData('', 'higgs-gamgam', notFound)).toBeNull();
    const throwing = (async () => { throw new TypeError('offline'); }) as typeof fetch;
    expect(await loadRealData('', 'higgs-gamgam', throwing)).toBeNull();
    const badManifest = (async () => new Response(JSON.stringify({ name: 'x' }), { status: 200 })) as typeof fetch;
    expect(await loadRealData('', 'higgs-gamgam', badManifest)).toBeNull();
  });

  test('a manifest and its file load from <base>/data/real/', async () => {
    const urls: string[] = [];
    const bytes = rows();
    const ok = (async (url: string) => {
      urls.push(String(url));
      if (String(url).endsWith('.manifest.json')) return new Response(JSON.stringify(manifest()), { status: 200 });
      return new Response(bytes.buffer as ArrayBuffer, { status: 200 });
    }) as unknown as typeof fetch;
    const d = await loadRealData('/pp', 'higgs-gamgam', ok);
    expect(urls).toEqual(['/pp/data/real/higgs-gamgam.manifest.json', '/pp/data/real/higgs-gamgam.f32']);
    expect(d!.events).toHaveLength(3);
    expect(d!.manifest.licence).toBe('test only');
  });
});
