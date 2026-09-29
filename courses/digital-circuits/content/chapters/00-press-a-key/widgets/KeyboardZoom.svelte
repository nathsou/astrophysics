<!--
  The prologue's flagship: a continuous zoom from a keyboard to the atoms of a silicon crystal, in eight
  levels. Drag the slider, click a level, press the arrows, or (once the picture has focus) scroll or drag on
  it. The camera and cross-fades are in zoom.ts, the drawings in scenes/. With reduced motion the slider
  steps from level to level and nothing animates: it is a stepper.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { findEntry } from '$lib/content/registry';
  import S0Keyboard from './scenes/S0Keyboard.svelte';
  import S1Matrix from './scenes/S1Matrix.svelte';
  import S2Board from './scenes/S2Board.svelte';
  import S3Package from './scenes/S3Package.svelte';
  import S4Die from './scenes/S4Die.svelte';
  import S5Gates from './scenes/S5Gates.svelte';
  import S6Cmos from './scenes/S6Cmos.svelte';
  import S7Lattice from './scenes/S7Lattice.svelte';
  import { FRAME, LAST, LEVELS, clampZ, ease, formatLength, levelView, nearestLevel, scaleBar, tourDuration, viewWidth } from './zoom';

  let { n, title = 'From a keypress to the atoms' }: { n?: string | number; title?: string } = $props();

  const scenes = [S0Keyboard, S1Matrix, S2Board, S3Package, S4Die, S5Gates, S6Cmos, S7Lattice];

  let z = $state(0);
  let reduced = $state(false);
  let engaged = $state(false);
  let touring = $state(false);
  let stage: HTMLDivElement | undefined = $state();
  let root: HTMLElement | undefined = $state();

  const level = $derived(nearestLevel(z));
  const info = $derived(LEVELS[level]!);
  const views = $derived(LEVELS.map((_, i) => levelView(i, z)));
  const width = $derived(viewWidth(z));
  const bar = $derived(scaleBar(width, 0.2));
  const barRight = $derived([1, 2, 7].includes(level));
  const chapter = $derived(findEntry('chapter', info.chapter.slug));
  const readout = $derived(`Level ${level + 1} of ${LEVELS.length}: ${info.title}. The picture is about ${formatLength(LEVELS[level]!.width)} across. ${info.caption}`);

  // ── Moving the camera ──────────────────────────────────────────────────────
  let raf = 0;
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    touring = false;
  }
  /** Animate z to `target` (jump when the reader prefers reduced motion). */
  function goTo(target: number, keepTouring = false) {
    if (!keepTouring) stop();
    const to = clampZ(target);
    if (reduced) {
      z = Math.round(to);
      return;
    }
    const from = z;
    const dur = tourDuration(from, to) * 1000;
    const t0 = performance.now();
    cancelAnimationFrame(raf);
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      z = from + (to - from) * ease(k);
      if (k < 1) raf = requestAnimationFrame(step);
      else raf = 0;
    };
    raf = requestAnimationFrame(step);
  }
  function move(delta: number) {
    goTo(reduced ? Math.round(z) + Math.sign(delta) : Math.round(z) + delta);
  }
  function tour() {
    if (touring) return stop();
    if (reduced) return;
    touring = true;
    const from = z >= LAST - 0.01 ? 0 : Math.floor(z);
    z = from;
    const steps = LAST - from;
    const dur = steps * 2.6 * 1000;
    const t0 = performance.now();
    cancelAnimationFrame(raf);
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const u = k * steps;
      const i = Math.min(steps - 1, Math.floor(u));
      const f = u - i;
      // dwell for a moment at each level, then move on to the next
      const h = Math.max(0, Math.min(1, (f - 0.2) / 0.6));
      z = from + i + ease(h);
      if (k < 1) raf = requestAnimationFrame(step);
      else {
        raf = 0;
        touring = false;
        z = LAST;
      }
    };
    raf = requestAnimationFrame(step);
  }

  function onSlide(e: Event) {
    stop();
    z = clampZ(Number((e.currentTarget as HTMLInputElement).value));
  }

  // ── Input on the picture itself: keys, wheel (when it has focus) and drag ─────
  function onKey(e: KeyboardEvent) {
    const k = e.key;
    if (k === 'ArrowUp' || k === 'ArrowRight' || k === '+' || k === '=' || k === 'PageDown') move(1);
    else if (k === 'ArrowDown' || k === 'ArrowLeft' || k === '-' || k === 'PageUp') move(-1);
    else if (k === 'Home') goTo(0);
    else if (k === 'End') goTo(LAST);
    else return;
    e.preventDefault();
  }
  let drag: { y: number; z: number } | null = null;
  function onDown(e: PointerEvent) {
    if (e.button !== 0) return;
    drag = { y: e.clientY, z };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    stop();
  }
  function onMove(e: PointerEvent) {
    if (!drag || reduced) return;
    z = clampZ(drag.z + (drag.y - e.clientY) / 170);
  }
  function onUp(e: PointerEvent) {
    if (!drag) return;
    const moved = Math.abs(drag.y - e.clientY);
    drag = null;
    if (moved > 6 && !reduced) goTo(Math.round(z));
    else if (reduced) z = Math.round(z);
  }

  onMount(() => {
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) z = Math.round(z);
    const el = stage;
    const wheel = (e: WheelEvent) => {
      if (!engaged) return;
      e.preventDefault();
      stop();
      z = clampZ(z + (e.deltaY > 0 ? -1 : 1) * Math.min(0.5, Math.abs(e.deltaY) / 400));
      if (reduced) z = Math.round(z);
    };
    el?.addEventListener('wheel', wheel, { passive: false });
    // Stop the tour when the figure scrolls out of view.
    const io = new IntersectionObserver(([entry]) => {
      if (entry && !entry.isIntersecting && touring) stop();
    });
    if (root) io.observe(root);
    return () => {
      el?.removeEventListener('wheel', wheel);
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  });

  const matrix = (v: { scale: number; tx: number; ty: number }) => `matrix(${v.scale} 0 0 ${v.scale} ${v.tx} ${v.ty})`;
