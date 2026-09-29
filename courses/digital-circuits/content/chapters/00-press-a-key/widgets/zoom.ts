/**
 * The keyboard-to-atoms zoom: eight levels, each drawn in the same 640 × 400 frame, and the camera
 * that moves between them.
 *
 * The picture is one nested drawing. Level i + 1 is what you would see if you zoomed into a small
 * rectangle of level i, its *focus*: the focus of level i is a rectangle of the same shape as the
 * frame, centred on `focus` (a point in level i's own coordinates), and its size is the frame
 * divided by S_i = width_i / width_(i+1), the ratio of the real widths the two levels show. So the
 * scale bar is honest even where the drawings are diagrams: the real width of the picture is
 * interpolated on a log scale as the camera moves.
 *
 * The camera moves between levels with the "zoom into a rectangle" curve (van Wijk & Nuij, 2003):
 * the visible rectangle shrinks exponentially, so the zoom looks like constant speed, and its
 * position is chosen so that the focus rectangle fills the frame exactly at the end.
 */

import { keyA, keyCentre } from './keyboard-layout';

export const FRAME = { w: 640, h: 400 } as const;

export interface Point {
  x: number;
  y: number;
}

export interface Level {
  id: string;
  /** Short name, e.g. "The die". */
  title: string;
  /** One sentence, shown under the picture. */
  caption: string;
  /** Real width of the picture at this level, in metres. */
  width: number;
  /** Where the next level lies, in this level's frame coordinates (unused for the last level). */
  focus: Point;
  /** The chapter that explains this level. */
  chapter: { slug: string; number: number; title: string };
}

export const LEVELS: readonly Level[] = [
  {
    id: 'keyboard',
    title: 'The keyboard',
    caption: 'You press a key. A finger pushes a plastic cap down about 4 mm, and a switch underneath closes.',
    width: 0.45,
    // centred on the A key, nudged right so that the focus rectangle stays inside the frame
    focus: { x: 90, y: keyCentre(keyA()).y },
    chapter: { slug: 'shannons-switches', number: 6, title: 'Shannon’s switches' },
  },
  {
    id: 'matrix',
    title: 'The switch and the matrix',
    caption: 'Under each key a switch can join one row wire to one column wire. The controller drives the rows one at a time and reads the columns.',
    width: 0.12,
    focus: { x: 520, y: 75 },
    chapter: { slug: 'building-blocks', number: 13, title: 'Building blocks' },
  },
  {
    id: 'board',
    title: 'The board',
    caption: 'The wires lead to a microcontroller, which turns “row 1, column 0” into a message for the USB connector.',
    width: 0.035,
    focus: { x: 330, y: 205 },
    chapter: { slug: 'talking-to-the-world', number: 24, title: 'Talking to the world' },
  },
  {
    id: 'package',
    title: 'The chip package',
    caption: 'A black plastic package, 7 mm across, protects a much smaller piece of silicon and brings its connections out to the board.',
    width: 0.0144,
    focus: { x: 320, y: 200 },
    chapter: { slug: 'breadboard-to-billions', number: 32, title: 'From breadboard to billions' },
  },
  {
    id: 'die',
    title: 'The die',
    caption: 'The silicon itself, about 3 mm square: memory, a CPU, a USB interface, and bond pads for the tiny wires that lead to the package.',
    width: 0.005,
    focus: { x: 375, y: 292 },
    chapter: { slug: 'breadboard-to-billions', number: 32, title: 'From breadboard to billions' },
  },
  {
    id: 'gates',
    title: 'A block of gates',
    caption: 'Zoom into the CPU and it is rows of standard cells, gates and flip-flops, joined by layers of metal wire and laid out by software.',
    width: 30e-6,
    focus: { x: 324.8, y: 190.4 },
    chapter: { slug: 'boolean-algebra', number: 11, title: 'Boolean algebra' },
  },
  {
    id: 'cmos',
    title: 'One CMOS gate',
    caption: 'A NAND gate is four transistors: two p-type in parallel from the supply to the output, two n-type in series from the output to ground.',
    width: 1.6e-6,
    focus: { x: 285, y: 275 },
    chapter: { slug: 'cmos', number: 9, title: 'CMOS' },
  },
  {
    id: 'lattice',
    title: 'The silicon lattice',
    caption: 'Silicon atoms in a crystal, each sharing electrons with four neighbours. A few are replaced by phosphorus or boron, and that is what doping means.',
    width: 5e-9,
    focus: { x: 320, y: 200 },
    chapter: { slug: 'diodes-and-leds', number: 7, title: 'Semiconductors, diodes and LEDs' },
  },
];

export const LEVEL_COUNT = LEVELS.length;
export const LAST = LEVEL_COUNT - 1;

