<!--
  Truth-table laboratory: type one or two formulas; see the table, whether each is a tautology or
  satisfiable, and whether the two are equivalent (rows where they differ are highlighted).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Tex from '$lib/components/exercise/Tex.svelte';
  import { parseFormula, formulaTex, variables, assignments, evaluate, type Formula } from '$lib/logic/prop';

  let { f = 'p -> q', g = '~q -> ~p', title = 'Truth-table lab' }: { f?: string; g?: string; title?: string } = $props();

  // svelte-ignore state_referenced_locally
  let src1 = $state(f);
  // svelte-ignore state_referenced_locally
  let src2 = $state(g);

  function parse(s: string): { f?: Formula; err?: string } {
    if (!s.trim()) return {};
    try {
      return { f: parseFormula(s) };
    } catch (e) {
      return { err: e instanceof Error ? e.message : String(e) };
    }
  }
  const p1 = $derived(parse(src1));
  const p2 = $derived(parse(src2));
  const vars = $derived([...new Set([...(p1.f ? variables(p1.f) : []), ...(p2.f ? variables(p2.f) : [])])].sort());
  const rows = $derived(vars.length <= 5 ? assignments(vars).map((env) => ({ env, a: p1.f ? evaluate(p1.f, env) : undefined, b: p2.f ? evaluate(p2.f, env) : undefined })) : []);
  const status = (col: 'a' | 'b') => {
    const vals = rows.map((r) => r[col]);
    if (vals.some((v) => v === undefined) || !vals.length) return '';
    if (vals.every(Boolean)) return 'tautology — true in every row';
    if (!vals.some(Boolean)) return 'contradiction — false in every row';
    return 'satisfiable, not a tautology';
  };
  const equiv = $derived(p1.f && p2.f ? rows.every((r) => r.a === r.b) : null);
  const insert = (sym: string, which: 1 | 2) => {
    if (which === 1) src1 += sym;
    else src2 += sym;
  };
</script>

<Widget {title} subtitle="Type formulas with ¬ ∧ ∨ → ↔ (or ~ & | -> <->). Variables are letters.">
  {#snippet controls()}
    <div class="inputs">
      {#each [1, 2] as which (which)}
        <label class="in">
          <span class="lab">{which === 1 ? 'A' : 'B'}</span>
          {#if which === 1}
            <input bind:value={src1} spellcheck="false" aria-label="Formula A" />
          {:else}
            <input bind:value={src2} spellcheck="false" aria-label="Formula B (optional)" placeholder="optional second formula" />
          {/if}
          <span class="keys">
            {#each ['¬', '∧', '∨', '→', '↔'] as k (k)}<button onclick={() => insert(k, which as 1 | 2)} tabindex="-1">{k}</button>{/each}
          </span>
        </label>
      {/each}
    </div>
  {/snippet}
  {#if p1.err || p2.err}<p class="err">⚠ {p1.err ?? p2.err}</p>{/if}
  {#if vars.length > 5}
    <p class="err">Up to five variables, please ({vars.length} used: 2⁵ = 32 rows is plenty).</p>
  {:else if rows.length}
    <div class="scroll">
      <table class="tt num">
        <thead>
          <tr>
            {#each vars as v (v)}<th class="var"><Tex tex={v} /></th>{/each}
            {#if p1.f}<th class="res"><Tex tex={formulaTex(p1.f)} /></th>{/if}
            {#if p2.f}<th class="res"><Tex tex={formulaTex(p2.f)} /></th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each rows as r, i (i)}
            <tr class:diff={p1.f && p2.f && r.a !== r.b}>
              {#each vars as v (v)}<td class="var" class:t={r.env[v]}>{r.env[v] ? 'T' : 'F'}</td>{/each}
              {#if p1.f}<td class="res" class:t={r.a}>{r.a ? 'T' : 'F'}</td>{/if}
              {#if p2.f}<td class="res" class:t={r.b}>{r.b ? 'T' : 'F'}</td>{/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <ul class="status">
      {#if p1.f}<li><strong>A</strong> is {status('a')}.</li>{/if}
      {#if p2.f}<li><strong>B</strong> is {status('b')}.</li>{/if}
      {#if equiv !== null}
        <li class:ok={equiv} class:bad={!equiv}>{equiv ? 'A and B are equivalent: they agree in every row.' : 'A and B are not equivalent: they differ in the highlighted rows.'}</li>
      {/if}
    </ul>
  {/if}
</Widget>

<style>
  .inputs {
    display: grid;
    gap: 0.4rem;
    width: 100%;
  }
  .in {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .lab {
    font-weight: 700;
    color: var(--accent);
    width: 1rem;
  }
  .in input {
    flex: 1 1 8rem;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: 0.9rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--page);
    color: var(--ink);
  }
  .keys {
    display: flex;
    gap: 0.15rem;
  }
  .keys button {
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 4px;
    width: 1.7rem;
    height: 1.7rem;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .scroll {
    overflow-x: auto;
  }
  .tt {
    width: auto;
    margin: 0 auto;
    border-collapse: collapse;
  }
  .tt th,
  .tt td {
    padding: 0.25rem 0.8rem;
    text-align: center;
    border-bottom: 1px solid var(--rule);
  }
  .tt .res {
    border-left: 2px solid var(--rule-strong);
    font-weight: 600;
  }
  .tt td {
    color: var(--bad);
  }
  .tt td.t {
    color: var(--ok);
  }
  .tt td.var {
    color: var(--ink-2);
  }
  tr.diff td {
    background: var(--maybe-soft);
  }
  .status {
    margin: 0.7rem 0 0;
    padding-left: 1.1rem;
    font-size: 0.85rem;
  }
  .ok {
    color: var(--ok);
    font-weight: 600;
  }
  .bad {
    color: var(--bad);
    font-weight: 600;
  }
  .err {
    color: var(--maybe);
    font-size: 0.85rem;
  }
</style>
