<!--
  The lattice exercise: make a ring of identical FODO cells stable and hit a target. The reader sets the focusing strengths of the two
  quadrupoles (and, if the spec allows, the drift length); the exercise shows the one-turn matrix trace, the phase advance per cell, the ring tune
  and β(s), and passes when the targets are met within the tolerance.

  Spec: { id, title, prompt, hints?, solution?, explain?,
    config?: { nCells?: 8, cellDrift?: 4 (m, between the quadrupoles), quadLength?: 0.4 (m), bendAngle?: per-cell total bend in mrad (default 2π/nCells),
              free?: ('kF'|'kD'|'L')[] (default ['kF','kD']), kMax?: 1.5 (m⁻², slider range), kF?, kD?: starting values },
    target: { muDeg?: phase advance per cell in degrees, tune?: ring tune Q, betaMax?: maximum β (m) in x, betaMin?: minimum β (m) in x },
    par: tolerance (relative; 0.03 = 3%, or a percentage above 1) }
  Each target that is given must be met within the tolerance.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { progress } from '$lib/state/progress.svelte';
  import { fodoCell, isStable, oneTurnMatrix, opticsAlong, periodicTwiss, type Element } from '$lib/hep/machine';
  import Slider from '../ui/Slider.svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Verdict from './parts/Verdict.svelte';
  import type { ExerciseBase } from './types';

  interface Spec extends ExerciseBase {
    config?: { nCells?: number; cellDrift?: number; quadLength?: number; bendAngle?: number; free?: string[]; kMax?: number; kF?: number; kD?: number };
    target?: { muDeg?: number; tune?: number; betaMax?: number; betaMin?: number };
    par?: number;
  }
  let { spec }: { spec: Spec } = $props();

  const cfg = spec.config ?? {};
  const nCells = cfg.nCells ?? 8;
  const free = cfg.free ?? ['kF', 'kD'];
  const quadLength = cfg.quadLength ?? 0.4;
  const tol = (spec.par ?? 0.03) > 1 ? (spec.par ?? 3) / 100 : (spec.par ?? 0.03);
  const target = spec.target ?? {};

  let kF = $state(cfg.kF ?? 0.3);
  let kD = $state(cfg.kD ?? 0.3);
  let drift = $state(cfg.cellDrift ?? 4);
  let verdict = $state<{ ok: boolean; msg: string } | null>(null);

  onMount(() => {
    progress.load();
    const d = progress.draft<{ kF: number; kD: number; drift: number } | null>(spec.id, null);
    if (d) { kF = d.kF; kD = d.kD; drift = d.drift; }
  });

  const cell = $derived.by((): Element[] => {
    const bend = ((cfg.bendAngle ?? (2 * Math.PI * 1000) / nCells) / 1000) / 2; // two dipoles per cell
    return fodoCell({ kF, kD, quadLength, gap: drift / 4, nDipoles: 1, dipoleLength: drift / 2, dipoleAngle: bend });
  });
  const M = $derived(oneTurnMatrix(cell));
  const stable = $derived(isStable(M));
  const tw = $derived(periodicTwiss(M));
  const table = $derived(stable ? opticsAlong(cell, 'x', { maxStep: 0.2 }) : null);
  const betaMax = $derived(table ? Math.max(...table.beta) : NaN);
  const betaMin = $derived(table ? Math.min(...table.beta) : NaN);
  const tune = $derived(table ? table.tune * nCells : NaN);
  const muDeg = $derived(stable ? (tw.mu * 180) / Math.PI : NaN);
  const length = $derived(cell.reduce((s, e) => s + ('length' in e ? e.length : 0), 0));

  interface Goal { name: string; value: number; want: number; unit: string; ok: boolean }
  const goals = $derived.by((): Goal[] => {
    const g: Goal[] = [];
    const add = (name: string, value: number, want: number | undefined, unit: string) => {
      if (want === undefined) return;
      g.push({ name, value, want, unit, ok: Number.isFinite(value) && Math.abs(value - want) <= tol * Math.abs(want) });
    };
    add('phase advance per cell', muDeg, target.muDeg, '°');
    add('ring tune Q', tune, target.tune, '');
    add('β max (x)', betaMax, target.betaMax, ' m');
    add('β min (x)', betaMin, target.betaMin, ' m');
    return g;
  });

  function check() {
    progress.saveDraft(spec.id, { kF, kD, drift });
    if (!stable) verdict = { ok: false, msg: `The cell is unstable: |Tr M| = ${Math.abs(tw.trace).toFixed(2)} must be below 2.` };
    else if (goals.some((g) => !g.ok)) verdict = { ok: false, msg: `Stable, but ${goals.filter((g) => !g.ok).map((g) => g.name).join(' and ')} ${goals.filter((g) => !g.ok).length > 1 ? 'are' : 'is'} outside the ${(tol * 100).toFixed(0)}% tolerance.` };
    else {
      verdict = { ok: true, msg: 'Stable, and every target is met.' };
      progress.markSolved(spec.id);
    }
  }

  // β(s) plot
  const W = 520, H = 170, PL = 40, PR = 10, PT = 8, PB = 28;
  const top = $derived(Math.max(10, Math.ceil((Number.isFinite(betaMax) ? betaMax : 10) / 5) * 5, target.betaMax ? target.betaMax * 1.2 : 0));
  const sx = (s: number) => PL + (s / length) * (W - PL - PR);
  const sy = (b: number) => PT + (1 - b / top) * (H - PT - PB);
  const path = $derived(table ? table.s.map((s, i) => `${i ? 'L' : 'M'}${sx(s).toFixed(1)} ${sy(table.beta[i]!).toFixed(1)}`).join('') : '');
  const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '–');
