import { describe, expect, it } from 'vitest';
import { defaultGeometry } from './geometry.ts';
import { HL_DIM, HL_NORMAL, HL_PRIMARY, HL_RELATED, buildScene, highlightStates, listObjects, relatedObjects, truthKeysOf } from './scene.ts';
import { inspect, describeEvent, formatGeV, linkLabel } from './inspect.ts';
import { sampleEvent } from './sampleEvents.ts';
import { defaultColours } from '../theme/particles.ts';
import { RecordWriter, buildCones, buildPoints, buildSegments, buildTowers, CONE_STRIDE, POINT_STRIDE, SEG_STRIDE, TOWER_STRIDE, lineColour, type RenderOptions } from './glData.ts';
import { ptColour, ptFraction } from './colour.ts';
import { drawLego, legoModel } from './draw2d.ts';
import { Camera } from './camera.ts';

const zmm = buildScene(sampleEvent('zmumu', { seed: 3 }), defaultGeometry);
const dijet = buildScene(sampleEvent('dijet', { seed: 1 }), defaultGeometry);
const opts: RenderOptions = { colourBy: 'particle', showTruth: true, showReco: true, showHits: true, showCalo: true, palette: defaultColours('dark') };

describe('scene objects and links', () => {
  it('has unique keys and ids equal to indices', () => {
    const keys = new Set(zmm.objects.map((o) => o.key));
    expect(keys.size).toBe(zmm.objects.length);
    zmm.objects.forEach((o, i) => {
      expect(o.id).toBe(i);
      expect(zmm.byKey.get(o.key)).toBe(i);
    });
  });
  it('links are symmetric', () => {
    for (const s of [zmm, dijet]) for (const o of s.objects) for (const l of o.links) expect(s.objects[l]!.links).toContain(o.id);
  });
  it('a reconstructed muon links to its track, its truth muon and nothing else of the wrong kind', () => {
    const mu = listObjects(zmm, 'object').find((o) => o.kind === 'muon')!;
    const cats = mu.links.map((l) => zmm.objects[l]!.cat).sort();
    expect(cats).toContain('track');
    expect(cats).toContain('truth');
    const tr = mu.links.map((l) => zmm.objects[l]!).find((o) => o.cat === 'truth')!;
    expect(Math.abs(zmm.event.truth!.particles[tr.index]!.pdg)).toBe(13);
  });
  it('a truth particle links to its mothers, daughters and reco matches', () => {
    const z = zmm.objects.find((o) => o.cat === 'truth' && zmm.event.truth!.particles[o.index]!.pdg === 23)!;
    const daughters = z.links.filter((l) => zmm.objects[l]!.cat === 'truth');
    expect(daughters.length).toBeGreaterThanOrEqual(4); // two muons and two beams
    const muTruth = zmm.objects.find((o) => o.cat === 'truth' && Math.abs(zmm.event.truth!.particles[o.index]!.pdg) === 13)!;
    expect(muTruth.links.some((l) => zmm.objects[l]!.cat === 'object')).toBe(true);
    expect(muTruth.links.some((l) => zmm.objects[l]!.cat === 'track')).toBe(true);
  });
  it('truthKeysOf returns the truth particle of a reco object', () => {
    const mu = listObjects(zmm, 'object').find((o) => o.kind === 'muon')!;
    const keys = truthKeysOf(zmm, mu.id);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^truth:\d+$/);
    expect(truthKeysOf(zmm, zmm.byKey.get(keys[0]!)!)).toEqual(keys);
  });
  it('objects are listed by descending pT', () => {
    const t = listObjects(zmm, 'track').map((o) => o.pt);
    for (let i = 1; i < t.length; i++) expect(t[i]!).toBeLessThanOrEqual(t[i - 1]!);
  });
});

