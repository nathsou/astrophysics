<!--
  The encoding lab (chapter 6's flagship): a constraint problem in Vouch, compiled to CNF as you edit it. It shows
  the size of the encoding (one-hot variables, Tseitin variables, clauses), the first clauses with their variables
  named, the number of solutions, and one of them, drawn as a grid when the unknown is a two-dimensional table.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import VouchEditor from '$lib/components/verify/VouchEditor.svelte';
  import { parse } from '$lib/fv/vouch/syntax/parser';
  import { check } from '$lib/fv/vouch/check/checker';
  import { solveProblem, EncodeError, type ProblemResult } from '$lib/fv/problem/encode';
  import { show, type Value, type FuncV } from '$lib/fv/vouch/interp/values';

  let { code, title, caption, limit = 2000 }: { code: string; title?: string; caption?: string; limit?: number } = $props();

  let editor: VouchEditor | undefined = $state();
  let result = $state.raw<ProblemResult | undefined>();
  let error = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;

  function run(src: string) {
    error = '';
    const parsed = parse(src);
    const checked = check(parsed.program);
    const errs = [...parsed.diagnostics, ...checked.diagnostics].filter((d) => d.severity === 'error');
    if (errs.length) {
      error = errs[0]!.message;
      return;
    }
    const p = [...checked.containers.values()].find((c) => c.kind === 'problem');
    if (!p) {
      error = 'There is no `problem` here.';
      return;
    }
    try {
      result = solveProblem(checked, p.decl.name, { limit, keep: 1 });
    } catch (e) {
      error = e instanceof EncodeError ? e.message : e instanceof Error ? e.message : String(e);
    }
  }
  $effect(() => {
    const src = code;
    untrack(() => run(src));
  });
  function changed(src: string) {
    clearTimeout(timer);
    timer = setTimeout(() => run(src), 500);
  }

  const lit = (l: number) => {
    const name = result?.encoding.names.get(Math.abs(l));
    const text = name ?? `t${Math.abs(l)}`;
    return l < 0 ? `¬(${text})` : `(${text})`;
  };
  const preview = $derived(result ? result.encoding.cnf.clauses.slice(0, 40) : []);

  /** A 2D table of a function-valued unknown with pair arguments, for drawing. */
  const grid = $derived.by(() => {
    const sol = result?.solutions[0];
    if (!sol) return undefined;
    for (const [name, v] of sol.values) {
      if (v === null || typeof v !== 'object' || v.t !== 'func') continue;
      const f = v as FuncV;
      const cells = result!.encoding.cells.filter((c) => c.sym.name === name);
      if (!cells.length || !cells.every((c) => c.arg && typeof c.arg === 'object' && (c.arg as { t: string }).t === 'tuple' && (c.arg as { items: Value[] }).items.length === 2)) continue;
      const rows = [...new Set(cells.map((c) => show((c.arg as { items: Value[] }).items[0]!)))];
      const cols = [...new Set(cells.map((c) => show((c.arg as { items: Value[] }).items[1]!)))];
      const at = (r: string, c: string) => {
        const cell = cells.find((x) => show((x.arg as { items: Value[] }).items[0]!) === r && show((x.arg as { items: Value[] }).items[1]!) === c);
        if (!cell) return '';
        const hit = f.entries.find(([k]) => show(k) === show(cell.arg!));
        return show(hit ? hit[1] : f.def);
      };
      return { name, rows, cols, at };
    }
    return undefined;
  });
</script>

<figure class="lab">
  {#if title}<header class="ui"><span class="kicker">Encoding lab</span> <span class="title">{title}</span></header>{/if}
  <VouchEditor bind:this={editor} value={code} name="encoding-lab" minLines={8} maxHeight="22rem" onchange={changed} />
  {#if error}
    <p class="err ui">{error}</p>
  {:else if result}
    <div class="stats ui">
      <div><b>{result.encoding.stats.cells.toLocaleString('en-GB')}</b><span>unknowns</span></div>
      <div><b>{result.encoding.stats.oneHotVars.toLocaleString('en-GB')}</b><span>one-hot variables</span></div>
      <div><b>{result.encoding.stats.tseitinVars.toLocaleString('en-GB')}</b><span>Tseitin variables</span></div>
      <div><b>{result.encoding.stats.clauses.toLocaleString('en-GB')}</b><span>clauses</span></div>
      <div class="count"><b>{result.count.toLocaleString('en-GB')}{result.more ? '+' : ''}</b><span>solution{result.count === 1 ? '' : 's'}</span></div>
      <div><b>{result.ms}</b><span>ms</span></div>
    </div>
    <div class="cols">
      <div class="sol">
        <p class="h ui">{result.count ? 'A solution, checked by the interpreter' : 'No solution'}</p>
        {#if grid}
          <table class="grid">
            <tbody>
              {#each grid.rows as r (r)}<tr>{#each grid.cols as c (c)}<td>{grid.at(r, c)}</td>{/each}</tr>{/each}
            </tbody>
          </table>
        {:else if result.solutions[0]}
          <ul class="vals">{#each [...result.solutions[0].values] as [k, v] (k)}<li><code>{k}</code> = <code>{show(v)}</code></li>{/each}</ul>
        {/if}
      </div>
      <div class="clauses">
        <p class="h ui">The first clauses (each line is an “or”; the formula is all of them)</p>
        <ol>
          {#each preview as c, i (i)}<li><code>{c.map(lit).join(' ∨ ')}</code></li>{/each}
        </ol>
        {#if result.encoding.cnf.clauses.length > preview.length}<p class="more ui">… and {(result.encoding.cnf.clauses.length - preview.length).toLocaleString('en-GB')} more. Variables named t… are Tseitin's.</p>{/if}
      </div>
    </div>
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .lab {
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
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0.7rem 0;
  }
  .stats div {
    display: flex;
    flex-direction: column;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
    min-width: 6rem;
  }
  .stats b {
    font-size: 1.2rem;
    font-variant-numeric: tabular-nums;
  }
  .stats span {
    font-size: 0.72rem;
    color: var(--mute);
  }
  .stats .count {
    border-color: var(--seal);
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    gap: 0.8rem;
  }
  @media (max-width: 760px) {
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .h {
    margin: 0 0 0.3rem;
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .grid {
    border-collapse: collapse;
    font-family: var(--font-mono);
  }
  .grid td {
    width: 2rem;
    height: 2rem;
    text-align: center;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    font-size: 1rem;
  }
  .vals {
    margin: 0;
    padding-left: 1rem;
    font-size: 0.85rem;
  }
  .clauses ol {
    margin: 0;
    padding-left: 2.2rem;
    max-height: 16rem;
    overflow: auto;
    font-size: 0.75rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
  }
  .clauses code {
    font-size: 0.72rem;
    background: none;
  }
  .more {
    font-size: 0.75rem;
    color: var(--mute);
    margin: 0.3rem 0 0;
  }
  .err {
    color: var(--pencil);
  }
  figcaption {
    margin-top: 0.7rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
