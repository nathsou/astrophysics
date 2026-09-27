<!--
  Shannon's guessing game (1951). Guess the next character of a passage; the number of guesses
  you need at each position gives upper and lower bounds on the entropy of English — as you
  predict it. The unigram and bigram "players" guess in order of their probabilities.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { shakespeare, ALPHABET27, type CorpusStats } from '../corpus-stats';

  const LEN = 48;
  let s = $state<CorpusStats | null>(null);
  let passage = $state('');
  let pos = $state(0);
  let wrong: string[] = $state([]);
  let guesses: number[] = $state([]);
  let input: HTMLInputElement | undefined = $state();

  const idx = (c: string) => (c === ' ' ? 26 : c.charCodeAt(0) - 97);

  onMount(async () => {
    s = await shakespeare();
    newPassage();
  });

  function newPassage() {
    if (!s) return;
    const t = s.text27;
    let start = Math.floor(Math.random() * (t.length - LEN * 2));
    start = t.indexOf(' ', start) + 1;
    passage = t.slice(start, start + LEN).trimEnd();
    pos = 0;
    wrong = [];
    guesses = [];
  }

  function guess(c: string) {
    if (pos >= passage.length || !ALPHABET27.includes(c) || wrong.includes(c)) return;
    if (c === passage[pos]) {
      guesses = [...guesses, wrong.length + 1];
      wrong = [];
      pos++;
    } else {
      wrong = [...wrong, c];
    }
  }

  /** Guess counts for a model that guesses characters in descending probability order. */
  function modelGuesses(kind: 'unigram' | 'bigram'): number[] {
    if (!s || !passage) return [];
    const out: number[] = [];
    for (let i = 0; i < passage.length; i++) {
      const cur = idx(passage[i]!);
      let scores: ArrayLike<number> = s.counts27;
      if (kind === 'bigram' && i > 0) {
        const p = idx(passage[i - 1]!);
        scores = s.bigram27.subarray(p * 27, p * 27 + 27);
      }
      // Rank = 1 + number of characters the model considers more likely than the true one.
      let rank = 1;
      for (let j = 0; j < 27; j++) if (scores[j]! > scores[cur]! || (scores[j] === scores[cur] && j < cur)) rank++;
      out.push(rank);
    }
    return out;
  }

  /** Shannon's (1951) bounds on entropy per character from the guess-count distribution q_i. */
  function bounds(g: number[]): { upper: number; lower: number; q: number[] } {
    const q = Array(28).fill(0);
    for (const n of g) q[n]++;
    for (let i = 1; i <= 27; i++) q[i] /= g.length || 1;
    let upper = 0, lower = 0;
    for (let i = 1; i <= 27; i++) {
      if (q[i] > 0) upper -= q[i] * Math.log2(q[i]);
      lower += i * (q[i] - (q[i + 1] ?? 0)) * Math.log2(i);
    }
    return { upper, lower, q };
  }

  const players = $derived([
    { name: 'You', g: guesses },
    // Models are scored on exactly the characters you have revealed, so the rows are comparable.
    { name: 'Unigram model', g: modelGuesses('unigram').slice(0, pos) },
    { name: 'Bigram model', g: modelGuesses('bigram').slice(0, pos) },
  ]);
  const done = $derived(pos >= passage.length && passage.length > 0);
  const unigramH = $derived.by(() => {
    if (!s) return 0;
    const tot = s.counts27.reduce((a, b) => a + b, 0);
    return -[...s.counts27].reduce((a, c) => a + (c > 0 ? (c / tot) * Math.log2(c / tot) : 0), 0);
  });
</script>

<Widget
  title="Shannon’s guessing game"
  subtitle="Guess the next character (a–z or space). Each position records how many guesses you needed. Good predictors need few guesses — and that is exactly what low entropy means."
  onreset={newPassage}
