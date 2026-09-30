/**
 * Appendix D collects the labs of the course. This file checks that it does so completely and accurately:
 *
 * - `labs.json` (which the page is drawn from) lists exactly the `:::real` blocks of the chapters, by chapter, order,
 *   section and parts list. When a chapter gains, loses or changes a block, the test fails and says how to update the
 *   file: `UPDATE_LABS=1 npx vitest run content/appendices/d-build-it-for-real`.
 * - every item of every lab's parts list is named by a row of the bill of materials, and every row is used by some lab;
 * - the quantities add up as the page says (the most any one lab needs, and the same for Parts I to IV);
 * - the adjustments to the bill quote words that are in the chapters;
 * - the pin numbers the page states agree with appendix A and with the chapters;
 * - the page links every chapter that has a lab, and names every kind of tool it promises.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { PARTS } from '$content/outline';
import '$lib/sim/netlist/catalog';
import { getDef, pinsOf } from '$lib/sim/netlist/catalog';
import { CHIPS } from '../a-reference/widgets/pinouts';
import labsJson from './labs.json';
import { ADJUSTS, ROWS, bill, clean, kinds, leadCount, matchItem, needsOf, partItems, rowOf, unmatchedItems } from './widgets/bom';
import { LABS, LAB_TITLES, extractLabs, labsFrom, type RawLab } from './widgets/labs';
import { BOARD, CHIP, HOLES, LEADS, PLACED, RAILS, WIRES, connected, groupOf, holeAt, pinHole } from './widgets/breadboard';

const contentRoot = path.resolve(import.meta.dirname, '../..');
const here = import.meta.dirname;
const chapterSlugs = new Set(PARTS.flatMap((p) => p.chapters.map((c) => c.slug)));

/** Every chapter's Markdown, in course order: [slug, text]. */
function chapters(): [string, string][] {
  const dir = path.join(contentRoot, 'chapters');
  return readdirSync(dir)
    .filter((d) => /^\d\d-/.test(d) && existsSync(path.join(dir, d, 'index.md')))
    .sort()
    .map((d): [string, string] => [d.replace(/^\d\d-/, ''), readFileSync(path.join(dir, d, 'index.md'), 'utf8')])
    .filter(([slug]) => chapterSlugs.has(slug));
}
const chapterText = new Map(chapters());
const fromChapters = (): RawLab[] => chapters().flatMap(([slug, text]) => extractLabs(slug, text));
const md = readFileSync(path.join(here, 'index.md'), 'utf8').replace(/ /g, ' ');

