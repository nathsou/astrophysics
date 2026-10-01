<script lang="ts">
  import { COURSE_TITLE } from '$content/outline';
  import ControlRoom from '$lib/control/ControlRoom.svelte';
</script>

<svelte:head>
  <title>The Control Room · {COURSE_TITLE}</title>
  <meta name="description" content="The whole mini-LHC in the browser: machine, generator, detector, reconstruction, trigger and analysis, running your own code." />
</svelte:head>

<ControlRoom />
