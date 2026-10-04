<!--
  How the pigeonhole formulas grow for CDCL: n + 1 pigeons in n holes, solved in the browser by the course's solver
  in two configurations, with the number of conflicts on a logarithmic scale. Each run has a time budget; a run that
  exceeds it is drawn as an open circle at the count reached ("at least this many").
-->
<script lang="ts">
  import { Solver, type SolverOptions } from '$lib/fv/sat/solver';
  import { pigeonhole } from '$lib/fv/sat/encode';

  let { caption, max = 9, budget = 3000 }: { caption?: string; max?: number; budget?: number } = $props();

  const configs: { name: string; cls: string; opts: SolverOptions }[] = [
    { name: 'learning, fixed order', cls: 'a', opts: { learn: true, vsids: false, restarts: false } },
    { name: 'full CDCL (VSIDS, restarts)', cls: 'b', opts: { learn: true, vsids: true, restarts: true } },
  ];
  type Pt = { n: number; conflicts: number; done: boolean; ms: number };
  let series = $state<Pt[][]>(configs.map(() => []));
  let running = $state(false);

  function start() {
    if (running) return;
    running = true;
    series = configs.map(() => []);
    // svelte-ignore state_referenced_locally
    const jobs = configs.flatMap((_, c) => Array.from({ length: max - 1 }, (_, k) => [c, k + 2] as const));
    let j = 0;
    const gaveUp = new Set<number>();
    const next = () => {
      while (j < jobs.length && gaveUp.has(jobs[j]![0])) j++;
      if (j >= jobs.length) {
        running = false;
        return;
      }
      const [c, n] = jobs[j++]!;
      const f = pigeonhole(n + 1, n);
      const s = new Solver(configs[c]!.opts);
      s.ensureVars(f.nvars);
      for (const cl of f.clauses) s.addClause(cl);
      const t0 = performance.now();
      const r = s.solve({ shouldStop: () => performance.now() - t0 > budget });
      const pt = { n, conflicts: s.stats.conflicts, done: r === 'unsat', ms: performance.now() - t0 };
      if (!pt.done) gaveUp.add(c);
      series = series.map((s2, k) => (k === c ? [...s2, pt] : s2));
      setTimeout(next, 10);
    };
    setTimeout(next, 10);
  }

  const W = 560;
  const H = 260;
  const L = 56;
  const x = (n: number) => L + ((n - 2) / Math.max(1, max - 2)) * (W - L - 20);
  const top = $derived(Math.max(10, ...series.flat().map((p) => p.conflicts)));
  const decades = $derived(Math.ceil(Math.log10(top)));
  const y = (v: number) => H - 30 - (Math.log10(Math.max(1, v)) / Math.max(1, decades)) * (H - 50);
</script>

<figure class="growth">
  <div class="bar ui">
    <button type="button" onclick={start} disabled={running}>{running ? 'Solving…' : series[0]!.length ? 'Run again' : 'Run'}</button>
    <span>n + 1 pigeons in n holes, n = 2 to {max}; each run stops after {budget / 1000} s.</span>
  </div>
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Conflicts needed for the pigeonhole formulas, logarithmic scale">
    <line x1={L} y1={H - 30} x2={W - 16} y2={H - 30} class="axis" />
    <line x1={L} y1="16" x2={L} y2={H - 30} class="axis" />
    {#each Array.from({ length: decades + 1 }, (_, d) => d) as d (d)}
      <line x1={L} y1={y(10 ** d)} x2={W - 16} y2={y(10 ** d)} class="grid" />
      <text x={L - 6} y={y(10 ** d) + 3} class="tick" text-anchor="end">{(10 ** d).toLocaleString('en-GB')}</text>
    {/each}
    {#each Array.from({ length: max - 1 }, (_, k) => k + 2) as n (n)}
      <text x={x(n)} y={H - 14} class="tick" text-anchor="middle">{n}</text>
    {/each}
    <text x={(W + L) / 2} y={H - 1} class="tick" text-anchor="middle">holes n</text>
    <text x={L + 4} y="12" class="tick">conflicts (log scale)</text>
    {#each configs as c, k (c.name)}
      {@const pts = series[k]!}
      {#if pts.length > 1}<polyline points={pts.map((p) => `${x(p.n)},${y(p.conflicts)}`).join(' ')} class="line {c.cls}" />{/if}
      {#each pts as p (p.n)}
        <circle cx={x(p.n)} cy={y(p.conflicts)} r="3.5" class="dot {c.cls}" class:open={!p.done}><title>{p.n} holes: {p.done ? '' : 'at least '}{p.conflicts.toLocaleString('en-GB')} conflicts, {Math.round(p.ms)} ms</title></circle>
      {/each}
    {/each}
  </svg>
  <div class="legend ui">
    {#each configs as c, k (c.name)}
      <span class="key {c.cls}">{c.name}{#if series[k]!.length}: {series[k]!.map((p) => `${p.done ? '' : '≥ '}${p.conflicts.toLocaleString('en-GB')}`).join(', ')}{/if}</span>
    {/each}
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .growth {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .bar {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    flex-wrap: wrap;
    font-size: 0.82rem;
    color: var(--ink-2);
    margin-bottom: 0.5rem;
  }
  button {
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    padding: 0.3rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ink-blue);
    background: var(--ink-blue);
    color: var(--on-accent);
  }
  button:disabled {
    opacity: 0.6;
  }
  svg {
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  .axis {
    stroke: var(--line-strong);
  }
  .grid {
    stroke: var(--line);
    stroke-dasharray: 2 3;
  }
  .tick {
    font-family: var(--font-ui);
    font-size: 10px;
    fill: var(--mute);
  }
  .line {
    fill: none;
    stroke-width: 2;
  }
  .a {
    stroke: var(--ink-blue);
    fill: var(--ink-blue);
    color: var(--ink-blue);
  }
  .b {
    stroke: var(--pencil);
    fill: var(--pencil);
    color: var(--pencil);
  }
  .line.a,
  .line.b {
    fill: none;
  }
  .dot.open {
    fill: var(--panel);
    stroke-width: 2;
  }
  .legend {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-top: 0.5rem;
    font-size: 0.8rem;
  }
  .key::before {
    content: '';
    display: inline-block;
    width: 0.9rem;
    height: 3px;
    margin-right: 0.4rem;
    vertical-align: middle;
    background: currentColor;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
