/**
 * Separation logic on a concrete heap (chapter 21): each conjunct of an assertion has a footprint, the set of heap
 * cells (object fields) it describes; P ∗ Q holds when P and Q hold on disjoint parts. Here the parts are found
 * from the footprints: points-to describes one cell, a list segment describes the cells of every node it passes.
 */
export interface CObj {
  id: string;
  fields: Record<string, number | string | null>;
}
export interface CHeap {
  objs: CObj[];
  vars: Record<string, string | null>;
}
export type CAtom = { k: 'pt'; v: string; field: string; val: string } | { k: 'seg'; from: string; to: string } | { k: 'emp' };

export function parseAtom(text: string): CAtom {
  const t = text.trim();
  if (t === 'emp') return { k: 'emp' };
  let m = /^([a-z]\w*)\.(\w+)\s*(?:\|->|↦)\s*(-?\w+)$/.exec(t);
  if (m) return { k: 'pt', v: m[1]!, field: m[2]!, val: m[3]! };
  m = /^list\(\s*(\w+)\s*\)$/.exec(t);
  if (m) return { k: 'seg', from: m[1]!, to: 'null' };
  m = /^lseg\(\s*(\w+)\s*,\s*(\w+)\s*\)$/.exec(t);
  if (m) return { k: 'seg', from: m[1]!, to: m[2]! };
  throw new Error(`Cannot read “${t}”: write x.f |-> v, list(x), lseg(x, y) or emp.`);
}

const cell = (obj: string, field: string) => `${obj}.${field}`;

/** The object a name denotes (a variable), or null. */
function target(h: CHeap, name: string): string | null | undefined {
  if (name === 'null') return null;
  if (name in h.vars) return h.vars[name]!;
  return undefined;
}

export interface Footprint {
  ok: boolean;
  cells: string[];
  reason?: string;
}

export function footprint(h: CHeap, a: CAtom): Footprint {
  if (a.k === 'emp') return { ok: true, cells: [] };
  if (a.k === 'pt') {
    const o = target(h, a.v);
    if (o === undefined) return { ok: false, cells: [], reason: `${a.v} is not a variable` };
    if (o === null) return { ok: false, cells: [], reason: `${a.v} is null, and null has no fields` };
    const obj = h.objs.find((x) => x.id === o)!;
    if (!(a.field in obj.fields)) return { ok: false, cells: [], reason: `${o} has no field ${a.field}` };
    const want = /^-?\d+$/.test(a.val) ? Number(a.val) : target(h, a.val);
    if (want === undefined) return { ok: false, cells: [cell(o, a.field)], reason: `${a.val} is not a variable` };
    const ok = obj.fields[a.field] === want;
    return { ok, cells: [cell(o, a.field)], reason: ok ? undefined : `${a.v}.${a.field} holds ${show(obj.fields[a.field]!)}, not ${show(want)}` };
  }
  const end = target(h, a.to);
  let cur = target(h, a.from);
  if (cur === undefined || end === undefined) return { ok: false, cells: [], reason: 'unknown variable' };
  const cells: string[] = [];
  const seen = new Set<string>();
  while (cur !== end) {
    if (cur === null) return { ok: false, cells, reason: `following next from ${a.from} reaches null before ${a.to}` };
    if (seen.has(cur)) return { ok: false, cells, reason: `following next from ${a.from} goes round a cycle` };
    seen.add(cur);
    const obj = h.objs.find((x) => x.id === cur)!;
    for (const f of Object.keys(obj.fields)) cells.push(cell(cur, f));
    cur = obj.fields.next as string | null;
  }
  return { ok: true, cells };
}

export interface StarResult {
  parts: Footprint[];
  /** Cells claimed by two conjuncts. */
  overlap: string[];
  /** Cells of the heap that no conjunct describes. */
  unclaimed: string[];
  holds: boolean;
}

export function star(h: CHeap, atoms: CAtom[]): StarResult {
  const parts = atoms.map((a) => footprint(h, a));
  const count = new Map<string, number>();
  for (const p of parts) for (const c of p.cells) count.set(c, (count.get(c) ?? 0) + 1);
  const overlap = [...count].filter(([, n]) => n > 1).map(([c]) => c);
  const all = h.objs.flatMap((o) => Object.keys(o.fields).map((f) => cell(o.id, f)));
  const unclaimed = all.filter((c) => !count.has(c));
  return { parts, overlap, unclaimed, holds: parts.every((p) => p.ok) && !overlap.length };
}

export const show = (x: number | string | null) => (x === null ? 'null' : String(x));
