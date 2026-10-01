<script lang="ts">
  import { base } from '$app/paths';
  import { findEntry } from '$lib/content/registry';
  let { items }: { items: { year: number; title: string; people?: string; chapter?: string; text: string }[] } = $props();
  let q = $state('');
  const shown = $derived(items.filter((e) => !q || `${e.year} ${e.title} ${e.people ?? ''} ${e.text}`.toLowerCase().includes(q.toLowerCase())));
</script>

<div class="timeline wide ui">
  <input class="search" type="search" placeholder="Filter {items.length} events…" bind:value={q} aria-label="Filter timeline" />
  <ol>
    {#each shown as e, i (i)}
      {@const ch = e.chapter ? (findEntry('chapter', e.chapter) ?? findEntry('appendix', e.chapter)) : undefined}
      <li>
        <span class="year num">{e.year}</span>
        <span class="dot" aria-hidden="true"></span>
        <div class="body">
          <div class="title">{e.title}{#if ch?.available} <a class="where" href="{base}{ch.href}">{ch.kind === 'chapter' ? 'Ch.' : 'App.'} {ch.number}</a>{/if}</div>
          {#if e.people}<div class="people">{e.people}</div>{/if}
          <div class="text">{@html e.text}</div>
        </div>
      </li>
    {/each}
  </ol>
</div>

<style>
  .timeline {
    margin: 1.5rem 0;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    position: relative;
  }
  ol::before {
    content: '';
    position: absolute;
    left: 4.75rem;
    top: 0.4rem;
    bottom: 0.4rem;
    width: 1.5px;
    background: color-mix(in srgb, var(--track) 45%, var(--line));
  }
  li {
    display: grid;
    grid-template-columns: 4rem 1.2rem 1fr;
    gap: 0 0.4rem;
    padding: 0.5rem 0;
    margin: 0 !important;
  }
  .year {
    text-align: right;
    font-family: var(--font-display);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--ink);
    font-size: 0.98rem;
    padding-top: 0.05rem;
  }
  .dot {
    width: 11px;
    height: 11px;
    margin: 0.45rem 0 0 0.33rem;
    border-radius: 50%;
    box-shadow: 0 0 0 3px var(--bg);
    background: var(--track);
    position: relative;
    z-index: 1;
  }
  li:nth-child(3n + 2) .dot {
    background: var(--c-lab);
  }
  li:nth-child(3n) .dot {
    background: var(--sig-high);
  }
  .title {
    font-weight: 700;
    font-size: 0.95rem;
  }
  .where {
    font-size: 0.75rem;
    font-weight: 500;
    margin-left: 0.3rem;
  }
  .people {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .text {
    font-size: 0.86rem;
    color: var(--ink-2);
    line-height: 1.5;
    margin-top: 0.1rem;
  }
</style>
