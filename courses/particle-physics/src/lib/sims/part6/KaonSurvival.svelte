<!--
  Why the Cronin–Fitch beam was a K_L beam (Chapter 24). The probability that a neutral kaon of momentum p has not decayed after a flight of L is exp(−L/βγcτ).
  The K_S (τ = 89.5 ps) is gone within centimetres; the K_L (τ = 51 ns) lasts for tens of metres. Lifetimes from the particle table.

    ::kaon-survival{n="24.4" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { logSurvival, meanDecayLengthMm } from './flavour';

  let { n, caption, title = 'A beam of long-lived kaons' }: { n?: string | number; caption?: string; title?: string } = $props();

  let p = $state(2);
  const FEET = 0.3048;
  const L57 = 57 * FEET; // metres
  const xs = Array.from({ length: 160 }, (_, i) => (i / 159) * 25);
  const lines = $derived([310, 130].map((pdg) => ({ pdg, label: pdg === 310 ? 'K_S' : 'K_L', colour: pdg === 310 ? 'var(--series-3)' : 'var(--series-1)', pts: xs.map((L) => ({ L, y: Math.max(-12, logSurvival(pdg, p, L * 1000) / Math.LN10) })), at: logSurvival(pdg, p, L57 * 1000) / Math.LN10, mean: meanDecayLengthMm(pdg, p) / 1000 })));
  const fmtP = (l10: number) => (l10 > -2 ? `${(10 ** l10).toPrecision(3)}` : `10^${l10.toFixed(0)}`);
</script>

<Widget {title} {n} {caption} kind="Explore" onreset={() => (p = 2)}>
  {#snippet controls()}
    <Slider bind:value={p} min={0.5} max={30} step={0.5} log label="Kaon momentum, GeV/c" format={(v) => v.toFixed(1)} />
  {/snippet}
  <Plot x={{ domain: [0, 25], label: 'distance flown [m]' }} y={{ domain: [-12, 0], label: 'surviving fraction (log₁₀)', format: (v) => `10^${v}`, tickValues: [-12, -10, -8, -6, -4, -2, 0] }} height={280} crosshair={false} label="Surviving fraction of K_S and K_L mesons against the distance flown, on a logarithmic scale: the K_S has gone after a metre, the K_L survives for tens of metres">
    {#snippet marks({ sx, sy, height })}
      <line x1={sx(L57)} x2={sx(L57)} y1="0" y2={height} stroke="var(--ink-2)" stroke-dasharray="4 3" />
      <text x={sx(L57) + 5} y="14" class="lbl">57 feet = 17.4 m</text>
      {#each lines as l}
        <path d={l.pts.map((q, i) => `${i ? 'L' : 'M'}${sx(q.L)},${sy(q.y)}`).join('')} fill="none" stroke={l.colour} stroke-width="2.4" />
        <text x={sx(l.label === 'K_S' ? 1.3 : 20)} y={sy(l.label === 'K_S' ? -5 : l.pts[Math.floor((20 / 25) * 159)]!.y) - 6} class="lbl" fill={l.colour}>{l.label}</text>
      {/each}
    {/snippet}
  </Plot>
  <table class="ui tab" aria-live="polite">
    <thead><tr><th></th><th>Mean flight βγcτ</th><th>Surviving fraction after 57 feet</th></tr></thead>
    <tbody>
      {#each lines as l}
        <tr><th scope="row">{l.label}</th><td>{l.mean < 1 ? `${(l.mean * 100).toFixed(1)} cm` : `${l.mean.toFixed(1)} m`}</td><td>{fmtP(l.at)}</td></tr>
      {/each}
    </tbody>
  </table>
  <p class="ui note">At 2 GeV/c a K_S flies about 11 cm on average, so none survives to 17 m (the fraction is 10⁻⁷⁰, which is zero for any practical purpose). A K_L flies about 60 m, so most do.
    Whatever was seen to decay into two pions 17 m from the target was not a K_S.</p>
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
  .tab {
    border-collapse: collapse;
    font-size: 0.84rem;
    margin-top: 0.5rem;
  }
  .tab th,
  .tab td {
    padding: 0.15rem 1.2rem 0.15rem 0;
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
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
