<!--
  The invariant workshop for systems: edit a system's invariants, choose k, and check them by k-induction. Two
  lights (base and step); when the step fails, the counterexample to induction is drawn as a table of states, each
  with the invariants it satisfies; when it succeeds, the DRAT certificate is checked in the background.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { runInduction } from '$lib/components/induction/client';
  import type { InductionEvent, ShownState } from '$lib/fv/ic3/worker';
  import type { Trace } from '$lib/fv/engines';

  let { code, title, caption, k: k0 = 1, maxK = 20, goal }: { code: string; title?: string; caption?: string; k?: number; maxK?: number; goal?: string } = $props();

  // svelte-ignore state_referenced_locally
  let source = $state(code.replace(/\n$/, ''));
  // svelte-ignore state_referenced_locally
  let k = $state(k0);
  let running = $state(false);
  let error = $state('');
  let names = $state<string[]>([]);
  let base = $state<{ depth: number; violations: { name: string; replayed: boolean; trace?: Trace; length: number }[] } | undefined>();
  let step = $state<{ k: number; inductive: boolean; cti?: ShownState[]; failing?: string[]; timedOut?: boolean } | undefined>();
  let cert = $state<'idle' | 'checking' | 'checked' | 'stopped' | 'failed'>('idle');
  let proofLines = $state(0);
  let checkedSource = $state('');
  let cancel: (() => void) | undefined;

  function run() {
    cancel?.();
    running = true;
    error = '';
    base = undefined;
    step = undefined;
    cert = 'idle';
    checkedSource = source;
    cancel = runInduction({ engine: 'kind', source, k, timeout: 20000, certifyBudget: 120000 }, (e: InductionEvent) => {
      if (e.kind === 'error') error = e.message;
      else if (e.kind === 'invariants') names = e.names;
      else if (e.kind === 'base') base = { depth: e.depth, violations: e.violations };
      else if (e.kind === 'step') {
        step = e;
        running = false;
        if (e.inductive && base && !base.violations.length) cert = 'checking';
      } else if (e.kind === 'certified') {
        cert = e.checked ? 'checked' : e.stopped ? 'stopped' : 'failed';
        proofLines = e.proofLines;
      } else if (e.kind === 'done') running = false;
    });
  }
  onMount(() => {
    run();
    return () => cancel?.();
  });

  const proved = $derived(!!base && !base.violations.length && !!step?.inductive);
  const stale = $derived(source !== checkedSource);
  const rows = $derived(step?.cti ? step.cti[0]!.values.map((v, i) => ({ name: v.name, kind: v.kind, cells: step!.cti!.map((s) => s.values[i]!.value) })) : []);
</script>

