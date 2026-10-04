<!--
  The IC3 stepper: IC3 runs on a small system (in a Web Worker) and records every event. Each state the variables
  can describe is a dot; its colour is the smallest frame that contains it (F0 = the initial states, then F1, F2, …,
  each containing the last), so the frames show as nested regions. Bad states are marked, reachable states ringed,
  and the states of the current event's cube outlined. Beside the dots: the clauses of each frame and the stack of
  proof obligations. At the end, the invariant and its certificate.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { runInduction } from '$lib/components/induction/client';
  import type { InductionEvent, ShownSnapshot, StateDot } from '$lib/fv/ic3/worker';
  import type { Trace } from '$lib/fv/engines';

  let { code, title, caption }: { code: string; title?: string; caption?: string } = $props();

  let error = $state('');
  let log = $state.raw<ShownSnapshot[]>([]);
  let states = $state.raw<StateDot[] | undefined>();
  let result = $state.raw<Extract<InductionEvent, { kind: 'ic3' }> | undefined>();
  let cert = $state<'idle' | 'checking' | 'checked' | 'stopped' | 'failed'>('idle');
  let at = $state(0);

  onMount(() => {
    // svelte-ignore state_referenced_locally
    const cancel = runInduction({ engine: 'ic3', source: code, timeout: 20000, certifyBudget: 60000, states: true }, (e) => {
      if (e.kind === 'error') error = e.message;
      else if (e.kind === 'ic3') {
        result = e;
        log = e.log;
        states = e.states;
        at = 0;
        if (e.status === 'proved') cert = 'checking';
      } else if (e.kind === 'certified') cert = e.checked ? 'checked' : e.stopped ? 'stopped' : 'failed';
    });
    return cancel;
  });

  const snap = $derived(log[at]);
  const last = $derived(at === log.length - 1);
  const N = $derived(snap ? snap.frames.length - 1 : 0);
  // Fixed positions: order the dots by the levels at the end of the run, so that the final frames are contiguous.
  const order = $derived.by(() => {
    if (!states || !log.length) return [];
    const fin = log.at(-1)!.levels ?? [];
    return states.map((_, i) => i).sort((a, b) => (fin[a] ?? 0) - (fin[b] ?? 0) || Number(states![b]!.reachable) - Number(states![a]!.reachable) || a - b);
  });
  const focus = $derived(new Set(snap?.focus ?? []));
  const cols = $derived(states ? Math.min(25, Math.ceil(Math.sqrt(states.length * 2.2))) : 1);
  const R = 9;
  const GAP = 24;
  const shade = (lv: number) => (lv === 0 ? 'var(--ink-blue)' : lv > N ? 'transparent' : `color-mix(in srgb, var(--seal) ${Math.round(85 - (60 * (lv - 1)) / Math.max(1, N - 1))}%, var(--panel))`);
  const describeState = (s: StateDot) => s.values.map((v) => `${v.kind === 'pc' ? v.name.replace(/\.pc$/, '') + ' at' : v.name} ${v.kind === 'pc' ? v.value : '= ' + v.value}`).join(', ');
  const traceText = (t: Trace) => t.steps.map((s, i) => `${i ? `→ ${s.label}: ` : ''}${s.state.values.map((v) => `${v.kind === 'pc' ? v.name.replace(/\.pc$/, '') + ' at ' + v.value : v.name + ' = ' + v.value}`).join(', ')}`);
</script>

