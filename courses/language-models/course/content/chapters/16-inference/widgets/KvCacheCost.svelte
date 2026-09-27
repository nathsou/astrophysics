<!--
  What a KV cache saves: generating T tokens one at a time, without a cache every step recomputes every
  earlier position; with a cache each position is computed once and its keys and values are reused.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';

  let T = $state(16);
  let step = $state(10);
  const s = $derived(Math.min(step, T));
  // Position-wise work (projections, MLP): Σ t without a cache, T with one.
  const noCache = $derived((T * (T + 1)) / 2);
  // Attention scores: each step's queries against its keys. Without a cache every earlier query is
  // recomputed too: Σ t², against Σ t.
  const attNo = $derived((T * (T + 1) * (2 * T + 1)) / 6);
  const attCache = $derived((T * (T + 1)) / 2);
  const cell = $derived(Math.max(6, Math.min(18, Math.floor(300 / T))));
</script>

<Widget
  title="What the KV cache saves"
  subtitle="Generating a sequence one token at a time. Each row is one generation step, each square one position whose layers are computed at that step. Drag the step slider to watch the sequence grow."
  onreset={() => {
    T = 16;
    step = 10;
  }}
>
  {#snippet controls()}
    <div class="sl"><Slider label="Tokens generated T" min={4} max={48} step={1} value={T} oninput={(v) => (T = Math.round(v))} format={(v) => String(Math.round(v))} /></div>
    <div class="sl"><Slider label="Current step" min={1} max={T} step={1} value={s} oninput={(v) => (step = Math.round(v))} format={(v) => String(Math.round(v))} /></div>
  {/snippet}

  <div class="two">
    {#each [false, true] as cached (cached)}
      <div>
        <p class="head ui">{cached ? 'With a KV cache' : 'Without a cache'}</p>
        <svg width={T * cell + 2} height={T * cell + 2} role="img" aria-label={cached ? 'Work with a cache' : 'Work without a cache'}>
          {#each Array.from({ length: T }, (_, r) => r) as r (r)}
            {#each Array.from({ length: r + 1 }, (_, c) => c) as c (c)}
              {@const computed = cached ? c === r : true}
              <rect x={1 + c * cell} y={1 + r * cell} width={cell - 1.5} height={cell - 1.5} rx="1.5" class:computed class:reused={!computed} class:future={r >= s} class:now={r === s - 1} />
            {/each}
          {/each}
        </svg>
        <p class="count ui"><strong class="num">{cached ? T : noCache}</strong> position computations{#if cached}, plus <span class="reuse">{noCache - T}</span> reads from the cache{/if}</p>
      </div>
    {/each}
  </div>
  <p class="note ui">
    Without a cache, generating {T} tokens computes {noCache.toLocaleString('en-GB')} positions: the work grows with T². With one, it computes each of the {T} positions once, {(noCache / T).toFixed(1)} times less. Attention itself still reads every earlier key at every step ({attCache.toLocaleString('en-GB')} query–key products with the cache, against {attNo.toLocaleString('en-GB')} without), which is why long contexts stay expensive.
  </p>
</Widget>

<style>
  .sl {
    flex: 1 1 12rem;
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.5rem;
  }
  @media (max-width: 640px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  .head {
    font-size: 0.8rem;
    font-weight: 600;
    margin: 0 0 0.4rem;
  }
  rect.computed {
    fill: var(--series-2);
  }
  rect.reused {
    fill: var(--series-1);
    opacity: 0.45;
  }
  rect.future {
    opacity: 0.12;
  }
  rect.now {
    stroke: var(--ink);
    stroke-width: 1;
  }
  .count {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.3rem 0 0;
  }
  .count strong {
    color: var(--series-2);
    font-size: 0.95rem;
  }
  .reuse {
    color: var(--series-1);
    font-weight: 600;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
    margin: 0.7rem 0 0;
  }
</style>
