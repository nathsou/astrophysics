/**
 * Analysis requests that share work. The analysis client answers only the newest request of a key, so two callers that
 * ask about the same text (the editor's linter and `FpgaSession.fit`) used to supersede each other: the older one got
 * `undefined`, and a fit that took that for "nothing to do" left its status on `running`. Here callers asking about the
 * same text in the same moment share one request, and `analysisForFit` turns the remaining case (the text, or the
 * worker, changed under the request) into either a retry or an error, never into silence.
 *
 * Pure TypeScript (no Svelte), so it has ordinary tests.
 */

/** Runs at most one request per text at a time; later callers with the same text share the pending answer. */
export class SharedRequests<A> {
  private readonly pending = new Map<string, Promise<A | undefined>>();

  run(text: string, exec: () => Promise<A | undefined>): Promise<A | undefined> {
    const existing = this.pending.get(text);
    if (existing) return existing;
    const p = exec().finally(() => {
      if (this.pending.get(text) === p) this.pending.delete(text);
    });
    this.pending.set(text, p);
    return p;
  }

  get size(): number {
    return this.pending.size;
  }
}

/** The analysis kept being superseded or lost; there is nothing to fit. */
export class AnalysisInterrupted extends Error {
  constructor() {
    super('The analysis was interrupted by newer edits. Try again.');
    this.name = 'AnalysisInterrupted';
  }
}

export interface FitAnalysisOptions<A extends { source: string }> {
  /** The session's current text, read again after every interrupted request. */
  source(): string;
  /** The analysis the session already holds (the editor's), if it is for this text. */
  current(): A | undefined;
  /** Asks the analysis client for a text. Resolves to `undefined` when a newer request superseded it. */
  request(text: string): Promise<A | undefined>;
  /** True once the fit was cancelled or replaced by a newer one. */
  stale(): boolean;
  /** How many interrupted requests to tolerate before giving up (default 4). */
  attempts?: number;
}

/**
 * The analysis a fit starts from: the text it was asked about and its analysis, or `'stale'` if the fit was cancelled
 * meanwhile. A request that resolves to `undefined` was superseded; the loop then looks again at the session's text
 * (which is what superseded it, if the user typed) and the analysis it holds, and asks again. After `attempts`
 * interruptions it throws `AnalysisInterrupted`, so the caller can report an error instead of hanging.
 */
export async function analysisForFit<A extends { source: string }>(o: FitAnalysisOptions<A>): Promise<{ source: string; analysis: A } | 'stale'> {
  const attempts = o.attempts ?? 4;
  for (let i = 0; i < attempts; i++) {
    if (o.stale()) return 'stale';
    const source = o.source();
    const held = o.current();
    if (held && held.source === source) return { source, analysis: held };
    const a = await o.request(source);
    if (o.stale()) return 'stale';
    if (a) return { source, analysis: a };
    // Superseded. The newer request's own caller may have stored its answer; the next round checks.
  }
  throw new AnalysisInterrupted();
}
