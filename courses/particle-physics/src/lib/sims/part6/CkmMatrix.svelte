<!--
  The CKM matrix (Chapter 24): the nine magnitudes |V_ij| as a grid, from the four Wolfenstein parameters through `ckmMatrix` of `hep/sm` (which keeps it unitary exactly).
  Cell darkness is log |V|², so that the hierarchy is visible: the diagonal is near 1, the next diagonal near 0.05, the corners near 10⁻⁵.

    ::ckm-matrix{n="24.1" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { WOLFENSTEIN } from '$lib/hep/sm';
  import { ckmMagnitudes, jarlskog, NAMES_DOWN, NAMES_UP } from './flavour';

  let { n, caption, title = 'The quark mixing matrix' }: { n?: string | number; caption?: string; title?: string } = $props();

  let lambda = $state(WOLFENSTEIN.lambda);
  let A = $state(WOLFENSTEIN.A);
  let rho = $state(WOLFENSTEIN.rhobar);
  let eta = $state(WOLFENSTEIN.etabar);
  const w = $derived({ lambda, A, rhobar: rho, etabar: eta });
  const M = $derived(ckmMagnitudes(w));
  const J = $derived(jarlskog(w));
  const rowSums = $derived(M.map((r) => r.reduce((s, v) => s + v * v, 0)));
  const colSums = $derived([0, 1, 2].map((j) => M.reduce((s, r) => s + r[j]! * r[j]!, 0)));
  const shade = (v: number) => Math.max(0.04, Math.min(1, (Math.log10(v * v) + 6) / 6));
  const fmt = (v: number) => (v >= 0.1 ? v.toFixed(4) : v >= 0.001 ? v.toFixed(4) : v.toExponential(2));
  const thetaC = $derived((Math.asin(lambda) * 180) / Math.PI);
</script>

<Widget {title} {n} {caption} kind="Explore" onreset={() => { lambda = WOLFENSTEIN.lambda; A = WOLFENSTEIN.A; rho = WOLFENSTEIN.rhobar; eta = WOLFENSTEIN.etabar; }}>
  {#snippet controls()}
    <div class="ctl">
      <Slider bind:value={lambda} min={0.1} max={0.4} step={0.001} label="λ = sin θ_C" format={(v) => v.toFixed(3)} />
      <Slider bind:value={A} min={0.5} max={1.2} step={0.005} label="A" format={(v) => v.toFixed(3)} />
      <Slider bind:value={rho} min={-0.3} max={0.6} step={0.005} label="ρ̄" format={(v) => v.toFixed(3)} />
      <Slider bind:value={eta} min={0} max={0.8} step={0.005} label="η̄ (the CP-violating phase)" format={(v) => v.toFixed(3)} />
    </div>
  {/snippet}
  <table class="ui ckm" aria-label="Magnitudes of the CKM matrix elements">
    <thead>
      <tr><th></th>{#each NAMES_DOWN as d}<th scope="col">{d}</th>{/each}<th scope="col" class="sum">Σ|V|² (row)</th></tr>
    </thead>
    <tbody>
      {#each M as row, i}
        <tr>
          <th scope="row">{NAMES_UP[i]}</th>
          {#each row as v, j}
            <td style:--s={shade(v)} title="|V_{NAMES_UP[i]}{NAMES_DOWN[j]}| = {v}"><span class="v">|V<sub>{NAMES_UP[i]}{NAMES_DOWN[j]}</sub>|</span>{fmt(v)}</td>
          {/each}
          <td class="sum">{rowSums[i]!.toFixed(6)}</td>
        </tr>
      {/each}
      <tr class="foot"><th scope="row">Σ|V|² (column)</th>{#each colSums as c}<td class="sum">{c.toFixed(6)}</td>{/each}<td></td></tr>
    </tbody>
  </table>
  <p class="ui note" aria-live="polite">
    Cabibbo angle θ<sub>C</sub> = {thetaC.toFixed(2)}°. Jarlskog invariant J = {(J * 1e5).toFixed(2)} × 10⁻⁵. Every row and every column squares and sums to 1, whatever the parameters: that is
    unitarity, and the matrix is built so that it holds exactly. Darkness is log|V|²: the diagonal is dark, the corners almost white. Set η̄ to 0 and J vanishes: the matrix is then real, and the weak force treats matter and antimatter alike.
  </p>
</Widget>

<style>
  .ctl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.6rem 1.4rem;
  }
  .ckm {
    border-collapse: separate;
    border-spacing: 4px;
    width: 100%;
    max-width: 640px;
    font-variant-numeric: tabular-nums;
  }
  th {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 600;
    color: var(--ink-2);
    text-align: center;
    padding: 0.2rem 0.4rem;
  }
  td {
    text-align: center;
    padding: 0.7rem 0.3rem;
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    background: color-mix(in srgb, var(--accent) calc(var(--s, 0.1) * 70%), var(--panel));
    color: var(--fg);
    position: relative;
  }
  td .v {
    display: block;
    font-family: var(--font-ui);
    font-size: 0.68rem;
    color: var(--ink-2);
    margin-bottom: 0.15rem;
  }
  td.sum {
    background: none;
    font-size: 0.78rem;
    color: var(--ink-2);
    padding: 0.2rem;
  }
  th.sum {
    font-size: 0.72rem;
    font-weight: 400;
  }
  .note {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
