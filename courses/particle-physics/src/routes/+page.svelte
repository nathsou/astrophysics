<script lang="ts">
  import { base } from '$app/paths';
  import { COURSE_SUBTITLE, COURSE_TITLE, PARTS, APPENDICES } from '$content/outline';
  import { ALL_ENTRIES } from '$lib/content/registry';

  const available = new Set(ALL_ENTRIES.filter((e) => e.available).map((e) => `${e.kind}/${e.slug}`));
  const STAGES = [
    { n: 1, name: 'Machine', what: 'Beams, luminosity, pile-up', from: 'Part V' },
    { n: 2, name: 'Generator', what: 'Collisions and decays', from: 'Parts I, IV' },
    { n: 3, name: 'Detector', what: 'Fields, matter, hits', from: 'Part II' },
    { n: 4, name: 'Reconstruction', what: 'Tracks, jets, leptons', from: 'Parts II, IV' },
    { n: 5, name: 'Trigger', what: 'Keep one in 40,000', from: 'Part VII' },
    { n: 6, name: 'Analysis', what: 'Fits, p-values, discovery', from: 'Part VII' },
  ];
  const total = PARTS.reduce((n, p) => n + p.chapters.length, 0);
  const done = PARTS.reduce((n, p) => n + p.chapters.filter((c) => available.has(`chapter/${c.slug}`)).length, 0);
</script>

<svelte:head>
  <title>{COURSE_TITLE}</title>
  <meta name="description" content="An interactive textbook on particle physics. Build a mini-LHC in the browser: a machine, an event generator, a detector, reconstruction, a trigger and an analysis, and find the Higgs boson." />
</svelte:head>

<div class="home">
  <section class="hero">
    <p class="eyebrow ui">An interactive course · {done} of {total} chapters</p>
    <h1>{COURSE_TITLE}</h1>
    <p class="sub">{COURSE_SUBTITLE}</p>
    <p class="lede">
      Particle physics is the study of the smallest things we know of, and the largest machine ever built to see them.
      This course teaches the Standard Model the way physicists found it out: by looking at tracks, measuring them,
      and asking what could have made them. Along the way you build a miniature version of the whole apparatus: a
      collider, a detector, the software that reads it out, and the analysis that turns billions of collisions into
      a discovery.
    </p>
    <div class="cta ui">
      <a class="primary" href="{base}/chapters/{PARTS[0]!.chapters[0]!.slug}/">Start with chapter 0</a>
      <a href="{base}/control-room/">The Control Room</a>
    </div>
  </section>

  <section class="pipe" aria-labelledby="pipe-h">
    <h2 id="pipe-h">The mini-LHC you build</h2>
    <p class="note">Six stages, each upgraded as the physics needs it. In chapter 29 the whole chain finds the Higgs boson, first in simulation and then in real data from the LHC experiments.</p>
    <ol class="stages ui">
      {#each STAGES as s}
        <li>
          <span class="n">{s.n}</span>
          <strong>{s.name}</strong>
          <span>{s.what}</span>
          <em>{s.from}</em>
        </li>
      {/each}
    </ol>
  </section>

  <section class="parts">
    {#each PARTS as part}
      <div class="part">
        <h2><span class="pid ui">{part.id === '0' ? '·' : `Part ${part.id}`}</span> {part.title}</h2>
        <p class="blurb">{part.blurb}</p>
        <ul>
          {#each part.chapters as c}
            {@const ok = available.has(`chapter/${c.slug}`)}
            <li class:planned={!ok}>
              <span class="num ui">{c.number}</span>
              {#if ok}<a href="{base}/chapters/{c.slug}/">{c.title}</a>{:else}<span class="t">{c.title}</span>{/if}
              <span class="sum">{c.summary}</span>
              {#if c.flagship}<span class="flag ui">{c.flagship}</span>{/if}
            </li>
          {/each}
        </ul>
      </div>
    {/each}
    <div class="part">
      <h2><span class="pid ui">Reference</span> Appendices</h2>
      <ul>
        {#each APPENDICES as a}
          {@const ok = available.has(`appendix/${a.slug}`)}
          <li class:planned={!ok}>
            <span class="num ui">{a.number}</span>
            {#if ok}<a href="{base}/appendix/{a.slug}/">{a.title}</a>{:else}<span class="t">{a.title}</span>{/if}
            <span class="sum">{a.summary}</span>
          </li>
        {/each}
      </ul>
    </div>
  </section>
</div>

<style>
  .home {
    max-width: 62rem;
    margin: 0 auto;
    padding: 3rem 1rem 4rem;
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--track-ink);
    margin: 0 0 0.6rem;
  }
  h1 {
    font-family: var(--font-display);
    font-size: clamp(2.6rem, 7vw, 4.6rem);
    line-height: 1;
    margin: 0;
    letter-spacing: -0.02em;
  }
  .sub {
    font-family: var(--font-display);
    font-size: 1.25rem;
    color: var(--ink-2);
    margin: 0.6rem 0 1.4rem;
  }
  .lede {
    max-width: 40rem;
    font-size: 1.12rem;
    line-height: 1.6;
  }
  .cta {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    margin-top: 1.4rem;
  }
  .cta a {
    border: 1.5px solid var(--track);
    color: var(--track-ink);
    border-radius: 6px;
    padding: 0.55rem 1.1rem;
    text-decoration: none;
    font-weight: 600;
  }
  .cta a.primary {
    background: var(--track);
    color: var(--on-accent);
  }
  .pipe {
    margin: 3rem 0;
  }
  .pipe h2,
  .part h2 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    margin: 0 0 0.4rem;
  }
  .note {
    color: var(--ink-2);
    max-width: 44rem;
  }
  .stages {
    list-style: none;
    padding: 0;
    margin: 1.2rem 0 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
    gap: 0.6rem;
  }
  .stages li {
    background: var(--panel);
    border: 1px solid var(--line);
    border-top: 3px solid var(--track);
    border-radius: 6px;
    padding: 0.7rem 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.85rem;
  }
  .stages .n {
    font-family: var(--font-mono);
    color: var(--track-ink);
    font-size: 0.75rem;
  }
  .stages em {
    color: var(--mute);
    font-style: normal;
    font-size: 0.75rem;
  }
  .part {
    margin: 2.2rem 0;
  }
  .pid {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--mute);
    margin-right: 0.4rem;
  }
  .blurb {
    color: var(--ink-2);
    margin: 0 0 0.8rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    border-top: 1px solid var(--line);
  }
  li {
    display: grid;
    grid-template-columns: 2.2rem minmax(0, 1fr) auto;
    gap: 0.1rem 0.8rem;
    align-items: baseline;
    padding: 0.65rem 0;
    border-bottom: 1px solid var(--line);
  }
  .num {
    font-family: var(--font-mono);
    color: var(--mute);
    font-size: 0.85rem;
  }
  li a,
  li .t {
    font-weight: 600;
    text-decoration: none;
  }
  li a {
    color: var(--track-ink);
  }
  li.planned .t {
    color: var(--mute);
  }
  .sum {
    grid-column: 2;
    color: var(--ink-2);
    font-size: 0.92rem;
  }
  .flag {
    grid-column: 3;
    grid-row: 1;
    font-size: 0.72rem;
    color: var(--mute);
    font-family: var(--font-mono);
  }
  @media (max-width: 600px) {
    li {
      grid-template-columns: 2rem minmax(0, 1fr);
    }
    .flag {
      display: none;
    }
  }
</style>
