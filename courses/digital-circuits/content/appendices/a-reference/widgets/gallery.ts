/**
 * The symbol gallery of Appendix A: one entry per catalog component, grouped by category, each with
 * a one-component circuit for the bench renderer to draw.
 */
import { allDefs, pinsOf, withDefaults } from '$lib/sim/netlist/catalog';
import type { Category, Circuit, ComponentDef } from '$lib/sim/netlist/types';

export const CATEGORIES: { id: Category; title: string; blurb: string }[] = [
  { id: 'source', title: 'Sources', blurb: 'Where the energy comes from.' },
  { id: 'wiring', title: 'Wiring', blurb: 'Not parts, but ways of connecting them without drawing every wire.' },
  { id: 'passive', title: 'Passive parts', blurb: 'Parts that only store or dissipate energy.' },
  { id: 'switch', title: 'Switches', blurb: 'Contacts you move by hand.' },
  { id: 'electromechanical', title: 'Electromechanical', blurb: 'A switch worked by electricity.' },
  { id: 'semiconductor', title: 'Semiconductors', blurb: 'Diodes, transistors and their relatives.' },
  { id: 'meter', title: 'Meters', blurb: 'Instruments you connect to read a value.' },
  { id: 'gate', title: 'Logic gates', blurb: 'The Boolean functions of Chapters 6 to 11.' },
  { id: 'sequential', title: 'Latches and flip-flops', blurb: 'One bit of memory (Chapters 16 and 17).' },
  { id: 'block', title: 'Building blocks', blurb: 'Multiplexers, adders, registers, counters and memories (Chapters 13 to 20).' },
  { id: 'io', title: 'Logic inputs and displays', blurb: 'Switches, lamps and displays for digital circuits.' },
];

/** Reference designators, as on a real schematic. */
const PREFIX: Record<string, string> = {
  resistor: 'R', potentiometer: 'RV', capacitor: 'C', inductor: 'L', lamp: 'LP',
  diode: 'D', led: 'D', npn: 'Q', pnp: 'Q', nmos: 'Q', pmos: 'Q', comparator: 'U',
  switch: 'S', spdt: 'S', pushbutton: 'SW', relay: 'K', battery: 'B', supply: 'PS', siggen: 'G',
  voltmeter: 'V', ammeter: 'A', label: 'L', rail: 'V', port: 'P',
};

export interface GalleryEntry {
  type: string;
  name: string;
  category: Category;
  description: string;
  /** Pin names as drawn, in catalog order. */
  pins: string[];
  circuit: Circuit;
  /** Lower-case text the search box looks in. */
  haystack: string;
}

export function entryFor(def: ComponentDef): GalleryEntry {
  const params = withDefaults(def, undefined);
  const pins = pinsOf(def, params).map((p) => p.name);
  const id = `${PREFIX[def.type] ?? (def.category === 'gate' || def.category === 'block' || def.category === 'sequential' ? 'U' : 'X')}1`;
  return {
    type: def.type,
    name: def.name,
    category: def.category,
    description: def.description ?? '',
    pins,
    circuit: { version: 1, title: def.name, components: [{ id, type: def.type, x: 0, y: 0 }], wires: [] },
    haystack: [def.name, def.type, def.category, def.description ?? '', ...pins].join(' ').toLowerCase(),
  };
}

export function galleryEntries(defs: ComponentDef[] = allDefs()): GalleryEntry[] {
  return defs.map(entryFor);
}

/** Every word of the query must appear somewhere in the entry. */
export function matches(entry: GalleryEntry, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => entry.haystack.includes(w));
}

export interface Group {
  id: Category;
  title: string;
  blurb: string;
  entries: GalleryEntry[];
}

/** Entries grouped in the order of CATEGORIES, keeping catalog order inside a group; empty groups are dropped. */
export function grouped(entries: GalleryEntry[], query = ''): Group[] {
  return CATEGORIES.map((c) => ({ ...c, entries: entries.filter((e) => e.category === c.id && matches(e, query)) })).filter((g) => g.entries.length > 0);
}
