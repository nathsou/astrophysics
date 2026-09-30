<!--
  What the selection is, under the chip view: for a logic cell its source elements (module paths and DCL lines), its
  truth table (as a function, in hex and as 16 bits) and its configuration bits; for a net its driver, its route and
  the wires it uses; for a tile the cells it holds. Everything in it is a link that moves the selection.
-->
<script lang="ts">
  import { NK } from '../../../pld/devices/vfpga';
  import { lutExpression, hex4 } from '../../fpga/lut';
  import type { FpgaSession } from '../../fpga/session.svelte';

  let { session }: { session: FpgaSession } = $props();

  const sel = $derived(session.selected);
  const r = $derived(session.result);
  const ix = $derived(session.index);
  const d = $derived(session.device);

  const cell = $derived.by(() => {
    if (!r || !ix || sel?.kind !== 'cell') return null;
    const i = r.cellIndex[`${sel.x},${sel.y},${sel.k}`];
    return i === undefined ? null : r.cells[i]!;
  });
  const cellNet = $derived(cell && ix ? (ix.netOfCell.get(`${cell.x},${cell.y},${cell.k}`) ?? -1) : -1);
  const sourceInfo = (id: string) => r?.sources[ix?.sourceByIndex.get(id) ?? -1];

  const net = $derived(r && sel?.kind === 'net' ? r.nets[sel.net] : null);
  const netStats = $derived.by(() => {
    if (!net || !d) return null;
    const spans: Record<number, number> = { 1: 0, 4: 0, 12: 0 };
    const nk = d.wireKinds.length;
    for (const n of net.nodes) if (d.nodeKind[n] === NK.WIRE) spans[d.wireKinds[d.nodeIdx[n]! % nk]!.span]!++;
    // The slowest path from the driver: sum the node delays down the route tree.
    const tree = r!.route.nets.find((t) => t.index === (sel as { net: number }).net);
    let worst = 0;
    if (tree) {
      const acc: number[] = [];
      tree.nodes.forEach((n, i) => {
        acc[i] = (tree.parents[i]! >= 0 ? acc[tree.parents[i]!]! : 0) + d.nodeDelay[n]!;
        worst = Math.max(worst, acc[i]!);
      });
    }
    return { spans, sinks: tree ? tree.nodes.filter((n) => d.nodeKind[n] === NK.LCI || d.nodeKind[n] === NK.PADO || d.nodeKind[n] === NK.CE || d.nodeKind[n] === NK.SR || d.nodeKind[n] === NK.RAMI).length : 0, delay: worst };
  });
  const tileCells = $derived.by(() => {
    if (!ix || !r || sel?.kind !== 'tile') return [];
    return (ix.cellsByTile.get(`${sel.x},${sel.y}`) ?? []).map((i) => r.cells[i]!).sort((a, b) => a.k - b.k);
  });
  const show = $derived(!!cell || !!net || (sel?.kind === 'tile' && tileCells.length > 0));
</script>

{#if show && r && ix}
  <div class="det ui" aria-live="polite">
    {#if cell}
      <div class="head"><strong>LC({cell.x},{cell.y},{cell.k})</strong><span class="k">{cell.kind}</span><span>{cell.label}</span></div>
      <div class="tt">
        <code class="fn">{lutExpression(cell.truth)}</code>
        <span class="hex">LUT {hex4(cell.truth)}</span>
        <span class="strip" role="img" aria-label="Truth table bits, highest row first">{#each { length: 16 } as _, b (b)}{@const bit = (cell.truth >> (15 - b)) & 1}<i class:on={bit === 1}>{bit}</i>{/each}</span>
      </div>
      <div class="row">
        <button type="button" onclick={() => session.select({ kind: 'bit', index: cell.bitOffset })} title="Select the first of its 25 configuration bits">bits {cell.bitOffset}–{cell.bitOffset + 24}</button>
        {#if cellNet >= 0}<button type="button" onclick={() => session.select({ kind: 'net', net: cellNet })}>drives net {r.nets[cellNet]!.name}</button>{/if}
      </div>
      <ul class="src">
        {#each cell.sourceIds as id (id)}
          {@const s = sourceInfo(id)}
          <li><button type="button" onclick={() => session.select({ kind: 'source', id })}><span class="p">{s?.path ?? ''}</span><span class="t">{s?.type}</span>{#if s?.line !== undefined}<span class="l">line {s.line}</span>{/if}</button></li>
        {/each}
      </ul>
    {:else if net && netStats}
      <div class="head"><strong>Net {net.name}</strong><span>{net.nodes.length} routing nodes</span><span>{netStats.sinks} sink{netStats.sinks === 1 ? '' : 's'}</span></div>
      <p class="line">wires: {netStats.spans[1]} span-1 · {netStats.spans[4]} span-4 · {netStats.spans[12]} span-12 · longest path ≈ {netStats.delay.toFixed(2)} ns through {net.nodes.length} nodes</p>
      <ul class="src">
        {#each net.sourceIds as id (id)}
          {@const s = sourceInfo(id)}
          <li><button type="button" onclick={() => session.select({ kind: 'source', id })}><span class="p">{s?.path ?? id}</span><span class="t">{s?.type}</span>{#if s?.line !== undefined}<span class="l">line {s.line}</span>{/if}</button></li>
        {/each}
      </ul>
    {:else if sel?.kind === 'tile'}
      <div class="head"><strong>Tile ({sel.x}, {sel.y})</strong><span>{tileCells.length} of 8 cells configured</span></div>
      <ul class="src">
        {#each tileCells as c (c.k)}
          <li><button type="button" onclick={() => session.select({ kind: 'cell', x: c.x, y: c.y, k: c.k })}><span class="p">cell {c.k}</span><span class="t">{c.kind}</span><span class="l">{c.label}</span></button></li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  .det {
    padding: 0.4rem 0.7rem 0.5rem;
    border-top: 1px solid var(--line);
    background: var(--pn);
    font-size: 0.76rem;
    color: var(--ink-2);
    max-height: 10.5rem;
    overflow: auto;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2rem 0.7rem;
  }
  .head strong {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .k {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--copper-ink);
  }
  .tt {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 0.8rem;
    margin: 0.3rem 0;
  }
  .fn {
    font-family: var(--font-mono);
    color: var(--fg);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 5px;
    padding: 0.05rem 0.4rem;
  }
  .hex {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--mute);
  }
  .strip {
    display: inline-flex;
    gap: 1px;
  }
  .strip i {
    font-style: normal;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    width: 0.85rem;
    text-align: center;
    background: var(--surface-3);
    color: var(--mute);
    border-radius: 2px;
  }
  .strip i.on {
    background: var(--sig-high);
    color: #1b1204;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.2rem;
  }
  .row button {
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
    font: inherit;
    font-size: 0.7rem;
    padding: 0.05rem 0.5rem;
    border-radius: 5px;
    cursor: pointer;
  }
  .row button:hover {
    border-color: var(--copper);
  }
  .line {
    margin: 0.25rem 0;
    font-size: 0.72rem;
  }
  .src {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .src button {
    display: flex;
    gap: 0.6rem;
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--ink-2);
    font: inherit;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-align: left;
    padding: 0.08rem 0.3rem;
    border-radius: 4px;
    cursor: pointer;
  }
  .src button:hover {
    background: var(--term-hl);
  }
  .p {
    color: var(--fg);
  }
  .t {
    color: var(--copper-ink);
    min-width: 3rem;
  }
  .l {
    color: var(--mute);
  }
</style>
