/**
 * Series–parallel networks of three switches and the Boolean expression each one computes.
 * Pure logic for the SeriesParallel widget (kept out of the component so it can be tested).
 */

export type NetworkId = 'ab-c' | 'a-bc';
export type Switches = { a: boolean; b: boolean; c: boolean };

export interface Network {
  id: NetworkId;
  /** The expression as tokens: a variable is "A", "B" or "C"; anything else is punctuation. */
  tokens: string[];
  /** Does the whole network conduct? */
  conducts: (s: Switches) => boolean;
  /** Does the branch that contains this switch conduct end to end? (Its wires are highlighted.) */
  branch: (s: Switches, which: 'a' | 'b' | 'c') => boolean;
}

export const NETWORKS: Record<NetworkId, Network> = {
  // A in series with B, and that pair in parallel with C.
  'ab-c': {
    id: 'ab-c',
    tokens: ['(', 'A', ' && ', 'B', ')', ' || ', 'C'],
    conducts: (s) => (s.a && s.b) || s.c,
    branch: (s, w) => (w === 'c' ? s.c : s.a && s.b),
  },
  // A in series with the parallel pair B, C.
  'a-bc': {
    id: 'a-bc',
    tokens: ['A', ' && ', '(', 'B', ' || ', 'C', ')'],
    conducts: (s) => s.a && (s.b || s.c),
    branch: (s, w) => (w === 'a' ? s.a && (s.b || s.c) : w === 'b' ? s.a && s.b : s.a && s.c),
  },
};

/** The eight rows of the truth table, in counting order (A is the most significant bit). */
export function rows(): Switches[] {
  return Array.from({ length: 8 }, (_, i) => ({ a: !!(i & 4), b: !!(i & 2), c: !!(i & 1) }));
}

export const rowIndex = (s: Switches): number => (s.a ? 4 : 0) + (s.b ? 2 : 0) + (s.c ? 1 : 0);

/** How many of the eight rows light the lamp. */
export const litCount = (n: Network): number => rows().filter((r) => n.conducts(r)).length;

/** The expression with each variable replaced by 0 or 1: `(1 && 0) || 1`. */
export function substituted(n: Network, s: Switches): string {
  return n.tokens.map((t) => (t === 'A' ? +s.a : t === 'B' ? +s.b : t === 'C' ? +s.c : t)).join('');
}
