<script lang="ts">
  import { COURSE_TITLE } from '$content/outline';
  import UnitsConverter from '$lib/sims/units/UnitsConverter.svelte';
  import { base } from '$app/paths';
</script>

<svelte:head><title>Units and constants · {COURSE_TITLE}</title></svelte:head>

<div class="page">
  <h1>Units and constants</h1>
  <p class="lede">
    Particle physicists measure energy, momentum and mass in electronvolts and set ħ = c = 1. This converter moves between those units and
    the everyday ones. The conventions are explained in <a href="{base}/chapters/scales-and-units/">Chapter 1</a> and collected in
    <a href="{base}/appendix/units/">appendix C</a>.
  </p>
  <UnitsConverter plain />
  <h2>Constants used throughout the course</h2>
  <table class="ui consts">
    <thead><tr><th>Quantity</th><th>Symbol</th><th>Value</th></tr></thead>
    <tbody>
      <tr><th scope="row">Reduced Planck constant times c</th><td>ħc</td><td>197.327 MeV·fm = 0.197327 GeV·fm</td></tr>
      <tr><th scope="row">Reduced Planck constant</th><td>ħ</td><td>6.582 × 10⁻²⁵ GeV·s</td></tr>
      <tr><th scope="row">Speed of light</th><td>c</td><td>299 792 458 m/s (exact)</td></tr>
      <tr><th scope="row">Electronvolt</th><td>eV</td><td>1.602 176 634 × 10⁻¹⁹ J (exact)</td></tr>
      <tr><th scope="row">Fine-structure constant</th><td>α</td><td>1/137.036 at low energy; about 1/128 at the Z mass</td></tr>
      <tr><th scope="row">Fermi constant</th><td>G<sub>F</sub></td><td>1.1664 × 10⁻⁵ GeV⁻²</td></tr>
      <tr><th scope="row">Conversion for cross-sections</th><td>(ħc)²</td><td>0.3894 GeV²·mb</td></tr>
      <tr><th scope="row">Boltzmann constant</th><td>k<sub>B</sub></td><td>8.617 × 10⁻⁵ eV/K (1 eV ≙ 11 604.5 K)</td></tr>
    </tbody>
  </table>
</div>

<style>
  .page {
    max-width: 48rem;
    margin: 2.5rem auto 4rem;
    padding: 0 1rem;
  }
  h1 {
    font-family: var(--font-display);
    margin: 0 0 0.5rem;
  }
  h2 {
    font-family: var(--font-display);
    margin-top: 2rem;
  }
  .lede {
    color: var(--ink-2);
    margin-bottom: 1.4rem;
  }
  .consts {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.9rem;
  }
  .consts th,
  .consts td {
    text-align: left;
    padding: 0.35rem 0.6rem;
    border-bottom: 1px solid var(--line);
    text-transform: none;
    letter-spacing: 0;
  }
</style>
