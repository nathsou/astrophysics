<script lang="ts">
  import { base } from '$app/paths';
  import { COURSE_TITLE, PARTS } from '$content/outline';
  import { ALL_ENTRIES } from '$lib/content/registry';
  import Icon from '$lib/components/ui/Icon.svelte';

  const byKey = new Map(ALL_ENTRIES.map((e) => [`${e.kind}:${e.slug}`, e]));
  const first = ALL_ENTRIES.find((e) => e.available);
  const appendices = ALL_ENTRIES.filter((e) => e.kind === 'appendix');

  // The model we build, stage by stage.
  const TRACK = [
    { name: 'Counts', ch: '2', note: 'n-gram tables' },
    { name: 'Neural bigram', ch: '5', note: 'gradient descent' },
    { name: 'MLP', ch: '7', note: 'embeddings' },
    { name: 'char-RNN', ch: '9', note: 'recurrence' },
    { name: 'char-GPT', ch: '12', note: 'trained in your browser' },
    { name: 'CourseGPT', ch: '14', note: '~30M params, PyTorch' },
    { name: 'Instruct', ch: '20', note: 'SFT, LoRA, DPO' },
    { name: 'Reasoner', ch: '22', note: 'GRPO' },
  ];

  const NEXT = [
    { t: 'mat', p: 0.41 },
    { t: 'floor', p: 0.17 },
    { t: 'sofa', p: 0.11 },
    { t: 'bed', p: 0.08 },
    { t: 'roof', p: 0.05 },
  ];
</script>

<svelte:head>
  <title>{COURSE_TITLE} — an interactive course</title>
  <meta name="description" content="Build, train and understand a GPT-style language model from scratch, with interactive equations, GPU visualisations and in-browser exercises." />
</svelte:head>

