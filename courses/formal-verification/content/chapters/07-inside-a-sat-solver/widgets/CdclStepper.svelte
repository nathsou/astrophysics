<!--
  The CDCL stepper (chapter 7's flagship). The clauses on the left, coloured by state; the trail across the top,
  grouped by decision level; the implication graph below it. Choose decisions yourself or let the solver choose;
  propagate one unit clause at a time; when a clause becomes false, predict the learned clause and the backjump
  level (in drive mode), then watch the analysis: the resolution steps back to the first unique implication point.
-->
<script lang="ts">
  import { Stepper, type Analysis } from '$lib/fv/sat/stepper';
  import { progress } from '$lib/state/progress.svelte';

  let {
    clauses,
    nvars,
    names,
    drive = false,
    id,
    caption,
  }: {
    clauses: number[][];
    nvars: number;
    /** Optional names for variables (index 1 = variable 1). */
    names?: string[];
    /** Ask the reader to predict each learned clause and backjump level before revealing it. */
    drive?: boolean;
    /** Exercise id (drive mode marks it solved after three correct predictions). */
    id?: string;
    caption?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  let s = $state.raw(new Stepper(clauses, nvars));
  let tick = $state(0);
  const refresh = () => (tick += 1);
  // The stepper mutates itself; `tick` re-renders the view after each step.
  const st = $derived(s);

  const name = (v: number) => names?.[v] ?? `x${v}`;
  const litText = (l: number) => `${l < 0 ? '¬' : ''}${name(Math.abs(l))}`;

  // Drive mode: the reader's predictions for the current conflict.
  let guessClause = $state<number | undefined>();
  let guessLevel = $state<number | undefined>();
  let revealed = $state(!drive);
  let score = $state(0);

  function reset() {
    s = new Stepper(clauses, nvars);
    guessClause = undefined;
    guessLevel = undefined;
    revealed = !drive;
    refresh();
  }
  function decide(lit: number) {
    st.decide(lit);
    afterStep();
  }
  function afterStep() {
    if (st.status === 'conflict') {
      guessClause = undefined;
      guessLevel = undefined;
      revealed = !drive;
    }
    refresh();
  }

  /** Candidate learned clauses for the prediction: the 1-UIP clause, the decisions clause, the conflict clause. */
  const candidates = $derived.by(() => {
    void tick;
    if (st.status !== 'conflict' || !st.analysis) return [];
    const uip = st.analysis.learned;
    const decisions = decisionsBehind(st.clauses[st.conflict]!).map((l) => -l);
    const conflict = st.clauses[st.conflict]!;
    const all = [
      { label: 'A', clause: uip, right: true },
      { label: 'B', clause: decisions, right: sameSet(decisions, uip) },
      { label: 'C', clause: conflict, right: sameSet(conflict, uip) },
    ];
    // Deduplicate identical candidates, keeping the right one.
    const seen = new Map<string, (typeof all)[number]>();
    for (const c of all) {
      const k = [...c.clause].sort((a, b) => a - b).join(',');
      if (!seen.has(k) || c.right) seen.set(k, c);
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  });
  const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

  /** The decisions that the conflict depends on (following reasons back). */
  function decisionsBehind(clause: number[]): number[] {
    const out = new Set<number>();
    const todo = clause.map((l) => Math.abs(l));
    const seen = new Set<number>();
    while (todo.length) {
      const v = todo.pop()!;
      if (seen.has(v)) continue;
      seen.add(v);
      const a = st.assigned(v);
      if (!a) continue;
      if (a.reason < 0) out.add(a.lit);
      else for (const l of st.clauses[a.reason]!) if (Math.abs(l) !== v) todo.push(Math.abs(l));
    }
    return [...out];
  }

  function reveal() {
    revealed = true;
    const a = st.analysis!;
    const c = candidates.find((x) => x.label === labelOf(guessClause));
    if (c?.right && guessLevel === a.backjump) {
      score++;
      if (id && score >= 3) progress.markSolved(id);
    }
  }
  const labelOf = (i: number | undefined) => (i === undefined ? undefined : candidates[i]?.label);

  // Layout of the implication graph: one row per decision level, columns in trail order.
  const graph = $derived.by(() => {
    void tick;
    const g = st.graph();
    const pos = new Map<number | 'conflict', { x: number; y: number }>();
    const perLevel = new Map<number, number>();
    g.nodes.forEach((n) => {
      const k = perLevel.get(n.level) ?? 0;
      perLevel.set(n.level, k + 1);
      pos.set(n.lit, { x: 40 + k * 78, y: 26 + n.level * 52 });
    });
    if (st.conflict >= 0) pos.set('conflict', { x: 40 + (perLevel.get(st.level) ?? 0) * 78, y: 26 + st.level * 52 });
    const w = Math.max(320, 80 + Math.max(1, ...[...perLevel.values()]) * 78 + 60);
    const h = 52 * (st.level + 1) + 30;
    return { g, pos, w, h };
  });

  const clauseClass = (i: number) => {
    void tick;
    const c = st.clauseState(i);
    return c.kind;
  };
  const statusText = $derived.by(() => {
    void tick;
    switch (st.status) {
      case 'sat':
        return 'Every variable is assigned and every clause is satisfied: SAT.';
      case 'unsat':
        return 'A clause is false at level 0, with no decision to undo: UNSAT.';
      case 'conflict':
        return `Clause ${st.conflict + 1} is false: a conflict at level ${st.level}.`;
      default: {
        const u = st.nextUnit();
        return u ? `Clause ${u.clause + 1} is unit: ${litText(u.lit)} is forced.` : 'No clause is unit. Decide a variable.';
      }
    }
  });
  const analysis = $derived.by((): Analysis | undefined => {
    void tick;
    return st.analysis;
  });
</script>

<figure class="cdcl">
  {#key tick}
  <div class="top">
    <section class="clauses">
      <p class="h ui">Clauses</p>
      <ol>
        {#each st.clauses as c, i (i)}
          <li class={clauseClass(i)} class:learned={i >= st.inputCount} class:conf={i === st.conflict}>
            <span class="n ui">{i >= st.inputCount ? 'L' : ''}{i + 1}</span>
            <span class="lits">{#each c as l, k (k)}<span class="lit" class:t={st.value(l) === true} class:f={st.value(l) === false}>{litText(l)}</span>{#if k < c.length - 1}<span class="or">∨</span>{/if}{/each}</span>
          </li>
        {/each}
      </ol>
      <p class="legend ui"><span class="sw sat"></span>satisfied <span class="sw unit"></span>unit <span class="sw false"></span>false</p>
    </section>
    <section class="right">
      <p class="h ui">Trail, by decision level</p>
      <div class="trail ui">
        {#each Array.from({ length: st.level + 1 }, (_, i) => i) as lv (lv)}
          <div class="lvl"><span class="lvn">{lv}</span>{#each st.trail.filter((t) => t.level === lv) as t (t.lit)}<span class="tlit" class:dec={t.reason < 0} title={t.reason < 0 ? 'decision' : `forced by clause ${t.reason + 1}`}>{litText(t.lit)}{#if t.reason >= 0}<sub>{t.reason + 1}</sub>{/if}</span>{/each}</div>
        {/each}
      </div>
      <p class="status ui" class:bad={st.status === 'conflict' || st.status === 'unsat'} class:good={st.status === 'sat'}>{statusText}</p>
      <div class="controls ui">
        <button type="button" onclick={() => { st.propagateOne(); afterStep(); }} disabled={st.status !== 'running' || !st.nextUnit()}>Propagate one</button>
        <button type="button" onclick={() => { st.propagateAll(); afterStep(); }} disabled={st.status !== 'running' || !st.nextUnit()}>Propagate all</button>
        <button type="button" onclick={() => { st.learnAndBackjump(); afterStep(); }} disabled={st.status !== 'conflict' || !revealed}>Learn and backjump</button>
        <button type="button" onclick={() => { st.step(); afterStep(); }} disabled={(st.status !== 'running' && st.status !== 'conflict') || (st.status === 'conflict' && !revealed)}>Solver's step</button>
        <button type="button" onclick={reset}>Reset</button>
      </div>
      {#if st.status === 'running' && !st.nextUnit()}
        <div class="decide ui">
          <span>Decide:</span>
          {#each st.unassignedVars() as v (v)}
            <span class="pair"><button type="button" onclick={() => decide(v)}>{name(v)}</button><button type="button" onclick={() => decide(-v)}>¬{name(v)}</button></span>
          {/each}
        </div>
      {/if}
      <p class="stats ui">decisions {st.stats.decisions} · propagations {st.stats.propagations} · conflicts {st.stats.conflicts} · learned {st.stats.learned}</p>
    </section>
  </div>

  <div class="graph">
    <p class="h ui">Implication graph: an arrow from each literal of a reason to the literal it forced; rows are decision levels</p>
    <svg viewBox="0 0 {graph.w} {graph.h}" width={graph.w} height={graph.h} role="img" aria-label="Implication graph">
      <defs><marker id="cdcl-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor" /></marker></defs>
      {#each graph.g.edges as e, i (i)}
        {@const a = graph.pos.get(e.from)}
        {@const b = graph.pos.get(e.to)}
        {#if a && b}
          {@const dx = b.x - a.x}
          {@const dy = b.y - a.y}
          {@const d = Math.hypot(dx, dy) || 1}
          {#if dy === 0 && Math.abs(dx) > 90}
            <!-- Same row, skipping nodes: arc above them instead of running through them. -->
            {@const lift = 16 + Math.abs(dx) / 8}
            <path d="M{a.x + 10},{a.y - 11} Q{(a.x + b.x) / 2},{a.y - lift * 2} {b.x - 10},{b.y - 12}" class="e" class:toc={e.to === 'conflict'} fill="none" marker-end="url(#cdcl-arr)" />
          {:else}
            <line x1={a.x + (dx / d) * 15} y1={a.y + (dy / d) * 15} x2={b.x - (dx / d) * 17} y2={b.y - (dy / d) * 17} class="e" class:toc={e.to === 'conflict'} marker-end="url(#cdcl-arr)" />
          {/if}
        {/if}
      {/each}
      {#each graph.g.nodes as n (n.lit)}
        {@const p = graph.pos.get(n.lit)!}
        <g class="node" class:dec={n.reason < 0} class:uip={analysis && revealed && n.lit === -analysis.uip}>
          <circle cx={p.x} cy={p.y} r="14" />
          <text x={p.x} y={p.y + 4}>{litText(n.lit)}</text>
          <text x={p.x} y={p.y - 18} class="lv">@{n.level}</text>
        </g>
      {/each}
      {#if graph.pos.get('conflict')}
        {@const p = graph.pos.get('conflict')!}
        <g class="node conflict"><rect x={p.x - 16} y={p.y - 14} width="32" height="28" rx="4" /><text x={p.x} y={p.y + 5}>✗</text></g>
      {/if}
    </svg>
  </div>

  {#if st.status === 'conflict' && analysis}
    <div class="analysis">
      {#if drive && !revealed}
        <p class="ui h">Predict: which clause will the solver learn, and to which level will it jump back?</p>
        <div class="cands ui">
          {#each candidates as c, i (c.label)}
            <label><input type="radio" name="cand" value={i} bind:group={guessClause} /> <b>{c.label}</b> <code>{c.clause.map(litText).join(' ∨ ')}</code></label>
          {/each}
        </div>
        <label class="ui lvsel">Backjump to level <select bind:value={guessLevel}>{#each Array.from({ length: st.level }, (_, i) => i) as l (l)}<option value={l}>{l}</option>{/each}</select></label>
        <button type="button" class="go ui" onclick={reveal} disabled={guessClause === undefined || guessLevel === undefined}>Check my prediction</button>
      {:else}
        {#if drive}
          {@const right = candidates[guessClause ?? -1]?.right && guessLevel === analysis.backjump}
          <p class="ui verdict" class:good={right}>{right ? 'Right: clause and level.' : `Not quite: the solver learns ${analysis.learned.map(litText).join(' ∨ ')} and jumps back to level ${analysis.backjump}.`} Correct predictions so far: {score}.</p>
        {/if}
        <p class="ui h">Conflict analysis: resolve the false clause with the reasons of the current level's literals, latest first</p>
        <ol class="res">
          <li><code>{st.clauses[st.conflict]!.map(litText).join(' ∨ ')}</code> <span class="why">the false clause {st.conflict + 1}</span></li>
          {#each analysis.resolutions as r, i (i)}
            <li><code>{r.result.map(litText).join(' ∨ ') || '∅'}</code> <span class="why">resolved on {name(r.pivot)} with clause {r.with + 1}</span></li>
          {/each}
        </ol>
        <p class="ui learned">Learned: <code>{analysis.learned.map(litText).join(' ∨ ')}</code>. Only one literal, {litText(analysis.uip)}, belongs to level {st.level}: the first unique implication point. The other literals' highest level is {analysis.backjump}, so the solver jumps back there, where the learned clause is unit.</p>
      {/if}
    </div>
  {/if}
  {/key}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .cdcl {
    margin: 2rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .top {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 0.8rem;
  }
  @media (max-width: 760px) {
    .top {
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
  .clauses ol {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 18rem;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
  }
  .clauses li {
    display: flex;
    gap: 0.5rem;
    padding: 0.12rem 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    border-left: 3px solid transparent;
  }
  .clauses li.sat {
    opacity: 0.45;
  }
  .clauses li.unit {
    border-left-color: var(--gold);
    background: var(--gold-soft);
  }
  .clauses li.false {
    border-left-color: var(--pencil);
    background: color-mix(in srgb, var(--pencil) 12%, transparent);
  }
  .clauses li.learned .n {
    color: var(--seal);
    font-weight: 700;
  }
  .n {
    width: 2rem;
    color: var(--mute);
    font-size: 0.72rem;
    text-align: right;
    flex: none;
  }
  .lit.t {
    color: var(--seal);
    font-weight: 700;
  }
  .lit.f {
    color: var(--mute);
    text-decoration: line-through;
  }
  .or {
    color: var(--mute);
    margin: 0 0.25rem;
  }
  .legend {
    font-size: 0.72rem;
    color: var(--mute);
    margin: 0.3rem 0 0;
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .sw {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
  }
  .sw.sat {
    background: var(--line-strong);
  }
  .sw.unit {
    background: var(--gold);
  }
  .sw.false {
    background: var(--pencil);
  }
  .trail {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.82rem;
  }
  .lvl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
  }
  .lvn {
    width: 1.4rem;
    color: var(--mute);
    font-size: 0.72rem;
  }
  .tlit {
    font-family: var(--font-mono);
    padding: 0.05rem 0.35rem;
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    background: var(--panel);
  }
  .tlit.dec {
    border-color: var(--ink-blue);
    font-weight: 700;
    box-shadow: inset 0 -2px 0 var(--ink-blue);
  }
  sub {
    color: var(--mute);
    font-size: 0.65rem;
    margin-left: 0.1rem;
  }
  .status {
    font-size: 0.86rem;
    margin: 0.5rem 0;
  }
  .status.bad {
    color: var(--pencil);
    font-weight: 600;
  }
  .status.good {
    color: var(--seal);
    font-weight: 600;
  }
  .controls,
  .decide {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
    font-size: 0.82rem;
  }
  .decide {
    margin-top: 0.4rem;
  }
  .pair {
    display: inline-flex;
  }
  .pair button:first-child {
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  }
  .pair button:last-child {
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    border-left: none;
  }
  button {
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    padding: 0.22rem 0.55rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .stats {
    font-size: 0.75rem;
    color: var(--mute);
    margin: 0.5rem 0 0;
  }
  .graph {
    margin-top: 0.8rem;
    overflow-x: auto;
  }
  svg {
    display: block;
    color: var(--edge);
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  .e {
    stroke: var(--edge);
    stroke-width: 1.2;
  }
  .e.toc {
    stroke: var(--pencil);
  }
  .node circle {
    fill: var(--pn);
    stroke: var(--fg);
  }
  .node.dec circle {
    stroke: var(--ink-blue);
    stroke-width: 2.5;
  }
  .node.uip circle {
    fill: var(--gold-soft);
    stroke: var(--gold);
    stroke-width: 3;
  }
  .node text {
    font-family: var(--font-mono);
    font-size: 10px;
    text-anchor: middle;
    fill: var(--fg);
  }
  .node .lv {
    font-size: 8px;
    fill: var(--mute);
  }
  .node.conflict rect {
    fill: color-mix(in srgb, var(--pencil) 20%, var(--panel));
    stroke: var(--pencil);
  }
  .analysis {
    margin-top: 0.8rem;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
  }
  .cands {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.86rem;
  }
  .lvsel {
    display: block;
    margin: 0.4rem 0;
    font-size: 0.86rem;
  }
  .go {
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .verdict {
    color: var(--pencil);
    font-weight: 600;
  }
  .verdict.good {
    color: var(--seal);
  }
  .res {
    margin: 0;
    padding-left: 1.4rem;
    font-size: 0.85rem;
  }
  .why {
    color: var(--mute);
    font-size: 0.78rem;
    margin-left: 0.4rem;
  }
  .learned {
    font-size: 0.9rem;
    margin: 0.5rem 0 0;
  }
  figcaption {
    margin-top: 0.7rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