>
  {#snippet controls()}
    <Button onclick={newPassage} disabled={!s}>New passage</Button>
    <Button variant="ghost" onclick={() => pos < passage.length && guess(passage[pos]!)} disabled={done}>Reveal next</Button>
    <span class="hint">Progress {pos}/{passage.length}</span>
  {/snippet}

  {#if !s}
    <p class="muted">Loading Shakespeare…</p>
  {:else}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="board" onclick={() => input?.focus()}>
      {#each passage as c, i (i)}
        <span class="cell" class:cur={i === pos} class:done={i < pos}>
          <span class="ch">{i < pos ? (c === ' ' ? '␣' : c) : i === pos ? '?' : '·'}</span>
          <span class="n num" class:first={guesses[i] === 1}>{i < pos ? guesses[i] : ''}</span>
        </span>
      {/each}
    </div>
    <div class="entry">
      <label>
        <span>Your guess</span>
        <input
          bind:this={input}
          value=""
          maxlength="1"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          disabled={done}
          aria-label="Type your guess for the next character"
          oninput={(e) => {
            const v = e.currentTarget.value.toLowerCase();
            e.currentTarget.value = '';
            if (v) guess(v);
          }}
        />
      </label>
      {#if wrong.length}<span class="wrong">Not: {#each wrong as w (w)}<s>{w === ' ' ? '␣' : w}</s>{/each}</span>{/if}
    </div>

    <table class="res">
      <thead>
        <tr><th>Player</th><th class="r">Avg. guesses</th><th class="r">Lower bound</th><th class="r">Upper bound</th><th>Guess-count distribution</th></tr>
      </thead>
      <tbody>
        {#each players as pl (pl.name)}
          {@const b = bounds(pl.g)}
          <tr>
            <th>{pl.name}</th>
            {#if pos > 0}
              <td class="r num">{(pl.g.reduce((a, x) => a + x, 0) / pl.g.length).toFixed(2)}</td>
              <td class="r num">{b.lower.toFixed(2)}</td>
              <td class="r num">{b.upper.toFixed(2)}</td>
              <td>
                <svg class="spark" viewBox="0 0 108 24" aria-label="Histogram of guesses needed">
                  {#each b.q.slice(1, 28) as qi, i (i)}<rect x={i * 4} y={24 - qi * 24} width="3" height={qi * 24} rx="1" />{/each}
                </svg>
              </td>
            {:else}
              <td colspan="4" class="muted">play a few characters first</td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="foot">
      Bounds in bits per character, over the characters revealed so far. For reference: a uniform guess over 27 symbols is
      log₂27 = 4.75 bits; the unigram entropy of this corpus is {unigramH.toFixed(2)} bits. Shannon’s own subjects, given up
      to 100 characters of context, came out at roughly 0.6–1.3 bits.
    </p>
  {/if}
</Widget>

<style>
  .hint,
  .muted {
    font-size: 0.8rem;
    color: var(--ink-3);
  }
  .board {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: 0.6rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    cursor: text;
  }
  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 1.5rem;
  }
  .ch {
    font-family: var(--font-mono);
    font-size: 1.1rem;
    color: var(--ink-3);
    line-height: 1.5;
  }
  .done .ch {
    color: var(--ink);
  }
  .cur .ch {
    color: var(--accent);
    font-weight: 700;
    border-bottom: 2px solid var(--accent-2);
  }
  .n {
    font-size: 0.65rem;
    color: var(--ink-2);
    min-height: 0.9rem;
  }
  .n.first {
    color: var(--ink-3);
  }
  .entry {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 0.7rem 0 1rem;
  }
  .entry label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .entry input {
    width: 2.6rem;
    height: 2.2rem;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 1.1rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
  }
  .wrong {
    font-size: 0.85rem;
    color: var(--ink-2);
    display: inline-flex;
    gap: 0.35rem;
  }
  .wrong s {
    font-family: var(--font-mono);
    color: var(--critical);
  }
  .res {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  .res th,
  .res td {
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid var(--rule);
    text-align: left;
  }
  .res thead th {
    color: var(--ink-2);
    font-weight: 600;
  }
  .r {
    text-align: right !important;
  }
  .spark {
    width: 108px;
    height: 24px;
  }
  .spark rect {
    fill: var(--series-1);
  }
  .foot {
    margin: 0.6rem 0 0;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
</style>
