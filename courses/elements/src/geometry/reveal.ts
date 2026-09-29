// Which objects of a figure the text has mentioned by a given paragraph, so the figure can be
// built up step by step alongside the proof, and the Byrne colours of every mentioned object.

import type { Para } from '../text/types';
import type { Scene } from './figure';
import { byrneColours, mentions, resolve, type Mention, type Target } from './resolve';
import type { V } from './vec';

export interface Resolved {
  /** Per paragraph, per label occurrence: the target (or null if it does not resolve). */
  targets: (Target | null)[][];
  /** Paragraph at which each element first appears. */
  elementFrom: number[];
  /** Paragraph at which each named point first appears. */
  pointFrom: Map<string, number>;
  colours: Map<string, { colour: string; dash?: string }>;
  /** Element index → the key the text uses for it. */
  elementKey: Map<number, string>;
}

export function paragraphMentions(paras: Para[]): Mention[][] {
  return paras.map((p) => mentions(p.c));
}

export function resolveAll(scene: Scene, ms: Mention[][], project?: (p: V) => V): Resolved {
  const targets = ms.map((row) => row.map((m) => resolve(scene, m.label, m.kind, project)));
  const pointFrom = new Map<string, number>();
  const elementFrom: number[] = scene.elements.map((e) => (e.from !== undefined ? e.from : Infinity));
  const elementKey = new Map<number, string>();
  targets.forEach((row, k) => {
    for (const t of row) {
      if (!t) continue;
      for (const n of t.points) if (!pointFrom.has(n)) pointFrom.set(n, k);
      if (t.element !== undefined) {
        if (scene.elements[t.element].from === undefined) elementFrom[t.element] = Math.min(elementFrom[t.element], k);
        if (!elementKey.has(t.element)) elementKey.set(t.element, t.key);
      }
    }
  });
  for (const [n, info] of scene.points) if (info.from !== undefined) pointFrom.set(n, info.from);
  // An element never mentioned appears once all its named points have; a point never mentioned
  // appears with the first element through it.
  const last = ms.length - 1;
  scene.elements.forEach((e, i) => {
    if (elementFrom[i] !== Infinity) return;
    const ns = e.kind === 'circle' && e.centre ? [e.centre] : e.names;
    const known = ns.map((n) => pointFrom.get(n)).filter((x): x is number => x !== undefined);
    elementFrom[i] = known.length ? Math.max(...known) : ns.length ? last : 0;
  });
  scene.elements.forEach((e, i) => {
    for (const n of e.names) if (!pointFrom.has(n)) pointFrom.set(n, elementFrom[i]);
  });
  for (const n of scene.points.keys()) if (!pointFrom.has(n)) pointFrom.set(n, last);
  const colours = byrneColours(targets.flat().filter((t): t is Target => !!t), scene);
  return { targets, elementFrom, pointFrom, colours, elementKey };
}
