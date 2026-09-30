/**
 * The labs of the course: every `:::real{parts="…"}` block of every chapter, with the chapter it is in, the section
 * it sits under, and its parts list.
 *
 * The blocks are read from the chapters' Markdown by `extractLabs`. A browser bundle cannot read the chapters at run
 * time without shipping all of them, so the result is committed as `../labs.json`, and `build-it-for-real.test.ts`
 * fails when a chapter's `:::real` blocks and the file disagree (`UPDATE_LABS=1 npx vitest run
 * content/appendices/d-build-it-for-real` rewrites it). Adding a lab to a chapter is therefore one command; if the lab
 * names a part the bill of materials does not know, the same test says which (add a row to `bom.ts`).
 */
import { PARTS } from '$content/outline';
import labsJson from '../labs.json';

/** What `extractLabs` finds in one chapter. */
export interface RawLab {
  /** The chapter's slug, e.g. "ohms-law". */
  chapter: string;
  /** 1 for the first `:::real` block of the chapter, 2 for the second. */
  n: number;
  /** The id of the section the block sits under (the compiler's heading id), for a link. */
  heading: string;
  /** The text of that heading. */
  headingText: string;
  /** The `parts` attribute, as written. */
  parts: string;
  /** The first sentence of the block, as plain text. */
  lead: string;
}

/** The compiler's `slugify` (tools/markdown/compile.ts), with its counter for repeated headings. */
function slugify(text: string, seen: Map<string, number>): string {
  const base =
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-') || 'section';
  const n = seen.get(base) ?? 0;
  seen.set(base, n + 1);
  return n ? `${base}-${n}` : base;
}

/** The text of a heading as the compiler's `toString` sees it: inline Markup and directives reduced to their words. */
function plain(md: string): string {
  return md
    .replace(/:[a-z]+\[([^\]]*)\](?:\{[^}]*\})?/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__|\*|(?<![A-Za-z0-9])_|_(?![A-Za-z0-9]))/g, '')
    .trim();
}

/** The first sentence of a block, without Markdown, citations or figure references, cut to a length that fits a row. */
function leadOf(body: string): string {
  const para = body.split('\n').filter((l) => !/^:{3,}/.test(l)).join('\n').trim().split(/\n\s*\n/)[0] ?? '';
  const text = plain(para.replace(/:cite\[[^\]]*\]/g, '').replace(/\s+/g, ' '));
  const end = /[.!?](?=\s|$)/.exec(text.replace(/\([^)]*\)/g, (m) => ' '.repeat(m.length)));
  const first = end ? text.slice(0, end.index + 1) : text;
  return first.length > 150 ? `${first.slice(0, 147).trimEnd()}…` : first;
}

/** The value of `parts="…"` (or `parts='…'`) in a directive's attribute block. */
function partsOf(attrs: string): string {
  const m = /\bparts\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(attrs);
  return (m?.[1] ?? m?.[2] ?? '').trim();
}

