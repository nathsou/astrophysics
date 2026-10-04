<!--
  The path tree explorer (chapter 15): symbolic execution of one Vouch function, one node at a time. The tree shows
  every branch decision; each finished path has a test input that the interpreter replayed; checks that can fail
  are shown with the input that breaks them. The listing marks the statements the replayed tests reached.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import VouchEditor from '$lib/components/verify/VouchEditor.svelte';
  import { parse } from '$lib/fv/vouch/syntax/parser';
  import { check } from '$lib/fv/vouch/check/checker';
  import { SymbolicExplorer, type SymNode } from '$lib/fv/symex/symex';

  let { code, fn: fnName, unroll: unroll0 = 4, maxNodes = 160, title, caption }: { code: string; fn?: string; unroll?: number; maxNodes?: number; title?: string; caption?: string } = $props();

  // svelte-ignore state_referenced_locally
  let source = $state(code.replace(/\n$/, ''));
  // svelte-ignore state_referenced_locally
  let unroll = $state(unroll0);
  let editing = $state(false);
  let editor: VouchEditor | undefined = $state();
  let ex = $state.raw<SymbolicExplorer | undefined>();
  let error = $state('');
  let tick = $state(0);
  let selected = $state<number | undefined>();
  let fns = $state<string[]>([]);
  // svelte-ignore state_referenced_locally
  let chosen = $state(fnName ?? '');
  let timer: ReturnType<typeof setTimeout> | undefined;

  function reset() {
    clearTimeout(timer);
    error = '';
    selected = undefined;
    const p = parse(source);
    const c = check(p.program);
    const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
    if (errs.length) {
      error = errs.map((e) => e.message).join(' ');
      ex = undefined;
      return;
    }
    fns = [...c.fns.values()].filter((f) => f.decl.body && f.decl.flavour === 'fn').map((f) => f.decl.name);
    if (!fns.includes(chosen)) chosen = fns[fns.length - 1] ?? '';
    const info = c.fns.get(chosen);
    if (!info) {
      error = 'There is no function with a body to explore.';
      ex = undefined;
      return;
    }
    ex = new SymbolicExplorer(c, info, source, { maxUnroll: unroll, maxNodes });
    tick++;
  }
  onMount(reset);

  function step() {
    if (!ex) return;
    try {
      ex.step();
    } catch (e) {
      error = String(e);
    }
    tick++;
  }
  function all() {
    if (!ex) return;
    clearTimeout(timer);
    const go = () => {
      const t0 = performance.now();
      while (ex && !ex.done && performance.now() - t0 < 40) ex.step();
      tick++;
      if (ex && !ex.done) timer = setTimeout(go, 0);
    };
    go();
  }
  function edit() {
    if (editing) {
      source = editor?.getValue() ?? source;
      editing = false;
      reset();
    } else editing = true;
  }

  // ── Layout ──
  const view = $derived.by(() => {
    void tick;
    if (!ex) return undefined;
    const nodes = ex.nodes;
    const pos = new Map<number, { x: number; y: number }>();
    let next = 0;
    const place = (n: SymNode): number => {
      const kids = n.children.map((c) => nodes[c]!);
      let x: number;
      if (!kids.length) x = next++;
      else {
        const xs = kids.map(place);
        x = (xs[0]! + xs[xs.length - 1]!) / 2;
      }
      pos.set(n.id, { x, y: n.depth });
      return x;
    };
    place(nodes[0]!);
    const depth = Math.max(...nodes.map((n) => n.depth));
    const failLines = new Set(ex.failures.map((f) => ex!.lineOf(f.span.start)));
    const stmts = ex.statementLines();
    return { nodes: [...nodes], pos, width: Math.max(1, next), depth, failLines, stmts, covered: new Set(ex.covered) };
  });
  const DX = 36;
  const DY = 54;
  const R = 9;
  const sel = $derived(view && selected !== undefined ? view.nodes[selected] : undefined);
  const selLines = $derived.by(() => {
    if (!sel || !ex || !view) return new Set<number>();
    const out = new Set<number>();
    let n: SymNode | undefined = sel;
    while (n) {
      if (n.branch) out.add(ex.lineOf(n.branch.span.start));
      n = n.parent !== undefined ? view.nodes[n.parent] : undefined;
    }
    if (sel.parent !== undefined) {
      const p = view.nodes[sel.parent]!;
      if (p.branch) out.add(ex.lineOf(p.branch.span.start));
    }
    sel.test?.lines.forEach((l) => out.add(l));
    return out;
  });
  const counts = $derived.by(() => {
    void tick;
    const n = view?.nodes ?? [];
    return { paths: n.filter((x) => x.kind === 'leaf').length, infeasible: n.filter((x) => x.kind === 'infeasible').length, cut: n.filter((x) => x.kind === 'cut').length, failures: n.reduce((s, x) => s + x.failures.length, 0) };
  });
  const lines = $derived(source.split('\n'));
