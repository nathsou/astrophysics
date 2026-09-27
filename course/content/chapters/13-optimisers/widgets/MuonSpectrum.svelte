<!--
  What Muon does to an update: a gradient matrix is dominated by a few directions (a few large
  singular values). Newton–Schulz iterations push every singular value towards 1, so the rare
  directions get as large a step as the common ones.
-->
<script lang="ts">
  import { Tensor } from '@lm/core/tensor';
  import { mulberry32, svd } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';

  const M = 24, N = 48;
  const [a, b, c] = [3.4445, -4.775, 2.0315];
  let steps = $state(5);

  // A gradient-like matrix: a few strong rank-one directions plus weak noise.
  const G = (() => {
    const rng = mulberry32(3);
    let g = Tensor.randn([M, N], { rng, std: 0.05 });
    [8, 3, 1.5, 0.8].forEach((s) => {
      const u = Tensor.randn([M, 1], { rng }), v = Tensor.randn([1, N], { rng });
      g = g.add(u.matmul(v).mul(s / Math.sqrt(M * N)));
    });
    return g;
  })();

  function ns(k: number): Tensor {
    let X = G.div(Math.sqrt(G.mul(G).sum().item()) + 1e-7);
    for (let i = 0; i < k; i++) {
      const A = X.matmul(X.T);
      X = X.mul(a).add(A.mul(b).add(A.matmul(A).mul(c)).matmul(X));
    }
    return X;
  }
  const before = svd(G.toFloat32Array(), M, N).S;
  const after = $derived(svd(ns(steps).toFloat32Array(), M, N).S);
  const maxBefore = before[0]!;
  // The scalar map one iteration applies to each (normalised) singular value, composed `steps` times.
  const poly = (s: number) => a * s + b * s ** 3 + c * s ** 5;
  const composed = (s: number) => {
    let x = s;
    for (let i = 0; i < steps; i++) x = poly(x);
    return x;
  };
</script>

<Widget
  title="Muon evens out the update’s directions"
  subtitle="Left: singular values of a gradient-like matrix (24 × 48) before (normalised) and after Newton–Schulz. Right: the polynomial each iteration applies to every singular value, composed."
  onreset={() => (steps = 5)}
>
  {#snippet controls()}
    <div class="ctl"><Slider label="Newton–Schulz iterations" min={0} max={8} step={1} value={steps} oninput={(v) => (steps = Math.round(v))} format={(v) => String(Math.round(v))} /></div>
  {/snippet}

  <div class="two">
    <div>
      <Legend items={[{ label: 'before (÷ largest)', color: 'var(--ink-3)' }, { label: `after ${steps} iteration${steps === 1 ? '' : 's'}`, color: 'var(--series-1)' }]} />
      <Plot label="Singular values before and after" height={220} x={{ domain: [0.5, M + 0.5], label: 'index', ticks: 6 }} y={{ domain: [0, 1.3], label: 'singular value', ticks: 5 }}>
        {#snippet marks({ sx, sy })}
          {#each Array.from(before) as s, i (i)}
            <line x1={sx(i + 1) - 2} x2={sx(i + 1) - 2} y1={sy(0)} y2={sy(s / maxBefore)} stroke="var(--ink-3)" stroke-width="3" />
            <line x1={sx(i + 1) + 2} x2={sx(i + 1) + 2} y1={sy(0)} y2={sy(Math.min(1.3, after[i]!))} stroke="var(--series-1)" stroke-width="3" />
          {/each}
        {/snippet}
      </Plot>
    </div>
    <div>
      <Legend items={[{ label: 'identity (0 iterations)', color: 'var(--ink-3)', dashed: true }, { label: `p∘…∘p (${steps} times)`, color: 'var(--series-2)' }]} />
      <Plot label="Composed Newton–Schulz polynomial" height={220} x={{ domain: [0, 1], label: 'input singular value', ticks: 5 }} y={{ domain: [0, 1.3], label: 'output', ticks: 5 }}>
        {#snippet marks({ sx, sy })}
          <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} stroke="var(--ink-3)" stroke-dasharray="4 4" />
          <path class="line" stroke="var(--series-2)" d={'M' + Array.from({ length: 201 }, (_, i) => i / 200).map((s) => `${sx(s)},${sy(Math.min(1.3, Math.max(0, composed(s))))}`).join('L')} />
        {/snippet}
      </Plot>
    </div>
  </div>
  <p class="note ui">
    Before: the first singular value dwarfs the rest, so a plain gradient step moves the weights almost only along one direction. After five iterations, every singular value lies between about 0.7 and 1.2: each direction of the update gets a step of similar size. The polynomial is deliberately not exact; it trades precision for speed, reaching “roughly 1” in few iterations for any input between 0 and 1.
  </p>
</Widget>

<style>
  .ctl {
    flex: 0 1 14rem;
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.5rem;
  }
  @media (max-width: 700px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
</style>
