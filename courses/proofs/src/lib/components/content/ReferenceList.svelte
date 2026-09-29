<script lang="ts">
  import type { Reference } from '$lib/content/types';
  let { items }: { items: Reference[] } = $props();
  let q = $state('');
  const shown = $derived(items.filter((r) => !q || `${r.authors} ${r.title} ${r.year} ${r.venue ?? ''}`.toLowerCase().includes(q.toLowerCase())));
</script>

<div class="reflist wide ui">
  <input class="search" type="search" placeholder="Filter {items.length} references…" bind:value={q} aria-label="Filter references" />
  <ol>
    {#each shown as r (r.key)}
      <li id="ref-{r.key}">
        <span class="authors">{r.authors}</span> ({r.year}).
        {#if r.url}<a href={r.url} target="_blank" rel="noopener"><em>{r.title}</em></a>{:else}<em>{r.title}</em>{/if}{#if r.venue}. {r.venue}{/if}.
        {#if r.note}<span class="note">{r.note}</span>{/if}
      </li>
    {/each}
  </ol>
</div>

<style>
  .reflist {
    margin: 1.5rem 0;
    font-size: 0.88rem;
  }
  .search,
  :global(.glossary .search),
  :global(.timeline .search) {
    width: 100%;
    max-width: 24rem;
    padding: 0.4rem 0.6rem;
    border: 2px solid var(--fg);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    margin-bottom: 0.8rem;
  }
  ol {
    padding-left: 1.4rem;
    display: grid;
    gap: 0.45rem;
  }
  .authors {
    font-weight: 600;
  }
  .note {
    display: block;
    color: var(--ink-2);
  }
</style>
