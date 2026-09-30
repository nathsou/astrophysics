/**
 * The bill of materials: every part named in the `parts` attribute of any lab, deduplicated, grouped, counted, with
 * the chapters that use it.
 *
 * The labs' parts lists are prose ("2 × LEDs", "10 kΩ and 20 kΩ resistors", "74HC74 (dual D flip-flop)"), so each
 * list is cut into items (`partItems`), and each item is matched against the rows below (`ROWS`). Every item of every
 * lab must match at least one row: the test says which item does not, and a new part is one new row here.
 *
 * Quantities are the most that any single lab needs, since a lab is built and then taken apart. They come from the
 * lists themselves ("3 × 100 kΩ resistors"). Should a lab's text ever ask for more than its `parts` list says,
 * `ADJUSTS` is the stopgap that adds it, with the words of the chapter that justify it (the test looks them up, and
 * fails once the chapter's own list says it too); the better fix is the chapter's list.
 */
import { MINIMAL_PARTS, type Lab } from './labs';

export type GroupId = 'passive' | 'semi' | 'led' | 'logic' | 'memory' | 'pld' | 'board' | 'switch' | 'wire' | 'tool';

export const GROUPS: { id: GroupId; title: string; blurb: string }[] = [
  { id: 'passive', title: 'Resistors, capacitors and potentiometers', blurb: 'Quarter-watt resistors, 5 % or better; ceramic capacitors except where an electrolytic is named.' },
  { id: 'semi', title: 'Diodes and transistors', blurb: 'Discrete semiconductors in TO-92 and glass packages.' },
  { id: 'led', title: 'LEDs and displays', blurb: '5 mm LEDs; every one needs a resistor of its own.' },
  { id: 'logic', title: '74HC logic and the 555', blurb: 'DIP packages, so that they fit across the gap of a breadboard.' },
  { id: 'memory', title: 'Memories', blurb: 'Parallel memories in DIP packages.' },
  { id: 'pld', title: 'Programmable logic', blurb: 'The chips of Part VI and the boards that carry them.' },
  { id: 'board', title: 'Microcontrollers and boards', blurb: 'Any 5 V board with an SPI port and a serial port will do.' },
  { id: 'switch', title: 'Switches, relays and power', blurb: 'Everything runs from a 5 V USB supply, a 9 V battery or AA cells.' },
  { id: 'wire', title: 'Wiring', blurb: 'What everything else is plugged into.' },
  { id: 'tool', title: 'Tools, software and household items', blurb: 'What the labs use besides parts. Chapter 3 and the section on tools say more.' },
];

export interface Row {
  id: string;
  group: GroupId;
  name: string;
  /** A few words on what to buy. */
  detail?: string;
  /** Matches an item of a lab's parts list. */
  test: RegExp;
  /** Match against the text as written, including parentheses (for items that name parts in brackets). */
  raw?: boolean;
  /** How many the item asks for; the default reads a leading "4 ×", "8 LEDs" or "two". */
  count?: (item: string) => number;
  /** Free software: no quantity. */
  software?: boolean;
  /** No useful count (a handful of jumper wires). */
  assorted?: boolean;
}

/** A leading count: "4 × 10 kΩ", "8 LEDs", "3 push-buttons", "two leads". Anything else is one. */
export function leadCount(item: string): number {
  let m = /^(\d+)\s*×/.exec(item);
  if (m) return Number(m[1]);
  m = /^(\d+) (?=LED|DIP|switches|push-?buttons?)/.exec(item);
  if (m) return Number(m[1]);
  if (/^two /i.test(item)) return 2;
  return 1;
}

const res = (id: string, name: string, test: RegExp): Row => ({ id, group: 'passive', name, test });

