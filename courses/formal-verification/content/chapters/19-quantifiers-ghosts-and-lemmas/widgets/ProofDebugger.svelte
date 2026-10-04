<!--
  The proof debugger: every proof obligation of the code, with its status. For a selected obligation: the solver's
  candidate states (a failed proof's model, mapped back to the program's variables), the quantifier instances it
  made (grouped by quantifier, with the round each was made in, so that a matching loop shows as a long chain), and
  the formula itself. Edit the code (add an assert, a lemma call) and verify again: that is assert bisection.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { parse } from '$lib/fv/vouch/syntax/parser';
  import { check } from '$lib/fv/vouch/check/checker';
  import { verifyFunction, type ObligationResult } from '$lib/fv/vouch/vc/verify';
  import { pretty, type Term } from '$lib/fv/logic/term';

  let { code, title, caption }: { code: string; title?: string; caption?: string } = $props();

  // svelte-ignore state_referenced_locally
  let source = $state(code.replace(/\n$/, ''));
  let results = $state.raw<{ fn: string; r: ObligationResult; line: number }[]>([]);
  let error = $state('');
  let selected = $state(0);
  let running = $state(false);
  let showVc = $state(false);

  const clean = (s: string) => s.replace(/!\d+/g, '').replace(/len_(\w+)/g, '|$1|').replace(/_loop\b/g, '');
  const show = (t: Term) => clean(pretty(t));

  function run() {
    error = '';
    running = true;
    try {
      const p = parse(source);
      const c = check(p.program);
      const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
      if (errs.length) {
        error = errs.map((e) => `line ${source.slice(0, e.span.start).split('\n').length}: ${e.message}`).join(' ');
        results = [];
        return;
      }
      const out: { fn: string; r: ObligationResult; line: number }[] = [];
      for (const info of c.fns.values()) {
        if (!info.decl.body || (info.decl.flavour !== 'fn' && info.decl.flavour !== 'lemma')) continue;
        const res = verifyFunction(c, info, { timeout: 3000, certify: false });
        if (res.unsupported) {
          error = `${info.decl.name}: ${res.unsupported}`;
          continue;
        }
        for (const r of res.results) out.push({ fn: info.decl.name, r, line: source.slice(0, r.obligation.span.start).split('\n').length });
      }
      results = out;
      const firstBad = out.findIndex((x) => x.r.status !== 'proved');
      selected = firstBad >= 0 ? firstBad : 0;
    } finally {
      running = false;
    }
  }
  untrack(run);

  const sel = $derived(results[selected]);
  const groups = $derived.by(() => {
    const inst = sel?.r.smt.instances ?? [];
    const by = new Map<Term, { quant: Term; items: { bindings: Term[]; round: number }[] }>();
    for (const i of inst) {
      const g = by.get(i.quant) ?? by.set(i.quant, { quant: i.quant, items: [] }).get(i.quant)!;
      g.items.push({ bindings: i.bindings, round: i.round });
    }
    return [...by.values()].sort((a, b) => b.items.length - a.items.length);
  });
  const loopSuspect = $derived(!!sel && (/instances|rounds/.test(sel.r.smt.reason ?? '') || groups.some((g) => g.items.length >= 30)));
  const proved = $derived(results.filter((x) => x.r.status === 'proved').length);
</script>

