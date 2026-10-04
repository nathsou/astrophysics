<!--
  The wp stepper: the postcondition flows backwards through the function, one statement at a time. Between the
  statements, the predicate that must hold at that point; at the top, the verification condition (precondition
  implies wp), checked by the solver. The VC inspector shows the exact SMT-LIB query.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { checkVc, computeWp, fromVouch, showFormula, smtlibOf, WpError, type Annotation, type WpProgram, type WpResult, type WStmt } from '$lib/fv/wp/wp';

  let { code, title, caption }: { code: string; title?: string; caption?: string } = $props();

  // svelte-ignore state_referenced_locally
  let source = $state(code.replace(/\n$/, ''));
  let editing = $state(false);
  let prog = $state.raw<WpProgram | undefined>();
  let res = $state.raw<WpResult | undefined>();
  let error = $state('');
  let shown = $state(0);
  let checks = $state.raw<ReturnType<typeof checkVc> | undefined>();
  let inspect = $state(false);
  let hover = $state<WStmt | undefined>();

  function load() {
    error = '';
    checks = undefined;
    shown = 0;
    try {
      prog = fromVouch(source);
      res = computeWp(prog);
    } catch (e) {
      if (!(e instanceof WpError)) throw e;
      error = e.message;
      prog = undefined;
      res = undefined;
    }
  }
  untrack(load);

  const total = $derived(res?.annotations.length ?? 0);
  const revealed = $derived(new Set((res?.annotations ?? []).slice(0, shown).map((a) => a.stmt)));
  const byStmt = $derived(new Map((res?.annotations ?? []).map((a) => [a.stmt, a] as [WStmt, Annotation])));
  function back() {
    if (shown < total) shown++;
    if (shown === total && prog && res && !checks) checks = checkVc(prog, res);
  }
  function all() {
    shown = total;
    if (prog && res) checks = checkVc(prog, res);
  }

  type Row = { kind: 'stmt'; s: WStmt; depth: number; text: string } | { kind: 'pred'; f?: string; depth: number; on: boolean; label?: string; hl: boolean } | { kind: 'close'; depth: number; text: string };
  const rows = $derived.by(() => {
    if (!prog || !res) return [] as Row[];
    const out: Row[] = [];
    const pred = (a: Annotation | undefined, which: 'pre' | 'post', depth: number, label?: string) => {
      const on = !!a && (revealed.has(a.stmt) || (which === 'post' && depth === 0));
      out.push({ kind: 'pred', f: a ? showFormula(a[which]) : undefined, depth, on, label, hl: !!a && hover === a.stmt });
    };
    const walk = (ss: WStmt[], depth: number) => {
      ss.forEach((s, i) => {
        const a = byStmt.get(s);
        pred(a, 'pre', depth);
        if (s.k === 'if') {
          out.push({ kind: 'stmt', s, depth, text: s.text.replace(/\{\s*$/, '{') });
          walk(s.then, depth + 1);
          if (s.else.length) {
            out.push({ kind: 'close', depth, text: '} else {' });
            walk(s.else, depth + 1);
          }
          out.push({ kind: 'close', depth, text: '}' });
        } else if (s.k === 'while') {
          out.push({ kind: 'stmt', s, depth, text: s.text });
          out.push({ kind: 'close', depth: depth + 1, text: `… body: wp of the body for the invariant (a side condition, below)` });
          out.push({ kind: 'close', depth, text: '}' });
        } else out.push({ kind: 'stmt', s, depth, text: s.text });
        if (i === ss.length - 1 && s.k !== 'return') pred(a, 'post', depth);
      });
    };
    walk(prog.body, 0);
    return out;
  });
  const pre = $derived(prog ? showFormula(prog.pre) : '');
  const post = $derived(prog ? showFormula(prog.post) : '');
</script>

<figure class="wps">
  {#if title}<h4 class="ui ttl">{title}</h4>{/if}
  <div class="bar ui">
    <button type="button" class="go" onclick={back} disabled={!res || shown >= total || editing}>Step back one statement</button>
    <button type="button" onclick={all} disabled={!res || editing}>All the way</button>
    <button type="button" onclick={() => ((shown = 0), (checks = undefined))} disabled={!res || editing}>Restart</button>
    <button type="button" onclick={() => (inspect = !inspect)} disabled={!res}>{inspect ? 'Hide' : 'Show'} the SMT query</button>
    <button type="button" onclick={() => (editing ? ((editing = false), load()) : (editing = true))}>{editing ? 'Done editing' : 'Edit the code'}</button>
  </div>
  {#if editing}
    <textarea bind:value={source} rows={source.split('\n').length + 1} spellcheck="false" aria-label="The function"></textarea>
  {:else if error}
    <p class="err ui">{error}</p>
  {:else if prog}
    <div class="prog">
      <div class="head"><code>fn {prog.name}(…)</code></div>
      <div class="pre ui">requires <code>{pre}</code></div>
      <div class="post ui">ensures <code>{post}</code> <span class="note">(result is the returned value)</span></div>
      <div class="lines">
        {#each rows as r, i (i)}
          {#if r.kind === 'stmt'}
            <div class="stmt" style="padding-left: {r.depth * 1.4 + 0.5}rem" role="presentation" onmouseenter={() => (hover = r.s)} onmouseleave={() => (hover = undefined)}><code>{r.text}</code></div>
          {:else if r.kind === 'close'}
            <div class="stmt dim" style="padding-left: {r.depth * 1.4 + 0.5}rem"><code>{r.text}</code></div>
          {:else}
            <div class="pred" class:on={r.on} class:hl={r.hl} style="margin-left: {r.depth * 1.4 + 0.5}rem">{#if r.on}<span class="brace">{'{'}</span> <code>{r.f}</code> <span class="brace">{'}'}</span>{:else}<span class="q">?</span>{/if}</div>
          {/if}
        {/each}
      </div>
    </div>
    <p class="ui count">{shown} of {total} statements processed{shown === 0 ? ': press Step back to start from the postcondition at the bottom.' : '.'}</p>
    {#if checks}
      <div class="vc ui">
        {#each checks as c, i (i)}
          <p class:ok={c.result.valid} class:bad={!c.result.valid}>
            <span class="mark">{c.result.valid ? '✓' : c.result.status === 'invalid' ? '✗' : '?'}</span>
            <span>{c.label}: <code>{showFormula(c.formula)}</code>
              {#if c.result.valid} is valid.{:else if c.result.counterexample} is not valid: {c.result.counterexample.map(([k, val]) => `${k} = ${val}`).join(', ')}.{:else} could not be decided ({c.result.reason}).{/if}</span>
          </p>
        {/each}
      </div>
    {/if}
    {#if inspect && res}
      <pre class="smt"><code>{smtlibOf(prog, res)}</code></pre>
      <p class="ui note">The negation of the verification condition, as SMT-LIB. If it is unsatisfiable, the condition is valid and the function meets its contract.</p>
    {/if}
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .wps {
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
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.6rem;
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
  textarea {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .err {
    color: var(--pencil);
  }
  .prog {
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
    padding: 0.5rem 0.4rem;
    overflow-x: auto;
  }
  .wps code {
    all: unset;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .head,
  .pre,
  .post {
    padding: 0.1rem 0.5rem;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .note {
    color: var(--mute);
    font-size: 0.75rem;
  }
  .lines {
    margin-top: 0.4rem;
  }
  .stmt {
    padding: 0.12rem 0.5rem;
  }
  .stmt:hover {
    background: color-mix(in srgb, var(--ink-blue) 8%, transparent);
  }
  .stmt.dim code {
    color: var(--mute);
  }
  .pred {
    margin: 0.1rem 0.5rem 0.1rem 0;
    padding: 0.08rem 0.45rem;
    border-left: 3px solid var(--line);
    font-size: 0.78rem;
    color: var(--mute);
  }
  .pred.on {
    border-left-color: var(--ink-blue);
    background: color-mix(in srgb, var(--ink-blue) 7%, transparent);
    color: var(--ink-blue);
  }
  .pred.hl {
    background: color-mix(in srgb, var(--gold) 18%, transparent);
  }
  .brace {
    color: var(--mute);
  }
  .q {
    font-family: var(--font-ui);
  }
  .count {
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .vc p {
    display: flex;
    gap: 0.4rem;
    margin: 0.3rem 0;
    font-size: 0.84rem;
  }
  .vc .ok .mark {
    color: var(--seal);
  }
  .vc .bad .mark,
  .vc .bad {
    color: var(--pencil);
  }
  .smt {
    max-height: 18rem;
    overflow: auto;
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: var(--panel);
    font-size: 0.75rem;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
