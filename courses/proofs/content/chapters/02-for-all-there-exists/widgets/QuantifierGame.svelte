<!--
  Quantifiers as a game (Hintikka): the Prover chooses values for ∃, the Sceptic for ∀, in order.
  The Prover wins if the final condition holds. A statement is true exactly when the Prover has a
  winning strategy. The computer plays the other side, by minimax over candidate moves.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Tex from '$lib/components/exercise/Tex.svelte';

  type Env = Record<string, number>;
  interface Move {
    q: 'all' | 'some';
    v: string;
    /** TeX for the quantifier, e.g. "\\forall x \\in \\mathbb{R}". */
    tex: string;
    /** Constraint on a legal value (given earlier moves), with a description. */
    legal: (x: number, env: Env) => boolean;
    legalText: string;
    integer?: boolean;
    /** Moves the computer considers. */
    candidates: (env: Env) => number[];
  }
  interface Statement {
    name: string;
    tex: string;
    moves: Move[];
    matrix: (env: Env) => boolean;
    matrixTex: string;
    truth: boolean;
    moral: string;
  }

  const reals = (env: Env, extra: number[] = []) => [-100, -10, -3, -1, -0.5, 0, 0.5, 1, 2, 3, 10, 100, ...extra];
  const STATEMENTS: Statement[] = [
    {
      name: 'Always a bigger number',
      tex: '\\forall x \\in \\mathbb{R}\\; \\exists y \\in \\mathbb{R}:\\; y > x^2',
      moves: [
        { q: 'all', v: 'x', tex: '\\forall x', legal: () => true, legalText: 'any real number', candidates: () => reals({}) },
        { q: 'some', v: 'y', tex: '\\exists y', legal: () => true, legalText: 'any real number', candidates: (e) => [e.x! * e.x! + 1, e.x!, 0] },
      ],
      matrix: (e) => e.y! > e.x! * e.x!,
      matrixTex: 'y > x^2',
      truth: true,
      moral: 'Whatever x the Sceptic picks, the Prover answers y = x² + 1. The Prover’s choice may depend on x, because x was chosen first.',
    },
    {
      name: 'One number above all squares',
      tex: '\\exists y \\in \\mathbb{R}\\; \\forall x \\in \\mathbb{R}:\\; y > x^2',
      moves: [
        { q: 'some', v: 'y', tex: '\\exists y', legal: () => true, legalText: 'any real number', candidates: () => reals({}) },
        { q: 'all', v: 'x', tex: '\\forall x', legal: () => true, legalText: 'any real number', candidates: (e) => [Math.sqrt(Math.abs(e.y!)) + 1, 0, 1, 10, 1000] },
      ],
      matrix: (e) => e.y! > e.x! * e.x!,
      matrixTex: 'y > x^2',
      truth: false,
      moral: 'The same words in a different order. Now the Prover must commit to y first, and the Sceptic answers with x = √|y| + 1. Swapping ∀ and ∃ changed a true statement into a false one.',
    },
    {
      name: '1/n gets small',
      tex: '\\forall \\varepsilon > 0\\; \\exists N \\in \\mathbb{N}\\; \\forall n \\ge N:\\; \\tfrac1n < \\varepsilon',
      moves: [
        { q: 'all', v: 'epsilon', tex: '\\forall \\varepsilon > 0', legal: (x) => x > 0, legalText: 'a positive number', candidates: () => [1, 0.5, 0.1, 0.01, 0.001] },
        { q: 'some', v: 'N', tex: '\\exists N', integer: true, legal: (x) => Number.isInteger(x) && x >= 1, legalText: 'a positive integer', candidates: (e) => [Math.floor(1 / e.epsilon!) + 1, 1, 10] },
        { q: 'all', v: 'n', tex: '\\forall n \\ge N', integer: true, legal: (x, e) => Number.isInteger(x) && x >= e.N!, legalText: 'an integer n ≥ N', candidates: (e) => [e.N!, e.N! + 1, e.N! * 2] },
      ],
      matrix: (e) => 1 / e.n! < e.epsilon!,
      matrixTex: '\\tfrac1n < \\varepsilon',
      truth: true,
      moral: 'This is what “1/n → 0” means (Chapter 13). The Prover’s strategy: N = ⌊1/ε⌋ + 1. Then every n ≥ N has 1/n ≤ 1/N < ε.',
    },
    {
      name: 'A smallest number',
      tex: '\\exists m \\in \\mathbb{Z}\\; \\forall k \\in \\mathbb{Z}:\\; m \\le k',
      moves: [
        { q: 'some', v: 'm', tex: '\\exists m', integer: true, legal: (x) => Number.isInteger(x), legalText: 'an integer', candidates: () => [0, -1, -100, 1] },
        { q: 'all', v: 'k', tex: '\\forall k', integer: true, legal: (x) => Number.isInteger(x), legalText: 'an integer', candidates: (e) => [e.m! - 1, 0] },
      ],
      matrix: (e) => e.m! <= e.k!,
      matrixTex: 'm \\le k',
      truth: false,
      moral: 'The integers have no smallest element: whatever m the Prover names, the Sceptic answers k = m − 1. Over the natural numbers 0, 1, 2, … the same statement is true (m = 0) — Chapter 6 builds on exactly this.',
    },
  ];

  let which = $state(0);
  let role = $state<'some' | 'all'>('some'); // the learner's side
  let env = $state<Env>({});
  let step = $state(0);
  let input = $state('');
  let error = $state('');
  const S = $derived(STATEMENTS[which]!);
  const done = $derived(step >= S.moves.length);
  const proverWins = $derived(done ? S.matrix(env) : null);

  /** Can the Prover win from move i with the given environment (minimax over candidates)? */
  function proverCanWin(st: Statement, i: number, e: Env): boolean {
    if (i >= st.moves.length) return st.matrix(e);
    const m = st.moves[i]!;
    const cs = m.candidates(e).filter((x) => m.legal(x, e));
    if (m.q === 'some') return cs.some((x) => proverCanWin(st, i + 1, { ...e, [m.v]: x }));
    return cs.every((x) => proverCanWin(st, i + 1, { ...e, [m.v]: x }));
  }

  function computerMove() {
    while (step < S.moves.length && S.moves[step]!.q !== role) {
      const m = S.moves[step]!;
      const cs = m.candidates(env).filter((x) => m.legal(x, env));
      const good = cs.find((x) => {
        const win = proverCanWin(S, step + 1, { ...env, [m.v]: x });
        return m.q === 'some' ? win : !win;
      });
      const pick = good ?? cs[0]!;
      env = { ...env, [m.v]: Number(pick.toPrecision(6)) };
      step++;
    }
  }

  function reset() {
    env = {};
    step = 0;
    input = '';
    error = '';
    computerMove();
  }
  $effect(() => {
    void which;
    void role;
    untrack(reset);
  });

  function play() {
    const m = S.moves[step]!;
    const x = Number(input.replace(',', '.'));
    if (!Number.isFinite(x) || input.trim() === '') {
      error = 'Type a number.';
      return;
    }
    if (!m.legal(x, env)) {
      error = `Not a legal move: ${m.v === 'epsilon' ? 'ε' : m.v} must be ${m.legalText}.`;
      return;
    }
    error = '';
    env = { ...env, [m.v]: x };
    step++;
    input = '';
    computerMove();
  }

  const show = (v: string) => (v === 'epsilon' ? 'ε' : v);
  const fmt = (x: number) => (Number.isInteger(x) ? String(x) : String(Number(x.toPrecision(5))));
  const youWon = $derived(done && (role === 'some' ? proverWins : !proverWins));
