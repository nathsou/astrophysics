<!--
  The state-space explorer (Part I's flagship): a system's model beside the graph of its reachable states. Walk
  it by hand, choosing among the enabled actions, or let breadth-first search visit it state by state. States that
  break an invariant turn red, the shortest path to the first one lights up, and the path to any selected state
  replays as a trace table.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import VouchEditor from '$lib/components/verify/VouchEditor.svelte';
  import TraceView from '$lib/components/verify/TraceView.svelte';
  import { parse } from '$lib/fv/vouch/syntax/parser';
  import { check } from '$lib/fv/vouch/check/checker';
  import { SystemRuntime, type State, type StepLabel } from '$lib/fv/vouch/interp/system';
  import { RuntimeFailure } from '$lib/fv/vouch/interp/eval';
  import { toTrace } from '$lib/fv/explore/explorer';

  let {
    code,
    title,
    caption,
    system,
    maxNodes = 800,
    editable = true,
    showLabels,
  }: {
    code: string;
    title?: string;
    caption?: string;
    system?: string;
    maxNodes?: number;
    editable?: boolean;
    showLabels?: boolean;
  } = $props();

  interface Node {
    id: number;
    key: string;
    state: State;
    depth: number;
    parent: number;
    label?: StepLabel;
    bad: string[];
    expanded: boolean;
    text: string;
    short: string;
  }
  interface Edge {
    from: number;
    to: number;
    label: string;
  }

  let editor: VouchEditor | undefined = $state();
  let rt = $state<SystemRuntime | undefined>();
  let error = $state('');
  let nodes = $state.raw<Node[]>([]);
  let edges = $state.raw<Edge[]>([]);
  let queue = $state.raw<number[]>([]);
  let selected = $state<number | undefined>();
  let firstBad = $state<number | undefined>();
  let truncated = $state(false);
  let index = new Map<string, number>();
  let edgeKeys = new Set<string>();
  let running = false;

  function load(src: string) {
    error = '';
    rt = undefined;
    nodes = [];
    edges = [];
    queue = [];
    selected = undefined;
    firstBad = undefined;
    truncated = false;
    index = new Map();
    edgeKeys = new Set();
    const parsed = parse(src);
    const checked = check(parsed.program);
    const errs = [...parsed.diagnostics, ...checked.diagnostics].filter((d) => d.severity === 'error');
    if (errs.length) {
      error = errs[0]!.message;
      return;
    }
    const name = system ?? [...checked.containers.values()].find((c) => c.kind === 'system')?.decl.name;
    if (!name) {
      error = 'There is no system in this model.';
      return;
    }
    try {
      const r = new SystemRuntime(checked, name);
      rt = r;
      const { states, failures } = r.initial();
      if (failures.length) error = failures[0]!.failure.message;
      for (const s of states) add(s, -1, undefined, 0);
      selected = 0;
      refresh();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  function describe(s: State): string {
    return rt!
      .describe(s)
      .map((v) => (v.kind === 'pc' ? v.value : `${v.name}=${v.value}`))
      .join(' ');
  }

  function add(s: State, parent: number, label: StepLabel | undefined, depth: number): number {
    const key = rt!.key(s);
    const have = index.get(key);
    if (have !== undefined) return have;
    if (nodes.length >= maxNodes) {
      truncated = true;
      return -1;
    }
    const bad: string[] = [];
    for (const inv of rt!.info.invariants) {
      try {
        if (!rt!.holds(inv.expr, s)) bad.push(inv.name ?? 'invariant');
      } catch (e) {
        if (!(e instanceof RuntimeFailure)) throw e;
        bad.push(inv.name ?? 'invariant');
      }
    }
    const id = nodes.length;
    const n: Node = { id, key, state: s, depth, parent, label, bad, expanded: false, text: describe(s), short: rt!.describe(s).map((v) => v.value).join(' ') };
    nodes.push(n);
    index.set(key, id);
    queue.push(id);
    if (bad.length && firstBad === undefined) firstBad = id;
    return id;
  }

  function expand(id: number) {
    const n = nodes[id]!;
    if (n.expanded) return;
    n.expanded = true;
    const { succs, failures } = rt!.successors(n.state);
    if (failures.length && !error) error = failures[0]!.failure.message;
    for (const s of succs) {
      const to = add(s.state, id, s.label, n.depth + 1);
      if (to < 0) continue;
      const k = `${id}>${to}`;
      if (!edgeKeys.has(k)) {
        edgeKeys.add(k);
        edges.push({ from: id, to, label: s.label.text });
      }
    }
  }

  /** One step of breadth-first search: expand the oldest unexpanded state. */
  function bfsStep(): boolean {
    while (queue.length && nodes[queue[0]!]!.expanded) queue.shift();
    const id = queue.shift();
    if (id === undefined) return false;
    expand(id);
    selected = id;
    refresh();
    return true;
  }

  function runAll() {
    if (running) return;
    running = true;
    const tick = () => {
      let n = 0;
      while (n < 25 && bfsStep()) n++;
      if (n === 25 && running) requestAnimationFrame(tick);
      else {
        running = false;
        if (firstBad !== undefined) selected = firstBad;
      }
    };
    requestAnimationFrame(tick);
  }

  /** Walk by hand: take one enabled step from the selected state. */
  function take(s: { label: StepLabel; state: State }) {
    if (selected === undefined) return;
    const from = selected;
    const to = add(s.state, from, s.label, nodes[from]!.depth + 1);
    if (to < 0) return;
    const k = `${from}>${to}`;
    if (!edgeKeys.has(k)) {
      edgeKeys.add(k);
      edges.push({ from, to, label: s.label.text });
    }
    selected = to;
    refresh();
  }

  function refresh() {
    nodes = [...nodes];
    edges = [...edges];
    queue = [...queue];
  }

  const enabled = $derived.by(() => {
    if (!rt || selected === undefined) return [];
    try {
      return rt.successors(nodes[selected]!.state).succs;
    } catch {
      return [];
    }
  });

  const pathTo = (id: number) => {
    const ids: number[] = [];
    for (let k = id; k >= 0; k = nodes[k]!.parent) ids.unshift(k);
    return ids;
  };
  const selPath = $derived(selected !== undefined && nodes[selected] ? pathTo(selected) : []);
  const badPath = $derived(firstBad !== undefined ? pathTo(firstBad) : []);
  const onPath = $derived(new Set(firstBad !== undefined ? badPath : selPath));
  const trace = $derived(rt && selPath.length ? toTrace(rt, selPath.map((i) => nodes[i]!.state), selPath.slice(1).map((i) => nodes[i]!.label!)) : undefined);
  const nextUp = $derived(queue.find((i) => !nodes[i]?.expanded));

  // Layout: one column per BFS depth.
  const COL = $derived(showLabels ?? nodes.length <= 24 ? 104 : 46);
  const ROW = $derived(showLabels ?? nodes.length <= 24 ? 30 : 16);
  const layout = $derived.by(() => {
    const cols = new Map<number, number[]>();
    for (const n of nodes) (cols.get(n.depth) ?? cols.set(n.depth, []).get(n.depth)!).push(n.id);
    const tallest = Math.max(1, ...[...cols.values()].map((c) => c.length));
    const pos = new Map<number, { x: number; y: number }>();
    for (const [d, ids] of cols) {
      const offset = ((tallest - ids.length) * ROW) / 2;
      ids.forEach((id, i) => pos.set(id, { x: 24 + d * COL, y: 18 + offset + i * ROW }));
    }
    const depth = Math.max(0, ...nodes.map((n) => n.depth));
    return { pos, width: 48 + depth * COL, height: 36 + (tallest - 1) * ROW };
  });
  const labelled = $derived(showLabels ?? nodes.length <= 24);

  $effect(() => {
    const src = code;
    untrack(() => load(src));
  });

  const bad = $derived(firstBad !== undefined ? nodes[firstBad] : undefined);
</script>

<figure class="space">
  {#if title}<header class="ui"><span class="kicker">State space</span> <span class="title">{title}</span></header>{/if}
  <div class="grid">
    <div class="model">
      <VouchEditor bind:this={editor} value={code} name="state-space" minLines={6} maxHeight="18rem" readonly={!editable} />
      {#if editable}<button type="button" class="ghost ui" onclick={() => load(editor?.getValue() ?? code)}>Load the edited model</button>{/if}
    </div>
    <div class="graph-pane">
      <div class="controls ui">
        <button type="button" onclick={() => bfsStep()} disabled={!rt}>Next state (BFS)</button>
        <button type="button" class="go" onclick={runAll} disabled={!rt}>Run BFS to the end</button>
        <button type="button" onclick={() => load(editor?.getValue() ?? code)}>Reset</button>
      </div>
      <p class="status ui" aria-live="polite">
        {#if error}<span class="err">{error}</span>
        {:else}
          {nodes.length.toLocaleString('en-GB')} state{nodes.length === 1 ? '' : 's'} found, {nodes.filter((n) => n.expanded).length} expanded{#if truncated}, stopped at {maxNodes}{/if}.
          {#if bad}<b class="bad">Invariant {bad.bad.join(', ')} fails at depth {bad.depth}</b>: the shortest path is highlighted.{:else if nodes.length && nodes.every((n) => n.expanded)}<b class="ok">Every reachable state visited; no invariant fails.</b>{/if}
        {/if}
      </p>
      <div class="graph" role="img" aria-label="The graph of reachable states, one column per breadth-first depth">
        <svg viewBox="0 0 {layout.width} {layout.height}" width={layout.width} height={layout.height}>
          {#each edges as e (e.from + '>' + e.to)}
            {@const a = layout.pos.get(e.from)}
            {@const b = layout.pos.get(e.to)}
            {#if a && b}
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class:hot={onPath.has(e.from) && onPath.has(e.to) && nodes[e.to]?.parent === e.from}><title>{e.label}</title></line>
            {/if}
          {/each}
          {#each nodes as n (n.id)}
            {@const p = layout.pos.get(n.id)}
            {#if p}
              <g class="node" class:bad={n.bad.length} class:init={n.parent < 0} class:sel={selected === n.id} class:open={!n.expanded} class:next={nextUp === n.id} class:path={onPath.has(n.id)} transform="translate({p.x},{p.y})" role="button" tabindex="-1" onclick={() => (selected = n.id)} onkeydown={(ev) => ev.key === 'Enter' && (selected = n.id)}>
                <circle r="7"></circle>
                {#if n.parent < 0}<circle r="10" class="ring"></circle>{/if}
                {#if labelled}<text y="-11">{n.short}</text>{/if}
                <title>#{n.id} {n.text}{n.bad.length ? ` — breaks ${n.bad.join(', ')}` : ''}</title>
              </g>
            {/if}
          {/each}
        </svg>
      </div>
      <p class="legend ui"><span class="dot init"></span> initial <span class="dot open"></span> found, not yet expanded <span class="dot next"></span> BFS expands it next <span class="dot bad"></span> breaks an invariant</p>
      {#if selected !== undefined && nodes[selected]}
        <div class="hand ui">
          <p class="cur"><b>State #{selected}</b> <code>{nodes[selected]?.text}</code></p>
          {#if enabled.length}
            <p class="steps">Enabled: {#each enabled as s, i (i)}<button type="button" class="step" onclick={() => take(s)}>{s.label.text}</button>{/each}</p>
          {:else}
            <p class="steps">No action is enabled here.</p>
          {/if}
        </div>
      {/if}
    </div>
  </div>
  {#if trace && trace.steps.length > 1}
    <TraceView {trace} caption={firstBad !== undefined && selected === firstBad ? 'The shortest path to the first bad state' : `The path to state #${selected}`} />
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .space {
    margin: 2rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  header {
    margin-bottom: 0.6rem;
  }
  .kicker {
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--gold);
    font-weight: 700;
  }
  .title {
    font-weight: 600;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.8rem;
  }
  .model {
    min-width: 0;
  }
  .graph-pane {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  button {
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
    padding: 0.28rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  button:disabled {
    opacity: 0.5;
  }
  .go {
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .ghost {
    margin-top: 0.4rem;
  }
  .status {
    margin: 0;
    font-size: 0.84rem;
    color: var(--ink-2);
  }
  .err,
  .bad {
    color: var(--pencil);
  }
  .ok {
    color: var(--seal);
  }
  .graph {
    overflow: auto;
    max-height: 26rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
  }
  svg {
    display: block;
  }
  line {
    stroke: var(--edge);
    stroke-width: 1;
    opacity: 0.55;
  }
  line.hot {
    stroke: var(--trace);
    stroke-width: 2.5;
    opacity: 1;
  }
  .node {
    cursor: pointer;
  }
  .node circle {
    fill: var(--state);
    stroke: var(--fg);
    stroke-width: 1;
  }
  .node.open circle {
    fill: var(--panel);
    stroke-dasharray: 2 2;
  }
  .node.next circle {
    stroke: var(--gold);
    stroke-width: 2.5;
  }
  .node.path circle {
    stroke: var(--trace);
    stroke-width: 2.5;
  }
  .node.bad circle {
    fill: var(--pencil);
  }
  .node .ring {
    fill: none;
    stroke: var(--fg);
    stroke-dasharray: none;
  }
  .node.sel circle:first-child {
    stroke: var(--ink-blue);
    stroke-width: 3.5;
  }
  text {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--ink-2);
    text-anchor: middle;
  }
  .legend {
    margin: 0;
    font-size: 0.74rem;
    color: var(--mute);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.5rem;
  }
  .dot {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    border: 1px solid var(--fg);
    background: var(--state);
  }
  .dot.open {
    background: var(--panel);
    border-style: dashed;
  }
  .dot.next {
    border: 2px solid var(--gold);
  }
  .dot.bad {
    background: var(--pencil);
  }
  .dot.init {
    box-shadow: 0 0 0 2px var(--pn), 0 0 0 3px var(--fg);
  }
  .hand {
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
    font-size: 0.82rem;
  }
  .hand p {
    margin: 0;
  }
  .cur code {
    font-size: 0.8rem;
  }
  .steps {
    margin-top: 0.35rem !important;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
  }
  .step {
    font-family: var(--font-mono);
    font-size: 0.76rem;
    padding: 0.12rem 0.45rem;
  }
  figcaption {
    margin-top: 0.7rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
