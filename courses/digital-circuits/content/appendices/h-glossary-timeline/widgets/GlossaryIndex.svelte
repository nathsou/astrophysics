<!--
  The glossary of the course, A–Z: a letter index, a filter, and for each term its definition and the chapter that
  introduces it.

    ::glossary-index
-->
<script lang="ts">
  import { base } from '$app/paths';
  import { findEntry } from '$lib/content/registry';
  import { ALPHABET, TERMS, groupByLetter } from './glossary';

  let q = $state('');
  const needle = $derived(q.trim().toLowerCase());
  const shown = $derived(needle ? TERMS.filter((t) => `${t.term} ${t.definition}`.toLowerCase().includes(needle)) : TERMS);
  const groups = $derived(groupByLetter(shown));
  const present = $derived(new Set(groups.map((g) => g.letter)));

  const where = (slug?: string) => {
    if (!slug) return undefined;
    const e = findEntry('chapter', slug) ?? findEntry('appendix', slug);
    return e?.available ? { href: `${base}${e.href}`, label: `${e.kind === 'appendix' ? 'Appendix' : 'Chapter'} ${e.number}`, title: e.title } : undefined;
  };
</script>

<div class="gi wide ui">
  <div class="bar">
    <input class="search" type="search" placeholder="Filter {TERMS.length} terms…" bind:value={q} aria-label="Filter the glossary" />
    <nav class="letters" aria-label="Jump to a letter">
      {#each ALPHABET as l (l)}
        {#if present.has(l)}<a href="#letter-{l === '#' ? 'num' : l}" aria-label="Terms starting with {l === '#' ? 'a digit or symbol' : l}">{l}</a>{:else}<span aria-hidden="true">{l}</span>{/if}
      {/each}
    </nav>
  </div>
  {#if !groups.length}<p class="none">No term matches “{q}”.</p>{/if}
  {#each groups as g (g.letter)}
    <section aria-labelledby="letter-{g.letter === '#' ? 'num' : g.letter}">
      <h3 id="letter-{g.letter === '#' ? 'num' : g.letter}">{g.letter}</h3>
      <dl>
        {#each g.terms as t (t.id)}
          {@const w = where(t.chapter)}
          <dt id="term-{t.id}">{t.term}</dt>
          <dd>
            {@html t.html}
            {#if w}<a class="where" href={w.href} title={w.title}>{w.label}</a>{/if}
          </dd>
        {/each}
      </dl>
    </section>
  {/each}
</div>

<style>
  .gi {
    margin: 1.5rem 0;
    font-size: 0.9rem;
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
  .letters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem;
  }
  .letters a,
  .letters span {
    display: inline-grid;
    place-items: center;
    min-width: 1.7rem;
    height: 1.7rem;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    text-decoration: none;
  }
  .letters a {
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    font-weight: 600;
  }
  .letters a:hover,
  .letters a:focus-visible {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .letters span {
    color: var(--mute);
    opacity: 0.45;
  }
  h3 {
    margin: 1.6rem 0 0.4rem !important;
    padding: 0 0 0.25rem !important;
    border-bottom: 2px solid var(--copper) !important;
    font-family: var(--font-display) !important;
    font-size: 1.3rem !important;
    color: var(--copper-ink);
    scroll-margin-top: 5rem;
  }
  dl {
    display: grid;
    grid-template-columns: minmax(8rem, 13rem) 1fr;
    gap: 0.5rem 1.25rem;
    margin: 0;
  }
  dt {
    font-weight: 650;
    scroll-margin-top: 5rem;
  }
  dd {
    margin: 0;
    color: var(--ink-2);
    line-height: 1.5;
  }
  dd :global(code) {
    font-size: 0.85em;
  }
  .where {
    font-size: 0.78rem;
    margin-left: 0.4rem;
    white-space: nowrap;
  }
  .none {
    color: var(--mute);
  }
  @media (max-width: 640px) {
    dl {
      grid-template-columns: 1fr;
    }
    dd {
      margin-bottom: 0.4rem;
    }
  }
</style>
