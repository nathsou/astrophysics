<!--
  Why generation is limited by memory bandwidth: each decoding step reads every weight once, whatever
  the batch size, while the arithmetic grows with the batch. A simple roofline model of tokens per second.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';

  const MODELS = {
    course32: { label: 'CourseGPT, float32', params: 29.6e6, bytes: 4 },
    course8: { label: 'CourseGPT, int8', params: 29.6e6, bytes: 1 },
    llama16: { label: '8 B model, bf16', params: 8e9, bytes: 2 },
    llama4: { label: '8 B model, int4', params: 8e9, bytes: 0.5 },
  } as const;
  const HARDWARE = {
    m4: { label: 'M4 Pro', bandwidth: 273e9, flops: 9e12, memory: 24e9, note: '273 GB/s; about 9 TFLOP/s (estimated); 24 GB shared memory' },
    rtx: { label: 'RTX 4060 Ti', bandwidth: 288e9, flops: 44e12, memory: 16e9, note: '288 GB/s; 44 TFLOP/s bf16; 16 GB' },
    h100: { label: 'H100', bandwidth: 3.35e12, flops: 989e12, memory: 80e9, note: '3.35 TB/s; 989 TFLOP/s bf16; 80 GB' },
  } as const;
  type ModelKey = keyof typeof MODELS;
  type HwKey = keyof typeof HARDWARE;

  let model = $state<ModelKey>('llama16');
  let hw = $state<HwKey>('rtx');
  let batch = $state(1);

  const M = $derived(MODELS[model]);
  const H = $derived(HARDWARE[hw]);
  // One decoding step for a batch of B sequences: read all weights once (bytes), do 2 FLOPs per
  // parameter per sequence. The step takes as long as the slower of the two.
  const stepTime = (B: number) => Math.max((M.params * M.bytes) / H.bandwidth, (2 * M.params * B) / H.flops);
  const perSeq = $derived(1 / stepTime(batch));
  const total = $derived(batch / stepTime(batch));
  const knee = $derived((H.flops * M.bytes) / (2 * H.bandwidth));
  const batches = Array.from({ length: 81 }, (_, i) => 2 ** (i / 8));
  const ys = $derived(batches.map((B) => B / stepTime(B)));
  const yMax = $derived(Math.max(...ys) * 2);
  const yMin = $derived(Math.min(...ys) / 2);
  const bytes = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${(b / 1e6).toFixed(0)} MB`);
  const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} k` : n.toFixed(n < 10 ? 1 : 0));
</script>

<Widget
  title="Decoding is limited by memory, not arithmetic"
  subtitle="A roofline model: each step reads every weight once and does 2 FLOPs per weight per sequence in the batch. Whichever takes longer sets the pace."
  onreset={() => {
    model = 'llama16';
    hw = 'rtx';
    batch = 1;
  }}
>
  {#snippet controls()}
    <Segmented label="Model" size="sm" options={Object.entries(MODELS).map(([value, m]) => ({ value: value as ModelKey, label: m.label }))} bind:value={model} />
    <Segmented label="Hardware" size="sm" options={Object.entries(HARDWARE).map(([value, h]) => ({ value: value as HwKey, label: h.label }))} bind:value={hw} />
    <div class="sl"><Slider label="Batch size" min={1} max={1024} log value={batch} oninput={(v) => (batch = Math.max(1, Math.round(v)))} format={(v) => String(Math.max(1, Math.round(v)))} /></div>
  {/snippet}

  <div class="two">
    <Plot label="Total tokens per second against batch size" height={240} x={{ type: 'log', domain: [1, 1024], label: 'batch size', tickValues: [1, 4, 16, 64, 256, 1024] }} y={{ type: 'log', domain: [yMin, yMax], label: 'tokens / s (whole batch)' }}>
      {#snippet marks({ sx, sy })}
        <path class="line" stroke="var(--series-1)" d={'M' + batches.map((B, i) => `${sx(B)},${sy(ys[i]!)}`).join('L')} />
        {#if knee >= 1 && knee <= 1024}<line x1={sx(knee)} x2={sx(knee)} y1={0} y2={sy(yMin)} stroke="var(--ink-3)" stroke-dasharray="4 4" />{/if}
        <circle cx={sx(batch)} cy={sy(total)} r="5" fill="var(--series-1)" />
      {/snippet}
    </Plot>
    <div class="out">
      <div><span class="k">Weights read per step</span><span class="v num">{bytes(M.params * M.bytes)}</span></div>
      <div><span class="k">Tokens / s, each sequence</span><span class="v num">{fmt(perSeq)}</span></div>
      <div><span class="k">Tokens / s, whole batch</span><span class="v num">{fmt(total)}</span></div>
      <div><span class="k">Bound by</span><span class="v">{batch < knee ? 'memory bandwidth' : 'arithmetic'}</span></div>
      {#if M.params * M.bytes > 0.9 * H.memory}<p class="warn ui">These weights do not fit in the {H.label}’s memory: in practice the model would not run at all.</p>{/if}
      <p class="note ui">{H.label}: {H.note}. Below a batch of about <strong class="num">{Math.round(knee)}</strong> the GPU waits for memory, so extra sequences are nearly free; above it, it runs out of arithmetic. Fewer bytes per weight (quantisation) raise the ceiling at small batches.</p>
    </div>
  </div>
</Widget>

<style>
  .sl {
    flex: 1 1 12rem;
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    gap: 1.2rem;
  }
  @media (max-width: 720px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  .out > div {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid var(--rule);
    padding: 0.3rem 0;
    font-size: 0.82rem;
  }
  .k {
    color: var(--ink-2);
  }
  .v {
    font-weight: 600;
  }
  .warn {
    font-size: 0.78rem;
    color: var(--critical);
    margin: 0.3rem 0 0;
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