</script>

<ExerciseFrame id={spec.id} kind="Lattice" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? (spec.hint ? [spec.hint] : [])} solution={spec.solution}>
  <p class="goal ui">
    A ring of <strong>{nCells}</strong> identical cells (focusing quad, bend, defocusing quad, bend; {f(length, 1)} m long). Targets, each within {(tol * 100).toFixed(0)}%:
    {#each goals as g, i}{i ? '; ' : ' '}{g.name} = {g.want}{g.unit}{/each}.
  </p>
  <div class="ctl ui">
    {#if free.includes('kF')}<Slider bind:value={kF} min={0.01} max={cfg.kMax ?? 1.5} step={0.01} labelHtml="Focusing quad strength k<sub>F</sub> [m⁻²]" />{/if}
    {#if free.includes('kD')}<Slider bind:value={kD} min={0.01} max={cfg.kMax ?? 1.5} step={0.01} labelHtml="Defocusing quad strength k<sub>D</sub> [m⁻²]" />{/if}
    {#if free.includes('L')}<Slider bind:value={drift} min={1} max={12} step={0.1} label="Space between the quadrupoles [m]" />{/if}
  </div>
  <div class="verdictline ui" class:ok={stable} class:bad={!stable} role="status" aria-live="polite">
    <strong>{stable ? '✓ Stable' : '✗ Unstable'}</strong> |Tr M| = {f(Math.abs(tw.trace), 3)} (must be below 2)
    {#if stable} · μ = {f(muDeg, 1)}° · Q = {f(tune, 3)} · β<sub>max</sub> = {f(betaMax, 1)} m · β<sub>min</sub> = {f(betaMin, 1)} m{/if}
  </div>
  <ul class="goals ui">
    {#each goals as g}<li class:ok={g.ok}>{g.ok ? '✓' : '✗'} {g.name}: {f(g.value, 2)}{g.unit} (target {g.want}{g.unit})</li>{/each}
  </ul>
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Horizontal beta function over one cell">
    {#each [0, 0.5, 1] as t}
      <line x1={PL} x2={W - PR} y1={sy(t * top)} y2={sy(t * top)} class="grid" />
      <text x={PL - 5} y={sy(t * top)} dy="0.32em" text-anchor="end" class="tick">{(t * top).toFixed(0)}</text>
    {/each}
    {#if target.betaMax}<line x1={PL} x2={W - PR} y1={sy(target.betaMax)} y2={sy(target.betaMax)} class="tgt" />{/if}
    {#if target.betaMin}<line x1={PL} x2={W - PR} y1={sy(target.betaMin)} y2={sy(target.betaMin)} class="tgt" />{/if}
    {#if stable}<path d={path} class="curve" />{:else}<text x={W / 2} y={H / 2} text-anchor="middle" class="warn">unstable: no β function</text>{/if}
    <text x={(PL + W - PR) / 2} y={H - 6} text-anchor="middle" class="tick">s along one cell [m] · dashed: targets</text>
  </svg>
  <div class="ui"><button type="button" class="check" onclick={check}>Check</button></div>
  {#if verdict}<Verdict ok={verdict.ok}>{verdict.msg}</Verdict>{#if verdict.ok && spec.explain}<div class="explain">{@html spec.explain}</div>{/if}{/if}
</ExerciseFrame>

<style>
  .goal {
    font-size: 0.88rem;
    margin: 0 0 0.6rem;
  }
  .ctl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.5rem;
    margin-bottom: 0.6rem;
  }
  .verdictline {
    padding: 0.4rem 0.7rem;
    border-left: 4px solid var(--line-strong);
    border-radius: 5px;
    font-size: 0.84rem;
    margin-bottom: 0.4rem;
  }
  .verdictline.ok {
    border-color: var(--ok);
    background: var(--ok-soft);
  }
  .verdictline.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .goals {
    list-style: none;
    margin: 0 0 0.5rem;
    padding: 0;
    font-size: 0.82rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1.2rem;
  }
  .goals li {
    color: var(--bad);
  }
  .goals li.ok {
    color: var(--ok);
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    margin-bottom: 0.6rem;
  }
  .grid {
    stroke: var(--grid);
  }
  .tick {
    fill: var(--ink-3);
    font-size: 10.5px;
  }
  .curve {
    fill: none;
    stroke: var(--series-1);
    stroke-width: 2.2;
  }
  .tgt {
    stroke: var(--sig-high);
    stroke-dasharray: 5 4;
    stroke-width: 1.5;
  }
  .warn {
    fill: var(--bad);
    font-size: 13px;
  }
  .check {
    border: 1px solid var(--accent);
    background: var(--accent-soft);
    color: var(--accent-ink);
    border-radius: var(--radius-sm);
    padding: 0.3rem 1rem;
    font: inherit;
    font-weight: 700;
    min-height: 2.3rem;
    cursor: pointer;
  }
  .check:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .explain {
    margin-top: 0.6rem;
    font-family: var(--font-body);
  }
</style>
