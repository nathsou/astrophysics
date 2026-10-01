<!--
  The tune diagram: the working point (Qx, Qy) of a ring among its resonance lines n·Qx + m·Qy = p. A particle that meets the same kick
  on every n-th turn (the tune is a simple fraction) is driven until it is lost; the lower the order |n| + |m|, the stronger the resonance.

    ::resonance-map{n="20.5" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { resonanceLines, resonanceDistance } from '$lib/hep/machine';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  const QX0 = 64, QY0 = 59; // the LHC's integer tunes: the window is [64, 65] × [59, 60]
  let fx = $state(0.31);
  let fy = $state(0.32);
  let maxOrder = $state(3);
  let spread = $state(0.01);

  const qx = $derived(QX0 + fx);
  const qy = $derived(QY0 + fy);
  const lines = $derived(resonanceLines(maxOrder, QX0, QY0));
  const near = $derived(resonanceDistance(qx, qy, maxOrder));
  // Lines that cross the tune footprint (a square of half-width `spread`).
  const hit = $derived(lines.filter((l) => Math.abs(l.n * qx + l.m * qy - l.p) <= spread * (Math.abs(l.n) + l.m) + 1e-12));
  const byOrder = $derived([1, 2, 3, 4, 5].map((o) => hit.filter((l) => l.order === o).length));

  const S = 390, M = 46;
  const px = (q: number) => M + (q - QX0) * (S - 2 * M);
  const py = (q: number) => S - M - (q - QY0) * (S - 2 * M);

  /** Clip the line n x + m y = p to the window; returns two points or null. */
  function segment(l: { n: number; m: number; p: number }): [number, number, number, number] | null {
    const pts: [number, number][] = [];
    const inside = (x: number, y: number) => x >= QX0 - 1e-9 && x <= QX0 + 1 + 1e-9 && y >= QY0 - 1e-9 && y <= QY0 + 1 + 1e-9;
    if (l.m === 0) {
      const x = l.p / l.n;
      return x >= QX0 && x <= QX0 + 1 ? [x, QY0, x, QY0 + 1] : null;
    }
    for (const x of [QX0, QX0 + 1]) {
      const y = (l.p - l.n * x) / l.m;
      if (inside(x, y)) pts.push([x, y]);
    }
    if (l.n !== 0) {
      for (const y of [QY0, QY0 + 1]) {
        const x = (l.p - l.m * y) / l.n;
        if (inside(x, y)) pts.push([x, y]);
      }
    } else {
      const y = l.p / l.m;
      return y >= QY0 && y <= QY0 + 1 ? [QX0, y, QX0 + 1, y] : null;
    }
    if (pts.length < 2) return null;
    return [pts[0]![0], pts[0]![1], pts[1]![0], pts[1]![1]];
  }
  const segs = $derived(lines.map((l) => ({ l, s: segment(l) })).filter((d) => d.s !== null) as { l: (typeof lines)[number]; s: [number, number, number, number] }[]);
  const style = (o: number) => ({ w: [0, 2.6, 1.9, 1.3, 0.9, 0.7][o] ?? 0.7, dash: ['', '', '8 3', '4 3', '2 3', '1 3'][o] ?? '1 3' });
  const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth'];

  function pick(e: PointerEvent) {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * (S - 2 * M);
    const y = ((e.clientY - r.top) / r.height) * (S - 2 * M);
    fx = Math.min(0.99, Math.max(0, Math.round((x / (S - 2 * M)) * 100) / 100));
    fy = Math.min(0.99, Math.max(0, Math.round((1 - y / (S - 2 * M)) * 100) / 100));
  }
  let dragging = false;
  const coeff = (c: number) => (Math.abs(c) === 1 ? '' : String(Math.abs(c)));
  function eqn(l: { n: number; m: number; p: number }): string {
    let out = '';
    if (l.n !== 0) out += `${l.n < 0 ? '−' : ''}${coeff(l.n)}Qx`;
    if (l.m !== 0) out += `${out ? ' + ' : ''}${coeff(l.m)}Qy`;
    return `${out} = ${l.p}`;
  }
</script>

<Widget title="The tune diagram" subtitle="Where in the (Qx, Qy) plane can a ring work?" {n} {caption} kind="Explore" onreset={() => { fx = 0.31; fy = 0.32; maxOrder = 3; spread = 0.01; }}>
  {#snippet controls()}
    <Slider bind:value={fx} min={0} max={0.99} step={0.01} label="Horizontal tune Qx = 64 + …" format={(v) => v.toFixed(2)} />
    <Slider bind:value={fy} min={0} max={0.99} step={0.01} label="Vertical tune Qy = 59 + …" format={(v) => v.toFixed(2)} />
    <Slider bind:value={maxOrder} min={1} max={5} step={1} label="Highest resonance order drawn" format={(v) => v.toFixed(0)} />
    <Slider bind:value={spread} min={0} max={0.05} step={0.005} label="Tune spread of the beam, ± [in Q]" format={(v) => v.toFixed(3)} />
  {/snippet}

  <div class="grid">
    <svg viewBox="0 0 {S} {S}" class="map" role="img" aria-label="Tune diagram for Qx between 64 and 65 and Qy between 59 and 60, with resonance lines up to order {maxOrder}. The working point is ({qx.toFixed(2)}, {qy.toFixed(2)}).">
      <rect x={M} y={M} width={S - 2 * M} height={S - 2 * M} class="frame" />
      {#each segs as d}
        <line x1={px(d.s[0])} y1={py(d.s[1])} x2={px(d.s[2])} y2={py(d.s[3])} class="res o{d.l.order}" stroke-width={style(d.l.order).w} stroke-dasharray={style(d.l.order).dash}><title>{ORD[d.l.order]}-order resonance: {eqn(d.l)}</title></line>
      {/each}
      <rect x={px(qx - spread)} y={py(qy + spread)} width={Math.max(2, 2 * spread * (S - 2 * M))} height={Math.max(2, 2 * spread * (S - 2 * M))} class="foot" />
      <circle cx={px(qx)} cy={py(qy)} r="4.5" class="wp" />
      {#each [0, 0.25, 0.5, 0.75, 1] as t}
        <text x={px(QX0 + t)} y={S - M + 15} text-anchor="middle" class="tk">{(QX0 + t).toFixed(2)}</text>
        <text x={M - 6} y={py(QY0 + t)} text-anchor="end" dy="0.3em" class="tk">{(QY0 + t).toFixed(2)}</text>
      {/each}
      <text x={S / 2} y={S - 6} text-anchor="middle" class="ax">Qx</text>
      <text x="11" y={S / 2} class="ax" transform="rotate(-90 11 {S / 2})" text-anchor="middle">Qy</text>
      <rect x={M} y={M} width={S - 2 * M} height={S - 2 * M} fill="transparent" role="presentation" style="cursor: crosshair; touch-action: none"
        onpointerdown={(e) => { dragging = true; (e.currentTarget as Element).setPointerCapture(e.pointerId); pick(e); }}
        onpointermove={(e) => dragging && pick(e)} onpointerup={() => (dragging = false)} />
    </svg>
    <div class="side ui" role="status" aria-live="polite">
      <p class="big">Working point <strong>({qx.toFixed(2)}, {qy.toFixed(2)})</strong></p>
      <p>Nearest resonance of order ≤ {maxOrder}: <strong>{near.line ? eqn(near.line) : '–'}</strong>, at a distance <strong>{near.distance.toFixed(3)}</strong> in the (Qx, Qy) plane.</p>
      <p>Lines crossing the beam's tune spread: <strong>{hit.length}</strong>{hit.length ? ` (${byOrder.map((c, i) => (c ? `${c} of order ${i + 1}` : '')).filter(Boolean).join(', ')})` : ''}.</p>
      <ul class="key">
        {#each [1, 2, 3, 4, 5] as o}
          {#if o <= maxOrder}<li><svg width="34" height="8" aria-hidden="true"><line x1="0" y1="4" x2="34" y2="4" stroke="var(--ink)" stroke-width={style(o).w} stroke-dasharray={style(o).dash} /></svg> order {o}</li>{/if}
        {/each}
      </ul>
      <p class="sm">Click or drag in the diagram to move the working point. Both integer parts are fixed: the LHC's design tunes are about 64.3 and 59.3.</p>
    </div>
  </div>
</Widget>

<style>
  .grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 1rem; align-items: start; }
  @media (max-width: 720px) { .grid { grid-template-columns: minmax(0, 1fr); } }
  .map { width: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; }
  .frame { fill: none; stroke: var(--line-strong); }
  .res { stroke: var(--ink); fill: none; }
  .res.o1 { stroke: var(--bad); }
  .res.o2 { stroke: var(--series-2); }
  .foot { fill: var(--accent-soft); stroke: var(--accent-ink); stroke-width: 1; opacity: 0.8; }
  .wp { fill: var(--accent); stroke: var(--ink); stroke-width: 1.5; }
  .tk { font-size: 10px; fill: var(--ink-3); }
  .ax { font-size: 12px; fill: var(--ink-2); }
  .side p { margin: 0 0 0.5rem; font-size: 0.86rem; }
  .side .sm { font-size: 0.76rem; color: var(--mute); }
  .key { list-style: none; padding: 0; margin: 0.2rem 0 0.6rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr)); gap: 0.15rem 0.5rem; font-size: 0.78rem; }
  .key li { display: flex; align-items: center; gap: 0.3rem; }
</style>
