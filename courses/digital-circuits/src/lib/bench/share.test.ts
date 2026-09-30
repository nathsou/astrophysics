import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Circuit } from '../sim/netlist/types';
import {
  DRAFT_KEY,
  base64UrlToBytes,
  bytesToBase64Url,
  decodeCircuit,
  decodeShare,
  encodeCircuit,
  encodeShare,
  loadDraft,
  parseCircuit,
  parseCircuitJson,
  readShareHash,
  saveDraft,
  shareHash,
  shareUrl,
} from './share';

const rc: Circuit = {
  version: 1,
  title: 'RC — charging ✓',
  engine: 'analog',
  components: [
    { id: 'B1', type: 'battery', x: 4, y: 10, rot: 270, params: { voltage: 5 } },
    { id: 'R1', type: 'resistor', x: 8, y: 2, params: { resistance: 1000 } },
    { id: 'C1', type: 'capacitor', x: 16, y: 4, rot: 90, params: { capacitance: 1e-6 } },
    { id: 'G1', type: 'ground', x: 4, y: 12 },
  ],
  wires: [
    { points: [[4, 6], [4, 2], [8, 2]] },
    { points: [[12, 2], [16, 2], [16, 4]] },
    { points: [[16, 8], [16, 12], [4, 12], [4, 10]] },
  ],
  notes: [{ x: 8, y: 0, text: 'τ = RC' }],
};

/** A memory stand-in for localStorage. */
function memoryStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

afterEach(() => vi.unstubAllGlobals());

describe('base64url', () => {
  test('round-trips every byte value without padding or unsafe characters', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const text = bytesToBase64Url(bytes);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect([...base64UrlToBytes(text)]).toEqual([...bytes]);
  });
  test('handles lengths that need different padding', () => {
    for (const n of [0, 1, 2, 3, 4, 5]) {
      const b = Uint8Array.from({ length: n }, (_, i) => 250 - i);
      expect([...base64UrlToBytes(bytesToBase64Url(b))]).toEqual([...b]);
    }
  });
});

describe('share links', () => {
  test('a circuit survives compression', async () => {
    const payload = await encodeCircuit(rc);
    expect(payload[0]).toBe('z');
    expect(payload).toMatch(/^z[A-Za-z0-9_-]+$/);
    expect(await decodeCircuit(payload)).toEqual(rc);
  });

  test('compression makes a big circuit smaller than its JSON', async () => {
    const big: Circuit = { ...rc, components: Array.from({ length: 40 }, (_, i) => ({ id: `R${i}`, type: 'resistor', x: i * 6, y: 2, params: { resistance: 1000 + i } })), wires: [] };
    const payload = await encodeCircuit(big);
    expect(payload.length).toBeLessThan(JSON.stringify(big).length * 0.6);
    expect(await decodeCircuit(payload)).toEqual(big);
  });

  test('plain fallback round-trips, including non-ASCII text', async () => {
    const payload = await encodeCircuit(rc, { compress: false });
    expect(payload[0]).toBe('j');
    expect(await decodeCircuit(payload)).toEqual(rc);
  });

  test('without CompressionStream the encoder falls back and the decoder still reads plain links', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    vi.stubGlobal('DecompressionStream', undefined);
    const payload = await encodeCircuit(rc);
    expect(payload[0]).toBe('j');
    expect(await decodeCircuit(payload)).toEqual(rc);
    await expect(decodeCircuit('zAAAA')).rejects.toThrow(/cannot open compressed/);
  });

  test('bench extras travel with the circuit and are optional', async () => {
    const extras = { instruments: [{ id: 'scope1', kind: 'scope', config: { timebase: 5e-4 } }], speed: 0.01 };
    const back = await decodeShare(await encodeShare(rc, extras));
    expect(back.circuit).toEqual(rc);
    expect(back.extras).toEqual(extras);
    expect((await decodeShare(await encodeShare(rc))).extras).toBeUndefined();
  });

  test('damaged links give readable errors', async () => {
    await expect(decodeCircuit('')).rejects.toThrow(/format/);
    await expect(decodeCircuit('qabc')).rejects.toThrow(/format/);
    await expect(decodeCircuit('z!!!')).rejects.toThrow(/damaged/);
    await expect(decodeCircuit('j' + bytesToBase64Url(new TextEncoder().encode('not json')))).rejects.toThrow(/damaged/);
    await expect(decodeCircuit('j' + bytesToBase64Url(new TextEncoder().encode('{"version":2}')))).rejects.toThrow(/version/);
  });

  test('the hash helpers', () => {
    expect(readShareHash('#c=zAbC_-9')).toBe('zAbC_-9');
    expect(readShareHash('c=jXY')).toBe('jXY');
    expect(readShareHash('#x=1&c=jXY')).toBe('jXY');
    expect(readShareHash('#')).toBeUndefined();
    expect(readShareHash('#other')).toBeUndefined();
    expect(shareHash('zA')).toBe('#c=zA');
    expect(shareUrl('https://example.org', '/digital-circuits', 'zA')).toBe('https://example.org/digital-circuits/bench/#c=zA');
  });
});

