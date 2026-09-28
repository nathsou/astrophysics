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
  {#if controls}<div class="controls ui">{@render controls()}</div>{/if}
  <div class="body">{@render children()}</div>
  {#if caption}<figcaption class="ui">{caption}</figcaption>{/if}
</figure>

<style>
  .widget {
    margin: 2rem 0;
    background: var(--chart-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 1.1rem 0.5rem;
  }
  .kind {
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 650;
    color: var(--accent);
  }
  h4 {
    margin: 0.1rem 0 0 !important;
    padding: 0 !important;
    border: 0 !important;
    font-size: 1.02rem !important;
    font-weight: 620;
  }
  .sub {
    margin: 0.2rem 0 0 !important;
    font-size: 0.82rem;
    color: var(--ink-2);
    line-height: 1.45;
  }
  .reset {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--ink-2);
    border-radius: 6px;
    padding: 0.3rem;
    cursor: pointer;
    display: inline-flex;
  }
  .reset:hover {
    color: var(--ink);
    background: var(--surface-2);
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.75rem 1.5rem;
    padding: 0.5rem 1.1rem 0.75rem;
    border-bottom: 1px solid var(--rule);
  }
  .body {
    padding: 0.9rem 1.1rem 1rem;
    font-family: var(--font-ui);
    font-size: 0.9rem;
  }
  figcaption {
    padding: 0.6rem 1.1rem 0.8rem;
    border-top: 1px solid var(--rule);
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
