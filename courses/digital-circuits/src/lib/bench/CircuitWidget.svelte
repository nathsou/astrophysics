<!--
  A live circuit in a chapter:

    ::circuit{src="06-shannons-switches/circuits/staircase.json" title="Two-way switching" mode="logic" speed=1 current=true}

  Loads the circuit (src relative to content/chapters/, or an inline `circuit` object), creates its
  engine through ./engines.ts, and runs it: sim time advances by `speed` × real time (sim seconds
  per real second), paused off-screen and in hidden tabs. The server renders the static schematic
  for inline circuits and a placeholder for `src` circuits.

  The abstraction dial: `::circuit{src="…" dial=true}` (or `dial="logic,switch,analog"`, `level="switch"`
  to start lower down) puts a Logic · Switches · Analog control in the toolbar. A circuit of gates is
  opened up by sim/expand: at Switches every gate becomes its CMOS transistors, drawn inside a dashed
  outline and simulated by the switch engine (a stage per unit delay, so a change ripples through); at
  Analog the same transistors are device models with parasitic capacitance, wires are coloured by
  voltage, and a timing strip shows the switching delay. The reader's switch settings travel with them
  from level to level. Levels the circuit cannot reach (a part with no transistor version, or more
  transistors than the level can show) are disabled, with the reason as their tooltip. See ./dial.ts.

  Engine options: `delayModel="transport"` (digital circuits: pass pulses shorter than a gate's delay, instead of
  the default "inertial", which swallows them) and `seed=3` (the seed of the random power-up state of gate loops
  and of metastability), e.g. `::circuit{src="…" delayModel="transport" seed=3}`. They are merged with the options
  of the abstraction level (see ./options.ts): `seed` reaches every engine, `delayModel` only the digital one.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import Widget from '../components/ui/Widget.svelte';
  import Segmented from '../components/ui/Segmented.svelte';
  import Toggle from '../components/ui/Toggle.svelte';
  import Schematic from './Schematic.svelte';
  import { buildModel, type SchematicMode } from './model';
  import TimingDiagram from './TimingDiagram.svelte';
  import type { Engine } from '../sim/engine';
  import type { Circuit, ParamValue } from '../sim/netlist/types';
  import type { SubResolver } from '../sim/netlist/connect';
  import { topLevelNets } from '../sim/netlist/flatten';
  import { createEngine } from './engines';
  import { engineOptions } from './options';
  import { resolveTraces } from './traces';
  import { formatSI, formatSpeed } from './format';
  import { describeOutputs } from './summary';
  import { encodeCircuit, shareHash } from './share';
  import Icon from '../components/ui/Icon.svelte';
  import GateFrame from './GateFrame.svelte';
  import { registerSymbol } from './symbols';
  import { defaultParts } from '../partsbin/flatten';
  import type { EngineOptions } from '../sim/engine';
  import {
    DIAL_HELP,
    DIAL_LABEL,
    DIAL_SPEED,
    autoTraces,
    availability,
    buildLevel,
    conduction,
    parseDial,
    parseLevel,
    remember,
    type Active,
    type DialLevel,
    type Inputs,
  } from './dial';

  registerSymbol('frame', GateFrame);

  let {
    src,
    circuit: inline,
    title,
    subtitle,
    caption,
    n,
    mode: initialMode,
    speed: initialSpeed = 1,
    current = false,
    traces,
    window: traceWindow,
    autoplay = true,
    toolbar = true,
    scale = 1.5,
    highlight,
    // Chapter circuits may contain `part:<id>` components: by default they come from the parts bin.
    parts = defaultParts,
    dial,
    level: initialLevel,
    delayModel,
    seed,
  }: {
    /** Path of a circuit JSON relative to content/chapters/, e.g. "06-shannons-switches/circuits/staircase.json". */
    src?: string;
    /** A circuit object (for widgets that build circuits in code). */
    circuit?: Circuit;
    title?: string;
    subtitle?: string;
    caption?: string;
    /** Figure number shown in the frame, e.g. "6.2". */
    n?: string | number;
    /** Wire colouring; default: logic for digital circuits, voltage for analog ones. */
    mode?: SchematicMode;
    /** Simulated seconds per real second (1e-8 for nanosecond logic, 1 for relays and lamps). */
    speed?: number;
    /** Show current as moving dots (analog circuits). */
    current?: boolean;
    /** Timing-diagram traces: net names, "U1.Y" pins or component ids, comma-separated. */
    traces?: string;
    /** Simulated seconds shown in the timing diagram (default: 4 real seconds' worth). */
    window?: number;
    autoplay?: boolean;
    /** Show the play/step/speed bar. */
    toolbar?: boolean;
    scale?: number;
    /** Component ids or net names to highlight, comma-separated. */
    highlight?: string;
    parts?: SubResolver;
    /** Offer the abstraction dial: true for Logic · Switches · Analog, or a list such as "logic,switch". */
    dial?: boolean | string;
    /** Level to start at: "logic", "switch" or "analog" (default: logic). */
    level?: string;
    /** Digital engine: "inertial" (default; a pulse shorter than a gate's delay is swallowed) or "transport" (it passes). */
    delayModel?: 'inertial' | 'transport';
    /** Seed for the random power-up state of gate loops and for metastability (a fixed default: figures are reproducible). */
    seed?: number;
  } = $props();

  const files = import.meta.glob<Circuit>('/content/chapters/*/circuits/*.json', { import: 'default' });
  // While prerendering the circuits are imported eagerly (so the page carries the static schematic);
  // the browser bundle loads them lazily, each when its widget mounts.
  const eagerFiles: Record<string, Circuit> = import.meta.env.SSR ? import.meta.glob<Circuit>('/content/chapters/*/circuits/*.json', { import: 'default', eager: true }) : {};
  const fileKey = (path: string) => `/content/chapters/${path.replace(/^\/+/, '')}`;

  let loaded: Circuit | undefined = $state(untrack(() => (src ? eagerFiles[fileKey(src)] : undefined)));
  let loadError = $state('');
  const authored = $derived(inline ?? loaded);

  // The abstraction dial: the levels on offer, the one shown, and what it simulates.
  const levels = $derived(parseDial(dial));
  const dialOn = $derived(levels.length > 1);
  const avail = $derived(availability(authored, levels));
  let level: DialLevel = $state(untrack(() => parseLevel(initialLevel) ?? 'logic'));
  /** The reader's switch settings, kept when the level changes. */
  let inputs: Inputs = {};
  let active: Active | undefined = $state.raw();
  let epoch = $state(0);
  const speeds: Partial<Record<DialLevel, number>> = {};
  /** What is drawn and simulated now: the circuit itself, or one level of its expansion. */
  const circuit = $derived(active?.drawn ?? authored);
  const kind = $derived(circuit?.engine ?? 'digital');
  const analog = $derived(kind === 'analog');
  const opened = $derived(!!active && active.level !== 'logic');
  // An opened-up circuit is big. Draw it at a scale that fits the figure if that stays readable (10 px labels
  // never drop below 8 px); below that the figure scrolls sideways instead.
  let figureWidth = $state(0);
  const openedScale = $derived.by(() => {
    if (!opened || !circuit) return scale;
    const vb = buildModel(circuit, parts).viewBox;
    const fit = (figureWidth - 8) / Math.max(1, vb.x1 - vb.x0);
    return Math.max(0.8, Math.min(scale * 0.72, fit));
  });

  // Settings the reader can change (seeded from the props).
  let mode: SchematicMode = $state(untrack(() => initialMode ?? (inline?.engine === 'analog' || parseLevel(initialLevel) === 'analog' ? 'voltage' : 'logic')));
  let showCurrent = $state(untrack(() => current));
  let speed = $state(
    untrack(() => {
      const l = parseLevel(initialLevel);
      return (l && DIAL_SPEED[l]) || initialSpeed;
    }),
  );
  let playing = $state(untrack(() => autoplay));
  let modeSet = untrack(() => initialMode !== undefined);
  $effect(() => {
    // Default colouring once the circuit is known.
    if (circuit && !modeSet) {
      modeSet = true;
      mode = circuit.engine === 'analog' ? 'voltage' : 'logic';
    }
  });

  let engine: Engine | null = $state(null);
  let engineError = $state('');
  let status = $state('');
  let statusLevel: 'info' | 'warning' | 'error' = $state('info');
  let simTime = $state(0);
  let generation = $state(0);
  let schematic: Schematic | undefined = $state();
  let timing: TimingDiagram | undefined = $state();
  let root: HTMLDivElement | undefined = $state();

  const highlightSet = $derived(highlight ? new Set(highlight.split(',').map((s) => s.trim())) : undefined);
  const conn = $derived(circuit ? topLevelNets(circuit, parts) : undefined);
  // Gate pins ("U1.Y") do not exist once the gates are opened up: the timing strip of the transistor levels
  // shows the parts the reader flips and what lights, unless the author named traces that still exist.
  const traceSpec = $derived(dialOn && active?.level === 'analog' ? (traces ?? (authored ? autoTraces(authored) : '')) : traces);
  const resolved = $derived(circuit && conn && traceSpec ? resolveTraces(traceSpec, circuit, conn) : { traces: [], missing: [] });
  const missingTraces = $derived(opened ? [] : resolved.missing);
  const span = $derived(traceWindow ?? speed * 4);

  // Load a circuit file (browser only; the glob is lazy).
  $effect(() => {
    if (inline || !src) return;
    const load = files[fileKey(src)];
    if (!load) {
      loadError = `Circuit not found: ${src}`;
      return;
    }
    let cancelled = false;
    load().then(
      (c) => !cancelled && (loaded = c),
      (e: unknown) => !cancelled && (loadError = `Could not load ${src}: ${String(e)}`),
    );
    return () => {
      cancelled = true;
    };
  });

  // Build the level to show whenever the circuit or the level changes (the switch settings are read, not tracked).
  $effect(() => {
    const b = authored;
    const lv = level;
    if (!b) return;
    untrack(() => {
      let a: Active | undefined;
      let lvl = lv;
      try {
        a = buildLevel(b, lvl, inputs, parts);
      } catch (err) {
        // A level that cannot be built (it was offered but failed): fall back to the gates, and say so.
        status = `Cannot show the ${DIAL_LABEL[lvl]} level: ${err instanceof Error ? err.message : String(err)}`;
        statusLevel = 'error';
        lvl = 'logic';
        a = buildLevel(b, 'logic', inputs, parts);
      }
      active = a;
      if (lvl !== lv) level = lvl;
      epoch++;
    });
  });

  // Create the engine for the circuit (again on reset).
  $effect(() => {
    const a = active;
    void generation;
    if (!a || typeof window === 'undefined') return;
    let cancelled = false;
    let made: Engine | null = null;
    engineError = '';
    if (!dialOn) status = '';
    try {
      const flat = a.netlist();
      const opts = engineOptions(a.kind, a.options, { delayModel, seed });
      if (opts.error) engineError = opts.error;
      createEngine(a.kind, flat, opts.options as EngineOptions).then(
        (e) => {
          if (cancelled) return;
          made = e;
          try {
            e.settle();
          } catch (err) {
            engineError = String(err);
          }
          engine = e;
          simTime = e.time;
        },
        (err: unknown) => !cancelled && (engineError = String(err)),
      );
    } catch (err) {
      engineError = err instanceof Error ? err.message : String(err);
    }
    return () => {
      cancelled = true;
      if (engine === made) engine = null;
    };
  });

  let shownMessages = 0;
  function pollMessages(e: Engine) {
    const msgs = e.messages;
    if (msgs.length === shownMessages) return;
    shownMessages = msgs.length;
    const last = msgs[msgs.length - 1];
    if (last) {
      status = last.text;
      statusLevel = last.level;
    }
  }

  function tick(dtReal: number) {
    const e = engine;
    if (!e) return;
    if (dtReal > 0) {
      try {
        e.advance(dtReal * speed);
      } catch (err) {
        playing = false;
        status = `Simulation stopped: ${err instanceof Error ? err.message : String(err)}`;
        statusLevel = 'error';
      }
    }
    schematic?.frame(dtReal);
    timing?.frame();
    paintTransistors(e);
    pollMessages(e);
    simTime = e.time;
  }

  function step() {
    playing = false;
    tick(0.1);
  }
  function reset() {
    shownMessages = 0;
    status = '';
    engine = null;
    inputs = {};
    if (authored) {
      active = buildLevel(authored, level, inputs, parts);
      epoch++;
    }
    generation++;
  }

  function setLevel(next: DialLevel) {
    if (next === level || !avail[next].ok || !avail[next].offered) return;
    speeds[level] = speed;
    level = next;
    speed = speeds[next] ?? DIAL_SPEED[next] ?? initialSpeed;
    mode = next === 'analog' ? 'voltage' : 'logic';
    shownMessages = 0;
    status = '';
    engine = null;
  }

  /** Colour the transistors by whether they conduct (switch level) or by region (analog level): the drawing's ink follows. */
  function paintTransistors(e: Engine) {
    const a = active;
    if (!a || !root || !opened) return;
    for (const g of root.querySelectorAll<SVGGElement>('g.comp[data-cid]')) {
      const i = Number(g.dataset.cid);
      if (!a.transistor[i]) continue;
      let c = 'x';
      try {
        c = conduction(e.state(a.ids[i]!));
      } catch {
        /* no state yet */
      }
      if (g.dataset.cond !== c) g.dataset.cond = c;
    }
  }

  function onparam(id?: string, key?: string, value?: ParamValue) {
    if (id !== undefined && key !== undefined && value !== undefined) inputs = remember(inputs, id, key, value);
    const e = engine;
    if (!e) return;
    // The switch level lets a change ripple through, a stage at a time, so it is not settled at once.
    if (!(opened && active?.level === 'switch')) {
      try {
        e.settle();
      } catch {
        /* the engine reports problems in messages */
      }
    }
    schematic?.frame(0);
    timing?.frame();
    paintTransistors(e);
    // Announce the outputs once the circuit has had time to react (a relay takes a few ms to move).
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      if (engine && circuit && conn) announcement = describeOutputs(circuit, conn, engine);
    }, 700);
  }
  let announceTimer: ReturnType<typeof setTimeout> | undefined;
  let announcement = $state('');

  onMount(() => {
    let raf = 0;
    let last = 0;
    let visible = false;
    const loop = (t: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      tick(playing ? dt : 0);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) start();
    });
    if (root) io.observe(root);
    const ro = new ResizeObserver(() => (figureWidth = root?.clientWidth ?? 0));
    if (root) ro.observe(root);
    const vis = () => !document.hidden && visible && start();
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(announceTimer);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', vis);
    };
  });

  // "Open on the bench": the circuit travels in the link (compressed, in the hash), so the bench needs no server.
  let benchHref = $state(`${base}/bench/`);
  $effect(() => {
    const c = active?.plain ?? circuit;
    if (!c) return;
    let stale = false;
    encodeCircuit(c).then(
      (payload) => !stale && (benchHref = `${base}/bench/${shareHash(payload)}`),
      () => {},
    );
    return () => {
      stale = true;
    };
  });
  function openOnBench(ev: MouseEvent) {
    if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return; // let the browser open a new tab
    ev.preventDefault();
    void goto(benchHref);
  }

  // Speed: a log slider in thirds of a decade (1, 2, 5 × 10ⁿ).
  const STEPS = [1, 2, 5];
  const speedIndex = $derived(Math.round(Math.log10(speed) * 3));
  function setSpeedIndex(i: number) {
    const decade = Math.floor(i / 3);
    speed = STEPS[((i % 3) + 3) % 3]! * 10 ** decade;
  }
  const minIndex = $derived(Math.min(-27, speedIndex - 6));
  const maxIndex = $derived(Math.max(3, speedIndex + 3));
