/**
 * What the inspector card shows for a selected object: a title, a list of quantities and groups of linked objects.
 * Pure data, so the card itself (Inspector.svelte) is only layout and the content is testable.
 */
import { hasParticle, particle } from '../hep/particles/index.ts';
import type { ParticleClass } from '../theme/particles.ts';
import type { DisplayScene, SceneObject } from './scene.ts';

export interface InspectRow {
  label: string;
  value: string;
  /** A longer explanation, shown as a tooltip. */
  title?: string;
}

export interface InspectGroup {
  label: string;
  ids: number[];
  /** How many more exist beyond the ids listed. */
  more: number;
}

export interface Inspection {
  id: number;
  title: string;
  subtitle: string;
  kind: ParticleClass | null;
  calo?: 'ecal' | 'hcal';
  rows: InspectRow[];
  groups: InspectGroup[];
}

/** An energy in GeV with a sensible unit ("511 keV", "45.2 GeV", "1.3 TeV"). Local, so the display does not depend on hep/units. */
export function formatGeV(x: number, digits = 3): string {
  const a = Math.abs(x);
  const t = (v: number) => Number(v.toPrecision(digits)).toString();
  if (a === 0) return '0 GeV';
  if (a >= 1e3) return `${t(x / 1e3)} TeV`;
  if (a >= 1) return `${t(x)} GeV`;
  if (a >= 1e-3) return `${t(x * 1e3)} MeV`;
  if (a >= 1e-6) return `${t(x * 1e6)} keV`;
  return `${x.toExponential(2)} GeV`;
}
const gev = formatGeV;
const fix = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '–');
const chargeText = (q: number | undefined) => (q === undefined ? undefined : q === 0 ? '0' : q > 0 ? `+${Math.abs(q) === 1 ? '1' : fix(q, 2)}` : `−${Math.abs(q) === 1 ? '1' : fix(-q, 2)}`);

/** A short label for a link button: "μ⁻ · pT 45.2 GeV". */
export function linkLabel(scene: DisplayScene, id: number): string {
  const o = scene.objects[id];
  if (!o) return '?';
  if (o.cat === 'tower' || o.cat === 'cluster') return `${o.label} · ${gev(o.energy, 3)}`;
  if (o.cat === 'vertex') return o.label;
  if (o.cat === 'met') return `${o.label} · ${gev(o.pt, 3)}`;
  return `${o.label} · pT ${gev(o.pt, 3)}`;
}

function group(label: string, ids: number[], limit = 12): InspectGroup | null {
  if (!ids.length) return null;
  return { label, ids: ids.slice(0, limit), more: Math.max(0, ids.length - limit) };
}

