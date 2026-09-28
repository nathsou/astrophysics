<!--
  A proof at several levels of detail, from the one-line idea to every step:
    ::::zoom{levels="Idea, Sketch, Proof"}
    :::level[Idea] … :::
    …
    ::::
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { setZoom } from './zoom';

  let { levels = 'Idea, Sketch, Proof', title, children }: { levels?: string; title?: string; children?: Snippet } = $props();

  const names = $derived(levels.split(',').map((s) => s.trim()));
  let current = $state(0);
  let next = 0;
  setZoom({
    claim: () => next++,
    get current() {
      return current;
    },
  });
</script>

<section class="zoom" aria-label={title ?? 'Proof at several levels of detail'}>
  <header class="ui">
    <span class="kind">Zoom</span>
    {#if title}<span class="title">{title}</span>{/if}
    <span class="spacer"></span>
    <div class="levels" role="tablist" aria-label="Level of detail">
      <button class="step" onclick={() => (current = Math.max(0, current - 1))} disabled={current === 0} aria-label="Less detail">−</button>
      {#each names as n, i (i)}
        <button role="tab" aria-selected={current === i} class:on={current === i} onclick={() => (current = i)}>
          <span class="dot" style:--k={i / Math.max(1, names.length - 1)}></span>{n}
        </button>
      {/each}
      <button class="step" onclick={() => (current = Math.min(names.length - 1, current + 1))} disabled={current === names.length - 1} aria-label="More detail">+</button>
    </div>
  </header>
  <div class="body">{@render children?.()}</div>
</section>

<style>
  .zoom {
    margin: 2rem 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    padding: 0.6rem 0.9rem;
    border-bottom: 1px solid var(--rule);
    font-size: 0.8rem;
  }
  .kind {
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 650;
    color: var(--accent);
  }
  .title {
    font-weight: 600;
  }
  .spacer {
    flex: 1;
  }
  .levels {
    display: flex;
    gap: 0.2rem;
    background: var(--surface-2);
    padding: 0.2rem;
    border-radius: 8px;
  }
  .levels button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 0;
    background: none;
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    cursor: pointer;
    color: var(--ink-2);
    font-size: 0.8rem;
  }
  .levels button.on {
    background: var(--surface);
    color: var(--ink);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  .levels .step {
    font-weight: 700;
    padding: 0.25rem 0.5rem;
  }
  .levels .step:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent) calc(25% + var(--k) * 75%), transparent);
  }
  .body {
    padding: 0.9rem 1.2rem 0.3rem;
  }
</style>
