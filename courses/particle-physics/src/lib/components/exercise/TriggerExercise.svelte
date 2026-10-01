<!--
  The trigger exercise: design a menu that keeps the signal inside a rate budget. The reader sets the threshold and prescale of each item
  of a small catalogue (hep/trigger `MENU_KINDS`) and the exercise measures, on seeded toy samples, the Level-1 and HLT rates against
  the budget and the efficiency for the named signal samples. It passes when the budget is respected and the mean signal efficiency beats `par`.

  Spec: { id, title, prompt, hints?, solution?, explain?,
    config?: { lumi?: number (10³⁴ cm⁻² s⁻¹, default 2), items?: string[] (catalogue keys offered; default all), n?: events per sample (default 800), seed? },
    budget: number (the HLT output in Hz) | { hltHz?: number; l1Hz?: number },
    sample: string | string[] (the signal sample keys scored: zmumu, wlnu, hgg, h4l, ttbar, susy, bmumu),
    par: number (required mean efficiency, 0–1, or a percentage above 1) }
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { progress } from '$lib/state/progress.svelte';
  import { loadToyModel, type ToyModel } from '$lib/sims/machine/samples';
  import { fmtPct, fmtRate } from '$lib/sims/machine/fmt';
  import Slider from '../ui/Slider.svelte';
  import Toggle from '../ui/Toggle.svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Verdict from './parts/Verdict.svelte';
  import {
    DEFAULT_BUDGET, MENU_KINDS, PRESCALES, SETTING_RANGES, TOY_SAMPLES, hltThresholdFor, makeSetting, scoreReport, startSettings, type ItemSetting,
  } from '$lib/hep/trigger';
  import type { ExerciseBase } from './types';

  interface Spec extends ExerciseBase {
    config?: { lumi?: number; items?: string[]; n?: number; seed?: number };
    budget?: number | { hltHz?: number; l1Hz?: number };
    sample?: string | string[];
    par?: number;
  }
  let { spec }: { spec: Spec } = $props();

  const lumi = spec.config?.lumi ?? 2;
  const keys = (spec.config?.items ?? MENU_KINDS.map((k) => k.key)).filter((k) => MENU_KINDS.some((m) => m.key === k));
  const budget = typeof spec.budget === 'number' ? { l1Hz: DEFAULT_BUDGET.l1Hz, hltHz: spec.budget } : { l1Hz: spec.budget?.l1Hz ?? DEFAULT_BUDGET.l1Hz, hltHz: spec.budget?.hltHz ?? DEFAULT_BUDGET.hltHz };
  const wanted = Array.isArray(spec.sample) ? spec.sample : spec.sample ? [spec.sample] : ['hgg'];
  const par = (spec.par ?? 0.8) > 1 ? (spec.par ?? 80) / 100 : (spec.par ?? 0.8);
  const label = (k: string) => TOY_SAMPLES.find((t) => t.key === k)?.label ?? k;

  let model = $state<ToyModel | null>(null);
  let settings = $state<ItemSetting[]>(startSettings().filter((s) => keys.includes(s.key)));
  let verdict = $state<{ ok: boolean; msg: string } | null>(null);
  let mounted = $state(false);

  onMount(async () => {
    progress.load();
    const saved = progress.draft<ItemSetting[] | null>(spec.id, null);
    if (saved && saved.length === settings.length) settings = saved;
    mounted = true;
    model = await loadToyModel(spec.config?.n ?? 800, spec.config?.seed ?? 1);
  });

  const report = $derived(model ? model.evaluator.evaluate(settings, lumi * 1e34) : null);
  const score = $derived(report ? scoreReport(report, budget, wanted) : null);
  const meanEff = $derived(score ? score.score / 100 : 0);
  const effs = $derived(score ? score.samples.filter((s) => wanted.includes(s.key)) : []);

  function setThreshold(i: number, v: number) {
    const s = settings[i]!;
    s.l1Threshold = v;
    s.hltThreshold = hltThresholdFor(s.key, v);
  }
  function check() {
    if (!score || !report) return;
    progress.saveDraft(spec.id, $state.snapshot(settings));
    if (score.overL1 || score.overHlt) {
      verdict = { ok: false, msg: `Over budget: ${score.overL1 ? `Level 1 ${fmtRate(report.l1Total)} (limit ${fmtRate(budget.l1Hz)})` : `HLT ${fmtRate(report.hltTotal * score.l1Factor)} (limit ${fmtRate(budget.hltHz)})`}.` };
    } else if (meanEff < par) {
      verdict = { ok: false, msg: `Within budget, but the signal efficiency is ${fmtPct(meanEff)}, below the ${fmtPct(par)} required.` };
    } else {
      verdict = { ok: true, msg: `Within budget with ${fmtPct(meanEff)} of the signal kept (required ${fmtPct(par)}).` };
      progress.markSolved(spec.id);
    }
  }
  const bar = (x: number, b: number) => Math.min(100, (x / b) * 100);
  void makeSetting;
  void SETTING_RANGES;
