<!--
  Measured with CourseGPT in PyTorch: for each decoding setting, how probable the generated text is under
  the model against how much it repeats itself — with real stories as the reference point.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { DATA, type TradeoffResult } from '../data';

  const R = DATA.tradeoff;
  const results = R?.results ?? [];
  let hover = $state<TradeoffResult | null>(null);
  const bits = (nats: number) => -nats / Math.LN2; // surprise per token, in bits
  const xs = results.map((r) => r.repetition), ys = results.map((r) => bits(r.logp));
  const xMax = Math.min(1, Math.max(0.05, ...xs) * 1.1);
  const yMax = Math.max(1, ...ys) * 1.1;
  const kind = (r: TradeoffResult) => (r.label === 'real stories' ? 'ref' : r.label.startsWith('greedy') || r.label.startsWith('beam') ? 'search' : 'sample');
  const colour = { ref: 'var(--ink)', search: 'var(--series-2)', sample: 'var(--series-1)' } as const;
  const ex = R?.examples;
  // The nearest setting to the pointer (x linear, y logarithmic, as plotted); none if far away.
  function pick(p: { x: number; y: number } | null) {
    if (!p) return void (hover = null);
    let best: TradeoffResult | null = null, dist = Infinity;
    for (const r of results) {
      const d = ((r.repetition - p.x) / xMax) ** 2 + (Math.log(bits(r.logp) / p.y) / Math.log(yMax / 0.4)) ** 2;
      if (d < dist) (best = r), (dist = d);
    }
    hover = dist < 0.003 ? best : null;
  }
</script>

<Widget
  title="Likely text is not good text"
  subtitle={R ? `Measured with CourseGPT: ${R.n} validation stories continued from their first ${R.prompt_len} tokens for ${R.steps} tokens with each setting. Hover a point.` : 'Measured with CourseGPT in PyTorch.'}
  kind="Measured"
>
  {#if !R}
    <p class="muted">Run <code>uv run lmc ch15 tradeoff</code> and <code>uv run lmc ch15 summary</code>.</p>
  {:else}
    <div class="two">
      <Plot label="Surprise against repetition for each decoding setting" height={280} onpointer={pick} x={{ domain: [0, xMax], label: 'repetition: share of 4-grams already used in the same text', format: (v) => `${(v * 100).toFixed(0)}%`, ticks: 5 }} y={{ type: 'log', domain: [0.4, yMax], label: 'surprise (bits / token, model at T = 1)', tickValues: [0.5, 1, 2, 4, 8] }}>
        {#snippet marks({ sx, sy })}
          {#each results as r (r.label)}
            <circle cx={sx(r.repetition)} cy={sy(bits(r.logp))} r={hover === r ? 7 : r.label === 'real stories' ? 6 : 4.5} fill={colour[kind(r)]} opacity={hover && hover !== r ? 0.35 : 0.9} />
          {/each}
        {/snippet}
      </Plot>
      <div class="side">
        <ul class="key ui">
          <li><span class="dot" style:background={colour.ref}></span>real stories (the reference)</li>
          <li><span class="dot" style:background={colour.search}></span>greedy and beam search</li>
          <li><span class="dot" style:background={colour.sample}></span>sampling settings</li>
        </ul>
        {#if hover}
          <div class="card">
            <strong>{hover.label}</strong>
            <div class="num">surprise {bits(hover.logp).toFixed(2)} bits / token</div>
            <div class="num">repetition {(hover.repetition * 100).toFixed(1)}%</div>
            <div class="num">distinct 4-grams {(hover.distinct4 * 100).toFixed(1)}%</div>
          </div>
        {:else}
          <p class="muted">Search methods sit at the bottom right: the most probable text, full of loops. High temperatures sit at the top: surprising text that loses the thread. The real stories are in between, and good settings land near them.</p>
        {/if}
      </div>
    </div>
    {#if ex}
      <div class="examples">
        <p class="ui k">The same prompt: “{ex.prompt}…”</p>
        <div class="ex"><span class="k">greedy</span><p>{ex.greedy}</p></div>
        <div class="ex"><span class="k">T = 1</span><p>{ex.t1}</p></div>
        <div class="ex"><span class="k">T = 1.5</span><p>{ex.t15}</p></div>
        <div class="ex"><span class="k">T = 1.5, min-p 0.1</span><p>{ex.t15minp}</p></div>
      </div>
    {/if}
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
    gap: 1.2rem;
  }
  @media (max-width: 720px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  .key {
    list-style: none;
    padding: 0;
    margin: 0 0 0.7rem;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .dot {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    margin-right: 0.4rem;
  }
  .card {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.5rem 0.7rem;
    font-size: 0.8rem;
    background: var(--surface);
  }
  .examples {
    margin-top: 0.8rem;
    border-top: 1px solid var(--rule);
    padding-top: 0.6rem;
  }
  .k {
    font-size: 0.75rem;
    color: var(--ink-2);
  }
  .ex {
    display: grid;
    grid-template-columns: 9rem minmax(0, 1fr);
    gap: 0.6rem;
    font-size: 0.85rem;
  }
  .ex p {
    margin: 0 0 0.5rem;
    white-space: pre-wrap;
  }
</style>
