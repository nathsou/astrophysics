<!--
  Low-rank approximation by SVD: keep the top k singular values of a matrix (here, a small picture)
  and see how much of it survives — and how few numbers that takes.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { svd, lowRank, type Svd } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Heatmap from '$lib/gfx/Heatmap.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { params } from '$lib/state/params.svelte';

  const M = 48, N = 72;
  let image = $state.raw<Float32Array | null>(null);
  let dec = $state.raw<Svd | null>(null);
  const k = $derived(Math.round(params.get('la.rank', 4)));

  onMount(() => {
    // Draw a picture with a mix of structure: flat regions, straight edges, curves and text.
    const c = document.createElement('canvas');
    c.width = N;
    c.height = M;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, N, 0);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(1, '#888');
    g.fillStyle = grad;
    g.fillRect(0, 0, N, M);
    g.fillStyle = '#000';
    g.beginPath();
    g.arc(56, 16, 11, 0, 2 * Math.PI);
    g.fill();
    g.fillRect(4, 36, 64, 3);
    g.font = 'bold 30px Georgia, serif';
    g.fillText('LM', 5, 30);
    const px = g.getImageData(0, 0, N, M).data;
    const A = new Float64Array(M * N);
    for (let i = 0; i < M * N; i++) A[i] = 1 - px[i * 4]! / 255;
    image = Float32Array.from(A);
    dec = svd(A, M, N);
  });

  const approx = $derived(dec ? Float32Array.from(lowRank(dec, k)) : null);
  const energy = $derived.by(() => {
    if (!dec) return 0;
    const sq = Array.from(dec.S, (s) => s * s);
    const total = sq.reduce((a, b) => a + b, 0);
    return sq.slice(0, k).reduce((a, b) => a + b, 0) / total;
  });
  const stored = $derived(k * (M + N + 1));
</script>

<Widget
  title="Low-rank approximation with the SVD"
  subtitle="A 48 × 72 picture is a matrix. Keep only its k largest singular values and their vectors; the result is the best rank-k approximation there is."
  onreset={() => params.set('la.rank', 4)}
>
  {#snippet controls()}
    <div class="ctl"><Slider label="rank k" min={1} max={M} step={1} value={k} oninput={(v) => params.set('la.rank', v)} format={(v) => String(Math.round(v))} /></div>
  {/snippet}

  {#if image && approx && dec}
    <div class="pics">
      <figure>
        <Heatmap values={image} rows={M} cols={N} range={[0, 1]} showScale={false} label="Original picture as a matrix" />
        <figcaption>original: {(M * N).toLocaleString('en-GB')} numbers</figcaption>
      </figure>
      <figure>
        <Heatmap values={approx} rows={M} cols={N} range={[0, 1]} showScale={false} label="Rank-{k} approximation" />
        <figcaption>rank {k}: {stored.toLocaleString('en-GB')} numbers ({((stored / (M * N)) * 100).toFixed(0)}%), {(energy * 100).toFixed(1)}% of ‖A‖²</figcaption>
      </figure>
    </div>
    <Plot
      label="Singular values of the picture, largest first"
      height={180}
      x={{ domain: [0.5, M + 0.5], label: 'index i', ticks: 6 }}
      y={{ type: 'log', domain: [Math.max(1e-3, dec.S[M - 1]! * 0.8), dec.S[0]! * 1.5], label: 'σᵢ (log scale)' }}
    >
      {#snippet marks({ sx, sy })}
        {#each Array.from(dec!.S) as s, i (i)}
          <line x1={sx(i + 1)} x2={sx(i + 1)} y1={sy(Math.max(s, 1e-3))} y2={sy(Math.max(1e-3, dec!.S[M - 1]! * 0.8))} stroke={i < k ? 'var(--series-1)' : 'var(--ink-3)'} stroke-width="3" stroke-linecap="round" />
        {/each}
      {/snippet}
      {#snippet tooltip({ x })}
        {@const i = Math.min(M, Math.max(1, Math.round(x)))}
        <div class="num">σ{i} = {dec!.S[i - 1]!.toFixed(3)}{i <= k ? ' (kept)' : ''}</div>
      {/snippet}
    </Plot>
  {:else}
    <p class="muted">Computing the SVD…</p>
  {/if}
</Widget>

<style>
  .ctl {
    flex: 0 1 18rem;
  }
  .pics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  @media (max-width: 600px) {
    .pics {
      grid-template-columns: 1fr;
    }
  }
  figure {
    margin: 0;
  }
  figcaption {
    font-size: 0.76rem;
    color: var(--ink-2);
    margin-top: 0.3rem;
  }
  .muted {
    color: var(--ink-3);
  }
</style>
