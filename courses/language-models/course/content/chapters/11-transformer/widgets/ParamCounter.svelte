<!--
  Where a GPT's parameters, memory and compute go, as a function of its shape. Presets range from
  this chapter's browser model to GPT-3.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Bars from '$lib/charts/Bars.svelte';

  type Cfg = { L: number; C: number; V: number; T: number; r: number; bias: boolean; tied: boolean };
  const PRESETS: { label: string; cfg: Cfg }[] = [
    { label: 'This chapter', cfg: { L: 2, C: 128, V: 65, T: 128, r: 4, bias: false, tied: true } },
    { label: 'GPT-2 small', cfg: { L: 12, C: 768, V: 50257, T: 1024, r: 4, bias: true, tied: true } },
    { label: 'GPT-2 medium', cfg: { L: 24, C: 1024, V: 50257, T: 1024, r: 4, bias: true, tied: true } },
    { label: 'GPT-2 XL', cfg: { L: 48, C: 1600, V: 50257, T: 1024, r: 4, bias: true, tied: true } },
    { label: 'GPT-3', cfg: { L: 96, C: 12288, V: 50257, T: 2048, r: 4, bias: true, tied: true } },
  ];
  let cfg = $state<Cfg>({ ...PRESETS[1]!.cfg });

  const parts = $derived.by(() => {
    const { L, C, V, T, r, bias, tied } = cfg;
    const b = bias ? 1 : 0;
    return {
      'token embeddings': V * C,
      'position embeddings': T * C,
      attention: L * (4 * C * C + b * 4 * C),
      MLP: L * (2 * r * C * C + b * (r * C + C)),
      LayerNorms: L * 4 * C + 2 * C,
      'output layer': tied ? 0 : V * C,
    };
  });
  const total = $derived(Object.values(parts).reduce((a, b) => a + b, 0));
  const nonEmbedding = $derived(parts.attention + parts.MLP + parts.LayerNorms);
  // Training compute per token ≈ 6N (forward 2N, backward 4N) plus the attention scores, 6·L·T·C.
  const flopsPerToken = $derived(6 * nonEmbedding + 6 * cfg.L * cfg.T * cfg.C);
  const fmt = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} k` : String(n));
  const bytes = (n: number) => (n >= 2 ** 40 ? `${(n / 2 ** 40).toFixed(1)} TiB` : n >= 2 ** 30 ? `${(n / 2 ** 30).toFixed(1)} GiB` : `${(n / 2 ** 20).toFixed(1)} MiB`);
</script>

<Widget
  title="Where the parameters go"
  subtitle="Choose a preset or set the shape. Almost everything is in the blocks’ matrices — 12·L·C² in all — except for small models, where the embeddings dominate."
  onreset={() => (cfg = { ...PRESETS[1]!.cfg })}
>
  {#snippet controls()}
    <div class="presets">
      {#each PRESETS as p (p.label)}<button class="chip" onclick={() => (cfg = { ...p.cfg })}>{p.label}</button>{/each}
    </div>
  {/snippet}

  <div class="layout">
    <div class="sliders ui">
      <Slider label="layers L" min={1} max={96} step={1} value={cfg.L} oninput={(v) => (cfg.L = Math.round(v))} format={(v) => String(Math.round(v))} />
      <Slider label="width C" min={64} max={12288} step={64} log value={cfg.C} oninput={(v) => (cfg.C = Math.round(v / 64) * 64)} format={(v) => String(Math.round(v))} />
      <Slider label="vocabulary V" min={65} max={200000} step={1} log value={cfg.V} oninput={(v) => (cfg.V = Math.round(v))} format={(v) => Math.round(v).toLocaleString('en-GB')} />
      <Slider label="context T" min={64} max={32768} step={64} log value={cfg.T} oninput={(v) => (cfg.T = Math.round(v))} format={(v) => Math.round(v).toLocaleString('en-GB')} />
      <div class="toggles">
        <Toggle bind:checked={cfg.bias} label="Biases" />
        <Toggle bind:checked={cfg.tied} label="Tied output layer" />
      </div>
    </div>
    <div>
      <p class="total num ui"><strong>{total.toLocaleString('en-GB')}</strong> parameters <span>({fmt(total)})</span></p>
      <Bars items={Object.entries(parts).map(([label, value]) => ({ label, value }))} label="Parameters by component" format={fmt} />
      <dl class="facts num ui">
        <dt>weights, float32 / bfloat16</dt><dd>{bytes(total * 4)} / {bytes(total * 2)}</dd>
        <dt>training state (weights, gradients, Adam)</dt><dd>≈ {bytes(total * 16)} <span class="muted">before activations</span></dd>
        <dt>training compute per token</dt><dd>≈ {fmt(flopsPerToken)}FLOP</dd>
      </dl>
    </div>
  </div>
</Widget>

<style>
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
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    gap: 1.5rem;
  }
  @media (max-width: 700px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  .sliders {
    display: grid;
    gap: 0.4rem;
  }
  .toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem;
    margin-top: 0.3rem;
  }
  .total {
    font-size: 1rem;
    margin: 0 0 0.5rem;
  }
  .total span {
    color: var(--ink-2);
  }
  .facts {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 0.8rem;
    font-size: 0.8rem;
    margin: 0.8rem 0 0;
  }
  dt {
    color: var(--ink-2);
  }
  dd {
    margin: 0;
  }
  .muted {
    color: var(--ink-3);
  }
</style>
