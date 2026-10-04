<!--
  The simplex view: linear constraints over x and y, drawn as half-planes, with the feasible region shaded. The
  course's simplex starts at (0, 0) and pivots; each pivot moves the assignment to a vertex, shown as a path. If the
  constraints are infeasible, the Farkas multipliers combine them into an absurd inequality anyone can check. In
  integer mode, branch and bound splits on a fractional coordinate and the tree of subproblems is shown.
-->
<script lang="ts">
  import { parseConstraint, runSimplex, farkasSum, branchAndBound, qText, qNum, LpParseError, type Constraint, type Run, type BbNode } from './lp';

  let { constraints: initial, integer: initialInteger = false, view = [-1, 6, -1, 6], caption }: { constraints: string[]; integer?: boolean; view?: number[]; caption?: string } = $props();

  // svelte-ignore state_referenced_locally
  let text = $state(initial.join('\n'));
  // svelte-ignore state_referenced_locally
  let integer = $state(initialInteger);
  let shown = $state(0);
  let selectedNode = $state(0);

  const parsed = $derived.by(() => {
    try {
      const cs = text.split('\n').map((l) => l.trim()).filter(Boolean).map(parseConstraint);
      return { ok: true as const, cs };
    } catch (e) {
      return { ok: false as const, error: e instanceof LpParseError ? e.message : String(e) };
    }
  });
  const run = $derived<Run | undefined>(parsed.ok ? runSimplex(parsed.cs) : undefined);
  const bb = $derived(parsed.ok && integer ? branchAndBound(parsed.cs) : undefined);
  const node = $derived<BbNode | undefined>(bb?.nodes[Math.min(selectedNode, (bb?.nodes.length ?? 1) - 1)]);
  const active = $derived<Run | undefined>(integer ? node?.run : run);
  $effect(() => {
    void text;
    void integer;
    shown = 0;
    selectedNode = 0;
  });

  const [X0, X1, Y0, Y1] = view as [number, number, number, number];
  const W = 380;
  const H = 380;
  const sx = (x: number) => ((x - X0) / (X1 - X0)) * W;
  const sy = (y: number) => H - ((y - Y0) / (Y1 - Y0)) * H;

  type P = [number, number];
  /** Clip a polygon to the half-plane a·x + b·y ≤ k (Sutherland–Hodgman). */
  function clip(poly: P[], a: number, b: number, k: number): P[] {
    const out: P[] = [];
    const inside = (p: P) => a * p[0] + b * p[1] <= k + 1e-9;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      const ip = inside(p);
      const iq = inside(q);
      if (ip) out.push(p);
      if (ip !== iq) {
        const t = (k - a * p[0] - b * p[1]) / (a * (q[0] - p[0]) + b * (q[1] - p[1]));
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    return out;
  }
  const region = (cs: { a: bigint; b: bigint; rel: string; k: bigint }[]) => {
    let poly: P[] = [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]];
    for (const c of cs) {
      const a = Number(c.a);
      const b = Number(c.b);
      const k = Number(c.k);
      if (c.rel !== '>=') poly = clip(poly, a, b, k);
      if (c.rel !== '<=') poly = clip(poly, -a, -b, -k);
      if (!poly.length) break;
    }
    return poly;
  };
  const feasibleRegion = $derived(parsed.ok ? region(parsed.cs) : []);
  const nodeRegion = $derived(parsed.ok && integer && node ? region([...parsed.cs, ...node.extra.map((e) => ({ a: e.v === 'x' ? 1n : 0n, b: e.v === 'y' ? 1n : 0n, rel: e.rel, k: e.k }))]) : []);

  /** The segment of the line a·x + b·y = k inside the view. */
  function line(c: Constraint): [P, P] | undefined {
    const a = Number(c.a);
    const b = Number(c.b);
    const k = Number(c.k);
    const pts: P[] = [];
    if (b !== 0) for (const x of [X0, X1]) pts.push([x, (k - a * x) / b]);
    if (a !== 0) for (const y of [Y0, Y1]) pts.push([(k - b * y) / a, y]);
    const inView = pts.filter(([x, y]) => x >= X0 - 1e-9 && x <= X1 + 1e-9 && y >= Y0 - 1e-9 && y <= Y1 + 1e-9);
    if (inView.length < 2) return undefined;
    return [inView[0]!, inView[inView.length - 1]!];
  }
  const lattice = $derived.by(() => {
    if (!integer) return [];
    const out: P[] = [];
    for (let x = Math.ceil(X0); x <= X1; x++) for (let y = Math.ceil(Y0); y <= Y1; y++) out.push([x, y]);
    return out;
  });
  const path = $derived(active?.path ?? []);
  const minus = (s: string) => s.replace(/^-/, "−");
  const fmt = (v: number) => minus(String(Math.round(v * 1000) / 1000));
  const upto = $derived(integer ? path.length : Math.min(path.length, shown + 1));
  const farkas = $derived(parsed.ok && run && !run.feasible && run.farkas && !integer ? farkasSum(parsed.cs, run.farkas) : undefined);
  const term = (a: bigint | string, b: bigint | string) => {
    const parts: string[] = [];
    const one = (c: string, v: string) => (c === '0' ? '' : c === '1' ? v : c === '-1' ? `−${v}` : `${c.replace('-', '−')}${v}`);
    const ax = one(String(a), 'x');
    const by = one(String(b), 'y');
    if (ax) parts.push(ax);
    if (by) parts.push(parts.length && !by.startsWith('−') ? `+ ${by}` : parts.length ? `− ${by.slice(1)}` : by);
    return parts.join(' ') || '0';
  };
