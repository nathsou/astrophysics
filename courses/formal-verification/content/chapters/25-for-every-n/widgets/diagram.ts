/**
 * A state of a parameterised system as a picture of nodes (chapter 25): what each state variable says about each
 * node becomes a label on the node, a relation between two nodes an arrow, anything else a line above the nodes.
 * A ternary relation (the ring's `btw`) orders the nodes round the circle; an order relation (`le`) becomes each
 * node's identifier rank. Pure functions, used by the parameterised workshop.
 */
import type { Ty } from '$lib/fv/vouch/check/types';
import { funcGet, show, type Value, type FuncV } from '$lib/fv/vouch/interp/values';

export interface Slot {
  name: string;
  ty: Ty | undefined;
  value: Value;
}

export interface NodeView {
  id: number;
  label: string;
  /** "rm: committed", "voted", "id 3", … */
  lines: string[];
}

export interface Picture {
  sort: string;
  nodes: NodeView[];
  edges: { from: number; to: number; label: string }[];
  globals: string[];
}

const atom = (sort: string, i: number): Value => ({ t: 'atom', type: sort, i });
const isAtom = (t: Ty | undefined, sort: string) => t?.k === 'atom' && t.name === sort;
const truthy = (v: Value | undefined) => v === true;

export function picture(slots: Slot[], sort: string, size: number, hints: { ring?: string; order?: string } = {}): Picture {
  const nodes: NodeView[] = Array.from({ length: size }, (_, i) => ({ id: i, label: `${sort}${i}`, lines: [] }));
  const edges: Picture['edges'] = [];
  const globals: string[] = [];
  const tup = (...xs: number[]): Value => (xs.length === 1 ? atom(sort, xs[0]!) : { t: 'tuple', items: xs.map((x) => atom(sort, x)) });
  for (const s of slots) {
    const t = s.ty;
    if (!t) continue;
    if (t.k === 'func' && s.value !== null && typeof s.value === 'object' && s.value.t === 'func') {
      const f = s.value as FuncV;
      const ps = t.params;
      if (ps.every((p) => isAtom(p, sort))) {
        if (ps.length === 1) {
          for (const n of nodes) {
            const v = funcGet(f, tup(n.id));
            if (t.result.k === 'bool') {
              if (truthy(v)) n.lines.push(s.name);
            } else n.lines.push(`${s.name}: ${show(v ?? null)}`);
          }
          continue;
        }
        if (ps.length === 2 && t.result.k === 'bool') {
          if (s.name === hints.order) {
            for (const n of nodes) n.lines.push(`id ${nodes.filter((m) => truthy(funcGet(f, tup(m.id, n.id)))).length}`);
            continue;
          }
          for (const a of nodes) for (const b of nodes) if (truthy(funcGet(f, tup(a.id, b.id)))) edges.push({ from: a.id, to: b.id, label: s.name });
          continue;
        }
        if (ps.length === 3 && t.result.k === 'bool') continue; // the ring order: used for the layout
      }
      globals.push(`${s.name} = ${show(s.value)}`);
      continue;
    }
    if (t.k === 'set' && s.value !== null && typeof s.value === 'object' && s.value.t === 'set') {
      const items = s.value.items;
      if (isAtom(t.elem, sort)) {
        for (const n of nodes) if (items.some((x) => x !== null && typeof x === 'object' && x.t === 'atom' && x.i === n.id)) n.lines.push(`∈ ${s.name}`);
        continue;
      }
      if (t.elem.k === 'struct') {
        const fs = t.elem.fields;
        const atomFields = fs.map((f, i) => (isAtom(f.ty, sort) ? i : -1)).filter((i) => i >= 0);
        if (atomFields.length === 1 || atomFields.length === 2) {
          for (const x of items) {
            if (x === null || typeof x !== 'object' || x.t !== 'struct') continue;
            const rest = fs.map((f, i) => (atomFields.includes(i) ? '' : show(x.fields[i]!))).filter(Boolean).join(' ');
            const at = atomFields.map((i) => (x.fields[i] as { i: number }).i);
            if (at.length === 1) nodes[at[0]!]?.lines.push(`${s.name}: ${rest || 'yes'}`);
            else edges.push({ from: at[0]!, to: at[1]!, label: `${s.name}${rest ? ' ' + rest : ''}` });
          }
          continue;
        }
      }
    }
    if (isAtom(t, sort) && s.value !== null && typeof s.value === 'object' && s.value.t === 'atom') {
      nodes[s.value.i]?.lines.push(`← ${s.name}`);
      continue;
    }
    globals.push(`${s.name} = ${show(s.value)}`);
  }
  return { sort, nodes: ringOrder(slots, sort, size, hints.ring).map((i) => nodes[i]!), edges, globals };
}

/** The nodes in ring order, from a relation btw[x, y, z] ("going round from x, y comes before z"), if there is one. */
export function ringOrder(slots: Slot[], sort: string, size: number, name = 'btw'): number[] {
  const ids = Array.from({ length: size }, (_, i) => i);
  const s = slots.find((x) => x.name === name && x.ty?.k === 'func' && x.ty.params.length === 3);
  if (!s || s.value === null || typeof s.value !== 'object' || s.value.t !== 'func' || size < 3) return ids;
  const f = s.value as FuncV;
  const btw = (a: number, b: number, c: number) => funcGet(f, { t: 'tuple', items: [atom(sort, a), atom(sort, b), atom(sort, c)] }) === true;
  const next = (a: number) => ids.find((b) => b !== a && ids.every((z) => z === a || z === b || btw(a, b, z)));
  const out = [0];
  for (let k = 1; k < size; k++) {
    const n = next(out.at(-1)!);
    if (n === undefined || out.includes(n)) return ids;
    out.push(n);
  }
  return out;
}
