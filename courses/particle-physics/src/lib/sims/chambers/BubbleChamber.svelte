<!--
  A liquid-hydrogen bubble chamber in a magnetic field, with events re-simulated from hep/chamber.

    ::bubble-chamber{n="12.4" preset="omega" caption="…"}

  Props: preset (omega | v0 | pair), seed, field (tesla), showNeutrals (draw the neutral particles' paths, dashed),
  forceCanvas. Bubbles are drawn along the tracks with a density that follows dE/dx; a neutral particle leaves no track,
  so a V can start in empty liquid. The Ω⁻ event is a simulation of the topology of the 1964 Brookhaven event
  (Barnes et al., Phys. Rev. Lett. 12, 204 (1964)), not the photograph.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { rng as makeRng } from '$lib/hep/random';
  import { MATERIALS, makePicture, mipLoss, type Picture, type Track } from '$lib/hep/chamber';
  import { particle } from '$lib/hep/particles';
  import { DropletField, dropletsForTrack, FOREVER } from './droplets';
  import ChamberView from './ChamberView.svelte';
  import TrackPanel from './TrackPanel.svelte';
  import { selectionInfo } from './info';
  import type { Measurement, ToolName } from './tools';

  let {
    n,
    caption,
    title,
    preset: preset0 = 'omega',
    seed: seed0 = 1,
    field: field0 = 2,
    showNeutrals: neutrals0 = false,
    forceCanvas = false,
  }: { n?: string | number; caption?: string; title?: string; preset?: string; seed?: number; field?: number; showNeutrals?: boolean; forceCanvas?: boolean } = $props();

  const MIP = (mipLoss(MATERIALS.hydrogen, true) * MATERIALS.hydrogen.density) / 10;
  let preset = $state<string>(['omega', 'v0', 'pair'].includes(preset0) ? preset0 : 'omega');
  let seed = $state(seed0);
  let B = $state(field0);
  let showNeutrals = $state(neutrals0);
  let tool = $state<ToolName>('none');
  let measurements = $state<Measurement[]>([]);
  let selected = $state<number | null>(null);
  let backend = $state('');
  let busy = $state(true);
  let growing = $state(true);
  let pic = $state.raw<Picture | null>(null);
  let tracks = $state.raw<Track[]>([]);
  const droplets = new DropletField();
  let t0 = 0;
  let clockNow = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let growTimer: ReturnType<typeof setTimeout> | undefined;

  const visible = $derived(tracks.filter((t) => !t.neutral));
  const selTrack = $derived(selected !== null ? (tracks.find((t) => t.id === selected) ?? null) : null);
  const selInfo = $derived(selTrack && pic ? selectionInfo(selTrack, pic.bField, pic.medium, 'bubble') : null);

  function build() {
    const p = makePicture(preset, seed, { bField: B });
    const rng = makeRng(seed * 31 + 5);
    droplets.clear();
    const kept: Track[] = [];
    for (const t of p.set.tracks) {
      if (t.neutral) {
        kept.push(t);
        continue;
      }
      if (!t.points.some((q) => q.visible)) continue;
      kept.push(t);
      droplets.append(dropletsForTrack(t, rng, { kind: 'bubble', birth: 0.05 + rng() * 0.15, life: FOREVER, mip: MIP, id: t.id }));
    }
    pic = p;
    tracks = kept;
    selected = null;
    measurements = [];
    t0 = performance.now();
    growing = true;
    clearTimeout(growTimer);
    growTimer = setTimeout(() => (growing = false), 900);
    busy = false;
  }

  // Re-simulate when the event or the field changes (debounced: the Ω⁻ event takes a fraction of a second).
  let first = true;
  $effect(() => {
    void [preset, seed, B];
    if (first) {
      first = false;
      return;
    }
    busy = true;
    clearTimeout(timer);
    timer = setTimeout(build, 140);
  });

  onMount(() => {
    const id = setTimeout(build, 30);
    const tick = setInterval(() => (clockNow = (performance.now() - t0) / 1000), 33);
    return () => {
      clearTimeout(id);
      clearTimeout(timer);
      clearTimeout(growTimer);
      clearInterval(tick);
    };
  });

  const PRESETS = [
    { value: 'omega', label: 'Ω⁻ event', title: 'K⁻ p → Ω⁻ K⁺ K⁰, re-simulated' },
    { value: 'v0', label: 'Two V⁰s', title: 'π⁻ p → Λ K⁰: two neutral particles that decay to a V each' },
    { value: 'pair', label: 'e⁺e⁻ pairs', title: 'Photons turning into electron–positron pairs' },
  ];
  const listed = $derived(visible.filter((t) => t.origin !== 'delta ray').slice(0, 16));
  const describe = (t: Track) => {
    const v = t.points.filter((p) => p.visible);
    const a = v[0]!;
    const b = v[v.length - 1]!;
    return `${(b.s - a.s).toFixed(0)} mm, from (${a.x.toFixed(0)}, ${a.y.toFixed(0)}) to (${b.x.toFixed(0)}, ${b.y.toFixed(0)}) mm`;
  };
  const ariaLabel = $derived(
    `A bubble chamber picture of ${PRESETS.find((p) => p.value === preset)?.label ?? 'an event'}, in a magnetic field of ${B.toFixed(1)} tesla out of the page. ${pic ? `${visible.length} charged tracks.` : ''} Use the track list below for a keyboard alternative to clicking.`,
  );
</script>

<Widget title={title ?? (pic ? pic.title : 'Bubble chamber')} {n} {caption} kind="Simulation" onreset={() => { seed = seed0; B = field0; }}>
  {#snippet controls()}
    <Segmented label="Event" size="sm" bind:value={preset} options={PRESETS} />
    <Slider bind:value={B} min={0} max={3} step={0.1} label="Magnetic field B [T] (illustrative)" format={(v) => v.toFixed(1)} />
    <Toggle bind:checked={showNeutrals} label="Draw the neutral particles (dashed)" />
  {/snippet}

  <div class="wrap">
    <ChamberView
      kind="bubble"
      worldW={800}
      worldH={500}
      field={droplets}
      clock={() => clockNow}
      grow={0.35}
      hold={1e9}
      mist={false}
      animated={growing}
      bField={B}
      medium="liquid hydrogen"
      tracks={tracks}
      {showNeutrals}
      bind:selected
      {tool}
      bind:measurements
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
      {#if measurements.length}<Button size="sm" onclick={() => (measurements = [])}>Clear marks</Button>{/if}
      <Button size="sm" onclick={() => (seed = seed + 1)} title="Simulate the same kind of event again with another random seed">New random seed</Button>
      <span class="seed">seed {seed}{busy ? ' · simulating…' : ''}</span>
      <span class="backend">{backend === 'webgl2' ? 'WebGL2' : backend === 'canvas2d' ? 'Canvas 2D' : ''}</span>
    </div>
    {#if measurements.length}
      <ul class="meas ui" aria-label="Your measurements">
        {#each measurements as m (m.id)}<li>{m.text}</li>{/each}
      </ul>
    {/if}
    {#if pic}<p class="note ui">{pic.note}</p>{/if}

    <TrackPanel info={selInfo} track={selTrack} bField={pic?.bField ?? B} />

    {#if pic}
      <details class="chain ui">
        <summary>Show what happened (spoiler: the neutral particles are named)</summary>
        <ol>
          {#each pic.steps as s, i (i)}<li>{s}</li>{/each}
        </ol>
        {#if pic.id === 'omega'}
          <!-- Figures from memory, to be checked against the paper by the reviewer: 5 GeV/c beam, m = 1686 ± 12 MeV. -->
          <p>
            Barnes and colleagues (Physical Review Letters 12, 204 (1964)) reported a mass of 1686 ± 12 MeV for the Ω⁻ in their event; the current value in the course's particle table is
            {(particle(3334).mass * 1000).toFixed(2)} MeV. This picture is a re-simulation of the event's topology with invented momenta, so it cannot reproduce that measurement.
          </p>
        {/if}
      </details>
      <details class="list ui">
        <summary>Charged tracks ({visible.length}): a list to select from by keyboard</summary>
        <ul>
          {#each listed as t (t.id)}
            <li><button type="button" class:on={selected === t.id} onclick={() => (selected = t.id)}>Track {t.id + 1}: {describe(t)}</button></li>
          {/each}
        </ul>
      </details>
    {/if}
  </div>
</Widget>

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
  .seed,
  .backend {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--mute);
  }
  .backend {
    margin-left: auto;
  }
  .note {
    margin: 0;
    font-size: 0.82rem;
    color: var(--ink-2);
    font-style: italic;
  }
  .meas {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  summary {
    cursor: pointer;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .chain ol {
    margin: 0.5rem 0;
    padding-left: 1.3rem;
    font-family: var(--font-body);
    font-size: 0.95rem;
  }
  .chain p {
    font-family: var(--font-body);
    font-size: 0.95rem;
    margin: 0.4rem 0;
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
</style>