export const ROWS: Row[] = [
  // Passives
  res('r-100', '100 Ω resistor', /(?<![\d.])100 Ω/),
  res('r-220', '220 Ω resistor', /(?<![\d.])220 Ω/),
  res('r-330', '330 Ω resistor', /(?<![\d.])330 Ω/),
  res('r-390', '390 Ω resistor', /(?<![\d.])390 Ω/),
  res('r-470', '470 Ω resistor', /(?<![\d.])470 Ω/),
  res('r-1k', '1 kΩ resistor', /(?<![\d.])1 kΩ/),
  res('r-4k7', '4.7 kΩ resistor', /(?<![\d.])4\.7 kΩ/),
  res('r-10k', '10 kΩ resistor', /(?<![\d.])10 kΩ(?! potentiometer)/),
  res('r-20k', '20 kΩ resistor', /(?<![\d.])20 kΩ/),
  res('r-47k', '47 kΩ resistor', /(?<![\d.])47 kΩ/),
  res('r-100k', '100 kΩ resistor', /(?<![\d.])100 kΩ(?! potentiometer)/),
  res('r-1M', '1 MΩ resistor', /(?<![\d.])1 MΩ/),
  res('r-10M', '10 MΩ resistor', /(?<![\d.])10 MΩ/),
  { id: 'r-any', group: 'passive', name: 'Two resistors of any two values', detail: 'Chapter 3’s divider: any of those above will do.', test: /resistors of different values/ },
  { id: 'c-10n', group: 'passive', name: '10 nF capacitor', test: /(?<![\d.])10 nF/ },
  { id: 'c-100n', group: 'passive', name: '100 nF capacitor', detail: 'ceramic; the decoupling capacitor', test: /(?<![\d.])100 nF/ },
  { id: 'c-1u', group: 'passive', name: '1 µF capacitor', test: /(?<![\d.])1 µF/ },
  { id: 'c-10u', group: 'passive', name: '10 µF electrolytic capacitor', detail: 'stripe marks the negative leg', test: /(?<![\d.])10 µF/ },
  { id: 'c-1000u', group: 'passive', name: '1000 µF electrolytic capacitor', detail: '10 V or more; stripe marks the negative leg', test: /1000 µF/ },
  { id: 'pot-10k', group: 'passive', name: '10 kΩ potentiometer', test: /(?<![\d.])10 kΩ potentiometer/ },
  { id: 'pot-100k', group: 'passive', name: '100 kΩ potentiometer', detail: 'linear', test: /(?<![\d.])100 kΩ potentiometer/ },

  // Diodes and transistors
  { id: 'd-1n4148', group: 'semi', name: '1N4148 diode', detail: 'a 1N4007 also works as the relay’s flyback diode (Chapter 5)', test: /1N4148/ },
  { id: 'q-2n3904', group: 'semi', name: '2N3904 NPN transistor', detail: 'or any small NPN', test: /2N3904/ },
  { id: 'q-2n7000', group: 'semi', name: '2N7000 n-channel MOSFET', test: /2N7000/ },
  { id: 'q-bs250', group: 'semi', name: 'BS250 p-channel MOSFET', test: /BS250/ },

  // LEDs and displays
  { id: 'led', group: 'led', name: 'LED, 5 mm, red', detail: 'any colour will light, but the numbers in the chapters are for red', test: /(?<!(?:amber|green|yellow|blue) )\bLEDs?\b/ },
  { id: 'led-amber', group: 'led', name: 'LED, 5 mm, amber', test: /amber LED/ },
  { id: 'led-green', group: 'led', name: 'LED, 5 mm, green', test: /green LED/ },
  { id: 'seven-seg', group: 'led', name: '7-segment display, common cathode', detail: 'check its pinout before wiring it', test: /7-segment display/ },

  // 74HC logic
  ...(
    [
      ['00', 'quad 2-input NAND'],
      ['02', 'quad 2-input NOR'],
      ['03', 'quad 2-input NAND, open drain'],
      ['04', 'hex inverter'],
      ['08', 'quad 2-input AND'],
      ['14', 'hex Schmitt-trigger inverter'],
      ['32', 'quad 2-input OR'],
      ['74', 'dual D flip-flop'],
      ['86', 'quad 2-input XOR'],
      ['161', '4-bit synchronous counter'],
      ['283', '4-bit adder'],
      ['595', '8-bit shift register with output latch'],
    ] as const
  ).map(([n, what]): Row => ({ id: `hc${n}`, group: 'logic', name: `74HC${n}`, detail: what, test: new RegExp(`74HC${n}\\b`) })),
  { id: 'ne555', group: 'logic', name: 'NE555 timer', detail: 'or LMC555', test: /NE555|555 timer/ },

  // Memories
  { id: 'sram-62256', group: 'memory', name: '62256 SRAM, 32K × 8', detail: '28-pin DIP', test: /62256/, raw: true },
  { id: 'eeprom-28c16', group: 'memory', name: '28C16 EEPROM, 2K × 8', detail: 'a 28C64 or 28C256 also works (Chapter 25)', test: /28C16/, raw: true },
  { id: 'eprom', group: 'memory', name: 'Windowed EPROM', detail: 'a 2764 or 27C64, or similar; an old one from a junk box is ideal (Chapter 32)', test: /(?<!E)EPROM/ },

  // Programmable logic
  { id: 'atf22v10', group: 'pld', name: 'ATF22V10C GAL', detail: '24-pin DIP', test: /ATF22V10/ },
  { id: 'atf1502', group: 'pld', name: 'ATF1502AS CPLD', detail: 'the -7AX44 (TQFP-44) or the -10JU44 (PLCC-44)', test: /ATF1502AS/ },
  { id: 'cpld-board', group: 'pld', name: '44-pin breakout board or socket adapter', detail: 'for TQFP or PLCC; or a ready-made ATF1502 dev board', test: /44-pin breakout board/ },
  { id: 'ice40', group: 'pld', name: 'iCE40 board', detail: 'an iCEstick, an iCEBreaker or any board with an iCE40 HX1K, HX8K or UP5K', test: /iCE40 (?:FPGA )?board/ },

  // Boards
  { id: 'arduino', group: 'board', name: 'Arduino Uno or Nano', detail: 'or any 5 V board', test: /Arduino/ },

  // Switches, relays and power
  { id: 'usb5v', group: 'switch', name: '5 V USB supply module', detail: 'a breadboard power module, or any 5 V USB source', test: /5 V (?:USB )?supply/ },
  { id: 'battery9v', group: 'switch', name: '9 V battery with clip', test: /9 V battery/ },
  { id: 'aa', group: 'switch', name: 'AA cell', detail: 'Chapter 6 uses two in a holder', test: /AA cells?/ },
  { id: 'relay', group: 'switch', name: '5 V relay, SPDT', detail: 'SRD-05VDC-SL-C or similar: 70 Ω coil, changeover contacts', test: /relay/ },
  { id: 'spdt', group: 'switch', name: 'SPDT slide switch', test: /SPDT slide switch/ },
  { id: 'push', group: 'switch', name: 'Pushbutton', detail: 'normally open, for a breadboard', test: /push-?buttons?|push button/ },
  {
    id: 'dip',
    group: 'switch',
    name: 'DIP switch positions',
    detail: 'one 8-way DIP switch, or two 4-way',
    test: /DIP switch/,
    count: (item) => Number(/(\d+)-way/.exec(item)?.[1] ?? leadCount(item)),
  },
  { id: 'toggle', group: 'switch', name: 'Toggle or slide switch, SPST', test: /^\d+ switches$|toggle switch/ },

  // Wiring
  { id: 'breadboard', group: 'wire', name: 'Solderless breadboard', detail: 'half-size or full-size', test: /breadboard/ },
  { id: 'jumpers', group: 'wire', name: 'Jumper wires', detail: 'male-to-male, assorted lengths', test: /jumper wires/, assorted: true },
  { id: 'croc', group: 'wire', name: 'Lead with crocodile clips', test: /crocodile clips/ },

  // Tools, software and household items
  { id: 'multimeter', group: 'tool', name: 'Digital multimeter', detail: 'a second one is convenient in Chapter 10', test: /multimeter/ },
  { id: 'stopwatch', group: 'tool', name: 'Stopwatch', detail: 'a phone will do', test: /stopwatch/ },
  { id: 'analyser', group: 'tool', name: 'USB logic analyser', detail: '8 channels, 24 MHz, sigrok-compatible', test: /logic analyser/ },
  { id: 'pulseview', group: 'tool', name: 'sigrok PulseView', detail: 'free software', test: /PulseView/, software: true },
  { id: 'programmer', group: 'tool', name: 'Universal device programmer', detail: 'TL866 class, with the adapter for 24-pin PLDs', test: /universal programmer/ },
  { id: 'ft232h', group: 'tool', name: 'FT232H USB breakout board', detail: 'the JTAG adapter', test: /FT232H/ },
  { id: 'usb-cable', group: 'tool', name: 'USB cable for the FPGA board', test: /USB cable/ },
  { id: 'yosys', group: 'tool', name: 'Yosys', detail: 'free software', test: /Yosys/, software: true },
  { id: 'nextpnr', group: 'tool', name: 'nextpnr-ice40', detail: 'free software', test: /nextpnr/, software: true },
  { id: 'icestorm', group: 'tool', name: 'Project IceStorm', detail: 'free software', test: /IceStorm/, software: true },
  { id: 'riscv-gcc', group: 'tool', name: 'RISC-V compiler', detail: 'free software: riscv32-unknown-elf-gcc, to build PicoSoC’s firmware', test: /RISC-V compiler/, software: true },
  { id: 'screwdriver', group: 'tool', name: 'Small screwdriver', test: /screwdriver/ },
  { id: 'keyboard', group: 'tool', name: 'Old USB keyboard, unplugged', test: /USB keyboard/ },
  { id: 'loupe', group: 'tool', name: '10× loupe or USB microscope', test: /loupe/ },
  { id: 'lamp', group: 'tool', name: 'Bright lamp', test: /bright lamp/ },
];

