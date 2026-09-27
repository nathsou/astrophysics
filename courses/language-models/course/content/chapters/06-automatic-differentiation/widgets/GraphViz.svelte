<!--
  A computational graph you can step through. The expression is compiled into the course library's
  tensors (every node retains its gradient), laid out by depth, and animated: forward values from
  left to right, then gradients flowing back from the output via the chain rule.
-->
<script lang="ts">
  import type { Tensor } from '@lm/core/tensor';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { compile, variables } from '../expr';

  const PRESETS: { label: string; expr: string; vals: Record<string, number> }[] = [
    { label: 'A neuron', expr: 'tanh(w*x + b)', vals: { w: 0.8, x: 2, b: -0.5 } },
    { label: 'Used twice', expr: 'x*x + x', vals: { x: 3 } },
    { label: 'Two paths', expr: '(a + b) * (a - b)', vals: { a: 2, b: 1 } },
    { label: 'Logistic loss', expr: '-log(sigmoid(w*x + b))', vals: { w: -0.5, x: 1.5, b: 0.3 } },
    { label: 'Deeper', expr: 'relu(a*b - c)^2 / 2 + exp(-c)', vals: { a: 1.5, b: 2, c: 1 } },
  ];

  let src = $state(PRESETS[0]!.expr);
  let vals = $state<Record<string, number>>({ ...PRESETS[0]!.vals });
  let phase = $state<'forward' | 'backward'>('forward');
  let step = $state(0);
  let hovered = $state<number | null>(null);

  const vars = $derived(variables(src));
  $effect(() => {
    for (const v of vars) if (!(v in vals)) vals[v] = 1;
  });

  type GNode = { id: number; t: Tensor; label: string; value: number; parents: number[]; children: number[]; depth: number; op: string; leaf: boolean; constant: boolean };

  const graph = $derived.by(() => {
    try {
      const { output } = compile(src, vals);
      output.backward();
      const ids = new Map<Tensor, number>();
      const nodes: GNode[] = [];
      const visit = (t: Tensor): number => {
        const known = ids.get(t);
        if (known !== undefined) return known;
        const parents = (t.node?.parents ?? []).map(visit);
        const id = nodes.length;
        ids.set(t, id);
        const depth = parents.length ? 1 + Math.max(...parents.map((p) => nodes[p]!.depth)) : 0;
        nodes.push({ id, t, label: t.label ?? t.node?.op ?? '?', value: t.item(), parents, children: [], depth, op: t.node?.op ?? '', leaf: !t.node, constant: !t.requiresGrad });
        return id;
      };
      visit(output);
      for (const n of nodes) for (const p of n.parents) nodes[p]!.children.push(n.id);
      return { nodes, out: nodes.length - 1, error: null as string | null };
    } catch (e) {
      return { nodes: [] as GNode[], out: -1, error: e instanceof Error ? e.message : String(e) };
    }
  });

  // Local partial derivative ∂(child)/∂(parent), from the values (matches the library's backward rules).
  function local(child: GNode, parentIdx: number): number {
    const ps = child.parents.map((p) => graph.nodes[p]!.value);
    const [a, b] = [ps[0]!, ps[1]!];
    const y = child.value;
    switch (child.op) {
      case 'add': return 1;
      case 'sub': return parentIdx === 0 ? 1 : -1;
      case 'mul': return parentIdx === 0 ? b : a;
      case 'div': return parentIdx === 0 ? 1 / b : -a / (b * b);
      case 'neg': return -1;
      case 'exp': return y;
      case 'log': return 1 / a;
      case 'sqrt': return 0.5 / y;
      case 'tanh': return 1 - y * y;
      case 'sigmoid': return y * (1 - y);
      case 'relu': return a > 0 ? 1 : 0;
      case 'pow': {
        const p = Number(child.label.slice(1));
        return p * a ** (p - 1);
      }
      default: return NaN;
    }
  }
  const LOCAL_FORMULA: Record<string, string> = {
    add: '1', sub: '±1', mul: 'the other factor', div: '1/b or −a/b²', neg: '−1', exp: 'exp(a) = output', log: '1/a', sqrt: '1/(2·output)', tanh: '1 − output²', sigmoid: 'output·(1 − output)', relu: '1 if a > 0 else 0', pow: 'p·a^(p−1)',
  };

  // Order: forward = by id (a topological order); backward = reverse, starting at the output.
  const order = $derived(graph.nodes.filter((n) => !n.constant).map((n) => n.id));
  const maxStep = $derived(order.length);
  const shownValue = (id: number) => phase === 'backward' || graph.nodes[id]!.constant || order.indexOf(id) < step;
  const shownGrad = (id: number) => phase === 'backward' && !graph.nodes[id]!.constant && order.length - 1 - order.indexOf(id) < step;

  // Layout.
  const COLW = 118, ROWH = 74, NW = 92, NH = 50;
  const layout = $derived.by(() => {
    const cols = new Map<number, number[]>();
    for (const n of graph.nodes) cols.set(n.depth, [...(cols.get(n.depth) ?? []), n.id]);
    const maxRows = Math.max(1, ...[...cols.values()].map((c) => c.length));
    const pos = new Map<number, { x: number; y: number }>();
    for (const [d, ids] of cols) ids.forEach((id, i) => pos.set(id, { x: 10 + d * COLW, y: 10 + (i + (maxRows - ids.length) / 2) * ROWH }));
    return { pos, width: 20 + (Math.max(0, ...cols.keys()) + 1) * COLW, height: 20 + maxRows * ROWH };
  });

  function choose(p: (typeof PRESETS)[number]) {
    src = p.expr;
    vals = { ...p.vals };
    phase = 'forward';
    step = 0;
  }
  function next() {
    if (step < maxStep) step++;
    else if (phase === 'forward') {
      phase = 'backward';
      step = 1;
    }
  }
  const fmt = (v: number) => (Math.abs(v) >= 1000 || (Math.abs(v) < 0.001 && v !== 0) ? v.toExponential(2) : v.toFixed(3));
  const hov = $derived(hovered !== null ? graph.nodes[hovered] : null);