</script>

<figure class="ptree">
  {#if title}<h4 class="ui ttl">{title}</h4>{/if}
  <div class="bar ui">
    {#if fns.length > 1}
      <label>Function <select bind:value={chosen} onchange={reset}>{#each fns as f (f)}<option value={f}>{f}</option>{/each}</select></label>
    {/if}
    <label>Unroll loops <input type="number" min="1" max="12" bind:value={unroll} onchange={reset} /> times</label>
    <button type="button" class="go" onclick={step} disabled={!ex || ex.done || editing}>Step</button>
    <button type="button" onclick={all} disabled={!ex || ex.done || editing}>Explore all</button>
    <button type="button" onclick={reset} disabled={editing}>Reset</button>
    <button type="button" onclick={edit}>{editing ? 'Done editing' : 'Edit the code'}</button>
  </div>
  {#if error}<p class="err ui">{error}</p>{/if}

  <div class="cols">
    <div class="src">
      {#if editing}
        <VouchEditor bind:this={editor} value={source} name="path-tree" minLines={Math.max(8, lines.length)} />
      {:else}
        <ol class="listing">
          {#each lines as l, i (i)}
            {@const n = i + 1}
            <li class:stmt={view?.stmts.includes(n)} class:cov={view?.covered.has(n)} class:fail={view?.failLines.has(n)} class:on={selLines.has(n)}><span class="ln">{n}</span><code>{l || ' '}</code></li>
          {/each}
        </ol>
        {#if view}<p class="ui covline">Statements reached by the replayed tests: {view.stmts.filter((l) => view!.covered.has(l)).length} of {view.stmts.length}</p>{/if}
      {/if}
    </div>
    <div class="tree">
      {#if view}
        <p class="ui stats">{counts.paths} path{counts.paths === 1 ? '' : 's'} · {counts.infeasible} infeasible · {counts.cut} cut · {ex?.queries ?? 0} solver queries{#if counts.failures}{' · '}<strong class="bad">{counts.failures} failing check{counts.failures === 1 ? '' : 's'}</strong>{/if}{#if ex?.done}{' · '}done{/if}</p>
        <div class="svgwrap">
          <svg width={view.width * DX + 20} height={(view.depth + 1) * DY + 10} role="img" aria-label="The execution tree">
            {#each view.nodes as n (n.id)}
              {#if n.parent !== undefined}
                {@const a = view.pos.get(n.parent)!}
                {@const b = view.pos.get(n.id)!}
                <line x1={a.x * DX + 10 + DX / 2} y1={a.y * DY + 18} x2={b.x * DX + 10 + DX / 2} y2={b.y * DY + 18} class="edge" class:no={n.kind === 'infeasible'} class:dashed={n.kind === 'cut'} />
                <text x={(a.x + b.x) / 2 * DX + 10 + DX / 2 + (n.edge?.dir ? -7 : 7)} y={(a.y + b.y) / 2 * DY + 20} class="lab" text-anchor="middle">{n.edge?.dir ? 'T' : 'F'}</text>
              {/if}
            {/each}
            {#each view.nodes as n (n.id)}
              {@const p = view.pos.get(n.id)!}
              {@const cx = p.x * DX + 10 + DX / 2}
              {@const cy = p.y * DY + 18}
              <g class="node {n.kind}" class:failing={n.failures.length > 0} class:sel={selected === n.id} role="button" tabindex="0" onclick={() => (selected = n.id)} onkeydown={(e) => e.key === 'Enter' && (selected = n.id)}>
                {#if n.kind === 'leaf'}<rect x={cx - R} y={cy - R} width={2 * R} height={2 * R} rx="2" />
                {:else if n.kind === 'infeasible'}<path d="M{cx - 6} {cy - 6} L{cx + 6} {cy + 6} M{cx + 6} {cy - 6} L{cx - 6} {cy + 6}" />
                {:else}<circle {cx} {cy} r={R} />{/if}
                {#if n.kind === 'cut'}<text x={cx} y={cy + 4} text-anchor="middle" class="glyph">…</text>{/if}
              </g>
            {/each}
          </svg>
        </div>
        <div class="details ui">
          {#if sel}
            {#if sel.branch}<p><strong>Branch</strong> on <code>{sel.branch.text}</code>{sel.branch.kind === 'loop' ? ` (loop test, iteration ${sel.branch.iteration + 1})` : ''}, line {ex?.lineOf(sel.branch.span.start)}.</p>{/if}
            <p><strong>Path condition</strong>: {#if sel.path.length}{#each sel.path as c, i (i)}<code>{c}</code>{#if i < sel.path.length - 1} ∧ {/if}{/each}{:else}<code>true</code> (the root){/if}</p>
            {#if sel.kind === 'infeasible'}<p>Infeasible: the solver proved that no input satisfies this path condition, so the program can never go this way.</p>{/if}
            {#if sel.kind === 'cut' || sel.kind === 'unknown'}<p>{sel.reason}</p>{/if}
            {#if sel.test}<p><strong>Test</strong>: <code>{sel.test.input}</code> → {sel.test.outcome} {sel.test.replayed ? '(replayed by the interpreter)' : ''}</p>{/if}
            {#each sel.failures as f, i (i)}<p class="bad"><strong>Can fail</strong>: {f.message} Input: <code>{f.input}</code>{f.replayed ? ' (replayed: the interpreter fails there too)' : ''}</p>{/each}
          {:else}
            <p class="hint">Press Step to expand the next node, or Explore all. Click a node to see its path condition and its test.</p>
          {/if}
        </div>
      {/if}
    </div>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .ptree {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .ttl {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.6rem;
    align-items: center;
    font-size: 0.82rem;
    margin-bottom: 0.6rem;
  }
  .bar input[type='number'] {
    width: 3.2rem;
    font: inherit;
    padding: 0.1rem 0.25rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  select {
    font: inherit;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  button {
    font-family: var(--font-ui);
    font-size: 0.82rem;
    padding: 0.22rem 0.65rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .go {
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .err {
    color: var(--pencil);
    font-size: 0.85rem;
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 0.9rem;
  }
  @media (max-width: 820px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  .listing {
    list-style: none;
    margin: 0;
    padding: 0.4rem 0;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    overflow-x: auto;
  }
  .listing li {
    display: flex;
    white-space: pre;
    border-left: 3px solid transparent;
    padding-right: 0.5rem;
  }
  .listing li.stmt {
    border-left-color: var(--line-strong);
  }
  .listing li.cov {
    border-left-color: var(--seal);
  }
  .listing li.fail {
    border-left-color: var(--pencil);
    background: color-mix(in srgb, var(--pencil) 8%, transparent);
  }
  .listing li.on {
    background: color-mix(in srgb, var(--ink-blue) 12%, transparent);
  }
  .ln {
    flex: none;
    display: inline-block;
    width: 2.2rem;
    text-align: right;
    padding-right: 0.6rem;
    color: var(--mute);
    user-select: none;
  }
  .listing code {
    all: unset;
    font: inherit;
    white-space: pre;
  }
  .covline,
  .stats {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.4rem 0;
  }
  .bad {
    color: var(--pencil);
  }
  .svgwrap {
    overflow-x: auto;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
    max-height: 26rem;
  }
  .edge {
    stroke: var(--line-strong);
    stroke-width: 1.4;
  }
  .edge.no {
    stroke-dasharray: 2 3;
    opacity: 0.6;
  }
  .edge.dashed {
    stroke-dasharray: 5 4;
  }
  .lab {
    font-family: var(--font-ui);
    font-size: 9px;
    fill: var(--mute);
  }
  .node {
    cursor: pointer;
  }
  .node circle,
  .node rect {
    fill: var(--panel);
    stroke: var(--ink-2);
    stroke-width: 1.6;
  }
  .node.branch circle {
    fill: color-mix(in srgb, var(--ink-blue) 18%, var(--panel));
    stroke: var(--ink-blue);
  }
  .node.leaf rect {
    fill: color-mix(in srgb, var(--seal) 25%, var(--panel));
    stroke: var(--seal);
  }
  .node.failing rect,
  .node.failing circle {
    fill: color-mix(in srgb, var(--pencil) 30%, var(--panel));
    stroke: var(--pencil);
  }
  .node.infeasible path {
    stroke: var(--mute);
    stroke-width: 2;
  }
  .node.cut circle,
  .node.unknown circle {
    stroke: var(--gold);
    stroke-dasharray: 3 2;
  }
  .glyph {
    font-size: 11px;
    fill: var(--gold);
  }
  .node.sel circle,
  .node.sel rect {
    stroke-width: 3;
  }
  .details {
    margin-top: 0.5rem;
    font-size: 0.84rem;
  }
  .details p {
    margin: 0.3rem 0;
  }
  .details code {
    all: unset;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    overflow-wrap: anywhere;
  }
  .hint {
    color: var(--mute);
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
