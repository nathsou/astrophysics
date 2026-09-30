<!-- Placeholder: the lattice exercise is implemented in a later milestone (see docs/PLAN.md). -->
<script lang="ts">
  import ExerciseFrame from './ExerciseFrame.svelte';
  import type { ExerciseBase } from './types';
  let { spec }: { spec: ExerciseBase } = $props();
</script>

<ExerciseFrame id={spec.id} kind="Lattice" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []} solution={spec.solution}>
  <p class="ui">This exercise is not available yet.</p>
</ExerciseFrame>
