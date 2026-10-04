<!--
  Be the scheduler (chapter 2's flagship): the processes of a system side by side, each with its code and the
  label it is at. You choose who moves next and try to break the invariant; then the explorer searches every
  interleaving and reports the shortest bad one, with the state counts under symmetry and partial-order reduction.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import TraceView from '$lib/components/verify/TraceView.svelte';
  import Badge from '$lib/components/verify/Badge.svelte';
  import { parse } from '$lib/fv/vouch/syntax/parser';
  import { check } from '$lib/fv/vouch/check/checker';
  import { SystemRuntime, type State, type StepLabel } from '$lib/fv/vouch/interp/system';
  import { RuntimeFailure } from '$lib/fv/vouch/interp/eval';
  import { Exploration, explore, toTrace } from '$lib/fv/explore/explorer';
  import { lineCol } from '$lib/fv/vouch/syntax/lexer';
  import type { Verdict } from '$lib/fv/engines';
  import { progress } from '$lib/state/progress.svelte';

  let {
    code,
    title,
    caption,
    exhibit,
    counts = true,
  }: { code: string; title?: string; caption?: string; exhibit?: string; counts?: boolean } = $props();

  let rt = $state.raw<SystemRuntime | undefined>();
  let error = $state('');
  let history = $state.raw<{ state: State; label?: StepLabel }[]>([]);
  let machine = $state.raw<{ verdicts: Verdict[]; states: number } | undefined>();
  let table = $state.raw<{ config: string; states: number; transitions: number }[]>([]);
  let searching = $state(false);
  let caught = $state(false);

  function load(src: string) {
    error = '';
    rt = undefined;
    machine = undefined;
    table = [];
    caught = false;
    const parsed = parse(src);
    const checked = check(parsed.program);
    const errs = [...parsed.diagnostics, ...checked.diagnostics].filter((d) => d.severity === 'error');
    if (errs.length) {
      error = errs[0]!.message;
      return;
    }
    const sys = [...checked.containers.values()].find((c) => c.kind === 'system');
    if (!sys) {
      error = 'There is no system in this model.';
      return;
    }
    try {
      const r = new SystemRuntime(checked, sys.decl.name);
      rt = r;
      history = [{ state: r.initial().states[0]! }];
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  $effect(() => {
    const src = code;
    untrack(() => load(src));
  });

  const cur = $derived(history.at(-1)?.state);

  // The code of each process, with the line of each label.
  const lines = $derived(code.split('\n'));
  const procs = $derived.by(() => {
    if (!rt) return [];
    return rt.instances.map((inst, i) => {
      const span = inst.proc.decl.span;
      const from = lineCol(code, span.start).line;
      const to = lineCol(code, span.end).line;
      const labelLine = new Map<string, number>();
      for (const ins of rt!.code.get(inst.proc)!) if (ins.op === 'label') labelLine.set(ins.name, lineCol(code, ins.span.start).line);
      return { i, name: inst.name, from, to, labelLine };
    });
  });

  function stepsOf(i: number): { label: StepLabel; state: State }[] {
    if (!rt || !cur) return [];
    try {
      return rt.successors(cur).succs.filter((s) => s.label.kind === 'process' && s.label.instance === i);
    } catch (e) {
      if (e instanceof RuntimeFailure) error = e.message;
      return [];
    }
  }
  const enabled = $derived(procs.map((p) => (cur ? stepsOf(p.i) : [])));

  const broken = $derived.by(() => {
    if (!rt || !cur) return [];
    return rt.info.invariants.filter((inv) => {
      try {
        return !rt!.holds(inv.expr, cur);
      } catch {
        return true;
      }
    }).map((inv) => inv.name ?? 'invariant');
  });
  const stuck = $derived(!!rt && !!cur && enabled.every((e) => !e.length) && rt.instances.some((_, i) => rt!.pcLabel(cur, i) !== 'done'));

  $effect(() => {
    if ((broken.length || stuck) && history.length > 1 && !caught) {
      caught = true;
      if (exhibit) progress.markCaught(exhibit);
    }
  });

  function take(s: { label: StepLabel; state: State }) {
    history = [...history, { state: s.state, label: s.label }];
  }
  function undo() {
    if (history.length > 1) history = history.slice(0, -1);
  }
  function restart() {
    history = history.slice(0, 1);
    caught = false;
  }

  const values = $derived(cur && rt ? rt.describe(cur).filter((v) => v.kind !== 'pc') : []);
  const prev = $derived(history.length > 1 && rt ? rt.describe(history.at(-2)!.state) : []);
  const changed = (name: string, value: string) => prev.some((p) => p.name === name && p.value !== value);
  const pcOf = (i: number) => (rt && cur ? rt.pcLabel(cur, i) : '');
  const handTrace = $derived(rt && history.length > 1 ? toTrace(rt, history.map((h) => h.state), history.slice(1).map((h) => h.label!)) : undefined);

  async function search() {
    if (!rt) return;
    searching = true;
    await new Promise((r) => setTimeout(r, 20));
    try {
      const { verdicts, exploration } = explore(rt, { timeout: 8000, deadlock: rt.instances.length > 0 });
      machine = { verdicts, states: exploration.size };
      if (counts) {
        const rows: typeof table = [];
        for (const [config, o] of [
          ['plain search', {}],
          ['partial-order reduction', { por: true }],
        ] as const) {
          const x = new Exploration(rt, { ...o, stopAtFirst: false, deadlock: true });
          x.run(200_000);
          rows.push({ config, states: x.size, transitions: x.transitions });
        }
        table = rows;
      }
    } finally {
      searching = false;
    }
  }
</script>

<figure class="sched">
  {#if title}<header class="ui"><span class="kicker">Be the scheduler</span> <span class="title">{title}</span></header>{/if}
  {#if error}<p class="err ui">{error}</p>{/if}
  {#if rt && cur}
    <div class="lanes" style:--n={procs.length}>
      {#each procs as p (p.i)}
        <section class="lane" class:done={pcOf(p.i) === 'done'}>
          <div class="head ui">
            <b>{p.name}</b>
            <span class="at">at <code>{pcOf(p.i)}</code></span>
          </div>
          <pre class="src">{#each lines.slice(p.from, p.to + 1) as l, k (k)}<span class="ln" class:here={p.labelLine.get(pcOf(p.i)) === p.from + k}>{l || ' '}</span>{/each}</pre>
          <div class="go ui">
            {#if enabled[p.i]?.length}
              {#each enabled[p.i] as s, k (k)}
                <button type="button" onclick={() => take(s)} title={s.label.text}>Step {p.name}{enabled[p.i]!.length > 1 ? ` (${k + 1})` : ''}</button>
              {/each}
            {:else}
              <button type="button" disabled>{pcOf(p.i) === 'done' ? 'Finished' : 'Blocked'}</button>
            {/if}
          </div>
        </section>
      {/each}
    </div>
    <div class="state ui">
      <span class="lbl">Shared state</span>
      {#each values as v (v.name)}<span class="var" class:changed={changed(v.name, v.value)}><code>{v.name}</code> = <code>{v.value}</code></span>{/each}
    </div>
    <div class="bar ui">
      <span class="count">{history.length - 1} step{history.length === 2 ? '' : 's'}</span>
      <button type="button" onclick={undo} disabled={history.length < 2}>Undo</button>
      <button type="button" onclick={restart} disabled={history.length < 2}>Restart</button>
      <span class="spacer"></span>
      <button type="button" class="machine" onclick={search} disabled={searching}>{searching ? 'Searching…' : 'Let the explorer search every interleaving'}</button>
    </div>
    {#if broken.length}
      <p class="alert ui" role="status"><b>Broken:</b> {broken.join(', ')} is false in this state, after {history.length - 1} steps of your schedule.</p>
    {:else if stuck}
      <p class="alert ui" role="status"><b>Deadlock:</b> no process can move, and not all of them have finished.</p>
    {/if}
    {#if handTrace && (broken.length || stuck)}
      <TraceView trace={handTrace} caption="Your schedule" />
    {/if}
    {#if machine}
      <div class="machine-out">
        {#each machine.verdicts as v, i (i)}<Badge verdict={v} />{/each}
        {#each machine.verdicts.filter((v) => v.trace) as v, i (i)}
          <TraceView trace={v.trace!} caption={`The explorer's shortest counterexample: ${v.subject}`} />
        {/each}
        {#if table.length}
          <table class="counts ui">
            <thead><tr><th>Search</th><th>States stored</th><th>Transitions tried</th></tr></thead>
            <tbody>{#each table as r (r.config)}<tr><td>{r.config}</td><td>{r.states.toLocaleString('en-GB')}</td><td>{r.transitions.toLocaleString('en-GB')}</td></tr>{/each}</tbody>
          </table>
        {/if}
      </div>
    {/if}
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .sched {
    margin: 2rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  header {
    margin-bottom: 0.6rem;
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
  .lanes {
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: 0.6rem;
  }
  @media (max-width: 700px) {
    .lanes {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .lane {
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
    padding: 0.5rem;
    min-width: 0;
  }
  .lane.done {
    opacity: 0.7;
  }
  .head {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    margin-bottom: 0.3rem;
  }
  .at code {
    color: var(--trace);
    font-weight: 700;
  }
  .src {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    line-height: 1.5;
    overflow-x: auto;
    background: var(--code-bg);
    border-radius: 4px;
    padding: 0.3rem 0;
  }
  .ln {
    display: block;
    padding: 0 0.5rem;
  }
  .ln.here {
    background: color-mix(in srgb, var(--trace) 22%, transparent);
    box-shadow: inset 3px 0 0 var(--trace);
  }
  .go {
    display: flex;
    gap: 0.3rem;
    margin-top: 0.4rem;
    flex-wrap: wrap;
  }
  button {
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
    padding: 0.28rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .go button {
    border-color: var(--trace);
    font-weight: 600;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .state {
    margin-top: 0.6rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.9rem;
    font-size: 0.82rem;
    align-items: baseline;
  }
  .lbl {
    color: var(--mute);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .var.changed code:last-child {
    color: var(--pencil);
    font-weight: 700;
  }
  .bar {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    margin-top: 0.6rem;
    flex-wrap: wrap;
  }
  .count {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin-right: 0.3rem;
  }
  .spacer {
    flex: 1;
  }
  .machine {
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .alert {
    margin: 0.6rem 0;
    color: var(--pencil);
    font-size: 0.9rem;
  }
  .err {
    color: var(--pencil);
  }
  .machine-out {
    margin-top: 0.7rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .counts {
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  .counts th,
  .counts td {
    text-align: left;
    padding: 0.25rem 0.8rem 0.25rem 0;
    border-bottom: 1px solid var(--line);
  }
  figcaption {
    margin-top: 0.7rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
