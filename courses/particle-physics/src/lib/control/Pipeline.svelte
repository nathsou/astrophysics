<!--
  The compact Control Room: one preset of the whole pipeline in a figure.

    ::pipeline{preset="zmumu" stage="all" n="29.1" caption="…" events=2000 title="…"}

  `preset`  zmumu | higgs-gamgam | higgs-4l | ttbar | dijet | minbias | ee-zpole.
  `stage`   all, or one of machine | generator | detector | reconstruction | trigger | analysis to show only that stage's panel.
  `events`  how many events "Regenerate" runs live (default 2000).
  `seed`    the run seed (default 1; the precomputed sample was made with seed 1).
  `data`    "simulation" (default) or "real": real data are used only if `static/data/real/<preset>.manifest.json` exists (see hep/pipeline/README.md); nothing is faked.

  The figure opens with a precomputed sample (static/data/samples/<preset>.json, made by scripts/data/samples.ts with the same code and seeds), so the histogram is there at once.
  "Regenerate with my code" runs the pipeline live in worker threads with the reader's saved solutions installed, and replaces the sample as events arrive.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { PRESET_INFO, STAGE_NAMES, STAGE_TITLES, isPreset, presetConfig, type PresetName, type StageName } from '$lib/hep/pipeline/index.ts';
  import { ControlSession } from './session.svelte.ts';
  import { presetHash } from './codec.ts';
  import Histogram from './Histogram.svelte';
  import { int, pct, plusMinus, sig, hz, xsec } from './fmt.ts';
  import './control.css';

  let {
    preset = 'zmumu',
    stage = 'all',
    n,
    caption,
    title,
    events = 2000,
    seed = 1,
    data = 'simulation',
  }: {
    preset?: string;
    stage?: string;
    n?: string | number;
    caption?: string;
    title?: string;
    events?: number | string;
    seed?: number | string;
    data?: string;
  } = $props();

  const name = $derived<PresetName>(isPreset(preset) ? preset : 'zmumu');
  const only = $derived(STAGE_NAMES.includes(stage as StageName) ? (stage as StageName) : null);
  const target = $derived(Math.max(50, Number(events) || 2000));
  const seedN = $derived(Math.trunc(Number(seed)) || 1);
  const session = new ControlSession({ poolSize: 3 });
  let obsIndex = $state(0);

  onMount(() => {
    session.apply({ config: presetConfig(name), seed: seedN });
    session.readMine();
    return () => session.dispose();
  });
  // wanting real data: switch to it once the file is known to exist
  $effect(() => {
    if (data === 'real' && session.realManifest && !session.useReal) void session.setUseReal(true);
  });

  const s = $derived(session.summary);
  const snap = $derived(session.snap);
  const enabledMine = $derived(session.mine.filter((m) => m.enabled && m.stage));
  const mineLabel = $derived(enabledMine.map((m) => m.hook).join(', '));
  const obs = $derived(s?.observables[Math.min(obsIndex, (s?.observables.length ?? 1) - 1)]);
  const real = $derived(session.realHistogram);
  const info = $derived(only && s ? s.stages.find((x) => x.stage === only) : null);
  const fit = $derived(s?.fit);
  const heading = $derived(title ?? (only ? `${PRESET_INFO[name].title}: ${STAGE_TITLES[only].toLowerCase()}` : PRESET_INFO[name].title));
</script>