<div class="home">
  <section class="hero">
    <div class="copy">
      <p class="eyebrow ui">An interactive course</p>
      <h1>{COURSE_TITLE}</h1>
      <p class="lede">
        Build a GPT from nothing — tokeniser, tensors, autograd, GPU kernels, attention, training, inference — then take it through
        scaling, fine-tuning, preference learning and reasoning. Every idea comes with the equation, the code, and a figure you can
        break.
      </p>
      <div class="cta ui">
        {#if first}<a class="primary" href="{base}{first.href}">Start with Chapter {first.number} <Icon name="chevron" size={16} /></a>{/if}
        <a class="secondary" href="#contents">See all chapters</a>
      </div>
    </div>
    <figure class="predict ui" aria-label="Illustration: a language model's probabilities for the next word">
      <div class="prompt">The cat sat on the <span class="cursor">▍</span></div>
      <ul>
        {#each NEXT as n, i (n.t)}
          <li style:--p={n.p / NEXT[0]!.p} style:--i={i}>
            <span class="tok">{n.t}</span>
            <span class="bar"><span></span></span>
            <span class="p num">{(n.p * 100).toFixed(0)}%</span>
          </li>
        {/each}
      </ul>
      <figcaption>P(next word | context)</figcaption>
    </figure>
  </section>

  <section class="track" aria-labelledby="track-h">
    <h2 id="track-h" class="ui">The model you will build</h2>
    <ol class="ui">
      {#each TRACK as s, i (s.name)}
        <li style:--i={i}>
          <span class="dot"></span>
          <span class="name">{s.name}</span>
          <span class="meta">Ch. {s.ch} · {s.note}</span>
        </li>
      {/each}
    </ol>
  </section>

  <section class="features ui">
    <div>
      <h3>Equations you can touch</h3>
      <p>Hover any symbol for what it means, why it is there and what changing it does. Some drive the figures directly.</p>
    </div>
    <div>
      <h3>Live on your GPU</h3>
      <p>Tensors, attention maps, gradients and training runs are computed and drawn with WebGPU, in the page.</p>
    </div>
    <div>
      <h3>Your code, in the model</h3>
      <p>Exercises run in the browser against tests. Pass them and the chapter’s figures switch to your implementation.</p>
    </div>
    <div>
      <h3>Real training</h3>
      <p>From Chapter 14, PyTorch on your own GPU trains CourseGPT, which then runs back in the browser on the engine you wrote.</p>
    </div>
  </section>

  <section class="contents" id="contents" aria-labelledby="contents-h">
    <h2 id="contents-h" class="ui">Contents</h2>
    {#each PARTS as part (part.id)}
      <div class="part">
        <div class="part-head ui">
          <span class="pid">Part {part.id}</span>
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
                <div class="card planned" aria-label="{e.title} (coming in milestone {e.milestone})">
                  <span class="n ui">{e.number}</span>
                  <span class="t ui">{e.title}</span>
                  <span class="s">{e.summary}</span>
                  <span class="soon ui">Coming · {e.milestone}</span>
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
        <h3>Mathematical and technical primers</h3>
        <p>Refreshers you can dip into whenever a chapter assumes something.</p>
      </div>
      <ul class="cards compact">
        {#each appendices as e (e.slug)}
          <li>
            {#if e.available}
              <a class="card ready" href="{base}{e.href}"><span class="n ui">{e.number}</span><span class="t ui">{e.title}</span></a>
            {:else}
              <div class="card planned"><span class="n ui">{e.number}</span><span class="t ui">{e.title}</span><span class="soon ui">Coming · {e.milestone}</span></div>
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
    font-family: var(--font-ui);
    font-size: clamp(2.5rem, 6vw, 4.2rem);
    line-height: 1.02;
    letter-spacing: -0.035em;
    font-weight: 760;
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
    border: 1px solid var(--border-control);
    color: var(--ink);
  }
  .secondary:hover {
    background: var(--surface-2);
  }

  .predict {
    margin: 0;
    padding: 1.5rem 1.6rem 1.2rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: var(--shadow-lg);
  }
  .prompt {
    font-family: var(--font-body);
    font-size: 1.35rem;
    margin-bottom: 1rem;
  }
  .cursor {
    color: var(--accent-2);
    animation: blink 1.1s steps(1) infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
  .predict ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.45rem;
  }
  .predict li {
    display: grid;
    grid-template-columns: 4rem 1fr 2.8rem;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9rem;
  }
  .tok {
    font-family: var(--font-mono);
  }
  .bar {
    height: 12px;
  }
  .bar span {
    display: block;
    height: 100%;
    width: calc(var(--p) * 100%);
    background: var(--series-1);
    border-radius: 0 4px 4px 0;
    transform-origin: left;
    animation: grow 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    animation-delay: calc(var(--i) * 90ms + 200ms);
  }
  @keyframes grow {
    from {
      transform: scaleX(0);
    }
  }
  .p {
    text-align: right;
    color: var(--ink-2);
  }
  .predict figcaption {
    margin-top: 0.9rem;
    font-size: 0.75rem;
    color: var(--ink-3);
    font-family: var(--font-mono);
  }

  h2 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 650;
    color: var(--ink-3);
    margin: 0 0 1.25rem;
  }
  .track {
    padding: 2rem 0 2.5rem;
    border-top: 1px solid var(--rule);
  }
  .track ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    position: relative;
  }
  .track ol::before {
    content: '';
    position: absolute;
    left: 0.4rem;
    right: 0.4rem;
    top: 0.45rem;
    height: 2px;
    background: linear-gradient(to right, var(--series-1), var(--series-7));
    opacity: 0.5;
  }
  .track li {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding-right: 0.5rem;
  }
  .dot {
    width: 0.9rem;
    height: 0.9rem;
    border-radius: 50%;
    background: var(--surface);
    border: 2.5px solid color-mix(in srgb, var(--series-1) calc(100% - var(--i) * 12%), var(--series-7));
    margin-bottom: 0.5rem;
    z-index: 1;
  }
  .name {
    font-weight: 650;
    font-size: 0.92rem;
  }
  .meta {
    font-size: 0.75rem;
    color: var(--ink-2);
  }
  @media (max-width: 900px) {
    .track ol {
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .track ol::before {
      display: none;
    }
  }

  .features {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr)); /* 4 or 2×2, never 3 + an orphan */
    gap: 1rem;
    padding: 0 0 3rem;
  }
  /* Four across when the column is wide enough (the sidebar takes 18rem from 1100px up). */
  @media (min-width: 1240px), (min-width: 860px) and (max-width: 1099px) {
    .features {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
  @media (max-width: 560px) {
    .features {
      grid-template-columns: minmax(0, 1fr);
    }
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
