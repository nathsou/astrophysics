<!--
  The vCPLD-32 chip view: four function blocks around the global interconnect matrix. Each block is a
  48-column, 40-term AND array (× marks a set bit) with its eight macrocells beside it; steering lines carry
  each term to its own macrocell or, in copper, to a neighbour that borrows it. The interconnect matrix is a
  crossbar: 64 source lines (32 pins, 32 macrocell feedbacks) and, for every block input, a vertical line with
  a dot where its multiplexer selects a source. Pads on the outside. Zoom and pan; hover for what a bit does.
-->
<script lang="ts">
  import './chip.css';
  import type { ChipProps } from '../types';
  import type { CpldDeviceFit } from '../adapters/cpld';
  import { arrayBit, interconnectBit, OE_GLOBAL, OE_NAMES, OE_OFF, OE_TERM, FB_INPUTS, LITERAL_COLUMNS, describeBit, type CpldMacrocell } from '../../pld/devices/vcpld32-arch';
  import type { CpldSnapshot } from '../../pld/devices/vcpld32';
  import { CW, RH, cpldGeom, cpldHit, type CpldHit, type FbGeom } from './cpld-geometry';
  import PanZoom from './PanZoom.svelte';

  let { fit, probe, hover, run, onselect, onhover, title, compact = false }: ChipProps<CpldDeviceFit> = $props();

  /** In a chapter's narrow pane the whole chip is a thumbnail (about 0.36 at 900 px); below this it opens on block 0 instead. */
  const COMPACT_MIN_FIT = 0.5;
  const chip = $derived(fit.chip);
  const g = cpldGeom();
  const uid = $props.id();
  const snap = $derived(run?.detail as CpldSnapshot | undefined);
  let pz: PanZoom | undefined = $state();
  let box: HTMLDivElement | undefined = $state();
  let tip = $state<{ x: number; y: number; title: string; lines: string[] } | null>(null);
  let hit = $state<CpldHit>(null);
  let cursor = $state({ fb: 0, term: 0, col: 0 });
  let focused = $state(false);
  let live = $state('');

  const srcName = (s: number) => (s < 32 ? `IO${s}${chip.ioNames[s] ? ` (${chip.ioNames[s]})` : ''}` : `MC${s - 32}${chip.mcNames[s - 32] ? ` (${chip.mcNames[s - 32]})` : ''}`);
  const sourceOf = (fb: number, k: number) => chip.cfg.fbs[fb]!.sources[k]!;

  // Which block inputs some enabled term reads.
  const usedInput = $derived(chip.cfg.fbs.map((f) => {
    const u = new Array<boolean>(FB_INPUTS).fill(false);
    for (const t of f.terms) if (t.kind === 'product') for (const l of t.literals) u[l.input] = true;
    return u;
  }));

  // Highlights.
  const termKey = (fb: number, t: number) => `f${fb}t${t}`;
  const parseTerms = (s: ReadonlySet<string>) => {
    const out = new Set<string>();
    for (const t of s) if (/^f\d+t\d+$/.test(t)) out.add(t);
    return out;
  };
  const selTerms = $derived(parseTerms(probe.terms));
  const hovTerms = $derived(parseTerms(hover.terms));
  const mcOf = (name: string) => chip.mcNames.indexOf(name);
  const mcSet = (s: ReadonlySet<string>) => new Set([...s].map(mcOf).filter((m) => m >= 0));
  const selMcs = $derived(mcSet(probe.outputs));
  const hovMcs = $derived(mcSet(hover.outputs));
  const lineSet = (s: ReadonlySet<string>) => {
    const out = new Set<number>();
    for (const n of s) {
      const m = mcOf(n);
      if (m >= 0) out.add(32 + m);
      const io = chip.inputPins[n] ?? chip.ioNames.indexOf(n);
      if (io !== undefined && io >= 0 && chip.ioRole[io] === 'input') out.add(io);
    }
    return out;
  };
  const selLines = $derived(lineSet(probe.signals));
  const hovLines = $derived(lineSet(hover.signals));

  const srcLevel = (s: number): 0 | 1 | undefined => (snap ? (s < 32 ? (snap.pins[s] as 0 | 1) : (snap.mc[s - 32] as 0 | 1)) : undefined);

  // Static paths per block.
  const paths = $derived.by(() =>
    g.fbs.map((f) => {
      const cfg = chip.cfg.fbs[f.fb]!;
      const x: string[] = [];
      const live: string[] = [];
      const off: string[] = [];
      const cols: string[] = [];
      const own: string[] = [];
      const borrow: string[] = [];
      const h = 2.8;
      for (const t of cfg.terms) {
        const y = f.rowY(t.term);
        if (t.kind === 'off' || t.kind === 'false') {
          off.push(`M${f.arrX0} ${y}H${f.arrX1}`);
          continue;
        }
        live.push(`M${f.arrX0 - 3} ${y}H${f.arrX1 + 3}`);
        for (let c = 0; c < LITERAL_COLUMNS; c++) {
          if (chip.bits[arrayBitIndex(f.fb, t.term, c)]) {
            const cx = f.colX(c);
            x.push(`M${cx - h} ${y - h}l${2 * h} ${2 * h}M${cx + h} ${y - h}l${-2 * h} ${2 * h}`);
          }
        }
        if (t.isOe || t.destMc < 0) continue;
        const m = t.mc;
        const steerLane = t.destMc === m ? t.slot : t.destMc > m ? 5 + t.slot : 10 + t.slot;
        const lx = f.edgeX + f.dir * (6 + steerLane * 4);
        const dy = f.mcY(t.destMc);
        const d = `M${f.edgeX} ${y}H${lx}V${dy}H${f.mcU(2)}`;
        (t.destMc === m ? own : borrow).push(d);
      }
      for (let c = 0; c < LITERAL_COLUMNS; c++) cols.push(f.top ? `M${f.colX(c)} ${f.arrY0}V${f.bufY}` : `M${f.colX(c)} ${f.bufY}V${f.arrY1}`);
      return { x: x.join(''), live: live.join(''), off: off.join(''), cols: cols.join(''), own: own.join(''), borrow: borrow.join('') };
    }),
  );
  const arrayBitIndex = (fb: number, t: number, c: number) => arrayBit(fb, t, c >> 1, (c & 1) === 1);

  function mcText(f: FbGeom, m: number): { title: string; lines: string[] } {
    const mc: CpldMacrocell = chip.cfg.fbs[f.fb]!.macrocells[m]!;
    const io = mc.io;
    const name = chip.mcNames[io];
    const parts = [
      `${mc.registered ? (mc.tff ? 'T flip-flop' : 'D flip-flop') : 'combinational'}${mc.xor ? ', inverted (XOR = 1)' : ''}${mc.registered ? `, power-up ${mc.init}` : ''}.`,
      `Output ${OE_NAMES[mc.oe]}${mc.oe === OE_OFF ? ' (buried or unused)' : ''}. ${mc.orTerms.length} product terms collected${mc.borrowed ? `, ${mc.borrowed} borrowed from a neighbour` : ''}${mc.lent ? `, ${mc.lent} lent` : ''}.`,
    ];
    return { title: `Macrocell ${io}${name ? `: ${name}` : ''}`, lines: parts };
  }

  function pointerAt(p: { x: number; y: number } | null, ev: PointerEvent | null) {
    if (!p || !ev) {
      hit = null;
      tip = null;
      onhover?.(null);
      return;
    }
    const h = cpldHit(g, p.x, p.y, sourceOf);
    hit = h;
    const r = box!.getBoundingClientRect();
    const pos = { x: ev.clientX - r.left, y: ev.clientY - r.top };
    if (!h) {
      tip = null;
      onhover?.(null);
      return;
    }
    if (h.kind === 'fuse') {
      const t = chip.cfg.fbs[h.fb]!.terms[h.term]!;
      const bit = arrayBit(h.fb, h.term, h.col >> 1, (h.col & 1) === 1);
      const dest = t.isOe ? 'the output enable of its macrocell' : t.destMc < 0 ? 'nowhere (steered off the block)' : t.destMc === t.mc ? 'its own macrocell' : `macrocell ${h.fb * 8 + t.destMc} (borrowed: steered ${t.steer})`;
      tip = { ...pos, title: `FB${h.fb} term ${h.term} · column ${h.col}`, lines: [describeBit(bit).text + `. Value ${chip.bits[bit]}.`, t.kind === 'off' ? 'Term disabled.' : `Term feeds ${dest}.`] };
      onhover?.(t.kind === 'off' || t.kind === 'false' ? null : { kind: 'term', id: termKey(h.fb, h.term) });
    } else if (h.kind === 'mc') {
      const f = g.fbs[h.fb]!;
      tip = { ...pos, ...mcText(f, h.mc) };
      const n = chip.mcNames[h.fb * 8 + h.mc];
      onhover?.(n ? { kind: 'output', name: n } : null);
    } else if (h.kind === 'pad') {
      const n = chip.ioNames[h.io];
      tip = { ...pos, title: `Pad IO${h.io}${n ? `: ${n}` : ''}`, lines: [chip.ioRole[h.io] === 'input' ? 'An input pin.' : chip.ioRole[h.io] === 'output' ? 'Driven by its macrocell.' : 'Free.'] };
      onhover?.(n ? { kind: 'signal', name: n } : null);
    } else if (h.kind === 'mux') {
      const s = sourceOf(h.fb, h.input);
      tip = { ...pos, title: `FB${h.fb} input ${h.input}`, lines: [`Its 64-way multiplexer selects ${srcName(s)} (source ${s}, 6 bits from ${interconnectBit(h.fb, h.input, 0)}).`] };
      const n = s < 32 ? chip.ioNames[s] : chip.mcNames[s - 32];
      onhover?.(n ? { kind: 'signal', name: n } : null);
    } else {
      tip = { ...pos, title: srcName(h.source), lines: ['A source line of the interconnect matrix; every block input can select it.'] };
      const n = h.source < 32 ? chip.ioNames[h.source] : chip.mcNames[h.source - 32];
      onhover?.(n ? { kind: 'signal', name: n } : null);
    }
  }
  function click(p: { x: number; y: number }) {
    const h = cpldHit(g, p.x, p.y, sourceOf);
    if (!h) return onselect?.(null);
    if (h.kind === 'fuse') {
      const t = chip.cfg.fbs[h.fb]!.terms[h.term]!;
      if (t.kind === 'off' || t.kind === 'false') {
        const n = chip.mcNames[h.fb * 8 + t.mc];
        return onselect?.(n ? { kind: 'output', name: n } : null);
      }
      return onselect?.({ kind: 'term', id: termKey(h.fb, h.term) });
    }
    if (h.kind === 'mc') {
      const n = chip.mcNames[h.fb * 8 + h.mc];
      return onselect?.(n ? { kind: 'output', name: n } : null);
    }
    if (h.kind === 'pad') {
      const n = chip.ioNames[h.io];
      return onselect?.(n ? { kind: 'signal', name: n } : null);
    }
    if (h.kind === 'mux') {
      const s = sourceOf(h.fb, h.input);
      const n = s < 32 ? chip.ioNames[s] : chip.mcNames[s - 32];
      return onselect?.(n ? { kind: 'signal', name: n } : null);
    }
    const n = h.source < 32 ? chip.ioNames[h.source] : chip.mcNames[h.source - 32];
    onselect?.(n ? { kind: 'signal', name: n } : null);
  }
  function fbRect(fb: number) {
    const f = g.fbs[fb]!;
    const x0 = Math.min(f.padX, f.arrX0);
    const x1 = Math.max(f.padX + f.padW, f.arrX1);
    return { x: x0 - 16, y: f.arrY0 - 46, w: x1 - x0 + 32, h: f.arrY1 - f.arrY0 + 120 };
  }
  function focusFb(fb: number) {
    pz?.focus(fbRect(fb));
  }
  function focusGim() {
    pz?.focus({ x: g.band.x0, y: g.band.y0 - 40, w: g.band.x1 - g.band.x0, h: g.band.y1 - g.band.y0 + 80 });
  }
  function dbl() {
    if (hit?.kind === 'fuse' || hit?.kind === 'mc') focusFb(hit.fb);
    else if (hit?.kind === 'mux' || hit?.kind === 'source') focusGim();
  }
  function key(ev: KeyboardEvent): boolean {
    let { fb, term, col } = cursor;
    if (ev.key === 'ArrowLeft') col--;
    else if (ev.key === 'ArrowRight') col++;
    else if (ev.key === 'ArrowUp') term--;
    else if (ev.key === 'ArrowDown') term++;
    else if (ev.key === 'Tab' && ev.altKey) fb = (fb + 1) % 4;
    else if (ev.key === 'Enter' || ev.key === ' ') {
      click({ x: g.fbs[fb]!.colX(col), y: g.fbs[fb]!.rowY(term) });
      ev.preventDefault();
      return true;
    } else return false;
    ev.preventDefault();
    term = Math.max(0, Math.min(39, term));
    col = Math.max(0, Math.min(47, col));
    cursor = { fb, term, col };
    const f = g.fbs[fb]!;
    const bit = arrayBit(fb, term, col >> 1, (col & 1) === 1);
    live = `FB${fb} term ${term} column ${col}: ${describeBit(bit).text}. Value ${chip.bits[bit]}.`;
    pz?.ensureVisible(f.colX(col), f.rowY(term));
    return true;
  }

  const mcLevel = (io: number) => (snap ? (snap.mc[io] as 0 | 1) : undefined);
  const padLevel = (io: number): 0 | 1 | 'z' | undefined => {
    if (!snap) return undefined;
    if (chip.ioRole[io] === 'output') return snap.driven[io] ? (snap.pins[io] as 0 | 1) : 'z';
    return snap.pins[io] as 0 | 1;
  };
  const activeTerm = (fb: number, t: number) => !!snap && snap.terms[fb * 40 + t] === 1;
  const fbUsed = (fb: number) => usedInput[fb]!.filter(Boolean).length;
  const triangle = (f: FbGeom, u: number, y: number, w = 16, h = 9) => `M${f.mcU(u)} ${y - h}v${2 * h}L${f.mcU(u + w)} ${y}Z`;
  const ffBox = (f: FbGeom, u0: number, u1: number, y: number, hh = 16) => {
    const a = f.mcU(u0);
    const b = f.mcU(u1);
    return { x: Math.min(a, b), y: y - hh, w: Math.abs(b - a), h: 2 * hh };
  };
