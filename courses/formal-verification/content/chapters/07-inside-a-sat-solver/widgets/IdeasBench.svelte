<!--
  What each idea buys: the same formulas solved by the course's solver with its ideas switched on one at a time:
  plain DPLL (chronological backtracking), clause learning with backjumping, the VSIDS heuristic, restarts.
  Every number is measured in your browser; a run that exceeds its time budget is reported as such.
-->
<script lang="ts">
  import { Solver, type SolverOptions } from '$lib/fv/sat/solver';
  import { pigeonhole, randomKSat, sudoku, nQueens } from '$lib/fv/sat/encode';
  import { rng } from '$lib/fv/util/random';
  import type { Cnf } from '$lib/fv/sat/cnf';

  let { caption, budget = 2500 }: { caption?: string; budget?: number } = $props();

  const hard9 = '800000000003600000070090200050007000000045700000100030001000068008500010090000400';
  const benches: { name: string; make: () => Cnf }[] = [
    { name: 'Sudoku 9 × 9 (21 givens)', make: () => sudoku(3, [...hard9].map(Number)) },
    { name: '12 queens', make: () => nQueens(12) },
    { name: 'Random 3-SAT, 120 variables, ratio 4.26', make: () => randomKSat(rng(42), 120, 511, 3) },
    { name: 'Pigeonhole: 7 pigeons, 6 holes', make: () => pigeonhole(7, 6) },
  ];
  const configs: { name: string; opts: SolverOptions }[] = [
    { name: 'DPLL', opts: { learn: false, vsids: false, restarts: false } },
    { name: '+ learning', opts: { learn: true, vsids: false, restarts: false } },
    { name: '+ VSIDS', opts: { learn: true, vsids: true, restarts: false } },
    { name: '+ restarts (full CDCL)', opts: { learn: true, vsids: true, restarts: true } },
  ];
  type Cell = { result: string; decisions: number; conflicts: number; ms: number } | undefined;
  let table = $state<Cell[][]>(benches.map(() => configs.map(() => undefined)));
  let running = $state(false);

  function runAll() {
    if (running) return;
    running = true;
    table = benches.map(() => configs.map(() => undefined));
    const jobs = benches.flatMap((_, b) => configs.map((_, c) => [b, c] as const));
    let k = 0;
    const next = () => {
      const [b, c] = jobs[k]!;
      const cnf = benches[b]!.make();
      const s = new Solver(configs[c]!.opts);
      s.ensureVars(cnf.nvars);
      for (const cl of cnf.clauses) s.addClause(cl);
      const t0 = performance.now();
      const r = s.solve({ shouldStop: () => performance.now() - t0 > budget });
      const ms = performance.now() - t0;
      table[b]![c] = { result: r === 'unknown' ? 'gave up' : r, decisions: s.stats.decisions, conflicts: s.stats.conflicts, ms };
      k++;
      if (k < jobs.length) setTimeout(next, 10);
      else running = false;
    };
    setTimeout(next, 10);
  }
</script>

<figure class="bench">
  <div class="bar ui">
    <button type="button" onclick={runAll} disabled={running}>{running ? 'Running…' : 'Run the benchmarks'}</button>
    <span>Each run stops after {budget / 1000} s. Numbers are conflicts and time.</span>
  </div>
  <div class="scroll">
    <table class="ui">
      <thead>
        <tr><th>Formula</th>{#each configs as c (c.name)}<th>{c.name}</th>{/each}</tr>
      </thead>
      <tbody>
        {#each benches as b, i (b.name)}
          <tr>
            <th>{b.name}</th>
            {#each configs as _, j (j)}
              {@const cell = table[i]![j]}
              <td class:gave={cell?.result === 'gave up'}>
                {#if cell}
                  <b>{cell.result === 'gave up' ? 'gave up' : cell.result}</b>
                  <span>{cell.conflicts.toLocaleString('en-GB')} conflicts</span>
                  <span>{cell.ms < 1000 ? `${Math.round(cell.ms)} ms` : `${(cell.ms / 1000).toFixed(1)} s`}</span>
                {:else}<span class="dash">–</span>{/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .bench {
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
    margin-bottom: 0.6rem;
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
  .scroll {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    font-size: 0.8rem;
    width: 100%;
  }
  th,
  td {
    text-align: left;
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
  }
  thead th {
    text-transform: none;
    letter-spacing: normal;
  }
  td span {
    display: block;
    color: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }
  td.gave b {
    color: var(--pencil);
  }
  .dash {
    color: var(--mute);
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
