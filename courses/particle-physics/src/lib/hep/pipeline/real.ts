/**
 * The loader contract for real data, so that the analysis the reader runs on the simulation runs unchanged on events recorded at the LHC (Chapter 29).
 *
 * Where: `static/data/real/<name>.manifest.json` and the file it names, next to it (`static/data/real/<name>.f32`). The Control Room and the pipeline widget
 * look for `static/data/real/<preset>.manifest.json` for a preset (for instance `higgs-gamgam`); if the manifest does not exist (HTTP 404) the real-data
 * mode is disabled, and nothing is faked.
 *
 * The file is a flat list of reconstructed **objects**, one row each, little-endian Float32, `stride = 8` values per row, in event order:
 *
 *     event   0-based event number (non-decreasing; events without objects are simply absent)
 *     kind    0 muon, 1 electron, 2 photon, 3 jet, 4 missing transverse momentum (pt = |MET|, phi = its direction, eta and E ignored)
 *     pt      GeV
 *     eta     pseudorapidity
 *     phi     radians, in (−π, π]
 *     E       GeV (for jets and muons the four-vector is (E, pt cos φ, pt sin φ, pt sinh η); if E ≤ 0 a massless object is assumed)
 *     charge  −1, +1, or 0 for photons, jets and MET
 *     iso     relative track isolation (scalar pT sum in a cone over the object's pT), or −1 if the source has none
 *
 * The manifest is JSON with these fields (all required unless marked optional):
 *
 *     name         file stem, e.g. "higgs-gamgam"
 *     title        a line for the plot legend, e.g. "ATLAS Open Data, 13 TeV, 10 fb⁻¹"
 *     file         file name relative to the manifest
 *     format       "objects-f32-v1" (this contract)
 *     events       number of events in the file (the events the selection below kept)
 *     rows         number of rows (objects)
 *     sha256       hex digest of the file
 *     sqrtS        centre-of-mass energy in GeV
 *     luminosityFb integrated luminosity the events correspond to, in fb⁻¹ (null if not known)
 *     observables  the observables of `hep/pipeline` this file can be analysed with, e.g. ["mgg"] (objects the observable needs must be in the file)
 *     selection    the selection that was applied when the file was made (trigger, object definitions, pre-selection) in words
 *     source       { title, record (URL or DOI), experiment, dataset }
 *     licence      e.g. "CC0 1.0" and the URL of the terms
 *     prepared     ISO date; script: path of the preparation script; software: versions used (optional)
 *
 * Units are GeV throughout. A dataset without a licence that allows redistribution is not shipped (docs/PLAN.md, *Real data*).
 */
import type { RecoEvent, RecoObject } from '../event/index.ts';
import type { P4 } from '../kinematics/index.ts';
import { binEdges, OBSERVABLES, recoObservables } from './observables.ts';
import { emptyHist, fillHist, type HistAcc } from './accum.ts';
import type { PipelineConfig } from './config.ts';

export const REAL_STRIDE = 8;
export const REAL_FORMAT = 'objects-f32-v1';
export const REAL_KINDS = ['muon', 'electron', 'photon', 'jet', 'met'] as const;

export interface RealManifest {
  name: string;
  title: string;
  file: string;
  format: string;
  events: number;
  rows: number;
  sha256: string;
  sqrtS: number;
  luminosityFb: number | null;
  observables: string[];
  selection: string;
  source: { title: string; record: string; experiment?: string; dataset?: string };
  licence: string;
  prepared: string;
  script?: string;
  software?: Record<string, string>;
}

/** Check a parsed manifest; throws a descriptive error if a required field is missing or the format is not the one this loader reads. */
export function parseRealManifest(x: unknown): RealManifest {
  const m = x as Partial<RealManifest> | null;
  const need: (keyof RealManifest)[] = ['name', 'title', 'file', 'format', 'events', 'rows', 'sha256', 'sqrtS', 'observables', 'selection', 'source', 'licence', 'prepared'];
  if (!m || typeof m !== 'object') throw new Error('the real-data manifest is not an object');
  for (const k of need) if (m[k] === undefined || m[k] === null) throw new Error(`the real-data manifest lacks "${k}"`);
  if (m.format !== REAL_FORMAT) throw new Error(`unsupported real-data format "${m.format}" (this loader reads "${REAL_FORMAT}")`);
  if (!Array.isArray(m.observables)) throw new Error('the real-data manifest: observables must be a list');
  return m as RealManifest;
}

