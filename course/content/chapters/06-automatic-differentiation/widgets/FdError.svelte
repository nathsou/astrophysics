<!--
  Finite differences are a trade-off: a large ε gives truncation error ~ε², a small ε gives
  round-off error ~u/ε (u = machine epsilon). The best ε depends on the floating-point precision.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';

  let x0 = $state(0.7);
  const f64 = (x: number) => Math.tanh(x) * Math.exp(x / 2);
  const fr = Math.fround;
  // Float32 arithmetic: round every intermediate result to the nearest float32.
  const f32 = (x: number) => fr(fr(Math.tanh(fr(x))) * fr(Math.exp(fr(fr(x) / 2))));
  const exact = (x: number) => (1 - Math.tanh(x) ** 2) * Math.exp(x / 2) + 0.5 * Math.tanh(x) * Math.exp(x / 2);

  const EPS = Array.from({ length: 56 }, (_, i) => 10 ** (-0.5 - i * 0.2));
  const series = $derived.by(() => {
    const d = exact(x0);
    const e64 = EPS.map((e) => ({ e, err: Math.abs((f64(x0 + e) - f64(x0 - e)) / (2 * e) - d) / Math.abs(d) }));
    const e32 = EPS.map((e) => {
      const up = fr(x0 + e), down = fr(x0 - e);
      const num = (f32(up) - f32(down)) / (up - down || e);
      return { e, err: Math.abs(num - d) / Math.abs(d) };
    });
    return { e64, e32 };
  });
  const best = (s: { e: number; err: number }[]) => s.reduce((a, b) => (b.err > 0 && b.err < a.err ? b : a));
  const clip = (v: number) => Math.min(10, Math.max(1e-16, v || 1e-16));
</script>

<Widget
  title="Choosing ε for a gradient check"
  subtitle="Relative error of the central difference (f(x+ε) − f(x−ε)) / 2ε against the exact derivative of f(x) = tanh(x)·e^(x/2), in 64-bit and 32-bit floating point."
>
  {#snippet controls()}
    <div class="ctl"><Slider label="evaluation point x" min={-2} max={2} step={0.05} bind:value={x0} /></div>
  {/snippet}
  <Legend
    items={[
      { label: `float64 (JavaScript numbers) — best ε ≈ ${best(series.e64).e.toExponential(0)}`, color: 'var(--series-1)' },
      { label: `float32 (our tensors, GPUs) — best ε ≈ ${best(series.e32).e.toExponential(0)}`, color: 'var(--series-2)' },
    ]}
  />
  <Plot label="Relative error against epsilon, log-log" height={300} x={{ type: 'log', domain: [1e-12, 0.3], label: 'step size ε (log scale)' }} y={{ type: 'log', domain: [1e-12, 10], label: 'relative error (log scale)' }}>
    {#snippet marks({ sx, sy })}
      {#each [{ s: series.e64, c: 'var(--series-1)' }, { s: series.e32, c: 'var(--series-2)' }] as ser (ser.c)}
        <path class="line" stroke={ser.c} d={'M' + ser.s.map((p) => `${sx(p.e)},${sy(clip(p.err))}`).join('L')} />
      {/each}
    {/snippet}
    {#snippet tooltip({ x })}
      {@const i = EPS.reduce((bi, e, k) => (Math.abs(Math.log(e / x)) < Math.abs(Math.log(EPS[bi]! / x)) ? k : bi), 0)}
      <div class="num">ε = {EPS[i]!.toExponential(1)}</div>
      <div class="num">float64 error {series.e64[i]!.err.toExponential(1)} · float32 {series.e32[i]!.err.toExponential(1)}</div>
    {/snippet}
  </Plot>
  <p class="foot">
    Right of the minimum, error falls as ε² (truncation of the Taylor series); left of it, error grows as u/ε, where u is the rounding unit (≈10⁻¹⁶ for float64, ≈10⁻⁷ for float32). The optimum sits near u^(1/3). In float32 no choice of ε gets better than about three or four correct digits — one reason gradient checks are run in float64.
  </p>
</Widget>

<style>
  .ctl {
    flex: 0 1 14rem;
  }
  .foot {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
    line-height: 1.5;
  }
</style>
