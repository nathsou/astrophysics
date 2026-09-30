<!--
  The FPGA logic view: the design hierarchy as a tree (modules → their RTL cells, each with the logic cells it became),
  and, for designs small enough to draw, the gates the design lowers to, running on the digital engine in step
  with the board. A gate, a module and a cell of the tree are all selectable and cross-probe the chip.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import CircuitView from '../../../widgets/dcl/CircuitView.svelte';
  import { flattenTree, type HierNode } from '../../fpga/hierarchy';
  import type { FpgaSession } from '../../fpga/session.svelte';
  import { moduleColour } from '../../fpga/draw';

  let { session, tabs = true }: { session: FpgaSession; tabs?: boolean } = $props();

  let tab = $state<'tree' | 'gates'>('tree');
  let open = $state<ReadonlySet<string>>(new Set());
  let view: CircuitView | undefined = $state();
  let hoverGate: string | null = null;

  const analysis = $derived(session.goodAnalysis);
  const roots = $derived(session.hierarchy);
  const rows = $derived(flattenTree(roots, open));
  const gates = $derived(analysis?.circuit && analysis.lowered ? { circuit: analysis.circuit, lowered: analysis.lowered } : null);
  const highlight = $derived(new Set([...session.probe.elements, ...session.hoverProbe.elements]));
  const moduleIndex = (path: string) => session.index?.modulePaths.indexOf(path) ?? -1;

  $effect(() => {
    // The root is open to begin with.
    if (roots.length && open.size === 0) open = new Set(roots.map((r) => r.path));
  });
  $effect(() => {
    // Select something that lives in a collapsed module: open its parents.
    const paths = [...session.probe.modules];
    if (session.selected?.kind === 'module' || !paths.length) return;
    const next = new Set(open);
    let changed = false;
    for (const p of paths) {
      let q = p;
      for (;;) {
        const i = q.lastIndexOf('.');
        if (i < 0) break;
        q = q.slice(0, i);
        if (!next.has(q)) {
          next.add(q);
          changed = true;
        }
      }
    }
    if (changed) open = next;
  });
  function toggle(n: HierNode) {
    const next = new Set(open);
    if (next.has(n.path)) next.delete(n.path);
    else next.add(n.path);
    open = next;
  }

  function onhover(id: string | null) {
    hoverGate = id;
    session.hover(id ? { kind: 'element', id } : null);
  }
  function onclick() {
    if (hoverGate) session.select({ kind: 'element', id: hoverGate });
  }

  // Ops mirrored from the board arrive through `session.ops`; a new CircuitView replays them.
  let applied = 0;
  $effect(() => {
    const ops = session.ops;
    if (!view) return;
    if (ops.length < applied) applied = 0;
    for (let i = applied; i < ops.length; i++) view.apply(ops[i]!);
    applied = ops.length;
  });
  $effect(() => {
    // A rebuilt circuit replays the ops itself (via the `replay` prop), so start counting from there.
    void gates;
    applied = untrack(() => session.ops.length);
  });
</script>

