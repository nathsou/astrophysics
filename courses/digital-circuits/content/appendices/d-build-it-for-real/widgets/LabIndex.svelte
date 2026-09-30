<!--
  Every lab of the course, by part, drawn from labs.json (the :::real blocks of the chapters): the chapter, what is
  built, and the parts list as the chapter gives it. When parts are ticked in the bill of materials, each lab says
  whether they are enough.

    ::lab-index{n="D.1"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import Widget from '$lib/components/ui/Widget.svelte';
  import { findEntry } from '$lib/content/registry';
  import { partItems } from './bom';
  import { owned, loadKit, missingFor } from './kit.svelte';
  import { COURSE_PARTS, LABS, type Lab } from './labs';

  let { n }: { n?: string | number } = $props();

  onMount(loadKit);

  const groups = COURSE_PARTS.map((p) => ({ ...p, labs: LABS.filter((l) => l.part === p.id) }));
  const heading = (id: string) => (id === '0' ? 'Prologue' : id === 'E' ? 'Epilogue' : `Part ${id}`);
  const href = (l: Lab) => {
    const e = findEntry('chapter', l.chapter);
    return e?.available ? `${base}${e.href}#${l.heading}` : undefined;
  };
  const anyTicked = $derived(owned.size > 0);
  const ready = $derived(LABS.filter((l) => missingFor(l, owned).length === 0).length);
  const shown = (m: string[]) => (m.length > 5 ? `${m.slice(0, 5).join(', ')} and ${m.length - 5} more` : m.join(', '));
</script>

<Widget title="The labs" {n} kind="Reference" live={false} caption="One entry for every “Build it for real” box in the chapters, in course order. The parts are the chapter’s own list. Tick what you own in the bill of materials below, and each lab will say whether you can build it.">
  <div class="labs ui">
    <p class="count" aria-live="polite">
      {LABS.length} labs in {new Set(LABS.map((l) => l.chapter)).size} chapters.
      {#if anyTicked}<strong>You have the parts for {ready} of them.</strong>{/if}
    </p>
    {#each groups as g (g.id)}
      <section aria-labelledby="labs-{g.id}">
        <h5 id="labs-{g.id}">{heading(g.id)}{#if heading(g.id) !== g.title} <span class="part">{g.title}</span>{/if}</h5>
        <ol>
          {#each g.labs as l (l.key)}
            {@const link = href(l)}
            {@const missing = missingFor(l, owned)}
            <li>
              <div class="head">
                <span class="ch">Ch {l.number}</span>
                {#if link}<a class="title" href={link}>{l.title}</a>{:else}<span class="title">{l.title}</span>{/if}
                <span class="from">{l.chapterTitle}</span>
                {#if anyTicked}
                  {#if missing.length === 0}
                    <span class="status ok">You have everything</span>
                  {:else}
                    <span class="status">Missing {missing.length}</span>
                  {/if}
                {/if}
              </div>
              <ul class="parts" aria-label="Parts for the lab of Chapter {l.number}">
                {#each partItems(l.parts) as p, i (i)}<li>{p}</li>{/each}
              </ul>
              {#if anyTicked && missing.length}<p class="miss">Missing: {shown(missing)}.</p>{/if}
            </li>
          {/each}
        </ol>
      </section>
    {/each}
  </div>
</Widget>

<style>
  .labs {
    padding: 0.9rem 1.1rem 1.2rem;
    display: grid;
    gap: 0.4rem;
  }
  .count {
    margin: 0 !important;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  .count strong {
    color: var(--ok);
  }
  h5 {
    margin: 1.1rem 0 0.4rem !important;
    padding: 0 0 0.25rem !important;
    border: 0 !important;
    border-bottom: 2px solid var(--copper) !important;
    font-family: var(--font-display) !important;
    font-size: 1rem !important;
  }
  h5::before,
  h5::after {
    display: none !important;
  }
  .part {
    margin-left: 0.4rem;
    font-weight: 400;
    font-size: 0.85rem;
    color: var(--mute);
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
  }
  ol > li {
    margin: 0;
    padding: 0.6rem 0;
    border-bottom: 1px solid var(--line);
    display: grid;
    gap: 0.35rem;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.15rem 0.6rem;
  }
  .ch {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--copper-ink);
    min-width: 3.2rem;
  }
  .title {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--fg);
    text-decoration-color: var(--line-strong);
    text-underline-offset: 3px;
  }
  a.title:hover,
  a.title:focus-visible {
    color: var(--copper-ink);
    text-decoration-color: var(--copper);
  }
  .from {
    font-size: 0.78rem;
    color: var(--mute);
  }
  .status {
    margin-left: auto;
    padding: 0.05rem 0.55rem;
    border: 1px solid var(--maybe);
    border-radius: 999px;
    background: var(--maybe-soft);
    color: var(--maybe);
    font-size: 0.72rem;
    font-weight: 600;
  }
  .status.ok {
    border-color: var(--ok);
    background: var(--ok-soft);
    color: var(--ok);
  }
  .parts {
    list-style: none;
    margin: 0;
    padding: 0 0 0 3.8rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .parts li {
    margin: 0;
    padding: 0.08rem 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--panel);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    line-height: 1.45;
    color: var(--ink-2);
  }
  .miss {
    margin: 0 !important;
    padding-left: 3.8rem;
    font-size: 0.78rem;
    color: var(--maybe);
  }
  @media (max-width: 560px) {
    .parts,
    .miss {
      padding-left: 0;
    }
    .status {
      margin-left: 0;
    }
  }
</style>
