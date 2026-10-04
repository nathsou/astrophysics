<script lang="ts">
  import { base } from '$app/paths';
  import { COURSE_SUBTITLE, COURSE_TITLE, PARTS, APPENDICES, READING_PATHS, type EngineId } from '$content/outline';
  import { ALL_ENTRIES, findEntry } from '$lib/content/registry';
  import { progress } from '$lib/state/progress.svelte';
  import { onMount } from 'svelte';

  const available = new Set(ALL_ENTRIES.filter((e) => e.available).map((e) => `${e.kind}/${e.slug}`));
  const total = PARTS.reduce((n, p) => n + p.chapters.length, 0);
  const done = PARTS.reduce((n, p) => n + p.chapters.filter((c) => available.has(`chapter/${c.slug}`)).length, 0);

  const ENGINE_LABELS: Record<EngineId, string> = {
    explore: 'explicit-state explorer',
    ltl: 'temporal logic',
    sat: 'SAT solver',
    relational: 'small-scope model finder',
    bmc: 'bounded model checking',
    bdd: 'decision diagrams',
    smt: 'SMT solver',
    symex: 'symbolic execution',
    vcgen: 'program verifier',
    heap: 'separation logic',
    kind: 'k-induction',
    ic3: 'IC3',
    param: 'parameterised invariants',
    absint: 'abstract interpreter',
  };
  const ENGINE_GLYPHS: Record<EngineId, string> = { explore: '◎', ltl: '◇', sat: '⊨', relational: '⋈', bmc: '⇶', bdd: '⋔', smt: '≡', symex: '⑂', vcgen: '⊢', heap: '∗', kind: '↻', ic3: '⧉', param: '∀', absint: '⊑' };

  let path: string | null = $state(null);
  const onPath = $derived(path ? new Set(READING_PATHS.find((p) => p.id === path)!.chapters) : null);
  onMount(() => progress.load());
</script>

<svelte:head>
  <title>{COURSE_TITLE}: {COURSE_SUBTITLE}</title>
  <meta name="description" content="An interactive course on formal verification for software engineers: model checking, SAT and SMT solvers, program proofs with invariants, separation logic and abstract interpretation, all running in the browser, with every result certified." />
</svelte:head>

