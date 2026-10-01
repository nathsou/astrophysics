<!--
  The synchrotron-radiation wall. A particle of energy E on a circle of radius ρ radiates U₀ = C_γ E⁴/ρ per turn, and C_γ falls as 1/m⁴. The RF system must
  give back that much every turn, so an electron ring stops growing in energy where U₀ reaches the total RF voltage. A proton ring meets the same wall,
  (mp/me)⁴ = 1.1 × 10¹³ times further away.

    ::radiation-wall{n="21.4" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { energyLossPerTurn, cGamma, LEP, LHC } from '$lib/hep/machine';
  import { M_E, M_P } from './physics';
  import { fmtSci } from '../machine/fmt';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let rho = $state(LEP.bendingRadius_m);
  let vrfGV = $state(3.63);
  let eBeam = $state(104.5);

  const uE = (E: number) => energyLossPerTurn(E, rho, M_E) * 1e9; // eV
  const uP = (E: number) => energyLossPerTurn(E, rho, M_P) * 1e9;
  const grid = Array.from({ length: 121 }, (_, i) => 10 ** (1 + (3 * i) / 120)); // 10 GeV … 10 TeV
  const eMaxE = $derived(((vrfGV * rho) / cGamma(M_E)) ** 0.25); // E⁴ = V ρ / C_γ with V in GeV
  const eMaxP = $derived(((vrfGV * rho) / cGamma(M_P)) ** 0.25);
  const loss = $derived(uE(eBeam));
  const sinPhi = $derived(loss / (vrfGV * 1e9));
  const f = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '–');
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const supFmt = (v: number) => { const e = Math.round(Math.log10(v)); return '10' + (e < 0 ? '⁻' : '') + String(Math.abs(e)).split('').map((d) => SUP[+d]).join(''); };
  const Y0 = 1e-8, Y1 = 1e18;
  const clampY = (v: number) => Math.max(Y0, Math.min(Y1, v));
</script>

