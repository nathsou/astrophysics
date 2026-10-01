<script lang="ts">
  import Pipeline from '$lib/control/Pipeline.svelte';
</script>
<div style="max-width:60rem;margin:1rem auto;padding:0 1rem">
  <Pipeline preset="zmumu" n="T.1" caption="all stages" />
  <Pipeline preset="higgs-4l" n="T.2" stage="trigger" />
  <Pipeline preset="dijet" n="T.3" />
  <Pipeline preset="ttbar" n="T.4" stage="reconstruction" />
  <Pipeline preset="ee-zpole" n="T.5" stage="generator" />
  <Pipeline preset="higgs-gamgam" n="T.6" stage="machine" />
  <Pipeline preset="minbias" n="T.7" stage="analysis" data="real" />
</div>
