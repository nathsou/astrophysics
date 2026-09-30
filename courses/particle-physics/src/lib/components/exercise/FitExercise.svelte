<!--
  The fit exercise: fit a model to a histogram, in the browser, with the course's analysis library (`hep/analysis`: Poisson maximum likelihood, the
  quasi-Newton minimiser). The reader picks the signal and background shapes (and, if the spec allows, the fit range and method), presses Fit, reads the
  parameters with their errors, the χ² and the pulls, and submits. It passes when the fitted parameter is within `tolerance` of `answer` (and, if
  `config.minPValue` is set, the model describes the data).

  Spec: { id, title, prompt, hints?, solution?, explain?,
    model: 'gauss+exp',                      the default model: signal shape + background shape (gauss, cb, bw, bwrel; exp, flat, cheb1…8, bern1…8)
    data: { seed?, range: [lo, hi], bins?, model?, truth: { 'sig.yield': 400, 'sig.mean': 125, … }, xLabel?, unit? }   toy data from the true model (default `model`)
          | { range, counts: [ … ] }        or explicit counts
    config?: { backgrounds?: string[], signals?: string[], parameter?: 'sig.yield', rangeEditable?: boolean, methods?: ['nll','chi2'], minPValue?: number, start?: {name: value} },
    tolerance?: number (relative, default 0.05) | { abs: number },
    answer: number | { 'sig.yield': 312, … } }
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { progress } from '$lib/state/progress.svelte';
  import HepHist from '$lib/charts/HepHist.svelte';
  import { buildFitProblem, checkFit, runExerciseFit, type FitChoice, type FitProblem, type FitSpecData } from '$lib/sims/stats/exercises';
  import type { FitResult, Model } from '$lib/hep/analysis';
  import Slider from '../ui/Slider.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Verdict from './parts/Verdict.svelte';
  import type { ExerciseBase } from './types';

  interface Spec extends ExerciseBase, FitSpecData {}
  let { spec }: { spec: Spec } = $props();

  let problem = $state<FitProblem | null>(null);
  let failed = $state<string | null>(null);
  let signal = $state('gauss');
  let background = $state('exp');
  let method = $state<'nll' | 'chi2'>('nll');
  let rangeLo = $state(0);
  let rangeHi = $state(1);
  let fitted = $state<{ fit: FitResult; model: Model; choice: FitChoice } | null>(null);
  let verdict = $state<{ ok: boolean; msg: string } | null>(null);
  let busy = $state(false);

  onMount(() => {
    progress.load();
    try {
      const p = buildFitProblem(spec);
      problem = p;
      signal = p.signals[0]!;
      background = p.backgrounds[0]!;
      method = p.methods[0]!;
      [rangeLo, rangeHi] = p.range;
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e);
    }
  });

  const edges = $derived(problem ? Array.from(problem.hist.edges) : []);
  const counts = $derived(problem ? Array.from(problem.hist.counts) : []);
  const inRange = (c: FitChoice | null) => (c ? c.range : (problem?.range ?? [0, 1]));
  const curve = $derived(fitted ? fitted.model.binned(fitted.fit.params, edges) : null);
  const bkgCurve = $derived(fitted ? fitted.model.componentBinned(fitted.fit.params, edges)[1]! : null);
  const ymax = $derived(Math.max(1, ...counts, ...(curve ?? [])) * 1.15);
  const fmt = (x: number) => Number(x.toPrecision(4)).toString();
  const fitRange = $derived(inRange(fitted?.choice ?? null));

  function choice(): FitChoice {
    return { signal, background, range: [rangeLo, rangeHi], method };
  }
  function doFit(): boolean {
    if (!problem) return false;
    busy = true;
    try {
      const c = choice();
      const r = runExerciseFit(problem, c);
      fitted = { ...r, choice: c };
      verdict = null;
      return true;
    } catch (e) {
      verdict = { ok: false, msg: `The fit failed: ${e instanceof Error ? e.message : String(e)}` };
      return false;
    } finally {
      busy = false;
    }
  }
  function submit() {
    if (!problem) return;
    // Submit what is on the screen: re-fit if the choices changed since the last fit.
    const c = choice();
    const same = fitted && fitted.choice.signal === c.signal && fitted.choice.background === c.background && fitted.choice.method === c.method && fitted.choice.range[0] === c.range[0] && fitted.choice.range[1] === c.range[1];
    if (!same && !doFit()) return;
    if (!fitted) return;
    const r = checkFit(spec, problem, fitted.fit);
    verdict = { ok: r.ok, msg: r.message };
    if (r.ok) progress.markSolved(spec.id);
  }
  const SHAPES: Record<string, string> = { gauss: 'Gaussian', cb: 'Crystal Ball', bw: 'Breit–Wigner', bwrel: 'rel. Breit–Wigner', exp: 'exponential', flat: 'flat', cheb1: 'Chebyshev 1', cheb2: 'Chebyshev 2', cheb3: 'Chebyshev 3', cheb4: 'Chebyshev 4', bern2: 'Bernstein 2', bern3: 'Bernstein 3' };
  const nameOf = (k: string) => SHAPES[k] ?? k;
</script>

