<!--
  The interval analyser: the abstract state at every program point of a function, the iterations at each loop
  head (joins, widening, narrowing), the checks with their verdicts, and a number line comparing a variable's
  abstract value with the concrete values seen when the function runs on sample inputs. Alarms can be triaged:
  boundary inputs, then symbolic execution, look for an input that really fails.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { parse } from '$lib/fv/vouch/syntax/parser';
  import { check, type Checked, type FnInfo } from '$lib/fv/vouch/check/checker';
  import { analyse, type AnalysisResult } from '$lib/fv/absint/analyse';
  import { NonRelational, IntervalValues, SignValues, type StateDomain } from '$lib/fv/absint/domain';
  import { Octagons } from '$lib/fv/absint/octagon';
  import { triage, type Triaged } from '$lib/fv/absint/triage';
  import { Runner } from '$lib/fv/vouch/interp/exec';
  import { rng } from '$lib/fv/util/random';
  import type { Value } from '$lib/fv/vouch/interp/values';

  let { code, fn: fnName, title, caption, domains = 'intervals', delay: delay0 = 2, goal }: { code: string; fn?: string; title?: string; caption?: string; domains?: string; delay?: number; goal?: string } = $props();

  // svelte-ignore state_referenced_locally
  let source = $state(code.replace(/\n$/, ''));
  // svelte-ignore state_referenced_locally
  const domainList = domains.split(',').map((d) => d.trim());
  // svelte-ignore state_referenced_locally
  let domain = $state(domainList[0]!);
  // svelte-ignore state_referenced_locally
  let delay = $state(delay0);
  let widening = $state(true);
  let narrowing = $state(true);
  let editing = $state(false);
  let error = $state('');
  let result = $state.raw<AnalysisResult | undefined>();
  let triaged = $state.raw<Triaged[] | undefined>();
  let triaging = $state(false);
  let loopIdx = $state(0);
  let selected = $state<{ line: number; v: string } | undefined>();
  let samples = $state.raw<{ span: number; vars: Record<string, string> }[]>([]);
  let ctx: { checked: Checked; info: FnInfo } | undefined;

  const makeDomain = (): StateDomain<unknown> => (domain === 'signs' ? new NonRelational(SignValues) : domain === 'octagons' ? new Octagons() : new NonRelational(IntervalValues)) as StateDomain<unknown>;

  function run() {
    error = '';
    triaged = undefined;
    const p = parse(source);
    const c = check(p.program);
    const errs = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error');
    if (errs.length) {
      error = errs.map((e) => e.message).join(' ');
      result = undefined;
      return;
    }
    const name = fnName ?? [...c.fns.keys()][0]!;
    const info = c.fns.get(name);
    if (!info) {
      error = `No function ${name}.`;
      return;
    }
    ctx = { checked: c, info };
    result = analyse(c, info, makeDomain(), source, { widenDelay: delay, noWidening: !widening, narrowing: narrowing ? 1 : 0, maxIterations: 40 });
    loopIdx = Math.min(loopIdx, Math.max(0, result.loops.length - 1));
    samples = sampleRuns(c, info);
  }

  /** Run the function on sample inputs (boundary values and seeded random ones), recording variable values. */
  function sampleRuns(c: Checked, info: FnInfo): { span: number; vars: Record<string, string> }[] {
    const r = rng(26);
    const out: { span: number; vars: Record<string, string> }[] = [];
    const pickFor = (ty: FnInfo['params'][number]['ty']): Value | undefined => {
      if (ty.k === 'bool') return r.chance(0.5);
      if (ty.k === 'int' || ty.k === 'nat' || ty.k === 'mach' || ty.k === 'range') {
        const lo = ty.k === 'nat' || (ty.k === 'mach' && !ty.signed) ? 0 : ty.k === 'range' ? Number(ty.lo) : -12;
        const hi = ty.k === 'range' ? Number(ty.hi) - 1 : 12;
        return BigInt(r.int(lo, hi + 1));
      }
      if (ty.k === 'seq' && (ty.elem.k === 'int' || ty.elem.k === 'nat')) return { t: 'seq', items: Array.from({ length: r.int(0, 6) }, () => BigInt(r.int(0, 10))) } as Value;
      return undefined;
    };
    for (let k = 0; k < 60; k++) {
      const args = info.params.map((p) => pickFor(p.ty));
      if (args.some((a) => a === undefined)) return out;
      const res = new Runner(c, { fuel: 20_000, trace: 400 }).run(info.decl.name, args as Value[]);
      if (res.discarded) continue;
      for (const t of res.trace) if (t.fn === info.decl.name) out.push({ span: t.span.start, vars: t.vars });
    }
    return out;
  }

  untrack(run);

  function doTriage() {
    if (!result || !ctx) return;
    triaging = true;
    const { checked, info } = ctx;
    const checks = result.checks;
    setTimeout(() => {
      try {
        triaged = triage(checked, info, source, checks).checks;
      } finally {
        triaging = false;
      }
    }, 30);
  }

  const lines = $derived(source.split('\n'));
  // The state shown on each line: the last statement starting there (a loop head shows its invariant).
  const byLine = $derived.by(() => {
    const m = new Map<number, { vars: Record<string, string>; relations: string[]; loopHead?: boolean; span: number }>();
    for (const p of result?.points ?? []) m.set(p.line, { ...p.state, loopHead: p.loopHead, span: p.span.start });
    return m;
  });
  const checksByLine = $derived.by(() => {
    const m = new Map<number, (Triaged | AnalysisResult['checks'][number])[]>();
    for (const c of triaged ?? result?.checks ?? []) m.set(c.line, [...(m.get(c.line) ?? []), c]);
    return m;
  });
  const statusOf = (c: Triaged | AnalysisResult['checks'][number]) => ('verdict' in c ? c.verdict : c.status);
  const loop = $derived(result?.loops[loopIdx]);
  const varsOf = $derived(Object.keys(result?.points.at(-1)?.state.vars ?? {}));

  // The number line for the selected variable at the selected line.
  const numberLine = $derived.by(() => {
    if (!selected || !result) return undefined;
    const pt = byLine.get(selected.line);
    if (!pt) return undefined;
    const abs = pt.vars[selected.v];
    if (abs === undefined) return undefined;
    // At a loop head, the concrete values are those entering the loop and those at the end of each iteration.
    let spans = [pt.span];
    if (pt.loopHead) {
      const head = result.points.find((p) => p.span.start === pt.span)!;
      const inside = result.points.filter((p) => p.span.start > head.span.start && p.span.end <= head.span.end);
      const before = result.points.filter((p) => p.span.end <= head.span.start).at(-1);
      spans = [...(inside.length ? [inside.at(-1)!.span.start] : []), ...(before ? [before.span.start] : [])];
    }
    const concrete = samples.filter((s) => spans.includes(s.span)).map((s) => s.vars[selected!.v]).filter((x): x is string => x !== undefined && /^-?\d+$/.test(x)).map(Number);
    const m = /^\[(−∞|-?\d+), (\+∞|-?\d+)\]$/.exec(abs);
    const single = /^-?\d+$/.test(abs) ? Number(abs) : undefined;
    const lo = single ?? (m ? (m[1] === '−∞' ? -Infinity : Number(m[1])) : -Infinity);
    const hi = single ?? (m ? (m[2] === '+∞' ? Infinity : Number(m[2])) : Infinity);
    const finite = [...concrete, ...(Number.isFinite(lo) ? [lo] : []), ...(Number.isFinite(hi) ? [hi] : [])];
    const minV = Math.min(0, ...finite) - 2;
    const maxV = Math.max(10, ...finite) + 2;
    return { abs, lo, hi, concrete: [...new Set(concrete)], minV, maxV };
  });
  const X = (v: number, nl: { minV: number; maxV: number }) => 20 + ((v - nl.minV) / (nl.maxV - nl.minV)) * 460;
