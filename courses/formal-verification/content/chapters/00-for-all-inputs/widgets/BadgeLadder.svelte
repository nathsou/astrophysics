<!--
  The badge ladder: every result in the course is reported with one of these badges, from the weakest claim
  (some inputs were tried) to the strongest (a proof for all inputs, with a checked certificate).
-->
<script lang="ts">
  import Badge from '$lib/components/verify/Badge.svelte';
  import type { Verdict } from '$lib/fv/engines';

  let { caption }: { caption?: string } = $props();

  const none = { kind: 'none' as const, checked: false, checker: '' };
  const rungs: { verdict: Verdict; claim: string }[] = [
    {
      claim: 'Some inputs were run, with every contract checked at run time. Says nothing about the others.',
      verdict: { engine: 'test', status: 'unknown', subject: 'search meets its contract', badge: { kind: 'tested', runs: 20000 }, certificate: none, assumptions: ['only the inputs that were tried'], stats: { runs: 20000 } },
    },
    {
      claim: 'Every case up to a bound: all arrays up to some length, all runs up to some number of steps.',
      verdict: { engine: 'bmc', status: 'unknown', subject: 'the queue never overflows', badge: { kind: 'bounded', bound: 20, what: 'steps' }, certificate: none, assumptions: ['runs longer than 20 steps were not examined'], stats: {} },
    },
    {
      claim: 'Every reachable state of one finite instance, such as three processes or two shards.',
      verdict: { engine: 'explore', status: 'verified', subject: 'mutual exclusion', badge: { kind: 'exhaustive', states: 192, instance: '2 processes' }, certificate: { kind: 'state-space', checked: false, checker: 'the explorer' }, assumptions: ['the instance has 2 processes'], stats: { states: 192 } },
    },
    {
      claim: 'A proof for all inputs, whose certificate a small trusted checker re-checked.',
      verdict: { engine: 'vc', status: 'verified', subject: 'search meets its contract', badge: { kind: 'verified', scope: 'all inputs' }, certificate: { kind: 'smt-proof', checked: true, checker: 'the certificate checker (DRAT, Farkas, congruence, instances)' }, assumptions: ['the SMT encoding of Vouch is correct'], stats: { obligations: 23 } },
    },
    {
      claim: 'A concrete input, schedule or message order that breaks the property, replayed by the reference interpreter before it is shown.',
      verdict: { engine: 'vc', status: 'violated', subject: 'no overflow: the i8 arithmetic does not overflow', badge: { kind: 'violated', replayed: true }, certificate: { kind: 'trace', checked: true, checker: 'the reference interpreter (the failing run is the certificate)' }, assumptions: [], stats: {} },
    },
    {
      claim: 'The engine could not decide, and says why: a time limit, an undecidable question, or a proof that needs more help from you.',
      verdict: { engine: 'vc', status: 'unknown', subject: 'loop invariant preserved', badge: { kind: 'unknown', reason: 'counterexample to induction' }, certificate: none, assumptions: [], stats: {} },
    },
  ];
</script>

<figure class="ladder">
  <ol>
    {#each rungs as r, i (i)}
      <li>
        <Badge verdict={r.verdict} />
        <p>{r.claim}</p>
      </li>
    {/each}
  </ol>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .ladder {
    margin: 1.8rem 0;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  li {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 0.8rem;
    align-items: center;
  }
  @media (max-width: 700px) {
    li {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.2rem;
    }
  }
  p {
    margin: 0;
    font-size: 0.95rem;
    color: var(--ink-2);
  }
  figcaption {
    margin-top: 0.7rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
