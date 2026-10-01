<!--
  The trigger game: 40 million bunch crossings a second come in, about a thousand events a second can be written out. Set the thresholds and
  prescales of a menu of eight trigger items and see the rate each one costs against the budgets, how much of each kind of physics survives,
  and what you threw away. The events are toy samples generated in code from simple distributions (see hep/trigger/toy.ts); the trigger
  logic is the library's (`l1Variables`, the HLT selections, `CatalogueEvaluator`).

    ::trigger-game{n="27.4" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import {
    DEFAULT_BUDGET, MENU_KINDS, PRESCALES, SETTING_RANGES, TOY_SAMPLES, hltThresholdFor, looseSettings, scoreReport, startSettings, suggestedSettings,
    type ItemSetting,
  } from '$lib/hep/trigger';
  import { loadToyModel, type ToyModel } from './samples';
  import { fmtCount, fmtPct, fmtRate } from './fmt';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let model = $state<ToyModel | null>(null);
  let progress = $state(0);
  let settings = $state<ItemSetting[]>(startSettings());
  let lumi = $state(2);

  onMount(async () => {
    model = await loadToyModel(1200, 1, undefined, (f) => (progress = f));
  });

  const report = $derived(model ? model.evaluator.evaluate(settings, lumi * 1e34) : null);
  const score = $derived(report ? scoreReport(report, DEFAULT_BUDGET) : null);
  const suggestedScore = $derived.by(() => (model ? scoreReport(model.evaluator.evaluate(suggestedSettings(), lumi * 1e34), DEFAULT_BUDGET).score : null));

  const INV_FB = 100; // fb⁻¹
  /** Fraction of each sample's events that are in the detector's acceptance (the events an analysis can use). */
  const fidFraction = $derived.by(() => {
    const out: Record<string, number> = {};
    if (!model) return out;
    for (const s of model.samples) {
      let sw = 0, sf = 0, any = false;
      for (const e of s.events) { const w = e.weight ?? 1; sw += w; if (e.fiducial !== undefined) any = true; if (e.fiducial !== false) sf += w; }
      out[s.name] = any && sw > 0 ? sf / sw : 1;
    }
    return out;
  });

  function setThreshold(i: number, v: number) {
    const s = settings[i]!;
    s.l1Threshold = v;
    s.hltThreshold = hltThresholdFor(s.key, v);
  }
  const reset = (s: ItemSetting[]) => { settings = s; };

  const info = (key: string) => TOY_SAMPLES.find((t) => t.key === key)!;
  const kindOf = (key: string) => MENU_KINDS.find((k) => k.key === key)!;
  const unitOf = (key: string) => (key === 'HT' ? 'GeV (sum)' : 'GeV');
  const itemRate = (key: string) => report?.items.find((i) => i.name === key);

  const signals = $derived(score ? score.samples.filter((s) => s.role === 'signal').sort((a, b) => b.importance - a.importance || a.key.localeCompare(b.key)) : []);
  const backgrounds = $derived(score ? score.samples.filter((s) => s.role === 'background') : []);
  const worst = $derived(signals.filter((s) => s.effective < 0.5 && s.importance >= 2));
  const lostCount = (key: string, eff: number) => info(key).sigmaPb * INV_FB * 1e3 * (fidFraction[key] ?? 1) * (1 - eff);
  const producedCount = (key: string) => info(key).sigmaPb * INV_FB * 1e3 * (fidFraction[key] ?? 1);
  const sampleRate = (key: string) => report?.samples.find((s) => s.name === key);

  const bar = (x: number, budget: number) => Math.min(100, (x / budget) * 100);
</script>

<Widget title="The trigger game" subtitle="40 MHz of collisions in, about 1,000 events a second out" {n} {caption} kind="Play" onreset={() => reset(startSettings())}>
  {#snippet controls()}
    <Slider bind:value={lumi} min={0.5} max={3} step={0.1} label="Luminosity [10³⁴ cm⁻² s⁻¹]" format={(v) => v.toFixed(1)} />
    <div class="btns ui" role="group" aria-label="Menus">
      <Button size="sm" onclick={() => reset(suggestedSettings())}>A sensible menu</Button>
      <Button size="sm" onclick={() => reset(looseSettings())}>Lowest thresholds</Button>
      <Button size="sm" onclick={() => reset(startSettings())}>Start again</Button>
    </div>
  {/snippet}

  {#if !model || !report || !score}
    <div class="loading ui" role="status">
      <p>Generating toy collisions…</p>
      <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress * 100)}><span style="width:{progress * 100}%"></span></div>
    </div>
  {:else}
    <p class="intro ui">
      Every 25 ns the beams cross and several protons collide, but one crossing in 400 at most can be read out. <strong>Level 1</strong> (electronics, about 4 µs to decide) may accept
      100,000 crossings a second; the <strong>high-level trigger</strong> (software on a computer farm) then keeps about 1,000 a second for storage. Each item of the menu looks for one signature
      above a threshold. A <strong>prescale</strong> of N keeps only one accepted event in N: it cuts the rate N-fold, for common or low-threshold physics you can afford to sample.
    </p>

    <div class="funnel ui" aria-label="Rates through the trigger">
      <div class="stage"><span class="k">Collisions</span><span class="v">40 MHz crossings</span></div>
      <span class="arrow" aria-hidden="true">→</span>
      <div class="stage" class:over={score.overL1}>
        <span class="k">Level 1 accepts</span>
        <span class="v">{fmtRate(report.l1Total)} <small>of {fmtRate(DEFAULT_BUDGET.l1Hz)}</small></span>
        <span class="meter"><span style="width:{bar(report.l1Total, DEFAULT_BUDGET.l1Hz)}%"></span></span>
        <span class="st">{score.overL1 ? '✗ over budget: the rest is dropped at random' : '✓ within budget'}</span>
      </div>
      <span class="arrow" aria-hidden="true">→</span>
      <div class="stage" class:over={score.overHlt}>
        <span class="k">HLT keeps</span>
        <span class="v">{fmtRate(report.hltTotal * score.l1Factor)} <small>of {fmtRate(DEFAULT_BUDGET.hltHz)}</small></span>
        <span class="meter"><span style="width:{bar(report.hltTotal * score.l1Factor, DEFAULT_BUDGET.hltHz)}%"></span></span>
        <span class="st">{score.overHlt ? '✗ over budget: the rest is dropped at random' : '✓ within budget'} · {(report.bandwidthMBs * score.l1Factor / 1000).toFixed(2)} GB/s at 1 MB per event</span>
      </div>
      <div class="score" aria-live="polite">
        <span class="k">Score</span>
        <span class="big">{score.score.toFixed(0)}</span>
        <span class="st">of 100{#if suggestedScore !== null}; a sensible menu scores {suggestedScore.toFixed(0)}{/if}</span>
      </div>
    </div>
    {#if score.overL1 || score.overHlt}
      <p class="warnline ui" role="status">
        Over budget: {#if score.overL1}Level 1 would accept {fmtRate(report.l1Total)}, so only {fmtPct(score.l1Factor)} of its accepts get through. {/if}{#if score.overHlt}The HLT output would be {fmtRate(report.hltTotal * score.l1Factor)}, so only {fmtPct(score.hltFactor)} is stored. {/if} Every physics sample loses the same fraction, signal included.
      </p>
    {/if}

    <h5 class="ui">The menu</h5>
    <ul class="menu">
      {#each settings as s, i (s.key)}
        {@const k = kindOf(s.key)}
        {@const r = itemRate(s.key)}
        {@const rg = SETTING_RANGES[s.key]!}
        <li class="item" class:off={s.enabled === false}>
          <div class="head">
            <Toggle checked={s.enabled !== false} label={k.label} onchange={(v) => (s.enabled = v)} />
            <span class="why ui">{k.purpose}</span>
          </div>
          <div class="ctl">
            <Slider value={s.l1Threshold} min={rg.min} max={rg.max} step={rg.step} label="Threshold [{unitOf(s.key)}]" oninput={(v) => setThreshold(i, v)} format={(v) => v.toFixed(v % 1 ? 1 : 0)} compact />
            <label class="ps ui">
              <span>Prescale</span>
              <select bind:value={s.prescale} aria-label="{k.label}: prescale, keep one event in N">
                {#each PRESCALES as p}<option value={p}>{p === 1 ? 'none (1)' : `1 in ${p.toLocaleString('en-GB')}`}</option>{/each}
              </select>
            </label>
          </div>
          <div class="rates ui">
            {#if r && s.enabled !== false}
              <div class="rate"><span>L1</span><span class="b"><span style="width:{bar(r.l1Rate, DEFAULT_BUDGET.l1Hz)}%"></span></span><span class="n">{fmtRate(r.l1Rate)}</span></div>
              <div class="rate"><span>HLT</span><span class="b h"><span style="width:{bar(r.hltRate, DEFAULT_BUDGET.hltHz)}%"></span></span><span class="n">{fmtRate(r.hltRate)}</span></div>
            {:else}
              <span class="mute">switched off</span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
    <p class="small ui">The HLT applies the same cut as Level 1 with a better measurement, a little tighter (10% above the Level-1 threshold), plus identification and isolation. Bars: share of the Level-1 budget (100 kHz) and of the HLT budget (1 kHz); the rates are at {lumi.toFixed(1)} × 10³⁴ cm⁻² s⁻¹.</p>

    <h5 class="ui">Which physics survives?</h5>
    <div class="scroll">
      <table class="ui phys">
        <thead>
          <tr><th>sample</th><th>weight</th><th>made per 100 fb⁻¹ (in acceptance)</th><th>recorded</th><th>efficiency</th><th>thrown away</th></tr>
        </thead>
        <tbody>
          {#each signals as s}
            <tr>
              <th scope="row">{info(s.key).label}<span class="note">{info(s.key).note}</span></th>
              <td>×{s.importance}</td>
              <td>{fmtCount(producedCount(s.key))}</td>
              <td>{fmtCount(producedCount(s.key) * s.effective)}</td>
              <td>
                <span class="effbar" class:low={s.effective < 0.5}><span style="width:{s.effective * 100}%"></span></span>
                <strong>{fmtPct(s.effective)}</strong> <span class="mute">± {fmtPct(s.error)}</span>
              </td>
              <td class:lostc={s.effective < 0.5}>{fmtCount(lostCount(s.key, s.effective))} {s.effective < 0.5 ? '✗' : ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="small ui">
      Efficiency counts events an analysis could use (leptons and photons in the detector, above typical analysis thresholds), after any budget losses. The two rows below are not physics you want:
      they are what the trigger has to fight through.
    </p>
    <div class="scroll">
      <table class="ui phys bg">
        <thead><tr><th>background</th><th>cross-section</th><th>L1 rate</th><th>HLT rate</th></tr></thead>
        <tbody>
          {#each backgrounds as s}
            <tr>
              <th scope="row">{info(s.key).label}<span class="note">{info(s.key).note}</span></th>
              <td>{info(s.key).sigmaPb >= 1e9 ? (info(s.key).sigmaPb / 1e9).toPrecision(2) + ' mb' : (info(s.key).sigmaPb / 1e6).toPrecision(2) + ' µb'}</td>
              <td>{fmtRate(sampleRate(s.key)?.l1Rate ?? 0)}</td>
              <td>{fmtRate((sampleRate(s.key)?.hltRate ?? 0))}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="verdict ui" class:good={score.score >= 80 && !score.overL1 && !score.overHlt} role="status" aria-live="polite">
      {#if score.overL1 || score.overHlt}
        <strong>Over budget.</strong> Raise thresholds or prescale the items with the biggest bars until both meters are under their limits.
      {:else if worst.length}
        <strong>You threw away:</strong>
        {#each worst as w, i}{i ? '; ' : ' '}{fmtPct(1 - w.effective)} of the {info(w.key).label} events ({fmtCount(lostCount(w.key, w.effective))} in 100 fb⁻¹){/each}.
        Rare, valuable physics needs low thresholds with no prescale; make room by tightening the items with the biggest rates.
      {:else}
        <strong>Within budget</strong> with the important physics kept. To do better, recover the last percent of the ×1 samples (W, Z, B decays) without going over budget.
      {/if}
    </div>
  {/if}
</Widget>

<style>
  .btns {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    align-self: flex-end;
  }
  .intro {
    margin: 0 0 0.8rem;
    font-size: 0.86rem;
    line-height: 1.55;
    color: var(--ink-2);
  }
  .loading {
    padding: 1.5rem 0;
    text-align: center;
    color: var(--ink-2);
  }
  .meter {
    display: block;
    height: 7px;
    background: var(--surface-3);
    border-radius: 99px;
    overflow: hidden;
    margin: 0.25rem 0;
  }
  .meter > span {
    display: block;
    height: 100%;
    background: var(--ok);
    border-radius: 99px;
  }
  .funnel {
    display: grid;
    grid-template-columns: 1fr auto 1.25fr auto 1.4fr 0.8fr;
    gap: 0.4rem 0.5rem;
    align-items: stretch;
  }
  @media (max-width: 820px) {
    .funnel {
      grid-template-columns: 1fr;
    }
    .funnel .arrow {
      display: none;
    }
  }
  .stage,
  .score {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--line);
    border-left: 4px solid var(--ok);
    border-radius: 6px;
    background: var(--surface);
    min-width: 0;
  }
  .stage:first-child {
    border-left-color: var(--line-strong);
  }
  .stage.over {
    border-left-color: var(--bad);
    background: var(--bad-soft);
  }
  .stage.over .meter > span {
    background: var(--bad);
  }
  .arrow {
    align-self: center;
    color: var(--mute);
    font-size: 1.3rem;
  }
  .k {
    font-size: 0.72rem;
    color: var(--mute);
  }
  .v {
    font-family: var(--font-mono);
    font-size: 1.05rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .v small {
    font-size: 0.72rem;
    color: var(--mute);
    font-weight: 400;
  }
  .st {
    font-size: 0.74rem;
    color: var(--ink-2);
  }
  .score {
    border-left-color: var(--sig-high);
  }
  .big {
    font-family: var(--font-mono);
    font-size: 1.9rem;
    font-weight: 700;
    line-height: 1;
  }
  .warnline {
    margin: 0.5rem 0 0;
    padding: 0.4rem 0.7rem;
    border-left: 4px solid var(--bad);
    background: var(--bad-soft);
    border-radius: 5px;
    font-size: 0.82rem;
  }
  h5 {
    margin: 1.1rem 0 0.4rem;
    font-size: 0.85rem;
    color: var(--ink-2);
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
  }
  .menu {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 25rem), 1fr));
    gap: 0.5rem;
  }
  .item {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.5rem 0.7rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--surface);
  }
  .item.off {
    opacity: 0.6;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.3rem 0.8rem;
  }
  .why {
    font-size: 0.74rem;
    color: var(--mute);
  }
  .ctl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1rem;
    align-items: flex-end;
  }
  .ctl :global(.slider) {
    flex: 1 1 11rem;
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
    color: var(--fg);
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    padding: 0.25rem 0.3rem;
    min-height: 1.9rem;
  }
  .ps select:focus-visible {
    outline: 2px solid var(--focus);
  }
  .rates {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .rate {
    display: grid;
    grid-template-columns: 2.4rem 1fr 4.6rem;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.76rem;
  }
  .rate .b {
    display: block;
    height: 7px;
    background: var(--surface-3);
    border-radius: 99px;
    overflow: hidden;
  }
  .rate .b > span {
    display: block;
    height: 100%;
    background: var(--series-1);
  }
  .rate .b.h > span {
    background: var(--series-2);
  }
  .rate .n {
    text-align: right;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
  .mute {
    color: var(--mute);
  }
  .small {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
  .scroll {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    text-align: right;
    padding: 0.3rem 0.5rem;
    border-bottom: 1px solid var(--line);
    text-transform: none;
    letter-spacing: 0;
    vertical-align: top;
  }
  thead th {
    color: var(--mute);
    font-weight: 600;
    white-space: nowrap;
  }
  tbody th {
    text-align: left;
    font-weight: 600;
    min-width: 9rem;
  }
  .note {
    display: block;
    font-weight: 400;
    font-size: 0.7rem;
    color: var(--mute);
  }
  td:nth-child(5) {
    white-space: nowrap;
    text-align: left;
  }
  .effbar {
    display: inline-block;
    width: 4.5rem;
    height: 7px;
    background: var(--surface-3);
    border-radius: 99px;
    overflow: hidden;
    vertical-align: middle;
    margin-right: 0.4rem;
  }
  .effbar > span {
    display: block;
    height: 100%;
    background: var(--ok);
  }
  .effbar.low > span {
    background: var(--bad);
  }
  .lostc {
    color: var(--bad);
    font-weight: 600;
  }
  .verdict {
    margin-top: 0.9rem;
    padding: 0.55rem 0.8rem;
    border-left: 4px solid var(--line-strong);
    background: var(--surface-2);
    border-radius: 5px;
    font-size: 0.86rem;
    line-height: 1.5;
  }
  .verdict.good {
    border-color: var(--ok);
    background: var(--ok-soft);
  }
</style>
