<!--
  The vPLA chip view in the classic datasheet notation. Inputs enter at the top and become true and
  complement lines; each product term is a horizontal line through the AND plane (an × is an intact fuse,
  a connection), ends in an AND gate and crosses the OR plane, where each output line ORs the terms
  crossed with an ×. Below, each output has a polarity fuse (an XOR). Hover a term to light it across both
  planes; in by-hand mode click a crossing to toggle its fuse.
-->
<script lang="ts">
  import './chip.css';
  import type { ChipProps } from '../types';
  import type { PlaDeviceFit } from '../adapters/pla';
  import { plaGeom, type PlaCell } from './pla-geometry';
  import PanZoom from './PanZoom.svelte';
  import Tip from './Tip.svelte';
  import type { PlaTrace } from '../../pld/devices/pla';

  let { fit, probe, hover, run, onselect, onhover, onedit, flash, editable = false, compact = false, title }: ChipProps<PlaDeviceFit> = $props();

  const chip = $derived(fit.chip);
  const pla = $derived(chip.pla);
  const g = $derived(plaGeom(chip.inputs, chip.terms, chip.outputs));
  const uid = $props.id();
  const trace = $derived(run?.detail as PlaTrace | undefined);
  const dead = $derived(chip.info.map((t) => t.kind === 'false'));

  const rowsOf = (terms: ReadonlySet<string>) => new Set([...terms].map((t) => Number(t.slice(1))));
  const selRows = $derived(rowsOf(probe.terms));
  const hovRows = $derived(rowsOf(hover.terms));
  const outIdx = (s: ReadonlySet<string>) => new Set([...s].map((n) => pla.outputNames.indexOf(n)).filter((o) => o >= 0));
  const selOuts = $derived(outIdx(probe.outputs));
  const hovOuts = $derived(outIdx(hover.outputs));
  const inIdx = (s: ReadonlySet<string>) => new Set([...s].map((n) => pla.inputNames.indexOf(n)).filter((o) => o >= 0));
  const selIns = $derived(inIdx(probe.signals));
  const hovIns = $derived(inIdx(hover.signals));
  const active = $derived(run?.activeTerms ?? new Set<string>());
  const declaredIn = $derived(chip.declaredInputs);
  const declaredOut = $derived(chip.declaredOutputs);

  const paths = $derived.by(() => {
    const andLive: string[] = [];
    const andDim: string[] = [];
    const dots: string[] = [];
    const line: string[] = [];
    const x = (cx: number, cy: number) => `M${cx - 4} ${cy - 4}l8 8M${cx + 4} ${cy - 4}l-8 8`;
    for (let t = 0; t < g.T; t++) {
      const y = g.rowY(t);
      line.push(`M${g.xA0 - 8} ${y}H${g.xA1 + 8}M${g.xA1 + 29} ${y}H${g.xO1}`);
      for (let k = 0; k < 2 * g.I; k++) {
        const blown = pla.andFuses[t * 2 * g.I + k];
        const cx = g.andX(k);
        if (blown) dots.push(`M${cx} ${y}h0.01`);
        else (dead[t] ? andDim : andLive).push(x(cx, y));
      }
      for (let o = 0; o < g.O; o++) {
        const blown = pla.orFuses[t * g.O + o];
        const cx = g.orX(o);
        if (blown) dots.push(`M${cx} ${y}h0.01`);
        else (dead[t] ? andDim : andLive).push(x(cx, y));
      }
    }
    const inLines: string[] = [];
    for (let k = 0; k < 2 * g.I; k++) inLines.push(`M${g.andX(k)} ${g.yArr - 30}V${g.yBottom + 6}`);
    const outLines: string[] = [];
    for (let o = 0; o < g.O; o++) outLines.push(`M${g.orX(o)} ${g.yArr - 6}V${g.yBottom + 10}`);
    return { live: andLive.join(''), dim: andDim.join(''), dots: dots.join(''), line: line.join(''), inLines: inLines.join(''), outLines: outLines.join('') };
  });

  // Interaction.
  let die: HTMLDivElement | undefined = $state();
  let tip = $state<{ x: number; y: number; title: string; lines: string[] } | null>(null);
  let cursor = $state({ row: 0, col: 0 });
  let focused = $state(false);
  let live = $state('');
  const cols = $derived(2 * g.I + g.O);
  const bitIndex = $derived((c: PlaCell) => (c.plane === 'and' ? (c.term * g.I + c.input) * 2 + (c.literal === 'true' ? 0 : 1) : c.plane === 'or' ? g.T * g.I * 2 + c.term * g.O + c.output : g.T * g.I * 2 + g.T * g.O + c.output));
  const cellOf = (row: number, col: number): PlaCell | null =>
    row < g.T ? (col < 2 * g.I ? { plane: 'and', term: row, input: col >> 1, literal: col & 1 ? 'complement' : 'true' } : { plane: 'or', term: row, output: col - 2 * g.I }) : col >= 2 * g.I ? { plane: 'polarity', output: col - 2 * g.I } : null;
  const refOf = (c: PlaCell) => (c.plane === 'polarity' ? ({ kind: 'output', name: pla.outputNames[c.output]! } as const) : ({ kind: 'term', id: `t${c.term}` } as const));
  function act(c: PlaCell) {
    if (editable && onedit) onedit({ type: 'toggle', ...c });
    else onselect?.(refOf(c));
  }
  function enter(ev: PointerEvent, c: PlaCell) {
    onhover?.(refOf(c));
    const r = die!.getBoundingClientRect();
    tip = { x: ev.clientX - r.left, y: ev.clientY - r.top, title: c.plane === 'polarity' ? `Polarity of ${pla.outputNames[c.output]}` : `Product term ${c.term}`, lines: [fit.bits.describe(bitIndex(c))] };
  }
  function leave() {
    onhover?.(null);
    tip = null;
  }
  function key(ev: KeyboardEvent): boolean {
    let { row, col } = cursor;
    if (ev.key === 'ArrowLeft') col--;
    else if (ev.key === 'ArrowRight') col++;
    else if (ev.key === 'ArrowUp') row--;
    else if (ev.key === 'ArrowDown') row++;
    else if (ev.key === 'Enter' || ev.key === ' ') {
      const c = cellOf(row, col);
      if (c) act(c);
      ev.preventDefault();
      return true;
    } else return false;
    ev.preventDefault();
    row = Math.max(0, Math.min(g.T, row));
    col = Math.max(0, Math.min(cols - 1, col));
    if (row === g.T && col < 2 * g.I) col = 2 * g.I;
    cursor = { row, col };
    const c = cellOf(row, col);
    if (c) {
      live = fit.bits.describe(bitIndex(c));
      onhover?.(refOf(c));
    }
    return true;
  }
  const cursorXY = $derived(cursor.col < 2 * g.I ? g.andX(cursor.col) : g.orX(cursor.col - 2 * g.I));
  const cursorY = $derived(cursor.row < g.T ? g.rowY(cursor.row) : g.yPol);

  const flashAt = $derived.by(() => {
    if (!flash) return null;
    const p = flash.id.split(':');
    if (p[0] === 'and') return { x: g.andX(Number(p[2]) * 2 + (p[3] === 'complement' ? 1 : 0)), y: g.rowY(Number(p[1])), n: flash.n };
    if (p[0] === 'or') return { x: g.orX(Number(p[2])), y: g.rowY(Number(p[1])), n: flash.n };
    if (p[0] === 'pol') return { x: g.orX(Number(p[1])), y: g.yPol, n: flash.n };
    return null;
  });
  const level = (n: string) => run?.signals[n];
  const inLevel = (i: number) => trace?.inputs[i];
