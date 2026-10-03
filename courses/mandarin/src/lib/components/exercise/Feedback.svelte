<script lang="ts">
  /** Right/wrong feedback line; explanations may contain Chinese. */
  import Rich from './Rich.svelte';
  let { ok, text = '', explain }: { ok: boolean | null; text?: string; explain?: string } = $props();
</script>

{#if ok !== null}
  <p class="fb" class:ok class:bad={!ok}>
    <strong>{ok ? '对！' : '不对。'}</strong>
    {#if text}<Rich {text} />{/if}
    {#if explain}<span class="ex"><Rich text={explain} /></span>{/if}
  </p>
{/if}

<style>
  .fb {
    margin: 0;
  }
  .fb strong {
    font-family: var(--font-zh);
    font-size: 1.05rem;
    margin-right: 0.2rem;
  }
  .ok strong {
    color: var(--jade);
  }
  .bad strong {
    color: var(--accent-ink);
  }
  .ex {
    display: block;
    color: var(--ink-2);
    margin-top: 0.15rem;
  }
</style>