<ExerciseFrame id={spec.id} kind="Fit" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? (spec.hint ? [spec.hint] : [])} solution={spec.solution}>
  {#if failed}
    <p class="ex-bad ui">This exercise is misconfigured: {failed}</p>
  {:else if !problem}
    <p class="ui" role="status">Preparing the data…</p>
  {:else}
    <div class="choices ui">
      {#if problem.signals.length > 1}<Segmented label="Signal shape" size="sm" bind:value={signal} options={problem.signals.map((s) => ({ value: s, label: nameOf(s) }))} />{/if}
      {#if problem.backgrounds.length > 1}<Segmented label="Background shape" size="sm" bind:value={background} options={problem.backgrounds.map((s) => ({ value: s, label: nameOf(s) }))} />{/if}
      {#if problem.methods.length > 1}<Segmented label="Method" size="sm" bind:value={method} options={problem.methods.map((m) => ({ value: m, label: m === 'nll' ? 'Poisson likelihood' : 'χ²' }))} />{/if}
    </div>
    {#if problem.rangeEditable}
      <div class="range ui">
        <Slider bind:value={rangeLo} min={problem.range[0]} max={problem.range[1]} step={(problem.range[1] - problem.range[0]) / problem.hist.nbins} label="Fit range: from" format={fmt} compact />
        <Slider bind:value={rangeHi} min={problem.range[0]} max={problem.range[1]} step={(problem.range[1] - problem.range[0]) / problem.hist.nbins} label="to" format={fmt} compact />
      </div>
    {/if}
    <HepHist
      series={[
        ...(bkgCurve ? [{ edges, counts: bkgCurve, label: 'fitted background', color: 'var(--series-2)' }] : []),
        ...(curve ? [{ edges, counts: curve, label: 'fit', color: 'var(--series-3)' }] : []),
        { edges, counts, label: 'data', points: true, errors: true, color: 'var(--series-1)' },
      ]}
      x={{ domain: problem.range, label: problem.xLabel }}
      y={{ domain: [0, ymax], label: `Events per ${fmt((problem.range[1] - problem.range[0]) / problem.hist.nbins)} ${problem.unit}`.trim() }}
      markers={fitted && (fitRange[0] > problem.range[0] || fitRange[1] < problem.range[1]) ? [{ x: fitRange[0], label: 'fit range', color: 'var(--mute)' }, { x: fitRange[1], label: '', color: 'var(--mute)' }] : []}
      height={250}
      label="Histogram of the data with the fitted model"
    />

    <div class="ex-bar ui">
      <button type="button" onclick={doFit} disabled={busy}>Fit {nameOf(signal)} + {nameOf(background)}</button>
      <button type="button" class="check" onclick={submit}>Submit the fitted {problem.parameter}</button>
    </div>

    {#if fitted}
      <div class="res ui" aria-live="polite">
        <table>
          <thead><tr><th>Parameter</th><th>Fitted</th><th>±</th></tr></thead>
          <tbody>
            {#each fitted.fit.names as nm, i}
              <tr class:target={nm === problem.parameter}><th scope="row">{nm}</th><td>{fmt(fitted.fit.params[i]!)}</td><td>{Number.isFinite(fitted.fit.errors[i]!) ? fmt(fitted.fit.errors[i]!) : 'n/a'}</td></tr>
            {/each}
          </tbody>
        </table>
        <p class="q">
          {fitted.fit.converged ? 'Converged' : 'Did not converge'}. {fitted.choice.method === 'nll' ? 'Baker–Cousins χ²' : 'χ² (errors √n)'} = {fmt(fitted.fit.chi2)} for {fitted.fit.ndf} degrees of freedom,
          p = {Number.isFinite(fitted.fit.pValue) ? (fitted.fit.pValue < 0.001 ? fitted.fit.pValue.toExponential(1) : fitted.fit.pValue.toFixed(3)) : 'n/a'}.
          {#if Number.isFinite(fitted.fit.pValue) && fitted.fit.pValue < 0.01}The model does not describe the data well; look at the pulls and try another shape.{/if}
        </p>
        <svg class="pulls" viewBox="0 0 {fitted.fit.pulls.length * 8} 50" role="img" aria-label="Pulls of the fit">
          <line x1="0" x2={fitted.fit.pulls.length * 8} y1="25" y2="25" stroke="var(--line-strong)" />
          {#each fitted.fit.pulls as pv, i}
            {@const h = Math.max(-23, Math.min(23, pv * 7))}
            <rect x={i * 8 + 1} width="6" y={h >= 0 ? 25 - h : 25} height={Math.abs(h)} fill={Math.abs(pv) > 3 ? 'var(--bad)' : Math.abs(pv) > 2 ? 'var(--maybe)' : 'var(--series-8)'} />
          {/each}
        </svg>
      </div>
    {/if}
    {#if verdict}<Verdict ok={verdict.ok}>{verdict.msg}</Verdict>{#if verdict.ok && spec.explain}<div class="explain">{@html spec.explain}</div>{/if}{/if}
  {/if}
</ExerciseFrame>

<style>
  @import './parts/exercise.css';
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.2rem;
    margin-bottom: 0.6rem;
  }
  .range {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.2rem;
    margin-bottom: 0.5rem;
  }
  .ex-bar {
    margin: 0.6rem 0;
  }
  .res table {
    border-collapse: collapse;
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
  }
  .res th,
  .res td {
    padding: 0.15rem 0.9rem 0.15rem 0;
    text-align: right;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
  }
  .res th:first-child {
    text-align: left;
    color: var(--ink-2);
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .res tr.target th,
  .res tr.target td {
    color: var(--accent-ink);
    font-weight: 700;
  }
  .q {
    margin: 0.5rem 0 0.3rem;
    font-size: 0.84rem;
  }
  .pulls {
    width: 100%;
    max-width: 40rem;
    height: 48px;
    display: block;
  }
  .explain {
    margin-top: 0.5rem;
    font-size: 0.95rem;
  }
</style>