<figure class="iw">
  {#if title}<h4 class="ui ttl">{title}</h4>{/if}
  <div class="cols">
    <div class="left">
      <textarea bind:value={source} rows={Math.min(30, source.split('\n').length + 1)} spellcheck="false" wrap="off" aria-label="The system"></textarea>
      <div class="bar ui">
        <label for="iw-k">k = <b>{k}</b></label>
        <input id="iw-k" type="range" min="1" max={maxK} bind:value={k} />
        <button type="button" class="go" onclick={run} disabled={running}>{running ? 'Checking…' : 'Check by k-induction'}</button>
      </div>
      {#if stale && !running}<p class="ui hint">The code has changed since the last check.</p>{/if}
    </div>
    <div class="right">
      {#if error}<p class="err ui">{error}</p>{/if}
      {#if base || step}
        <ul class="lights ui">
          {#if base}
            <li class:ok={!base.violations.length} class:bad={base.violations.length > 0}>
              <span class="lamp" aria-hidden="true"></span>
              <span><b>Base</b>: no run of {base.depth === 0 ? 'zero steps (an initial state)' : `up to ${base.depth} step${base.depth === 1 ? '' : 's'}`} breaks an invariant.
                {#each base.violations as v (v.name)}<span class="cex"> {v.name} fails after {v.length} step{v.length === 1 ? '' : 's'}{v.replayed ? ' (replayed by the interpreter)' : ''}: the invariant is false, not just unproved.</span>{/each}</span>
            </li>
          {/if}
          {#if step}
            <li class:ok={step.inductive} class:bad={!step.inductive}>
              <span class="lamp" aria-hidden="true"></span>
              <span><b>Step</b>: {step.k === 1 ? 'every step from a state satisfying all the invariants leads to a state that satisfies them' : `${step.k} consecutive distinct states satisfying all the invariants are always followed by one that does`}.
                {#if step.timedOut}<span class="cex"> The solver ran out of time.</span>{:else if !step.inductive}<span class="cex"> Not so: see the counterexample to induction below.</span>{/if}</span>
            </li>
          {/if}
        </ul>
        {#if proved}
          <p class="verdict ok ui">✓ Proved for every reachable state{step && step.k > 1 ? ` (${step.k}-inductive)` : ' (inductive)'}.
            {#if cert === 'checking'}<span class="certst">Checking the certificate (the DRAT proofs of both queries)…</span>
            {:else if cert === 'checked'}<span class="certst">Certificate checked: {proofLines.toLocaleString('en-GB')} proof lines.</span>
            {:else if cert === 'stopped'}<span class="certst">The certificate check ran out of time.</span>
            {:else if cert === 'failed'}<span class="certst bad">The certificate was rejected.</span>{/if}</p>
          {#if goal}<p class="goal ui">{goal}</p>{/if}
        {/if}
      {:else if running}
        <p class="ui hint">Checking…</p>
      {/if}
      {#if step?.cti}
        <div class="cti">
          <p class="ui ctih"><b>Counterexample to induction.</b> {step.cti.length - 1 === 1 ? 'Two states' : `${step.cti.length} states`}: every invariant holds in {step.cti.length === 2 ? 'the first' : 'all but the last'}, one step leads from each to the next, and in the last {step.failing?.join(', ')} fail{step.failing?.length === 1 ? 's' : ''}. Is the first state reachable? If not, add an invariant that rules it out.</p>
          <div class="tablewrap">
            <table>
              <thead>
                <tr>
                  <th class="ui"></th>
                  {#each step.cti as _, i (i)}<th class="ui">{i === step.cti.length - 1 ? 'after' : step.cti.length === 2 ? 'before' : `state ${i}`}</th>{/each}
                </tr>
                <tr class="invrow">
                  <th class="ui">invariants</th>
                  {#each step.cti as s, i (i)}
                    <td>{#each names as n, j (n)}<span class="chip ui" class:no={!s.holds[j]} title="{n}: {s.holds[j] ? 'holds' : 'fails'}">{s.holds[j] ? '✓' : '✗'} {n}</span>{/each}</td>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each rows as r (r.name)}
                  <tr>
                    <th class="ui" class:pc={r.kind === 'pc'}>{r.kind === 'pc' ? r.name.replace(/\.pc$/, '') + ' at' : r.name}</th>
                    {#each r.cells as c, i (i)}<td class:changed={i > 0 && c !== r.cells[i - 1]}><code>{c}</code></td>{/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .iw {
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
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 0.9rem;
  }
  @media (max-width: 860px) {
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    line-height: 1.45;
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    white-space: pre;
    overflow-x: auto;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.5rem;
    font-size: 0.85rem;
  }
  .bar input[type='range'] {
    flex: 1 1 8rem;
    accent-color: var(--ink-blue);
  }
  button {
    font-family: var(--font-ui);
    font-size: 0.82rem;
    padding: 0.25rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
  }
  .go {
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .hint {
    font-size: 0.8rem;
    color: var(--mute);
    margin: 0.4rem 0 0;
  }
  .err {
    color: var(--pencil);
    font-size: 0.84rem;
  }
  .lights {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
    font-size: 0.84rem;
  }
  .lights li {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
  }
  .lamp {
    flex: none;
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    background: var(--line-strong);
    transform: translateY(0.1rem);
  }
  .ok .lamp {
    background: var(--seal);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--seal) 25%, transparent);
  }
  .bad .lamp {
    background: var(--pencil);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pencil) 25%, transparent);
  }
  .cex {
    color: var(--pencil);
  }
  .verdict {
    margin: 0.8rem 0 0;
    padding: 0.5rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--seal);
    color: var(--seal);
    font-size: 0.86rem;
    font-weight: 600;
  }
  .certst {
    display: block;
    font-weight: 400;
    font-size: 0.8rem;
    color: var(--ink-2);
    margin-top: 0.2rem;
  }
  .certst.bad {
    color: var(--pencil);
  }
  .goal {
    margin: 0.5rem 0 0;
    font-size: 0.84rem;
    color: var(--fg);
  }
  .cti {
    margin-top: 0.8rem;
    padding: 0.5rem 0.6rem;
    border-left: 3px solid var(--pencil);
    background: color-mix(in srgb, var(--pencil) 5%, transparent);
  }
  .ctih {
    margin: 0 0 0.5rem;
    font-size: 0.82rem;
  }
  .tablewrap {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    font-size: 0.78rem;
  }
  th,
  td {
    padding: 0.2rem 0.45rem;
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
    white-space: nowrap;
  }
  .iw th {
    font-weight: 600;
    color: var(--ink-2);
    font-size: 0.74rem;
    text-transform: none;
    letter-spacing: 0;
  }
  th.pc {
    color: var(--ink-blue);
  }
  td.changed {
    background: color-mix(in srgb, var(--gold) 22%, transparent);
  }
  .iw code {
    all: unset;
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .invrow td {
    white-space: normal;
    min-width: 7rem;
  }
  .chip {
    display: inline-block;
    margin: 0 0.2rem 0.2rem 0;
    padding: 0 0.35rem;
    border-radius: 999px;
    font-size: 0.68rem;
    border: 1px solid var(--seal);
    color: var(--seal);
  }
  .chip.no {
    border-color: var(--pencil);
    color: var(--pencil);
    font-weight: 700;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
