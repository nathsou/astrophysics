<!--
  A ```place block: a small design has been taken through the course's flow up to packing; you place its blocks on
  the vFPGA-S die by hand, and your wirelength cost (the half-perimeter of every net's bounding box, corrected for
  the number of terminals, exactly the placer's own wirelength term) is compared with what the simulated-annealing
  placer managed on the same seed. Beat it.

  Move a block by dragging it onto a free site or another block of its kind, or with the keyboard: arrow keys move
  between sites, Enter or Space picks a block up and puts it down, Escape lets go. Fixed blocks (the clock pad and
  pinned ports) stay where the design puts them. The lines are the nets: the ones on the block you hold are drawn
  heavier.

    id: ch30/place-lfsr
    design: |
      module Lfsr(…) { … }
    seed: 4
    pins: { "seed[0]": P12, … }
    solution: { "tile 0": "1,1", clk: P4, … }

  See place/model.ts for the fields, the cost and the checks.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Icon from '../ui/Icon.svelte';
  import Verdict from './parts/Verdict.svelte';
  import './parts/exercise.css';
  import { progress } from '$lib/state/progress.svelte';
  import { buildProblem, fromNames, score, toNames, assignOf, type Assign, type PlaceInput, type Problem, type Score } from './place/model';

  let { spec }: { spec: PlaceInput } = $props();

  const uid = $props.id();
  let problem = $state.raw<Problem | null>(null);
  let broken = $state('');
  try {
    problem = untrack(() => buildProblem(spec));
  } catch (e) {
    broken = e instanceof Error ? e.message : String(e);
  }

  // The grid, in SVG units: a tile is 100 × 100, y counts upwards on the device and downwards on the screen.
  const T = 100;
  const dev = $derived(problem?.device);
  const W = $derived((dev?.width ?? 4) * T);
  const H = $derived((dev?.height ?? 4) * T);
  interface Geo {
    x: number;
    y: number;
    w: number;
    h: number;
  }
  /** The rectangle of each site. A pad tile holds its pads side by side (top and bottom rows) or one above the other (left and right columns). */
  const geo = $derived.by<Geo[]>(() => {
    if (!problem) return [];
    const d = problem.device;
    const per = d.spec.padsPerTile;
    return problem.sites.map((s) => {
      const px = s.x * T;
      const py = (d.height - 1 - s.y) * T;
      if (s.kind === 'logic') return { x: px + 8, y: py + 8, w: T - 16, h: T - 16 };
      const slot = d.pads[s.pad]!.slot;
      const horizontal = s.y === 0 || s.y === d.height - 1;
      if (horizontal) return { x: px + 4 + (slot * (T - 8)) / per, y: py + 22, w: (T - 8) / per - 4, h: T - 44 };
      return { x: px + 22, y: py + 4 + (slot * (T - 8)) / per, w: T - 44, h: (T - 8) / per - 4 };
    });
  });

  // Every block where the exercise starts it (also in the prerendered page, where no effect runs).
  let assign = $state.raw<Assign>(untrack(() => (problem ? problem.start.slice() : new Int32Array(0))));
  let view = $state<'yours' | 'annealer'>('yours');
  let picked = $state<number | null>(null);
  let focusSite = $state(0);
  let announce = $state('');
  let showNets = $state(true);
  let checked = $state.raw<Score | null>(null);
  let showSolution = $state(false);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let stale = $state(false);

  const annealerAssign = $derived(problem ? assignOf(problem, problem.annealer) : new Int32Array(0));
  const shown = $derived(view === 'yours' ? assign : annealerAssign);
  const live = $derived(problem && assign.length ? score(spec, problem, assign) : null);
  const occupant = $derived.by(() => {
    const m = new Map<number, number>();
    shown.forEach((s, b) => m.set(s, b));
    return m;
  });
  const lines = $derived.by(() => {
    if (!problem || !showNets || !shown.length) return [] as { x1: number; y1: number; x2: number; y2: number; hot: boolean; key: string }[];
    const out: { x1: number; y1: number; x2: number; y2: number; hot: boolean; key: string }[] = [];
    const c = (b: number) => {
      const g = geo[shown[b]!]!;
      return { x: g.x + g.w / 2, y: g.y + g.h / 2 };
    };
    problem.nets.forEach((n, ni) => {
      if (!n.counted) return;
      const d = c(n.blocks[0]!);
      for (const b of n.blocks.slice(1)) {
        const p = c(b);
        out.push({ x1: d.x, y1: d.y, x2: p.x, y2: p.y, hot: picked !== null && (n.blocks.includes(picked) || false), key: `${ni}-${b}` });
      }
    });
    return out;
  });

  onMount(() => {
    progress.load();
    const saved = progress.draft<Record<string, string> | null>(spec.id, null);
    if (saved && problem) {
      try {
        assign = fromNames(problem, saved);
      } catch {
        /* an old draft for a different design */
      }
    }
    return () => clearTimeout(saveTimer);
  });

  const siteName = (s: number) => problem!.sites[s]!.name;
  const blockAt = (s: number) => occupant.get(s);
  const kindOf = (s: number) => problem!.sites[s]!.kind;

  /** Move the block `b` to site `s`, swapping with whoever is there. Returns what happened, in words. */
  function move(b: number, s: number): string {
    const p = problem!;
    const blk = p.blocks[b]!;
    if (blk.fixed) return `${blk.name} is fixed: the design puts it on ${siteName(assign[b]!)}.`;
    if ((blk.kind === 'io') !== (kindOf(s) === 'io')) return `${blk.name} is ${blk.kind === 'io' ? 'a pad block: it goes on a pad' : 'a logic tile: it goes on a tile'}.`;
    const from = assign[b]!;
    if (from === s) return `${blk.name} stays on ${siteName(s)}.`;
    const other = blockAt(s);
    const next = assign.slice();
    if (other !== undefined) {
      if (p.blocks[other]!.fixed) return `${siteName(s)} holds ${p.blocks[other]!.name}, which is fixed.`;
      next[other] = from;
    }
    next[b] = s;
    assign = next;
    checked = null;
    stale = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => progress.saveDraft(spec.id, toNames(p, assign)), 400);
    return other !== undefined ? `Moved ${blk.name} to ${siteName(s)}, and ${p.blocks[other]!.name} to ${siteName(from)}.` : `Moved ${blk.name} to ${siteName(s)}.`;
  }

  function activate(s: number) {
    if (view !== 'yours') return;
    const here = blockAt(s);
    if (picked === null) {
      if (here === undefined) return void (announce = `${siteName(s)} is free. Pick up a block first.`);
      if (problem!.blocks[here]!.fixed) return void (announce = `${problem!.blocks[here]!.name} is fixed.`);
      picked = here;
      announce = `Picked up ${problem!.blocks[here]!.name}. Choose a site to put it on, or press Escape.`;
      return;
    }
    if (here === picked) {
      picked = null;
      announce = 'Put it back.';
      return;
    }
    announce = move(picked, s);
    picked = null;
  }

  // ── Dragging ─────────────────────────────────────────────────────────────────────
  let svg: SVGSVGElement | undefined = $state();
  let drag = $state<{ block: number; x: number; y: number; started: boolean; sx: number; sy: number } | null>(null);
  function toSvg(ev: PointerEvent): { x: number; y: number } {
    const m = svg!.getScreenCTM()!.inverse();
    const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m);
    return { x: pt.x, y: pt.y };
  }
  function down(ev: PointerEvent, s: number) {
    const b = blockAt(s);
    if (view !== 'yours' || b === undefined || problem!.blocks[b]!.fixed) return;
    const p = toSvg(ev);
    drag = { block: b, x: p.x, y: p.y, started: false, sx: ev.clientX, sy: ev.clientY };
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
  }
  function moveDrag(ev: PointerEvent) {
    if (!drag) return;
    const p = toSvg(ev);
    drag = { ...drag, x: p.x, y: p.y, started: drag.started || Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > 6 };
  }
  function up(ev: PointerEvent, s: number) {
    // Not dragging (a free site, or a block that cannot move): a plain press and release is a click.
    if (!drag) return void activate(s);
    const d = drag;
    drag = null;
    if (!d.started) return void activate(s);
    const p = toSvg(ev);
    const target = geo.findIndex((g) => p.x >= g.x && p.x <= g.x + g.w && p.y >= g.y && p.y <= g.y + g.h);
    picked = null;
    announce = target < 0 ? 'Dropped outside the die: nothing moved.' : move(d.block, target);
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────────────
  function key(ev: KeyboardEvent, s: number) {
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = dirs[ev.key];
    if (d) {
      ev.preventDefault();
      const here = geo[s]!;
      let best = -1;
      let bestScore = Infinity;
      geo.forEach((g, i) => {
        if (i === s) return;
        const dx = g.x + g.w / 2 - (here.x + here.w / 2);
        const dy = g.y + g.h / 2 - (here.y + here.h / 2);
        const along = dx * d[0] + dy * d[1];
        if (along <= 1) return;
        const across = Math.abs(dx * d[1]) + Math.abs(dy * d[0]);
        const sc = along + across * 2.5;
        if (sc < bestScore) {
          bestScore = sc;
          best = i;
        }
      });
      if (best >= 0) {
        focusSite = best;
        queueMicrotask(() => svg?.querySelector<SVGGElement>(`[data-site="${best}"]`)?.focus());
      }
    } else if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      activate(s);
    } else if (ev.key === 'Escape' && picked !== null) {
      picked = null;
      announce = 'Let go.';
    }
  }

  function check() {
    if (!problem) return;
    checked = score(spec, problem, assign);
    stale = false;
    if (checked.beats) progress.markSolved(spec.id);
  }
  function reset() {
    if (!problem) return;
    assign = problem.start.slice();
    picked = null;
    checked = null;
    progress.saveDraft(spec.id, null);
    announce = 'Every block is back where it began.';
  }
  function loadSolution() {
    if (!problem || !spec.solution) return;
    assign = fromNames(problem, spec.solution);
    view = 'yours';
    checked = null;
    stale = true;
  }
  const fmt = (n: number) => n.toFixed(2);
  const label = (b: number) => problem!.blocks[b]!.name;
  /** Short text that fits in a chip: `tile 0` → `T0`, `seed[2]` stays. */
  const chipText = (b: number) => (problem!.blocks[b]!.kind === 'logic' ? `T${label(b).replace('tile ', '')}` : label(b));
  const goalCost = $derived(problem ? (spec.goal ?? 1) * problem.annealerCost : 0);
  const pct = (c: number) => (problem ? Math.min(100, (100 * c) / Math.max(1, 1.6 * problem.annealerCost)) : 0);
</script>

<ExerciseFrame id={spec.id} kind="Place" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []}>
  <div class="place">
    {#if broken}
      <p class="ex-bad">{broken}</p>
    {:else if problem}
      <div class="board">
        <div class="die">
          <svg bind:this={svg} viewBox="0 0 {W} {H}" role="group" aria-label="The vFPGA-S die: logic tiles in the middle, pads around the edge. {view === 'yours' ? 'Your placement.' : 'The annealer’s placement.'}" onpointermove={moveDrag}>
            {#each Array.from({ length: dev!.width * dev!.height }, (_, i) => i) as t (t)}
              {@const tx = Math.floor(t / dev!.height)}
              {@const ty = t % dev!.height}
              {#if dev!.tileKind[dev!.tid(tx, ty)] !== 0}
                <rect class="tile" x={tx * T + 2} y={(dev!.height - 1 - ty) * T + 2} width={T - 4} height={T - 4} rx="6" />
              {/if}
            {/each}
            {#if showNets}
              <g class="nets" aria-hidden="true">
                {#each lines as l (l.key)}
                  <line class:hot={l.hot} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
                {/each}
              </g>
            {/if}
            {#each problem.sites as s, i (i)}
              {@const g = geo[i]!}
              {@const b = blockAt(i)}
              {@const blk = b === undefined ? undefined : problem.blocks[b]}
              <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
              <g
                class="site {s.kind}"
                class:occupied={b !== undefined}
                class:picked={b !== undefined && picked === b}
                class:fixed={blk?.fixed}
                data-site={i}
                role="button"
                tabindex={focusSite === i ? 0 : -1}
                aria-label="{s.name}: {blk ? `${blk.name}${blk.fixed ? ' (fixed)' : ''}${picked === b ? ', picked up' : ''}` : 'free'}"
                aria-pressed={b !== undefined && picked === b}
                onfocus={() => (focusSite = i)}
                onkeydown={(ev) => key(ev, i)}
                onpointerdown={(ev) => down(ev, i)}
                onpointerup={(ev) => up(ev, i)}
                onclick={(ev) => {
                  // Pointer clicks are handled on pointerup (they may be drags); a click with no pointer is the keyboard or a screen reader.
                  if (ev.detail === 0) activate(i);
                }}
              >
                <rect class="slot" x={g.x} y={g.y} width={g.w} height={g.h} rx="5" />
                {#if b === undefined || (drag?.started && drag.block === b)}
                  <text class="sitelabel" x={g.x + g.w / 2} y={g.y + g.h / 2 + 3} text-anchor="middle">{s.kind === 'logic' ? `${s.x},${s.y}` : problem.device.pads[s.pad]!.name}</text>
                {:else}
                  <rect class="chip {blk!.kind}" x={g.x + 2} y={g.y + 2} width={g.w - 4} height={g.h - 4} rx="4" />
                  <text class="chiptext" x={g.x + g.w / 2} y={g.y + g.h / 2 + 3} text-anchor="middle">{chipText(b)}</text>
                  {#if blk!.kind === 'logic'}<text class="chipsub" x={g.x + g.w / 2} y={g.y + g.h / 2 + 18} text-anchor="middle">{blk!.cells} cells</text>{/if}
                {/if}
              </g>
            {/each}
            {#if drag?.started}
              <g class="ghost" pointer-events="none">
                <rect class="chip {problem.blocks[drag.block]!.kind}" x={drag.x - 26} y={drag.y - 16} width="52" height="32" rx="5" />
                <text class="chiptext" x={drag.x} y={drag.y + 4} text-anchor="middle">{chipText(drag.block)}</text>
              </g>
            {/if}
          </svg>
        </div>

        <div class="side ui">
          <div class="seg" role="radiogroup" aria-label="Which placement to show">
            <button type="button" role="radio" aria-checked={view === 'yours'} class:on={view === 'yours'} onclick={() => (view = 'yours')}>Yours</button>
            <button type="button" role="radio" aria-checked={view === 'annealer'} class:on={view === 'annealer'} onclick={() => ((view = 'annealer'), (picked = null))}>The annealer’s (seed {spec.seed})</button>
          </div>
          <dl class="score" aria-label="Wirelength cost">
            <div class:leader={live && live.cost < problem.annealerCost - 1e-9}>
              <dt>Yours</dt>
              <dd class="num">{live ? fmt(live.cost) : '–'}</dd>
              <dd class="bar" aria-hidden="true"><span style:width="{pct(live?.cost ?? 0)}%"></span></dd>
            </div>
            <div>
              <dt>Annealer, seed {spec.seed}</dt>
              <dd class="num">{fmt(problem.annealerCost)}</dd>
              <dd class="bar ann" aria-hidden="true"><span style:width="{pct(problem.annealerCost)}%"></span></dd>
            </div>
          </dl>
          <p class="ex-note goal">
            {#if live?.legal && live.cost < goalCost - 1e-9}<strong>Below the annealer’s cost by {fmt(goalCost - live.cost)}.</strong>{:else}Goal: a legal placement with a cost below {fmt(goalCost)}.{/if}
            Critical path (the placer’s estimate): yours {live?.legal ? `${live.period.toFixed(2)} ns` : '–'}, the annealer’s {problem.annealerPeriod.toFixed(2)} ns.
          </p>
          {#if live && !live.legal}
            <ul class="ex-list" aria-label="Problems with the placement">{#each live.problems.slice(0, 4) as p (p)}<li><span class="mark">✗</span> {p}</li>{/each}</ul>
          {/if}
          <label class="netbox"><input type="checkbox" bind:checked={showNets} /> Draw the nets</label>
          <p class="legend ex-note">
            <span class="lg"><span class="key logic"></span> logic tile (cells packed together)</span>
            <span class="lg"><span class="key io"></span> pad block (a port)</span>
            <span class="lg"><span class="key fx"></span> fixed</span>
          </p>
        </div>
      </div>

      <p class="ex-note keys" id="{uid}-keys">Drag a block onto a site, or use the arrow keys to move between sites, Enter to pick up and put down, Escape to let go. A block dropped on another of its kind swaps places with it.</p>
      <p class="sr" role="status" aria-live="polite">{announce}</p>
      <p class="ex-note says" aria-hidden="true">{announce}</p>

      <div class="ex-bar ui">
        <button type="button" class="check" onclick={check}><Icon name="check" size={15} /> Check</button>
        <button type="button" onclick={reset}><Icon name="reset" size={13} /> Start again</button>
      </div>

      {#if checked}
        <Verdict ok={checked.beats}>
          {#if checked.beats}Legal, and cheaper than the annealer: {fmt(checked.cost)} against {fmt(checked.annealer)}.{:else if !checked.legal}The placement is not legal.{:else if checked.cost >= checked.annealer - 1e-9 && checked.cost <= checked.annealer + 1e-9}Level with the annealer ({fmt(checked.cost)}): it has to be lower.{:else}Legal, but {fmt(checked.cost)} is not below {fmt(checked.goal)}.{/if}
          {#if stale}<span class="ex-note"> (you have moved blocks since)</span>{/if}
        </Verdict>
        {#each checked.problems as p (p)}<p class="ex-bad">{p}</p>{/each}
        {#if checked.beats && spec.explain}<div class="ex-explain">{@html spec.explain}</div>{/if}
      {/if}

      {#if spec.solution}
        <div class="ex-solution ui">
          <button type="button" onclick={() => (showSolution = !showSolution)} aria-expanded={showSolution}><Icon name="eye" size={14} /> {showSolution ? 'Hide the solution' : 'Show a solution'}</button>
          {#if showSolution}
            <pre class="ex-code">{Object.entries(spec.solution).map(([k, v]) => `${k.padEnd(10)} → ${v}`).join('\n')}</pre>
            <div class="ex-bar"><button type="button" onclick={loadSolution}>Put these blocks on the die</button></div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</ExerciseFrame>

<style>
  .place {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
  }
  .board {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.8rem;
    min-width: 0;
  }
  @media (min-width: 760px) {
    .board {
      grid-template-columns: minmax(0, 26rem) minmax(0, 1fr);
      align-items: start;
    }
  }
  .die {
    min-width: 0;
    max-width: 30rem;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  .tile {
    fill: var(--surface-2);
    stroke: var(--line);
  }
  .nets line {
    stroke: var(--ink-3);
    stroke-width: 1.1;
    opacity: 0.45;
  }
  .nets line.hot {
    stroke: var(--copper);
    stroke-width: 3;
    opacity: 0.95;
  }
  .site {
    cursor: pointer;
    outline: none;
  }
  .site .slot {
    fill: var(--surface);
    stroke: var(--line-strong);
    stroke-width: 1.2;
    stroke-dasharray: 4 3;
  }
  .site.occupied .slot {
    stroke-dasharray: none;
  }
  .site:focus-visible .slot {
    stroke: var(--focus);
    stroke-width: 3;
    stroke-dasharray: none;
  }
  .site:hover .slot {
    stroke: var(--copper);
  }
  .sitelabel {
    fill: var(--ink-3);
    font: 10px var(--font-mono);
    pointer-events: none;
  }
  .chip {
    stroke-width: 1.5;
    pointer-events: none;
  }
  .chip.logic {
    fill: var(--copper-soft);
    stroke: var(--copper);
  }
  .chip.io {
    fill: var(--ok-soft);
    stroke: var(--ok);
  }
  .site.fixed .chip {
    stroke-dasharray: 3 2;
  }
  .site.picked .chip {
    stroke: var(--focus);
    stroke-width: 3.5;
  }
  .chiptext {
    fill: var(--ink);
    font: 700 10px var(--font-mono);
    pointer-events: none;
  }
  .chipsub {
    fill: var(--ink-2);
    font: 9px var(--font-mono);
    pointer-events: none;
  }
  .ghost {
    opacity: 0.85;
  }
  .side {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
    font-size: 0.84rem;
  }
  .seg {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  .seg button {
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink-2);
    font: inherit;
    font-size: 0.8rem;
    padding: 0.3rem 0.7rem;
    min-height: 2.3rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .seg button.on {
    border-color: var(--copper);
    background: var(--copper-soft);
    color: var(--copper-ink);
    font-weight: 700;
  }
  .seg button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .score {
    margin: 0;
    display: grid;
    gap: 0.4rem;
  }
  .score > div {
    display: grid;
    grid-template-columns: 9.5rem 4rem 1fr;
    align-items: center;
    gap: 0.5rem;
  }
  @media (max-width: 480px) {
    .score > div {
      grid-template-columns: 7.2rem 3.4rem 1fr;
    }
  }
  .score dt {
    color: var(--ink-2);
  }
  .score dd {
    margin: 0;
  }
  .score .num {
    font-family: var(--font-mono);
    font-weight: 700;
    text-align: right;
  }
  .score .bar {
    height: 0.6rem;
    border: 1px solid var(--line);
    border-radius: 3px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .score .bar span {
    display: block;
    height: 100%;
    background: var(--copper);
  }
  .score .bar.ann span {
    background: var(--ink-3);
  }
  .score .leader .num {
    color: var(--ok);
  }
  .goal {
    margin: 0;
  }
  .netbox {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
  }
  .legend {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.8rem;
    align-items: center;
  }
  .lg {
    white-space: nowrap;
  }
  .key {
    display: inline-block;
    width: 0.8rem;
    height: 0.8rem;
    border: 1.5px solid;
    border-radius: 3px;
    vertical-align: -0.1rem;
    margin-right: 0.2rem;
  }
  .key.logic {
    background: var(--copper-soft);
    border-color: var(--copper);
  }
  .key.io {
    background: var(--ok-soft);
    border-color: var(--ok);
  }
  .key.fx {
    border-color: var(--ink-2);
    border-style: dashed;
  }
  .keys,
  .says {
    margin: 0;
  }
  .says {
    min-height: 1.3em;
    color: var(--ink-2);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
