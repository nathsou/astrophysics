<!--
  The random 3-SAT phase transition, generated live: for each clause-to-variable ratio, solve a batch of random
  formulas with the course's CDCL solver and plot the fraction that are satisfiable and the median work (conflicts).
-->
<script lang="ts">
  import { randomKSat } from '$lib/fv/sat/encode';
  import { solveCnf } from '$lib/fv/sat/solver';
  import { rng } from '$lib/fv/util/random';

  let { caption, n = 60, perPoint = 30 }: { caption?: string; n?: number; perPoint?: number } = $props();

  const ratios = Array.from({ length: 25 }, (_, i) => 2 + i * 0.25);
  let points = $state<{ r: number; sat: number; work: number }[]>([]);
  let running = $state(false);

  function start() {
    if (running) return;
    running = true;
    points = [];
    const rand = rng(1971);
    let i = 0;
    const step = () => {
      const r = ratios[i]!;
      const m = Math.round(r * n);
      let sat = 0;
      const work: number[] = [];
      for (let k = 0; k < perPoint; k++) {
        const res = solveCnf(randomKSat(rand, n, m, 3), {});
        if (res.result === 'sat') sat++;
        work.push(res.solver.stats.conflicts);
      }
      work.sort((a, b) => a - b);
      points = [...points, { r, sat: sat / perPoint, work: work[Math.floor(work.length / 2)]! }];
      i++;
      if (i < ratios.length) requestAnimationFrame(step);
      else running = false;
    };
    requestAnimationFrame(step);
  }

  const W = 560;
  const H = 240;
  const x = (r: number) => 40 + ((r - 2) / 6) * (W - 60);
  const ySat = (f: number) => 20 + (1 - f) * (H - 50);
  const maxWork = $derived(Math.max(1, ...points.map((p) => p.work)));
  const yWork = (w: number) => 20 + (1 - w / maxWork) * (H - 50);
</script>

<figure class="phase">
  <div class="bar ui">
    <button type="button" onclick={start} disabled={running}>{running ? 'Solving…' : points.length ? 'Run again' : 'Generate the plot'}</button>
    <span>{n} variables, {perPoint} random formulas per ratio, solved by the course's CDCL solver in your browser.</span>
  </div>
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Fraction satisfiable and median conflicts against the ratio of clauses to variables">
    <line x1="40" y1={H - 30} x2={W - 20} y2={H - 30} class="axis" />
    <line x1="40" y1="20" x2="40" y2={H - 30} class="axis" />
    {#each [2, 3, 4, 4.26, 5, 6, 7, 8] as t (t)}
      <text x={x(t)} y={H - 14} class="tick" class:hot={t === 4.26}>{t}</text>
      {#if t === 4.26}<line x1={x(t)} y1="20" x2={x(t)} y2={H - 30} class="mark" />{/if}
    {/each}
    <text x="44" y="14" class="lbl sat">fraction satisfiable</text>
    <text x={W - 24} y="14" class="lbl work" text-anchor="end">median conflicts (max {maxWork.toLocaleString('en-GB')})</text>
    <text x={W / 2} y={H - 1} class="tick">clauses ÷ variables</text>
    {#if points.length > 1}
      <polyline points={points.map((p) => `${x(p.r)},${ySat(p.sat)}`).join(' ')} class="line sat" />
      <polyline points={points.map((p) => `${x(p.r)},${yWork(p.work)}`).join(' ')} class="line work" />
    {/if}
    {#each points as p (p.r)}
      <circle cx={x(p.r)} cy={ySat(p.sat)} r="2.5" class="dot sat" />
      <circle cx={x(p.r)} cy={yWork(p.work)} r="2.5" class="dot work" />
    {/each}
  </svg>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .phase {
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
  .mark {
    stroke: var(--gold);
    stroke-dasharray: 3 3;
  }
  .tick {
    font-family: var(--font-ui);
    font-size: 10px;
    fill: var(--mute);
    text-anchor: middle;
  }
  .tick.hot {
    fill: var(--gold);
    font-weight: 700;
  }
  .lbl {
    font-family: var(--font-ui);
    font-size: 10.5px;
    font-weight: 700;
  }
  .line {
    fill: none;
    stroke-width: 2;
  }
  .sat {
    stroke: var(--seal);
    fill: var(--seal);
  }
  .work {
    stroke: var(--pencil);
    fill: var(--pencil);
  }
  .line.sat,
  .line.work {
    fill: none;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
