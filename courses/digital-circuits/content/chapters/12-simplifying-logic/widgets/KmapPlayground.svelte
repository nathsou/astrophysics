<!--
  The Karnaugh-map playground. Click a cell to cycle it through 0, 1 and don't-care; drag across cells to draw a
  group (past the edge of the map to wrap round it). A legal group is a 1, 2, 4, 8 or 16 cell rectangle with no 0
  in it (no 1, if you group the zeros for a product of sums), and it is a product term. The expression and a gate
  circuit follow, and the cover is scored against the minimum that Quine–McCluskey finds. Logic in kmap.ts;
  keyboard: arrows move, 0 / 1 / x set a cell, Space cycles it, Shift+arrows select a rectangle and Enter
  makes it a group.

    ::kmap-playground{n="12.1" caption="…"}
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import type { ParamValue } from '$lib/sim/netlist/types';
  import LiveDag from '../../11-boolean-algebra/widgets/LiveDag.svelte';
  import { layoutDag } from '../../11-boolean-algebra/widgets/layout';
  import {
    EXAMPLES,
    NAMES,
    cellsOfExample,
    colLabel,
    compareCost,
    dagOf,
    groupFromSpans,
    groupProblem,
    literalsIn,
    mintermsOf,
    minimum,
    outlinePath,
    piecesOf,
    rowLabel,
    mintermAt,
    shapeOf,
    spanOf,
    status,
    target,
    textOf,
    tokensOf,
    type CellValue,
    type Mode,
    type Span,
  } from './kmap';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  const CELL = 52;
  const LEFT = 78;
  const TOP = 62;

  let vars = $state(3);
  let mode = $state<Mode>('sop');
  let exampleId = $state<string | null>('majority');
  let cells = $state<CellValue[]>(cellsOfExample(EXAMPLES.find((e) => e.id === 'majority')!));
  let groups = $state<string[]>([]);
  let showPrimes = $state(false);
  let starred = $state<string[]>([]);
  let message = $state('Click a cell to change it. Drag across cells to draw a group.');
  let messageKind = $state<'info' | 'bad' | 'good'>('info');
  let current = $state<number[]>([0, 0, 0, 0]);
  let generation = $state(0);
  let hover = $state<string | null>(null);
  let focus = $state({ r: 0, c: 0 });
  let sel = $state<{ r0: number; c0: number; r1: number; c1: number } | null>(null);
  let svg: SVGSVGElement | undefined = $state();
  let focused = $state(false);

  const shape = $derived(shapeOf(vars));
  const W = $derived(LEFT + shape.cols * CELL + 14);
  const H = $derived(TOP + shape.rows * CELL + 14);
  const names = $derived(NAMES.slice(0, vars));
  const min = $derived(minimum(shape, cells, mode));
  const st = $derived(status(shape, cells, groups, mode, min.primes));
  const example = $derived(EXAMPLES.find((e) => e.id === exampleId));
  const circuit = $derived.by(() => {
    void generation;
    const values = untrack(() => Object.fromEntries(NAMES.map((nm, v) => [nm, !!current[v]])));
    return layoutDag(dagOf(vars, groups, mode), { title: 'Circuit for the groups', values });
  });
  const currentRow = $derived(current.slice(0, vars).reduce((m, b) => (m << 1) | b, 0));
  const want = $derived(target(mode));
  const size = (cost: { terms: number; literals: number }) => cost.literals + (cost.terms > 1 ? cost.terms : 0);
  const score = $derived(st.complete && groups.length > 0 ? Math.min(100, Math.round((100 * size(min.cost)) / Math.max(1, size(st.cost)))) : undefined);
  const verdict = $derived.by((): { kind: 'good' | 'ok' | 'bad'; text: string } => {
    if (min.patterns.length === 0) return { kind: 'ok', text: mode === 'sop' ? 'There are no 1s: the function is the constant 0, and no groups are needed.' : 'There are no 0s: the function is the constant 1.' };
    if (!st.complete) {
      const bits: string[] = [];
      if (st.uncovered.length) bits.push(`${st.uncovered.length} ${want ? '1' : '0'}${st.uncovered.length === 1 ? '' : 's'} not yet in a group (minterm${st.uncovered.length === 1 ? '' : 's'} ${st.uncovered.join(', ')})`);
      if (st.wrong.length) bits.push(`${st.wrong.length} group cell${st.wrong.length === 1 ? '' : 's'} hold${st.wrong.length === 1 ? 's' : ''} the wrong value`);
      return { kind: 'bad', text: `Not yet: ${bits.join('; ')}.` };
    }
    const c = compareCost(st.cost, min.cost);
    if (c <= 0) return { kind: 'good', text: c < 0 ? 'Smaller than Quine–McCluskey’s answer?! Check the map.' : 'Minimal. No cover of this function is smaller.' };
    const extra: string[] = [];
    if (st.redundant.length) extra.push(`${st.redundant.length === 1 ? 'One group is' : 'Some groups are'} redundant: everything in ${st.redundant.length === 1 ? 'it is' : 'them is'} covered by the others`);
    if (st.growable.length) extra.push(`${st.growable.length === 1 ? 'One group' : 'Some groups'} could be bigger`);
    return { kind: 'ok', text: `Correct, but ${st.cost.terms - min.cost.terms > 0 ? `${st.cost.terms - min.cost.terms} term${st.cost.terms - min.cost.terms === 1 ? '' : 's'} and ` : ''}${st.cost.literals - min.cost.literals} literal${st.cost.literals - min.cost.literals === 1 ? '' : 's'} more than the minimum.${extra.length ? ' ' + extra.join('; ') + '.' : ''}` };
  });

  function say(text: string, kind: 'info' | 'bad' | 'good' = 'info') {
    message = text;
    messageKind = kind;
  }

  // ── Editing the function ─────────────────────────────────────────────────────
  function loadExample(id: string) {
    const e = EXAMPLES.find((x) => x.id === id)!;
    exampleId = id;
    vars = e.n;
    cells = cellsOfExample(e);
    groups = [];
    starred = [];
    mode = 'sop';
    generation++;
    focus = { r: 0, c: 0 };
    say(e.note);
  }
  function setVars(k: number) {
    exampleId = null;
    vars = k;
    cells = Array.from({ length: 2 ** k }, () => 0 as CellValue);
    groups = [];
    starred = [];
    current = [0, 0, 0, 0];
    focus = { r: 0, c: 0 };
    generation++;
    say('An empty map. Click cells to set them to 1 (and again for don’t-care).');
  }
  function setMode(m: Mode) {
    mode = m;
    groups = [];
    starred = [];
    generation++;
    say(m === 'sop' ? 'Group the 1s: each group is a product term, and the terms are ORed.' : 'Group the 0s: each group is a sum term with its variables complemented, and the terms are ANDed.');
  }
  function setCell(m: number, v: CellValue) {
    exampleId = null;
    cells[m] = v;
  }
  const cycle = (v: CellValue): CellValue => ((v + 1) % 3) as CellValue;
  function clearGroups() {
    groups = [];
    starred = [];
    generation++;
    say('Groups cleared.');
  }
  function clearCells() {
    exampleId = null;
    cells = cells.map(() => 0 as CellValue);
    groups = [];
    starred = [];
    generation++;
  }

  // ── Groups ───────────────────────────────────────────────────────────────────
  function addGroup(pattern: string) {
    if (groups.includes(pattern)) return say('You already have that group.', 'bad');
    const problem = groupProblem(shape, cells, pattern, mode);
    if (problem) return say(problem, 'bad');
    if (!mintermsOf(pattern).some((m) => cells[m] === want)) return say('That group holds only don’t-cares: it covers nothing you need, and would cost a gate.', 'bad');
    groups = [...groups, pattern];
    starred = starred.filter((p) => groups.includes(p));
    generation++;
    const lits = literalsIn(pattern);
    say(`Group added: ${mintermsOf(pattern).length} cells, ${lits} literal${lits === 1 ? '' : 's'}. ${lits === 0 ? 'It covers the whole map: the function is constant.' : `Bigger groups have fewer literals: each doubling drops one.`}`, 'good');
  }
  function removeGroup(pattern: string) {
    groups = groups.filter((g) => g !== pattern);
    starred = starred.filter((p) => p !== pattern);
    generation++;
    say('Group removed.');
  }
  function showMinimum() {
    groups = [...min.patterns];
    starred = [...min.essential];
    generation++;
    say(min.patterns.length ? `Quine–McCluskey’s minimum: ${min.cost.terms} term${min.cost.terms === 1 ? '' : 's'}, ${min.cost.literals} literal${min.cost.literals === 1 ? '' : 's'}. The starred groups are essential: they cover a cell that nothing else can.` : 'There is nothing to cover.', 'good');
  }
  function commit(rs: Span, cs: Span) {
    const g = groupFromSpans(shape, rs, cs);
    if (!g.ok) return say(g.why, 'bad');
    addGroup(g.pattern);
  }

  // ── Pointer ──────────────────────────────────────────────────────────────────
  let drag = $state<{ r0: number; c0: number; r1: number; c1: number; moved: boolean } | null>(null);
  function at(ev: PointerEvent): { r: number; c: number } {
    const box = svg!.getBoundingClientRect();
    const k = W / box.width;
    return { c: Math.floor(((ev.clientX - box.left) * k - LEFT) / CELL), r: Math.floor(((ev.clientY - box.top) * k - TOP) / CELL) };
  }
  function down(ev: PointerEvent) {
    if (ev.button !== 0 || !svg) return;
    const p = at(ev);
    if (p.r < 0 || p.r >= shape.rows || p.c < 0 || p.c >= shape.cols) return;
    try {
      svg.setPointerCapture(ev.pointerId);
    } catch {
      /* a synthetic or already-released pointer: dragging still works while the pointer stays over the map */
    }
    drag = { r0: p.r, c0: p.c, r1: p.r, c1: p.c, moved: false };
    focus = { r: p.r, c: p.c };
    sel = null;
  }
  function move(ev: PointerEvent) {
    if (!drag || !svg) return;
    const p = at(ev);
    const lim = (v: number, s: number) => Math.max(-s, Math.min(2 * s - 1, v));
    drag.r1 = lim(p.r, shape.rows);
    drag.c1 = lim(p.c, shape.cols);
    drag.moved = drag.r1 !== drag.r0 || drag.c1 !== drag.c0;
  }
  function up() {
    const d = drag;
    drag = null;
    if (!d) return;
    if (!d.moved) {
      const m = mintermAt(shape, d.r0, d.c0);
      setCell(m, cycle(cells[m]!));
      return;
    }
    commit(spanOf(d.r0, d.r1, shape.rows), spanOf(d.c0, d.c1, shape.cols));
  }
  const preview = $derived.by(() => {
    const d = drag?.moved ? drag : sel;
    if (!d) return null;
    const g = groupFromSpans(shape, spanOf(d.r0, d.r1, shape.rows), spanOf(d.c0, d.c1, shape.cols));
    if (!g.ok) return { ok: false as const, pieces: [], why: g.why };
    const why = groupProblem(shape, cells, g.pattern, mode);
    return { ok: !why, pieces: piecesOf(shape, g.pattern), why: why ?? '' };
  });

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  function key(ev: KeyboardEvent) {
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const a = arrows[ev.key];
    const m = mintermAt(shape, focus.r, focus.c);
    if (a) {
      ev.preventDefault();
      if (ev.shiftKey) {
        const s = sel ?? { r0: focus.r, c0: focus.c, r1: focus.r, c1: focus.c };
        s.r1 = Math.max(-shape.rows, Math.min(2 * shape.rows - 1, s.r1 + a[0]));
        s.c1 = Math.max(-shape.cols, Math.min(2 * shape.cols - 1, s.c1 + a[1]));
        sel = { ...s };
        return;
      }
      sel = null;
      focus = { r: Math.max(0, Math.min(shape.rows - 1, focus.r + a[0])), c: Math.max(0, Math.min(shape.cols - 1, focus.c + a[1])) };
      return;
    }
    if (ev.key === '0' || ev.key === '1') {
      ev.preventDefault();
      setCell(m, Number(ev.key) as CellValue);
    } else if (ev.key === 'x' || ev.key === 'X' || ev.key === '2') {
      ev.preventDefault();
      setCell(m, 2);
    } else if (ev.key === ' ') {
      ev.preventDefault();
      setCell(m, cycle(cells[m]!));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (sel) {
        const s = sel;
        sel = null;
        commit(spanOf(s.r0, s.r1, shape.rows), spanOf(s.c0, s.c1, shape.cols));
      } else setCell(m, cycle(cells[m]!));
    } else if (ev.key === 'Escape') sel = null;
  }

  function onparam(id: string, k: string, value: ParamValue) {
    const v = NAMES.findIndex((nm) => id === `in_${nm}`);
    if (v >= 0 && k === 'on') current[v] = value ? 1 : 0;
  }

  // ── Drawing ──────────────────────────────────────────────────────────────────
  const colour = (i: number) => `var(--series-${(i % 6) + 1})`;
  const cellXY = (r: number, c: number) => ({ x: LEFT + c * CELL, y: TOP + r * CELL });
  function pieceBox(p: { r0: number; c0: number; r1: number; c1: number; openTop: boolean; openBottom: boolean; openLeft: boolean; openRight: boolean }, inset: number) {
    const x0 = LEFT + p.c0 * CELL + (p.openLeft ? 0 : inset);
    const y0 = TOP + p.r0 * CELL + (p.openTop ? 0 : inset);
    const x1 = LEFT + (p.c1 + 1) * CELL - (p.openRight ? 0 : inset);
    const y1 = TOP + (p.r1 + 1) * CELL - (p.openBottom ? 0 : inset);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, open: { top: p.openTop, bottom: p.openBottom, left: p.openLeft, right: p.openRight } };
  }
  const groupLabel = (g: string) => textOf([g], mode, names) || (mode === 'sop' ? '1' : '0');
  const cellLabel = (m: number) => `${names.map((nm, v) => `${nm}=${(m >> (vars - 1 - v)) & 1}`).join(' ')}, minterm ${m}, ${cells[m] === 2 ? 'don’t care' : cells[m]}`;
  const primeChips = $derived(min.primes.filter((p) => !groups.includes(p)));
  const rowNames = $derived(names.slice(0, shape.rowVars).join(''));
  const colNames = $derived(names.slice(shape.rowVars).join(''));
