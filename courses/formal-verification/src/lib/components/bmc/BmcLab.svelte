<!--
  The unrolling view (chapter 10): a system in an editor; bounded model checking adds one copy of the transition
  relation per bound and asks the SAT solver whether the property can fail at that step. Each bound appears as it
  is checked (its size and time); a counterexample is replayed by the runtime and drawn as a waveform. "Race the
  explorer" runs Part I's explicit-state search on the same system with a time limit, for comparison.

  Usage: :::bmc-lab{title="…" maxK=12} with a ```vouch system inside.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import VouchEditor from '$lib/components/verify/VouchEditor.svelte';
  import Badge from '$lib/components/verify/Badge.svelte';
  import Waveform from './Waveform.svelte';
  import { parse } from '$lib/fv/vouch/syntax/parser';
  import { check, type Checked } from '$lib/fv/vouch/check/checker';
  import { SystemRuntime } from '$lib/fv/vouch/interp/system';
  import { BmcSession, bmcVerdicts, type BoundStats } from '$lib/fv/bmc/bmc';
  import { BmcError } from '$lib/fv/bmc/symbolic';
  import { explore } from '$lib/fv/explore/explorer';
  import type { Verdict } from '$lib/fv/engines';

  let { code, title, caption, maxK = 12, race = false }: { code: string; title?: string; caption?: string; maxK?: number; race?: boolean } = $props();

  let editor: VouchEditor | undefined = $state();
  let checked = $state.raw<Checked | undefined>();
  let system = $state('');
  let error = $state('');
  // svelte-ignore state_referenced_locally
  let bound = $state(maxK);
  let bounds = $state.raw<(BoundStats & { found: string[] })[]>([]);
  let verdicts = $state.raw<Verdict[]>([]);
  let running = $state(false);
  let selected = $state(0);
  let raceResult = $state<string | undefined>();
  let racing = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;

  function load(src: string) {
    error = '';
    bounds = [];
    verdicts = [];
    raceResult = undefined;
    const parsed = parse(src);
    const c = check(parsed.program);
    const errs = [...parsed.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
    if (errs.length) {
      error = `line ${src.slice(0, errs[0]!.span.start).split('\n').length}: ${errs[0]!.message}`;
      checked = undefined;
      return;
    }
    const sys = [...c.containers.values()].find((x) => x.kind === 'system');
    if (!sys) {
      error = 'There is no `system` here.';
      return;
    }
    checked = c;
    system = sys.decl.name;
  }

  function run() {
    if (!checked || running) return;
    const gen = ++generation;
    running = true;
    bounds = [];
    verdicts = [];
    selected = 0;
    let session: BmcSession;
    let rt: SystemRuntime;
    try {
      rt = new SystemRuntime(checked, system);
      session = new BmcSession(rt, { maxK: bound, timeout: 20000 });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      running = false;
      return;
    }
    const tick = () => {
      if (gen !== generation) return;
      try {
        const b = session.next();
        const res = session.result();
        bounds = [...bounds, { ...b, found: res.properties.filter((p) => p.foundAt === b.k).map((p) => p.subject) }];
        if (session.done) {
          verdicts = bmcVerdicts(rt, res);
          const firstBad = verdicts.findIndex((v) => v.status === 'violated');
          selected = Math.max(0, firstBad);
          running = false;
        } else setTimeout(tick, 15);
      } catch (e) {
        error = e instanceof BmcError ? e.message : e instanceof Error ? e.message : String(e);
        running = false;
      }
    };
    setTimeout(tick, 15);
  }

  function raceExplorer() {
    if (!checked || racing) return;
    racing = true;
    raceResult = undefined;
    setTimeout(() => {
      try {
        const t0 = performance.now();
        const r = explore(new SystemRuntime(checked!, system), { timeout: 4000, maxStates: 300_000, chunk: 1 });
        const ms = performance.now() - t0;
        const states = r.exploration.size;
        const bad = r.verdicts.filter((v) => v.status === 'violated').map((v) => v.subject);
        raceResult = bad.length
          ? `The explorer found ${bad.join(', ')} violated after visiting ${states.toLocaleString('en-GB')} states in ${(ms / 1000).toFixed(1)} s.`
          : `The explorer visited ${states.toLocaleString('en-GB')} states in ${(ms / 1000).toFixed(1)} s and ${r.verdicts.every((v) => v.status === 'verified') ? 'found no violation: the state space is small enough to search completely.' : 'gave up without finding the violation.'}`;
      } catch (e) {
        raceResult = `The explorer could not run: ${e instanceof Error ? e.message : String(e)}`;
      }
      racing = false;
    }, 20);
  }

  $effect(() => {
    const src = code;
    untrack(() => {
      load(src);
      run();
    });
  });
  function changed(src: string) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      load(src);
      run();
    }, 700);
  }

  const maxMs = $derived(Math.max(1, ...bounds.map((b) => b.ms)));
  const maxClauses = $derived(Math.max(1, ...bounds.map((b) => b.clauses)));
  const current = $derived(verdicts[selected]);
</script>

<figure class="bmc">
  {#if title}<header class="ui"><span class="kicker">Unrolling</span> <span class="title">{title}</span></header>{/if}
  <VouchEditor bind:this={editor} value={code} name="bmc-lab" minLines={8} maxHeight="24rem" onchange={changed} />
  {#if error}
    <p class="err ui">{error}</p>
  {:else}
    <div class="bar ui">
      <label class="k">Unroll up to <input type="range" min="1" max="30" bind:value={bound} /> <b>{bound}</b> steps</label>
      <button type="button" class="go" onclick={run} disabled={running}>{running ? 'Unrolling…' : 'Run BMC'}</button>
      {#if race}<button type="button" onclick={raceExplorer} disabled={racing}>{racing ? 'Exploring…' : 'Race the explorer'}</button>{/if}
    </div>
    {#if bounds.length}
      <div class="chart ui" aria-label="Each bound: the size of the SAT problem and the time to solve it">
        <div class="row head"><span>k</span><span>clauses so far</span><span>time for this bound</span><span></span></div>
        {#each bounds as b (b.k)}
          <div class="row" class:hit={b.found.length > 0}>
            <span>{b.k}</span>
            <span class="cell"><span class="b1" style="width: {(b.clauses / maxClauses) * 100}%"></span><em>{b.clauses.toLocaleString('en-GB')}</em></span>
            <span class="cell"><span class="b2" style="width: {(b.ms / maxMs) * 100}%"></span><em>{b.ms} ms</em></span>
            <span class="res">{b.found.length ? `SAT: ${b.found.join(', ')} fails` : 'UNSAT'}</span>
          </div>
        {/each}
      </div>
    {/if}
    {#if verdicts.length}
      {#if verdicts.length > 1}
        <div class="tabs ui">{#each verdicts as v, i (i)}<button type="button" class:on={i === selected} onclick={() => (selected = i)}>{v.subject}</button>{/each}</div>
      {/if}
      {#if current}
        <Badge verdict={current} />
        {#if current.trace}<Waveform trace={current.trace} />{/if}
      {/if}
    {/if}
    {#if raceResult}<p class="race ui">{raceResult}</p>{/if}
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .bmc {
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
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.8rem;
    align-items: center;
    margin: 0.6rem 0;
    font-size: 0.84rem;
  }
  .k {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
  }
  .k input {
    width: 8rem;
    accent-color: var(--ink-blue);
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
    opacity: 0.55;
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
  .chart {
    font-size: 0.78rem;
    margin: 0.4rem 0 0.8rem;
    max-height: 16rem;
    overflow-y: auto;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
  }
  .row {
    display: grid;
    grid-template-columns: 2.2rem minmax(0, 1fr) minmax(0, 1fr) minmax(7rem, 1.2fr);
    gap: 0.5rem;
    align-items: center;
    padding: 0.15rem 0.5rem;
    border-bottom: 1px solid var(--line);
    font-variant-numeric: tabular-nums;
  }
  .row.head {
    color: var(--mute);
    font-weight: 600;
  }
  .row.hit .res {
    color: var(--pencil);
    font-weight: 700;
  }
  .res {
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }
  .cell {
    position: relative;
    height: 1.1rem;
    display: flex;
    align-items: center;
  }
  .cell em {
    position: relative;
    font-style: normal;
    padding-left: 0.3rem;
  }
  .b1,
  .b2 {
    position: absolute;
    left: 0;
    top: 0.25rem;
    height: 0.6rem;
    border-radius: 2px;
    background: color-mix(in srgb, var(--ink-blue) 35%, transparent);
    min-width: 2px;
  }
  .b2 {
    background: color-mix(in srgb, var(--pencil) 35%, transparent);
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.4rem;
  }
  .tabs button.on {
    border-color: var(--ink-blue);
    color: var(--ink-blue);
    font-weight: 600;
  }
  .race {
    font-size: 0.85rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  @media (max-width: 560px) {
    .row {
      grid-template-columns: 1.6rem minmax(0, 1fr) minmax(0, 1fr);
    }
    .row .res {
      grid-column: 1 / -1;
    }
  }
</style>