describe('highlighting', () => {
  it('nothing selected: all normal', () => {
    expect([...highlightStates(zmm, null)].every((s) => s === HL_NORMAL)).toBe(true);
    expect([...highlightStates(zmm, 'nonexistent')].every((s) => s === HL_NORMAL)).toBe(true);
  });
  it('a selected muon is primary, its track and truth are related, the rest dimmed', () => {
    const mu = listObjects(zmm, 'object').find((o) => o.kind === 'muon')!;
    const st = highlightStates(zmm, mu.key);
    expect(st[mu.id]).toBe(HL_PRIMARY);
    for (const l of mu.links) expect(st[l]).toBe(HL_RELATED);
    const other = listObjects(zmm, 'object').filter((o) => o.kind === 'muon')[1]!;
    expect(st[other.id]).toBe(HL_DIM);
  });
  it('selecting a truth particle highlights the track and object built from it (second hop)', () => {
    const mu = listObjects(zmm, 'object').find((o) => o.kind === 'muon')!;
    const truthId = mu.links.find((l) => zmm.objects[l]!.cat === 'truth')!;
    const rel = relatedObjects(zmm, truthId);
    expect(rel.has(mu.id)).toBe(true);
    const track = mu.links.find((l) => zmm.objects[l]!.cat === 'track')!;
    expect(rel.has(track)).toBe(true);
  });
  it('selecting one truth particle does not highlight an unrelated truth particle', () => {
    const mus = zmm.objects.filter((o) => o.cat === 'truth' && Math.abs(zmm.event.truth!.particles[o.index]!.pdg) === 13);
    const rel = relatedObjects(zmm, mus[0]!.id);
    expect(rel.has(mus[1]!.id)).toBe(false);
  });
  it('reuses the provided array', () => {
    const buf = new Uint8Array(zmm.objects.length);
    expect(highlightStates(zmm, 'met', buf)).toBe(buf);
  });
});

describe('drawing primitives', () => {
  it('reco tracks of muons run out to the muon stations, others end at the ECAL', () => {
    const last = defaultGeometry.muon[defaultGeometry.muon.length - 1]!;
    let muons = 0;
    for (const pl of zmm.polylines) {
      if (pl.layer !== 'reco') continue;
      const n = pl.points.length / 3;
      const r = Math.hypot(pl.points[3 * (n - 1)]!, pl.points[3 * (n - 1) + 1]!);
      const z = Math.abs(pl.points[3 * (n - 1) + 2]!);
      if (pl.kind === 'muon') {
        muons++;
        expect(r > last.r - 5 || z > last.halfLength - 5).toBe(true);
      } else {
        expect(r <= defaultGeometry.ecal.rIn + 1 || z <= defaultGeometry.ecal.halfLength + 1).toBe(true);
      }
    }
    expect(muons).toBe(2);
  });
  it('truth photons are wavy, neutrinos dotted, muons solid and thick', () => {
    const w = buildScene(sampleEvent('wenu', { seed: 2 }), defaultGeometry);
    const kinds = new Map(w.polylines.filter((p) => p.layer === 'truth').map((p) => [p.kind, p.line] as const));
    expect(kinds.get('neutrino')).toBe('dotted');
    expect(kinds.get('photon')).toBe('wavy');
    expect(kinds.get('electron')).toBe('solid');
    const m = zmm.polylines.find((p) => p.kind === 'muon')!;
    const h = zmm.polylines.find((p) => p.kind === 'hadron')!;
    expect(m.width).toBeGreaterThan(h.width * 2);
  });
  it('towers start on their calorimeter face and are as tall as their energy', () => {
    for (const t of dijet.towers) {
      expect(t.t1).toBeGreaterThan(t.t0);
      const shell = t.calo === 'ecal' ? defaultGeometry.ecal : defaultGeometry.hcal;
      const ch = Math.cosh(t.eta);
      const r0 = t.t0 / ch, z0 = Math.abs(t.t0 * Math.tanh(t.eta));
      expect(r0 <= shell.rIn + 0.5 && z0 <= shell.halfLength + 0.5).toBe(true);
      expect(t.t1 - t.t0).toBeCloseTo(Math.max(6, t.energy * dijet.energyScale), 6);
    }
    expect(dijet.towers.length).toBeGreaterThan(20);
  });
  it('a jet cone per reco jet, with opening angle 0.4 / cosh η', () => {
    const jets = dijet.event.reco.objects.filter((o) => o.kind === 'jet');
    expect(dijet.cones).toHaveLength(jets.length);
    for (const c of dijet.cones) expect(c.tanHalf).toBeCloseTo(0.4 / Math.cosh(c.eta), 12);
  });
  it('the missing-pT arrow points along the MET vector', () => {
    const w = buildScene(sampleEvent('wenu', { seed: 2 }), defaultGeometry);
    expect(w.met).not.toBeNull();
    expect(w.met!.phi).toBeCloseTo(Math.atan2(w.event.reco.met.y, w.event.reco.met.x), 12);
  });
  it('hits are owned by the tracks that contain them', () => {
    const t = zmm.event.reco.tracks[0]!;
    const obj = zmm.byKey.get('track:0')!;
    for (const h of t.hits) expect(zmm.hits.owner[h]).toBe(obj);
  });
  it('an event with no detector still draws tracks and clusters (real data)', () => {
    const e = sampleEvent('dijet', { seed: 1 });
    const real = { reco: e.reco, weight: 1 };
    const s = buildScene(real, defaultGeometry);
    expect(s.hits.count).toBe(0);
    expect(s.towers.length).toBe(e.reco.clusters.length);
    expect(s.polylines.length).toBeGreaterThan(5);
    expect(s.hasTruth).toBe(false);
  });
});