</script>

<Widget title="Karnaugh-map playground" n={fig} {caption} onreset={() => loadExample(exampleId ?? 'majority')}>
  {#snippet controls()}
    <Segmented size="sm" label="Number of variables" value={vars} onchange={setVars} options={[2, 3, 4].map((k) => ({ value: k, label: `${k} variables` }))} />
    <Segmented size="sm" label="Examples" value={exampleId ?? ''} onchange={loadExample} options={EXAMPLES.map((e) => ({ value: e.id, label: e.label }))} />
    <Segmented
      size="sm"
      label="What to group"
      value={mode}
      onchange={setMode}
      options={[
        { value: 'sop', label: 'Group the 1s', title: 'Sum of products' },
        { value: 'pos', label: 'Group the 0s', title: 'Product of sums' },
      ]}
    />
  {/snippet}

  <div class="kp ui">
    <div class="left">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <svg
        bind:this={svg}
        class="map"
        viewBox="0 0 {W} {H}"
        role="application"
        tabindex="0"
        aria-label="Karnaugh map of {vars} variables. Arrow keys move between cells; 0, 1 and x set a cell; Space cycles it; hold Shift with the arrow keys to select a rectangle and press Enter to make it a group."
        onpointerdown={down}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={() => (drag = null)}
        onkeydown={key}
        onfocus={() => (focused = true)}
        onblur={() => (focused = false)}
      >
        <defs>
          <pattern id="kp-x" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--panel)" />
            <rect width="2" height="6" fill="var(--sig-z)" opacity="0.35" />
          </pattern>
        </defs>

        <!-- Axis labels. -->
        <text class="axis" x={LEFT - 10} y={TOP - 30} text-anchor="end">{colNames}</text>
        <text class="axis" x={LEFT - 46} y={TOP - 10}>{rowNames}</text>
        <path class="diag" d="M{LEFT - 58} {TOP - 40} L{LEFT - 2} {TOP - 2}" />
        {#each Array.from({ length: shape.cols }, (_, c) => c) as c (c)}
          <text class="gray" x={LEFT + c * CELL + CELL / 2} y={TOP - 8} text-anchor="middle">{colLabel(shape, c)}</text>
        {/each}
        {#each Array.from({ length: shape.rows }, (_, r) => r) as r (r)}
          <text class="gray" x={LEFT - 8} y={TOP + r * CELL + CELL / 2 + 4} text-anchor="end">{rowLabel(shape, r)}</text>
        {/each}

        <!-- Cells. -->
        {#each Array.from({ length: shape.rows }, (_, r) => r) as r (r)}
          {#each Array.from({ length: shape.cols }, (_, c) => c) as c (c)}
            {@const m = mintermAt(shape, r, c)}
            {@const p = cellXY(r, c)}
            {@const v = cells[m]}
            <g class="cell" class:one={v === 1} class:dc={v === 2} class:cur={m === currentRow} class:foc={focus.r === r && focus.c === c}>
              <rect class="bg" x={p.x} y={p.y} width={CELL} height={CELL} fill={v === 2 ? 'url(#kp-x)' : undefined} />
              <text class="val" x={p.x + CELL / 2} y={p.y + CELL / 2 + 8} text-anchor="middle">{v === 2 ? 'x' : v}</text>
              <text class="idx" x={p.x + CELL - 4} y={p.y + CELL - 5} text-anchor="end">{m}</text>
              <title>{cellLabel(m)}</title>
            </g>
          {/each}
        {/each}
        <rect class="frame" x={LEFT} y={TOP} width={shape.cols * CELL} height={shape.rows * CELL} />

        <!-- Prime groups, faint. -->
        {#if showPrimes}
          {#each min.primes as pr (pr)}
            {#each piecesOf(shape, pr) as p, i (i)}
              {@const b = pieceBox(p, 6)}
              <path class="prime" d={outlinePath(b.x, b.y, b.w, b.h, 9, b.open)} />
            {/each}
          {/each}
        {/if}

        <!-- The reader's groups. -->
        {#each groups as g, gi (g)}
          {@const bad = groupProblem(shape, cells, g, mode)}
          {#each piecesOf(shape, g) as p, i (i)}
            {@const b = pieceBox(p, 4 + (gi % 3) * 3)}
            <g class="grp" class:bad class:hot={hover === g} style:--gc={colour(gi)}>
              <rect class="fill" x={b.x} y={b.y} width={b.w} height={b.h} rx="9" />
              <path class="line" d={outlinePath(b.x, b.y, b.w, b.h, 9, b.open)} />
            </g>
          {/each}
        {/each}

        <!-- What is being drawn. -->
        {#if preview}
          {#each preview.pieces as p, i (i)}
            {@const b = pieceBox(p, 3)}
            <path class="preview" class:no={!preview.ok} d={outlinePath(b.x, b.y, b.w, b.h, 9, b.open)} />
          {/each}
        {/if}

        {#if focused}
          {@const f = cellXY(focus.r, focus.c)}
          <rect class="focus-ring" x={f.x + 1} y={f.y + 1} width={CELL - 2} height={CELL - 2} rx="4" />
        {/if}
      </svg>

      <p class="msg" class:bad={messageKind === 'bad'} class:good={messageKind === 'good'} role="status">{preview && !preview.ok && preview.why ? preview.why : message}</p>

      <div class="chips" aria-label="Your groups">
        {#each groups as g, gi (g)}
          <span class="chip" class:bad={groupProblem(shape, cells, g, mode)} style:--gc={colour(gi)} onmouseenter={() => (hover = g)} onmouseleave={() => (hover = null)} role="group" aria-label="Group {groupLabel(g)}">
            <i aria-hidden="true"></i>
            <span class="t">{groupLabel(g)}</span>
            {#if starred.includes(g)}<span class="star" title="Essential: it covers a cell nothing else can" aria-label="essential">★</span>{/if}
            <button type="button" class="x" onclick={() => removeGroup(g)} aria-label="Remove group {groupLabel(g)}">×</button>
          </span>
        {:else}
          <span class="none">No groups yet.</span>
        {/each}
      </div>

      <div class="actions">
        <Button size="sm" variant="primary" onclick={showMinimum}>Show me the minimum</Button>
        <Button size="sm" onclick={clearGroups} disabled={groups.length === 0}>Clear groups</Button>
        <Button size="sm" onclick={clearCells}>Clear map</Button>
        <label class="pt"><input type="checkbox" bind:checked={showPrimes} /> Show every largest group</label>
      </div>
      {#if showPrimes}
        <div class="chips" aria-label="Largest groups (prime implicants)">
          {#each primeChips as p (p)}
            <button type="button" class="chip add" onclick={() => addGroup(p)} aria-label="Add group {groupLabel(p)}"><span class="t">+ {groupLabel(p)}</span></button>
          {:else}
            <span class="none">All the largest groups are in.</span>
          {/each}
        </div>
      {/if}
    </div>

    <div class="right">
      <div class="expr" aria-label="Expression: Y = {textOf(groups, mode, names)}">
        <span class="lhs">Y =</span>
        {#each tokensOf(groups, mode, names) as t, i (i)}{#if t.t === 'lit'}<span class="lit" class:neg={t.neg}>{t.name}</span>{:else}<span class="op">{t.text}</span>{/if}{/each}
      </div>

      <div class="score" class:good={verdict.kind === 'good'} class:bad={verdict.kind === 'bad'} role="status">
        <div class="nums">
          <div><span class="k">Yours</span><b>{st.cost.terms}</b> term{st.cost.terms === 1 ? '' : 's'}, <b>{st.cost.literals}</b> literal{st.cost.literals === 1 ? '' : 's'}</div>
          <div><span class="k">Minimum</span><b>{min.cost.terms}</b> term{min.cost.terms === 1 ? '' : 's'}, <b>{min.cost.literals}</b> literal{min.cost.literals === 1 ? '' : 's'}</div>
          {#if score !== undefined}<div><span class="k">Score</span><b>{score} %</b></div>{/if}
        </div>
        <p>{verdict.text}</p>
      </div>

      <LiveDag {circuit} scale={1.0} {onparam} label="Circuit for Y = {textOf(groups, mode, names)}" />
    </div>
  </div>
</Widget>

<style>
  .kp {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 1rem 1.6rem;
    align-items: start;
  }
  @media (max-width: 52rem) {
    .kp {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .left {
    min-width: 0;
    display: grid;
    gap: 0.6rem;
    max-width: 340px;
  }
  .right {
    min-width: 0;
    display: grid;
    gap: 0.7rem;
  }
  .map {
    display: block;
    width: 100%;
    height: auto;
    touch-action: none;
    user-select: none;
    font-family: var(--font-mono);
    outline: none;
    overflow: visible;
  }
  .axis {
    font-size: 12px;
    font-weight: 700;
    fill: var(--ink-2);
    letter-spacing: 0.08em;
  }
  .diag {
    stroke: var(--line-strong);
    stroke-width: 1;
    fill: none;
  }
  .gray {
    font-size: 11px;
    fill: var(--mute);
  }
  .cell .bg {
    fill: var(--panel);
    stroke: var(--line-strong);
    stroke-width: 1;
    cursor: pointer;
  }
  .cell.one .bg {
    fill: color-mix(in srgb, var(--sig-high) 14%, var(--panel));
  }
  .cell .val {
    font-size: 22px;
    font-weight: 700;
    fill: var(--sig-low);
    pointer-events: none;
  }
  .cell.one .val {
    fill: var(--sig-high);
  }
  .cell.dc .val {
    fill: var(--mute);
    font-weight: 500;
  }
  .cell .idx {
    font-size: 9px;
    fill: var(--mute);
    pointer-events: none;
  }
  .cell.cur .bg {
    stroke: var(--copper);
    stroke-width: 2.4;
  }
  .frame {
    fill: none;
    stroke: var(--fg);
    stroke-width: 1.6;
    pointer-events: none;
  }
  .grp {
    pointer-events: none;
  }
  .grp .fill {
    fill: var(--gc);
    opacity: 0.16;
  }
  .grp .line {
    fill: none;
    stroke: var(--gc);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .grp.hot .line {
    stroke-width: 4.5;
  }
  .grp.hot .fill {
    opacity: 0.3;
  }
  .grp.bad .line {
    stroke: var(--bad);
    stroke-dasharray: 5 4;
  }
  .prime {
    fill: none;
    stroke: var(--mute);
    stroke-width: 1.5;
    stroke-dasharray: 3 4;
    pointer-events: none;
  }
  .preview {
    fill: none;
    stroke: var(--copper);
    stroke-width: 3;
    stroke-dasharray: 6 4;
    pointer-events: none;
  }
  .preview.no {
    stroke: var(--bad);
  }
  .focus-ring {
    fill: none;
    stroke: var(--focus);
    stroke-width: 2.5;
    pointer-events: none;
  }
  .msg {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.45;
    color: var(--ink-2);
    min-height: 2.9em;
  }
  .msg.bad {
    color: var(--bad);
  }
  .msg.good {
    color: var(--ok);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    min-height: 1.9rem;
    align-items: center;
  }
  .none {
    font-size: 0.8rem;
    color: var(--mute);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.15rem 0.2rem 0.15rem 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--panel);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--fg);
  }
  .chip i {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--gc);
  }
  .chip.bad {
    border-color: var(--bad);
    color: var(--bad);
  }
  .chip .star {
    color: var(--sig-high);
  }
  .chip .x {
    border: 0;
    background: none;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    color: var(--mute);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
  }
  .chip .x:hover {
    background: var(--pn);
    color: var(--fg);
  }
  .chip.add {
    padding: 0.2rem 0.6rem;
    cursor: pointer;
    border-style: dashed;
  }
  .chip.add:hover {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.5rem;
    align-items: center;
  }
  .pt {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .expr {
    font-family: var(--font-mono);
    font-size: 0.98rem;
    line-height: 1.7;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    overflow-x: auto;
    white-space: pre;
  }
  .lhs {
    color: var(--mute);
    margin-right: 0.5rem;
  }
  .lit {
    font-weight: 600;
  }
  .lit.neg {
    text-decoration: overline;
    text-decoration-thickness: 1.5px;
  }
  .op {
    color: var(--mute);
  }
  .score {
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    background: var(--panel);
    font-size: 0.86rem;
  }
  .score.good {
    background: var(--ok-soft);
    border-color: var(--ok);
  }
  .score.bad {
    background: var(--bad-soft);
    border-color: color-mix(in srgb, var(--bad) 45%, var(--line));
  }
  .score p {
    margin: 0.3rem 0 0;
    line-height: 1.45;
    color: var(--ink-2);
  }
  .nums {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1.2rem;
  }
  .nums .k {
    display: inline-block;
    min-width: 4.4rem;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  .nums b {
    font-family: var(--font-mono);
  }
</style>
