<!--
  The top quark's virtual footprint (Chapter 25). A loop with a top and a bottom quark changes the relative strength of the Z and W couplings by Δρ = 3 G_F m_t² / (8√2 π²),
  which grows as the SQUARE of the top mass. At fixed α, G_F and m_Z it raises the predicted W mass by δm_W ≈ m_W cos²θ_W Δρ / (2 (cos²θ_W − sin²θ_W)) (on-shell definitions). Both are leading terms only;
  the real analyses fit many observables with all corrections (and the Higgs mass enters too, only logarithmically).

    ::rho-parameter{n="25.3" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { G_F, M_W, SIN2W_ONSHELL, M_T } from '$lib/hep/sm';

  let { n, caption, title = 'A heavy quark that is never seen, felt through loops' }: { n?: string | number; caption?: string; title?: string } = $props();
  let mt = $state(M_T);
  const drho = (m: number) => (3 * G_F * m * m) / (8 * Math.SQRT2 * Math.PI ** 2);
  const s2 = SIN2W_ONSHELL, c2 = 1 - s2;
  const dmW = (m: number) => (M_W * c2 * drho(m)) / (2 * (c2 - s2));
  const pts = Array.from({ length: 101 }, (_, i) => {
    const m = (i / 100) * 250;
    return { m, d: drho(m), w: dmW(m) };
  });
</script>

<Widget {title} {n} {caption} kind="Explore" onreset={() => (mt = M_T)}>
  {#snippet controls()}
    <Slider bind:value={mt} min={0} max={250} step={0.5} label="Top-quark mass, GeV" format={(v) => v.toFixed(1)} />
  {/snippet}
  <Plot x={{ domain: [0, 250], label: 'top-quark mass [GeV]' }} y={{ domain: [0, 0.0135], label: 'Δρ', format: (v) => v.toFixed(3) }} height={250} crosshair={false} label="The top-quark contribution to the rho parameter against the top mass: a parabola">
    {#snippet marks({ sx, sy, height })}
      <rect x={sx(150)} y="0" width={sx(190) - sx(150)} {height} fill="var(--series-5)" opacity="0.16" />
      <text x={sx(152)} y="14" class="lbl">early-1990s indirect range (approximate)</text>
      <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.m)},${sy(p.d)}`).join('')} fill="none" stroke="var(--series-1)" stroke-width="2.4" />
      <circle cx={sx(mt)} cy={sy(drho(mt))} r="6" fill="var(--accent)" stroke="var(--panel)" stroke-width="1.5" />
    {/snippet}
  </Plot>
  <p class="ui note" aria-live="polite">
    At m<sub>t</sub> = {mt.toFixed(1)} GeV: Δρ = {drho(mt).toFixed(5)} ({(100 * drho(mt)).toFixed(2)} %), and the W mass is raised by about {dmW(mt).toFixed(2)} GeV ({(100 * dmW(mt) / M_W).toFixed(2)} %) compared with a world without the top loop.
    Doubling the mass quadruples both. That quadratic growth is why precision measurements of the Z and the W could estimate the mass of a particle that was too heavy to produce.
    The Higgs boson enters only through a logarithm, so a fit that knows the top mass can estimate the Higgs mass only crudely (Chapter 29).
  </p>
</Widget>

<style>
  .lbl {
    font-size: 11px;
    font-family: var(--font-ui);
    fill: var(--ink-2);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
  .note {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
