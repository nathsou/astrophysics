<!--
  The design hierarchy beside the chip it was fitted to. Hover, focus or click a module on the left to light the
  macrocells that implement it; hover or click a macrocell to see its equation. The fitter is the course's own.

    ::floorplan-map{n="27.4" design="bcd" caption="…"}
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { BLOCK_INPUTS, DESIGNS, floorplan, moduleNodes, outputsOf, type CellView, type FloorMode } from './floorplan';

  let { n, caption, design: start = 'bcd' }: { n?: string | number; caption?: string; design?: string } = $props();

  let id = $state(untrack(() => start));
  let mode = $state<FloorMode>('fitter');
  let sel = $state<string | null>(null); // module id or output name
  let hov = $state<string | null>(null);

  const d = $derived(DESIGNS.find((x) => x.id === id) ?? DESIGNS[0]!);
  const r = $derived(floorplan(d, mode));
  const nodes = $derived(moduleNodes(d.tree));
  const topKids = $derived(d.tree.children ?? []);
  const colorOf = (path: string[]) => {
    const k = topKids.findIndex((c) => c.id === path[1]);
    return `var(--series-${((k < 0 ? 0 : k) % 8) + 1})`;
  };
  const focus = $derived(hov ?? sel);
  const lit = (c: CellView): boolean => {
    if (!focus) return true;
    if (focus === c.name) return true;
    const node = nodes.find((x) => x.node.id === focus)?.node;
    return node ? outputsOf(node).includes(c.name) : false;
  };
  const cell = $derived(r.fbs.flatMap((f) => f.cells).find((c) => c && (c.name === sel || c.name === hov)) ?? null);
  const kindText = (c: CellView) => (c.kind === 'comb' ? 'combinational' : `${c.kind} flip-flop`);
  const fmt = (v: number) => (Number.isFinite(v) && v > 0 ? `${v} ns` : 'n/a');

  function pick(v: string) {
    id = v;
    sel = null;
    hov = null;
  }
  const toggle = (v: string) => (sel = sel === v ? null : v);
</script>

