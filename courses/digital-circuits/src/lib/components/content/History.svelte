<!--
  A history card that flips.
    :::history{year=1937 title="Shannon’s thesis" people="Claude Shannon" image="/history/shannon.png"
               source="Figure: US Patent 2,…, public domain" run="Run Shannon’s circuit"}
    First paragraph: the one-line hook, shown on the front.

    The rest of the story, shown on the back.
    :::
  The story is rendered twice (the front shows only its first block, the back everything after it), so the
  card works without JavaScript measurements and each face is complete for assistive technology; the face
  that is turned away is `inert`. With reduced motion the faces crossfade instead of turning.
  "Run the original" dispatches a bubbling `run-original` CustomEvent with { title, year } for the bench.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { base } from '$app/paths';
  import Icon from '../ui/Icon.svelte';

  let {
    year,
    title,
    people,
    image,
    imageAlt,
    source,
    run,
    children,
  }: {
    year?: number | string;
    title?: string;
    people?: string;
    /** Image URL; paths starting with "/" are resolved against the site base (files in static/). */
    image?: string;
    imageAlt?: string;
    /** Credit line for the image and the story's source. */
    source?: string;
    /** Label of the "Run the original" button; omitted → no button. `run` alone → default label. */
    run?: string | boolean;
    children?: Snippet;
  } = $props();

  const id = $props.id();
  let flipped = $state(false);
  let hasBack = $state(true);
  let root = $state<HTMLElement | undefined>();
  let frontEl = $state<HTMLElement | undefined>();
  let backEl = $state<HTMLElement | undefined>();
  let hFront = $state(0);
  let hBack = $state(0);

  const src = $derived(image ? (image.startsWith('/') && !image.startsWith('//') ? `${base}${image}` : image) : undefined);
  const runLabel = $derived(run === true ? 'Run the original' : run || undefined);
  const measured = $derived(hFront > 0 && hBack > 0);

  $effect(() => {
    if (!frontEl || !backEl) return;
    // The back holds everything after the first block; a one-paragraph story does not flip.
    const story = backEl.querySelector('.story');
    hasBack = !!story && [...story.children].slice(1).some((c) => c.textContent?.trim());
    const ro = new ResizeObserver(() => {
      hFront = frontEl!.offsetHeight;
      hBack = backEl!.offsetHeight;
    });
    ro.observe(frontEl);
    ro.observe(backEl);
    return () => ro.disconnect();
  });

  function flip(to: boolean) {
    flipped = to;
    // The button that was pressed is now on the inert face: move focus to the other face.
    requestAnimationFrame(() => root?.querySelector<HTMLElement>(to ? '.back .face-title' : '.front .face-title')?.focus({ preventScroll: true }));
  }

  function runOriginal(e: MouseEvent) {
    (e.currentTarget as HTMLElement).dispatchEvent(new CustomEvent('run-original', { bubbles: true, detail: { title, year } }));
  }
</script>

