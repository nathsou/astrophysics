<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { PARTS, COURSE_TITLE } from '$content/outline';
  import type { ContentModule } from '$lib/content/types';
  import { findEntry, neighbours, type NavEntry } from '$lib/content/registry';
  import { nav } from '$lib/state/nav.svelte';
  import TermLayer from '../content/TermLayer.svelte';
  import Icon from '../ui/Icon.svelte';

  let { mod, entry }: { mod: ContentModule; entry: NavEntry } = $props();

  const Content = $derived(mod.default);
  const meta = $derived(mod.metadata);
  const part = $derived(PARTS.find((p) => p.id === entry.part));
  const around = $derived(neighbours(entry.kind, entry.slug));
  const eyebrow = $derived(entry.kind === 'appendix' ? `Appendix ${entry.number}` : `Chapter ${entry.number}${part ? (part.id === '0' || part.id === 'E' ? ` · ${part.title}` : ` · Part ${part.id} — ${part.title}`) : ''}`);
  const prereqs = $derived((meta.prerequisites ?? []).map((s) => findEntry('chapter', s) ?? findEntry('appendix', s)).filter((e) => e !== undefined));

  $effect(() => {
    nav.toc = mod.toc;
    nav.pageTitle = `${entry.number}. ${meta.title}`;
    return () => {
      nav.toc = [];
      nav.pageTitle = null;
    };
  });

  onMount(() => {
    const heads = mod.toc.filter((t) => t.depth === 2).map((t) => document.getElementById(t.id)).filter((h) => h !== null);
    let frame = 0;
    const update = () => {
      frame = 0;
      // Active = last section heading above the upper third of the viewport.
      let active: string | null = null;
      for (const h of heads) if (h.getBoundingClientRect().top < innerHeight * 0.33) active = h.id;
      nav.activeId = active;
    };
    const onScroll = () => (frame ||= requestAnimationFrame(update));
    addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  });
</script>

<svelte:head>
  <title>{entry.number}. {meta.title} — {COURSE_TITLE}</title>
  <meta name="description" content={meta.summary} />
</svelte:head>

<article class="article">
  <header class="chapter-head">
    <p class="eyebrow ui">{eyebrow}</p>
    <h1>{meta.title}</h1>
    <p class="summary">{meta.summary}</p>
    <div class="meta ui">
      {#if meta.duration}<span><Icon name="history" size={14} /> {meta.duration}</span>{/if}
      {#if prereqs.length}
        <span>Assumes:
          {#each prereqs as p, i (p.slug)}{#if i}, {/if}{#if p.available}<a href="{base}{p.href}">{p.number}. {p.title}</a>{:else}<span title="Coming soon">{p.number}. {p.title}</span>{/if}{/each}
        </span>
      {/if}
    </div>
    {#if meta.theorems?.length}
      <div class="builds ui">
        <span class="label">Theorems</span>
        {#each meta.theorems as b (b)}<span class="chip thm">{b}</span>{/each}
      </div>
    {/if}
    {#if meta.techniques?.length}
      <div class="builds ui">
        <span class="label">Techniques</span>
        {#each meta.techniques as b (b)}<span class="chip">{b}</span>{/each}
      </div>
    {/if}
  </header>

  <TermLayer docs={{ terms: mod.terms, references: mod.references, glossary: mod.glossary }}>
    <Content />
  </TermLayer>

  {#if mod.references.length}
    <section class="references">
      <h2 id="references">References</h2>
      <ol>
        {#each mod.references as r (r.key)}
          <li id="ref-{r.key}">
            <span class="authors">{r.authors}</span> ({r.year}). {#if r.url}<a href={r.url} target="_blank" rel="noopener"><em>{r.title}</em></a>{:else}<em>{r.title}</em>{/if}{#if r.venue}. {r.venue}{/if}.
            {#if r.note}<span class="note">{r.note}</span>{/if}
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  <nav class="pager ui" aria-label="Chapter navigation">
    {#if around.prev}
      <a class="prev" href="{base}{around.prev.href}"><span class="dir">← Previous</span><span class="t">{around.prev.number}. {around.prev.title}</span></a>
    {:else}<span></span>{/if}
    {#if around.next}
      <a class="next" href="{base}{around.next.href}"><span class="dir">Next →</span><span class="t">{around.next.number}. {around.next.title}</span></a>
    {/if}
  </nav>
</article>

<style>
  .article {
    padding-bottom: 6rem;
  }
  .chapter-head {
    padding: 3.5rem 0 1.5rem;
  }
  .eyebrow {
    margin: 0 0 0.6rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    font-weight: 650;
    color: var(--accent);
  }
  h1 {
    font-family: var(--font-body);
    font-size: clamp(2.3rem, 5.5vw, 3.4rem);
    line-height: 1.08;
    letter-spacing: -0.02em;
    font-weight: 600;
    margin: 0 0 0.9rem;
  }
  .summary {
    font-size: 1.3rem;
    line-height: 1.5;
    color: var(--ink-2);
    margin: 0 0 1.25rem;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .meta span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .builds {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin-top: 1rem;
    font-size: 0.8rem;
  }
  .builds .label {
    color: var(--ink-3);
    margin-right: 0.3rem;
  }
  .chip {
    padding: 0.15rem 0.6rem;
    border-radius: 99px;
    background: var(--accent-soft);
    color: var(--accent-ink);
    font-weight: 560;
  }
  .chip.thm {
    background: var(--history-soft);
    color: var(--ink);
    border: 1px solid color-mix(in srgb, var(--history) 30%, transparent);
  }
  .builds .label {
    min-width: 5.5rem;
  }
  .references {
    margin-top: 3rem;
    font-size: 0.92rem;
  }
  .references ol {
    padding-left: 1.4rem;
  }
  .references li {
    margin-bottom: 0.5rem;
  }
  .references li:target {
    background: var(--term-hl);
    border-radius: 4px;
  }
  .authors {
    font-weight: 600;
  }
  .note {
    display: block;
    color: var(--ink-2);
    font-size: 0.86rem;
  }
  .pager {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 4rem;
  }
  .pager a {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.9rem 1.1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    text-decoration: none;
    color: var(--ink);
  }
  .pager a:hover {
    border-color: var(--accent-2);
  }
  .next {
    text-align: right;
    grid-column: 2;
  }
  .dir {
    font-size: 0.75rem;
    color: var(--ink-3);
  }
  .t {
    font-weight: 600;
  }
</style>
