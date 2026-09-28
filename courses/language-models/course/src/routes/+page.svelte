<script lang="ts">
  import { base } from '$app/paths';
  import { COURSE_TITLE, PARTS } from '$content/outline';
  import { ALL_ENTRIES, type NavEntry } from '$lib/content/registry';
  import Icon from '$lib/components/ui/Icon.svelte';

  const byKey = new Map(ALL_ENTRIES.map((e) => [`${e.kind}:${e.slug}`, e]));
  const first = ALL_ENTRIES.find((e) => e.available);
  const appendices = ALL_ENTRIES.filter((e) => e.kind === 'appendix');
  const chapters = ALL_ENTRIES.filter((e) => e.kind === 'chapter');
  const doneCount = chapters.filter((e) => e.available).length;

  /** done = written, running = the next chapter in line, queued = still planned. */
  const nextUp = chapters.find((e) => !e.available);
  type Status = 'done' | 'running…' | 'queued';
  const statusOf = (e: NavEntry): Status => (e.available ? 'done' : e === nextUp ? 'running…' : 'queued');
  const cls = (s: Status) => (s === 'done' ? 'done' : s === 'queued' ? 'queued' : 'running');

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

  // Next-word probabilities at T = 1; the slider re-tempers them, as in Chapter 15.
  const NEXT = [
    { t: 'mat', p: 0.41 },
    { t: 'floor', p: 0.17 },
    { t: 'sofa', p: 0.11 },
    { t: 'bed', p: 0.08 },
    { t: 'roof', p: 0.05 },
  ];
  let temp = $state(1);
  const probs = $derived.by(() => {
    const ex = NEXT.map((n) => Math.exp(Math.log(n.p) / temp));
    const z = ex.reduce((a, b) => a + b, 0);
    return NEXT.map((n, i) => ({ t: n.t, p: ex[i]! / z }));
  });
</script>

<svelte:head>
  <title>{COURSE_TITLE} — an interactive course</title>
  <meta name="description" content="Build, train and understand a GPT-style language model from scratch, with interactive equations, GPU visualisations and in-browser exercises." />
</svelte:head>

