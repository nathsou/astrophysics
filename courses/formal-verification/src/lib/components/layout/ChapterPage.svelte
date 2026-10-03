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
  const eyebrow = $derived(
    entry.kind === 'appendix'
      ? `Appendix ${entry.number}`
      : entry.kind === 'part'
        ? 'How we got here'
        : `Chapter ${entry.number}${part ? (part.id === '0' || part.id === 'E' ? ` · ${part.title}` : ` · Part ${part.id} — ${part.title}`) : ''}${entry.optional ? ' · ◇ optional' : ''}`,
  );
  // The header's seal: the chapter's number in the middle, the part around the rim.
  const sealNumber = $derived(entry.kind === 'chapter' ? entry.number : entry.kind === 'part' ? entry.number : entry.number);
  const sealRim = $derived(
    (entry.kind === 'appendix' ? 'APPENDIX · REFERENCE · FOR ALL INPUTS · ' : part ? (part.id === '0' ? 'PROLOGUE · FOR ALL INPUTS · ' : part.id === 'E' ? 'EPILOGUE · FOR ALL INPUTS · ' : `PART ${part.id} · ${part.title.toUpperCase()} · `) : 'FOR ALL INPUTS · ').repeat(3),
  );
  const RAYS = Array.from({ length: 48 }, (_, i) => i);
  const sealTitle = $derived(entry.kind === 'chapter' ? `${entry.number}. ${meta.title}` : meta.title);
  const prereqs = $derived((meta.prerequisites ?? []).map((s) => findEntry('chapter', s) ?? findEntry('appendix', s)).filter((e) => e !== undefined));

  $effect(() => {
    nav.toc = mod.toc;
    nav.pageTitle = entry.kind === 'chapter' ? `${entry.number}. ${meta.title}` : meta.title;
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
  <title>{sealTitle} — {COURSE_TITLE}</title>
  <meta name="description" content={meta.summary} />
</svelte:head>

<article class="article">
  <header class="chapter-head wide">
    <svg class="seal" viewBox="0 0 160 160" aria-hidden="true">
      <defs><path id="rim-{entry.slug}" d="M80 80m-63 0a63 63 0 1 1 126 0a63 63 0 1 1-126 0" /></defs>
      {#each RAYS as i (i)}<path class="ray" d="M80 6L80 13" transform="rotate({i * 7.5} 80 80)" />{/each}
      <circle class="r1" cx="80" cy="80" r="72" />
      <circle class="r2" cx="80" cy="80" r="54" />
      <circle class="r3" cx="80" cy="80" r="50" />
      <text class="rim"><textPath href="#rim-{entry.slug}" textLength="390">{sealRim.slice(0, 44)}</textPath></text>
      <text class="num" x="80" y="92" text-anchor="middle">{sealNumber}</text>
      <path class="tick" d="M64 104l8 7 18-17" />
    </svg>
    <div class="head-text">
    <p class="eyebrow">{eyebrow}</p>
    <h1>{meta.title}</h1>
    <p class="summary">{meta.summary}</p>
    <div class="meta ui">
      {#if entry.kind === 'part'}<span><Icon name="timeline" size={14} /> An essay on how this part’s ideas and tools developed</span>{/if}
      {#if meta.duration}<span><Icon name="history" size={14} /> {meta.duration}</span>{/if}
      {#if prereqs.length}
        <span class="assumes">Assumes:
          {#each prereqs as p, i (p.slug)}{#if i}{', '}{/if}{#if p.available}<a href="{base}{p.href}">{p.number}. {p.title}</a>{:else}<span title="Coming soon">{p.number}. {p.title}</span>{/if}{/each}
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
    grid-template-columns: minmax(0, 1fr) 10.5rem;
    gap: 2rem;
    align-items: start;
    padding: 3.5rem 0 2.1rem;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid var(--line);
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
    letter-spacing: 0.1em;
    font-weight: 500;
    color: var(--track-ink);
  }
  h1 {
    font-family: var(--font-display);
    font-size: clamp(2.15rem, 5.4vw, 3.2rem);
    line-height: 1.04;
    letter-spacing: -0.032em;
    font-weight: 600;
    margin: 0 0 1rem;
    overflow-wrap: break-word;
    text-wrap: balance;
  }
  .summary {
    font-size: 1.28rem;
    line-height: 1.5;
    color: var(--ink-2);
    margin: 0 0 1.3rem;
    text-wrap: pretty;
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
  /* The prerequisites are running text, not a row of flex items: they wrap at the commas (and inside a long title) instead
     of pushing the page wider than a phone. */
  .meta .assumes {
    display: block;
    min-width: 0;
    max-width: 100%;
    overflow-wrap: anywhere;
  }
  .meta .assumes span {
    display: inline;
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
    letter-spacing: 0.1em;
    color: var(--mute);
    margin-right: 0.3rem;
    min-width: 5.5rem;
  }
  .chip {
    padding: 0.1rem 0.6rem;
    border-radius: 99px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--fg);
    font-weight: 500;
  }
  .chip.thm {
    border-color: color-mix(in srgb, var(--sig-high) 50%, var(--line));
    background: color-mix(in srgb, var(--sig-high) 12%, var(--panel));
  }

  /* The seal. */
  .seal {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
    width: 9.5rem;
    height: auto;
    margin-top: 0.4rem;
    transform: rotate(-8deg);
  }
  .seal .ray {
    stroke: var(--gold);
    stroke-width: 1.4;
  }
  .seal circle {
    fill: none;
    stroke: var(--gold);
  }
  .seal .r1 {
    stroke-width: 1.5;
    fill: var(--gold-soft);
  }
  .seal .r2 {
    stroke-width: 0.8;
  }
  .seal .r3 {
    stroke-width: 0.6;
    stroke-dasharray: 2 2;
  }
  .seal .rim {
    font-family: var(--font-mono);
    font-size: 8.6px;
    letter-spacing: 0.08em;
    fill: var(--gold);
  }
  .seal .num {
    font-family: var(--font-display);
    font-size: 40px;
    font-weight: 600;
    fill: var(--fg);
  }
  .seal .tick {
    fill: none;
    stroke: var(--seal);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  @media (max-width: 720px) {
    .chapter-head {
      grid-template-columns: minmax(0, 1fr);
    }
    .seal {
      display: none;
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
    gap: 1rem;
    margin-top: 4rem;
  }
  .pager a {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.9rem 1.1rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--panel);
    text-decoration: none;
    color: var(--fg);
    box-shadow: var(--shadow);
    transition: border-color 120ms, transform 120ms;
  }
  .pager a:hover {
    border-color: var(--track);
  }
  .pager a:hover .t {
    color: var(--track-ink);
  }
  .next {
    text-align: right;
    grid-column: 2;
  }
  .dir {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--mute);
  }
  .t {
    font-weight: 600;
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
