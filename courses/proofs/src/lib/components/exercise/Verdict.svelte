<!-- A compact badge for a step checker verdict. -->
<script lang="ts">
  import type { Verdict } from '$lib/cas';
  import { fmtNum } from '$lib/cas';

  let { v }: { v: Verdict } = $props();

  const at = $derived(
    v.how === 'counterexample'
      ? Object.entries(v.at)
          .map(([k, x]) => `${k.replace(/_(\w+)/, '$1')} = ${fmtNum(x)}`)
          .join(', ')
      : '',
  );
</script>

{#if v.how === 'exact'}
  <span class="v ok" title="Both sides have the same canonical form, so this step is proved.">✓ algebra</span>
{:else if v.how === 'tested'}
  <span class="v tested" title="No symbolic proof, but it held at all {v.samples} test values: very probably true.">✓ tested ×{v.samples}</span>
{:else if v.how === 'counterexample'}
  <span class="v bad" title="This step is false: here is a counterexample.">✗ fails at {at}: {fmtNum(v.lhs)} vs {fmtNum(v.rhs)}</span>
{:else}
  <span class="v err">⚠ {v.message}</span>
{/if}

<style>
  .v {
    display: inline-block;
    font-family: var(--font-ui);
    font-size: 0.74rem;
    font-weight: 600;
    padding: 0.1rem 0.5rem;
    border-radius: 99px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .ok {
    color: var(--ok);
    background: var(--ok-soft);
  }
  .tested {
    color: var(--ok);
    background: transparent;
    border: 1px dashed color-mix(in srgb, var(--ok) 60%, transparent);
  }
  .bad {
    color: var(--bad);
    background: var(--bad-soft);
    white-space: normal;
  }
  .err {
    color: var(--maybe);
    background: var(--maybe-soft);
    white-space: normal;
  }
</style>