/** Zoom factor from level i to level i + 1. */
export function stepFactor(i: number, levels: readonly Level[] = LEVELS): number {
  const a = levels[i];
  const b = levels[i + 1];
  if (!a || !b) return 1;
  return a.width / b.width;
}

/** The focus rectangle of level i, in its own coordinates. */
export function focusRect(i: number, levels: readonly Level[] = LEVELS): { x: number; y: number; w: number; h: number } {
  const S = stepFactor(i, levels);
  const w = FRAME.w / S;
  const h = FRAME.h / S;
  const c = levels[i]!.focus;
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

/** Fraction of the way the visible rectangle has moved to the focus when the zoom is `t` (0..1) of the way there. */
export function pan(t: number, S: number): number {
  if (S <= 1 + 1e-9) return t;
  return (1 - S ** -t) / (1 - 1 / S);
}

export interface LevelView {
  /** SVG transform matrix parameters: x' = scale·x + tx, y' = scale·y + ty. */
  scale: number;
  tx: number;
  ty: number;
  /** 0..1 */
  opacity: number;
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How visible a level is, as a function of t = z − i (t < 0: approaching it, t > 0: leaving it). */
export function opacityAt(t: number): number {
  if (t < 0) return smoothstep(-0.85, -0.35, t);
  return 1 - smoothstep(0.35, 0.85, t);
}

/**
 * Where and how big level `i` is drawn when the camera is at `z` (0 = the keyboard, LAST = the
 * lattice). Levels far from `z` get opacity 0.
 */
export function levelView(i: number, z: number, levels: readonly Level[] = LEVELS): LevelView {
  const t = z - i;
  const opacity = opacityAt(t);
  if (t >= 0) {
    // Zooming into level i: the camera rectangle shrinks towards level i's focus.
    const S = stepFactor(i, levels);
    const s = S ** t;
    const f = focusRect(i, levels);
    const u = pan(t, S);
    return { scale: s, tx: 0 - f.x * u * s, ty: 0 - f.y * u * s, opacity };
  }
  // Level i is inside the focus rectangle of level i − 1, and grows as the camera zooms in on it.
  const p = i - 1;
  if (p < 0) return { scale: 1, tx: 0, ty: 0, opacity };
  const S = stepFactor(p, levels);
  const u = t + 1; // progress of the zoom from p to i
  const s = S ** (u - 1); // = S^t
  const f = focusRect(p, levels);
  const left = f.x * pan(u, S);
  const top = f.y * pan(u, S);
  const k = S ** u;
  return { scale: s, tx: (f.x - left) * k, ty: (f.y - top) * k, opacity };
}

/** Real width of the picture (metres) when the camera is at `z`, interpolated on a log scale. */
export function viewWidth(z: number, levels: readonly Level[] = LEVELS): number {
  const zc = Math.max(0, Math.min(levels.length - 1, z));
  const i = Math.min(levels.length - 2, Math.floor(zc));
  const t = zc - i;
  const a = levels[i]!.width;
  const b = levels[i + 1]!.width;
  return a * (b / a) ** t;
}

/** "45 cm", "9 cm", "25 mm", "30 µm", "5 nm". */
export function formatLength(m: number): string {
  const units: [number, string][] = [
    [1, 'm'],
    [1e-2, 'cm'],
    [1e-3, 'mm'],
    [1e-6, 'µm'],
    [1e-9, 'nm'],
    [1e-10, 'Å'],
  ];
  // Prefer cm only between 1 cm and 1 m, never for centi- of smaller things.
  let chosen = units[units.length - 1]!;
  for (const u of units) {
    if (m >= u[0] * 0.9995) {
      chosen = u;
      break;
    }
  }
  const v = m / chosen[0];
  const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '');
  return `${s} ${chosen[1]}`;
}

/** The level nearest to z. */
export const nearestLevel = (z: number): number => Math.max(0, Math.min(LAST, Math.round(z)));

/** Clamp a camera position to the valid range. */
export const clampZ = (z: number): number => Math.max(0, Math.min(LAST, z));

/** Time (seconds) the animated zoom from `a` to `b` takes: about 1.3 s per level, whatever the distance. */
export const tourDuration = (a: number, b: number): number => Math.max(0.4, Math.abs(b - a) * 1.3);

/** Ease in and out. */
export const ease = (x: number): number => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

/** A scale bar for a picture `viewWidth` metres across: a round length (1, 2 or 5 × 10ⁿ m) no longer than `maxFraction` of the width. */
export function scaleBar(viewWidth: number, maxFraction = 0.28): { length: number; fraction: number } {
  const target = viewWidth * maxFraction;
  const p = 10 ** Math.floor(Math.log10(target));
  const length = [5, 2, 1].map((m) => m * p).find((l) => l <= target * (1 + 1e-9)) ?? p;
  return { length, fraction: length / viewWidth };
}
