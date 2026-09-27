<!--
  A numbered display equation. Symbols wrapped in \term{id}{…} are hoverable (see TermLayer).
  Terms that carry a `param` get a live slider underneath, bound to the shared parameter store.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { tryPageDocs } from './context';
  import { params, focus } from '$lib/state/params.svelte';
  import Slider from '../ui/Slider.svelte';

  let {
    n,
    id,
    caption,
    title,
    controls = true,
    children,
  }: { n?: number; id?: string; caption?: string; title?: string; controls?: boolean; children?: Snippet } = $props();

  const docs = tryPageDocs();
  let el: HTMLElement;
  let termIds: string[] = $state([]);

  onMount(() => {
    termIds = [...new Set([...el.querySelectorAll<HTMLElement>('[data-term]')].map((e) => e.dataset.term!))];
    for (const t of termIds) {
      const p = docs.terms[t]?.param;
      if (p) params.init(p.key, p.value);
    }
  });

  const bound = $derived(termIds.filter((t) => docs.terms[t]?.param));
</script>

<figure class="equation" {id} bind:this={el}>
  {#if title}<div class="title ui">{title}</div>{/if}
  <div class="row">
    <div class="body">{@render children?.()}</div>
    {#if n}<span class="num ui" aria-label="Equation {n}">({n})</span>{/if}
  </div>
  {#if controls && bound.length}
    <div class="controls">
      {#each bound as t (t)}
        {@const p = docs.terms[t]!.param!}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="ctl"
          onpointerenter={() => focus.set(t, 'equation-control')}
          onpointerleave={() => focus.source === 'equation-control' && focus.set(null)}
        >
          <Slider
            compact
            min={p.min}
            max={p.max}
            step={p.step}
            log={p.log}
            labelHtml={docs.terms[t]!.label}
            value={params.get(p.key, p.value)}
            oninput={(v) => params.set(p.key, v)}
          />
        </div>
      {/each}
    </div>
  {/if}
  {#if caption}<figcaption class="ui">{caption}</figcaption>{/if}
</figure>

<style>
  .equation {
    margin: 1.75rem 0;
    padding: 0.4rem 0;
  }
  .title {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-3);
    font-weight: 600;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  .body :global(.math-display) {
    margin: 0.6rem 0;
  }
  .num {
    color: var(--ink-3);
    font-size: 0.85rem;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    padding: 0.65rem 0.9rem;
    margin-top: 0.25rem;
    background: var(--surface-2);
    border-radius: var(--radius-sm);
  }
  .ctl {
    flex: 1 1 12rem;
  }
  figcaption {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: var(--ink-2);
    text-align: center;
  }
</style>
