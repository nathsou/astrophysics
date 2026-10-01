/**
 * Comparing a reader's diagram with the enumerated answer key.
 */
import { findDiagram } from './canonical.ts';
import { loopCount } from './model.ts';
import type { Diagram } from './types.ts';

export interface KeyMatch {
  /** Index in the key of the diagram the reader drew, or -1. */
  index: number;
  /** Indices of the key diagrams found so far, given the list of diagrams drawn (each counted once). */
  found: number[];
}

/**
 * Which diagram of the answer key (if any) is `drawn`? Only finished diagrams with no loops can match.
 * Legs are labelled: each external particle is a separate leg.
 */
export function matchAnswerKey(drawn: Diagram, key: readonly Diagram[], foundBefore: readonly number[] = []): KeyMatch {
  if (loopCount(drawn) !== 0) return { index: -1, found: [...foundBefore] };
  const index = findDiagram(key, drawn);
  const found = index >= 0 && !foundBefore.includes(index) ? [...foundBefore, index] : [...foundBefore];
  return { index, found };
}
