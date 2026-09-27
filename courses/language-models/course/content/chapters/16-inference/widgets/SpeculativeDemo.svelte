<!--
  Speculative decoding on CourseGPT: a cheap drafter (a small model with the same tokeniser, or
  prompt lookup) proposes γ tokens; CourseGPT checks them all in one cached forward pass and keeps
  what it agrees with. The output has exactly CourseGPT's distribution.
-->
<script lang="ts">
  import { mulberry32, sampleIndex } from '@lm/core';
  import { softmaxT, speculativeAccept } from '@lm/core/sample';
  import type { GptRunner, KvCache } from '@lm/core/gpu';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { impl } from '$lib/exercise/impl.svelte';
  import { loadCourseGpt, loadDraftModel, runnerFor, type CourseGpt } from '$lib/models/coursegpt';

  type Drafter = 'model' | 'lookup';
  interface Piece {
    text: string;
    kind: 'prompt' | 'accepted' | 'target';
  }

  let target = $state<CourseGpt | null>(null);
  let draftModel = $state<CourseGpt | null>(null);
  let status = $state<'idle' | 'loading' | 'running' | 'error'>('idle');
  let error = $state('');
  let drafter = $state<Drafter>('model');
  let gamma = $state(4);
  let T = $state(0.7);
  let prompt = $state('Once upon a time, there was a little girl named Lily. Lily loved her red ball. One day, Lily');
  let pieces = $state<Piece[]>([]);
  let stats = $state<{ passes: number; tokens: number; ms: number; baselineMs: number } | null>(null);

  const lookup = $derived(
    impl.get('spec.promptLookup', (ids: number[], n: number, k: number): number[] => {
      for (let s = ids.length - n - 1; s >= 0; s--) {
        let ok = true;
        for (let i = 0; i < n && ok; i++) ok = ids[s + i] === ids[ids.length - n + i];
        if (ok) return ids.slice(s + n, Math.min(ids.length, s + n + k));
      }
      return [];
    }),
  );

  async function read(run: GptRunner, cache: KvCache, ids: number[], all = false): Promise<Float32Array> {
    const l = run.forward(cache, ids, { all });
    const z = await l.read();
    l.dispose();
    return z;
  }

  const oneHot = (V: number, x: number) => {
    const q = new Float64Array(V);
    q[x] = 1;
    return q;
  };

  async function go(n = 100) {
    status = 'loading';
    try {
      target ??= await loadCourseGpt();
      if (drafter === 'model') draftModel ??= await loadDraftModel();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      status = 'error';
      return;
    }
    status = 'running';
    const V = target.cfg.vocab;
    const tRun = await runnerFor(target);
    const dRun = drafter === 'model' ? await runnerFor(draftModel!) : null;
    const promptIds = [target.eot, ...target.tok.encode(prompt)];

    // Baseline: plain cached decoding of the same number of tokens, timed before and after the
    // speculative run (after a warm-up), so that GPU clock changes affect both sides alike.
    const plain = async (tokens: number): Promise<number> => {
      const rngB = mulberry32(1);
      const cache = tRun.cache();
      const start = performance.now();
      let z = await read(tRun, cache, promptIds);
      for (let i = 0; i < tokens; i++) z = await read(tRun, cache, [sampleIndex(softmaxT(z, T), rngB())]);
      cache.dispose();
      return performance.now() - start;
    };
    await plain(20);
    const before = await plain(n);

    const rng = mulberry32(7);
    const ids = [...promptIds];
    const tCache = tRun.cache(), dCache = dRun?.cache();
    pieces = [{ text: prompt, kind: 'prompt' }];
    let passes = 0;
    const t0 = performance.now();
    while (ids.length - promptIds.length < n && ids.length + gamma + 1 < tCache.capacity) {
      const before = ids.length;
      // 1. Draft γ tokens.
      let drafts: number[] = [];
      const qs: Float64Array[] = [];
      if (dRun && dCache) {
        let feed = ids.slice(dCache.length);
        for (let j = 0; j < gamma; j++) {
          const q = softmaxT(await read(dRun, dCache, feed), T);
          const d = sampleIndex(q, rng());
          drafts.push(d);
          qs.push(q);
          feed = [d];
        }
      } else {
        drafts = lookup(ids, 2, gamma);
        drafts.forEach((d) => qs.push(oneHot(V, d)));
      }
      // 2. The target scores every draft in one pass: feed what it has not seen, plus the drafts.
      const feed = [...ids.slice(tCache.length), ...drafts];
      const all = await read(tRun, tCache, feed, true);
      passes++;
      const k = drafts.length;
      const p = Array.from({ length: k + 1 }, (_, i) => softmaxT(all.subarray((feed.length - k - 1 + i) * V, (feed.length - k + i) * V), T));
      // 3. Accept or correct, then roll both caches back to the tokens that survived.
      const { tokens, accepted } = speculativeAccept(p, qs, drafts, rng);
      ids.push(...tokens);
      tCache.length = before + accepted;
      if (dCache) dCache.length = Math.min(dCache.length, before + accepted);
      const text = (xs: number[]) => target!.tok.decode(xs.filter((x) => x !== target!.eot));
      if (accepted) pieces.push({ text: text(tokens.slice(0, accepted)), kind: 'accepted' });
      pieces.push({ text: text(tokens.slice(accepted)), kind: 'target' });
      pieces = [...pieces];
      if (tokens.includes(target.eot)) break;
    }
    const ms = performance.now() - t0;
    tCache.dispose();
    dCache?.dispose();
    const baselineMs = (before + (await plain(n))) / 2;
    stats = { passes, tokens: ids.length - promptIds.length, ms, baselineMs: (baselineMs * (ids.length - promptIds.length)) / n };
    status = 'idle';
  }
