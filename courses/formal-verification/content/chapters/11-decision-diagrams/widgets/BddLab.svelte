<!--
  The BDD lab: type a propositional formula and see its reduced ordered BDD. The variable order is a row of chips:
  select one and move it left or right, and the diagram is rebuilt. Solid edges go to the high child (the variable
  is true), dashed edges to the low child. With a `target`, the exercise is solved when the BDD has at most that
  many nodes.
-->
<script lang="ts">
  import { Bdd } from '$lib/fv/bdd/bdd';
  import { parseFormula, ParseError } from '$lib/fv/bdd/parse';
  import { progress } from '$lib/state/progress.svelte';

  let { formula: initial, order: initialOrder, target, id, caption, editable = true }: { formula: string; order?: string[]; target?: number; id?: string; caption?: string; editable?: boolean } = $props();

  // svelte-ignore state_referenced_locally
  let text = $state(initial);
  let order = $state<string[]>([]);
  let selected = $state<string | undefined>();
  let solved = $state(false);

  const parsed = $derived.by(() => {
    try {
      return { ok: true as const, p: parseFormula(text) };
    } catch (e) {
      return { ok: false as const, error: e instanceof ParseError ? e.message : String(e) };
    }
  });

  // Keep the order in sync with the formula's variables (new ones at the end, removed ones dropped).
  $effect(() => {
    if (!parsed.ok) return;
    const names = parsed.p.names;
    const base = order.length ? order : (initialOrder ?? names);
    const next = [...base.filter((n) => names.includes(n)), ...names.filter((n) => !base.includes(n))];
    if (next.join() !== order.join()) order = next;
  });

  const built = $derived.by(() => {
    if (!parsed.ok || !order.length) return undefined;
    const { p } = parsed;
    const b = new Bdd(order.map((n) => p.names.indexOf(n) + 1));
    const root = b.fromFormula(p.formula);
    const nodes = b.graph(root);
    return { b, root, nodes, size: b.size(root), n: p.names.length, count: b.satCount(root, p.names.map((_, i) => i + 1)) };
  });

  $effect(() => {
    if (target && built && built.size <= target && !solved) {
      solved = true;
      if (id) progress.markSolved(id);
    }
  });

  function move(d: number) {
    if (!selected) return;
    const i = order.indexOf(selected);
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const o = [...order];
    [o[i], o[j]] = [o[j]!, o[i]!];
    order = o;
  }

  // Layout: one row per level that has nodes; nodes spread across the row; leaves at the bottom.
  const layout = $derived.by(() => {
    if (!built || built.nodes.length > 180) return undefined;
    const { nodes, root } = built;
    const levels = [...new Set(nodes.map((n) => n.level))].sort((a, b) => a - b);
    const rowOf = new Map(levels.map((l, i) => [l, i]));
    const byRow: (typeof nodes)[] = levels.map(() => []);
    for (const n of nodes) byRow[rowOf.get(n.level)!]!.push(n);
    const widest = Math.max(2, ...byRow.map((r) => r.length));
    const W = Math.max(320, widest * 54 + 40);
    const H = (levels.length + 1) * 62 + 30;
    const pos = new Map<number, { x: number; y: number }>();
    byRow.forEach((row, r) => row.forEach((n, i) => pos.set(n.id, { x: ((i + 1) * W) / (row.length + 1), y: 30 + r * 62 })));
    const leafY = 30 + levels.length * 62;
    const leaves = [0, 1].filter((t) => root === t || nodes.some((n) => n.lo === t || n.hi === t));
    leaves.forEach((t, i) => pos.set(t, { x: ((i + 1) * W) / (leaves.length + 1), y: leafY }));
    return { W, H, pos, leaves };
  });
  const nameOf = (v: number) => (parsed.ok ? parsed.p.names[v - 1] ?? `x${v}` : '');
</script>

