<!--
  Measured: mixture-of-experts variants against the dense model at the same active compute, and how evenly
  each layer's router spreads its tokens (with and without the balancing loss).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { DATA } from '../data';

  const runs = DATA.runs;
  const dense = runs.find((r) => r.key === 'gpt2');
  const lo = Math.min(...runs.map((r) => r.val_bits)) - 0.03;
  const hi = Math.max(...runs.map((r) => r.val_bits)) + 0.02;
  const m = (n: number) => `${(n / 1e6).toFixed(1)} M`;
  const loadKeys = Object.keys(DATA.loads ?? {});
  let which = $state(loadKeys.includes('e8k2-noaux') ? 'e8k2-noaux' : (loadKeys[0] ?? ''));
  const loads = $derived(DATA.loads?.[which] ?? []);
  const E = $derived(loads[0]?.length ?? 0);
  const shade = (f: number) => Math.min(1, f * E / 3); // 1/E (uniform) → a third of full colour
</script>

<Widget
  title="Experts at equal compute"
  subtitle={`Each model spends the same FLOPs per token and trains for the same ${DATA.steps?.toLocaleString('en-GB') ?? ''} steps as the dense 6 × 384 model of Chapter 18. The mixtures have several times its parameters, but each token uses only its router’s top k experts.`}
  kind="Measured"
>
  {#if !runs.length}
    <p class="muted">Run <code>uv run lmc ch19 train</code>, <code>routing</code> and <code>summary</code>.</p>
  {:else}
    <div class="bars">
      <span class="h ui"></span><span class="h ui">validation bits / token (shorter is better)</span><span class="h ui">vs dense</span><span class="h ui">parameters: total / active</span>
      {#each runs as r, i (r.key)}
        <div class="lbl">{r.label}</div>
        <div class="track"><div class="bar" style:width="{((r.val_bits - lo) / (hi - lo)) * 100}%" style:background="var(--series-{i + 1})"></div><span class="num">{r.val_bits.toFixed(3)}</span></div>
        <div class="num d" class:good={dense && r.val_bits < dense.val_bits - 0.01}>{dense && r !== dense ? `${r.val_bits - dense.val_bits >= 0 ? '+' : ''}${(r.val_bits - dense.val_bits).toFixed(3)}` : ''}</div>
        <div class="num p">{m(r.total_params)} / {m(r.active_params)}</div>
      {/each}
    </div>
    {#if loadKeys.length}
      <div class="heat-head">
        <span class="ui">Share of routing slots per expert (rows: layers 1–6), at the end of training:</span>
        <Segmented label="Model" size="sm" options={loadKeys.map((k) => ({ value: k, label: runs.find((r) => r.key === k)?.label ?? k }))} bind:value={which} />
      </div>
      <div class="heat" style:grid-template-columns="3rem repeat({E}, minmax(0, 1fr))">
        {#each loads as layer, l (l)}
          <span class="ui ll">layer {l + 1}</span>
          {#each layer as f, e (e)}<span class="cell num" style:background="color-mix(in srgb, var(--series-1) {Math.round(shade(f) * 100)}%, var(--surface))" title="expert {e}: {(f * 100).toFixed(1)}%">{E <= 8 ? `${(f * 100).toFixed(0)}` : ''}</span>{/each}
        {/each}
      </div>
      <p class="note ui">Uniform routing would give every expert {E ? (100 / E).toFixed(1) : '…'}% of the slots.</p>
    {/if}
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .bars {
    display: grid;
    grid-template-columns: minmax(10rem, max-content) minmax(0, 1fr) 4.5rem 8.5rem;
    gap: 0.3rem 0.7rem;
    align-items: center;
    font-size: 0.8rem;
  }
  .h {
    font-size: 0.7rem;
    color: var(--ink-3);
  }
  .lbl {
    color: var(--ink-2);
  }
  .track {
    position: relative;
    height: 1.1rem;
    background: var(--surface-2);
    border-radius: 3px;
  }
  .track span {
    position: absolute;
    right: 0.3rem;
    top: 0;
    line-height: 1.1rem;
    font-size: 0.72rem;
  }
  .bar {
    height: 100%;
    border-radius: 3px;
    opacity: 0.85;
  }
  .d,
  .p {
    text-align: right;
    color: var(--ink-2);
  }
  .d.good {
    color: var(--good);
    font-weight: 600;
  }
  .heat-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    margin: 1rem 0 0.4rem;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .heat {
    display: grid;
    gap: 2px;
  }
  .ll {
    font-size: 0.68rem;
    color: var(--ink-3);
  }
  .cell {
    height: 1.3rem;
    border-radius: 2px;
    font-size: 0.66rem;
    text-align: center;
    line-height: 1.3rem;
  }
  .note {
    font-size: 0.75rem;
    color: var(--ink-3);
    margin: 0.4rem 0 0;
  }
</style>
