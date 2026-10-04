<!--
  The Vouch-specific exercises (PLAN §5), dispatched by kind. Kinds whose engines are chapter-specific (ltl,
  encode, play, drive, rewrite) are implemented next to their engines and registered here.
-->
<script lang="ts">
  import VerifyExercise from './vouch/VerifyExercise.svelte';
  import SpecExercise from './vouch/SpecExercise.svelte';
  import BugExercise from './vouch/BugExercise.svelte';
  import LtlExercise from './vouch/LtlExercise.svelte';
  import EncodeExercise from './vouch/EncodeExercise.svelte';
  import RewriteExercise from './vouch/RewriteExercise.svelte';

  let { spec }: { spec: { id: string; kind: string; [k: string]: unknown } } = $props();
</script>

{#if spec.kind === 'verify' || spec.kind === 'invariant' || spec.kind === 'model'}
  <VerifyExercise spec={spec as never} />
{:else if spec.kind === 'spec'}
  <SpecExercise spec={spec as never} />
{:else if spec.kind === 'bug'}
  <BugExercise spec={spec as never} />
{:else if spec.kind === 'ltl'}
  <LtlExercise spec={spec as never} />
{:else if spec.kind === 'encode'}
  <EncodeExercise spec={spec as never} />
{:else if spec.kind === 'rewrite'}
  <RewriteExercise spec={spec as never} />
{:else}
  <p class="ui">Unknown exercise kind {spec.kind}.</p>
{/if}
