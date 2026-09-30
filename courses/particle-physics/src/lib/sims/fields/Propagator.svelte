<!--
  Virtual-particle exchange as a Yukawa potential (Chapter 14).

    ::propagator{n="14.3" caption="…"}

  Tab 1: for a chosen mass of the exchanged particle, the propagator 1/(q² + m²) and its Fourier transform, the Yukawa
  potential e^{−r/R}/r with range R = ħc/(mc²), compared with the massless 1/r (the photon). The pion (about 140 MeV)
  gives 1.4 fm. Tab 2: Yukawa's 1935 argument run backwards: from the range of the nuclear force to the mass of the
  mediator, with ħc = 197.327 MeV fm.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { particle } from '$lib/hep/particles';
  import { massFromRangeMeV, massInElectronMasses, propagator, rangeFm, virtualLifetimeS, yukawaShape } from '$lib/hep/fields';
  import { fmt, pow10 } from './canvas';

  let { n, caption, title = 'Exchange of a massive particle: range and the Yukawa potential' }: { n?: string | number; caption?: string; title?: string } = $props();

  let tab = $state<'range' | 'invert'>('range');
  let mass = $state(139.57); // MeV
  let rangeIn = $state(1.4); // fm

  const PRESETS = [
    { label: 'electron', mev: particle(11).mass * 1000 },
    { label: 'pion π±', mev: particle(211).mass * 1000 },
    { label: 'ρ meson', mev: particle(113).mass * 1000 },
    { label: 'W boson', mev: particle(24).mass * 1000 },
  ];
  const fmMass = (v: number) => (v < 10 ? v.toFixed(2) : v < 1000 ? v.toFixed(0) : (v / 1000).toFixed(v < 1e4 ? 2 : 1)) + (v < 1000 ? ' MeV' : ' GeV');

  const R = $derived(rangeFm(mass));
  const dt = $derived(virtualLifetimeS(mass));
  const rGrid = Array.from({ length: 160 }, (_, i) => 0.03 * 10 ** ((i / 159) * Math.log10(30 / 0.03)));
  const yuk = $derived(rGrid.map((r) => ({ r, y: Math.max(1e-300, yukawaShape(r, mass)) })));
  const coul = rGrid.map((r) => ({ r, y: 1 / r }));
  const path = (pts: { r: number; y: number }[], sx: (v: number) => number, sy: (v: number) => number, clipLo = 1e-6) =>
    pts
      .filter((p) => p.y > clipLo)
      .map((p, i) => `${i ? 'L' : 'M'}${sx(p.r).toFixed(1)},${sy(p.y).toFixed(1)}`)
      .join('');

  // propagator in momentum space: q in units of the mass, so the shape is the same for every mass; axis in MeV
  const qGrid = Array.from({ length: 120 }, (_, i) => 10 ** (-1 + (i / 119) * 4.5)); // 0.1 … 3000 MeV, fixed
  const prop = $derived(qGrid.map((q) => ({ q, y: propagator(q, mass) })));
  const propMassless = qGrid.map((q) => ({ q, y: 1 / (q * q) }));
  const ppath = (pts: { q: number; y: number }[], sx: (v: number) => number, sy: (v: number) => number) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.q).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');

  // inversion
  const mInv = $derived(massFromRangeMeV(rangeIn));
  const nearest = $derived.by(() => {
    const cand = [211, 321, 113, 223, 221, 13, 333, 2212].map((id) => particle(id));
    let best = cand[0]!;
    for (const c of cand) if (Math.abs(Math.log(c.mass * 1000 / mInv)) < Math.abs(Math.log(best.mass * 1000 / mInv))) best = c;
    return best;
  });
</script>

