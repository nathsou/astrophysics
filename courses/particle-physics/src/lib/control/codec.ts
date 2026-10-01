/**
 * Sharing and saving the Control Room's state.
 *
 * A state is the configuration, the seed and the preset it started from. It travels in the URL hash as `#c=<payload>`: the JSON of the *changes* to the
 * preset (so a link to an untouched preset is a few dozen characters), compressed with `CompressionStream('deflate-raw')` and written in base64url.
 * Where the browser has no `CompressionStream`, the JSON is written in base64url uncompressed (payload prefix `j.`; compressed payloads start `z.`).
 * Shorter hand-written forms work too: `#preset=higgs-gamgam&seed=3`.
 * The state is also autosaved in `localStorage` under `particle-physics:control`.
 */
import { diffConfig, isPreset, mergeConfig, presetConfig, type PipelineConfig, type PresetName } from '../hep/pipeline/index.ts';

export const STORAGE_KEY = 'particle-physics:control';

export interface ControlState {
  config: PipelineConfig;
  seed: number;
}

interface Wire {
  v: 1;
  /** Preset name, changes relative to it, seed. */
  p: string;
  d?: unknown;
  s: number;
}

export function toWire(state: ControlState): Wire {
  const name = state.config.name;
  const base = isPreset(name) ? presetConfig(name) : presetConfig('zmumu');
  const d = diffConfig(base, state.config);
  return { v: 1, p: isPreset(name) ? name : 'zmumu', d, s: state.seed };
}

export function fromWire(w: unknown): ControlState | null {
  const x = w as Partial<Wire> | null;
  if (!x || typeof x !== 'object' || typeof x.p !== 'string' || !isPreset(x.p)) return null;
  const patch = x.d && typeof x.d === 'object' ? { ...(x.d as object), name: x.p } : { name: x.p };
  try {
    return { config: mergeConfig(patch, x.p as PresetName), seed: typeof x.s === 'number' && Number.isFinite(x.s) ? Math.trunc(x.s) : 1 };
  } catch {
    return null;
  }
}

// ── base64url ──

export function bytesToBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function base64UrlToBytes(text: string): Uint8Array {
  const b = text.replace(/-/g, '+').replace(/_/g, '/');
  const s = atob(b + '='.repeat((4 - (b.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function pipeThrough(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(bytes as unknown as BufferSource);
  void writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

const hasCompression = (): boolean => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/** The URL-hash payload of a state. */
export async function encodeState(state: ControlState): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toWire(state)));
  if (hasCompression()) {
    try {
      return 'z.' + bytesToBase64Url(await pipeThrough(json, new CompressionStream('deflate-raw')));
    } catch {
      /* fall through to the uncompressed form */
    }
  }
  return 'j.' + bytesToBase64Url(json);
}

/** A state from a payload made by `encodeState`; null if it is damaged or from an unknown version. */
export async function decodeState(payload: string): Promise<ControlState | null> {
  try {
    const kind = payload.slice(0, 2);
    const bytes = base64UrlToBytes(payload.slice(2));
    let json: Uint8Array;
    if (kind === 'z.') {
      if (!hasCompression()) return null;
      json = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
    } else if (kind === 'j.') json = bytes;
    else return null;
    return fromWire(JSON.parse(new TextDecoder().decode(json)));
  } catch {
    return null;
  }
}

/** Parse a location hash (`#c=…` or `#preset=…&seed=…`). The result is null when the hash holds no state. */
export async function stateFromHash(hash: string): Promise<ControlState | null> {
  const h = hash.replace(/^#/, '');
  if (!h) return null;
  const q = new URLSearchParams(h);
  const c = q.get('c');
  if (c) return decodeState(c);
  const preset = q.get('preset');
  if (preset && isPreset(preset)) {
    const seed = Number(q.get('seed') ?? 1);
    return { config: presetConfig(preset), seed: Number.isFinite(seed) ? Math.trunc(seed) : 1 };
  }
  return null;
}

/** The hash for a state (`#c=…`). */
export async function hashForState(state: ControlState): Promise<string> {
  return '#c=' + (await encodeState(state));
}

/** The short hash for an untouched preset (used by chapter figures). */
export const presetHash = (preset: string, seed = 1): string => `#preset=${encodeURIComponent(preset)}&seed=${seed}`;

// ── autosave ──

export function loadSaved(): ControlState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? fromWire(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
export function saveState(state: ControlState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toWire(state)));
  } catch {
    /* storage unavailable: nothing is remembered */
  }
}
