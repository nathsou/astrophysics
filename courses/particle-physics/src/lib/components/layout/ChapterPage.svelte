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
  // The header's DIP package: the chapter is a part on the board, its number printed on the package.
  const chipLabel = $derived(entry.kind === 'appendix' ? `APP-${entry.number}` : `CH-${entry.number.padStart(2, '0')}`);
  const chipSub = $derived(entry.kind === 'appendix' ? 'REFERENCE' : part ? (part.id === '0' ? 'PROLOGUE' : part.id === 'E' ? 'EPILOGUE' : `PART ${part.id}`) : '');
  const PINS = [0, 1, 2, 3, 4, 5, 6];
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
    <svg class="dip" viewBox="0 0 176 116" aria-hidden="true">
      {#each PINS as i (i)}
        <rect class="pin" x={21 + i * 21} y="4" width="9" height="16" rx="1.5" />
        <rect class="pin" x={21 + i * 21} y="96" width="9" height="16" rx="1.5" />
      {/each}
      <rect class="pkg" x="6" y="16" width="164" height="84" rx="5" />
      <path class="notch" d="M6 48a10 10 0 0 1 0 20" />
      <circle class="dot" cx="20" cy="86" r="3.2" />
      <text class="ref" x="92" y="56" text-anchor="middle">{chipLabel}</text>
      <text class="sub" x="92" y="76" text-anchor="middle">{chipSub}</text>
    </svg>
    <div class="head-text">
    <p class="eyebrow">{eyebrow}</p>
    <h1>{meta.title}</h1>
    <p class="summary">{meta.summary}</p>
    <div class="meta ui">
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

  /* The DIP package. */
  .dip {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
    width: 10.5rem;
    height: auto;
    margin-top: 0.6rem;
    overflow: visible;
  }
  .pin {
    fill: light-dark(#c9ccd1, #8a939f);
    stroke: light-dark(#8d939b, #5c6673);
    stroke-width: 1;
  }
  .pkg {
    fill: light-dark(#22272e, #243044);
    stroke: light-dark(#11151a, #4a5b73);
    stroke-width: 1;
    filter: drop-shadow(0 6px 10px light-dark(rgb(40 30 10 / 0.18), rgb(0 0 0 / 0.5)));
  }
  .notch {
    fill: light-dark(#161a1f, #172131);
  }
  .dot {
    fill: light-dark(#161a1f, #172131);
  }
  .dip text {
    font-family: var(--font-mono);
    fill: light-dark(#e9e4da, #c9d2dd);
  }
  .ref {
    font-size: 19px;
    font-weight: 600;
    letter-spacing: 0.06em;
  }
  .sub {
    font-size: 9.5px;
    letter-spacing: 0.24em;
    fill: light-dark(#a9a398, #7f8b9b) !important;
  }
  @media (max-width: 720px) {
    .chapter-head {
      grid-template-columns: minmax(0, 1fr);
      gap: 1.25rem;
      padding-top: 1.75rem;
    }
    .dip {
      grid-column: 1;
      grid-row: 1;
      justify-self: start;
      margin: 0;
      width: 6.5rem;
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
