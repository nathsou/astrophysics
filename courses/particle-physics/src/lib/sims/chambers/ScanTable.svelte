<!--
  The scanning table: measure a simulated chamber picture the way a scanner did. A ruler for lengths, a three-point circle
  (curvature → radius → momentum through p = 0.29979·B·R) and an angle tool. After "Compare with the simulation" your
  numbers are shown beside the simulation's true ones, with a tolerance.

    ::scan-table{n="5.4" preset="cloud:alpha,mu-,e+" seed=3 caption="…"}

  Props: preset (a name for hep/chamber's makePicture: cloud-mixed, cloud-alpha, cloud:alpha,mu-,e+, anderson, omega, v0, pair),
  seed, field (tesla, overrides the preset's), plate, labels (draw the A, B, C tags), picture (a ready-made Picture:
  used by the exercises), exercise (hide the comparison: the exercise does the grading). `bind:measurements` and
  `bind:selected` expose the reader's marks.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { makePicture, type Picture, type Track } from '$lib/hep/chamber';
  import { DropletField } from './droplets';
  import { fillFromPicture } from './scene';
  import ChamberView from './ChamberView.svelte';
  import TrackPanel from './TrackPanel.svelte';
  import { selectionInfo } from './info';
  import { compareMeasurement } from './grading';
  import type { Measurement, ToolName } from './tools';

  let {
    n,
    caption,
    title = 'Scanning table',
    preset = 'cloud:alpha,mu-,e+',
    seed: seed0 = 1,
    field = undefined,
    plate = undefined,
    labels: showLabels = true,
    picture = undefined,
    exercise = false,
    measurements = $bindable([]),
    selected = $bindable(null),
    forceCanvas = false,
    embedded = false,
  }: {
    n?: string | number;
    caption?: string;
    title?: string;
    preset?: string;
    seed?: number;
    field?: number;
    plate?: boolean;
    labels?: boolean;
    picture?: Picture;
    exercise?: boolean;
    measurements?: Measurement[];
    selected?: number | null;
    forceCanvas?: boolean;
    /** Draw without the Widget frame (inside an exercise). */
    embedded?: boolean;
  } = $props();

  let seed = $state(untrack(() => seed0));
  let tool = $state<ToolName>('ruler');
  let snap = $state(true);
  let labelsOn = $state(untrack(() => showLabels));
  let backend = $state('');
  let busy = $state(false);
  let built = $state.raw<Picture | null>(null);
  let tracks = $state.raw<Track[]>([]);
  let compared = $state(false);
  const droplets = new DropletField();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const pic = $derived(picture ?? built);
  const selTrack = $derived(selected !== null ? (tracks.find((t) => t.id === selected) ?? null) : null);
  const selInfo = $derived(selTrack && pic ? selectionInfo(selTrack, pic.bField, pic.medium, pic.kind) : null);
  const comparisons = $derived(compared && pic ? measurements.map((m) => ({ m, c: compareMeasurement(m, pic) })) : []);

  function load(p: Picture) {
    tracks = fillFromPicture(p, droplets, 7, 0.02);
    selected = null;
    measurements = [];
    compared = false;
    busy = false;
  }

  function build() {
    const p = makePicture(preset, seed, { bField: field, plate });
    built = p;
    load(p);
  }

  let first = true;
  $effect(() => {
    void [preset, seed, field, plate, picture];
    untrack(() => {
      if (picture) {
        load(picture);
        return;
      }
      if (first) {
        first = false;
        return;
      }
      busy = true;
      clearTimeout(timer);
      timer = setTimeout(build, 60);
    });
  });
  onMount(() => {
    if (!picture) {
      busy = true;
      timer = setTimeout(build, 20);
    }
    return () => clearTimeout(timer);
  });

  const kindLabel = $derived(pic?.kind === 'bubble' ? 'bubble chamber' : 'cloud chamber');
  const describe = (t: Track) => {
    const v = t.points.filter((p) => p.visible);
    if (!v.length) return '';
    const a = v[0]!;
    const b = v[v.length - 1]!;
    return `${(b.s - a.s).toFixed(0)} mm, from (${a.x.toFixed(0)}, ${a.y.toFixed(0)}) to (${b.x.toFixed(0)}, ${b.y.toFixed(0)}) mm`;
  };
  const letterOf = (id: number) => pic?.labels.find((l) => l.trackId === id)?.letter;
  const listed = $derived(tracks.filter((t) => !t.neutral && t.origin !== 'delta ray').slice(0, 20));
  const ariaLabel = $derived(`A simulated ${kindLabel} picture to measure. ${pic ? pic.labels.length + ' labelled tracks.' : ''} Field ${pic ? Math.abs(pic.bField).toFixed(1) : ''} tesla. Use the keyboard crosshair, or the track list below for exact coordinates.`);
</script>

{#snippet body()}
  {#if pic}
    <div class="wrap">
      <ChamberView
        kind={pic.kind}
        worldW={pic.width}
        worldH={pic.height}
        field={droplets}
        clock={() => 10}
        grow={0.3}
        hold={1e9}
        mist={false}
        animated={false}
        bField={pic.bField}
        medium={pic.medium}
        plates={pic.plates.map((p) => ({ y0: p.y0, y1: p.y1 }))}
        source={pic.source}
        {tracks}
        labels={labelsOn ? pic.labels : []}
        bind:selected
        {tool}
        bind:measurements
        {snap}
        zoomable
        fiducials
        {ariaLabel}
        {forceCanvas}
        bind:backend
      />
      <div class="bar ui">
        <Segmented
          label="Tool"
          size="sm"
          bind:value={tool}
          options={[
            { value: 'none', label: 'Select' },
            { value: 'ruler', label: 'Ruler' },
            { value: 'circle', label: 'Circle (3 points)' },
            { value: 'angle', label: 'Angle' },
          ]}
        />
        <Toggle bind:checked={snap} label="Snap to droplets" />
        <Toggle bind:checked={labelsOn} label="Track letters" />
        {#if measurements.length}<Button size="sm" onclick={() => { measurements = []; compared = false; }}>Clear marks</Button>{/if}
        {#if !picture && !exercise}<Button size="sm" onclick={() => (seed = seed + 1)}>New picture</Button>{/if}
        <span class="backend">{busy ? 'simulating… ' : ''}{backend === 'webgl2' ? 'WebGL2' : backend === 'canvas2d' ? 'Canvas 2D' : ''}</span>
      </div>

      <div class="grid">
        <section class="meas ui" aria-label="Your measurements">
          <h5>Your measurements</h5>
          {#if !measurements.length}
            <p class="empty">Nothing yet. Choose a tool and click in the picture.</p>
          {:else}
            <table>
              <thead><tr><th scope="col">#</th><th scope="col">Tool</th><th scope="col">Result</th><th scope="col">Track</th><th scope="col"><span class="sr-only">Remove</span></th></tr></thead>
              <tbody>
                {#each measurements as m, i (m.id)}
                  <tr>
                    <td>{i + 1}</td>
                    <td>{m.tool === 'ruler' ? 'ruler' : m.tool === 'circle' ? 'circle' : 'angle'}</td>
                    <td>{m.text}</td>
                    <td>{m.track !== null && m.track !== undefined ? (letterOf(m.track) ?? `#${m.track + 1}`) : '–'}</td>
                    <td><button type="button" class="x" aria-label="Remove measurement {i + 1}" onclick={() => { measurements = measurements.filter((q) => q.id !== m.id); }}>×</button></td>
                  </tr>
                {/each}
              </tbody>
            </table>
            {#if !exercise}
              <Button size="sm" onclick={() => (compared = !compared)}>{compared ? 'Hide the simulation’s values' : 'Compare with the simulation'}</Button>
            {/if}
          {/if}
          {#if compared && comparisons.length}
            <table class="cmp">
              <thead><tr><th scope="col">#</th><th scope="col">You</th><th scope="col">Simulation</th><th scope="col">Within 10 %?</th></tr></thead>
              <tbody>
                {#each comparisons as { m, c }, i (m.id)}
                  <tr>
                    <td>{measurements.indexOf(m) + 1}</td>
                    {#if c}
                      <td>{c.measured.toFixed(1)} {c.unit}</td>
                      <td>{c.truth.toFixed(1)} {c.unit}<br /><small>{c.what}</small></td>
                      <td>{c.ok ? '✓ yes' : '✗ no'}<br /><small>{c.note}</small></td>
                    {:else}
                      <td colspan="3">not on a track, so there is nothing to compare with</td>
                    {/if}
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </section>
        <TrackPanel info={selInfo} track={selTrack} bField={pic.bField} plates={pic.plates.map((p) => ({ y0: p.y0, y1: p.y1 }))} allowReveal={!exercise} />
      </div>

      <details class="list ui">
        <summary>Tracks in the picture ({listed.length}): select one by keyboard</summary>
        <ul>
          {#each listed as t (t.id)}
            <li><button type="button" class:on={selected === t.id} onclick={() => (selected = t.id)}>{letterOf(t.id) ? `Track ${letterOf(t.id)}` : `Track ${t.id + 1}`}: {describe(t)}</button></li>
          {/each}
        </ul>
      </details>
      <p class="note ui">{pic.note}</p>
    </div>
  {:else}
    <p class="ui">Simulating the picture…</p>
  {/if}
{/snippet}

{#if embedded}
  {@render body()}
{:else}
  <Widget {title} {n} {caption} kind="Measure">
    {@render body()}
  </Widget>
{/if}

<style>
  .wrap {
    display: grid;
    gap: 0.7rem;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
  }
  .backend {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--mute);
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.7rem;
    align-items: start;
  }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .meas {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.6rem 0.8rem;
    background: var(--pn);
    font-size: 0.82rem;
    display: grid;
    gap: 0.5rem;
    align-content: start;
  }
  h5 {
    margin: 0;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--mute);
    font-family: var(--font-mono);
    border: 0;
    padding: 0;
  }
  .empty {
    margin: 0;
    color: var(--ink-2);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
  }
  th {
    text-align: left;
    font-weight: 500;
    color: var(--mute);
    text-transform: none;
    letter-spacing: 0;
    padding: 0.15rem 0.4rem 0.15rem 0;
  }
  td {
    padding: 0.2rem 0.4rem 0.2rem 0;
    border-top: 1px solid var(--line);
    vertical-align: top;
  }
  small {
    color: var(--mute);
  }
  .x {
    border: 0;
    background: transparent;
    color: var(--mute);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
  }
  .x:hover {
    color: var(--bad);
  }
  .note {
    margin: 0;
    font-size: 0.8rem;
    color: var(--ink-2);
    font-style: italic;
  }
  .list summary {
    cursor: pointer;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .list ul {
    list-style: none;
    margin: 0.4rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
  }
  .list button {
    width: 100%;
    text-align: left;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--fg);
    border-radius: 6px;
    padding: 0.25rem 0.6rem;
    font-size: 0.78rem;
    cursor: pointer;
  }
  .list button.on {
    border-color: var(--track);
    background: var(--track-soft);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
