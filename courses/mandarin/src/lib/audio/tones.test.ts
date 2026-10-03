import { describe, expect, it } from 'vitest';
import { track, yin } from './pitch';
import { analyse, buildTemplates, features, idealTemplates, vote, CONFIDENT } from './tones';
import FIXTURE from './fixtures/tts-tones.json' with { type: 'json' };

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
  const classify = (f: (t: number) => number, mid: number) => analyse(track(voice(f), { sampleRate: SR }), hop, { mid }).tone;
  for (const base of [120, 220]) {
    it(`recognises the four tones at ${base} Hz`, () => {
      // The speaker's middle pitch is known, as it is after a few recordings.
      expect(classify(() => st(base, 4), base)).toBe(1);
      expect(classify((t) => st(base, -1 + 6 * t), base)).toBe(2);
      expect(classify((t) => st(base, t < 0.55 ? -2 - 5 * (t / 0.55) : -7 + 9 * ((t - 0.55) / 0.45)), base)).toBe(3);
      expect(classify((t) => st(base, 5 - 10 * t), base)).toBe(4);
    });
  }
  it('uses the speaker’s range for a low level third tone', () => {
    const r = analyse(track(voice(() => st(200, -6)), { sampleRate: SR }), hop, { mid: 200 });
    expect(r.tone).toBe(3);
  });
  it('declines to judge silence', () => {
    expect(analyse(Array(40).fill(null), hop).tone).toBeNull();
  });
});

describe('tone classifier on recorded voices', () => {
  type Row = { voice: string; ch: string; tone: number; hz: number[] };
  const rows = FIXTURE as Row[];
  const voices = [...new Set(rows.map((r) => r.voice))];
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

  /** Leave one voice out: train on three voices, test on the fourth, for each voice. */
  function heldOut(useLevel: boolean) {
    let right = 0, total = 0, sure = 0, sureRight = 0;
    for (const held of voices) {
      const templates = [...buildTemplates(rows.filter((r) => r.voice !== held)), ...idealTemplates()];
      const mid = median(rows.filter((r) => r.voice === held).flatMap((r) => r.hz.filter((x) => x > 0)));
      for (const r of rows.filter((x) => x.voice === held)) {
        const x = features(r.hz.map((h) => h || null), useLevel ? mid : undefined);
        if (!x) continue;
        const v = vote(x, templates, useLevel);
        total++;
        if (v.tone === r.tone) right++;
        if (v.confidence >= CONFIDENT) {
          sure++;
          if (v.tone === r.tone) sureRight++;
        }
      }
    }
    return { accuracy: right / total, sureAccuracy: sureRight / sure, coverage: sure / total };
  }

  it('recognises tones of unseen voices once it knows their range', () => {
    const r = heldOut(true);
    expect(r.accuracy).toBeGreaterThan(0.85);
    expect(r.sureAccuracy).toBeGreaterThan(0.9);
    expect(r.coverage).toBeGreaterThan(0.8);
  });
  it('still does well before it knows the speaker', () => {
    expect(heldOut(false).accuracy).toBeGreaterThan(0.75);
  });
});
