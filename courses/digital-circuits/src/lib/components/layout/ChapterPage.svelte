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
  // A little overlapped-primaries figure whose arrangement varies from chapter to chapter.
  const variant = $derived([...entry.slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 4);
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
  <header class="chapter-head wide">
    <div class="plate v{variant}" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="head-text">
    <p class="eyebrow">{eyebrow}</p>
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
    </div>
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
    padding-bottom: 5rem;
  }
  .chapter-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 11rem;
    gap: 2rem;
    align-items: start;
    padding: 3.25rem 0 2rem;
    margin-bottom: 0.5rem;
    border-bottom: 2px solid var(--fg);
  }
  .head-text {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
  }
  .eyebrow {
    margin: 0 0 0.9rem;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 500;
    color: var(--accent);
  }
  h1 {
    font-family: var(--font-display);
    font-size: clamp(2.1rem, 5.4vw, 3.05rem);
    line-height: 1;
    letter-spacing: -0.035em;
    font-weight: 900;
    margin: 0 0 1.1rem;
    overflow-wrap: break-word;
    hyphens: auto;
  }
  .summary {
    font-size: 1.32rem;
    line-height: 1.5;
    color: var(--ink-2);
    margin: 0 0 1.4rem;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    font-size: 0.86rem;
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
    font-size: 0.82rem;
  }
  .builds .label {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--mute);
    margin-right: 0.3rem;
    min-width: 5.5rem;
  }
  .chip {
    padding: 0.12rem 0.6rem;
    border-radius: var(--radius-sm);
    background: var(--pn);
    color: var(--ink);
    font-weight: 500;
  }
  .chip.thm {
    background: var(--fx-yellow);
    color: var(--fx-ink);
    font-weight: 700;
  }

  /* Overlapped primaries, in the spirit of the mockup's figure. */
  .plate {
    grid-column: 2;
    grid-row: 1;
    position: relative;
    font-size: 1rem;
    height: 11em;
    width: 11em;
    justify-self: end;
    margin-top: 0.4em;
  }
  .plate i {
    position: absolute;
    display: block;
  }
  .plate.v0 i:nth-child(1) { left: 0; top: 0; width: 6.5em; height: 6.5em; background: var(--fx-yellow); }
  .plate.v0 i:nth-child(2) { left: 4.4em; top: 3.8em; width: 6.5em; height: 6.5em; background: var(--fx-red); opacity: 0.9; }
  .plate.v0 i:nth-child(3) { left: 1.4em; top: 6em; width: 4.3em; height: 4.3em; background: var(--fx-blue); }
  .plate.v1 i:nth-child(1) { left: 4.5em; top: 0; width: 6.5em; height: 6.5em; background: var(--fx-blue); }
  .plate.v1 i:nth-child(2) { left: 0; top: 3.6em; width: 6.5em; height: 6.5em; background: var(--fx-yellow); opacity: 0.92; }
  .plate.v1 i:nth-child(3) { left: 5.7em; top: 6.6em; width: 4.3em; height: 4.3em; background: var(--fx-red); }
  .plate.v2 i:nth-child(1) { left: 0; top: 4.5em; width: 6.5em; height: 6.5em; background: var(--fx-red); }
  .plate.v2 i:nth-child(2) { left: 3.8em; top: 0; width: 6.5em; height: 6.5em; background: var(--fx-blue); opacity: 0.9; }
  .plate.v2 i:nth-child(3) { left: 6.6em; top: 6.4em; width: 4.3em; height: 4.3em; background: var(--fx-yellow); }
  .plate.v3 i:nth-child(1) { left: 0; top: 0; width: 6.5em; height: 6.5em; background: var(--fx-blue); }
  .plate.v3 i:nth-child(2) { left: 3.6em; top: 4.2em; width: 6.5em; height: 6.5em; background: var(--fx-red); opacity: 0.9; }
  .plate.v3 i:nth-child(3) { left: 6.8em; top: 0.4em; width: 4.2em; height: 4.2em; background: var(--fx-yellow); }
  @media (max-width: 720px) {
    .chapter-head {
      grid-template-columns: minmax(0, 1fr);
      gap: 1.25rem;
      padding-top: 1.75rem;
    }
    .plate {
      grid-column: 1;
      grid-row: 1;
      justify-self: start;
      margin: 0;
      font-size: 0.5rem;
    }
    .head-text {
      grid-row: 2;
    }
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
    border-radius: var(--radius-sm);
  }
  .authors {
    font-weight: 600;
  }
  .note {
    display: block;
    color: var(--ink-2);
    font-size: 0.88rem;
  }
  .pager {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
    margin-top: 4rem;
  }
  .pager a {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.9rem 1.1rem;
    border-top: 2px solid var(--fg);
    border-bottom: 2px solid var(--fg);
    text-decoration: none;
    color: var(--ink);
    transition: background-color 120ms;
  }
  .pager a:hover {
    background: var(--pn);
    opacity: 1;
  }
  .pager a:hover .t {
    color: var(--accent);
  }
  .next {
    text-align: right;
    grid-column: 2;
  }
  .dir {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--accent);
  }
  .t {
    font-weight: 700;
    font-size: 1.02rem;
  }
  @media (max-width: 560px) {
    .pager {
      grid-template-columns: 1fr;
    }
    .next {
      grid-column: 1;
    }
  }
</style>
