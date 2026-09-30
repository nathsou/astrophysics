<!--
  Figure 32.5: three ways to guess a branch, on five patterns of outcomes, with the two-bit counter's four states drawn
  as the state machine of Chapter 19.

    ::branch-predictor{n="32.5" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { KINDS, NAMES, PATTERNS, cpi, simulate } from './predictor';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let pid = $state('loop8');
  let upto = $state(16);
  let depth = $state(15);
  const uid = $props.id();

  const pattern = $derived(PATTERNS.find((p) => p.id === pid)!);
  const runs = $derived(KINDS.map((k) => simulate(k, pattern.outcomes)));
  const seen = $derived(runs.map((r) => ({ kind: r.kind, misses: r.hits.slice(0, upto).filter((h) => !h).length, run: r })));
  const two = $derived(runs[2]!);
  const stateNow = $derived(upto < pattern.outcomes.length ? two.states[upto]! : undefined);
  const STATES = ['strongly not taken', 'weakly not taken', 'weakly taken', 'strongly taken'];

  // State diagram: four boxes in a row; taken arrows above, not-taken arrows below.
  const bx = (s: number) => 50 + s * 90;
</script>

<Widget {n} title="Guessing a branch" subtitle="A state machine inside the CPU" kind="Interactive" {caption} onreset={() => ((pid = 'loop8'), (upto = 16), (depth = 15))}>
  {#snippet controls()}
    <Segmented label="Pattern of branch outcomes" value={pid} onchange={(v) => (pid = v)} options={PATTERNS.map((p) => ({ value: p.id, label: p.label, title: p.what }))} size="sm" />
    <Slider label="Branches executed" bind:value={upto} min={0} max={pattern.outcomes.length} step={1} format={(v) => `${v}`} />
    <Slider label="Pipeline depth (cost of a wrong guess, in cycles)" bind:value={depth} min={3} max={25} step={1} format={(v) => `${v}`} />
  {/snippet}

  <div class="bp">
    <p class="what ui">{pattern.what}</p>

    <div class="rows ui" role="table" aria-label="Outcomes and guesses">
      <div class="row head" role="row">
        <span class="lab" role="rowheader">Outcome</span>
        <span class="cells" role="cell">
          {#each pattern.outcomes as t, i (i)}<span class="c o" class:future={i >= upto} class:now={i === upto - 1} title="branch {i + 1}: {t ? 'taken' : 'not taken'}">{t ? 'T' : 'N'}</span>{/each}
        </span>
        <span class="tot"></span>
      </div>
      {#each seen as s (s.kind)}
        <div class="row" role="row">
          <span class="lab" role="rowheader">{NAMES[s.kind]}</span>
          <span class="cells" role="cell">
            {#each s.run.guesses as g, i (i)}
              <span class="c" class:hit={s.run.hits[i]} class:miss={!s.run.hits[i]} class:future={i >= upto} title="branch {i + 1}: guessed {g ? 'taken' : 'not taken'}, {s.run.hits[i] ? 'right' : 'wrong'}">{g ? 'T' : 'N'}</span>
            {/each}
          </span>
          <span class="tot"><strong>{s.misses}</strong> wrong{#if upto > 0}, {Math.round((100 * s.misses) / upto)} %{/if}</span>
        </div>
      {/each}
    </div>
    <p class="key ui"><span class="c hit">T</span> right guess <span class="c miss">N</span> wrong guess: a wrong guess throws away the instructions fetched since the branch.</p>

    <div class="lower">
      <svg viewBox="-16 0 404 140" role="img" aria-label="The two-bit counter: four states in a row. A taken branch moves one state to the right and a not-taken branch one to the left, stopping at the ends. The two states on the right guess taken.{stateNow !== undefined ? ` Now in state ${stateNow}: ${STATES[stateNow]}.` : ''}">
        <defs>
          <marker id="arr-{uid}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="var(--ink-2)" /></marker>
        </defs>
        {#each [0, 1, 2, 3] as s (s)}
          <g class="st" class:now={stateNow === s} class:guess={s >= 2}>
            <rect x={bx(s) - 32} y="52" width="64" height="40" rx="7" />
            <text x={bx(s)} y="69" text-anchor="middle" class="sn">{s.toString(2).padStart(2, '0')}</text>
            <text x={bx(s)} y="84" text-anchor="middle" class="sg">guess {s >= 2 ? 'T' : 'N'}</text>
          </g>
        {/each}
        {#each [0, 1, 2] as s (s)}
          <path class="ar" d="M{bx(s) + 12} 51 Q{bx(s) + 45} 14 {bx(s + 1) - 12} 50" marker-end="url(#arr-{uid})" />
          <path class="ar" d="M{bx(s + 1) - 12} 93 Q{bx(s) + 45} 130 {bx(s) + 12} 94" marker-end="url(#arr-{uid})" />
        {/each}
        <path class="ar" d="M{bx(3) + 32} 62 C{bx(3) + 66} 40 {bx(3) + 66} 78 {bx(3) + 33} 76" marker-end="url(#arr-{uid})" />
        <path class="ar" d="M{bx(0) - 32} 82 C{bx(0) - 66} 104 {bx(0) - 66} 66 {bx(0) - 33} 68" marker-end="url(#arr-{uid})" />
        <text x={(bx(1) + bx(2)) / 2} y="20" text-anchor="middle" class="al">taken →</text>
        <text x={(bx(1) + bx(2)) / 2} y="138" text-anchor="middle" class="al">← not taken</text>
      </svg>

      <table class="ui">
        <caption>Cycles per instruction, if one instruction in five is a branch and a wrong guess costs {depth} cycles</caption>
        <thead><tr><th>Predictor</th><th>Wrong</th><th>CPI</th></tr></thead>
        <tbody>
          {#each runs as r (r.kind)}
            <tr><td>{NAMES[r.kind]}</td><td>{Math.round((100 * r.misses) / pattern.outcomes.length)} %</td><td class="num">{cpi(r.misses / pattern.outcomes.length, depth).toFixed(2)}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</Widget>

<style>
  .bp {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .what {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .rows {
    display: grid;
    gap: 0.35rem;
    min-width: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 6.6rem minmax(0, 1fr) 6.2rem;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.78rem;
  }
  .lab {
    font-weight: 600;
    color: var(--ink-2);
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(48, minmax(0, 1fr));
    gap: 1px;
    min-width: 0;
  }
  .c {
    display: inline-grid;
    place-items: center;
    min-width: 0;
    height: 1.35rem;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    border-radius: 2px;
    background: var(--pn);
    color: var(--ink-2);
  }
  .c.o {
    background: var(--line);
    color: var(--fg);
  }
  .c.hit {
    background: var(--ok-soft);
    color: var(--ok);
  }
  .c.miss {
    background: var(--bad-soft);
    color: var(--bad);
    font-weight: 700;
    box-shadow: inset 0 0 0 1px var(--bad);
  }
  .c.future {
    opacity: 0.28;
  }
  .c.now {
    box-shadow: inset 0 0 0 2px var(--copper);
  }
  .tot {
    text-align: right;
    font-size: 0.74rem;
    color: var(--ink-2);
  }
  .key {
    margin: 0;
    font-size: 0.76rem;
    color: var(--mute);
  }
  .key .c {
    width: 1.3rem;
    display: inline-grid;
    vertical-align: middle;
  }
  .lower {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
  }
  svg {
    width: 100%;
    height: auto;
    font-family: var(--font-ui);
  }
  .st rect {
    fill: var(--panel);
    stroke: var(--line-strong);
    stroke-width: 1.4;
  }
  .st.guess rect {
    stroke: var(--sig-high);
  }
  .st.now rect {
    fill: var(--copper-soft);
    stroke: var(--copper);
    stroke-width: 2.6;
  }
  .sn {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
    fill: var(--fg);
  }
  .sg {
    font-size: 9.5px;
    fill: var(--ink-2);
  }
  .ar {
    fill: none;
    stroke: var(--ink-2);
    stroke-width: 1.3;
  }
  .al {
    font-size: 10px;
    fill: var(--mute);
  }
  table {
    border-collapse: collapse;
    font-size: 0.8rem;
    width: 100%;
  }
  caption {
    caption-side: top;
    text-align: left;
    font-size: 0.74rem;
    color: var(--mute);
    padding-bottom: 0.3rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.2rem 0.4rem;
    border-bottom: 1px solid var(--line);
  }
  .num {
    font-family: var(--font-mono);
    font-weight: 600;
  }
  @media (max-width: 40rem) {
    .lower {
      grid-template-columns: minmax(0, 1fr);
    }
    .row {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.15rem;
    }
    .tot {
      text-align: left;
    }
    .cells {
      grid-template-columns: repeat(24, minmax(0, 1fr));
      gap: 2px;
    }
  }
</style>
