<!--
  Serving many requests from a fixed KV-cache budget. Requests of random lengths (up to a maximum) arrive; with
  contiguous allocation each reserves the maximum length, with paging each takes blocks as it grows. How many
  requests fit at once? Uses the learner's kvSlots().
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { impl } from '$lib/exercise/impl.svelte';

  function reference(lengths: number[], maxLen: number, block: number) {
    return {
      used: lengths.reduce((a, n) => a + n, 0),
      contiguous: lengths.length * maxLen,
      paged: lengths.reduce((a, n) => a + Math.ceil(n / block) * block, 0),
    };
  }
  const slots = $derived(impl.get('eff.paged', reference));
  const mine = $derived(impl.isMine('eff.paged'));

  const MAX = 4096, BUDGET = 65536;
  let block = $state(16);
  let mean = $state(600);
  const lengths = $derived.by(() => {
    const rng = mulberry32(27);
    // Exponential lengths: most requests are short, a few are long.
    return Array.from({ length: 400 }, () => Math.min(MAX, Math.max(1, Math.round(-mean * Math.log(1 - rng())))));
  });
  const fit = (kind: 'contiguous' | 'paged') => {
    let n = 0;
    while (n < lengths.length) {
      let r: { contiguous: number; paged: number };
      try {
        r = slots(lengths.slice(0, n + 1), MAX, block);
      } catch {
        r = reference(lengths.slice(0, n + 1), MAX, block);
      }
      if (r[kind] > BUDGET) break;
      n++;
    }
    return n;
  };
  const nc = $derived(fit('contiguous'));
  const np = $derived(fit('paged'));
  const shown = $derived(lengths.slice(0, np));
</script>

<Widget
  title="Paged attention"
  subtitle="A KV cache with room for 65,536 tokens, serving requests whose lengths vary (up to 4,096). Reserving the maximum for each request wastes most of the memory; allocating fixed-size blocks as sequences grow wastes at most one partly filled block per request."
  onreset={() => {
    block = 16;
    mean = 600;
  }}
>
  {#snippet controls()}
    <div class="sl"><Slider label="Mean request length" min={50} max={3000} step={10} value={mean} oninput={(v) => (mean = v)} format={(v) => v.toFixed(0)} /></div>
    <div class="sl"><Slider label="Block size" min={1} max={256} step={1} value={block} oninput={(v) => (block = v)} format={(v) => v.toFixed(0)} /></div>
  {/snippet}

  {#if mine}<p class="mine ui">Using your kvSlots().</p>{/if}
  <div class="rows ui">
    <span>Contiguous</span>
    <div class="track">{#each lengths.slice(0, nc) as n, i (i)}<div class="req" style:width="{(MAX / BUDGET) * 100}%"><div class="fill" style:width="{(n / MAX) * 100}%"></div></div>{/each}</div>
    <strong class="num">{nc}</strong>
    <span>Paged</span>
    <div class="track">{#each shown as n, i (i)}<div class="req" style:width="{((Math.ceil(n / block) * block) / BUDGET) * 100}%"><div class="fill" style:width="{(n / (Math.ceil(n / block) * block)) * 100}%"></div></div>{/each}</div>
    <strong class="num">{np}</strong>
  </div>
  <p class="note ui">Requests that fit at once (the number on the right). Filled: tokens actually cached; pale: reserved but empty.</p>
</Widget>

<style>
  .sl {
    flex: 1 1 11rem;
  }
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .rows {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr) 2.5rem;
    gap: 0.5rem 0.7rem;
    align-items: center;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .track {
    display: flex;
    height: 1.6rem;
    background: var(--surface-2);
    border-radius: 3px;
    overflow: hidden;
  }
  .req {
    height: 100%;
    background: color-mix(in srgb, var(--series-1) 22%, transparent);
    border-right: 1px solid var(--surface);
    flex: none;
  }
  .fill {
    height: 100%;
    background: var(--series-1);
  }
  .note {
    font-size: 0.76rem;
    color: var(--ink-3);
    margin: 0.4rem 0 0;
  }
</style>
