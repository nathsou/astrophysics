<!-- Activation functions and their derivatives, side by side. -->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';

  const erf = (x: number) => {
    // Abramowitz & Stegun 7.1.26, accurate to about 1e-7.
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return Math.sign(x) * y;
  };
  const Phi = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));
  const phi = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  const sig = (x: number) => 1 / (1 + Math.exp(-x));

  const ACTS: Record<string, { label: string; f: (x: number) => number; d: (x: number) => number; note: string }> = {
    sigmoid: { label: 'sigmoid', f: sig, d: (x) => sig(x) * (1 - sig(x)), note: 'The classic squashing function. Its slope is at most 0.25 and vanishes on both sides, so gradients shrink at every layer — the vanishing-gradient problem that stalled deep networks for two decades.' },
    tanh: { label: 'tanh', f: Math.tanh, d: (x) => 1 - Math.tanh(x) ** 2, note: 'A rescaled sigmoid, centred on zero, with slope 1 at the origin. Used in the MLP of Chapter 7 and in RNNs, but still saturates for |x| > 2.' },
    relu: { label: 'ReLU', f: (x) => Math.max(0, x), d: (x) => (x > 0 ? 1 : 0), note: 'max(0, x): slope exactly 1 wherever it is active, so gradients pass through undiminished (Nair and Hinton, 2010). Units that are never active get no gradient and can “die”.' },
    leaky: { label: 'leaky ReLU', f: (x) => (x > 0 ? x : 0.1 * x), d: (x) => (x > 0 ? 1 : 0.1), note: 'A small slope for negative inputs keeps every unit trainable.' },
    gelu: { label: 'GELU', f: (x) => x * Phi(x), d: (x) => Phi(x) + x * phi(x), note: 'x·Φ(x): a smooth ReLU that lets small negative values through (Hendrycks and Gimpel, 2016). GPT-2 uses it, and so do the Transformers of Chapter 11.' },
    silu: { label: 'SiLU / Swish', f: (x) => x * sig(x), d: (x) => sig(x) * (1 + x * (1 - sig(x))), note: 'x·σ(x), very close to GELU. Llama-style models use it inside the gated SwiGLU block (Chapter 18).' },
  };
  let key = $state<keyof typeof ACTS>('gelu');
  const a = $derived(ACTS[key]!);
  const xs = Array.from({ length: 241 }, (_, i) => -5 + (10 * i) / 240);
</script>

<Widget title="Activation functions" subtitle="The non-linearity between layers, and its derivative — which multiplies every gradient flowing back through it." onreset={() => (key = 'gelu')}>
  {#snippet controls()}
    <Segmented label="Activation" size="sm" options={Object.entries(ACTS).map(([k, v]) => ({ value: k, label: v.label }))} bind:value={key} />
  {/snippet}
  <Legend items={[{ label: `${a.label}(x)`, color: 'var(--series-1)' }, { label: 'derivative', color: 'var(--series-2)' }]} />
  <Plot label="{a.label} and its derivative" height={230} x={{ domain: [-5, 5], ticks: 10 }} y={{ domain: [-1.5, 3], ticks: 5 }}>
    {#snippet marks({ sx, sy })}
      <line x1={sx(-5)} x2={sx(5)} y1={sy(0)} y2={sy(0)} stroke="var(--axis)" />
      <path class="line" stroke="var(--series-1)" d={'M' + xs.map((x) => `${sx(x)},${sy(Math.min(3.2, a.f(x)))}`).join('L')} />
      <path class="line" stroke="var(--series-2)" d={'M' + xs.map((x) => `${sx(x)},${sy(a.d(x))}`).join('L')} />
    {/snippet}
    {#snippet tooltip({ x })}
      <div class="num">x = {x.toFixed(2)}: f = {a.f(x).toFixed(3)}, f′ = {a.d(x).toFixed(3)}</div>
    {/snippet}
  </Plot>
  <p class="note ui">{a.note}</p>
</Widget>

<style>
  .note {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
