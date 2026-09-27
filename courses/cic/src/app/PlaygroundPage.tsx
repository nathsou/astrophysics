import { Playground } from '../viz/Playground.tsx';

const START = `-- Welcome to the course playground.
-- Everything here is checked by the course kernel, a small
-- implementation of Lean 4's type theory written in TypeScript.
-- Hover over terms to see their types. Type \\lam then space for λ.

def double : Nat → Nat
  | 0 => 0
  | n + 1 => double n + 2

#reduce double 21

theorem and_swap (p q : Prop) : p ∧ q → q ∧ p :=
  fun h => ⟨h.right, h.left⟩

#check @and_swap
#print Nat.rec
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
          A scratchpad connected to the course kernel. Choose a calculus — from the simply typed λ-calculus up to the full Calculus of Inductive Constructions — and experiment.
        </p>
        <Playground code={initial} selectable height="28rem" class="full" title="Scratchpad" />
      </div>
    </div>
  );
}
