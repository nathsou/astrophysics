<!--
  Gradient descent and heavy-ball momentum on the quadratic f(x, y) = ½(λ₁x² + λ₂y²), λ₁ = 1,
  λ₂ = 1/κ: the trajectory on the contours, and the loss per step against the theoretical rates.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';

  let kappa = $state(20);
  let eta = $state(0.9); // as a fraction of the stability limit 2 / λmax
  let beta = $state(0);
  const STEPS = 60;
  const l1 = 1;
  const l2 = $derived(1 / kappa);
  const lr = $derived((eta * 2) / l1);

  const run = $derived.by(() => {
    let x = -1.6, y = 1.1, vx = 0, vy = 0;
    const path: [number, number][] = [[x, y]];
    const loss: number[] = [0.5 * (l1 * x * x + l2 * y * y)];
    for (let t = 0; t < STEPS; t++) {
      vx = beta * vx + l1 * x;
      vy = beta * vy + l2 * y;
      x -= lr * vx;
      y -= lr * vy;
      path.push([x, y]);
      loss.push(0.5 * (l1 * x * x + l2 * y * y));
    }
    return { path, loss };
  });
  // Best achievable rates on this problem (per step, for the distance to the minimum).
  const gdRate = $derived((kappa - 1) / (kappa + 1));
  const hbRate = $derived((Math.sqrt(kappa) - 1) / (Math.sqrt(kappa) + 1));
  const bestEta = $derived(2 / (l1 + l2) / (2 / l1));
  const bestBeta = $derived(hbRate ** 2);
  const L0 = $derived(run.loss[0]!);
  const diverged = $derived(!Number.isFinite(run.loss.at(-1)!) || run.loss.at(-1)! > L0 * 10);
  const clip = (v: number) => Math.max(-2, Math.min(2, v));
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const pow10 = (v: number) => {
    const e = Math.round(Math.log10(v));
    return e === 0 ? '1' : `10${e < 0 ? '⁻' : ''}${[...String(Math.abs(e))].map((d) => SUP[+d]).join('')}`;
  };
</script>

<Widget
  title="Conditioning, step size and momentum"
  subtitle="Gradient descent on f = ½(x² + y²/κ): curvature 1 along x, 1/κ along y. The learning rate is shown as a fraction of the stability limit 2/λmax."
  onreset={() => {
    kappa = 20;
    eta = 0.9;
    beta = 0;
  }}
>
  {#snippet controls()}
    <div class="sl"><Slider label="Condition number κ" min={1} max={200} log value={kappa} oninput={(v) => (kappa = v)} format={(v) => v.toFixed(0)} /></div>
    <div class="sl"><Slider label="η × λmax / 2" min={0.05} max={1.1} step={0.01} value={eta} oninput={(v) => (eta = v)} /></div>
    <div class="sl"><Slider label="Momentum β" min={0} max={0.98} step={0.01} value={beta} oninput={(v) => (beta = v)} /></div>
  {/snippet}

  <div class="two">
    <Plot label="Trajectory on the contours of f" height={240} x={{ domain: [-2, 2], label: 'x (steep)', ticks: 5 }} y={{ domain: [-2, 2], label: 'y (flat)', ticks: 5 }} crosshair={false}>
      {#snippet marks({ sx, sy })}
        {#each [0.02, 0.1, 0.3, 0.7, 1.3, 2] as c (c)}
          <ellipse cx={sx(0)} cy={sy(0)} rx={sx(Math.sqrt((2 * c) / l1)) - sx(0)} ry={sy(0) - sy(Math.sqrt((2 * c) / l2))} fill="none" stroke="var(--grid)" stroke-width="1.2" />
        {/each}
        <path class="line" stroke="var(--series-1)" fill="none" d={'M' + run.path.map(([x, y]) => `${sx(clip(x))},${sy(clip(y))}`).join('L')} />
        {#each run.path.slice(0, 25) as [x, y], i (i)}<circle cx={sx(clip(x))} cy={sy(clip(y))} r="2.2" fill="var(--series-1)" />{/each}
      {/snippet}
    </Plot>
    <div>
      <Legend items={[{ label: 'f after each step', color: 'var(--series-1)' }, { label: 'best rate, plain GD', color: 'var(--series-2)', dashed: true }, { label: 'best rate, momentum', color: 'var(--series-3)', dashed: true }]} />
      <Plot label="Loss against step, log scale" height={200} x={{ domain: [0, STEPS], label: 'step', ticks: 6 }} y={{ type: 'log', domain: [1e-8, 10], label: 'f', tickValues: [1e-8, 1e-6, 1e-4, 1e-2, 1], format: pow10 }}>
        {#snippet marks({ sx, sy })}
          <path class="line" stroke="var(--series-2)" stroke-dasharray="4 4" d={'M' + Array.from({ length: STEPS + 1 }, (_, t) => `${sx(t)},${sy(Math.max(1e-8, L0 * gdRate ** (2 * t)))}`).join('L')} />
          <path class="line" stroke="var(--series-3)" stroke-dasharray="4 4" d={'M' + Array.from({ length: STEPS + 1 }, (_, t) => `${sx(t)},${sy(Math.max(1e-8, L0 * hbRate ** (2 * t)))}`).join('L')} />
          <path class="line" stroke="var(--series-1)" d={'M' + run.loss.map((l, t) => `${sx(t)},${sy(Math.min(10, Math.max(1e-8, l)))}`).join('L')} />
        {/snippet}
      </Plot>
    </div>
  </div>
  <p class="note ui">
    {#if diverged}
      Diverging: above the limit, the steep direction overshoots further at every step.
    {:else}
      Best plain step size η·λmax/2 = <strong class="num">{bestEta.toFixed(2)}</strong> gives a rate of <strong class="num">{gdRate.toFixed(3)}</strong> per step; with momentum β = <strong class="num">{bestBeta.toFixed(2)}</strong> (and step 4/(√λmax + √λmin)²) the rate improves to <strong class="num">{hbRate.toFixed(3)}</strong>. At κ = {kappa.toFixed(0)}, that is about {Math.ceil(Math.log(1e-3) / Math.log(gdRate))} against {Math.ceil(Math.log(1e-3) / Math.log(hbRate))} steps to shrink the error a thousandfold.
    {/if}
  </p>
</Widget>

<style>
  .sl {
    flex: 1 1 11rem;
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.2rem;
  }
  @media (max-width: 720px) {
    .two {
      grid-template-columns: 1fr;
    }
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
