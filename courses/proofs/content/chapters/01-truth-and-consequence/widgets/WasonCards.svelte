<!--
  The Wason selection task (1966): which cards must you turn over to test the rule
  "if a card has a vowel on one side, it has an even number on the other"?
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  const cards = [
    { face: 'E', back: '7', must: true, why: 'A vowel: if the back is odd, the rule is broken.' },
    { face: 'K', back: '4', must: false, why: 'A consonant: the rule says nothing about consonants, whatever is on the back.' },
    { face: '4', back: 'A', must: false, why: 'An even number: the rule does not say only vowels have even numbers, so any back is fine.' },
    { face: '7', back: 'U', must: true, why: 'An odd number: if the back is a vowel, the rule is broken. (Here it is — the rule is false!)' },
  ];
  let picked = $state<boolean[]>([false, false, false, false]);
  let revealed = $state(false);
  const correct = $derived(cards.every((c, i) => c.must === picked[i]));

  function reset() {
    picked = [false, false, false, false];
    revealed = false;
  }
</script>

<Widget title="Four cards" subtitle="Each card has a letter on one side and a number on the other. Rule: “If a card has a vowel on one side, then it has an even number on the other.” Which cards must you turn over to check the rule? Pick as few as possible." onreset={reset}>
  <div class="table">
    {#each cards as c, i (i)}
      <button class="card" class:picked={picked[i]} class:flipped={revealed && picked[i]} onclick={() => !revealed && (picked[i] = !picked[i])} aria-pressed={picked[i]} aria-label="Card showing {c.face}">
        <span class="inner">
          <span class="front">{c.face}</span>
          <span class="back">{c.back}</span>
        </span>
      </button>
    {/each}
  </div>
  <div class="row ui">
    {#if !revealed}
      <button class="go" onclick={() => (revealed = true)} disabled={!picked.some(Boolean)}>Turn over my cards</button>
    {:else}
      <p class="verdict" class:ok={correct}>
        {#if correct}Right: E and 7 — and only those.{:else}The answer is E and 7. Most people choose E and 4; fewer than one in ten get it right.{/if}
      </p>
    {/if}
  </div>
  {#if revealed}
    <ul class="why ui">
      {#each cards as c, i (i)}
        <li class:must={c.must}><strong>{c.face}</strong> — {c.must ? 'must be turned.' : 'need not be turned.'} {c.why}</li>
      {/each}
    </ul>
  {/if}
</Widget>

<style>
  .table {
    display: flex;
    justify-content: center;
    gap: 1rem;
    padding: 0.5rem 0 1rem;
    perspective: 800px;
  }
  .card {
    width: 5.2rem;
    height: 7.4rem;
    border: 0;
    padding: 0;
    background: none;
    cursor: pointer;
  }
  .inner {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    transition: transform 0.7s cubic-bezier(0.45, 0, 0.2, 1);
    transform-style: preserve-3d;
  }
  .flipped .inner {
    transform: rotateY(180deg);
  }
  .front,
  .back {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border-radius: 10px;
    font-family: var(--font-body);
    font-size: 2.4rem;
    font-weight: 600;
    backface-visibility: hidden;
    border: 2px solid var(--rule-strong);
    background: var(--page);
    color: var(--ink);
    box-shadow: var(--shadow);
  }
  .back {
    transform: rotateY(180deg);
    background: var(--surface-2);
    color: var(--accent);
  }
  .picked .front,
  .picked .back {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft), var(--shadow);
  }
  .row {
    display: flex;
    justify-content: center;
  }
  .go {
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    border-radius: 7px;
    padding: 0.4rem 1rem;
    font-weight: 600;
    cursor: pointer;
  }
  .go:disabled {
    opacity: 0.5;
  }
  .verdict {
    margin: 0;
    font-weight: 600;
    color: var(--bad);
  }
  .verdict.ok {
    color: var(--ok);
  }
  .why {
    margin: 0.8rem 0 0;
    padding-left: 1.2rem;
    font-size: 0.85rem;
  }
  .why li.must strong {
    color: var(--accent);
  }
</style>
