<!--
  From gates to lookup tables: a small and-inverter graph, optionally balanced, covered with LUTs of two, three or
  four inputs by the course's own mapper. Click a node to see every cut it has and which one the mapper chose.

    ::cut-mapper{n="30.3" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { PRESETS, allCuts, buildGraph, map, ttHex, type NodeInfo } from './cut-mapper';

  let { n, caption, preset: start = 'wrapped', k: startK = 4 }: { n?: string | number; caption?: string; preset?: string; k?: number } = $props();

  // svelte-ignore state_referenced_locally
  let id = $state(PRESETS.some((p) => p.id === start) ? start : 'wrapped');
  // svelte-ignore state_referenced_locally
  let k = $state<2 | 3 | 4>(startK === 2 || startK === 3 ? startK : 4);
  let balance = $state(false);
  let picked = $state<number | null>(null);

  const preset = $derived(PRESETS.find((p) => p.id === id)!);
  const graph = $derived(buildGraph(id, balance));
  const m = $derived(map(graph, k));
  const byNode = $derived(new Map(m.nodes.map((x) => [x.node, x])));
  const nameOf = (v: number) => byNode.get(v)?.name ?? `n${v}`;

  // Layout: one column per level, inputs on the left.
  const COLW = 58;
  const ROWH = 27;
  const PADX = 40;
  const PADY = 18;
  const layout = $derived.by(() => {
    const cols = new Map<number, NodeInfo[]>();
    for (const x of m.nodes) cols.set(x.level, [...(cols.get(x.level) ?? []), x]);
    const order = new Map(graph.inputs.map((i, k) => [i.node, k]));
    const ys = new Map<number, number>();
    const inputs = (cols.get(0) ?? []).sort((a, b) => (order.get(a.node) ?? 0) - (order.get(b.node) ?? 0));
    inputs.forEach((x, i) => ys.set(x.node, i * ROWH));
    const levels = Math.max(...m.nodes.map((x) => x.level)) + 1;
    // Each node sits at the mean height of what feeds it, pushed down where two would touch: wires then rarely pass under a node.
    for (let lv = 1; lv < levels; lv++) {
      const list = (cols.get(lv) ?? []).map((x) => {
        const f = [graph.aig.fan0[x.node]! >> 1, graph.aig.fan1[x.node]! >> 1];
        return { x, want: f.reduce((a, v) => a + (ys.get(v) ?? 0), 0) / f.length };
      });
      list.sort((a, b) => a.want - b.want || a.x.node - b.x.node);
      let prev = -Infinity;
      for (const it of list) {
        const y = Math.max(it.want, prev + ROWH);
        ys.set(it.x.node, y);
        prev = y;
      }
    }
    const pos = new Map<number, { x: number; y: number }>();
    for (const x of m.nodes) pos.set(x.node, { x: PADX + x.level * COLW, y: PADY + (ys.get(x.node) ?? 0) });
    const maxY = Math.max(...[...pos.values()].map((p) => p.y));
    return { pos, w: PADX * 2 + levels * COLW - 10, h: maxY + PADY + 8 };
  });

  const edges = $derived(
    m.nodes
      .filter((x) => x.kind === 'and')
      .flatMap((x) => [graph.aig.fan0[x.node]!, graph.aig.fan1[x.node]!].map((f) => ({ from: f >> 1, to: x.node, inv: (f & 1) === 1 }))),
  );

  const colour = (i: number) => `var(--series-${(i % 8) + 1})`;
  const cuts = $derived(picked !== null && byNode.get(picked)?.kind === 'and' ? allCuts(graph.aig, picked, k) : []);
  const chosen = $derived(picked !== null && byNode.get(picked)!.lut >= 0 ? m.mapped.luts[byNode.get(picked)!.lut]! : null);
  const labelOf = (v: number) => byNode.get(v)?.label ?? 0;
  const summary = $derived(`${preset.label}: ${m.andNodes} AND nodes, ${m.aigDepth} deep in the graph; with ${k}-input LUTs: ${m.luts} LUTs, ${m.depth} levels.`);
  const badge = (x: NodeInfo) => (x.lut >= 0 ? `L${x.lut}` : '');
</script>

<Widget {n} title="From gates to lookup tables" subtitle="Cuts, depth and area" {caption} onreset={() => ((id = start), (k = 4), (balance = false), (picked = null))}>
  {#snippet controls()}
    <Segmented label="Function" value={id} onchange={(v) => ((id = v), (picked = null))} options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} size="sm" />
    <Segmented label="Inputs per LUT" value={k} onchange={(v) => (k = v)} options={[{ value: 2, label: 'K = 2' }, { value: 3, label: 'K = 3' }, { value: 4, label: 'K = 4' }]} size="sm" />
    <Toggle bind:checked={balance} label="Balance the graph first" onchange={() => (picked = null)} />
  {/snippet}

  <div class="cm">
    <p class="story ui">{preset.story}</p>

    <div class="scroll">
      <svg viewBox="0 0 {layout.w} {layout.h}" role="group" aria-label={summary} style:min-width="{Math.min(layout.w, 480)}px">
        {#each edges as e, i (i)}
          {@const a = layout.pos.get(e.from)!}
          {@const b = layout.pos.get(e.to)!}
          <line x1={a.x + (byNode.get(e.from)!.kind === 'input' ? 12 : 8)} y1={a.y} x2={b.x - 8} y2={b.y} class="edge" class:inv={e.inv} />
          {#if e.inv}<circle cx={b.x - 11} cy={b.y + (a.y - b.y) * 0.05} r="2.2" class="bubble" />{/if}
        {/each}
        {#each m.nodes as x (x.node)}
          {@const p = layout.pos.get(x.node)!}
          {@const cov = x.covers[0]}
          <g
            class="node"
            class:sel={picked === x.node}
            class:root={x.lut >= 0}
            role="button"
            tabindex="0"
            aria-label="{x.kind === 'input' ? `Input ${x.name}` : `AND node ${x.node}`}{x.lut >= 0 ? `, the output of LUT ${x.lut}` : ''}. Show its cuts."
            aria-pressed={picked === x.node}
            onclick={() => (picked = picked === x.node ? null : x.node)}
            onkeydown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                picked = picked === x.node ? null : x.node;
              }
            }}
          >
            {#if x.kind === 'input'}
              <rect x={p.x - 12} y={p.y - 8} width="24" height="16" rx="3" class="pi" />
              <text x={p.x} y={p.y + 3.2} text-anchor="middle" class="t">{x.name}</text>
            {:else}
              <circle
                cx={p.x}
                cy={p.y}
                r="8"
                class="and"
                style:fill={cov !== undefined ? `color-mix(in srgb, ${colour(cov)} 30%, var(--panel))` : 'var(--panel)'}
                style:stroke={cov !== undefined ? colour(cov) : 'var(--line-strong)'}
              />
              <text x={p.x} y={p.y + 3} text-anchor="middle" class="t sm">{x.lut >= 0 ? badge(x) : x.covers.length > 1 ? '·' : ''}</text>
            {/if}
          </g>
        {/each}
        {#each graph.roots as r (r)}
          {@const p = layout.pos.get(r >> 1)}
          {#if p}
            <line x1={p.x + 8} y1={p.y} x2={p.x + 26} y2={p.y} class="edge out" />
            <text x={p.x + 28} y={p.y + 3.2} class="t out">out</text>
          {/if}
        {/each}
      </svg>
    </div>

    <p class="sum ui" role="status">
      Graph: <b>{m.andNodes}</b> AND nodes, <b>{m.aigDepth}</b> deep. With {k}-input LUTs: <b>{m.luts}</b> LUT{m.luts === 1 ? '' : 's'}, <b>{m.depth}</b> level{m.depth === 1 ? '' : 's'}.
    </p>

    <ul class="luts ui" aria-label="The LUTs">
      {#each m.mapped.luts as l, i (i)}
        <li style:border-color={colour(i)}>
          <b style:color={colour(i)}>L{i}</b> = f({l.leaves.map(nameOf).join(', ')})
          <span class="tt">{ttHex(l.tt, l.leaves.length)}</span>
        </li>
      {/each}
    </ul>

    {#if picked !== null && byNode.get(picked)}
      {@const sel = byNode.get(picked)!}
      <div class="cuts ui">
        {#if sel.kind === 'input'}
          <p>{sel.name} is an input: its only cut is itself.</p>
        {:else}
          <p>
            <b>Node {sel.node}</b> has {cuts.length} cut{cuts.length === 1 ? '' : 's'} of at most {k} leaves. It needs at least <b>{sel.label}</b> level{sel.label === 1 ? '' : 's'} of LUTs.
          </p>
          <table>
            <thead><tr><th>Leaves</th><th>Truth table</th><th>Levels</th><th></th></tr></thead>
            <tbody>
              {#each cuts as c, i (i)}
                {@const lv = 1 + Math.max(...c.leaves.map(labelOf))}
                <tr class:pick={chosen && chosen.leaves.join() === c.leaves.join()} class:best={lv === sel.label}>
                  <td>{'{'}{c.leaves.map(nameOf).join(', ')}{'}'}</td>
                  <td class="mono">{ttHex(c.tt, c.leaves.length)}</td>
                  <td>{lv}</td>
                  <td>{chosen && chosen.leaves.join() === c.leaves.join() ? 'chosen' : lv === sel.label ? 'as good' : ''}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {:else}
      <p class="hint ui">Click a node to see its cuts.</p>
    {/if}
  </div>
</Widget>

<style>
  .cm {
    display: grid;
    gap: 0.55rem;
    padding: 0.8rem 1rem 1rem;
  }
  .story {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .scroll {
    overflow-x: auto;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .edge {
    stroke: var(--wire);
    stroke-width: 1.1;
    opacity: 0.75;
  }
  .edge.inv {
    stroke-dasharray: 3 2;
  }
  .edge.out {
    stroke-width: 1.6;
    opacity: 1;
  }
  .bubble {
    fill: var(--panel);
    stroke: var(--wire);
    stroke-width: 1;
  }
  .pi {
    fill: var(--pn);
    stroke: var(--line-strong);
  }
  .and {
    stroke-width: 1.4;
  }
  .node {
    cursor: pointer;
    outline: none;
  }
  .node.root .and {
    stroke-width: 2.6;
  }
  .node.sel .and,
  .node.sel .pi,
  .node:focus-visible .and,
  .node:focus-visible .pi {
    stroke: var(--copper);
    stroke-width: 3;
  }
  .t {
    font: 600 8px var(--font-mono);
    fill: var(--fg);
    pointer-events: none;
  }
  .t.sm {
    font-size: 6.5px;
  }
  .t.out {
    fill: var(--mute);
    font-size: 7px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .sum {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .sum b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .luts {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    font-size: 0.78rem;
  }
  .luts li {
    border: 1px solid;
    border-radius: 6px;
    padding: 0.15rem 0.5rem;
    color: var(--ink-2);
  }
  .tt {
    font-family: var(--font-mono);
    color: var(--mute);
    margin-left: 0.35rem;
  }
  .cuts {
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .cuts p {
    margin: 0 0 0.3rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    text-align: left;
    padding: 0.15rem 0.5rem 0.15rem 0;
  }
  thead th {
    color: var(--mute);
    font-weight: 500;
  }
  .mono {
    font-family: var(--font-mono);
  }
  tr.best td {
    color: var(--fg);
  }
  tr.pick td {
    color: var(--copper-ink);
    font-weight: 600;
  }
  .hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--mute);
  }
</style>
