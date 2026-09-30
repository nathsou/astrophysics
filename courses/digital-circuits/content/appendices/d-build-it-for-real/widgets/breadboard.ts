/**
 * A solderless breadboard, small enough to draw at phone width: twelve columns, two halves of five holes per column
 * with a gap between them, and a pair of power rails above and below.
 *
 * The connections are the whole point. Inside the board, the five holes of one column of one half are joined by a
 * metal strip, the two halves are not joined to each other (that is what the chip straddles), and each rail runs the
 * length of the board (some full-size boards split their rails in the middle; this one does not).
 */

export const BOARD = {
  cols: 12,
  pitch: 22,
  /** x of column 1. */
  x0: 76,
  /** y of the first row of each half. */
  topY: 88,
  bottomY: 212,
  width: 380,
  height: 384,
} as const;

export type Zone = 't' | 'b' | 'rail';
export const TOP_ROWS = ['a', 'b', 'c', 'd', 'e'] as const;
export const BOTTOM_ROWS = ['f', 'g', 'h', 'i', 'j'] as const;

/** The four rails, from the top of the drawing to the bottom. */
export const RAILS = [
  { id: 'top-minus', y: 26, sign: '−' },
  { id: 'top-plus', y: 48, sign: '+' },
  { id: 'bottom-minus', y: 336, sign: '−' },
  { id: 'bottom-plus', y: 358, sign: '+' },
] as const;

export interface Hole {
  zone: Zone;
  col: number;
  /** a–e or f–j for a terminal strip; the rail's id for a rail. */
  row: string;
  x: number;
  y: number;
}

export const colX = (col: number) => BOARD.x0 + (col - 1) * BOARD.pitch;

export const HOLES: Hole[] = [
  ...Array.from({ length: BOARD.cols }, (_, i) => i + 1).flatMap((col) => [
    ...TOP_ROWS.map((row, k): Hole => ({ zone: 't', col, row, x: colX(col), y: BOARD.topY + k * BOARD.pitch })),
    ...BOTTOM_ROWS.map((row, k): Hole => ({ zone: 'b', col, row, x: colX(col), y: BOARD.bottomY + k * BOARD.pitch })),
    ...RAILS.map((r): Hole => ({ zone: 'rail', col, row: r.id, x: colX(col), y: r.y })),
  ]),
];

export function holeAt(zone: Zone, col: number, row: string): Hole | undefined {
  return HOLES.find((h) => h.zone === zone && h.col === col && h.row === row);
}

/** The name of the metal strip a hole is on: a column of one half, or a rail. */
export const groupOf = (h: Hole): string => (h.zone === 'rail' ? h.row : `${h.zone}${h.col}`);

/** Every hole joined to `h` by the board itself. */
export function connected(h: Hole): Hole[] {
  const g = groupOf(h);
  return HOLES.filter((x) => groupOf(x) === g);
}

/** The holes of a group, by its name. */
export const holesOf = (group: string): Hole[] => HOLES.filter((x) => groupOf(x) === group);

/** A name a person would use for a hole: "3c" (column 3, row c), or "top + rail". */
export function nameOf(h: Hole): string {
  if (h.zone !== 'rail') return `${h.col}${h.row}`;
  const r = RAILS.find((x) => x.id === h.row)!;
  return `${h.row.startsWith('top') ? 'top' : 'bottom'} ${r.sign} rail`;
}

/** What is joined, in words, for the caption under the drawing. */
export function describe(group: string): string {
  const hs = holesOf(group);
  if (group.startsWith('t') || group.startsWith('b')) {
    const first = hs[0]!;
    const last = hs.at(-1)!;
    return `Holes ${nameOf(first)} to ${nameOf(last)}: five holes, one strip of metal. Anything pushed into any of them is joined to everything pushed into the others.`;
  }
  const r = RAILS.find((x) => x.id === group)!;
  return `The ${group.startsWith('top') ? 'top' : 'bottom'} ${r.sign} rail: all ${hs.length} holes are one wire, along the whole length of the board. This is where the supply goes.`;
}

// ── The example circuit drawn on it ──────────────────────────────────────────────────────────────────────────────

/**
 * A 74HC04 with one inverter lit: the chip straddles the gap in columns 5 to 11, notch to the left, so pin 1 is the
 * bottom-left pin and the numbers run to the right along the bottom and back along the top. Pin 14 (VCC) is
 * top-left, pin 7 (GND) bottom-right.
 */
export const CHIP = { firstCol: 5, pins: 14, name: '74HC04' } as const;

/** The column and half of a pin of the chip. */
export function pinHole(pin: number): Hole {
  const per = CHIP.pins / 2;
  if (pin <= per) return holeAt('b', CHIP.firstCol + pin - 1, 'f')!;
  return holeAt('t', CHIP.firstCol + (CHIP.pins - pin), 'e')!;
}

export type Colour = 'red' | 'black';

export interface Wire {
  id: string;
  colour: Colour;
  from: Hole;
  to: Hole;
  /** Extra points for a wire that does not run straight. */
  via?: { x: number; y: number }[];
}

const hole = (zone: Zone, col: number, row: string): Hole => {
  const h = holeAt(zone, col, row);
  if (!h) throw new Error(`no hole ${zone}${col}${row}`);
  return h;
};

export const WIRES: Wire[] = [
  { id: 'vcc', colour: 'red', from: hole('t', CHIP.firstCol, 'a'), to: hole('rail', CHIP.firstCol, 'top-plus') },
  { id: 'gnd', colour: 'black', from: hole('b', CHIP.firstCol + 6, 'j'), to: hole('rail', CHIP.firstCol + 6, 'bottom-minus') },
  { id: 'input', colour: 'black', from: hole('b', CHIP.firstCol, 'j'), to: hole('rail', CHIP.firstCol, 'bottom-minus') },
  {
    id: 'bridge',
    colour: 'black',
    from: hole('rail', 1, 'top-minus'),
    to: hole('rail', 1, 'bottom-minus'),
    via: [
      { x: 44, y: 26 },
      { x: 44, y: 336 },
    ],
  },
];

/** The supply's two leads, entering at the right-hand end of the top rails. */
export const LEADS = [
  { id: 'lead-plus', colour: 'red' as const, to: hole('rail', BOARD.cols, 'top-plus'), label: '+5 V' },
  { id: 'lead-minus', colour: 'black' as const, to: hole('rail', BOARD.cols, 'top-minus'), label: '0 V' },
];

/** The parts on the board, by the holes they span. */
export const PLACED = {
  capacitor: { from: hole('rail', 3, 'top-plus'), to: hole('rail', 3, 'top-minus'), label: '100 nF' },
  resistor: { from: hole('b', 2, 'h'), to: hole('b', 6, 'h'), label: '1 kΩ' },
  led: { anode: hole('b', 2, 'j'), cathode: hole('rail', 2, 'bottom-minus') },
} as const;