/** Describe an object for the inspector. */
export function inspect(scene: DisplayScene, id: number): Inspection | null {
  const o: SceneObject | undefined = scene.objects[id];
  if (!o) return null;
  const ev = scene.event;
  const rows: InspectRow[] = [];
  const groups: InspectGroup[] = [];
  const push = (g: InspectGroup | null) => g && groups.push(g);
  const linked = (cat: SceneObject['cat']) => o.links.filter((l) => scene.objects[l]!.cat === cat);
  const kinematics = () => {
    rows.push({ label: 'pT', value: gev(o.pt), title: 'transverse momentum: the part of the momentum perpendicular to the beam' });
    rows.push({ label: 'η', value: fix(o.eta), title: 'pseudorapidity: 0 is perpendicular to the beam, large values are close to it' });
    rows.push({ label: 'φ', value: fix(o.phi, 3), title: 'azimuth around the beam, radians' });
  };

  if (o.cat === 'truth') {
    const p = ev.truth!.particles[o.index]!;
    const info = hasParticle(p.pdg) ? particle(p.pdg) : null;
    kinematics();
    rows.push({ label: 'E', value: gev(o.energy) });
    rows.push({ label: 'mass', value: o.mass !== undefined && Math.abs(o.mass) > 1e-6 ? gev(o.mass) : '0', title: 'invariant mass computed from the four-momentum' });
    if (o.charge !== undefined) rows.push({ label: 'charge', value: chargeText(o.charge)! });
    rows.push({ label: 'PDG id', value: String(p.pdg), title: 'Particle Data Group Monte Carlo number' });
    rows.push({ label: 'status', value: p.status });
    rows.push({ label: 'vertex', value: `(${p.vertex.map((v) => fix(v, 1)).join(', ')}) mm` });
    if (p.endVertex) rows.push({ label: 'decay vertex', value: `(${p.endVertex.map((v) => fix(v, 1)).join(', ')}) mm` });
    if (p.collision) rows.push({ label: 'collision', value: `pile-up ${p.collision}` });
    push(group('Mothers', p.mothers.map((m) => scene.byKey.get(`truth:${m}`)!).filter((x) => x !== undefined)));
    push(group('Daughters', p.daughters.map((m) => scene.byKey.get(`truth:${m}`)!).filter((x) => x !== undefined)));
    push(group('Reco objects', linked('object')));
    push(group('Reco tracks', linked('track')));
    push(group('Calorimeter towers', linked('tower')));
    return { id, title: info ? `${info.symbol}  ${info.name}` : o.label, subtitle: o.sub, kind: o.kind, rows, groups };
  }
  if (o.cat === 'object') {
    const r = ev.reco.objects[o.index]!;
    kinematics();
    rows.push({ label: 'E', value: gev(o.energy) });
    if (o.mass !== undefined) rows.push({ label: 'mass', value: Math.abs(o.mass) > 1e-3 ? gev(o.mass) : '0' });
    if (o.charge) rows.push({ label: 'charge', value: chargeText(o.charge)! });
    if (r.isolation !== undefined) rows.push({ label: 'isolation', value: fix(r.isolation, 3), title: 'scalar sum of pT of other tracks in a cone ΔR < 0.3, divided by the pT of the object' });
    if (r.btag !== undefined) rows.push({ label: 'b-tag score', value: fix(r.btag, 2) });
    if (r.nConstituents !== undefined) rows.push({ label: 'constituents', value: String(r.nConstituents) });
    push(group('Truth match', linked('truth')));
    push(group('Built from tracks', linked('track')));
    push(group('Built from clusters', linked('cluster')));
    if (!linked('truth').length) rows.push({ label: 'truth match', value: 'none (a fake, or real data)' });
    return { id, title: `Reconstructed ${o.label.replace(/[⁺⁻]/, '')}`, subtitle: o.sub, kind: o.kind, rows, groups };
  }
  if (o.cat === 'track') {
    const t = ev.reco.tracks[o.index]!;
    kinematics();
    rows.push({ label: 'charge', value: chargeText(t.charge)! });
    rows.push({ label: 'd0', value: `${fix(t.d0, 3)} mm`, title: 'transverse impact parameter relative to the primary vertex' });
    rows.push({ label: 'z0', value: `${fix(t.z0, 2)} mm`, title: 'longitudinal impact parameter relative to the primary vertex' });
    rows.push({ label: 'χ²/ndof', value: `${fix(t.chi2, 1)} / ${t.ndof}` });
    rows.push({ label: 'hits', value: String(t.hits.length) });
    if (t.purity !== undefined) rows.push({ label: 'purity', value: fix(t.purity, 2), title: 'fraction of the hits that come from the matched truth particle' });
    push(group('Truth match', linked('truth')));
    push(group('Used by', linked('object')));
    push(group('Vertex', linked('vertex')));
    if (!linked('truth').length && ev.truth) rows.push({ label: 'truth match', value: 'none (a fake track)' });
    return { id, title: o.label, subtitle: o.sub, kind: o.kind, rows, groups };
  }
  if (o.cat === 'cluster' || o.cat === 'tower') {
    rows.push({ label: 'calorimeter', value: o.calo === 'ecal' ? 'electromagnetic (ECAL)' : 'hadronic (HCAL)' });
    rows.push({ label: 'E', value: gev(o.energy) });
    rows.push({ label: 'E_T', value: gev(o.pt), title: 'transverse energy: E / cosh η' });
    rows.push({ label: 'η', value: fix(o.eta) });
    rows.push({ label: 'φ', value: fix(o.phi, 3) });
    if (o.cat === 'cluster') {
      rows.push({ label: 'cells', value: String(ev.reco.clusters[o.index]!.cells.length) });
      push(group('Towers', linked('tower')));
    } else {
      rows.push({ label: 'cells', value: String(scene.towers[o.index]?.cells.length ?? 0) });
      push(group('Clusters', linked('cluster')));
    }
    push(group('Truth contributors', linked('truth')));
    push(group('Used by', linked('object')));
    return { id, title: o.label, subtitle: o.sub, kind: null, calo: o.calo, rows, groups };
  }
  if (o.cat === 'vertex') {
    const v = ev.reco.vertices[o.index]!;
    rows.push({ label: 'position', value: `(${fix(v.x, 3)}, ${fix(v.y, 3)}, ${fix(v.z, 2)}) mm` });
    rows.push({ label: 'tracks', value: String(v.tracks.length) });
    if (v.chi2 !== undefined) rows.push({ label: 'χ²', value: fix(v.chi2, 2) });
    push(group('Tracks', linked('track')));
    return { id, title: o.label, subtitle: o.sub, kind: null, rows, groups };
  }
  // missing pT
  rows.push({ label: 'magnitude', value: gev(o.pt) });
  rows.push({ label: 'φ', value: fix(o.phi, 3) });
  rows.push({ label: 'ΣE_T', value: gev(ev.reco.sumEt), title: 'scalar sum of transverse energy in the event' });
  return { id, title: 'Missing transverse momentum', subtitle: 'the momentum imbalance that neutrinos (and other invisible particles) leave', kind: 'neutrino', rows, groups };
}

/** A sentence for screen readers describing an event. */
export function describeEvent(scene: DisplayScene): string {
  const ev = scene.event;
  const count = (k: string) => ev.reco.objects.filter((o) => o.kind === k).length;
  const parts: string[] = [];
  for (const [k, n] of [['muon', 'muons'], ['electron', 'electrons'], ['photon', 'photons'], ['jet', 'jets'], ['tau', 'taus']] as const) {
    const c = count(k);
    if (c) parts.push(`${c} ${c === 1 ? n.replace(/s$/, '') : n}`);
  }
  const met = Math.hypot(ev.reco.met.x, ev.reco.met.y);
  return `${ev.truth?.process ? ev.truth.process + '. ' : ''}${ev.reco.tracks.length} tracks, ${ev.reco.vertices.length} vertices, ${parts.length ? parts.join(', ') : 'no identified objects'}, missing pT ${gev(met, 3)}.`;
}
