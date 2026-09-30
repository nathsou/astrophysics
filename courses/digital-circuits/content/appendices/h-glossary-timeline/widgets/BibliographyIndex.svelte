<!--
  Every source of the course, grouped by the part of the course that first cites it. Each entry lists the chapters
  that cite it. Entries have the anchor `ref-<key>`, which other pages link to.

    ::bibliography-index
-->
<script lang="ts">
  import { base } from '$app/paths';
  import { findEntry } from '$lib/content/registry';
  import { CITATIONS, REFS, groupRefs, type Where } from './bibliography';

  let q = $state('');
  const needle = $derived(q.trim().toLowerCase());
  const groups = $derived(
    groupRefs(needle ? REFS.filter((r) => `${r.authors} ${r.title} ${r.year} ${r.venue ?? ''} ${r.note ?? ''} ${r.key}`.toLowerCase().includes(needle)) : REFS, CITATIONS),
  );
  const count = $derived(groups.reduce((n, g) => n + g.entries.length, 0));

  const link = (w: Where) => {
    const e = findEntry(w.kind, w.slug);
    return e?.available ? `${base}${e.href}` : undefined;
  };
</script>

<div class="bib wide ui">
  <div class="bar">
    <input class="search" type="search" placeholder="Filter {REFS.length} sources…" bind:value={q} aria-label="Filter the bibliography" />
    <nav class="jump" aria-label="Jump to a group">
      {#each groups as g (g.id)}<a href="#bib-{g.id}">{g.short}</a>{/each}
    </nav>
  </div>
  {#if !count}<p class="none">No source matches “{q}”.</p>{/if}
  {#each groups as g (g.id)}
    <section aria-labelledby="bib-{g.id}">
      <h3 id="bib-{g.id}">{g.title} <span class="n">{g.entries.length}</span></h3>
      <ol>
        {#each g.entries as r (r.key)}
          <li id="ref-{r.key}">
            <span class="authors">{r.authors}</span> ({r.year}).
            {#if r.url}<a href={r.url} target="_blank" rel="noopener"><em>{r.title}</em></a>{:else}<em>{r.title}</em>{/if}{#if r.venue}. {r.venue.replace(/\.$/, '')}{/if}.
            {#if r.note}<span class="note">{r.note}</span>{/if}
            {#if r.cited.length}
              <span class="cited">Cited in
                {#each r.cited as w, i (w.place)}{@const h = link(w)}{i ? ', ' : ' '}{#if h}<a href={h}>{w.label}</a>{:else}{w.label}{/if}{/each}.</span>
            {/if}
          </li>
        {/each}
      </ol>
    </section>
  {/each}
</div>

<style>
  .bib {
    margin: 1.5rem 0;
    font-size: 0.88rem;
  }
  .bar {
    display: grid;
    gap: 0.6rem;
    margin-bottom: 0.6rem;
  }
  .search {
    width: 100%;
    max-width: 24rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
    color: var(--fg);
    font: inherit;
  }
  .jump {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .jump a {
    padding: 0.15rem 0.6rem;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--panel);
    color: var(--fg);
    font-size: 0.78rem;
    text-decoration: none;
  }
  .jump a:hover,
  .jump a:focus-visible {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  h3 {
    margin: 1.8rem 0 0.5rem !important;
    padding: 0 0 0.25rem !important;
    border-bottom: 2px solid var(--copper) !important;
    font-family: var(--font-display) !important;
    font-size: 1.15rem !important;
    color: var(--fg);
    scroll-margin-top: 5rem;
  }
  .n {
    margin-left: 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--mute);
  }
  ol {
    padding-left: 0;
    list-style: none;
    display: grid;
    gap: 0.6rem;
    margin: 0;
  }
  li {
    margin: 0;
    padding-left: 0.8rem;
    border-left: 3px solid var(--line);
    scroll-margin-top: 5rem;
  }
  li:target {
    border-left-color: var(--copper);
    background: var(--copper-soft);
  }
  .authors {
    font-weight: 600;
  }
  .note {
    display: block;
    color: var(--ink-2);
  }
  .cited {
    display: block;
    font-size: 0.78rem;
    color: var(--mute);
  }
  .none {
    color: var(--mute);
  }
</style>
