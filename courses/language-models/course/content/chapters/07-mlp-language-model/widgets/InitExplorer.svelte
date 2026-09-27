<!--
  Why initialisation matters: push a batch of random inputs through an 8-layer network (width 256)
  and back-propagate a random gradient. Watch activations and gradients vanish or explode with depth
  unless the weights are scaled by gain/√fan_in.
-->
<script lang="ts">
  import { Tensor, nn, noGrad } from '@lm/core/tensor';
  import { mulberry32 } from '@lm/core';
  import { params } from '$lib/state/params.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Histogram from '$lib/charts/Histogram.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';

  const L = 8, W = 256, B = 256;
  const gain = $derived(params.get('init.gain', 5 / 3));
  let act: 'tanh' | 'relu' | 'none' = $state('tanh');
  let norm = $state(false);

  type Layer = { act: Float32Array; std: number; gradStd: number; saturated: number };
  let layers = $state.raw<Layer[]>([]);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function run() {
    const rng = mulberry32(3);
    const std = (xs: Float32Array) => {
      let s = 0;
      for (const x of xs) s += x * x;
      return Math.sqrt(s / xs.length);
    };
    // Forward: random inputs through L layers, keeping every activation's gradient.
    let y = Tensor.randn([B, W], { rng, requiresGrad: true });
    const ys: Tensor[] = [];
    for (let l = 0; l < L; l++) {
      const w = Tensor.randn([W, W], { rng, std: gain / Math.sqrt(W) });
      let pre = y.matmul(w);
      if (norm) pre = nn.layerNorm(pre, Tensor.ones([W]), Tensor.zeros([W]));
      y = act === 'tanh' ? pre.tanh() : act === 'relu' ? pre.relu() : pre;
      ys.push(y.retainGrad());
    }
    // Backward: a random upstream gradient at the top, as a loss would provide.
    y.mul(Tensor.randn([B, W], { rng: mulberry32(9) })).sum().backward();
    layers = ys.map((t) => {
      const a = noGrad(() => t.toFloat32Array());
      let sat = 0;
      for (const v of a) if (act === 'tanh' ? Math.abs(v) > 0.97 : act === 'relu' ? v === 0 : false) sat++;
      return { act: a, std: std(a), gradStd: std(t.grad!.toFloat32Array()), saturated: sat / a.length };
    });
  }

  $effect(() => {
    void [gain, act, norm];
    clearTimeout(timer);
    timer = setTimeout(run, 60);
    return () => clearTimeout(timer);
  });

  const PRESETS = [
    { label: 'Too small (0.5)', g: 0.5 },
    { label: 'Xavier (1)', g: 1 },
    { label: 'Kaiming, tanh (5/3)', g: 5 / 3 },
    { label: 'Kaiming, ReLU (√2)', g: Math.SQRT2 },
    { label: 'Too large (3)', g: 3 },
  ];
  const clampLog = (v: number) => Math.min(1e3, Math.max(1e-6, v || 1e-6));
</script>

<Widget
  title="Initialisation decides whether a deep network can learn"
  subtitle="Eight layers of 256 units, random inputs, weights ~ N(0, (gain/√256)²). No training — just one forward and one backward pass."
  onreset={() => {
    params.set('init.gain', 5 / 3);
    act = 'tanh';
    norm = false;
  }}
>
  {#snippet controls()}
    <div class="ctl"><Slider label="gain" min={0.25} max={4} step={0.01} log value={gain} oninput={(v) => params.set('init.gain', v)} /></div>
    <Segmented label="Non-linearity" size="sm" options={[{ value: 'tanh', label: 'tanh' }, { value: 'relu', label: 'ReLU' }, { value: 'none', label: 'none (linear)' }]} bind:value={act} />
    <Toggle bind:checked={norm} label="LayerNorm" />
    <div class="presets">
      {#each PRESETS as p (p.label)}<button class="chip" onclick={() => params.set('init.gain', p.g)}>{p.label}</button>{/each}
    </div>
  {/snippet}

  <div class="grid">
    {#each layers as l, i (i)}
      <div class="cell">
        <div class="lt">layer {i + 1}<span class="num">std {l.std.toFixed(2)}{act !== 'none' ? ` · ${(l.saturated * 100).toFixed(0)}% ${act === 'tanh' ? 'sat.' : 'dead'}` : ''}</span></div>
        <Histogram values={l.act} range={act === 'tanh' ? [-1, 1] : undefined} height={48} bins={30} mark={act === 'tanh' ? 0.97 : undefined} label="Activations of layer {i + 1}" />
      </div>
    {/each}
  </div>

  <Legend items={[{ label: 'Activation std (forward)', color: 'var(--series-1)' }, { label: 'Gradient std (backward)', color: 'var(--series-2)' }]} />
  <Plot label="Activation and gradient scale by layer" height={200} x={{ domain: [1, L], label: 'layer', ticks: 8, format: (v) => String(v) }} y={{ type: 'log', domain: [1e-6, 1e3], label: 'standard deviation (log)' }}>
    {#snippet marks({ sx, sy })}
      {#if layers.length}
        <path class="line" stroke="var(--series-1)" d={'M' + layers.map((l, i) => `${sx(i + 1)},${sy(clampLog(l.std))}`).join('L')} />
        <path class="line" stroke="var(--series-2)" d={'M' + layers.map((l, i) => `${sx(i + 1)},${sy(clampLog(l.gradStd))}`).join('L')} />
        {#each layers as l, i (i)}
          <circle class="dot" cx={sx(i + 1)} cy={sy(clampLog(l.std))} r="4" fill="var(--series-1)" />
          <circle class="dot" cx={sx(i + 1)} cy={sy(clampLog(l.gradStd))} r="4" fill="var(--series-2)" />
        {/each}
      {/if}
    {/snippet}
  </Plot>
</Widget>

<style>
  .ctl {
    flex: 0 1 11rem;
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .chip {
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 99px;
    padding: 0.2rem 0.6rem;
    font-size: 0.74rem;
    cursor: pointer;
    color: var(--ink-2);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.6rem 1rem;
    margin-bottom: 1rem;
  }
  @media (max-width: 700px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  .lt {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    font-weight: 600;
    margin-bottom: 0.15rem;
  }
  .lt span {
    font-weight: 400;
    color: var(--ink-2);
  }
</style>
