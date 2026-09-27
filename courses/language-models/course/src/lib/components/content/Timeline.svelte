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
    left: 4.6rem;
    top: 0.4rem;
    bottom: 0.4rem;
    width: 2px;
    background: var(--rule-strong);
  }
  li {
    display: grid;
    grid-template-columns: 4rem 1.2rem 1fr;
    gap: 0 0.3rem;
    padding: 0.45rem 0;
    margin: 0 !important;
  }
  .year {
    text-align: right;
    font-weight: 650;
    color: var(--history);
    font-size: 0.95rem;
    padding-top: 0.05rem;
  }
  .dot {
    width: 10px;
    height: 10px;
    margin: 0.4rem 0 0 0.4rem;
    border-radius: 50%;
    background: var(--surface);
    border: 2px solid var(--history);
    position: relative;
    z-index: 1;
  }
  .title {
    font-weight: 620;
    font-size: 0.92rem;
  }
  .where {
    font-size: 0.75rem;
    font-weight: 500;
    margin-left: 0.3rem;
  }
  .people {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .text {
    font-size: 0.84rem;
    color: var(--ink-2);
    line-height: 1.5;
    margin-top: 0.1rem;
  }
</style>