<section bind:this={root} class="history" class:flipped class:measured aria-label={title ? `History: ${title}` : 'History'} style:height={measured ? `${flipped ? hBack : hFront}px` : undefined}>
  <div class="card">
    <div class="face front" inert={flipped}>
      <div class="face-inner" bind:this={frontEl}>
        <div class="top ui">
          <span class="tag"><Icon name="history" size={13} /> History</span>
          {#if year}<span class="year">{year}</span>{/if}
        </div>
        <div class="front-grid" class:with-image={!!src}>
          <div class="front-text">
            {#if title}<h4 class="face-title" tabindex="-1" id="{id}-t">{title}</h4>{/if}
            {#if people}<p class="people ui">{people}</p>{/if}
            <div class="hook">{@render children?.()}</div>
          </div>
          {#if src}
            <figure class="plate">
              <img {src} alt={imageAlt ?? ''} loading="lazy" />
            </figure>
          {/if}
        </div>
        <div class="actions ui">
          {#if hasBack}
            <button class="flip-btn" onclick={() => flip(true)} aria-describedby={title ? `${id}-t` : undefined}>
              <Icon name="flip" size={15} /> Read the story
            </button>
          {/if}
          {#if runLabel}
            <button class="run" onclick={runOriginal}><Icon name="play" size={13} /> {runLabel}</button>
          {/if}
          {#if source && !hasBack}<span class="source">{source}</span>{/if}
        </div>
      </div>
    </div>

    <div class="face back" inert={!flipped}>
      <div class="face-inner" bind:this={backEl}>
        <div class="top ui">
          <span class="tag"><Icon name="history" size={13} /> History{#if year}&ensp;·&ensp;{year}{/if}</span>
        </div>
        {#if title}<h4 class="face-title small" tabindex="-1">{title}</h4>{/if}
        <div class="story">{@render children?.()}</div>
        {#if source}<p class="source ui">{source}</p>{/if}
        <div class="actions ui">
          <button class="flip-btn" onclick={() => flip(false)}><Icon name="flip" size={15} /> Back to the card</button>
          {#if runLabel}
            <button class="run" onclick={runOriginal}><Icon name="play" size={13} /> {runLabel}</button>
          {/if}
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .history {
    --paper: light-dark(#fbf6ea, #141c28);
    position: relative;
    margin: 2.5rem 0;
    perspective: 1600px;
    transition: height 450ms cubic-bezier(0.3, 0.7, 0.2, 1);
  }
  .card {
    position: relative;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 650ms cubic-bezier(0.3, 0.7, 0.2, 1);
  }
  .flipped .card {
    transform: rotateY(180deg);
  }
  .face {
    border-radius: var(--radius);
    background: var(--paper);
    border: 1px solid color-mix(in srgb, var(--c-history) 28%, var(--line));
    box-shadow: var(--shadow-lg);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    overflow: hidden;
  }
  /* A double rule inside the edge, like an archive index card. */
  .face::after {
    content: '';
    position: absolute;
    inset: 5px;
    border: 1px solid color-mix(in srgb, var(--c-history) 16%, transparent);
    border-radius: calc(var(--radius) - 3px);
    pointer-events: none;
  }
  .front {
    position: relative;
  }
  .back {
    position: absolute;
    inset: 0 0 auto 0;
    transform: rotateY(180deg);
  }
  .measured .face {
    position: absolute;
    inset: 0;
  }
  .face-inner {
    padding: 1rem 1.35rem 1.1rem;
  }
  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 0.55rem;
    margin-bottom: 0.8rem;
    border-bottom: 1px dashed color-mix(in srgb, var(--c-history) 30%, var(--line));
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
    color: var(--c-history);
  }
  .year {
    font-family: var(--font-display);
    font-size: 2.3rem;
    font-weight: 500;
    letter-spacing: -0.04em;
    line-height: 0.9;
    color: var(--c-history);
    font-variant-numeric: tabular-nums;
  }
  .front-grid.with-image {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(7rem, 38%);
    gap: 1.25rem;
    align-items: start;
  }
  .face-title {
    margin: 0 0 0.15rem !important;
    font-family: var(--font-display);
    font-size: 1.3rem !important;
    font-weight: 600;
    letter-spacing: -0.015em;
    line-height: 1.2;
    color: var(--fg);
  }
  .face-title:focus {
    outline: none;
  }
  .face-title.small {
    font-size: 1.1rem !important;
    margin-bottom: 0.5rem !important;
  }
  .people {
    margin: 0 0 0.65rem !important;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  /* Front: the hook is the story's first block; the back shows the rest. */
  .hook :global(> :not(:first-child)) {
    display: none;
  }
  .hook :global(> :first-child) {
    margin: 0 0 0.9rem;
    font-size: 1.08rem;
    font-style: italic;
    color: var(--fg);
  }
  .story :global(> :first-child) {
    display: none;
  }
  .story {
    font-size: 1rem;
  }
  .story :global(p) {
    margin: 0 0 0.8rem;
  }
  .plate {
    margin: 0;
    padding: 6px;
    background: light-dark(#fffdf8, #e9e4d8);
    border: 1px solid var(--line);
    border-radius: 3px;
    transform: rotate(0.8deg);
    box-shadow: var(--shadow);
  }
  .plate img {
    display: block;
    width: 100%;
    height: auto;
    filter: light-dark(none, contrast(1.05));
  }
  .source {
    margin: 0.3rem 0 0.8rem !important;
    font-size: 0.76rem;
    color: var(--mute);
    line-height: 1.45;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.6rem;
  }
  .actions .source {
    margin: 0 !important;
  }
  .actions button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.32rem 0.8rem;
    border-radius: 99px;
    font-size: 0.84rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 120ms, border-color 120ms, color 120ms;
  }
  .flip-btn {
    border: 1px solid color-mix(in srgb, var(--c-history) 45%, var(--line));
    background: transparent;
    color: var(--c-history);
  }
  .flip-btn:hover {
    background: color-mix(in srgb, var(--c-history) 10%, transparent);
  }
  .run {
    border: 1px solid var(--fg);
    background: var(--fg);
    color: var(--bg);
  }
  .run:hover {
    background: var(--copper);
    border-color: var(--copper);
    color: var(--on-accent);
  }
  @media (max-width: 560px) {
    .face-inner {
      padding: 0.9rem 1rem 1rem;
    }
    .front-grid.with-image {
      grid-template-columns: minmax(0, 1fr);
    }
    .plate {
      max-width: 16rem;
    }
    .year {
      font-size: 1.9rem;
    }
  }

  /* Reduced motion: crossfade in place of the turn. */
  @media (prefers-reduced-motion: reduce) {
    .card,
    .flipped .card {
      transform: none;
      transition: none;
    }
    .face {
      transition: opacity 220ms, visibility 220ms !important;
      backface-visibility: visible;
    }
    .back {
      transform: none;
      opacity: 0;
      visibility: hidden;
    }
    .flipped .back {
      opacity: 1;
      visibility: visible;
    }
    .flipped .front {
      opacity: 0;
      visibility: hidden;
    }
  }
</style>