</script>

<Widget
  title="Back-propagation, one node at a time"
  subtitle="Type an expression or pick one. Step forward to compute each node’s value, then backward: every node’s gradient is the sum, over its children, of the child’s gradient times the local derivative."
  onreset={() => choose(PRESETS[0]!)}
>
  {#snippet controls()}
    <label class="f"><span>Expression</span><input bind:value={src} spellcheck="false" oninput={() => ((phase = 'forward'), (step = 0))} /></label>
    <div class="presets">
      {#each PRESETS as p (p.label)}<button class="chip" class:on={p.expr === src} onclick={() => choose(p)}>{p.label}</button>{/each}
    </div>
  {/snippet}

  <div class="vars">
    {#each vars as v (v)}
      <div class="ctl"><Slider label={v} min={-3} max={3} step={0.05} value={vals[v] ?? 1} oninput={(x) => (vals[v] = x)} /></div>
    {/each}
  </div>

  {#if graph.error}
    <p class="err">{graph.error}</p>
  {:else}
    <div class="toolbar">
      <Button onclick={() => ((phase = 'forward'), (step = 0))}>⟲ Start</Button>
      <Button variant="primary" onclick={next} disabled={phase === 'backward' && step >= maxStep}>{phase === 'forward' && step >= maxStep ? 'Start backward pass →' : 'Step →'}</Button>
      <Button variant="ghost" onclick={() => ((phase = 'backward'), (step = maxStep))}>Show all</Button>
      <span class="phase">{phase === 'forward' ? `Forward pass: ${step} / ${maxStep} values computed` : `Backward pass: ${step} / ${maxStep} gradients known`}</span>
    </div>
    <div class="canvas">
      <svg width={layout.width} height={layout.height} role="img" aria-label="Computational graph">
        <defs>
          <marker id="ad-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--axis)" />
          </marker>
        </defs>
        {#each graph.nodes as n (n.id)}
          {#each n.parents as p, pi (pi)}
            {@const a = layout.pos.get(p)!}
            {@const b = layout.pos.get(n.id)!}
            {@const active = phase === 'backward' && shownGrad(n.id) && !graph.nodes[p]!.constant}
            <path d="M{a.x + NW},{a.y + NH / 2} C{a.x + NW + 20},{a.y + NH / 2} {b.x - 20},{b.y + NH / 2} {b.x},{b.y + NH / 2}" class="edge" class:active marker-end="url(#ad-arrow)" />
            {#if active}
              <text x={(a.x + NW + b.x) / 2} y={(a.y + b.y) / 2 + NH / 2 - 6} class="local" text-anchor="middle">×{fmt(local(n, pi))}</text>
            {/if}
          {/each}
        {/each}
        {#each graph.nodes as n (n.id)}
          {@const q = layout.pos.get(n.id)!}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g transform="translate({q.x},{q.y})" class="node" class:leaf={n.leaf && !n.constant} class:const={n.constant} class:out={n.id === graph.out} class:hl={hovered === n.id} onpointerenter={() => (hovered = n.id)} onpointerleave={() => (hovered = null)}>
            <rect width={NW} height={NH} rx="8" />
            <text x={NW / 2} y="15" text-anchor="middle" class="lab">{n.label}</text>
            <text x={NW / 2} y="30" text-anchor="middle" class="val">{shownValue(n.id) ? fmt(n.value) : '?'}</text>
            {#if !n.constant}<text x={NW / 2} y="44" text-anchor="middle" class="grad">{shownGrad(n.id) ? `∂ ${fmt(n.t.grad?.item() ?? 0)}` : ''}</text>{/if}
          </g>
        {/each}
      </svg>
    </div>
    <div class="explain">
      {#if hov && phase === 'backward' && shownGrad(hov.id) && hov.id !== graph.out}
        <strong>{hov.label}</strong>: ∂L/∂{hov.label} = {#each hov.children as c, i (c)}{i ? ' + ' : ''}<span class="num">∂L/∂{graph.nodes[c]!.label} × ∂{graph.nodes[c]!.label}/∂{hov.label} = {fmt(graph.nodes[c]!.t.grad?.item() ?? 0)} × {fmt(local(graph.nodes[c]!, graph.nodes[c]!.parents.indexOf(hov.id)))}</span>{/each}
        = <strong class="num">{fmt(hov.t.grad?.item() ?? 0)}</strong>
        {#if hov.children.length > 1}<span class="note"> — used {hov.children.length} times, so its gradient is a <em>sum</em> over paths.</span>{/if}
      {:else if hov && !hov.leaf}
        <strong>{hov.label}</strong> ({hov.op}) — local derivative: {LOCAL_FORMULA[hov.op] ?? '—'}
      {:else}
        Hover a node. Leaves are inputs (blue) and constants (grey); the output is outlined. The numbers on highlighted edges are local derivatives.
      {/if}
    </div>
  {/if}
</Widget>

<style>
  .f {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.74rem;
    color: var(--ink-2);
    flex: 1 1 14rem;
  }
  .f input {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .chip {
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 99px;
    padding: 0.2rem 0.6rem;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--ink-2);
  }
  .chip.on {
    background: var(--accent-soft);
    border-color: var(--accent-2);
    color: var(--accent-ink);
  }
  .vars {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.2rem;
    margin-bottom: 0.6rem;
  }
  .ctl {
    flex: 0 1 10rem;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }
  .phase {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin-left: 0.5rem;
  }
  .canvas {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    padding: 0.3rem;
  }
  .edge {
    fill: none;
    stroke: var(--axis);
    stroke-width: 1.5;
  }
  .edge.active {
    stroke: var(--series-2);
    stroke-width: 2.5;
  }
  .local {
    font-size: 10px;
    font-family: var(--font-mono);
    fill: var(--series-2);
  }
  .node rect {
    fill: var(--surface-2);
    stroke: var(--rule-strong);
    stroke-width: 1.2;
  }
  .node.leaf rect {
    fill: color-mix(in srgb, var(--series-1) 16%, var(--surface));
  }
  .node.const rect {
    fill: var(--surface-3);
    stroke-dasharray: 3 3;
  }
  .node.out rect {
    stroke: var(--ink);
    stroke-width: 2;
  }
  .node.hl rect {
    stroke: var(--series-2);
    stroke-width: 2.5;
  }
  .lab {
    font-size: 11px;
    font-weight: 650;
    fill: var(--ink);
  }
  .val {
    font-size: 11px;
    font-family: var(--font-mono);
    fill: var(--ink);
  }
  .grad {
    font-size: 10.5px;
    font-family: var(--font-mono);
    fill: var(--series-2);
    font-weight: 650;
  }
  .explain {
    margin-top: 0.6rem;
    font-size: 0.82rem;
    min-height: 2.6rem;
    line-height: 1.6;
  }
  .note {
    color: var(--ink-2);
  }
  .err {
    color: var(--critical);
    font-size: 0.85rem;
  }
</style>
