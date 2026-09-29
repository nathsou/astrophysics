<!--
  A toolbar button that opens a small popup. The popup content gets a `close` function; Escape, a click
  outside and choosing something all close it.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Glyph, { type GlyphName } from './Glyph.svelte';

  let {
    label,
    icon,
    title,
    align = 'left',
    compact = false,
    children,
  }: { label?: string; icon?: GlyphName; title: string; align?: 'left' | 'right'; compact?: boolean; children: Snippet<[() => void]> } = $props();

  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();
  const close = () => (open = false);
  const uid = $props.id();
</script>

<svelte:window
  onpointerdown={(ev) => {
    if (open && root && !root.contains(ev.target as Node)) open = false;
  }}
/>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="menu" bind:this={root} onkeydown={(ev) => ev.key === 'Escape' && open && (ev.stopPropagation(), (open = false))}>
  <button type="button" class="btn ui" class:compact aria-haspopup="true" aria-expanded={open} aria-controls="{uid}-pop" {title} onclick={() => (open = !open)}>
    {#if icon}<Glyph name={icon} size={17} />{/if}
    {#if label}<span class="lbl">{label}</span>{/if}
    <Glyph name="chevron" size={13} />
  </button>
  {#if open}
    <div class="pop {align}" id="{uid}-pop">{@render children(close)}</div>
  {/if}
</div>

<style>
  .menu {
    position: relative;
    display: inline-flex;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    height: 2.1rem;
    padding: 0 0.6rem;
    border: 1px solid transparent;
    border-radius: 7px;
    background: none;
    color: var(--ink-2);
    font: inherit;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }
  .btn:hover,
  .btn[aria-expanded='true'] {
    background: var(--panel);
    border-color: var(--line);
    color: var(--fg);
  }
  .pop {
    position: absolute;
    top: calc(100% + 6px);
    z-index: 60;
    min-width: 15rem;
    max-width: min(22rem, 90vw);
    max-height: min(70vh, 32rem);
    overflow-y: auto;
    padding: 0.35rem;
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    box-shadow: var(--shadow-lg);
    font-family: var(--font-ui);
  }
  .pop.left {
    left: 0;
  }
  .pop.right {
    right: 0;
  }
  @media (max-width: 1420px) {
    .btn.compact .lbl {
      display: none;
    }
  }
  @media (max-width: 760px) {
    .menu {
      position: static;
    }
    .pop {
      position: fixed;
      left: 0.5rem;
      right: 0.5rem;
      top: 7.4rem;
      max-width: none;
    }
  }
</style>
