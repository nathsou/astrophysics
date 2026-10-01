<!-- What the run measured: the fit of the main observable, the expected significance in the signal window, and the samples with their cross-sections and weights. -->
<script lang="ts">
  import type { ControlSession } from './session.svelte.ts';
  import { int, pct, plusMinus, sig, xsec } from './fmt.ts';
  import './control.css';

  let { session, samples = true }: { session: ControlSession; samples?: boolean } = $props();
  const s = $derived(session.summary);
  const fit = $derived(s?.fit);
  const w = $derived(s?.window);
  const NAMES: Record<string, string> = {
    'sig.yield': 'signal yield', 'sig.mean': 'peak position [GeV]', 'sig.sigma': 'peak width σ [GeV]', 'sig.width': 'peak width Γ [GeV]',
    'bkg.yield': 'background yield', 'bkg.slope': 'background slope [1/GeV]',
  };
</script>

{#if s}
  <div class="grid ui">
    {#if fit}
      <div>
        <h4>Fit of the main observable ({fit.model}, {fit.of})</h4>
        <table class="cr-table">
          <caption class="cr-visually-hidden">Fit parameters</caption>
          <thead><tr><th scope="col">parameter</th><th scope="col">value</th></tr></thead>
          <tbody>
            {#each Object.entries(fit.params) as [k, p]}
              <tr><th scope="row">{NAMES[k] ?? k}</th><td class="num">{plusMinus(p.value, p.error)}</td></tr>
            {/each}
            <tr><th scope="row">χ² / ndf</th><td class="num">{fit.chi2.toFixed(1)} / {fit.ndf}</td></tr>
          </tbody>
        </table>
        {#if fit.yieldSignificance !== undefined}<p class="cr-note">Signal yield over its uncertainty: {fit.yieldSignificance.toFixed(1)} σ (a rough measure; see Chapter 28 for significance proper).</p>{/if}
        {#if !fit.reliable}<p class="cr-warn">The fit is not reliable yet: with so few events it cannot constrain the peak. Let the run go on.</p>{/if}
      </div>
    {/if}
    {#if w}
      <div>
        <h4>Signal window {w.lo}–{w.hi}</h4>
        <table class="cr-table">
          <caption class="cr-visually-hidden">Signal window</caption>
          <tbody>
            <tr><th scope="row">expected signal</th><td class="num">{sig(w.signal)}</td></tr>
            <tr><th scope="row">expected background</th><td class="num">{sig(w.background)}</td></tr>
            <tr><th scope="row">Asimov significance</th><td class="num">{w.significance === null ? '–' : `${w.significance.toFixed(2)} σ`}</td></tr>
          </tbody>
        </table>
        <p class="cr-note">Z = √(2((s + b) ln(1 + s/b) − s)), computed by the library or by your <code>analysis.significance</code> if it is switched on. Leading-order signal.</p>
      </div>
    {/if}
  </div>
  {#if samples}
    <div class="cr-scroll ui">
      <table class="cr-table">
        <caption class="cr-visually-hidden">Samples</caption>
        <thead><tr><th scope="col">sample</th><th scope="col">cross-section</th><th scope="col">generated</th><th scope="col">weight per event</th><th scope="col">selected</th><th scope="col">efficiency</th></tr></thead>
        <tbody>
          {#each s.samples as x}
            <tr>
              <th scope="row">{x.label} <span class="cr-badge">{x.role}</span></th>
              <td class="num">{xsec(x.sigmaPb)}</td>
              <td class="num">{int(x.n)}</td>
              <td class="num">{s.lumiFb === null ? '1' : sig(x.weight)}</td>
              <td class="num">{s.lumiFb === null ? int(x.expectedSelected) : sig(x.expectedSelected)}</td>
              <td class="num">{pct(x.selectionEfficiency)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/if}

<style>
  .grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    margin-bottom: 0.8rem;
  }
  h4 {
    font-size: 0.82rem;
    font-weight: 600;
    margin: 0 0 0.3rem;
    color: var(--ink-2);
    border: 0;
    padding: 0;
  }
  code {
    font-size: 0.78rem;
  }
</style>
