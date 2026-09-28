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
  const eyebrow = $derived(entry.kind === 'appendix' ? `Appendix ${entry.number}` : `Chapter ${entry.number}${part ? ` · Part ${part.id} — ${part.title}` : ''}`);
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
    <span class="nb md" aria-hidden="true"></span>
    <p class="eyebrow">{eyebrow}</p>
    <h1>{meta.title}</h1>
    <p class="summary">{meta.summary}</p>
    <div class="meta">
      {#if meta.duration}<span><Icon name="history" size={14} /> {meta.duration}</span>{/if}
      {#if prereqs.length}
        <span>Assumes:
          {#each prereqs as p, i (p.slug)}{#if i}, {/if}{#if p.available}<a href="{base}{p.href}">{p.number}. {p.title}</a>{:else}<span title="Coming in milestone {p.milestone}">{p.number}. {p.title}</span>{/if}{/each}
        </span>
      {/if}
    </div>
    {#if meta.builds?.length}
      <div class="builds">
        <span class="label">builds =</span>
        {#each meta.builds as b (b)}<span class="chip">{b}</span>{/each}
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
    padding: 3.25rem 0 1rem;
  }
  .chapter-head .nb {
    top: 3.9rem;
  }
  .eyebrow {
    margin: 0 0 0.9rem;
    font: 500 0.72rem var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent);
  }
  h1 {
    font-family: var(--font-ui);
    font-size: clamp(2.4rem, 7vw, 3.75rem);
    line-height: 1;
    letter-spacing: -0.04em;
    font-weight: 700;
    margin: 0 0 1rem;
    text-wrap: balance;
  }
  .summary {
    font-size: 1.125rem;
    line-height: 1.65;
    color: var(--ink-2);
    margin: 0 0 1.25rem;
    max-width: 36rem;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    font: 400 0.78rem var(--font-mono);
    color: var(--ink-2);
  }
  .meta span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .builds {
    display: block;
    margin-top: 1rem;
    font: 400 0.78rem var(--font-mono);
    padding: 0.55rem 0.9rem;
    background: var(--pn);
    border-left: 3px solid var(--ac);
    border-radius: 0 var(--radius) var(--radius) 0;
  }
  .builds .label {
    color: var(--ink-3);
    margin-right: 0.3rem;
  }
  .chip {
    color: var(--accent-ink);
    font-weight: 500;
  }
  .chip:not(:last-child)::after {
    content: ',';
    color: var(--ink-3);
    margin-right: 0.4rem;
  }
  .references {
    margin-top: 3rem;
    font-size: 0.95rem;
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
    font-weight: 700;
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
    padding: 0.8rem 1.1rem;
    background: var(--pn);
    border-left: 3px solid var(--ac);
    border-radius: 0 var(--radius) var(--radius) 0;
    text-decoration: none;
    color: var(--ink);
  }
  .pager a:hover {
    background: var(--surface-3);
  }
  .pager .next {
    text-align: right;
    grid-column: 2;
    border-left: 0;
    border-right: 3px solid var(--ac);
    border-radius: var(--radius) 0 0 var(--radius);
  }
  .dir {
    font: 400 0.72rem var(--font-mono);
    color: var(--ink-3);
  }
  .t {
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  @media (max-width: 759px) {
    .chapter-head .nb {
      margin-bottom: 0.6rem;
    }
    .pager {
      grid-template-columns: 1fr;
    }
    .pager .next {
      grid-column: 1;
    }
  }
</style>
