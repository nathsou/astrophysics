<!--
  An event display for a chapter: a figure frame around EventDisplay, with simulated events until the chapter passes real ones.

    ::event-display-widget{sample="zmumu" n="7.1" caption="…"}
    ::event-display-widget{sample="dijet" views="3d,lego" count="6" seed="3"}

  `sample` is one of zmumu, h4e, hgg, dijet, wenu (also written "weν"), pileup, stress. `count` is how many events the reader can
  step through; `seed` is the first seed. From code, pass `events` (or `event`) instead of a sample.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import type { FullEvent } from '../hep/event/index.ts';
  import EventDisplay from './EventDisplay.svelte';
  import { defaultGeometry, type DisplayGeometry } from './geometry.ts';
  import { resolveSampleName, sampleEvents, SAMPLE_LABELS } from './sampleEvents.ts';
  import type { ColourBy } from './glData.ts';

  let {
    sample = 'zmumu',
    n,
    caption,
    title,
    views = '3d,rphi,rz,lego',
    count,
    seed = 1,
    events = undefined,
    event = undefined,
    geometry = defaultGeometry,
    showTruth = false,
    showReco = true,
    showHits = true,
    colourBy = 'particle',
    viewHeight = 340,
  }: {
    sample?: string;
    n?: string | number;
    caption?: string;
    title?: string;
    views?: string | string[];
    count?: number | string;
    seed?: number | string;
    events?: FullEvent[];
    event?: FullEvent;
    geometry?: DisplayGeometry;
    showTruth?: boolean | string;
    showReco?: boolean | string;
    showHits?: boolean | string;
    colourBy?: ColourBy;
    viewHeight?: number | string;
  } = $props();

  const name = $derived(resolveSampleName(sample));
  const seed0 = $derived(Number(seed) || 1);
  const num = $derived(count !== undefined ? Math.max(1, Math.round(Number(count))) : name === 'pileup' ? 3 : name === 'stress' ? 1 : 8);
  const list = $derived(events?.length ? events : event ? [event] : sampleEvents(name, num, seed0, { geometry }));
  const flag = (v: boolean | string): boolean => v === true || v === 'true' || v === '';
  let index = $state(0);
  let selected = $state<string | null>(null);
  let seedState = $state(1);
</script>

<Widget title={title ?? (events || event ? 'Event display' : `Event display: ${SAMPLE_LABELS[name]}`)} {n} {caption} kind={events || event ? 'Event' : 'Simulated event'}>
  <EventDisplay
    events={list}
    {geometry}
    {views}
    showTruth={flag(showTruth)}
    showReco={flag(showReco)}
    showHits={flag(showHits)}
    {colourBy}
    viewHeight={Number(viewHeight) || 340}
    bind:index
    bind:selected
    bind:seed={seedState}
  />
</Widget>
