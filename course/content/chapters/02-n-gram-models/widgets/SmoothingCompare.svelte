<script lang="ts">
  import { onMount } from 'svelte';
  import { params, focus } from '$lib/state/params.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { charData, model, type CharData } from '../shared';

  let data: CharData | null = $state(null);
  let context = $state('the qu');
  let order = $state(4);
  onMount(async () => {
    data = await charData();
  });

  const k = $derived(params.get('smooth.k', 0.1));
  const d = $derived(params.get('smooth.d', 0.75));
  const SERIES = [
    { key: 'mle', label: 'MLE', color: 'var(--series-1)' },
    { key: 'addk', label: 'Add-k', color: 'var(--series-2)' },
    { key: 'kn', label: 'Kneser–Ney', color: 'var(--series-3)' },
  ] as const;

  const result = $derived.by(() => {
    if (!data) return null;
    const ids = [...context].filter((c) => data!.vocab.chars.includes(c)).map((c) => data!.vocab.encode(c)[0]!);
    const ctx = ids.slice(Math.max(0, ids.length - (order - 1)));
    const dists = {
      mle: model(data, order, { kind: 'mle' }).distribution(ctx),
      addk: model(data, order, { kind: 'addk', k }).distribution(ctx),
      kn: model(data, order, { kind: 'kn', d }).distribution(ctx),
    };
    // Context count and how many distinct characters followed it in training.
    const t = data.stats.table(order);
    const code = data.stats.codeOf(ctx, ctx.length, ctx.length);
    const [lo, hi] = ctx.length === order - 1 ? data.stats.range(t, code) : [0, 0];
    const seen = new Set<number>();
    for (let i = lo; i < hi; i++) seen.add(t.codes[i]! % data.vocab.vocabSize);
    const ctxCount = t.cum[hi]! - t.cum[lo]!;
    const V = data.vocab.vocabSize;
    // Show the seen continuations, then the unseen ones Kneser–Ney considers most likely.
    const all = [...Array(V).keys()];
    const seenTop = all.filter((i) => seen.has(i)).sort((a, b) => dists.mle[b]! - dists.mle[a]!).slice(0, 7);
    const unseenTop = all.filter((i) => !seen.has(i)).sort((a, b) => dists.kn[b]! - dists.kn[a]!).slice(0, Math.max(4, 10 - seenTop.length));
    const unseenMass = (p: Float64Array) => [...p].reduce((s, x, i) => (seen.has(i) ? s : s + x), 0);
    return { ctx, dists, top: [...seenTop, ...unseenTop], seen, ctxCount, unseen: { mle: unseenMass(dists.mle), addk: unseenMass(dists.addk), kn: unseenMass(dists.kn) } };
  });

  const show = (id: number) => data?.vocab.show(id) ?? '';
  const maxP = $derived(result ? Math.max(...result.top.flatMap((i) => SERIES.map((s) => result!.dists[s.key][i]!))) : 1);
  const pct = (p: number) => (p < 0.001 && p > 0 ? '<0.1%' : `${(p * 100).toFixed(1)}%`);
</script>

<Widget
  title="Where does the probability go?"
  subtitle="Next-character distributions after a context, under three estimators. Smoothing takes mass from what was seen and gives it to what wasn’t — the question is how much, and to whom."
>
  {#snippet controls()}
    <label class="grp">
      <span class="lbl">Context</span>
      <input bind:value={context} spellcheck="false" />
    </label>
    <div class="grp">
      <span class="lbl">Order n</span>
      <Segmented label="Order" size="sm" options={[2, 3, 4, 5, 6].map((v) => ({ value: v, label: String(v) }))} bind:value={order} />
    </div>
    <div class="presets">
      {#each ['the qu', 'ROMEO', 'my lo', 'xyzzy', 'thou a'] as c (c)}<button class="chip" onclick={() => (context = c)}>{c}</button>{/each}
    </div>
  {/snippet}

  {#if !data || !result}
    <p class="lbl">Counting n-grams…</p>
  {:else}
    <p class="info">
      Context <code>{result.ctx.map(show).join('')}</code> occurred <strong class="num">{result.ctxCount.toLocaleString('en-GB')}</strong> times in training, followed by
      <strong class="num">{result.seen.size}</strong> distinct characters out of {data.vocab.vocabSize}.
      {#if result.ctxCount === 0}<strong>Never seen:</strong> MLE and add-k fall back to uniform; Kneser–Ney backs off to shorter contexts.{/if}
    </p>
    <Legend items={SERIES.map((s) => ({ label: s.label, color: s.color, dot: true }))} />
    <div class="chart" role="table" aria-label="Probability of each next character under each estimator">
      {#each result.top as id (id)}
        <div class="row" role="row" class:unseen={!result.seen.has(id)}>
          <code class="ch" role="rowheader">{show(id)}</code>
          <div class="bars">
            {#each SERIES as s (s.key)}
              {@const p = result.dists[s.key][id]!}
              <div class="b" title="{s.label}: {pct(p)}">
                <span style:width="{(p / maxP) * 100}%" style:background={s.color}></span>
                <em class="num">{pct(p)}</em>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="unseen-sum" onpointerenter={() => focus.set('d', 'smoothing')} onpointerleave={() => focus.set(null)}>
      <span class="k">Total probability given to the {data.vocab.vocabSize - result.seen.size} characters never seen after this context:</span>
      {#each SERIES as s (s.key)}<span class="tag"><i style:background={s.color}></i>{s.label} <strong class="num">{pct(result.unseen[s.key])}</strong></span>{/each}
    </div>
    <p class="hint">Change k and d with the sliders under equations (5) and (7). Rows with a dashed outline are unseen continuations.</p>
  {/if}
</Widget>

<style>
  .grp {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .lbl,
  .k,
  .hint {
    font-size: 0.74rem;
    color: var(--ink-2);
  }
  input {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
    width: 8rem;
  }
  .presets {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  .chip {
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 99px;
    padding: 0.15rem 0.55rem;
    font-size: 0.74rem;
    font-family: var(--font-mono);
    cursor: pointer;
    color: var(--ink-2);
  }
  .info {
    font-size: 0.84rem;
    margin: 0 0 0.6rem;
  }
  .chart {
    display: grid;
    gap: 4px;
  }
  .row {
    display: grid;
    grid-template-columns: 2rem 1fr;
    align-items: center;
    gap: 0.5rem;
    padding: 2px 4px;
    border-radius: 5px;
  }
  .row.unseen {
    outline: 1px dashed var(--rule-strong);
  }
  .ch {
    text-align: center;
  }
  .bars {
    display: grid;
    gap: 2px;
  }
  .b {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    height: 8px;
  }
  .b span {
    display: block;
    height: 8px;
    min-width: 1px;
    border-radius: 0 3px 3px 0;
  }
  .b em {
    font-style: normal;
    font-size: 0.64rem;
    color: var(--ink-3);
    line-height: 1;
  }
  .unseen-sum {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1rem;
    align-items: center;
    margin-top: 0.9rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--rule);
    font-size: 0.8rem;
    cursor: help;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .tag i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }
  .hint {
    margin: 0.5rem 0 0;
  }
</style>
