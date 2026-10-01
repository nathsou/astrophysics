/// <reference lib="webworker" />
/**
 * The pile-up scan of Chapter 8 off the page's thread: simulating and reconstructing crossings with hundreds of collisions takes
 * long enough to freeze a page. One request is one point of the curves (`kind: 'point'`: `n` crossings at one pile-up) or one
 * picture (`kind: 'picture'`: one crossing, with its hits and tracks).
 */
import { PILEUP_HOOKS, aggregate, eventSeed, reconstructCrossing, simulateCrossing, type EventResult, type FinderSettings, type PointResult, type Quality } from './pileup.ts';
import { installHooks } from './hooksWorker.ts';

export type PileupRequest =
  | { id: number; kind: 'point'; pu: number; n: number; seed: number; settings: FinderSettings; quality: Quality; mine: Record<string, string> }
  | { id: number; kind: 'picture'; pu: number; seed: number; settings: FinderSettings; quality: Quality; mine: Record<string, string> };
export type PileupResponse = { id: number; kind: 'point'; point: PointResult; errors: Record<string, string> } | { id: number; kind: 'picture'; picture: EventResult; errors: Record<string, string> } | { id: number; error: string };

self.onmessage = (e: MessageEvent<PileupRequest>) => {
  const m = e.data;
  try {
    const errors = installHooks(PILEUP_HOOKS, m.mine);
    if (m.kind === 'point') {
      const events: EventResult[] = [];
      for (let i = 0; i < m.n; i++) events.push(reconstructCrossing(simulateCrossing(m.pu, eventSeed(m.seed, m.pu, i), m.quality), m.settings));
      (self as unknown as Worker).postMessage({ id: m.id, kind: 'point', point: aggregate(m.pu, events), errors } satisfies PileupResponse);
    } else {
      const x = simulateCrossing(m.pu, eventSeed(m.seed, m.pu, 0), m.quality);
      (self as unknown as Worker).postMessage({ id: m.id, kind: 'picture', picture: reconstructCrossing(x, m.settings, true), errors } satisfies PileupResponse);
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: m.id, error: err instanceof Error ? err.message : String(err) } satisfies PileupResponse);
  }
};