</script>

<figure class="ia">
  {#if title}<h4 class="ui ttl">{title}</h4>{/if}
  <div class="bar ui">
    {#if domainList.length > 1}
      <label>Domain <select bind:value={domain} onchange={run}>{#each domainList as d (d)}<option value={d}>{d}</option>{/each}</select></label>
    {/if}
    <label><input type="checkbox" bind:checked={widening} onchange={run} /> widening</label>
    {#if widening}<label>after <input type="number" min="0" max="8" bind:value={delay} onchange={run} /> iterations</label>{/if}
    <label><input type="checkbox" bind:checked={narrowing} onchange={run} /> narrowing</label>
    <button type="button" onclick={() => (editing ? ((editing = false), run()) : (editing = true))}>{editing ? 'Analyse' : 'Edit the code'}</button>
  </div>
  {#if error}<p class="err ui">{error}</p>{/if}
  {#if editing}
    <textarea bind:value={source} rows={lines.length + 1} spellcheck="false" wrap="off" aria-label="The function"></textarea>
  {:else if result}
    <div class="listing" aria-label="The function with the abstract state after each line">
      {#each lines as l, i (i)}
        {@const st = byLine.get(i + 1)}
        {@const cs = checksByLine.get(i + 1) ?? []}
        <div class="row" class:head={st?.loopHead}>
          <span class="ln">{i + 1}</span>
          <code class="src">{l || ' '}</code>
          <span class="ann ui">
            {#each cs as c, k (k)}<span class="chk {statusOf(c)}" title={c.message}>{statusOf(c) === 'proved' ? '✓' : statusOf(c) === 'confirmed' ? '✗' : '⚠'} {c.kind}</span>{/each}
            {#if st}
              {#if st.loopHead}<span class="lh">loop head</span>{/if}
              {#each Object.entries(st.vars) as [v, a] (v)}<button type="button" class="var" class:sel={selected?.line === i + 1 && selected.v === v} onclick={() => (selected = { line: i + 1, v })}><b>{v}</b> {a}</button>{/each}
              {#each st.relations as r (r)}<span class="rel">{r}</span>{/each}
            {/if}
          </span>
        </div>
      {/each}
    </div>
    {#if numberLine && selected}
      <div class="nl">
        <p class="sub ui">{selected.v} after line {selected.line}: abstract value {numberLine.abs}; dots are values seen in {samples.length ? 'sample runs' : 'no runs'}</p>
        <svg viewBox="0 0 500 56" role="img" aria-label="Number line">
          <line x1="10" y1="34" x2="490" y2="34" class="axis" />
          {#if numberLine.hi >= numberLine.minV && numberLine.lo <= numberLine.maxV}
            <rect x={Number.isFinite(numberLine.lo) ? X(numberLine.lo, numberLine) - 4 : 10} y="24" width={Math.max(8, (Number.isFinite(numberLine.hi) ? X(numberLine.hi, numberLine) + 4 : 490) - (Number.isFinite(numberLine.lo) ? X(numberLine.lo, numberLine) - 4 : 10))} height="20" rx="4" class="abs" />
          {/if}
          {#if !Number.isFinite(numberLine.lo)}<text x="12" y="20" class="inf">← −∞</text>{/if}
          {#if !Number.isFinite(numberLine.hi)}<text x="488" y="20" class="inf" text-anchor="end">+∞ →</text>{/if}
          {#each numberLine.concrete as v (v)}<circle cx={X(v, numberLine)} cy="34" r="3.5" class="dot" />{/each}
          {#each [numberLine.minV + 2, numberLine.maxV - 2] as t (t)}<text x={X(t, numberLine)} y="54" class="tick" text-anchor="middle">{t}</text>{/each}
        </svg>
      </div>
    {:else}
      <p class="hint ui">Click a variable's value to compare it with the values seen in sample runs.</p>
    {/if}
    {#if result.loops.length}
      <div class="loops">
        <p class="sub ui">Iterations at the loop head
          {#if result.loops.length > 1}<select bind:value={loopIdx}>{#each result.loops as l, i (i)}<option value={i}>line {l.line}</option>{/each}</select>{:else}(line {result.loops[0]!.line}){/if}</p>
        {#if loop}
          <ol class="iters">
            {#each loop.iterations as it, i (i)}
              <li class={it.how}><span class="how ui">{it.how === 'entry' ? 'entry' : it.how === 'stable' ? 'stable: the next iteration adds nothing' : it.how === 'widen' ? 'widen' : it.how === 'narrow' ? 'narrow' : 'join'}</span>
                <code>{Object.entries(it.state.vars).map(([k, v]) => `${k} ${v}`).join(',  ')}{it.state.relations.length ? ';  ' + it.state.relations.join(', ') : ''}</code></li>
            {/each}
          </ol>
          {#if loop.capped}<p class="err ui">Without widening, the iteration did not stabilise: stopped after {loop.iterations.length - 1} iterations. The state shown is not a fixpoint, and the checks after it are not sound.</p>{/if}
        {/if}
      </div>
    {/if}
    <div class="checks ui">
      {#each triaged ?? result.checks as c, i (i)}
        <p class="ck {statusOf(c)}"><b>{statusOf(c) === 'proved' ? '✓ proved' : statusOf(c) === 'confirmed' ? '✗ confirmed' : statusOf(c) === 'unconfirmed' ? '⚠ unconfirmed alarm' : '⚠ alarm'}</b>, line {c.line}, {c.kind}: {c.message}
          {#if 'input' in c && c.input} Fails on {c.input} (replayed): {(c as Triaged).failure}{/if}
          {#if statusOf(c) === 'unconfirmed'} No failing input found: possibly a false alarm.{/if}</p>
      {/each}
      {#if goal && result.checks.length && result.checks.every((c) => c.status === 'proved')}<p class="goal">✓ {goal}</p>{/if}
      {#if result.checks.some((c) => c.status === 'alarm') && !triaged}
        <button type="button" class="go" onclick={doTriage} disabled={triaging}>{triaging ? 'Triaging…' : 'Triage the alarms'}</button>
      {/if}
    </div>
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .ia {
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
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.9rem;
    align-items: center;
    font-size: 0.82rem;
    margin-bottom: 0.6rem;
  }
  .bar input[type='number'] {
    width: 3rem;
  }
  select,
  input[type='number'] {
    font-family: var(--font-ui);
    font-size: 0.8rem;
    background: var(--panel);
    color: var(--fg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
  }
  button {
    font-family: var(--font-ui);
    font-size: 0.8rem;
    padding: 0.2rem 0.6rem;
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
  textarea {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    white-space: pre;
  }
  .listing {
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
    overflow-x: auto;
    padding: 0.3rem 0;
  }
  .row {
    display: grid;
    grid-template-columns: 2rem minmax(16rem, max-content) minmax(14rem, 1fr);
    gap: 0.5rem;
    align-items: baseline;
    min-height: 1.4rem;
  }
  @media (max-width: 700px) {
    .row {
      grid-template-columns: 2rem minmax(0, 1fr);
    }
    .ann {
      grid-column: 2;
      padding-bottom: 0.2rem;
    }
  }
  .row.head {
    background: color-mix(in srgb, var(--gold) 10%, transparent);
  }
  .ln {
    text-align: right;
    color: var(--mute);
    font-family: var(--font-mono);
    font-size: 0.74rem;
  }
  .ia code {
    all: unset;
    font-family: var(--font-mono);
    font-size: 0.76rem;
  }
  .ia code.src {
    white-space: pre;
  }
  .ann {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    font-size: 0.72rem;
    padding-right: 0.4rem;
  }
  .var {
    padding: 0 0.35rem;
    font-size: 0.72rem;
    border-color: var(--line);
    font-family: var(--font-mono);
  }
  .var b {
    font-weight: 600;
    color: var(--ink-blue);
  }
  .var.sel {
    border-color: var(--gold);
    background: color-mix(in srgb, var(--gold) 15%, var(--panel));
  }
  .rel {
    font-family: var(--font-mono);
    color: var(--seal);
  }
  .lh {
    color: var(--gold);
    font-weight: 700;
  }
  .chk {
    padding: 0 0.35rem;
    border-radius: 999px;
    border: 1px solid;
    font-weight: 700;
  }
  .chk.proved {
    color: var(--seal);
  }
  .chk.alarm,
  .chk.unconfirmed {
    color: var(--gold);
  }
  .chk.confirmed {
    color: var(--pencil);
  }
  .hint {
    font-size: 0.78rem;
    color: var(--mute);
  }
  .sub {
    margin: 0.7rem 0 0.25rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .nl svg {
    display: block;
    width: 100%;
    max-width: 640px;
    height: auto;
  }
  .axis {
    stroke: var(--line-strong);
  }
  .abs {
    fill: color-mix(in srgb, var(--ink-blue) 22%, transparent);
    stroke: var(--ink-blue);
  }
  .dot {
    fill: var(--pencil);
  }
  .inf,
  .tick {
    font-family: var(--font-ui);
    font-size: 10px;
    fill: var(--ink-2);
  }
  .iters {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.2rem;
  }
  .iters li {
    display: grid;
    grid-template-columns: 7.5rem minmax(0, 1fr);
    gap: 0.5rem;
    align-items: baseline;
  }
  .how {
    font-size: 0.74rem;
    font-weight: 700;
    color: var(--ink-2);
  }
  .widen .how {
    color: var(--gold);
  }
  .narrow .how {
    color: var(--ink-blue);
  }
  .stable .how {
    color: var(--seal);
  }
  .err {
    color: var(--pencil);
    font-size: 0.82rem;
  }
  .checks {
    margin-top: 0.7rem;
    font-size: 0.82rem;
  }
  .ck {
    margin: 0.25rem 0;
  }
  .ck.proved b {
    color: var(--seal);
  }
  .ck.alarm b,
  .ck.unconfirmed b {
    color: var(--gold);
  }
  .ck.confirmed b {
    color: var(--pencil);
  }
  .goal {
    color: var(--seal);
    font-weight: 600;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