</script>

{#snippet art(k: number)}
  <defs>
    <filter id="{uid}-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <linearGradient id="{uid}-fb" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.14" />
      <stop offset="1" stop-color="#000" stop-opacity="0.34" />
    </linearGradient>
  </defs>
  <text x="26" y="34" class="t" style="font-size: 15px; font-weight: 600; fill: var(--metal)">{title ?? fit.title}</text>
  <text x="26" y="52" class="t2">vCPLD-32 · 4 function blocks × 8 macrocells · 40 product terms per block · {chip.bits.length} configuration bits{chip.usercode ? ` · USERCODE “${chip.usercode}”` : ''}</text>

  <!-- the interconnect matrix -->
  <rect x={g.band.x0} y={g.band.y0} width={g.band.x1 - g.band.x0} height={g.band.y1 - g.band.y0} rx="12" fill="url(#{uid}-fb)" stroke="var(--metal-dim)" stroke-width="1.6" />
  <text x={(g.band.x0 + g.band.x1) / 2} y={g.band.y0 + 20} text-anchor="middle" class="t2" style="letter-spacing: 0.18em">GLOBAL INTERCONNECT MATRIX · 64 SOURCES → 4 × 24 INPUT MULTIPLEXERS</text>
  {#each { length: 64 } as _, s (s)}
    {@const y = g.lineY(s)}
    {@const lv = srcLevel(s)}
    {@const on = selLines.has(s) || hovLines.has(s)}
    <path d="M{g.band.x0 + 46} {y}H{g.band.x1 - 46}" class="metal" stroke={on ? (selLines.has(s) ? 'var(--sel)' : 'var(--hov)') : lv === 1 ? 'var(--hot)' : 'var(--metal-dim)'} stroke-width={on ? 1.4 : lv === 1 ? 1.2 : 0.6} opacity={on || lv === 1 ? 1 : 0.7} />
    {#if k > 1.5 ? s % 2 === 0 || k > 3 : s % 8 === 0 && k > 0.55}
      <text x={g.band.x0 + 42} y={y + 2.4} text-anchor="end" class="lbl" style="font-size: 5.6px; {on ? 'fill: var(--sel)' : ''}">{s < 32 ? `IO${s}` : `MC${s - 32}`}</text>
      <text x={g.band.x1 - 42} y={y + 2.4} class="lbl" style="font-size: 5.6px">{s < 32 ? (chip.ioNames[s] ?? '') : (chip.mcNames[s - 32] ?? '')}</text>
    {/if}
  {/each}

  {#each g.fbs as f (f.fb)}
    {@const cfg = chip.cfg.fbs[f.fb]!}
    {@const p = paths[f.fb]!}
    <!-- frame -->
    <rect x={Math.min(f.padX, f.arrX0) - 10} y={f.arrY0 - 34} width={Math.max(f.padX + f.padW, f.arrX1) - Math.min(f.padX, f.arrX0) + 20} height={f.arrY1 - f.arrY0 + 46} rx="10" fill="none" stroke="var(--metal-faint)" stroke-width="1.6" />
    <text x={f.arrX0} y={f.arrY0 - 14} class="t" style="font-size: 12px; font-weight: 700; fill: var(--metal)">FB{f.fb}</text>
    <text x={f.arrX0 + 36} y={f.arrY0 - 14} class="t2">AND array 48 × 40 · {fbUsed(f.fb)} of 24 inputs used · {cfg.macrocells.filter((m) => m.orTerms.length || m.registered || m.oe !== OE_OFF).length} of 8 macrocells</text>
    <rect x={f.arrX0 - 4} y={f.arrY0 - 3} width={LITERAL_COLUMNS * CW + 8} height={RH * 40 + 6} rx="3" fill="url(#{uid}-fb)" stroke="var(--metal-faint)" />

    <!-- selected and hovered terms and macrocells -->
    {#each cfg.terms as t (t.term)}
      {@const key = termKey(f.fb, t.term)}
      {#if selTerms.has(key) || hovTerms.has(key) || activeTerm(f.fb, t.term)}
        <rect x={f.arrX0 - 3} y={f.rowY(t.term) - RH / 2} width={LITERAL_COLUMNS * CW + 6} height={RH} fill={selTerms.has(key) ? 'var(--sel-soft)' : hovTerms.has(key) ? 'var(--hov-soft)' : 'color-mix(in srgb, var(--hot) 12%, transparent)'} stroke={selTerms.has(key) ? 'var(--sel)' : 'none'} stroke-width="0.7" />
      {/if}
    {/each}

    <!-- input buffers, columns and crossbar dots -->
    {#each { length: FB_INPUTS } as _, i (i)}
      {@const s = sourceOf(f.fb, i)}
      {@const xt = f.colX(2 * i)}
      {@const xc = f.colX(2 * i + 1)}
      {@const used = usedInput[f.fb]![i]}
      {@const lv = srcLevel(s)}
      {@const dir = f.top ? 1 : -1}
      <g opacity={used ? 1 : 0.3}>
        <path d="M{(xt + xc) / 2} {f.bufY + dir * 12}V{f.bufY + dir * 3}M{xt} {f.bufY + dir * 3}H{xc}M{xt} {f.bufY + dir * 3}V{f.bufY}M{xc} {f.bufY + dir * 3}V{f.bufY}" class="metal" stroke-width="0.9" />
        <path d="M{xt - 3.5} {f.bufY}h7l-3.5 {-dir * 7}z" fill="#0a0d16" stroke="var(--metal)" stroke-width="0.9" />
        <path d="M{xc - 3.5} {f.bufY}h7l-3.5 {-dir * 7}z" fill="#0a0d16" stroke="var(--metal)" stroke-width="0.9" />
        <path d="M{f.inputX(i)} {f.bufY + dir * 12}V{g.lineY(s)}" class="metal" stroke={lv === 1 && used ? 'var(--hot)' : 'var(--metal-dim)'} stroke-width={lv === 1 && used ? 1.6 : 0.9} />
        <circle cx={f.inputX(i)} cy={g.lineY(s)} r="2.4" fill={lv === 1 && used ? 'var(--hot)' : 'var(--metal)'} style="filter: drop-shadow(0 0 2px var(--metal-dim))" />
      </g>
      {#if k > 1.2}<text x={f.inputX(i)} y={f.bufY + dir * 22} text-anchor="middle" class="lbl" style="font-size: 5.8px">{i}</text>{/if}
      {#if snap && used}
        {@const v = snap.inputs[f.fb * 24 + i]}
        <path d="M{v ? xt : xc} {f.top ? f.arrY0 : f.bufY}V{f.top ? f.bufY : f.arrY1}" class="metal" stroke="var(--hot)" stroke-width="1.6" filter="url(#{uid}-glow)" />
      {/if}
    {/each}
    <path d={p.cols} class="metal" stroke-width="0.6" />

    <!-- rows and crossings -->
    <path d={p.off} class="metal" stroke-width="0.6" stroke-dasharray="1 4" opacity="0.5" />
    <path d={p.live} class="metal" stroke-width="0.85" />
    {#each cfg.terms as t (t.term)}
      {#if activeTerm(f.fb, t.term) && (t.kind === 'product' || t.kind === 'true')}
        <path d="M{f.arrX0 - 3} {f.rowY(t.term)}H{f.arrX1 + 3}" class="metal" stroke="var(--hot)" stroke-width="1.5" filter="url(#{uid}-glow)" />
      {/if}
    {/each}
    <path d={p.x} fill="none" stroke="var(--metal)" stroke-width="1.15" stroke-linecap="round" />

    <!-- steering -->
    <path d={p.own} class="metal" stroke="var(--metal-dim)" stroke-width="0.9" />
    <path d={p.borrow} class="metal" stroke="var(--hov)" stroke-width="1.2" stroke-dasharray="3 2" style="filter: drop-shadow(0 0 2px var(--hov))" />
    {#each cfg.macrocells as m (m.mc)}
      {@const y = f.mcY(m.mc)}
      {@const used = m.orTerms.length > 0 || m.registered || m.oe !== OE_OFF}
      {@const io = m.io}
      {@const lv = mcLevel(io)}
      {@const sel = selMcs.has(io)}
      {@const ff = ffBox(f, 92, 136, y)}
      {@const pl = padLevel(io)}
      <g opacity={used ? 1 : 0.4}>
        <!-- OR, XOR, register, output buffer -->
        <path d="M{f.mcU(2)} {y - 12}Q{f.mcU(14)} {y} {f.mcU(2)} {y + 12}Q{f.mcU(30)} {y + 10} {f.mcU(42)} {y}Q{f.mcU(30)} {y - 10} {f.mcU(2)} {y - 12}Z" fill="#0a0d16" stroke={sel ? 'var(--sel)' : 'var(--metal)'} stroke-width="1.2" />
        <path d="M{f.mcU(42)} {y}H{f.mcU(58)}" class="metal" stroke={snap?.sums[io] ? 'var(--hot)' : 'var(--metal-dim)'} stroke-width="1.2" />
        <circle cx={f.mcU(66)} cy={y} r="8" fill={m.xor ? 'color-mix(in srgb, var(--hov) 38%, #0a0d16)' : '#0a0d16'} stroke="var(--metal)" stroke-width="1.2" />
        <path d="M{f.mcU(66) - 4} {y}h8M{f.mcU(66)} {y - 4}v8" stroke="var(--metal)" stroke-width="1" />
        <path d="M{f.mcU(74)} {y}H{f.mcU(92)}" class="metal" stroke={snap?.d[io] ? 'var(--hot)' : 'var(--metal-dim)'} stroke-width="1.2" />
        {#if m.registered}
          <rect x={ff.x} y={ff.y} width={ff.w} height={ff.h} rx="3" fill="#0a0d16" stroke="var(--metal)" stroke-width="1.3" />
          <text x={f.mcU(f.dir === 1 ? 98 : 98)} y={y - 4} text-anchor={f.dir === 1 ? 'start' : 'end'} class="lbl" style="font-size: 8px">{m.tff ? 'T' : 'D'}</text>
          <text x={f.mcU(130)} y={y - 4} text-anchor={f.dir === 1 ? 'end' : 'start'} class="lbl" style="font-size: 8px">Q</text>
          <text x={f.mcU(114)} y={y + 11} text-anchor="middle" class="lbl" style="font-size: 7.5px; fill: {snap?.q[io] ? 'var(--hot)' : ''}">{snap ? snap.q[io] : 'FF'}</text>
        {:else}
          <path d="M{f.mcU(92)} {y}H{f.mcU(136)}" class="metal" stroke={snap?.d[io] ? 'var(--hot)' : 'var(--metal-dim)'} stroke-width="1.2" />
        {/if}
        <path d="M{f.mcU(136)} {y}H{f.mcU(146)}" class="metal" stroke={lv === 1 ? 'var(--hot)' : 'var(--metal-dim)'} stroke-width="1.2" />
        <path d={triangle(f, 146, y, 16, 9)} fill="#0a0d16" stroke="var(--metal)" stroke-width="1.2" />
        <path d="M{f.mcU(162)} {y}H{f.padX + (f.right ? 0 : f.padW)}" class="metal" stroke={m.oe !== OE_OFF && lv === 1 ? 'var(--hot)' : 'var(--metal-dim)'} stroke-width="1.3" />
        {#if k > 1}
          <text x={f.mcU(4)} y={y - 16} text-anchor={f.dir === 1 ? 'start' : 'end'} class="lbl" style="font-size: 7.5px; fill: {sel ? 'var(--sel)' : ''}">MC{io}{chip.mcNames[io] ? ` · ${chip.mcNames[io]}` : ''}</text>
          <text x={f.mcU(146)} y={y + 20} text-anchor={f.dir === 1 ? 'start' : 'end'} class="lbl" style="font-size: 6.8px">{m.oe === OE_TERM ? 'OE: term' : m.oe === OE_GLOBAL ? 'OE: GOE' : m.oe === OE_OFF ? 'no pin' : 'OE: on'}</text>
        {/if}
        <!-- arrow heads of the steering lines -->
        <path d="M{f.mcU(3)} {y}l{-f.dir * 5} -3v6z" fill={m.borrowed ? 'var(--hov)' : 'var(--metal)'} />
      </g>
      <!-- pad -->
      <g>
        <rect x={f.padX} y={y - 10} width={f.padW} height="20" rx="3" fill={pl === 1 ? 'color-mix(in srgb, var(--hot) 35%, #0a0d16)' : '#0a0d16'} stroke={sel ? 'var(--sel)' : pl === 1 ? 'var(--hot)' : 'var(--metal-dim)'} stroke-width={sel ? 2 : 1.2} stroke-dasharray={pl === 'z' ? '3 2' : undefined} opacity={chip.ioRole[io] === 'free' ? 0.5 : 1} />
        <text x={f.padX + 5} y={y + 3.5} class="lbl" style="font-size: 8px">{io}</text>
        <text x={f.padX + f.padW - 5} y={y + 3.5} text-anchor="end" class="t" style="font-size: 9.5px; font-weight: 600">{chip.ioNames[io] ?? ''}</text>
      </g>
    {/each}
    {#if k > 2}
      {#each cfg.terms as t (t.term)}
        {#if t.isOe}<text x={f.arrX0 - 5} y={f.rowY(t.term) + 2.2} text-anchor="end" class="lbl" style="font-size: 5.6px; fill: var(--sel)">OE</text>{/if}
      {/each}
    {/if}
  {/each}

  {#if hit?.kind === 'fuse'}
    {@const f = g.fbs[hit.fb]!}
    <path d="M{f.arrX0} {f.rowY(hit.term)}H{f.arrX1}M{f.colX(hit.col)} {f.arrY0}V{f.arrY1}" class="metal" stroke="var(--hov)" stroke-width="0.7" stroke-dasharray="2 2" />
    <rect x={f.colX(hit.col) - 4} y={f.rowY(hit.term) - 4} width="8" height="8" rx="2" fill="none" stroke="#fff" stroke-width="1" />
  {/if}
  {#if focused}
    {@const f = g.fbs[cursor.fb]!}
    <rect x={f.colX(cursor.col) - 5} y={f.rowY(cursor.term) - 5} width="10" height="10" rx="2" fill="none" stroke="var(--focus)" stroke-width="1.8" />
  {/if}
{/snippet}

<div class="die screen" bind:this={box} ondblclick={dbl} role="presentation">
  <PanZoom bind:this={pz} width={g.W} height={g.H} home={compact ? fbRect(0) : undefined} minFit={COMPACT_MIN_FIT} wheel={compact ? 'modifier' : 'always'} label="vCPLD-32 chip: function blocks, interconnect matrix and pads" ondown={click} onpoint={pointerAt} onkey={key} onfocuschange={(f) => (focused = f)}>
    {#snippet children({ k })}
      {@render art(k)}
    {/snippet}
    {#snippet overlay({ w })}
      <div class="hud">
        <strong>{fit.summary}</strong>
      </div>
      <div class="macros" aria-label="Zoom to a block">
        {#each [0, 1, 2, 3] as f (f)}<button type="button" onclick={() => focusFb(f)} title="Zoom to function block {f}">FB{f}</button>{/each}
        <button type="button" onclick={focusGim} title="Zoom to the interconnect matrix">GIM</button>
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
    /* The fitter's summary is long ("11 of 32 macrocells, 28 of 160 product terms, 0 borrowed"): it wraps inside the pane. */
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .hud strong {
    color: var(--metal);
    font-weight: 500;
  }
  .macros {
    position: absolute;
    left: 0.6rem;
    bottom: 0.6rem;
    display: flex;
    gap: 2px;
    z-index: 4;
  }
  .macros button {
    min-width: 2.2rem;
    height: 1.5rem;
    padding: 0 0.4rem;
    border-radius: 5px;
    border: 1px solid var(--metal-dim);
    background: color-mix(in srgb, #05070d 80%, transparent);
    color: var(--die-ink);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    cursor: pointer;
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
