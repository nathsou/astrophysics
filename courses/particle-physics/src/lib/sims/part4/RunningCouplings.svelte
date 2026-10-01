<!--
  The running couplings from hep/sm: 1/α(Q) of QED and α_s(Q) of QCD.

    ::running-couplings{which="alpha" n="16.4" caption="…"}     which = alpha | alphas | both

  The QED curve is the one-loop vacuum polarisation of every charged fermion (QED only: 1/128.96 at m_Z, where the conventional
  MS-bar value, which also includes the W boson's loop, is 1/127.95). The QCD curve is αs(m_Z) = 0.118 run with the one- and
  two-loop β functions and the quark thresholds.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { alphaEM, alphaS, nfActive, ALPHA_MZ_MSBAR, M_Z, ALPHA_0 } from '$lib/hep/sm';

  let { n, caption, which = 'alpha', title }: { n?: string | number; caption?: string; which?: 'alpha' | 'alphas' | 'both'; title?: string } = $props();

  let logQ = $state(Math.log10(M_Z));
  const Q = $derived(10 ** logQ);
  const grid = (lo: number, hi: number, k: number) => Array.from({ length: k }, (_, i) => lo * Math.pow(hi / lo, i / (k - 1)));
  const qA = grid(0.3, 1000, 120);
  const qS = grid(1, 1000, 120);
  const pathOf = (xs: number[], f: (q: number) => number, sx: (v: number) => number, sy: (v: number) => number) =>
    xs.map((q, i) => `${i ? 'L' : 'M'}${sx(q).toFixed(1)},${sy(f(q)).toFixed(1)}`).join('');
  const showA = $derived(which !== 'alphas');
  const showS = $derived(which !== 'alpha');
</script>

<Widget title={title ?? (which === 'alpha' ? 'The electromagnetic coupling runs' : which === 'alphas' ? 'The strong coupling runs' : 'Two couplings, two directions')} {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={logQ} min={0} max={3} step={0.01} label="Energy scale Q" format={(v) => `${(10 ** v).toPrecision(3)} GeV`} />
  {/snippet}
  <div class="grid" class:one={which !== 'both'}>
    {#if showA}
      <div>
        <p class="cap ui">QED: 1/α(Q) falls as Q rises</p>
        <Plot height={280} label="The inverse electromagnetic coupling against the energy scale" x={{ type: 'log', domain: [0.3, 1000], label: 'Q [GeV]', tickValues: [0.3, 1, 10, 100, 1000] }} y={{ domain: [126, 138], label: '1/α(Q)', ticks: 6 }}>
          {#snippet marks({ sx, sy, width })}
            <line x1="0" x2={width} y1={sy(1 / ALPHA_0)} y2={sy(1 / ALPHA_0)} stroke="var(--ink-3)" stroke-dasharray="4 4" />
            <line x1="0" x2={width} y1={sy(1 / ALPHA_MZ_MSBAR)} y2={sy(1 / ALPHA_MZ_MSBAR)} stroke="var(--series-8)" stroke-dasharray="2 4" />
            <text x="6" y={sy(1 / ALPHA_MZ_MSBAR) - 5} class="gl">1/127.95: the conventional (MS-bar) value at m_Z, which includes the W loop</text>
            <text x="6" y={sy(1 / ALPHA_0) - 5} class="gl">1/137.036 at Q = 0</text>
            <path d={pathOf(qA, (q) => 1 / alphaEM(q), sx, sy)} fill="none" stroke="var(--series-1)" stroke-width="2.4" />
            <line x1={sx(M_Z)} x2={sx(M_Z)} y1="0" y2="1000" stroke="var(--line-strong)" />
            <circle cx={sx(Q)} cy={sy(1 / alphaEM(Q))} r="5" fill="var(--series-7)" stroke="var(--surface)" stroke-width="1.5" />
          {/snippet}
        </Plot>
        <p class="read ui">1/α({Q.toPrecision(3)} GeV) = <strong>{(1 / alphaEM(Q)).toFixed(2)}</strong> (QED loops of e, μ, τ and the quarks)</p>
      </div>
    {/if}
    {#if showS}
      <div>
        <p class="cap ui">QCD: α<sub>s</sub>(Q) falls as Q rises</p>
        <Plot height={280} label="The strong coupling against the energy scale, at one and two loops" x={{ type: 'log', domain: [1, 1000], label: 'Q [GeV]', tickValues: [1, 3, 10, 30, 100, 300, 1000] }} y={{ domain: [0, 0.5], label: 'α_s(Q)', ticks: 5 }}>
          {#snippet marks({ sx, sy })}
            <path d={pathOf(qS, (q) => alphaS(q, 1), sx, sy)} fill="none" stroke="var(--series-2)" stroke-width="2" stroke-dasharray="6 4" />
            <path d={pathOf(qS, (q) => alphaS(q, 2), sx, sy)} fill="none" stroke="var(--series-1)" stroke-width="2.4" />
            <line x1={sx(M_Z)} x2={sx(M_Z)} y1="0" y2="1000" stroke="var(--line-strong)" />
            <circle cx={sx(Math.max(Q, 1))} cy={sy(alphaS(Q))} r="5" fill="var(--series-7)" stroke="var(--surface)" stroke-width="1.5" />
          {/snippet}
        </Plot>
        <p class="read ui">α<sub>s</sub>({Q.toPrecision(3)} GeV) = <strong>{alphaS(Q).toFixed(3)}</strong> (two loops; {alphaS(Q, 1).toFixed(3)} at one loop), {nfActive(Q)} active quark flavours</p>
      </div>
    {/if}
  </div>
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem;
  }
  .grid.one {
    grid-template-columns: minmax(0, 1fr);
  }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .cap {
    margin: 0 0 0.3rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .read {
    margin: 0.4rem 0 0;
    font-size: 0.82rem;
  }
  .gl {
    font-size: 10.5px;
    fill: var(--ink-3);
  }
</style>
