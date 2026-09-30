<!--
  The cuts exercise: choose selection cuts on a toy sample (generated in the browser from simple distributions, with a fixed seed) to maximise the
  expected significance Z = √(2((s + b) ln(1 + s/b) − s)). It passes when Z reaches `par`. The reader sees the distribution of each variable for the signal and
  the background, sets the cuts with sliders, and reads s, b, Z and the cutflow live.

  Spec: { id, title, prompt, hints?, solution?, explain?,
    config: { seed?, signal: { events, yield, vars: { name: dist } }, background: { events, yield, vars }, bkgRelUnc?, minBkgEvents? },
            dist = { dist: 'normal', mean, sigma, min?, max? } | { dist: 'exponential', mean, offset?, min?, max? } | { dist: 'uniform', lo, hi }
                   | { dist: 'lognormal', mu, sigma } | { dist: 'halfnormal', sigma, offset? };  `events` are generated, `yield` the expected number before cuts,
    variables: [{ name, label?, unit?, kind: 'window' | 'min' | 'max', lo, hi, step? }]   (what may be cut, and the slider range)
    par: number | 'auto'   (the significance to beat; 'auto' or absent: 0.9 × the optimum found by the library's `selectionOptimiser`) }
  `sample` is accepted in place of `config`.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { progress } from '$lib/state/progress.svelte';
  import HepHist from '$lib/charts/HepHist.svelte';
  import { Hist1D } from '$lib/hep/analysis';
  import { buildCutsProblem, checkCuts, cutflowRows, defaultCutState, evaluateCuts, parFor, type CutState, type CutsProblem, type CutsSpecData } from '$lib/sims/stats/exercises';
  import Slider from '../ui/Slider.svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Verdict from './parts/Verdict.svelte';
  import type { ExerciseBase } from './types';

  interface Spec extends ExerciseBase, CutsSpecData {}
  let { spec }: { spec: Spec } = $props();

  let problem = $state<CutsProblem | null>(null);
  let failed = $state<string | null>(null);
  let cuts = $state<CutState>({});
  let par = $state<number | null>(null);
  let verdict = $state<{ ok: boolean; msg: string } | null>(null);
  let best = $state(0);

  onMount(() => {
    progress.load();
    try {
      const p = buildCutsProblem(spec);
      problem = p;
      const fresh = defaultCutState(p.variables);
      const saved = progress.draft<CutState | null>(spec.id, null);
      cuts = saved && p.variables.every((v) => saved[v.name]) ? saved : fresh;
      if (p.par !== undefined) par = p.par;
      else setTimeout(() => (par = parFor(p)), 20);
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e);
    }
  });

  const sel = $derived(problem ? evaluateCuts(problem, cuts) : null);
  const none = $derived(problem ? evaluateCuts(problem, defaultCutState(problem.variables)) : null);
  const rows = $derived(problem ? cutflowRows(problem, cuts) : []);
  $effect(() => {
    if (sel && Number.isFinite(sel.z) && problem && sel.nBkg >= problem.minBkgEvents) best = Math.max(best, sel.z);
  });

  function set(name: string, which: 0 | 1, v: number) {
    const cur = cuts[name] ?? [0, 0];
    const next: [number, number] = which === 0 ? [v, cur[1]] : [cur[0], v];
    cuts = { ...cuts, [name]: next };
    verdict = null;
  }
  function reset() {
    if (problem) cuts = defaultCutState(problem.variables);
    verdict = null;
  }
  function check() {
    if (!problem || par === null) return;
    progress.saveDraft(spec.id, $state.snapshot(cuts));
    const r = checkCuts(problem, cuts, par);
    verdict = { ok: r.ok, msg: r.message };
    if (r.ok) progress.markSolved(spec.id);
  }

  // One normalised histogram pair per variable.
  const NBINS = 40;
  const hists = $derived.by(() => {
    if (!problem) return [];
    return problem.variables.map((v) => {
      const edges = Array.from({ length: NBINS + 1 }, (_, i) => v.lo + ((v.hi - v.lo) * i) / NBINS);
      const make = (col: ArrayLike<number>, n: number) => {
        const h = new Hist1D(edges);
        for (let i = 0; i < n; i++) h.fill(col[i]!);
        return h.normalise(1).counts;
      };
      const s = make(problem!.sig.columns[v.name]!, problem!.sig.n);
      const b = make(problem!.bkg.columns[v.name]!, problem!.bkg.n);
      return { edges, s: Array.from(s), b: Array.from(b), top: Math.max(...s, ...b) * 1.15 };
    });
  });
  const fmt = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toPrecision(3));
  const pct = $derived(par && sel ? Math.min(100, (100 * Math.max(0, sel.z)) / par) : 0);
</script>

