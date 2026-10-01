<!--
  The collider dashboard: set the beam parameters and read off the luminosity, the pile-up, the integrated luminosity per day, the energy
  stored in the beam, and what synchrotron radiation costs electrons compared with protons.

    ::collider-dashboard{mode="lhc" n="21.3" caption="…"}     mode: lhc (proton beams) | lep (electron–positron beams)

  The formulas are `machine.luminosity` (through the reader's hook), `pileup`, `optimalFill`, `storedEnergyMJ` and the radiation functions of
  `hep/machine`. The parameter presets are illustrative.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { rng } from '$lib/hep/random';
  import {
    LEP, LHC, LHC_DESIGN, RUN3_LIKE, SIGMA_INEL_MB, bunchCrossings, burnOffTime, cm2ToInvFb, collisionVertices, copperMeltedKg, criticalEnergyEV, electronLossKeV,
    geometricFactor, interactionRate, luminosity, luminousRegionSigmaZ, optimalFill, pileup, protonLossKeV, radiatedPowerW, revolutionFrequency, sigmaStar, storedEnergyMJ,
    tntKg, trainSpeedKmH, type LumiParams,
  } from '$lib/hep/machine';
  import { fmtSci } from './fmt';

  let { mode = 'lhc', n, caption }: { mode?: 'lhc' | 'lep'; n?: string | number; caption?: string } = $props();

  const M_P = 0.9382720813;
  const M_E = 0.000510998950;
  const isLep = $derived(mode === 'lep');

  // ── hadron collider inputs ──
  let preset = $state<'design' | 'run3' | 'hl' | 'custom'>('design');
  let Nb = $state(LHC_DESIGN.Nb / 1e11);
  let nb = $state(LHC_DESIGN.nb);
  let epsN = $state(LHC_DESIGN.eps_n * 1e6);
  let betaStar = $state(LHC_DESIGN.betaStar);
  let theta = $state(LHC_DESIGN.crossingAngle * 1e6);
  let energyTeV = $state(7);
  let crab = $state(false);

  function setPreset(p: string) {
    preset = p as typeof preset;
    if (p === 'design') { Nb = 1.15; nb = 2808; epsN = 3.75; betaStar = 0.55; theta = 285; energyTeV = 7; crab = false; }
    if (p === 'run3') { Nb = RUN3_LIKE.Nb / 1e11; nb = RUN3_LIKE.nb; epsN = RUN3_LIKE.eps_n * 1e6; betaStar = RUN3_LIKE.betaStar; theta = RUN3_LIKE.crossingAngle * 1e6; energyTeV = 6.8; crab = false; }
    if (p === 'hl') { Nb = 2.2; nb = 2760; epsN = 2.5; betaStar = 0.15; theta = 500; energyTeV = 7; crab = false; }
  }
  const touch = () => { if (preset !== 'custom') preset = 'custom'; };

  // ── lepton collider inputs (LEP-like, flat beams) ──
  let eBeam = $state(104.5);
  let Ne = $state(4.0); // 1e11
  let nbE = $state(4);
  let sigX = $state(190); // µm
  let sigY = $state(3); // µm
  let vrf = $state(3.6); // GV

  const E_GeV = $derived(isLep ? eBeam : energyTeV * 1000);
  const m = $derived(isLep ? M_E : M_P);
  const frev = revolutionFrequency(LHC.circumference_m);

  const params = $derived<LumiParams>({
    Nb: Nb * 1e11, nb, frev, eps_n: epsN * 1e-6, betaStar, gamma: (energyTeV * 1000) / M_P,
    crossingAngle: crab ? 0 : theta * 1e-6, sigmaZ: LHC.optics.sigmaZ_m,
  });
  const lumiHadron = $derived(luminosity(params));
  /** Flat Gaussian beams: L = N² n f/(4π σx σy), no crossing angle (LEP's bunches met head on). */
  const lumiLepton = $derived(((Ne * 1e11) ** 2 * nbE * frev) / (4 * Math.PI * sigX * 1e-6 * sigY * 1e-6) * 1e-4);
  const lumi = $derived(isLep ? lumiLepton : lumiHadron);

  const mu = $derived(isLep ? 0 : pileup(lumiHadron, nb, frev, SIGMA_INEL_MB));
  const collisionsPerSecond = $derived(interactionRate(lumiHadron, SIGMA_INEL_MB));
  const sStar = $derived(sigmaStar(params) * 1e6);
  const F = $derived(geometricFactor(params));
  const nTotal = $derived(isLep ? Ne * 1e11 * nbE : Nb * 1e11 * nb);
  const stored = $derived(storedEnergyMJ(isLep ? Ne * 1e11 : Nb * 1e11, isLep ? nbE : nb, E_GeV));
  const current_mA = $derived(isLep ? Ne * 1e11 * nbE * 1.602176634e-19 * frev * 1e3 : NaN);

  // Integrated luminosity per day from a cycle of stable beams and a turnaround, with burn-off and a 20 h lifetime from other losses.
  const TAU_OTHER = 20 * 3600;
  const TURNAROUND = 3 * 3600;
  const fill = $derived(isLep ? null : optimalFill(lumiHadron, burnOffTime(Nb * 1e11 * nb, lumiHadron, 2), TAU_OTHER, TURNAROUND));
  const perDay = $derived(fill ? cm2ToInvFb(fill.averageLumi * 86400) : NaN);

  // Synchrotron radiation at the ring's radius.
  const rho = $derived(isLep ? LEP.bendingRadius_m : LHC.bendingRadius_m);
  const uE = $derived(electronLossKeV(E_GeV, rho) * 1e3); // eV per turn
  const uP = $derived(protonLossKeV(E_GeV, rho) * 1e3);
  const uOwn = $derived(isLep ? uE : uP);
  const eCrit = $derived(criticalEnergyEV(E_GeV, rho, m));
  const power_MW = $derived(isLep ? radiatedPowerW(uE / 1e9, current_mA * 1e-3) / 1e6 : NaN);

  interface Bar { label: string; v: number; note: string }
  const bars = $derived<Bar[]>(
    isLep
      ? [
          { label: `Electron, ${E_GeV.toFixed(1)} GeV, this ring`, v: uE, note: 'what LEP had to replace every turn' },
          { label: 'Proton, same energy and ring', v: uP, note: 'the same ring with protons' },
        ]
      : [
          { label: `Proton, ${(E_GeV / 1000).toFixed(1)} TeV, LHC`, v: uP, note: 'the LHC as it is' },
          { label: 'Electron, 104.5 GeV, LEP', v: electronLossKeV(LEP.maxBeamEnergy_GeV, LEP.bendingRadius_m) * 1e3, note: 'the LEP record' },
          { label: `Electron, ${(E_GeV / 1000).toFixed(1)} TeV, LHC ring`, v: uE, note: 'an electron LHC' },
        ],
  );
  const BW = 560, BPL = 12, BPR = 12;
  const LOGMIN = -6, LOGMAX = 18;
  const BH = $derived(bars.length * 46 + 34);
  const bx = (v: number) => BPL + ((Math.log10(Math.max(v, 1e-7)) - LOGMIN) / (LOGMAX - LOGMIN)) * (BW - BPL - BPR);
  const ticks = [-6, -3, 0, 3, 6, 9, 12, 15, 18];
  const tickLabel: Record<number, string> = { '-6': '1 µeV', '-3': '1 meV', 0: '1 eV', 3: '1 keV', 6: '1 MeV', 9: '1 GeV', 12: '1 TeV', 15: '1 PeV', 18: '1 EeV' };

  // ── one bunch crossing ──
  let seed = $state(1);
  const crossing = $derived.by(() => {
    const r = rng(seed);
    const k = isLep ? 1 : Math.max(1, bunchCrossings(1, r, mu)[0]!);
    const sz = isLep ? 10 : luminousRegionSigmaZ(params) * 1e3;
    const zs = collisionVertices(r, k, sz);
    const tracks = zs.map((z) => Array.from({ length: 3 }, () => ({ z, a: (r() - 0.5) * 2.6, len: 26 + r() * 30 })));
    return { k, zs, tracks, sz };
  });
  const CW = 560, CH = 170;
  const cz = (z: number) => CW / 2 + z * (CW / 2 - 30) / 180;

  const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '–');
  const speed = $derived(trainSpeedKmH(stored, 400));
  const presetOpts = [{ value: 'design', label: 'Design (2008)' }, { value: 'run3', label: 'Run 3-like' }, { value: 'hl', label: 'HL-LHC-like' }, ...(preset === 'custom' ? [{ value: 'custom', label: 'Custom' }] : [])];
  const bestBar = $derived(Math.max(...bars.map((b) => b.v)));
