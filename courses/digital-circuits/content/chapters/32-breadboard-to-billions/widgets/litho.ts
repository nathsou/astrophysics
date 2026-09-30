/**
 * Photolithography, twice. `buildSteps` describes, step by step, how one n-channel transistor is printed in a
 * wafer (the self-aligned silicon-gate process of about 1970, which every later process still follows in spirit);
 * the numbers are cross-section coordinates in an arbitrary 100 × 60 box that the figure scales to fit.
 * `resolution` is the Rayleigh equation of the printing machine, with the machines of Figure 32.3.
 */

export type LayerKind = 'silicon' | 'oxide' | 'poly' | 'resist' | 'exposed' | 'implant' | 'dielectric' | 'metal' | 'chrome';

export interface Layer {
  kind: LayerKind;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface Step {
  id: string;
  title: string;
  text: string;
  layers: Layer[];
  /** Light comes from above (steps that expose the resist). */
  light: boolean;
  /** The mask is in the picture. */
  mask: boolean;
}

/** Vertical layout: the silicon surface is at y = 30 and y grows downwards. */
export const SURFACE = 30;
export const WIDTH = 100;
export const HEIGHT = 60;

export interface GateSpec {
  /** Left and right edge of the gate on the mask, 0–100. */
  x0: number;
  x1: number;
}

export const DEFAULT_GATE: GateSpec = { x0: 40, x1: 60 };
/** The dopant is driven this far under the gate edge by the anneal (a few per cent of the gate length). */
export const IMPLANT_DEPTH = 8;

const span = (kind: LayerKind, x0: number, x1: number, y0: number, y1: number): Layer => ({ kind, x0, x1, y0, y1 });

export function buildSteps(g: GateSpec = DEFAULT_GATE): Step[] {
  const si = span('silicon', 0, WIDTH, SURFACE, HEIGHT);
  const oxide = (x0: number, x1: number) => span('oxide', x0, x1, SURFACE - 1.5, SURFACE);
  const poly = (x0: number, x1: number) => span('poly', x0, x1, SURFACE - 7, SURFACE - 1.5);
  const resist = (x0: number, x1: number, kind: LayerKind = 'resist') => span(kind, x0, x1, SURFACE - 14, SURFACE - 7);
  const chrome = span('chrome', g.x0, g.x1, 3.6, 6.4);
  return [
    {
      id: 'wafer',
      title: 'A wafer of p-type silicon',
      text: 'The starting point is a slice of silicon a fraction of a millimetre thick, lightly doped so that it has a few free holes (Chapter 7). Everything that follows is built in and on its top surface.',
      layers: [si],
      light: false,
      mask: false,
    },
    {
      id: 'deposit',
      title: 'Grow a thin oxide, deposit polysilicon',
      text: 'Heating the wafer in oxygen grows a layer of glass, the gate oxide, a few nanometres thick. A layer of polycrystalline silicon, which conducts, is deposited over it. Together they are the gate and its insulator, but still a sheet across the whole wafer.',
      layers: [si, oxide(0, WIDTH), poly(0, WIDTH)],
      light: false,
      mask: false,
    },
    {
      id: 'resist',
      title: 'Coat with photoresist',
      text: 'A drop of photoresist, a polymer that dissolves differently after it has seen light, is spun into an even film. This is the film that will be photographed.',
      layers: [si, oxide(0, WIDTH), poly(0, WIDTH), resist(0, WIDTH)],
      light: false,
      mask: false,
    },
    {
      id: 'expose',
      title: 'Expose through the mask',
      text: 'Light passes through the photomask and a lens that shrinks its image, and falls on the resist. Where the mask has chrome the resist stays in shadow. Everywhere else it is exposed, and will dissolve in the developer.',
      layers: [si, oxide(0, WIDTH), poly(0, WIDTH), resist(0, g.x0, 'exposed'), resist(g.x0, g.x1), resist(g.x1, WIDTH, 'exposed'), chrome],
      light: true,
      mask: true,
    },
    {
      id: 'develop',
      title: 'Develop',
      text: 'The developer washes away the exposed resist and leaves a stencil: a strip of resist where the gate is to be. The pattern of the mask has been copied into the resist. This step, in some form, is repeated for every layer of the chip.',
      layers: [si, oxide(0, WIDTH), poly(0, WIDTH), resist(g.x0, g.x1)],
      light: false,
      mask: false,
    },
    {
      id: 'etch',
      title: 'Etch',
      text: 'A plasma or an acid eats the polysilicon and oxide wherever the resist does not protect them. What is left of them is exactly the strip under the stencil: the gate.',
      layers: [si, oxide(g.x0, g.x1), poly(g.x0, g.x1), resist(g.x0, g.x1)],
      light: false,
      mask: false,
    },
    {
      id: 'implant',
      title: 'Strip the resist, implant the dopant',
      text: 'With the resist gone, a beam of phosphorus or arsenic ions is fired at the whole wafer. The gate stops them; the bare silicon on either side takes them and becomes n-type: the source and the drain. Their inner edges lie exactly under the gate’s edges, whatever the gate’s position: the transistor is self-aligned.',
      layers: [
        si,
        span('implant', 0, g.x0 + IMPLANT_DEPTH / 2, SURFACE, SURFACE + IMPLANT_DEPTH),
        span('implant', g.x1 - IMPLANT_DEPTH / 2, WIDTH, SURFACE, SURFACE + IMPLANT_DEPTH),
        oxide(g.x0, g.x1),
        poly(g.x0, g.x1),
      ],
      light: false,
      mask: false,
    },
    {
      id: 'metal',
      title: 'Insulate, open contacts, deposit metal',
      text: 'A thick layer of glass covers everything. Two more masks cut holes through it to the source and the drain, and metal fills the holes and runs along the top as wires. The transistor of Chapter 8 now has three terminals that something can reach; modern chips repeat the last step ten or more times, one layer of wiring above another.',
      layers: [
        si,
        span('implant', 0, g.x0 + IMPLANT_DEPTH / 2, SURFACE, SURFACE + IMPLANT_DEPTH),
        span('implant', g.x1 - IMPLANT_DEPTH / 2, WIDTH, SURFACE, SURFACE + IMPLANT_DEPTH),
        oxide(g.x0, g.x1),
        poly(g.x0, g.x1),
        span('dielectric', 0, g.x0 - 2, SURFACE - 16, SURFACE),
        span('dielectric', g.x0 - 2, g.x1 + 2, SURFACE - 16, SURFACE - 7),
        span('dielectric', g.x1 + 2, WIDTH, SURFACE - 16, SURFACE),
        span('metal', 0, g.x0 - 8, SURFACE - 22, SURFACE - 16),
        span('metal', 6, g.x0 - 8, SURFACE - 16, SURFACE),
        span('metal', g.x1 + 8, WIDTH - 6, SURFACE - 22, SURFACE - 16),
        span('metal', g.x1 + 8, WIDTH - 12, SURFACE - 16, SURFACE),
      ],
      light: false,
      mask: false,
    },
  ];
}

/** The parts of a step's picture of one kind, e.g. the polysilicon that is left. */
export const layersOf = (s: Step, kind: LayerKind) => s.layers.filter((l) => l.kind === kind);

// ------------------------------------------------------------------------------------------- the Rayleigh equation

export interface Scanner {
  id: string;
  name: string;
  /** Wavelength in nm. */
  wavelengthNm: number;
  /** Numerical aperture of the lens (mirror system for EUV). */
  na: number;
  era: string;
  /** Source key for the wavelength and the aperture (`content/bibliography.yaml`). */
  source?: string;
}

export const SCANNERS: Scanner[] = [
  { id: 'iline', name: 'i-line', wavelengthNm: 365, na: 0.55, era: '1990s' },
  { id: 'krf', name: 'KrF', wavelengthNm: 248, na: 0.8, era: 'late 1990s' },
  { id: 'arf', name: 'ArF', wavelengthNm: 193, na: 0.93, era: '2000s' },
  { id: 'arfi', name: 'ArF, immersed in water', wavelengthNm: 193, na: 1.35, era: '2000s to now', source: 'song2022' },
  { id: 'euv', name: 'EUV', wavelengthNm: 13.5, na: 0.33, era: '2019 on', source: 'asml-euv' },
  { id: 'hina', name: 'High-NA EUV', wavelengthNm: 13.5, na: 0.55, era: 'mid-2020s', source: 'asml-euv' },
];

/** The Rayleigh equation: the smallest half-pitch a machine can print, CD = k1 λ / NA. */
export const resolution = (wavelengthNm: number, na: number, k1: number) => (k1 * wavelengthNm) / na;

/** The smallest k1 one exposure can reach: at 0.25 the pitch is λ / (2 NA), the finest for which the lens still catches the first diffraction orders. */
export const K1_LIMIT = 0.25;