{#snippet row(e: NavEntry)}
  {@const s = statusOf(e)}
  {#if e.available}
    <a class="row ready" href="{base}{e.href}">
      <span class="n">{e.number.padStart(2, '0')}</span>
      <span class="what"><span class="t">{e.title}</span><span class="s">{e.summary}</span></span>
      <span class="st {cls(s)}">{s}</span>
    </a>
  {:else}
    <div class="row planned" aria-label="{e.title}, {s}, coming in milestone {e.milestone}">
      <span class="n">{e.number.padStart(2, '0')}</span>
      <span class="what"><span class="t">{e.title}</span><span class="s">{e.summary}</span></span>
      <span class="st {cls(s)}">{s}</span>
    </div>
  {/if}
{/snippet}

<div class="home">
  <section class="cellrow head" aria-labelledby="home-title">
    <span class="nb md" aria-hidden="true">[md]</span>
    <div>
      <h1 id="home-title">{COURSE_TITLE}</h1>
      <p class="lede">
        Build a GPT from nothing: text statistics, tokenisers, tensors and autograd, GPU kernels in WebGPU, attention and the
        Transformer, trained on your own GPU, in the page. Then scaling, fine-tuning, preference learning and reasoning. Every idea
        comes with the equation, the code, and a figure you can break.
      </p>
      <div class="cta">
        {#if first}<a class="primary" href="{base}{first.href}">Start with Chapter {first.number} <Icon name="chevron" size={16} /></a>{/if}
        <a class="secondary" href="#contents">See all chapters</a>
      </div>
    </div>
  </section>

  <section class="cellrow" id="contents" aria-label="Contents">
    <div class="cellcol">
      <div class="cell in">
        <span class="nb in" aria-hidden="true">In [1]:</span>
        <pre class="code"><code><span class="kw">for</span> chapter <span class="kw">in</span> course:
  <span class="fn">print</span>(chapter.title, chapter.status)</code></pre>
      </div>
      <div class="cell out">
        <span class="nb out" aria-hidden="true">Out[1]:</span>
        <div class="listing">
          <p class="tally"><span>{doneCount} of {chapters.length} chapters written</span></p>
          {#each PARTS as part (part.id)}
            <h2 class="part"><span class="pid">Part {part.id}</span> {part.title}<span class="blurb">{part.blurb}</span></h2>
            <ul>
              {#each part.chapters as c (c.slug)}
                <li>{@render row(byKey.get(`chapter:${c.slug}`)!)}</li>
              {/each}
            </ul>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <hr class="divider" />

  <section class="cellrow head" aria-labelledby="track-h">
    <span class="nb md" aria-hidden="true">[md]</span>
    <div>
      <h2 id="track-h" class="big">The model you will build</h2>
      <p class="sub">Eight stages, each one a model that runs in your browser and that you have written yourself.</p>
    </div>
  </section>
  <section class="cellrow" aria-label="Stages of the model">
    <span class="nb out" aria-hidden="true">Out[2]:</span>
    <ol class="track">
      {#each TRACK as s, i (s.name)}
        <li>
          <span class="idx">{String(i + 1).padStart(2, '0')}</span>
          <span class="name">{s.name}</span>
          <span class="meta">Ch. {s.ch} · {s.note}</span>
        </li>
      {/each}
    </ol>
  </section>

  <hr class="divider" />

  <section class="cellrow head" aria-labelledby="predict-h">
    <span class="nb md" aria-hidden="true">[md]</span>
    <div>
      <h2 id="predict-h" class="big">Next-word probabilities</h2>
      <p class="sub">A language model turns a context into a distribution over the next token. Dividing the scores by T sharpens or flattens it. Drag the slider.</p>
    </div>
  </section>
  <section class="cellrow" aria-label="Temperature demonstration">
    <div class="cellcol">
      <div class="cell in">
        <span class="nb in" aria-hidden="true">In [3]:</span>
        <div class="code ctl">
          <div>softmax(z / <span class="ac">T</span>) <span class="cm"># T = {temp.toFixed(2)}, context: "The cat sat on the"</span></div>
          <label class="slide"><span class="mu">T</span>
            <input type="range" min="0.2" max="3" step="0.05" bind:value={temp} aria-label="Temperature T" />
          </label>
        </div>
      </div>
      <div class="cell out">
        <span class="nb out" aria-hidden="true">Out[3]:</span>
        <figure class="bars" aria-label="Next-word probabilities at temperature {temp.toFixed(2)}">
          <ul>
            {#each probs as n (n.t)}
              <li>
                <span class="pv">{n.p.toFixed(2)}</span>
                <span class="col"><i style:height="{Math.max(2, Math.round(n.p * 130))}px"></i></span>
                <span class="tok">{n.t}</span>
              </li>
            {/each}
          </ul>
        </figure>
      </div>
    </div>
  </section>

  <hr class="divider" />

  <section class="cellrow features" aria-label="How the course works">
    <span class="nb md" aria-hidden="true">[md]</span>
    <div class="grid">
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
    </div>
  </section>

  <section class="cellrow head" aria-labelledby="app-h">
    <span class="nb md" aria-hidden="true">[md]</span>
    <div>
      <h2 id="app-h" class="big small">Appendices</h2>
      <p class="sub">Mathematical and technical primers: refreshers you can dip into whenever a chapter assumes something.</p>
    </div>
  </section>
  <section class="cellrow" aria-label="Appendices">
    <div class="cellcol">
      <div class="cell out">
        <span class="nb out" aria-hidden="true">Out[4]:</span>
        <div class="listing">
          <ul>
            {#each appendices as e (e.slug)}
              <li>{@render row(e)}</li>
            {/each}
          </ul>
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .home {
    max-width: calc(880px + 8vw);
    margin: 0 auto;
    padding: 2.5rem clamp(1rem, 4vw, 2.5rem) 6rem;
    font-family: var(--font-ui);
    counter-reset: none;
  }
  /* Notebook rows: 70px label gutter + content. */
  .cellrow {
    display: grid;
    grid-template-columns: var(--gutter-w) minmax(0, 1fr);
    gap: var(--gutter-gap);
    margin-bottom: 1.1rem;
  }
  .cellrow > .nb,
  .cell > .nb {
    position: static;
    width: auto;
  }
  .cellrow > .nb {
    padding-top: 0.5rem;
  }
  .cellrow > .cellcol {
    grid-column: 1 / -1;
  }
  .cell {
    display: grid;
    grid-template-columns: var(--gutter-w) minmax(0, 1fr);
    gap: var(--gutter-gap);
    margin-bottom: 1.1rem;
  }
  .cell > .nb {
    padding-top: 0.75rem;
  }
  .cell.out > .nb {
    padding-top: 0.15rem;
  }
  .nb::before {
    content: none !important;
  }
  .cellrow.head {
    margin-bottom: 1.1rem;
  }
  .cellrow > section,
  .cellrow > :not(.nb):not(.cellcol) {
    min-width: 0;
  }

  h1 {
    font-size: clamp(2.5rem, 7.4vw, 3.75rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1;
    margin: 0;
    text-wrap: balance;
  }
  .lede {
    font-size: 1.0625rem;
    line-height: 1.65;
    color: var(--ink-2);
    margin: 1rem 0 1.5rem;
    max-width: 36rem;
  }
  .cta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  .cta a {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.6rem 1.1rem;
    border-radius: var(--radius);
    font-weight: 700;
    font-size: 0.92rem;
    text-decoration: none;
  }
  .primary {
    background: var(--ac);
    color: var(--on-accent);
  }
  .primary:hover {
    background: var(--accent-ink);
    color: var(--bg);
  }
  .secondary {
    border: 1px solid var(--rule-strong);
    color: var(--ink);
  }
  .secondary:hover {
    background: var(--pn);
  }

  .code {
    margin: 0;
    background: var(--pn);
    border-left: 3px solid var(--ac);
    border-radius: 0 var(--radius) var(--radius) 0;
    padding: 0.75rem 1rem;
    font: 400 0.8125rem/1.7 var(--font-mono);
    overflow-x: auto;
  }
  .code code {
    font: inherit;
  }
  .kw {
    color: var(--code-keyword);
  }
  .fn {
    color: var(--code-fn);
  }
  .ac {
    color: var(--ac);
  }
  .cm,
  .mu {
    color: var(--ink-3);
  }

  .listing {
    font: 400 0.84375rem/1.6 var(--font-mono);
    min-width: 0;
  }
  .tally {
    margin: 0 0 0.6rem;
    color: var(--ink-3);
    font-size: 0.78rem;
  }
  .tally::before {
    content: '# ';
  }
  .listing ul {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
  }
  .part {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 0.7rem;
    margin: 1.4rem 0 0.35rem;
    font: 500 0.72rem/1.5 var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-2);
  }
  .part:first-of-type {
    margin-top: 0.4rem;
  }
  .pid {
    color: var(--accent);
  }
  .blurb {
    font-family: var(--font-ui);
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    font-size: 0.82rem;
    color: var(--ink-3);
  }
  .row {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr) auto;
    gap: 0 0.9rem;
    align-items: baseline;
    padding: 0.35rem 0.5rem;
    margin: 0 -0.5rem;
    border-radius: var(--radius);
    color: var(--fg);
    text-decoration: none;
  }
  a.row:hover {
    background: var(--pn);
  }
  .row .n {
    color: var(--ink-3);
  }
  .row .what {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .row .t {
    font-size: 0.84375rem;
  }
  .row .s {
    font: 400 0.8125rem/1.45 var(--font-ui);
    color: var(--ink-3);
  }
  .row.planned .t {
    color: var(--ink-2);
  }
  .st {
    font-size: 0.8125rem;
    white-space: nowrap;
  }
  .st.done {
    color: var(--accent);
  }
  .st.running {
    color: var(--running-text);
  }
  .st.queued {
    color: var(--ink-3);
  }

  .divider {
    height: 1px;
    border: 0;
    background: var(--rule);
    margin: 3.5rem 0 2.5rem;
  }
  h2.big {
    font-size: clamp(1.9rem, 5vw, 2.4rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.1;
    margin: 0;
  }
  h2.big.small {
    font-size: 1.6rem;
  }
  .sub {
    font-size: 1rem;
    line-height: 1.65;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
    max-width: 40rem;
  }

  .track {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
    gap: 0.9rem 1.1rem;
    grid-column: 2;
  }
  .track li {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding-left: 0.85rem;
    border-left: 2px solid var(--ac);
  }
  .idx {
    font: 400 0.7rem var(--font-mono);
    color: var(--ink-3);
  }
  .name {
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .meta {
    font: 400 0.72rem var(--font-mono);
    color: var(--ink-2);
  }

  .ctl .slide {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    margin-top: 0.4rem;
  }
  .ctl input {
    flex: 1;
    accent-color: var(--ac);
  }
  .bars ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    gap: 0.6rem;
    align-items: flex-end;
    height: 150px;
    border-bottom: 1px solid var(--mute);
  }
  .bars {
    margin: 0;
  }
  .bars li {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    height: 100%;
    position: relative;
  }
  .pv {
    font: 400 0.625rem var(--font-mono);
    color: var(--ink-2);
  }
  .col {
    display: flex;
    align-items: flex-end;
    width: 100%;
    margin-top: 4px;
  }
  .col i {
    display: block;
    width: 100%;
    background: var(--ac);
    border-radius: 2px 2px 0 0;
    transition: height 120ms ease;
  }
  .tok {
    position: absolute;
    bottom: -1.5rem;
    font: 400 0.72rem var(--font-mono);
    color: var(--ink-2);
  }
  .bars {
    padding-bottom: 1.8rem;
  }

  .features .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 1.4rem 2rem;
  }
  .features h3 {
    margin: 0 0 0.3rem;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .features p {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.6;
    color: var(--ink-2);
  }
  .features {
    margin-bottom: 3rem;
  }

  @media (max-width: 759px) {
    .cellrow,
    .cell {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.25rem;
    }
    .cellrow > .nb,
    .cell > .nb,
    .cell.out > .nb {
      padding-top: 0;
      text-align: left;
    }
    .track {
      grid-column: 1;
    }
    .row {
      grid-template-columns: 1.6rem minmax(0, 1fr) auto;
      gap: 0 0.6rem;
    }
  }
</style>
