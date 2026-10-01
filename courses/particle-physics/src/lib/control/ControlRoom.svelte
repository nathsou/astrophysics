<!--
  The Control Room: the whole mini-LHC in one workspace. Machine → generator → detector → reconstruction → trigger → analysis, six panes with their controls,
  a status strip in the spirit of the LHC's "Page 1", live histograms that fill as events stream through a pool of workers, and the event display for the
  events the trigger kept. Each pane says whether it runs the reference code or the reader's ("mine"). The state is in the URL hash and in localStorage.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { base } from '$app/paths';
  import { STAGE_NAMES, PRESET_INFO, isPreset, type StageName } from '$lib/hep/pipeline/index.ts';
  import { ControlSession } from './session.svelte.ts';
  import { hashForState } from './codec.ts';
  import StatusStrip from './StatusStrip.svelte';
  import RunControls from './RunControls.svelte';
  import StagePane from './StagePane.svelte';
  import MachinePane from './MachinePane.svelte';
  import GeneratorPane from './GeneratorPane.svelte';
  import DetectorPane from './DetectorPane.svelte';
  import RecoPane from './RecoPane.svelte';
  import TriggerPane from './TriggerPane.svelte';
  import AnalysisPane from './AnalysisPane.svelte';
  import HistogramPanel from './HistogramPanel.svelte';
  import ResultsPanel from './ResultsPanel.svelte';
  import EventPanel from './EventPanel.svelte';
  import MinePanel from './MinePanel.svelte';
  import './control.css';

  const session = new ControlSession();
  let ready = $state(false);
  let hashTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    void (async () => {
      await session.restore(location.hash);
      session.warm();
      ready = true;
    })();
    return () => {
      session.dispose();
      if (hashTimer) clearTimeout(hashTimer);
    };
  });

  // A change to what determines the events discards the run; every change is saved and written to the address bar.
  $effect(() => {
    if (!ready) return;
    session.watchPhysics();
    void JSON.stringify($state.snapshot(session.config));
    void session.seed;
    session.save();
    if (hashTimer) clearTimeout(hashTimer);
    hashTimer = setTimeout(async () => {
      try {
        replaceState(await hashForState({ config: $state.snapshot(session.config) as never, seed: session.seed }), {});
      } catch {
        /* the router is not ready or the URL cannot be changed: the Copy link button still works */
      }
    }, 600);
  });

  const preset = $derived(isPreset(session.config.name) ? PRESET_INFO[session.config.name] : null);
  const panes: StageName[] = [...STAGE_NAMES];
</script>

<div class="room">
  <header class="top">
    <h1>The Control Room</h1>
    <p class="lede">
      This is the whole mini-LHC. A <em>machine</em> collides the beams, a <em>generator</em> invents what comes out, a <em>detector</em> records it, the <em>reconstruction</em> turns the
      records into particles, the <em>trigger</em> decides which events to keep, and the <em>analysis</em> fills histograms. Press Start and events stream through the six stages on all your
      processor cores. Where you have solved an exercise and switched "use my code" on, your function replaces the library's, and the pane says <span class="cr-badge mine">mine</span>.
    </p>
    {#if preset}<p class="preset ui"><strong>{preset.title}.</strong> {preset.summary}</p>{/if}
  </header>

  <StatusStrip {session} />
  <div class="gap"></div>
  <RunControls {session} />

  <h2 id="stages">The six stages</h2>
  <div class="stages">
    {#each panes as stage}
      <StagePane {stage} {session}>
        {#if stage === 'machine'}<MachinePane {session} />
        {:else if stage === 'generator'}<GeneratorPane {session} />
        {:else if stage === 'detector'}<DetectorPane {session} />
        {:else if stage === 'reconstruction'}<RecoPane {session} />
        {:else if stage === 'trigger'}<TriggerPane {session} />
        {:else}<AnalysisPane {session} />{/if}
      </StagePane>
    {/each}
  </div>

  <h2 id="histograms">Histograms</h2>
  <HistogramPanel {session} />
  <div class="gap"></div>
  <ResultsPanel {session} />

  <h2 id="events">Events</h2>
  <EventPanel {session} />

  <h2 id="mine">My code</h2>
  <MinePanel {session} />

  <h2>What is approximate</h2>
  <ul class="approx ui">
    <li>The generator works at <strong>leading order</strong>: every cross-section is the lowest-order value, times a K-factor only if you set one. The parton shower and the hadronisation are toy models, and the parton densities are a pedagogical parametrisation, not a fit.</li>
    <li>The detector is a <strong>fast simulation</strong>, not Geant4: helices, parametrised showers and Gaussian smearing, with no endcap disks and no nuclear interactions.</li>
    <li>The rates in the trigger pane are the rates of <strong>the events in this run</strong> (σ L × efficiency). The minimum-bias and QCD events that dominate a real trigger are not in a Z or Higgs run.</li>
    <li>The pile-up simulated per event is usually below the machine's μ, to keep the figure quick. Raise it in the machine pane to see tracking and jets degrade.</li>
    <li>Pseudo-data are Poisson fluctuations of the simulation. They are not data. Real data appear in Chapter 29, labelled as such.</li>
  </ul>
  <p class="cr-note ui">Every number is reproducible: the seed, the configuration (in the address bar) and the code decide every event, whatever the number of workers. Units are GeV; lengths in mm.
    <a class="cr-link" href="{base}/chapters/">Back to the chapters.</a></p>
</div>

<style>
  .room {
    max-width: 82rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 4rem;
    font-family: var(--font-ui);
  }
  h1 {
    font-family: var(--font-display);
    margin: 0 0 0.4rem;
    font-size: clamp(1.7rem, 4vw, 2.4rem);
  }
  h2 {
    font-family: var(--font-display);
    margin: 2rem 0 0.7rem;
    font-size: 1.3rem;
    border-bottom: 1px solid var(--line);
    padding-bottom: 0.3rem;
  }
  .lede {
    max-width: 52rem;
    color: var(--ink-2);
    line-height: 1.55;
    margin: 0 0 0.6rem;
  }
  .preset {
    margin: 0 0 1rem;
    color: var(--ink-2);
    font-size: 0.9rem;
  }
  .gap {
    height: 0.7rem;
  }
  .stages {
    display: grid;
    gap: 0.9rem;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 21rem), 1fr));
    align-items: start;
  }
  .approx {
    color: var(--ink-2);
    font-size: 0.88rem;
    line-height: 1.55;
    padding-left: 1.2rem;
    max-width: 60rem;
  }
</style>
