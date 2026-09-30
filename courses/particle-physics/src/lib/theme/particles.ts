/**
 * The single source for particle colours and line-style meanings.
 *
 * Every figure in the course (event displays, Feynman diagrams, histograms, the particle table) gives a kind of particle the
 * same colour and the same line style, in both themes, and never relies on the colour alone:
 *
 *   electron  solid, medium          muon      solid, thick        tau       solid, medium
 *   photon    wavy                   hadron    solid, thin         neutrino  dotted
 *   jet       solid, thin (+ cone)   boson     wavy, medium        higgs     dashed
 *
 * This module has no DOM access at import time, so it can be imported from Svelte components, workers and plain TS tests.
 * Canvas and WebGL code reads the resolved colours with `particleColours()`, which reads the `--p-*` tokens of src/app.css.
 */

export type ParticleClass = 'electron' | 'muon' | 'photon' | 'hadron' | 'neutrino' | 'jet' | 'boson' | 'higgs' | 'tau';

/** All kinds, in legend order. */
export const PARTICLE_KINDS: readonly ParticleClass[] = ['electron', 'muon', 'tau', 'photon', 'hadron', 'jet', 'neutrino', 'boson', 'higgs'];

/** How a line is drawn. `curly` is the gluon line of a Feynman diagram (used only by diagrams). */
export type LineStyle = 'solid' | 'wavy' | 'dotted' | 'dashed' | 'curly';

export interface KindStyle {
  /** The CSS custom property that holds the colour (defined in src/app.css, both themes). */
  cssVar: string;
  /** SVG `stroke-dasharray` for this kind ('' for a solid line). Wavy lines are drawn solid and waved by the renderer. */
  dash: string;
  /** Stroke width in CSS pixels for a 2D figure. */
  width: number;
  /** A short glyph used in legends and labels. */
  symbol: string;
  /** The line style in words (for the legend and for screen readers). */
  line: LineStyle;
  /** Human-readable name of the kind. */
  label: string;
  /** What the style means for a reader who cannot see colour. */
  description: string;
}

const STYLES: Record<ParticleClass, KindStyle> = {
  electron: { cssVar: '--p-electron', dash: '', width: 2, symbol: 'e', line: 'solid', label: 'Electron / positron', description: 'solid line, curved track ending in the electromagnetic calorimeter' },
  muon: { cssVar: '--p-muon', dash: '', width: 3.4, symbol: 'μ', line: 'solid', label: 'Muon', description: 'thick solid line, passes through everything to the muon chambers' },
  tau: { cssVar: '--p-tau', dash: '', width: 2, symbol: 'τ', line: 'solid', label: 'Tau', description: 'solid line, decays inside the detector' },
  photon: { cssVar: '--p-photon', dash: '', width: 1.7, symbol: 'γ', line: 'wavy', label: 'Photon', description: 'wavy line, no track, energy in the electromagnetic calorimeter' },
  hadron: { cssVar: '--p-hadron', dash: '', width: 1.2, symbol: 'h', line: 'solid', label: 'Charged hadron', description: 'thin solid line, energy in the hadronic calorimeter' },
  jet: { cssVar: '--p-jet', dash: '', width: 1.2, symbol: 'j', line: 'solid', label: 'Jet (quark or gluon)', description: 'translucent cone around a bundle of thin tracks and calorimeter energy' },
  neutrino: { cssVar: '--p-neutrino', dash: '1 4', width: 1.8, symbol: 'ν', line: 'dotted', label: 'Neutrino / missing pT', description: 'dotted line: invisible, inferred from the momentum imbalance' },
  boson: { cssVar: '--p-boson', dash: '', width: 2, symbol: 'V', line: 'wavy', label: 'W or Z boson', description: 'wavy line in diagrams; decays before it can be seen' },
  higgs: { cssVar: '--p-higgs', dash: '7 4', width: 2.2, symbol: 'H', line: 'dashed', label: 'Higgs boson', description: 'dashed line in diagrams; decays before it can be seen' },
};

/** The kind of particle with this PDG Monte Carlo number (sign ignored). Unknown numbers give 'boson'. */
export function kindOf(pdg: number): ParticleClass {
  const a = Math.abs(Math.trunc(pdg));
  switch (a) {
    case 11:
      return 'electron';
    case 13:
      return 'muon';
    case 15:
      return 'tau';
    case 12:
    case 14:
    case 16:
      return 'neutrino';
    case 22:
      return 'photon';
    case 23:
    case 24:
      return 'boson';
    case 25:
      return 'higgs';
    case 21:
      return 'jet';
  }
  if (a >= 1 && a <= 8) return 'jet';
  if (a >= 100) return 'hadron';
  return 'boson';
}

/** The style of a kind: colour variable, dash pattern, stroke width and symbol. */
export function styleFor(kind: ParticleClass): KindStyle {
  return STYLES[kind];
}

/** The line style of a particular particle in a diagram: like `styleFor(kindOf(pdg)).line` but gluons are curly. */
export function lineOf(pdg: number): LineStyle {
  return Math.abs(pdg) === 21 ? 'curly' : STYLES[kindOf(pdg)].line;
}

/** Whether a kind is drawn with a wavy line. */
export const isWavy = (kind: ParticleClass): boolean => STYLES[kind].line === 'wavy';

// ── Colours ────────────────────────────────────────────────────────────────────────────────────────

/** A colour as a CSS string (`rgb(…)`) and as linear-free sRGB components in 0…1 (for WebGL). */
export interface Colour {
  css: string;
  rgb: [number, number, number];
}

