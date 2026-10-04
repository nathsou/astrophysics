<script lang="ts">
  import ExerciseFrame from '../ExerciseFrame.svelte';
  let { spec }: { spec: { id: string; title?: string; prompt?: string; hints?: string[] } } = $props();
</script>

<ExerciseFrame id={spec.id} kind="rewrite" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []}>
  <p class="ui">This exercise is being built.</p>
</ExerciseFrame>
