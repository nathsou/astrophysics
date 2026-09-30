<!--
  A ```route block: the logic cells and pads of a vFPGA-S are placed for you; connect the nets by choosing what drives
  each routing multiplexer. Work from a sink back to its source: pick a net's sink in the list, choose one of the
  inputs of its multiplexer (each is labelled with the signal it carries right now), and carry on along the wire
  you chose until you reach the source. The chip view shows the same configuration, and clicking a pin on it (zoom
  in to a tile) selects the same multiplexer.

  Check traces every sink back through the multiplexers: a sink that reaches nothing is open, one that reaches another
  net's source is shorted to it. A legal routing is then simulated on the fabric, for every input combination.

    id: ch28/route-and-or
    fabric: { pads: { P0: in, … P8: out }, cells: [{ at: [1, 1, 0], lut: "I0 & I1" }, …] }
    nets: [{ name: a, from: P0, to: ["LC(1,1,0).I0"] }, …]
    outputs: { P8: "P0 & P1 | P2 & P3" }
    solution: [["P0", "LC(1,1,0).I0"], …]

  See route/model.ts for the fields and the checker.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Icon from '../ui/Icon.svelte';
  import Mismatch from './parts/Mismatch.svelte';
  import Verdict from './parts/Verdict.svelte';
  import './parts/exercise.css';
  import '$lib/studio/studio.css';
  import FpgaChip from '$lib/studio/chips/vfpga/FpgaChip.svelte';
  import { FpgaSession } from '$lib/studio/fpga/session.svelte';
  import { lutExpression } from '$lib/studio/fpga/lut';
  import { progress } from '$lib/state/progress.svelte';
  import { device as makeDevice, lockedIntact, lutOf, nodeLabel, nodeOf, traceDriver } from './fabric';
  import { checkRoute, netStatus, solutionBits, startBits, type RouteInput, type RouteOutcome } from './route/model';

  let { spec }: { spec: RouteInput } = $props();

  const dev = makeDevice();
  const start = untrack(() => startBits(spec));
  const session = new FpgaSession({});
  session.setMode('hand');
  session.hand.goal = null;
  session.hand.check = null;
  session.hand.loadBits(start);
  const hm = session.hand;

  // The reader's own undo history of routing edits (the session's would also undo the loading of the start).
  let history = $state.raw<Uint8Array[]>([start.slice()]);
  let at = $state(0);
  let ignore = false;
  let notice = $state('');
  let outcome = $state.raw<RouteOutcome | null>(null);
  let showSolution = $state(false);
  let stale = $state(false);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const bits = $derived(hm.bits);
  const status = $derived(netStatus(spec, bits));
  const done = $derived(status.filter((n) => n.done).length);
  /** The sink (net, sink index) the reader is working on, as a node. */
  let work = $state<{ net: number; sink: number } | null>(null);

  onMount(() => {
    progress.load();
    const saved = progress.draft<number[] | null>(spec.id, null);
    if (saved && saved.length === start.length) {
      const b = Uint8Array.from(saved);
      if (lockedIntact(dev, b, start)) {
        history = [start.slice(), b];
        at = 1;
        ignore = true;
        hm.loadBits(b);
      }
    }
    return () => {
      clearTimeout(saveTimer);
      session.destroy();
    };
  });

  $effect(() => {
    const b = hm.bits;
    untrack(() => {
      if (ignore) {
        ignore = false;
        return;
      }
      if (!lockedIntact(dev, b, start)) {
        // A click on the chip view toggled a bit of a cell: they are placed for you.
        notice = 'The cells and pads are placed for you: only the routing is yours.';
        ignore = true;
        hm.loadBits(history[at]!);
        return;
      }
      if (b.some((v, i) => v !== history[at]![i])) {
        history = [...history.slice(0, at + 1), b.slice()];
        at = history.length - 1;
        notice = '';
        stale = true;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => progress.saveDraft(spec.id, [...b]), 400);
      }
    });
  });

  function go(target: number) {
    if (target < 0 || target >= history.length) return;
    at = target;
    ignore = true;
    hm.loadBits(history[at]!);
    stale = true;
  }
  function again() {
    history = [start.slice()];
    at = 0;
    ignore = true;
    hm.loadBits(start);
    hm.node = null;
    work = null;
    outcome = null;
    progress.saveDraft(spec.id, null);
  }
  function check() {
    outcome = checkRoute(spec, hm.bits);
    stale = false;
    if (outcome.pass) progress.markSolved(spec.id);
  }

  // ── The multiplexer under the selection ────────────────────────────────────────────
  const node = $derived(hm.node);
  const choices = $derived(node === null ? [] : (void hm.tick, hm.hand.muxChoices(node)));
  const carries = (n: number): string => {
    const t = traceDriver(dev, bits, n);
    if (t.loop) return 'a loop';
    if (t.source < 0) return 'nothing yet';
    const net = spec.nets.find((x) => nodeOf(dev, x.from, 'source') === t.source);
    return net ? `net ${net.name} (${nodeLabel(dev, t.source)})` : nodeLabel(dev, t.source);
  };
  /** A wire named for people: `W(1,3,S,1,0)` is the wire that starts in tile (1, 3) and runs south. */
  function describe(n: number): string {
    const name = dev.nodeName(n);
    const w = /^W\((\d+),(\d+),([ENWS]),(\d+),(\d+)\)$/.exec(name);
    if (w) return `wire from tile (${w[1]}, ${w[2]}) going ${({ E: 'east', N: 'north', W: 'west', S: 'south' } as Record<string, string>)[w[3]!]}, track ${w[5]}`;
    return nodeLabel(dev, n);
  }
  const wanted = $derived(work ? spec.nets[work.net]! : null);
  function chooseSink(ni: number, si: number) {
    work = { net: ni, sink: si };
    hm.node = nodeOf(dev, spec.nets[ni]!.to[si]!, 'sink');
  }
  function choose(from: number) {
    if (node === null) return;
    const n = node;
    hm.edit((h) => h.select(n, from));
    // Carry on along the wire just chosen, until the signal the net needs is reached.
    if (from >= 0 && dev.cfgOffset[from]! >= 0) {
      const t = traceDriver(dev, hm.bits, from);
      const src = wanted ? nodeOf(dev, wanted.from, 'source') : -1;
      if (t.source !== src) hm.node = from;
    }
  }
  const nodeTitle = $derived(node === null ? '' : describe(node));
  const cells = $derived((spec.fabric.cells ?? []).map((c) => ({ name: `LC(${c.at.join(',')})`, fn: lutExpression(lutOf(c)) })));
  const stateMark = { ok: '✓', open: '○', short: '✗', loop: '✗' } as const;
  const stateWord = { ok: 'connected', open: 'not connected', short: 'shorted', loop: 'loop' } as const;
</script>

<ExerciseFrame id={spec.id} kind="Route" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []}>
  <div class="route">
    <div class="top">
      <div class="chipbox">
        <div class="studio" style="height: 100%">
          <FpgaChip {session} compact handEdits />
        </div>
      </div>

      <div class="panel ui">
        <section aria-label="Nets to route">
          <h5>Nets <span class="count num">{done} of {status.length} routed</span></h5>
          <ul class="nets">
            {#each status as n, ni (n.name)}
              <li>
                <span class="nn"><strong>{n.name}</strong> from <code>{n.from}</code></span>
                <ul>
                  {#each n.sinks as s, si (s.sink)}
                    <li>
                      <button type="button" class="sink" class:sel={work?.net === ni && work?.sink === si} onclick={() => chooseSink(ni, si)} aria-pressed={work?.net === ni && work?.sink === si}>
                        <span class="mark {s.state}" aria-hidden="true">{stateMark[s.state]}</span>
                        <code>{s.sink}</code>
                        <span class="st">{stateWord[s.state]}{#if s.state === 'short'}: {s.drivenBy}{/if}</span>
                      </button>
                    </li>
                  {/each}
                </ul>
              </li>
            {/each}
          </ul>
          <details class="cells">
            <summary>The cells that are placed</summary>
            <ul>{#each cells as c (c.name)}<li><code>{c.name}</code> = <code>{c.fn}</code></li>{/each}</ul>
          </details>
        </section>

        <section aria-label="The multiplexer you are setting" class="mux">
          <h5>{node === null ? 'Choose a sink' : `What drives ${nodeTitle}?`}</h5>
          {#if node === null}
            <p class="ex-note">Press a sink in the list, or zoom the chip in to a tile (Ctrl and the wheel, or the buttons) and click a pin. Then choose, below, the input its multiplexer should read.</p>
          {:else if !choices.length}
            <p class="ex-note">{nodeTitle} is a source: nothing drives it. Pick another sink.</p>
          {:else}
            {#if wanted}<p class="ex-note">Net <strong>{wanted.name}</strong> needs the signal of <code>{wanted.from}</code>.</p>{/if}
            <!-- Rebuilt after every edit: a radio the reader clicked must show what the bits now say, not what was clicked. -->
            {#key hm.tick}
            <ul class="choices" role="radiogroup" aria-label="Inputs of the multiplexer">
              <li>
                <label><input type="radio" name="mux" checked={!choices.some((c) => c.selected)} onchange={() => choose(-1)} /> <span>nothing</span></label>
              </li>
              {#each choices as c (c.node)}
                <li>
                  <label class:on={c.selected}>
                    <input type="radio" name="mux" checked={c.selected} onchange={() => choose(c.node)} />
                    <span class="cn">{describe(c.node)}</span>
                    <span class="carry ex-note">carries {carries(c.node)}</span>
                  </label>
                </li>
              {/each}
            </ul>
            {/key}
          {/if}
        </section>
      </div>
    </div>

    <div class="ex-bar ui">
      <button type="button" class="check" onclick={check}><Icon name="check" size={15} /> Check the routing</button>
      <button type="button" onclick={() => go(at - 1)} disabled={at === 0}>Undo</button>
      <button type="button" onclick={() => go(at + 1)} disabled={at >= history.length - 1}>Redo</button>
      <button type="button" onclick={again} disabled={history.length === 1}><Icon name="reset" size={13} /> Start again</button>
    </div>
    {#if notice}<p class="ex-bad" role="status">{notice}</p>{/if}

    <div class="out ui">
      {#if outcome}
        <Verdict ok={outcome.pass}>
          {#if outcome.pass}Every sink is reached, no two nets share a wire{outcome.functionOk ? ', and the fabric computes the function' : ''}.{:else if !outcome.legal}The routing is not legal yet.{:else}Legal routing, but the function is wrong.{/if}
          {#if stale}<span class="ex-note"> (you have changed it since)</span>{/if}
        </Verdict>
        {#each outcome.problems as p (p)}<p class="ex-bad">{p}</p>{/each}
        {#if outcome.rows.length}<Mismatch rows={outcome.rows} caption="Pad levels the simulated fabric gave, against what the design should do" />{/if}
        {#if outcome.pass && spec.explain}<div class="ex-explain">{@html spec.explain}</div>{/if}
      {/if}
    </div>

    {#if spec.solution}
      <div class="ex-solution ui">
        <button
          type="button"
          onclick={() => {
            showSolution = !showSolution;
          }}
          aria-expanded={showSolution}><Icon name="eye" size={14} /> {showSolution ? 'Hide the solution' : 'Show a solution'}</button
        >
        {#if showSolution}
          <p class="ex-note">One routing that works, as routes from a source to a sink:</p>
          <pre class="ex-code">{spec.solution.map(([a, b]) => `${a}  →  ${b}`).join('\n')}</pre>
          <div class="ex-bar">
            <button
              type="button"
              onclick={() => {
                const b = solutionBits(spec);
                history = [...history.slice(0, at + 1), b];
                at = history.length - 1;
                ignore = true;
                hm.loadBits(b);
              }}>Load it onto the chip</button
            >
          </div>
        {/if}
      </div>
    {/if}
  </div>
</ExerciseFrame>

<style>
  .route {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
  }
  .top {
    display: grid;
    gap: 0.7rem;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
  }
  @media (min-width: 900px) {
    .top {
      grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
      align-items: start;
    }
  }
  .chipbox {
    height: 24rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    overflow: hidden;
    min-width: 0;
  }
  .panel {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
    font-size: 0.84rem;
  }
  h5 {
    margin: 0 0 0.3rem;
    font-size: 0.82rem;
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .count {
    font-weight: 500;
    color: var(--ink-3);
    font-size: 0.74rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .nets > li {
    margin: 0.35rem 0;
  }
  .nets ul {
    margin-left: 0.6rem;
  }
  .nn {
    color: var(--ink-2);
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .sink {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    width: 100%;
    text-align: left;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ink);
    font: inherit;
    padding: 0.25rem 0.4rem;
    min-height: 2.1rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .sink:hover {
    border-color: var(--line-strong);
  }
  .sink.sel {
    border-color: var(--copper);
    background: var(--copper-soft);
  }
  .sink:focus-visible,
  .choices input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .mark {
    font-weight: 800;
    width: 1rem;
    text-align: center;
    color: var(--ink-3);
  }
  .mark.ok {
    color: var(--ok);
  }
  .mark.short,
  .mark.loop {
    color: var(--bad);
  }
  .st {
    color: var(--ink-3);
    font-size: 0.76rem;
  }
  .cells {
    margin-top: 0.4rem;
    color: var(--ink-2);
  }
  .cells summary {
    cursor: pointer;
  }
  .cells ul {
    margin: 0.3rem 0 0 1rem;
  }
  .choices li {
    margin: 0.1rem 0;
  }
  .choices label {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 0.5rem;
    align-items: baseline;
    padding: 0.3rem 0.4rem;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    min-height: 2.1rem;
    cursor: pointer;
  }
  .choices label:hover {
    border-color: var(--line-strong);
  }
  .choices label.on {
    background: var(--surface-2);
    border-color: var(--line-strong);
  }
  .choices .carry {
    grid-column: 2;
    margin: 0;
    font-size: 0.74rem;
  }
  .cn {
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
</style>
