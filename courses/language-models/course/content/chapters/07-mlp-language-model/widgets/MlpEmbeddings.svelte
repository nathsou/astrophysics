<!--
  The model's character embeddings, projected to 2-D with PCA, updating as it trains.
  Hover a character to see its nearest neighbours by cosine similarity in the full d-dimensional space.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { pca, cosineRows } from '@lm/core';
  import { impl } from '$lib/exercise/impl.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { mlp } from '../trainer.svelte';

  onMount(() => {
    void mlp.load();
  });

  let hover: number | null = $state(null);
  let width = $state(600);
  const H = 360;
  const d = $derived(mlp.config.d);
  const V = $derived(mlp.V);
  const project = $derived(impl.get('pca.top2', (data: ArrayLike<number>, rows: number, cols: number) => pca(data, rows, cols, 2).projected));
  const emb = $derived(mlp.snapshot?.embedding ?? null);
  const pts = $derived.by(() => {
    if (!emb || !mlp.vocab) return [];
    const p = project(emb, V, d);
    let xs = [], ys = [];
    for (let i = 0; i < V; i++) {
      xs.push(p[i * 2]!);
      ys.push(p[i * 2 + 1]!);
    }
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)], [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    return xs.map((x, i) => {
      const ch = mlp.vocab.chars[i]!;
      const cls = /[a-z]/.test(ch) ? 0 : /[A-Z]/.test(ch) ? 1 : 2;
      return { i, ch: mlp.vocab.show(i), cls, x: 24 + ((x - x0) / (x1 - x0 || 1)) * (width - 48), y: 20 + ((ys[i]! - y0) / (y1 - y0 || 1)) * (H - 40) };
    });
  });
  const neighbours = $derived.by(() => {
    if (hover === null || !emb) return [];
    return Array.from({ length: V }, (_, j) => ({ j, s: j === hover ? -2 : cosineRows(emb, d, hover!, j) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 6);
  });
  const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];
</script>

<Widget
  title="What the embeddings learn"
  subtitle="Each character’s {d}-dimensional embedding, projected onto its two directions of greatest variance (PCA). At step 0 the layout is random; watch structure appear as the model trains."
>
  <Legend items={[{ label: 'lower-case letters', color: COLORS[0]!, dot: true }, { label: 'capitals', color: COLORS[1]!, dot: true }, { label: 'punctuation, space, digits', color: COLORS[2]!, dot: true }]} />
  <div class="wrap" bind:clientWidth={width}>
    <svg {width} height={H} role="img" aria-label="2-D projection of character embeddings">
      {#each pts as p (p.i)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g transform="translate({p.x},{p.y})" onpointerenter={() => (hover = p.i)} onpointerleave={() => (hover = null)} class:hl={hover === p.i} class:nb={neighbours.some((n) => n.j === p.i)}>
          <circle r="11" fill={COLORS[p.cls]} class="dot" />
          <text dy="0.35em" text-anchor="middle">{p.ch}</text>
        </g>
      {/each}
    </svg>
  </div>
  <div class="info">
    {#if hover !== null && mlp.vocab}
      Nearest to <code>{mlp.vocab.show(hover)}</code>:
      {#each neighbours as n (n.j)}<span class="nbr"><code>{mlp.vocab.show(n.j)}</code> {n.s.toFixed(2)}</span>{/each}
    {:else}
      Step {mlp.snapshot?.step ?? 0}. Hover a character for its nearest neighbours. {impl.isMine('pca.top2') ? 'Projected with your PCA.' : ''}
    {/if}
  </div>
</Widget>

<style>
  .wrap {
    width: 100%;
    background: var(--chart-surface);
  }
  svg {
    display: block;
  }
  .dot {
    opacity: 0.22;
    stroke: var(--chart-surface);
    stroke-width: 2;
  }
  g text {
    font-family: var(--font-mono);
    font-size: 12px;
    fill: var(--ink);
    pointer-events: none;
  }
  g {
    cursor: default;
    transition: transform 400ms ease;
  }
  g.hl .dot {
    opacity: 0.9;
  }
  g.nb .dot {
    opacity: 0.55;
  }
  .info {
    font-size: 0.8rem;
    color: var(--ink-2);
    min-height: 1.5rem;
    margin-top: 0.4rem;
  }
  .nbr {
    margin-left: 0.6rem;
  }
</style>