describe('inspector content', () => {
  it('describes a reconstructed muon with its truth match and tracks', () => {
    const mu = listObjects(zmm, 'object').find((o) => o.kind === 'muon')!;
    const i = inspect(zmm, mu.id)!;
    expect(i.rows.map((r) => r.label)).toEqual(expect.arrayContaining(['pT', 'η', 'φ', 'charge', 'mass']));
    const labels = i.groups.map((g) => g.label);
    expect(labels).toContain('Truth match');
    expect(labels).toContain('Built from tracks');
    expect(i.rows.find((r) => r.label === 'mass')!.value).toMatch(/MeV/);
  });
  it('describes a truth particle with its name, mothers and daughters', () => {
    const z = zmm.objects.find((o) => o.cat === 'truth' && zmm.event.truth!.particles[o.index]!.pdg === 23)!;
    const i = inspect(zmm, z.id)!;
    expect(i.title).toContain('Z');
    expect(i.groups.map((g) => g.label)).toEqual(expect.arrayContaining(['Mothers', 'Daughters']));
    expect(i.rows.find((r) => r.label === 'mass')!.value).toMatch(/GeV/);
  });
  it('describes every object without throwing', () => {
    for (const s of [zmm, dijet]) for (const o of s.objects) expect(inspect(s, o.id)).not.toBeNull();
    expect(inspect(zmm, 99999)).toBeNull();
  });
  it('formats energies and summarises the event', () => {
    expect(formatGeV(0.000511)).toBe('511 keV');
    expect(formatGeV(45.25)).toBe('45.3 GeV');
    expect(formatGeV(13000)).toBe('13 TeV');
    expect(describeEvent(zmm)).toMatch(/2 muons/);
    expect(linkLabel(zmm, 0)).toBeTruthy();
  });
});