describe('validation', () => {
  test('accepts the example shape', () => {
    expect(parseCircuit(rc)).toBe(rc);
  });
  test.each([
    [null, /JSON object/],
    [{ version: 2, components: [], wires: [] }, /version/],
    [{ version: 1, wires: [] }, /components/],
    [{ version: 1, components: [] }, /wires/],
    [{ version: 1, components: [{ id: 'X', type: 'flux-capacitor', x: 0, y: 0 }], wires: [] }, /Unknown component type/],
    [{ version: 1, components: [{ id: 'R1', type: 'resistor', x: 0, y: 0 }, { id: 'R1', type: 'resistor', x: 4, y: 0 }], wires: [] }, /Two components/],
    [{ version: 1, components: [{ id: 'R1', type: 'resistor', x: 0, y: 0, rot: 45 }], wires: [] }, /rot/],
    [{ version: 1, components: [], wires: [{ points: [[0, 0]] }] }, /Wire 1/],
    [{ version: 1, components: [{ type: 'resistor', x: 0, y: 0 }], wires: [] }, /needs an "id"/],
  ])('rejects %j', (bad, message) => {
    expect(() => parseCircuit(bad)).toThrow(message);
  });
  test('subcircuit types are known when the circuit defines them', () => {
    const c = { version: 1, components: [{ id: 'U1', type: 'sub:half', x: 0, y: 0 }], wires: [], subcircuits: { half: { version: 1, components: [], wires: [] } } };
    expect(() => parseCircuit(c)).not.toThrow();
    expect(() => parseCircuit({ ...c, subcircuits: {} })).toThrow(/Unknown component type/);
  });
  test('imported files', () => {
    expect(parseCircuitJson(JSON.stringify(rc)).circuit).toEqual(rc);
    expect(() => parseCircuitJson('{oops')).toThrow(/valid JSON/);
  });
});

describe('autosave', () => {
  test('saves under dc-bench and loads back', () => {
    const store = memoryStore();
    expect(loadDraft(store)).toBeUndefined();
    expect(saveDraft(rc, { speed: 2 }, store)).toBe(true);
    expect(store.m.has(DRAFT_KEY)).toBe(true);
    const back = loadDraft(store)!;
    expect(back.circuit).toEqual(rc);
    expect(back.extras).toEqual({ speed: 2 });
  });
  test('never throws when storage fails or holds rubbish', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
    };
    expect(saveDraft(rc, undefined, broken)).toBe(false);
    expect(loadDraft(broken)).toBeUndefined();
    const store = memoryStore();
    store.setItem(DRAFT_KEY, '{"version":9}');
    expect(loadDraft(store)).toBeUndefined();
    expect(saveDraft(rc, undefined, undefined)).toBe(false);
  });
});
