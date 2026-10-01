<!--
  Bjorken scaling, in the course's parton distributions (Chapter 13): the structure function F₂(x, Q²) = Σ e_q² x (q + q̄) against Q at fixed x.
  Flat curves are scaling. The mild slopes are scaling violations, which the DGLAP evolution produces and QCD predicts (Chapter 18).
  A teaching parametrisation, not a fit, and not SLAC's data.

    ::scaling-plot{n="13.5" caption="…"}
-->
<script lang="ts">
  import './part3.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { xf } from '$lib/hep/gen/pdf';

  let { n, caption }: { n?: string | number; caption?: string } = $props();
  const E2: [number, number][] = [[2, 4 / 9], [1, 1 / 9], [3, 1 / 9], [4, 4 / 9], [5, 1 / 9]];
  const F2 = (x: number, Q: number) => E2.reduce((s, [id, e2]) => s + e2 * (xf(id, x, Q) + xf(-id, x, Q)), 0);
  const XS = [0.5, 0.25, 0.1, 0.01];
  const COLS = ['var(--series-2)', 'var(--series-3)', 'var(--series-1)', 'var(--series-7)'];
  const QG = Array.from({ length: 60 }, (_, i) => 10 ** (0 + (i * 2.6) / 59));
  const path = (x: number, sx: (v: number) => number, sy: (v: number) => number) => QG.map((Q, i) => `${i ? 'L' : 'M'}${sx(Q * Q).toFixed(1)},${sy(F2(x, Q)).toFixed(1)}`).join('');
  const slac = (x: number) => { const a = F2(x, Math.sqrt(2)), b = F2(x, Math.sqrt(20)); return b / a; };
</script>

<Widget title="Scaling: F₂ hardly depends on Q²" {n} {caption} kind="Model" live={false}>
  <Plot
    height={270}
    label="The structure function F2 against Q squared on a logarithmic axis for four values of x: nearly flat for x of 0.1 to 0.5, and rising slowly for x equal to 0.01."
    x={{ type: 'log', domain: [1, 4e5], label: 'Q²  [GeV²]', tickValues: [1, 10, 100, 1e3, 1e4, 1e5], format: (v) => '10^' + Math.round(Math.log10(v)) }}
    y={{ domain: [0, 0.8], label: 'F₂(x, Q²)', ticks: 4 }}
  >
    {#snippet marks({ sx, sy })}
      <rect x={sx(2)} width={sx(20) - sx(2)} y="0" height="1000" fill="var(--grid)" opacity="0.7" />
      <text x={sx(2) + 4} y="14" class="p3-tag">an illustrative range, Q² = 2–20 GeV²</text>
      {#each XS as x, i}
        <path d={path(x, sx, sy)} class="p3-line" stroke={COLS[i]} />
        <text x={sx(3e5)} y={sy(F2(x, 550)) - 5} text-anchor="end" class="p3-tag">x = {x}</text>
      {/each}
    {/snippet}
  </Plot>
  <dl class="p3-out ui">
    {#each XS as x}<div><dt>F₂ at x = {x}: Q² = 20 over Q² = 2 GeV²</dt><dd>{slac(x).toFixed(2)}</dd></div>{/each}
  </dl>
  <p class="p3-note ui">Computed from the course's parton distributions, F₂ = Σ e<sub>q</sub>² x (q + q̄) over u, d, s, c, b. Across the shaded band the curves at x = 0.1 and 0.25 change little (see the numbers): that is Bjorken scaling. At larger x the function falls and at smaller x it rises: the scaling violations that QCD predicts (Chapter 18). A teaching parametrisation, not data.</p>
</Widget>