const rowById = new Map(ROWS.map((r) => [r.id, r]));
export const rowOf = (id: string): Row => {
  const r = rowById.get(id);
  if (!r) throw new Error(`no bill-of-materials row "${id}"`);
  return r;
};

// ── Cutting a parts list into items ──────────────────────────────────────────────────────────────────────────────

/** Typographic spaces and the two micro and ohm signs, reduced to one spelling. */
export const clean = (s: string): string =>
  s
    .replace(/[   ]/g, ' ')
    .replace(/μ/g, 'µ')
    .replace(/Ω/g, 'Ω')
    .replace(/\s+/g, ' ')
    .trim();

/** "red, amber and green LEDs" → "red LED, amber LED, green LED", so that each colour is an item. */
function expandColours(s: string): string {
  const colour = '(?:red|amber|green|yellow|blue)';
  return s.replace(new RegExp(`\\b${colour}(?:(?:, | and )${colour})+ LEDs`, 'g'), (m) =>
    m
      .replace(/ LEDs$/, '')
      .split(/, | and /)
      .map((c) => `${c} LED`)
      .join(', '),
  );
}

/** A parts list as items: split at the commas that are not inside brackets. */
export function partItems(parts: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of expandColours(clean(parts))) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

/** A number and its unit, joined by a narrow no-break space so that they never split across lines. */
export const nb = (s: string): string => s.replace(/(\d) (kΩ|MΩ|Ω|V|mA|µF|nF|MHz|Hz)(?![A-Za-z])/g, '$1\u202f$2');

