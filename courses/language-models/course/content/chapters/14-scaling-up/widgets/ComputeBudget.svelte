<!--
  What a training run costs: parameters, FLOPs, time on different hardware, and memory
  (weights, gradients, AdamW's moments, activations), for a GPT of a given shape.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';

  interface Shape {
    layers: number;
    width: number;
    context: number;
    vocab: number;
    tokens: number;
    batch: number;
  }
  const PRESETS: Record<string, { label: string; shape: Shape }> = {
    chargpt: { label: 'char-GPT (Ch. 12)', shape: { layers: 4, width: 192, context: 256, vocab: 65, tokens: 3000 * 32 * 256, batch: 32 } },
    coursegpt: { label: 'CourseGPT', shape: { layers: 8, width: 512, context: 512, vocab: 8192, tokens: 8000 * 256 * 512, batch: 32 } },
    gpt2: { label: 'GPT-2 small', shape: { layers: 12, width: 768, context: 1024, vocab: 50257, tokens: 10e9, batch: 16 } },
  };
  // Achieved training throughput (FLOP/s). "measured" figures come from this course's runs.
  const HARDWARE = [
    { value: 'browser', label: 'M4 Pro, browser', flops: 0.63e12, note: 'measured: our WebGPU engine training char-GPT (Chapter 12)', memory: 24 },
    { value: 'mps', label: 'M4 Pro, PyTorch', flops: 2.7e12, note: 'estimated from short PyTorch runs on the M4 Pro’s GPU (MPS backend)', memory: 24 },
    { value: '4060', label: 'RTX 4060 Ti', flops: 26e12, note: 'measured: CourseGPT in PyTorch with bf16 and torch.compile, ≈ 60% of the 44 TFLOP/s peak', memory: 16 },
    { value: 'h100', label: 'H100', flops: 400e12, note: 'assumed: 40% of the 989 TFLOP/s bf16 peak, typical of well-tuned large runs', memory: 80 },
  ] as const;

  let preset = $state('coursegpt');
  let s = $state<Shape>({ ...PRESETS.coursegpt!.shape });
  let hw = $state<(typeof HARDWARE)[number]['value']>('4060');
  let flash = $state(true);

  const hardware = $derived(HARDWARE.find((h) => h.value === hw)!);
  const heads = $derived(Math.max(1, Math.round(s.width / 64)));
  // Per block: q, k, v, o (4C²) and the MLP (8C²). Embeddings: tokens (V×C, tied with the output) and positions.
  const blockParams = $derived(12 * s.layers * s.width * s.width);
  const tokParams = $derived(s.vocab * s.width);
  const params = $derived(blockParams + tokParams + s.context * s.width + (4 * s.layers + 2) * s.width);
  // 6 FLOPs per parameter used in a matmul (the tied output layer is one), plus causal attention.
  const flopsPerToken = $derived(6 * (blockParams + tokParams) + 6 * s.layers * s.context * s.width);
  const total = $derived(flopsPerToken * s.tokens);
  const seconds = $derived(total / hardware.flops);
  // Memory, mixed precision: float32 weights, gradients and AdamW's two moments = 16 bytes per parameter.
  const stateBytes = $derived(16 * params);
  // Activations kept for the backward pass (Korthikanti et al., 2022): ≈ 34·B·T·C bytes per block in
  // 16-bit, plus 5·heads·B·T² for the attention matrices unless FlashAttention recomputes them,
  // plus the logits and their gradient (≈ 8 bytes per entry of B·T·V).
  const actBytes = $derived(
    s.layers * (34 * s.batch * s.context * s.width + (flash ? 0 : 5 * heads * s.batch * s.context * s.context)) + 8 * s.batch * s.context * s.vocab,
  );
  const chinchilla = $derived(20 * params);

  const fmt = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  function si(n: number): string {
    const u = [[1e15, 'P'], [1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k']] as const;
    for (const [v, p] of u) if (n >= v) return `${(n / v).toPrecision(3)} ${p}`;
    return n.toPrecision(3);
  }
  function sci(n: number): string {
    const e = Math.floor(Math.log10(n));
    return `${(n / 10 ** e).toFixed(1)} × 10${String(e).replace(/\d|-/g, (d) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(d)]!)}`;
  }
  function duration(sec: number): string {
    if (sec < 90) return `${sec.toFixed(0)} s`;
    if (sec < 5400) return `${(sec / 60).toFixed(0)} min`;
    if (sec < 2 * 86400) return `${(sec / 3600).toFixed(1)} h`;
    if (sec < 2 * 365 * 86400) return `${(sec / 86400).toFixed(1)} days`;
    return `${(sec / 365 / 86400).toFixed(1)} years`;
  }
  const gib = (b: number) => `${(b / 2 ** 30).toFixed(b < 2 ** 30 ? 2 : 1)} GiB`;
  const fits = $derived(stateBytes + actBytes < hardware.memory * 2 ** 30 * 0.9);

  function choose(p: string) {
    preset = p;
    s = { ...PRESETS[p]!.shape };
  }
  const set = (k: keyof Shape) => (v: number) => {
    s[k] = Math.round(v);
    preset = '';
  };
</script>

<Widget
  title="What a training run costs"
  subtitle="Pick a model shape and a token budget. Compute is ≈ 6 FLOPs per parameter per token; memory is the optimiser state plus the activations kept for the backward pass."
  onreset={() => choose('coursegpt')}
>
  {#snippet controls()}
    <Segmented label="Model" size="sm" options={Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label }))} value={preset} onchange={choose} />
    <Segmented label="Hardware" size="sm" options={HARDWARE.map((h) => ({ value: h.value, label: h.label }))} bind:value={hw} />
  {/snippet}

  <div class="grid">
    <div class="sliders">
      <Slider label="Layers" min={1} max={48} step={1} value={s.layers} oninput={set('layers')} format={(v) => String(Math.round(v))} />
      <Slider label="Width C" min={64} max={2048} step={64} value={s.width} oninput={set('width')} format={(v) => String(Math.round(v))} />
      <Slider label="Context T" min={64} max={4096} step={64} value={s.context} oninput={set('context')} format={(v) => String(Math.round(v))} />
      <Slider label="Vocabulary V" min={64} max={131072} log value={s.vocab} oninput={set('vocab')} format={(v) => fmt(Math.round(v))} />
      <Slider label="Training tokens" min={1e6} max={1e12} log value={s.tokens} oninput={set('tokens')} format={(v) => si(v)} />
      <Slider label="Micro-batch B" min={1} max={128} step={1} value={s.batch} oninput={set('batch')} format={(v) => String(Math.round(v))} />
      <Toggle bind:checked={flash} label="FlashAttention (no T × T matrices stored)" />
    </div>
    <div class="out">
      <div class="big">
        <div><span class="k">Parameters</span><span class="v num">{si(params)}</span><span class="d">{((tokParams / params) * 100).toFixed(0)}% in the token embedding</span></div>
        <div><span class="k">Compute</span><span class="v num">{sci(total)} FLOPs</span><span class="d">{si(flopsPerToken)}FLOPs per token</span></div>
        <div><span class="k">Time on {hardware.label}</span><span class="v num">{duration(seconds)}</span><span class="d">at {si(hardware.flops)}FLOP/s — {hardware.note}</span></div>
      </div>
      <table class="mem num">
        <tbody>
          <tr><td>Weights, float32</td><td>{gib(4 * params)}</td></tr>
          <tr><td>Gradients, float32</td><td>{gib(4 * params)}</td></tr>
          <tr><td>AdamW moments m, v</td><td>{gib(8 * params)}</td></tr>
          <tr><td>Activations (B = {s.batch}, bf16)</td><td>{gib(actBytes)}</td></tr>
          <tr class="tot" class:bad={!fits}><td>Total (of {hardware.memory} GB)</td><td>{gib(stateBytes + actBytes)}{fits ? '' : ' — does not fit'}</td></tr>
        </tbody>
      </table>
      <p class="note">
        {#if s.tokens < chinchilla / 3}
          The token budget is well below the ≈ 20 tokens per parameter ({si(chinchilla)}) that Chapter 17’s scaling laws suggest: this model would benefit from more data.
        {:else if s.tokens > chinchilla * 3}
          The token budget is well above ≈ 20 tokens per parameter ({si(chinchilla)}): a larger model would use this compute better, though a small model is cheaper to run afterwards.
        {:else}
          About 20 tokens per parameter ({si(chinchilla)}): the compute-optimal balance of Chapter 17’s scaling laws.
        {/if}
      </p>
    </div>
  </div>
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 1.5rem;
  }
  @media (max-width: 720px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .sliders {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .big {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    margin-bottom: 0.8rem;
  }
  .big > div {
    display: grid;
    grid-template-columns: 9.5rem 1fr;
    column-gap: 0.8rem;
    align-items: baseline;
  }
  .k {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .v {
    font-size: 1.15rem;
    font-weight: 600;
  }
  .d {
    grid-column: 2;
    font-size: 0.74rem;
    color: var(--ink-3);
  }
  .mem {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  .mem td {
    border-top: 1px solid var(--rule);
    padding: 0.2rem 0.3rem;
  }
  .mem td:last-child {
    text-align: right;
  }
  .mem .tot td {
    font-weight: 600;
    border-top: 1px solid var(--rule-strong);
  }
  .mem .tot.bad td {
    color: var(--critical);
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
    margin: 0.7rem 0 0;
  }
</style>
