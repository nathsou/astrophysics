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
    font-family: var(--font-mono);
    font-size: 0.74rem;
    font-weight: 700;
    padding: 0.1rem 0.15rem;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  /* Accepted = blue, pending / wrong = red, as in the printed plates. */
  .ok {
    color: var(--ok);
  }
  .tested {
    color: var(--ok);
    font-weight: 500;
    border-bottom: 2px dashed currentColor;
  }
  .bad {
    color: var(--bad);
    white-space: normal;
  }
  .err {
    color: var(--maybe);
    white-space: normal;
  }
</style>