</script>

<ExerciseFrame id={spec.id} kind="Trigger" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? (spec.hint ? [spec.hint] : [])} solution={spec.solution}>
  <p class="goal ui">
    Keep at least <strong>{fmtPct(par)}</strong> of {wanted.map(label).join(' and ')}, with Level 1 under <strong>{fmtRate(budget.l1Hz)}</strong> and the HLT under
    <strong>{fmtRate(budget.hltHz)}</strong>, at {lumi.toFixed(1)} × 10³⁴ cm⁻² s⁻¹.
  </p>
  {#if !model || !report || !score}
    <p class="ui" role="status">Generating toy collisions…</p>
  {:else}
    <ul class="items">
      {#each settings as s, i (s.key)}
        {@const k = MENU_KINDS.find((m) => m.key === s.key)!}
        {@const rg = SETTING_RANGES[s.key]!}
        {@const r = report.items.find((x) => x.name === s.key)}
        <li class="item ui" class:off={s.enabled === false}>
          <Toggle checked={s.enabled !== false} label={k.label} onchange={(v) => (s.enabled = v)} />
          <Slider value={s.l1Threshold} min={rg.min} max={rg.max} step={rg.step} label="Threshold [GeV]" oninput={(v) => setThreshold(i, v)} format={(v) => v.toFixed(v % 1 ? 1 : 0)} compact />
          <label class="ps"><span>Prescale</span>
            <select bind:value={s.prescale} aria-label="{k.label}: prescale">{#each PRESCALES as p}<option value={p}>{p === 1 ? 'none' : `1 in ${p}`}</option>{/each}</select>
          </label>
          <span class="r">{r && s.enabled !== false ? `${fmtRate(r.l1Rate)} → ${fmtRate(r.hltRate)}` : 'off'}</span>
        </li>
      {/each}
    </ul>
    <div class="meters ui" role="status" aria-live="polite">
      <div class:over={score.overL1}><span>Level 1</span><span class="m"><span style="width:{bar(report.l1Total, budget.l1Hz)}%"></span></span><strong>{fmtRate(report.l1Total)}</strong> {score.overL1 ? '✗' : '✓'}</div>
      <div class:over={score.overHlt}><span>HLT</span><span class="m"><span style="width:{bar(report.hltTotal * score.l1Factor, budget.hltHz)}%"></span></span><strong>{fmtRate(report.hltTotal * score.l1Factor)}</strong> {score.overHlt ? '✗' : '✓'}</div>
      {#each effs as e}
        <div class:over={e.effective < par}><span>{e.label}</span><span class="m"><span style="width:{e.effective * 100}%"></span></span><strong>{fmtPct(e.effective)}</strong> {e.effective >= par ? '✓' : '✗'}</div>
      {/each}
    </div>
    <div class="ui"><button type="button" class="check" onclick={check}>Check</button></div>
    {#if verdict}<Verdict ok={verdict.ok}>{verdict.msg}</Verdict>{#if verdict.ok && spec.explain}<div class="explain">{@html spec.explain}</div>{/if}{/if}
  {/if}
</ExerciseFrame>

<style>
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
  .goal {
    font-size: 0.88rem;
    margin: 0 0 0.6rem;
  }
  .items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .item {
    display: grid;
    grid-template-columns: minmax(9rem, 1.2fr) minmax(9rem, 1.5fr) auto minmax(7rem, auto);
    gap: 0.4rem 0.8rem;
    align-items: end;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--surface);
  }
  @media (max-width: 640px) {
    .item {
      grid-template-columns: 1fr 1fr;
    }
  }
  .item.off {
    opacity: 0.6;
  }
  .ps {
    display: flex;
    flex-direction: column;
    font-size: 0.72rem;
    color: var(--mute);
  }
  .ps select {
    font: inherit;
    font-size: 0.82rem;
    background: var(--panel);
    color: var(--fg);
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    padding: 0.25rem;
  }
  .r {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    text-align: right;
    color: var(--ink-2);
  }
  .meters {
    margin: 0.7rem 0 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.82rem;
  }
  .meters > div {
    display: grid;
    grid-template-columns: 7.5rem 1fr 5rem 1.2rem;
    gap: 0.5rem;
    align-items: center;
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
    background: var(--ok);
  }
  .over .m > span {
    background: var(--bad);
  }
  .over strong {
    color: var(--bad);
  }
  .explain {
    margin-top: 0.6rem;
    font-family: var(--font-body);
  }
</style>
