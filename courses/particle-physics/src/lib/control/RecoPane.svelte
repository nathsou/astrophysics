<!-- Stage 4 controls: options of hep/reco (seeding, thresholds, jets, pile-up subtraction, b-tagging), and the truth-matching summary. -->
<script lang="ts">
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { DEFAULT_RECO_CONFIG, type RecoConfig } from '$lib/hep/reco/config.ts';
  import type { ControlSession } from './session.svelte.ts';
  import { pct, int } from './fmt.ts';
  import './control.css';

  let { session }: { session: ControlSession } = $props();
  const r = $derived({ ...DEFAULT_RECO_CONFIG, ...session.config.reco });
  const set = <K extends keyof RecoConfig>(k: K, v: RecoConfig[K]) => {
    session.config.reco = { ...session.config.reco, [k]: v };
  };
  const s = $derived(session.summary);
</script>

<div>
  <span class="cr-label">Track seeding</span>
  <Segmented label="Track seeding" size="sm" options={[{ value: 'triplets', label: 'pixel triplets' }, { value: 'hough', label: 'Hough transform' }]} value={r.seeding} onchange={(v) => set('seeding', v as 'triplets' | 'hough')} />
</div>
<div class="cr-fields">
  <Slider label="Track pT threshold [GeV]" min={0.3} max={4} step={0.1} value={r.ptMin} format={(v) => v.toFixed(1)} oninput={(v) => set('ptMin', v)} />
  <Slider label="Jet radius R" min={0.2} max={1} step={0.05} value={r.jetR} format={(v) => v.toFixed(2)} oninput={(v) => set('jetR', v)} />
  <Slider label="Jet pT threshold [GeV]" min={8} max={60} step={1} value={r.jetPtMin} format={(v) => String(Math.round(v))} oninput={(v) => set('jetPtMin', Math.round(v))} />
  <Slider label="Muon pT threshold [GeV]" min={1} max={20} step={0.5} value={r.muonPtMin} format={(v) => v.toFixed(1)} oninput={(v) => set('muonPtMin', v)} />
</div>
<div class="cr-row">
  <Toggle label="Charged-hadron subtraction" checked={r.chs} onchange={(c) => set('chs', c)} />
  <Toggle label="b-tagging" checked={r.bTag} onchange={(c) => set('bTag', c)} />
</div>
{#if s && (s.efficiencies.length || s.tracking.nTruth)}
  <div class="cr-scroll">
    <table class="cr-table ui">
      <caption class="cr-visually-hidden">Truth against reconstruction</caption>
      <thead><tr><th scope="col">truth → reco</th><th scope="col">efficiency</th><th scope="col">fake rate</th></tr></thead>
      <tbody>
        <tr><th scope="row">tracks (pT &gt; 0.5 GeV)</th><td class="num">{pct(s.tracking.efficiency)}</td><td class="num">{s.tracking.fakePerEvent.toFixed(2)}/event</td></tr>
        {#each s.efficiencies as e}
          <tr>
            <th scope="row">{e.kind}s{e.nTruth ? ` (${int(e.nTruth)} truth)` : ''}</th>
            <td class="num">{e.nTruth ? pct(e.efficiency) : '–'}</td>
            <td class="num">{e.nReco ? pct(e.fakeRate) : '–'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="cr-note">Efficiency: prompt truth objects in the detector's acceptance with a reconstructed object within ΔR &lt; 0.1. Fake: a reconstructed object with no truth particle of its kind nearby.</p>
{/if}