</script>

<Widget
  title="Speculative decoding"
  subtitle="A drafter guesses γ tokens; CourseGPT checks all of them in one forward pass. Green text is drafts CourseGPT accepted; blue is the one token it produces itself at the end of each check."
  onreset={() => {
    gamma = 4;
    T = 0.7;
    drafter = 'model';
  }}
>
  {#snippet controls()}
    <Button variant="primary" onclick={() => go()} disabled={status === 'loading' || status === 'running'}>{status === 'loading' ? 'Loading…' : status === 'running' ? 'Generating…' : 'Generate 100 tokens'}</Button>
    <Segmented label="Drafter" size="sm" options={[{ value: 'model', label: 'Draft model (2 layers)' }, { value: 'lookup', label: 'Prompt lookup' }]} bind:value={drafter} />
    <div class="sl"><Slider label="Draft length γ" min={1} max={8} step={1} value={gamma} oninput={(v) => (gamma = Math.round(v))} format={(v) => String(Math.round(v))} /></div>
    <div class="sl"><Slider label="Temperature" min={0} max={1.5} step={0.05} value={T} oninput={(v) => (T = v)} /></div>
  {/snippet}

  <textarea bind:value={prompt} rows="2" spellcheck="false" aria-label="Prompt" disabled={status === 'running'}></textarea>
  {#if status === 'error'}<p class="muted">{error}</p>{/if}
  {#if pieces.length > 1}
    <div class="out">{#each pieces as piece, i (i)}<span class={piece.kind}>{piece.text}</span>{/each}</div>
  {/if}
  {#if stats}
    <div class="stats ui">
      <span><strong class="num">{(stats.tokens / stats.passes).toFixed(2)}</strong> tokens per CourseGPT pass</span>
      <span><strong class="num">{stats.passes}</strong> passes for {stats.tokens} tokens</span>
      <span>wall clock <strong class="num">{(stats.baselineMs / stats.ms).toFixed(2)}×</strong> the speed of plain decoding ({(stats.ms / stats.tokens).toFixed(1)} against {(stats.baselineMs / stats.tokens).toFixed(1)} ms per token; noisy, as GPU clocks vary)</span>
    </div>
  {/if}
</Widget>

<style>
  .sl {
    flex: 0 1 10rem;
  }
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  textarea {
    width: 100%;
    font-family: var(--font-body);
    font-size: 0.92rem;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
    resize: vertical;
  }
  .out {
    margin-top: 0.5rem;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    font-size: 0.92rem;
    line-height: 1.7;
    white-space: pre-wrap;
  }
  .prompt {
    color: var(--ink-3);
  }
  .accepted {
    background: color-mix(in srgb, var(--good) 22%, transparent);
  }
  .target {
    background: color-mix(in srgb, var(--series-1) 22%, transparent);
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.4rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    margin-top: 0.5rem;
  }
  .stats strong {
    color: var(--ink);
  }
</style>
