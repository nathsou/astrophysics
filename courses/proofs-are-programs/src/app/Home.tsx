import { A } from '@solidjs/router';
import { For } from 'solid-js';
import { chapters, parts } from '../content/chapters.ts';
import { CourseMap } from '../viz/CourseMap.tsx';

export function Home() {
  return (
    <div class="home">
      <section class="hero">
        <div class="hero-inner">
          <div class="chapter-kicker">An interactive course</div>
          <h1>The Calculus of Inductive Constructions</h1>
          <p class="hero-lead">
            From the untyped λ-calculus to the type theory at the heart of Lean&nbsp;4 — built up one idea at a time, with a real kernel running in your browser.
          </p>
          <div class="row" style={{ 'margin-top': '1.6rem' }}>
            <A href="/ch/intro" class="btn primary">
              Start reading →
            </A>
            <A href="/playground" class="btn">
              Open the playground
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
              <div class="label">{p.num === 0 ? 'Prologue' : `Part ${['', 'I', 'II', 'III', 'IV', 'V'][p.num]}`}</div>
              <h2>{p.title}</h2>
              <div class="home-cards">
                <For each={chapters.filter((c) => c.part === p.num)}>
                  {(c) => (
                    <A href={`/ch/${c.slug}`} class="home-card">
                      <span class="hc-num">{c.num === 0 ? '0' : c.num}</span>
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
