<!--
  Turing's diagonal argument as a game. Propose a halting predictor H; the machine builds the
  contrarian program D, which asks H about itself and does the opposite. Whatever H says about
  D, it is wrong.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  interface Predictor {
    name: string;
    code: string;
    /** What H answers when asked about (D, D). */
    verdictOnD: 'halts' | 'loops';
    how: string;
  }
  const PREDICTORS: Predictor[] = [
    { name: 'The optimist', code: 'def H(P, x):\n    return "halts"', verdictOnD: 'halts', how: 'The optimist says every program halts.' },
    { name: 'The pessimist', code: 'def H(P, x):\n    return "loops"', verdictOnD: 'loops', how: 'The pessimist says every program runs for ever.' },
    { name: 'The syntax checker', code: 'def H(P, x):\n    if "while True" in P:\n        return "loops"\n    return "halts"', verdictOnD: 'loops', how: 'D contains the text “while True”, so the syntax checker says it loops.' },
    { name: 'The patient simulator', code: 'def H(P, x):\n    run P on x for a billion steps\n    if it stopped: return "halts"\n    return "loops"', verdictOnD: 'loops', how: 'To run D on D for a billion steps, the simulator must run D, which calls H, which starts another simulation of D… The billion steps run out before anything finishes, so it answers “loops”.' },
  ];

  let which = $state(0);
  let phase = $state<'idle' | 'asking' | 'answer' | 'done'>('idle');
  const H = $derived(PREDICTORS[which]!);
  const actual = $derived(H.verdictOnD === 'halts' ? 'loops' : 'halts');

  async function run() {
    phase = 'asking';
    await new Promise((r) => setTimeout(r, 900));
    phase = 'answer';
    await new Promise((r) => setTimeout(r, 1100));
    phase = 'done';
  }
  function pick(i: number) {
    which = i;
    phase = 'idle';
  }
</script>

<Widget title="The contrarian machine" subtitle="Choose a program H that claims to predict whether any program halts. The machine builds D, which asks H about itself — and does the opposite." onreset={() => (phase = 'idle')}>
  {#snippet controls()}
    <div class="tabs">
      {#each PREDICTORS as p, i (i)}<button class:on={which === i} onclick={() => pick(i)}>{p.name}</button>{/each}
    </div>
    <button class="go" onclick={run} disabled={phase === 'asking' || phase === 'answer'}>Run D on D</button>
  {/snippet}
  <div class="cols">
    <figure>
      <figcaption>Your predictor H</figcaption>
      <pre>{H.code}</pre>
    </figure>
    <figure>
      <figcaption>The contrarian D, built from H</figcaption>
      <pre>def D(P):
    if H(P, P) == "halts":
        while True: pass   # loop for ever
    else:
        return             # halt at once</pre>
    </figure>
  </div>
  <div class="stage" data-phase={phase}>
    <div class="step" class:on={phase !== 'idle'}>1. D(D) asks: <code>H(D, D)</code>?</div>
    <div class="step" class:on={phase === 'answer' || phase === 'done'}>2. H answers <strong class="v">“{H.verdictOnD}”</strong>. {H.how}</div>
    <div class="step" class:on={phase === 'done'}>
      3. So D does the opposite and <strong class="v">{actual === 'halts' ? 'halts at once' : 'loops for ever'}</strong>
      {#if actual === 'loops'}<span class="spin" aria-hidden="true">⟳</span>{/if}.
    </div>
    {#if phase === 'done'}
      <p class="verdict">H said D {H.verdictOnD === 'halts' ? 'halts' : 'loops'} on input D; in fact it {actual === 'halts' ? 'halts' : 'loops'}. <strong>H is wrong</strong> — and the same trap works for every possible H.</p>
    {/if}
  </div>
</Widget>

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  button {
    font: inherit;
    font-size: 0.78rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
  }
  .tabs button.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .go {
    border-color: var(--byrne-red);
  }
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  @media (max-width: 640px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  figure {
    margin: 0;
  }
  figcaption {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-3);
    font-weight: 650;
    margin-bottom: 0.25rem;
  }
  pre {
    margin: 0;
    padding: 0.6rem 0.7rem;
    border-radius: 6px;
    background: var(--page);
    border: 1px solid var(--border);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    line-height: 1.5;
    overflow-x: auto;
  }
  .stage {
    margin-top: 0.8rem;
    display: grid;
    gap: 0.35rem;
    font-size: 0.88rem;
  }
  .step {
    opacity: 0.3;
    transition: opacity 0.4s;
  }
  .step.on {
    opacity: 1;
  }
  .v {
    color: var(--byrne-red);
  }
  .spin {
    display: inline-block;
    animation: spin 1s linear infinite;
    color: var(--byrne-red);
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .verdict {
    margin: 0.4rem 0 0;
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    background: var(--bad-soft);
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.82rem;
  }
</style>
