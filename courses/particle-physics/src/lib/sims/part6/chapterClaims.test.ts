import { describe, expect, test } from 'vitest';
import { rng } from '$lib/hep/random';
import { ttbar, pdf } from '$lib/hep/gen';

// Numbers that the chapters quote from the course's own generator (Chapters 23 and 25).
// Chapter 25's caption: the share of top pairs from gluon fusion (LHC) and from qq̄ annihilation (Tevatron) in the course's leading-order generator.
describe('tt̄ production channels in the course generator', () => {
  test('gluon fusion gives about 84 % at 13 TeV pp; quark annihilation about 95 % at 1.96 TeV ppbar', () => {
    const r = rng(11);
    const n = 20000;
    const lhc = ttbar();
    let gg = 0;
    for (let i = 0; i < n; i++) if (lhc.generate(r, { sqrtS: 13000 }).event.particles[2]!.pdg === 21) gg++;
    const tev = ttbar({ beams: 'ppbar' });
    let qq = 0;
    for (let i = 0; i < n; i++) if (tev.generate(r, { sqrtS: 1960 }).event.particles[2]!.pdg !== 21) qq++;
    console.log('gg fraction at 13 TeV', gg / n, ' qqbar fraction at 1.96 TeV', qq / n);
    expect(gg / n).toBeGreaterThan(0.82);
    expect(gg / n).toBeLessThan(0.86);
    expect(qq / n).toBeGreaterThan(0.93);
    expect(qq / n).toBeLessThan(0.96);
  });

  test('Chapter 23: at x = 0.15 and Q = m_W an up quark in the proton is about ten times more probable than an up antiquark', () => {
    const q = pdf(2, 0.15, 80.4), qbar = pdf(-2, 0.15, 80.4);
    console.log('u/ubar at x = 0.15:', q / qbar);
    expect(q / qbar).toBeGreaterThan(7);
    expect(q / qbar).toBeLessThan(14);
  });
});
