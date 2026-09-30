<!-- The Device Studio widgets as chapters use them (a gallery for review; not linked from the navigation). -->
<script lang="ts">
  import * as W from '$lib/widgets';
</script>

<svelte:head><title>Device Studio widgets</title></svelte:head>

<article class="gallery">
  <h1>Device Studio widgets</h1>
  <h2>::prom-fuses</h2>
  <W.PromFuses />
  <h2>::pla-planes</h2>
  <W.PlaPlanes />
  <h2>::device-studio (GAL22V10)</h2>
  <W.DeviceStudio device="gal22v10" example="traffic-light" views="source,chip,logic" />
  <h2>::device-studio (vCPLD-32)</h2>
  <W.DeviceStudio device="cpld32" example="bcd-display" views="chip,logic,bits,report" />
  <h2>::jtag-tap</h2>
  <W.JtagTap />
</article>

<style>
  .gallery {
    max-width: 78rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 4rem;
  }
</style>
