<!--
  An atlas of the proof techniques in the course. Choose the shape of what you want to prove; the
  atlas suggests moves that often work for that shape, with the chapters where you saw them.
-->
<script lang="ts">
  import { base } from '$app/paths';
  import Widget from '$lib/components/ui/Widget.svelte';

  type Goal = 'all' | 'forall-n' | 'exists' | 'impossible' | 'equality' | 'inequality' | 'limit' | 'infinite' | 'divisibility';
  interface Technique {
    name: string;
    goals: Goal[];
    cue: string;
    examples: { ch: string; slug: string; what: string }[];
  }
  const GOALS: { id: Goal; label: string }[] = [
    { id: 'all', label: 'Show everything' },
    { id: 'forall-n', label: '… holds for every n' },
    { id: 'exists', label: 'Something exists' },
    { id: 'impossible', label: 'Something is impossible' },
    { id: 'equality', label: 'An identity' },
    { id: 'inequality', label: 'An inequality' },
    { id: 'limit', label: 'A limit or continuity' },
    { id: 'infinite', label: 'Infinitely many' },
    { id: 'divisibility', label: 'Divisibility, primes' },
  ];
  const T: Technique[] = [
    { name: 'Unfold the definitions', goals: ['equality', 'limit', 'divisibility', 'inequality'], cue: 'Write out exactly what each term means. Many proofs are nothing more.', examples: [{ ch: '1', slug: 'truth-and-consequence', what: 'even and odd squares' }, { ch: '13', slug: 'epsilon-delta', what: 'limits from ε and N' }] },
    { name: 'Contrapositive', goals: ['divisibility', 'impossible'], cue: '“If P then Q” is hard, but “if not Q then not P” starts from something concrete.', examples: [{ ch: '1', slug: 'truth-and-consequence', what: 'n² even ⇒ n even' }] },
    { name: 'Contradiction', goals: ['impossible', 'infinite'], cue: 'To show something does not exist, assume it does, name it, and study it until it misbehaves.', examples: [{ ch: '3', slug: 'root-two', what: '√2 is irrational' }, { ch: '17', slug: 'e-and-pi', what: 'an integer between 0 and 1' }] },
    { name: 'Construction', goals: ['exists', 'infinite'], cue: 'Build the object. Often from the objects you already have — multiply them, add one.', examples: [{ ch: '4', slug: 'infinitely-many-primes', what: 'Euclid’s new prime' }, { ch: '2', slug: 'for-all-there-exists', what: 'a rational in every gap' }] },
    { name: 'Induction', goals: ['forall-n', 'equality', 'inequality'], cue: 'Find the smaller case inside the bigger one. Base case, step, done.', examples: [{ ch: '5', slug: 'induction', what: 'Gauss’s sum, trominoes, Hanoi' }] },
    { name: 'Strengthen the hypothesis', goals: ['forall-n', 'inequality'], cue: 'If the induction step is stuck, prove something stronger that carries its own margin.', examples: [{ ch: '5', slug: 'induction', what: 'Σ1/k² ≤ 2 − 1/n' }, { ch: '7', slug: 'fermats-descent', what: 'x⁴ + y⁴ = z² instead of w⁴' }] },
    { name: 'Well-ordering / least counterexample', goals: ['forall-n', 'impossible', 'divisibility'], cue: 'Take the smallest thing that could go wrong, and find a smaller one.', examples: [{ ch: '6', slug: 'unique-factorisation', what: 'unique factorisation' }, { ch: '6', slug: 'unique-factorisation', what: 'Bézout’s identity' }] },
    { name: 'Infinite descent', goals: ['impossible'], cue: 'From any solution build a smaller one; positive integers can’t shrink for ever.', examples: [{ ch: '3', slug: 'root-two', what: 'Tennenbaum’s squares' }, { ch: '7', slug: 'fermats-descent', what: 'Fermat’s n = 4' }] },
    { name: 'Cases and parity', goals: ['impossible', 'divisibility', 'forall-n'], cue: 'Split by remainders. Squares are 0 or 1 mod 4; that kills many equations.', examples: [{ ch: '9', slug: 'two-squares', what: '4k + 3 primes' }, { ch: '7', slug: 'fermats-descent', what: 'one leg is even' }] },
    { name: 'Counting in two ways', goals: ['equality', 'divisibility', 'exists'], cue: 'Count one set two different ways and equate the answers.', examples: [{ ch: '8', slug: 'fermats-little-theorem', what: 'necklaces' }, { ch: '21', slug: 'five-colours', what: 'Platonic solids' }] },
    { name: 'Involutions and fixed points', goals: ['exists'], cue: 'Pair things up; whatever is left unpaired has the right parity.', examples: [{ ch: '9', slug: 'two-squares', what: 'Zagier’s windmills' }, { ch: '10', slug: 'quadratic-reciprocity', what: 'Wilson’s theorem' }] },
    { name: 'Bijection', goals: ['equality', 'infinite'], cue: 'To show two sets have the same size, pair them off.', examples: [{ ch: '11', slug: 'sizes-of-infinity', what: 'the Calkin–Wilf tree' }] },
    { name: 'Diagonal argument', goals: ['impossible', 'infinite'], cue: 'Given any list, build something that differs from the n-th item in the n-th place.', examples: [{ ch: '11', slug: 'sizes-of-infinity', what: 'ℝ is uncountable' }, { ch: '12', slug: 'limits-of-proof', what: 'the halting problem' }] },
    { name: 'Pigeonhole', goals: ['exists'], cue: 'More objects than boxes. The art is choosing the boxes.', examples: [{ ch: '19', slug: 'pigeonholes', what: 'Dirichlet approximation' }, { ch: '19', slug: 'pigeonholes', what: 'Erdős–Szekeres' }] },
    { name: 'Invariant', goals: ['impossible'], cue: 'Find a quantity the moves can’t change, with different values at start and goal.', examples: [{ ch: '20', slug: 'invariants', what: 'the 15 puzzle' }, { ch: '20', slug: 'invariants', what: 'Conway’s soldiers' }] },
    { name: 'Extremal element / supremum', goals: ['exists', 'limit'], cue: 'Look at the largest, smallest, first or last thing with a property.', examples: [{ ch: '14', slug: 'completeness', what: 'the intermediate value theorem' }, { ch: '15', slug: 'fundamental-theorem', what: 'extreme values' }] },
    { name: 'Bisection / nested intervals', goals: ['exists', 'limit'], cue: 'Halve, keep the interesting half, repeat; completeness gives the point.', examples: [{ ch: '14', slug: 'completeness', what: 'Bolzano–Weierstrass' }] },
    { name: 'The ε/2 (and ε/3) trick', goals: ['limit', 'inequality'], cue: 'Split the error budget between the pieces you will add.', examples: [{ ch: '13', slug: 'epsilon-delta', what: 'sum of limits' }, { ch: '18', slug: 'monsters', what: 'uniform limits' }] },
    { name: 'Squeeze and compare', goals: ['limit', 'inequality', 'infinite'], cue: 'Trap the unknown between two things you understand.', examples: [{ ch: '16', slug: 'infinite-series', what: 'Oresme, and Basel' }, { ch: '17', slug: 'e-and-pi', what: 'the tail of Σ1/k!' }] },
    { name: 'Auxiliary function', goals: ['exists', 'inequality', 'equality'], cue: 'Subtract, rescale or combine so that a known special case applies.', examples: [{ ch: '15', slug: 'fundamental-theorem', what: 'the mean value theorem from Rolle' }, { ch: '17', slug: 'e-and-pi', what: 'Niven’s F' }] },
    { name: 'Reduce to a lemma', goals: ['all' as Goal], cue: 'Break the theorem into a chain of smaller ones — and look for one you already know.', examples: [{ ch: '10', slug: 'quadratic-reciprocity', what: 'the reciprocity chain' }, { ch: '15', slug: 'fundamental-theorem', what: 'EVT → Rolle → MVT → FTC' }] },
    { name: 'Counterexample', goals: ['impossible', 'all' as Goal], cue: 'Before proving, try to break it. A single example refutes a universal claim.', examples: [{ ch: '0', slug: 'what-is-a-proof', what: 'n² + n + 41' }, { ch: '18', slug: 'monsters', what: 'Weierstrass’s function' }] },
  ];
  let goal = $state<Goal>('all');
  const shown = $derived(goal === 'all' ? T : T.filter((t) => t.goals.includes(goal) || t.goals.includes('all')));
