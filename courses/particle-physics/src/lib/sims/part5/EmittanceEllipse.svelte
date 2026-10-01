<!--
  Emittance and the β function in phase space. A bunch of protons occupies an ellipse in (x, x′) whose area π ε is fixed by how the beam was made;
  the optics only decide its shape: a large β gives a wide, parallel beam, a small β a narrow, divergent one (the collision point). As the beam is
  accelerated the geometric emittance shrinks as 1/(βγ), while the normalised emittance stays constant (adiabatic damping).

    ::emittance-ellipse{n="20.6" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { rng, normal } from '$lib/hep/random';
  import { geometricEmittance, beamSigma, phaseSpaceEllipse, type Twiss } from '$lib/hep/machine';
  import { M_P } from './physics';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let energy = $state(450);
  let epsN = $state(3.75);
  let beta = $state(100);
  let alpha = $state(0);
  let fixedAxes = $state(true);

  const bg = $derived(energy / M_P); // βγ = p/m
  const eps = $derived(geometricEmittance(epsN * 1e-6, bg)); // m·rad
  const tw = $derived<Twiss>({ beta, alpha, gamma: (1 + alpha * alpha) / beta });
  const sigma = $derived(beamSigma(eps, beta)); // m
  const sigmaP = $derived(Math.sqrt(eps * tw.gamma)); // rad
  const eps450 = $derived(geometricEmittance(epsN * 1e-6, 450 / M_P));

  // 500 protons from a unit Gaussian in normalised phase space (seeded), mapped by the Twiss matrix.
  const unit = (() => {
    const r = rng(7);
    return Array.from({ length: 500 }, () => [normal(r), normal(r)] as [number, number]);
  })();
  const cloud = $derived(unit.map(([u, v]) => ({ x: Math.sqrt(eps * beta) * u * 1e3, xp: -Math.sqrt(eps / beta) * (alpha * u + v) * 1e6 })));
  const ell1 = $derived(phaseSpaceEllipse(tw, eps, 90).map((p) => ({ x: p.x * 1e3, xp: p.xp * 1e6 })));
  const ell2 = $derived(phaseSpaceEllipse(tw, 4 * eps, 90).map((p) => ({ x: p.x * 1e3, xp: p.xp * 1e6 })));
  const xr = $derived(fixedAxes ? 3 : Math.max(0.001, 2.4 * sigma * 1e3 * 1.25));
  const yr = $derived(fixedAxes ? 60 : Math.max(0.01, 2.4 * Math.sqrt(eps * tw.gamma) * 1e6 * 1.25));
  const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '–');
</script>

<Widget title="Emittance: the area of the beam in phase space" subtitle="The optics change the shape, acceleration shrinks the area" {n} {caption} kind="Explore" onreset={() => { energy = 450; epsN = 3.75; beta = 100; alpha = 0; fixedAxes = true; }}>
  {#snippet controls()}
    <Slider bind:value={energy} min={450} max={7000} step={10} log label="Proton momentum [GeV/c]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={epsN} min={1} max={5} step={0.05} label="Normalised emittance εₙ [µm]" format={(v) => v.toFixed(2)} />
    <Slider bind:value={beta} min={0.5} max={200} step={0.5} log label="β function at this point [m]" format={(v) => v.toFixed(v < 10 ? 2 : 0)} />
    <Slider bind:value={alpha} min={-2} max={2} step={0.1} label="α (the slope of β(s): α = −β′/2)" format={(v) => v.toFixed(1)} />
    <Toggle bind:checked={fixedAxes} label="Keep the axes fixed (to compare sizes)" />
    <div class="presets ui">
      <Button size="sm" onclick={() => { beta = 100; alpha = 0; }}>Arc, β ≈ 100 m</Button>
      <Button size="sm" onclick={() => { beta = 0.55; alpha = 0; energy = 7000; }}>Collision point, β* = 0.55 m at 7 TeV</Button>
    </div>
  {/snippet}

  <Plot
    label="Phase space of the beam: position x in millimetres against angle x′ in microradians. The one-sigma ellipse has area π times the geometric emittance of {f(eps * 1e9, 2)} nanometres."
    x={{ domain: [-xr, xr], label: 'x [mm]' }}
    y={{ domain: [-yr, yr], label: 'x′ [µrad]' }}
    height={300}
  >
    {#snippet marks({ sx, sy })}
      {#each cloud as p}<circle cx={sx(p.x)} cy={sy(p.xp)} r="1.6" class="pt" />{/each}
      <path class="e2" d={ell2.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)} ${sy(p.xp)}`).join('') + 'Z'} />
      <path class="e1" d={ell1.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)} ${sy(p.xp)}`).join('') + 'Z'} />
    {/snippet}
  </Plot>

  <dl class="readout ui" role="status" aria-live="polite">
    <div><dt>Geometric emittance ε = εₙ/(βγ)</dt><dd>{f(eps * 1e9, 3)} nm·rad</dd></div>
    <div><dt>… at 450 GeV/c</dt><dd>{f(eps450 * 1e9, 2)} nm·rad (× {f(eps450 / eps, 1)} larger)</dd></div>
    <div><dt>Beam size σ = √(ε β)</dt><dd>{sigma < 1e-3 ? `${f(sigma * 1e6, 1)} µm` : `${f(sigma * 1e3, 3)} mm`}</dd></div>
    <div><dt>Divergence σ′ = √(ε (1 + α²)/β)</dt><dd>{f(sigmaP * 1e6, 2)} µrad</dd></div>
    <div><dt>Area of the 1σ ellipse, π ε</dt><dd>{f(Math.PI * eps * 1e9, 2)} nm·rad (the same whatever β and α)</dd></div>
  </dl>
  <p class="note ui">Dots: 500 seeded protons from a Gaussian beam. Inner ellipse: 1σ (39% of the protons in two dimensions); outer: 2σ (four times the area). The optics here are a single point; the lattice designer follows β(s) all round the ring.</p>
</Widget>

<style>
  .pt { fill: var(--series-1); opacity: 0.55; }
  .e1 { fill: none; stroke: var(--ink); stroke-width: 2; }
  .e2 { fill: none; stroke: var(--ink-2); stroke-width: 1.3; stroke-dasharray: 5 4; }
  .presets { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.3rem; }
  .readout { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0.4rem 0.9rem; margin: 0.6rem 0 0; }
  .readout div { border-left: 2px solid var(--line-strong); padding-left: 0.5rem; }
  dt { font-size: 0.74rem; color: var(--mute); text-transform: none; letter-spacing: 0; }
  dd { margin: 0; font-family: var(--font-mono); font-size: 0.9rem; font-variant-numeric: tabular-nums; }
  .note { font-size: 0.78rem; color: var(--mute); margin: 0.5rem 0 0; }
</style>
