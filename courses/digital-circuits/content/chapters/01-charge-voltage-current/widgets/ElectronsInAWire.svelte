<!--
  Electrons in a wire: the flagship of Chapter 1.

  A schematic picture of the free electrons of a copper wire. They jiggle at random all the time (fast:
  about 10⁵ m/s in reality). Close the switch and a *field front* races along the wire; behind it, every
  electron picks up a tiny extra drift against the conventional current. The drift is 10⁻⁹ of the thermal
  speed in reality, so the picture takes the true ratio and multiplies it by an exaggeration the reader
  chooses. The readouts are the real numbers. Logic and numbers are in ./wire.ts (tested).

  Canvas 2D; paused off-screen and in hidden tabs; starts paused for readers who prefer reduced motion.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { onThemeChange, prefersReducedMotion, readSignals, withAlpha, type Signals } from '$lib/theme/signals';
  import {
    V_THERMAL,
    VELOCITY_FACTOR,
    WireSim,
    displayDriftRatio,
    driftSpeed,
    electronsPerSecond,
    formatAmps,
    formatLength,
    formatSpeed,
    sci,
    signalSpeed,
    supHtml,
    type Exaggeration,
  } from './wire';

  let { title = 'Electrons in a wire', caption, n }: { title?: string; caption?: string; n?: string | number } = $props();

  const HEIGHT = 250;
  const CY = 132;
  const THERMAL_PX = 90;

  let current = $state(1);
  let area = $state(1);
  let exaggeration = $state<Exaggeration>(1e9);
  let closed = $state(false);
  let playing = $state(true);
  /** Real distance the average electron has drifted since the switch was first closed (m), and the real seconds that took. */
  let odometer = $state(0);
  let odoSeconds = $state(0);
  let reducedMotion = $state(false);

  let canvas: HTMLCanvasElement | undefined = $state();
  let root: HTMLDivElement | undefined = $state();
  let sim: WireSim | undefined;
  let ctx: CanvasRenderingContext2D | null = null;
  let sig: Signals | undefined;
  let font = 'system-ui, sans-serif';
  let dpr = 1;
  let cssWidth = 0;
  let visible = false;
  let raf = 0;
  let last = 0;

  // The numbers in the readouts (real physics, independent of the picture).
  const vDrift = $derived(driftSpeed(current, area));
  const perSecond = $derived(electronsPerSecond(current));
  const vSignal = signalSpeed();
  const thermalRatio = $derived(V_THERMAL / vDrift);
  const drawn = $derived(displayDriftRatio(current, area, exaggeration));
  const tubeHeight = $derived(44 + 86 * ((Math.log10(area) + 1) / 2));

  const EXAGGERATIONS: { value: Exaggeration; label: string; title: string }[] = [
    { value: 1, label: 'True scale', title: 'Draw the drift at its real size relative to the thermal motion: invisible' },
    { value: 1e6, label: '×10⁶', title: 'Exaggerate the drift a million times' },
    { value: 1e9, label: '×10⁹', title: 'Exaggerate the drift a billion times' },
  ];

  function ensureSim(w: number) {
    if (!sim) sim = new WireSim(w, tubeHeight, { seed: 42, thermal: THERMAL_PX });
    else if (Math.abs(sim.width - w) > 0.5 || Math.abs(sim.height - tubeHeight) > 0.5) sim.resize(w, tubeHeight);
    return sim;
  }

  function measure() {
    if (!canvas) return;
    const w = Math.max(240, Math.floor(canvas.parentElement?.clientWidth ?? canvas.clientWidth));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w !== cssWidth || canvas.width !== Math.round(w * dpr)) {
      cssWidth = w;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(HEIGHT * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${HEIGHT}px`;
    }
    ctx = canvas.getContext('2d');
    ensureSim(w);
  }

  // ── drawing ────────────────────────────────────────────────────────────
  function arrow(c: CanvasRenderingContext2D, x0: number, x1: number, y: number, head = 6) {
    const dir = Math.sign(x1 - x0) || 1;
    c.beginPath();
    c.moveTo(x0, y);
    c.lineTo(x1, y);
    c.moveTo(x1 - dir * head, y - head * 0.65);
    c.lineTo(x1, y);
    c.lineTo(x1 - dir * head, y + head * 0.65);
    c.stroke();
  }

  function draw() {
    const c = ctx;
    const s = sim;
    if (!c || !s || !sig || !canvas) return;
    const W = s.width;
    const h = s.height;
    const top = CY - h / 2;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, HEIGHT);
    c.font = `500 12px ${font}`;
    c.textBaseline = 'middle';

    // The wire: a copper tube, seen from the side.
    const r = 10;
    const tube = new Path2D();
    tube.roundRect(1, top, W - 2, h, r);
    c.fillStyle = withAlpha(sig.copper, 0.09);
    c.fill(tube);

    c.save();
    c.clip(tube);
    // Field: where the front has passed, tinted amber, with small arrows along the conventional direction.
    const step = 6;
    c.fillStyle = withAlpha(sig.high, 0.14);
    for (let x = 0; x < W; x += step) if (s.fieldAt(x + step / 2)) c.fillRect(x, top, step + 0.5, h);
    // Ions: the fixed lattice (copper cores).
    c.fillStyle = withAlpha(sig.mute, 0.5);
    const pitch = 26;
    for (let ix = pitch / 2; ix < W; ix += pitch)
      for (let iy = pitch / 2 + 2; iy < h; iy += pitch) {
        c.beginPath();
        c.arc(ix, top + iy, 3.4, 0, Math.PI * 2);
        c.fill();
      }
    c.strokeStyle = withAlpha(sig.high, 0.6);
    c.lineWidth = 1.5;
    c.lineCap = 'round';
    for (let x = 60; x < W - 20; x += 90) {
      if (s.fieldAt(x)) arrow(c, x - 9, x + 9, top + 11, 5);
    }
    // Electrons.
    c.fillStyle = sig.current;
    for (let i = 1; i < s.count; i++) {
      c.beginPath();
      c.arc(s.x[i]!, top + s.y[i]!, 2.7, 0, Math.PI * 2);
      c.fill();
    }
    // The tagged electron and its recent path.
    if (s.count > 0) {
      const tx = s.x[0]!;
      const ty = top + s.y[0]!;
      const tr = s.trail;
      c.lineWidth = 1.6;
      for (let k = 2; k < tr.length; k += 2) {
        const a = (k / tr.length) * 0.8;
        c.strokeStyle = withAlpha(sig.copper, a);
        c.beginPath();
        c.moveTo(tx - (s.taggedDx - tr[k - 2]!), top + tr[k - 1]!);
        c.lineTo(tx - (s.taggedDx - tr[k]!), top + tr[k + 1]!);
        c.stroke();
      }
      c.beginPath();
      c.arc(tx, ty, 5, 0, Math.PI * 2);
      c.fillStyle = sig.copper;
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = sig.panel;
      c.stroke();
    }
    // The front.
    const fx = s.frontX();
    if (fx !== undefined) {
      const grad = c.createLinearGradient(fx - 26, 0, fx + 2, 0);
      grad.addColorStop(0, withAlpha(sig.high, 0));
      grad.addColorStop(1, withAlpha(sig.high, 0.5));
      c.fillStyle = grad;
      c.fillRect(fx - 26, top, 28, h);
      c.strokeStyle = sig.high;
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(fx, top);
      c.lineTo(fx, top + h);
      c.stroke();
    }
    c.restore();

    c.lineWidth = 2.5;
    c.strokeStyle = sig.copper;
    c.stroke(tube);

    // Labels and arrows outside the tube.
    c.lineCap = 'round';
    c.textAlign = 'left';
    const anyField = s.fieldAt(4);
    c.fillStyle = sig.mute;
    c.fillText('switch', 6, top - 14);
    c.textAlign = 'right';
    c.fillText('to the lamp', W - 6, top - 14);
    if (fx !== undefined) {
      c.textAlign = fx > W - 90 ? 'right' : 'left';
      c.fillStyle = sig.high;
      c.fillText('field front', fx + (fx > W - 90 ? -8 : 8), top - 14);
    }
    c.textAlign = 'center';
    if (anyField) {
      const mid = Math.min(W / 2, Math.max(120, W / 2));
      c.strokeStyle = sig.high;
      c.fillStyle = sig.high;
      c.lineWidth = 2;
      arrow(c, mid - 46, mid + 46, top + h + 20, 7);
      c.fillText('conventional current', mid, top + h + 38);
      c.strokeStyle = sig.current;
      c.fillStyle = sig.current;
      arrow(c, mid + 46, mid - 46, top - 34 + 0, 7);
      c.fillText('electrons drift', mid, top - 52 + 0);
    }
  }

  // ── animation ──────────────────────────────────────────────────────────
  function frame(t: number) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dtReal = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    if (playing && sim) {
      sim.step(dtReal, drawn.ratio * THERMAL_PX);
      if (closed) {
        odometer += vDrift * dtReal;
        odoSeconds += dtReal;
      }
    }
    draw();
    if (playing) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && visible && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function reset() {
    sim = undefined;
    closed = false;
    odometer = 0;
    odoSeconds = 0;
    measure();
    draw();
  }

  onMount(() => {
    reducedMotion = prefersReducedMotion();
    if (reducedMotion) playing = false;
    font = getComputedStyle(canvas!).fontFamily || font;
    sig = readSignals(canvas);
    measure();
    draw();
    const stopTheme = onThemeChange(() => {
      sig = readSignals(canvas);
      draw();
    });
    const ro = new ResizeObserver(() => {
      measure();
      draw();
    });
    if (canvas?.parentElement) ro.observe(canvas.parentElement);
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      if (visible) kick();
    });
    if (root) io.observe(root);
    const vis = () => !document.hidden && kick();
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      stopTheme();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
    };
  });

  // Reader's changes: update the picture immediately, even when paused.
  $effect(() => {
    const isClosed = closed;
    untrack(() => {
      sim?.setSwitch(isClosed);
      draw();
      kick();
    });
  });
  $effect(() => {
    void tubeHeight;
    void exaggeration;
    untrack(() => {
      if (canvas && sim) {
        measure();
        draw();
      }
    });
  });
  $effect(() => {
    if (playing) untrack(kick);
  });

  const status = $derived(
    closed
      ? `Switch closed. Current ${formatAmps(current)} in ${area} mm² of copper. Average electron drift ${formatSpeed(vDrift)}; the field travels at about ${sci(vSignal)} m/s.`
      : 'Switch open. The electrons jiggle at random and go nowhere on average.',
  );
</script>

<Widget {title} {caption} {n} kind="Flagship interactive" onreset={reset} fullscreen>
  {#snippet controls()}
    <Toggle bind:checked={closed} label={closed ? 'Switch closed' : 'Switch open'} />
    <Slider bind:value={current} min={0.01} max={10} log label="Current" format={formatAmps} />
    <Slider bind:value={area} min={0.1} max={10} log label="Cross-section" format={(v) => `${v < 1 ? v.toFixed(2) : v.toFixed(1)} mm²`} />
    <div class="ctl">
      <span class="lbl ui">Drift on screen</span>
      <Segmented options={EXAGGERATIONS} bind:value={exaggeration} label="Exaggerate the drift" size="sm" />
    </div>
    <button class="play ui" type="button" onclick={() => (playing = !playing)} aria-pressed={playing}>
      <Icon name={playing ? 'close' : 'play'} size={13} />
      {playing ? 'Pause' : reducedMotion ? 'Animate' : 'Play'}
    </button>
  {/snippet}

  <div class="wrap" bind:this={root}>
    <div class="cv" role="img" aria-label="A copper wire seen from the side, full of jiggling electrons. {status}">
      <canvas bind:this={canvas} aria-hidden="true"></canvas>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{status}</p>

    <ul class="legend ui" aria-label="Key">
      <li><i class="dot e"></i> a free electron, jiggling</li>
      <li><i class="dot t"></i> one electron, with its recent path</li>
      <li><i class="dot f"></i> where the field has arrived</li>
    </ul>

    <dl class="read ui">
      <div>
        <dt>Drift speed</dt>
        <dd class="big">{formatSpeed(vDrift)}</dd>
        <dd class="sub">{formatLength(vDrift * 3600)} in an hour</dd>
      </div>
      <div>
        <dt>Electrons per second</dt>
        <dd class="big">{@html supHtml(sci(perSecond))}</dd>
        <dd class="sub">through any cross-section</dd>
      </div>
      <div>
        <dt>Field (signal) speed</dt>
        <dd class="big">≈ {@html supHtml(sci(vSignal))} m/s</dd>
        <dd class="sub">{(VELOCITY_FACTOR).toFixed(2)} c · a metre in {((1 / vSignal) * 1e9).toFixed(1)} ns</dd>
      </div>
      <div>
        <dt>Thermal speed</dt>
        <dd class="big">≈ {@html supHtml(sci(V_THERMAL))} m/s</dd>
        <dd class="sub">{@html supHtml(sci(thermalRatio, 1))} times the drift</dd>
      </div>
      <div class="wide">
        <dt>Since you closed the switch</dt>
        <dd class="big">{odoSeconds > 0 ? formatLength(odometer) : '–'}</dd>
        <dd class="sub">
          {#if odoSeconds > 0}
            is how far the average electron has really moved in {odoSeconds < 10 ? odoSeconds.toFixed(1) : odoSeconds.toFixed(0)} s. The field covered every metre of the wire in about 5 ns.
          {:else}
            Close the switch: the number that appears here is the real distance an electron has travelled.
          {/if}
        </dd>
      </div>
      <div class="wide">
        <dt>On screen</dt>
        <dd class="big">{drawn.ratio < 0.001 ? '< 0.1 %' : `${(drawn.ratio * 100).toFixed(drawn.ratio < 0.1 ? 1 : 0)} %`}</dd>
        <dd class="sub">
          of the thermal speed{drawn.capped ? ' (capped so the picture stays readable)' : ''}. Reality: {@html supHtml(sci(vDrift / V_THERMAL, 1))} of it.
        </dd>
      </div>
    </dl>
  </div>
</Widget>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }
  .cv {
    width: 100%;
    overflow: hidden;
    border-radius: 6px;
  }
  canvas {
    display: block;
    max-width: 100%;
  }
  .ctl {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .play {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 1.9rem;
    padding: 0.2rem 0.75rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
  }
  .play:hover {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .play:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .dot {
    display: inline-block;
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 50%;
  }
  .dot.e {
    background: var(--sig-current);
  }
  .dot.t {
    background: var(--copper);
  }
  .dot.f {
    border-radius: 2px;
    background: color-mix(in srgb, var(--sig-high) 30%, transparent);
    border: 1px solid var(--sig-high);
  }
  .read {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
    gap: 0.6rem;
    margin: 0;
  }
  .read > div {
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--pn);
    min-width: 0;
  }
  .read .wide {
    grid-column: span 2;
  }
  dt {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  dd {
    margin: 0;
  }
  .big {
    font-family: var(--font-mono);
    font-size: 1.05rem;
    font-weight: 500;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .sub {
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.4;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (max-width: 560px) {
    .read .wide {
      grid-column: span 1;
    }
  }
</style>
