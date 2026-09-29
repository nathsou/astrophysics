<!--
  Voltage landscape: the flagship of Chapter 2.

  A small circuit (a battery, R1, and from node A two paths to ground: R2, and R3 + R4) is solved by the
  course's analog engine and drawn as terrain whose height is voltage: the battery is a lift, each resistor a
  slope, each wire a flat plateau; current is a stream of balls rolling downhill. Sliders change the battery
  and the resistors and the landscape reshapes; hover (or focus a table row) for numbers.

  WebGL 2 with no libraries (render-gl.ts); a Canvas 2D orthographic fallback (render-2d.ts) where WebGL 2 is
  missing or on request. Geometry, balls and the solution are in landscape.ts (tested). The same circuit is
  shown below as a schematic (the bench's Schematic), so the two views can be compared. Drag to turn the
  landscape; arrow keys work too. Paused off-screen; balls start paused for readers who prefer reduced motion.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Schematic from '$lib/bench/Schematic.svelte';
  import { formatReadout, formatSI } from '$lib/bench/format';
  import { flatten } from '$lib/sim/netlist/flatten';
  import type { Circuit } from '$lib/sim/netlist/types';
  import { onThemeChange, prefersReducedMotion, readSignals, voltColor, parseColor, type Signals } from '$lib/theme/signals';
  import circuitJson from '../circuits/landscape.json';
  import { BallField, DEFAULT_PARAMS, LandscapeSolver, PARAM_LIMITS, buildScene, pick, type Anchor, type Palette, type Params, type RGB, type Scene, type Solution } from './landscape';
  import { DEFAULT_CAMERA, project, viewProjection, type Camera, type Vec3 } from './mat4';
  import { GLRenderer } from './render-gl';
  import { draw2D } from './render-2d';

  let { title = 'Voltage landscape', caption, n }: { title?: string; caption?: string; n?: string | number } = $props();

  const circuit = circuitJson as unknown as Circuit;
  const solver = new LandscapeSolver(flatten(circuit));

  let params = $state<Params>({ ...DEFAULT_PARAMS });
  /** The exact solution for the current sliders (what the tables and tooltips say). */
  let solution = $state<Solution>(solver.solve());
  let hover = $state<string | null>(null);
  let tip = $state({ x: 0, y: 0 });
  let playing = $state(true);
  let reducedMotion = $state(false);
  let renderer = $state<'webgl' | 'canvas'>('webgl');
  let glAvailable = $state(true);
  let note = $state('');
  let labels = $state<{ id: string; kind: Anchor['kind']; text: string; x: number; y: number }[]>([]);
  let canvasEl: HTMLCanvasElement | undefined = $state();
  let box: HTMLDivElement | undefined = $state();
  let root: HTMLDivElement | undefined = $state();
  let schematic: Schematic | undefined = $state();

  // Non-reactive animation state.
  const camera: Camera = { ...DEFAULT_CAMERA };
  let shown: Solution = { ...untrack(() => solution) };
  let scene: Scene | undefined;
  let scenePalette: Palette | undefined;
  const balls = new BallField();
  let sig: Signals | undefined;
  let gl: GLRenderer | null = null;
  let ctx2d: CanvasRenderingContext2D | null = null;
  let width = 600;
  let height = 380;
  let visible = false;
  let raf = 0;
  let last = 0;
  let dragging: { x: number; y: number; id: number; moved: number } | null = null;
  let needsScene = true;

  const LIGHT: Vec3 = (() => {
    const v: Vec3 = [-0.45, 0.8, 0.4];
    const l = Math.hypot(...v);
    return [v[0] / l, v[1] / l, v[2] / l];
  })();

  const rgb = (css: string): RGB => {
    const [r, g, b] = parseColor(css);
    return [r / 255, g / 255, b / 255];
  };

  function palette(): Palette {
    const s = sig!;
    const vmax = Math.max(1, params.vs);
    return {
      volt: (v) => rgb(voltColor(v, s, 0, vmax)),
      floor: rgb(s.voltZero),
      glass: rgb(s.copper),
      line: rgb(s.mute),
      accent: rgb(s.copper),
    };
  }

  // ── the drawn schematic follows the sliders (labels show the values) ──────
  const shownCircuit = $derived<Circuit>({
    ...circuit,
    components: circuit.components.map((c) => {
      const key = c.id === 'B1' ? 'vs' : c.id === 'R1' ? 'r1' : c.id === 'R2' ? 'r2' : c.id === 'R3' ? 'r3' : c.id === 'R4' ? 'r4' : undefined;
      if (!key) return c;
      return { ...c, params: { ...(c.params ?? {}), [c.id === 'B1' ? 'voltage' : 'resistance']: params[key] } };
    }),
  });

  function setParam(k: keyof Params, v: number) {
    params[k] = v;
    solver.set({ [k]: v });
    solution = solver.solve();
    schematic?.frame(0);
    kick();
  }

  function resetAll() {
    for (const k of Object.keys(DEFAULT_PARAMS) as (keyof Params)[]) params[k] = DEFAULT_PARAMS[k];
    solver.set(DEFAULT_PARAMS);
    solution = solver.solve();
    Object.assign(camera, DEFAULT_CAMERA);
    schematic?.frame(0);
    kick();
  }

  // ── size, renderer, drawing ────────────────────────────────────────────
  function measure() {
    if (!box || !canvasEl) return;
    width = Math.max(200, box.clientWidth);
    height = Math.max(200, box.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (gl) gl.resize(width, height, dpr);
    else if (renderer === 'canvas') {
      canvasEl.width = Math.round(width * dpr);
      canvasEl.height = Math.round(height * dpr);
      ctx2d = canvasEl.getContext('2d');
      ctx2d?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function attachRenderer() {
    const el = canvasEl;
    if (!el) return;
    gl?.dispose();
    gl = null;
    ctx2d = null;
    note = '';
    if (renderer === 'webgl') {
      gl = GLRenderer.create(el);
      if (!gl) {
        glAvailable = false;
        note = 'WebGL 2 is not available in this browser, so this is the simpler 2D view.';
        renderer = 'canvas';
        return; // the canvas is re-created; this effect runs again
      }
    }
    measure();
    needsScene = true;
    kick();
  }

  /** The camera as used for drawing: pulled back on narrow screens so that the whole landscape fits. */
  function viewCamera(): Camera {
    const fit = Math.max(1, 1.65 / (width / height));
    return { ...camera, ortho: renderer === 'canvas', distance: camera.distance * fit };
  }

  function rebuildScene() {
    scenePalette = palette();
    scene = buildScene(shown, scenePalette);
    needsScene = false;
  }

  function render() {
    if (!scene || !sig) return;
    const cam = viewCamera();
    const ballPositions = balls.positions(scene.paths);
    if (gl) gl.draw(scene, ballPositions, cam, { ball: rgb(sig.current), light: LIGHT });
    else if (ctx2d) draw2D(ctx2d, width, height, scene, ballPositions, cam, { ball: sig.current, light: LIGHT });
    updateLabels(cam);
  }

  function labelText(a: Anchor): string {
    const v = (x: number) => formatReadout(x, 'V');
    switch (a.id) {
      case 'P':
        return v(shown.vP);
      case 'A':
        return v(shown.vA);
      case 'B':
        return v(shown.vB);
      case 'G':
        return '0 V ground';
      case 'B1':
        return `battery ${v(shown.vP)}`;
      case 'R1':
        return `R1 ${formatSI(params.r1, 'Ω')}`;
      case 'R2':
        return `R2 ${formatSI(params.r2, 'Ω')}`;
      case 'R3':
        return `R3 ${formatSI(params.r3, 'Ω')}`;
      case 'R4':
        return `R4 ${formatSI(params.r4, 'Ω')}`;
      default:
        return a.id;
    }
  }

  function updateLabels(cam: Camera) {
    if (!scene) return;
    const mvp = viewProjection(cam, width / height);
    const next = scene.anchors
      .map((a) => {
        const p = project(a.pos, mvp, width, height);
        return { id: a.id, kind: a.kind, text: labelText(a), x: Math.round(p.x), y: Math.round(p.y), ok: p.visible };
      })
      .filter((l) => l.ok)
      .map(({ ok: _ok, ...l }) => l);
    const key = (ls: typeof next) => ls.map((l) => `${l.id}:${l.text}:${l.x},${l.y}`).join('|');
    if (key(next) !== key(labels)) labels = next;
  }

  function easing(): boolean {
    for (const k of ['vP', 'vA', 'vB', 'iTotal', 'i2', 'i3'] as const) {
      if (Math.abs(shown[k] - solution[k]) > (k[0] === 'v' ? 1e-3 : 1e-7)) return true;
    }
    return false;
  }

  function frame(t: number) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    let moving = false;
    if (easing()) {
      const k = 1 - Math.exp(-dt * 16);
      for (const key of ['vP', 'vA', 'vB', 'iTotal', 'i2', 'i3'] as const) shown[key] += (solution[key] - shown[key]) * k;
      needsScene = true;
      moving = easing();
      if (!moving) shown = { ...solution };
    }
    if (needsScene || !scene) rebuildScene();
    if (scene && playing) balls.advance(dt, scene.paths);
    render();
    if (playing || moving || dragging) raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (!raf && visible && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  // ── camera and hover ───────────────────────────────────────────────────
  function pointerDown(ev: PointerEvent) {
    if (ev.button !== 0) return;
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    dragging = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, moved: 0 };
    if (ev.pointerType !== 'mouse') hoverAt(ev);
  }
  function pointerMove(ev: PointerEvent) {
    if (dragging) {
      const dx = ev.clientX - dragging.x;
      const dy = ev.clientY - dragging.y;
      dragging.x = ev.clientX;
      dragging.y = ev.clientY;
      dragging.moved += Math.abs(dx) + Math.abs(dy);
      camera.yaw -= dx * 0.008;
      camera.pitch = Math.min(1.25, Math.max(0.15, camera.pitch + dy * 0.006));
      if (dragging.moved > 6) hover = null;
      kick();
      needsRender();
    } else if (ev.pointerType === 'mouse') hoverAt(ev);
  }
  function pointerUp() {
    dragging = null;
  }
  function hoverAt(ev: PointerEvent) {
    if (!scene || !box) return;
    const r = box.getBoundingClientRect();
    const px = ev.clientX - r.left;
    const py = ev.clientY - r.top;
    const cam = viewCamera();
    const a = pick(scene.anchors, viewProjection(cam, width / height), width, height, px, py);
    hover = a?.id ?? null;
    tip = { x: Math.min(px + 14, width - 200), y: Math.max(4, py - 8) };
  }
  function needsRender() {
    if (!raf) requestAnimationFrame(() => render());
  }
  function key(ev: KeyboardEvent) {
    const step = 0.12;
    if (ev.key === 'ArrowLeft') camera.yaw += step;
    else if (ev.key === 'ArrowRight') camera.yaw -= step;
    else if (ev.key === 'ArrowUp') camera.pitch = Math.min(1.25, camera.pitch + step);
    else if (ev.key === 'ArrowDown') camera.pitch = Math.max(0.15, camera.pitch - step);
    else return;
    ev.preventDefault();
    kick();
    needsRender();
  }
  function turn(d: number) {
    camera.yaw += d;
    kick();
    needsRender();
  }
  function resetView() {
    Object.assign(camera, DEFAULT_CAMERA);
    kick();
    needsRender();
  }

  onMount(() => {
    reducedMotion = prefersReducedMotion();
    if (reducedMotion) playing = false;
    sig = readSignals(box);
    const stopTheme = onThemeChange(() => {
      sig = readSignals(box);
      needsScene = true;
      kick();
      needsRender();
    });
    const ro = new ResizeObserver(() => {
      measure();
      kick();
      needsRender();
    });
    if (box) ro.observe(box);
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
      gl?.dispose();
    };
  });

  // (Re)create the renderer whenever the canvas element is (re)created.
  $effect(() => {
    void canvasEl;
    void renderer;
    untrack(() => attachRenderer());
  });
  $effect(() => {
    if (playing) untrack(kick);
  });

  // ── numbers for the tables and the tooltip ───────────────────────────────
  const parts = $derived([
    { id: 'B1', name: 'Battery (lift)', value: formatSI(params.vs, 'V'), drop: -solution.vP, current: solution.iTotal },
    { id: 'R1', name: 'R1', value: formatSI(params.r1, 'Ω'), drop: solution.vP - solution.vA, current: solution.iTotal },
    { id: 'R2', name: 'R2', value: formatSI(params.r2, 'Ω'), drop: solution.vA, current: solution.i2 },
    { id: 'R3', name: 'R3', value: formatSI(params.r3, 'Ω'), drop: solution.vA - solution.vB, current: solution.i3 },
    { id: 'R4', name: 'R4', value: formatSI(params.r4, 'Ω'), drop: solution.vB, current: solution.i3 },
  ]);
  const nodes = $derived([
    { id: 'P', name: 'P (battery +)', v: solution.vP },
    { id: 'A', name: 'A', v: solution.vA },
    { id: 'B', name: 'B', v: solution.vB },
    { id: 'G', name: 'Ground', v: 0 },
  ]);

  const hoverText = $derived.by(() => {
    if (!hover) return undefined;
    const node = nodes.find((x) => x.id === hover);
    if (node) return { title: `Node ${node.name}`, lines: [`${formatReadout(node.v, 'V')} above ground`, `height ${(node.v / 12 * 100).toFixed(0)} % of the ruler`] };
    const part = parts.find((x) => x.id === hover);
    if (part) {
      if (part.id === 'B1') return { title: 'Battery: the lift', lines: [`Raises each coulomb by ${formatReadout(solution.vP, 'V')}`, `${formatReadout(solution.iTotal, 'A')} through it`, `${formatSI(solution.vP * solution.iTotal, 'W')} delivered`] };
      return {
        title: `${part.name}, ${part.value}`,
        lines: [`Slope: drops ${formatReadout(part.drop, 'V')}`, `${formatReadout(part.current, 'A')} rolls down it`, `${formatSI(part.drop * part.current, 'W')} turned into heat`],
      };
    }
    return undefined;
  });

  const partIds = ['B1', 'R1', 'R2', 'R3', 'R4'];
  const highlight = $derived(hover && partIds.includes(hover) ? new Set([hover]) : undefined);
  const sumLift = $derived(formatReadout(solution.vP, 'V'));
</script>

<Widget {title} {caption} {n} kind="Flagship interactive" onreset={resetAll} fullscreen>
  {#snippet controls()}
    <Slider value={params.vs} min={PARAM_LIMITS.vs[0]} max={PARAM_LIMITS.vs[1]} step={0.5} label="Battery" format={(v) => `${v.toFixed(1)} V`} oninput={(v) => setParam('vs', v)} />
    {#each [['r1', 'R1'], ['r2', 'R2'], ['r3', 'R3'], ['r4', 'R4']] as const as [k, name] (k)}
      <Slider value={params[k]} min={PARAM_LIMITS.r[0]} max={PARAM_LIMITS.r[1]} log label={name} format={(v) => formatSI(v, 'Ω', 3)} oninput={(v) => setParam(k, v)} />
    {/each}
  {/snippet}

  <div class="lw" bind:this={root}>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="stage"
      bind:this={box}
      role="application"
      aria-roledescription="3D view"
      aria-label="3D view of the circuit: height is voltage. Drag or use the arrow keys to turn it."
      tabindex="0"
      onpointerdown={pointerDown}
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerUp}
      onpointerleave={() => (hover = null)}
      onkeydown={key}
    >
      {#key renderer}
        <canvas bind:this={canvasEl} aria-hidden="true"></canvas>
      {/key}
      <div class="labels" aria-hidden="true">
        {#each labels as l (l.id)}
          <span class="lab {l.kind}" class:on={hover === l.id} style:left="{l.x}px" style:top="{l.y}px">{l.text}</span>
        {/each}
      </div>
      {#if hoverText}
        <div class="tip ui" style:left="{tip.x}px" style:top="{tip.y}px">
          <strong>{hoverText.title}</strong>
          {#each hoverText.lines as line (line)}<span>{line}</span>{/each}
        </div>
      {/if}
      {#if note}<p class="note ui">{note}</p>{/if}
    </div>

    <div class="bar ui">
      <button type="button" class="b" onclick={() => turn(0.3)} aria-label="Turn the landscape left"><Icon name="chevron" size={14} /></button>
      <button type="button" class="b" onclick={() => turn(-0.3)} aria-label="Turn the landscape right"><Icon name="chevron" size={14} /></button>
      <button type="button" class="b txt" onclick={resetView}>Reset view</button>
      <button type="button" class="b txt" onclick={() => (playing = !playing)} aria-pressed={playing}>
        <Icon name={playing ? 'close' : 'play'} size={13} />
        {playing ? 'Pause balls' : 'Roll balls'}
      </button>
      {#if glAvailable}
        <Segmented
          size="sm"
          label="Renderer"
          bind:value={renderer}
          options={[
            { value: 'webgl', label: 'WebGL 2', title: 'Draw with WebGL 2' },
            { value: 'canvas', label: 'Canvas 2D', title: 'The simpler isometric view' },
          ]}
        />
      {/if}
      <span class="hint">Drag to turn. Hover for numbers.</span>
    </div>

    <div class="below">
      <div class="sch">
        <Schematic bind:this={schematic} circuit={shownCircuit} engine={solver.engine} mode="voltage" showCurrent live={false} scale={1.05} {highlight} />
      </div>
      <div class="tables ui">
        <table>
          <caption>Nodes (height above ground)</caption>
          <tbody>
            {#each nodes as r (r.id)}
              <tr tabindex="0" class:on={hover === r.id} onfocus={() => (hover = r.id)} onblur={() => (hover = null)} onmouseenter={() => (hover = r.id)} onmouseleave={() => (hover = null)}>
                <th scope="row">{r.name}</th>
                <td>{formatReadout(r.v, 'V')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <table>
          <caption>Parts</caption>
          <thead><tr><th scope="col">Part</th><th scope="col">Drop</th><th scope="col">Current</th></tr></thead>
          <tbody>
            {#each parts as r (r.id)}
              <tr tabindex="0" class:on={hover === r.id} onfocus={() => (hover = r.id)} onblur={() => (hover = null)} onmouseenter={() => (hover = r.id)} onmouseleave={() => (hover = null)}>
                <th scope="row">{r.name} <span class="val">{r.value}</span></th>
                <td>{r.id === 'B1' ? `+${formatReadout(-r.drop, 'V')}` : formatReadout(r.drop, 'V')}</td>
                <td>{formatReadout(r.current, 'A')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <p class="laws ui" aria-live="polite">
      <span><b>Voltage law:</b> the lift ({sumLift}) = R1 ({formatReadout(solution.vP - solution.vA, 'V')}) + R2 ({formatReadout(solution.vA, 'V')}).</span>
      <span><b>Current law:</b> R1 ({formatReadout(solution.iTotal, 'A')}) = R2 ({formatReadout(solution.i2, 'A')}) + R3 ({formatReadout(solution.i3, 'A')}).</span>
    </p>
  </div>
</Widget>

<style>
  .lw {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }
  .stage {
    position: relative;
    height: clamp(340px, 50vw, 460px);
    border: 1px solid var(--line);
    border-radius: 8px;
    background: linear-gradient(to bottom, var(--pn), var(--panel));
    overflow: hidden;
    touch-action: none;
    cursor: grab;
    user-select: none;
  }
  .stage:active {
    cursor: grabbing;
  }
  .stage:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
  .labels {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .lab {
    position: absolute;
    transform: translate(-50%, -100%);
    padding: 0.05rem 0.35rem;
    border-radius: 4px;
    background: color-mix(in srgb, var(--panel) 82%, transparent);
    color: var(--fg);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    white-space: nowrap;
    line-height: 1.35;
  }
  .lab.node {
    font-weight: 600;
    border: 1px solid var(--line-strong);
  }
  .lab.part {
    color: var(--ink-2);
  }
  .lab.tick {
    transform: translate(-100%, -50%);
    background: none;
    color: var(--mute);
    font-size: 0.66rem;
  }
  .lab.on {
    border: 1px solid var(--copper);
    color: var(--copper-ink);
    background: var(--panel);
  }
  .tip {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    max-width: 14rem;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    box-shadow: var(--shadow-lg);
    font-size: 0.78rem;
    color: var(--ink-2);
    pointer-events: none;
    z-index: 2;
  }
  .tip strong {
    color: var(--fg);
    font-size: 0.82rem;
  }
  .note {
    position: absolute;
    left: 0.6rem;
    bottom: 0.4rem;
    margin: 0;
    font-size: 0.74rem;
    color: var(--mute);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.6rem;
    font-size: 0.8rem;
  }
  .b {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-width: 1.9rem;
    height: 1.9rem;
    padding: 0 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
  }
  .b:hover {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .b:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .b:first-child :global(svg) {
    transform: scaleX(-1);
  }
  .hint {
    margin-left: auto;
    color: var(--mute);
  }
  .below {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 0.9rem;
    align-items: start;
  }
  .sch {
    min-width: 0;
    overflow-x: auto;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel);
    padding: 0.3rem;
  }
  .tables {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
  }
  caption {
    text-align: left;
    font-family: var(--font-mono);
    font-size: 0.64rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
    padding-bottom: 0.2rem;
  }
  th,
  td {
    padding: 0.18rem 0.4rem;
    border-bottom: 1px solid var(--line);
    text-align: right;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }
  thead th {
    color: var(--mute);
    font-size: 0.7rem;
  }
  th[scope='row'],
  thead th:first-child {
    text-align: left;
    color: var(--ink-2);
  }
  .val {
    color: var(--mute);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    margin-left: 0.3rem;
  }
  td {
    font-family: var(--font-mono);
  }
  tr:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  tr.on {
    background: var(--copper-soft);
  }
  .laws {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    margin: 0;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .laws b {
    color: var(--fg);
    font-weight: 600;
  }
  @media (max-width: 720px) {
    .below {
      grid-template-columns: minmax(0, 1fr);
    }
    .hint {
      display: none;
    }
    .lab.part {
      display: none;
    }
  }
</style>
