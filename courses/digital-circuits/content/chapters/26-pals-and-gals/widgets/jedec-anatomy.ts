/**
 * The anatomy of a GAL22V10 JEDEC file, for the chapter's inspector: the real file that the course's fitter
 * writes for a design, split into lines, each with an explanation computed from the fuse map (which array row
 * it is, what the macrocell configuration says, what the signature spells) and the two checksums recomputed
 * live so that flipping a fuse shows what they are for.
 */
import { EXAMPLES } from '$lib/studio/examples';
import { fitGal22v10Equations, type GalFit } from '$lib/pld/devices/gal22v10-fit';
import { writeGal22v10Jedec, readGal22v10Jedec } from '$lib/pld/devices/gal22v10-jedec';
import {
  ARRAY_FUSES,
  COLUMNS,
  CONFIG_BASE,
  FUSE_COUNT,
  OLMC_PINS,
  PRODUCT_TERMS,
  ROWS,
  SIGNATURE_BASE,
  decodeRow,
  describeFuse,
  getSignature,
  isOlmcPin,
  olmcIndex,
  rowInfo,
} from '$lib/pld/devices/gal22v10';
import { ETX, STX, fuseChecksum, transmissionChecksum } from '$lib/pld/twolevel/jedec';

export interface DesignChoice {
  id: string;
  label: string;
  /** Example id in the Studio's GAL22V10 examples. */
  example: string;
  clock?: string;
}

export const DESIGNS: readonly DesignChoice[] = [
  { id: 'traffic-light', label: 'Traffic light', example: 'traffic-light', clock: 'CLK' },
  { id: 'decoder', label: '3-to-8 decoder', example: 'decoder' },
];

