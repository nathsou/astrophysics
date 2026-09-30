import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTES, PARTICLE_KINDS, defaultColours, isWavy, kindOf, lineOf, makeColour, onParticleColoursChange, parseColour, particleColours, styleFor, type ParticleClass } from '../theme/particles.ts';
import { particle } from '../hep/particles/index.ts';

describe('kindOf', () => {
  it('maps PDG numbers to kinds, ignoring the sign', () => {
    const cases: [number, ParticleClass][] = [
      [11, 'electron'], [-11, 'electron'], [13, 'muon'], [-13, 'muon'], [15, 'tau'], [22, 'photon'],
      [12, 'neutrino'], [-14, 'neutrino'], [16, 'neutrino'], [23, 'boson'], [24, 'boson'], [-24, 'boson'],
      [25, 'higgs'], [21, 'jet'], [1, 'jet'], [-5, 'jet'], [6, 'jet'],
      [211, 'hadron'], [-211, 'hadron'], [111, 'hadron'], [2212, 'hadron'], [130, 'hadron'], [443, 'hadron'],
    ];
    for (const [pdg, k] of cases) expect(kindOf(pdg), String(pdg)).toBe(k);
  });
  it('agrees with the particle table: every table entry gets a kind, leptons and hadrons as expected', () => {
    for (const id of [11, 13, 15, 12, 14, 16, 22, 23, 24, 25, 21, 211, 321, 2212, 2112, 111, 130, 310, 443]) {
      const p = particle(id);
      const k = kindOf(id);
      if (p.kind === 'meson' || p.kind === 'baryon') expect(k).toBe('hadron');
      if (p.kind === 'quark') expect(k).toBe('jet');
    }
  });
  it('unknown numbers are bosons rather than an error', () => {
    expect(kindOf(32)).toBe('boson');
    expect(kindOf(0)).toBe('boson');
  });
});

describe('styleFor', () => {
  it('gives every kind a colour variable that exists in app.css, in both themes', () => {
    const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');
    for (const k of PARTICLE_KINDS) {
      const s = styleFor(k);
      expect(s.cssVar).toMatch(/^--p-[a-z-]+$/);
      expect(css).toContain(`${s.cssVar}: light-dark(`);
      expect(css).toContain(`${s.cssVar}: #`); // the pinned dark value of .screen
    }
  });
  it('the built-in palettes equal the tokens of app.css', () => {
    const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');
    const names: Record<string, string> = { electron: '--p-electron', muon: '--p-muon', tau: '--p-tau', photon: '--p-photon', hadron: '--p-hadron', jet: '--p-jet', neutrino: '--p-neutrino', boson: '--p-boson', higgs: '--p-higgs', hit: '--p-hit', caloEm: '--p-calo-em', caloHad: '--p-calo-had' };
    for (const [key, token] of Object.entries(names)) {
      const m = new RegExp(`${token}: light-dark\\((#[0-9a-f]{6}), (#[0-9a-f]{6})\\)`).exec(css);
      expect(m, token).not.toBeNull();
      expect(DEFAULT_PALETTES.light[key as keyof typeof DEFAULT_PALETTES.light]).toBe(m![1]);
      expect(DEFAULT_PALETTES.dark[key as keyof typeof DEFAULT_PALETTES.dark]).toBe(m![2]);
    }
  });
  it('colour is never the only cue: kinds differ in line style, width or symbol', () => {
    const seen = new Set<string>();
    for (const k of PARTICLE_KINDS) {
      const s = styleFor(k);
      const sig = `${s.line}|${s.width}|${s.dash}|${s.symbol}`;
      expect(seen.has(sig)).toBe(false);
      seen.add(sig);
    }
    // the six kinds a reader must tell apart in an event display differ by line alone
    const lines = ['electron', 'muon', 'photon', 'hadron', 'neutrino', 'higgs'].map((k) => `${styleFor(k as ParticleClass).line}|${styleFor(k as ParticleClass).width}`);
    expect(new Set(lines).size).toBe(6);
  });
  it('muons are the thickest solid line; hadrons the thinnest; photons wavy; neutrinos dotted; Higgs dashed', () => {
    expect(styleFor('muon').width).toBeGreaterThan(styleFor('electron').width);
    expect(styleFor('electron').width).toBeGreaterThan(styleFor('hadron').width);
    expect(styleFor('muon').line).toBe('solid');
    expect(isWavy('photon')).toBe(true);
    expect(isWavy('boson')).toBe(true);
    expect(styleFor('neutrino').line).toBe('dotted');
    expect(styleFor('neutrino').dash).not.toBe('');
    expect(styleFor('higgs').line).toBe('dashed');
    expect(styleFor('higgs').dash).not.toBe('');
    expect(lineOf(21)).toBe('curly');
    expect(lineOf(22)).toBe('wavy');
  });
});

describe('colours', () => {
  it('parses the colour formats a browser returns', () => {
    expect(parseColour('#ff0000')).toEqual([1, 0, 0]);
    expect(parseColour('#0f0')).toEqual([0, 1, 0]);
    expect(parseColour('rgb(0, 0, 255)')).toEqual([0, 0, 1]);
    expect(parseColour('rgba(255, 255, 255, 0.5)')).toEqual([1, 1, 1]);
    expect(parseColour('rgb(255 128 0 / 50%)')![1]).toBeCloseTo(128 / 255, 9);
    expect(parseColour('color(srgb 0.2 0.4 0.6)')).toEqual([0.2, 0.4, 0.6]);
    expect(parseColour('nonsense')).toBeNull();
  });
  it('makeColour clamps and formats', () => {
    expect(makeColour([2, -1, 0.5]).css).toBe('rgb(255, 0, 128)');
  });
  it('works without a DOM: import-time safe, dark palette, no-op watcher', () => {
    expect(typeof document).toBe('undefined');
    const c = particleColours();
    expect(c.muon.css).toBe(defaultColours('dark').muon.css);
    expect(c.muon.rgb[0]).toBeCloseTo(1, 1);
    const off = onParticleColoursChange(() => {});
    expect(typeof off).toBe('function');
    off();
  });
  it('every colour has a WCAG contrast of at least 3:1 (graphics) against the page it is shown on', () => {
    const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const L = (rgb: number[]) => 0.2126 * lin(rgb[0]!) + 0.7152 * lin(rgb[1]!) + 0.0722 * lin(rgb[2]!);
    const ratio = (a: number[], b: number[]) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
    const pageLight = parseColour('#fbfaf6')!, pageDark = parseColour('#0a1018')!;
    for (const k of [...PARTICLE_KINDS, 'hit', 'caloEm', 'caloHad'] as const) {
      expect(ratio(defaultColours('dark')[k].rgb, pageDark), `dark ${k}`).toBeGreaterThanOrEqual(3);
      expect(ratio(defaultColours('light')[k].rgb, pageLight), `light ${k}`).toBeGreaterThanOrEqual(3);
    }
  });
});
