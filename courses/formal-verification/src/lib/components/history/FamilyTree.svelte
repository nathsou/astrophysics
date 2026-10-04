<!--
  The family tree of tools: which tool descends from (solid arrow) or was influenced by (dashed arrow) which.
  Same lanes and the same colours as the timeline. Selecting a node highlights its ancestors and descendants
  and shows its details; the table below the drawing is the accessible view of the same data.
-->
<script lang="ts">
  import { base } from '$app/paths';
  import { findEntry } from '$lib/content/registry';
  import { layoutLineage, NODE_H } from './lineage-layout';
  import { LANE_LABELS, type LineageEdge, type LineageNode } from './types';

  let { nodes, edges, lane }: { nodes: LineageNode[]; edges: LineageEdge[]; lane?: string } = $props();

  const shownNodes = $derived(lane ? nodes.filter((n) => lane.split(',').includes(n.lane)) : nodes);
  const L = $derived(layoutLineage(shownNodes, edges));
  let selected: string | null = $state(null);

  /** Ancestors and descendants of the selected node (the lineage that lights up). */
  const lit = $derived.by(() => {
    if (!selected) return new Set<string>();
    const out = new Set<string>([selected]);
    const walk = (dir: 'up' | 'down', id: string) => {
      for (const e of edges) {
        const next = dir === 'up' && e.to === id ? e.from : dir === 'down' && e.from === id ? e.to : null;
        if (next && !out.has(next)) {
          out.add(next);
          walk(dir, next);
        }
      }
    };
    walk('up', selected);
    walk('down', selected);
    return out;
  });
  const sel = $derived(nodes.find((n) => n.id === selected));
  const nameOf = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const chapterOf = (slug?: string) => (slug ? (findEntry('chapter', slug) ?? findEntry('appendix', slug)) : undefined);
</script>

