<!--
  The vPROM chip view: an address decoder driving one word line per address, a fuse at every crossing of a
  word line and a bit line, and an output buffer under each bit line. Intact fuses are drawn joined;
  blown ones are broken and glow copper. Click a fuse to select its word and output, or, in by-hand
  mode, to blow it (with a short programming pulse).
-->
<script lang="ts">
  import './chip.css';
  import type { ChipProps } from '../types';
  import type { PromFit } from '../adapters/prom';
  import { promGeom } from './prom-geometry';
  import PanZoom from './PanZoom.svelte';
  import Tip from './Tip.svelte';
  import { bin } from '../adapters/common';

  let { fit, probe, hover, run, onselect, onhover, onedit, flash, editable = false, compact = false, title }: ChipProps<PromFit> = $props();

  const chip = $derived(fit.chip);
  const prom = $derived(chip.prom);
  const g = $derived(promGeom(chip.words, chip.width, chip.addressBits));
  const uid = $props.id();

  // Highlights.
  const rowsOf = (terms: ReadonlySet<string>) => new Set([...terms].map((t) => Number(t.slice(1))));
  const colsOf = (outs: ReadonlySet<string>) => new Set([...outs].map((o) => chip.outputs.indexOf(o)).filter((c) => c >= 0));
  const selRows = $derived(rowsOf(probe.terms));
  const hovRows = $derived(rowsOf(hover.terms));
  const selCols = $derived(colsOf(probe.outputs));
  const hovCols = $derived(colsOf(hover.outputs));
  const address = $derived((run?.detail as { address?: number } | undefined)?.address ?? -1);
  const bitsOut = $derived((run?.detail as { bits?: (0 | 1)[] } | undefined)?.bits ?? []);

  // Geometry as batched paths.
  const paths = $derived.by(() => {
    const word: string[] = [];
    const intact: string[] = [];
    const body: string[] = [];
    const blown: string[] = [];
    const spark: string[] = [];
    const bit: string[] = [];
    const endX = g.xArr + g.colW * g.width;
    for (let w = 0; w < chip.words; w++) {
      const y = g.wordY(w);
      word.push(`M${g.xDec + g.wDec} ${y}H${endX}`);
      for (let c = 0; c < chip.width; c++) {
        const tx = g.fuseX(c);
        const bx = g.bitX(c);
        const ly = y + 7;
        if (prom.fuses[w * chip.width + c]) {
          blown.push(`M${tx} ${y}V${ly}h3M${bx - 3} ${ly}H${bx}`);
          const mx = (tx + bx) / 2 + 1;
          spark.push(`M${mx - 3} ${ly - 3}L${mx + 3} ${ly + 3}M${mx + 3} ${ly - 3}L${mx - 3} ${ly + 3}`);
        } else {
          intact.push(`M${tx} ${y}V${ly}H${bx}`);
          const mx = (tx + bx) / 2;
          body.push(`M${mx - 5} ${ly - 2.5}h10v5h-10z`);
        }
      }
    }
    for (let c = 0; c < chip.width; c++) bit.push(`M${g.bitX(c)} ${g.yArr - 6}V${g.yBottom + 6}`);
    return { word: word.join(''), intact: intact.join(''), body: body.join(''), blown: blown.join(''), spark: spark.join(''), bit: bit.join('') };
  });

  const ringCells = $derived.by(() => {
    const out: { w: number; c: number; kind: 'sel' | 'hov' }[] = [];
    for (const i of hover.bits) out.push({ w: Math.floor(i / chip.width), c: i % chip.width, kind: 'hov' });
    for (const i of probe.bits) out.push({ w: Math.floor(i / chip.width), c: i % chip.width, kind: 'sel' });
    return out;
  });

  // Interaction.
  let die: HTMLDivElement | undefined = $state();
  let tip = $state<{ x: number; y: number; title: string; lines: string[] } | null>(null);
  let cursor = $state({ w: 0, c: 0 });
  let focused = $state(false);
  let live = $state('');
  const flashCell = $derived.by(() => {
    if (!flash) return null;
    const [w, c] = flash.id.split(':').map(Number);
    return w === undefined || c === undefined || Number.isNaN(w) || Number.isNaN(c) ? null : { w, c, n: flash.n };
  });

  function cellText(w: number, c: number): string {
    return fit.bits.describe(w * chip.width + c);
  }
  function refOf(w: number, c: number) {
    return prom.fuses[w * chip.width + c] ? ({ kind: 'term', id: `w${w}` } as const) : ({ kind: 'output', name: chip.outputs[c]! } as const);
  }
  function act(w: number, c: number) {
    if (editable && onedit) {
      if (!prom.fuses[w * chip.width + c]) onedit({ type: 'blow', word: w, column: c });
      return;
    }
    onselect?.(refOf(w, c));
  }
  function enter(ev: PointerEvent, w: number, c: number) {
    onhover?.(refOf(w, c));
    const r = die!.getBoundingClientRect();
    tip = { x: ev.clientX - r.left, y: ev.clientY - r.top, title: `${chip.outputs[c]} at address ${bin(w, chip.addressBits)}`, lines: [cellText(w, c)] };
  }
  function leave() {
    onhover?.(null);
    tip = null;
  }
  function key(ev: KeyboardEvent): boolean {
    let { w, c } = cursor;
    if (ev.key === 'ArrowLeft') c = Math.max(0, c - 1);
    else if (ev.key === 'ArrowRight') c = Math.min(chip.width - 1, c + 1);
    else if (ev.key === 'ArrowUp') w = Math.max(0, w - 1);
    else if (ev.key === 'ArrowDown') w = Math.min(chip.words - 1, w + 1);
    else if (ev.key === 'Enter' || ev.key === ' ') {
      act(w, c);
      ev.preventDefault();
      return true;
    } else return false;
    ev.preventDefault();
    cursor = { w, c };
    live = cellText(w, c);
    onhover?.(refOf(w, c));
    return true;
  }
  const pinY = (i: number) => g.yArr + (chip.words * g.rowH) / 2 + (i - (chip.addressBits - 1) / 2) * 24;
  const level = (name: string) => run?.signals[name];