</script>

<Widget title="The quantifier game" subtitle="∃ is the Prover’s move, ∀ is the Sceptic’s. Moves are made left to right. The Prover wins if the condition after the colon holds at the end." onreset={reset}>
  {#snippet controls()}
    <label class="sel">Statement
      <select bind:value={which}>
        {#each STATEMENTS as s, i (i)}<option value={i}>{s.name}</option>{/each}
      </select>
    </label>
    <div class="roles" role="radiogroup" aria-label="Your side">
      <button class:on={role === 'some'} onclick={() => (role = 'some')}>I’m the Prover (∃)</button>
      <button class:on={role === 'all'} onclick={() => (role = 'all')}>I’m the Sceptic (∀)</button>
    </div>
  {/snippet}
  <div class="statement"><Tex tex={S.tex} display /></div>
  <ol class="moves">
    {#each S.moves as m, i (i)}
      <li class:current={i === step} class:mine={m.q === role} class:past={i < step}>
        <span class="who">{m.q === 'some' ? 'Prover' : 'Sceptic'}{m.q === role ? ' (you)' : ''}</span>
        <Tex tex={m.tex} />
        {#if i < step}<span class="val">{show(m.v)} = <strong>{fmt(env[m.v]!)}</strong></span>
        {:else if i === step}<span class="val wait">choosing…</span>{/if}
      </li>
    {/each}
  </ol>
  {#if !done}
    {@const m = S.moves[step]!}
    <form class="play" onsubmit={(e) => (e.preventDefault(), play())}>
      <label>Choose {show(m.v)} ({m.legalText}): <input bind:value={input} inputmode="decimal" aria-label="Your value for {show(m.v)}" /></label>
      <button type="submit">Play</button>
      {#if error}<span class="err">{error}</span>{/if}
    </form>
  {:else}
    <div class="result" class:won={youWon}>
      <p>
        <Tex tex={S.matrixTex} /> is <strong>{proverWins ? 'true' : 'false'}</strong> here, so the <strong>{proverWins ? 'Prover' : 'Sceptic'}</strong> wins
        {youWon ? '— that’s you!' : '— the computer beat you.'}
      </p>
      <p class="moral">{S.moral}</p>
      <button onclick={reset}>Play again</button>
    </div>
  {/if}
</Widget>

<style>
  .sel {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  select {
    font: inherit;
    padding: 0.2rem 0.4rem;
    border-radius: 6px;
    border: 1px solid var(--rule-strong);
    background: var(--page);
    color: var(--ink);
  }
  .roles {
    display: flex;
    gap: 0.25rem;
  }
  .roles button,
  .play button,
  .result button {
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.25rem 0.7rem;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .roles button.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .statement {
    text-align: center;
    font-size: 1.1rem;
  }
  .moves {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.6rem;
    padding: 0;
    margin: 0.5rem 0 1rem;
  }
  .moves li {
    display: grid;
    justify-items: center;
    gap: 0.2rem;
    min-width: 8.5rem;
    padding: 0.5rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--page);
    opacity: 0.6;
  }
  .moves li.past,
  .moves li.current {
    opacity: 1;
  }
  .moves li.current {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .who {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-3);
    font-weight: 650;
  }
  .mine .who {
    color: var(--accent);
  }
  .val {
    font-size: 0.85rem;
  }
  .wait {
    color: var(--ink-3);
  }
  .play {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  .play input {
    width: 7rem;
    font-family: var(--font-mono);
    padding: 0.25rem 0.4rem;
    border-radius: 6px;
    border: 1px solid var(--rule-strong);
    background: var(--page);
    color: var(--ink);
  }
  .err {
    color: var(--bad);
    width: 100%;
    text-align: center;
  }
  .result {
    text-align: center;
    padding: 0.6rem 0.8rem;
    border-radius: var(--radius-sm);
    background: var(--bad-soft);
  }
  .result.won {
    background: var(--ok-soft);
  }
  .result p {
    margin: 0 0 0.5rem;
  }
  .moral {
    font-size: 0.85rem;
    color: var(--ink-2);
  }
</style>
