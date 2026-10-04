<!--
  Symbolic reachability (chapter 11): a system in an editor; each press of "One image" adds every state one step
  further, all at once, as a BDD. The table shows how many states are reachable and how big the BDDs are. At the
  fixpoint, invariants are checked and, when they hold, the reachable set is exported as an inductive invariant
  and re-checked by SAT. "Race the explorer" runs explicit-state search on the same system for comparison.

  Usage: :::reach-lab{title="…" race=true} with a ```vouch system inside.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import VouchEditor from '$lib/components/verify/VouchEditor.svelte';
  import Badge from '$lib/components/verify/Badge.svelte';
  import { parse } from '$lib/fv/vouch/syntax/parser';
  import { check, type Checked } from '$lib/fv/vouch/check/checker';
  import { SystemRuntime } from '$lib/fv/vouch/interp/system';
  import { Reachability, reachVerdicts, type ReachIteration } from '$lib/fv/bdd/reach';
  import { explore } from '$lib/fv/explore/explorer';
  import type { Verdict } from '$lib/fv/engines';

  let { code, title, caption, race = false }: { code: string; title?: string; caption?: string; race?: boolean } = $props();

  let checked = $state.raw<Checked | undefined>();
  let system = $state('');
  let error = $state('');
  let reach: Reachability | undefined;
  let iterations = $state.raw<ReachIteration[]>([]);
  let info = $state<{ vars: number; tNodes: number } | undefined>();
  let done = $state(false);
  let verdicts = $state.raw<Verdict[]>([]);
  let busy = $state(false);
  let raceResult = $state<string | undefined>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function load(src: string) {
    error = '';
    iterations = [];
    verdicts = [];
    done = false;
    raceResult = undefined;
    reach = undefined;
    info = undefined;
    const parsed = parse(src);
    const c = check(parsed.program);
    const errs = [...parsed.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
    if (errs.length) {
      error = `line ${src.slice(0, errs[0]!.span.start).split('\n').length}: ${errs[0]!.message}`;
      return;
    }
    const sys = [...c.containers.values()].find((x) => x.kind === 'system');
    if (!sys) {
      error = 'There is no `system` here.';
      return;
    }
    checked = c;
    system = sys.decl.name;
    try {
      reach = new Reachability(new SystemRuntime(c, system));
      iterations = [...reach.iterations];
      info = { vars: reach.cur.length, tNodes: reach.transitionNodes };
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  function finish() {
    if (!reach || !checked) return;
    done = true;
    const r = reach.run({ timeout: 1 });
    verdicts = reachVerdicts(new SystemRuntime(checked, system), r, reach);
  }

  function one() {
    if (!reach || done) return;
    reach.step();
    iterations = [...reach.iterations];
    if (reach.done) finish();
  }

  function all() {
    if (!reach || done || busy) return;
    busy = true;
    const tick = () => {
      if (!reach) return;
      const t0 = performance.now();
      while (!reach.done && performance.now() - t0 < 40) reach.step();
      iterations = [...reach.iterations];
      if (reach.done) {
        finish();
        busy = false;
      } else if (reach.iterations.length > 5000) busy = false;
      else setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
  }

  function raceExplorer() {
    if (!checked) return;
    raceResult = undefined;
    setTimeout(() => {
      const t0 = performance.now();
      const r = explore(new SystemRuntime(checked!, system), { timeout: 4000, maxStates: 2_000_000, chunk: 500 });
      const ms = performance.now() - t0;
      const complete = r.verdicts.every((v) => v.badge.kind === 'exhaustive' || v.status === 'violated');
      raceResult = `The explorer visited ${r.exploration.size.toLocaleString('en-GB')} states in ${(ms / 1000).toFixed(1)} s${complete ? ', all of them.' : ' and stopped: it stores and visits states one at a time.'}`;
    }, 20);
  }

  $effect(() => {
    const src = code;
    untrack(() => load(src));
  });
  function changed(src: string) {
    clearTimeout(timer);
    timer = setTimeout(() => load(src), 700);
  }
  const fmt = (n: bigint) => (n < 10n ** 9n ? n.toLocaleString('en-GB') : `${(Number(n) / 10 ** Math.floor(Math.log10(Number(n)))).toFixed(2)} × 10^${Math.floor(Math.log10(Number(n)))}`);
</script>

<figure class="reach">
  {#if title}<header class="ui"><span class="kicker">Symbolic reachability</span> <span class="title">{title}</span></header>{/if}
  <VouchEditor value={code} name="reach-lab" minLines={6} maxHeight="22rem" onchange={changed} />
  {#if error}
    <p class="err ui">{error}</p>
  {:else if info}
    <p class="ui meta">{info.vars} Boolean state variables; the transition relation is a BDD of {info.tNodes.toLocaleString('en-GB')} nodes over current and next-state variables.</p>
    <div class="bar ui">
      <button type="button" onclick={one} disabled={done || busy}>One image</button>
      <button type="button" class="go" onclick={all} disabled={done || busy}>{busy ? 'Iterating…' : 'Run to the fixpoint'}</button>
      <button type="button" onclick={() => load(code)}>Reset</button>
      {#if race}<button type="button" onclick={raceExplorer}>Race the explorer</button>{/if}
    </div>
    <div class="tbl ui">
      <div class="row head"><span>i</span><span>reachable states</span><span>new</span><span>BDD of the set</span><span>BDD of the new states</span></div>
      {#each iterations.slice(-60) as it (it.i)}
        <div class="row"><span>{it.i}</span><span>{fmt(it.states)}</span><span>{fmt(it.frontier)}</span><span>{it.reachNodes.toLocaleString('en-GB')} nodes</span><span>{it.frontierNodes.toLocaleString('en-GB')} nodes</span></div>
      {/each}
      {#if done}<div class="row fix"><span></span><span>Fixpoint: nothing new. {fmt(iterations.at(-1)!.states)} reachable states.</span></div>{/if}
    </div>
    {#each verdicts as v, i (i)}<Badge verdict={v} />{/each}
    {#if raceResult}<p class="race ui">{raceResult}</p>{/if}
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .reach {
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
  .meta {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0.2rem;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0.5rem 0;
  }
  button {
    font: inherit;
    font-size: 0.84rem;
    padding: 0.25rem 0.7rem;
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
  .err {
    color: var(--pencil);
    font-size: 0.85rem;
  }
  .tbl {
    font-size: 0.78rem;
    max-height: 15rem;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
    margin-bottom: 0.6rem;
  }
  .row {
    display: grid;
    grid-template-columns: 2rem repeat(4, minmax(0, 1fr));
    gap: 0.4rem;
    padding: 0.15rem 0.5rem;
    border-bottom: 1px solid var(--line);
    font-variant-numeric: tabular-nums;
  }
  .row.head {
    color: var(--mute);
    font-weight: 600;
  }
  .row.fix span:nth-child(2) {
    grid-column: 2 / -1;
    color: var(--seal);
    font-weight: 600;
  }
  .race {
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  @media (max-width: 560px) {
    .row {
      grid-template-columns: 1.6rem repeat(2, minmax(0, 1fr));
    }
    .row span:nth-child(4),
    .row span:nth-child(5) {
      display: none;
    }
  }
</style>