describe('render data', () => {
  it('builds finite segment records with valid object ids', () => {
    const w = buildSegments(dijet, opts);
    expect(w.stride).toBe(SEG_STRIDE);
    expect(w.count).toBeGreaterThan(1000);
    const d = w.view();
    expect(d.length).toBe(w.count * SEG_STRIDE);
    for (let i = 0; i < d.length; i++) expect(Number.isFinite(d[i]!)).toBe(true);
    for (let i = 0; i < w.count; i++) {
      const id = d[i * SEG_STRIDE + 13]!;
      expect(id === -1 || (id >= 0 && id < dijet.objects.length && Number.isInteger(id))).toBe(true);
    }
  });
  it('hides what the options hide', () => {
    const all = buildSegments(dijet, opts).count;
    const noTruth = buildSegments(dijet, { ...opts, showTruth: false }).count;
    const noReco = buildSegments(dijet, { ...opts, showReco: false, showTruth: false }).count;
    expect(noTruth).toBeLessThan(all);
    expect(noReco).toBeLessThan(noTruth); // only the wire frames remain
    expect(buildPoints(dijet, { ...opts, showHits: false, showReco: false }).count).toBe(0);
    expect(buildTowers(dijet, { ...opts, showCalo: false }).count).toBe(0);
    expect(buildCones(dijet, { ...opts, showReco: false }).count).toBe(0);
  });
  it('points: one per hit and muon hit, plus the vertices', () => {
    const p = buildPoints(zmm, opts);
    expect(p.stride).toBe(POINT_STRIDE);
    expect(p.count).toBe(zmm.hits.count + zmm.muonHits.count + zmm.vertices.length);
  });
  it('towers and cones have the documented layout', () => {
    const t = buildTowers(dijet, opts);
    expect(t.stride).toBe(TOWER_STRIDE);
    expect(t.count).toBe(dijet.towers.length);
    expect(t.view()[4]).toBeLessThan(t.view()[5]!);
    const c = buildCones(dijet, opts);
    expect(c.stride).toBe(CONE_STRIDE);
    expect(c.count).toBe(2);
  });
  it('the writer grows without losing records', () => {
    const w = new RecordWriter(3, 2);
    for (let i = 0; i < 100; i++) {
      const o = w.next();
      w.data[o] = i;
    }
    expect(w.count).toBe(100);
    expect(w.view()[3 * 99]).toBe(99);
  });
  it('pT colouring changes with pT, particle colouring does not', () => {
    const lo = lineColour('hadron', 1, { colourBy: 'pt', palette: opts.palette });
    const hi = lineColour('hadron', 100, { colourBy: 'pt', palette: opts.palette });
    expect(lo).not.toEqual(hi);
    expect(lineColour('hadron', 1, opts)).toEqual(lineColour('hadron', 100, opts));
    expect(lineColour('neutrino', 1, { colourBy: 'pt', palette: opts.palette })).toEqual(opts.palette.neutrino.rgb);
    expect(ptFraction(0.1)).toBe(0);
    expect(ptFraction(1e6)).toBe(1);
    expect(ptColour(10)).toHaveLength(3);
  });
  it('the lego model has one bar per tower with E_T = E / cosh η', () => {
    const m = legoModel(dijet);
    expect(m.bars).toHaveLength(dijet.towers.length);
    for (const b of m.bars) {
      const t = dijet.towers.find((x) => x.obj === b.obj)!;
      expect(b.et).toBeCloseTo(t.energy / Math.cosh(t.eta), 9);
    }
    expect(m.hScale * m.maxEt).toBeLessThanOrEqual(2.4 + 1e-9);
  });
  it('the lego plot draws on a fake 2D context and reports polygons for picking', () => {
    const calls: string[] = [];
    const grad = { addColorStop() {} };
    const ctx = new Proxy({}, {
      get: (_t, k: string) => {
        if (k === 'createRadialGradient') return () => grad;
        return (..._a: unknown[]) => {
          calls.push(k);
        };
      },
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    const cam = new Camera({ ortho: true, width: 400, height: 300 });
    cam.near = -60;
    cam.far = 60;
    cam.update();
    const polys = drawLego(ctx, dijet, legoModel(dijet), cam, opts, null);
    expect(polys.ids.length).toBeGreaterThanOrEqual(dijet.towers.length);
    expect(calls).toContain('fill');
    expect(polys.prio.includes(2)).toBe(true); // jet circles
  });
});