</script>

<Widget title={isLep ? 'An electron–positron collider' : 'A proton collider'} subtitle={isLep ? 'LEP-like flat beams in the 26.7 km tunnel: luminosity and the price of synchrotron radiation' : 'LHC-like beams: luminosity, pile-up, integrated luminosity and the energy in the beam'} {n} {caption} kind="Explore" onreset={() => (isLep ? ((eBeam = 104.5), (Ne = 4), (nbE = 4), (sigX = 190), (sigY = 3), (vrf = 3.6)) : setPreset('design'))}>
  {#snippet controls()}
    {#if !isLep}
      <Segmented label="Parameter preset" value={preset} options={presetOpts} onchange={(v: string) => v !== 'custom' && setPreset(v)} />
      <Slider bind:value={Nb} min={0.5} max={2.4} step={0.05} label="Protons per bunch [10¹¹]" oninput={touch} format={(v) => v.toFixed(2)} />
      <Slider bind:value={nb} min={50} max={2808} step={1} label="Colliding bunches" oninput={touch} format={(v) => v.toFixed(0)} />
      <Slider bind:value={epsN} min={1} max={5} step={0.05} label="Normalised emittance [µm]" oninput={touch} format={(v) => v.toFixed(2)} />
      <Slider bind:value={betaStar} min={0.1} max={1.5} step={0.01} label="β* at the collision point [m]" oninput={touch} />
      <Slider bind:value={theta} min={0} max={600} step={5} label="Full crossing angle [µrad]" oninput={touch} format={(v) => v.toFixed(0)} />
      <Segmented label="Beam energy" value={energyTeV} options={[{ value: 6.8, label: '6.8 TeV' }, { value: 7, label: '7 TeV' }]} onchange={() => touch()} />
      <Toggle bind:checked={crab} label="Crab cavities" onchange={touch} />
    {:else}
      <Slider bind:value={eBeam} min={45} max={110} step={0.5} label="Beam energy [GeV]" format={(v) => v.toFixed(1)} />
      <Slider bind:value={Ne} min={0.5} max={6} step={0.1} label="Electrons per bunch [10¹¹]" format={(v) => v.toFixed(1)} />
      <Slider bind:value={nbE} min={1} max={8} step={1} label="Bunches per beam" format={(v) => v.toFixed(0)} />
      <Slider bind:value={sigX} min={100} max={300} step={5} label="Horizontal beam size σx* [µm]" format={(v) => v.toFixed(0)} />
      <Slider bind:value={sigY} min={1} max={8} step={0.5} label="Vertical beam size σy* [µm]" format={(v) => v.toFixed(1)} />
      <Slider bind:value={vrf} min={0.2} max={4} step={0.1} label="Total RF voltage [GV]" format={(v) => v.toFixed(1)} />
    {/if}
  {/snippet}

  <div class="hero">
    <div class="big" role="status" aria-live="polite">
      <span class="lbl ui">Instantaneous luminosity</span>
      <span class="val">{fmtSci(lumi, 3)} <small>cm⁻² s⁻¹</small></span>
      <span class="sub ui">
        {#if isLep}{f(lumi / 1e32, 2)}× the ≈10³² that LEP reached{:else}{f(lumi / 1e34, 2)}× the LHC design value (10³⁴){/if}
      </span>
    </div>
    <dl class="cells ui">
      {#if !isLep}
        <div><dt>Beam size at the collision point σ*</dt><dd>{f(sStar, 1)} µm</dd></div>
        <div><dt>Geometric factor F (crossing angle)</dt><dd>{f(F, 3)}</dd></div>
        <div><dt>Collisions per crossing μ</dt><dd>{f(mu, 1)}</dd></div>
        <div><dt>Collisions per second</dt><dd>{fmtSci(collisionsPerSecond, 2)}</dd></div>
        <div><dt>Integrated luminosity per day</dt><dd>{f(perDay, 2)} fb⁻¹</dd></div>
      {:else}
        <div><dt>Beam current (per beam)</dt><dd>{f(current_mA, 2)} mA</dd></div>
        <div><dt>Events per hour of a 10 pb process (the order of W⁺W⁻ pairs at LEP2)</dt><dd>{f(lumi * 10e-36 * 3600, 1)}</dd></div>
        <div><dt>Pile-up</dt><dd>none: one e⁺e⁻ collision at most</dd></div>
      {/if}
      <div><dt>Energy stored in one beam</dt><dd>{stored >= 1 ? f(stored, 0) + ' MJ' : f(stored * 1000, 1) + ' kJ'}</dd></div>
    </dl>
  </div>

  {#if !isLep && fill}
    <p class="small ui">
      Integrated luminosity per day assumes one 20 h "other losses" lifetime, the burn-off of protons in collisions at two experiments, and a 3 h turnaround between fills: the best
      fill is {f(fill.fillLength / 3600, 1)} h long and gives {f(cm2ToInvFb(fill.integrated), 3)} fb⁻¹ ({f(fill.averageLumi / lumiHadron * 100, 0)}% of the peak on average).
    </p>
  {/if}

  <h5 class="ui">{isLep ? 'One bunch crossing' : `One bunch crossing: ${crossing.k} collision${crossing.k === 1 ? '' : 's'} at once`}</h5>
  <svg viewBox="0 0 {CW} {CH}" class="plot" role="img" aria-label="Schematic of one bunch crossing seen from the side: {crossing.k} collision vertices along the beam axis, each with tracks.">
    <rect x="30" y="20" width={CW - 60} height={CH - 40} rx="8" class="det" />
    <line x1="14" x2={CW - 14} y1={CH / 2} y2={CH / 2} class="beam" />
    {#each crossing.tracks as vs, vi}
      {#each vs as t}
        <line x1={cz(t.z)} y1={CH / 2} x2={cz(t.z) + Math.sin(t.a) * t.len * 0.7} y2={CH / 2 - Math.cos(t.a) * t.len * (vi % 2 ? -1 : 1)} class="trk" />
      {/each}
    {/each}
    {#each crossing.zs as z, i}
      <circle cx={cz(z)} cy={CH / 2} r={i === 0 ? 4.5 : 3} class={i === 0 ? 'hard' : 'pu'} />
    {/each}
    <text x="36" y="14" class="lbl2">beam axis (z); ● hard scatter{isLep ? '' : ', ○ pile-up'}; luminous region σz ≈ {f(crossing.sz, 0)} mm</text>
  </svg>
  <div class="bar ui"><Button size="sm" onclick={() => (seed += 1)}>Another crossing</Button></div>

  <h5 class="ui">Energy in the beam</h5>
  <p class="ui analog">
    <strong>{stored >= 1 ? f(stored, 0) + ' MJ' : f(stored * 1000, 1) + ' kJ'}</strong>
    = {tntKg(stored) >= 1 ? f(tntKg(stored), 0) + ' kg' : f(tntKg(stored) * 1000, 0) + ' g'} of TNT
    = a 400-tonne train at {f(speed, 0)} km/h{#if stored > 10} = enough to melt {f(copperMeltedKg(stored), 0)} kg of copper{/if}.
    {#if !isLep}The LHC holds two beams of this size, and the beam dump is built to absorb one safely.{:else}A LEP beam stored far less: the energy that mattered there was the radiated power.{/if}
  </p>

  <h5 class="ui">Energy radiated per particle per turn (same radius {f(rho, 0)} m)</h5>
  <svg viewBox="0 0 {BW} {BH}" class="plot" role="img" aria-label="Bar chart on a logarithmic axis of the energy radiated per turn. {bars.map((b) => `${b.label}: ${b.v.toExponential(1)} eV`).join('. ')}.">
    {#each ticks as t}
      <line x1={bx(10 ** t)} x2={bx(10 ** t)} y1="6" y2={BH - 26} class="grid" />
      <text x={bx(10 ** t)} y={BH - 11} text-anchor={t === 18 ? "end" : t === -6 ? "start" : "middle"} class="tick">{tickLabel[t]}</text>
    {/each}
    {#each bars as b, i}
      <text x={BPL} y={14 + i * 46} class="barlbl">{b.label}</text>
      <rect x={BPL} y={19 + i * 46} width={Math.max(2, bx(b.v) - BPL)} height="14" class="barr b{i}" />
      <text x={bx(b.v) > BW - 130 ? bx(b.v) - 6 : bx(b.v) + 6} y={31 + i * 46} text-anchor={bx(b.v) > BW - 130 ? 'end' : 'start'} class="barval" class:inbar={bx(b.v) > BW - 130}>{fmtSci(b.v, 2)} eV</text>
    {/each}
    <line x1={bx(E_GeV * 1e9)} x2={bx(E_GeV * 1e9)} y1="4" y2={BH - 26} class="own"><title>the beam energy per particle</title></line>
  </svg>
  <p class="small ui">
    The dashed line is the particle's own energy ({f(E_GeV, 0)} GeV). {#if !isLep}An electron in this ring at this energy would radiate {fmtSci(uE / (E_GeV * 1e9), 2)} times its own energy every turn: it could not be accelerated at all.
    The proton loses {f(uP / 1e3, 1)} keV per turn, and the critical photon energy is {f(eCrit, 0)} eV (ultraviolet).
    {:else}
    Radiation costs {f(uE / 1e9, 2)} GeV per turn ({f((uE / (E_GeV * 1e9)) * 100, 1)}% of the beam energy) and {f(power_MW, 1)} MW of RF power at this current; critical photon energy {f(eCrit / 1e6, 2)} MeV.
    <strong class:okv={vrf * 1e9 >= uE} class:badv={vrf * 1e9 < uE}>{vrf * 1e9 >= uE ? '✓ The RF system can replace it.' : '✗ The RF voltage is below the loss: the beam cannot be held at this energy.'}</strong>
    {/if}
  </p>
</Widget>

<style>
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    gap: 1rem 1.4rem;
    align-items: center;
  }
  @media (max-width: 720px) {
    .hero {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .big {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--line-strong);
    border-left: 4px solid var(--sig-high);
    border-radius: 6px;
    background: var(--surface);
  }
  .lbl {
    font-size: 0.76rem;
    color: var(--mute);
  }
  .val {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.15;
  }
  .val small {
    font-size: 0.75rem;
    color: var(--mute);
    font-weight: 400;
  }
  .sub {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 0.45rem 0.9rem;
    margin: 0;
  }
  .cells div {
    border-left: 2px solid var(--line-strong);
    padding-left: 0.5rem;
  }
  dt {
    font-size: 0.72rem;
    color: var(--mute);
    line-height: 1.25;
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.88rem;
    font-variant-numeric: tabular-nums;
  }
  dd small {
    color: var(--mute);
  }
  h5 {
    margin: 1rem 0 0.35rem;
    font-size: 0.82rem;
    color: var(--ink-2);
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
  }
  .small {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.4rem 0 0;
  }
  .analog {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.5;
  }
  .plot {
    display: block;
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .bar {
    margin-top: 0.4rem;
  }
  .det {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 1.5;
    stroke-dasharray: 6 4;
  }
  .beam {
    stroke: var(--ink-3);
    stroke-width: 1.5;
  }
  .trk {
    stroke: var(--p-hit);
    stroke-width: 1;
    opacity: 0.8;
  }
  .hard {
    fill: var(--sig-high);
    stroke: var(--fg);
    stroke-width: 1.5;
  }
  .pu {
    fill: var(--panel);
    stroke: var(--series-1);
    stroke-width: 1.6;
  }
  .lbl2 {
    fill: var(--ink-2);
    font-size: 11px;
  }
  .grid {
    stroke: var(--grid);
  }
  .tick {
    fill: var(--ink-3);
    font-size: 10.5px;
  }
  .barr {
    fill: var(--series-1);
  }
  .barr.b1 {
    fill: var(--series-2);
  }
  .barr.b2 {
    fill: var(--series-7);
  }
  .barlbl {
    font-size: 11.5px;
    font-weight: 600;
    fill: var(--fg);
  }
  .barval.inbar {
    fill: var(--on-accent);
  }
  .barval {
    fill: var(--fg);
    font-size: 11px;
    font-family: var(--font-mono);
  }
  .own {
    stroke: var(--fg);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }
  .okv {
    color: var(--ok);
  }
  .badv {
    color: var(--bad);
  }
</style>
