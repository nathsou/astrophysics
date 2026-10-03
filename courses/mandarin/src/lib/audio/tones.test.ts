import { describe, expect, it } from 'vitest';
import { track, yin } from './pitch';
import { analyse } from './tones';

const SR = 16000;

/** A voiced syllable: a few harmonics following the pitch curve f(t), t ∈ [0, 1]. */
function voice(f: (t: number) => number, seconds = 0.45): Float32Array {
  const n = Math.round(SR * seconds);
  const out = new Float32Array(n + Math.round(SR * 0.1));
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    phase += (2 * Math.PI * f(t)) / SR;
    const env = Math.min(1, i / 400, (n - i) / 400);
    out[i] = env * (0.5 * Math.sin(phase) + 0.25 * Math.sin(2 * phase) + 0.12 * Math.sin(3 * phase));
  }
  return out;
}

const st = (base: number, semis: number) => base * 2 ** (semis / 12);

describe('yin', () => {
  it('finds the pitch of a steady tone', () => {
    const s = voice(() => 220);
    const f = yin(s.subarray(2000, 2640), { sampleRate: SR });
    expect(f).not.toBeNull();
    expect(Math.abs(f! - 220)).toBeLessThan(2);
  });
  it('reports silence as unvoiced', () => {
    expect(yin(new Float32Array(640), { sampleRate: SR })).toBeNull();
  });
});

describe('tone classifier', () => {
  const hop = 0.01;
  const classify = (f: (t: number) => number) => analyse(track(voice(f), { sampleRate: SR }), hop).tone;
  for (const base of [120, 220]) {
    it(`recognises the four tones at ${base} Hz`, () => {
      expect(classify(() => st(base, 4))).toBe(1);
      expect(classify((t) => st(base, -1 + 6 * t))).toBe(2);
      expect(classify((t) => st(base, t < 0.55 ? -2 - 5 * (t / 0.55) : -7 + 9 * ((t - 0.55) / 0.45)))).toBe(3);
      expect(classify((t) => st(base, 5 - 10 * t))).toBe(4);
    });
  }
  it('uses the speaker’s range for a low level third tone', () => {
    const r = analyse(track(voice(() => st(200, -5)), { sampleRate: SR }), hop, { mid: 200 });
    expect(r.tone).toBe(3);
  });
  it('declines to judge silence', () => {
    expect(analyse(Array(40).fill(null), hop).tone).toBeNull();
  });
});
