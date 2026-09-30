<!--
  A DCL playground that starts from a program kept in snippets.ts (so that the tests can run it):

    ::snippet-playground{id="fix-the-test" n="29.3" caption="…"}

  It is the shared playground (`$lib/widgets/dcl/DclPlayground.svelte`): an editor that checks as you type, a
  simulator, the gates, and the file's tests.
-->
<script lang="ts">
  import DclPlayground from '$lib/widgets/dcl/DclPlayground.svelte';
  import { SNIPPETS } from './snippets';

  let {
    id,
    title,
    subtitle,
    caption,
    n,
    tests = true,
    circuit = true,
    tab,
  }: {
    id: string;
    title?: string;
    subtitle?: string;
    caption?: string;
    n?: string | number;
    tests?: boolean;
    circuit?: boolean;
    tab?: string;
  } = $props();

  const snippet = $derived(SNIPPETS[id]);
</script>

{#if snippet}
  <DclPlayground code={snippet.code} top={snippet.top} title={title ?? snippet.title} {subtitle} {caption} {n} {tests} {circuit} {tab} />
{:else}
  <p role="alert">Unknown snippet “{id}”.</p>
{/if}