<div class="home">
  <section class="hero guilloche">
    <p class="eyebrow ui">An interactive course · {done} of {total} chapters</p>
    <h1>{COURSE_TITLE}</h1>
    <p class="sub">{COURSE_SUBTITLE}</p>
    <p class="lede">
      A test checks the inputs you thought of. A verifier checks all of them, including the schedule your threads
      run in, the order your messages arrive in, and the moves of an attacker. This course teaches the four ways
      machines do that (exploring every state, encoding in logic, generalising with invariants, approximating with
      abstractions), lets you use each one on real bugs, then opens it up so you can see why it succeeds, fails or
      says “unknown”. Every answer comes with a certificate that a small checker re-checks.
    </p>
    <div class="cta ui">
      <a class="primary" href="{base}/chapters/{PARTS[0]!.chapters[0]!.slug}/">Start with chapter 0</a>
      <a href="{base}/workbench/">The Workbench</a>
      <a href="{base}/appendix/bug-museum/">The bug museum</a>
      <a href="{base}/appendix/timeline-and-family-tree/">Timeline and family tree</a>
    </div>
    <svg class="hero-seal" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="54" class="a" />
      <circle cx="60" cy="60" r="44" class="b" />
      <path d="M38 62l14 13 30-31" class="t" />
    </svg>
  </section>

  <section class="paths" aria-labelledby="paths-h">
    <h2 id="paths-h">Three ways through</h2>
    <p class="note">Every chapter is written to be read in order, but each part opens with what it assumes. Pick a path to highlight its chapters on the map below.</p>
    <div class="path-cards ui" role="group" aria-label="Reading paths">
      {#each READING_PATHS as p (p.id)}
        <button type="button" class="path" aria-pressed={path === p.id} onclick={() => (path = path === p.id ? null : p.id)}>
          <strong>{p.title}</strong>
          <span>{p.blurb}</span>
          <em>{p.chapters.length} chapters</em>
        </button>
      {/each}
    </div>
  </section>

  <section class="map" id="course-map" aria-label="Course map">
    {#each PARTS as part (part.id)}
      <div class="part">
        <h2>
          <span class="pid ui">{part.id === '0' || part.id === 'E' ? part.title : `Part ${part.id}`}</span>
          {#if part.id !== '0' && part.id !== 'E'}{part.title}{/if}
        </h2>
        <p class="blurb">{part.blurb}</p>
        {#if part.essay}
          {@const ess = findEntry('part', part.essay)}
          {#if ess?.available}<p class="essay ui"><a href="{base}{ess.href}">§ How we got here</a></p>{/if}
        {/if}
        <ol class="chapters">
          {#each part.chapters as c (c.slug)}
            {@const ok = available.has(`chapter/${c.slug}`)}
            <li class:dim={onPath && !onPath.has(c.slug)} class:hl={onPath?.has(c.slug)} class:visited={progress.visited[c.slug]}>
              <span class="n ui">{c.number}</span>
              <div class="c">
                {#if ok}<a href="{base}/chapters/{c.slug}/">{c.title}</a>{:else}<span class="planned" title="Being written">{c.title}</span>{/if}
                {#if c.optional}<span class="opt ui" title="Optional deeper chapter">◇ optional</span>{/if}
                <p>{c.summary}</p>
                {#if c.engines?.length}
                  <p class="engines ui">
                    {#each c.engines as e (e)}<span title={ENGINE_LABELS[e]}><b aria-hidden="true">{ENGINE_GLYPHS[e]}</b> {ENGINE_LABELS[e]}</span>{/each}
                  </p>
                {/if}
              </div>
            </li>
          {/each}
        </ol>
      </div>
    {/each}
    <div class="part">
      <h2><span class="pid ui">Appendices</span></h2>
      <ol class="chapters">
        {#each APPENDICES as a (a.slug)}
          <li>
            <span class="n ui">{a.number}</span>
            <div class="c">
              {#if available.has(`appendix/${a.slug}`)}<a href="{base}/appendix/{a.slug}/">{a.title}</a>{:else}<span class="planned">{a.title}</span>{/if}
              <p>{a.summary}</p>
            </div>
          </li>
        {/each}
      </ol>
    </div>
  </section>
</div>

<style>
  .home {
    max-width: 72rem;
    margin: 0 auto;
    padding: 0 max(1rem, 3vw) 5rem;
  }
  .hero {
    padding: 4rem 2rem 3rem;
    margin: 0 -2rem;
    border-bottom: 1px solid var(--line);
  }
  .hero::before {
    opacity: 0.6;
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--gold);
    margin: 0 0 0.8rem;
  }
  h1 {
    font-family: var(--font-display);
    font-size: clamp(2.6rem, 8vw, 4.6rem);
    font-weight: 600;
    letter-spacing: -0.035em;
    line-height: 1;
    margin: 0;
  }
  .sub {
    font-size: clamp(1.15rem, 2.6vw, 1.5rem);
    font-style: italic;
    color: var(--ink-2);
    margin: 0.5rem 0 1.4rem;
  }
  .lede {
    max-width: 42rem;
    font-size: 1.12rem;
    margin: 0 0 1.6rem;
  }
  .hero {
    position: relative;
  }
  .hero-seal {
    position: absolute;
    right: 2rem;
    top: 3.2rem;
    width: 7.5rem;
    transform: rotate(-10deg);
  }
  .hero-seal circle {
    fill: none;
    stroke: var(--gold);
  }
  .hero-seal .a {
    stroke-width: 2;
    fill: var(--gold-soft);
  }
  .hero-seal .b {
    stroke-dasharray: 3 2;
  }
  .hero-seal .t {
    fill: none;
    stroke: var(--seal);
    stroke-width: 6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  @media (max-width: 900px) {
    .hero-seal {
      display: none;
    }
  }
  .cta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  .cta a {
    padding: 0.5rem 1rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--panel);
    color: var(--fg);
    text-decoration: none;
    font-weight: 500;
  }
  .cta a.primary {
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
  }
  .cta a:hover {
    border-color: var(--ink-blue);
  }
  h2 {
    font-family: var(--font-display);
    font-weight: 560;
    font-size: 1.6rem;
    margin: 2.8rem 0 0.5rem;
  }
  .note {
    color: var(--ink-2);
    margin: 0 0 1rem;
  }
  .path-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
    gap: 0.8rem;
  }
  .path {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    text-align: left;
    padding: 0.9rem 1rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--panel);
    cursor: pointer;
  }
  .path span {
    font-size: 0.88rem;
    color: var(--ink-2);
  }
  .path em {
    font-size: 0.78rem;
    color: var(--mute);
  }
  .path[aria-pressed='true'] {
    border-color: var(--gold);
    box-shadow: inset 0 0 0 1px var(--gold);
    background: var(--gold-soft);
  }
  .part h2 {
    display: flex;
    align-items: baseline;
    gap: 0.8rem;
    border-top: 1px solid var(--line);
    padding-top: 1.2rem;
  }
  .pid {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--gold);
    min-width: 5rem;
  }
  .blurb {
    color: var(--ink-2);
    margin: 0 0 0.5rem;
    max-width: 48rem;
  }
  .essay {
    margin: 0 0 0.8rem;
    font-size: 0.9rem;
    font-style: italic;
  }
  .chapters {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 21rem), 1fr));
    gap: 0.6rem 1.4rem;
  }
  .chapters li {
    display: grid;
    grid-template-columns: 2.2rem minmax(0, 1fr);
    gap: 0.6rem;
    padding: 0.6rem 0.4rem;
    border-radius: var(--radius-sm);
    transition: opacity 150ms;
  }
  .chapters li.dim {
    opacity: 0.35;
  }
  .chapters li.hl {
    background: var(--gold-soft);
  }
  .n {
    font-family: var(--font-mono);
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--mute);
    text-align: right;
  }
  .visited .n {
    color: var(--seal);
  }
  .c a,
  .planned {
    font-weight: 600;
    font-size: 1.05rem;
  }
  .planned {
    color: var(--ink-2);
  }
  .opt {
    margin-left: 0.4rem;
    font-size: 0.72rem;
    color: var(--gold);
  }
  .c p {
    margin: 0.15rem 0 0;
    font-size: 0.94rem;
    color: var(--ink-2);
  }
  .c .engines {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.7rem;
    font-size: 0.74rem;
    color: var(--mute);
  }
  .engines b {
    color: var(--ink-blue);
    font-weight: 600;
  }
</style>
