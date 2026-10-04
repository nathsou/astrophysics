<!--
  The course timeline: one lane per family of techniques, from Boole to today.

  An overview strip (years across, lanes down; one dot per event) sits above a filterable list. Clicking a dot
  or pressing Enter on it scrolls the list to that event. The list is the accessible view: every event is
  there in order with its lane, people, text, citation and chapter link. `::timeline{part="II"}` embeds the
  slice for one part (the lanes of that part, all years).
-->
<script lang="ts">
  import { base } from '$app/paths';
  import { findEntry } from '$lib/content/registry';
  import { LANES, LANE_LABELS, LANE_PARTS, type Lane, type TimelineEvent } from './types';

  let { items, part, lane: initialLane }: { items: TimelineEvent[]; part?: string; lane?: Lane } = $props();

  const inPart = (e: TimelineEvent) => !part || (e.parts ?? LANE_PARTS[e.lane] ?? []).includes(part);
  const scoped = $derived(items.filter(inPart).sort((a, b) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0)));
  const lanes = $derived(LANES.filter((l) => scoped.some((e) => e.lane === l)));

  // svelte-ignore state_referenced_locally
  let active: Lane | 'all' = $state(initialLane ?? 'all');
  let q = $state('');
  let focusIndex = $state(-1);
  const shown = $derived(
    scoped.filter((e) => (active === 'all' || e.lane === active) && (!q || `${e.year} ${e.title} ${e.people ?? ''} ${e.text}`.toLowerCase().includes(q.toLowerCase()))),
  );

  const minYear = $derived(Math.min(...scoped.map((e) => e.year), 1840));
  const maxYear = $derived(Math.max(...scoped.map((e) => e.year), 2026));
  const W = 1000;
  const ROW = 16;
  const PAD = 190;
  /** Most of the field's history is after 1940: the years before it get a compressed tenth of the width. */
  const BREAK = 1940;
  const x = (y: number) => {
    const span = W - PAD - 12;
    if (minYear >= BREAK) return PAD + ((y - minYear) / Math.max(1, maxYear - minYear)) * span;
    if (y < BREAK) return PAD + ((y - minYear) / (BREAK - minYear)) * span * 0.1;
    return PAD + span * 0.1 + ((y - BREAK) / Math.max(1, maxYear - BREAK)) * span * 0.9;
  };
  const decades = $derived([...(minYear < BREAK ? [minYear] : []), ...Array.from({ length: Math.floor(maxYear / 10) - Math.ceil(Math.max(minYear, BREAK) / 10) + 1 }, (_, i) => (Math.ceil(Math.max(minYear, BREAK) / 10) + i) * 10)]);

  let listEl: HTMLOListElement | undefined = $state();
  function jump(e: TimelineEvent) {
    active = 'all';
    q = '';
    queueMicrotask(() => {
      const i = shown.indexOf(e);
      focusIndex = i;
      const li = listEl?.querySelectorAll('li')[i] as HTMLElement | undefined;
      li?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      li?.focus({ preventScroll: true });
    });
  }
  const laneIndex = (l: Lane) => lanes.indexOf(l);
</script>