<Widget {title} {n} {caption} kind="Explore">
  {#snippet controls()}
    <Segmented
      label="Which view"
      size="sm"
      bind:value={tab}
      options={[
        { value: 'range', label: 'Mass → range' },
        { value: 'invert', label: 'Range → mass (Yukawa, 1935)' },
      ]}
    />
    {#if tab === 'range'}
      <Slider bind:value={mass} min={0.5} max={100000} log label="Mass of the exchanged particle, mc²" format={fmMass} />
    {:else}
      <Slider bind:value={rangeIn} min={0.2} max={6} step={0.05} label="Range of the force, R" format={(v) => v.toFixed(2) + ' fm'} />
    {/if}
  {/snippet}

  {#if tab === 'range'}
    <div class="presets ui" role="group" aria-label="Choose a particle">
      {#each PRESETS as p}
        <button type="button" class:on={Math.abs(Math.log(mass / p.mev)) < 0.01} onclick={() => (mass = p.mev)}>{p.label}</button>
      {/each}
    </div>

    <div class="grid">
      <div>
        <h5 class="ui">In momentum space: the propagator</h5>
        <Plot
          height={230}
          label="The propagator 1 over q squared plus m squared against momentum q on logarithmic axes, flat below q equal to the mass and falling as 1 over q squared above it, compared with the massless propagator."
          x={{ type: 'log', domain: [0.1, 3000], label: 'momentum transfer q [MeV]', tickValues: [1, 10, 100, 1000], format: pow10 }}
          y={{ type: 'log', domain: [1e-7, 10], label: '1/(q² + m²) [MeV⁻²]', tickValues: [1e-6, 1e-4, 1e-2, 1], format: pow10 }}
        >
          {#snippet marks({ sx, sy })}
            <path d={ppath(propMassless, sx, sy)} class="line" stroke="var(--series-8)" stroke-dasharray="6 4" />
            <path d={ppath(prop, sx, sy)} class="line" stroke="var(--series-1)" />
            <line x1={sx(mass)} x2={sx(mass)} y1="0" y2="1000" stroke="var(--series-7)" stroke-dasharray="2 3" />
          {/snippet}
        </Plot>
      </div>
      <div>
        <h5 class="ui">In space: the Yukawa potential</h5>
        <Plot
          height={230}
          label="The Yukawa shape e to the minus r over R, divided by r, against distance r on logarithmic axes. It follows 1 over r inside the range R and falls away beyond it, compared with the massless 1 over r."
          x={{ type: 'log', domain: [0.03, 30], label: 'distance r [fm]', tickValues: [0.1, 1, 10], format: pow10 }}
          y={{ type: 'log', domain: [1e-4, 40], label: 'e^(−r/R)/r [fm⁻¹]', tickValues: [1e-3, 1e-2, 0.1, 1, 10], format: pow10 }}
        >
          {#snippet marks({ sx, sy })}
            <path d={path(coul, sx, sy)} class="line" stroke="var(--series-8)" stroke-dasharray="6 4" />
            <path d={path(yuk, sx, sy, 1e-5)} class="line" stroke="var(--series-1)" />
            <line x1={sx(R)} x2={sx(R)} y1="0" y2="1000" stroke="var(--series-7)" stroke-dasharray="2 3" />
            {#if R > 0.03 && R < 30}
              <text x={sx(R) + 4} y="14" class="mark">R = {fmt(R, 3)} fm</text>
            {/if}
          {/snippet}
        </Plot>
      </div>
    </div>
    <ul class="key ui">
      <li><span class="sw solid"></span> massive exchange (this mass)</li>
      <li><span class="sw dash"></span> massless exchange, the photon: 1/q² and 1/r at every distance</li>
      <li><span class="sw dot"></span> q = mc² (left) and r = R (right)</li>
    </ul>

    <dl class="out ui" aria-live="polite">
      <div><dt>mass mc²</dt><dd>{fmMass(mass)} <small>= {fmt(massInElectronMasses(mass), 3)} electron masses</small></dd></div>
      <div><dt>range R = ħc/mc²</dt><dd>{R >= 1 ? fmt(R, 3) + ' fm' : fmt(R * 1e3, 3) + ' × 10⁻³ fm'}</dd></div>
      <div><dt>time the quantum can exist, ħ/mc²</dt><dd>{fmt(dt, 3)} s</dd></div>
    </dl>
    <p class="note ui">
      The Fourier transform of 1/(q² + m²) in three dimensions is e<sup>−mr</sup>/(4πr) (with r in units of ħ/mc). So an exchanged particle of mass m gives a force that looks like the photon's 1/r inside a distance R = ħc/mc² and dies away exponentially outside it. The same can be read as borrowed energy: to exist at all, the particle needs energy mc², which the uncertainty principle allows for a time of about ħ/mc², during which it can travel at most c times that, which is R. A massless photon can be exchanged over any distance, which is why the electric force has infinite range.
    </p>
  {:else}
    <div class="invert">
      <p class="ui lead">
        In 1935 Hideki Yukawa asked what kind of particle, exchanged between protons and neutrons, could make a force that is strong but reaches only as far as the nucleus. Run the argument backwards: the nuclear force is felt out to about 1 to 2 fm, so the exchanged particle has
        mc² = ħc/R.
      </p>
      <div class="big ui" aria-live="polite">
        <div class="eq">
          <span class="lab">mc² = ħc / R</span>
          <span class="num">197.327 MeV fm / {rangeIn.toFixed(2)} fm = <strong>{fmt(mInv, 4)} MeV</strong></span>
        </div>
        <div class="eq">
          <span class="lab">in electron masses</span>
          <span class="num"><strong>{fmt(massInElectronMasses(mInv), 3)}</strong> × m<sub>e</sub></span>
        </div>
        <div class="eq">
          <span class="lab">nearest known particle in the table</span>
          <span class="num"><strong>{nearest.symbol}</strong>, {fmt(nearest.mass * 1000, 4)} MeV</span>
        </div>
      </div>
      <Plot
        height={230}
        label="The mass of the mediator in MeV against the range of the force in fm: a hyperbola, with the point for the chosen range marked."
        x={{ domain: [0.2, 6], label: 'range of the force R [fm]', ticks: 6 }}
        y={{ type: 'log', domain: [30, 1000], label: 'mass mc² [MeV]', tickValues: [30, 100, 300, 1000] }}
      >
        {#snippet marks({ sx, sy })}
          <path d={Array.from({ length: 100 }, (_, i) => 0.2 + (i / 99) * 5.8).map((r, i) => `${i ? 'L' : 'M'}${sx(r).toFixed(1)},${sy(massFromRangeMeV(r)).toFixed(1)}`).join('')} class="line" stroke="var(--series-1)" />
          <circle cx={sx(rangeIn)} cy={sy(mInv)} r="5" fill="var(--series-7)" />
          <line x1={sx(1.4)} x2={sx(1.4)} y1={sy(30)} y2={sy(massFromRangeMeV(1.4))} stroke="var(--series-8)" stroke-dasharray="3 3" />
          <text x={sx(1.4) + 6} y={sy(30) - 6} class="mark">1.4 fm</text>
        {/snippet}
      </Plot>
      <p class="note ui">
        A range of 1.4 fm gives about 141 MeV, some 276 electron masses: heavier than an electron, much lighter than a proton. Yukawa predicted a particle of this kind; the charged pion, with a mass of 139.57 MeV/c², was found in cosmic-ray photographic emulsions in 1947. The table's particles are listed only so that you can see which one is nearest; the argument fixes the mass scale, not the particle.
      </p>
    </div>
  {/if}
</Widget>

<style>
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 0.6rem;
  }
  .presets button {
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--ink-2);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    font-size: 0.78rem;
    cursor: pointer;
  }
  .presets button.on {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
  .presets button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
  @media (max-width: 720px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  h5 {
    margin: 0 0 0.2rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink-2);
    text-transform: none;
    letter-spacing: 0;
  }
  .mark {
    font-size: 11px;
    fill: var(--series-7);
  }
  .key {
    list-style: none;
    margin: 0.4rem 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1.2rem;
    font-size: 0.76rem;
    color: var(--ink-2);
  }
  .key li {
    display: flex;
    gap: 0.4rem;
    align-items: baseline;
    margin: 0 !important;
  }
  .sw {
    display: inline-block;
    width: 22px;
    border-top: 2px solid var(--series-1);
    transform: translateY(-3px);
  }
  .sw.dash {
    border-top: 2px dashed var(--series-8);
  }
  .sw.dot {
    border-top: 2px dotted var(--series-7);
  }
  .out {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.6rem;
    margin: 0.6rem 0 0;
  }
  .out div {
    display: flex;
    gap: 0.4rem;
    align-items: baseline;
  }
  dt {
    font-size: 0.78rem;
    color: var(--mute);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    color: var(--fg);
  }
  dd small {
    color: var(--mute);
    font-family: var(--font-ui);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
    margin: 0.6rem 0 0;
  }
  .lead {
    font-size: 0.86rem;
    line-height: 1.5;
    color: var(--ink-2);
    margin: 0 0 0.6rem;
  }
  .big {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-bottom: 0.6rem;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--pn);
  }
  .eq {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1rem;
    align-items: baseline;
  }
  .eq .lab {
    font-size: 0.78rem;
    color: var(--mute);
    min-width: 13rem;
  }
  .eq .num {
    font-family: var(--font-mono);
    font-size: 0.86rem;
    color: var(--fg);
  }
</style>
