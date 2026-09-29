<!--
  The frame of an instrument in the dock: a title strip with the instrument's name, a collapse button and
  (for instruments the reader added) a close button, like the strip of a Widget.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Glyph, { type GlyphName } from '../editor/Glyph.svelte';

  let {
    id,
    title,
    subtitle,
    icon,
    collapsed = $bindable(),
    onclose,
    children,
  }: { id?: string; title: string; subtitle?: string; icon: GlyphName; collapsed?: boolean | undefined; onclose?: () => void; children: Snippet } = $props();
  const uid = $props.id();
</script>

<section class="card" aria-labelledby="{uid}-t" data-instrument={id}>
  <header class="ui">
    <button type="button" class="head" onclick={() => (collapsed = !collapsed)} aria-expanded={!collapsed} aria-controls="{uid}-b">
      <span class="ic"><Glyph name={icon} size={16} /></span>
      <span class="titles">
        <span class="t" id="{uid}-t">{title}</span>
        {#if subtitle}<span class="s">{subtitle}</span>{/if}
      </span>
      <span class="chev" class:open={!collapsed}><Glyph name="chevron" size={16} /></span>
    </button>
    {#if onclose}
      <button type="button" class="x" onclick={onclose} aria-label="Remove {title}" title="Remove"><Glyph name="close" size={15} /></button>
    {/if}
  </header>
  <div class="body" id="{uid}-b" hidden={!!collapsed}>{@render children()}</div>
</section>

<style>
  .card {
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    background: var(--panel);
    box-shadow: var(--shadow);
    overflow: hidden;
    min-width: 0;
  }
  header {
    display: flex;
    align-items: stretch;
    background: linear-gradient(to bottom, color-mix(in srgb, light-dark(#ebe4d6, #131c29) 70%, var(--panel)), light-dark(#ebe4d6, #131c29));
    border-bottom: 1px solid var(--line-strong);
  }
  .head {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.5rem 0.7rem;
    border: 0;
    background: none;
    color: var(--fg);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .ic {
    display: grid;
    place-items: center;
    color: var(--copper-ink);
  }
  .titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .t {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 0.92rem;
    letter-spacing: -0.01em;
  }
  .s {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .chev {
    display: grid;
    color: var(--mute);
    transition: transform 150ms;
    transform: rotate(-90deg);
  }
  .chev.open {
    transform: none;
  }
  .x {
    display: grid;
    place-items: center;
    width: 2.2rem;
    border: 0;
    border-left: 1px solid var(--line);
    background: none;
    color: var(--mute);
    cursor: pointer;
  }
  .x:hover {
    color: var(--bad);
  }
  .body {
    padding: 0.8rem 0.85rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
</style>
