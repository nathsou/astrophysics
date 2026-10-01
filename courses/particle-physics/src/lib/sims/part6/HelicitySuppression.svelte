<!--
  Helicity suppression of π → e ν (Chapter 22). The pion has spin 0 and decays at rest to a lepton and a neutrino back to back. The
  weak interaction makes the neutrino left-handed, so the two spins can only cancel if the antilepton is left-handed too, which the
  weak interaction disfavours by a factor that grows as the lepton gets lighter: the rate is ∝ m_ℓ² (1 − m_ℓ²/m_π²)².
  Left: the spins. Right: the rate against the lepton's mass, with the electron, the muon and a slider for a hypothetical lepton.

    ::helicity-suppression{n="22.3" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { particle } from '$lib/hep/particles';
  import { pionDecayLepton, pionLeptonicRatio } from './weak';

  let { n, caption, title = 'Why π → eν is rare' }: { n?: string | number; caption?: string; title?: string } = $props();

  const mpi = particle(211).mass;
  const mE = particle(11).mass, mMu = particle(13).mass;
  let mMeV = $state(105.66);
  const L = $derived(pionDecayLepton(mMeV / 1000));
  const Le = pionDecayLepton(mE);
  const Lmu = pionDecayLepton(mMu);
  const ref = Lmu.rateFactor;
  const curve = Array.from({ length: 160 }, (_, i) => {
    const m = 0.3 * (139 / 0.3) ** (i / 159);
    return { m, r: pionDecayLepton(m / 1000).rateFactor / ref };
  });
  const relRate = $derived(L.rateFactor / ref);
  const maxM = Math.sqrt(1 / 3) * mpi * 1000;
  const fmt = (x: number) => (x === 0 ? '0' : x < 1e-2 ? x.toExponential(2) : x.toPrecision(3));
  const W = 360, H = 190;
</script>

<Widget {title} {n} {caption} kind="Explore" onreset={() => (mMeV = 105.66)}>
  {#snippet controls()}
    <Slider bind:value={mMeV} min={0.3} max={139} step={0.1} log label="Mass of the charged lepton, MeV (electron 0.511, muon 105.7)" format={(v) => v.toFixed(v < 10 ? 2 : 1)} />
  {/snippet}
  <div class="grid">
    <section aria-label="Spins in π⁺ → ℓ⁺ ν">
      <h5 class="ui">π⁺ at rest → ℓ⁺ + ν</h5>
      <svg viewBox="0 0 {W} {H}" role="img" aria-label="The pion, with spin zero, decays into an antilepton flying right and a neutrino flying left. The neutrino's spin points right, so the antilepton's spin must point left, against its motion.">
        <defs>
          <marker id="h-mom" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--ink)" /></marker>
          <marker id="h-spin" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--accent)" /></marker>
        </defs>
        <circle cx={W / 2} cy="70" r="16" fill="var(--panel)" stroke="var(--ink)" stroke-width="2" />
        <text x={W / 2} y="75" text-anchor="middle" class="t">π⁺</text>
        <text x={W / 2} y="100" text-anchor="middle" class="s">spin 0</text>
        <!-- neutrino to the left -->
        <line x1={W / 2 - 22} y1="70" x2="36" y2="70" stroke="var(--p-neutrino)" stroke-width="3" stroke-dasharray="2 4" marker-end="url(#h-mom)" />
        <text x="36" y="56" class="s">ν: momentum</text>
        <line x1="70" y1="92" x2="130" y2="92" stroke="var(--accent)" stroke-width="3.5" marker-end="url(#h-spin)" />
        <text x="36" y="114" class="s">ν spin points right:</text>
        <text x="36" y="127" class="s">left-handed, as V − A wants</text>
        <!-- antilepton to the right -->
        <line x1={W / 2 + 22} y1="70" x2={W - 36} y2="70" stroke="var(--p-electron)" stroke-width="3.5" marker-end="url(#h-mom)" />
        <text x={W - 36} y="56" text-anchor="end" class="s">ℓ⁺: momentum</text>
        <line x1={W - 70} y1="92" x2={W - 130} y2="92" stroke="var(--accent)" stroke-width="3.5" marker-end="url(#h-spin)" />
        <text x={W - 36} y="114" text-anchor="end" class="s">ℓ⁺ spin must point left:</text>
        <text x={W - 36} y="127" text-anchor="end" class="s">the disfavoured helicity</text>
        <text x={W / 2} y="162" text-anchor="middle" class="s">total spin along the axis: 0</text>
      </svg>
      <table class="ui tab">
        <tbody>
          <tr><th scope="row">Lepton speed β</th><td>{L.beta === 0 ? '—' : L.beta < 0.9999 ? L.beta.toFixed(4) : `1 − ${(1 - L.beta).toExponential(2)}`}</td></tr>
          <tr><th scope="row">Chance of the wrong helicity, (1 − β)/2</th><td>{fmt(L.wrongHelicity)}</td></tr>
          <tr><th scope="row">Rate relative to π → μν</th><td><strong>{fmt(relRate)}</strong></td></tr>
        </tbody>
      </table>
    </section>
    <section aria-label="The rate against the lepton mass">
      <h5 class="ui">Decay rate against lepton mass (π → μν = 1)</h5>
      <Plot
        x={{ type: 'log', domain: [0.3, 139], label: 'lepton mass [MeV]', tickValues: [0.5, 1, 3, 10, 30, 100], format: (v) => String(v) }}
        y={{ type: 'log', domain: [1e-6, 3], label: 'Γ / Γ(π → μν)', tickValues: [1e-6, 1e-4, 1e-2, 1], format: (v) => (v === 1 ? '1' : `1e${Math.round(Math.log10(v))}`) }}
        height={240}
        label="Relative rate of pion decay against the lepton's mass: it rises as the mass squared, peaks near 81 MeV and falls to zero at the pion mass"
        crosshair={false}
      >
        {#snippet marks({ sx, sy })}
          <path d={curve.map((p, i) => `${i ? 'L' : 'M'}${sx(p.m)},${sy(Math.max(p.r, 1e-7))}`).join('')} fill="none" stroke="var(--series-1)" stroke-width="2.2" />
          <line x1={sx(maxM)} x2={sx(maxM)} y1={sy(3)} y2={sy(1e-6)} stroke="var(--line-strong)" stroke-dasharray="3 3" />
          <circle cx={sx(mE * 1000)} cy={sy(Le.rateFactor / ref)} r="5" fill="var(--p-electron)" />
          <text x={sx(mE * 1000) + 8} y={sy(Le.rateFactor / ref) + 4} class="lbl">e: {fmt(Le.rateFactor / ref)}</text>
          <circle cx={sx(mMu * 1000)} cy={sy(1)} r="5" fill="var(--p-muon)" />
          <text x={sx(mMu * 1000) - 9} y={sy(1) + 16} text-anchor="end" class="lbl">μ: 1</text>
          {#if relRate > 0}
            <circle cx={sx(mMeV)} cy={sy(Math.max(relRate, 1e-7))} r="6" fill="none" stroke="var(--ink)" stroke-width="2" />
          {/if}
        {/snippet}
      </Plot>
      <p class="ui note">Tree level: Γ ∝ m_ℓ² (1 − m_ℓ²/m_π²)². The rate peaks at m_ℓ = m_π/√3 = {maxM.toFixed(0)} MeV. The ratio e to μ is {pionLeptonicRatio().toExponential(3)} from the masses in the particle table; a τ (1777 MeV) is too heavy for the pion to make.</p>
    </section>
  </div>
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.2rem;
  }
  @media (max-width: 860px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  h5 {
    margin: 0 0 0.4rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink-2);
    text-transform: none;
    letter-spacing: 0;
  }
  svg {
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .t {
    font-size: 13px;
    fill: var(--ink);
  }
  .s,
  .lbl {
    font-size: 10.5px;
    fill: var(--ink-2);
    font-family: var(--font-ui);
  }
  .lbl {
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
    font-size: 11px;
  }
  .tab {
    margin-top: 0.5rem;
    border-collapse: collapse;
    font-size: 0.84rem;
    font-variant-numeric: tabular-nums;
  }
  .tab th,
  .tab td {
    padding: 0.15rem 0.8rem 0.15rem 0;
    text-align: left;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    color: var(--ink-2);
  }
  .tab td {
    color: var(--fg);
    font-family: var(--font-mono);
  }
  .note {
    margin: 0.4rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
