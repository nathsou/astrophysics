<!--
  Renders a Circuit as an SVG schematic and animates it from an Engine.

  The SVG structure is built once per circuit (buildModel); each frame only touches attributes that
  changed: wire colours (data-v / --c), symbol state (brightness, contacts), current dots
  (stroke-dashoffset). With `live` (default) the schematic runs its own animation loop while on
  screen; a host that advances the engine itself (CircuitWidget) passes live={false} and calls
  frame(dt) after each advance.
-->
<script lang="ts">
  import './symbols/symbols.css';
  import './schematic.css';
  import { onMount, untrack } from 'svelte';
  import type { Engine, ElementState } from '../sim/engine';
  import type { Circuit, Params, ParamValue } from '../sim/netlist/types';
  import type { SubResolver } from '../sim/netlist/connect';
  import { buildModel, LABEL_SIZE, pinCurrentSources, type ModelComponent, type SchematicMode } from './model';
  import { symbolFor } from './symbols';
  import { logicAttr, voltageColour } from './colour';
  import { dotSpeed, solveEdgeCurrents } from './currents';
  import { formatReadout, formatSI, logicChar, mainValue } from './format';
  import { FILAMENT, LED_COLOURS } from './symbols/colours';
  import { G } from './geometry';

  let {
    circuit,
    engine = null,
    mode = 'logic',
    showCurrent = false,
    highlight,
    interactive = true,
    running = true,
    scale = 1.5,
    parts,
    live = true,
    label,
    onparam,
    staticState,
    pinMarks = false,
    viewBox,
    fill = false,
  }: {
    circuit: Circuit;
    engine?: Engine | null;
    mode?: SchematicMode;
    /** Moving dots for current (analog engines). */
    showCurrent?: boolean;
    /** Component ids (and net names) to highlight. */
    highlight?: Set<string>;
    /** Clickable switches and buttons, hover cards. */
    interactive?: boolean;
    /** Current dots move only while running. */
    running?: boolean;
    /** CSS pixels per schematic pixel at full width (the SVG shrinks to fit narrower containers). */
    scale?: number;
    /** Resolver for parts-bin types ("part:…"). */
    parts?: SubResolver;
    /** Run an own animation loop (false: the host calls frame()). */
    live?: boolean;
    /** Accessible name of the schematic. */
    label?: string;
    /** Called after the reader changed a part (the engine has already been told). */
    onparam?: (id: string, key: string, value: ParamValue) => void;
    /** Element states to draw while there is no engine (static figures: a lit LED, a burned resistor). */
    staticState?: Record<string, ElementState>;
    /** Mark every pin position (symbol reviews). */
    pinMarks?: boolean;
    /** Show this part of the drawing (schematic px) instead of fitting the circuit: for a pannable canvas. */
    viewBox?: { x0: number; y0: number; x1: number; y1: number };
    /** Fill the container (position: absolute; inset: 0) instead of sizing to the circuit. Use with `viewBox`. */
    fill?: boolean;
  } = $props();

  const uid = $props.id();
  const model = $derived(buildModel(circuit, parts));

  /** Live parameters and state of one component, updated only when they change. */
  class Live {
    params: Params = $state.raw({});
    state: ElementState = $state.raw({});
    constructor(params: Params, state: ElementState | undefined) {
      this.params = params;
      this.state = state ?? {};
    }
  }
  const lives = $derived(model.comps.map((m) => new Live(m.params, staticState?.[m.c.id])));

  let svg: SVGSVGElement | undefined = $state();
  let container: HTMLDivElement | undefined = $state();

  // DOM handles for per-frame updates, collected after each (re)build.
  let netEls: (Element & ElementCSSInlineStyle)[][] = [];
  let prevNet: string[] = [];
  let edgeEls: (SVGPathElement | undefined)[] = $state([]);
  let arrowEls: (SVGPathElement | undefined)[] = $state([]);
  let offsets = new Float64Array(0);
  let edgeShown = new Uint8Array(0);
  let pinSrc: { id: string; pin: number }[][] = [];
  let pinCur = new Float64Array(0);
  let edgeCur = new Float64Array(0);
  let reducedMotion = $state(false);

  const WIRING = new Set(['ground', 'label', 'port']);
  const SPACING = 16;

  function collect() {
    if (!svg) return;
    const m = model;
    netEls = Array.from({ length: m.conn.netCount }, () => []);
    svg.querySelectorAll<SVGElement>('[data-net]').forEach((el) => {
      const n = Number(el.dataset.net);
      if (n >= 0) netEls[n]?.push(el);
    });
    svg.querySelectorAll<SVGGElement>('g.comp').forEach((g) => {
      const comp = m.comps[Number(g.dataset.cid)];
      if (!comp) return;
      g.querySelectorAll<SVGElement>('.stub[data-pin]').forEach((s) => {
        const n = comp.pinNets[Number(s.dataset.pin)];
        if (n !== undefined && n >= 0) netEls[n]?.push(s);
      });
    });
    prevNet = [];
    offsets = new Float64Array(m.edges.length);
    edgeShown = new Uint8Array(m.edges.length);
    edgeCur = new Float64Array(m.edges.length);
    pinCur = new Float64Array(m.graph.pins.length);
  }

  function clearColours() {
    for (const els of netEls)
      for (const el of els) {
        el.removeAttribute('data-v');
        el.style.removeProperty('--c');
      }
    prevNet = [];
  }

  const shallowEqual = (a: ElementState, b: ElementState) => {
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    for (const k of ka) if (a[k] !== b[k] && !(Number.isNaN(a[k]) && Number.isNaN(b[k]))) return false;
    return true;
  };

  /** Engine state plus what display symbols need (probe value, meter reading, lit indicator). */
  function liveState(m: ModelComponent, e: Engine): ElementState {
    if (WIRING.has(m.c.type)) return {};
    let s: ElementState = {};
    if (!m.isSub) {
      try {
        s = e.state(m.c.id) ?? {};
      } catch {
        s = {};
      }
    }
    const logic = (k: number) => (m.pinNets[k]! >= 0 ? e.logic(netOf(m.pinNets[k]!)) : 3);
    switch (m.c.type) {
      case 'probe':
        return { ...s, logic: logic(0) };
      case 'voltmeter':
        return s.value !== undefined ? s : { ...s, reading: e.voltage(netOf(m.pinNets[1]!)) - e.voltage(netOf(m.pinNets[0]!)) };
      case 'ammeter':
        return s.value !== undefined ? s : { ...s, reading: e.current(m.c.id, 0) };
      case 'indicator':
        return s.brightness !== undefined ? s : { ...s, brightness: logic(0) === 1 ? 1 : 0 };
      case 'seven-seg':
        return s.segments !== undefined ? s : { ...s, segments: m.pins.reduce((acc, _, k) => (logic(k) === 1 ? acc | (1 << k) : acc), 0) };
      case 'hex-display': {
        if (s.value !== undefined) return s;
        const bits = m.pins.map((_, k) => logic(k));
        return bits.some((b) => b > 1) ? s : { ...s, value: bits.reduce((acc: number, b, k) => acc | (b << k), 0) };
      }
    }
    return s;
  }

  /** Engine net of a top-level net (flatten() may merge nets tied together inside subcircuits). */
  const netOf = (n: number): number => engine?.netlist.alias?.[n] ?? n;

  /** Update the drawing from the engine. `dt`: real seconds since the last frame (moves the dots). */
  export function frame(dt = 0): void {
    const e = engine;
    const m = model;
    if (!svg || !e) return;
    // Wire colours.
    if (mode !== 'plain') {
      const range = m.voltageRange;
      for (let n = 0; n < m.conn.netCount; n++) {
        const v = mode === 'logic' ? logicAttr(e.logic(netOf(n))) : voltageColour(e.voltage(netOf(n)), range);
        if (v === prevNet[n]) continue;
        prevNet[n] = v;
        for (const el of netEls[n] ?? []) {
          if (mode === 'logic') el.setAttribute('data-v', v);
          else el.style.setProperty('--c', v);
        }
      }
    }
    // Symbol states.
    const ls = lives;
    m.comps.forEach((comp, i) => {
      const s = liveState(comp, e);
      const l = ls[i];
      if (l && !shallowEqual(s, l.state)) l.state = s;
    });
    // Currents.
    if (showCurrent && e.kind === 'analog' && m.edges.length) {
      if (pinSrc.length !== m.graph.pins.length) pinSrc = pinCurrentSources(m, e.netlist);
      for (let i = 0; i < pinSrc.length; i++) {
        let sum = 0;
        for (const src of pinSrc[i]!) sum += e.current(src.id, src.pin);
        pinCur[i] = sum;
      }
      solveEdgeCurrents(m.graph, pinCur, edgeCur);
      for (let k = 0; k < m.edges.length; k++) {
        const sp = dotSpeed(edgeCur[k]!);
        const show = sp !== 0 ? 1 : 0;
        if (reducedMotion) {
          const a = arrowEls[k];
          if (!a) continue;
          const want = show && m.edges[k]!.length >= 2 ? (sp > 0 ? 1 : 2) : 0;
          if (want !== edgeShown[k]) {
            edgeShown[k] = want;
            const mid = m.edges[k]!.mid;
            a.style.display = want ? '' : 'none';
            a.setAttribute('transform', `translate(${mid.x * G} ${mid.y * G}) rotate(${mid.angle + (want === 2 ? 180 : 0)})`);
          }
          continue;
        }
        const el = edgeEls[k];
        if (!el) continue;
        if (show !== edgeShown[k]) {
          edgeShown[k] = show;
          el.style.display = show ? '' : 'none';
        }
        if (!show) continue;
        if (running) offsets[k] = (((offsets[k]! + sp * dt) % SPACING) + SPACING) % SPACING;
        el.setAttribute('stroke-dashoffset', (-offsets[k]!).toFixed(2));
      }
    }
    if (hover) tip = describe(hover);
  }

  // Rebuild DOM handles whenever the circuit is re-rendered.
  $effect(() => {
    void model;
    void edgeEls.length;
    untrack(() => {
      collect();
      pinSrc = [];
      frame(0);
    });
  });
  // Mode or engine changed: clear and repaint.
  $effect(() => {
    void mode;
    void engine;
    untrack(() => {
      clearColours();
      pinSrc = [];
      edgeShown.fill(0);
      frame(0);
    });
  });
  $effect(() => {
    if (showCurrent) return;
    untrack(() => {
      edgeEls.forEach((el) => el && (el.style.display = 'none'));
      arrowEls.forEach((el) => el && (el.style.display = 'none'));
      edgeShown.fill(0);
    });
  });

  // Own animation loop (standalone use), paused off-screen and in hidden tabs.
  onMount(() => {
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!live) return;
    let raf = 0;
    let last = 0;
    let visible = true;
    const loop = (t: number) => {
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      frame(dt);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!raf && visible && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) start();
      else stop();
    });
    if (svg) io.observe(svg);
    const vis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', vis);
    start();
    return () => {
      stop();
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
    };
  });

  // ── Interaction ──────────────────────────────────────────────────────────
  function set(i: number, value: ParamValue) {
    const comp = model.comps[i];
    const l = lives[i];
    const it = comp?.interaction;
    if (!comp || !l || !it) return;
    if (l.params[it.key] === value) return;
    l.params = { ...l.params, [it.key]: value };
    engine?.setParam(comp.c.id, it.key, value);
    onparam?.(comp.c.id, it.key, value);
    frame(0);
  }
  function flip(i: number) {
    const it = model.comps[i]?.interaction;
    const l = lives[i];
    if (!it || !l) return;
    if (it.kind === 'toggle') set(i, !l.params[it.key]);
    else if (it.kind === 'throw') set(i, Number(l.params[it.key]) >= 0.5 ? 0 : 1);
  }
  function onKeyDown(ev: KeyboardEvent, i: number) {
    if (ev.key !== ' ' && ev.key !== 'Enter') return;
    ev.preventDefault();
    if (ev.repeat) return;
    const it = model.comps[i]?.interaction;
    if (it?.kind === 'hold') set(i, true);
    else flip(i);
  }
  function onKeyUp(ev: KeyboardEvent, i: number) {
    if ((ev.key === ' ' || ev.key === 'Enter') && model.comps[i]?.interaction?.kind === 'hold') set(i, false);
  }
  function onPointerDown(ev: PointerEvent, i: number) {
    const it = model.comps[i]?.interaction;
    if (!it || ev.button !== 0) return;
    if (it.kind === 'hold') {
      (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
      set(i, true);
    }
  }
  function onPointerUp(i: number) {
    if (model.comps[i]?.interaction?.kind === 'hold') set(i, false);
  }
  function onClick(i: number) {
    const it = model.comps[i]?.interaction;
    if (it && it.kind !== 'hold') flip(i);
  }

  function ariaLabel(i: number): string {
    const comp = model.comps[i]!;
    const l = lives[i]!;
    const name = `${comp.def.name} ${comp.c.label || comp.c.id}`;
    switch (comp.c.type) {
      case 'spdt':
        return `${name}, in position ${Number(l.params.throw) >= 0.5 ? 1 : 0}`;
      case 'toggle':
        return `${name}, outputs ${l.params.on ? 1 : 0}`;
      case 'switch':
        return `${name}, ${l.params.closed ? 'closed' : 'open'}`;
      default:
        return `${name} (hold to press)`;
    }
  }

  // ── Hover cards ──────────────────────────────────────────────────────────
  type Hover = { kind: 'net'; net: number } | { kind: 'comp'; i: number };
  let hover: Hover | null = $state(null);
  let tip: { title: string; lines: string[] } = $state({ title: '', lines: [] });
  let tipX = $state(0);
  let tipY = $state(0);

  function netTitle(n: number): string {
    const m = model;
    const named = m.conn.netNames[n];
    if (named) return named;
    const pins = [...m.conn.pinNet].filter(([, v]) => v === n).map(([k]) => k);
    return pins.length ? pins.slice(0, 3).join(' · ') + (pins.length > 3 ? ' …' : '') : `Net ${n}`;
  }
  const LEVEL = ['LOW', 'HIGH', 'unknown', 'floating'];

  function describe(h: Hover): { title: string; lines: string[] } {
    const e = engine;
    if (h.kind === 'net') {
      const lines: string[] = [];
      if (e) {
        const l = e.logic(netOf(h.net));
        if (e.kind === 'analog') lines.push(`${formatReadout(e.voltage(netOf(h.net)), 'V')} · logic ${logicChar(l)}`);
        else lines.push(`logic ${logicChar(l)} (${LEVEL[l]})`);
      }
      return { title: netTitle(h.net), lines };
    }
    const comp = model.comps[h.i]!;
    const l = lives[h.i]!;
    const lines: string[] = [];
    const value = mainValue(comp.c.type, l.params);
    if (value) lines.push(value);
    if (l.state.burned) lines.push('Burned out');
    if (e && e.kind === 'analog' && !WIRING.has(comp.c.type) && !comp.isSub) {
      const v = comp.pinNets.map((n) => (n >= 0 ? e.voltage(netOf(n)) : NaN));
      const cur = comp.pins.map((_, k) => e.current(comp.c.id, k));
      if (comp.pins.length === 2) {
        lines.push(`${formatReadout(v[0]! - v[1]!, 'V')} across`);
        lines.push(`${formatReadout(Math.abs(cur[0]!), 'A')} through`);
      } else {
        comp.pins.forEach((p, k) => lines.push(`${p.name}: ${formatReadout(v[k]!, 'V')}, ${formatReadout(cur[k]!, 'A')} in`));
      }
      const power = v.reduce((s, vk, k) => s + (Number.isFinite(vk) ? vk * cur[k]! : 0), 0);
      if (Math.abs(power) > 1e-9) lines.push(`${formatSI(power, 'W')} ${power >= 0 ? 'dissipated' : 'delivered'}`);
    } else if (e && comp.def.category !== 'wiring') {
      const outs = comp.pins.map((p, k) => (p.dir === 'out' && comp.pinNets[k]! >= 0 ? `${p.name} = ${logicChar(e.logic(netOf(comp.pinNets[k]!)))}` : '')).filter(Boolean);
      if (outs.length) lines.push(outs.join(', '));
    }
    return { title: `${comp.c.id} · ${comp.def.name}`, lines };
  }

  function moveTip(ev: PointerEvent) {
    if (!container) return;
    const r = container.getBoundingClientRect();
    tipX = Math.min(ev.clientX - r.left + 14, r.width - 180);
    tipY = ev.clientY - r.top + 16;
  }
  function enter(ev: PointerEvent, h: Hover) {
    if (!interactive) return;
    hover = h;
    tip = describe(h);
    moveTip(ev);
  }
  function leave() {
    hover = null;
  }

  const vb = $derived(viewBox ?? model.viewBox);
  const width = $derived(vb.x1 - vb.x0);
  const height = $derived(vb.y1 - vb.y0);
  const hlNets = $derived.by(() => {
    const s = new Set<number>();
    if (!highlight) return s;
    model.conn.netNames.forEach((name, n) => name && highlight.has(name) && s.add(n));
    return s;
  });
  const burned = $derived(model.comps.map((_, i) => !!lives[i]?.state.burned));
</script>

<div class="sch-wrap" class:fill bind:this={container}>
  <svg
    bind:this={svg}
    class="sch"
    class:fill
    viewBox="{vb.x0} {vb.y0} {width} {height}"
    width={fill ? '100%' : width * scale}
    height={fill ? '100%' : height * scale}
    role="group"
    aria-label={label ?? circuit.title ?? 'Circuit schematic'}
    style="--_xhatch: url(#{uid}-xhatch)"
  >
    <defs>
      <radialGradient id="{uid}-glow-warm">
        <stop offset="0" stop-color={FILAMENT.core} stop-opacity="1" />
        <stop offset="0.45" stop-color={FILAMENT.mid} stop-opacity="0.75" />
        <stop offset="1" stop-color={FILAMENT.edge} stop-opacity="0" />
      </radialGradient>
      {#each Object.entries(LED_COLOURS) as [name, c] (name)}
        <radialGradient id="{uid}-glow-{name}">
          <stop offset="0" stop-color={c.glow} stop-opacity="0.95" />
          <stop offset="0.4" stop-color={c.lit} stop-opacity="0.5" />
          <stop offset="1" stop-color={c.lit} stop-opacity="0" />
        </radialGradient>
      {/each}
      <radialGradient id="{uid}-scorch">
        <stop offset="0" stop-color="#1b120c" stop-opacity="0.8" />
        <stop offset="0.6" stop-color="#3a2414" stop-opacity="0.45" />
        <stop offset="1" stop-color="#3a2414" stop-opacity="0" />
      </radialGradient>
      <pattern id="{uid}-xhatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="4" height="4" fill="var(--_x)" opacity="0.14" />
        <rect width="1.6" height="4" fill="var(--_x)" opacity="0.75" />
      </pattern>
      <filter id="{uid}-seg-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>

    {#if highlight}
      {#each model.comps as comp (comp.c.id)}
        {#if highlight.has(comp.c.id)}
          <rect class="hl" x={comp.box.x0 - 4} y={comp.box.y0 - 4} width={comp.box.x1 - comp.box.x0 + 8} height={comp.box.y1 - comp.box.y0 + 8} rx="4" />
        {/if}
      {/each}
    {/if}

    <g class="wires">
      {#each model.wires as w, i (i)}
        <g class="w" class:hl-net={hlNets.has(w.net)} data-net={w.net}>
          <path class="halo" d={w.d} />
          <path class="main" d={w.d} />
          {#if interactive}
            <path class="hit" d={w.d} role="presentation" onpointerenter={(ev) => enter(ev, { kind: 'net', net: w.net })} onpointermove={moveTip} onpointerleave={leave} />
          {/if}
        </g>
      {/each}
    </g>

    {#each model.comps as comp, i (comp.c.id)}
      {@const Sym = symbolFor(comp.c.type)}
      {@const l = lives[i]!}
      {@const act = interactive && !!comp.interaction}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (the role is switch or button when focusable) -->
      <g
        class="comp"
        class:act
        data-cid={i}
        transform={comp.transform}
        role={act ? (comp.interaction?.kind === 'hold' ? 'button' : 'switch') : undefined}
        tabindex={act ? 0 : undefined}
        aria-label={act ? ariaLabel(i) : undefined}
        aria-checked={act && comp.interaction?.kind !== 'hold' ? !!(comp.interaction?.kind === 'throw' ? Number(l.params.throw) >= 0.5 : l.params[comp.interaction!.key]) : undefined}
        aria-pressed={act && comp.interaction?.kind === 'hold' ? !!l.params.pressed : undefined}
        onclick={act ? () => onClick(i) : undefined}
        onkeydown={act ? (ev) => onKeyDown(ev, i) : undefined}
        onkeyup={act ? (ev) => onKeyUp(ev, i) : undefined}
        onpointerdown={act ? (ev) => onPointerDown(ev, i) : undefined}
        onpointerup={act ? () => onPointerUp(i) : undefined}
        onpointercancel={act ? () => onPointerUp(i) : undefined}
        onpointerenter={interactive ? (ev) => enter(ev, { kind: 'comp', i }) : undefined}
        onpointermove={interactive ? moveTip : undefined}
        onpointerleave={interactive ? leave : undefined}
      >
        {#if interactive}
          <rect class="hit" x={comp.local.x0} y={comp.local.y0} width={comp.local.x1 - comp.local.x0} height={comp.local.y1 - comp.local.y0} />
        {/if}
        {#if act}
          <rect class="focus-ring" x={comp.local.x0 - 3} y={comp.local.y0 - 3} width={comp.local.x1 - comp.local.x0 + 6} height={comp.local.y1 - comp.local.y0 + 6} rx="4" />
        {/if}
        <Sym
          id={comp.c.id}
          type={comp.c.type}
          def={comp.def}
          params={l.params}
          pins={comp.pins}
          state={l.state}
          rot={comp.c.rot ?? 0}
          flip={!!comp.c.flip}
          {uid}
        />
      </g>
      {#if burned[i]}
        {@const cx = (comp.box.x0 + comp.box.x1) / 2}
        {@const cy = (comp.box.y0 + comp.box.y1) / 2}
        <g class="scorch">
          <ellipse {cx} {cy} rx={Math.max(14, (comp.box.x1 - comp.box.x0) * 0.45)} ry={Math.max(12, (comp.box.y1 - comp.box.y0) * 0.5)} fill="url(#{uid}-scorch)" />
          <g class="smoke">
            <circle cx={cx + 2} cy={cy - 6} r="4" />
            <circle cx={cx - 3} cy={cy - 8} r="3.5" />
            <circle cx={cx + 5} cy={cy - 4} r="3" />
          </g>
        </g>
      {/if}
    {/each}

    {#each model.junctions as j, i (i)}
      <circle class="junction" data-net={j.net} cx={j.x} cy={j.y} r="3.2" />
    {/each}
    {#each model.open as p, i (i)}
      <circle class="open-pin" cx={p.x} cy={p.y} r="2.4" />
    {/each}
    {#if pinMarks}
      {#each model.comps as comp (comp.c.id)}
        {#each comp.pinPos as p, k (k)}
          <circle cx={p[0] * G} cy={p[1] * G} r="1.3" fill="#e0245e"><title>{comp.pins[k]?.name}</title></circle>
        {/each}
      {/each}
    {/if}

    {#if showCurrent}
      <g class="currents" aria-hidden="true">
        {#each model.edges as edge, k (k)}
          {#if reducedMotion}
            <path bind:this={arrowEls[k]} class="arrow" style="display: none" d="M-4 -4 L2 0 L-4 4 Z" />
          {:else}
            <path bind:this={edgeEls[k]} class="dots" style="display: none" d={edge.d} />
          {/if}
        {/each}
      </g>
    {/if}

    {#each model.comps as comp (comp.c.id)}
      {#if comp.label}
        {@const lb = comp.label}
        <text class="lbl" x={lb.x} y={lb.y} style:font-size="{LABEL_SIZE}px">
          <tspan class="id">{lb.id}</tspan>{#if lb.value}{#if lb.stacked}<tspan class="val" x={lb.x} dy="1.25em">{lb.value}</tspan>{:else}<tspan
                class="val"
                dx="0.6em">{lb.value}</tspan
              >{/if}{/if}
        </text>
      {/if}
    {/each}

    {#each model.notes as note, i (i)}
      <text class="note" x={note.x} y={note.y}>
        {#each note.lines as line, k (k)}<tspan x={note.x} dy={k ? '1.3em' : 0}>{line}</tspan>{/each}
      </text>
    {/each}
  </svg>

  {#if mode === 'voltage' && engine}
    <div class="legend ui" aria-hidden="true">
      <span>{model.negative ? formatSI(-model.voltageRange, 'V') : '0 V'}</span>
      <span class="ramp" class:neg={model.negative}></span>
      <span>{formatSI(model.voltageRange, 'V')}</span>
    </div>
  {/if}

  {#if hover && interactive}
    <div class="tip ui" style:left="{tipX}px" style:top="{tipY}px" role="tooltip">
      <strong>{tip.title}</strong>
      {#each tip.lines as line, k (k)}<span>{line}</span>{/each}
    </div>
  {/if}
</div>

<style>
  .sch-wrap {
    position: relative;
    max-width: 100%;
  }
  .sch-wrap.fill {
    position: absolute;
    inset: 0;
    max-width: none;
    overflow: hidden;
  }
  .sch.fill {
    max-width: none;
    height: 100%;
    margin: 0;
  }
  .sch {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 0 auto;
    overflow: visible;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }
  .legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.4rem;
    margin-top: 0.2rem;
    font-family: var(--font-mono, monospace);
    font-size: 0.68rem;
    color: var(--ink-3, #635b4e);
  }
  .ramp {
    width: 5.5rem;
    height: 0.45rem;
    border-radius: 2px;
    background: linear-gradient(90deg, var(--volt-zero, #8c8c8c), var(--volt-pos, #e0482e));
  }
  .ramp.neg {
    background: linear-gradient(90deg, var(--volt-neg, #2f6fd6), var(--volt-zero, #8c8c8c), var(--volt-pos, #e0482e));
  }
  .tip {
    position: absolute;
    z-index: 5;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 8rem;
    max-width: 16rem;
    padding: 0.4rem 0.6rem;
    background: var(--surface, #fff);
    color: var(--ink, #1a1917);
    border: 1.5px solid var(--fg, #1a1917);
    border-radius: var(--radius-sm, 3px);
    box-shadow: 3px 3px 0 color-mix(in srgb, var(--fg, #000) 18%, transparent);
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.74rem;
    line-height: 1.35;
  }
  .tip strong {
    font-family: var(--font-ui, system-ui, sans-serif);
    font-size: 0.78rem;
  }
</style>
