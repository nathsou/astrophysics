<!-- Stage 6 controls: the observables, the binning of the main one, the selection of objects, the signal window, the fit, and the luminosity the histograms are scaled to. -->
<script lang="ts">
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { OBSERVABLES, OBSERVABLE_NAMES, binEdges, type FitSettings } from '$lib/hep/pipeline/index.ts';
  import type { ControlSession } from './session.svelte.ts';
  import './control.css';

  let { session }: { session: ControlSession } = $props();
  const a = $derived(session.config.analysis);
  const main = $derived(a.observables[0]!);
  const def = $derived(OBSERVABLES[main]!);
  const bin = $derived(a.binning[main] ?? { bins: def.bins, lo: def.lo, hi: def.hi });
  const setBin = (k: 'bins' | 'lo' | 'hi', v: number) => {
    session.config.analysis.binning = { ...session.config.analysis.binning, [main]: { ...bin, [k]: v } };
  };
  const setMain = (name: string) => {
    const rest = session.config.analysis.observables.filter((o) => o !== name);
    session.config.analysis.observables = [name, ...rest].slice(0, 4);
    session.config.analysis.window = null;
    session.config.analysis.fit = null;
  };
  const setSecond = (i: number, name: string) => {
    const obs = session.config.analysis.observables.slice();
    if (name === '') obs.splice(i, 1);
    else obs[i] = name;
    session.config.analysis.observables = obs.filter((o, k) => obs.indexOf(o) === k);
  };
  const sel = $derived(a.selection);
  const setSel = <K extends keyof typeof sel>(k: K, v: (typeof sel)[K]) => {
    session.config.analysis.selection = { ...session.config.analysis.selection, [k]: v };
  };
  const MODELS = ['gauss+exp', 'cb+exp', 'bw+exp', 'bwrel+exp', 'gauss+flat', 'gauss+cheb2', 'cb+cheb2'];
  const setFit = (model: string) => {
    session.config.analysis.fit = model === '' ? null : { model, range: a.fit?.range ?? [bin.lo, bin.hi] };
  };
  const lumiOn = $derived(a.lumiFb !== null);
  const isMass = $derived(['mll', 'mgg', 'm4l', 'mjj'].includes(main));
</script>