</script>

{#snippet bar()}
    <div class="bar" role="toolbar" aria-label="Simulation controls">
      {#if dialOn}
        <div class="dial ui" role="radiogroup" aria-label="Abstraction level">
          {#each levels as l (l)}
            {@const a = avail[l]}
            <button
              type="button"
              role="radio"
              aria-checked={level === l}
              aria-disabled={!a.ok}
              class:on={level === l}
              class:off={!a.ok}
              title={a.ok ? DIAL_HELP[l] : `Not available: ${a.reason}`}
              onclick={() => setLevel(l)}>{DIAL_LABEL[l]}</button
            >
          {/each}
        </div>
      {/if}
      {#if toolbar}
      <div class="btns">
        <button class="ctl" type="button" onclick={() => (playing = !playing)} aria-label={playing ? 'Pause' : 'Run'} title={playing ? 'Pause' : 'Run'} disabled={!engine}>
          {#if playing}
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" /></svg>
          {:else}
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor" /></svg>
          {/if}
        </button>
        <button class="ctl" type="button" onclick={step} aria-label="Step" title="Step: a tenth of a second at this speed" disabled={!engine}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 5l10 7-10 7zM17 5h3v14h-3z" fill="currentColor" /></svg>
        </button>
      </div>
      <label class="speed">
        <span>Speed</span>
        <input
          type="range"
          min={minIndex}
          max={maxIndex}
          step="1"
          value={speedIndex}
          oninput={(ev) => setSpeedIndex(Number((ev.currentTarget as HTMLInputElement).value))}
          aria-valuetext="{formatSpeed(speed)} (simulated time per second)"
        />
        <output>{formatSpeed(speed)}</output>
      </label>
      {/if}
      {#if analog && toolbar}
        <Segmented
          size="sm"
          label="Wire colours"
          bind:value={mode}
          options={[
            { value: 'voltage', label: 'Volts', title: 'Colour wires by voltage' },
            { value: 'logic', label: 'Logic', title: 'Colour wires by logic level' },
            { value: 'plain', label: 'Ink', title: 'No colouring' },
          ]}
        />
        <Toggle label="Current" bind:checked={showCurrent} />
      {/if}
      {#if toolbar}<span class="time" aria-hidden="true">t = {formatSI(simTime, 's', 3)}</span>{/if}
    </div>
{/snippet}

{#snippet benchAction()}
  {#if circuit}
    <a class="w-action" href={benchHref} onclick={openOnBench} title="Open this circuit on the bench: change it, and measure it with instruments">
      <Icon name="bench" size={15} />Open on the bench
    </a>
  {/if}
{/snippet}

<Widget title={title ?? circuit?.title ?? 'Circuit'} {subtitle} {caption} {n} onreset={reset} fullscreen grid controls={toolbar || dialOn ? bar : undefined} actions={benchAction}>
  <div class="cw" bind:this={root}>
    {#if circuit}
      <div class="stage" class:opened>
        {#key `${generation}:${epoch}`}
          <Schematic
            bind:this={schematic}
            {circuit}
            {engine}
            {mode}
            showCurrent={analog && showCurrent}
            highlight={highlightSet}
            running={playing}
            scale={opened ? openedScale : scale}
            {parts}
            live={false}
            {onparam}
          />
        {/key}
      </div>
      {#if opened && active}
        <p class="key ui" aria-hidden="true">
          <span>{Object.values(active.map).reduce((n, ids) => n + ids.length, 0)} transistors in {Object.keys(active.map).length} {Object.keys(active.map).length === 1 ? 'gate' : 'gates'}</span>
          {#if active.level === 'analog'}
            <span><i class="sw on"></i>conducting</span><span><i class="sw sat"></i>saturated</span><span><i class="sw off"></i>off</span>
          {:else}
            <span><i class="sw on"></i>on</span><span><i class="sw off"></i>off</span><span><i class="sw x"></i>unknown</span>
          {/if}
        </p>
      {/if}
      {#if resolved.traces.length}
        <div class="traces">
          <TimingDiagram bind:this={timing} {engine} traces={resolved.traces} window={span} live={false} />
        </div>
      {/if}
    {:else}
      <div class="placeholder" aria-busy={!loadError}>{loadError || 'Loading circuit…'}</div>
    {/if}

    {#if engineError || status || missingTraces.length}
      <p class="status ui {engineError ? 'error' : statusLevel}" role="status">
        {engineError || status || `Unknown traces: ${missingTraces.join(', ')}`}
      </p>
    {/if}
    <p class="sr-only" role="status" aria-live="polite">{announcement}</p>
  </div>
</Widget>

<style>
  .cw {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }
  .bar {
    display: flex;
    flex: 1 1 100%;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1.1rem;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .btns {
    display: inline-flex;
    gap: 0.3rem;
  }

  /* The abstraction dial: illuminated push buttons like the other segmented controls; a level the circuit cannot reach stays dark. */
  .dial {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--pn);
    max-width: 100%;
  }
  .dial button {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    border: 0;
    border-radius: 6px;
    background: transparent;
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--ink-2);
    cursor: pointer;
    transition:
      background-color 120ms,
      color 120ms;
  }
  .dial button::before {
    content: '';
    width: 6px;
    height: 6px;
    flex: none;
    border-radius: 50%;
    background: var(--surface-3);
    box-shadow: inset 0 0 0 1px var(--line-strong);
    transition:
      background-color 150ms,
      box-shadow 150ms;
  }
  .dial button.on {
    background: var(--panel);
    color: var(--fg);
    font-weight: 600;
    box-shadow:
      0 1px 2px light-dark(rgb(40 30 10 / 0.12), rgb(0 0 0 / 0.5)),
      0 0 0 1px var(--line);
  }
  .dial button.on::before {
    background: var(--sig-high);
    box-shadow:
      0 0 6px var(--sig-high-glow),
      0 0 0 1px color-mix(in srgb, var(--sig-high) 40%, transparent);
  }
  .dial button:hover:not(.on):not(.off) {
    color: var(--fg);
    background: color-mix(in srgb, var(--panel) 50%, transparent);
  }
  .dial button.off {
    opacity: 0.45;
    cursor: not-allowed;
    text-decoration: line-through;
    text-decoration-thickness: 1px;
  }
  .dial button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  /* An opened-up circuit is big: it scrolls sideways on a narrow screen instead of shrinking past reading. */
  .stage.opened {
    overflow-x: auto;
    padding-bottom: 0.2rem;
  }
  .stage.opened :global(.sch-wrap),
  .stage.opened :global(.sch) {
    max-width: none;
  }
  /* Transistors, by whether they conduct: the drawing's ink follows (green on, amber saturated, grey off, red unknown). */
  .cw {
    --cond-on: light-dark(#0d8a3c, #63e08a);
    --cond-sat: light-dark(#c47a00, #ffc247);
    --cond-off: light-dark(#9a9488, #6e6a63);
    --cond-x: var(--sig-x, #d6332b);
  }
  .cw :global(.sch g.comp[data-cond='on']) {
    --_ink: var(--cond-on);
    filter: drop-shadow(0 0 2.5px color-mix(in srgb, var(--cond-on) 60%, transparent));
  }
  .cw :global(.sch g.comp[data-cond='sat']) {
    --_ink: var(--cond-sat);
    filter: drop-shadow(0 0 2.5px color-mix(in srgb, var(--cond-sat) 60%, transparent));
  }
  .cw :global(.sch g.comp[data-cond='off']) {
    --_ink: var(--cond-off);
  }
  .cw :global(.sch g.comp[data-cond='x']) {
    --_ink: var(--cond-x);
  }
  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1rem;
    margin: 0;
    font-size: 0.74rem;
    color: var(--ink-3);
  }
  .key span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .key .sw {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    background: var(--cond-off);
  }
  .key .sw.on {
    background: var(--cond-on);
  }
  .key .sw.sat {
    background: var(--cond-sat);
  }
  .key .sw.x {
    background: var(--cond-x);
  }
  .ctl {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.9rem;
    height: 1.9rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
    transition:
      border-color 120ms,
      color 120ms;
  }
  .ctl:hover:not(:disabled) {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .ctl:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .ctl:focus-visible,
  .speed input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .speed {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-ui);
  }
  .speed input {
    width: 7rem;
    accent-color: var(--phosphor);
  }
  .speed output {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    min-width: 4.2rem;
    color: var(--fg);
  }
  .time {
    margin-left: auto;
    /* A fixed width, so the readout does not move as the digits and the unit (µs, ms, s) change. */
    display: inline-block;
    min-width: 12ch;
    text-align: left;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--mute);
    font-variant-numeric: tabular-nums;
  }
  .placeholder {
    min-height: 12rem;
    display: grid;
    place-items: center;
    color: var(--mute);
    font-size: 0.85rem;
  }
  .traces {
    border-top: 1px solid var(--line);
    padding-top: 0.5rem;
  }
  .status {
    margin: 0;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .status.warning {
    color: var(--maybe);
  }
  .status.error {
    color: var(--bad);
    font-weight: 600;
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
</style>