const strip = (s: string) =>
  s
    .split('\n')
    .filter((l) => !/^\s*#\s*@/.test(l))
    .join('\n');

/** The `# @title` line of a Studio source. */
const titleOf = (s: string) => /^\s*#\s*@title\s+(.*)$/m.exec(s)?.[1]?.trim();

export function fitDesign(id: string): GalFit {
  const d = DESIGNS.find((x) => x.id === id);
  if (!d) throw new Error(`No design ${id}`);
  const ex = EXAMPLES.gal22v10.find((e) => e.id === d.example)!;
  return fitGal22v10Equations(strip(ex.source), { clock: d.clock, title: titleOf(ex.source) });
}

/** The header lines the fitter puts before the first `*`. */
export const headerFor = (fit: GalFit): string[] => ['Device: GAL22V10 (ATF22V10)', ...(fit.design.title ? [`Design: ${fit.design.title}`] : [])];

/** The file for a fuse map (possibly edited). With the fitter's own fuses it is exactly `fit.jedec()`. */
export const render = (fit: GalFit, fuses: ArrayLike<number>): string => writeGal22v10Jedec(fuses, { style: 'standard', header: headerFor(fit) });

export type LineKind = 'stx' | 'header' | 'F' | 'G' | 'QP' | 'QF' | 'array' | 'config' | 'signature' | 'C' | 'end' | 'etx';

export interface Line {
  index: number;
  text: string;
  kind: LineKind;
  /** For L lines: the first fuse number and how many fuses. */
  start?: number;
  length?: number;
}

/** Split a file into lines with their kind. */
export function lines(text: string): Line[] {
  return text
    .replace(/\n$/, '')
    .split('\n')
    .map((raw, index) => {
      const l: Line = { index, text: raw, kind: 'header' };
      if (raw.startsWith(STX)) l.kind = 'stx';
      else if (raw.startsWith(ETX)) l.kind = 'etx';
      else if (raw === '*') l.kind = 'end';
      else if (raw.startsWith('*F')) l.kind = 'F';
      else if (raw.startsWith('*G')) l.kind = 'G';
      else if (raw.startsWith('*QP')) l.kind = 'QP';
      else if (raw.startsWith('*QF')) l.kind = 'QF';
      else if (raw.startsWith('*C')) l.kind = 'C';
      else if (raw.startsWith('*L')) {
        const m = /^\*L(\d+) ([01]+)$/.exec(raw)!;
        l.start = Number(m[1]);
        l.length = m[2]!.length;
        l.kind = l.start >= SIGNATURE_BASE ? 'signature' : l.start >= CONFIG_BASE ? 'config' : 'array';
      }
      return l;
    });
}

const hex4 = (x: number) => x.toString(16).toUpperCase().padStart(4, '0');

export interface Checksums {
  /** The fuse checksum recomputed from the fuse map. */
  fuse: number;
  /** The transmission checksum recomputed from the text. */
  transmission: number;
  /** The values written in the file, if it has them. */
  writtenFuse?: number;
  writtenTransmission?: number;
}

export function checksums(text: string, fuses: ArrayLike<number>): Checksums {
  const etx = text.indexOf(ETX);
  const stx = text.indexOf(STX);
  const c = /\*C([0-9A-Fa-f]{4})/.exec(text);
  const t = /^([0-9A-Fa-f]{4})/.exec(text.slice(etx + 1));
  return {
    fuse: fuseChecksum(fuses),
    transmission: transmissionChecksum(text.slice(stx, etx + 1)),
    writtenFuse: c ? parseInt(c[1]!, 16) : undefined,
    writtenTransmission: t ? parseInt(t[1]!, 16) : undefined,
  };
}

export interface Explanation {
  title: string;
  body: string[];
}

/** The name of the signal on a pin, or "pin N". */
function pinName(fit: GalFit, pin: number): string {
  return fit.pins.find((p) => p.pin === pin)?.name ?? `pin ${pin}`;
}

/**
 * The equation on an array row, in terms of the levels on the pins. A registered macrocell feeds the array
 * with the register's *inverting* output, so in active-high mode the true column of its pin means "the pin is 0":
 * the fuse map says /Q where the equation you wrote says Q, and the other way round (galette compensates for
 * this in the same way).
 */
export function termText(fit: GalFit, fuses: ArrayLike<number>, row: number): string {
  const t = decodeRow(fuses, row);
  if (t.kind === 'false') return 'never true (a signal is connected both ways, or the row was left blank)';
  if (t.kind === 'true') return 'always true (nothing is connected)';
  const invertedFeedback = (pin: number): boolean => {
    if (!isOlmcPin(pin)) return false;
    const i = olmcIndex(pin);
    const registered = fuses[CONFIG_BASE + 2 * i + 1] === 0;
    const activeHigh = fuses[CONFIG_BASE + 2 * i] === 1;
    return registered && activeHigh;
  };
  return t.literals.map((l) => `${l.complement !== invertedFeedback(l.pin) ? '/' : ''}${pinName(fit, l.pin)}`).join(' · ');
}

export function explain(line: Line, fit: GalFit, fuses: ArrayLike<number>): Explanation {
  const sums = checksums('', fuses);
  switch (line.kind) {
    case 'stx':
      return { title: 'STX', body: ['Start of text, byte 02. Everything from here to ETX is one transmission, and the last checksum adds up every byte in between.'] };
    case 'header':
      return { title: 'Design specification', body: ['Free text up to the first “*”. Programmers ignore it; people read it. The fitter puts the device and the design name here.'] };
    case 'F':
      return { title: '*F0: default fuse state', body: ['Every fuse not listed in an L line is 0. In a GAL a 0 fuse connects its column to the product term, so an unlisted row connects both the true and the complement of every signal: it is x · x̄ = 0, a product term that is never true. That is why unused rows are simply left out.'] };
    case 'G':
      return { title: '*G0: security fuse', body: ['0: not set. Setting it (G1) blocks reading the fuse map back out of the chip. Nothing here uses it.'] };
    case 'QP':
      return { title: '*QP24: pins', body: ['The device has 24 pins. A programmer checks this against the chip in its socket.'] };
    case 'QF':
      return {
        title: '*QF5892: number of fuses',
        body: [`${ROWS} rows × ${COLUMNS} columns = ${ARRAY_FUSES} array fuses, then ${FUSE_COUNT - SIGNATURE_BASE + (SIGNATURE_BASE - CONFIG_BASE)} more: 20 configuration fuses (two for each of the ten macrocells) and 64 for the user signature. ${ARRAY_FUSES} + 20 + 64 = ${FUSE_COUNT}.`],
      };
    case 'array': {
      const row = line.start! / COLUMNS;
      const info = rowInfo(row);
      const what =
        info.kind === 'AR'
          ? 'the asynchronous reset term (AR): when it is true every register clears at once'
          : info.kind === 'SP'
            ? 'the synchronous preset term (SP): when it is true at a clock edge every register sets'
            : info.kind === 'OE'
              ? `the output-enable term of the macrocell on pin ${info.pin} (${pinName(fit, info.pin!)})`
              : `product term ${info.term! + 1} of ${PRODUCT_TERMS[info.pin!]} of the macrocell on pin ${info.pin} (${pinName(fit, info.pin!)})`;
      return {
        title: `*L${String(line.start).padStart(4, '0')}: row ${row} of the AND array`,
        body: [
          `Fuses ${line.start} to ${line.start! + COLUMNS - 1}: one row of the AND array, ${what}.`,
          `The 44 bits are 22 pairs, one pair for each signal: the first bit connects the signal, the second its complement. A 0 connects.`,
          `This row computes: ${termText(fit, fuses, row)}.`,
          ...(info.kind !== 'AR' && info.kind !== 'SP' && hasRegisteredFeedback(fuses, row) ? ['A registered output feeds the array with the flip-flop’s inverting output, so the fuse map holds the opposite of the literal you wrote for it; the line above has undone that.'] : []),
        ],
      };
    }
    case 'config': {
      const rows = OLMC_PINS.map((pin, i) => {
        const s0 = fuses[CONFIG_BASE + 2 * i]!;
        const s1 = fuses[CONFIG_BASE + 2 * i + 1]!;
        return `pin ${pin} (${pinName(fit, pin)}): S0 = ${s0}, S1 = ${s1}: ${s1 ? 'combinational' : 'registered'}, active ${s0 ? 'high' : 'low'}`;
      });
      return { title: `*L${CONFIG_BASE}: macrocell configuration`, body: ['Two fuses for each output macrocell, from pin 23 down to pin 14. S0 = 1 is active high, S0 = 0 active low; S1 = 1 is combinational, S1 = 0 is registered.', ...rows] };
    }
    case 'signature': {
      const sig = getSignature(Uint8Array.from(fuses));
      const text = Array.from(sig, (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '·')).join('');
      return { title: `*L${SIGNATURE_BASE}: user signature`, body: [`64 bits = 8 bytes of your own, readable from the chip even when the array is protected. These spell “${text}”: the first eight characters of the design’s title.`] };
    }
    case 'C':
      return {
        title: `*C${hex4(sums.fuse)}: fuse checksum`,
        body: [
          'Take the fuse map as bytes, the first fuse in the least significant bit of the first byte, and add them all up, keeping 16 bits. A programmer recomputes this after reading the file and refuses the file if it differs, which catches a bit flipped in transit or by a careless edit of the fuse lines.',
          `Recomputed from the fuse map now: ${hex4(sums.fuse)}.`,
        ],
      };
    case 'end':
      return { title: '*', body: ['The last field ends here.'] };
    case 'etx':
      return { title: 'ETX and the transmission checksum', body: ['End of text, byte 03, and then four hex digits: the sum of every byte of the file from STX to ETX inclusive, in 16 bits. It covers the header and the format fields as well as the fuses.'] };
  }
}

/** Does this row connect the feedback of a registered, active-high output? */
function hasRegisteredFeedback(fuses: ArrayLike<number>, row: number): boolean {
  const t = decodeRow(fuses, row);
  return t.literals.some((l) => isOlmcPin(l.pin) && fuses[CONFIG_BASE + 2 * olmcIndex(l.pin) + 1] === 0 && fuses[CONFIG_BASE + 2 * olmcIndex(l.pin)] === 1);
}

/** A copy of the fuse array with one fuse flipped. */
export function flipped(fuses: ArrayLike<number>, index: number): Uint8Array {
  if (!Number.isInteger(index) || index < 0 || index >= FUSE_COUNT) throw new RangeError(`Fuse ${index} out of range (0–${FUSE_COUNT - 1})`);
  const out = Uint8Array.from(fuses);
  out[index] = out[index] ? 0 : 1;
  return out;
}

/** Does a programmer accept the file (both checksums right, right size)? */
export function accepted(text: string): boolean {
  try {
    readGal22v10Jedec(text, true);
    return true;
  } catch {
    return false;
  }
}

/** One sentence about one fuse, for hovering over a bit of an L line. */
export function fuseText(fit: GalFit, fuses: ArrayLike<number>, index: number): string {
  const f = describeFuse(index);
  const v = fuses[index];
  if (f.kind === 'array') {
    const sig = pinName(fit, f.inputPin);
    const what = `${f.complement ? 'the complement of ' : ''}${sig}`;
    const where = f.rowKind === 'AR' ? 'the AR term' : f.rowKind === 'SP' ? 'the SP term' : f.rowKind === 'OE' ? `the output-enable term of pin ${f.olmcPin}` : `term ${f.term! + 1} of pin ${f.olmcPin}`;
    return `Fuse ${index}: row ${f.row}, column ${f.column}. ${v ? 'Not connected' : 'Connected'}: ${what} ${v ? 'is left out of' : 'is an input of'} ${where}.`;
  }
  if (f.kind === 'signature') return `Fuse ${index}: bit ${f.bit} of signature byte ${f.byte}.`;
  if (f.kind === 'S0') return `Fuse ${index}: S0 of pin ${f.pin}. ${v ? 'Active high' : 'Active low'}.`;
  return `Fuse ${index}: S1 of pin ${f.pin}. ${v ? 'Combinational' : 'Registered'}.`;
}

/** The file as a hand edit would leave it: the fuses changed, but the checksums still those of `before`. */
export function withStaleChecksums(fit: GalFit, before: string, fuses: ArrayLike<number>): string {
  const b = checksums(before, [] as number[]);
  const text = render(fit, fuses);
  return text
    .replace(/\*C[0-9A-F]{4}/, `*C${hex4(b.writtenFuse!)}`)
    .replace(/(\x03)[0-9A-F]{4}/, `$1${hex4(b.writtenTransmission!)}`);
}
