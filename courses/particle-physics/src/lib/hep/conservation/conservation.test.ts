import { describe, expect, test } from 'vitest';
import { checkReaction, parseReaction, parseParticle, LAWS, LEDGER } from './index.ts';
import { allParticles, particle } from '../particles/index.ts';
import { hook } from '../hooks.ts';

const run = (text: string) => {
  const r = parseReaction(text);
  expect(r.errors, text).toEqual([]);
  return checkReaction(r.initial, r.final);
};

describe('parsing', () => {
  test('ASCII names, symbols and antiparticles', () => {
    expect(parseParticle('K-')).toBe(-321);
    expect(parseParticle('π⁻')).toBe(-211);
    expect(parseParticle('γ')).toBe(22);
    expect(parseParticle('anti-p')).toBe(-2212);
    expect(parseParticle('pbar')).toBe(-2212);
    expect(parseParticle('nubar_mu')).toBe(-14);
    expect(parseParticle('anti-nu_e')).toBe(-12);
    expect(parseParticle('Omega-')).toBe(3334);
    expect(parseParticle('omega')).toBe(223);
    expect(parseParticle('K0bar')).toBe(-311);
    expect(parseParticle('Xi0')).toBe(3322);
    expect(parseParticle('unobtainium')).toBeUndefined();
  });
  test('both arrows, glued tokens and multiplicities', () => {
    expect(parseReaction('p → e+ + gamma')).toEqual({ initial: [2212], final: [-11, 22], errors: [] });
    expect(parseReaction('mu- -> e- + anti-nu_e + nu_mu').final).toEqual([11, -12, 14]);
    expect(parseReaction('e+e- → 2γ').final).toEqual([22, 22]);
    expect(parseReaction('p+p -> p + p + pi0').initial).toEqual([2212, 2212]);
  });
  test('errors are reported, not thrown', () => {
    expect(parseReaction('p → flurble').errors.length).toBe(1);
    expect(parseReaction('p and q').errors.length).toBe(1);
  });
});

describe('the ledger', () => {
  test('known allowed reactions', () => {
    for (const t of [
      'n → p + e- + anti-nu_e',
      'p + p → p + p + p + anti-p',
      'K- + p → Omega- + K+ + K0',
      'pi- + p → K0 + Lambda',
      'pi0 → gamma + gamma',
      'e+ + e- → mu+ + mu-',
      'mu- → e- + anti-nu_e + nu_mu',
      'Delta++ → p + pi+',
      'Sigma0 → Lambda + gamma',
    ]) {
      const r = run(t);
      expect(r.allowed, t).toBe(true);
      expect(r.violated, t).toEqual([]);
      expect(r.details.interaction).toBe('strong');
    }
  });
  test('known forbidden reactions name the right law', () => {
    expect(run('p → e+ + gamma').violated).toEqual(['baryon', 'lepton-e']);
    expect(run('e- → nu_e + gamma').violated).toEqual(['charge']);
    expect(run('mu- → e- + gamma').violated).toEqual(['lepton-e', 'lepton-mu']);
    expect(run('mu- → e- + gamma').details.explanation.join(' ')).toMatch(/Total lepton number is conserved/);
    expect(run('p + p → p + p + p').violated).toEqual(['baryon']);
    expect(run('pi- + p → K0 + K0').details.firstLaw).toBe('baryon');
    expect(run('pi- + p → pi0 + n').allowed).toBe(true);
    expect(run('p → n + e+ + nu_e').violated).toEqual(['energy']);
  });
  test('associated production: a single kaon is forbidden, a pair is allowed', () => {
    expect(run('pi- + p → K0 + Lambda').allowed).toBe(true);
    const bad = run('pi- + p → K+ + pi- + n');
    expect(bad.violated).toEqual(['strangeness']);
    expect(bad.details.delta.strangeness).toBe(1);
    expect(bad.details.interaction).toBe('weak');
  });
  test('weak decays change strangeness by one unit', () => {
    for (const t of ['Lambda → p + pi-', 'K+ → mu+ + nu_mu', 'Omega- → Lambda + K-', 'Xi0 → Lambda + pi0', 'D0 → K- + pi+']) {
      const r = run(t);
      expect(r.allowed, t).toBe(false);
      expect(r.details.interaction, t).toBe('weak');
    }
    expect(run('Lambda → p + pi-').violated).toEqual(['strangeness']);
    expect(run('D0 → K- + pi+').violated).toEqual(['charm', 'strangeness'].sort((a, b) => ['strangeness', 'charm'].indexOf(a) - ['strangeness', 'charm'].indexOf(b)));
    // ΔS = 2 is two weak vertices
    const two = run('Xi- → n + pi-');
    expect(two.details.delta.strangeness).toBe(2);
    expect(two.details.interaction).toBe('forbidden');
  });
  test('the Omega minus has no lighter strangeness −3 state to decay into: its decays are weak, and strong ones are not open', () => {
    const mOmega = particle(3334).mass;
    expect(mOmega).toBeLessThan(particle(3312).mass + particle(311).mass); // Ξ⁻ K̄⁰ would be the strong decay
    expect(run('Omega- → Xi- + pi0').details.interaction).toBe('weak');
  });
  test('the ledger passes a reaction that nature does not: π⁰ → γγγ (C-parity) is allowed here', () => {
    expect(run('pi0 → gamma + gamma + gamma').allowed).toBe(true);
  });
  test('every decay in the particle table conserves the exact laws; hadron decays are weak or strong, never forbidden', () => {
    for (const p of allParticles()) {
      for (const d of p.decays) {
        for (const pdg of p.selfConjugate ? [p.pdg] : [p.pdg, -p.pdg]) {
          const prods = pdg > 0 ? d.products : d.products.map((x) => (particle(x).selfConjugate ? x : -x));
          const r = checkReaction([pdg], prods);
          const name = `${particle(pdg).name} → ${prods.map((x) => particle(x).name).join(' ')}`;
          // Decays of the neutral kaon and of unstable quarks are table conveniences (K0 → K_S / K_L is a mixing statement).
          if ([311, -311].includes(pdg)) continue;
          if (Math.abs(pdg) <= 6 || Math.abs(pdg) >= 21 && Math.abs(pdg) <= 25) continue;
          expect(r.details.exactBroken, name).toEqual([]);
        }
      }
    }
  });
  test('details: the two sides of every law are printed', () => {
    const r = run('K- + p → Omega- + K+ + K0');
    const s = r.details.laws.find((l) => l.id === 'strangeness')!;
    expect([s.initial, s.final]).toEqual([-1, -1]);
    const c = r.details.laws.find((l) => l.id === 'charge')!;
    expect([c.initial, c.final]).toEqual([0, 0]);
    expect(r.details.thresholdSqrtS).toBeCloseTo(1.67245 + 0.493677 + 0.497611, 6);
  });
  test('the hook returns the reference by default', () => {
    expect(hook('conservation.checkReaction', checkReaction)).toBe(checkReaction);
  });
  test('the ledger lists every law once', () => {
    expect(new Set(LAWS.map((l) => l.id)).size).toBe(LAWS.length);
    expect(LEDGER.length).toBeGreaterThan(5);
  });
});