<div class="cr-fields">
  <div>
    <label class="cr-label" for="obs-main">Main observable</label>
    <select id="obs-main" class="cr-select" value={main} onchange={(e) => setMain(e.currentTarget.value)}>
      {#each OBSERVABLE_NAMES as o}<option value={o}>{OBSERVABLES[o]!.label}{OBSERVABLES[o]!.unit ? ` [${OBSERVABLES[o]!.unit}]` : ''}</option>{/each}
    </select>
  </div>
  {#each [1, 2] as i}
    <div>
      <label class="cr-label" for="obs-{i}">Also draw</label>
      <select id="obs-{i}" class="cr-select" value={a.observables[i] ?? ''} onchange={(e) => setSecond(i, e.currentTarget.value)}>
        <option value="">none</option>
        {#each OBSERVABLE_NAMES.filter((o) => o !== main) as o}<option value={o}>{OBSERVABLES[o]!.label}</option>{/each}
      </select>
    </div>
  {/each}
</div>
<p class="cr-note">{def.description}</p>
<details class="fold">
<summary class="ui">Binning of {def.label}</summary>
<div class="cr-fields">
  <Slider label="Bins" min={5} max={120} step={1} value={bin.bins} format={(v) => String(Math.round(v))} oninput={(v) => setBin('bins', Math.round(v))} />
  <Slider label="Lower edge" min={def.log ? 1 : -1} max={def.hi} step={def.hi > 100 ? 1 : 0.5} value={bin.lo} format={(v) => String(Math.round(v * 10) / 10)} oninput={(v) => setBin('lo', v)} />
  <Slider label="Upper edge" min={def.lo + 1} max={def.hi * 2} step={def.hi > 100 ? 1 : 0.5} value={bin.hi} format={(v) => String(Math.round(v * 10) / 10)} oninput={(v) => setBin('hi', v)} />
</div>
</details>
<details class="fold">
<summary class="ui">Selection of objects</summary>
<div class="cr-fields">
  <Slider label="Lepton pT cut [GeV]" min={2} max={60} step={1} value={sel.leptonPtMin} format={(v) => String(Math.round(v))} oninput={(v) => setSel('leptonPtMin', Math.round(v))} />
  <Slider label="Photon pT cut [GeV]" min={5} max={60} step={1} value={sel.photonPtMin} format={(v) => String(Math.round(v))} oninput={(v) => setSel('photonPtMin', Math.round(v))} />
  <Slider label="Jet pT cut [GeV]" min={15} max={150} step={1} value={sel.jetPtMin} format={(v) => String(Math.round(v))} oninput={(v) => setSel('jetPtMin', Math.round(v))} />
  <Slider label="|η| limit" min={0.5} max={2.5} step={0.1} value={sel.etaMax} format={(v) => v.toFixed(1)} oninput={(v) => setSel('etaMax', v)} />
  <Slider label="Isolation limit" min={0.05} max={1} step={0.05} value={Math.min(sel.isolationMax, 1)} format={(v) => (v >= 1 ? 'off' : v.toFixed(2))} oninput={(v) => setSel('isolationMax', v >= 1 ? 100 : v)} />
</div>
<Toggle label="Photon pT/m cuts (0.35 and 0.25)" checked={sel.ptOverM} onchange={(c) => setSel('ptOverM', c)} />
</details>

{#if isMass}
<details class="fold" open>
<summary class="ui">Fit and signal window</summary>
  <div class="cr-fields">
    <div>
      <label class="cr-label" for="fit-model">Fit</label>
      <select id="fit-model" class="cr-select" value={a.fit?.model ?? ''} onchange={(e) => setFit(e.currentTarget.value)}>
        <option value="">none</option>
        {#each MODELS as m}<option value={m}>{m}</option>{/each}
      </select>
    </div>
    {#if a.fit}
      <Slider label="Fit from" min={bin.lo} max={bin.hi - 2} step={1} value={a.fit.range?.[0] ?? bin.lo} format={(v) => String(Math.round(v))} oninput={(v) => (session.config.analysis.fit = { ...(session.config.analysis.fit as FitSettings), range: [v, a.fit?.range?.[1] ?? bin.hi] })} />
      <Slider label="Fit to" min={bin.lo + 2} max={bin.hi} step={1} value={a.fit.range?.[1] ?? bin.hi} format={(v) => String(Math.round(v))} oninput={(v) => (session.config.analysis.fit = { ...(session.config.analysis.fit as FitSettings), range: [a.fit?.range?.[0] ?? bin.lo, v] })} />
    {/if}
  </div>
  <div class="cr-fields">
    <Slider label="Signal window from" min={bin.lo} max={bin.hi - 1} step={1} value={a.window?.[0] ?? bin.lo} format={(v) => String(Math.round(v))} oninput={(v) => (session.config.analysis.window = [v, a.window?.[1] ?? bin.hi])} />
    <Slider label="Signal window to" min={bin.lo + 1} max={bin.hi} step={1} value={a.window?.[1] ?? bin.hi} format={(v) => String(Math.round(v))} oninput={(v) => (session.config.analysis.window = [a.window?.[0] ?? bin.lo, v])} />
  </div>
</details>
{/if}
<div class="cr-row">
  <Toggle label="Scale to a luminosity" checked={lumiOn} onchange={(c) => (session.config.analysis.lumiFb = c ? 100 : null)} />
  {#if lumiOn}
    <div style="flex:1;min-width:11rem">
      <Slider label="Integrated luminosity [fb⁻¹]" min={0.0001} max={1000} log value={a.lumiFb ?? 100} format={(v) => (v >= 10 ? String(Math.round(v)) : v >= 0.1 ? v.toFixed(2) : v.toPrecision(2))} oninput={(v) => (session.config.analysis.lumiFb = v)} />
    </div>
  {/if}
  <Toggle label="Pseudo-data" checked={a.pseudoData} onchange={(c) => (session.config.analysis.pseudoData = c)} />
</div>
<p class="cr-note">Without a luminosity the histograms count simulated events (one sample only makes sense). Pseudo-data are Poisson fluctuations of the simulation, not data.</p>

<style>
  .fold {
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.35rem 0.6rem 0.5rem;
  }
  .fold > summary {
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink-2);
    margin: 0 -0.2rem;
    padding: 0.1rem 0.2rem;
  }
  .fold > summary:focus-visible {
    outline: 2px solid var(--focus);
    border-radius: 4px;
  }
  .fold[open] > summary {
    margin-bottom: 0.5rem;
  }
</style>
