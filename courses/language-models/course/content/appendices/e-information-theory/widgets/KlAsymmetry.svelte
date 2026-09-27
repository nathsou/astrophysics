<!--
  Fit a single Gaussian q to a two-peaked distribution p, once by minimising the forward KL
  D(p‖q) and once the reverse KL D(q‖p). Forward KL covers both modes; reverse KL picks one.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';

  let sep = $state(5.5);
  let weight = $state(0.6);

  const X0 = -8, X1 = 8, N = 400;
  const xs = Array.from({ length: N }, (_, i) => X0 + ((X1 - X0) * (i + 0.5)) / N);
  const dx = (X1 - X0) / N;
  const gauss = (x: number, mu: number, s: number) => Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));

  const p = $derived(xs.map((x) => weight * gauss(x, -sep / 2, 0.8) + (1 - weight) * gauss(x, sep / 2, 0.8)));

  function kl(a: number[], b: number[]): number {
    let s = 0;
    for (let i = 0; i < N; i++) if (a[i]! > 1e-300) s += a[i]! * Math.log(a[i]! / Math.max(b[i]!, 1e-300)) * dx;
    return s;
  }

  /** Coarse-to-fine grid search over (μ, σ) for the Gaussian minimising the chosen divergence. */
  function fit(direction: 'forward' | 'reverse') {
    const score = (mu: number, s: number) => {
      const q = xs.map((x) => gauss(x, mu, s));
      return direction === 'forward' ? kl(p, q) : kl(q, p);
    };
    let best = { mu: 0, s: 1, v: Infinity };
    const search = (mus: number[], ss: number[]) => {
      for (const mu of mus) for (const s of ss) {
        const v = score(mu, s);
        if (v < best.v) best = { mu, s, v };
      }
    };
    const range = (a: number, b: number, step: number) => Array.from({ length: Math.round((b - a) / step) + 1 }, (_, i) => a + i * step);
    search(range(-6, 6, 0.25), range(0.3, 6, 0.15));
    const { mu, s } = best;
    search(range(mu - 0.25, mu + 0.25, 0.025), range(Math.max(0.2, s - 0.15), s + 0.15, 0.015));
    return best;
  }

  const fwd = $derived(fit('forward'));
  const rev = $derived(fit('reverse'));
  const qf = $derived(xs.map((x) => gauss(x, fwd.mu, fwd.s)));
  const qr = $derived(xs.map((x) => gauss(x, rev.mu, rev.s)));
  const ymax = $derived(Math.max(...p, ...qf, ...qr) * 1.1);
  const path = (ys: number[], sx: (v: number) => number, sy: (v: number) => number) => 'M' + xs.map((x, i) => `${sx(x)},${sy(ys[i]!)}`).join('L');
</script>

<Widget
  title="KL divergence is not symmetric"
  subtitle="The target p (grey) has two peaks. A single Gaussian q cannot match it, so the direction of the divergence decides which compromise we get."
  onreset={() => {
    sep = 5.5;
    weight = 0.6;
  }}
>
  {#snippet controls()}
    <div class="ctl"><Slider label="Distance between the peaks" min={0} max={8} step={0.1} bind:value={sep} /></div>
    <div class="ctl"><Slider label="Weight of the left peak" min={0.05} max={0.95} step={0.01} bind:value={weight} /></div>
  {/snippet}

  <Legend
    items={[
      { label: 'Target p', color: 'var(--ink-3)' },
      { label: `Forward KL, argmin D(p‖q): μ = ${fwd.mu.toFixed(1)}, σ = ${fwd.s.toFixed(2)}`, color: 'var(--series-1)' },
      { label: `Reverse KL, argmin D(q‖p): μ = ${rev.mu.toFixed(1)}, σ = ${rev.s.toFixed(2)}`, color: 'var(--series-2)' },
    ]}
  />
  <Plot label="Target distribution and the two fitted Gaussians" height={280} x={{ domain: [X0, X1], label: 'x', ticks: 8 }} y={{ domain: [0, ymax], label: 'density', ticks: 4 }}>
    {#snippet marks({ sx, sy })}
      <path d={path(p, sx, sy) + `L${sx(X1)},${sy(0)}L${sx(X0)},${sy(0)}Z`} fill="var(--ink-3)" opacity="0.15" />
      <path class="line" stroke="var(--ink-3)" d={path(p, sx, sy)} />
      <path class="line" stroke="var(--series-1)" d={path(qf, sx, sy)} />
      <path class="line" stroke="var(--series-2)" d={path(qr, sx, sy)} />
    {/snippet}
  </Plot>
  <p class="foot">
    <strong>Forward KL</strong> penalises q for being small wherever p has mass, so q spreads to cover both peaks (“mode-covering”) — even putting mass in the valley where p has none. <strong>Reverse KL</strong> penalises q for putting mass where p has little, so q settles on one peak (“mode-seeking”). Move the peaks closer: below a separation of about 4.5 there is no longer a clear valley, and both directions settle on a similar broad Gaussian. Maximum likelihood minimises the forward KL; the KL penalty in RLHF (Chapter 21) uses the reverse direction.
  </p>
</Widget>

<style>
  .ctl {
    flex: 1 1 12rem;
  }
  .foot {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
    line-height: 1.5;
  }
</style>