<div class="timeline wide ui">
  <svg class="strip" viewBox="0 0 {W} {lanes.length * ROW + 26}" role="group" aria-label="Overview: {scoped.length} events by lane and year">
    {#each decades as d (d)}
      <line class="tick" x1={x(d)} x2={x(d)} y1="0" y2={lanes.length * ROW} />
      {#if d % 20 === 0 || d === minYear}<text class="yr" x={x(d)} y={lanes.length * ROW + 16} text-anchor="middle">{d}</text>{/if}
    {/each}
    {#if minYear < BREAK}<text class="yr" x={x(BREAK) - 6} y={lanes.length * ROW + 16} text-anchor="middle">≈</text>{/if}
    {#each lanes as l, i (l)}
      <text class="lane-name" x={PAD - 8} y={i * ROW + ROW / 2 + 4} text-anchor="end">{LANE_LABELS[l]}</text>
      <line class="lane" x1={PAD} x2={W - 12} y1={i * ROW + ROW / 2} y2={i * ROW + ROW / 2} />
    {/each}
    {#each scoped as e, i (i)}
      <circle
        class="ev lane-{e.lane}"
        cx={x(e.year)}
        cy={laneIndex(e.lane) * ROW + ROW / 2}
        r="4.5"
        tabindex="0"
        role="button"
        aria-label="{e.year}: {e.title}"
        onclick={() => jump(e)}
        onkeydown={(k) => (k.key === 'Enter' || k.key === ' ') && (k.preventDefault(), jump(e))}
      ><title>{e.year}: {e.title}</title></circle>
    {/each}
  </svg>

  <div class="controls">
    <div class="lanes" role="group" aria-label="Filter by lane">
      <button type="button" aria-pressed={active === 'all'} onclick={() => (active = 'all')}>All</button>
      {#each lanes as l (l)}
        <button type="button" class="lane-{l}" aria-pressed={active === l} onclick={() => (active = l)}><i aria-hidden="true"></i>{LANE_LABELS[l]}</button>
      {/each}
    </div>
    <input class="search" type="search" placeholder="Search {scoped.length} events…" bind:value={q} aria-label="Search the timeline" />
  </div>

  <ol bind:this={listEl} aria-live="polite">
    {#each shown as e, i (i)}
      {@const ch = e.chapter ? (findEntry('chapter', e.chapter) ?? findEntry('part', e.chapter) ?? findEntry('appendix', e.chapter)) : undefined}
      <li tabindex="-1" class:focused={i === focusIndex} class="lane-{e.lane}">
        <span class="year num">{e.year}</span>
        <span class="dot" aria-hidden="true"></span>
        <div class="body">
          <div class="title">
            {e.title}
            {#if ch}{#if ch.available}<a class="where" href="{base}{ch.href}">{ch.kind === 'chapter' ? `Ch. ${ch.number}` : ch.kind === 'part' ? `Part ${ch.number}` : `App. ${ch.number}`}</a>{:else}<span class="where">{ch.kind === 'chapter' ? `Ch. ${ch.number}` : ch.title}</span>{/if}{/if}
          </div>
          <div class="sub"><span class="lane-tag">{LANE_LABELS[e.lane]}</span>{#if e.people} · {e.people}{/if}</div>
          <div class="text">{@html e.text}</div>
        </div>
      </li>
    {:else}
      <li class="empty">No events match.</li>
    {/each}
  </ol>
</div>

<style>
  .timeline {
    margin: 1.6rem 0;
    --l-logic: var(--series-8);
    --l-model-checking: var(--series-1);
    --l-sat: var(--series-6);
    --l-smt: var(--series-2);
    --l-deductive: var(--series-3);
    --l-heap: var(--series-4);
    --l-abstract-interpretation: var(--series-5);
    --l-industry: var(--ink-2);
    --l-disasters: var(--pencil);
  }
  .lane-logic { --c: var(--l-logic); }
  .lane-model-checking { --c: var(--l-model-checking); }
  .lane-sat { --c: var(--l-sat); }
  .lane-smt { --c: var(--l-smt); }
  .lane-deductive { --c: var(--l-deductive); }
  .lane-heap { --c: var(--l-heap); }
  .lane-abstract-interpretation { --c: var(--l-abstract-interpretation); }
  .lane-industry { --c: var(--l-industry); }
  .lane-disasters { --c: var(--l-disasters); }

  .strip {
    width: 100%;
    height: auto;
    display: block;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--panel);
    padding: 0.5rem 0.25rem 0.1rem;
  }
  .tick {
    stroke: var(--line);
  }
  .lane {
    stroke: var(--line);
    stroke-dasharray: 2 3;
  }
  .yr,
  .lane-name {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--mute);
  }
  .ev {
    fill: var(--c);
    stroke: var(--panel);
    stroke-width: 1.5;
    cursor: pointer;
  }
  .ev:hover,
  .ev:focus-visible {
    r: 7;
    outline: none;
    stroke: var(--fg);
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
    justify-content: space-between;
    margin: 0.8rem 0;
  }
  .lanes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .lanes button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--panel);
    font-size: 0.8rem;
    cursor: pointer;
  }
  .lanes button i {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: var(--c);
  }
  .lanes button[aria-pressed='true'] {
    border-color: var(--fg);
    background: var(--pn);
    font-weight: 600;
  }
  .search {
    font: inherit;
    font-size: 0.86rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--panel);
    color: var(--fg);
    min-width: 12rem;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    position: relative;
    max-height: 38rem;
    overflow-y: auto;
  }
  li {
    display: grid;
    grid-template-columns: 3.4rem 1rem minmax(0, 1fr);
    gap: 0 0.5rem;
    padding: 0.55rem 0.4rem;
    border-bottom: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  li.focused {
    background: var(--gold-soft);
  }
  .year {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 0.9rem;
    text-align: right;
  }
  .dot {
    width: 0.6rem;
    height: 0.6rem;
    margin-top: 0.45rem;
    border-radius: 50%;
    background: var(--c);
  }
  .title {
    font-weight: 600;
    font-size: 0.95rem;
  }
  .where {
    margin-left: 0.4rem;
    font-size: 0.78rem;
    font-weight: 500;
  }
  .sub {
    font-size: 0.78rem;
    color: var(--mute);
  }
  .text {
    font-family: var(--font-body);
    font-size: 0.98rem;
    color: var(--ink-2);
    margin-top: 0.15rem;
  }
  .text :global(p) {
    margin: 0;
  }
  .empty {
    display: block;
    color: var(--mute);
  }

</style>