<figure class="bddlab">
  {#if editable}
    <label class="ui f">Formula <input type="text" bind:value={text} spellcheck="false" autocomplete="off" /></label>
  {:else}
    <p class="ui f"><code>{text}</code></p>
  {/if}
  {#if !parsed.ok}
    <p class="ui err">{parsed.error}</p>
  {:else if built}
    <div class="order ui">
      <span>Order (top first):</span>
      {#each order as n (n)}
        <button type="button" class="chip" class:sel={selected === n} onclick={() => (selected = selected === n ? undefined : n)} aria-pressed={selected === n}>{n}</button>
      {/each}
      <span class="moves">
        <button type="button" onclick={() => move(-1)} disabled={!selected} aria-label="Move the selected variable up the order">◀</button>
        <button type="button" onclick={() => move(1)} disabled={!selected} aria-label="Move the selected variable down the order">▶</button>
      </span>
    </div>
    <p class="ui stats">
      <b>{built.size}</b> nodes (leaves included) · a full decision tree would have {(2n ** BigInt(built.n + 1) - 1n).toLocaleString('en-GB')} · {built.count.toLocaleString('en-GB')} of {(2n ** BigInt(built.n)).toLocaleString('en-GB')} assignments satisfy it
      {#if target}· target: at most {target} nodes {#if built.size <= target}<span class="ok">✓ reached</span>{/if}{/if}
    </p>
    {#if layout}
      <div class="scroll">
        <svg viewBox="0 0 {layout.W} {layout.H}" width={layout.W} height={layout.H} role="img" aria-label="The BDD of the formula">
          {#each built.nodes as n (n.id)}
            {@const a = layout.pos.get(n.id)!}
            {#each [[n.lo, false], [n.hi, true]] as [c, hi] (String(hi))}
              {@const b = layout.pos.get(c as number)!}
              {@const bend = (hi ? 1 : -1) * (Math.abs(b.x - a.x) < 4 || b.y - a.y > 70 ? 22 + (b.y - a.y) / 12 : 6)}
              <path d="M{a.x + (hi ? 5 : -5)},{a.y + 13} Q{(a.x + b.x) / 2 + bend},{(a.y + b.y) / 2} {b.x},{b.y - 13}" fill="none" class="e" class:hi={hi} class:lo={!hi} />
            {/each}
          {/each}
          {#each built.nodes as n (n.id)}
            {@const a = layout.pos.get(n.id)!}
            <circle cx={a.x} cy={a.y} r="14" class="node" />
            <text x={a.x} y={a.y + 4} class="v">{nameOf(n.v)}</text>
          {/each}
          {#each layout.leaves as t (t)}
            {@const a = layout.pos.get(t)!}
            <rect x={a.x - 13} y={a.y - 13} width="26" height="26" rx="3" class="leaf" class:one={t === 1} />
            <text x={a.x} y={a.y + 5} class="v">{t}</text>
          {/each}
        </svg>
      </div>
      <p class="legend ui"><span class="sw hi"></span>variable true <span class="sw lo"></span>variable false</p>
    {:else}
      <p class="ui note">Too many nodes to draw ({built.size}); the count above is exact.</p>
    {/if}
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .bddlab {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .f {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.85rem;
    margin: 0 0 0.5rem;
  }
  .f input {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: 0.88rem;
    padding: 0.3rem 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .err {
    color: var(--pencil);
    font-size: 0.85rem;
  }
  .order {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  button {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.15rem 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .chip.sel {
    border-color: var(--ink-blue);
    background: var(--ink-blue);
    color: var(--on-accent);
  }
  .moves {
    display: inline-flex;
    gap: 0.2rem;
    margin-left: 0.4rem;
  }
  .stats {
    font-size: 0.84rem;
    color: var(--ink-2);
    margin: 0.6rem 0;
  }
  .ok {
    color: var(--seal);
    font-weight: 700;
  }
  .scroll {
    overflow-x: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  svg {
    display: block;
    margin: 0 auto;
  }
  .e {
    stroke-width: 1.4;
  }
  .e.hi {
    stroke: var(--ink-blue);
  }
  .e.lo {
    stroke: var(--mute);
    stroke-dasharray: 4 3;
  }
  .node {
    fill: var(--pn);
    stroke: var(--ink-blue);
    stroke-width: 1.6;
  }
  .leaf {
    fill: var(--pn);
    stroke: var(--line-strong);
    stroke-width: 1.6;
  }
  .leaf.one {
    stroke: var(--seal);
  }
  .v {
    font-family: var(--font-mono);
    font-size: 10.5px;
    fill: var(--fg);
    text-anchor: middle;
  }
  .legend {
    font-size: 0.78rem;
    color: var(--ink-2);
    display: flex;
    gap: 0.8rem;
    align-items: center;
  }
  .sw {
    display: inline-block;
    width: 1.4rem;
    height: 0;
    margin-right: 0.3rem;
    vertical-align: middle;
  }
  .sw.hi {
    border-top: 2px solid var(--ink-blue);
  }
  .sw.lo {
    border-top: 2px dashed var(--mute);
  }
  .note {
    font-size: 0.84rem;
    color: var(--ink-2);
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