describe('the labs, read from the chapters', () => {
  const found = fromChapters();

  test('labs.json is up to date', () => {
    if (process.env.UPDATE_LABS) writeFileSync(path.join(here, 'labs.json'), `${JSON.stringify(found, null, 2)}\n`);
    const have = process.env.UPDATE_LABS ? found : (labsJson as RawLab[]);
    const key = (l: RawLab) => `${l.chapter}#${l.n}`;
    const missing = found.filter((l) => !have.some((h) => key(h) === key(l)));
    const extra = have.filter((h) => !found.some((l) => key(h) === key(l)));
    const changed = found.filter((l) => {
      const h = have.find((x) => key(x) === key(l));
      return h && JSON.stringify(h) !== JSON.stringify(l);
    });
    const say = (what: string, ls: RawLab[]) => (ls.length ? `\n  ${what}: ${ls.map(key).join(', ')}` : '');
    expect(
      { missing: missing.map(key), extra: extra.map(key), changed: changed.map(key) },
      `labs.json does not match the chapters.${say('new in the chapters', missing)}${say('gone from the chapters', extra)}${say('changed', changed)}\n  Run: UPDATE_LABS=1 npx vitest run content/appendices/d-build-it-for-real`,
    ).toEqual({ missing: [], extra: [], changed: [] });
  });

  test('every chapter with a :::real block is a chapter of the outline, and every lab has a parts list', () => {
    expect(found.length).toBeGreaterThanOrEqual(34);
    for (const l of found) expect(l.parts, `${l.chapter}#${l.n} has no parts="…"`).not.toBe('');
  });

  test('the extractor finds blocks, their sections and their parts', () => {
    const text = [
      '# Title',
      '## First section',
      '```md',
      ':::real{parts="not a lab"}',
      '```',
      '## Build it *for* real',
      ':::real{parts="74HC00, 2 × LED (red, green), 1 kΩ"}',
      'Wire the chip. Then more.',
      ':::',
      '## Build it for real',
      '::::real[Title]{parts="a, b"}',
      ':::note',
      'inside',
      ':::',
      '::::',
    ].join('\n');
    const labs = extractLabs('x', text);
    expect(labs.map((l) => [l.n, l.heading, l.parts, l.lead])).toEqual([
      [1, 'build-it-for-real', '74HC00, 2 × LED (red, green), 1 kΩ', 'Wire the chip.'],
      [2, 'build-it-for-real-1', 'a, b', 'inside'],
    ]);
  });

  test('the section a lab sits under is a heading of its chapter, with the id the compiler gives it', () => {
    for (const l of LABS) {
      const text = chapterText.get(l.chapter)!;
      expect(text, `${l.chapter}: heading "${l.headingText}"`).toMatch(new RegExp(`^#{2,3} .*${l.headingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'));
      expect(l.heading).toMatch(/^[\p{L}\p{N}-]+$/u);
    }
  });

  test('every lab is shown with a title of its own', () => {
    const keys = new Set(LABS.map((l) => l.key));
    for (const k of Object.keys(LAB_TITLES)) expect(keys.has(k), `LAB_TITLES names a lab that does not exist: ${k}`).toBe(true);
    for (const l of LABS) expect(LAB_TITLES[l.key], `add a title for lab ${l.key} to LAB_TITLES in widgets/labs.ts (its first sentence is shown until you do)`).toBeTruthy();
  });

  test('the labs come out in course order', () => {
    const order = PARTS.flatMap((p) => p.chapters.map((c) => c.slug));
    const at = LABS.map((l) => order.indexOf(l.chapter));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(labsFrom([...found].reverse()).map((l) => l.key)).toEqual(labsFrom(found).map((l) => l.key));
  });
});

describe('the bill of materials', () => {
  test('every item of every parts list is named by a row', () => {
    expect(unmatchedItems(LABS), 'these items match no row of the bill: add one to ROWS in widgets/bom.ts').toEqual([]);
  });

  test('every row is used by some lab', () => {
    const used = new Set(LABS.flatMap((l) => [...needsOf(l).keys()]));
    expect(ROWS.filter((r) => !used.has(r.id)).map((r) => r.id), 'rows that no lab uses: remove them from ROWS').toEqual([]);
  });

  test('row ids are unique', () => {
    expect(new Set(ROWS.map((r) => r.id)).size).toBe(ROWS.length);
  });

  test('a parts list is cut at commas outside brackets, and colours become items', () => {
    expect(partItems('74HC00, 62256 (32K × 8 SRAM, 28-pin DIP), 8 × LED')).toEqual(['74HC00', '62256 (32K × 8 SRAM, 28-pin DIP)', '8 × LED']);
    expect(partItems('74HC08, red, amber and green LEDs, 3 × 330 Ω resistors')).toEqual(['74HC08', 'red LED', 'amber LED', 'green LED', '3 × 330 Ω resistors']);
    expect(clean('100 nF μF Ω')).toBe('100 nF µF Ω');
  });

  test('items are counted by their leading number', () => {
    expect(leadCount('4 × 10 kΩ resistors')).toBe(4);
    expect(leadCount('8 LEDs')).toBe(8);
    expect(leadCount('3 push-buttons or a 3-way DIP switch')).toBe(3);
    expect(leadCount('two 74HC595 shift registers')).toBe(2);
    expect(leadCount('10 kΩ and 20 kΩ resistors')).toBe(1);
    expect(leadCount('100 nF capacitor')).toBe(1);
  });

  test('items are matched to the right rows', () => {
    const rows = (s: string) => matchItem(s).map((m) => [m.row.id, m.count]);
    expect(rows('10 kΩ and 20 kΩ resistors')).toEqual([['r-10k', 1], ['r-20k', 1]]);
    expect(rows('8 × 10 kΩ')).toEqual([['r-10k', 8]]);
    expect(rows('9 × 20 kΩ (or 2 × 10 kΩ each)')).toEqual([['r-20k', 9]]);
    expect(rows('100 kΩ potentiometer (linear)')).toEqual([['pot-100k', 1]]);
    expect(rows('10 kΩ potentiometer')).toEqual([['pot-10k', 1]]);
    expect(rows('10 µF and 1 µF capacitors')).toEqual([['c-1u', 1], ['c-10u', 1]].sort((a, b) => ROWS.findIndex((r) => r.id === a[0]) - ROWS.findIndex((r) => r.id === b[0])));
    expect(rows('1000 µF electrolytic capacitor (10 V or more)')).toEqual([['c-1000u', 1]]);
    expect(rows('8-way DIP switch (or two 4-way)')).toEqual([['dip', 8]]);
    expect(rows('4 DIP switches')).toEqual([['dip', 4]]);
    expect(rows('SRAM or EEPROM (a 62256 or a 28C16)').map((r) => r[0])).toEqual(['sram-62256', 'eeprom-28c16']);
    expect(rows('28C16 EEPROM (or 28C64 or 28C256)')).toEqual([['eeprom-28c16', 1]]);
    expect(rows('a windowed EPROM (a 2764, 27C64 or similar)')).toEqual([['eprom', 1]]);
    expect(rows('74HC74 (dual D flip-flop)')).toEqual([['hc74', 1]]);
    expect(rows('74HC161')).toEqual([['hc161', 1]]);
    expect(rows('74HC14')).toEqual([['hc14', 1]]);
    expect(rows('2 × SPDT slide switches')).toEqual([['spdt', 2]]);
    expect(rows('555 timer and its parts from Chapter 17 (or a debounced push button)')).toEqual([['ne555', 1]]);
  });

  const lines = bill(LABS);
  const line = (id: string) => lines.find((l) => l.row.id === id)!;

  test('a quantity is the most that any single lab needs', () => {
    expect(line('led').all).toBe(8); // Chapters 18, 20, 23, 24 and 26 each put eight LEDs on a row
    expect(line('r-330').all).toBe(8);
    expect(line('r-10k').all).toBe(8); // Chapters 14, 23 and 24 (eight pull-downs, or eight ladder resistors)
    expect(line('dip').all).toBe(8);
    expect(line('hc595').all).toBe(2); // Chapter 25's Arduino EEPROM programmer
    expect(line('hc283').all).toBe(2); // Chapter 14's 8-bit adder
    expect(line('relay').all).toBe(2); // Chapter 6's AND and OR
    expect(line('aa').all).toBe(2);
    expect(line('multimeter').all).toBe(1);
  });

  test('the minimal kit is the labs of Parts I to IV, and only those', () => {
    const minimal = new Set(LABS.filter((l) => ['I', 'II', 'III', 'IV'].includes(l.part)).map((l) => l.chapter));
    const numbers = [...minimal].map((s) => Number(LABS.find((l) => l.chapter === s)!.number));
    expect(Math.min(...numbers)).toBe(1);
    expect(Math.max(...numbers)).toBe(20);
    // Parts of Parts V and VI are not in it.
    for (const id of ['ne555', 'hc161', 'sram-62256']) expect(line(id).minimal, id).toBeGreaterThan(0);
    for (const id of ['eeprom-28c16', 'atf22v10', 'atf1502', 'ice40', 'arduino', 'analyser', 'programmer', 'ft232h', 'yosys', 'eprom']) {
      expect(line(id).minimal, `${id} is not in the minimal kit`).toBe(0);
      expect(line(id).all, id).toBeGreaterThan(0);
    }
    for (const l of lines) expect(l.minimal).toBeLessThanOrEqual(l.all);
    expect(kinds(lines, 'minimal')).toBeLessThan(kinds(lines, 'all'));
  });

  test('a row lists exactly the chapters whose labs name it', () => {
    for (const l of lines) {
      const expected = [...new Set(LABS.filter((lab) => needsOf(lab).has(l.row.id)).map((lab) => lab.chapter))];
      expect(l.uses.map((u) => u.chapter).sort(), l.row.id).toEqual(expected.sort());
    }
    expect(line('hc161').uses.map((u) => u.number)).toEqual(['18', '21', '22', '23']);
    expect(line('ne555').uses.map((u) => u.number)).toEqual(['17', '18', '26']);
  });

  test('every chip of appendix A is a row of the bill, under the same part number', () => {
    for (const chip of CHIPS) {
      const row = ROWS.find((r) => r.name === chip.part || (chip.id === 'ne555' && r.id === 'ne555'));
      expect(row, chip.part).toBeTruthy();
      expect(row!.group).toBe('logic');
    }
  });

  test('every adjustment quotes words of its lab, and names a row and a lab that exist', () => {
    for (const a of ADJUSTS) {
      const lab = LABS.find((l) => l.key === a.lab);
      expect(lab, `no lab ${a.lab}`).toBeTruthy();
      rowOf(a.row);
      const block = extractBlock(chapterText.get(lab!.chapter)!, lab!.n);
      expect(clean(block).includes(clean(a.quote)), `${a.lab}: the lab no longer says "${a.quote}"`).toBe(true);
      expect(a.count).toBeGreaterThanOrEqual(1);
    }
  });
});

/** The text of the nth `:::real` block of a chapter. */
function extractBlock(text: string, n: number): string {
  const lines = text.split('\n');
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    const d = /^(:{3,})real\b/.exec(lines[i]!);
    if (!d || ++seen !== n) continue;
    const body: string[] = [];
    for (i++; i < lines.length && lines[i]!.trim() !== d[1]; i++) body.push(lines[i]!);
    return body.join('\n');
  }
  throw new Error(`no block ${n}`);
}

describe('the breadboard drawing', () => {
  test('a terminal strip is five holes in a column, and the gap separates the halves', () => {
    const strip = connected(holeAt('t', 3, 'a')!);
    expect(strip).toHaveLength(5);
    expect(strip.every((h) => h.col === 3 && h.zone === 't')).toBe(true);
    expect(connected(holeAt('b', 3, 'f')!).some((h) => h.zone === 't')).toBe(false);
    expect(groupOf(holeAt('t', 3, 'e')!)).not.toBe(groupOf(holeAt('b', 3, 'f')!));
  });

  test('a rail runs the whole length of the board', () => {
    const all = connected(holeAt('rail', 1, 'top-plus')!);
    expect(all).toHaveLength(BOARD.cols);
    expect(new Set(all.map((h) => h.col)).size).toBe(BOARD.cols);
    expect(RAILS).toHaveLength(4);
    expect(groupOf(holeAt('rail', 1, 'top-plus')!)).not.toBe(groupOf(holeAt('rail', 1, 'top-minus')!));
  });

  test('every hole is one hole: the grid has 10 strip holes and 4 rail holes to a column', () => {
    const seen = new Set(HOLES.map((h) => `${h.zone}${h.col}${h.row}`));
    expect(seen.size).toBe(HOLES.length);
    expect(HOLES.length).toBe(BOARD.cols * 14);
    for (const h of HOLES) {
      expect(h.x).toBeGreaterThan(0);
      expect(h.x).toBeLessThan(BOARD.width);
      expect(h.y).toBeLessThan(BOARD.height);
    }
  });

  test('the chip straddles the gap, with its supply pins at opposite corners', () => {
    const p = (n: number) => pinHole(n);
    for (let n = 1; n <= 7; n++) {
      expect(p(n).zone).toBe('b');
      expect(p(15 - n).zone).toBe('t');
      expect(p(15 - n).col).toBe(p(n).col); // pin 14 is across the gap from pin 1, pin 8 from pin 7
    }
    expect([p(1).col, p(7).col, p(14).col, p(8).col]).toEqual([CHIP.firstCol, CHIP.firstCol + 6, CHIP.firstCol, CHIP.firstCol + 6]);
  });

  test('the example is wired as the caption says: VCC to the + rail, every other leg to somewhere different', () => {
    const g = groupOf;
    const wire = (id: string) => WIRES.find((w) => w.id === id)!;
    // No wire or part is shorted: its two ends are on different strips.
    for (const w of WIRES) expect(g(w.from), w.id).not.toBe(g(w.to));
    expect(g(PLACED.resistor.from)).not.toBe(g(PLACED.resistor.to));
    expect(g(PLACED.capacitor.from)).not.toBe(g(PLACED.capacitor.to));
    expect(g(PLACED.led.anode)).not.toBe(g(PLACED.led.cathode));
    // Pin 14 is on the strip that the red wire takes to the + rail; pin 7 and pin 1 go to the − rail at the bottom.
    expect(g(pinHole(14))).toBe(g(wire('vcc').from));
    expect(g(wire('vcc').to)).toBe('top-plus');
    expect(g(pinHole(7))).toBe(g(wire('gnd').from));
    expect(g(wire('gnd').to)).toBe('bottom-minus');
    expect(g(pinHole(1))).toBe(g(wire('input').from));
    expect(g(wire('input').to)).toBe('bottom-minus');
    // The bridge joins the two − rails, the capacitor sits between the top rails, and the supply feeds the top rails.
    expect([g(wire('bridge').from), g(wire('bridge').to)].sort()).toEqual(['bottom-minus', 'top-minus']);
    expect([g(PLACED.capacitor.from), g(PLACED.capacitor.to)].sort()).toEqual(['top-minus', 'top-plus']);
    expect(LEADS.map((l) => g(l.to)).sort()).toEqual(['top-minus', 'top-plus']);
    // Pin 2 (the inverter's output) is on the resistor's strip; the resistor's other end is the LED's anode, and its cathode is on the − rail.
    expect(g(pinHole(2))).toBe(g(PLACED.resistor.to));
    expect(g(PLACED.resistor.from)).toBe(g(PLACED.led.anode));
    expect(g(PLACED.led.cathode)).toBe('bottom-minus');
  });
});

describe('the page', () => {
  test('the pinouts it quotes match appendix A', () => {
    const pins = (id: string) => CHIPS.find((c) => c.id === id)!.pins;
    const pin = (id: string, name: string) => pins(id).findIndex((p) => p.name === name) + 1;
    // The power-pin table of the page: chip, VCC, GND.
    const row = (part: string) => {
      const m = new RegExp(`\\|\\s*${part}\\s*\\|[^|]*\\|\\s*(\\d+)\\s*\\|\\s*(\\d+)\\s*\\|`).exec(md);
      expect(m, `the power-pin table has no row for ${part}`).toBeTruthy();
      return [Number(m![1]), Number(m![2])];
    };
    for (const id of ['74hc00', '74hc02', '74hc04', '74hc08', '74hc32', '74hc74', '74hc86', '74hc161', '74hc283', '74hc595']) {
      expect(row(id.toUpperCase()), id).toEqual([pin(id, 'VCC'), pin(id, 'GND')]);
    }
    expect(row('NE555')).toEqual([pin('ne555', 'VCC'), pin('ne555', 'GND')]);
  });

  test('the power pins of the chips outside appendix A are as the chapters say', () => {
    const says = (slug: string, words: string) => expect(clean(chapterText.get(slug)!).includes(words), `${slug} no longer says: ${words}`).toBe(true);
    says('the-clock', '74HC14 (pins 1–2 and 3–4; ground pin 7, +5 V pin 14)');
    says('real-gates', 'Power the 74HC04 from 5 V (pin 14 to +5 V, pin 7 to ground)');
    says('memory', '+5 V on pin 28 and ground on pin 14');
    says('pals-and-gals', 'Power: pin 24 to +5 V, pin 12 to ground');
  });

  test('every chapter with a lab is linked from the page or listed by the labs widget', () => {
    // The widget draws every lab from labs.json; the text links the chapters it discusses.
    for (const slug of ['ohms-law', 'the-bench', 'real-gates', 'the-clock', 'talking-to-the-world', 'pals-and-gals', 'cplds']) {
      expect(md, slug).toContain(`/chapters/${slug}/`);
    }
    expect(md).toContain('/appendix/reference/');
    expect(md).toContain('/appendix/simulator/');
  });

  test('the page claims a lab in every chapter from 0 to 30 and in Chapter 32, and there is one', () => {
    const have = new Set(LABS.map((l) => Number(l.number)));
    for (let n = 0; n <= 30; n++) expect(have.has(n), `Chapter ${n} has no :::real block`).toBe(true);
    expect(have.has(32)).toBe(true);
    expect(md).toContain('every chapter from 0 to 30');
  });

  test('the minimal kit named in the text is in the minimal kit', () => {
    const line = (id: string) => bill(LABS).find((l) => l.row.id === id)!;
    for (const id of ['multimeter', 'breadboard', 'jumpers', 'usb5v', 'battery9v', 'aa', 'led', 'pot-10k', 'pot-100k', 'd-1n4148', 'q-2n3904', 'q-2n7000', 'q-bs250', 'relay', 'push', 'dip', 'seven-seg', 'ne555', 'sram-62256']) {
      expect(line(id).minimal, id).toBeGreaterThan(0);
    }
    for (const n of ['00', '02', '03', '04', '08', '14', '32', '74', '86', '161', '283', '595']) expect(line(`hc${n}`).minimal, `74HC${n}`).toBeGreaterThan(0);
    expect(md).toContain('the 74HC00, 02, 03, 04, 08, 14, 32, 74, 86, 161, 283 and 595');
  });

  test('the chapters where the bill goes beyond the parts list are named', () => {
    for (const a of ADJUSTS) {
      const n = LABS.find((l) => l.key === a.lab)!.number;
      expect(md, `the text does not mention Chapter ${n}, adjusted for ${a.row}`).toMatch(new RegExp(`Chapters? (?:[\\d, and]*\\b)?${n}\\b`));
    }
  });

  test('the simulator differences it states are true of the simulator and the chapters', () => {
    // Gates in the catalogue have inputs and an output and no supply pins; their delay defaults to 1 ns.
    const nand = getDef('nand')!;
    const names = pinsOf(nand, {}).map((p) => p.name);
    expect(names.some((n) => /vcc|vdd|gnd|supply/i.test(n))).toBe(false);
    expect(nand.params?.find((p) => p.key === 'delay')?.default).toBe(1);
    expect(md).toContain('1 ns by default');
    // A 74HC gate takes about 8 ns, in Chapter 10's table of families.
    expect(/CMOS, 74HC[^\n]*\| 8 ns \|/.test(clean(chapterText.get('real-gates')!)), 'Chapter 10 table: 74HC, 8 ns').toBe(true);
    expect(md).toContain('about 8 ns');
    // Chapter 9 says the 2N7000's threshold is about 2 V against the simulator's 1 V.
    expect(clean(chapterText.get('cmos')!).includes('(about 2 V for the 2N7000) is higher than the simulator’s 1 V')).toBe(true);
    // Chapter 4: the simulator's pushbutton has a bounce option; Chapter 3: 5 % is normal, gold means 5 %.
    expect(chapterText.get('capacitors-and-time')!.includes('has a `bounce` option')).toBe(true);
    expect(chapterText.get('the-bench')!.includes('gold means 5 %')).toBe(true);
  });

  test('the tools section covers every tool it is meant to', () => {
    for (const w of ['multimeter', 'logic analyser', 'sigrok', 'PulseView', 'oscilloscope', 'programmer', 'minipro', 'FT232H', 'OpenOCD', 'iCE40', 'iCEBreaker', 'Yosys', 'nextpnr', 'IceStorm', 'mains']) {
      expect(md, w).toContain(w);
    }
  });

  test('the figures the text refers to are placed', () => {
    for (const tag of ['::lab-index', '::bill-of-materials', '::breadboard-diagram']) expect(md).toContain(tag);
  });
});