</script>

<Widget title="Which move?" subtitle="What does your statement look like? Pick its shape to see moves that often work, and where you met them." onreset={() => (goal = 'all')}>
  {#snippet controls()}
    <div class="goals">
      {#each GOALS as g (g.id)}<button class:on={goal === g.id} onclick={() => (goal = g.id)}>{g.label}</button>{/each}
    </div>
  {/snippet}
  <div class="grid">
    {#each shown as t (t.name)}
      <article class="card">
        <h5>{t.name}</h5>
        <p class="cue">{t.cue}</p>
        <p class="ex">
          {#each t.examples as e, i (i)}{#if i} · {/if}<a href="{base}/chapters/{e.slug}/">Ch. {e.ch}</a> {e.what}{/each}
        </p>
      </article>
    {/each}
  </div>
</Widget>

<style>
  .goals {
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
    border-radius: 99px;
    padding: 0.2rem 0.7rem;
    cursor: pointer;
  }
  button.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: 0.6rem;
  }
  .card {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.55rem 0.75rem;
    background: var(--page);
    animation: in 0.25s ease-out;
  }
  @keyframes in {
    from {
      opacity: 0;
      transform: translateY(3px);
    }
  }
  h5 {
    margin: 0 0 0.25rem;
    font-size: 0.9rem;
  }
  .cue {
    margin: 0 0 0.35rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .ex {
    margin: 0;
    font-size: 0.75rem;
    color: var(--ink-3);
  }
  .ex a {
    color: var(--accent);
    font-weight: 600;
  }
</style>