<Widget title="The synchrotron-radiation wall" subtitle="What an electron loses each turn, and what the RF can give back" {n} {caption} kind="Explore" onreset={() => { rho = LEP.bendingRadius_m; vrfGV = 3.63; eBeam = 104.5; }}>
  {#snippet controls()}
    <Slider bind:value={eBeam} min={10} max={10000} step={0.5} log label="Beam energy [GeV]" format={(v) => (v < 1000 ? v.toFixed(1) : (v / 1000).toFixed(2) + ' TeV')} />
    <Slider bind:value={rho} min={500} max={30000} step={1} log label="Bending radius ρ [m]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={vrfGV} min={0.1} max={10} step={0.01} log label="Total RF voltage per turn [GV]" format={(v) => v.toFixed(2)} />
    <div class="pre ui">
      <Button size="sm" onclick={() => { rho = LEP.bendingRadius_m; vrfGV = 3.63; eBeam = 104.5; }}>LEP at its end</Button>
      <Button size="sm" onclick={() => { rho = LHC.bendingRadius_m; vrfGV = 0.016; eBeam = 6800; }}>LHC</Button>
    </div>
  {/snippet}

  <Plot
    label="Energy radiated per turn in electronvolts against beam energy in GeV, on logarithmic axes, for an electron and for a proton in the same ring. The electron curve crosses the RF voltage line at {f(eMaxE, 1)} GeV."
    x={{ type: 'log', domain: [10, 10000], label: 'beam energy [GeV]', tickValues: [10, 100, 1000, 10000] }}
    y={{ type: 'log', domain: [Y0, Y1], label: 'energy radiated per turn [eV]', tickValues: [1e-6, 1e-3, 1, 1e3, 1e6, 1e9, 1e12, 1e15, 1e18], format: supFmt }}
    height={290}
  >
    {#snippet marks({ sx, sy })}
      <line class="rf" x1={sx(10)} x2={sx(10000)} y1={sy(vrfGV * 1e9)} y2={sy(vrfGV * 1e9)} />
      <text x={sx(12)} y={sy(vrfGV * 1e9) - 6} class="ann">RF voltage per turn: {f(vrfGV, 2)} GV</text>
      <path class="ce" d={grid.map((E, i) => `${i ? 'L' : 'M'}${sx(E)} ${sy(clampY(uE(E)))}`).join('')} />
      <path class="cp" d={grid.map((E, i) => `${i ? 'L' : 'M'}${sx(E)} ${sy(clampY(uP(E)))}`).join('')} />
      <text x={sx(12)} y={sy(clampY(uE(12))) - 8} class="ann">electron</text>
      <text x={sx(12)} y={sy(clampY(uP(12))) - 8} class="ann">proton</text>
      <line class="mk" x1={sx(eBeam)} x2={sx(eBeam)} y1={sy(Y0)} y2={sy(Y1)} />
      <circle cx={sx(eBeam)} cy={sy(clampY(uE(eBeam)))} r="5" class="pe" />
      <circle cx={sx(eBeam)} cy={sy(clampY(uP(eBeam)))} r="5" class="pp" />
      {#if eMaxE >= 10 && eMaxE <= 10000}<circle cx={sx(eMaxE)} cy={sy(vrfGV * 1e9)} r="5.5" class="wall" />{/if}
    {/snippet}
  </Plot>

  <dl class="readout ui" role="status" aria-live="polite">
    <div><dt>Electron at {f(eBeam, 1)} GeV loses per turn</dt><dd>{loss >= 1e9 ? f(loss / 1e9, 2) + ' GeV' : loss >= 1e6 ? f(loss / 1e6, 2) + ' MeV' : loss >= 1e3 ? f(loss / 1e3, 1) + ' keV' : fmtSci(loss, 2) + ' eV'} ({f((loss / (eBeam * 1e9)) * 100, 2)}% of its energy)</dd></div>
    <div><dt>A proton at the same energy</dt><dd>{fmtSci(uP(eBeam), 2)} eV</dd></div>
    <div><dt>Electron energy at which the loss equals the RF voltage</dt><dd>{f(eMaxE, 1)} GeV</dd></div>
    <div><dt>Same for a proton</dt><dd>{fmtSci(eMaxP, 2)} GeV</dd></div>
    <div><dt>Loss ÷ RF voltage (= sin φs, the synchronous phase)</dt><dd>{f(sinPhi, 3)}{sinPhi >= 1 ? ' — beyond the wall: no stable phase' : ''}</dd></div>
  </dl>
  <p class="note ui">U₀ = C_γ E⁴/ρ with C_γ = 8.846 × 10⁻⁵ m/GeV³ for electrons. A ring cannot hold a beam once U₀ exceeds the RF voltage; in practice the limit is lower, because the bucket shrinks to nothing as sin φs approaches 1. LEP's total RF voltage at its end was about 3.6 GV (approximate).</p>
</Widget>

<style>
  .rf { stroke: var(--bad); stroke-width: 1.6; stroke-dasharray: 7 4; }
  .ce { fill: none; stroke: var(--series-2); stroke-width: 2.2; }
  .cp { fill: none; stroke: var(--series-1); stroke-width: 2.2; stroke-dasharray: 6 4; }
  .mk { stroke: var(--ink-3); stroke-width: 1; }
  .pe { fill: var(--series-2); stroke: var(--surface); stroke-width: 1.5; }
  .pp { fill: var(--series-1); stroke: var(--surface); stroke-width: 1.5; }
  .wall { fill: none; stroke: var(--bad); stroke-width: 2.5; }
  .ann { font-size: 11px; fill: var(--ink-2); }
  .pre { display: flex; gap: 0.4rem; margin-top: 0.3rem; }
  .readout { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.4rem 0.9rem; margin: 0.6rem 0 0; }
  .readout div { border-left: 2px solid var(--line-strong); padding-left: 0.5rem; }
  dt { font-size: 0.74rem; color: var(--mute); text-transform: none; letter-spacing: 0; }
  dd { margin: 0; font-family: var(--font-mono); font-size: 0.9rem; font-variant-numeric: tabular-nums; }
  .note { font-size: 0.78rem; color: var(--mute); margin: 0.5rem 0 0; }
</style>
