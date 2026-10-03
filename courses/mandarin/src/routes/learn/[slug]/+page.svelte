<script lang="ts">
  import { untrack } from 'svelte';
  import { base } from '$app/paths';
  import { LESSONS } from '$content/outline';
  import { hasLesson } from '$lib/content/lessons';
  import { nav } from '$lib/state/nav.svelte';
  import { progress } from '$lib/state/progress.svelte';
  import LessonEnd from '$lib/components/layout/LessonEnd.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  let { data } = $props();
  const ref = $derived(data.ref);
  const index = $derived(LESSONS.findIndex((l) => l.slug === ref.slug));
  const prev = $derived(LESSONS.slice(0, index).reverse().find((l) => hasLesson(l.slug)));
  const next = $derived(LESSONS.slice(index + 1).find((l) => hasLesson(l.slug)));

  $effect(() => {
    const toc = data.toc;
    const slug = ref.slug;
    untrack(() => {
      nav.pageTitle = ref.title;
      nav.toc = toc;
      progress.visit(slug);
    });
    const heads = toc.map((t) => document.getElementById(t.id)).filter((x): x is HTMLElement => !!x);
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) nav.activeId = e.target.id;
      },
      { rootMargin: '-10% 0px -75% 0px' },
    );
    heads.forEach((h) => obs.observe(h));
    return () => {
      obs.disconnect();
      nav.toc = [];
      nav.activeId = null;
    };
  });
</script>

<svelte:head>
  <title>{ref.title} · Mandarin, Out Loud</title>
  <meta name="description" content={ref.blurb} />
</svelte:head>

<article class="lesson">
  <header class="head">
    <p class="kicker ui">Lesson {ref.number} · {ref.part.title} <span class="zh-font">{ref.part.zh}</span></p>
    <div class="titles">
      <span class="big zh-font" aria-hidden="true">{ref.zh}</span>
      <h1>{ref.title}</h1>
    </div>
    <p class="blurb">{ref.blurb}</p>
    <p class="meta ui">
      <span><Icon name="flame" size={14} /> About {ref.minutes} minutes</span>
      {#if data.metadata.words.length}<span><Icon name="book" size={14} /> {data.metadata.words.length} new words</span>{/if}
      {#if data.metadata.exercises}<span><Icon name="sparkle" size={14} /> {data.metadata.exercises} activities</span>{/if}
    </p>
    {#if data.metadata.goals?.length}
      <div class="goals">
        <p class="ui gl">By the end you can</p>
        <ul>
          {#each data.metadata.goals as g (g)}<li>{g}</li>{/each}
        </ul>
      </div>
    {/if}
  </header>

  <data.Content />

  <LessonEnd slug={ref.slug} words={data.metadata.words} />

  <nav class="pager ui" aria-label="Lessons">
    {#if prev}<a class="prev" href="{base}/learn/{prev.slug}/"><Icon name="back" size={16} /><span><small>Previous</small>{prev.title}</span></a>{:else}<span></span>{/if}
    {#if next}<a class="next" href="{base}/learn/{next.slug}/"><span><small>Next</small>{next.title}</span><Icon name="arrow" size={16} /></a>{/if}
  </nav>
</article>

<style>
  .lesson {
    padding: 2.2rem clamp(1rem, 4vw, 3.5rem) 4rem;
    max-width: 50rem;
  }
  .kicker {
    margin: 0;
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--accent-ink);
  }
  .titles {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 0.5rem 0 0.4rem;
  }
  .big {
    flex: none;
    font-size: clamp(2.6rem, 7vw, 3.6rem);
    line-height: 1;
    color: var(--accent);
  }
  h1 {
    margin: 0;
    font-size: clamp(1.8rem, 4.5vw, 2.5rem);
  }
  .blurb {
    margin: 0.3rem 0 0.7rem;
    font-size: 1.15rem;
    color: var(--ink-2);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.1rem;
    margin: 0;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .meta span {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .goals {
    margin-top: 1.2rem;
    padding: 0.8rem 1.1rem;
    border-radius: var(--radius);
    background: var(--pn);
  }
  .gl {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .goals ul {
    margin: 0.3rem 0 0;
    padding-left: 1.2rem;
  }
  .pager {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 2.5rem;
  }
  .pager a {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.7rem 1rem;
    border: 1px solid var(--line);
    border-radius: 12px;
    color: var(--fg);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.92rem;
    max-width: 48%;
  }
  .pager a:hover {
    border-color: var(--accent);
  }
  .pager small {
    display: block;
    font-weight: 500;
    font-size: 0.72rem;
    color: var(--mute);
  }
  .next {
    margin-left: auto;
    text-align: right;
  }
</style>