</script>

{#snippet controls()}
  <Button onclick={() => move(-1)} disabled={level === 0 && z < 0.05} aria-label="Zoom out one level">Zoom out</Button>
  <label class="slide ui">
    <span class="sr-only">Zoom level</span>
    <input type="range" min="0" max={LAST} step={reduced ? 1 : 0.01} value={z} oninput={onSlide} aria-valuetext="Level {level + 1} of {LEVELS.length}: {info.title}" style:--fill="{(z / LAST) * 100}%" />
  </label>
  <Button onclick={() => move(1)} disabled={level === LAST && z > LAST - 0.05} aria-label="Zoom in one level">Zoom in</Button>
  {#if !reduced}<Button onclick={tour} aria-pressed={touring}>{touring ? 'Stop' : 'Take the tour'}</Button>{/if}
{/snippet}

<Widget {title} {n} kind="Interactive zoom" {controls} live={false} caption="Zoom in with the slider, the buttons, or by clicking the picture and then scrolling, dragging or using the arrow keys. Each level is a real size: the scale bar tells you how wide the picture is.">
  <div class="kz" bind:this={root}>
    <div class="row">
      <div
        class="stage"
        class:engaged
        bind:this={stage}
        role="slider"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={LAST}
        aria-valuenow={Math.round(z * 100) / 100}
        aria-valuetext="Level {level + 1} of {LEVELS.length}: {info.title}"
        aria-label="Zoom from a keyboard to a silicon crystal. Use the arrow keys to zoom."
        tabindex="0"
        onkeydown={onKey}
        onfocusin={() => (engaged = true)}
        onfocusout={() => (engaged = false)}
        onpointerdown={onDown}
        onpointermove={onMove}
        onpointerup={onUp}
        onpointercancel={onUp}
      >
        <svg viewBox="0 0 {FRAME.w} {FRAME.h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <rect class="bg" x="0" y="0" width={FRAME.w} height={FRAME.h} />
          {#each LEVELS as _, i (i)}
            {@const v = views[i]!}
            {#if v.opacity > 0.004}
              {@const Scene = scenes[i]!}
              <g transform={matrix(v)} opacity={v.opacity} class="lvl">
                <Scene />
              </g>
            {/if}
          {/each}
        </svg>
        <div class="bar" style:width="{bar.fraction * 100}%" style:left={barRight ? 'auto' : '3%'} style:right={barRight ? '3%' : 'auto'}>
          <span>{formatLength(bar.length)}</span>
        </div>
        {#if z < 0.4 || engaged}<div class="hint ui" aria-hidden="true">{engaged ? 'scroll, drag or use ↑ ↓' : 'click, then scroll or drag'}</div>{/if}
      </div>

      <ol class="ladder ui" aria-label="Levels">
        {#each LEVELS as l, i (l.id)}
          <li>
            <button type="button" class:on={i === level} class:near={Math.abs(z - i) < 0.5} aria-current={i === level ? 'step' : undefined} onclick={() => goTo(i)} title={l.title}>
              <span class="num">{i + 1}</span>
              <span class="name">{l.title}</span>
              <span class="size">{formatLength(l.width)}</span>
            </button>
          </li>
        {/each}
      </ol>
    </div>

    <div class="cap">
      <p class="lvl-title ui"><span class="k">Level {level + 1} of {LEVELS.length}</span> {info.title} <span class="w">· {formatLength(info.width)} across</span></p>
      <p class="sentence">{info.caption}</p>
      <p class="link ui">
        {#if chapter?.available}
          <a href="{base}{chapter.href}">Chapter {info.chapter.number}, {info.chapter.title}, explains this level →</a>
        {:else}
          <span>Chapter {info.chapter.number}, {info.chapter.title}, will explain this level.</span>
        {/if}
      </p>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{readout}</p>
  </div>
</Widget>

<style>
  .kz {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    min-width: 0;
  }
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 13.5rem;
    gap: 1rem;
    align-items: start;
  }
  .stage {
    position: relative;
    aspect-ratio: 640 / 400;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    overflow: hidden;
    background: var(--panel);
    touch-action: pan-y;
    cursor: ns-resize;
    outline: none;
    user-select: none;
  }
  .stage:focus-visible {
    box-shadow: 0 0 0 2px var(--focus);
  }
  .stage.engaged {
    border-color: var(--copper);
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    font-family: var(--font-mono);
  }
  .bg {
    fill: var(--panel);
  }
  /* Strokes keep their pixel width while a level is magnified, so that a zoomed line stays a line. */
  .lvl :global(path),
  .lvl :global(line),
  .lvl :global(rect),
  .lvl :global(circle),
  .lvl :global(polyline) {
    vector-effect: non-scaling-stroke;
  }
  .bar {
    position: absolute;
    bottom: 3.5%;
    height: 0;
    border-top: 3px solid var(--fg);
    pointer-events: none;
  }
  .bar::before,
  .bar::after {
    content: '';
    position: absolute;
    top: -8px;
    height: 12px;
    width: 3px;
    background: var(--fg);
  }
  .bar::before {
    left: 0;
  }
  .bar::after {
    right: 0;
  }
  .bar span {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 6px;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--fg);
    text-shadow: 0 0 4px var(--panel), 0 0 4px var(--panel), 0 0 2px var(--panel);
  }
  .hint {
    position: absolute;
    left: 8px;
    top: 8px;
    padding: 0.15rem 0.5rem;
    font-size: 0.68rem;
    border-radius: 99px;
    background: color-mix(in srgb, var(--panel) 85%, transparent);
    border: 1px solid var(--line);
    color: var(--mute);
    pointer-events: none;
  }
  .ladder {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 3px;
  }
  .ladder li {
    margin: 0;
  }
  .ladder button {
    display: grid;
    grid-template-columns: 1.4rem 1fr auto;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.28rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--pn);
    color: var(--ink-2);
    font-size: 0.74rem;
    text-align: left;
    cursor: pointer;
  }
  .ladder button:hover {
    border-color: var(--copper);
  }
  .ladder button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .ladder button.near {
    background: color-mix(in srgb, var(--sig-high) 10%, var(--pn));
  }
  .ladder button.on {
    border-color: var(--sig-high);
    color: var(--fg);
    font-weight: 600;
    background: color-mix(in srgb, var(--sig-high) 18%, var(--pn));
  }
  .num {
    font-family: var(--font-mono);
    color: var(--mute);
  }
  .size {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--mute);
  }
  .cap {
    border-top: 1px solid var(--line);
    padding-top: 0.6rem;
  }
  .cap p {
    margin: 0 !important;
  }
  .lvl-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--fg);
  }
  .k {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--copper-ink);
    margin-right: 0.4rem;
  }
  .w {
    font-weight: 400;
    color: var(--mute);
  }
  .sentence {
    margin-top: 0.3rem !important;
    font-family: var(--font-body);
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .link {
    margin-top: 0.35rem !important;
    font-size: 0.84rem;
  }
  .link a {
    color: var(--accent-ink);
    font-weight: 500;
  }
  .slide {
    flex: 1 1 12rem;
    min-width: 9rem;
    display: flex;
    align-items: center;
  }
  .slide input {
    width: 100%;
    accent-color: var(--copper);
    height: 1.4rem;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (max-width: 760px) {
    .row {
      grid-template-columns: 1fr;
    }
    .ladder {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .ladder button {
      grid-template-columns: 1fr;
      justify-items: center;
      text-align: center;
      padding: 0.3rem 0.2rem;
    }
    .ladder .name {
      display: none;
    }
    .ladder .size {
      font-size: 0.62rem;
    }
  }
</style>
