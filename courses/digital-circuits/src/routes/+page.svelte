<script lang="ts">
  import { base } from '$app/paths';
  import { PARTS, APPENDICES, COURSE_TITLE, COURSE_SUBTITLE } from '$content/outline';
  import { ALL_ENTRIES } from '$lib/content/registry';
  import Icon, { type IconName } from '$lib/components/ui/Icon.svelte';

  const available = new Set(ALL_ENTRIES.filter((e) => e.available).map((e) => `${e.kind}:${e.slug}`));
  const chapters = PARTS.flatMap((p) => p.chapters);
  const ready = chapters.filter((c) => available.has(`chapter:${c.slug}`)).length;
  const first = ALL_ENTRIES.find((e) => e.available);
  const numbered = PARTS.filter((p) => p.id !== '0' && p.id !== 'E').length;

  const partLabel = (id: string) => (id === '0' ? 'Prologue' : id === 'E' ? 'Epilogue' : `Part ${id}`);
  const pad2 = (n: string) => n.padStart(2, '0');

  // The timeline strip: every chapter's key moment, in date order, with axis breaks over long gaps.
  const events = chapters
    .filter((c) => c.year && c.event)
    .map((c) => ({ year: c.year!, event: c.event!, number: c.number, slug: c.slug, ready: available.has(`chapter:${c.slug}`) }))
    .sort((a, b) => a.year - b.year || Number(a.number) - Number(b.number));
  const strip = events.map((e, i) => ({ ...e, gap: i > 0 ? e.year - events[i - 1]!.year : 0 }));

  const HOW: { icon: IconName; title: string; text: string }[] = [
    { icon: 'probe', title: 'Live circuits you can poke', text: 'Every figure is a running circuit. Flip the switches, probe the nets, and turn the abstraction dial from logic to transistors to volts over time.' },
    { icon: 'bin', title: 'Your parts bin', text: 'Build an inverter, an adder, a flip-flop. Once a part passes its checker it becomes a black box you reuse: the CPU in Part V is made entirely of your own parts.' },
    { icon: 'bench', title: 'The bench', text: 'A multimeter, a bench supply, an oscilloscope, a function generator and a logic probe. Open any figure on the bench to take it apart.' },
    { icon: 'studio', title: 'The Device Studio', text: 'Program ROMs, PALs, CPLDs and FPGAs by hand or in DCL, the course’s hardware language, with the logic view and the chip view side by side.' },
    { icon: 'history', title: 'History cards', text: 'Volta’s pile, Shannon’s thesis, the first transistor, the first FPGA. Flip a card for the story; some let you run the original circuit.' },
    { icon: 'real', title: 'Build it for real', text: 'Optional labs with a breadboard, a handful of 74HC chips and a 5 V supply — and, in Part VI, a real FPGA board. Low voltage only.' },
  ];

  // Scope traces (viewBox 400 × 250; 10 × 8 divisions of 40 × 31.25). CH1: the clock, 2 divisions a
  // period. CH2: Q0, which toggles on every rising edge.
  const W = 400;
  function square(period: number, hi: number, lo: number, startHigh: boolean, until = W): string {
    let d = `M0 ${startHigh ? hi : lo}`;
    let level = startHigh;
    for (let x = period / 2; x <= until; x += period / 2) {
      d += `H${x}V${(level = !level) ? hi : lo}`;
    }
    return d + `H${until}`;
  }
  const ch1 = square(80, 58, 104, true);
  // Q0 toggles at each rising clock edge (x = 80, 160, …): one count a second, like the LEDs below.
  const q0 = square(160, 150, 196, false);
</script>

<svelte:head>
  <title>{COURSE_TITLE} — {COURSE_SUBTITLE}</title>
  <meta name="description" content="An interactive course on digital circuits for software engineers: from a battery and a switch to a CPU you build yourself and map onto an FPGA." />
</svelte:head>