/** One recorded event, as the reconstructed objects the analysis reads (no truth, no detector output). */
export type RealEvent = RecoEvent;

const p4 = (pt: number, eta: number, phi: number, E: number): P4 => {
  const px = pt * Math.cos(phi), py = pt * Math.sin(phi), pz = pt * Math.sinh(eta);
  return { E: E > 0 ? E : Math.hypot(px, py, pz), px, py, pz };
};

/** Decode the bytes of a real-data file into events. */
export function parseRealObjects(buffer: ArrayBuffer): RealEvent[] {
  const a = new Float32Array(buffer);
  if (a.length % REAL_STRIDE !== 0) throw new Error(`real-data file: ${a.length} values is not a multiple of ${REAL_STRIDE}`);
  const events: RealEvent[] = [];
  let cur: RealEvent | null = null;
  let curId = -1;
  for (let i = 0; i < a.length; i += REAL_STRIDE) {
    const id = a[i]!;
    if (cur === null || id !== curId) {
      cur = { tracks: [], vertices: [], clusters: [], objects: [], met: { x: 0, y: 0 }, sumEt: 0 };
      events.push(cur);
      curId = id;
    }
    const kind = a[i + 1]!, pt = a[i + 2]!, eta = a[i + 3]!, phi = a[i + 4]!, E = a[i + 5]!, charge = a[i + 6]!, iso = a[i + 7]!;
    if (kind === 4) {
      cur.met = { x: pt * Math.cos(phi), y: pt * Math.sin(phi) };
      continue;
    }
    const name = REAL_KINDS[kind];
    if (!name || name === 'met') continue;
    const o: RecoObject = { kind: name, p: p4(pt, eta, phi, E), truth: -1 };
    if (charge !== 0) o.charge = charge;
    if (iso >= 0) o.isolation = iso;
    cur.objects.push(o);
  }
  return events;
}

/** Fetch `<base>/data/real/<name>.manifest.json` and its file. Returns null if the manifest does not exist (404) or cannot be fetched: the caller then offers no real-data mode. */
export async function loadRealData(base: string, name: string, fetchFn: typeof fetch = fetch): Promise<{ manifest: RealManifest; events: RealEvent[] } | null> {
  const dir = `${base}/data/real`;
  let res: Response;
  try {
    res = await fetchFn(`${dir}/${name}.manifest.json`);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let manifest: RealManifest;
  try {
    manifest = parseRealManifest(await res.json());
  } catch {
    return null;
  }
  const f = await fetchFn(`${dir}/${manifest.file}`);
  if (!f.ok) return null;
  return { manifest, events: parseRealObjects(await f.arrayBuffer()) };
}

/** Only the manifest, for a cheap existence check (the widget enables its "real data" option only if this is not null). */
export async function realManifestExists(base: string, name: string, fetchFn: typeof fetch = fetch): Promise<RealManifest | null> {
  try {
    const res = await fetchFn(`${base}/data/real/${name}.manifest.json`);
    if (!res.ok) return null;
    return parseRealManifest(await res.json());
  } catch {
    return null;
  }
}

/** The main observable of a configuration histogrammed on real events with the same selection and binning as the simulation: counts per bin. */
export function histogramReal(events: readonly RealEvent[], config: PipelineConfig): { edges: number[]; acc: HistAcc; selected: number } {
  const name = config.analysis.observables[0]!;
  const edges = binEdges(OBSERVABLES[name]!, config.analysis.binning[name]);
  const acc = emptyHist(edges.length - 1);
  let selected = 0;
  for (const ev of events) {
    const v = recoObservables(ev, config.analysis.selection, [name])[0];
    if (v !== null && v !== undefined) {
      fillHist(acc, edges, v);
      selected++;
    }
  }
  return { edges, acc, selected };
}