export interface ParticleColours extends Record<ParticleClass, Colour> {
  /** A tracker hit. */
  hit: Colour;
  /** Electromagnetic and hadronic calorimeter towers. */
  caloEm: Colour;
  caloHad: Colour;
}

const tokenName: Record<keyof ParticleColours, string> = {
  electron: '--p-electron',
  muon: '--p-muon',
  tau: '--p-tau',
  photon: '--p-photon',
  hadron: '--p-hadron',
  jet: '--p-jet',
  neutrino: '--p-neutrino',
  boson: '--p-boson',
  higgs: '--p-higgs',
  hit: '--p-hit',
  caloEm: '--p-calo-em',
  caloHad: '--p-calo-had',
};

/** Hex values of the tokens in each theme, mirroring src/app.css. Used when there is no DOM (tests, workers). */
export const DEFAULT_PALETTES: Record<'light' | 'dark', Record<keyof ParticleColours, string>> = {
  dark: {
    electron: '#6fe3ff', muon: '#ff7a7a', tau: '#ff9de1', photon: '#ffe066', hadron: '#b9a0ff', jet: '#ffb066',
    neutrino: '#9aa8b8', boson: '#7fe8a8', higgs: '#ffffff', hit: '#8ea4c0', caloEm: '#6fe3ff', caloHad: '#ff9a5a',
  },
  light: {
    electron: '#0b7088', muon: '#c2342c', tau: '#b3358f', photon: '#a87d00', hadron: '#6a48c0', jet: '#b4601a',
    neutrino: '#5b6b7e', boson: '#0b7247', higgs: '#1c2127', hit: '#5d6b80', caloEm: '#0b7088', caloHad: '#c2621f',
  },
};

/** Parse `#rgb`, `#rrggbb`, `rgb()`, `rgba()` (comma or space syntax) and `color(srgb r g b)`. Returns null if unparseable. */
export function parseColour(text: string): [number, number, number] | null {
  const s = text.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) {
    const h = m[1]!;
    return [parseInt(h[0]! + h[0]!, 16) / 255, parseInt(h[1]! + h[1]!, 16) / 255, parseInt(h[2]! + h[2]!, 16) / 255];
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (m) {
    const h = m[1]!;
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (m) return [+m[1]! / 255, +m[2]! / 255, +m[3]! / 255];
  m = /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(s);
  if (m) return [+m[1]!, +m[2]!, +m[3]!];
  return null;
}

/** Make a `Colour` from components in 0…1. */
export function makeColour(rgb: [number, number, number]): Colour {
  const c = rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
  return { css: `rgb(${c[0]}, ${c[1]}, ${c[2]})`, rgb: [rgb[0], rgb[1], rgb[2]] };
}

function fromHex(hex: string): Colour {
  return makeColour(parseColour(hex) ?? [1, 1, 1]);
}

/** The palette of a named theme, without touching the DOM. */
export function defaultColours(theme: 'light' | 'dark' = 'dark'): ParticleColours {
  const p = DEFAULT_PALETTES[theme];
  const out = {} as ParticleColours;
  for (const k of Object.keys(tokenName) as (keyof ParticleColours)[]) out[k] = fromHex(p[k]);
  return out;
}

let normaliser: CanvasRenderingContext2D | null | undefined;
/** Turn any CSS colour the browser understands into rgb components, through a canvas. */
function viaCanvas(css: string): [number, number, number] | null {
  if (normaliser === undefined) {
    try {
      normaliser = document.createElement('canvas').getContext('2d');
    } catch {
      normaliser = null;
    }
  }
  if (!normaliser) return null;
  normaliser.fillStyle = '#000';
  normaliser.fillStyle = css;
  return parseColour(String(normaliser.fillStyle));
}

/**
 * Read the resolved particle colours from the page. The tokens are declared with `light-dark()`, which custom
 * properties keep unresolved, so each one is resolved by giving a probe element `color: var(--p-…)` and reading
 * the computed colour. `root` is the element whose colour scheme applies (a `.screen` element is always dark);
 * it defaults to the document element. Without a DOM, the built-in dark palette is returned.
 */
export function particleColours(root?: Element | null): ParticleColours {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return defaultColours('dark');
  const host = root ?? document.documentElement;
  const dark = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
  const fallback = defaultColours(dark ? 'dark' : 'light');
  const probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
  host.appendChild(probe);
  const out = {} as ParticleColours;
  try {
    for (const k of Object.keys(tokenName) as (keyof ParticleColours)[]) {
      probe.style.color = '';
      probe.style.color = `var(${tokenName[k]})`;
      const computed = getComputedStyle(probe).color;
      const rgb = parseColour(computed) ?? viaCanvas(computed);
      out[k] = rgb ? makeColour(rgb) : fallback[k];
    }
  } finally {
    probe.remove();
  }
  return out;
}

/** The colour of one kind, read from the page. */
export function kindColour(kind: ParticleClass, root?: Element | null): Colour {
  return particleColours(root)[kind];
}

/**
 * Call `cb` with freshly read colours whenever the theme changes (the `data-theme` or `data-paper` attribute of <html>, or
 * the system colour scheme). Returns a function that stops watching. Safe to call without a DOM.
 */
export function onParticleColoursChange(cb: (c: ParticleColours) => void, root?: Element | null): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {};
  const fire = () => cb(particleColours(root));
  const mo = new MutationObserver(fire);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-paper', 'class', 'style'] });
  const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
  mq?.addEventListener('change', fire);
  return () => {
    mo.disconnect();
    mq?.removeEventListener('change', fire);
  };
}
