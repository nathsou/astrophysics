<!--
  The logic view recovered from the bits: the configuration decodes to pads, LUTs (with their flip-flops) and the
  wires the multiplexers select, and the netlist is laid out in layers, inputs on the left. What does this
  bitstream do? Read it here: each LUT says what it computes in terms of what drives it.
-->
<script lang="ts">
  import type { VFpgaDevice } from '../../../pld/devices/vfpga';
  import { layoutRecovered, recover } from '../../fpga/hand';
  import { hex4 } from '../../fpga/lut';
  import type { FpgaSession } from '../../fpga/session.svelte';

  let { session, device, bits }: { session: FpgaSession; device: VFpgaDevice; bits: Uint8Array } = $props();

  const rec = $derived(recover(device, bits));
  const lay = $derived(layoutRecovered(rec));
  const COLW = 190;
  const ROWH = 74;
  const BW = 132;
  const BH = 46;
  const W = $derived(lay.columns * COLW + 20);
  const H = $derived(lay.rows * ROWH + 16);
  const px = (i: number) => 12 + lay.col[i]! * COLW;
  const py = (i: number) => 10 + lay.row[i]! * ROWH;
  const nodeW = (i: number) => (rec.nodes[i]!.kind === 'lut' ? BW : 62);
  const nodeH = (i: number) => (rec.nodes[i]!.kind === 'lut' ? BH : 26);

  interface Edge {
    from: number;
    to: number;
    pin: number;
  }
  const edges = $derived.by(() => {
    const out: Edge[] = [];
    rec.nodes.forEach((n, to) => {
      const pins = n.kind === 'lut' ? n.used : n.kind === 'pad-out' ? [0] : [];
      for (const p of pins) if (n.inputs[p]! >= 0) out.push({ from: n.inputs[p]!, to, pin: p });
    });
    return out;
  });
  const floating = $derived(rec.nodes.flatMap((n, i) => (n.kind === 'lut' ? n.used.filter((p) => n.inputs[p]! < 0).map((p) => ({ i, p })) : n.kind === 'pad-out' && n.inputs[0]! < 0 ? [{ i, p: 0 }] : [])));
  const selected = $derived(session.selected?.kind === 'cell' ? `LC(${session.selected.x},${session.selected.y},${session.selected.k})` : null);

  function curve(e: Edge): string {
    const x1 = px(e.from) + nodeW(e.from);
    const y1 = py(e.from) + nodeH(e.from) / 2;
    const x2 = px(e.to);
    const pins = rec.nodes[e.to]!.kind === 'lut' ? rec.nodes[e.to]!.used : [0];
    const y2 = py(e.to) + ((pins.indexOf(e.pin) + 1) / (pins.length + 1)) * nodeH(e.to);
    const dx = Math.max(30, (x2 - x1) / 2);
    return `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
  }
  function pick(i: number) {
    const n = rec.nodes[i]!;
    if (n.kind === 'lut' && n.x !== undefined) session.selected = { kind: 'cell', x: n.x, y: n.y!, k: n.k! };
  }
</script>

<div class="rv ui">
  {#if rec.nodes.length === 0}
    <p class="empty">Nothing is configured yet. Set a LUT, connect a pad, and the logic appears here.</p>
  {:else}
    <div class="scroll">
      <svg viewBox="0 0 {W} {H}" style="width: 100%; max-width: {W}px; height: auto" role="img" aria-label="Logic recovered from the configuration bits: {rec.nodes.filter((n) => n.kind === 'lut').length} LUTs">
        {#each edges as e, i (i)}
          <path d={curve(e)} class="edge" />
        {/each}
        {#each rec.nodes as n, i (i)}
          {#if n.kind === 'lut'}
            <g class="node lut" class:sel={selected === n.id} role="button" tabindex="0" aria-label="{n.label}: {n.expression}" onclick={() => pick(i)} onkeydown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && pick(i)}>
              <rect x={px(i)} y={py(i)} width={BW} height={BH} rx="6" />
              <text x={px(i) + 8} y={py(i) + 14} class="l">{n.label.replace('LC', 'LC ')}{n.ff ? ' + flip-flop' : ''}</text>
              <text x={px(i) + 8} y={py(i) + 29} class="e">{n.expression && n.expression.length > 22 ? `${n.expression.slice(0, 21)}…` : n.expression}</text>
              <text x={px(i) + 8} y={py(i) + 41} class="h">{hex4(n.truth ?? 0)}</text>
            </g>
          {:else}
            <g class="node pad" class:out={n.kind === 'pad-out'}>
              <rect x={px(i)} y={py(i)} width="62" height="26" rx="13" />
              <text x={px(i) + 31} y={py(i) + 17} text-anchor="middle" class="l">{n.kind === 'const' ? `const ${n.label}` : n.label}</text>
            </g>
          {/if}
        {/each}
        {#each floating as f, i (i)}
          <text x={px(f.i) - 6} y={py(f.i) + 12 + f.p * 8} text-anchor="end" class="float">I{f.p}?</text>
        {/each}
      </svg>
    </div>
    {#if rec.loops.length}
      <p class="loop" role="alert"><strong>Combinational loop:</strong> {rec.loops[0]}. The output never settles unless something in the loop is a flip-flop.</p>
    {/if}
    {#if floating.length}<p class="note">An input marked “?” is not connected: an unconnected LUT input reads as unknown.</p>{/if}
  {/if}
</div>

<style>
  .rv {
    padding: 0.4rem 0.6rem;
    font-size: 0.78rem;
  }
  .scroll {
    overflow: auto;
    max-width: 100%;
  }
  .empty,
  .note {
    margin: 0.4rem 0;
    color: var(--mute);
    font-size: 0.78rem;
  }
  .loop {
    margin: 0.4rem 0 0;
    color: var(--bad);
    font-size: 0.78rem;
  }
  svg {
    display: block;
    font-family: var(--font-mono);
  }
  .edge {
    fill: none;
    stroke: var(--wire);
    stroke-width: 1.5;
  }
  .lut rect {
    fill: var(--surface);
    stroke: var(--copper);
    stroke-width: 1.4;
  }
  .lut.sel rect {
    stroke: var(--phosphor);
    stroke-width: 2.4;
  }
  .lut {
    cursor: pointer;
  }
  .lut:focus-visible rect {
    stroke: var(--focus);
    stroke-width: 2.4;
  }
  .pad rect {
    fill: var(--surface-3);
    stroke: var(--line-strong);
  }
  .pad.out rect {
    stroke: var(--phosphor);
  }
  text {
    fill: var(--fg);
    font-size: 10px;
  }
  .l {
    font-weight: 600;
    font-size: 9.5px;
  }
  .e {
    fill: var(--copper-ink);
    font-size: 10.5px;
  }
  .h {
    fill: var(--mute);
    font-size: 8.5px;
  }
  .float {
    fill: var(--bad);
    font-size: 9px;
  }
</style>
