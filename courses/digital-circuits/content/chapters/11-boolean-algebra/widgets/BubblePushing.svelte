<!--
  Bubble pushing: drag an inversion bubble across a gate and De Morgan's law redraws the gate (AND becomes
  OR, every bubble on it flips). The expression follows, and a truth table compares the network with the one
  you started from, live. "Edit" mode toggles a single bubble, which is not a legal move: watch the
  comparison turn red. Model and tests in bubbles.ts.

    ::bubble-pushing{n="11.2" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { prefersReducedMotion } from '$lib/theme/signals';
  import {
    BUBBLE_R as R,
    GATE_W,
    PRESETS,
    bodyPath,
    clone,
    compare,
    dragTarget,
    exprOf,
    gateName,
    gateOf,
    layoutNet,
    pushThrough,
    rowEnv,
    toggleBubble,
    wireValues,
    type MoveResult,
    type Net,
  } from './bubbles';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let presetId = $state('nandnand');
  const preset = $derived(PRESETS.find((p) => p.id === presetId)!);
  let net = $state<Net>(clone(PRESETS.find((p) => p.id === 'nandnand')!.net));
  let history = $state<Net[]>([]);
  let mode = $state<'push' | 'edit'>('push');
  let env = $state<Record<string, number>>({ A: 0, B: 0, C: 0, D: 0 });
  let say = $state('Drag a bubble across a gate (or click it). The bubble goes through, and De Morgan redraws the gate.');
  let ghosts = $state<{ id: number; x0: number; y0: number; x1: number; y1: number }[]>([]);
  let ghostId = 0;
  let reduced = $state(false);
  let svg: SVGSVGElement | undefined = $state();

  onMount(() => {
    reduced = prefersReducedMotion();
  });

  const geom = $derived(layoutNet(net));
  const values = $derived(wireValues(net, env));
  const cmp = $derived(compare(preset.net, net));
  const row = $derived(net.vars.reduce((m, v) => (m << 1) | (env[v] ? 1 : 0), 0));
  const gx = (id: string) => geom.gates.find((g) => g.id === id)!;

  function load(id: string) {
    presetId = id;
    net = clone(PRESETS.find((p) => p.id === id)!.net);
    history = [];
    say = 'Drag a bubble across a gate (or click it). The bubble goes through, and De Morgan redraws the gate.';
    ghosts = [];
  }

  /** Where a bubble slot is drawn. */
  function slotPos(id: string, slot: 'out' | number): { x: number; y: number } {
    const g = gx(id);
    if (slot === 'out') return { x: g.x + GATE_W + R, y: g.y };
    const p = g.pins[slot]!;
    return { x: g.x + p.edge - R, y: p.y };
  }

  function apply(r: MoveResult) {
    history = [...history, net];
    if (!reduced) {
      const next: typeof ghosts = [];
      for (const c of r.changed) {
        const g = gx(c.gate);
        const centre = { x: g.x + GATE_W / 2, y: g.y };
        const at = slotPos(c.gate, c.slot);
        next.push(c.on ? { id: ++ghostId, x0: centre.x, y0: centre.y, x1: at.x, y1: at.y } : { id: ++ghostId, x0: at.x, y0: at.y, x1: centre.x, y1: centre.y });
      }
      ghosts = next;
    }
    net = r.net;
    say = r.say;
    // The bubble that was focused may be gone: keep the keyboard in the drawing.
    queueMicrotask(() => svg?.querySelector<SVGGElement>('.bub')?.focus({ preventScroll: true }));
  }

  function act(id: string, slot: 'out' | number, direction: 'back' | 'forward' | 'click') {
    if (mode === 'edit') {
      apply(toggleBubble(net, id, slot));
      return;
    }
    const dir = direction === 'click' ? (slot === 'out' ? 'back' : 'forward') : direction;
    const t = dragTarget(net, id, slot, dir);
    if ('why' in t) {
      say = t.why;
      return;
    }
    apply(pushThrough(net, t.gate));
  }

  function undo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    net = prev;
    history = history.slice(0, -1);
    ghosts = [];
    say = 'Undone.';
  }

  // Dragging: a bubble follows the pointer, and crossing about 16 units in either direction commits the move.
  let drag = $state<{ key: string; dx: number } | null>(null);
  let dragStart = 0;
  let committed = false;
  const THRESHOLD = 16;

  function down(ev: PointerEvent, id: string, slot: 'out' | number) {
    if (ev.button !== 0) return;
    try {
      (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    } catch {
      /* a pointer that is already gone: the drag still works while it stays over the bubble */
    }
    dragStart = ev.clientX;
    committed = false;
    drag = { key: `${id}:${slot}`, dx: 0 };
  }
  function move(ev: PointerEvent, id: string, slot: 'out' | number) {
    if (!drag || drag.key !== `${id}:${slot}` || committed || !svg) return;
    const k = geom.width / svg.getBoundingClientRect().width;
    const dx = (ev.clientX - dragStart) * k;
    drag.dx = Math.max(-28, Math.min(28, dx));
    if (Math.abs(dx) >= THRESHOLD) {
      committed = true;
      drag = null;
      act(id, slot, dx > 0 ? 'forward' : 'back');
    }
  }
  function up(id: string, slot: 'out' | number) {
    const was = drag;
    drag = null;
    if (was && was.key === `${id}:${slot}` && !committed && Math.abs(was.dx) < 6) act(id, slot, 'click');
  }
  function key(ev: KeyboardEvent, id: string, slot: 'out' | number) {
    if (ev.key === 'Enter' || ev.key === ' ') act(id, slot, 'click');
    else if (ev.key === 'ArrowLeft') act(id, slot, 'back');
    else if (ev.key === 'ArrowRight') act(id, slot, 'forward');
    else return;
    ev.preventDefault();
  }

  /** Animate a ghost bubble from its start to its end, then drop it. */
  function travel(node: SVGElement, g: { id: number; x0: number; y0: number; x1: number; y1: number }) {
    const a = node.animate(
      [
        { transform: `translate(${g.x0}px, ${g.y0}px)`, opacity: 1 },
        { transform: `translate(${g.x1}px, ${g.y1}px)`, opacity: 1, offset: 0.85 },
        { transform: `translate(${g.x1}px, ${g.y1}px)`, opacity: 0 },
      ],
      { duration: 420, easing: 'ease-in-out', fill: 'forwards' },
    );
    a.onfinish = () => (ghosts = ghosts.filter((x) => x.id !== g.id));
    return { destroy: () => a.cancel() };
  }

  const nameOf = (id: string) => gateName(gateOf(net, id)!) ?? 'gate';

  /** Endpoints and wire paths. */
  interface Wire {
    d: string;
    stub?: string;
    v: number;
    stubV: number;
    key: string;
  }
  const wires = $derived.by((): Wire[] => {
    const out: Wire[] = [];
    for (const g of net.gates) {
      const to = gx(g.id);
      g.ins.forEach((p, i) => {
        const src = gateOf(net, p.src);
        const sg = src ? gx(p.src) : undefined;
        const v = geom.vars.find((x) => x.name === p.src);
        const x1 = sg ? sg.x + GATE_W + (src!.outInv ? 2 * R : 0) : v!.x + 28;
        const y1 = sg ? sg.y : v!.y;
        const pin = to.pins[i]!;
        const x2 = to.x + pin.edge - (p.inv ? 2 * R : 0);
        const mid = x1 + Math.max(14, (x2 - x1) / 2);
        const d = y1 === pin.y ? `M${x1} ${y1} H${x2}` : `M${x1} ${y1} H${mid} V${pin.y} H${x2}`;
        const sv = values.signal[p.src]!;
        out.push({ d, stub: p.inv ? `M${x2 + 2 * R} ${pin.y} H${to.x + pin.edge}` : undefined, v: sv, stubV: sv ^ 1, key: `${g.id}:${i}` });
      });
    }
    const root = gateOf(net, net.root)!;
    const rg = gx(net.root);
    out.push({ d: `M${rg.x + GATE_W + (root.outInv ? 2 * R : 0)} ${rg.y} H${geom.output.x}`, v: values.signal[net.root]!, stubV: 0, key: 'out' });
    return out;
  });

  const toggleVar = (name: string) => (env[name] = env[name] ? 0 : 1);
</script>

<Widget title="Bubble pushing" {n} {caption} onreset={() => load(presetId)}>
  {#snippet controls()}
    <Segmented size="sm" label="Circuit" value={presetId} onchange={load} options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} />
    <Segmented
      size="sm"
      label="What a click does"
      bind:value={mode}
      options={[
        { value: 'push', label: 'Push', title: 'Move a bubble through a gate (De Morgan): the function never changes' },
        { value: 'edit', label: 'Edit', title: 'Add or remove a single bubble: the function may change' },
      ]}
    />
    <Button size="sm" onclick={undo} disabled={history.length === 0}>Undo</Button>
  {/snippet}

  <div class="bp ui">
    <div class="draw">
      <svg
        bind:this={svg}
        viewBox="0 0 {geom.width} {geom.height}"
        role="group"
        aria-label="Gate diagram. Expression now: Y = {exprOf(net)}. Bubbles are buttons: Enter pushes a bubble through a gate; the arrow keys choose the direction."
        style:max-width="{Math.max(300, geom.width * 1.15)}px"
      >
        {#each wires as w (w.key)}
          <path class="wire" class:hi={w.v} d={w.d} />
          {#if w.stub}<path class="wire" class:hi={w.stubV} d={w.stub} />{/if}
        {/each}

        {#each geom.vars as v (v.name)}
          <g
            class="var"
            class:hi={env[v.name]}
            role="switch"
            tabindex="0"
            aria-checked={!!env[v.name]}
            aria-label="Input {v.name}, {env[v.name] ? 1 : 0}"
            onclick={() => toggleVar(v.name)}
            onkeydown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), toggleVar(v.name))}
          >
            <rect x={v.x - 16} y={v.y - 12} width="44" height="24" rx="5" />
            <text x={v.x - 6} y={v.y + 4}>{v.name}</text>
            <text x={v.x + 16} y={v.y + 4} class="val">{env[v.name] ? 1 : 0}</text>
          </g>
        {/each}

        {#each net.gates as g (g.id)}
          {@const p = gx(g.id)}
          <g transform="translate({p.x} {p.y})">
            <path class="body" class:hi={values.body[g.id]} d={bodyPath(g.kind)} />
            <text class="gname" x={GATE_W / 2} y="38" text-anchor="middle">{nameOf(g.id)}</text>
          </g>
        {/each}

        <!-- Bubbles and empty slots (in Edit mode). -->
        {#each net.gates as g (g.id)}
          {#each [...g.ins.map((pin, i) => ({ slot: i as 'out' | number, on: pin.inv })), { slot: 'out' as 'out' | number, on: g.outInv }] as s (s.slot)}
            {#if s.on || mode === 'edit'}
              {@const at = slotPos(g.id, s.slot)}
              {@const k = `${g.id}:${s.slot}`}
              {@const dx = drag?.key === k ? drag.dx : 0}
              <g
                class="bub"
                class:empty={!s.on}
                class:fresh={s.on && !reduced}
                role="button"
                tabindex="0"
                aria-label="{s.on ? 'Inversion bubble' : 'Empty slot'} on the {s.slot === 'out' ? 'output' : `input ${'ABCD'[s.slot as number] ?? (s.slot as number) + 1}`} of gate {g.id} ({nameOf(g.id)}). {mode === 'edit' ? 'Enter toggles it.' : 'Enter pushes it through a gate; left and right arrows choose the direction.'}"
                style:transform="translate({at.x + dx}px, {at.y}px)"
                onpointerdown={(e) => down(e, g.id, s.slot)}
                onpointermove={(e) => move(e, g.id, s.slot)}
                onpointerup={() => up(g.id, s.slot)}
                onpointercancel={() => (drag = null)}
                onkeydown={(e) => key(e, g.id, s.slot)}
              >
                <circle class="hit" r="13" />
                <circle class="dot" r={R} />
              </g>
            {/if}
          {/each}
        {/each}

        {#each ghosts as g (g.id)}
          <circle class="ghost" r={R} cx="0" cy="0" use:travel={g} />
        {/each}

        <text class="y" x={geom.output.x + 6} y={geom.output.y + 4}>Y = {values.signal[net.root]}</text>
      </svg>
      <p class="say" role="status">{say}</p>
    </div>

    <div class="side">
      <div class="ex">
        <div><span class="lab">Started with</span><code>Y = {exprOf(preset.net)}</code></div>
        <div><span class="lab">Now</span><code>Y = {exprOf(net)}</code></div>
      </div>
      <p class="verdict" class:ok={cmp.same} class:bad={!cmp.same} role="status">
        {#if cmp.same}
          Same function as the original: all {cmp.rows.length} rows agree.
        {:else}
          Not the same function: it differs on {cmp.differing} of {cmp.rows.length} rows.
          {#if cmp.counterexample}For {net.vars.map((v) => `${v} = ${cmp.counterexample!.env[v]}`).join(', ')} the original gives {cmp.counterexample.original} and this gives {cmp.counterexample.now}.{/if}
        {/if}
      </p>
      <div class="tt" role="table" aria-label="Truth table of the original and the current circuit">
        <div class="head" role="row">
          {#each net.vars as v (v)}<span role="columnheader">{v}</span>{/each}
          <span role="columnheader" class="o">was</span><span role="columnheader" class="o">now</span><span role="columnheader" class="o"></span>
        </div>
        {#each cmp.rows as r (r.m)}
          {@const e = rowEnv(net.vars, r.m)}
          <button type="button" class="tr" class:cur={r.m === row} class:diff={!r.same} role="row" onclick={() => (env = { ...env, ...e })} aria-label="Row {r.m}: {net.vars.map((v) => `${v} = ${e[v]}`).join(', ')}; was {r.original}, now {r.now}{r.same ? '' : ', different'}. Set the inputs to this row.">
            {#each net.vars as v (v)}<span>{e[v]}</span>{/each}
            <span class="o">{r.original}</span><span class="o">{r.now}</span><span class="o mark">{r.same ? '✓' : '✗'}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
</Widget>

<style>
  .bp {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
    gap: 1rem 1.5rem;
    align-items: start;
  }
  @media (max-width: 48rem) {
    .bp {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .draw {
    min-width: 0;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    margin: 0 auto;
    overflow: visible;
    touch-action: pan-y;
    font-family: var(--font-mono);
  }
  .wire {
    fill: none;
    stroke: var(--sig-low);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: stroke 120ms;
  }
  .wire.hi {
    stroke: var(--sig-high);
    stroke-width: 3.2;
    filter: drop-shadow(0 0 3px var(--sig-high-glow));
  }
  .body {
    fill: var(--panel);
    stroke: var(--fg);
    stroke-width: 2;
    stroke-linejoin: round;
    transition: fill 120ms;
  }
  .body.hi {
    fill: color-mix(in srgb, var(--sig-high) 16%, var(--panel));
  }
  .gname {
    font-size: 10px;
    font-weight: 700;
    fill: var(--mute);
    letter-spacing: 0.06em;
  }
  .y {
    font-size: 13px;
    font-weight: 700;
    fill: var(--fg);
  }
  .var {
    cursor: pointer;
    outline: none;
  }
  .var rect {
    fill: var(--pn);
    stroke: var(--line-strong);
    stroke-width: 1.5;
  }
  .var text {
    font-size: 12px;
    font-weight: 700;
    fill: var(--fg);
  }
  .var .val {
    fill: var(--sig-low);
  }
  .var.hi rect {
    stroke: var(--sig-high);
    fill: color-mix(in srgb, var(--sig-high) 14%, var(--panel));
  }
  .var.hi .val {
    fill: var(--sig-high);
  }
  .var:focus-visible rect {
    stroke: var(--focus);
    stroke-width: 2.5;
  }
  .bub {
    cursor: grab;
    outline: none;
    touch-action: none;
  }
  .bub:active {
    cursor: grabbing;
  }
  .bub .hit {
    fill: transparent;
  }
  .bub .dot {
    fill: var(--panel);
    stroke: var(--copper);
    stroke-width: 2.4;
    transition: fill 120ms;
  }
  .bub:hover .dot {
    fill: var(--copper-soft);
  }
  .bub:focus-visible .hit {
    stroke: var(--focus);
    stroke-width: 2;
  }
  .bub.empty .dot {
    stroke-dasharray: 2 2.5;
    stroke: var(--line-strong);
    fill: transparent;
  }
  .bub.empty:hover .dot {
    stroke: var(--copper);
  }
  .bub.fresh {
    animation: appear 160ms 260ms backwards;
  }
  @keyframes appear {
    from {
      opacity: 0;
    }
  }
  .ghost {
    fill: var(--copper-soft);
    stroke: var(--copper);
    stroke-width: 2.4;
    pointer-events: none;
  }
  .say {
    margin: 0.6rem 0 0;
    font-size: 0.84rem;
    color: var(--ink-2);
    line-height: 1.5;
    min-height: 2.6em;
  }
  .side {
    display: grid;
    gap: 0.7rem;
    min-width: 0;
  }
  .ex {
    display: grid;
    gap: 0.35rem;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.55rem 0.75rem;
    overflow-x: auto;
  }
  .ex div {
    display: flex;
    gap: 0.7rem;
    align-items: baseline;
    white-space: nowrap;
  }
  .lab {
    flex: none;
    width: 6.5rem;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.92rem;
    font-weight: 600;
  }
  .verdict {
    margin: 0;
    padding: 0.45rem 0.7rem;
    border-radius: 6px;
    font-size: 0.84rem;
    line-height: 1.45;
  }
  .verdict.ok {
    background: var(--ok-soft);
    color: var(--ok);
  }
  .verdict.bad {
    background: var(--bad-soft);
    color: var(--bad);
  }
  .tt {
    display: grid;
    gap: 2px;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    text-align: center;
    column-count: 1;
  }
  .head,
  .tr {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 2px;
    align-items: center;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
  }
  .head {
    color: var(--mute);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .tr {
    cursor: pointer;
  }
  .tr span {
    padding: 0.12rem 0;
    background: color-mix(in srgb, var(--pn) 70%, transparent);
    border-radius: 3px;
  }
  .tr:hover span {
    background: var(--pn);
  }
  .tr.cur span {
    background: var(--copper-soft);
    box-shadow: inset 0 0 0 1px var(--copper);
  }
  .tr.diff .o {
    color: var(--bad);
    font-weight: 700;
  }
  .tr .mark {
    color: var(--ok);
  }
  .tr.diff .mark {
    color: var(--bad);
  }
  .tr:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  @media (prefers-reduced-motion: reduce) {
    .wire,
    .body,
    .bub .dot {
      transition: none;
    }
  }
</style>
