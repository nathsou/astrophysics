<!--
  The shower lab: fire an electron, a photon, a pion or a muon into a block of lead, iron, copper or water and see what happens.

    ::shower-lab{n="6.3" caption="…"}     props: particle (e | gamma | pi | mu), material (Pb | Fe | Cu | H2O), energy (GeV), seed

  Electromagnetic showers: Heitler's toy model (`heitlerShower`, or the reader's version when "use my code" is on) for the numbers of
  particles, and the gamma-distribution profile of `hep/detector` for the energy deposited against depth. Hadronic showers: the
  gamma-distribution profile in nuclear interaction lengths, with a random depth for the first interaction. Muons: the mean energy loss
  (Bethe–Bloch plus radiative) and the range. All from the course's detector module; none of it is a full simulation.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LinePlot from './LinePlot.svelte';
  import { heitlerShower, longitudinalFraction, materials, criticalEnergy, moliereRadius, muonEnergyAfter, muonRange, muonStoppingPower, hadronShape, M_MU, type HeitlerShower } from '../../hep/detector/index.ts';
  import { hook } from '../../hep/hooks.ts';
  import { rng as makeRng, exponential } from '../../hep/random/index.ts';
  import { emContainmentDepth, hadronContainmentDepth, hadronFraction, hadronProfile, longitudinalProfile } from './matter.ts';
  import { savedFor, useMine } from './mine.ts';

  let {
    n: figNo,
    caption,
    title = 'Shower lab',
    particle: p0 = 'e',
    material: m0 = 'Pb',
    energy: e0 = 50,
    seed: seed0 = 1,
  }: { n?: string | number; caption?: string; title?: string; particle?: string; material?: string; energy?: number; seed?: number } = $props();

  type Kind = 'e' | 'gamma' | 'pi' | 'mu';
  let kind = $state<Kind>(untrack(() => (['e', 'gamma', 'pi', 'mu'].includes(p0) ? (p0 as Kind) : 'e')));
  let mat = $state(untrack(() => (['Pb', 'Fe', 'Cu', 'H2O'].includes(m0) ? m0 : 'Pb')));
  let logE = $state(untrack(() => Math.log10(Math.min(1000, Math.max(0.5, Number(e0))))));
  let sharing = $state<'equal' | 'random'>('equal');
  let logDepth = $state(Math.log10(25));
  let seed = $state(untrack(() => seed0));
  let mineAvailable = $state(false);
  let useMineOn = $state(false);
  let mineNote = $state('');
  let version = $state(0);

  onMount(() => {
    mineAvailable = savedFor(['detector.heitlerShower']).length > 0;
    return () => {
      useMine(['detector.heitlerShower'], false);
    };
  });
  function toggleMine(on: boolean) {
    const r = useMine(['detector.heitlerShower'], on);
    const err = r.errors['detector.heitlerShower'];
    mineNote = err ? `Your code failed to load (${err}); the library's shower is used.` : on ? 'The numbers of particles come from your heitlerShower.' : '';
    version++;
  }

  const E = $derived(10 ** logE);
  const depthCm = $derived(10 ** logDepth);
  const M = $derived(materials[mat]!);
  const Ec = $derived(criticalEnergy(M)); // GeV
  const X0 = $derived(M.X0cm);
  const lam = $derived(M.lambdaIcm);
  const RM = $derived(moliereRadius(M));
  const isEM = $derived(kind === 'e' || kind === 'gamma');

  const fmt = (v: number, d = 3) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(d - 1));
  const fmtE = (v: number) => (v >= 1 ? `${fmt(v)} GeV` : `${(v * 1000).toFixed(v * 1000 < 10 ? 1 : 0)} MeV`);

  // ── electromagnetic ──
  const heitler = $derived.by((): HeitlerShower | null => {
    void version;
    if (!isEM) return null;
    const fn = hook('detector.heitlerShower', heitlerShower);
    // with a random split the library tracks every particle: beyond ~10⁵ particles use the analytic (equal-split) model
    const r = makeRng(seed);
    try {
      return sharing === 'random' && E / Ec < 40_000 ? fn(E, Ec, r) : fn(E, Ec);
    } catch (e) {
      return null;
    }
  });
  const kEm = $derived(kind === 'gamma' ? 'photon' : 'electron');
  const tGrid = $derived.by(() => {
    const tmax = Math.max(6, Math.log(E / Ec) + 12);
    return Array.from({ length: 121 }, (_, i) => (tmax * i) / 120);
  });
  const emProfile = $derived(tGrid.map((t) => longitudinalProfile(E, t, Ec, kEm)));
  const emDepth95 = $derived(emContainmentDepth(E, Ec, 0.95, kEm));
  const tmaxPar = $derived(Math.log(E / Ec) + (kind === 'gamma' ? 0.5 : -0.5));
  const emContained = $derived(longitudinalFraction(E, Ec, 0, depthCm / X0, kEm));

  // ── hadronic ──
  const lGrid = $derived(Array.from({ length: 121 }, (_, i) => (Math.max(6, hadronContainmentDepth(E, 0.999)) * i) / 120));
  const hadProfile = $derived(lGrid.map((l) => hadronProfile(E, l)));
  const hadDepth95 = $derived(hadronContainmentDepth(E, 0.95));
  const start = $derived(exponential(makeRng(seed + 7), 1)); // depth of the first nuclear interaction, in λI
  const hadContained = $derived(hadronFraction(E, 0, depthCm / lam - start));
  const lmax = $derived(hadronShape(E).a - 1);

  // ── muon ──
  const Emu = $derived(Math.sqrt(E * E + M_MU * M_MU));
  const muDedx = $derived(muonStoppingPower(M, Emu) * M.density * 1e-3); // GeV/cm
  const muGrid = $derived(Array.from({ length: 81 }, (_, i) => (Math.max(60, depthCm * 1.5) * i) / 80));
  const muLoss = $derived(muGrid.map((d) => (Emu - muonEnergyAfter(M, d * M.density, Emu)) * 1 || 0));
  const muRange = $derived(muonRange(M, E));
  const muLostHere = $derived(Emu - muonEnergyAfter(M, depthCm * M.density, Emu));

  const contained = $derived(isEM ? emContained : kind === 'pi' ? Math.max(0, hadContained) : 0);

  // ── the picture of the first generations (Heitler) ──
  const tree = $derived.by(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; photon: boolean; g: number }[] = [];
    const maxG = 5;
    const W = 640, H = 206; // the tree spans ±(45 + 22.5 + 11 + 6 + 3) = ±87 about the middle of the area above the labels
    const dx = 100;
    const go = (g: number, x: number, y: number, isPhoton: boolean, spread: number) => {
      if (g >= maxG) return;
      const x2 = x + dx;
      if (!isPhoton) {
        // electron → electron + photon
        out.push({ x1: x, y1: y, x2, y2: y - spread, photon: false, g }, { x1: x, y1: y, x2, y2: y + spread, photon: true, g });
        go(g + 1, x2, y - spread, false, spread / 2);
        go(g + 1, x2, y + spread, true, spread / 2);
      } else {
        out.push({ x1: x, y1: y, x2, y2: y - spread, photon: false, g }, { x1: x, y1: y, x2, y2: y + spread, photon: false, g });
        go(g + 1, x2, y - spread, false, spread / 2);
        go(g + 1, x2, y + spread, false, spread / 2);
      }
    };
    go(0, 20, (H - 18) / 2, kind === 'gamma', 45);
    return { lines: out, W, H };
  });
  const genPoints = $derived(heitler ? heitler.generations.map((g) => ({ x: g.depthX0, y: g.count, color: 'var(--series-2)' })) : []);
  const genLine = $derived(heitler ? { x: heitler.generations.map((g) => g.depthX0), y: heitler.generations.map((g) => g.count) } : { x: [], y: [] });
  const SHORT: Record<string, string> = { e: 'electron', gamma: 'photon', pi: 'pion', mu: 'muon' };