const stripBrackets = (s: string) => s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

/** The rows an item names, each with how many the item asks for. */
export function matchItem(item: string): { row: Row; count: number }[] {
  const plain = stripBrackets(item);
  const out: { row: Row; count: number }[] = [];
  for (const row of ROWS) {
    if (!row.test.test(row.raw ? item : plain)) continue;
    out.push({ row, count: (row.count ?? leadCount)(plain) });
  }
  return out;
}

// ── What each lab needs ──────────────────────────────────────────────────────────────────────────────────────────

/** A floor for one row in one lab, for what the lab's text asks for and its `parts` list does not say. */
export interface Adjust {
  /** The lab: "<chapter slug>" or "<chapter slug>#2". */
  lab: string;
  row: string;
  count: number;
  /** Words of the lab's block that justify it; the test checks that they are there. */
  quote: string;
}

/**
 * None at present: every chapter's parts list names all that its lab uses (quantities included), so the bill is the
 * lists and nothing else. A new gap is one entry here; the test fails if an entry has become redundant.
 */
export const ADJUSTS: Adjust[] = [];

/** One lab's needs: row id → count. */
export function needsOf(lab: Lab): Map<string, number> {
  const need = new Map<string, number>();
  for (const item of partItems(lab.parts)) {
    for (const { row, count } of matchItem(item)) need.set(row.id, Math.max(need.get(row.id) ?? 0, count));
  }
  for (const a of ADJUSTS) if (a.lab === lab.key) need.set(a.row, Math.max(need.get(a.row) ?? 0, a.count));
  return need;
}

/** Items of the labs' parts lists that no row names. */
export function unmatchedItems(labs: Lab[]): { lab: string; item: string }[] {
  const out: { lab: string; item: string }[] = [];
  for (const lab of labs) for (const item of partItems(lab.parts)) if (!matchItem(item).length) out.push({ lab: lab.key, item });
  return out;
}

// ── The bill ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Use {
  chapter: string;
  number: string;
  /** The most any lab of this chapter needs. */
  count: number;
}

export interface Line {
  row: Row;
  /** The most any single lab needs (0 if none does: the row is unused). */
  all: number;
  /** The same over the labs of Parts I to IV. */
  minimal: number;
  /** The chapters whose labs use it, in course order. */
  uses: Use[];
}

export function bill(labs: Lab[]): Line[] {
  const lines = new Map<string, Line>(ROWS.map((row) => [row.id, { row, all: 0, minimal: 0, uses: [] }]));
  for (const lab of labs) {
    for (const [id, count] of needsOf(lab)) {
      const line = lines.get(id)!;
      line.all = Math.max(line.all, count);
      if (MINIMAL_PARTS.includes(lab.part)) line.minimal = Math.max(line.minimal, count);
      const use = line.uses.find((u) => u.chapter === lab.chapter);
      if (use) use.count = Math.max(use.count, count);
      else line.uses.push({ chapter: lab.chapter, number: lab.number, count });
    }
  }
  return [...lines.values()];
}

/** How many kinds of thing the lines add up to, leaving out software. */
export const kinds = (lines: Line[], which: 'all' | 'minimal') => lines.filter((l) => l[which] > 0 && !l.row.software).length;
