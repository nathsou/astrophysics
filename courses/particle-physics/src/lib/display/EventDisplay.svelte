<!--
  The event display: a simulated (or real) collision event in four linked views.

    3D            WebGL2, orbit with mouse, touch or keyboard. Helical tracks, calorimeter towers with height ∝ energy,
                  muon hits, jet cones, the missing pT as a dotted arrow, faint wire frames of the detector.
    rphi          the transverse view (looking along the beam), 2D canvas.
    rz            the longitudinal view, 2D canvas.
    lego          calorimeter E_T over the (η, φ) plane, with jets.

  Hover or keyboard-select an object in any view (or in the object list) and it is highlighted in all of them and described
  in the inspector; for a reconstructed object the inspector links to the truth particle it matches and the tracks and
  clusters it was built from. Give `events` to step through a list (Previous, Next, Random with a seed).
  Without WebGL2 the 3D view says so and the two flat views are shown instead.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import type { FullEvent } from '../hep/event/index.ts';
  import { rng } from '../hep/random/index.ts';
  import { defaultColours, onParticleColoursChange, particleColours, PARTICLE_KINDS, styleFor, type ParticleClass, type ParticleColours } from '../theme/particles.ts';
  import { ptGradientCss, PT_RAMP_HI, PT_RAMP_LO } from './colour.ts';
  import { defaultGeometry, type DisplayGeometry } from './geometry.ts';
  import type { ColourBy, RenderOptions } from './glData.ts';
  import { describeEvent, inspect, linkLabel } from './inspect.ts';
  import { sampleEvent } from './sampleEvents.ts';
  import { buildScene, highlightStates, listObjects } from './scene.ts';
  import GlView from './GlView.svelte';
  import PlaneView from './PlaneView.svelte';
  import LegoView from './LegoView.svelte';
  import Inspector from './Inspector.svelte';
  import ObjectList from './ObjectList.svelte';
  import KindSwatch from './KindSwatch.svelte';
  import { parseViews, type ViewName } from './types.ts';

  let {
    event = undefined,
    events = undefined,
    geometry = defaultGeometry,
    views = ['3d', 'rphi', 'rz', 'lego'],
    showTruth = false,
    showReco = true,
    showHits = true,
    showCalo = true,
    colourBy = 'particle',
    viewHeight = 380,
    selected = $bindable<string | null>(null),
    hover = $bindable<string | null>(null),
    index = $bindable(0),
    seed = $bindable(1),
    controls = true,
    toggles = true,
    inspector = true,
    objectList = true,
    legend = true,
    autoRotate = false,
    onselect,
  }: {
    /** One event to show (ignored if `events` is given). */
    event?: FullEvent;
    /** A list of events to step through. */
    events?: FullEvent[];
    geometry?: DisplayGeometry;
    /** Which views to show: any of '3d', 'rphi', 'rz', 'lego' (an array, or a comma-separated string). */
    views?: readonly string[] | string;
    showTruth?: boolean;
    showReco?: boolean;
    showHits?: boolean;
    showCalo?: boolean;
    colourBy?: ColourBy;
    /** Height of each view in pixels. */
    viewHeight?: number;
    /** Key of the selected object ('truth:5', 'object:0', 'track:3', …); bind it to link two displays. */
    selected?: string | null;
    /** Key of the hovered (or keyboard-focused) object; bind it to link the hover of two displays. */
    hover?: string | null;
    /** Index in `events`. */
    index?: number;
    /** Seed of the Random button. */
    seed?: number;
    controls?: boolean;
    /** Show the Truth / Reco / Hits / Calorimeter switches. */
    toggles?: boolean;
    inspector?: boolean;
    objectList?: boolean;
    /** Show the colour and line-style key for the kinds in the event. */
    legend?: boolean;
    autoRotate?: boolean;
    onselect?: (key: string | null) => void;
  } = $props();

  const VIEW_TITLE: Record<ViewName, string> = { '3d': '3D view', rphi: 'Transverse view (r–φ)', rz: 'Longitudinal view (r–z)', lego: 'Calorimeter lego (η–φ)' };
  const VIEW_SHORT: Record<ViewName, string> = { '3d': '3D', rphi: 'Transverse', rz: 'Longitudinal', lego: 'Lego' };
  const VIEW_HELP: Record<ViewName, string> = {
    '3d': 'Drag to rotate, scroll or pinch to zoom. Keys: arrows turn, + and − zoom, 0 resets, [ and ] step through objects.',
    rphi: 'Looking along the beam. Drag to pan, scroll or pinch to zoom, 0 resets.',
    rz: 'Looking across the beam: z to the right, r up (negative r is the other side of the beam). Drag to pan, scroll to zoom.',
    lego: 'Bar height is transverse energy over the η–φ plane. Drag to turn it.',
  };

  // ── Local copies of the options, so the switches work whatever the props say, and follow the props when they change ──
  let truthOn = $state(untrack(() => showTruth));
  let recoOn = $state(untrack(() => showReco));
  let hitsOn = $state(untrack(() => showHits));
  let caloOn = $state(untrack(() => showCalo));
  let cb = $state<ColourBy>(untrack(() => colourBy));
  let rotateOn = $state(untrack(() => autoRotate));
  $effect(() => void (truthOn = showTruth));
  $effect(() => void (recoOn = showReco));
  $effect(() => void (hitsOn = showHits));
  $effect(() => void (caloOn = showCalo));
  $effect(() => void (cb = colourBy));
  $effect(() => void (rotateOn = autoRotate));

  const parsedViews = $derived(parseViews(views));
  let glFailed = $state(false);
  // Without WebGL2 the 3D panel explains itself and the flat views are added if none was asked for.
  const shownViews = $derived.by((): ViewName[] => {
    const v = parsedViews;
    if (glFailed && v.includes('3d') && !v.some((x) => x !== '3d' && x !== 'lego')) return [...v, 'rphi', 'rz'];
    return v;
  });

  // ── The event and its scene ──
  const fallbackEvent = $derived(events?.length || event ? undefined : sampleEvent('zmumu', { seed: 1, geometry }));
  const ev = $derived<FullEvent>(events?.length ? events[Math.max(0, Math.min(index, events.length - 1))]! : (event ?? fallbackEvent!));
  const scene = $derived(buildScene(ev, geometry));
  const summary = $derived(describeEvent(scene));

  // ── Selection: what is hovered (pointer, or keyboard focus in the list) and what is selected ──
  let tip = $state<{ text: string; x: number; y: number } | null>(null);
  const activeKey = $derived(hover ?? selected);
  const activeId = $derived(activeKey === null ? null : (scene.byKey.get(activeKey) ?? null));
  const states = $derived(activeKey !== null && activeId !== null ? highlightStates(scene, activeKey) : null);
  $effect(() => {
    if (selected !== null && !scene.byKey.has(selected)) selected = null;
  });

  function setSelected(key: string | null): void {
    selected = key;
    onselect?.(key);
  }
  function onHover(id: number | null, cx: number, cy: number): void {
    if (id === null) {
      hover = null;
      tip = null;
      return;
    }
    hover = scene.objects[id]!.key;
    const r = root?.getBoundingClientRect();
    tip = r ? { text: linkLabel(scene, id), x: cx - r.left, y: cy - r.top } : null;
  }
  function onPick(id: number | null): void {
    setSelected(id === null ? null : scene.objects[id]!.key);
  }

  // The order in which [ and ] step through the objects.
  const navIds = $derived.by((): number[] => {
    const out: number[] = [];
    if (recoOn) {
      out.push(...listObjects(scene, 'object').map((o) => o.id));
      if (scene.met) out.push(scene.met.obj);
      out.push(...listObjects(scene, 'track').slice(0, 80).map((o) => o.id));
      if (caloOn) out.push(...listObjects(scene, 'cluster').slice(0, 40).map((o) => o.id));
    }
    if (truthOn) out.push(...listObjects(scene, 'truth').filter((o) => scene.polylines.some((p) => p.obj === o.id)).slice(0, 120).map((o) => o.id));
    return out;
  });
  function cycle(dir: 1 | -1): void {
    const n = navIds.length;
    if (!n) return;
    const cur = selected === null ? -1 : navIds.indexOf(scene.byKey.get(selected) ?? -1);
    const next = cur < 0 ? (dir > 0 ? 0 : n - 1) : (cur + dir + n) % n;
    setSelected(scene.objects[navIds[next]!]!.key);
  }

  // ── Stepping through events ──
  const count = $derived(events?.length ?? 0);
  function step(d: number): void {
    if (!count) return;
    index = (((index + d) % count) + count) % count;
  }
  function randomEvent(): void {
    if (!count) return;
    const r = rng(seed);
    index = Math.floor(r() * count);
    seed = seed + 1;
  }

  // ── Colours ──
  let probe = $state<HTMLElement>();
  let palette = $state<ParticleColours>(defaultColours('dark'));
  let root = $state<HTMLElement>();
  let width = $state(800);
  let reduced = $state(false);
  let tab = $state<ViewName>('3d');
  $effect(() => {
    if (!shownViews.includes(tab)) tab = shownViews[0]!;
  });
  onMount(() => {
    palette = particleColours(probe);
    const off = onParticleColoursChange((c) => (palette = c), probe);
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    reduced = mq.matches;
    const onMq = () => (reduced = mq.matches);
    mq.addEventListener('change', onMq);
    let roFrame = 0;
    const ro = new ResizeObserver((entries) => {
      // Applied on the next frame, so that a layout change it causes cannot re-enter the observer.
      const w = entries[0]!.contentRect.width;
      if (roFrame) cancelAnimationFrame(roFrame);
      roFrame = requestAnimationFrame(() => {
        roFrame = 0;
        if (Math.abs(w - width) > 0.5) width = w;
      });
    });
    if (root) ro.observe(root);
    return () => {
      off();
      mq.removeEventListener('change', onMq);
      ro.disconnect();
    };
  });
  const options = $derived<RenderOptions>({ colourBy: cb, showTruth: truthOn, showReco: recoOn, showHits: hitsOn, showCalo: caloOn, palette });
  const narrow = $derived(width < 620);
  const visibleViews = $derived(narrow ? [tab] : shownViews);
  const columns = $derived(narrow || shownViews.length === 1 ? 1 : 2);

  const kindsPresent = $derived.by((): ParticleClass[] => {
    const s = new Set<ParticleClass>();
    for (const p of scene.polylines) if (p.layer === 'truth' ? truthOn : recoOn) s.add(p.kind);
    if (recoOn && scene.cones.length) s.add('jet');
    if (recoOn && scene.met) s.add('neutrino');
    return PARTICLE_KINDS.filter((k) => s.has(k));
  });

  // ── Panel buttons ──
  let gl3d = $state<GlView>();
  let planeRphi = $state<PlaneView>();
  let planeRz = $state<PlaneView>();
  let lego = $state<LegoView>();
  const viewRef = (v: ViewName) => (v === '3d' ? gl3d : v === 'rphi' ? planeRphi : v === 'rz' ? planeRz : lego);
  const rotate = (v: ViewName, a: number, e: number) => (viewRef(v) as { rotate?: (a: number, e: number) => void } | undefined)?.rotate?.(a, e);
  const zoom = (v: ViewName, f: number) => (viewRef(v) as { zoom?: (f: number) => void } | undefined)?.zoom?.(f);
  const reset = (v: ViewName) => (viewRef(v) as { reset?: () => void } | undefined)?.reset?.();
  const extent = (v: ViewName, e: 'all' | 'calo' | 'tracker') => (viewRef(v) as { setExtent?: (e: 'all' | 'calo' | 'tracker') => void } | undefined)?.setExtent?.(e);

  const announce = $derived.by(() => {
    if (activeId === null) return '';
    const i = inspect(scene, activeId);
    return i ? `${i.title}. ${i.rows.slice(0, 4).map((r) => `${r.label} ${r.value}`).join(', ')}.` : '';
  });
  const label = (v: ViewName) => `${VIEW_TITLE[v]} of the event. ${summary}`;
