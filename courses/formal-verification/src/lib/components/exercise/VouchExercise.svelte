<!--
  Placeholder for the Vouch-specific exercises (verify, spec, invariant, model, ltl, encode, play, drive,
  rewrite, bug). Replaced by the real implementations as the engines land.
-->
<script lang="ts">
  let { spec }: { spec: { id: string; kind: string; title?: string; prompt?: string } } = $props();
</script>

<section class="ex ui" aria-label="Exercise">
  <p class="k">{spec.kind} exercise</p>
  {#if spec.title}<h3>{spec.title}</h3>{/if}
  {#if spec.prompt}<div>{@html spec.prompt}</div>{/if}
</section>

<style>
  .ex {
    margin: 1.5rem 0;
    padding: 1rem;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
  }
  .k {
    margin: 0;
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--mute);
  }
</style>
