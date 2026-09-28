<script lang="ts">
  import { base } from '$app/paths';
  import { COURSE_SUBTITLE, COURSE_TITLE, PARTS } from '$content/outline';
  import { ALL_ENTRIES } from '$lib/content/registry';
  import Icon from '$lib/components/ui/Icon.svelte';
  import PythagorasShuffle from '$lib/widgets/PythagorasShuffle.svelte';

  const byKey = new Map(ALL_ENTRIES.map((e) => [`${e.kind}:${e.slug}`, e]));
  const first = ALL_ENTRIES.find((e) => e.available);
  const appendices = ALL_ENTRIES.filter((e) => e.kind === 'appendix');
  const timeline = ALL_ENTRIES.filter((e) => e.kind === 'chapter' && e.year !== undefined && e.theorem).sort((x, y) => x.year! - y.year!);
  const year = (y: number) => (y < 0 ? `${-y} BC` : String(y));
</script>

<svelte:head>
  <title>{COURSE_TITLE} — {COURSE_SUBTITLE}</title>
  <meta name="description" content="An interactive course on finding and writing mathematical proofs, built around great theorems from Euclid to Zagier: logic, induction, number theory, infinity and calculus." />
</svelte:head>

<div class="home">
  <section class="hero">
    <div class="copy">
      <p class="eyebrow ui">An interactive course</p>
      <h1>{COURSE_TITLE}</h1>
      <p class="sub">{COURSE_SUBTITLE}</p>
      <p class="lede">
        Learn to find and write proofs by rebuilding the great ones — Euclid’s primes, the irrationality of √2, Fermat’s little theorem, Cantor’s
        diagonal, Gödel’s incompleteness and the ε–δ foundations of calculus. You explore, conjecture, and then prove, with a step checker that
        catches algebra mistakes and a tutor that asks the right question.
      </p>
      <div class="cta ui">
        {#if first}<a class="primary" href="{base}{first.href}">Start with Chapter {first.number} <Icon name="chevron" size={16} /></a>{/if}
        <a class="secondary" href="#contents">See all chapters</a>
      </div>
    </div>
    <figure class="hero-fig">
      <PythagorasShuffle auto size={300} />
      <figcaption class="ui">The same four triangles leave c² uncovered, or a² + b². A proof you can watch.</figcaption>
    </figure>
  </section>

  <section class="timeline" aria-labelledby="tl-h">
    <h2 id="tl-h" class="ui">2,300 years of theorems</h2>
    <ol class="tl ui">
      {#each timeline as e (e.slug)}
        <li>
          <span class="yr">{year(e.year!)}</span>
          {#if e.available}
            <a href="{base}{e.href}"><span class="pt"></span><span class="th">{e.theorem}</span><span class="ch">Chapter {e.number}</span></a>
          {:else}
            <span class="off"><span class="pt"></span><span class="th">{e.theorem}</span><span class="ch">Chapter {e.number} · coming</span></span>
          {/if}
        </li>
      {/each}
    </ol>
  </section>

  <section class="features ui">
    <div>
      <h3>Great theorems, rebuilt</h3>
      <p>Each chapter is built around one theorem and its story. You gather evidence, form a conjecture and rebuild the proof — then meet other proofs and famous failed ones.</p>
    </div>
    <div>
      <h3>A step checker</h3>
      <p>Type a chain of equalities or inequalities and a small computer algebra system checks every step — proving it, or finding a counterexample.</p>
    </div>
    <div>
      <h3>Proofs at every zoom level</h3>
      <p>See a proof as a one-line idea, a sketch or every detail. Order jumbled proofs, find the bug in false ones, fill in the gaps.</p>
    </div>
    <div>
      <h3>A Socratic tutor (optional)</h3>
      <p>Write proofs in your own words. With your own API key, Claude points at the first gap and asks a question — it never writes the proof for you.</p>
    </div>
  </section>

  <section class="contents" id="contents" aria-labelledby="contents-h">
    <h2 id="contents-h" class="ui">Contents</h2>
    {#each PARTS as part (part.id)}
      <div class="part">
        <div class="part-head ui">
          <span class="pid">{part.id === '0' ? 'Prologue' : part.id === 'E' ? 'Epilogue' : `Part ${part.id}`}</span>
          <h3>{part.title}</h3>
          <p>{part.blurb}</p>
        </div>
        <ul class="cards">
          {#each part.chapters as c (c.slug)}
            {@const e = byKey.get(`chapter:${c.slug}`)!}
            <li>
              {#if e.available}
                <a class="card ready" href="{base}{e.href}">
                  <span class="n ui">{e.number}</span>
                  <span class="t ui">{e.title}</span>
                  <span class="s">{e.summary}</span>
                </a>
              {:else}
                <div class="card planned" aria-label="{e.title} (coming soon)">
                  <span class="n ui">{e.number}</span>
                  <span class="t ui">{e.title}</span>
                  <span class="s">{e.summary}</span>
                  <span class="soon ui">Coming soon</span>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/each}
    <div class="part">
      <div class="part-head ui">
        <span class="pid">Appendices</span>
        <h3>Reference</h3>
        <p>Notation, the step checker, and every term, date and source in the course.</p>
      </div>
      <ul class="cards compact">
        {#each appendices as e (e.slug)}
          <li>
            {#if e.available}
              <a class="card ready" href="{base}{e.href}"><span class="n ui">{e.number}</span><span class="t ui">{e.title}</span></a>
            {:else}
              <div class="card planned"><span class="n ui">{e.number}</span><span class="t ui">{e.title}</span><span class="soon ui">Coming soon</span></div>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  </section>
</div>

<style>
  .home {
    max-width: 72rem;
    margin: 0 auto;
    padding: 0 clamp(1rem, 4vw, 3rem) 6rem;
  }
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 3rem;
    align-items: center;
    padding: 4.5rem 0 3.5rem;
  }
  @media (max-width: 900px) {
    .hero {
      grid-template-columns: 1fr;
      padding-top: 2.5rem;
    }
  }
  .eyebrow {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 650;
    color: var(--accent);
  }
  h1 {
    font-family: var(--font-body);
    font-size: clamp(2.8rem, 7vw, 4.8rem);
    line-height: 1;
    letter-spacing: -0.025em;
    font-weight: 620;
    margin: 0 0 1.25rem;
  }
  .lede {
    font-size: 1.25rem;
    line-height: 1.55;
    color: var(--ink-2);
    margin: 0 0 2rem;
    max-width: 36rem;
  }
  .cta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .cta a {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.7rem 1.2rem;
    border-radius: 9px;
    font-weight: 600;
    font-size: 0.95rem;
    text-decoration: none;
  }
  .primary {
    background: var(--accent);
    color: var(--on-accent);
  }
  .primary:hover {
    background: var(--accent-ink);
  }
  .secondary {
    border: 1px solid var(--rule-strong);
    color: var(--ink);
  }
  .secondary:hover {
    background: var(--surface-2);
  }

  h2 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 650;
    color: var(--ink-3);
    margin: 0 0 1.25rem;
  }
  .timeline {
    padding: 2rem 0 2.5rem;
    border-top: 1px solid var(--rule);
  }
  .tl {
    list-style: none;
    margin: 0;
    padding: 0.5rem 0 1rem;
    display: flex;
    gap: 0;
    overflow-x: auto;
    scrollbar-width: thin;
    position: relative;
  }
  .tl li {
    flex: 0 0 8.5rem;
    position: relative;
    padding: 0 0.6rem 0 0;
  }
  .tl li::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 2.05rem;
    height: 2px;
    background: var(--rule-strong);
  }
  .tl li:first-child::before {
    left: 0.45rem;
  }
  .tl .yr {
    display: block;
    font-family: var(--font-body);
    font-size: 1.05rem;
    color: var(--history);
    font-variant-numeric: oldstyle-nums;
    height: 1.5rem;
  }
  .tl .pt {
    position: relative;
    z-index: 1;
    display: block;
    width: 0.9rem;
    height: 0.9rem;
    margin: 0.1rem 0 0.55rem;
    border-radius: 50%;
    background: var(--surface);
    border: 2.5px solid var(--accent);
  }
  .tl a,
  .tl .off {
    display: block;
    font-size: 0.82rem;
    line-height: 1.35;
    text-decoration: none;
    color: var(--ink);
  }
  .tl a:hover .th {
    color: var(--accent);
  }
  .tl .th {
    font-weight: 600;
  }
  .tl .ch {
    display: block;
    font-size: 0.72rem;
    color: var(--ink-3);
    margin-top: 0.2rem;
  }
  .tl .off .pt {
    border-color: var(--rule-strong);
  }
  .tl .off .th {
    color: var(--ink-2);
  }
  .hero-fig {
    margin: 0;
    padding: 1.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: var(--shadow-lg);
  }
  .hero-fig figcaption {
    margin-top: 0.8rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    text-align: center;
  }
  .sub {
    font-family: var(--font-body);
    font-style: italic;
    font-size: clamp(1.2rem, 2.2vw, 1.5rem);
    color: var(--ink-2);
    margin: -0.6rem 0 1.25rem;
  }
  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 1rem;
    padding: 0 0 3rem;
  }
  .features div {
    padding: 1.1rem 1.2rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .features h3 {
    margin: 0 0 0.4rem;
    font-size: 0.98rem;
  }
  .features p {
    margin: 0;
    font-size: 0.86rem;
    line-height: 1.5;
    color: var(--ink-2);
  }

  .contents {
    border-top: 1px solid var(--rule);
    padding-top: 2rem;
  }
  .part {
    display: grid;
    grid-template-columns: 16rem minmax(0, 1fr);
    gap: 2rem;
    padding: 1.5rem 0;
    border-bottom: 1px solid var(--rule);
  }
  @media (max-width: 900px) {
    .part {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }
  .pid {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 650;
    color: var(--accent);
  }
  .part-head h3 {
    margin: 0.2rem 0 0.4rem;
    font-size: 1.2rem;
    letter-spacing: -0.01em;
  }
  .part-head p {
    margin: 0;
    font-size: 0.85rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: 0.75rem;
  }
  .card {
    position: relative;
    display: grid;
    grid-template-columns: 2rem 1fr;
    gap: 0.1rem 0.5rem;
    height: 100%;
    padding: 0.85rem 1rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    text-decoration: none;
    color: var(--ink);
  }
  .card .n {
    grid-row: span 2;
    font-size: 1.1rem;
    font-weight: 650;
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
  }
  .card .t {
    font-weight: 620;
    font-size: 0.95rem;
  }
  .card .s {
    font-size: 0.84rem;
    line-height: 1.45;
    color: var(--ink-2);
  }
  .ready {
    background: var(--surface);
    box-shadow: var(--shadow);
    transition: border-color 120ms, transform 120ms;
  }
  .ready .n {
    color: var(--accent);
  }
  .ready:hover {
    border-color: var(--accent-2);
    transform: translateY(-1px);
  }
  .planned {
    background: transparent;
    border-style: dashed;
  }
  .planned .t,
  .planned .s {
    color: var(--ink-3);
  }
  .soon {
    grid-column: 2;
    margin-top: 0.35rem;
    font-size: 0.7rem;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .compact .card {
    padding: 0.6rem 0.9rem;
  }
</style>