<figure class="pd">
  {#if title}<h4 class="ui ttl">{title}</h4>{/if}
  <textarea bind:value={source} rows={Math.min(28, source.split('\n').length + 1)} spellcheck="false" aria-label="The code"></textarea>
  <div class="bar ui">
    <button type="button" class="go" onclick={run} disabled={running}>{running ? 'Verifying…' : 'Verify'}</button>
    <span class="sum">{proved} of {results.length} obligations proved</span>
  </div>
  {#if error}<p class="err ui">{error}</p>{/if}
  {#if results.length}
    <div class="cols">
      <ol class="obs ui">
        {#each results as x, i (i)}
          <li>
            <button type="button" class:sel={selected === i} class:bad={x.r.status !== 'proved'} onclick={() => (selected = i)}>
              <span class="mark">{x.r.status === 'proved' ? '✓' : x.r.status === 'failed' ? '✗' : '?'}</span>
              <span class="ln">{x.fn}, line {x.line}</span>
              <span class="what">{x.r.obligation.message}</span>
              {#if x.r.smt.instances?.length}<span class="n">{x.r.smt.instances.length} inst.</span>{/if}
            </button>
          </li>
        {/each}
      </ol>
      <div class="detail ui">
        {#if sel}
          <p class="head"><b>{sel.r.obligation.message}</b> (line {sel.line}): {sel.r.status === 'proved' ? 'proved.' : sel.r.status === 'failed' ? (sel.r.replay ? `fails: ${sel.r.replay.message} Input: ${sel.r.replay.inputs}.` : 'not proved; the solver found a model.') : `not proved (${sel.r.smt.reason ?? 'unknown'}).`}</p>
          {#if sel.r.states?.length && !sel.r.replay}
            <p class="lab">The solver’s {sel.r.smt.status === 'sat' ? 'counterexample' : 'last candidate'}, as program states</p>
            <table class="states">
              <tbody>
                {#each sel.r.states as s (s.label)}<tr><th>{s.label}</th><td><code>{s.values.map((v) => `${v.name} = ${v.value}`).join(', ')}</code></td></tr>{/each}
              </tbody>
            </table>
          {/if}
          <p class="lab">Quantifier instances ({sel.r.smt.instances?.length ?? 0})</p>
          {#if loopSuspect}<p class="warn">Possible matching loop: one quantifier keeps producing new instances, each creating terms that trigger it again.</p>{/if}
          {#if groups.length}
            {#each groups as g, gi (gi)}
              <div class="grp">
                <p><code>{show(g.quant)}</code> <span class="cnt">× {g.items.length}</span></p>
                <ol class="inst">
                  {#each g.items.slice(0, 14) as it, k (k)}<li><span class="rd">round {it.round}</span> <code>{g.quant.bound!.map((b, j) => `${clean(b.name!)} ↦ ${show(it.bindings[j]!)}`).join(', ')}</code></li>{/each}
                  {#if g.items.length > 14}<li class="more">… {g.items.length - 14} more</li>{/if}
                </ol>
              </div>
            {/each}
          {:else}
            <p class="none">None: this obligation was decided without instantiating any quantifier.</p>
          {/if}
          <button type="button" class="link" onclick={() => (showVc = !showVc)}>{showVc ? 'Hide' : 'Show'} the formula</button>
          {#if showVc}
            <div class="vc"><p class="lab">Assuming</p>{#each sel.r.obligation.hyps as h, i (i)}<p><code>{show(h)}</code></p>{/each}<p class="lab">prove</p><p><code>{show(sel.r.obligation.goal)}</code></p></div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .pd {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .ttl {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
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
    resize: vertical;
  }
  .bar {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    margin: 0.4rem 0;
  }
  .go {
    font-family: var(--font-ui);
    font-size: 0.85rem;
    padding: 0.25rem 0.9rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ink-blue);
    background: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
    cursor: pointer;
  }
  .sum {
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .err {
    color: var(--pencil);
    font-size: 0.82rem;
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.3fr);
    gap: 0.8rem;
  }
  @media (max-width: 820px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  .obs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.2rem;
    max-height: 26rem;
    overflow: auto;
    font-size: 0.78rem;
    align-content: start;
  }
  .obs button {
    display: grid;
    grid-template-columns: 1rem auto 1fr auto;
    gap: 0.35rem;
    width: 100%;
    text-align: left;
    padding: 0.2rem 0.35rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
  }
  .obs button.sel {
    border-color: var(--ink-blue);
    box-shadow: 0 0 0 1px var(--ink-blue);
  }
  .obs .mark {
    color: var(--seal);
    font-weight: 700;
  }
  .obs .bad .mark {
    color: var(--pencil);
  }
  .ln {
    color: var(--mute);
    white-space: nowrap;
  }
  .what {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .n {
    color: var(--gold);
    white-space: nowrap;
  }
  .detail {
    font-size: 0.82rem;
    min-width: 0;
  }
  .head {
    margin: 0 0 0.4rem;
  }
  .lab {
    margin: 0.6rem 0 0.2rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .pd code {
    all: unset;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .states {
    border-collapse: collapse;
    margin: 0;
  }
  .states th {
    text-align: left;
    font-weight: 600;
    color: var(--ink-2);
    padding: 0.1rem 0.5rem 0.1rem 0;
    vertical-align: top;
    white-space: nowrap;
    width: 1%;
  }
  .warn {
    color: var(--pencil);
    font-weight: 600;
  }
  .grp {
    margin: 0.3rem 0;
    padding: 0.3rem 0.5rem;
    border-left: 3px solid var(--gold);
    background: var(--panel);
  }
  .grp p {
    margin: 0;
  }
  .cnt {
    color: var(--gold);
    font-weight: 700;
  }
  .inst {
    margin: 0.2rem 0 0;
    padding-left: 1.2rem;
  }
  .rd {
    color: var(--mute);
    font-size: 0.72rem;
  }
  .more,
  .none {
    color: var(--mute);
  }
  .link {
    margin-top: 0.5rem;
    background: none;
    border: none;
    color: var(--ink-blue);
    cursor: pointer;
    padding: 0;
    font: inherit;
    text-decoration: underline;
  }
  .vc p {
    margin: 0.15rem 0;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