<Widget title={heading} {n} {caption} kind="Pipeline">
  {#snippet actions()}
    <a class="w-action" href="{base}/control-room/{presetHash(name, seedN)}">Open in the Control Room</a>
  {/snippet}
  {#snippet controls()}
    {#if session.running}
      <button type="button" class="cr-btn stop" onclick={() => session.stop()}>Stop</button>
    {:else}
      <button type="button" class="cr-btn primary" onclick={() => { session.seed = seedN; session.regenerate(target); }}>
        {enabledMine.length ? 'Regenerate with my code' : 'Run live'}
      </button>
    {/if}
    <span class="state ui" aria-live="polite">
      {#if snap?.running}
        {int(snap.events)} / {int(target)} events · {int(snap.wallRate)} events/s
      {:else if snap && snap.events > 0}
        live run: {int(snap.events)} events{snap.finished ? '' : ' (stopped)'}
      {:else if session.payloadState === 'ready' && session.view?.source === 'precomputed'}
        precomputed sample: {int(session.view.events)} events, seed {session.payload?.manifest.seed}
      {:else if session.payloadState === 'loading'}
        loading the precomputed sample…
      {:else}
        no precomputed sample for this setting: press Run live
      {/if}
    </span>
    <span class="cr-badge" class:mine={enabledMine.length > 0} title={enabledMine.length ? 'Your saved solutions are installed in the workers when you run' : 'Run with the reference code'}>
      {enabledMine.length ? `my code: ${mineLabel}` : 'reference code'}
    </span>
    {#if session.realManifest}
      <Segmented label="Simulation or real data" size="sm" options={[{ value: 'sim', label: 'simulation' }, { value: 'real', label: 'real data' }]} value={session.useReal ? 'real' : 'sim'} onchange={(v) => void session.setUseReal(v === 'real')} />
    {/if}
  {/snippet}

  {#if !s}
    <p class="cr-note ui">{session.payloadState === 'loading' ? 'Loading…' : 'Press Run live to run the pipeline in your browser.'}</p>
    {#if snap?.problems.length}{#each snap.problems as p}<p class="cr-warn ui">{p}</p>{/each}{/if}
  {:else}
    {#if snap?.problems.length}{#each snap.problems as p}<p class="cr-warn ui" role="alert">{p}</p>{/each}{/if}
    {#if !only}
      <div class="stages ui" aria-live="polite">
        {#each s.stages as st}
          <div class="st">
            <span class="nm">{STAGE_TITLES[st.stage]}</span>
            <span class="rate"><b>{st.eventsPerSecond >= 10 ? int(st.eventsPerSecond) : sig(st.eventsPerSecond, 2)}</b> ev/s</span>
            <span class="cnt">{st.counters[st.counters.length - 1]?.label}: <b>{int(st.counters[st.counters.length - 1]?.value ?? 0)}</b></span>
          </div>
        {/each}
      </div>
    {/if}

    {#if !only || only === 'analysis'}
      {#if s.observables.length > 1}
        <div class="sel ui">
          <Segmented label="Observable" size="sm" options={s.observables.map((o, i) => ({ value: i, label: o.label }))} value={obsIndex} onchange={(v) => (obsIndex = v as number)} />
        </div>
      {/if}
      {#if obs}
        <Histogram {obs} summary={s} main={obsIndex === 0} real={real && obsIndex === 0 ? { edges: real.edges, counts: real.counts, manifest: real.manifest } : null} height={300} />
      {/if}
      {#if obsIndex === 0 && fit}
        <p class="fit ui">
          Fit ({fit.model}, {fit.of}):
          {#if fit.params['sig.mean']}peak at <b>{plusMinus(fit.params['sig.mean'].value, fit.params['sig.mean'].error)}</b> GeV{/if}
          {#if fit.params['sig.sigma']}, width σ = <b>{plusMinus(fit.params['sig.sigma'].value, fit.params['sig.sigma'].error)}</b> GeV{/if}
          {#if fit.params['sig.width']}, width Γ = <b>{plusMinus(fit.params['sig.width'].value, fit.params['sig.width'].error)}</b> GeV{/if}
          {#if fit.params['sig.yield']}, signal yield <b>{plusMinus(fit.params['sig.yield'].value, fit.params['sig.yield'].error)}</b>{/if}.
          χ²/ndf = {fit.chi2.toFixed(0)}/{fit.ndf}.
        </p>
      {/if}
      {#if obsIndex === 0 && s.window?.significance != null}
        <p class="fit ui">In the window {s.window.lo}–{s.window.hi}: expected signal {sig(s.window.signal)}, background {sig(s.window.background)}, Asimov significance <b>{s.window.significance.toFixed(1)} σ</b>.</p>
      {/if}
      {#if real}
        <p class="cr-note ui">Real data: {real.manifest.title}. {int(real.selected)} events pass the same selection.</p>
      {/if}
    {:else if info}
      <div class="panel ui">
        <p class="big"><b>{info.eventsPerSecond >= 10 ? int(info.eventsPerSecond) : sig(info.eventsPerSecond, 2)}</b> events per second on one core ({sig(info.msPerEvent, 3)} ms per event)</p>
        <dl>
          {#each info.counters as c}<div><dt>{c.label}</dt><dd>{int(c.value)}</dd></div>{/each}
          {#each info.perEvent as c}<div><dt>{c.label}</dt><dd>{sig(c.value, 3)}</dd></div>{/each}
        </dl>
        {#if only === 'machine'}
          <dl><div><dt>luminosity</dt><dd>{sig(s.machine.lumi)} cm⁻² s⁻¹</dd></div><div><dt>collisions per crossing μ</dt><dd>{sig(s.machine.mu, 3)}</dd></div><div><dt>simulated</dt><dd>{sig(s.machine.simulatedMu, 3)}</dd></div></dl>
        {:else if only === 'generator'}
          <div class="cr-scroll"><table class="cr-table"><thead><tr><th scope="col">sample</th><th scope="col">cross-section</th><th scope="col">generated</th></tr></thead>
            <tbody>{#each s.samples as x}<tr><th scope="row">{x.label}</th><td class="num">{xsec(x.sigmaPb)}</td><td class="num">{int(x.n)}</td></tr>{/each}</tbody></table></div>
        {:else if only === 'reconstruction'}
          <table class="cr-table"><thead><tr><th scope="col">truth → reco</th><th scope="col">efficiency</th><th scope="col">fake rate</th></tr></thead>
            <tbody>
              <tr><th scope="row">tracks</th><td class="num">{pct(s.tracking.efficiency)}</td><td class="num">{s.tracking.fakePerEvent.toFixed(2)}/event</td></tr>
              {#each s.efficiencies as e}<tr><th scope="row">{e.kind}s</th><td class="num">{e.nTruth ? pct(e.efficiency) : '–'}</td><td class="num">{e.nReco ? pct(e.fakeRate) : '–'}</td></tr>{/each}
            </tbody></table>
        {:else if only === 'trigger'}
          <dl><div><dt>Level-1 rate</dt><dd>{hz(s.trigger.l1Total)}</dd></div><div><dt>HLT rate</dt><dd>{hz(s.trigger.hltTotal)}</dd></div><div><dt>live fraction</dt><dd>{pct(s.trigger.liveFraction, 2)}</dd></div></dl>
        {/if}
      </div>
    {/if}
    <p class="cr-note ui">
      Simulation{s.lumiFb !== null ? `, scaled to ${sig(s.lumiFb)} fb⁻¹ with leading-order cross-sections${s.isLO ? ' (K = 1; no higher-order factor is applied)' : ''}` : ', unscaled'}.
      {session.view?.source === 'precomputed' ? 'Shown: a precomputed sample made with the reference code. Regenerate to run it live with your own.' : 'Computed in your browser.'}
    </p>
  {/if}
</Widget>

<style>
  .state {
    font-size: 0.8rem;
    color: var(--ink-2);
    font-family: var(--font-mono);
  }
  .stages {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
    gap: 0.4rem;
    margin-bottom: 0.7rem;
  }
  .st {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.3rem 0.5rem;
    font-size: 0.72rem;
    color: var(--mute);
    font-family: var(--font-mono);
    min-width: 0;
  }
  .st .nm {
    font-family: var(--font-ui);
    font-weight: 600;
    color: var(--ink-2);
    font-size: 0.78rem;
  }
  .st b {
    color: var(--fg);
  }
  .st .rate b {
    color: var(--phosphor-ink);
  }
  .sel {
    margin-bottom: 0.5rem;
    overflow-x: auto;
  }
  .fit {
    margin: 0.5rem 0 0;
    font-size: 0.84rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
  .panel dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.4rem 0.9rem;
    margin: 0.5rem 0;
  }
  dt {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--mute);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
  }
  .big {
    margin: 0;
  }
</style>
