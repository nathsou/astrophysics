<!--
  Truth and reconstruction side by side, with the selection linked: click a muon on the reconstructed side and the truth
  particle it came from lights up on the other, and the other way round. Hovering is linked too.

    ::truth-reco-compare{sample="h4e" n="7.3" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import type { FullEvent } from '../hep/event/index.ts';
  import { rng } from '../hep/random/index.ts';
  import EventDisplay from './EventDisplay.svelte';
  import { defaultGeometry, type DisplayGeometry } from './geometry.ts';
  import { resolveSampleName, sampleEvents, SAMPLE_LABELS } from './sampleEvents.ts';
  import { parseViews } from './types.ts';
  import Inspector from './Inspector.svelte';
  import ObjectList from './ObjectList.svelte';
  import { buildScene } from './scene.ts';

  let {
    sample = 'zmumu',
    n,
    caption,
    title,
    views = '3d',
    count = 6,
    seed = 1,
    events = undefined,
    geometry = defaultGeometry,
    viewHeight = 340,
  }: {
    sample?: string;
    n?: string | number;
    caption?: string;
    title?: string;
    /** The view shown on each side (one of 3d, rphi, rz, lego). */
    views?: string | string[];
    count?: number | string;
    seed?: number | string;
    events?: FullEvent[];
    geometry?: DisplayGeometry;
    viewHeight?: number | string;
  } = $props();

  const name = $derived(resolveSampleName(sample));
  const list = $derived(events?.length ? events : sampleEvents(name, Math.max(1, Number(count) || 6), Number(seed) || 1, { geometry }));
  const view = $derived(parseViews(views).slice(0, 1));
  let index = $state(0);
  let selected = $state<string | null>(null);
  let hover = $state<string | null>(null);
  let seedState = $state(1);
  const total = $derived(list.length);
  const scene = $derived(buildScene(list[Math.min(index, list.length - 1)]!, geometry));
  const activeKey = $derived(hover ?? selected);
  const activeId = $derived(activeKey === null ? null : (scene.byKey.get(activeKey) ?? null));
  const step = (d: number) => (index = (((index + d) % total) + total) % total);
  const random = () => {
    index = Math.floor(rng(seedState)() * total);
    seedState += 1;
  };
</script>

<Widget title={title ?? `Truth and reconstruction: ${SAMPLE_LABELS[name]}`} {n} {caption} kind="Compare">
  {#if total > 1}
    <div class="bar ui" role="group" aria-label="Choose the event">
      <button type="button" onclick={() => step(-1)} aria-label="Previous event">◀</button>
      <span class="evn" aria-live="polite">event {index + 1} / {total}</span>
      <button type="button" onclick={() => step(1)} aria-label="Next event">▶</button>
      <button type="button" onclick={random}>Random <span class="seed">seed {seedState}</span></button>
    </div>
  {/if}
  <div class="pair">
    <div class="side">
      <h5 class="ui">What happened (truth)</h5>
      <EventDisplay events={list} {geometry} views={view} showTruth showReco={false} showHits={false} showCalo={false} controls={false} inspector={false} objectList={false} legend={false} viewHeight={Number(viewHeight) || 340} {index} bind:selected bind:hover />
    </div>
    <div class="side">
      <h5 class="ui">What the detector saw (reconstruction)</h5>
      <EventDisplay events={list} {geometry} views={view} showTruth={false} showReco showHits showCalo controls={false} inspector={false} objectList={false} legend={false} viewHeight={Number(viewHeight) || 340} {index} bind:selected bind:hover />
    </div>
  </div>
  <div class="foot">
    <Inspector {scene} {activeId} pinned={selected !== null && hover === null} onselect={(id) => (selected = scene.objects[id]!.key)} onpreview={(id) => (hover = id === null ? null : scene.objects[id]!.key)} onclear={() => (selected = null)} />
    <ObjectList {scene} activeKey={selected} onfocusobject={(id) => (hover = id === null ? null : scene.objects[id]!.key)} onselect={(id) => (selected = scene.objects[id]!.key)} />
  </div>
</Widget>

<style>
  .bar {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.6rem;
    flex-wrap: wrap;
  }
  .bar button {
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    border-radius: 6px;
    padding: 0.25rem 0.65rem;
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    min-height: 1.9rem;
  }
  .bar button:hover,
  .bar button:focus-visible {
    border-color: var(--track);
    color: var(--track-ink);
  }
  .evn {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .seed {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--mute);
  }
  .pair {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
    gap: 0.8rem;
  }
  .side {
    min-width: 0;
  }
  h5 {
    margin: 0 0 0.3rem !important;
    padding: 0 !important;
    border: 0 !important;
    font-size: 0.8rem !important;
    font-weight: 600;
    text-transform: none !important;
    letter-spacing: 0 !important;
    color: var(--ink-2);
  }
  h5::before,
  h5::after {
    display: none !important;
  }
  .foot {
    margin-top: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
</style>
