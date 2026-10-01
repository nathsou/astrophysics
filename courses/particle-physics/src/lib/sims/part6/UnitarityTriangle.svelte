<!--
  The unitarity triangle (Chapter 24 flagship), built from measurements. Unitarity of the CKM matrix demands V_ud V_ub* + V_cd V_cb* + V_td V_tb* = 0: three complex numbers
  that add to zero form a triangle. Divide by V_cd V_cb* and the base becomes the segment from (0, 0) to (1, 0); the apex is the point (ρ̄, η̄).
  Each measurement is a constraint on the apex: a side length (a circle), an angle (a straight line). Here the "measured" values are the central values of the
  triangle in `hep/sm` (the PDG's global fit, λ = 0.225, A = 0.826, ρ̄ = 0.159, η̄ = 0.348), so they agree by construction; the sliders let you move one and see
  the constraints disagree. The bands are SCHEMATIC (their widths are illustrative, not the published uncertainties).

    ::unitarity-triangle{n="24.2" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { WOLFENSTEIN } from '$lib/hep/sm';
  import { apexFromSides, ckmMagnitudes, triangleFromApex } from './flavour';

  let { n, caption, title = 'The unitarity triangle' }: { n?: string | number; caption?: string; title?: string } = $props();

  const fit = triangleFromApex(WOLFENSTEIN.rhobar, WOLFENSTEIN.etabar);
  const sin2b0 = Math.sin((2 * fit.beta * Math.PI) / 180);
  let Ru = $state(Number(fit.Ru.toFixed(3)));
  let Rt = $state(Number(fit.Rt.toFixed(3)));
  let sin2b = $state(Number(sin2b0.toFixed(3)));
  let gam = $state(Number(fit.gamma.toFixed(1)));
  let showRu = $state(true), showRt = $state(true), showB = $state(true), showG = $state(true), bands = $state(false);

  const apex = $derived(apexFromSides(Ru, Rt));
  const beta = $derived((Math.asin(Math.min(1, sin2b)) / 2) * (180 / Math.PI));
  const tri = $derived(apex ? triangleFromApex(apex.rhobar, apex.etabar) : null);
  const m = ckmMagnitudes();
  const base = m[1]![0]! * m[1]![2]!;
  const J = $derived(apex ? base * base * apex.etabar : 0);
  // drawing: equal scales
  const X0 = -0.4, X1 = 1.25, Y0 = -0.1, Y1 = 0.72;
  const S = 330, W = (X1 - X0) * S, H = (Y1 - Y0) * S;
  const px = (r: number) => (r - X0) * S;
  const py = (e: number) => (Y1 - e) * S;
  const rad = (d: number) => (d * Math.PI) / 180;
  const arc = (cx: number, r: number) => {
    // upper half circle of radius r about (cx, 0), clipped to the frame by the SVG viewport
    const pts: string[] = [];
    for (let i = 0; i <= 120; i++) {
      const t = Math.PI * (i / 120);
      pts.push(`${i ? 'L' : 'M'}${px(cx + r * Math.cos(t))},${py(r * Math.sin(t))}`);
    }
    return pts.join('');
  };
  const BAND = { Ru: 0.05, Rt: 0.04, beta: 1.2, gam: 5 };
  const ticksX = [-0.2, 0, 0.2, 0.4, 0.6, 0.8, 1, 1.2];
  const ticksY = [0, 0.2, 0.4, 0.6];
  const f = (x: number, d = 3) => x.toFixed(d);
  // distance of the apex from the two angle lines
  const rayBeta = $derived(apex ? { ang: beta, miss: Math.abs(apex.etabar * Math.cos(rad(beta)) - (1 - apex.rhobar) * Math.sin(rad(beta))) } : { ang: beta, miss: 0 });
  const rayGam = $derived(apex ? { ang: gam, miss: Math.abs(apex.etabar * Math.cos(rad(gam)) - apex.rhobar * Math.sin(rad(gam))) } : { ang: gam, miss: 0 });
</script>

<Widget {title} {n} {caption} kind="Explore" onreset={() => { Ru = Number(fit.Ru.toFixed(3)); Rt = Number(fit.Rt.toFixed(3)); sin2b = Number(sin2b0.toFixed(3)); gam = Number(fit.gamma.toFixed(1)); showRu = showRt = showB = showG = true; bands = false; }}>
  {#snippet controls()}
    <div class="ctl">
      <Slider bind:value={Ru} min={0.2} max={0.6} step={0.005} label="Side R_u = |V_ud V_ub| / |V_cd V_cb|, from b → u against b → c decays" format={(v) => v.toFixed(3)} />
      <Slider bind:value={Rt} min={0.6} max={1.2} step={0.005} label="Side R_t = |V_td V_tb| / |V_cd V_cb|, from B⁰ and B_s⁰ oscillation frequencies" format={(v) => v.toFixed(3)} />
      <Slider bind:value={sin2b} min={0.3} max={1} step={0.005} label="sin 2β, from the CP asymmetry of B⁰ → J/ψ K_S⁰" format={(v) => v.toFixed(3)} />
      <Slider bind:value={gam} min={30} max={100} step={0.5} label="Angle γ, from B → D K decays (LHCb, Belle II)" format={(v) => v.toFixed(1) + '°'} />
      <div class="tog">
        <Toggle bind:checked={showRu} label="R_u circle" />
        <Toggle bind:checked={showRt} label="R_t circle" />
        <Toggle bind:checked={showB} label="β line" />
        <Toggle bind:checked={showG} label="γ line" />
        <Toggle bind:checked={bands} label="Schematic bands" />
      </div>
    </div>
  {/snippet}
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="The unitarity triangle in the plane of ρ̄ and η̄: circles about the two ends of the base for the two measured sides, two straight lines for the measured angles, and the apex where they meet">
    <defs><clipPath id="ut-clip"><rect width={W} height={H} /></clipPath></defs>
    {#each ticksX as t}
      <line x1={px(t)} x2={px(t)} y1="0" y2={H} class="grid" />
      <text x={px(t)} y={H - 4} text-anchor="middle" class="tick">{t}</text>
    {/each}
    {#each ticksY as t}
      <line x1="0" x2={W} y1={py(t)} y2={py(t)} class={t === 0 ? 'axis' : 'grid'} />
      <text x="4" y={py(t) - 3} class="tick">{t}</text>
    {/each}
    <text x={W - 6} y={py(0) - 6} text-anchor="end" class="lab">ρ̄</text>
    <text x={px(0) + 6} y="14" class="lab">η̄</text>
    <g clip-path="url(#ut-clip)">
      {#if showRu}
        {#if bands}<path d={arc(0, Ru * (1 + BAND.Ru))} class="band" stroke="var(--series-1)" /><path d={arc(0, Ru * (1 - BAND.Ru))} class="band" stroke="var(--series-1)" />{/if}
        <path d={arc(0, Ru)} fill="none" stroke="var(--series-1)" stroke-width="2.4" />
      {/if}
      {#if showRt}
        {#if bands}<path d={arc(1, Rt * (1 + BAND.Rt))} class="band" stroke="var(--series-3)" /><path d={arc(1, Rt * (1 - BAND.Rt))} class="band" stroke="var(--series-3)" />{/if}
        <path d={arc(1, Rt)} fill="none" stroke="var(--series-3)" stroke-width="2.4" />
      {/if}
      {#if showB}
        {#if bands}
          {#each [-BAND.beta, BAND.beta] as d}<line x1={px(1)} y1={py(0)} x2={px(1 - 2 * Math.cos(rad(beta + d)))} y2={py(2 * Math.sin(rad(beta + d)))} class="band" stroke="var(--series-5)" />{/each}
        {/if}
        <line x1={px(1)} y1={py(0)} x2={px(1 - 2 * Math.cos(rad(beta)))} y2={py(2 * Math.sin(rad(beta)))} stroke="var(--series-5)" stroke-width="2.2" stroke-dasharray="7 4" />
      {/if}
      {#if showG}
        {#if bands}
          {#each [-BAND.gam, BAND.gam] as d}<line x1={px(0)} y1={py(0)} x2={px(2 * Math.cos(rad(gam + d)))} y2={py(2 * Math.sin(rad(gam + d)))} class="band" stroke="var(--series-8)" />{/each}
        {/if}
        <line x1={px(0)} y1={py(0)} x2={px(2 * Math.cos(rad(gam)))} y2={py(2 * Math.sin(rad(gam)))} stroke="var(--series-8)" stroke-width="2.2" stroke-dasharray="2 4" />
      {/if}
      {#if apex}
        <path d="M{px(0)},{py(0)}L{px(1)},{py(0)}L{px(apex.rhobar)},{py(apex.etabar)}Z" fill="var(--accent-soft)" fill-opacity="0.5" stroke="var(--ink)" stroke-width="1.6" />
        <circle cx={px(apex.rhobar)} cy={py(apex.etabar)} r="5.5" fill="var(--ink)" />
      {/if}
    </g>
    <circle cx={px(0)} cy={py(0)} r="4" fill="var(--ink)" />
    <circle cx={px(1)} cy={py(0)} r="4" fill="var(--ink)" />
    {#if tri}
      <text x={px(tri.rhobar * 0.5) - 14} y={py(tri.etabar * 0.5) - 6} class="lab">R_u</text>
      <text x={px(1 - (1 - tri.rhobar) * 0.5) + 6} y={py(tri.etabar * 0.5) - 6} class="lab">R_t</text>
      <text x={px(0) + 24} y={py(0) - 8} class="ang">γ {f(tri.gamma, 1)}°</text>
      <text x={px(1) - 8} y={py(0) - 8} text-anchor="end" class="ang">β {f(tri.beta, 1)}°</text>
      <text x={px(tri.rhobar)} y={py(tri.etabar) - 11} text-anchor="middle" class="ang">α {f(tri.alpha, 1)}°</text>
    {/if}
  </svg>
  <div class="read ui" aria-live="polite">
    {#if apex && tri}
      <table>
        <tbody>
          <tr><th scope="row">Apex from the two sides</th><td>(ρ̄, η̄) = ({f(apex.rhobar)}, {f(apex.etabar)})</td></tr>
          <tr><th scope="row">Angles of that triangle</th><td>α = {f(tri.alpha, 1)}°, β = {f(tri.beta, 1)}°, γ = {f(tri.gamma, 1)}°</td></tr>
          <tr><th scope="row">The β line misses the apex by</th><td>{f(rayBeta.miss)} (in units of the base) {rayBeta.miss < 0.01 ? '— consistent' : rayBeta.miss < 0.04 ? '' : '— tension'}</td></tr>
          <tr><th scope="row">The γ line misses the apex by</th><td>{f(rayGam.miss)} {rayGam.miss < 0.01 ? '— consistent' : rayGam.miss < 0.04 ? '' : '— tension'}</td></tr>
          <tr><th scope="row">Jarlskog invariant J = |V_cd V_cb|² η̄</th><td>{(J * 1e5).toFixed(2)} × 10⁻⁵ (twice the area of the unrescaled triangle)</td></tr>
        </tbody>
      </table>
    {:else}
      <p class="msg">These two sides cannot close a triangle: the circles do not meet.</p>
    {/if}
    <p class="sub">Central values: the global-fit triangle of the PDG, as built into <code>hep/sm</code> (λ = {WOLFENSTEIN.lambda}, A = {WOLFENSTEIN.A}, ρ̄ = {WOLFENSTEIN.rhobar}, η̄ = {WOLFENSTEIN.etabar}). They agree by construction; the point of the figure is how they would disagree. If η̄ were 0 the triangle would be flat and no CP violation could occur.</p>
  </div>
</Widget>

<style>
  .ctl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 0.6rem 1.4rem;
  }
  .tog {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.2rem;
    grid-column: 1 / -1;
  }
  svg {
    width: 100%;
    height: auto;
    background: var(--chart-surface);
    border: 1px solid var(--line);
    border-radius: 6px;
    display: block;
  }
  .grid {
    stroke: var(--grid);
    stroke-width: 1;
  }
  .axis {
    stroke: var(--axis);
    stroke-width: 1.4;
  }
  .tick {
    font-size: 10px;
    fill: var(--ink-3);
    font-family: var(--font-ui);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
  .lab,
  .ang {
    font-size: 12px;
    fill: var(--ink);
    font-family: var(--font-ui);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
  .ang {
    font-size: 11px;
    fill: var(--ink-2);
  }
  .band {
    fill: none;
    stroke-width: 1;
    opacity: 0.55;
  }
  .read {
    margin-top: 0.6rem;
  }
  table {
    border-collapse: collapse;
    font-size: 0.84rem;
  }
  th,
  td {
    padding: 0.15rem 1rem 0.15rem 0;
    text-align: left;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    color: var(--ink-2);
  }
  td {
    color: var(--fg);
    font-family: var(--font-mono);
  }
  .sub,
  .msg {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--ink-2);
  }
</style>
