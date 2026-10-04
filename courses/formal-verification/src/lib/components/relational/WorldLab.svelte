<!--
  The instance visualiser (chapter 9): a `world` in an editor, a command to run (`check` or `run`), a scope, and the
  instance or counterexample drawn as atoms and arrows. Unary relations are tags on atoms, binary relations arrows,
  wider relations a table. "Another instance" excludes the instances already shown. "Sweep the scope" runs the
  command at every scope from 1 up and plots the size of the SAT problem and the time, which is the small scope
  hypothesis's price list.

  Usage: :::world-lab{title="…" maxScope=5} with a ```vouch world inside.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import VouchEditor from '$lib/components/verify/VouchEditor.svelte';
  import Badge from '$lib/components/verify/Badge.svelte';
  import { parse } from '$lib/fv/vouch/syntax/parser';
  import { check, type Checked } from '$lib/fv/vouch/check/checker';
  import { worldVerdict } from '$lib/fv/verify/document';
  import type { Verdict } from '$lib/fv/engines';
  import type * as A from '$lib/fv/vouch/syntax/ast';

  let { code, title, caption, maxScope = 5, command: initialCommand }: { code: string; title?: string; caption?: string; maxScope?: number; command?: string } = $props();

  let editor: VouchEditor | undefined = $state();
  let checked = $state.raw<Checked | undefined>();
  let world = $state('');
  let commands = $state.raw<A.PropDecl[]>([]);
  // svelte-ignore state_referenced_locally
  let chosen = $state(initialCommand ?? '');
  let scope = $state(3);
  let verdict = $state.raw<Verdict | undefined>();
  let models = $state.raw<boolean[][]>([]);
  let shown = $state(0);
  let error = $state('');
  let sweep = $state.raw<{ scope: number; vars: number; clauses: number; ms: number; found: boolean }[]>([]);
  let sweeping = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const label = (c: A.PropDecl) => `${c.k} ${c.name ?? ''}`.trim();
  const current = $derived(commands.find((c) => label(c) === chosen) ?? commands[0]);

  function load(src: string) {
    error = '';
    verdict = undefined;
    models = [];
    sweep = [];
    const parsed = parse(src);
    const c = check(parsed.program);
    const errs = [...parsed.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
    if (errs.length) {
      error = `line ${src.slice(0, errs[0]!.span.start).split('\n').length}: ${errs[0]!.message}`;
      checked = undefined;
      return;
    }
    const w = [...c.containers.values()].find((x) => x.kind === 'world');
    if (!w) {
      error = 'There is no `world` here.';
      return;
    }
    checked = c;
    world = w.decl.name;
    commands = w.checks;
    if (!commands.some((x) => label(x) === chosen)) chosen = commands[0] ? label(commands[0]) : '';
    const cmd = commands.find((x) => label(x) === chosen);
    scope = cmd?.scope ?? 3;
    run();
  }

  function run(more = false) {
    if (!checked || !current) return;
    const exclude = more ? models : [];
    const v = worldVerdict(checked, world, current, scope, exclude);
    const model = v.result?.model;
    if (!more) {
      models = model ? [model] : [];
      shown = 1;
    } else if (model) {
      models = [...models, model];
      shown = models.length;
    } else shown = models.length + 1;
    verdict = v;
  }

  function doSweep() {
    if (!checked || !current || sweeping) return;
    sweeping = true;
    sweep = [];
    let k = 1;
    const next = () => {
      const t0 = performance.now();
      const v = worldVerdict(checked!, world, current!, k);
      const ms = performance.now() - t0;
      const r = v.result;
      if (r) sweep = [...sweep, { scope: k, vars: r.stats.vars, clauses: r.stats.clauses, ms, found: r.found }];
      k++;
      if (k <= maxScope && ms < 4000) setTimeout(next, 10);
      else sweeping = false;
    };
    setTimeout(next, 10);
  }

  $effect(() => {
    const src = code;
    untrack(() => load(src));
  });
  function changed(src: string) {
    clearTimeout(timer);
    timer = setTimeout(() => load(src), 600);
  }

  // ── Drawing ──
  const inst = $derived(verdict?.instance);
  const palette = ['var(--ink-blue)', 'var(--seal)', 'var(--gold)', 'var(--pencil)', 'var(--ink-2)'];
  const relPalette = ['var(--ink-blue)', 'var(--pencil)', 'var(--seal)', 'var(--gold)', 'var(--ink-2)', 'var(--mute)'];
  const drawing = $derived.by(() => {
    if (!inst) return undefined;
    const atoms = inst.atoms.flatMap((a, ti) => a.names.map((n, k) => ({ name: n, type: a.type, colour: palette[ti % palette.length]!, col: ti, row: k })));
    // One column per atom type, in declaration order; atoms stacked in each column.
    const T = Math.max(1, inst.atoms.length);
    const rows = Math.max(1, ...inst.atoms.map((a) => a.names.length));
    const W = Math.max(380, T * 180);
    const H = Math.max(200, rows * 74 + 50);
    const pos = new Map<string, { x: number; y: number }>();
    for (const a of atoms) {
      const n = inst.atoms[a.col]!.names.length;
      pos.set(a.name, { x: (W * (a.col + 0.5)) / T, y: H / 2 + (a.row - (n - 1) / 2) * 74 });
    }
    const tags = new Map<string, string[]>();
    const edges: { from: string; to: string; rel: string; colour: string; bend: number }[] = [];
    const wide: typeof inst.rels = [];
    const binaries = inst.rels.filter((r) => r.cols.length === 2);
    for (const r of inst.rels) {
      if (r.cols.length === 1) for (const [a] of r.tuples) tags.set(a!, [...(tags.get(a!) ?? []), r.name]);
      else if (r.cols.length > 2) wide.push(r);
    }
    binaries.forEach((r, ri) => {
      for (const [a, b] of r.tuples) {
        // Spread parallel edges between the same pair of atoms.
        const same = edges.filter((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a)).length;
        edges.push({ from: a!, to: b!, rel: r.name, colour: relPalette[ri % relPalette.length]!, bend: same });
      }
    });
    return { atoms, pos, tags, edges, wide, W, H, binaries };
  });

  function edgePath(e: { from: string; to: string; bend: number }, d: NonNullable<typeof drawing>): { path: string; lx: number; ly: number } {
    const a = d.pos.get(e.from)!;
    const b = d.pos.get(e.to)!;
    const r = 20;
    if (e.from === e.to) {
      // A self-loop to the right of the atom.
      const s = 30 + e.bend * 10;
      return { path: `M${a.x + r * 0.7},${a.y - r * 0.7} C${a.x + s + 20},${a.y - s} ${a.x + s + 20},${a.y + s} ${a.x + r * 0.7 + 3},${a.y + r * 0.7 + 3}`, lx: a.x + s + 18, ly: a.y - 4 };
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    // Edges inside one column bow sideways; two-way pairs and parallel edges curve apart.
    const sameCol = Math.abs(dx) < 1;
    const reverse = d.edges.some((x) => x.from === e.to && x.to === e.from);
    const off = (sameCol ? 26 + Math.abs(dy) * 0.25 : 0) + (reverse ? 16 : 0) + e.bend * 16;
    const mx = (a.x + b.x) / 2 + nx * off;
    const my = (a.y + b.y) / 2 + ny * off;
    const ux = (mx - a.x) / (Math.hypot(mx - a.x, my - a.y) || 1);
    const uy = (my - a.y) / (Math.hypot(mx - a.x, my - a.y) || 1);
    const vx = (mx - b.x) / (Math.hypot(mx - b.x, my - b.y) || 1);
    const vy = (my - b.y) / (Math.hypot(mx - b.x, my - b.y) || 1);
    const sx = a.x + ux * r;
    const sy = a.y + uy * r;
    const ex = b.x + vx * (r + 3);
    const ey = b.y + vy * (r + 3);
    return { path: `M${sx},${sy} Q${mx},${my} ${ex},${ey}`, lx: (sx + 2 * mx + ex) / 4, ly: (sy + 2 * my + ey) / 4 - 3 };
  }
  const maxMs = $derived(Math.max(1, ...sweep.map((p) => p.ms)));
  const maxVars = $derived(Math.max(1, ...sweep.map((p) => p.clauses)));
</script>

<figure class="wl">
  {#if title}<header class="ui"><span class="kicker">Small world</span> <span class="title">{title}</span></header>{/if}
  <VouchEditor bind:this={editor} value={code} name="world-lab" minLines={8} maxHeight="24rem" onchange={changed} />
  {#if error}
    <p class="err ui">{error}</p>
  {:else if commands.length}
    <div class="bar ui">
      <label>Command <select bind:value={chosen} onchange={() => { scope = current?.scope ?? 3; run(); }}>{#each commands as c (label(c))}<option value={label(c)}>{label(c)}</option>{/each}</select></label>
      <label class="scope">Scope <input type="range" min="1" max={maxScope} bind:value={scope} onchange={() => run()} /> <b>{scope}</b></label>
      <button type="button" class="go" onclick={() => run()}>Run</button>
      <button type="button" onclick={() => run(true)} disabled={!models.length || verdict?.status === 'error'}>Another instance</button>
      <button type="button" onclick={doSweep} disabled={sweeping}>{sweeping ? 'Sweeping…' : 'Sweep the scope'}</button>
    </div>
    {#if verdict}
      <Badge {verdict} />
      {#if shown > models.length && models.length}<p class="note ui">No other instance: all {models.length} instance{models.length === 1 ? '' : 's'} at this scope {models.length === 1 ? 'has' : 'have'} been shown (instances that differ only by renaming atoms count as different here).</p>{/if}
      {#if drawing}
        <div class="pic">
          <svg viewBox="0 0 {drawing.W} {drawing.H}" role="img" aria-label="The instance: atoms and the relations between them">
            <defs>
              {#each drawing.binaries as r, ri (r.name)}
                <marker id="wl-arrow-{ri}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill={relPalette[ri % relPalette.length]} /></marker>
              {/each}
            </defs>
            {#each drawing.edges as e, i (i)}
              {@const p = edgePath(e, drawing)}
              {@const ri = drawing.binaries.findIndex((r) => r.name === e.rel)}
              <path d={p.path} fill="none" stroke={e.colour} stroke-width="1.6" marker-end="url(#wl-arrow-{ri})" />
              <text x={p.lx} y={p.ly} class="rl" fill={e.colour}>{e.rel}</text>
            {/each}
            {#each drawing.atoms as a (a.name)}
              {@const q = drawing.pos.get(a.name)!}
              <circle cx={q.x} cy={q.y} r="20" class="atom" style="stroke: {a.colour}" />
              <text x={q.x} y={q.y + 4} class="an">{a.name}</text>
              {#if drawing.tags.get(a.name)}<text x={q.x} y={q.y + 34} class="tag">{drawing.tags.get(a.name)!.join(', ')}</text>{/if}
            {/each}
            {#if !drawing.atoms.length}<text x={drawing.W / 2} y={drawing.H / 2} class="an">(no atoms at all)</text>{/if}
          </svg>
          <ul class="legend ui">
            {#each verdict.instance?.atoms ?? [] as a, ti (a.type)}<li><span class="dot" style="background: {palette[ti % palette.length]}"></span>{a.type}: {a.names.length ? a.names.join(', ') : 'none'}</li>{/each}
            {#each verdict.instance?.rels ?? [] as r (r.name)}<li><code>{r.name}</code> = {'{'}{r.tuples.map((t) => (t.length === 1 ? t[0] : `(${t.join(', ')})`)).join(', ')}{'}'}</li>{/each}
          </ul>
        </div>
      {/if}
    {/if}
    {#if sweep.length}
      <div class="sweep ui">
        <p class="h">The same command at every scope: the SAT problem grows, and so does the time.</p>
        <table>
          <thead><tr><th>scope</th><th>clauses</th><th></th><th>time</th><th></th><th>result</th></tr></thead>
          <tbody>
            {#each sweep as p (p.scope)}
              <tr>
                <td>{p.scope}</td>
                <td>{p.clauses.toLocaleString('en-GB')}</td>
                <td class="barcell"><span class="bar1" style="width: {(p.clauses / maxVars) * 100}%"></span></td>
                <td>{p.ms < 1000 ? `${Math.max(1, Math.round(p.ms))} ms` : `${(p.ms / 1000).toFixed(1)} s`}</td>
                <td class="barcell"><span class="bar2" style="width: {(p.ms / maxMs) * 100}%"></span></td>
                <td>{p.found ? (current?.k === 'check' ? 'counterexample' : 'instance') : 'none'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .wl {
    margin: 2rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  header {
    margin-bottom: 0.5rem;
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
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.8rem;
    align-items: center;
    margin: 0.6rem 0;
    font-size: 0.84rem;
  }
  select,
  button {
    font: inherit;
    font-size: 0.84rem;
    padding: 0.25rem 0.6rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  button {
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
  .scope {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
  }
  .scope input {
    width: 7rem;
    accent-color: var(--ink-blue);
  }
  .err {
    color: var(--pencil);
    font-size: 0.85rem;
  }
  .note {
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .pic {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: 0.8rem;
    margin-top: 0.6rem;
    align-items: start;
  }
  @media (max-width: 640px) {
    .pic {
      grid-template-columns: 1fr;
    }
  }
  svg {
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  .atom {
    fill: var(--pn);
    stroke-width: 2.5;
  }
  .an {
    font-family: var(--font-mono);
    font-size: 11px;
    fill: var(--fg);
    text-anchor: middle;
  }
  .tag {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 700;
    fill: var(--gold);
    text-anchor: middle;
  }
  .rl {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 600;
    text-anchor: middle;
    paint-order: stroke;
    stroke: var(--panel);
    stroke-width: 3px;
  }
  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.8rem;
    display: grid;
    gap: 0.3rem;
    overflow-wrap: anywhere;
  }
  .legend code {
    font-family: var(--font-mono);
    font-weight: 600;
  }
  .dot {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    margin-right: 0.4rem;
    vertical-align: -0.05rem;
  }
  .sweep {
    margin-top: 0.8rem;
    font-size: 0.82rem;
  }
  .sweep .h {
    margin: 0 0 0.3rem;
    color: var(--ink-2);
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th,
  td {
    text-align: left;
    padding: 0.15rem 0.4rem;
    border-bottom: 1px solid var(--line);
    font-variant-numeric: tabular-nums;
  }
  .barcell {
    width: 22%;
  }
  .bar1,
  .bar2 {
    display: block;
    height: 0.55rem;
    border-radius: 2px;
    background: var(--ink-blue);
    min-width: 2px;
  }
  .bar2 {
    background: var(--pencil);
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
