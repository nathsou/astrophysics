<!--
  A diffusion cloud chamber: droplets condense along the tracks of charged particles, and fade.

    ::cloud-chamber{n="5.1" caption="…" field=0 source="mixed"}
    ::cloud-chamber{n="5.3" preset="anderson" caption="…"}

  Props: field (tesla, 0–2), source (mixed | alpha | beta | muon | shower), plate (lead plate on), rate (arrivals per
  second), seed, scan (scanning tools on), preset ("anderson": 1.5 T, a 6 mm lead plate, cosmic-ray particles, a guided
  reading of the photograph). Tracks come from hep/chamber, so ranges, curvature and ionisation are the physics's.
  Sound (Geiger clicks) is off by default; the choice is remembered in localStorage ('particle-physics:sound').
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { rng as makeRng, exponential, type Rng } from '$lib/hep/random';
  import { MATERIALS, andersonExposure, andersonPicture, cloudArrival, cloudSetup, mipLoss, type Picture, type SourceKind, type Track } from '$lib/hep/chamber';
  import { DropletField, dropletsForTrack, FOREVER } from './droplets';
  import { Geiger, readSoundPreference, writeSoundPreference } from './audio';
  import ChamberView from './ChamberView.svelte';
  import TrackPanel from './TrackPanel.svelte';
  import AndersonPanel from './AndersonPanel.svelte';
  import { selectionInfo } from './info';
  import type { Measurement, ToolName } from './tools';

  let {
    n,
    caption,
    title,
    field: field0 = 0,
    source: source0 = 'mixed',
    plate: plate0 = false,
    rate: rate0 = 1.5,
    seed = 1,
    scan: scan0 = false,
    preset = '',
    forceCanvas = false,
  }: {
    n?: string | number;
    caption?: string;
    title?: string;
    field?: number;
    source?: string;
    plate?: boolean;
    rate?: number;
    seed?: number;
    scan?: boolean;
    preset?: string;
    forceCanvas?: boolean;
  } = $props();

  const anderson = preset === 'anderson';
  const WORLD = anderson ? { w: 220, h: 200 } : { w: 300, h: 190 };
  const LIFE = 2.4; // s: how long a droplet takes to fade
  const HOLD = 0.9; // s: how long it stays fully bright
  const MIP = (mipLoss(MATERIALS.air, true) * MATERIALS.air.density) / 10;

  let B = $state(anderson ? 1.5 : Math.min(2, Math.abs(field0)));
  let dirWord = $state<'out' | 'in'>(field0 >= 0 ? 'out' : 'in');
  const out = $derived(dirWord === 'out');
  let plate = $state(anderson ? true : plate0);
  let src = $state<string>(['alpha', 'beta', 'muon', 'mixed', 'shower'].includes(source0) ? source0 : 'mixed');
  let rate = $state(rate0);
  let sound = $state(false);
  let frozen = $state(false);
  let scanMode = $state(scan0 || anderson);
  let tool = $state<ToolName>(scan0 ? 'ruler' : 'none');
  let measurements = $state<Measurement[]>([]);
  let selected = $state<number | null>(null);
  let backend = $state('');
  let exposure = $state(0);
  let picture = $state.raw<Picture | null>(null);

  const droplets = new DropletField();
  let tracks = $state.raw<Track[]>([]);
  const birth = new Map<number, number>();
  let nextId = 0;
  let simTime = 0;
  let nextArrival = 0.2;
  let arrRng: Rng = makeRng(seed);
  let dropRng: Rng = makeRng(seed + 1);
  let raf = 0;
  let lastTs = 0;
  let cleanupAt = 0;
  let count = $state(0);
  const geiger = new Geiger();
  const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const signedB = $derived(out ? B : -B);
  const persist = $derived(anderson);
  const effectiveRate = $derived(src === 'shower' ? Math.min(rate, 0.8) : rate);
  const plates = $derived(persist ? (picture?.plates ?? []) : plate || src === 'shower' ? cloudSetup({ plate: 6 }).plates : []);
  const plateBands = $derived(plates.map((p) => ({ y0: p.y0, y1: p.y1 })));
  const setup = $derived(cloudSetup({ width: WORLD.w, height: WORLD.h, bField: signedB, plate: plate }));
  const selTrack = $derived(selected !== null ? (tracks.find((t) => t.id === selected) ?? null) : null);
  const selInfo = $derived(selTrack ? selectionInfo(selTrack, persist ? (picture?.bField ?? signedB) : signedB, 'air+alcohol vapour', 'cloud') : null);
  const aBField = $derived(persist ? (picture?.bField ?? 1.5) : signedB);

  function addSet(set: { tracks: Track[] }, atTime: number, life: number) {
    const shift = nextId;
    const add: Track[] = [];
    for (const t of set.tracks) {
      if (t.neutral) continue;
      if (!t.points.some((p) => p.visible)) continue;
      const id = t.id + shift;
      const copy: Track = { ...t, id };
      add.push(copy);
      birth.set(id, atTime);
      droplets.append(dropletsForTrack(copy, dropRng, { kind: 'cloud', birth: atTime, life, mip: MIP, id }));
    }
    nextId += set.tracks.length;
    tracks = [...tracks, ...add];
    count += set.tracks.length ? 1 : 0;
  }

  function arrive() {
    const kind = (src === 'mixed' ? 'mixed' : src) as SourceKind;
    const s = cloudSetup({ width: WORLD.w, height: WORLD.h, bField: signedB, plate });
    const set = cloudArrival(kind, arrRng, s);
    addSet(set, simTime, LIFE);
    if (sound) geiger.click();
  }

  function cleanup() {
    droplets.prune(simTime, HOLD);
    const alive = tracks.filter((t) => simTime < (birth.get(t.id) ?? 0) + HOLD + LIFE);
    if (alive.length !== tracks.length) {
      for (const t of tracks) if (!alive.includes(t)) birth.delete(t.id);
      tracks = alive;
      if (selected !== null && !alive.some((t) => t.id === selected)) selected = null;
    }
  }

  function clearAll() {
    droplets.clear();
    tracks = [];
    birth.clear();
    measurements = [];
    selected = null;
  }

  function tick(ts: number) {
    raf = requestAnimationFrame(tick);
    const dt = lastTs ? Math.min(0.3, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    if (frozen || persist) return;
    simTime += dt;
    let guard = 0;
    while (simTime >= nextArrival && guard++ < 4) {
      arrive();
      nextArrival += exponential(arrRng, 1 / Math.max(0.05, effectiveRate));
    }
    if (nextArrival < simTime) nextArrival = simTime + 0.2;
    if (simTime > cleanupAt) {
      cleanup();
      cleanupAt = simTime + 0.5;
    }
  }

  // ───── the Anderson photograph and further exposures
  function showPicture(p: Picture) {
    clearAll();
    picture = p;
    tracks = p.set.tracks.filter((t) => !t.neutral && t.points.some((q) => q.visible));
    for (const t of tracks) {
      birth.set(t.id, 0);
      droplets.append(dropletsForTrack(t, dropRng, { kind: 'cloud', birth: 0, life: FOREVER, mip: MIP, id: t.id }));
    }
    simTime = 1; // droplets have all grown by the time it is drawn
    nextId = tracks.length;
    // select the labelled track automatically so that the panel has something to measure only when the reader asks: no
    selected = null;
  }
  function nextExposure() {
    exposure++;
    showPicture(andersonExposure(seed * 101 + exposure));
  }

  onMount(() => {
    sound = readSoundPreference();
    if (sound) geiger.enable();
    if (anderson) {
      showPicture(andersonPicture(seed));
    } else {
      // A few tracks already in the chamber when the page loads.
      simTime = 0;
      arrive();
      simTime = 0.6;
      arrive();
      simTime = 0.9;
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      geiger.close();
    };
  });

  function toggleSound(v: boolean) {
    if (v && !geiger.enable()) {
      sound = false;
      return;
    }
    writeSoundPreference(v);
    if (v) geiger.click();
  }

  function unfreeze() {
    frozen = false;
    clearAll();
    nextArrival = simTime + 0.2;
  }

  const listed = $derived(tracks.slice(-14).reverse());
  const describeTrack = (t: Track) => {
    const vis = t.points.filter((p) => p.visible);
    if (!vis.length) return 'track';
    const a = vis[0]!;
    const b = vis[vis.length - 1]!;
    const len = vis.length > 1 ? vis[vis.length - 1]!.s - vis[0]!.s : 0;
    return `${len.toFixed(0)} mm, from (${a.x.toFixed(0)}, ${a.y.toFixed(0)}) to (${b.x.toFixed(0)}, ${b.y.toFixed(0)}) mm`;
  };
  const truthLabel = $derived(picture && selected !== null ? (picture.labels.find((l) => l.trackId === selected) ?? picture.labels[0] ?? null) : (picture?.labels[0] ?? null));
  const ariaLabel = $derived(
    anderson
      ? 'A cloud-chamber picture with a horizontal lead plate across the middle, in a magnetic field of 1.5 tesla. One particle track crosses the plate.'
      : `A cloud chamber with droplet tracks. Magnetic field ${B.toFixed(1)} tesla ${B === 0 ? '' : out ? 'out of the page' : 'into the page'}${plate ? ', with a lead plate across the middle' : ''}. Use the track list below for a keyboard alternative to clicking.`,
  );
</script>

<Widget title={title ?? (anderson ? "Anderson's photograph: which way, and what?" : 'Cloud chamber')} {n} {caption} kind={anderson ? 'Reconstruction' : 'Simulation'} onreset={anderson ? () => showPicture(andersonPicture(seed)) : unfreeze}>
  {#snippet controls()}
    {#if !anderson}
      <Segmented
        label="Source"
        size="sm"
        bind:value={src}
        options={[
          { value: 'mixed', label: 'Background', title: 'Whatever passes through: cosmic muons, electrons, a few alphas' },
          { value: 'alpha', label: 'Alpha' },
          { value: 'beta', label: 'Beta' },
          { value: 'muon', label: 'Cosmic muon' },
          { value: 'shower', label: 'Shower', title: 'An electron of a few hundred MeV entering a stack of lead plates' },
        ]}
      />
      <Slider bind:value={B} min={0} max={2} step={0.05} label="Magnetic field B [T]" format={(v) => v.toFixed(2)} />
      <Segmented
        label="Field direction"
        size="sm"
        bind:value={dirWord}
        options={[
          { value: 'out', label: 'out of page ⊙' },
          { value: 'in', label: 'into page ⊗' },
        ]}
      />
      <Slider bind:value={rate} min={0.1} max={8} step={0.1} log label="Arrival rate [per s]" format={(v) => v.toFixed(1)} />
      <Toggle bind:checked={plate} label="6 mm lead plate" />
    {:else}
      <span class="note ui">Field 1.5 T (15 kG) out of the page; lead plate 6 mm: as reported by Anderson.</span>
    {/if}
    <Toggle bind:checked={sound} label={sound ? 'Geiger clicks: on' : 'Geiger clicks: off'} onchange={toggleSound} />
  {/snippet}

  <div class="wrap">
    <ChamberView
      kind="cloud"
      worldW={WORLD.w}
      worldH={WORLD.h}
      field={droplets}
      clock={() => simTime}
      grow={0.14}
      gain={1.5}
      hold={frozen || persist ? 1e9 : HOLD}
      drift={reducedMotion || frozen || persist ? 0 : 0.7}
      mist={!reducedMotion}
      animated={!frozen && !persist}
      bField={aBField}
      plates={plateBands}
      source={persist ? undefined : setup.source}
      {tracks}
      eligible={(t) => frozen || persist || simTime < (birth.get(t.id) ?? 0) + HOLD + LIFE * 0.85}
      labels={[]}
      bind:selected
      {tool}
      bind:measurements
      zoomable
      {ariaLabel}
      {forceCanvas}
      bind:backend
    />

    <div class="bar ui">
      {#if !anderson}
        <Button size="sm" onclick={() => (frozen = !frozen)} aria-pressed={frozen}>{frozen ? 'Resume' : 'Freeze the picture'}</Button>
        {#if frozen}<Button size="sm" onclick={unfreeze}>Clear and restart</Button>{/if}
        <Toggle bind:checked={scanMode} label="Scan mode (ruler and protractor)" onchange={(v) => { if (!v) { tool = 'none'; measurements = []; } else { tool = 'ruler'; frozen = true; } }} />
      {/if}
      {#if scanMode}
        <Segmented
          label="Scanning tool"
          size="sm"
          bind:value={tool}
          onchange={(v) => { if (v !== 'none' && !anderson) frozen = true; }}
          options={[
            { value: 'none', label: 'Select' },
            { value: 'ruler', label: 'Ruler' },
            { value: 'circle', label: 'Circle (3 points)' },
            { value: 'angle', label: 'Angle' },
          ]}
        />
        {#if measurements.length}<Button size="sm" onclick={() => (measurements = [])}>Clear marks</Button>{/if}
      {/if}
      <span class="backend">{backend === 'webgl2' ? 'WebGL2' : backend === 'canvas2d' ? 'Canvas 2D' : ''}</span>
    </div>

    {#if scanMode && measurements.length}
      <ul class="meas ui" aria-label="Your measurements">
        {#each measurements as m (m.id)}<li>{m.text}</li>{/each}
      </ul>
    {/if}

    {#if anderson}
      <AndersonPanel info={selInfo} truth={truthLabel} first={exposure === 0} bField={aBField} onnext={nextExposure} />
      <TrackPanel info={selInfo} track={selTrack} bField={aBField} plates={plateBands} allowReveal={false} />
    {:else}
      <TrackPanel info={selInfo} track={selTrack} bField={aBField} plates={plateBands} />
    {/if}

    {#if listed.length}
      <details class="list ui">
        <summary>Tracks in the chamber ({tracks.length}): a list to select from by keyboard</summary>
        <ul>
          {#each listed as t (t.id)}
            <li>
              <button type="button" class:on={selected === t.id} onclick={() => (selected = t.id)}>Track {t.id + 1}: {describeTrack(t)}</button>
            </li>
          {/each}
        </ul>
      </details>
    {/if}
    <p class="sr-only" aria-live="polite">{count} arrivals so far.</p>
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
  .backend {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--mute);
  }
  .note {
    font-size: 0.82rem;
    color: var(--ink-2);
    max-width: 34rem;
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