/** Every `:::real` block of one chapter's Markdown, in order. `chapter` is the chapter's slug. */
export function extractLabs(chapter: string, text: string): RawLab[] {
  const lines = text.split('\n');
  const seen = new Map<string, number>();
  const labs: RawLab[] = [];
  let heading = { id: '', text: '' };
  let fence: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const f = /^(\s*)(`{3,}|~{3,})/.exec(line);
    if (f) {
      if (!fence) fence = f[2]![0]!.repeat(3);
      else if (line.trim().startsWith(fence)) fence = undefined;
      continue;
    }
    if (fence) continue;
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      const t = plain(h[2]!);
      heading = { id: slugify(t, seen), text: t };
      continue;
    }
    const d = /^(:{3,})real\b(?:\[[^\]]*\])?\s*(?:\{([^}]*)\})?\s*$/.exec(line);
    if (!d) continue;
    const colons = d[1]!;
    const body: string[] = [];
    for (i++; i < lines.length && lines[i]!.trim() !== colons; i++) body.push(lines[i]!);
    labs.push({
      chapter,
      n: labs.length + 1,
      heading: heading.id,
      headingText: heading.text,
      parts: partsOf(d[2] ?? ''),
      lead: leadOf(body.join('\n')),
    });
  }
  return labs;
}

// ── The labs, with their place in the course ─────────────────────────────────────────────────────────────────────

/** One lab, ready to show. */
export interface Lab extends RawLab {
  /** "chapter-slug#n": the key of a lab in this appendix. */
  key: string;
  /** The chapter's number ("0" … "32"). */
  number: string;
  chapterTitle: string;
  /** The part of the course: "0", "I" … "VI", "E". */
  part: string;
  /** What is built, in a few words. */
  title: string;
}

/**
 * What each lab builds, in a few words. A lab that is not in this table (a new one) is shown with the first sentence of
 * its block instead. Keys are `<chapter slug>` for the first lab of a chapter and `<chapter slug>#2` for the second.
 */
export const LAB_TITLES: Record<string, string> = {
  'press-a-key': 'Open an old keyboard and find its controller',
  'charge-voltage-current': 'Measure a cell and its internal resistance',
  'ohms-law': 'An LED and its resistor; a measured divider',
  'the-bench': 'Learn the multimeter’s dial',
  'capacitors-and-time': 'An LED fading through a big RC; measure τ',
  relays: 'A relay driven by a transistor, with its flyback diode',
  'shannons-switches': 'A staircase light from two SPDT switches',
  'shannons-switches#2': 'Relay AND and OR gates',
  'diodes-and-leds': 'Plot an LED’s I–V curve by hand',
  'the-transistor': 'A transistor switch and an RTL inverter chain',
  cmos: 'A discrete CMOS inverter',
  'real-gates': '74HC04 transfer curve; an open-drain wired-AND',
  'boolean-algebra': 'XOR from four NANDs',
  'simplifying-logic': 'The majority function, built two ways',
  'building-blocks': 'One segment of a 7-segment decoder from gates',
  arithmetic: 'A 4-bit adder with DIP switches and LEDs',
  timing: 'A glitch slowed down until you can see it',
  feedback: 'A NAND SR latch; a ring oscillator slowed to a blink',
  'the-clock': 'A 555 astable; a debounced button toggling a flip-flop',
  'registers-and-counters': 'A 74HC161 counting on LEDs; a 74HC595 driving eight LEDs',
  'state-machines': 'The traffic-light FSM from flip-flops and gates',
  memory: 'Read and write a 62256 SRAM by hand',
  datapath: 'A program counter from a 74HC161',
  control: 'A control store on a breadboard',
  'running-programs': 'Deposit and examine bytes like an Altair',
  'talking-to-the-world': 'A 74HC595 on SPI, watched by a logic analyser',
  'talking-to-the-world#2': 'An R-2R DAC from resistors',
  'programmable-logic': 'A 28C16 EEPROM as a 7-segment decoder',
  'pals-and-gals': 'The traffic light in one ATF22V10',
  cplds: 'Read a CPLD’s IDCODE, boundary-scan a pin, program it over JTAG',
  'inside-an-fpga': 'Blink an LED on an iCE40; find a LUT in its bitstream',
  'describing-hardware': 'Nothing to wire: a board for the designs of Chapter 31 (optional)',
  'netlist-to-bitstream': 'The same counter through Yosys and nextpnr',
  'cpus-on-a-chip': 'PicoRV32 on an iCEBreaker, with a serial port to your terminal',
  'breadboard-to-billions': 'Look at the die of a windowed EPROM',
};

const chapterInfo = new Map(
  PARTS.flatMap((p) => p.chapters.map((c) => [c.slug, { number: c.number, title: c.title, part: p.id }] as const)),
);

/** Build the displayed labs from raw ones (in course order). */
export function labsFrom(raw: RawLab[]): Lab[] {
  const labs: Lab[] = [];
  for (const r of raw) {
    const c = chapterInfo.get(r.chapter);
    if (!c) continue;
    const key = r.n === 1 ? r.chapter : `${r.chapter}#${r.n}`;
    labs.push({ ...r, key, number: c.number, chapterTitle: c.title, part: c.part, title: LAB_TITLES[key] ?? r.lead });
  }
  const order = [...chapterInfo.keys()];
  return labs.sort((a, b) => order.indexOf(a.chapter) - order.indexOf(b.chapter) || a.n - b.n);
}

/** Every lab in the chapters (as of the last `UPDATE_LABS=1` run of the test). */
export const LABS: Lab[] = labsFrom(labsJson as RawLab[]);

/** The parts of the course, for grouping. */
export const COURSE_PARTS = PARTS.map((p) => ({ id: p.id, title: p.title })).filter((p) => LABS.some((l) => l.part === p.id));

/** The parts of the course whose labs make up the "minimal kit": Parts I to IV. */
export const MINIMAL_PARTS = ['I', 'II', 'III', 'IV'];