</script>

{#snippet art(k: number)}
  <defs>
    <filter id="{uid}-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2.2" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <linearGradient id="{uid}-dec" x1="0" x2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.35" />
      <stop offset="1" stop-color="#000" stop-opacity="0.12" />
    </linearGradient>
  </defs>
  <rect x="6" y="6" width={g.W - 12} height={g.H - 12} rx="10" fill="none" stroke="var(--metal-faint)" stroke-width="2" />
  <rect x="11" y="11" width={g.W - 22} height={g.H - 22} rx="7" fill="none" stroke="var(--metal-faint)" stroke-dasharray="2 4" />
  <text x="24" y="34" class="t" style="font-size: 13px; font-weight: 600; fill: var(--metal)">{title ?? fit.title}</text>
  <text x="24" y="50" class="t2">vPROM · {chip.words} words × {chip.width} bits · {prom.fuseCount} fuses</text>

  <!-- selection bands -->
  {#each { length: chip.words } as _, w (w)}
    {#if selRows.has(w) || hovRows.has(w) || address === w}
      <rect x={g.xDec + g.wDec} y={g.wordY(w) - g.rowH / 2} width={g.xArr + g.colW * chip.width - g.xDec - g.wDec + 6} height={g.rowH} fill={selRows.has(w) ? 'var(--sel-soft)' : hovRows.has(w) ? 'var(--hov-soft)' : 'color-mix(in srgb, var(--hot) 13%, transparent)'} />
    {/if}
  {/each}
  {#each { length: chip.width } as _, c (c)}
    {#if selCols.has(c) || hovCols.has(c)}
      <rect x={g.xArr + g.colW * c} y={g.yArr - 4} width={g.colW} height={chip.words * g.rowH + 8} fill={selCols.has(c) ? 'var(--sel-soft)' : 'var(--hov-soft)'} />
    {/if}
  {/each}

  <!-- decoder -->
  <rect x={g.xDec} y={g.yArr - 8} width={g.wDec} height={chip.words * g.rowH + 16} rx="6" fill="url(#{uid}-dec)" stroke="var(--metal-dim)" />
  <text x={g.xDec + g.wDec / 2} y={g.yArr - 18} text-anchor="middle" class="lbl">{chip.words}-word decoder</text>
  {#each { length: chip.addressBits } as _, i (i)}
    {@const name = chip.inputs[i]!}
    {@const v = level(name)}
    {@const py = pinY(i)}
    <path class="metal" d="M{g.xDec - 14} {py}H{g.xDec + 30}" stroke={v === 1 ? 'var(--hot)' : 'var(--metal-dim)'} stroke-width={v === 1 ? 2.4 : 1.4} />
    <circle cx={g.xDec - 14} cy={py} r="4.5" fill={v === 1 ? 'var(--hot)' : '#0a0d16'} stroke={probe.signals.has(name) || hover.signals.has(name) ? 'var(--sel)' : 'var(--metal)'} stroke-width="1.4" filter={v === 1 ? `url(#${uid}-glow)` : undefined} />
    <text x={g.xDec - 22} y={py + 4} text-anchor="end" class="t" style={probe.signals.has(name) ? 'fill: var(--sel)' : ''}>{name}</text>
    <text x={g.xDec + 34} y={py + 3.5} class="lbl">{v === undefined ? '' : v}</text>
  {/each}
  {#each { length: chip.words } as _, w (w)}
    <text x={g.xDec + g.wDec - 8} y={g.wordY(w) + 3.5} text-anchor="end" class="lbl" style={address === w ? 'fill: var(--hot); font-weight: 700' : ''}>{bin(w, chip.addressBits)}</text>
  {/each}

  <!-- lines -->
  <path class="metal" d={paths.word} stroke-width="1.6" />
  {#if address >= 0}
    <path class="metal" d="M{g.xDec + g.wDec} {g.wordY(address)}H{g.xArr + g.colW * chip.width}" stroke="var(--hot)" stroke-width="2.4" filter="url(#{uid}-glow)" />
  {/if}
  <path class="metal" d={paths.bit} stroke-width="1.6" />
  {#each bitsOut as v, c (c)}
    {#if v === 1}
      <path class="metal" d="M{g.bitX(c)} {g.yArr - 6}V{g.yBottom + 26}" stroke="var(--hot)" stroke-width="2.4" filter="url(#{uid}-glow)" />
    {/if}
  {/each}
  <path d={paths.intact} fill="none" stroke="var(--metal)" stroke-width="1.5" stroke-linejoin="round" />
  <path d={paths.body} fill="var(--metal)" stroke="none" />
  <path d={paths.blown} fill="none" stroke="var(--metal-dim)" stroke-width="1.5" />
  <path d={paths.spark} fill="none" stroke="var(--hov)" stroke-width="1.5" stroke-linecap="round" style="filter: drop-shadow(0 0 2.5px var(--hov))" />

  <!-- column heads and outputs -->
  {#each { length: chip.width } as _, c (c)}
    {@const name = chip.outputs[c]!}
    {@const v = level(name)}
    {@const on = selCols.has(c) || hovCols.has(c)}
    <text x={g.bitX(c) - 5} y={g.yArr - 30} text-anchor="middle" class="t" style="font-weight: 600; {selCols.has(c) ? 'fill: var(--sel)' : hovCols.has(c) ? 'fill: var(--hov)' : ''}">{name}</text>
    <text x={g.bitX(c) - 5} y={g.yArr - 18} text-anchor="middle" class="lbl">bit {chip.width - 1 - c}</text>
    <path d="M{g.bitX(c) - 7} {g.yBottom + 14}h14l-7 12z" fill="#0a0d16" stroke={on ? 'var(--sel)' : 'var(--metal)'} stroke-width="1.3" />
    <path class="metal" d="M{g.bitX(c)} {g.yBottom + 26}V{g.yBottom + 40}" stroke={v === 1 ? 'var(--hot)' : 'var(--metal-dim)'} stroke-width={v === 1 ? 2.4 : 1.4} />
    <circle cx={g.bitX(c)} cy={g.yBottom + 46} r="5.5" fill={v === 1 ? 'var(--hot)' : '#0a0d16'} stroke={on ? 'var(--sel)' : 'var(--metal)'} stroke-width="1.4" filter={v === 1 ? `url(#${uid}-glow)` : undefined} />
    <text x={g.bitX(c)} y={g.yBottom + 66} text-anchor="middle" class="t" style={on ? 'fill: var(--sel)' : ''}>{name}</text>
    {#if v !== undefined}<text x={g.bitX(c)} y={g.yBottom + 79} text-anchor="middle" class="lbl">{v}</text>{/if}
  {/each}

  <!-- rings for selected and hovered bits -->
  {#each ringCells as r, i (i)}
    <rect x={g.fuseX(r.c) - 6} y={g.wordY(r.w) - 5} width={g.bitX(r.c) - g.fuseX(r.c) + 12} height="19" rx="4" fill="none" stroke={r.kind === 'sel' ? 'var(--sel)' : 'var(--hov)'} stroke-width="1.5" stroke-dasharray={r.kind === 'hov' ? '3 2' : undefined} />
  {/each}

  <!-- the programming pulse -->
  {#if flashCell}
    {#key flashCell.n}
      <path class="flash-line" d="M{g.xDec + g.wDec} {g.wordY(flashCell.w)}H{g.fuseX(flashCell.c)}" stroke="#fff5d6" fill="none" stroke-linecap="round" />
      <circle class="flare" cx={(g.fuseX(flashCell.c) + g.bitX(flashCell.c)) / 2} cy={g.wordY(flashCell.w) + 7} r="6" fill="none" stroke="#fff0c0" stroke-width="2" />
    {/key}
  {/if}

  <!-- the keyboard cursor -->
  {#if focused}
    <rect x={g.fuseX(cursor.c) - 9} y={g.wordY(cursor.w) - 8} width={g.bitX(cursor.c) - g.fuseX(cursor.c) + 18} height="24" rx="5" fill="none" stroke="var(--focus)" stroke-width="2" />
  {/if}

  <!-- fuse targets -->
  {#each { length: chip.words } as _, w (w)}
    {#each { length: chip.width } as _, c (c)}
      <rect
        x={g.xArr + g.colW * c}
        y={g.wordY(w) - g.rowH / 2}
        width={g.colW}
        height={g.rowH}
        fill="transparent"
        style="cursor: {editable && !prom.fuses[w * chip.width + c] ? 'crosshair' : 'pointer'}"
        role="presentation"
        onpointerenter={(ev) => enter(ev, w, c)}
        onpointermove={(ev) => enter(ev, w, c)}
        onpointerleave={leave}
        onclick={() => act(w, c)}
      />
    {/each}
  {/each}
  <!-- k is the zoom level; the fuse detail is the same at every zoom, so it is unused here -->
  {#if k < 0}<text />{/if}
{/snippet}

<div class="die screen" class:compact bind:this={die}>
  {#if compact}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <svg
      viewBox="0 0 {g.W} {g.H}"
      width="100%"
      role="application"
      aria-label="vPROM fuse array, {chip.words} words of {chip.width} bits. Arrow keys move between fuses; Enter {editable ? 'blows' : 'selects'} one."
      tabindex="0"
      onkeydown={(ev) => void key(ev)}
      onfocus={() => (focused = true)}
      onblur={() => (focused = false)}
    >
      {@render art(1)}
    </svg>
  {:else}
    <PanZoom width={g.W} height={g.H} label="vPROM fuse array" onkey={key} onfocuschange={(f) => (focused = f)}>
      {#snippet children({ k })}
        {@render art(k)}
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
