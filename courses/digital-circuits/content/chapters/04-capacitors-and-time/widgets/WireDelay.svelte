<!-- Chapter 4's wire-delay figure: the RC lab with a logic output's resistance and a wire's capacitance (see RcLab.svelte). -->
<script lang="ts">
  import RcLab from './RcLab.svelte';

  let { n }: { n?: string } = $props();
</script>

<RcLab preset="wire" {n} />
