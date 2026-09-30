/**
 * The product-term allocator of one vCPLD-32 function block, as the course's real allocator decides it.
 *
 * The reader sets how many product terms each of the eight macrocells needs; `allocate` asks
 * `allocateTerms` (src/lib/pld/cpld/allocator.ts) where every one of the 40 term slots goes: to its own macrocell,
 * to the one below or to the one above. `rearrange` asks `arrangeFb` (the fitter's own search) to move the outputs
 * to different macrocells so that the allocation works, or works with less borrowing.
 */
import { arrangeFb, allocateTerms, maxTermsAt, type AllocResult, type FbAllocation } from '$lib/pld/cpld/allocator';
import { MACROCELLS_PER_FB, TERMS_PER_MC } from '$lib/pld/devices/vcpld32-arch';
import { T_PD, T_PTA } from '$lib/pld/cpld/timing';

export const MCS = MACROCELLS_PER_FB;
export const SLOTS = TERMS_PER_MC;
export const MAX_DEMAND = 16;

export interface Scenario {
  id: string;
  label: string;
  story: string;
  demand: number[];
}

export const SCENARIOS: readonly Scenario[] = [
  { id: 'even', label: 'Five each', story: 'Every macrocell needs exactly its own five terms, so nothing moves.', demand: [5, 5, 5, 5, 5, 5, 5, 5] },
  { id: 'wide', label: 'One wide output', story: 'A decoder segment that needs 12 terms sits in macrocell 3, and its neighbours need only two each. They lend what they can spare, three apiece, which is one term short, so one of them borrows in turn from further out.', demand: [2, 2, 2, 12, 2, 2, 2, 2] },
  { id: 'parity', label: '4-input parity', story: 'The parity of four inputs needs 8 terms whichever way round it is stored (Chapter 26). It sits at the end of the chain, with one neighbour.', demand: [8, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'end', label: '12 terms at the end', story: 'The same wide output, at the end of the chain: there is only one neighbour to borrow from, and ten terms is the most it can collect.', demand: [12, 1, 1, 1, 1, 1, 1, 1] },
  { id: 'crowded', label: 'Crowded block', story: 'A 10-term output between two neighbours that already use all their own slots, and the block is full: 40 terms wanted, 40 slots.', demand: [5, 5, 5, 10, 5, 5, 5, 0] },
];

export type SlotKind = 'off' | 'own' | 'lent';

export interface SlotView {
  /** Macrocell whose OR gate takes this term (equal to the macrocell itself for `own`). */
  to: number;
  kind: SlotKind;
}

export interface McView {
  mc: number;
  demand: number;
  /** The most it could ever collect in this position (10 at the ends, 15 inside). */
  reach: number;
  own: number;
  fromBelow: number;
  fromAbove: number;
  borrowed: number;
  lent: number;
  slots: SlotView[];
  /** Pin-to-pin delay of a path that ends here, in nanoseconds. */
  tpd: number;
}

export type LabResult =
  | { ok: true; mcs: McView[]; borrowed: number; termsUsed: number; slotsFree: number }
  | { ok: false; message: string; failing: number; needed: number; available: number };

/** Slot `s` of macrocell `m` goes to macrocell m (local), m + 1 (up) or m − 1 (down). */
function view(demand: number[], a: FbAllocation): McView[] {
  return a.mcs.map((m) => {
    const slots: SlotView[] = m.steer.map((s) => {
      if (s === 'off') return { to: m.mc, kind: 'off' as const };
      if (s === 'local') return { to: m.mc, kind: 'own' as const };
      return { to: s === 'up' ? m.mc + 1 : m.mc - 1, kind: 'lent' as const };
    });
    const busy = demand[m.mc]! > 0;
    return {
      mc: m.mc,
      demand: demand[m.mc]!,
      reach: maxTermsAt(m.mc, false),
      own: m.own,
      fromBelow: m.fromBelow,
      fromAbove: m.fromAbove,
      borrowed: m.borrowed,
      lent: m.lent,
      slots,
      tpd: busy ? T_PD + (m.borrowed > 0 ? T_PTA : 0) : 0,
    };
  });
}

export function allocate(demand: number[]): LabResult {
  if (demand.length !== MCS) throw new Error(`a function block has ${MCS} macrocells`);
  const r: AllocResult = allocateTerms(demand.map((terms) => (terms > 0 ? { terms } : undefined)));
  if (!r.ok) return { ok: false, message: r.message, failing: r.mc, needed: r.needed, available: r.available };
  const used = demand.reduce((a, b) => a + b, 0);
  return { ok: true, mcs: view(demand, r), borrowed: r.borrowed, termsUsed: r.termsUsed, slotsFree: MCS * SLOTS - used };
}

/**
 * The fitter's placement of the same outputs: the busy macrocells' demands are handed to `arrangeFb`, which returns
 * the macrocell each one should sit in. Idle macrocells stay idle. Returns null if no arrangement works at all.
 */
export function rearrange(demand: number[]): number[] | null {
  const busy = demand.map((terms, mc) => ({ terms, mc })).filter((d) => d.terms > 0);
  const arr = arrangeFb(busy.map((d) => ({ terms: d.terms, oe: false, buried: false })));
  if (!arr) return null;
  const out = new Array<number>(MCS).fill(0);
  busy.forEach((d, i) => (out[arr.positions[i]!] = d.terms));
  return out;
}

/** One line for a macrocell: where its terms come from. */
export function describeMc(m: McView): string {
  if (m.demand === 0) return m.lent > 0 ? `idle, lends ${m.lent}` : 'idle';
  const parts = [`${m.own} own`];
  if (m.fromBelow) parts.push(`${m.fromBelow} from MC${m.mc - 1}`);
  if (m.fromAbove) parts.push(`${m.fromAbove} from MC${m.mc + 1}`);
  return parts.join(' + ') + (m.lent ? `; lends ${m.lent}` : '');
}
