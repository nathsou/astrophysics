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
  const chapters = ALL_ENTRIES.filter((e) => e.kind === 'chapter');
  /** Numerals in the list are two digits (01, 02, …); appendix letters stay as they are. */
  const num = (n: string) => (/^\d+$/.test(n) ? n.padStart(2, '0') : n);
  const SHAPES = ['red', 'blue', 'yellow'] as const;
</script>

<svelte:head>
  <title>{COURSE_TITLE} — {COURSE_SUBTITLE}</title>
  <meta name="description" content="An interactive course on finding and writing mathematical proofs, built around great theorems from Euclid to Zagier: logic, induction, number theory, infinity and calculus." />
</svelte:head>

<div class="home">
  <section class="hero" aria-labelledby="hero-h">
    <div class="stage">
      <div class="art" aria-hidden="true">
        <i class="b red"></i><i class="b yellow"></i><i class="b blue-sq"></i><i class="b tri"></i>
        <div class="title">PROOF<br />CRAFT</div>
      </div>
      <h1 id="hero-h" class="visually-hidden">{COURSE_TITLE}: {COURSE_SUBTITLE}</h1>
      <div class="intro">
        <p class="sub">{COURSE_SUBTITLE}.</p>
        <p class="desc">Learn to find and write proofs by rebuilding great theorems, with a step checker and an optional Socratic tutor.</p>
        <div class="cta">
          {#if first}<a class="primary" href="{base}{first.href}">Start with Chapter {first.number} <Icon name="chevron" size={16} /></a>{/if}
          <a class="secondary" href="#contents">See all chapters</a>
        </div>
        <p class="meta">Mathematics · {chapters.length} chapters</p>
      </div>
    </div>
  </section>

  <section class="contents" id="contents" aria-labelledby="contents-h">
    <h2 id="contents-h" class="visually-hidden">Contents</h2>
    {#each PARTS as part (part.id)}
      <div class="part">
        <div class="part-head">
          {#if part.id !== '0' && part.id !== 'E'}<span class="pid">Part {part.id}</span>{/if}
          <h3>{part.title}</h3>
          <p>{part.blurb}</p>
        </div>
        <ul class="rows">
          {#each part.chapters as c (c.slug)}
            {@const e = byKey.get(`chapter:${c.slug}`)!}
            <li>
              {#if e.available}
                <a class="row ready" href="{base}{e.href}">
                  <span class="n">{num(e.number)}</span>
                  <span class="t">{e.title}</span>
                  {#if e.year !== undefined}<span class="y">{year(e.year)}</span>{/if}
                  <span class="s">{e.summary}</span>
                </a>
              {:else}
                <div class="row planned" aria-label="{e.title} (coming soon)">
                  <span class="n">{num(e.number)}</span>
                  <span class="t">{e.title}</span>
                  <span class="y">Coming soon</span>
                  <span class="s">{e.summary}</span>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/each}
    <div class="part">
      <div class="part-head">
        <span class="pid">Appendices</span>
        <h3>Reference</h3>
        <p>Notation, the step checker, and every term, date and source in the course.</p>
      </div>
      <ul class="rows compact">
        {#each appendices as e (e.slug)}
          <li>
            {#if e.available}
              <a class="row ready" href="{base}{e.href}"><span class="n">{num(e.number)}</span><span class="t">{e.title}</span></a>
            {:else}
              <div class="row planned"><span class="n">{num(e.number)}</span><span class="t">{e.title}</span><span class="y">Coming soon</span></div>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  </section>

  <section class="about" aria-labelledby="about-h">
    <div class="about-text">
      <h2 id="about-h">Prove it, don’t just read it</h2>
      <p class="lede">
        Learn to find and write proofs by rebuilding the great ones — Euclid’s primes, the irrationality of √2, Fermat’s little theorem, Cantor’s
        diagonal, Gödel’s incompleteness and the ε–δ foundations of calculus. You explore, conjecture, and then prove.
      </p>
      <div class="features">
        <div class="f red">
          <h3>Great theorems, rebuilt</h3>
          <p>Each chapter is built around one theorem and its story. You gather evidence, form a conjecture and rebuild the proof — then meet other proofs and famous failed ones.</p>
        </div>
        <div class="f blue">
          <h3>A step checker</h3>
          <p>Type a chain of equalities or inequalities and a small computer algebra system checks every step — proving it, or finding a counterexample.</p>
        </div>
        <div class="f yellow">
          <h3>Proofs at every zoom level</h3>
          <p>See a proof as a one-line idea, a sketch or every detail. Order jumbled proofs, find the bug in false ones, fill in the gaps.</p>
        </div>
        <div class="f ink">
          <h3>A Socratic tutor (optional)</h3>
          <p>Write proofs in your own words. With your own API key, Claude points at the first gap and asks a question — it never writes the proof for you.</p>
        </div>
      </div>
    </div>
    <figure class="hero-fig">
      <PythagorasShuffle auto size={300} />
      <figcaption class="ui">The same four triangles leave c² uncovered, or a² + b². A proof you can watch.</figcaption>
    </figure>
  </section>

  <section class="timeline" aria-labelledby="tl-h">
    <h2 id="tl-h">2,300 years of theorems</h2>
    <ol class="tl ui">
      {#each timeline as e, i (e.slug)}
        <li>
          <span class="yr">{year(e.year!)}</span>
          {#if e.available}
            <a href="{base}{e.href}"><span class="pt {SHAPES[i % 3]}"></span><span class="th">{e.theorem}</span><span class="ch">Chapter {e.number}</span></a>
          {:else}
            <span class="off"><span class="pt {SHAPES[i % 3]}"></span><span class="th">{e.theorem}</span><span class="ch">Chapter {e.number} · coming</span></span>
          {/if}
        </li>
      {/each}
    </ol>
  </section>
</div>

<style>
  .home {
    max-width: 1000px;
    margin: 0 auto;
    padding: 0 0 5rem;
    font-family: var(--font-ui);
  }
  .home > section:not(.hero) {
    margin-inline: clamp(1.25rem, 4vw, 2.25rem);
  }

  /* ───── Hero: a composition of absolutely-positioned blocks on a 1000 x 520 stage. ─────
     --u is one design pixel; it shrinks with the container so the whole composition scales. */
  .hero {
    container-type: inline-size;
  }
  .stage {
    --u: min(1px, 0.1cqw);
    position: relative;
    display: grid;
    grid-template-columns: calc(560 * var(--u)) minmax(0, 1fr);
    min-height: calc(520 * var(--u));
    overflow: hidden;
  }
  .art {
    position: absolute;
    left: 0;
    top: 0;
    width: calc(510 * var(--u));
    height: calc(520 * var(--u));
    pointer-events: none;
  }
  .b {
    position: absolute;
    display: block;
  }
  .b.red {
    left: 0;
    top: 0;
    width: calc(340 * var(--u));
    height: calc(340 * var(--u));
    background: var(--fx-red);
  }
  .b.yellow {
    left: calc(340 * var(--u));
    top: 0;
    width: calc(170 * var(--u));
    height: calc(170 * var(--u));
    background: var(--fx-yellow);
  }
  .b.blue-sq {
    left: 0;
    top: calc(340 * var(--u));
    width: calc(170 * var(--u));
    height: calc(180 * var(--u));
    background: var(--fx-blue);
  }
  .b.tri {
    left: calc(340 * var(--u));
    top: calc(170 * var(--u));
    width: calc(170 * var(--u));
    height: calc(170 * var(--u));
    background: var(--fx-blue);
    clip-path: polygon(100% 0, 100% 100%, 0 100%);
  }
  /* Cream on the red block, ink on the yellow one, page ink elsewhere, so no letter is lost
     against the page or the primaries. */
  .title {
    position: absolute;
    left: calc(32 * var(--u));
    top: calc(32 * var(--u));
    font-family: var(--font-display);
    font-weight: 900;
    font-size: calc(110 * var(--u));
    line-height: 0.86;
    letter-spacing: -0.04em;
    white-space: nowrap;
    color: transparent;
    -webkit-text-fill-color: transparent;
    -webkit-background-clip: text;
    background-clip: text;
    background-image:
      linear-gradient(var(--fx-cream), var(--fx-cream)), linear-gradient(var(--fx-cream), var(--fx-cream)),
      linear-gradient(var(--fx-ink), var(--fx-ink)), linear-gradient(var(--fg), var(--fg));
    background-repeat: no-repeat;
    background-position:
      calc(-32 * var(--u)) calc(-32 * var(--u)),
      calc(-32 * var(--u)) calc(95 * var(--u)),
      calc(308 * var(--u)) calc(-32 * var(--u)),
      0 0;
    background-size:
      calc(372 * var(--u)) calc(159 * var(--u)),
      calc(340 * var(--u)) calc(245 * var(--u)),
      calc(170 * var(--u)) calc(170 * var(--u)),
      100% 100%;
  }
  .intro {
    grid-column: 2;
    padding: calc(36 * var(--u)) calc(36 * var(--u)) 2rem 0;
    min-width: 0;
  }
  .sub {
    margin: 0 0 0.7rem;
    font-family: var(--font-body);
    font-style: italic;
    font-size: 1.4rem;
    line-height: 1.25;
  }
  .desc {
    margin: 0 0 1.4rem;
    font-size: 1.06rem;
    line-height: 1.6;
  }
  .cta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
  }
  .cta a {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.62rem 1.05rem;
    border: 2px solid var(--fg);
    border-radius: var(--radius-sm);
    font-weight: 700;
    font-size: 0.95rem;
    text-decoration: none;
    color: var(--ink);
  }
  .cta a:hover {
    opacity: 1;
  }
  .cta .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .cta .primary:hover {
    background: var(--accent-ink);
    border-color: var(--accent-ink);
    color: var(--on-accent);
  }
  .cta .secondary:hover {
    background: var(--pn);
  }
  .meta {
    margin: 1.1rem 0 0;
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--mute);
  }

  /* Narrow containers: stack the composition above the text, scaled to the full width. */
  @container (max-width: 719px) {
    .stage {
      --u: min(1px, calc(100cqw / 510));
      display: block;
      min-height: 0;
    }
    .art {
      position: relative;
    }
    .intro {
      padding: 1.5rem clamp(1.25rem, 5cqw, 2rem) 1.5rem;
    }
  }

  /* ───── Contents: numbered rows ruled with 2px ink. ───── */
  .contents {
    padding-top: 1.5rem;
  }
  .part {
    padding: 2rem 0 0.75rem;
  }
  .part-head {
    display: grid;
    gap: 0.25rem;
    margin-bottom: 1.1rem;
    max-width: 44rem;
  }
  .pid {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .part-head h3 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 900;
    font-size: clamp(1.5rem, 3.4vw, 1.9rem);
    line-height: 1.05;
    letter-spacing: -0.03em;
  }
  .part-head p {
    margin: 0.2rem 0 0;
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 17.5rem), 1fr));
    gap: 0 2.25rem;
    align-content: start;
  }
  .row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    column-gap: 0.7rem;
    align-items: baseline;
    height: 100%;
    padding: 0.7rem 0 0.75rem;
    border-bottom: 2px solid var(--fg);
    color: var(--ink);
    text-decoration: none;
  }
  .row .n {
    color: var(--accent);
    font-weight: 700;
    font-size: 1rem;
    font-variant-numeric: tabular-nums;
    min-width: 1.5rem;
  }
  .row .t {
    font-weight: 700;
    font-size: 1rem;
    line-height: 1.3;
  }
  .row .y {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 0.7rem;
    color: var(--mute);
    white-space: nowrap;
  }
  .row .s {
    grid-column: 2 / -1;
    margin-top: 0.25rem;
    font-size: 0.86rem;
    line-height: 1.45;
    color: var(--ink-2);
  }
  .ready:hover {
    opacity: 1;
  }
  .ready:hover .t,
  .ready:hover .n {
    color: var(--accent);
  }
  .ready:hover .n {
    color: var(--fx-red);
  }
  .planned .t,
  .planned .s,
  .planned .n {
    color: var(--ink-3);
  }
  .compact .row {
    padding-block: 0.55rem;
  }

  /* ───── About: features + the animated proof ───── */
  .about {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 20rem);
    gap: 2.5rem;
    align-items: start;
    margin-top: 3.5rem;
    padding-top: 2.5rem;
    border-top: 2px solid var(--fg);
  }
  @media (max-width: 860px) {
    .about {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .about h2,
  .timeline h2 {
    margin: 0 0 1rem;
    font-family: var(--font-display);
    font-weight: 900;
    font-size: clamp(1.7rem, 4vw, 2.3rem);
    line-height: 1;
    letter-spacing: -0.03em;
  }
  .lede {
    margin: 0 0 1.75rem;
    font-family: var(--font-body);
    font-size: 1.22rem;
    line-height: 1.55;
    color: var(--ink-2);
    max-width: 38rem;
  }
  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 1.5rem 2rem;
  }
  .f {
    position: relative;
    padding-top: 1.6rem;
    border-top: 2px solid var(--fg);
  }
  .f::before {
    content: '';
    position: absolute;
    left: 0;
    top: -2px;
    width: 2.75rem;
    height: 0.6rem;
    background: var(--fx-red);
  }
  .f.blue::before {
    background: var(--fx-blue);
  }
  .f.yellow::before {
    background: var(--fx-yellow);
  }
  .f.ink::before {
    background: var(--fg);
  }
  .f h3 {
    margin: 0 0 0.4rem;
    font-size: 1.05rem;
    font-weight: 700;
  }
  .f p {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.55;
    color: var(--ink-2);
  }
  .hero-fig {
    margin: 0;
    padding: 1.25rem;
    background: var(--surface);
    border: 2px solid var(--fg);
    border-radius: var(--radius);
    box-shadow: 6px 6px 0 var(--fx-yellow);
  }
  .hero-fig figcaption {
    margin-top: 0.8rem;
    font-size: 0.84rem;
    line-height: 1.45;
    color: var(--ink-2);
    text-align: center;
  }

  /* ───── Timeline ───── */
  .timeline {
    margin-top: 3.5rem;
    padding-top: 2.5rem;
    border-top: 2px solid var(--fg);
  }
  .tl {
    list-style: none;
    margin: 0;
    padding: 0.5rem 0 1rem;
    display: flex;
    overflow-x: auto;
    scrollbar-width: thin;
    position: relative;
  }
  .tl li {
    flex: 0 0 9.5rem;
    position: relative;
    padding: 0 0.8rem 0 0;
  }
  .tl li::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 2.35rem;
    height: 2px;
    background: var(--fg);
  }
  .tl .yr {
    display: block;
    font-family: var(--font-display);
    font-weight: 900;
    font-size: 1.15rem;
    letter-spacing: -0.02em;
    height: 1.7rem;
    color: var(--ink);
  }
  .tl .pt {
    position: relative;
    z-index: 1;
    display: block;
    width: 0.95rem;
    height: 0.95rem;
    margin: 0.35rem 0 0.7rem;
  }
  .tl .pt.red {
    background: var(--fx-red);
  }
  .tl .pt.blue {
    background: var(--fx-blue);
  }
  .tl .pt.yellow {
    background: var(--fx-yellow);
  }
  .tl a,
  .tl .off {
    display: block;
    font-size: 0.86rem;
    line-height: 1.35;
    text-decoration: none;
    color: var(--ink);
  }
  .tl a:hover {
    opacity: 1;
  }
  .tl a:hover .th {
    color: var(--accent);
  }
  .tl .th {
    font-weight: 700;
  }
  .tl .ch {
    display: block;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--mute);
    margin-top: 0.25rem;
  }
  .tl .off .th {
    color: var(--ink-3);
  }
</style>