</script>

<figure class="simplex">
  <div class="cols">
    <div class="left">
      <label class="ui lab" for="lp-text">Constraints over x and y, one per line</label>
      <textarea id="lp-text" bind:value={text} rows={Math.max(4, initial.length + 1)} spellcheck="false"></textarea>
      <label class="ui chk"><input type="checkbox" bind:checked={integer} /> x and y must be integers (branch and bound)</label>
      {#if !parsed.ok}<p class="ui err">{parsed.error}</p>{/if}
      {#if parsed.ok && run && !integer}
        <div class="bar ui">
          <button type="button" onclick={() => (shown = Math.min(shown + 1, path.length - 1))} disabled={shown >= path.length - 1}>Next pivot</button>
          <button type="button" onclick={() => (shown = path.length - 1)} disabled={shown >= path.length - 1}>All pivots</button>
          <button type="button" onclick={() => (shown = 0)}>Restart</button>
        </div>
        <p class="ui status" class:good={run.feasible && shown === path.length - 1} class:bad={!run.feasible && shown === path.length - 1}>
          {#if shown < path.length - 1}Pivot {shown} of {path.length - 1}: x = {fmt(path[shown]!.x)}, y = {fmt(path[shown]!.y)}.
          {:else if run.feasible}Feasible after {run.pivots} pivot{run.pivots === 1 ? '' : 's'}: x = {qText(run.x)}, y = {qText(run.y)}.
          {:else}Infeasible after {run.pivots} pivot{run.pivots === 1 ? '' : 's'}. The certificate:{/if}
        </p>
        {#if farkas && shown === path.length - 1}
          <table class="farkas ui">
            <tbody>
              {#each [...farkas.rows].sort((p, q) => p.index - q.index) as r (r.index)}<tr><td>{qText(r.m)} ×</td><td>({term(r.a, r.b)} ≤ {minus(String(r.k))})</td><td class="src">constraint {r.index + 1}</td></tr>{/each}
              <tr class="sum"><td>sum:</td><td>0 ≤ {minus(qText(farkas.sum.k))}</td><td class="src">false</td></tr>
            </tbody>
          </table>
          <p class="ui note">Each line is a constraint written as “… ≤ …” and multiplied by a non-negative number; adding them makes x and y cancel and leaves an inequality that is false. So no point satisfies all the constraints.</p>
        {/if}
      {/if}
      {#if bb}
        <p class="ui status" class:good={!!bb.solution} class:bad={bb.exhausted}>{bb.solution ? `Integer solution: x = ${qText(bb.solution.run.x)}, y = ${qText(bb.solution.run.y)}.` : bb.exhausted ? 'Every branch is infeasible: no integer solution.' : 'Stopped after 40 subproblems.'}</p>
        <ol class="tree ui">
          {#each bb.nodes as n (n.id)}
            {@const depth = n.extra.length}
            <li style="padding-left: {depth * 0.9}rem" class={n.status} class:sel={node?.id === n.id}>
              <button type="button" onclick={() => (selectedNode = n.id)}>{n.branch ?? 'root'}</button>
              <span>{n.status === 'unexplored' ? 'not explored' : n.status === 'infeasible' ? 'infeasible' : n.status === 'integral' ? `integral: (${qText(n.run.x)}, ${qText(n.run.y)})` : `(${qText(n.run.x)}, ${qText(n.run.y)}): split`}</span>
            </li>
          {/each}
        </ol>
      {/if}
    </div>
    <div class="right">
      <svg viewBox="-28 -8 {W + 36} {H + 30}" role="img" aria-label="The constraints as half-planes and the simplex path">
        {#each Array.from({ length: Math.floor(X1) - Math.ceil(X0) + 1 }, (_, i) => Math.ceil(X0) + i) as gx (gx)}
          <line x1={sx(gx)} y1="0" x2={sx(gx)} y2={H} class="grid" class:axis={gx === 0} />
          <text x={sx(gx)} y={H + 14} class="tick">{gx}</text>
        {/each}
        {#each Array.from({ length: Math.floor(Y1) - Math.ceil(Y0) + 1 }, (_, i) => Math.ceil(Y0) + i) as gy (gy)}
          <line x1="0" y1={sy(gy)} x2={W} y2={sy(gy)} class="grid" class:axis={gy === 0} />
          <text x="-8" y={sy(gy) + 3} class="tick end">{gy}</text>
        {/each}
        {#if feasibleRegion.length >= 2}<polygon points={feasibleRegion.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ')} class="region" />{/if}
        {#if nodeRegion.length >= 2}<polygon points={nodeRegion.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ')} class="noderegion" />{/if}
        {#if parsed.ok}
          {#each parsed.cs as c, i (i)}
            {@const seg = line(c)}
            {#if seg}
              <line x1={sx(seg[0][0])} y1={sy(seg[0][1])} x2={sx(seg[1][0])} y2={sy(seg[1][1])} class="cline" class:hot={farkas?.rows.some((r) => r.index === i) && shown === path.length - 1} />
              <text x={sx((seg[0][0] * 3 + seg[1][0]) / 4)} y={sy((seg[0][1] * 3 + seg[1][1]) / 4) - 4} class="clab">{i + 1}</text>
            {/if}
          {/each}
        {/if}
        {#each lattice as [x, y] (`${x},${y}`)}<circle cx={sx(x)} cy={sy(y)} r="1.8" class="lat" />{/each}
        {#if upto > 1}<polyline points={path.slice(0, upto).map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} class="path" />{/if}
        {#each path.slice(0, upto) as p, i (i)}<circle cx={sx(p.x)} cy={sy(p.y)} r={i === upto - 1 ? 5 : 3} class="pt" class:last={i === upto - 1} />{/each}
      </svg>
    </div>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .simplex {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.9rem;
  }
  @media (max-width: 700px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  .lab {
    display: block;
    font-size: 0.78rem;
    color: var(--ink-2);
    margin-bottom: 0.2rem;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    padding: 0.4rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .chk {
    display: block;
    font-size: 0.82rem;
    margin: 0.3rem 0;
  }
  .chk input {
    accent-color: var(--ink-blue);
  }
  .bar {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
    margin: 0.4rem 0;
  }
  button {
    font-family: var(--font-ui);
    font-size: 0.8rem;
    padding: 0.2rem 0.6rem;
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
  .err {
    color: var(--pencil);
    font-size: 0.82rem;
  }
  .status {
    font-size: 0.84rem;
    color: var(--ink-2);
    margin: 0.3rem 0;
  }
  .status.good {
    color: var(--seal);
    font-weight: 600;
  }
  .status.bad {
    color: var(--pencil);
    font-weight: 600;
  }
  .farkas {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    border-collapse: collapse;
  }
  .farkas td {
    padding: 0.1rem 0.4rem;
  }
  .farkas .src {
    color: var(--mute);
    font-family: var(--font-ui);
    font-size: 0.74rem;
  }
  .farkas .sum td {
    border-top: 1px solid var(--line-strong);
    font-weight: 700;
    color: var(--pencil);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .tree {
    list-style: none;
    margin: 0.3rem 0 0;
    padding: 0;
    font-size: 0.78rem;
    max-height: 14rem;
    overflow: auto;
  }
  .tree li {
    display: flex;
    gap: 0.4rem;
    align-items: baseline;
    padding: 0.08rem 0;
  }
  .tree li.sel button {
    border-color: var(--ink-blue);
    color: var(--ink-blue);
    font-weight: 700;
  }
  .tree li.infeasible span {
    color: var(--pencil);
  }
  .tree li.integral span {
    color: var(--seal);
    font-weight: 700;
  }
  .tree li.unexplored span {
    color: var(--mute);
  }
  .tree button {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    padding: 0.05rem 0.35rem;
  }
  svg {
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  .grid {
    stroke: var(--line);
  }
  .grid.axis {
    stroke: var(--line-strong);
    stroke-width: 1.5;
  }
  .tick {
    font-family: var(--font-ui);
    font-size: 10px;
    fill: var(--mute);
    text-anchor: middle;
  }
  .tick.end {
    text-anchor: end;
  }
  .region {
    fill: color-mix(in srgb, var(--seal) 18%, transparent);
    stroke: var(--seal);
    stroke-width: 1.2;
  }
  .noderegion {
    fill: color-mix(in srgb, var(--gold) 22%, transparent);
    stroke: var(--gold);
    stroke-dasharray: 4 3;
  }
  .cline {
    stroke: var(--ink-2);
    stroke-width: 1.2;
  }
  .cline.hot {
    stroke: var(--pencil);
    stroke-width: 2.2;
  }
  .clab {
    font-family: var(--font-ui);
    font-size: 10px;
    font-weight: 700;
    fill: var(--ink-2);
  }
  .lat {
    fill: var(--mute);
  }
  .path {
    fill: none;
    stroke: var(--ink-blue);
    stroke-width: 2;
  }
  .pt {
    fill: var(--ink-blue);
  }
  .pt.last {
    fill: var(--gold);
    stroke: var(--ink-blue);
    stroke-width: 1.5;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