<Widget {n} title="From the design to the chip" subtitle="Modules on the left, macrocells on the right" {caption} onreset={() => ((id = start), (mode = 'fitter'), (sel = null))}>
  {#snippet controls()}
    <Segmented label="Design" size="sm" value={id} onchange={pick} options={DESIGNS.map((x) => ({ value: x.id, label: x.label, title: x.story }))} />
    <Segmented label="Placement" size="sm" bind:value={mode} options={[{ value: 'fitter', label: 'The fitter’s choice', title: 'Let the fitter partition the outputs' }, { value: 'spread', label: 'Spread over the blocks', title: 'Force consecutive outputs into different function blocks' }]} />
  {/snippet}

  <div class="fm">
    <p class="story ui">{d.story}</p>
    <div class="cols">
      <div class="tree ui" role="tree" aria-label="Design hierarchy">
        {#each nodes as { node, depth } (node.id)}
          <div class="node" style:padding-left="{depth * 0.9}rem" role="treeitem" aria-selected={sel === node.id}>
            <button type="button" class="mod" class:on={focus === node.id} onmouseenter={() => (hov = node.id)} onmouseleave={() => (hov = null)} onfocus={() => (hov = node.id)} onblur={() => (hov = null)} onclick={() => toggle(node.id)}>
              {#if depth > 0}<i class="sw" style:background={colorOf(['top', node.id])}></i>{/if}
              <span>{node.label}</span>
              <small>{outputsOf(node).length}</small>
            </button>
            {#if node.outputs && depth > 0}
              <div class="outs" style:padding-left="{0.9}rem">
                {#each node.outputs as o (o)}
                  <button type="button" class="out" class:on={focus === o} onmouseenter={() => (hov = o)} onmouseleave={() => (hov = null)} onfocus={() => (hov = o)} onblur={() => (hov = null)} onclick={() => toggle(o)}>{o}</button>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <div class="chip" aria-label="The four function blocks">
        {#each r.fbs as f (f.fb)}
          {@const used = f.cells.some(Boolean)}
          <section class="fb" class:idle={!used}>
            <header class="ui"><b>FB{f.fb}</b><span class:full={f.inputs >= BLOCK_INPUTS}>{f.inputs}/{BLOCK_INPUTS} signals</span></header>
            <div class="meter" aria-hidden="true"><i style:width="{(100 * f.inputs) / BLOCK_INPUTS}%"></i></div>
            <ol>
              {#each f.cells as c, mc (mc)}
                {#if c}
                  <li>
                    <button type="button" class="cell" class:dim={!lit(c)} class:buried={c.buried} class:on={c.name === sel} style:--c={colorOf(c.path)} onmouseenter={() => (hov = c.name)} onmouseleave={() => (hov = null)} onfocus={() => (hov = c.name)} onblur={() => (hov = null)} onclick={() => toggle(c.name)} aria-label="{c.name}, macrocell {f.fb * 8 + mc}, {kindText(c)}, {c.terms} product terms">
                      <span class="i">{mc}</span><span class="nm">{c.name}</span><span class="k">{c.kind === 'comb' ? '' : c.kind}</span><span class="t">{c.terms}{c.borrowed ? '+' + c.borrowed : ''}</span>
                    </button>
                  </li>
                {:else}
                  <li><span class="cell empty"><span class="i">{mc}</span></span></li>
                {/if}
              {/each}
            </ol>
          </section>
        {/each}
      </div>
    </div>

    <div class="info ui" aria-live="polite">
      {#if cell}
        <b>{cell.name}</b> in FB{cell.fb}, macrocell {cell.fb * 8 + cell.mc}: {kindText(cell)}{cell.buried ? ', buried (no pin)' : ''}, {cell.terms} product term{cell.terms === 1 ? '' : 's'}{cell.borrowed ? ` (${cell.borrowed} borrowed)` : ''}, active {cell.polarity}.
        <code>{cell.polarity === 'low' ? '!(' : ''}{cell.sum}{cell.polarity === 'low' ? ')' : ''}</code>
        <span class="dl">Delay to this output: {cell.tpd !== undefined ? `${cell.tpd} ns` : 'clocked'}{cell.depth ? `, behind ${cell.depth} combinational macrocell${cell.depth === 1 ? '' : 's'}` : ''}.</span>
      {:else}
        Hover a module or a macrocell. Numbers on a macrocell are its product terms (+ borrowed).
      {/if}
    </div>
    <dl class="sum ui">
      <div><dt>Macrocells</dt><dd>{r.totals.macrocells} of 32</dd></div>
      <div><dt>Signals through the matrix</dt><dd>{r.totals.blockInputs} of {r.totals.blockInputCapacity}</dd></div>
      <div><dt>Worst pin to pin</dt><dd>{fmt(r.totals.tpd)}</dd></div>
      <div><dt>Worst clock to output</dt><dd>{fmt(r.totals.tco)}</dd></div>
    </dl>
  </div>
</Widget>

<style>
  .fm {
    display: grid;
    gap: 0.7rem;
    padding: 0.9rem 1rem 1rem;
  }
  .story {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .cols {
    display: grid;
    gap: 0.9rem;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  @media (min-width: 760px) {
    .cols {
      grid-template-columns: 12.5rem minmax(0, 1fr);
    }
  }
  .tree {
    display: grid;
    gap: 2px;
    font-size: 0.82rem;
  }
  .mod,
  .out {
    font: inherit;
    color: var(--fg);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 5px;
    cursor: pointer;
    text-align: left;
  }
  .mod {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.2rem 0.4rem;
    font-weight: 600;
  }
  .mod small {
    margin-left: auto;
    font-family: var(--font-mono);
    color: var(--mute);
    font-weight: 400;
  }
  .mod:hover,
  .mod.on,
  .out:hover,
  .out.on {
    border-color: var(--copper);
    background: var(--copper-soft);
  }
  .sw {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    flex: none;
  }
  .outs {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    padding-top: 1px;
  }
  .out {
    padding: 0.05rem 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.74rem;
  }
  .chip {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }
  @media (min-width: 1000px) {
    .chip {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
  .fb {
    border: 1px solid var(--line-strong);
    border-radius: 7px;
    background: var(--pn);
    padding: 0.35rem;
    min-width: 0;
  }
  .fb.idle {
    opacity: 0.55;
    border-style: dashed;
  }
  .fb header {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    color: var(--mute);
    margin-bottom: 0.2rem;
  }
  .fb header b {
    color: var(--fg);
    font-family: var(--font-mono);
  }
  .fb header .full {
    color: var(--bad);
  }
  .meter {
    height: 4px;
    background: var(--line);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 0.3rem;
  }
  .meter i {
    display: block;
    height: 100%;
    background: var(--copper);
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  .cell {
    display: grid;
    grid-template-columns: 0.9rem minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 0.25rem;
    width: 100%;
    padding: 0.12rem 0.3rem;
    border: 1px solid var(--line-strong);
    border-left: 4px solid var(--c, var(--sig-low));
    border-radius: 4px;
    background: var(--panel);
    color: var(--fg);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    cursor: pointer;
    text-align: left;
    height: 1.5rem;
  }
  .cell.empty {
    border-style: dashed;
    border-left-style: dashed;
    border-left-width: 1px;
    border-color: var(--line);
    background: transparent;
    cursor: default;
    color: var(--mute);
  }
  .cell.buried {
    border-style: dashed;
    border-left-style: solid;
  }
  .cell.dim {
    opacity: 0.25;
  }
  .cell.on,
  .cell:hover {
    border-color: var(--copper);
    background: var(--copper-soft);
  }
  .i {
    color: var(--mute);
  }
  .nm {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .k {
    color: var(--mute);
    font-size: 0.66rem;
  }
  .t {
    color: var(--copper-ink);
    font-weight: 700;
  }
  .info {
    font-size: 0.82rem;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border-left: 3px solid var(--line-strong);
    background: var(--pn);
    min-height: 3.2rem;
    color: var(--ink-2);
  }
  .info code {
    display: block;
    margin: 0.25rem 0;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--fg);
    overflow-wrap: anywhere;
  }
  .dl {
    display: block;
  }
  .sum {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.4rem;
    margin: 0;
  }
  .sum div {
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.3rem 0.5rem;
  }
  .sum dt {
    font-size: 0.7rem;
    color: var(--mute);
  }
  .sum dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.9rem;
  }
</style>
