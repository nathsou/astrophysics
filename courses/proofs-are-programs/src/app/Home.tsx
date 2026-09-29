import { A } from '@solidjs/router';
import { For } from 'solid-js';
import { chapters, parts, romans } from '../content/chapters.ts';
import { Playground } from '../viz/Playground.tsx';

const TEASER = `-- A proof is a program. This one is written with tactics;
-- open "proof term" below to see the program they write.
theorem and_swap (p q : Prop) : p ∧ q → q ∧ p := by
  intro ⟨hp, hq⟩
  exact ⟨hq, hp⟩

-- And this program comes with a proof that it is correct.
def double : Nat → Nat
  | 0 => 0
  | n + 1 => double n + 2

theorem double_correct (n : Nat) : double n = n + n := by
  induction n with
  | zero => rfl
  | succ n ih => simp [double, ih]; omega

#eval double 21`;

export function Home() {
  return (
    <div class="home">
      <section class="hero">
        <div class="hero-inner">
          <div class="chapter-kicker">An interactive course</div>
          <h1>Proofs Are Programs</h1>
          <p class="hero-lead">
            The Curry–Howard correspondence, for programmers. Write proofs as programs, prove programs correct — an interpreter, a compiler, a type checker — and finish by building a small kernel of your own. Everything runs in your browser, on a real type checker.
          </p>
          <div class="row" style={{ 'margin-top': '1.6rem' }}>
            <A href="/ch/prologue" class="btn primary">
              Start reading →
            </A>
            <A href="/playground" class="btn">
              Open the playground
            </A>
          </div>
        </div>
      </section>
      <section class="home-teaser">
        <Playground code={TEASER} title="A taste" height="17rem" lens />
      </section>
      <section class="home-paths">
        <div class="path-card">
          <div class="label">Practice first</div>
          <h3>Start here, dip into the theory</h3>
          <p>
            Read this course in order. Whenever a chapter relies on how the type checker works, an <em>Under the hood</em> box links to the chapter of <a href="../cic/">The Calculus of Inductive Constructions</a> that explains it.
          </p>
        </div>
        <div class="path-card">
          <div class="label">Theory first</div>
          <h3>The kernel first, then the programs</h3>
          <p>
            If you would rather know how a proof checker works before using one, read <a href="../cic/">the CIC course</a> first, then come back for Parts III to VI: tactics, verified programs and your own kernel. <A href="/reference/bridges">This map</A> shows how the two courses fit together.
          </p>
        </div>
      </section>
      <section class="home-parts">
        <For each={parts}>
          {(p) => (
            <div class="home-part">
              <div class="label">{p.num === 0 || p.num === 7 ? p.title : `Part ${romans[p.num]}`}</div>
              <h2>{p.num === 0 || p.num === 7 ? '' : p.title}</h2>
              <div class="home-cards">
                <For each={chapters.filter((c) => c.part === p.num)}>
                  {(c) => (
                    <A href={`/ch/${c.slug}`} class="home-card">
                      <span class="hc-num">{c.part === 0 ? '0' : c.part === 7 ? '∎' : c.num}</span>
                      <span class="hc-title">{c.title}</span>
                      <span class="hc-blurb">{c.blurb}</span>
                    </A>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </section>
    </div>
  );
}