<figure class="ic">
  {#if title}<h4 class="ui ttl">{title}</h4>{/if}
  {#if error}<p class="err ui">{error}</p>{/if}
  {#if !log.length && !error}<p class="ui wait">Running IC3…</p>{/if}
  {#if snap}
    <div class="bar ui">
      <button type="button" onclick={() => (at = Math.max(0, at - 1))} disabled={at === 0}>← Back</button>
      <button type="button" class="go" onclick={() => (at = Math.min(log.length - 1, at + 1))} disabled={last}>Next event →</button>
      <input type="range" min="0" max={log.length - 1} bind:value={at} aria-label="Event" />
      <span class="pos">event {at + 1} of {log.length}</span>
    </div>
    <p class="ev ui">{snap.event}</p>
    <div class="cols">
      <div class="space">
        {#if states}
          <svg viewBox="0 0 {cols * GAP + 8} {Math.ceil(states.length / cols) * GAP + 8}" style="max-width: {Math.max(220, (cols * GAP + 8) * 1.4)}px" role="img" aria-label="The state space, coloured by frame">
            {#each order as idx, j (idx)}
              {@const s = states[idx]!}
              {@const lv = snap.levels?.[idx] ?? N + 1}
              {@const cx = 4 + GAP / 2 + (j % cols) * GAP}
              {@const cy = 4 + GAP / 2 + Math.floor(j / cols) * GAP}
              <g>
                <title>{describeState(s)}{s.bad ? ' (bad)' : ''}{s.reachable ? ' (reachable)' : ' (unreachable)'}; {lv === 0 ? 'initial' : lv > N ? 'in no frame' : `in F${lv} and later frames`}</title>
                {#if focus.has(idx)}<circle {cx} {cy} r={R + 3.5} class="focus" />{/if}
                <circle {cx} {cy} r={R} class="dot" class:out={lv > N} style="fill: {shade(lv)}" />
                {#if s.reachable}<circle {cx} {cy} r={R - 3.5} class="reach" />{/if}
                {#if s.bad}<path d="M{cx - 4} {cy - 4} L{cx + 4} {cy + 4} M{cx + 4} {cy - 4} L{cx - 4} {cy + 4}" class="bad" />{/if}
              </g>
            {/each}
          </svg>
          <ul class="legend ui">
            <li><span class="sw" style="background: var(--ink-blue)"></span>initial (F0)</li>
            <li><span class="sw" style="background: color-mix(in srgb, var(--seal) 85%, var(--panel))"></span>in F1</li>
            <li><span class="sw" style="background: color-mix(in srgb, var(--seal) 30%, var(--panel))"></span>in a later frame only</li>
            <li><span class="sw out"></span>in no frame</li>
            <li><span class="sw ring"></span>reachable</li>
            <li><span class="x">✕</span>bad</li>
            <li><span class="sw foc"></span>the event's cube</li>
          </ul>
        {:else}
          <p class="ui wait">Too many states to draw.</p>
        {/if}
      </div>
      <div class="side">
        <p class="sub ui">Clauses, by the highest frame where they hold</p>
        <ol class="frames">
          {#each snap.frames.slice(1) as cs, i (i)}
            <li><span class="lvl ui">F{i + 1}</span>
              {#if cs.length}{#each cs as c (c)}<code class="cl">¬({c})</code>{/each}{:else}<span class="none ui">no clauses of its own</span>{/if}
            </li>
          {/each}
        </ol>
        <p class="sub ui">Proof obligations</p>
        {#if snap.obligations.length}
          <ol class="obl">
            {#each [...snap.obligations].reverse() as o, i (i)}<li><span class="lvl ui">level {o.level}</span> <code>{o.cube}</code></li>{/each}
          </ol>
        {:else}<p class="none ui">none</p>{/if}
      </div>
    </div>
    {#if last && result}
      <div class="final ui" class:ok={result.status === 'proved'} class:bad={result.status === 'violated'}>
        {#if result.status === 'proved'}
          <p><b>✓ Proved.</b> The inductive invariant IC3 found ({result.invariant?.length} clause{result.invariant?.length === 1 ? '' : 's'}, after {result.frames} frames):</p>
          <ul>{#each result.invariant ?? [] as c (c)}<li><code>{c}</code></li>{/each}</ul>
          <p class="certst">{cert === 'checking' ? 'Checking the certificate: initiation, consecution and implication, three DRAT proofs…' : cert === 'checked' ? 'Certificate checked: the invariant holds initially, is preserved by every step, and implies the property.' : cert === 'stopped' ? 'The certificate check ran out of time.' : cert === 'failed' ? 'The certificate was rejected.' : ''}</p>
        {:else if result.status === 'violated'}
          <p><b>✗ Violated</b>: {result.violated}. {result.replayed ? 'The run below was replayed by the interpreter.' : 'The run could not be replayed.'}</p>
          {#if result.trace}<ol class="trace">{#each traceText(result.trace) as l, i (i)}<li><code>{l}</code></li>{/each}</ol>{/if}
        {:else}
          <p>IC3 did not finish in time.</p>
        {/if}
        <p class="stats">{result.stats.queries?.toLocaleString('en-GB')} SAT queries, {result.stats.obligations} proof obligations, {result.stats.ms} ms.</p>
      </div>
    {/if}
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .ic {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .ttl {
    margin: 0 0 0.6rem;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
  }
  .bar input {
    flex: 1 1 8rem;
    accent-color: var(--ink-blue);
  }
  button {
    font-family: var(--font-ui);
    font-size: 0.82rem;
    padding: 0.22rem 0.65rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .go {
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .pos {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .ev {
    margin: 0.6rem 0;
    min-height: 2.6em;
    font-size: 0.86rem;
    font-weight: 600;
  }
  .wait {
    color: var(--mute);
    font-size: 0.85rem;
  }
  .err {
    color: var(--pencil);
    font-size: 0.85rem;
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 0.9rem;
  }
  @media (max-width: 860px) {
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  svg {
    display: block;
    width: 100%;
    max-width: 560px;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  .dot {
    stroke: var(--line-strong);
    stroke-width: 1;
    transition: fill 0.2s;
  }
  .dot.out {
    stroke-dasharray: 2 2;
  }
  .reach {
    fill: none;
    stroke: var(--panel);
    stroke-width: 1.6;
  }
  .bad {
    stroke: var(--pencil);
    stroke-width: 2.2;
  }
  .focus {
    fill: none;
    stroke: var(--gold);
    stroke-width: 2.5;
  }
  .legend {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.8rem;
    margin: 0.4rem 0 0;
    padding: 0;
    font-size: 0.72rem;
    color: var(--ink-2);
  }
  .legend li {
    display: flex;
    gap: 0.3rem;
    align-items: center;
  }
  .sw {
    display: inline-block;
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
  }
  .sw.out {
    border-style: dashed;
  }
  .sw.ring {
    background: var(--seal);
    box-shadow: inset 0 0 0 2px var(--panel), inset 0 0 0 4px var(--seal);
  }
  .sw.foc {
    border: 2.5px solid var(--gold);
  }
  .x {
    color: var(--pencil);
    font-weight: 700;
  }
  .sub {
    margin: 0 0 0.25rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .frames,
  .obl,
  .trace {
    list-style: none;
    margin: 0 0 0.7rem;
    padding: 0;
    display: grid;
    gap: 0.25rem;
  }
  .frames li,
  .obl li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: baseline;
  }
  .lvl {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--ink-blue);
    min-width: 2rem;
  }
  .ic code {
    all: unset;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    overflow-wrap: anywhere;
  }
  .ic code.cl {
    padding: 0 0.3rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
  }
  .none {
    font-size: 0.75rem;
    color: var(--mute);
  }
  .final {
    margin-top: 0.8rem;
    padding: 0.5rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    font-size: 0.84rem;
  }
  .final.ok {
    border-color: var(--seal);
  }
  .final.ok b {
    color: var(--seal);
  }
  .final.bad {
    border-color: var(--pencil);
  }
  .final.bad b {
    color: var(--pencil);
  }
  .final p {
    margin: 0.2rem 0;
  }
  .final ul {
    margin: 0.2rem 0;
    padding-left: 1.2rem;
  }
  .certst,
  .stats {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  @media (prefers-reduced-motion: reduce) {
    .dot {
      transition: none;
    }
  }
</style>