<article class="home">
  <!-- ───────────── Hero ───────────── -->
  <section class="hero">
    <div class="hero-text">
      <p class="eyebrow">An interactive course <span aria-hidden="true">·</span> for software engineers</p>
      <h1>{COURSE_TITLE}</h1>
      <p class="subtitle">{COURSE_SUBTITLE}</p>
      <p class="lede">
        Start with a battery, a switch and a lamp. Build every part yourself on a live simulator, assemble an 8-bit CPU from your own
        parts bin, then put it on a programmable chip — a virtual one whose every fuse you can inspect, and a real one if you like.
        No electronics background needed.
      </p>
      <div class="cta">
        {#if first}
          <a class="btn primary" href="{base}{first.href}">Start with {first.kind === 'chapter' ? `chapter ${first.number}` : first.title} <Icon name="arrow" size={16} /></a>
          <a class="btn" href="#contents">The course map</a>
        {:else}
          <a class="btn primary" href="#contents">Explore the course map <Icon name="arrow" size={16} /></a>
        {/if}
      </div>
      <dl class="readouts">
        <div><dt>Chapters</dt><dd>{chapters.length}</dd></div>
        <div><dt>Parts</dt><dd>{numbered}</dd></div>
        <div><dt>Appendices</dt><dd>{APPENDICES.length}</dd></div>
        <div><dt>Ready</dt><dd>{ready}</dd></div>
      </dl>
    </div>

    <div class="instrument" role="img" aria-label="An oscilloscope showing a clock and the lowest bit of a counter, above four LEDs counting in binary.">
      <div class="bezel-top" aria-hidden="true">
        <span class="brand">BENCH&nbsp;·&nbsp;DSO-2</span>
        <span class="run"><i></i>RUN</span>
      </div>
      <div class="scope screen" aria-hidden="true">
        <svg viewBox="0 0 400 250" preserveAspectRatio="none">
          <g class="graticule">
            {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as i (i)}<line x1={i * 40} y1="0" x2={i * 40} y2="250" />{/each}
            {#each [1, 2, 3, 4, 5, 6, 7] as i (i)}<line x1="0" y1={i * 31.25} x2="400" y2={i * 31.25} />{/each}
          </g>
          <g class="axes">
            <line x1="200" y1="0" x2="200" y2="250" />
            <line x1="0" y1="125" x2="400" y2="125" />
            {#each Array.from({ length: 49 }, (_, i) => i) as i (i)}<line x1={i * 8 + 8} y1="122" x2={i * 8 + 8} y2="128" />{/each}
          </g>
          <g class="trace ch1">
            <path class="persist" d={ch1} />
            <path class="live" d={ch1} />
          </g>
          <g class="trace ch2">
            <path class="persist" d={q0} />
            <path class="live" d={q0} />
          </g>
          <text x="8" y="50" class="lab ch1">1</text>
          <text x="8" y="142" class="lab ch2">2</text>
        </svg>
        <div class="readout"><span class="c1">CH1 CLK 2.00 V</span><span class="c2">CH2 Q0 2.00 V</span><span class="tb">500 ms/div</span></div>
      </div>
      <div class="counter" aria-hidden="true">
        <div class="leds">
          {#each [3, 2, 1, 0] as b (b)}
            <span class="led-cell">
              <span class="led" style:--w={2 ** b}><i></i></span>
              <span class="bit">Q{b}</span>
            </span>
          {/each}
        </div>
        <div class="count"><span class="k">COUNT</span><span class="v"></span></div>
      </div>
    </div>
  </section>

  <!-- ───────────── How it works ───────────── -->
  <section class="how" aria-labelledby="how-h">
    <header class="sec-head">
      <p class="kicker">How this course works</p>
      <h2 id="how-h">A lab bench in your browser</h2>
    </header>
    <ul class="how-grid">
      {#each HOW as h (h.title)}
        <li>
          <span class="how-icon"><Icon name={h.icon} size={22} /></span>
          <h3>{h.title}</h3>
          <p>{h.text}</p>
        </li>
      {/each}
    </ul>
  </section>

  <!-- ───────────── The course map ───────────── -->
  <section class="map" id="contents" aria-labelledby="map-h">
    <header class="sec-head">
      <p class="kicker">The course map</p>
      <h2 id="map-h">One signal path, from a battery to a CPU on a chip</h2>
      <p class="legend ui" aria-hidden="true">
        <span><i class="pad on"></i> ready to read</span>
        <span><i class="pad"></i> planned</span>
        <span class="mono">{ready}/{chapters.length} ready</span>
      </p>
    </header>

    <div class="board">
      {#each PARTS as part, pi (part.id)}
        <section class="part" aria-labelledby="part-{part.id}">
          <header class="part-head">
            <svg class="ic" viewBox="0 0 64 48" aria-hidden="true">
              {#each [0, 1, 2, 3] as i (i)}
                <rect class="ic-pin" x={12 + i * 11} y="2" width="5" height="8" rx="1" />
                <rect class="ic-pin" x={12 + i * 11} y="38" width="5" height="8" rx="1" />
              {/each}
              <rect class="ic-body" x="4" y="9" width="56" height="30" rx="3" />
              <path class="ic-notch" d="M4 18a6 6 0 0 1 0 12" />
              <text x="34" y="29" text-anchor="middle">{part.id === '0' ? 'P' : part.id}</text>
            </svg>
            <div class="part-text">
              <p class="part-label">{partLabel(part.id)} <span class="ref">U{pi + 1}</span></p>
              <h3 id="part-{part.id}">{part.title}</h3>
              <p class="blurb">{part.blurb}</p>
            </div>
          </header>
          <ol class="chapters">
            {#each part.chapters as c (c.slug)}
              {@const ok = available.has(`chapter:${c.slug}`)}
              <li class:ready={ok}>
                <svelte:element this={ok ? 'a' : 'div'} class="ch" href={ok ? `${base}/chapters/${c.slug}/` : undefined}>
                  <span class="pad" aria-hidden="true"></span>
                  <span class="num">{pad2(c.number)}</span>
                  <span class="ch-main">
                    <span class="ch-title">{c.title}{#if !ok}<span class="visually-hidden"> (planned)</span>{/if}</span>
                    <span class="ch-sum">{c.summary}</span>
                    {#if c.flagship || c.year}
                      <span class="ch-meta">
                        {#if c.flagship}<span class="flag"><Icon name="wave" size={13} /> {c.flagship}</span>{/if}
                        {#if c.year}<span class="yr">{c.year} · {c.event}</span>{/if}
                      </span>
                    {/if}
                  </span>
                </svelte:element>
              </li>
            {/each}
          </ol>
        </section>
      {/each}
    </div>
  </section>

  <!-- ───────────── Timeline strip ───────────── -->
  <section class="history-strip" aria-labelledby="time-h">
    <header class="sec-head">
      <p class="kicker">Three centuries on one trace</p>
      <h2 id="time-h">The history behind each chapter</h2>
    </header>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="strip-scroll" tabindex="0" role="region" aria-label="Timeline, scrollable">
      <ol class="strip">
        {#each strip as e (e.slug)}
          {#if e.gap > 40}<li class="brk" aria-hidden="true"><span>{e.gap} yrs</span></li>{/if}
          <li class="ev" class:ready={e.ready}>
            <span class="tp" aria-hidden="true"></span>
            <span class="y">{e.year}</span>
            <span class="e">{e.event}</span>
            {#if e.ready}
              <a class="c" href="{base}/chapters/{e.slug}/">Chapter {e.number}</a>
            {:else}
              <span class="c">Chapter {e.number}</span>
            {/if}
          </li>
        {/each}
      </ol>
    </div>
  </section>

  <!-- ───────────── Appendices ───────────── -->
  <section class="apps" aria-labelledby="app-h">
    <header class="sec-head">
      <p class="kicker">Appendices</p>
      <h2 id="app-h">Datasheets and reference</h2>
    </header>
    <ul class="app-grid">
      {#each APPENDICES as a (a.slug)}
        {@const ok = available.has(`appendix:${a.slug}`)}
        <li class:ready={ok}>
          <svelte:element this={ok ? 'a' : 'div'} class="app" href={ok ? `${base}/appendix/${a.slug}/` : undefined}>
            <span class="app-n">{a.number}</span>
            <span class="app-t">{a.title}{#if !ok}<span class="visually-hidden"> (planned)</span>{/if}</span>
            <span class="app-s">{a.summary}</span>
          </svelte:element>
        </li>
      {/each}
    </ul>
  </section>
</article>

<style>
  .home {
    --gutter: clamp(1rem, 4vw, 2.5rem);
    max-width: 76rem;
    margin: 0 auto;
    padding: 0 var(--gutter) 5rem;
  }
  section {
    min-width: 0;
  }

  /* ───────────── Hero ───────────── */
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
    gap: clamp(2rem, 5vw, 4.5rem);
    align-items: center;
    padding: clamp(2.5rem, 7vw, 5.5rem) 0 clamp(2.5rem, 6vw, 4.5rem);
  }
  .eyebrow {
    margin: 0 0 1.1rem;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--copper-ink);
  }
  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(3rem, 8.5vw, 5.6rem);
    line-height: 0.95;
    letter-spacing: -0.045em;
  }
  .subtitle {
    margin: 0.9rem 0 0;
    font-family: var(--font-display);
    font-weight: 400;
    font-size: clamp(1.25rem, 2.6vw, 1.7rem);
    line-height: 1.25;
    letter-spacing: -0.015em;
    color: var(--ink-2);
    text-wrap: balance;
  }
  .lede {
    margin: 1.4rem 0 0;
    max-width: 36rem;
    font-size: 1.1rem;
    line-height: 1.65;
    color: var(--ink-2);
    text-wrap: pretty;
  }
  .cta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-top: 1.8rem;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
    padding: 0.5rem 1.15rem;
    border-radius: 9px;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    font-family: var(--font-ui);
    font-size: 0.98rem;
    font-weight: 500;
    text-decoration: none;
    box-shadow: var(--shadow);
    transition: border-color 120ms, background-color 120ms, color 120ms;
  }
  .btn:hover {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
  }
  .btn.primary:hover {
    background: var(--accent-ink);
    border-color: var(--accent-ink);
    color: var(--on-accent);
  }
  .readouts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.75rem;
    margin: 2.2rem 0 0;
    padding-top: 1.1rem;
    border-top: 1px dashed var(--line-strong);
  }
  .readouts div {
    display: flex;
    flex-direction: column-reverse;
  }
  .readouts dt {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .readouts dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 500;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }

  /* The instrument: an oscilloscope above a 4-bit counter. */
  .instrument {
    --bezel: light-dark(#e6dfd1, #151e2b);
    position: relative;
    padding: 0.8rem 0.9rem 1rem;
    border-radius: 16px;
    background: linear-gradient(to bottom, color-mix(in srgb, var(--bezel) 60%, var(--panel)), var(--bezel));
    border: 1px solid var(--line-strong);
    box-shadow:
      inset 0 1px 0 light-dark(rgb(255 255 255 / 0.7), rgb(255 255 255 / 0.05)),
      var(--shadow-lg);
  }
  .bezel-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 0.2rem 0.6rem;
    font-family: var(--font-mono);
    font-size: 0.64rem;
    letter-spacing: 0.12em;
    color: var(--mute);
  }
  .run {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--phosphor-ink);
  }
  .run i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--phosphor);
    box-shadow: 0 0 6px var(--phosphor-glow);
  }
  .scope {
    position: relative;
    border-radius: 10px;
    overflow: hidden;
    background: radial-gradient(ellipse at 50% 45%, color-mix(in srgb, var(--scope-bg) 80%, #1b3a30), var(--scope-bg) 75%);
    box-shadow:
      inset 0 0 0 1px rgb(0 0 0 / 0.6),
      inset 0 0 30px rgb(0 0 0 / 0.55);
    aspect-ratio: 16 / 10;
  }
  .scope svg {
    display: block;
    width: 100%;
    height: calc(100% - 1.6rem);
  }
  .graticule line {
    stroke: var(--scope-grid);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    stroke-dasharray: 2 4;
  }
  .axes line {
    stroke: rgb(92 240 160 / 0.22);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .trace path {
    fill: none;
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
  }
  .ch1 path {
    stroke: var(--phosphor);
  }
  .ch2 path {
    stroke: var(--sig-high);
  }
  .ch1 .live {
    filter: drop-shadow(0 0 3px var(--phosphor-glow));
  }
  .ch2 .live {
    filter: drop-shadow(0 0 3px var(--sig-high-glow));
  }
  .persist {
    opacity: 0.28;
  }
  /* The beam sweeps left to right, 5 s a screen (one clock period a second, like the counter). */
  .live {
    animation: sweep 5s linear infinite;
  }
  @keyframes sweep {
    from {
      clip-path: inset(0 100% 0 0);
    }
    to {
      clip-path: inset(0 0 0 0);
    }
  }
  .lab {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
  }
  .lab.ch1 {
    fill: var(--phosphor);
  }
  .lab.ch2 {
    fill: var(--sig-high);
  }
  .readout {
    position: absolute;
    inset: auto 0 0 0;
    height: 1.6rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0 0.7rem;
    border-top: 1px solid rgb(92 240 160 / 0.12);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.04em;
    white-space: nowrap;
    overflow: hidden;
  }
  .c1 {
    color: var(--phosphor);
  }
  .c2 {
    color: var(--sig-high);
  }
  .tb {
    margin-left: auto;
    color: var(--fg);
    opacity: 0.7;
  }
  /* One animated integer drives both the LEDs and the readout, so they cannot drift apart. */
  .counter {
    --n: 11;
    animation: count 16s steps(16, end) infinite;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 0.9rem;
    padding: 0.7rem 0.9rem;
    border-radius: 10px;
    background: color-mix(in srgb, var(--bezel) 50%, var(--bg));
    border: 1px solid var(--line);
    box-shadow: inset 0 1px 3px light-dark(rgb(40 30 10 / 0.08), rgb(0 0 0 / 0.4));
  }
  .leds {
    display: flex;
    gap: clamp(0.8rem, 3vw, 1.4rem);
  }
  .led-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
  }
  .led {
    position: relative;
    width: 1.35rem;
    height: 1.35rem;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, light-dark(#9b8f79, #3a3226), light-dark(#5a4a32, #1d1812) 70%);
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.35);
  }
  .led i {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #fff3d6, #ffc15e 35%, #f08c00 75%);
    box-shadow:
      0 0 10px 2px rgb(255 178 62 / 0.6),
      0 0 24px 6px rgb(255 160 0 / 0.25);
    /* Bit b of the shared count --n (see .counter). */
    opacity: mod(round(down, calc(var(--n) / var(--w)), 1), 2);
  }
  .bit {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    color: var(--mute);
  }
  .count {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-family: var(--font-mono);
  }
  .count .k {
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    color: var(--mute);
  }
  @property --n {
    syntax: '<integer>';
    inherits: true;
    initial-value: 11;
  }
  .count .v {
    counter-reset: n var(--n);
    font-size: 1.6rem;
    font-weight: 500;
    line-height: 1.1;
    color: var(--sig-high);
    text-shadow: 0 0 10px var(--sig-high-glow);
    font-variant-numeric: tabular-nums;
  }
  .count .v::after {
    content: counter(n, decimal-leading-zero);
  }
  @keyframes count {
    from {
      --n: 0;
    }
    to {
      --n: 16;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .live,
    .counter {
      animation: none !important;
    }
  }

  /* ───────────── Section heads ───────────── */
  .sec-head {
    margin: 0 0 1.75rem;
    max-width: 44rem;
  }
  .kicker {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0 0 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--copper-ink);
  }
  .kicker::before {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--copper);
    flex: none;
  }
  .sec-head h2 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(1.6rem, 3.6vw, 2.3rem);
    line-height: 1.1;
    letter-spacing: -0.03em;
    text-wrap: balance;
  }

  /* ───────────── How it works ───────────── */
  .how {
    padding: 3.5rem 0 1rem;
    border-top: 1px solid var(--line);
  }
  .how-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
    gap: 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .how-grid li {
    padding: 1.15rem 1.2rem 1.2rem;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: color-mix(in srgb, var(--panel) 85%, transparent);
    box-shadow: var(--shadow);
  }
  .how-icon {
    display: inline-grid;
    place-items: center;
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 10px;
    color: var(--copper-ink);
    background: var(--copper-soft);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--copper) 25%, transparent);
  }
  .how-grid h3 {
    margin: 0.85rem 0 0.35rem;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 1.12rem;
    letter-spacing: -0.01em;
  }
  .how-grid p {
    margin: 0;
    font-size: 0.98rem;
    line-height: 1.55;
    color: var(--ink-2);
  }

  /* ───────────── The course map ───────────── */
  .map {
    padding: 4.5rem 0 1rem;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1.25rem;
    margin: 1rem 0 0;
    font-size: 0.84rem;
    color: var(--mute);
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }
  .legend .mono {
    font-size: 0.74rem;
  }
  .legend .pad {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 1.5px dashed var(--sig-z);
  }
  .legend .pad.on {
    border: 2px solid var(--copper);
    background: var(--copper-soft);
  }

  .board {
    --rail: 1.6rem;
    position: relative;
  }
  .part {
    display: grid;
    grid-template-columns: minmax(0, 20rem) minmax(0, 1fr);
    gap: 0 3rem;
    padding: 2rem 0;
    border-top: 1px dashed var(--line);
  }
  .part:first-child {
    border-top: 0;
    padding-top: 0.5rem;
  }
  .part-head {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    align-self: start;
    position: sticky;
    top: 5rem;
  }
  .ic {
    width: 4rem;
    height: 3rem;
    flex: none;
  }
  .ic-body {
    fill: light-dark(#22272e, #243044);
    stroke: light-dark(#11151a, #4a5b73);
  }
  .ic-pin {
    fill: light-dark(#c3c7cd, #7d8795);
  }
  .ic-notch {
    fill: light-dark(#161a1f, #172131);
  }
  .ic text {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 14px;
    fill: light-dark(#f0ebe1, #d7dee7);
    letter-spacing: 0.04em;
  }
  .part-label {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--copper-ink);
  }
  .part-label .ref {
    color: var(--mute);
    letter-spacing: 0.04em;
  }
  .part-head h3 {
    margin: 0.2rem 0 0.4rem;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 1.3rem;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }
  .blurb {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.55;
    color: var(--ink-2);
  }

  /* Chapters are test points on a copper trace. */
  .chapters {
    position: relative;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .chapters::before {
    content: '';
    position: absolute;
    left: calc(var(--rail) / 2 - 1px);
    top: 1.2rem;
    bottom: 1.2rem;
    width: 2px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--copper) 55%, var(--line));
  }
  .ch {
    position: relative;
    display: grid;
    grid-template-columns: var(--rail) 2.1rem minmax(0, 1fr);
    align-items: baseline;
    gap: 0 0.5rem;
    padding: 0.7rem 0.75rem 0.75rem 0;
    border-radius: 10px;
    color: var(--fg);
    text-decoration: none;
  }
  a.ch {
    transition: background-color 120ms;
  }
  a.ch:hover {
    background: color-mix(in srgb, var(--panel) 90%, transparent);
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .pad {
    justify-self: center;
    align-self: start;
    margin-top: 0.42rem;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--bg);
    border: 1.5px dashed var(--sig-z);
    position: relative;
    z-index: 1;
  }
  .ready .pad {
    border: 2.5px solid var(--copper);
    background: var(--bg);
  }
  a.ch:hover .pad {
    background: var(--sig-high);
    border-color: var(--sig-high);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--sig-high) 20%, transparent), 0 0 10px var(--sig-high-glow);
  }
  .num {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--copper-ink);
    font-variant-numeric: tabular-nums;
  }
  .ch-main {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }
  .ch-title {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 1.08rem;
    letter-spacing: -0.01em;
    line-height: 1.3;
  }
  .ch-sum {
    font-size: 0.94rem;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .ch-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.9rem;
    margin-top: 0.3rem;
    font-family: var(--font-ui);
    font-size: 0.78rem;
    color: var(--mute);
  }
  .flag {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--phosphor-ink);
  }
  .yr {
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }
  /* Planned chapters: dimmed, like an unpowered part. */
  li:not(.ready) .ch-title {
    color: color-mix(in srgb, var(--fg) 72%, var(--bg));
  }
  li:not(.ready) .num {
    color: var(--mute);
  }
  li:not(.ready) .ch-sum {
    color: var(--mute);
  }
  li:not(.ready) .flag {
    color: var(--mute);
  }

  /* ───────────── Timeline strip ───────────── */
  .history-strip {
    padding: 4.5rem 0 1rem;
    border-top: 1px solid var(--line);
  }
  .strip-scroll {
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x proximity;
    padding: 0 0 1rem;
    margin: 0 calc(-1 * var(--gutter));
    scrollbar-width: thin;
    scrollbar-color: var(--line-strong) transparent;
    mask-image: linear-gradient(90deg, transparent, #000 var(--gutter), #000 calc(100% - var(--gutter)), transparent);
  }
  .strip {
    position: relative;
    display: flex;
    width: max-content;
    margin: 0;
    padding: 0 var(--gutter);
    list-style: none;
  }
  .strip::before {
    content: '';
    position: absolute;
    left: var(--gutter);
    right: var(--gutter);
    top: 2.9rem;
    height: 2px;
    background: color-mix(in srgb, var(--copper) 55%, var(--line));
  }
  .ev {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 9.5rem;
    padding: 0 1rem 0 0;
    scroll-snap-align: start;
  }
  .ev .y {
    order: -1;
    height: 2.2rem;
    font-family: var(--font-mono);
    font-size: 1.35rem;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }
  .tp {
    width: 13px;
    height: 13px;
    margin: 0.1rem 0 0.8rem;
    border-radius: 50%;
    border: 2.5px solid var(--copper);
    background: var(--bg);
    position: relative;
    z-index: 1;
  }
  .ev.ready .tp {
    background: var(--sig-high);
    border-color: var(--sig-high);
  }
  .ev .e {
    font-family: var(--font-display);
    font-weight: 500;
    font-size: 0.98rem;
    line-height: 1.3;
  }
  .ev .c {
    margin-top: 0.3rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--mute);
  }
  .brk {
    position: relative;
    width: 3.5rem;
    flex: none;
    align-self: flex-start;
    margin-top: 2.35rem;
  }
  /* An axis break: the trace is cut and the gap labelled. */
  .brk::before {
    content: '';
    position: absolute;
    left: 1.2rem;
    top: -0.35rem;
    width: 0.9rem;
    height: 1.4rem;
    background: var(--bg);
    border-left: 1.5px solid var(--line-strong);
    border-right: 1.5px solid var(--line-strong);
    transform: skewX(-18deg);
    z-index: 1;
  }
  .brk span {
    position: absolute;
    top: 1.35rem;
    left: 0;
    width: 3.3rem;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--mute);
  }

  /* ───────────── Appendices ───────────── */
  .apps {
    padding: 4rem 0 0;
    border-top: 1px solid var(--line);
  }
  .app-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .app {
    display: grid;
    grid-template-columns: 2.2rem minmax(0, 1fr);
    gap: 0.1rem 0.6rem;
    height: 100%;
    padding: 0.9rem 1rem;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: color-mix(in srgb, var(--panel) 70%, transparent);
    color: var(--fg);
    text-decoration: none;
  }
  a.app:hover {
    border-color: var(--copper);
  }
  .app-n {
    grid-row: span 2;
    display: grid;
    place-items: center;
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 6px;
    border: 1px dashed var(--line-strong);
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--mute);
  }
  .ready .app-n {
    border: 1px solid var(--copper);
    color: var(--copper-ink);
  }
  .app-t {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 1rem;
  }
  .app-s {
    font-size: 0.86rem;
    line-height: 1.45;
    color: var(--mute);
  }

  /* ───────────── Responsive ───────────── */
  @media (max-width: 960px) {
    .hero {
      grid-template-columns: minmax(0, 1fr);
    }
    .instrument {
      max-width: 34rem;
    }
    .part {
      grid-template-columns: minmax(0, 1fr);
      gap: 1rem;
    }
    .part-head {
      position: static;
    }
  }
  @media (max-width: 560px) {
    .how-grid li {
      display: grid;
      grid-template-columns: 2.6rem minmax(0, 1fr);
      gap: 0.2rem 0.9rem;
      padding: 1rem;
    }
    .how-icon {
      grid-row: span 2;
    }
    .how-grid h3 {
      margin: 0.35rem 0 0.2rem;
    }
  }
  @media (max-width: 480px) {
    .readouts {
      gap: 0.5rem 1.25rem;
    }
    .readouts dd {
      font-size: 1.25rem;
    }
    .ch {
      grid-template-columns: var(--rail) 1.7rem minmax(0, 1fr);
      padding-right: 0.25rem;
    }
    .ic {
      width: 3.2rem;
    }
    .counter {
      padding: 0.6rem 0.7rem;
    }
    .led {
      width: 1.1rem;
      height: 1.1rem;
    }
    .readout .tb {
      display: none;
    }
  }
</style>
