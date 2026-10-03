<!--
  A bug-museum exhibit, placed where the chapter re-enacts it: `::museum{exhibit="binary-search-2006"}`.
  The "caught" stamp appears once an exercise in the course has caught the bug.
-->
<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { progress } from '$lib/state/progress.svelte';
  import { findEntry } from '$lib/content/registry';
  import type { Exhibit } from './types';

  let { exhibit, compact = false }: { exhibit: Exhibit; compact?: boolean } = $props();
  onMount(() => progress.load());
  const caught = $derived(progress.isCaught(exhibit.id));
  const where = $derived(findEntry('chapter', exhibit.chapter));
</script>

<aside class="exhibit" class:compact aria-label="Bug museum exhibit: {exhibit.title}">
  <div class="plate ui">
    <span class="label">Bug museum</span>
    <span class="year num">{exhibit.year}</span>
  </div>
  <div class="body">
    <h3 class="title">{exhibit.title}</h3>
    <div class="summary">{@html exhibit.summary}</div>
    <p class="meta ui">
      {#if exhibit.reenacted}<span>Re-enacted{#if where} in {#if where.available}<a href="{base}{where.href}">Ch. {where.number}</a>{:else}Ch. {where.number}{/if}{/if}</span>{:else}<span>History card{#if where} · Ch. {where.number}{/if}</span>{/if}
      {#if exhibit.simplification}<span class="simp">Simplified: {exhibit.simplification}</span>{/if}
    </p>
  </div>
  <div class="stamp ui" class:on={caught} aria-live="polite">{caught ? '✓ caught' : 'not yet caught'}</div>
</aside>

<style>
  .exhibit {
    position: relative;
    margin: 1.8rem 0;
    padding: 1rem 1.2rem 1rem;
    border: 1px solid var(--line-strong);
    border-radius: 2px;
    background: var(--panel);
    box-shadow: 4px 4px 0 var(--pn);
  }
  .plate {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid var(--line);
    padding-bottom: 0.35rem;
    margin-bottom: 0.6rem;
  }
  .label {
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--pencil);
    font-weight: 600;
  }
  .year {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--mute);
  }
  .title {
    margin: 0 0 0.35rem;
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 600;
    padding-right: 6.5rem;
  }
  .summary {
    font-size: 0.98rem;
    color: var(--ink-2);
  }
  .summary :global(p) {
    margin: 0 0 0.5rem;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    margin: 0.4rem 0 0;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .simp {
    font-style: italic;
  }
  .stamp {
    position: absolute;
    top: 2.6rem;
    right: 1rem;
    transform: rotate(-9deg);
    padding: 0.1rem 0.5rem;
    border: 1.5px dashed var(--line-strong);
    border-radius: 3px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .stamp.on {
    border-style: double;
    border-width: 3px;
    color: var(--seal);
    border-color: var(--seal);
  }
  .compact {
    margin: 0;
    height: 100%;
  }
</style>
