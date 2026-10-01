import { afterEach, describe, expect, it, vi } from 'vitest';
import { SOUND_KEY, readSoundPreference, writeSoundPreference } from './audio';

afterEach(() => vi.unstubAllGlobals());

describe('sound preference', () => {
  it('is off by default and when storage is unavailable', () => {
    expect(SOUND_KEY).toBe('particle-physics:sound');
    expect(readSoundPreference()).toBe(false); // no localStorage in this environment
    expect(() => writeSoundPreference(true)).not.toThrow();
  });
  it('is remembered in localStorage', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    expect(readSoundPreference()).toBe(false);
    writeSoundPreference(true);
    expect(store.get('particle-physics:sound')).toBe('1');
    expect(readSoundPreference()).toBe(true);
    writeSoundPreference(false);
    expect(readSoundPreference()).toBe(false);
  });
});
