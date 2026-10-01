import { describe, expect, test } from 'vitest';
import { presetConfig } from '../hep/pipeline/index.ts';
import { decodeState, encodeState, fromWire, stateFromHash, toWire, bytesToBase64Url, base64UrlToBytes, hashForState, presetHash } from './codec.ts';

describe('sharing the state', () => {
  test('a state survives encode and decode, and an untouched preset makes a short link', async () => {
    const config = presetConfig('higgs-gamgam');
    const plain = await encodeState({ config, seed: 5 });
    expect(plain.length).toBeLessThan(80);
    expect(await decodeState(plain)).toEqual({ config, seed: 5 });
    config.machine.sqrtS = 14000;
    config.detector.bField = 2.5;
    config.trigger.menu[0]!.l1Threshold = 17;
    config.generator.kFactor = 3.4;
    config.analysis.fit = { model: 'cb+exp', range: [110, 150] };
    const p = await encodeState({ config, seed: -2 });
    expect(p).toMatch(/^[zj]\.[A-Za-z0-9_-]+$/);
    expect(await decodeState(p)).toEqual({ config, seed: -2 });
  });
  test('the changes only: the wire form of an untouched preset has no diff', () => {
    expect(toWire({ config: presetConfig('zmumu'), seed: 1 }).d).toBeUndefined();
    const c = presetConfig('zmumu');
    c.machine.sqrtS = 7000;
    expect(toWire({ config: c, seed: 1 }).d).toEqual({ machine: { sqrtS: 7000 } });
  });
  test('damaged or foreign payloads give null, not an exception', async () => {
    expect(await decodeState('z.@@@')).toBeNull();
    expect(await decodeState('q.abc')).toBeNull();
    expect(await decodeState('j.' + bytesToBase64Url(new TextEncoder().encode('{"v":1,"p":"nonsense","s":1}')))).toBeNull();
    expect(fromWire(null)).toBeNull();
    expect(fromWire({ v: 1, p: 'zmumu', s: 'x' })!.seed).toBe(1);
  });
  test('hash forms: #c=…, #preset=…&seed=…, and nothing', async () => {
    const state = { config: presetConfig('ttbar'), seed: 9 };
    expect(await stateFromHash(await hashForState(state))).toEqual(state);
    expect((await stateFromHash(presetHash('dijet', 4)))!.seed).toBe(4);
    expect((await stateFromHash('#preset=dijet'))!.config.name).toBe('dijet');
    expect(await stateFromHash('')).toBeNull();
    expect(await stateFromHash('#preset=bogus')).toBeNull();
    expect(await stateFromHash('#c=garbage')).toBeNull();
  });
  test('base64url round trip', () => {
    const bytes = Uint8Array.from({ length: 300 }, (_, i) => (i * 37) % 256);
    expect(Array.from(base64UrlToBytes(bytesToBase64Url(bytes)))).toEqual(Array.from(bytes));
  });
});
