<!--
  CourseGPT beside published frontier models: parameters, training tokens and training compute (6ND, or reported),
  on a logarithmic scale. Uses the learner's gpuDays() to say how long each would take on one GPU.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { impl } from '$lib/exercise/impl.svelte';

  const reference = (params: number, tokens: number, peak: number, mfu: number) => (6 * params * tokens) / (peak * mfu) / 86_400;
  const gpuDays = $derived(impl.get('epi.days', reference));
  const mine = $derived(impl.isMine('epi.days'));

  // Active parameters are used for compute (DeepSeek-V3 is a mixture of experts: 671 B total, 37 B active).
  const MODELS = [
    { name: 'CourseGPT (this book)', year: 2026, params: 29.6e6, active: 29.6e6, tokens: 1.05e9 },
    { name: 'GPT-2', year: 2019, params: 1.5e9, active: 1.5e9, tokens: null },
    { name: 'GPT-3', year: 2020, params: 175e9, active: 175e9, tokens: 300e9 },
    { name: 'Chinchilla', year: 2022, params: 70e9, active: 70e9, tokens: 1.4e12 },
    { name: 'Llama 2 70B', year: 2023, params: 70e9, active: 70e9, tokens: 2e12 },
    { name: 'Llama 3.1 405B', year: 2024, params: 405e9, active: 405e9, tokens: 15.6e12 },
    { name: 'DeepSeek-V3', year: 2024, params: 671e9, active: 37e9, tokens: 14.8e12 },
  ];
  let metric = $state<'params' | 'tokens' | 'compute'>('compute');
  let gpu = $state<'4060' | 'h100'>('h100');
  const PEAK = { '4060': 44e12, h100: 989e12 };
  const value = (m: (typeof MODELS)[number]) => (metric === 'params' ? m.params : metric === 'tokens' ? m.tokens : m.tokens ? 6 * m.active * m.tokens : null);
  const vals = $derived<(number | null)[]>(MODELS.map(value));
  const lo = $derived(Math.log10(Math.min(...(vals.filter((v) => v !== null) as number[]))) - 0.3);
  const hi = $derived(Math.log10(Math.max(...(vals.filter((v) => v !== null) as number[]))) + 0.2);
  const fmt = (v: number) => {
    const e = Math.floor(Math.log10(v));
    return `${(v / 10 ** e).toFixed(1)} × 10${String(e).replace(/./g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]!)}`;
  };
  const days = (m: (typeof MODELS)[number]) => {
    if (!m.tokens) return null;
    try {
      return gpuDays(m.active, m.tokens, PEAK[gpu], 0.4);
    } catch {
      return reference(m.active, m.tokens, PEAK[gpu], 0.4);
    }
  };
  const human = (d: number) => (d < 1 ? `${(d * 24).toFixed(1)} hours` : d < 365 ? `${d.toFixed(0)} days` : `${(d / 365).toLocaleString('en-GB', { maximumFractionDigits: 0 })} years`);
  const base = $derived(vals[0] ?? 1);
</script>

<Widget
  title="From CourseGPT to the frontier"
  subtitle="Published sizes of some landmark models, on a logarithmic scale. Compute is 6 × active parameters × tokens. The last column is how long one GPU would take at 40% utilisation."
  kind="Measured"
>
  {#snippet controls()}
    <Segmented label="Quantity" size="sm" options={[{ value: 'params', label: 'Parameters' }, { value: 'tokens', label: 'Training tokens' }, { value: 'compute', label: 'Training compute' }]} bind:value={metric} />
    <Segmented label="GPU" size="sm" options={[{ value: '4060', label: 'RTX 4060 Ti' }, { value: 'h100', label: 'H100' }]} bind:value={gpu} />
  {/snippet}

  {#if mine}<p class="mine ui">Using your gpuDays().</p>{/if}
  <div class="rows ui">
    {#each MODELS as m, i (m.name)}
      {@const v = vals[i] ?? null}
      {@const d = days(m)}
      <span class="lbl">{m.name} <span class="yr">{m.year}</span></span>
      <div class="track">
        {#if v !== null}<div class="bar" class:ours={i === 0} style:width="{((Math.log10(v) - lo) / (hi - lo)) * 100}%"></div>{/if}
        <span class="num v">{v !== null ? `${fmt(v)}${i > 0 ? ` · ${fmt(v / base).replace(/^1\.0 × /, '')}×` : ''}` : 'not published'}</span>
      </div>
      <span class="num d">{d !== null ? human(d) : ''}</span>
    {/each}
  </div>
  <p class="note ui">Bars are logarithmic: each step of the scale is a factor of ten. {metric === 'params' ? 'DeepSeek-V3 uses 37 B of its 671 B parameters per token.' : ''}</p>
</Widget>

<style>
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .rows {
    display: grid;
    grid-template-columns: minmax(8.5rem, max-content) minmax(0, 1fr) 5.5rem;
    gap: 0.35rem 0.7rem;
    align-items: center;
    font-size: 0.8rem;
  }
  .lbl {
    color: var(--ink-2);
  }
  .yr {
    color: var(--ink-3);
    font-size: 0.7rem;
  }
  .track {
    position: relative;
    height: 1.2rem;
    background: var(--surface-2);
    border-radius: 3px;
  }
  .bar {
    height: 100%;
    background: var(--series-1);
    opacity: 0.8;
    border-radius: 3px;
  }
  .bar.ours {
    background: var(--series-2);
  }
  .v {
    position: absolute;
    left: 0.4rem;
    top: 0;
    line-height: 1.2rem;
    font-size: 0.7rem;
    color: var(--ink);
  }
  .d {
    text-align: right;
    color: var(--ink-2);
    font-size: 0.75rem;
  }
  .note {
    font-size: 0.76rem;
    color: var(--ink-3);
    margin: 0.5rem 0 0;
  }
</style>