</script>

<Widget {title} n={figNo} {caption} kind="Explore">
  {#snippet controls()}
    <Segmented
      label="Particle"
      options={[
        { value: 'e', label: 'electron' },
        { value: 'gamma', label: 'photon' },
        { value: 'pi', label: 'pion' },
        { value: 'mu', label: 'muon' },
      ]}
      bind:value={kind}
    />
    <Segmented
      label="Material"
      options={[
        { value: 'Pb', label: 'lead' },
        { value: 'Fe', label: 'iron' },
        { value: 'Cu', label: 'copper' },
        { value: 'H2O', label: 'water' },
      ]}
      bind:value={mat}
    />
    <Slider bind:value={logE} min={-0.3} max={3} step={0.02} label={kind === 'mu' ? 'Muon momentum' : 'Energy'} format={(v) => fmtE(10 ** v)} />
    <Slider bind:value={logDepth} min={0} max={3} step={0.02} label="Absorber thickness" format={(v) => `${(10 ** v).toFixed(10 ** v < 10 ? 1 : 0)} cm`} />
    {#if isEM}<Segmented label="Energy sharing" options={[{ value: 'equal', label: 'equal halves (Heitler)' }, { value: 'random', label: 'random shares' }]} bind:value={sharing} />{/if}
    <Button onclick={() => (seed += 1)}>Fire again (seed {seed})</Button>
    {#if mineAvailable && isEM}<Toggle bind:checked={useMineOn} label="use my code (heitlerShower)" onchange={toggleMine} />{/if}
  {/snippet}

  <p class="ui lead">
    A <strong>{fmtE(E)} {SHORT[kind]}</strong> in <strong>{M.label.toLowerCase()}</strong>
    (X₀ = {fmt(X0)} cm, λ<sub>I</sub> = {fmt(lam)} cm, E<sub>c</sub> = {fmtE(Ec)}, Molière radius {fmt(RM)} cm).
  </p>

  {#if isEM && heitler}
    <div class="grid">
      <div>
        <h5 class="ui">Heitler's cascade: the first five splittings</h5>
        <svg viewBox="0 0 {tree.W} {tree.H}" role="img" aria-label="The first generations of an electromagnetic cascade: each electron splits into an electron and a photon, each photon into an electron and a positron" class="tree">
          {#each tree.lines as l}
            <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.photon ? 'var(--p-photon)' : 'var(--p-electron)'} stroke-width={l.photon ? 1.6 : 2.2} stroke-dasharray={l.photon ? '5 3' : undefined} opacity={1 - l.g * 0.1} />
          {/each}
          {#each [0, 1, 2, 3, 4, 5] as g}
            <text x={20 + g * 100} y={tree.H - 4} text-anchor="middle" class="tl">{g === 0 ? 'E₀' : `E₀/${2 ** g}`}</text>
          {/each}
        </svg>
        <p class="ui small"><span class="key e"></span> electron or positron <span class="key g"></span> photon. Every splitting takes one splitting length, ln 2 × X₀ = {fmt(Math.LN2 * X0)} cm of {M.label.toLowerCase()}, and halves the energy per particle.</p>
      </div>
      <div>
        <h5 class="ui">Particles in each generation ({sharing === 'equal' ? 'equal halves' : 'random shares'})</h5>
        <LinePlot
          lines={[{ x: genLine.x, y: genLine.y, label: 'particles', dash: '' }]}
          points={genPoints}
          vmarks={[{ value: heitler.tMaxX0, label: 'maximum', color: 'var(--mute)' }]}
          x={{ domain: [0, Math.max(6, heitler.generations.at(-1)!.depthX0 * 1.05)], label: 'depth [X₀]' }}
          y={{ type: 'log', domain: [0.8, Math.max(10, heitler.nMax * 3)], label: 'number of particles' }}
          height={200}
          legend={false}
          label="Number of particles in each generation of the Heitler cascade against depth in radiation lengths"
        />
        <p class="ui small">
          Maximum after <strong>{heitler.maxGeneration}</strong> splittings, at <strong>{fmt(heitler.tMaxX0)} X₀</strong> ({fmt(heitler.tMaxX0 * X0)} cm), with <strong>{heitler.nMax.toLocaleString('en-GB')}</strong> particles
          (E₀/E<sub>c</sub> = {(E / Ec).toFixed(0)}{sharing === 'equal' ? `; the model says N = E₀/E_c at depth X₀ ln(E₀/E_c) = ${fmt(Math.log(E / Ec))} X₀, rounded up to a whole splitting length` : ''}). Total deposited: {fmt(heitler.totalDeposited)} GeV of {fmt(E)} GeV.
        </p>
      </div>
    </div>
    <h5 class="ui">Energy deposited against depth</h5>
    <LinePlot
      lines={[{ x: tGrid, y: emProfile, label: 'dE/dt', dash: '', fill: true }]}
      vmarks={[
        { value: tmaxPar, label: 'maximum', color: 'var(--mute)' },
        { value: emDepth95, label: '95 %', color: 'var(--series-2)' },
        { value: depthCm / X0, label: 'your block', color: 'var(--series-3)', dash: '2 3' },
      ]}
      x={{ domain: [0, tGrid.at(-1)!], label: 'depth [X₀]' }}
      y={{ domain: [0, Math.max(...emProfile) * 1.1], label: 'dE/dt [GeV per X₀]', format: (v) => Number(v.toPrecision(2)).toString() }}
      height={210}
      legend={false}
      label="Energy deposited per radiation length against depth, with the depth of the shower maximum and the depth containing 95 percent"
    />
    <p class="ui out">
      Shower maximum at {fmt(tmaxPar)} X₀ = {fmt(tmaxPar * X0)} cm; 95 % contained by {fmt(emDepth95)} X₀ = <strong>{fmt(emDepth95 * X0)} cm</strong>.
      A block of {depthCm.toFixed(depthCm < 10 ? 1 : 0)} cm ({fmt(depthCm / X0)} X₀) contains <strong>{(100 * emContained).toFixed(1)} %</strong> of the energy: {fmt(E * (1 - emContained))} GeV leaves the back.
    </p>
  {:else if isEM}
    <p class="ui out">The toy shower could not be built for this energy (too many particles for the random version).</p>
  {:else if kind === 'pi'}
    <h5 class="ui">A hadronic shower: energy against depth in interaction lengths</h5>
    <LinePlot
      lines={[{ x: lGrid, y: hadProfile, label: 'dE/dl', dash: '', fill: true }]}
      vmarks={[
        { value: lmax, label: 'maximum', color: 'var(--mute)' },
        { value: hadDepth95, label: '95 %', color: 'var(--series-2)' },
        { value: depthCm / lam, label: 'your block', color: 'var(--series-3)', dash: '2 3' },
      ]}
      x={{ domain: [0, lGrid.at(-1)!], label: 'depth [λ_I]' }}
      y={{ domain: [0, Math.max(...hadProfile) * 1.1], label: 'dE/dl [GeV per λ_I]', format: (v) => Number(v.toPrecision(2)).toString() }}
      height={230}
      legend={false}
      label="Energy deposited per nuclear interaction length against depth for a hadronic shower"
    />
    <p class="ui out">
      This pion's first nuclear interaction is at {start.toFixed(2)} λ<sub>I</sub> = {fmt(start * lam)} cm (an exponential draw: the same pion would have gone deeper or shallower another day). The shower
      maximum is about {fmt(lmax)} λ<sub>I</sub> deeper, and 95 % of the energy is contained within {fmt(hadDepth95)} λ<sub>I</sub> = <strong>{fmt(hadDepth95 * lam)} cm</strong> of the interaction.
      Your block of {depthCm.toFixed(depthCm < 10 ? 1 : 0)} cm ({fmt(depthCm / lam)} λ<sub>I</sub>) contains <strong>{(100 * Math.max(0, hadContained)).toFixed(1)} %</strong>. Note the scale: in lead λ<sub>I</sub> is {fmt(materials.Pb!.lambdaIcm)} cm but X₀ is {fmt(materials.Pb!.X0cm)} cm.
    </p>
  {:else}
    <h5 class="ui">A muon loses energy slowly and steadily</h5>
    <LinePlot
      lines={[{ x: muGrid, y: muLoss, label: 'energy lost', dash: '' }]}
      vmarks={[{ value: depthCm, label: 'your block', color: 'var(--series-3)', dash: '2 3' }]}
      x={{ domain: [0, muGrid.at(-1)!], label: 'thickness of material [cm]' }}
      y={{ domain: [0, Math.max(1e-6, ...muLoss) * 1.1], label: 'energy lost [GeV]', format: (v) => Number(v.toPrecision(2)).toString() }}
      height={230}
      legend={false}
      label="Mean energy lost by a muon against thickness of material"
    />
    <p class="ui out">
      Mean loss {(muDedx * 1000).toFixed(muDedx * 1000 < 10 ? 2 : 1)} MeV per cm at this energy. Through {depthCm.toFixed(depthCm < 10 ? 1 : 0)} cm it loses <strong>{fmt(muLostHere)} GeV</strong>
      ({(100 * muLostHere / Emu).toFixed(1)} % of its energy) and comes out with {fmt(Emu - muLostHere)} GeV; there is no shower. Its mean range in {M.label.toLowerCase()} would be
      <strong>{muRange >= 100 ? (muRange / 100).toFixed(muRange > 1000 ? 0 : 1) + ' m' : muRange.toFixed(0) + ' cm'}</strong>.
    </p>
  {/if}
  {#if mineNote}<p class="ui small">{mineNote}</p>{/if}
  {#if kind !== 'mu'}
    <div class="gauge ui" role="img" aria-label="Fraction of the energy contained in the block: {(100 * contained).toFixed(0)} percent">
      <div class="bar" style:width="{100 * contained}%"></div>
      <span>{(100 * contained).toFixed(1)} % contained</span>
    </div>
  {/if}
</Widget>

<style>
  .lead {
    margin: 0 0 0.6rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.2rem;
    margin-bottom: 0.6rem;
  }
  @media (max-width: 820px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  h5 {
    margin: 0.4rem 0 0.3rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
    font-weight: 500;
  }
  .small {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin: 0.3rem 0 0;
  }
  .out {
    margin: 0.4rem 0;
    font-size: 0.88rem;
  }
  .tree {
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .tl {
    font-size: 11px;
    fill: var(--ink-2);
  }
  .key {
    display: inline-block;
    width: 1.3rem;
    height: 0;
    border-top: 3px solid;
    vertical-align: middle;
    margin: 0 0.2rem 0 0.5rem;
  }
  .key.e {
    border-color: var(--p-electron);
  }
  .key.g {
    border-color: var(--p-photon);
    border-top-style: dashed;
  }
  .gauge {
    position: relative;
    height: 1.6rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--pn);
    overflow: hidden;
    margin-top: 0.6rem;
  }
  .bar {
    position: absolute;
    inset: 0 auto 0 0;
    background: color-mix(in srgb, var(--phosphor) 35%, transparent);
    border-right: 2px solid var(--phosphor);
  }
  .gauge span {
    position: relative;
    display: block;
    text-align: center;
    line-height: 1.5rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--fg);
  }
</style>