</script>

{#snippet art()}
  <defs>
    <filter id="{uid}-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2.2" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
  <rect x="6" y="6" width={g.W - 12} height={g.H - 12} rx="10" fill="none" stroke="var(--metal-faint)" stroke-width="2" />
  <rect x="11" y="11" width={g.W - 22} height={g.H - 22} rx="7" fill="none" stroke="var(--metal-faint)" stroke-dasharray="2 4" />
  <text x="24" y="34" class="t" style="font-size: 13px; font-weight: 600; fill: var(--metal)">{title ?? fit.title}</text>
  <text x="24" y="50" class="t2">vPLA · {g.I} inputs × {g.T} product terms × {g.O} outputs · {pla.fuseCount} fuses</text>
  <text x={(g.xA0 + g.xA1) / 2} y={g.yArr - 110} text-anchor="middle" class="lbl" style="letter-spacing: 0.16em">AND PLANE</text>
  <text x={(g.xO0 + g.xO1) / 2} y={g.yArr - 110} text-anchor="middle" class="lbl" style="letter-spacing: 0.16em">OR PLANE</text>

  <!-- selection bands -->
  {#each { length: g.T } as _, t (t)}
    {#if selRows.has(t) || hovRows.has(t) || active.has(`t${t}`)}
      <rect x={g.xA0 - 8} y={g.rowY(t) - g.rowH / 2} width={g.xO1 - g.xA0 + 8} height={g.rowH} fill={selRows.has(t) ? 'var(--sel-soft)' : hovRows.has(t) ? 'var(--hov-soft)' : 'color-mix(in srgb, var(--hot) 11%, transparent)'} />
    {/if}
  {/each}
  {#each { length: g.O } as _, o (o)}
    {#if selOuts.has(o) || hovOuts.has(o)}
      <rect x={g.xO0 + g.orW * o} y={g.yArr - 4} width={g.orW} height={g.yBottom - g.yArr + 190} fill={selOuts.has(o) ? 'var(--sel-soft)' : 'var(--hov-soft)'} />
    {/if}
  {/each}
  {#each { length: g.I } as _, i (i)}
    {#if selIns.has(i) || hovIns.has(i)}
      <rect x={g.xA0 + g.colW * 2 * i} y={g.yArr - 66} width={g.colW * 2} height={g.yBottom - g.yArr + 72} fill={selIns.has(i) ? 'var(--sel-soft)' : 'var(--hov-soft)'} />
    {/if}
  {/each}

  <!-- input buffers -->
  {#each { length: g.I } as _, i (i)}
    {@const name = pla.inputNames[i]!}
    {@const v = inLevel(i)}
    {@const used = i < declaredIn}
    {@const xt = g.andX(2 * i)}
    {@const xc = g.andX(2 * i + 1)}
    {@const xm = (xt + xc) / 2}
    <g opacity={used ? 1 : 0.55}>
      <circle cx={xm} cy={g.yArr - 84} r="4.5" fill={v === 1 ? 'var(--hot)' : '#0a0d16'} stroke={selIns.has(i) ? 'var(--sel)' : 'var(--metal)'} stroke-width="1.4" filter={v === 1 ? `url(#${uid}-glow)` : undefined} />
      <text x={xm} y={g.yArr - 95} text-anchor="middle" class="t" style={selIns.has(i) ? 'fill: var(--sel)' : ''}>{name}</text>
      <path class="metal" d="M{xm} {g.yArr - 79}V{g.yArr - 64}M{xt} {g.yArr - 64}H{xc}M{xt} {g.yArr - 64}V{g.yArr - 54}M{xc} {g.yArr - 64}V{g.yArr - 54}" stroke-width="1.5" stroke={v === 1 ? 'var(--hot)' : 'var(--metal-dim)'} />
      <path d="M{xt - 6} {g.yArr - 54}h12l-6 12z" fill="#0a0d16" stroke="var(--metal)" stroke-width="1.2" />
      <path d="M{xc - 6} {g.yArr - 54}h12l-6 12z" fill="#0a0d16" stroke="var(--metal)" stroke-width="1.2" />
      <circle cx={xc} cy={g.yArr - 38} r="2.6" fill="#0a0d16" stroke="var(--metal)" stroke-width="1.1" />
    </g>
  {/each}

  <!-- lines -->
  <path class="metal" d={paths.inLines} stroke-width="1.3" />
  {#each { length: g.I } as _, i (i)}
    {@const v = inLevel(i)}
    {#if v !== undefined}
      <path class="metal" d="M{g.andX(v === 1 ? 2 * i : 2 * i + 1)} {g.yArr - 30}V{g.yBottom + 6}" stroke="var(--hot)" stroke-width="2" filter="url(#{uid}-glow)" />
    {/if}
  {/each}
  <path class="metal" d={paths.line} stroke-width="1.5" />
  {#each { length: g.T } as _, t (t)}
    {#if active.has(`t${t}`)}
      <path class="metal" d="M{g.xA0 - 8} {g.rowY(t)}H{g.xA1 + 8}M{g.xA1 + 29} {g.rowY(t)}H{g.xO1}" stroke="var(--hot)" stroke-width="2.2" filter="url(#{uid}-glow)" />
    {/if}
    <path d="M{g.xA1 + 8} {g.rowY(t) - 9}H{g.xA1 + 19}A9 9 0 0 1 {g.xA1 + 19} {g.rowY(t) + 9}H{g.xA1 + 8}Z" fill="#0a0d16" stroke={selRows.has(t) ? 'var(--sel)' : 'var(--metal)'} stroke-width="1.2" />
    <text x={g.xA0 - 16} y={g.rowY(t) + 3.5} text-anchor="end" class="lbl" style={selRows.has(t) ? 'fill: var(--sel); font-weight: 700' : hovRows.has(t) ? 'fill: var(--hov)' : ''}>T{t}</text>
  {/each}
  <path class="metal" d={paths.outLines} stroke-width="1.3" />
  {#each { length: g.O } as _, o (o)}
    {#if trace?.sums[o]}
      <path class="metal" d="M{g.orX(o)} {g.yArr - 6}V{g.yBottom + 10}" stroke="var(--hot)" stroke-width="2.2" filter="url(#{uid}-glow)" />
    {/if}
  {/each}

  <!-- fuses -->
  <path d={paths.dots} fill="none" stroke="var(--metal-faint)" stroke-width="3" stroke-linecap="round" />
  <path d={paths.dim} fill="none" stroke="var(--metal-dim)" stroke-width="1.2" opacity="0.6" />
  <path d={paths.live} fill="none" stroke="var(--metal)" stroke-width="1.6" stroke-linecap="round" style="filter: drop-shadow(0 0 2px var(--metal-dim))" />

  <!-- outputs -->
  {#each { length: g.O } as _, o (o)}
    {@const name = pla.outputNames[o]!}
    {@const v = level(name)}
    {@const x = g.orX(o)}
    {@const on = selOuts.has(o) || hovOuts.has(o)}
    {@const inv = pla.polarityFuses[o] === 1}
    {@const shown = o < declaredOut}
    <g opacity={shown ? 1 : 0.55}>
      <path d="M{x - 10} {g.yBottom + 10}Q{x} {g.yBottom + 20} {x + 10} {g.yBottom + 10}Q{x + 8} {g.yBottom + 32} {x} {g.yBottom + 44}Q{x - 8} {g.yBottom + 32} {x - 10} {g.yBottom + 10}Z" fill="#0a0d16" stroke={on ? 'var(--sel)' : 'var(--metal)'} stroke-width="1.2" />
      <path class="metal" d="M{x} {g.yBottom + 44}V{g.yBottom + 54}M{x} {g.yBottom + 70}V{g.yBottom + 134}" stroke={v === 1 ? 'var(--hot)' : 'var(--metal-dim)'} stroke-width={v === 1 ? 2.2 : 1.4} />
      <circle cx={x} cy={g.yBottom + 62} r="8" fill={inv ? 'color-mix(in srgb, var(--hov) 40%, #0a0d16)' : '#0a0d16'} stroke="var(--metal)" stroke-width="1.3" />
      <path d="M{x - 4} {g.yBottom + 62}h8M{x} {g.yBottom + 58}v8" stroke="var(--metal)" stroke-width="1.2" />
      <path class="metal" d="M{x} {g.yPol - 10}V{g.yBottom + 70}" stroke-dasharray="2 3" stroke-width="1.2" />
      <!-- the polarity fuse -->
      <rect x={x - 9} y={g.yPol - 8} width="18" height="16" rx="3" fill="#0a0d16" stroke={inv ? 'var(--hov)' : 'var(--metal-dim)'} stroke-width="1.2" />
      {#if inv}<path d="M{x - 4} {g.yPol - 4}l8 8M{x + 4} {g.yPol - 4}l-8 8" stroke="var(--hov)" stroke-width="1.3" opacity="0.5" />{:else}<path d="M{x - 4} {g.yPol - 4}l8 8M{x + 4} {g.yPol - 4}l-8 8" stroke="var(--metal)" stroke-width="1.5" />{/if}
      <circle cx={x} cy={g.yBottom + 142} r="5.5" fill={v === 1 ? 'var(--hot)' : '#0a0d16'} stroke={on ? 'var(--sel)' : 'var(--metal)'} stroke-width="1.4" filter={v === 1 ? `url(#${uid}-glow)` : undefined} />
      <text x={x} y={g.yBottom + 162} text-anchor="middle" class="t" style={on ? 'fill: var(--sel)' : ''}>{name}</text>
      {#if v !== undefined && shown}<text x={x} y={g.yBottom + 175} text-anchor="middle" class="lbl">{v}</text>{/if}
    </g>
  {/each}
  <text x={g.xO0 - 10} y={g.yPol + 3.5} text-anchor="end" class="lbl">polarity ×=high</text>

  {#if flashAt}
    {#key flashAt.n}
      <circle class="flare" cx={flashAt.x} cy={flashAt.y} r="6" fill="none" stroke="#fff0c0" stroke-width="2" />
    {/key}
  {/if}
  {#if focused}
    <rect x={cursorXY - 10} y={cursorY - 10} width="20" height="20" rx="4" fill="none" stroke="var(--focus)" stroke-width="2" />
  {/if}

  <!-- fuse targets -->
  {#each { length: g.T } as _, t (t)}
    {#each { length: 2 * g.I } as _, k (k)}
      <rect x={g.andX(k) - g.colW / 2} y={g.rowY(t) - g.rowH / 2} width={g.colW} height={g.rowH} fill="transparent" style="cursor: pointer" role="presentation" onpointerenter={(ev) => enter(ev, { plane: 'and', term: t, input: k >> 1, literal: k & 1 ? 'complement' : 'true' })} onpointermove={(ev) => enter(ev, { plane: 'and', term: t, input: k >> 1, literal: k & 1 ? 'complement' : 'true' })} onpointerleave={leave} onclick={() => act({ plane: 'and', term: t, input: k >> 1, literal: k & 1 ? 'complement' : 'true' })} />
    {/each}
    {#each { length: g.O } as _, o (o)}
      <rect x={g.orX(o) - g.orW / 2} y={g.rowY(t) - g.rowH / 2} width={g.orW} height={g.rowH} fill="transparent" style="cursor: pointer" role="presentation" onpointerenter={(ev) => enter(ev, { plane: 'or', term: t, output: o })} onpointermove={(ev) => enter(ev, { plane: 'or', term: t, output: o })} onpointerleave={leave} onclick={() => act({ plane: 'or', term: t, output: o })} />
    {/each}
  {/each}
  {#each { length: g.O } as _, o (o)}
    <rect x={g.orX(o) - g.orW / 2} y={g.yPol - 12} width={g.orW} height="24" fill="transparent" style="cursor: pointer" role="presentation" onpointerenter={(ev) => enter(ev, { plane: 'polarity', output: o })} onpointerleave={leave} onclick={() => act({ plane: 'polarity', output: o })} />
  {/each}
{/snippet}

<div class="die screen" class:compact bind:this={die}>
  {#if compact}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <svg
      viewBox="0 0 {g.W} {g.H}"
      width="100%"
      role="application"
      aria-label="vPLA: AND plane and OR plane. Arrow keys move between fuses; Enter {editable ? 'toggles' : 'selects'} one."
      tabindex="0"
      onkeydown={(ev) => void key(ev)}
      onfocus={() => (focused = true)}
      onblur={() => (focused = false)}
    >
      {@render art()}
    </svg>
  {:else}
    <PanZoom width={g.W} height={g.H} label="vPLA AND and OR planes" onkey={key} onfocuschange={(f) => (focused = f)}>
      {#snippet children()}
        {@render art()}
      {/snippet}
    </PanZoom>
  {/if}
  {#if tip}<Tip x={tip.x} y={tip.y} title={tip.title} lines={tip.lines} width={die?.clientWidth ?? 400} />{/if}
  <p class="sr" aria-live="polite">{live}</p>
</div>

<style>
  .die {
    height: 100%;
    min-height: 16rem;
  }
  .die.compact {
    height: auto;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    margin: 0;
  }
</style>
