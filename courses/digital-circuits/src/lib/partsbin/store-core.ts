/**
 * The reader's parts bin as plain data and logic (no reactivity, no browser APIs): which parts they have
 * built, the "use my parts" switch, JSON import and export, and the resolver that flattening uses.
 * `store.svelte.ts` wraps it in runes and localStorage.
 */
import type { Circuit } from '../sim/netlist/types';
import type { SubResolver } from '../sim/netlist/connect';
import { behaviourOf, getPart } from './parts';
import { checkPart } from './verify';
import { costOfSafe } from './cost';

export interface MinePart {
  /** The reader's circuit, ports named as the part's pins. */
  circuit: Circuit;
  savedAt: number;
  /** Cost of the circuit when it passed (gates, transistors, depth). */
  gates?: number;
  transistors?: number;
  depth?: number;
  /** Chapter's exercise id that produced it. */
  from?: string;
}

export interface PartsData {
  version: 1;
  useMine: boolean;
  mine: Record<string, MinePart>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const STORAGE_KEY = 'dc-parts';

export const isCircuit = (c: unknown): c is Circuit => !!c && typeof c === 'object' && (c as Circuit).version === 1 && Array.isArray((c as Circuit).components) && Array.isArray((c as Circuit).wires);

export class PartsStoreCore {
  mine: Record<string, MinePart> = {};
  useMine = true;
  constructor(
    private readonly storage?: StorageLike,
    private readonly key = STORAGE_KEY,
  ) {}

  load(): void {
    try {
      const raw = this.storage?.getItem(this.key);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<PartsData>;
      this.useMine = data.useMine !== false;
      this.mine = {};
      for (const [id, m] of Object.entries(data.mine ?? {})) if (getPart(id) && m && isCircuit(m.circuit)) this.mine[id] = m;
    } catch {
      /* corrupt or unavailable storage: start with an empty bin */
    }
  }

  save(): void {
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.data()));
    } catch {
      /* storage full or blocked: the bin lives on for this visit only */
    }
  }

  data(): PartsData {
    return { version: 1, useMine: this.useMine, mine: this.mine };
  }

  has(id: string): boolean {
    return id in this.mine;
  }

  /** Store the reader's version of a part (the caller has checked it). */
  set(id: string, circuit: Circuit, extra: Partial<MinePart> = {}): void {
    if (!getPart(id)) throw new Error(`unknown part ${id}`);
    this.mine = { ...this.mine, [id]: { circuit, savedAt: Date.now(), ...extra } };
    this.save();
  }

  remove(id: string): void {
    const { [id]: _, ...rest } = this.mine;
    this.mine = rest;
    this.save();
  }

  setUseMine(on: boolean): void {
    this.useMine = on;
    this.save();
  }

  exportJson(): string {
    return JSON.stringify(this.data(), null, 2);
  }

  /** Read an exported bin. Every circuit is checked again; parts that fail are skipped and reported. */
  importJson(text: string, options: { verify?: boolean; merge?: boolean } = {}): { imported: string[]; skipped: { id: string; reason: string }[] } {
    const imported: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    let data: Partial<PartsData>;
    try {
      data = JSON.parse(text) as Partial<PartsData>;
    } catch {
      throw new Error('That file is not valid JSON.');
    }
    if (!data || typeof data !== 'object' || data.version !== 1 || typeof data.mine !== 'object' || !data.mine) throw new Error('That file is not a parts bin export.');
    const next: Record<string, MinePart> = options.merge === false ? {} : { ...this.mine };
    for (const [id, m] of Object.entries(data.mine)) {
      if (!getPart(id)) {
        skipped.push({ id, reason: 'not a part of this course' });
        continue;
      }
      if (!m || !isCircuit(m.circuit)) {
        skipped.push({ id, reason: 'not a circuit' });
        continue;
      }
      if (options.verify !== false) {
        let ok = false;
        let reason = 'it does not pass its checker';
        try {
          const r = checkPart(id, m.circuit, partsResolver(false));
          ok = r.pass;
          if (!ok && r.problems[0]) reason = r.problems[0];
        } catch (e) {
          reason = e instanceof Error ? e.message : String(e);
        }
        if (!ok) {
          skipped.push({ id, reason });
          continue;
        }
      }
      next[id] = { circuit: m.circuit, savedAt: typeof m.savedAt === 'number' ? m.savedAt : Date.now(), gates: m.gates, transistors: m.transistors, depth: m.depth, from: m.from };
      imported.push(id);
    }
    this.mine = next;
    if (typeof data.useMine === 'boolean') this.useMine = data.useMine;
    this.save();
    return { imported, skipped };
  }

  /** The resolver for `part:<id>` types: the reader's version if "use my parts" is on and they have one, else the reference. */
  resolver(usingMine = this.useMine): SubResolver {
    return partsResolver(usingMine, (id) => this.mine[id]);
  }
}

/**
 * Resolve `part:<id>` to a circuit for flattening: the reader's verified version (when `usingMine`, the part
 * allows substitution and the reader's circuit runs on the digital engine), else the reference. Transistor-level
 * parts (NOT, NAND and NOR in RTL and CMOS) always stand in as a single behavioural gate.
 */
export function partsResolver(usingMine: boolean, mine?: (id: string) => MinePart | undefined): SubResolver {
  return (type) => {
    if (!type.startsWith('part:')) return undefined;
    const id = type.slice(5);
    if (usingMine) {
      const m = mine?.(id);
      const spec = getPart(id);
      if (m && spec?.substitutable && (m.circuit.engine ?? 'digital') === 'digital') return m.circuit;
    }
    return behaviourOf(id);
  };
}

export { costOfSafe };