<div class="logic">
  {#if tabs}
    <div class="mini ui" role="tablist" aria-label="Logic view">
      <button type="button" role="tab" aria-selected={tab === 'tree'} class:on={tab === 'tree'} onclick={() => (tab = 'tree')}>Hierarchy</button>
      <button type="button" role="tab" aria-selected={tab === 'gates'} class:on={tab === 'gates'} onclick={() => (tab = 'gates')}>Gates</button>
      <span class="grow"></span>
      {#if analysis?.stats}<span class="info">{analysis.stats.gates} gates · {analysis.stats.flipFlops} flip-flops</span>{/if}
    </div>
  {/if}

  {#if tab === 'tree'}
    <div class="tree ui" role="tree" aria-label="Design hierarchy">
      {#if !rows.length}
        <p class="empty">Fit the design to see its modules and the cells they became.</p>
      {/if}
      {#each rows as n (n.path)}
        {@const isOpen = open.has(n.path)}
        {@const sel = session.probe.modules.has(n.path) && session.selected?.kind === 'module' && session.selected.path === n.path}
        <div class="row" role="treeitem" aria-selected={sel} aria-expanded={n.children.length || n.cells.length ? isOpen : undefined} style:padding-left="{0.4 + n.depth * 0.9}rem">
          <button type="button" class="tw" aria-label={isOpen ? 'Collapse' : 'Expand'} onclick={() => toggle(n)}>{isOpen ? '▾' : '▸'}</button>
          <button type="button" class="mod" class:sel class:hot={session.probe.modules.has(n.path) && !sel} onclick={() => session.select({ kind: 'module', path: n.path })} onpointerenter={() => session.hover({ kind: 'module', path: n.path })} onpointerleave={() => session.hover(null)}>
            {#if moduleIndex(n.path) >= 0 && (session.index?.modulePaths.length ?? 0) > 1}<i style:background={moduleColour(moduleIndex(n.path))}></i>{/if}
            <b>{n.name}</b>
            <span class="cnt">{n.total} cells</span>
          </button>
        </div>
        {#if isOpen}
          {#each n.cells.slice(0, 60) as c (c.id)}
            <button
              type="button"
              class="cell"
              class:gone={c.cells === 0}
              class:sel={session.selected?.kind === 'source' && session.selected.id === c.id}
              class:hot={session.probe.sources.has(c.id)}
              style:padding-left="{1.9 + n.depth * 0.9}rem"
              onclick={() => session.select({ kind: 'source', id: c.id })}
              onpointerenter={() => session.hover({ kind: 'source', id: c.id })}
              onpointerleave={() => session.hover(null)}
              title={c.cells === 0 ? 'Absorbed into a neighbour’s LUT or removed by optimisation' : `${c.cells} logic cell${c.cells === 1 ? '' : 's'}`}
            >
              <span class="k">{c.kind}</span>
              {#if c.line !== undefined}<span class="ln">line {c.line}</span>{/if}
              <span class="cnt">{c.cells === 0 ? '·' : c.cells}</span>
            </button>
          {/each}
          {#if n.cells.length > 60}<p class="more" style:padding-left="{1.9 + n.depth * 0.9}rem">and {n.cells.length - 60} more</p>{/if}
        {/if}
      {/each}
    </div>
  {:else}
    <div class="gates">
      {#if gates}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="cvwrap" {onclick}>
          <CircuitView
            bind:this={view}
            circuit={gates.circuit}
            lowered={gates.lowered}
            {highlight}
            {onhover}
            oninput={(port, value) => session.run.setPort(port, value)}
            replay={session.ops}
            dim={session.hasErrors}
            label="Gates of {session.goodAnalysis?.top ?? 'the design'}"
          />
        </div>
      {:else}
        <p class="empty ui">
          {analysis?.circuitError ?? (session.hasErrors ? 'Fix the errors in the source to see the gates.' : 'The gates appear once the design has been checked.')}
          {#if analysis?.stats}<br />It lowers to {analysis.stats.gates} gates and {analysis.stats.flipFlops} flip-flops: use the hierarchy to explore it.{/if}
        </p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .logic {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--panel);
  }
  .mini {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid var(--line);
    font-size: 0.72rem;
  }
  .mini button {
    border: 0;
    background: transparent;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
    color: var(--mute);
    cursor: pointer;
    padding: 0.1rem 0.5rem;
    border-radius: 4px;
  }
  .mini button.on {
    color: var(--copper-ink);
    background: var(--panel);
    box-shadow: 0 0 0 1px var(--line);
  }
  .grow {
    flex: 1;
  }
  .info {
    color: var(--mute);
    font-size: 0.7rem;
  }
  .tree {
    flex: 1;
    overflow: auto;
    padding: 0.3rem 0 0.6rem;
    font-size: 0.78rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.15rem;
  }
  .tw {
    width: 1.2rem;
    border: 0;
    background: transparent;
    color: var(--mute);
    cursor: pointer;
    padding: 0;
  }
  button.mod,
  button.cell {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    border: 0;
    background: transparent;
    color: var(--fg);
    font: inherit;
    text-align: left;
    cursor: pointer;
    border-radius: 4px;
    padding: 0.12rem 0.4rem;
  }
  button.mod {
    flex: 1;
  }
  button.cell {
    width: 100%;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--ink-2);
  }
  button.mod:hover,
  button.cell:hover {
    background: var(--term-hl);
  }
  button.sel {
    background: var(--term-hl-strong);
    box-shadow: inset 3px 0 0 var(--phosphor);
  }
  button.hot {
    background: var(--term-hl);
  }
  button.cell.gone {
    color: var(--mute);
    opacity: 0.7;
  }
  .mod i {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 2px;
  }
  .cnt {
    margin-left: auto;
    color: var(--mute);
    font-family: var(--font-mono);
    font-size: 0.68rem;
  }
  .k {
    min-width: 4.2rem;
  }
  .ln {
    color: var(--mute);
  }
  .more {
    margin: 0.2rem 0;
    color: var(--mute);
    font-size: 0.7rem;
  }
  .gates {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0.5rem;
  }
  .empty {
    margin: 0.8rem;
    color: var(--mute);
    font-size: 0.82rem;
  }
</style>
