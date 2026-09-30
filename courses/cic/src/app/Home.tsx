import { A } from '@solidjs/router';
import { For, Show, createSignal, onMount } from 'solid-js';
import { chapters, parts, fileName, baseFileName } from '../content/chapters.ts';
import { CourseMap } from '../viz/CourseMap.tsx';
import { CodeBlock } from '../viz/CodeBlock.tsx';

const WELCOME = `theorem and_swap (p q : Prop) :
  p ∧ q → q ∧ p :=
  fun h => ⟨h.right, h.left⟩`;

export function Home() {
  // the snippet above is checked by the course kernel (loaded lazily, after first paint)
  const [checked, setChecked] = createSignal(false);
  onMount(() => {
    const run = async () => {
      try {
        const { envFor, check } = await import('./kernel.ts');
        const r = check(WELCOME, envFor('cic'));
        setChecked(!r.messages.some((m) => m.severity === 'error'));
      } catch {
        /* the mark is decoration; ignore failures */
      }
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => void run());
    else setTimeout(() => void run(), 200);
  });
  const first = chapters[0];
  return (
    <div class="home">
      <section class="hero">
        <div class="hero-inner">
          <div class="chapter-kicker">-- Welcome</div>
          <h1>Calculus of Inductive Constructions</h1>
          <p class="hero-lead">
            From the untyped λ-calculus to the type theory at the heart of Lean&nbsp;4, built up one idea at a time, with a real type-checking kernel running in your browser.
          </p>
          <CodeBlock
            code={WELCOME}
            lang="lean"
            mark={
              <Show when={checked()}>
                <span class="ok-tick" title="checked by the course kernel" role="img" aria-label="checked by the course kernel">
                  ✓
                </span>
              </Show>
            }
          />
          <div class="row">
            <A href={`/ch/${first.slug}`} class="btn primary">
              ▶ open {fileName(first)}
            </A>
            <A href="/playground" class="btn">
              open playground.lean
            </A>
          </div>
        </div>
      </section>
      <section class="home-map">
        <CourseMap />
        <p class="home-map-caption">The road from the untyped λ-calculus to Lean 4. Each arrow adds one idea, motivated by something the previous system cannot do. Click a calculus to jump to its chapter.</p>
      </section>
      <section class="home-parts">
        <For each={parts}>
          {(p) => (
            <div class="home-part">
              <h2 class="home-part-title">{p.num === 0 ? '-- Prologue' : `-- Part ${['', 'I', 'II', 'III', 'IV', 'V'][p.num]} · ${p.title}`}</h2>
              <div class="home-cards">
                <For each={chapters.filter((c) => c.part === p.num)}>
                  {(c) => (
                    <A href={`/ch/${c.slug}`} class="home-card">
                      <span class="hc-file">
                        <span class="hc-num">{String(c.num).padStart(2, '0')}</span>
                        {baseFileName(c)}
                      </span>
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
      <section class="home-companion">
        <div class="callout pap-bridge">
          <div class="callout-title">Companion course · Proofs Are Programs</div>
          <p>
            This course explains how the kernel works. <a href="../proofs-are-programs/">Proofs Are Programs</a> uses the same language to program and prove: logic as a library, tactics,
            induction, verified sorting, a verified compiler, and a type checker you build yourself. Chapters of both courses link to each other.
          </p>
        </div>
      </section>
    </div>
  );
}
