<!-- The status strip, in the spirit of the LHC's "Page 1" display in the control room: machine mode, energy, luminosity, pile-up, events and trigger rate on one dark screen. -->
<script lang="ts">
  import type { ControlSession } from './session.svelte.ts';
  import { duration, hz, int, lumi as fmtLumi, pct, sig } from './fmt.ts';
  import './control.css';

  let { session }: { session: ControlSession } = $props();
  const s = $derived(session.summary);
  const snap = $derived(session.snap);
  const m = $derived(session.config.machine);
  const view = $derived(session.view);
  const state = $derived(snap?.running ? 'RUNNING' : view?.source === 'precomputed' ? 'PRECOMPUTED' : snap && snap.events > 0 ? 'STOPPED' : 'READY');
  const modeLabel = $derived(m.mode === 'ee' ? 'e⁺e⁻' : m.mode === 'ppbar' ? 'pp̄' : 'pp');
  const energy = $derived(m.sqrtS >= 1000 ? `${sig(m.sqrtS / 1000, 4)} TeV` : `${sig(m.sqrtS, 4)} GeV`);
  const events = $derived(view ? view.events : 0);
</script>

<div class="screen strip" role="group" aria-label="Machine and run status">
  <div class="cell"><span class="k">machine mode</span><span class="v">{modeLabel} collisions</span></div>
  <div class="cell"><span class="k">√s</span><span class="v">{energy}</span></div>
  <div class="cell"><span class="k">luminosity</span><span class="v">{s ? fmtLumi(s.machine.lumi) : '–'}</span></div>
  <div class="cell"><span class="k">pile-up μ</span><span class="v">{s ? `${sig(s.machine.mu, 3)} (simulated ${sig(s.machine.simulatedMu, 3)})` : '–'}</span></div>
  <div class="cell" aria-live="polite"><span class="k">events processed</span><span class="v hot">{int(events)}{snap && snap.target !== Infinity && snap.running ? ` / ${int(snap.target)}` : ''}</span></div>
  <div class="cell"><span class="k">trigger rate (this run)</span><span class="v">{s ? hz(s.trigger.hltTotal) : '–'}</span></div>
  <div class="cell"><span class="k">live fraction</span><span class="v">{s ? pct(s.trigger.liveFraction, 3) : '–'}</span></div>
  <div class="cell"><span class="k">state</span><span class="v state" class:run={state === 'RUNNING'}>{state}{snap?.running ? ` · ${int(snap.wallRate)} ev/s · ${duration(snap.elapsedMs)}` : ''}</span></div>
</div>

<style>
  .strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
    gap: 1px;
    background: var(--line);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    overflow: hidden;
    font-family: var(--font-mono);
  }
  .cell {
    background: var(--bg);
    padding: 0.4rem 0.7rem 0.45rem;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }
  .k {
    font-size: 0.64rem;
    letter-spacing: 0.04em;
    color: var(--mute);
  }
  .v {
    font-size: 0.88rem;
    color: var(--phosphor);
    overflow-wrap: anywhere;
  }
  .v.hot {
    color: var(--sig-high);
    font-weight: 600;
  }
  .v.state {
    color: var(--ink-2);
  }
  .v.state.run {
    color: var(--phosphor);
  }
</style>
