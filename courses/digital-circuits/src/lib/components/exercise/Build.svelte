<!-- A ```build block: see circuit/CircuitExercise.svelte and circuit/spec.ts for the schema. -->
<script lang="ts">
  import CircuitExercise from './circuit/CircuitExercise.svelte';
  import type { BuildInput } from './circuit/spec';

  let { spec }: { spec: BuildInput } = $props();
</script>

<CircuitExercise {spec} kind="Build" />