</script>

<div class="ed" bind:this={root}>
  <div class="screen probe" bind:this={probe} aria-hidden="true"></div>

  {#if controls}
    <div class="bar ui">
      {#if count > 1}
        <div class="stepper" role="group" aria-label="Choose the event">
          <button type="button" class="btn" onclick={() => step(-1)} aria-label="Previous event">◀</button>
          <span class="evn" aria-live="polite">event {index + 1} / {count}</span>
          <button type="button" class="btn" onclick={() => step(1)} aria-label="Next event">▶</button>
          <button type="button" class="btn" onclick={randomEvent} title="A random event, chosen from the seed">Random <span class="seed">seed {seed}</span></button>
        </div>
      {/if}
      {#if toggles}
        <div class="toggles">
          <Toggle bind:checked={recoOn} label="Reconstructed" />
          {#if ev.truth}<Toggle bind:checked={truthOn} label="Truth" />{/if}
          {#if ev.detector}<Toggle bind:checked={hitsOn} label="Hits" />{/if}
          <Toggle bind:checked={caloOn} label="Calorimeter" />
          {#if shownViews.includes('3d') && !glFailed}<Toggle bind:checked={rotateOn} label="Auto-rotate" disabled={reduced} />{/if}
        </div>
      {/if}
      <div class="colour">
        <Segmented
          label="Colour tracks by"
          size="sm"
          options={[
            { value: 'particle', label: 'Particle type' },
            { value: 'pt', label: 'pT' },
          ]}
          bind:value={cb}
        />
        {#if cb === 'pt'}
          <span class="ramp" aria-label="pT colour scale from {PT_RAMP_LO} to {PT_RAMP_HI} GeV, logarithmic">
            <span>{PT_RAMP_LO} GeV</span><span class="bar2" style="background:{ptGradientCss()}"></span><span>{PT_RAMP_HI} GeV</span>
          </span>
        {/if}
      </div>
    </div>
  {/if}

  <p class="info ui" aria-live="polite">
    {#if ev.truth}<strong>{ev.truth.process}</strong> ·{/if}
    {ev.reco.tracks.length} tracks · {ev.reco.objects.length} objects · missing pT {Math.hypot(ev.reco.met.x, ev.reco.met.y).toFixed(1)} GeV
    {#if ev.detector?.pileup} · {ev.detector.pileup} pile-up collisions{/if}
  </p>

  {#if legend && kindsPresent.length}
    <ul class="key ui" aria-label="Key to the colours and line styles">
      {#each kindsPresent as k (k)}
        <li><KindSwatch kind={k} width={34} height={12} /><span>{styleFor(k).label}</span></li>
      {/each}
    </ul>
  {/if}

  <div class="main">
    <div class="views">
      {#if narrow && shownViews.length > 1}
        <div class="tabs">
          <Segmented label="View" size="sm" options={shownViews.map((v) => ({ value: v, label: VIEW_SHORT[v] }))} bind:value={tab} />
        </div>
      {/if}
      <div class="grid" style="grid-template-columns: repeat({columns}, minmax(0, 1fr))">
        {#each visibleViews as v (v)}
          <section class="panel" class:span={!narrow && shownViews.length === 3 && v === '3d'} aria-label={VIEW_TITLE[v]}>
            <header class="ph ui">
              <h5>{VIEW_TITLE[v]}</h5>
              <div class="tools">
                {#if v === '3d' || v === 'lego'}
                  <button type="button" class="tb" onclick={() => rotate(v, 0.25, 0)} aria-label="Rotate left">◀</button>
                  <button type="button" class="tb" onclick={() => rotate(v, -0.25, 0)} aria-label="Rotate right">▶</button>
                  <button type="button" class="tb" onclick={() => rotate(v, 0, 0.2)} aria-label="Tilt up">▲</button>
                  <button type="button" class="tb" onclick={() => rotate(v, 0, -0.2)} aria-label="Tilt down">▼</button>
                {:else}
                  <button type="button" class="tb txt" onclick={() => extent(v, 'all')}>All</button>
                  <button type="button" class="tb txt" onclick={() => extent(v, 'calo')}>Calorimeters</button>
                  <button type="button" class="tb txt" onclick={() => extent(v, 'tracker')}>Tracker</button>
                {/if}
                <button type="button" class="tb" onclick={() => zoom(v, v === 'rphi' || v === 'rz' ? 1.3 : 0.8)} aria-label="Zoom in">+</button>
                <button type="button" class="tb" onclick={() => zoom(v, v === 'rphi' || v === 'rz' ? 0.77 : 1.25)} aria-label="Zoom out">−</button>
                {#if v === '3d' || v === 'lego'}<button type="button" class="tb" onclick={() => reset(v)} aria-label="Reset the view">↺</button>{/if}
              </div>
            </header>
            {#if v === '3d'}
              <GlView bind:this={gl3d} {scene} {options} {states} height={viewHeight} autoRotate={rotateOn && !reduced} onhover={onHover} onselect={onPick} oncycle={cycle} onfail={() => (glFailed = true)} label={label(v)} description={VIEW_HELP[v]} />
            {:else if v === 'rphi'}
              <PlaneView bind:this={planeRphi} mode="rphi" {scene} {options} {states} height={viewHeight} onhover={onHover} onselect={onPick} oncycle={cycle} label={label(v)} description={VIEW_HELP[v]} />
            {:else if v === 'rz'}
              <PlaneView bind:this={planeRz} mode="rz" {scene} {options} {states} height={viewHeight} onhover={onHover} onselect={onPick} oncycle={cycle} label={label(v)} description={VIEW_HELP[v]} />
            {:else}
              <LegoView bind:this={lego} {scene} {options} {states} height={viewHeight} onhover={onHover} onselect={onPick} oncycle={cycle} label={label(v)} description={VIEW_HELP[v]} />
            {/if}
            <p class="help ui">{VIEW_HELP[v]}</p>
          </section>
        {/each}
      </div>
    </div>
  </div>
  {#if inspector}
    <div class="side">
      <Inspector {scene} {activeId} pinned={selected !== null && hover === null} onselect={(id) => setSelected(scene.objects[id]!.key)} onpreview={(id) => (hover = id === null ? null : scene.objects[id]!.key)} onclear={() => setSelected(null)} />
    </div>
  {/if}

  {#if objectList}
    <ObjectList {scene} activeKey={selected} onfocusobject={(id) => (hover = id === null ? null : scene.objects[id]!.key)} onselect={(id) => setSelected(scene.objects[id]!.key)} />
  {/if}

  {#if tip}<div class="tip ui" style="left:{tip.x + 14}px; top:{tip.y + 16}px">{tip.text}</div>{/if}
  <p class="sr" aria-live="polite">{announce}</p>
</div>

<style>
  .ed {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    min-width: 0;
  }
  .probe {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    visibility: hidden;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.4rem;
    align-items: center;
  }
  .stepper {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
  }
  .evn {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--ink-2);
    min-width: 6.5rem;
    text-align: center;
  }
  .btn {
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
  .btn:hover,
  .btn:focus-visible {
    border-color: var(--track);
    color: var(--track-ink);
  }
  .seed {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--mute);
    margin-left: 0.3rem;
  }
  .toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.1rem;
  }
  .colour {
    display: flex;
    gap: 0.7rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .ramp {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.7rem;
    color: var(--mute);
    font-family: var(--font-mono);
  }
  .bar2 {
    width: 7rem;
    height: 0.55rem;
    border-radius: 3px;
    border: 1px solid var(--line-strong);
  }
  .info {
    margin: 0 !important;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .info strong {
    color: var(--fg);
  }
  .key {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    font-size: 0.74rem;
    color: var(--ink-2);
  }
  .key li {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
  }
  .main,
  .side {
    min-width: 0;
  }
  .views {
    min-width: 0;
  }
  .tabs {
    margin-bottom: 0.5rem;
  }
  .grid {
    display: grid;
    gap: 0.7rem;
  }
  .panel {
    min-width: 0;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    overflow: hidden;
    background: var(--panel);
  }
  .panel.span {
    grid-column: 1 / -1;
  }
  .ph {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.8rem;
    align-items: center;
    justify-content: space-between;
    padding: 0.35rem 0.6rem;
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--pn) 70%, var(--panel));
  }
  h5 {
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    font-family: var(--font-mono) !important;
    font-size: 0.68rem !important;
    font-weight: 500 !important;
    text-transform: uppercase;
    letter-spacing: 0.09em !important;
    color: var(--mute);
  }
  h5::before,
  h5::after {
    display: none !important;
  }
  .tools {
    display: inline-flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  .tb {
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    border-radius: 5px;
    min-width: 1.6rem;
    height: 1.6rem;
    padding: 0 0.4rem;
    font-size: 0.72rem;
    cursor: pointer;
    line-height: 1;
  }
  .tb.txt {
    font-size: 0.7rem;
  }
  .tb:hover,
  .tb:focus-visible {
    border-color: var(--track);
    color: var(--track-ink);
  }
  .help {
    margin: 0 !important;
    padding: 0.3rem 0.6rem;
    font-size: 0.7rem;
    color: var(--mute);
    border-top: 1px solid var(--line);
  }
  .tip {
    position: absolute;
    pointer-events: none;
    z-index: 5;
    background: #0a1018;
    color: #e6ebf2;
    border: 1px solid #32445b;
    border-radius: 5px;
    padding: 0.2rem 0.5rem;
    font-size: 0.74rem;
    white-space: nowrap;
    box-shadow: 0 4px 14px rgb(0 0 0 / 0.45);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    margin: 0;
  }
  @media (max-width: 520px) {
    .tools .tb {
      min-width: 1.9rem;
      height: 1.9rem;
    }
  }
</style>