<div class="tree wide ui">
  <div class="scroll" role="region" aria-label="Family tree of tools (scrolls sideways)" tabindex="0">
    <svg width={L.width} height={L.height + 24} viewBox="0 0 {L.width} {L.height + 24}" aria-hidden="true">
      <defs>
        <marker id="ft-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L8 4L0 8z" class="arrowhead" />
        </marker>
      </defs>
      {#each L.bands as b, i (b.lane)}
        <rect class="band" class:odd={i % 2 === 1} x="0" y={b.y} width={L.width} height={b.h} />
        <text class="band-name" x={L.width - 8} y={b.y + 14} text-anchor="end">{LANE_LABELS[b.lane]}</text>
      {/each}
      {#each L.years as y (y)}
        <line class="decade" x1={L.x(y)} x2={L.x(y)} y1="0" y2={L.height} />
        <text class="yr" x={L.x(y)} y={L.height + 16} text-anchor="middle">{y}</text>
      {/each}
      {#each L.edges as e, i (i)}
        <path class="edge {e.type}" class:dim={selected && !(lit.has(e.from) && lit.has(e.to))} d={e.d} marker-end="url(#ft-arrow)" />
      {/each}
    </svg>
    <div class="nodes" style:width="{L.width}px" style:height="{L.height}px">
      {#each L.nodes as n (n.id)}
        <button
          type="button"
          class="node lane-{n.lane} {n.kind}"
          class:dim={selected && !lit.has(n.id)}
          class:sel={selected === n.id}
          style:left="{n.x}px"
          style:top="{n.y}px"
          style:width="{n.w}px"
          style:height="{NODE_H}px"
          aria-pressed={selected === n.id}
          onclick={() => (selected = selected === n.id ? null : n.id)}
        >{n.name}</button>
      {/each}
    </div>
  </div>

  <div class="detail" aria-live="polite">
    {#if sel}
      {@const ch = chapterOf(sel.chapter)}
      <p><strong>{sel.name}</strong> ({sel.year}) · {LANE_LABELS[sel.lane]} · {sel.kind}{#if ch} · {#if ch.available}<a href="{base}{ch.href}">Ch. {ch.number}</a>{:else}Ch. {ch.number}{/if}{/if}{#if sel.rosetta} · <a href="{base}/appendix/rosetta/#{sel.rosetta}">Rosetta</a>{/if}</p>
      {#if sel.note}<p class="note">{sel.note}</p>{/if}
      <p class="rel">
        {#each edges.filter((e) => e.to === sel.id) as e, i (i)}{#if i}; {/if}{e.type === 'descends' ? 'descends from' : 'influenced by'} {nameOf(e.from)}{/each}
        {#each edges.filter((e) => e.from === sel.id) as e, i (i)}{#if i || edges.some((x) => x.to === sel.id)}; {/if}{e.type === 'descends' ? 'parent of' : 'influenced'} {nameOf(e.to)}{/each}
      </p>
    {:else}
      <p class="hint">Select a tool or idea to light up its lineage. Solid arrows: descends from. Dashed: influenced.</p>
    {/if}
  </div>

  <details class="table">
    <summary>The family tree as a table ({edges.length} relations)</summary>
    <table>
      <thead><tr><th>From</th><th>Relation</th><th>To</th></tr></thead>
      <tbody>
        {#each edges as e, i (i)}
          <tr><td>{nameOf(e.from)}</td><td>{e.type === 'descends' ? 'parent of' : 'influenced'}</td><td>{nameOf(e.to)}</td></tr>
        {/each}
      </tbody>
    </table>
  </details>
</div>

<style>
  .tree {
    margin: 1.6rem 0;
    --l-logic: var(--series-8);
    --l-model-checking: var(--series-1);
    --l-sat: var(--series-6);
    --l-smt: var(--series-2);
    --l-deductive: var(--series-3);
    --l-heap: var(--series-4);
    --l-abstract-interpretation: var(--series-5);
    --l-industry: var(--ink-2);
    --l-disasters: var(--pencil);
  }
  .lane-logic { --c: var(--l-logic); }
  .lane-model-checking { --c: var(--l-model-checking); }
  .lane-sat { --c: var(--l-sat); }
  .lane-smt { --c: var(--l-smt); }
  .lane-deductive { --c: var(--l-deductive); }
  .lane-heap { --c: var(--l-heap); }
  .lane-abstract-interpretation { --c: var(--l-abstract-interpretation); }
  .lane-industry { --c: var(--l-industry); }
  .lane-disasters { --c: var(--l-disasters); }
  .scroll {
    position: relative;
    overflow-x: auto;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--panel);
  }
  svg {
    display: block;
  }
  .band {
    fill: transparent;
  }
  .band.odd {
    fill: color-mix(in srgb, var(--pn) 55%, transparent);
  }
  .band-name,
  .yr {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--mute);
  }
  .decade {
    stroke: var(--line);
    stroke-dasharray: 1 4;
  }
  .edge {
    fill: none;
    stroke: var(--edge);
    stroke-width: 1.3;
  }
  .edge.influenced {
    stroke-dasharray: 4 3;
  }
  .edge.dim {
    opacity: 0.15;
  }
  .arrowhead {
    fill: var(--edge);
  }
  .nodes {
    position: absolute;
    top: 0;
    left: 0;
  }
  .node {
    position: absolute;
    padding: 0 0.4rem;
    border: 1px solid var(--c);
    border-left-width: 4px;
    border-radius: 3px;
    background: var(--panel);
    font-size: 0.74rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    text-align: left;
  }
  .node.idea {
    border-radius: 999px;
    border-left-width: 1px;
    font-style: italic;
  }
  .node.paper {
    border-style: dashed;
    border-left-style: solid;
  }
  .node.dim {
    opacity: 0.25;
  }
  .node.sel {
    background: var(--gold-soft);
    outline: 2px solid var(--gold);
  }
  .detail {
    min-height: 3.2rem;
    font-size: 0.9rem;
    padding: 0.6rem 0.2rem;
  }
  .detail p {
    margin: 0 0 0.2rem;
  }
  .note,
  .rel {
    color: var(--ink-2);
  }
  .hint {
    color: var(--mute);
  }
  .table {
    font-size: 0.85rem;
  }
  .table table {
    width: 100%;
    border-collapse: collapse;
  }
  .table td,
  .table th {
    text-align: left;
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid var(--line);
  }
</style>
