<!--
  Development lab for the FPGA Studio widgets (not linked from the course): the compact Studio, vFPGA-S by hand,
  the placement and routing replay, and the LUT explorer.
-->
<script lang="ts">
  import DeviceStudio from '$lib/studio/widgets/DeviceStudio.svelte';
  import FpgaByHand from '$lib/studio/widgets/FpgaByHand.svelte';
  import FpgaStudio from '$lib/studio/widgets/FpgaStudio.svelte';
  import LutExplorer from '$lib/studio/widgets/LutExplorer.svelte';
  import PlaceRouteReplay from '$lib/studio/widgets/PlaceRouteReplay.svelte';
</script>

<article class="lab">
  <h1>FPGA lab</h1>
  <p class="lede">The FPGA Studio widgets, for design review. Not linked from the course.</p>

  <h2>LUT explorer</h2>
  <LutExplorer n="28.1" />

  <h2>By hand</h2>
  <FpgaByHand n="28.2" />

  <h2>Compact Studio</h2>
  <FpgaStudio n="30.1" design="counter" views="source,chip,logic,bits,report,board,replay" />
  <FpgaStudio n="30.2" design="hex-counter" size="M" views="chip,board,logic" title="The hex counter on the board" />

  <h2>As a device of the generic Device Studio widget</h2>
  <DeviceStudio device="fpga" example="traffic-light" views="source,chip,logic" n="30.4" />

  <h2>Place and route replay</h2>
  <PlaceRouteReplay n="30.3" design="alu" />
</article>

<style>
  .lab {
    max-width: 78rem;
    margin: 0 auto;
    padding: 1rem 1rem 4rem;
  }
  .lede {
    color: var(--mute);
  }
</style>
