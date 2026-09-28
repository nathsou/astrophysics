// Coding trees by numbers (section "Trees"). A tree with immediate subtrees t_1, …, t_k and root
// label l is coded by the sequence code ⟨k, #t_1, …, #t_k, l⟩; a single node labelled l by ⟨0, l⟩.
//
// The functions of the proof that SubtreeSeq is primitive recursive:
//   ISubtrees(t)          = subseq(t, 1, (t)_0)          the codes of the immediate subtrees
//   h(s)                  = ISubtrees((s)_0) ⌢ … ⌢ ISubtrees((s)_{len(s)−1})
//   hSubtreeSeq(t, 0)     = ⟨t⟩
//   hSubtreeSeq(t, n + 1) = hSubtreeSeq(t, n) ⌢ h(hSubtreeSeq(t, n))
//   SubtreeSeq(t)         = hSubtreeSeq(t, t)
// Codes are kept as exact symbolic numbers (numbers/nat.ts): they are astronomically large even
// for small trees. The functions are computed on the trees themselves, which is equivalent.

import { evaluate as evalNat, lit, seqOf, type Nat } from '../numbers/nat.ts';

export interface Tree {
  label: bigint;
  children: Tree[];
}

export const leaf = (label: bigint | number): Tree => ({ label: BigInt(label), children: [] });
export const node = (label: bigint | number, children: Tree[]): Tree => ({ label: BigInt(label), children });

/** #t = ⟨k, #t_1, …, #t_k, l⟩, symbolically. */
export function treeCode(t: Tree): Nat {
  return seqOf([lit(t.children.length), ...t.children.map(treeCode), lit(t.label)]);
}

/** The code as a plain nested sequence text, e.g. ⟨2, ⟨0, 2⟩, ⟨0, 3⟩, 1⟩. */
export function treeCodeText(t: Tree): string {
  return `⟨${[String(t.children.length), ...t.children.map(treeCodeText), String(t.label)].join(', ')}⟩`;
}

export function treeCodeTex(t: Tree): string {
  return `\\langle ${[String(t.children.length), ...t.children.map(treeCodeTex), String(t.label)].join(', ')} \\rangle`;
}

export function depth(t: Tree): number {
  return t.children.length === 0 ? 0 : 1 + Math.max(...t.children.map(depth));
}

export function countNodes(t: Tree): number {
  return 1 + t.children.reduce((s, c) => s + countNodes(c), 0);
}

export function sameTree(a: Tree, b: Tree): boolean {
  return a.label === b.label && a.children.length === b.children.length && a.children.every((c, i) => sameTree(c, b.children[i]));
}

/** ISubtrees(t): the immediate subtrees, in order. */
export const immediateSubtrees = (t: Tree): Tree[] => t.children;

/** h(s): the immediate subtrees of the elements of s, concatenated. */
export function childrenOfAll(s: Tree[]): Tree[] {
  return s.flatMap(immediateSubtrees);
}

/** hSubtreeSeq(t, 0), …, hSubtreeSeq(t, n), each a sequence of trees (with repetitions, as in the book). */
export function hSubtreeSeqLevels(t: Tree, n: number, maxLength = 4096): { seq: Tree[]; truncated: boolean }[] {
  const out: { seq: Tree[]; truncated: boolean }[] = [{ seq: [t], truncated: false }];
  for (let i = 0; i < n; i++) {
    const prev = out[out.length - 1];
    if (prev.truncated) {
      out.push(prev);
      continue;
    }
    const next = [...prev.seq, ...childrenOfAll(prev.seq)];
    out.push(next.length > maxLength ? { seq: next.slice(0, maxLength), truncated: true } : { seq: next, truncated: false });
  }
  return out;
}

/** The distinct subtrees of t (each once, in the order first met breadth-first). */
export function distinctSubtrees(t: Tree): Tree[] {
  const out: Tree[] = [];
  const queue = [t];
  while (queue.length) {
    const s = queue.shift()!;
    if (!out.some((u) => sameTree(u, s))) out.push(s);
    queue.push(...s.children);
  }
  return out;
}

/** Does every subtree of t occur in the sequence? */
export function containsAllSubtrees(t: Tree, seq: Tree[]): boolean {
  return distinctSubtrees(t).every((u) => seq.some((s) => sameTree(s, u)));
}

/** The code #t as a number, when it is small enough to evaluate. */
export function codeNumber(t: Tree, maxBits = 4096): bigint | null {
  return evalNat(treeCode(t), maxBits);
}
