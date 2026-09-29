<!--
  The Quine–McCluskey stepper. Enter a function (or pick an example) and step through the algorithm: the
  minterms grouped by their number of 1s, the merges round by round, the prime implicants, the prime
  implicant chart, essential primes, dominance, the cyclic core and Petrick's method. The frames come
  from the trace of quineMcCluskey (qmsteps.ts).

    ::qm-stepper{n="12.2" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { prefersReducedMotion } from '$lib/theme/signals';
  import { EXAMPLES, labels, parseList, run, termOf } from './qmsteps';
  import { tokensOf } from './kmap';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  let vars = $state(4);
  let onText = $state('4, 8, 10, 11, 12, 15');
  let dcText = $state('9, 14');
  let exampleId = $state<string | null>('textbook');
  let index = $state(0);
  let playing = $state(false);
  let reveal = $state(Infinity);
  let reduced = $state(false);
  let root: HTMLDivElement | undefined = $state();
  let hover = $state<number | null>(null);

  const parsed = $derived.by(() => {
    const a = parseList(onText, vars);
    const b = parseList(dcText, vars);
    if (!a.ok) return { error: `Minterms: ${a.why}` };
    if (!b.ok) return { error: `Don’t-cares: ${b.why}` };
    const overlap = a.list.filter((m) => b.list.includes(m));
    if (overlap.length) return { error: `Minterm ${overlap[0]} is in both lists.` };
    if (a.list.length + b.list.length > 40) return { error: 'That is a lot of minterms for a figure; try fewer than 40.' };
    return { on: a.list, dc: b.list };
  });
  const result = $derived('on' in parsed ? run(vars, parsed.on!, parsed.dc!) : null);
  const frames = $derived(result?.frames ?? []);
  const frame = $derived(frames[Math.min(index, Math.max(0, frames.length - 1))]);
  const trace = $derived(result?.q.trace);
  const L = $derived(trace ? labels(trace) : new Map<number, string>());
  const lab = (id: number) => L.get(id) ?? '';

  onMount(() => {
    reduced = prefersReducedMotion();
    if (!root) return;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(root);
    const timer = setInterval(() => {
      if (playing && visible && !document.hidden) {
        if (index + 1 >= frames.length) playing = false;
        else index++;
      }
    }, 2600);
    return () => {
      clearInterval(timer);
      io.disconnect();
    };
  });

  // The merges of a round appear one after another when the reader arrives at that step.
  let revealTimer: ReturnType<typeof setInterval> | undefined;
  $effect(() => {
    const f = frame;
    clearInterval(revealTimer);
    if (!f || f.phase !== 'merge' || f.mergeRound === undefined || reduced || !trace) {
      reveal = Infinity;
      return;
    }
    const total = trace.rounds[f.mergeRound]!.merges.length;
    reveal = 0;
    revealTimer = setInterval(() => {
      reveal++;
      if (reveal >= total) clearInterval(revealTimer);
    }, Math.max(60, Math.min(220, 1600 / Math.max(1, total))));
    return () => clearInterval(revealTimer);
  });

  function load(id: string) {
    const e = EXAMPLES.find((x) => x.id === id)!;
    exampleId = id;
    vars = e.n;
    onText = e.on.join(', ');
    dcText = e.dc.join(', ');
    index = 0;
    playing = false;
  }
  function setVars(k: number) {
    exampleId = null;
    vars = k;
    index = 0;
  }
  function edited() {
    exampleId = null;
    index = 0;
    playing = false;
  }
  const go = (i: number) => {
    index = Math.max(0, Math.min(frames.length - 1, i));
  };

  /** Ids of the merges of the visible round that are revealed so far. */
  const shownMerges = $derived.by(() => {
    if (!trace || !frame) return { results: new Set<number>(), sources: new Set<number>() };
    const results = new Set<number>();
    const sources = new Set<number>();
    trace.rounds.forEach((r, ri) => {
      const visibleRound = ri + 1 < frame.rounds;
      if (!visibleRound) return;
      const inFlight = frame.phase === 'merge' && frame.mergeRound === ri;
      r.merges.forEach((m, k) => {
        if (inFlight && k >= reveal) return;
        results.add(m.result);
        sources.add(m.a);
        sources.add(m.b);
      });
    });
    return { results, sources };
  });

  /** Merges related to the implicant under the pointer, for highlighting. */
  const related = $derived.by(() => {
    const s = new Set<number>();
    if (hover === null || !trace) return s;
    s.add(hover);
    for (const r of trace.rounds)
      for (const m of r.merges) {
        if (m.result === hover) {
          s.add(m.a);
          s.add(m.b);
        }
        if (m.a === hover || m.b === hover) s.add(m.result);
      }
    return s;
  });

  const isPrime = (id: number) => !!trace && !!frame?.primes && trace.primes.includes(id);
  const covers = (p: number, m: number) => !!trace && trace.implicants[p]!.minterms.includes(m);
  const bin = (m: number) => m.toString(2).padStart(vars, '0');
  const cs = $derived(frame?.chartState);
  const rowClass = (p: number) => ({
    sel: !!cs?.selected.includes(p),
    gone: !!cs?.removedRows.includes(p),
    act: !!frame?.active.rows.includes(p),
  });
  const colClass = (m: number) => ({ gone: !!cs?.removedCols.includes(m), act: !!frame?.active.cols.includes(m) });
  const md = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const answer = $derived(trace ? tokensOf(trace.solution.map((id) => trace!.implicants[id]!.pattern), 'sop', trace.names) : []);
</script>

<Widget title="Quine–McCluskey, step by step" n={fig} {caption} onreset={() => load('textbook')}>
  {#snippet controls()}
    <Segmented size="sm" label="Examples" value={exampleId ?? ''} onchange={load} options={EXAMPLES.map((e) => ({ value: e.id, label: e.label }))} />
    <Segmented size="sm" label="Number of variables" value={vars} onchange={setVars} options={[3, 4, 5].map((k) => ({ value: k, label: `${k} variables` }))} />
  {/snippet}

  <div class="qm ui" bind:this={root}>
    <div class="entry">
      <label>
        <span>Must be 1 (minterms)</span>
        <input type="text" bind:value={onText} oninput={edited} spellcheck="false" autocomplete="off" inputmode="numeric" aria-label="Minterms that must be 1, separated by commas" />
      </label>
      <label>
        <span>Don’t-cares</span>
        <input type="text" bind:value={dcText} oninput={edited} spellcheck="false" autocomplete="off" inputmode="numeric" aria-label="Don’t-care minterms, separated by commas" />
      </label>
    </div>
    {#if 'error' in parsed}
      <p class="err" role="alert">{parsed.error}</p>
    {/if}

    {#if trace && frame}
      <div class="player" role="group" aria-label="Step controls">
        <Button size="sm" onclick={() => go(index - 1)} disabled={index === 0} aria-label="Previous step">◀</Button>
        <Button size="sm" onclick={() => (playing = !playing)} aria-pressed={playing}>{playing ? 'Pause' : 'Play'}</Button>
        <Button size="sm" onclick={() => go(index + 1)} disabled={index >= frames.length - 1} aria-label="Next step">▶</Button>
        <input type="range" min="0" max={frames.length - 1} step="1" value={index} oninput={(e) => go(Number(e.currentTarget.value))} aria-label="Step" aria-valuetext="Step {index + 1} of {frames.length}: {frame.title}" />
        <span class="count">{index + 1} / {frames.length}</span>
      </div>

      <div class="say" role="status">
        <h5>{frame.title}</h5>
        <p>{@html md(frame.text)}</p>
      </div>

      <div class="cols" aria-label="Implicants by round">
        {#each Array.from({ length: frame.rounds }, (_, i) => i) as ri (ri)}
          {@const round = trace.rounds[ri]!}
          <div class="col">
            <div class="ch">{ri === 0 ? 'Minterms' : `Round ${ri}`}</div>
            {#each round.groups as g (g.ones)}
              <div class="grp">
                <div class="gh">{ri === 0 ? `${g.ones} one${g.ones === 1 ? '' : 's'}` : ''}</div>
                {#each g.ids as id (id)}
                  {@const im = trace.implicants[id]!}
                  {@const arrived = ri === 0 || shownMerges.results.has(id) || !(frame.phase === 'merge' && frame.mergeRound === ri - 1)}
                  <button
                    type="button"
                    class="imp"
                    class:dcOnly={im.onlyDontCares}
                    class:merged={shownMerges.sources.has(id)}
                    class:prime={isPrime(id)}
                    class:rel={related.has(id)}
                    class:hide={!arrived}
                    onpointerenter={() => (hover = id)}
                    onpointerleave={() => (hover = null)}
                    onfocus={() => (hover = id)}
                    onblur={() => (hover = null)}
                    aria-label="{im.pattern}, covers {im.minterms.join(', ')}{shownMerges.sources.has(id) ? ', merged' : ''}{isPrime(id) ? `, prime implicant ${lab(id)}` : ''}"
                  >
                    <span class="pat">{im.pattern}</span>
                    <span class="mts">({im.minterms.join(',')})</span>
                    <span class="mark">{#if shownMerges.sources.has(id)}✓{:else if isPrime(id)}<b>{lab(id)}</b>{/if}</span>
                  </button>
                {/each}
              </div>
            {/each}
          </div>
        {/each}
      </div>

      {#if frame.chart}
        <div class="chart-wrap">
          <table class="chart" aria-label="Prime implicant chart">
            <thead>
              <tr>
                <th class="corner">prime</th>
                {#each trace.chart.cols as m (m)}
                  <th class="mt" class:gone={colClass(m).gone} class:act={colClass(m).act}>{m}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each trace.chart.rows as p (p)}
                {@const rc = rowClass(p)}
                <tr class:sel={rc.sel} class:gone={rc.gone} class:act={rc.act}>
                  <th class="rowh"><b>{lab(p)}</b> <span class="pat">{trace.implicants[p]!.pattern}</span> <span class="term">{termOf(trace, p)}</span></th>
                  {#each trace.chart.cols as m (m)}
                    {@const cc = colClass(m)}
                    <td class:gone={cc.gone} class:act={cc.act && (rc.act || frame.phase === 'essential' || frame.phase === 'column-dominance')}>{covers(p, m) ? '●' : ''}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      {#if trace.petrick && frame.petrick >= 0}
        {@const pet = trace.petrick}
        <div class="pet">
          <div class="ph">Petrick’s product</div>
          <div class="sums">
            {#each pet.sums as s (s.minterm)}<span class="sum" class:cur={frame.active.cols.includes(s.minterm) && frame.phase === 'petrick-multiply'}>({s.primes.map(lab).join(' + ')})</span>{/each}
          </div>
          {#each pet.steps.slice(0, frame.petrick) as step, i (i)}
            <div class="pstep">
              <span class="k">× column {step.minterm}</span>
              <span class="v">{step.count} product{step.count === 1 ? '' : 's'}{#if step.products && step.products.length <= 10}: {step.products.map((p) => p.map(lab).join('·')).join(' + ')}{/if}</span>
            </div>
          {/each}
        </div>
      {/if}

      {#if frame.result}
        <div class="res">
          <span class="lhs">f =</span>
          {#each answer as t, i (i)}{#if t.t === 'lit'}<span class="lit" class:neg={t.neg}>{t.name}</span>{:else}<span class="op">{t.text}</span>{/if}{/each}
        </div>
      {/if}
    {/if}
  </div>
</Widget>

<style>
  .qm {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .entry {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem;
  }
  @media (max-width: 36rem) {
    .entry {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  label {
    display: grid;
    gap: 0.2rem;
  }
  label span {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  input[type='text'] {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    min-width: 0;
  }
  input:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .err {
    margin: 0;
    padding: 0.4rem 0.7rem;
    border-radius: 6px;
    background: var(--bad-soft);
    color: var(--bad);
    font-size: 0.84rem;
  }
  .player {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .player input[type='range'] {
    flex: 1 1 8rem;
    min-width: 6rem;
    accent-color: var(--copper);
  }
  .count {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--mute);
  }
  .say {
    background: var(--pn);
    border: 1px solid var(--line);
    border-left: 3px solid var(--copper);
    border-radius: 6px;
    padding: 0.55rem 0.8rem;
  }
  .say h5 {
    margin: 0 0 0.25rem;
    font-size: 0.95rem;
    font-family: var(--font-display);
  }
  .say p {
    margin: 0;
    font-size: 0.86rem;
    line-height: 1.55;
    color: var(--ink-2);
  }
  .cols {
    display: flex;
    gap: 0.6rem;
    overflow-x: auto;
    padding-bottom: 0.3rem;
    align-items: flex-start;
  }
  .col {
    flex: none;
    min-width: 8.2rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--panel);
    padding: 0.3rem 0.4rem 0.4rem;
  }
  .ch {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
    padding: 0.1rem 0 0.25rem;
  }
  .grp + .grp {
    border-top: 1px dashed var(--line);
    margin-top: 0.2rem;
    padding-top: 0.2rem;
  }
  .gh {
    font-size: 0.64rem;
    color: var(--mute);
    min-height: 0.5rem;
  }
  .imp {
    display: grid;
    grid-template-columns: auto 1fr 1.8rem;
    gap: 0.4rem;
    align-items: baseline;
    width: 100%;
    border: 0;
    background: none;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.12rem 0.25rem;
    border-radius: 4px;
    color: var(--fg);
    text-align: left;
    cursor: default;
    transition: opacity 160ms, background-color 120ms;
  }
  .imp .pat {
    font-weight: 700;
    letter-spacing: 0.1em;
  }
  .imp .mts {
    color: var(--mute);
    font-size: 0.72rem;
  }
  .imp .mark {
    text-align: right;
    color: var(--ok);
  }
  .imp .mark b {
    color: var(--copper-ink);
  }
  .imp.merged {
    color: var(--mute);
  }
  .imp.prime {
    background: var(--copper-soft);
  }
  .imp.rel {
    background: var(--term-hl);
  }
  .imp.dcOnly .pat {
    font-style: italic;
    font-weight: 500;
  }
  .imp.hide {
    opacity: 0;
  }
  .chart-wrap {
    overflow-x: auto;
  }
  table.chart {
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    text-align: center;
  }
  .chart th,
  .chart td {
    border: 1px solid var(--line);
    padding: 0.2rem 0.45rem;
    transition: background-color 150ms, opacity 150ms;
  }
  .chart th.corner {
    color: var(--mute);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: var(--pn);
  }
  .chart th.mt {
    background: var(--pn);
    color: var(--ink-2);
  }
  .chart .rowh {
    text-align: left;
    white-space: nowrap;
    background: var(--pn);
    font-weight: 500;
  }
  .chart .rowh .pat {
    letter-spacing: 0.1em;
    margin: 0 0.3rem;
  }
  .chart .rowh .term {
    color: var(--mute);
  }
  .chart td {
    color: var(--sig-high);
  }
  .chart .gone {
    opacity: 0.35;
    text-decoration: line-through;
  }
  .chart tr.gone .rowh,
  .chart tr.gone td {
    opacity: 0.35;
  }
  .chart tr.sel .rowh {
    background: var(--copper-soft);
    box-shadow: inset 3px 0 0 var(--copper);
  }
  .chart tr.act td,
  .chart tr.act .rowh {
    background: color-mix(in srgb, var(--sig-high) 14%, var(--panel));
  }
  .chart th.act,
  .chart td.act {
    background: color-mix(in srgb, var(--sig-high) 24%, var(--panel));
    box-shadow: inset 0 0 0 1px var(--sig-high);
  }
  .pet {
    display: grid;
    gap: 0.3rem;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.5rem 0.7rem;
    background: var(--panel);
    overflow-x: auto;
  }
  .ph {
    font-family: var(--font-ui);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  .sums {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.4rem;
  }
  .sum.cur {
    background: var(--term-hl-strong);
    border-radius: 3px;
  }
  .pstep {
    display: flex;
    gap: 0.7rem;
  }
  .pstep .k {
    flex: none;
    color: var(--mute);
    min-width: 6.5rem;
  }
  .res {
    font-family: var(--font-mono);
    font-size: 1.05rem;
    background: var(--ok-soft);
    border: 1px solid var(--ok);
    border-radius: 6px;
    padding: 0.5rem 0.8rem;
    overflow-x: auto;
    white-space: pre;
  }
  .lhs {
    color: var(--mute);
    margin-right: 0.5rem;
  }
  .lit {
    font-weight: 600;
  }
  .lit.neg {
    text-decoration: overline;
    text-decoration-thickness: 1.5px;
  }
  .op {
    color: var(--mute);
  }
  @media (prefers-reduced-motion: reduce) {
    .imp,
    .chart th,
    .chart td {
      transition: none;
    }
  }
</style>
