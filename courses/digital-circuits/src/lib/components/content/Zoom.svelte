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
    margin: 2.25rem 0;
    border: 1px solid var(--line);
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
    background: var(--pn);
    border-bottom: 1px solid var(--line);
    font-size: 0.82rem;
  }
  .kind {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 700;
    color: var(--accent);
  }
  .title {
    font-weight: 700;
  }
  .spacer {
    flex: 1;
  }
  .levels {
    display: flex;
    gap: 0;
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .levels button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 0;
    background: none;
    padding: 0.25rem 0.65rem;
    cursor: pointer;
    color: var(--ink);
    font-size: 0.82rem;
    font-weight: 500;
  }
  .levels button + button {
    border-left: 1px solid var(--line);
  }
  .levels button.on {
    background: var(--fg);
    color: var(--bg);
    font-weight: 700;
  }
  .levels button:hover:not(.on):not(:disabled) {
    background: var(--pn);
  }
  .levels .step {
    font-weight: 700;
    padding: 0.25rem 0.55rem;
  }
  .levels .step:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .dot {
    width: 0.5rem;
    height: 0.5rem;
    background: color-mix(in srgb, var(--copper) calc(25% + var(--k) * 75%), transparent);
    outline: 1px solid currentColor;
  }
  .body {
    padding: 1rem 1.3rem 0.35rem;
  }
</style>
