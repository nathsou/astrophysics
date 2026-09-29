<!--
  The GAL22V10 chip view: a DIP-24 package around the real 44-column AND array with its 132 rows grouped by
  output macrocell (8 to 16 product terms and an output-enable row each), the macrocells drawn as blocks
  (OR, XOR polarity, register, output enable, output buffer), and the pins down both sides. Zoom and pan;
  hover a fuse for what it means; click a fuse, a macrocell or a pin to select it. Connected crossings are ×;
  unused rows are dotted.
-->
<script lang="ts">
  import './chip.css';
  import type { ChipProps } from '../types';
  import type { GalDeviceFit } from '../adapters/gal';
  import { galFuseText } from '../adapters/gal';
  import { AR_ROW, COLUMNS, OLMC_PINS, ROWS, SP_ROW, columnSignal, olmcRows, type GalSnapshot } from '../../pld/devices/gal22v10';
  import { COL_W, ROW_H, galGeom, galHit, pinColumns, type GalHit } from './gal-geometry';
  import PanZoom from './PanZoom.svelte';

  let { fit, probe, hover, run, onselect, onhover, title }: ChipProps<GalDeviceFit> = $props();

  const chip = $derived(fit.chip);
  const g = galGeom();
  const uid = $props.id();
  const snap = $derived(run?.detail as GalSnapshot | undefined);
  let pz: PanZoom | undefined = $state();
  let box: HTMLDivElement | undefined = $state();
  let tip = $state<{ x: number; y: number; title: string; lines: string[] } | null>(null);
  let hit = $state<GalHit>(null);
  let cursor = $state({ row: 1, col: 0 });
  let focused = $state(false);
  let live = $state('');

  const pinName = (p: number) => chip.pins[p - 1]?.name ?? '';
  const pinOfName = (n: string) => chip.pins.find((q) => q.name === n && q.role !== 'nc')?.pin;
  const outIdx = (s: ReadonlySet<string>) => new Set(chip.olmcs.filter((o) => o.name && s.has(o.name)).map((o) => o.index));
  const rowsOf = (s: ReadonlySet<string>) => new Set([...s].filter((t) => /^r\d+$/.test(t)).map((t) => Number(t.slice(1))));
  const selRows = $derived(rowsOf(probe.terms));
  const hovRows = $derived(rowsOf(hover.terms));
  const selOlmc = $derived(outIdx(probe.outputs));
  const hovOlmc = $derived(outIdx(hover.outputs));
  const sigCols = (s: ReadonlySet<string>) => {
    const out = new Set<number>();
    for (const n of s) {
      const p = pinOfName(n);
      const c = p === undefined ? null : pinColumns(p);
      if (c) out.add(c[0]);
    }
    return out;
  };
  const selCols = $derived(sigCols(probe.signals));
  const hovCols = $derived(sigCols(hover.signals));
  const selPins = $derived(new Set([...probe.signals].map(pinOfName).filter((p): p is number => p !== undefined)));
  const hovPins = $derived(new Set([...hover.signals].map(pinOfName).filter((p): p is number => p !== undefined)));

  /** The level of a signal as the array sees it (registered macrocells feed back ¬Q). */
  function arrayLevel(k: number): 0 | 1 | undefined {
    if (!snap) return undefined;
    const pin = columnSignal(2 * k).pin;
    const o = chip.olmcs.find((x) => x.pin === pin);
    if (o?.registered) return snap.q[pin] ? 0 : 1;
    return snap.pins[pin] as 0 | 1;
  }

  /** Pins whose signal some live product term reads (only those routes are drawn boldly). */
  const usedPins = $derived.by(() => {
    const used = new Set<number>();
    for (let r = 0; r < ROWS; r++) {
      if (chip.rowDead[r]) continue;
      for (let c = 0; c < COLUMNS; c++) if (chip.fuses[r * COLUMNS + c] === 0) used.add(columnSignal(c).pin);
    }
    return used;
  });

  // Static geometry as batched paths (recomputed only when the fuses change).
  const paths = $derived.by(() => {
    const live: string[] = [];
    const dots: string[] = [];
    const liveRows: string[] = [];
    const deadRows: string[] = [];
    const cols: string[] = [];
    const h = 3.2;
    for (let r = 0; r < ROWS; r++) {
      const y = g.rowY(r);
      if (chip.rowDead[r]) {
        deadRows.push(`M${g.xArr} ${y}H${g.xArrEnd}`);
        continue;
      }
      liveRows.push(`M${g.xArr - 4} ${y}H${g.xArrEnd + 4}`);
      for (let c = 0; c < COLUMNS; c++) {
        const cx = g.colX(c);
        if (chip.fuses[r * COLUMNS + c] === 0) live.push(`M${cx - h} ${y - h}l${2 * h} ${2 * h}M${cx + h} ${y - h}l${-2 * h} ${2 * h}`);
        else dots.push(`M${cx} ${y}h0.01`);
      }
    }
    for (let c = 0; c < COLUMNS; c++) cols.push(`M${g.colX(c)} ${g.yBuf + 14}V${g.yArrEnd}`);
    return { x: live.join(''), dots: dots.join(''), live: liveRows.join(''), dead: deadRows.join(''), cols: cols.join('') };
  });

  const activeRows = $derived.by(() => {
    const out: number[] = [];
    if (snap) for (let r = 0; r < ROWS; r++) if (snap.rows[r] && !chip.rowDead[r]) out.push(r);
    return out;
  });

  const rowLabel = (r: number) => (r === AR_ROW ? 'AR' : r === SP_ROW ? 'SP' : (fit.bits.rowLabel(r) ?? ''));

  // Interaction.
  function pointerAt(p: { x: number; y: number } | null, ev: PointerEvent | null) {
    if (!p || !ev) {
      hit = null;
      tip = null;
      onhover?.(null);
      return;
    }
    const h = galHit(g, p.x, p.y);
    hit = h;
    const r = box!.getBoundingClientRect();
    const pos = { x: ev.clientX - r.left, y: ev.clientY - r.top };
    if (!h) {
      tip = null;
      onhover?.(null);
      return;
    }
    if (h.kind === 'fuse') {
      const fuse = h.row * COLUMNS + h.col;
      tip = { ...pos, title: `Fuse ${fuse}`, lines: [galFuseText(chip, fuse)] };
      onhover?.(refOfRow(h.row));
    } else if (h.kind === 'pin') {
      const pv = chip.pins[h.pin - 1]!;
      tip = { ...pos, title: `Pin ${h.pin}: ${pv.name || 'not connected'}`, lines: [roleText(h.pin)] };
      onhover?.(pv.name && pv.role !== 'gnd' && pv.role !== 'vcc' ? { kind: 'signal', name: pv.name } : null);
    } else {
      const o = chip.olmcs[h.index]!;
      tip = {
        ...pos,
        title: `Macrocell of pin ${o.pin}${o.name ? `: ${o.name}` : ''}`,
        lines: [o.use === 'unused' ? 'Not used.' : `${o.use === 'input' ? 'Used as an input (output enable off).' : `${o.registered ? 'Registered (D flip-flop)' : 'Combinational'}, ${o.activeHigh ? 'active high' : 'active low'}.`} ${o.termsUsed} of ${o.termCount} product terms used.`],
      };
      onhover?.(o.name ? { kind: 'output', name: o.name } : null);
    }
  }
  function roleText(pin: number): string {
    const p = chip.pins[pin - 1]!;
    switch (p.role) {
      case 'clock':
        return 'Clock of every register; also an array input.';
      case 'input':
        return 'Dedicated input.';
      case 'input-olmc':
        return 'Macrocell pin used as an input.';
      case 'output':
        return 'Output of a macrocell.';
      case 'gnd':
        return 'Ground.';
      case 'vcc':
        return 'Supply.';
      default:
        return 'Not connected.';
    }
  }
  const refOfRow = (row: number) => (chip.rowTerm[row] ? ({ kind: 'term', id: chip.rowTerm[row]! } as const) : chip.rowOutput[row] ? ({ kind: 'output', name: chip.rowOutput[row]! } as const) : null);
  function click(p: { x: number; y: number }) {
    const h = galHit(g, p.x, p.y);
    if (!h) {
      onselect?.(null);
      return;
    }
    if (h.kind === 'fuse') onselect?.(refOfRow(h.row));
    else if (h.kind === 'pin') {
      const pv = chip.pins[h.pin - 1]!;
      if (pv.name && pv.role !== 'gnd' && pv.role !== 'vcc') onselect?.({ kind: 'signal', name: pv.name });
    } else {
      const o = chip.olmcs[h.index]!;
      if (o.name) onselect?.({ kind: 'output', name: o.name });
    }
  }
  function focusOlmc(index: number) {
    const gr = g.group[index]!;
    pz?.focus({ x: g.xArr - 40, y: gr.top - 12, w: g.xBlock1 - g.xArr + 120, h: gr.bottom - gr.top + 24 });
  }
  function dbl(ev: MouseEvent) {
    if (hit?.kind === 'olmc') focusOlmc(hit.index);
    else if (hit?.kind === 'fuse') {
      const o = chip.olmcs.findIndex((q) => hit && hit.kind === 'fuse' && hit.row >= q.oeRow && hit.row <= q.oeRow + q.termCount);
      if (o >= 0) focusOlmc(o);
    }
    void ev;
  }
  function key(ev: KeyboardEvent): boolean {
    let { row, col } = cursor;
    if (ev.key === 'ArrowLeft') col--;
    else if (ev.key === 'ArrowRight') col++;
    else if (ev.key === 'ArrowUp') row--;
    else if (ev.key === 'ArrowDown') row++;
    else if (ev.key === 'PageDown') row += 10;
    else if (ev.key === 'PageUp') row -= 10;
    else if (ev.key === 'Enter' || ev.key === ' ') {
      const r = refOfRow(row);
      if (r) onselect?.(r);
      ev.preventDefault();
      return true;
    } else return false;
    ev.preventDefault();
    row = Math.max(0, Math.min(ROWS - 1, row));
    col = Math.max(0, Math.min(COLUMNS - 1, col));
    cursor = { row, col };
    live = galFuseText(chip, row * COLUMNS + col);
    pz?.ensureVisible(g.colX(col), g.rowY(row));
    onhover?.(refOfRow(row));
    return true;
  }
  const level = (name: string) => run?.signals[name];
  const padLabelOnLeft = (side: string) => side === 'left';
  const pinLevel = (p: number): 0 | 1 | 'z' | undefined => {
    const n = pinName(p);
    if (!n) return undefined;
    const v = level(n);
    return v;
  };
