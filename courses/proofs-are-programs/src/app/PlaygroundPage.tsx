import { Playground } from '../viz/Playground.tsx';

const START = `-- Welcome to the playground of Proofs Are Programs.
-- Everything is checked by the course kernel, running in your browser.
-- Hover over a term to see its type; put the cursor in a proof to see its goals.
-- Unicode: type \\to then space for →, \\and for ∧, \\forall for ∀, \\< for ⟨.

def sum : List Nat → Nat
  | [] => 0
  | x :: xs => x + sum xs

#eval sum [1, 2, 3, 4]

theorem sum_append (xs ys : List Nat) : sum (xs ++ ys) = sum xs + sum ys := by
  induction xs with
  | nil => simp [sum]
  | cons x xs ih => simp [sum, ih]; omega

#test ∀ (xs ys : List Nat), sum (xs ++ ys) = sum ys + sum xs
`;

export default function PlaygroundPage() {
  let initial = START;
  try {
    const q = new URLSearchParams(location.hash.split('?')[1] ?? '');
    const c = q.get('code');
    if (c) initial = decodeURIComponent(escape(atob(c)));
  } catch {
    /* ignore malformed links */
  }
  return (
    <div class="page" style={{ 'grid-template-columns': 'minmax(0, 1fr)', 'max-width': '90rem' }}>
      <div class="prose" style={{ 'max-width': 'none' }}>
        <h1 style={{ 'font-size': '2rem', 'max-width': 'none' }}>Playground</h1>
        <p style={{ 'max-width': '50rem', margin: '0 0 1rem' }}>
          A scratchpad connected to the course kernel, with the course's standard library loaded. Click <em>proof term</em> to see the program your tactics are writing.
        </p>
        <Playground code={initial} height="30rem" class="full" title="Scratchpad" lens />
      </div>
    </div>
  );
}
