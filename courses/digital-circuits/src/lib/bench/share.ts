/**
 * Sharing and saving circuits on the bench.
 *
 * A share link keeps the whole circuit in the URL hash, so nothing is stored on a server:
 *
 *     …/bench/#c=<payload>
 *
 * The payload is one format character followed by base64url text:
 *
 *   `z`  the circuit as JSON, compressed with CompressionStream('deflate-raw')
 *   `j`  the plain JSON (used where CompressionStream does not exist)
 *
 * Decoding accepts both, whatever the browser can do itself. The JSON is the Circuit, and may carry a
 * `bench` property with the bench's own state (instruments and their probes); the circuit model ignores
 * it. The current circuit is also autosaved to localStorage under `dc-bench` (every access is guarded:
 * storage can be missing or full).
 */
import type { Circuit } from '../sim/netlist/types';
import { getDef } from '../sim/netlist/catalog';

export const DRAFT_KEY = 'dc-bench';

/** What travels with a circuit: the bench's own state, opaque to this module. */
export type BenchExtras = Record<string, unknown>;

export interface SharePayload {
  circuit: Circuit;
  extras?: BenchExtras;
}

// ── base64url ────────────────────────────────────────────────────────────────

export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const hasStreams = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined' && typeof Response !== 'undefined';

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(data as BufferSource).catch(() => {});
  void writer.close().catch(() => {});
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

// ── Encoding ─────────────────────────────────────────────────────────────────

/** JSON of a circuit, with the bench's extras under `bench`. */
export function serialise(circuit: Circuit, extras?: BenchExtras): string {
  return JSON.stringify(extras && Object.keys(extras).length ? { ...circuit, bench: extras } : circuit);
}

/**
 * The payload of a share link. `compress: false` forces the plain form (also used when the browser
 * has no CompressionStream).
 */
export async function encodeShare(circuit: Circuit, extras?: BenchExtras, options: { compress?: boolean } = {}): Promise<string> {
  const bytes = new TextEncoder().encode(serialise(circuit, extras));
  if (options.compress !== false && hasStreams()) {
    try {
      return 'z' + bytesToBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
    } catch {
      /* fall through to the plain form */
    }
  }
  return 'j' + bytesToBase64Url(bytes);
}

/** Decode a payload made by encodeShare. Throws an Error with a readable message. */
export async function decodeShare(payload: string): Promise<SharePayload> {
  const text = payload.trim();
  const format = text[0];
  const body = text.slice(1);
  let json: string;
  try {
    if (format === 'z') {
      if (!hasStreams()) throw new Error('This browser cannot open compressed links (no DecompressionStream).');
      json = new TextDecoder().decode(await pipe(base64UrlToBytes(body), new DecompressionStream('deflate-raw')));
    } else if (format === 'j') {
      json = new TextDecoder().decode(base64UrlToBytes(body));
    } else {
      throw new Error('Unknown link format.');
    }
  } catch (e) {
    throw new Error(e instanceof Error && /link|browser/.test(e.message) ? e.message : 'The link is damaged: it could not be decoded.');
  }
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('The link is damaged: it does not contain a circuit.');
  }
  return payloadFromJson(data);
}

/** Split a parsed JSON document into the circuit and the bench extras, validating the circuit. */
export function payloadFromJson(data: unknown): SharePayload {
  const { bench: extras, ...rest } = parseCircuit(data) as Circuit & { bench?: unknown };
  const circuit: Circuit = rest;
  const out: SharePayload = { circuit };
  if (extras && typeof extras === 'object' && !Array.isArray(extras)) out.extras = extras as BenchExtras;
  return out;
}

export const encodeCircuit = (circuit: Circuit, options?: { compress?: boolean }): Promise<string> => encodeShare(circuit, undefined, options);
export const decodeCircuit = async (payload: string): Promise<Circuit> => (await decodeShare(payload)).circuit;

// ── Hash and URL ─────────────────────────────────────────────────────────────

/** The payload in a location hash ("#c=…"), if there is one. */
export function readShareHash(hash: string): string | undefined {
  const m = /^#?(?:.*&)?c=([A-Za-z0-9_-]+)/.exec(hash);
  return m?.[1];
}

export const shareHash = (payload: string): string => `#c=${payload}`;

/** A full link to the bench: `base` is the site base path ("" or "/digital-circuits"). */
export function shareUrl(origin: string, base: string, payload: string): string {
  return `${origin}${base}/bench/${shareHash(payload)}`;
}

// ── Validation ───────────────────────────────────────────────────────────────

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Check that a parsed JSON value is a circuit the bench can open: version 1, components with unique ids
 * and known types, wires as lists of grid points. Returns the circuit (the same object) or throws an
 * Error saying what is wrong.
 */
export function parseCircuit(data: unknown): Circuit {
  if (!isObj(data)) throw new Error('This is not a circuit: expected a JSON object.');
  if (data.version !== 1) throw new Error(`Unsupported circuit version ${JSON.stringify(data.version)} (expected 1).`);
  if (!Array.isArray(data.components)) throw new Error('The circuit has no "components" list.');
  if (!Array.isArray(data.wires)) throw new Error('The circuit has no "wires" list.');
  const subs = isObj(data.subcircuits) ? data.subcircuits : {};
  const ids = new Set<string>();
  for (const [i, c] of data.components.entries()) {
    if (!isObj(c) || typeof c.id !== 'string' || typeof c.type !== 'string') throw new Error(`Component ${i + 1} needs an "id" and a "type".`);
    if (!isNum(c.x) || !isNum(c.y)) throw new Error(`Component ${c.id} needs numeric "x" and "y".`);
    if (ids.has(c.id)) throw new Error(`Two components are called ${c.id}.`);
    ids.add(c.id);
    const known = getDef(c.type) || (c.type.startsWith('sub:') && c.type.slice(4) in subs);
    if (!known) throw new Error(`Unknown component type "${c.type}" (${c.id}).`);
    if (c.rot !== undefined && ![0, 90, 180, 270].includes(c.rot as number)) throw new Error(`${c.id}: "rot" must be 0, 90, 180 or 270.`);
  }
  for (const [i, w] of data.wires.entries()) {
    const pts = isObj(w) ? w.points : undefined;
    if (!Array.isArray(pts) || pts.length < 2 || !pts.every((p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]))) {
      throw new Error(`Wire ${i + 1} needs a list of at least two [x, y] points.`);
    }
  }
  return data as unknown as Circuit;
}

/** Parse JSON text (an imported file) into a payload; errors are readable. */
export function parseCircuitJson(text: string): SharePayload {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  return payloadFromJson(data);
}

// ── Autosave ─────────────────────────────────────────────────────────────────

interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function storage(): Store | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** Save the current bench circuit. Returns whether it was stored. */
export function saveDraft(circuit: Circuit, extras?: BenchExtras, store: Store | undefined = storage()): boolean {
  try {
    if (!store) return false;
    store.setItem(DRAFT_KEY, serialise(circuit, extras));
    return true;
  } catch {
    return false;
  }
}

/** The autosaved circuit, if there is a valid one. */
export function loadDraft(store: Store | undefined = storage()): SharePayload | undefined {
  try {
    const text = store?.getItem(DRAFT_KEY);
    if (!text) return undefined;
    return parseCircuitJson(text);
  } catch {
    return undefined;
  }
}

export function clearDraft(store: Store | undefined = storage()): void {
  try {
    store?.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
