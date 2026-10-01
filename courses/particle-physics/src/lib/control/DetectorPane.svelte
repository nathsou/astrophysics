<!-- Stage 3 controls: the detector preset and a few knobs (field, resolutions, dead channels), through hep/detector's `customise`. -->
<script lang="ts">
  import Slider from '$lib/components/ui/Slider.svelte';
  import { resolveDetector, type DetectorSettings } from '$lib/hep/pipeline/index.ts';
  import { presets } from '$lib/hep/detector/config.ts';
  import type { ControlSession } from './session.svelte.ts';
  import './control.css';

  let { session }: { session: ControlSession } = $props();
  const d = $derived(session.config.detector);
  const base = $derived(presets[d.preset] ?? presets.onion!);
  const cfg = $derived(resolveDetector($state.snapshot(session.config.detector) as DetectorSettings));
  const set = <K extends keyof DetectorSettings>(k: K, v: DetectorSettings[K]) => {
    session.config.detector[k] = v;
  };
</script>

<div>
  <label class="cr-label" for="det-preset">Detector</label>
  <select id="det-preset" class="cr-select" value={d.preset} onchange={(e) => (session.config.detector = { preset: e.currentTarget.value })}>
    {#each Object.keys(presets) as p}<option value={p}>{p}</option>{/each}
  </select>
  <p class="cr-note">{base.description}</p>
</div>
<div class="cr-fields">
  <Slider label="Solenoid field [T]" min={0.5} max={6} step={0.1} value={d.bField ?? base.bField} format={(v) => v.toFixed(1)} oninput={(v) => set('bField', v)} />
  <Slider label="Tracker resolution ×" min={0.5} max={5} step={0.1} value={d.trackerResolution ?? 1} format={(v) => `${v.toFixed(1)}×`} oninput={(v) => set('trackerResolution', v)} />
  <Slider label="ECAL stochastic term [√GeV]" min={0.01} max={0.2} step={0.005} value={d.ecalStochastic ?? base.ecal.stochastic} format={(v) => v.toFixed(3)} oninput={(v) => set('ecalStochastic', v)} />
  <Slider label="HCAL stochastic term [√GeV]" min={0.3} max={1.5} step={0.05} value={d.hcalStochastic ?? base.hcal.stochastic} format={(v) => v.toFixed(2)} oninput={(v) => set('hcalStochastic', v)} />
  <Slider label="Dead tracker channels" min={0} max={0.2} step={0.005} value={d.deadFraction ?? base.deadFraction} format={(v) => `${(100 * v).toFixed(1)} %`} oninput={(v) => set('deadFraction', v)} />
  <Slider label="Noise hits per layer" min={0} max={20} step={1} value={d.noiseHitsPerLayer ?? base.noiseHitsPerLayer} format={(v) => String(Math.round(v))} oninput={(v) => set('noiseHitsPerLayer', Math.round(v))} />
</div>
<p class="cr-note">{cfg.trackerLayers.length} tracker layers to r = {Math.round(Math.max(...cfg.trackerLayers.map((l) => l.r)))} mm, ECAL {cfg.ecal.depthX0} X₀, HCAL {cfg.hcal.depthLambda} λ, {cfg.muon.stations.length} muon stations, |η| &lt; {cfg.etaMax}.</p>
