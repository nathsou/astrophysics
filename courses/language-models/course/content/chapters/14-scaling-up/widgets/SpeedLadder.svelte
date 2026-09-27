<!--
  Measured on the RTX 4060 Ti: CourseGPT's training throughput as each optimisation of the chapter
  is switched on — lower precision, FlashAttention, then torch.compile.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { DATA } from '../data';

  const S = DATA.speed;
  let what = $state<'tokens_per_s' | 'mfu' | 'memory_gib'>('tokens_per_s');
  const results = S?.results ?? [];
  const max = $derived(Math.max(...results.map((r) => r[what])));
  const fmt = $derived(
    what === 'tokens_per_s' ? (v: number) => `${Math.round(v).toLocaleString('en-GB')} tok/s` : what === 'mfu' ? (v: number) => `${(v * 100).toFixed(0)}%` : (v: number) => `${v.toFixed(1)} GiB`,
  );
  const base = results[0]?.tokens_per_s ?? 1;
</script>

<Widget
  title="Where the speed comes from"
  subtitle={S ? `Measured on an ${S.gpu.replace('NVIDIA GeForce ', '')}: one CourseGPT training step (micro-batch ${S.batch} × ${S.context} tokens) with AdamW, each row adding one optimisation.` : 'Measured on an RTX 4060 Ti.'}
  kind="Measured"
>
  {#snippet controls()}
    <Segmented label="Quantity" size="sm" options={[{ value: 'tokens_per_s', label: 'Throughput' }, { value: 'mfu', label: 'MFU' }, { value: 'memory_gib', label: 'Peak memory' }]} bind:value={what} />
  {/snippet}
  {#if !S}
    <p class="muted">Run <code>uv run lmc ch14 speed</code> and <code>uv run lmc ch14 summary</code>.</p>
  {:else}
    <div class="bars">
      {#each results as r, i (r.label)}
        <div class="lbl">{r.label}</div>
        <div class="track"><div class="bar" style:width="{(r[what] / max) * 100}%" style:background="var(--series-{i + 1})"></div></div>
        <div class="val num">{fmt(r[what])}{#if what === 'tokens_per_s' && i > 0}<span class="x">&nbsp;×{(r.tokens_per_s / base).toFixed(1)}</span>{/if}</div>
      {/each}
    </div>
    <p class="note ui">MFU is measured against the card’s 44 TFLOP/s bfloat16 peak, so the float32 rows are unfairly low by that yardstick: float32 has no tensor-core path at all, and TF32 runs at half the bf16 rate.</p>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.85rem;
  }
  .bars {
    display: grid;
    grid-template-columns: minmax(8rem, max-content) minmax(0, 1fr) minmax(7rem, max-content);
    gap: 0.35rem 0.8rem;
    align-items: center;
    font-size: 0.8rem;
  }
  .lbl {
    color: var(--ink-2);
  }
  .track {
    height: 1.1rem;
    background: var(--surface-2);
    border-radius: 3px;
  }
  .bar {
    height: 100%;
    border-radius: 3px;
    transition: width 300ms;
  }
  .val {
    text-align: right;
  }
  .x {
    color: var(--ink-3);
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.7rem 0 0;
  }
</style>
