<!--
  The Bench style guide: tokens, type, callouts and components in one page, for design review.
  Prerendered (see svelte.config.js prerender.entries) but not linked from the navigation.
-->
<script lang="ts">
  import Callout, { CALLOUT_KINDS } from '$lib/components/content/Callout.svelte';
  import History from '$lib/components/content/History.svelte';
  import Quiz from '$lib/components/content/Quiz.svelte';
  import Details from '$lib/components/content/Details.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { readSignals, onThemeChange, type Signals } from '$lib/theme/signals';

  const SURFACES = ['--bg', '--panel', '--pn', '--surface-3', '--line', '--line-strong', '--fg', '--ink-2', '--mute'];
  const ACCENTS = ['--copper', '--copper-ink', '--phosphor', '--phosphor-ink', '--ac', '--focus', '--ok', '--bad', '--maybe'];
  const SIGNALS = ['--sig-high', '--sig-low', '--sig-z', '--sig-x', '--sig-current', '--wire', '--volt-neg', '--volt-zero', '--volt-pos', '--silicon', '--silicon-metal', '--scope-bg'];
  const CALLOUT_HUES = ['--c-note', '--c-tip', '--c-warning', '--c-key', '--c-question', '--c-challenge', '--c-lab', '--c-programmer', '--c-hood', '--c-deeper', '--c-real', '--c-history'];
  const SERIES = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `--series-${i}`);
  const KINDS = ['note', 'tip', 'warning', 'key', 'question', 'challenge', 'lab', 'programmer', 'hood', 'deeper', 'real'];
  const SAMPLE: Record<string, string> = {
    note: 'A relay’s contacts bounce for a few milliseconds when they close; the simulator models it only when you ask.',
    tip: 'Hold <kbd>Shift</kbd> while dragging a wire to keep it straight.',
    warning: 'Never connect an LED straight across a supply: without a resistor the current is limited only by the battery.',
    key: 'Gain restores a degraded signal at every stage. That is why digital works.',
    question: 'If the two switches are in parallel, what does the lamp compute?',
    challenge: 'Build XOR from four NAND gates, using as few wires as you can.',
    lab: 'Measure the time constant of the RC circuit with the oscilloscope’s cursors.',
    programmer: 'Combinational logic is a pure function: the same inputs always give the same outputs, and nothing is remembered.',
    hood: 'The analog engine solves the circuit with modified nodal analysis: one linear system per time step.',
    deeper: 'The capacitor voltage obeys <em>RC</em>·d<em>v</em>/d<em>t</em> + <em>v</em> = <em>V</em><sub>s</sub>, so <em>v</em>(<em>t</em>) = <em>V</em><sub>s</sub>(1 − e<sup>−<em>t</em>/<em>RC</em></sup>).',
    real: 'Wire four DIP switches to a 74HC283 and read the sum on four LEDs.',
  };

  let slider = $state(2.5);
  let logSlider = $state(1000);
  let on = $state(true);
  let off = $state(false);
  let level = $state<'logic' | 'switch' | 'analog'>('logic');
  let lastRun = $state('');
  let sig = $state<Signals | undefined>();
  let canvas = $state<HTMLCanvasElement | undefined>();
  let root = $state<HTMLElement | undefined>();

  // History cards announce "Run the original" with a bubbling CustomEvent.
  $effect(() => {
    if (!root) return;
    const on = (e: Event) => (lastRun = (e as CustomEvent<{ title: string }>).detail.title);
    root.addEventListener('run-original', on);
    return () => root?.removeEventListener('run-original', on);
  });

  const quiz = {
    question: 'Two switches in <strong>series</strong> control a lamp. When is the lamp on?',
    options: [
      { text: 'When either switch is closed', correct: false, why: 'That is two switches in parallel: OR.' },
      { text: 'When both switches are closed', correct: true, why: 'Current needs a path through both: series is AND.' },
      { text: 'When exactly one switch is closed', correct: false, why: 'That is the staircase circuit: XOR.' },
    ],
  };

  function drawScope() {
    if (!canvas || !sig) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = sig.scopeBg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = sig.scopeGrid;
    for (let x = 0; x <= w; x += w / 10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += h / 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = sig.phosphor;
    ctx.shadowColor = sig.phosphorGlow;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const t = (x / w) * 3;
      const v = 1 - Math.exp(-((t % 1.5) < 0.75 ? (t % 1.5) : 0) * 4);
      const y = h * 0.8 - v * h * 0.6;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  onMount(() => {
    sig = readSignals(canvas);
    drawScope();
    return onThemeChange(() => {
      sig = readSignals(canvas);
      drawScope();
    });
  });
</script>

<svelte:head>
  <title>Style guide — The Bench</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<article class="article sg" bind:this={root}>
  <header class="sg-head">
    <p class="eyebrow">Design system</p>
    <h1>The Bench</h1>
    <p class="summary">
      A lab notebook by day, the lab at night. Warm paper with an engineering grid, ink and copper; a blue-black room with phosphor
      traces. Signal colours mean the same thing everywhere.
    </p>
    <p class="ui sg-links"><a href="{base}/styleguide/chapter/">A sample chapter page</a> · <a href="{base}/">The home page</a></p>
  </header>

  <!-- ─────────── Palette ─────────── -->
  <h2 id="palette">Palette</h2>
  <p>Every token is written once as <code>light-dark(light, dark)</code>. The two panels below force a colour scheme, so both themes are visible side by side.</p>
  <div class="wide themes">
    {#each ['light', 'dark'] as scheme (scheme)}
      <div class="scheme grid-paper" style:color-scheme={scheme}>
        <p class="scheme-name">{scheme === 'light' ? 'Light · lab notebook' : 'Dark · lab at night'}</p>
        {#each [['Paper and ink', SURFACES], ['Accents and feedback', ACCENTS], ['Signals', SIGNALS], ['Callouts', CALLOUT_HUES], ['Chart series', SERIES]] as [name, list] (name)}
          <p class="group">{name}</p>
          <div class="swatches">
            {#each list as t (t)}
              <div class="sw"><span class="chip" style:background="var({t})"></span><code>{t}</code></div>
            {/each}
          </div>
        {/each}
      </div>
    {/each}
  </div>

  <!-- ─────────── Signals ─────────── -->
  <h2 id="signals">Signals on wires</h2>
  <p>
    HIGH is warm amber and thicker, LOW is slate, a floating net (Z) is dashed grey, an unknown or contended net (X) is red and flickers
    (static under reduced motion). Colour is never the only cue. SVG uses <code>class="wire sig-high"</code>; Canvas reads the same tokens
    through <code>readSignals()</code> in <code>$lib/theme/signals</code>.
  </p>
  <div class="wide themes">
    {#each ['light', 'dark'] as scheme (scheme)}
      <div class="scheme wires grid-paper" style:color-scheme={scheme}>
        <svg viewBox="0 0 320 214" role="img" aria-label="Sample wires in the {scheme} theme: high, low, floating, unknown, unpowered, and a net coloured by voltage">
          {#each [['sig-high', 'HIGH', '1'], ['sig-low', 'LOW', '0'], ['sig-z', 'Z', 'z'], ['sig-x', 'X', 'x'], ['', 'wire', '—']] as [cls, label, v], i (label)}
            <text x="6" y={26 + i * 34} class="wlabel">{label}</text>
            <path class="wire {cls}" d="M60 {22 + i * 34}H150V{12 + i * 34}H250" />
            <circle cx="60" cy={22 + i * 34} r="3.5" class="node" />
            <text x="262" y={26 + i * 34} class="wval {cls}">{v}</text>
          {/each}
          <defs>
            <linearGradient id="volt-{scheme}" x1="0" x2="1">
              <stop offset="0" stop-color="var(--volt-neg)" />
              <stop offset="0.5" stop-color="var(--volt-zero)" />
              <stop offset="1" stop-color="var(--volt-pos)" />
            </linearGradient>
          </defs>
          <rect x="60" y="186" width="190" height="8" rx="4" fill="url(#volt-{scheme})" />
          <text x="6" y="194" class="wlabel">volts</text>
          <text x="60" y="210" class="tick">−5 V</text>
          <text x="155" y="210" class="tick" text-anchor="middle">0</text>
          <text x="250" y="210" class="tick" text-anchor="end">+5 V</text>
          {#each [0, 1, 2, 3, 4] as k (k)}
            <circle cx={170 + k * 16} cy="22" r="2.2" class="dotc" style:animation-delay="{-k * 0.2}s" />
          {/each}
        </svg>
      </div>
    {/each}
  </div>
  <p>
    In running text: <span class="lv hi">1</span> <span class="lv lo">0</span> <span class="lv z">Z</span> <span class="lv x">X</span>
    (<code>&lt;span class="lv hi"&gt;</code>). Current is drawn as moving dots in <code>--sig-current</code> (the dots on the HIGH wire above).
  </p>
  <figure class="canvas-demo wide">
    <div class="screen"><canvas bind:this={canvas} width="640" height="180" aria-label="A Canvas scope trace drawn with colours from readSignals()"></canvas></div>
    <figcaption class="ui">Canvas, coloured by <code>readSignals(canvas)</code>; the canvas sits in a <code>.screen</code>, so it gets the dark values in both themes. Current values: <code>high {sig?.high ?? '…'}</code>, <code>phosphor {sig?.phosphor ?? '…'}</code>.</figcaption>
  </figure>

  <!-- ─────────── Type ─────────── -->
  <h2 id="type">Typography</h2>
  <p>
    <strong>Space Grotesk</strong> for display and interface: a grotesque drawn from a monospace, so it sits naturally beside the
    readouts. <strong>Literata</strong> for reading: a sturdy text face with optical sizes, made for long stretches on screens.
    <strong>JetBrains Mono</strong> for values, pins and code.
  </p>
  <div class="type-scale">
    <p class="t-display">Digital Circuits</p>
    <p class="t-h1">Chapter title, 3.2 rem</p>
    <p class="t-h2">Section heading, 1.85 rem</p>
    <p class="t-h3">Subsection heading, 1.25 rem</p>
    <p class="t-body">Body text in Literata at 18 px. A transistor is a switch that another switch can flip — and, crucially, an amplifier: <em>a small signal controls a large one</em>.</p>
    <p class="t-ui">Interface text in Space Grotesk · Open on the bench · Reset · 0.86 rem</p>
    <p class="t-mono">V<sub>OUT</sub> = 4.98 V · 74HC00 · pin 14 · 0x3F · 1011₂</p>
    <p class="t-label label-caps">Instrument label · CH1 · 500 ms/div</p>
  </div>

  <h3>Prose</h3>
  <p>A paragraph with a <a href="#type">link</a>, some <code>inline code</code>, and <strong>strong</strong> text. Lists use copper pads for bullets and mono numerals:</p>
  <ul>
    <li>series is AND;</li>
    <li>parallel is OR;</li>
    <li>the staircase light is XOR.</li>
  </ul>
  <ol>
    <li>Set the supply to 5 V.</li>
    <li>Close the switch and read the meter.</li>
  </ol>
  <table>
    <thead><tr><th>A</th><th>B</th><th>A NAND B</th></tr></thead>
    <tbody>
      <tr><td>0</td><td>0</td><td>1</td></tr>
      <tr><td>0</td><td>1</td><td>1</td></tr>
      <tr><td>1</td><td>0</td><td>1</td></tr>
      <tr><td>1</td><td>1</td><td>0</td></tr>
    </tbody>
  </table>
  <figure class="code-block" data-lang="dcl">
    <figcaption>half_adder.dcl</figcaption>
    <pre><code><span style:color="var(--code-keyword)">module</span> <span style:color="var(--code-type)">HalfAdder</span>(<span style:color="var(--code-prop)">a</span>: <span style:color="var(--code-type)">bit</span>, <span style:color="var(--code-prop)">b</span>: <span style:color="var(--code-type)">bit</span>) -&gt; (<span style:color="var(--code-prop)">sum</span>: <span style:color="var(--code-type)">bit</span>, <span style:color="var(--code-prop)">carry</span>: <span style:color="var(--code-type)">bit</span>) {'{'}
  <span style:color="var(--code-comment)">// XOR for the sum, AND for the carry</span>
  sum   = a ^ b
  carry = a &amp; b
{'}'}</code></pre>
  </figure>
  <blockquote>“The switching circuits may be represented by equations.” — a block quotation.</blockquote>

  <!-- ─────────── Callouts ─────────── -->
  <h2 id="callouts">Callouts</h2>
  {#each KINDS as k (k)}
    <Callout kind={k} title={k === 'real' ? 'A 4-bit adder on a breadboard' : k === 'hood' ? 'How the solver steps' : undefined} parts={k === 'real' ? '74HC283, 74HC04, 4 × LED, 330 Ω, DIP switch' : undefined}>
      <p>{@html SAMPLE[k]}</p>
      {#if k === 'hood'}
        <figure class="code-block"><pre><code><span style:color="var(--code-keyword)">for</span> (<span style:color="var(--code-keyword)">let</span> t = <span style:color="var(--code-number)">0</span>; t &lt; tEnd; t += dt) solve(G, I)</code></pre></figure>
      {/if}
    </Callout>
  {/each}
  <p class="kinds-note ui">Also available from the shared shell: {Object.keys(CALLOUT_KINDS).filter((k) => !KINDS.includes(k)).join(', ')}.</p>

  <!-- ─────────── History ─────────── -->
  <h2 id="history">History card</h2>
  <p>Press <em>Read the story</em> to flip it (a crossfade with reduced motion). <em>Run the original</em> dispatches a <code>run-original</code> event{#if lastRun}: last received “{lastRun}”{/if}.</p>
  <History year={1937} title="Shannon’s master’s thesis" people="Claude Shannon, MIT" source="Source: C. E. Shannon, ‘A Symbolic Analysis of Relay and Switching Circuits’, 1938." run="Run Shannon’s circuit">
    {#snippet hook()}<p>A 21-year-old student noticed that the relay circuits in telephone exchanges obey Boole’s algebra.</p>{/snippet}
    <p>
      Shannon had spent a summer at Bell Labs and knew the tangle of relays that routed calls. Back at MIT, where he tended Vannevar Bush’s
      differential analyser, he realised that series contacts behave like AND and parallel contacts like OR, so a circuit could be designed
      on paper, simplified with algebra, and only then wired.
    </p>
    <p>The thesis turned circuit design from a craft into a calculation — and it is exactly what this chapter’s switches do.</p>
  </History>

  <!-- ─────────── Quiz ─────────── -->
  <h2 id="quiz">Quiz</h2>
  <Quiz data={quiz} />

  <!-- ─────────── Widget frame ─────────── -->
  <h2 id="widget">Widget frame</h2>
  <Widget title="A switch, a battery and a lamp" n="1.1" subtitle="Close the switch and watch the current flow." caption="The lamp lights when the circuit is closed: current flows from the battery’s + terminal round to its − terminal." onreset={() => (on = false)} fullscreen grid>
    {#snippet actions()}
      <button class="w-action"><Icon name="bench" size={14} /> Open on the bench</button>
    {/snippet}
    {#snippet controls()}
      <Toggle bind:checked={on} label="Switch closed" />
      <Segmented options={[{ value: 'logic', label: 'Logic' }, { value: 'switch', label: 'Switches' }, { value: 'analog', label: 'Analog' }]} bind:value={level} label="Abstraction level" size="sm" />
      <Slider bind:value={slider} min={0} max={5} step={0.1} label="Supply" format={(v) => `${v.toFixed(1)} V`} />
    {/snippet}
    <svg class="demo-circuit" viewBox="0 0 360 150" role="img" aria-label="Battery, switch and lamp; the switch is {on ? 'closed' : 'open'}">
      <path class="wire {on ? 'sig-high' : 'sig-low'}" d="M60 40H150" />
      <path class="wire {on ? 'sig-high' : 'sig-low'}" d="M210 40H300V70" />
      <path class="wire sig-low" d="M300 110V130H60V100" />
      <path class="wire {on ? 'sig-high' : 'sig-low'}" d="M60 40V70" />
      <!-- battery -->
      <line x1="44" y1="72" x2="76" y2="72" class="sym" /><line x1="52" y1="82" x2="68" y2="82" class="sym thick" /><line x1="44" y1="92" x2="76" y2="92" class="sym" /><line x1="52" y1="100" x2="68" y2="100" class="sym thick" />
      <!-- switch -->
      <circle cx="150" cy="40" r="3.5" class="node" /><circle cx="210" cy="40" r="3.5" class="node" />
      <line x1="150" y1="40" x2={on ? 210 : 203} y2={on ? 40 : 14} class="wire {on ? 'sig-high' : 'sig-low'}" />
      <!-- lamp -->
      <circle cx="300" cy="90" r="20" class="lamp" class:lit={on} /><path d="M286 76l28 28M314 76l-28 28" class="sym" />
      <text x="150" y="70" class="lbl">S1</text><text x="84" y="90" class="lbl">{slider.toFixed(1)} V</text><text x="328" y="94" class="lbl">L1</text>
    </svg>
    <p class="readout-line">Level: <strong>{level}</strong> · switch {on ? 'closed' : 'open'} · supply {slider.toFixed(1)} V</p>
  </Widget>

  <!-- ─────────── Controls ─────────── -->
  <h2 id="controls">Controls</h2>
  <div class="controls-demo ui">
    <div class="row">
      <Button variant="primary"><Icon name="play" size={14} /> Run</Button>
      <Button>Step</Button>
      <Button variant="ghost"><Icon name="reset" size={14} /> Reset</Button>
      <Button size="sm">Small</Button>
      <Button disabled>Disabled</Button>
    </div>
    <div class="row">
      <Segmented options={[{ value: 'logic', label: 'Logic' }, { value: 'switch', label: 'Switches' }, { value: 'analog', label: 'Analog' }]} bind:value={level} label="Abstraction level" />
    </div>
    <div class="row">
      <Toggle bind:checked={on} label="Switch S1 (on)" />
      <Toggle bind:checked={off} label="Sound" />
      <Toggle checked={false} disabled label="Disabled" />
    </div>
    <div class="row sliders">
      <Slider bind:value={slider} min={0} max={5} step={0.1} label="Supply voltage" format={(v) => `${v.toFixed(1)} V`} />
      <Slider bind:value={logSlider} min={10} max={100000} log label="Resistance" format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} kΩ` : `${v.toFixed(0)} Ω`)} />
    </div>
  </div>

  <h3>Details</h3>
  <Details title="Why does the water analogy break?">
    <p>Water in a pipe needs to flow all the way round before anything happens; the field in a wire is set up at nearly the speed of light.</p>
  </Details>
</article>

<style>
  .sg {
    padding-bottom: 5rem;
  }
  .sg-head {
    padding: 3.25rem 0 1.5rem;
  }
  .eyebrow {
    margin: 0 0 0.6rem;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--copper-ink);
  }
  h1 {
    margin: 0 0 0.8rem;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(2.3rem, 6vw, 3.4rem);
    letter-spacing: -0.035em;
    line-height: 1;
  }
  .sg-links {
    font-size: 0.9rem;
  }
  .summary {
    font-size: 1.2rem;
    color: var(--ink-2);
  }
  .themes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    gap: 1rem;
    margin: 1rem 0 1.5rem;
  }
  .scheme {
    padding: 1rem 1.1rem 1.1rem;
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    color: var(--fg);
    min-width: 0;
  }
  .scheme-name {
    margin: 0 0 0.5rem !important;
    font-family: var(--font-display);
    font-weight: 600;
  }
  .group {
    margin: 0.9rem 0 0.35rem !important;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8.2rem, 1fr));
    gap: 0.35rem 0.6rem;
  }
  .sw {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
  }
  .sw .chip {
    width: 1.35rem;
    height: 1.35rem;
    border-radius: 5px;
    box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.35);
    flex: none;
  }
  .sw code {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--ink-2);
    background: none !important;
    border: 0 !important;
    padding: 0 !important;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .wires svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .wlabel,
  .tick {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--mute);
  }
  .wval {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    fill: var(--wire);
  }
  .wval.sig-high {
    fill: var(--sig-high);
  }
  .wval.sig-low {
    fill: var(--sig-low);
  }
  .wval.sig-z {
    fill: var(--sig-z);
  }
  .wval.sig-x {
    fill: var(--sig-x);
  }
  .node {
    fill: var(--wire);
  }
  .dotc {
    fill: var(--sig-current);
    animation: flow 1s linear infinite;
  }
  @keyframes flow {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(16px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dotc {
      animation: none;
    }
  }
  .canvas-demo {
    margin: 1rem 0 2rem;
  }
  .canvas-demo canvas {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 10px;
    border: 1px solid var(--line-strong);
  }
  .canvas-demo figcaption {
    margin-top: 0.5rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .type-scale {
    display: grid;
    gap: 0.6rem;
    padding: 1.1rem 1.25rem;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--panel);
  }
  .type-scale p {
    margin: 0 !important;
  }
  .t-display {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(2.6rem, 7vw, 4.2rem);
    letter-spacing: -0.045em;
    line-height: 1;
  }
  .t-h1 {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: clamp(1.9rem, 5vw, 3.2rem);
    letter-spacing: -0.032em;
    line-height: 1.05;
  }
  .t-h2 {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 1.85rem;
    letter-spacing: -0.02em;
  }
  .t-h3 {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 1.25rem;
  }
  .t-ui {
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .t-mono {
    font-family: var(--font-mono);
    font-size: 0.92rem;
  }
  .t-label {
    color: var(--mute);
  }
  .kinds-note {
    font-size: 0.86rem;
    color: var(--mute);
  }
  .demo-circuit {
    display: block;
    width: 100%;
    max-width: 30rem;
    height: auto;
    margin: 0 auto;
  }
  .sym {
    stroke: var(--wire);
    stroke-width: 2;
    stroke-linecap: round;
    fill: none;
  }
  .sym.thick {
    stroke-width: 4;
  }
  .lamp {
    fill: var(--panel);
    stroke: var(--wire);
    stroke-width: 2;
    transition: fill 200ms;
  }
  .lamp.lit {
    fill: color-mix(in srgb, var(--sig-high) 45%, var(--panel));
    filter: drop-shadow(0 0 10px var(--sig-high-glow));
  }
  .lbl {
    font-family: var(--font-mono);
    font-size: 11px;
    fill: var(--mute);
  }
  .readout-line {
    margin: 0.5rem 0 0;
    font-size: 0.84rem;
    color: var(--ink-2);
    text-align: center;
  }
  .controls-demo {
    display: grid;
    gap: 1.1rem;
    padding: 1.2rem 1.25rem;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--panel);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1.25rem;
  }
  .sliders > :global(*) {
    flex: 1 1 14rem;
  }
</style>
