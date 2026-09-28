<!--
  Standard frame for an interactive figure: numbered title, instructions, controls, body, caption.
  Widgets are "wide" by default so they can use the margin column on large screens.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let {
    title,
    subtitle,
    caption,
    wide = true,
    controls,
    children,
    onreset,
    kind = 'Interactive',
  }: {
    title: string;
    subtitle?: string;
    caption?: string;
    wide?: boolean;
    controls?: Snippet;
    children: Snippet;
    onreset?: () => void;
    kind?: string;
  } = $props();
</script>

<figure class="widget" class:wide>
  <header class="ui">
    <div class="titles">
      <span class="kind">{kind}</span>
      <h4>{title}</h4>
      {#if subtitle}<p class="sub">{subtitle}</p>{/if}
    </div>
    {#if onreset}
      <button class="reset" onclick={onreset} title="Reset" aria-label="Reset widget"><Icon name="reset" size={15} /></button>
    {/if}
  </header>
  {#if controls}
    <div class="cell in">
      <span class="nb in" aria-hidden="true"></span>
      <div class="controls ui">{@render controls()}</div>
    </div>
  {/if}
  <div class="cell out">
    <span class="nb out" aria-hidden="true"></span>
    <div class="body">{@render children()}</div>
  </div>
  {#if caption}<figcaption class="ui">{caption}</figcaption>{/if}
</figure>

<style>
  .widget {
    margin: 2.5rem 0;
    position: relative;
    counter-increment: cell;
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0 0 0.6rem;
  }
  .kind {
    font: 500 0.68rem var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent);
  }
  h4 {
    margin: 0.1rem 0 0 !important;
    padding: 0 !important;
    border: 0 !important;
    font-size: 1.15rem !important;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .sub {
    margin: 0.25rem 0 0 !important;
    font-size: 0.9rem;
    color: var(--ink-2);
    line-height: 1.55;
  }
  .reset {
    border: 1px solid var(--border);
    background: transparent;
    color: var(--ink-2);
    border-radius: var(--radius);
    padding: 0.3rem;
    cursor: pointer;
    display: inline-flex;
  }
  .reset:hover {
    color: var(--ink);
    background: var(--pn);
  }
  .cell {
    position: relative;
  }
  .cell.in .nb {
    top: 0.7rem;
  }
  .cell.out .nb {
    top: 0.45rem;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.75rem 1.5rem;
    padding: 0.7rem 1rem 0.8rem;
    background: var(--pn);
    border-left: 3px solid var(--ac);
    border-radius: 0 var(--radius) var(--radius) 0;
    margin-bottom: 0.5rem;
  }
  .body {
    padding: 0.4rem 0 0.5rem;
    font-family: var(--font-ui);
    font-size: 0.9rem;
    min-width: 0;
    /* a figure wider than the column scrolls inside its cell instead of widening the page */
    overflow-x: auto;
    overflow-y: hidden;
  }
  figcaption {
    padding: 0.5rem 0 0;
    border-top: 1px solid var(--rule);
    font-size: 0.85rem;
    color: var(--ink-2);
    line-height: 1.55;
  }
</style>