<ExerciseFrame id={spec.id} kind="Cuts" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? (spec.hint ? [spec.hint] : [])} solution={spec.solution}>
  {#if failed}
    <p class="ex-bad ui">This exercise is misconfigured: {failed}</p>
  {:else if !problem || !sel || !none}
    <p class="ui" role="status">Generating the toy sample…</p>
  {:else}
    <p class="goal ui">
      Choose cuts so that the expected significance reaches <strong>{par === null ? '…' : `${par.toFixed(2)}σ`}</strong>. With no cuts it is {none.z.toFixed(2)}σ
      ({fmt(none.s)} signal and {fmt(none.b)} background events expected).
    </p>
    <div class="vars">
      {#each problem.variables as v, i (v.name)}
        {@const c = cuts[v.name] ?? [v.lo, v.hi]}
        {@const h = hists[i]}
        <section class="var" aria-label="Cut on {v.label ?? v.name}">
          <h5 class="ui">{v.label ?? v.name}{v.unit ? ` [${v.unit}]` : ''}</h5>
          {#if h}
            <HepHist
              series={[
                { edges: h.edges, counts: h.b, label: 'background', color: 'var(--series-8)', fill: true },
                { edges: h.edges, counts: h.s, label: 'signal', color: 'var(--sig-high)' },
              ]}
              x={{ domain: [v.lo, v.hi], label: `${v.label ?? v.name}${v.unit ? ` [${v.unit}]` : ''}` }}
              y={{ domain: [0, h.top], label: 'Fraction per bin' }}
              markers={[...(v.kind !== 'max' && c[0] > v.lo ? [{ x: c[0], label: '', color: 'var(--track)' }] : []), ...(v.kind !== 'min' && c[1] < v.hi ? [{ x: c[1], label: '', color: 'var(--track)' }] : [])]}
              height={170}
              legend={i === 0}
              label="Normalised distributions of {v.label ?? v.name} for signal and background, with the cut positions"
            />
          {/if}
          <div class="sliders">
            {#if v.kind !== 'max'}
              <Slider value={c[0]} min={v.lo} max={v.hi} step={v.step ?? (v.hi - v.lo) / 200} label={v.kind === 'window' ? 'Keep above' : 'Keep at or above'} oninput={(x) => set(v.name, 0, x)} format={(x) => fmt(x)} compact />
            {/if}
            {#if v.kind !== 'min'}
              <Slider value={c[1]} min={v.lo} max={v.hi} step={v.step ?? (v.hi - v.lo) / 200} label={v.kind === 'window' ? 'Keep below' : 'Keep at or below'} oninput={(x) => set(v.name, 1, x)} format={(x) => fmt(x)} compact />
            {/if}
          </div>
        </section>
      {/each}
    </div>

    <div class="meter ui" role="status" aria-live="polite">
      <span>Expected significance</span>
      <span class="m"><span style="width:{pct}%"></span></span>
      <strong>{Number.isFinite(sel.z) ? sel.z.toFixed(2) : '∞'}σ</strong>
      <span>{par !== null && sel.z >= par && sel.nBkg >= problem.minBkgEvents ? '✓' : ''}</span>
    </div>

    <table class="flow ui">
      <caption class="sr">Cutflow</caption>
      <thead><tr><th>After</th><th>Signal s</th><th>Background b</th><th>Z</th></tr></thead>
      <tbody>
        {#each rows as r}
          <tr><th scope="row">{r.name}</th><td>{fmt(r.s)}</td><td>{fmt(r.b)}</td><td>{Number.isFinite(r.z) ? r.z.toFixed(2) : '∞'}σ</td></tr>
        {/each}
      </tbody>
    </table>
    {#if sel.nBkg < problem.minBkgEvents}<p class="ex-bad ui">Only {sel.nBkg} simulated background events survive: too few to trust b. Loosen a cut.</p>{/if}

    <div class="ex-bar ui">
      <button type="button" class="check" onclick={check} disabled={par === null}>Check</button>
      <button type="button" onclick={reset}>Remove all cuts</button>
      {#if best > 0}<span class="ex-note ui">Best so far: {best.toFixed(2)}σ</span>{/if}
    </div>
    {#if verdict}<Verdict ok={verdict.ok}>{verdict.msg}</Verdict>{#if verdict.ok && spec.explain}<div class="explain">{@html spec.explain}</div>{/if}{/if}
  {/if}
</ExerciseFrame>

<style>
  @import './parts/exercise.css';
  .goal {
    font-size: 0.9rem;
    margin: 0 0 0.6rem;
  }
  .vars {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
    gap: 0.8rem;
  }
  .var {
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.5rem 0.65rem 0.6rem;
    background: var(--surface);
    min-width: 0;
  }
  h5 {
    margin: 0 0 0.3rem;
    font-size: 0.82rem;
    font-weight: 700;
    text-transform: none;
    letter-spacing: 0;
  }
  .sliders {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1rem;
    margin-top: 0.3rem;
  }
  .meter {
    display: grid;
    grid-template-columns: 9rem 1fr 4.5rem 1.2rem;
    gap: 0.5rem;
    align-items: center;
    margin: 0.8rem 0 0.4rem;
    font-size: 0.84rem;
  }
  @media (max-width: 520px) {
    .meter {
      grid-template-columns: 6rem 1fr 4rem 1rem;
    }
  }
  .m {
    display: block;
    height: 8px;
    background: var(--surface-3);
    border-radius: 99px;
    overflow: hidden;
  }
  .m > span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
  .flow {
    border-collapse: collapse;
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
    margin: 0.4rem 0 0.7rem;
  }
  .flow th,
  .flow td {
    padding: 0.15rem 0.9rem 0.15rem 0;
    text-align: right;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
  }
  .flow th:first-child {
    text-align: left;
    color: var(--ink-2);
  }
  .sr {
    position: absolute;
    left: -9999px;
  }
  .explain {
    margin-top: 0.5rem;
    font-size: 0.95rem;
  }
</style>
