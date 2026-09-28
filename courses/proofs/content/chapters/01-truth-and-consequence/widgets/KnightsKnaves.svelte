<!--
  Knights always tell the truth, knaves always lie (Smullyan). Decide who is who; the widget
  checks the assignment against every statement, and can show the truth table that solves it.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  interface Puzzle {
    people: string[];
    says: { who: number; text: string; claim: (k: boolean[]) => boolean }[];
  }
  const PUZZLES: Puzzle[] = [
    {
      people: ['Alice', 'Bob'],
      says: [{ who: 0, text: 'We are both knaves.', claim: (k) => !k[0] && !k[1] }],
    },
    {
      people: ['Alice', 'Bob'],
      says: [
        { who: 0, text: 'Bob is a knave.', claim: (k) => !k[1] },
        { who: 1, text: 'Alice and I are of the same kind.', claim: (k) => k[0] === k[1] },
      ],
    },
    {
      people: ['Alice', 'Bob', 'Carol'],
      says: [
        { who: 0, text: 'Bob is a knave.', claim: (k) => !k[1] },
        { who: 1, text: 'Carol is a knave.', claim: (k) => !k[2] },
        { who: 2, text: 'Alice and Bob are both knaves.', claim: (k) => !k[0] && !k[1] },
      ],
    },
  ];

  let which = $state(0);
  let knight = $state<(boolean | null)[]>([null, null]);
  let checked = $state(false);
  let showTable = $state(false);
  const P = $derived(PUZZLES[which]!);

  function choose(i: number) {
    which = i;
    knight = PUZZLES[i]!.people.map(() => null);
    checked = false;
    showTable = false;
  }

  /** A statement is consistent with the assignment iff (speaker is a knight) ↔ (claim is true). */
  const consistent = (k: boolean[]) => P.says.every((s) => k[s.who] === s.claim(k));
  const all = $derived(
    Array.from({ length: 1 << P.people.length }, (_, m) => P.people.map((_, i) => ((m >> (P.people.length - 1 - i)) & 1) === 0)),
  );
  const solutions = $derived(all.filter(consistent));
  const complete = $derived(knight.every((x) => x !== null));
  const ok = $derived(complete && consistent(knight as boolean[]));
</script>

<Widget title="Knights and knaves" subtitle="On this island knights always tell the truth and knaves always lie. Decide who is who." onreset={() => choose(which)}>
  {#snippet controls()}
    <div class="tabs" role="tablist">
      {#each PUZZLES as _, i (i)}
        <button role="tab" aria-selected={which === i} class:on={which === i} onclick={() => choose(i)}>Puzzle {i + 1}</button>
      {/each}
    </div>
  {/snippet}
  <div class="scene">
    {#each P.people as name, i (name)}
      <div class="person" class:kn={knight[i] === true} class:kv={knight[i] === false}>
        <div class="avatar" aria-hidden="true">{knight[i] === true ? '🛡️' : knight[i] === false ? '🎭' : '❔'}</div>
        <div class="name">{name}</div>
        {#each P.says.filter((s) => s.who === i) as s (s.text)}
          <div class="bubble">“{s.text}”</div>
        {/each}
        <div class="choice">
          <button class:on={knight[i] === true} onclick={() => ((knight[i] = true), (checked = false))}>Knight</button>
          <button class:on={knight[i] === false} onclick={() => ((knight[i] = false), (checked = false))}>Knave</button>
        </div>
      </div>
    {/each}
  </div>
  <div class="row">
    <button class="go" disabled={!complete} onclick={() => (checked = true)}>Check</button>
    {#if checked}
      <span class:ok class:bad={!ok}>
        {#if ok}✓ Consistent: every statement is true exactly when its speaker is a knight.{:else}✗ Someone’s statement doesn’t match their kind. Try again.{/if}
      </span>
    {/if}
    <span class="spacer"></span>
    <button class="link" onclick={() => (showTable = !showTable)}>{showTable ? 'Hide' : 'Solve by'} truth table</button>
  </div>
  {#if showTable}
    <table class="tt num">
      <thead>
        <tr>{#each P.people as n (n)}<th>{n}</th>{/each}<th>consistent?</th></tr>
      </thead>
      <tbody>
        {#each all as k, r (r)}
          <tr class:sol={consistent(k)}>
            {#each k as x, i (i)}<td>{x ? 'knight' : 'knave'}</td>{/each}
            <td>{consistent(k) ? '✓' : '✗'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="note">{solutions.length === 1 ? 'Exactly one row is consistent, so the puzzle has a unique answer.' : `${solutions.length} rows are consistent.`}</p>
  {/if}
</Widget>

<style>
  .tabs {
    display: flex;
    gap: 0.25rem;
  }
  .tabs button,
  .choice button {
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.2rem 0.7rem;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .tabs button.on,
  .choice button.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .scene {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1.2rem;
    padding: 0.5rem 0 1rem;
  }
  .person {
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 0.4rem;
    width: 12rem;
    padding: 0.7rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--page);
    transition: border-color 0.2s;
  }
  .person.kn {
    border-color: var(--byrne-blue);
  }
  .person.kv {
    border-color: var(--byrne-red);
  }
  .avatar {
    font-size: 2rem;
  }
  .name {
    font-weight: 650;
  }
  .bubble {
    font-family: var(--font-body);
    font-style: italic;
    font-size: 0.98rem;
    text-align: center;
    background: var(--surface-2);
    border-radius: 12px;
    padding: 0.35rem 0.7rem;
  }
  .choice {
    display: flex;
    gap: 0.3rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.85rem;
  }
  .spacer {
    flex: 1;
  }
  .go {
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    border-radius: 6px;
    padding: 0.3rem 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .go:disabled {
    opacity: 0.5;
  }
  .link {
    border: 0;
    background: none;
    color: var(--accent);
    text-decoration: underline;
    cursor: pointer;
  }
  .ok {
    color: var(--ok);
    font-weight: 600;
  }
  .bad {
    color: var(--bad);
    font-weight: 600;
  }
  .tt {
    width: auto;
    margin: 0.75rem auto 0;
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  .tt th,
  .tt td {
    padding: 0.2rem 0.7rem;
    border-bottom: 1px solid var(--rule);
    text-align: center;
  }
  tr.sol td {
    background: var(--ok-soft);
    font-weight: 600;
  }
  .note {
    text-align: center;
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.4rem 0 0;
  }
</style>
