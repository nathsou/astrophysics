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
    margin: 2.25rem 0;
    background: var(--chart-surface);
    border: 2px solid var(--fg);
    border-radius: var(--radius);
    box-shadow: 6px 6px 0 var(--pn);
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 1.15rem 0.6rem;
    background: var(--pn);
    border-bottom: 2px solid var(--fg);
  }
  .kind {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 500;
    color: var(--ink-2);
  }
  .kind::before {
    content: '';
    width: 0.6rem;
    height: 0.6rem;
    background: var(--fx-red);
    flex: none;
  }
  h4 {
    margin: 0.2rem 0 0 !important;
    padding: 0 !important;
    border: 0 !important;
    font-family: var(--font-display) !important;
    font-size: 1.2rem !important;
    font-weight: 900 !important;
    letter-spacing: -0.02em !important;
    line-height: 1.1 !important;
  }
  .sub {
    margin: 0.3rem 0 0 !important;
    font-size: 0.86rem;
    color: var(--ink-2);
    line-height: 1.45;
  }
  .reset {
    border: 2px solid var(--fg);
    background: var(--surface);
    color: var(--ink);
    border-radius: var(--radius-sm);
    padding: 0.28rem;
    cursor: pointer;
    display: inline-flex;
    flex: none;
  }
  .reset:hover {
    background: var(--fx-yellow);
    color: var(--fx-ink);
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.75rem 1.5rem;
    padding: 0.7rem 1.15rem 0.8rem;
    border-bottom: 1px solid var(--rule);
  }
  .body {
    padding: 1rem 1.15rem 1.1rem;
    font-family: var(--font-ui);
    font-size: 0.92rem;
  }
  figcaption {
    padding: 0.65rem 1.15rem 0.85rem;
    border-top: 1px solid var(--rule-strong);
    font-size: 0.84rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
