<!--
  A message sequence chart with an adversary (chapters 4 and 5). Lanes are the participants; time runs down.
  You choose every step, the protocol's and the adversary's (lose a message, crash a node, or, in chapter 5, act
  as the intruder), and the chart grows: a dot for each step, an arrow for each message from the step that sent
  it to the step that received it. Then the explorer gets the same powers and searches every schedule.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Badge from '$lib/components/verify/Badge.svelte';
  import { parse } from '$lib/fv/vouch/syntax/parser';
  import { check } from '$lib/fv/vouch/check/checker';
  import { SystemRuntime, type State, type StepLabel } from '$lib/fv/vouch/interp/system';
  import { explore } from '$lib/fv/explore/explorer';
  import { Refinement } from '$lib/fv/explore/refine';
  import { show, type Value, type StructV } from '$lib/fv/vouch/interp/values';
  import type { Verdict } from '$lib/fv/engines';
  import { progress } from '$lib/state/progress.svelte';

  let {
    code,
    title,
    caption,
    lanes,
    laneType,
    actors = {},
    msgVar = 'net',
    routes = {},
    fromField,
    toField,
    receives = {},
    adversary = [],
    exhibit,
    refinement = false,
  }: {
    code: string;
    title?: string;
    caption?: string;
    /** Lane names. Lane 0 is for steps of actions without a `laneType` parameter (unless `actors` says otherwise). */
    lanes: string[];
    /** Actions with a parameter of this type act in lane 1 + the parameter's index. */
    laneType?: string;
    /** Action name → lane name. */
    actors?: Record<string, string>;
    msgVar?: string;
    /** Message kind → [from lane, to lane]; the lane name "@" stands for the lane of the message's `laneType` field. */
    routes?: Record<string, [string, string]>;
    /** Or: the fields of a message that name its sender and its recipient (enum values named like lanes). */
    fromField?: string;
    toField?: string;
    /** Action name → the message kind it receives. */
    receives?: Record<string, string>;
    /** Actions that belong to the environment (the network, crashes, the intruder). */
    adversary?: string[];
    exhibit?: string;
    /** Show the specification step that each step maps to (the system declares `refines`). */
    refinement?: boolean;
  } = $props();

  let rt = $state.raw<SystemRuntime | undefined>();
  let refine = $state.raw<Refinement | undefined>();
  let error = $state('');
  let history = $state.raw<{ state: State; label?: StepLabel }[]>([]);
  let machine = $state.raw<Verdict[] | undefined>();
  let machineHistory = $state.raw<{ state: State; label?: StepLabel }[] | undefined>();
  let searching = $state(false);

  function load(src: string) {
    error = '';
    machine = undefined;
    machineHistory = undefined;
    const parsed = parse(src);
    const checked = check(parsed.program);
    const errs = [...parsed.diagnostics, ...checked.diagnostics].filter((d) => d.severity === 'error');
    if (errs.length) {
      error = errs[0]!.message;
      return;
    }
    const sys = [...checked.containers.values()].filter((c) => c.kind === 'system').at(-1);
    if (!sys) return;
    try {
      rt = new SystemRuntime(checked, sys.decl.name);
      refine = refinement && sys.refines ? new Refinement(checked, sys.decl.name) : undefined;
      history = [{ state: rt.initial().states[0]! }];
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  $effect(() => {
    const src = code;
    untrack(() => load(src));
  });

  const cur = $derived(history.at(-1)?.state);
  const succs = $derived.by(() => {
    if (!rt || !cur) return [];
    try {
      return rt.successors(cur).succs;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      return [];
    }
  });
  const protocolSteps = $derived(succs.filter((s) => !adversary.includes(s.label.name)));
  const adversarySteps = $derived(succs.filter((s) => adversary.includes(s.label.name)));

  const broken = $derived.by(() => {
    if (!rt || !cur) return [];
    return rt.info.invariants.filter((inv) => {
      try {
        return !rt!.holds(inv.expr, cur);
      } catch {
        return true;
      }
    }).map((i) => i.name ?? 'invariant');
  });
  $effect(() => {
    if (broken.length && history.length > 1 && exhibit) progress.markCaught(exhibit);
  });

  // ── Decoding a run into a chart ──
  const msgIndex = $derived(rt ? rt.info.vars.findIndex((v) => v.name === msgVar) : -1);
  const msgFields = $derived.by(() => {
    if (!rt || msgIndex < 0) return [];
    const t = rt.info.vars[msgIndex]!.ty;
    const elem = t.k === 'set' || t.k === 'multiset' ? t.elem : undefined;
    return elem?.k === 'struct' ? elem.fields.map((f) => f.name) : [];
  });
  const field = (m: Value, name: string) => (m as StructV).fields[msgFields.indexOf(name)];
  const items = (s: State): Value[] => {
    const v = s.vals[msgIndex] as { items?: readonly Value[] } | undefined;
    return [...(v?.items ?? [])];
  };
  const laneByName = (n: string) => Math.max(0, lanes.indexOf(n));
  const atomIndex = (v: Value | undefined): number | undefined => (v && typeof v === 'object' && 'i' in v && (v as { t: string }).t === 'atom' ? (v as { i: number }).i : undefined);

  function laneOfStep(l: StepLabel): number {
    if (actors[l.name]) return laneByName(actors[l.name]!);
    if (laneType) {
      const a = rt!.info.actions.find((x) => x.decl.name === l.name);
      const k = a?.params.findIndex((p) => p.ty.k === 'atom' && p.ty.name === laneType) ?? -1;
      if (k >= 0) return 1 + (atomIndex(l.args[k]) ?? 0);
    }
    return 0;
  }
  function route(m: Value): [number, number] {
    if (fromField && toField) {
      const f = field(m, fromField);
      const t = field(m, toField);
      return [laneByName((f as { variant?: string })?.variant ?? show(f!)), laneByName((t as { variant?: string })?.variant ?? show(t!))];
    }
    const kind = (field(m, 'kind') as { variant?: string })?.variant ?? '';
    const r = routes[kind];
    if (!r) return [0, 0];
    const at = laneType ? 1 + (atomIndex(field(m, msgFields.find((f) => f !== 'kind') ?? '')) ?? 0) : 0;
    return [r[0] === '@' ? at : laneByName(r[0]), r[1] === '@' ? at : laneByName(r[1])];
  }
  const kindOf = (m: Value) => (field(m, 'kind') as { variant?: string })?.variant ?? '';

  interface Chart {
    steps: { lane: number; text: string; adversary: boolean; abstract?: string }[];
    arrows: { from: number; to: number; sentAt: number; doneAt?: number; lost: boolean; text: string }[];
  }
  function chart(run: { state: State; label?: StepLabel }[]): Chart {
    const steps: Chart['steps'] = [];
    const arrows: Chart['arrows'] = [];
    const open = new Map<string, number[]>();
    for (let i = 1; i < run.length; i++) {
      const before = new Set(items(run[i - 1]!.state).map((m) => show(m)));
      const after = items(run[i]!.state);
      const afterKeys = new Set(after.map((m) => show(m)));
      const l = run[i]!.label!;
      const lane = laneOfStep(l);
      let abstract: string | undefined;
      if (refine) {
        try {
          abstract = refine.abstractStep(refine.abstract(run[i - 1]!.state), refine.abstract(run[i]!.state)) ?? '✗ not a step of the specification';
        } catch {
          abstract = undefined;
        }
      }
      steps.push({ lane, text: l.text, adversary: adversary.includes(l.name), abstract });
      const row = steps.length - 1;
      // Messages sent by this step.
      for (const m of after) {
        const k = show(m);
        if (before.has(k)) continue;
        const [from, to] = route(m);
        arrows.push({ from, to, sentAt: row, lost: false, text: kindOf(m) || k });
        (open.get(k) ?? open.set(k, []).get(k)!).push(arrows.length - 1);
      }
      // Messages lost (removed) in this step.
      for (const k of before) {
        if (afterKeys.has(k)) continue;
        for (const a of open.get(k) ?? []) if (arrows[a]!.doneAt === undefined) {
          arrows[a]!.doneAt = row;
          arrows[a]!.lost = adversary.includes(l.name);
        }
      }
      // Messages received by this step (the action reads a message of that kind addressed to this lane).
      const kind = receives[l.name];
      if (kind) {
        for (const [k, ids] of open) {
          for (const a of ids) {
            const ar = arrows[a]!;
            if (ar.doneAt === undefined && ar.text === kind && ar.to === lane) {
              ar.doneAt = row;
              break;
            }
          }
        }
      }
    }
    return { steps, arrows };
  }

  const handChart = $derived(rt ? chart(history) : undefined);
  const machineChart = $derived(rt && machineHistory ? chart(machineHistory) : undefined);

  function take(s: { label: StepLabel; state: State }) {
    history = [...history, { state: s.state, label: s.label }];
  }

  async function search() {
    if (!rt) return;
    searching = true;
    await new Promise((r) => setTimeout(r, 20));
    try {
      const { verdicts } = explore(rt, { timeout: 10000, symmetry: true });
      const out = [...verdicts];
      if (refine) out.push(refine.check({ timeout: 10000 }));
      machine = out;
      const bad = out.find((v) => v.status === 'violated' && v.trace);
      if (bad?.trace) {
        // Re-run the trace through the runtime to recover states for the chart.
        const run: { state: State; label?: StepLabel }[] = [{ state: rt.initial().states[0]! }];
        for (const st of bad.trace.steps.slice(1)) {
          const prev = run.at(-1)!.state;
          const next = rt.successors(prev).succs.find((x) => x.label.text === st.label && rt!.describe(x.state).every((v, i) => v.value === st.state.values[i]?.value));
          if (!next) break;
          run.push({ state: next.state, label: next.label });
        }
        machineHistory = run;
      }
    } finally {
      searching = false;
    }
  }

  const COLW = 112;
  const ROWH = 34;
</script>

{#snippet drawChart(c: Chart)}
  {@const w = Math.max(lanes.length * COLW + (refine ? 190 : 0), 300)}
  {@const h = (c.steps.length + 1.5) * ROWH + 30}
  <div class="chart">
    <svg viewBox="0 0 {w} {h}" width={w} height={h} role="img" aria-label="Message sequence chart">
      <defs><marker id="msc-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor" /></marker></defs>
      {#each lanes as name, i (i)}
        <text x={COLW * i + COLW / 2} y="16" class="lane-name">{name}</text>
        <line x1={COLW * i + COLW / 2} y1="24" x2={COLW * i + COLW / 2} y2={h - 6} class="lifeline" />
      {/each}
      {#each c.arrows as a, i (i)}
        {@const x1 = COLW * a.from + COLW / 2}
        {@const y1 = 30 + (a.sentAt + 1) * ROWH}
        {@const x2 = COLW * a.to + COLW / 2}
        {@const y2 = a.doneAt !== undefined ? 30 + (a.doneAt + 1) * ROWH : h - 10}
        {#if a.lost}
          {@const mx = (x1 + x2) / 2}
          {@const my = (y1 + y2) / 2}
          <line {x1} {y1} x2={mx} y2={my} class="msg lost" />
          <text x={mx} y={my + 4} class="cross">✗</text>
        {:else}
          <line {x1} {y1} {x2} {y2} class="msg" class:flight={a.doneAt === undefined} marker-end="url(#msc-arr)" />
        {/if}
        <text x={(x1 + x2) / 2 + (x2 >= x1 ? 4 : -4)} y={(y1 + y2) / 2 - 4} class="msg-label" text-anchor={x2 >= x1 ? 'start' : 'end'}>{a.text}</text>
      {/each}
      {#each c.steps as s, i (i)}
        {@const x = COLW * s.lane + COLW / 2}
        {@const y = 30 + (i + 1) * ROWH}
        <circle cx={x} cy={y} r="5" class="step" class:adv={s.adversary} />
        <text x={x + 9} y={y - 7} class="step-label" class:adv={s.adversary}>{s.text}</text>
        {#if s.abstract}<text x={lanes.length * COLW + 10} y={y + 4} class="abs" class:bad={s.abstract.startsWith('✗')}>{s.abstract === 'stutter' ? '·' : s.abstract}</text>{/if}
      {/each}
    </svg>
  </div>
{/snippet}

<figure class="msc">
  {#if title}<header class="ui"><span class="kicker">Message sequence chart</span> <span class="title">{title}</span></header>{/if}
  {#if error}<p class="err ui">{error}</p>{/if}
  {#if rt && handChart}
    {@render drawChart(handChart)}
    {#if refine}<p class="note ui">Right margin: the step of the specification that each step corresponds to (· for none: the specification does not see it).</p>{/if}
    <div class="choices ui">
      <div>
        <p class="h">Protocol steps</p>
        <div class="btns">{#each protocolSteps as s, i (i)}<button type="button" onclick={() => take(s)}>{s.label.text}</button>{:else}<span class="none">none enabled</span>{/each}</div>
      </div>
      {#if adversary.length}
        <div>
          <p class="h adv">The network and its failures</p>
          <div class="btns">{#each adversarySteps as s, i (i)}<button type="button" class="adv" onclick={() => take(s)}>{s.label.text}</button>{:else}<span class="none">none enabled</span>{/each}</div>
        </div>
      {/if}
    </div>
    <div class="bar ui">
      <span>{history.length - 1} steps</span>
      <button type="button" onclick={() => history.length > 1 && (history = history.slice(0, -1))} disabled={history.length < 2}>Undo</button>
      <button type="button" onclick={() => (history = history.slice(0, 1))} disabled={history.length < 2}>Restart</button>
      <span class="spacer"></span>
      <button type="button" class="machine" onclick={search} disabled={searching}>{searching ? 'Searching…' : 'Give the explorer the same powers'}</button>
    </div>
    {#if broken.length}<p class="alert ui" role="status"><b>Broken:</b> {broken.join(', ')} is false now.</p>{/if}
    {#if machine}
      <div class="out">
        {#each machine as v, i (i)}<Badge verdict={v} />{/each}
        {#if machineChart}
          <p class="h ui">The explorer's shortest counterexample</p>
          {@render drawChart(machineChart)}
        {/if}
      </div>
    {/if}
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .msc {
    margin: 2rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  header {
    margin-bottom: 0.5rem;
  }
  .kicker {
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--gold);
    font-weight: 700;
  }
  .title {
    font-weight: 600;
  }
  .chart {
    overflow: auto;
    max-height: 30rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
  }
  svg {
    display: block;
    color: var(--edge);
  }
  .lane-name {
    font-family: var(--font-ui);
    font-size: 12px;
    font-weight: 700;
    fill: var(--fg);
    text-anchor: middle;
  }
  .lifeline {
    stroke: var(--line-strong);
    stroke-dasharray: 3 3;
  }
  .msg {
    stroke: var(--ink-blue);
    stroke-width: 1.4;
  }
  .msg.flight {
    stroke-dasharray: 5 4;
    opacity: 0.7;
  }
  .msg.lost {
    stroke: var(--pencil);
    stroke-dasharray: 4 3;
  }
  .cross {
    fill: var(--pencil);
    font-size: 13px;
    text-anchor: middle;
    font-weight: 700;
  }
  .msg-label {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--ink-blue);
  }
  .step {
    fill: var(--fg);
  }
  .step.adv {
    fill: var(--pencil);
  }
  .step-label {
    font-family: var(--font-mono);
    font-size: 9.5px;
    fill: var(--ink-2);
  }
  .step-label.adv {
    fill: var(--pencil);
  }
  .abs {
    font-family: var(--font-mono);
    font-size: 9.5px;
    fill: var(--seal);
  }
  .abs.bad {
    fill: var(--pencil);
  }
  .note {
    font-size: 0.78rem;
    color: var(--mute);
    margin: 0.3rem 0 0;
  }
  .choices {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.6rem;
    margin-top: 0.6rem;
  }
  @media (max-width: 700px) {
    .choices {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .h {
    margin: 0 0 0.3rem;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .h.adv {
    color: var(--pencil);
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  button {
    font: inherit;
    font-size: 0.78rem;
    cursor: pointer;
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .btns button {
    font-family: var(--font-mono);
  }
  button.adv {
    border-color: var(--pencil);
    color: var(--pencil);
  }
  button:disabled {
    opacity: 0.5;
  }
  .none {
    font-size: 0.8rem;
    color: var(--mute);
  }
  .bar {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    margin-top: 0.6rem;
    flex-wrap: wrap;
    font-size: 0.82rem;
  }
  .spacer {
    flex: 1;
  }
  .machine {
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
    font-size: 0.82rem;
    padding: 0.28rem 0.7rem;
  }
  .alert {
    color: var(--pencil);
    margin: 0.5rem 0;
  }
  .err {
    color: var(--pencil);
  }
  .out {
    margin-top: 0.7rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  figcaption {
    margin-top: 0.7rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
