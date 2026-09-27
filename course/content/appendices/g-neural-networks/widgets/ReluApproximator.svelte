<!--
  Universal approximation, constructively: a sum of n shifted ReLUs is a piecewise-linear function
  with n kinks, so it can follow any continuous curve as closely as we like by adding units.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';

  const TARGETS: Record<string, { label: string; f: (x: number) => number; y: [number, number] }> = {
    sin: { label: 'sin 2x', f: (x) => Math.sin(2 * x), y: [-1.6, 1.6] },
    bump: { label: 'bump', f: (x) => Math.exp(-3 * x * x) - 0.3 * x, y: [-1.2, 1.6] },
    step: { label: 'step', f: (x) => (x > 0.3 ? 1 : 0), y: [-0.5, 1.5] },
    wiggle: { label: 'wiggly', f: (x) => 0.6 * Math.sin(5 * x) + 0.3 * Math.cos(11 * x), y: [-1.4, 1.4] },
  };
  let key = $state<keyof typeof TARGETS>('sin');
  let n = $state(6);
  let showUnits = $state(true);
  const t = $derived(TARGETS[key]!);
  const X0 = -3, X1 = 3;

  // Interpolate the target at n + 1 evenly spaced knots. Between knots the network is linear; at knot
  // k_i a unit ReLU(x − k_i) with weight (s_i − s_{i−1}) changes the slope.
  const net = $derived.by(() => {
    const knots = Array.from({ length: n + 1 }, (_, i) => X0 + ((X1 - X0) * i) / n);
    const vals = knots.map(t.f);
    const slopes = knots.slice(0, -1).map((k, i) => (vals[i + 1]! - vals[i]!) / (knots[i + 1]! - k));
    const units = slopes.map((s, i) => ({ at: knots[i]!, w: i === 0 ? s : s - slopes[i - 1]! }));
    const f = (x: number) => vals[0]! + units.reduce((a, u) => a + u.w * Math.max(0, x - u.at), 0);
    return { knots, units, f, bias: vals[0]! };
  });
  const xs = Array.from({ length: 401 }, (_, i) => X0 + ((X1 - X0) * i) / 400);
  const maxErr = $derived(Math.max(...xs.map((x) => Math.abs(net.f(x) - t.f(x)))));
  const path = (f: (x: number) => number, sx: (v: number) => number, sy: (v: number) => number) => 'M' + xs.map((x) => `${sx(x)},${sy(Math.max(t.y[0] - 5, Math.min(t.y[1] + 5, f(x))))}`).join('L');
</script>

<Widget
  title="Enough ReLUs can draw any curve"
  subtitle="Each hidden unit ReLU(x − k) is a hinge at k. A weighted sum of n hinges is a curve made of n straight pieces, which can follow any continuous function as closely as you like."
  onreset={() => {
    key = 'sin';
    n = 6;
    showUnits = true;
  }}
>
  {#snippet controls()}
    <Segmented label="Target function" size="sm" options={Object.entries(TARGETS).map(([k, v]) => ({ value: k, label: v.label }))} bind:value={key} />
    <div class="ctl"><Slider label="hidden units n" min={1} max={60} step={1} value={n} oninput={(v) => (n = Math.round(v))} format={(v) => String(Math.round(v))} /></div>
    <Toggle bind:checked={showUnits} label="Show individual units" />
  {/snippet}

  <Legend
    items={[
      { label: `target: ${t.label}`, color: 'var(--series-1)' },
      { label: `network with ${n} ReLU units`, color: 'var(--series-2)' },
      ...(showUnits ? [{ label: 'each unit’s contribution', color: 'var(--ink-3)' }] : []),
    ]}
  />
  <Plot label="Target function and its ReLU-network approximation" height={260} x={{ domain: [X0, X1], ticks: 7 }} y={{ domain: t.y, ticks: 5 }}>
    {#snippet marks({ sx, sy })}
      {#if showUnits && n <= 30}
        {#each net.units as u, i (i)}
          <path class="unit" d={path((x) => u.w * Math.max(0, x - u.at), sx, sy)} />
        {/each}
      {/if}
      <path class="line" stroke="var(--series-1)" d={path(t.f, sx, sy)} />
      <path class="line" stroke="var(--series-2)" d={path(net.f, sx, sy)} />
      {#each net.knots.slice(0, -1) as k (k)}
        <circle cx={sx(k)} cy={sy(net.f(k))} r="3" fill="var(--series-2)" />
      {/each}
    {/snippet}
  </Plot>
  <p class="note ui num">
    Largest error on [−3, 3]: <strong>{maxErr.toFixed(3)}</strong>. Network: f(x) = {net.bias.toFixed(2)} + Σᵢ wᵢ · ReLU(x − kᵢ), with {n} units: {3 * n + 1} parameters in a general network (an input weight, bias and output weight per unit, plus an output bias).
    {#if key === 'step'}The step is discontinuous, so the error at the jump never goes to zero — but the region where it is large shrinks as units are added.{/if}
  </p>
</Widget>

<style>
  .ctl {
    flex: 0 1 14rem;
  }
  .unit {
    fill: none;
    stroke: var(--ink-3);
    stroke-width: 1;
    opacity: 0.6;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
