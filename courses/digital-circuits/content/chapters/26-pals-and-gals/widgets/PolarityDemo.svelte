<!--
  Output polarity: the same function fitted into the macrocell you choose, active high or active low, by the
  course's own GAL22V10 fitter. A row of slots shows the product terms of the macrocell and how many the
  function needs.

    ::polarity-demo{n="26.3" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { PINS, PRESETS, capacity, fitOutput, type PolarityChoice } from './polarity';

  let { n, caption, preset: start = 'ok', pin: startPin = 23 }: { n?: string | number; caption?: string; preset?: string; pin?: number } = $props();

  // svelte-ignore state_referenced_locally
  let id = $state(start);
  // svelte-ignore state_referenced_locally
  let pin = $state<number>(startPin);
  let polarity = $state<PolarityChoice>('high');
  const preset = $derived(PRESETS.find((p) => p.id === id)!);
  const out = $derived(fitOutput(id, pin, polarity));
  const cap = $derived(capacity(pin));
  const needed = $derived(out.ok ? out.terms : (out.needed ?? cap + 1));
  const SLOTS = 16;
  const label = $derived(out.ok ? `Fits: ${out.terms} of ${cap} product terms, active ${out.polarity}` : `Does not fit: needs ${needed} product terms, the macrocell has ${cap}`);
</script>

<Widget {n} title="Output polarity" subtitle="Which way round is cheaper?" {caption} onreset={() => ((id = start), (pin = startPin), (polarity = 'high'))}>
  {#snippet controls()}
    <Segmented label="Function" value={id} onchange={(v) => (id = v)} options={PRESETS.map((p) => ({ value: p.id, label: p.label, title: p.story }))} />
    <Segmented label="Macrocell" value={String(pin)} onchange={(v) => (pin = Number(v))} options={PINS.map((p) => ({ value: String(p), label: `pin ${p}: ${capacity(p)}`, title: `Pin ${p} has ${capacity(p)} product terms` }))} />
    <Segmented label="Polarity" value={polarity} onchange={(v) => (polarity = v)} options={[{ value: 'high', label: 'Active high' }, { value: 'low', label: 'Active low' }, { value: 'auto', label: 'Let the fitter choose' }]} />
  {/snippet}

  <div class="pd">
    <p class="story ui">{preset.story}</p>
    <pre class="eq">{preset.equations}</pre>

    <div class="slots" role="img" aria-label={label}>
      {#each Array.from({ length: SLOTS }, (_, i) => i) as i (i)}
        <span class="slot" class:gone={i >= cap} class:used={out.ok && i < out.terms} class:over={!out.ok && i >= cap && i < needed} class:full={!out.ok && i < cap}></span>
      {/each}
    </div>
    <div class="scale ui"><span>product terms of pin {pin}: <b>{cap}</b></span><span>needed: <b class:bad={!out.ok}>{needed}</b></span></div>

    {#if out.ok}
      <div class="verdict ok ui"><b>Fits</b>: {out.terms} of {cap} terms, active {out.polarity}. <span class="both">Active high needs {out.highTerms}, active low {out.lowTerms}.</span></div>
      <pre class="eq stored">{out.stored}</pre>
    {:else}
      <div class="verdict bad ui" role="alert"><b>Does not fit.</b> {out.message}</div>
    {/if}
  </div>
</Widget>

<style>
  .pd {
    display: grid;
    gap: 0.6rem;
    padding: 0.9rem 1rem 1rem;
  }
  .story {
    margin: 0;
    font-size: 0.88rem;
    color: var(--ink-2);
  }
  .eq {
    margin: 0;
    padding: 0.45rem 0.7rem;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.84rem;
    overflow-x: auto;
  }
  .eq.stored {
    border-color: var(--ok);
  }
  .slots {
    display: grid;
    grid-template-columns: repeat(16, minmax(0, 1fr));
    gap: 3px;
  }
  .slot {
    height: 1.4rem;
    border-radius: 3px;
    border: 1px solid var(--line-strong);
    background: var(--panel);
  }
  .slot.gone {
    border-style: dashed;
    border-color: var(--line);
    background: transparent;
    opacity: 0.55;
  }
  .slot.used {
    background: var(--sig-high);
    border-color: var(--sig-high);
  }
  .slot.full {
    background: var(--sig-high);
    border-color: var(--sig-high);
  }
  .slot.over {
    background: var(--bad);
    border: 1px dashed var(--bad);
    opacity: 0.85;
  }
  .scale {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    color: var(--mute);
  }
  .scale b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .scale b.bad {
    color: var(--bad);
  }
  .verdict {
    font-size: 0.86rem;
    padding: 0.45rem 0.7rem;
    border-radius: 6px;
    border-left: 3px solid;
  }
  .verdict.ok {
    border-color: var(--ok);
    background: var(--ok-soft);
  }
  .verdict.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .both {
    color: var(--ink-2);
  }
</style>