</script>

{#snippet art(k: number)}
  <defs>
    <filter id="{uid}-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <linearGradient id="{uid}-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.18" />
      <stop offset="1" stop-color="#000" stop-opacity="0.38" />
    </linearGradient>
  </defs>

  <!-- package -->
  <path d="M{g.xBody0} {g.yBody0}H{(g.xBody0 + g.xBody1) / 2 - 22}A22 22 0 0 0 {(g.xBody0 + g.xBody1) / 2 + 22} {g.yBody0}H{g.xBody1}V{g.yBody1}H{g.xBody0}Z" fill="url(#{uid}-body)" stroke="var(--metal-dim)" stroke-width="2" />
  <circle cx={g.xBody0 + 18} cy={g.yBody0 + 18} r="5" fill="none" stroke="var(--metal-dim)" />
  <text x={g.xBody0 + 34} y={g.yBody0 + 24} class="t" style="font-size: 15px; font-weight: 600; fill: var(--metal)">{title ?? fit.title}</text>
  <text x={g.xBody0 + 34} y={g.yBody0 + 42} class="t2">GAL22V10 · 12 inputs · 10 macrocells · 5,892 fuses · signature “{chip.signature}”</text>

  <!-- pin-to-buffer routes -->
  {#each g.routes as r (r.pin)}
    {@const on = selPins.has(r.pin) || hovPins.has(r.pin)}
    {@const n = pinName(r.pin)}
    {@const v = n ? level(n) : undefined}
    {@const used = usedPins.has(r.pin)}
    <path d={r.d} fill="none" stroke={on ? (selPins.has(r.pin) ? 'var(--sel)' : 'var(--hov)') : used && v === 1 ? 'var(--hot)' : 'var(--metal-dim)'} stroke-width={on || (used && v === 1) ? 1.8 : 1} opacity={on || (used && v === 1) ? 1 : used ? 0.6 : 0.16} stroke-dasharray={r.kind === 'feedback' ? '4 3' : undefined} />
  {/each}

  <!-- input buffers and column lines -->
  {#each { length: 22 } as _, s (s)}
    {@const pin = columnSignal(2 * s).pin}
    {@const xt = g.colX(2 * s)}
    {@const xc = g.colX(2 * s + 1)}
    {@const lv = arrayLevel(s)}
    <path d="M{(xt + xc) / 2} {g.yBuf - 8}V{g.yBuf - 4}M{xt} {g.yBuf - 4}H{xc}M{xt} {g.yBuf - 4}V{g.yBuf}M{xc} {g.yBuf - 4}V{g.yBuf}" class="metal" stroke-width="1" />
    <path d="M{xt - 3.5} {g.yBuf}h7l-3.5 7z" fill="#0a0d16" stroke="var(--metal)" stroke-width="0.9" />
    <path d="M{xc - 3.5} {g.yBuf}h7l-3.5 7z" fill="#0a0d16" stroke="var(--metal)" stroke-width="0.9" />
    <circle cx={xc} cy={g.yBuf + 9} r="1.5" fill="#0a0d16" stroke="var(--metal)" stroke-width="0.8" />
    {#if k > 0.9}<text x={(xt + xc) / 2} y={g.yBuf - 12} text-anchor="middle" class="lbl" style="font-size: 7.5px">{pin}</text>{/if}
    {#if lv !== undefined}
      <path d="M{lv === 1 ? xt : xc} {g.yBuf + 14}V{g.yArrEnd}" class="metal" stroke="var(--hot)" stroke-width="1.8" filter="url(#{uid}-glow)" />
    {/if}
  {/each}
  <path class="metal" d={paths.cols} stroke-width="0.8" />
  {#each [...new Set([...selCols, ...hovCols])] as c (c)}
    <rect x={g.xArr + c * COL_W} y={g.yBuf - 6} width={2 * COL_W} height={g.yArrEnd - g.yBuf + 6} fill={selCols.has(c) ? 'var(--sel-soft)' : 'var(--hov-soft)'} />
  {/each}

  <!-- rows: bands, lines, fuses -->
  {#each g.group as gr, i (i)}
    {#if selOlmc.has(i) || hovOlmc.has(i)}
      <rect x={g.xArr - 22} y={gr.top + 2} width={g.xBlock1 - g.xArr + 60} height={gr.bottom - gr.top - 4} rx="3" fill={selOlmc.has(i) ? 'var(--sel-soft)' : 'var(--hov-soft)'} stroke={selOlmc.has(i) ? 'var(--sel)' : 'var(--hov)'} stroke-width="0.8" stroke-dasharray={selOlmc.has(i) ? undefined : '3 3'} />
    {/if}
  {/each}
  {#each [...hovRows].filter((r) => !selRows.has(r)) as r (r)}
    <rect x={g.xArr - 4} y={g.rowY(r) - ROW_H / 2} width={g.xArrEnd - g.xArr + 8} height={ROW_H} fill="var(--hov-soft)" />
  {/each}
  {#each [...selRows] as r (r)}
    <rect x={g.xArr - 4} y={g.rowY(r) - ROW_H / 2} width={g.xArrEnd - g.xArr + 8} height={ROW_H} fill="var(--sel-soft)" stroke="var(--sel)" stroke-width="0.7" />
  {/each}
  <path d={paths.dead} class="metal" stroke-width="0.7" stroke-dasharray="1 5" opacity="0.5" />
  <path d={paths.live} class="metal" stroke-width="0.9" />
  {#each activeRows as r (r)}
    <path d="M{g.xArr - 4} {g.rowY(r)}H{g.xArrEnd + 4}" class="metal" stroke="var(--hot)" stroke-width="1.6" filter="url(#{uid}-glow)" />
  {/each}
  {#if k > 3}<path d={paths.dots} fill="none" stroke="var(--metal-faint)" stroke-width="1.6" stroke-linecap="round" />{/if}
  <path d={paths.x} fill="none" stroke="var(--metal)" stroke-width={k > 2 ? 1.1 : 1.3} stroke-linecap="round" />

  {#if k > 2.4}
    {#each { length: ROWS } as _, r (r)}
      <text x={g.xArr - 8} y={g.rowY(r) + 2.4} text-anchor="end" class="lbl" style="font-size: 6.4px">{rowLabel(r)}</text>
    {/each}
  {/if}
  <text x={g.xArr - 8} y={g.rowY(AR_ROW) + 3} text-anchor="end" class="lbl" style="font-weight: 700">AR</text>
  <text x={g.xArr - 8} y={g.rowY(SP_ROW) + 3} text-anchor="end" class="lbl" style="font-weight: 700">SP</text>
  <rect x={g.xArr} y={g.yBuf + 12} width={COLUMNS * COL_W} height={g.yArrEnd - g.yBuf - 12} fill="none" stroke="var(--metal-faint)" />

  <!-- macrocells -->
  {#each chip.olmcs as o, i (o.pin)}
    {@const gr = g.group[i]!}
    {@const r = olmcRows(o.pin)}
    {@const cy = gr.cy}
    {@const x0 = g.xBlock0}
    {@const used = o.use === 'output'}
    {@const sum = snap?.sums[o.pin]}
    {@const out = snap ? snap.pins[o.pin] : undefined}
    {@const driven = snap?.driven[o.pin]}
    {@const q = snap?.q[o.pin]}
    {@const sel = selOlmc.has(i)}
    <g opacity={used ? 1 : 0.5}>
      <!-- collector -->
      <path class="metal" d="M{g.xArrEnd + 8} {g.rowY(r.firstTermRow)}V{g.rowY(r.firstTermRow + r.terms - 1)}" stroke-width="1.2" stroke={sum ? 'var(--hot)' : undefined} />
      {#each { length: r.terms } as _, t (t)}
        {#if !chip.rowDead[r.firstTermRow + t]}
          <path class="metal" d="M{g.xArrEnd + 4} {g.rowY(r.firstTermRow + t)}H{g.xArrEnd + 8}" stroke-width="1" stroke={snap?.rows[r.firstTermRow + t] ? 'var(--hot)' : undefined} />
          <circle cx={g.xArrEnd + 8} cy={g.rowY(r.firstTermRow + t)} r="1.6" fill="var(--metal)" />
        {/if}
      {/each}
      <path class="metal" d="M{g.xArrEnd + 8} {cy}H{x0 + 8}" stroke-width="1.2" stroke={sum ? 'var(--hot)' : undefined} />
      <!-- OR -->
      <path d="M{x0 + 8} {cy - 14}Q{x0 + 20} {cy} {x0 + 8} {cy + 14}Q{x0 + 34} {cy + 12} {x0 + 44} {cy}Q{x0 + 34} {cy - 12} {x0 + 8} {cy - 14}Z" fill="#0a0d16" stroke={sel ? 'var(--sel)' : 'var(--metal)'} stroke-width="1.2" />
      <path class="metal" d="M{x0 + 44} {cy}H{x0 + 62}" stroke-width="1.2" stroke={sum ? 'var(--hot)' : undefined} />
      <!-- polarity XOR -->
      <circle cx={x0 + 70} cy={cy} r="8" fill={o.activeHigh ? '#0a0d16' : 'color-mix(in srgb, var(--hov) 38%, #0a0d16)'} stroke="var(--metal)" stroke-width="1.2" />
      <path d="M{x0 + 66} {cy}h8M{x0 + 70} {cy - 4}v8" stroke="var(--metal)" stroke-width="1" />
      <path class="metal" d="M{x0 + 78} {cy}H{x0 + 96}" stroke-width="1.2" />
      <!-- register or bypass -->
      {#if o.registered}
        <rect x={x0 + 96} y={cy - 17} width="44" height="34" rx="3" fill="#0a0d16" stroke="var(--metal)" stroke-width="1.3" />
        <text x={x0 + 104} y={cy - 4} class="lbl" style="font-size: 8px">D</text>
        <text x={x0 + 126} y={cy - 4} class="lbl" style="font-size: 8px">Q</text>
        <path d="M{x0 + 96} {cy + 8}l6 -4l-6 -4" fill="none" stroke="var(--metal)" stroke-width="1" />
        <text x={x0 + 118} y={cy + 12} text-anchor="middle" class="lbl" style="font-size: 7px; fill: {q ? 'var(--hot)' : ''}">{q === undefined ? 'REG' : q}</text>
      {:else}
        <path class="metal" d="M{x0 + 96} {cy}H{x0 + 140}" stroke-width="1.2" stroke={sum ? 'var(--hot)' : undefined} />
        <text x={x0 + 118} y={cy - 6} text-anchor="middle" class="lbl" style="font-size: 7px">comb</text>
      {/if}
      <path class="metal" d="M{x0 + 140} {cy}H{x0 + 168}" stroke-width="1.2" stroke={driven && out === 1 ? 'var(--hot)' : undefined} />
      <!-- output buffer with enable -->
      <path d="M{x0 + 168} {cy - 9}v18l16 -9z" fill="#0a0d16" stroke="var(--metal)" stroke-width="1.2" />
      <path d="M{x0 + 176} {cy - 13}V{cy - 26}H{g.xArrEnd + 12}V{g.rowY(r.oeRow)}H{g.xArrEnd + 4}" class="metal" fill="none" stroke-width="0.9" stroke-dasharray="2 2" />
      <path class="metal" d="M{x0 + 184} {cy}H{g.xBlock1 - 2}" stroke-width="1.4" stroke={driven && out === 1 ? 'var(--hot)' : undefined} />
      {#if k > 1}
        <text x={x0 + 8} y={gr.top + 10} class="lbl" style="font-size: 8.5px; fill: {sel ? 'var(--sel)' : ''}">pin {o.pin} {o.name ? `· ${o.name}` : '· unused'}</text>
        <text x={x0 + 96} y={cy + 30} class="lbl" style="font-size: 7px">{o.registered ? 'S1=0 registered' : 'S1=1 comb'} · {o.activeHigh ? 'S0=1 high' : 'S0=0 low'}</text>
        <text x={x0 + 176} y={cy + 20} class="lbl" style="font-size: 7px">{o.oeKind === 'always' ? 'OE: on' : o.oeKind === 'term' ? 'OE: term' : 'OE: off'}</text>
      {/if}
    </g>
  {/each}
  {#each g.outCurves as c (c.pin)}
    {@const n = pinName(c.pin)}
    {@const v = n ? level(n) : undefined}
    <path d={c.d} fill="none" class="metal" stroke={v === 1 ? 'var(--hot)' : 'var(--metal-dim)'} stroke-width={v === 1 ? 2 : 1.2} stroke-dasharray={v === 'z' ? '4 3' : undefined} opacity={n ? 1 : 0.3} />
  {/each}

  <!-- pins -->
  {#each g.pads as p (p.pin)}
    {@const pv = chip.pins[p.pin - 1]!}
    {@const lv = pinLevel(p.pin)}
    {@const on = selPins.has(p.pin) || hovPins.has(p.pin)}
    <g opacity={pv.role === 'nc' ? 0.5 : 1}>
      <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="3" fill={lv === 1 ? 'color-mix(in srgb, var(--hot) 35%, #0a0d16)' : '#0a0d16'} stroke={on ? (selPins.has(p.pin) ? 'var(--sel)' : 'var(--hov)') : lv === 1 ? 'var(--hot)' : 'var(--metal-dim)'} stroke-width={on ? 2 : 1.2} stroke-dasharray={lv === 'z' ? '3 2' : undefined} />
      <text x={padLabelOnLeft(p.side) ? p.x + p.w - 6 : p.x + 6} y={p.cy + 3.5} text-anchor={padLabelOnLeft(p.side) ? 'end' : 'start'} class="lbl" style="font-size: 9.5px; fill: var(--die-ink-2)">{p.pin}</text>
      <text x={padLabelOnLeft(p.side) ? p.x + 6 : p.x + p.w - 6} y={p.cy + 3.5} text-anchor={padLabelOnLeft(p.side) ? 'start' : 'end'} class="t" style="font-size: 10px; font-weight: 600; {on ? 'fill: var(--sel)' : ''}">{pv.name}</text>
      {#if pv.role === 'clock'}<text x={padLabelOnLeft(p.side) ? p.x - 4 : p.x + p.w + 4} y={p.cy + 3} text-anchor={padLabelOnLeft(p.side) ? 'end' : 'start'} class="lbl" style="font-size: 8px">clk</text>{/if}
    </g>
  {/each}

  <!-- the pointer and the keyboard cursor -->
  {#if hit?.kind === 'fuse'}
    <path d="M{g.xArr} {g.rowY(hit.row)}H{g.xArrEnd}M{g.colX(hit.col)} {g.yBuf + 14}V{g.yArrEnd}" class="metal" stroke="var(--hov)" stroke-width="0.8" stroke-dasharray="2 2" />
    <rect x={g.colX(hit.col) - 4.5} y={g.rowY(hit.row) - 4.5} width="9" height="9" rx="2" fill="none" stroke="#fff" stroke-width="1.1" />
  {/if}
  {#if focused}
    <rect x={g.colX(cursor.col) - 5} y={g.rowY(cursor.row) - 5} width="10" height="10" rx="2" fill="none" stroke="var(--focus)" stroke-width="1.8" />
  {/if}
{/snippet}

<div class="die screen" bind:this={box} ondblclick={dbl} role="presentation">
  <PanZoom bind:this={pz} width={g.W} height={g.H} label="GAL22V10 chip: fuse array, macrocells and pins" ondown={click} onpoint={pointerAt} onkey={key} onfocuschange={(f) => (focused = f)} wheel="always">
    {#snippet children({ k })}
      {@render art(k)}
    {/snippet}
    {#snippet overlay({ w })}
      <div class="hud">
        <strong>{chip.connected}</strong>/{ROWS * COLUMNS} fuses · <strong>{chip.olmcs.filter((o) => o.use === 'output').length}</strong>/10 macrocells
      </div>
      <div class="macros" aria-label="Go to a macrocell">
        {#each chip.olmcs as o (o.pin)}
          <button type="button" class:on={selOlmc.has(o.index)} class:off={o.use === 'unused'} onclick={() => focusOlmc(o.index)} title="Zoom to the macrocell of pin {o.pin}">{o.pin}</button>
        {/each}
      </div>
      {#if tip}
        <div class="tip" style:left="{Math.max(4, Math.min(tip.x + 14, w - 250))}px" style:top="{tip.y + 16}px" role="tooltip"><strong>{tip.title}</strong>{#each tip.lines as l, i (i)}<div>{l}</div>{/each}</div>
      {/if}
      <p class="sr" aria-live="polite">{live}</p>
    {/snippet}
  </PanZoom>
</div>

<style>
  .die {
    height: 100%;
    min-height: 18rem;
    border-radius: 0;
  }
  .hud {
    position: absolute;
    left: 0.6rem;
    top: 0.5rem;
    z-index: 4;
    padding: 0.25rem 0.55rem;
    border-radius: 6px;
    background: color-mix(in srgb, #05070d 78%, transparent);
    border: 1px solid var(--metal-dim);
    font-family: var(--font-mono);
    font-size: 0.66rem;
    color: var(--die-ink-2);
    max-width: calc(100% - 4rem);
    white-space: nowrap;
  }
  .hud strong {
    color: var(--metal);
  }
  .macros {
    position: absolute;
    left: 0.6rem;
    bottom: 0.6rem;
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    z-index: 4;
    max-width: 60%;
  }
  .macros button {
    min-width: 1.7rem;
    height: 1.5rem;
    padding: 0 0.3rem;
    border-radius: 5px;
    border: 1px solid var(--metal-dim);
    background: color-mix(in srgb, #05070d 80%, transparent);
    color: var(--die-ink);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    cursor: pointer;
  }
  .macros button.on {
    border-color: var(--sel);
    color: var(--sel);
  }
  .macros button.off {
    opacity: 0.5;
  }
  .macros button:hover {
    border-color: var(--metal);
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
