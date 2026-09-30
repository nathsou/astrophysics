import { describe, expect, it } from 'vitest';
import { analysisForFit, AnalysisInterrupted, SharedRequests } from './analysis-share';

type A = { source: string; n: number };

/** A fake analysis client with the real one's rule: only the newest request of a key is answered. */
function fakeClient() {
  let latest = 0;
  let id = 0;
  const calls: string[] = [];
  return {
    calls,
    run(text: string): Promise<A | undefined> {
      const mine = ++id;
      latest = mine;
      calls.push(text);
      return new Promise((r) => setTimeout(() => r(latest === mine ? { source: text, n: mine } : undefined), 5));
    },
  };
}

describe('SharedRequests', () => {
  it('shares one request between callers asking about the same text', async () => {
    const client = fakeClient();
    const s = new SharedRequests<A>();
    const a = s.run('x', () => client.run('x'));
    const b = s.run('x', () => client.run('x'));
    expect(await a).toEqual(await b);
    expect((await a)?.source).toBe('x');
    expect(client.calls).toEqual(['x']);
    expect(s.size).toBe(0);
  });

  it('keeps the rule for different texts: the older is superseded', async () => {
    const client = fakeClient();
    const s = new SharedRequests<A>();
    const a = s.run('x', () => client.run('x'));
    const b = s.run('y', () => client.run('y'));
    expect(await a).toBeUndefined();
    expect((await b)?.source).toBe('y');
  });

  it('forgets a settled request, so the same text can be asked again', async () => {
    const client = fakeClient();
    const s = new SharedRequests<A>();
    await s.run('x', () => client.run('x'));
    await s.run('x', () => client.run('x'));
    expect(client.calls).toEqual(['x', 'x']);
  });

  it('forgets a request that rejects', async () => {
    const s = new SharedRequests<A>();
    await expect(s.run('x', () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(s.size).toBe(0);
  });
});

describe('analysisForFit', () => {
  const base = (over: Partial<Parameters<typeof analysisForFit<A>>[0]> & { client?: ReturnType<typeof fakeClient> } = {}) => {
    const client = over.client ?? fakeClient();
    const state = { source: 'x', held: undefined as A | undefined, cancelled: false };
    return {
      client,
      state,
      opts: {
        source: () => state.source,
        current: () => state.held,
        request: (t: string) => client.run(t),
        stale: () => state.cancelled,
        ...over,
      } as Parameters<typeof analysisForFit<A>>[0],
    };
  };

  it('uses the analysis the session already holds for this text', async () => {
    const { client, state, opts } = base();
    state.held = { source: 'x', n: 0 };
    expect(await analysisForFit(opts)).toEqual({ source: 'x', analysis: { source: 'x', n: 0 } });
    expect(client.calls).toEqual([]);
  });

  it('ignores a held analysis of other text', async () => {
    const { client, state, opts } = base();
    state.held = { source: 'old', n: 0 };
    const r = await analysisForFit(opts);
    expect(r).not.toBe('stale');
    expect(client.calls).toEqual(['x']);
  });

  it('continues when the editor superseded the fit with the same text (the hang)', async () => {
    const client = fakeClient();
    const { state, opts } = base({ client });
    // The fit asks first; the editor's linter then asks about the same text through the same key, so the fit's request is
    // never answered. The editor's answer reaches the session through onanalysis.
    let editorAsked = false;
    const fitRequest = (t: string) => {
      const p = client.run(t);
      if (!editorAsked) {
        editorAsked = true;
        void client.run(t).then((a) => (state.held = a));
      }
      return p;
    };
    const r = await analysisForFit({ ...opts, request: fitRequest });
    expect(r).not.toBe('stale');
    if (r !== 'stale') expect(r.source).toBe('x');
  });

  it('with shared requests the fit and the editor get the same answer from one request', async () => {
    const client = fakeClient();
    const shared = new SharedRequests<A>();
    const ask = (t: string) => shared.run(t, () => client.run(t));
    const { opts } = base({ client, request: ask });
    const editor = ask('x');
    const r = await analysisForFit(opts);
    expect(client.calls).toEqual(['x']);
    expect(r).toEqual({ source: 'x', analysis: (await editor)! });
  });

  it('retries after a superseded request and then succeeds', async () => {
    let n = 0;
    const { opts } = base({ request: async (t) => (++n < 3 ? undefined : { source: t, n }) });
    const r = await analysisForFit(opts);
    expect(r).toEqual({ source: 'x', analysis: { source: 'x', n: 3 } });
  });

  it('picks up the analysis the newer request stored', async () => {
    const { state, opts } = base({
      request: async () => {
        state.held = { source: 'x', n: 9 };
        return undefined;
      },
    });
    expect(await analysisForFit(opts)).toEqual({ source: 'x', analysis: { source: 'x', n: 9 } });
  });

  it('follows the text when it changed under the request', async () => {
    const { state, opts } = base({
      request: async (t) => {
        if (t === 'x') {
          state.source = 'y';
          return undefined;
        }
        return { source: t, n: 1 };
      },
    });
    expect(await analysisForFit(opts)).toEqual({ source: 'y', analysis: { source: 'y', n: 1 } });
  });

  it('throws instead of hanging when every request is superseded', async () => {
    let n = 0;
    const { opts } = base({ request: async () => (n++, undefined), attempts: 3 });
    await expect(analysisForFit(opts)).rejects.toBeInstanceOf(AnalysisInterrupted);
    expect(n).toBe(3);
  });

  it('reports a cancelled fit as stale', async () => {
    const { state, opts } = base({
      request: async () => {
        state.cancelled = true;
        return { source: 'x', n: 1 };
      },
    });
    expect(await analysisForFit(opts)).toBe('stale');
  });
});
