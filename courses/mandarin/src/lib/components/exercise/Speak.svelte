<script lang="ts">
  import { untrack } from 'svelte';
  import type { Speak } from '$lib/exercises/types';
  import { Sequence } from '$lib/exercises/sequence.svelte';
  import Steps from './Steps.svelte';
  import ToneMirror from '../zh/ToneMirror.svelte';

  let { data, report }: { data: Speak; id: string; report: (ok: boolean) => void } = $props();
  const seq = new Sequence(untrack(() => data.items.length));
  const item = $derived(data.items[seq.index]!);

  function result(ok: boolean | null) {
    // Single syllables are judged; for words the learner compares the shapes themselves.
    if (ok === null) {
      seq.attempt(true);
      return;
    }
    seq.attempt(ok);
  }
</script>

<Steps {seq} {report} canReveal>
  {#key `${seq.index}:${seq.round}`}
    <ToneMirror text={item} onresult={result} />
  {/key}
  {#snippet feedback()}
    {#if !seq.settled}<span class="tip">Recordings stay on your device.</span>{/if}
  {/snippet}
</Steps>

<style>
  .tip {
    font-size: 0.8rem;
    color: var(--mute);
  }
</style>
