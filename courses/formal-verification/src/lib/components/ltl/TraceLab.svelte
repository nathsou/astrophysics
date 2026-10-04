<!--
  The trace lab (chapter 3's flagship): build a lasso-shaped trace (a few positions, then a loop back that
  repeats forever) by toggling which propositions hold where, and watch each formula's truth value, at every
  position, update. Select a formula to see its Büchi automaton.
-->
<script lang="ts">
  import { parseProp } from '$lib/fv/ltl/props';
  import { evalAll, type Ltl } from '$lib/fv/ltl/ltl';
  import { toBuchi } from '$lib/fv/ltl/buchi';

  let {
    props = ['p', 'q'],
    formulas = ['always p', 'eventually q', 'p until q', 'always eventually q', 'eventually always q'],
    trace,
    caption,
    automaton = true,
  }: {
    props?: string[];
    formulas?: string[];
    trace?: { states: string[][]; loop: number };
    caption?: string;
    automaton?: boolean;
  } = $props();

  // svelte-ignore state_referenced_locally
  let states = $state<string[][]>(trace?.states.map((s) => [...s]) ?? [[props[0]!], [props[0]!], [props[1] ?? props[0]!]]);
  // svelte-ignore state_referenced_locally
  let loop = $state(trace?.loop ?? 2);
  // svelte-ignore state_referenced_locally
  let fs = $state<string[]>([...formulas]);
  let fresh = $state('');
  let selected = $state(0);

  const n = $derived(states.length);
  function toggle(i: number, p: string) {
    const s = states[i]!;
    states[i] = s.includes(p) ? s.filter((x) => x !== p) : [...s, p];
  }
  function addPos() {
    states = [...states, []];
  }
  function removePos() {
    if (states.length <= 1) return;
    states = states.slice(0, -1);
    if (loop >= states.length) loop = states.length - 1;
  }

  const evaluated = $derived(
    fs.map((f) => {
      const r = parseProp(f, props);
      if ('error' in r) return { f, error: r.error };
      const vals = evalAll(r.ltl, n, Math.min(loop, n - 1), (i, a) => states[i]!.includes(r.props[a]!));
      return { f, vals, ltl: r.ltl, names: r.props };
    }),
  );

  function add() {
    if (!fresh.trim()) return;
    fs = [...fs, fresh.trim()];
    selected = fs.length - 1;
    fresh = '';
  }

  const aut = $derived.by(() => {
    const e = evaluated[selected];
    if (!automaton || !e || !('ltl' in e) || !e.ltl) return undefined;
    const b = toBuchi(e.ltl as Ltl);
    const names = e.names!;
    const k = b.nodes.length;
    const R = k === 1 ? 0 : Math.max(55, 24 * k);
    const pos = b.nodes.map((_, i) => ({ x: R + 70 + R * Math.cos((2 * Math.PI * i) / k - Math.PI / 2), y: R + 60 + R * Math.sin((2 * Math.PI * i) / k - Math.PI / 2) }));
    const label = (i: number) => {
      const nd = b.nodes[i]!;
      const lits = [...nd.pos.map((a) => names[a]!), ...nd.neg.map((a) => `¬${names[a]!}`)];
      return lits.length ? lits.join(' ∧ ') : 'true';
    };
    const acc = (i: number) => b.accepting.length === 0 || b.accepting.every((set) => set.has(i));
    return { b, pos, label, acc, size: 2 * R + 140, k };
  });
</script>

<figure class="lab">
  <div class="tracebox">
    <table class="trace ui">
      <thead>
        <tr>
          <th></th>
          {#each states as _, i (i)}<th class:loophead={i === loop}>{i}{#if i === loop}<span class="loopmark" title="the loop returns here">↺</span>{/if}</th>{/each}
          <th class="back" aria-label="loop">→ {loop}</th>
        </tr>
      </thead>
      <tbody>
        {#each props as p (p)}
          <tr>
            <th class="prop"><code>{p}</code></th>
            {#each states as s, i (i)}
              <td class:inloop={i >= loop}><button type="button" class:on={s.includes(p)} onclick={() => toggle(i, p)} aria-label="{p} at position {i}: {s.includes(p) ? 'true' : 'false'}">{s.includes(p) ? '●' : ''}</button></td>
            {/each}
            <td></td>
          </tr>
        {/each}
        {#each evaluated as e, k (k)}
          <tr class="frow" class:sel={selected === k} onclick={() => (selected = k)}>
            <th class="formula"><code>{e.f}</code></th>
            {#if 'error' in e && e.error}
              <td colspan={n + 1} class="error">{e.error}</td>
            {:else if 'vals' in e && e.vals}
              {#each e.vals as v, i (i)}<td class="val" class:t={v} class:inloop={i >= loop}>{v ? '✓' : '✗'}</td>{/each}
              <td></td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="controls ui">
    <button type="button" onclick={addPos}>Add a position</button>
    <button type="button" onclick={removePos} disabled={n <= 1}>Remove the last</button>
    <label>Loop back to position
      <select bind:value={loop}>{#each states as _, i (i)}<option value={i}>{i}</option>{/each}</select>
    </label>
    <form class="addf" onsubmit={(e) => { e.preventDefault(); add(); }}>
      <input bind:value={fresh} placeholder="always (p ==> eventually q)" aria-label="A formula to add" />
      <button type="submit">Add the formula</button>
    </form>
  </div>
  <p class="read ui">The trace is positions 0 to {n - 1}, then positions {loop} to {n - 1} again, forever. A ✓ in column <i>i</i> means the formula holds of the trace from position <i>i</i> on; the formula holds of the whole trace when column 0 has a ✓.</p>
  {#if aut}
    <div class="aut">
      <p class="ui h">Büchi automaton for <code>{evaluated[selected]?.f}</code>: {aut.k} state{aut.k === 1 ? '' : 's'}. A run is accepted if it visits the double-circled states infinitely often{aut.b.accepting.length > 1 ? ' (one from each acceptance set)' : ''}.</p>
      <svg viewBox="0 0 {aut.size} {aut.size}" width={Math.min(aut.size, 460)} role="img" aria-label="The formula's automaton">
        <defs><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor" /></marker></defs>
        {#each aut.b.succ as outs, i (i)}
          {#each outs as j (j)}
            {@const a = aut.pos[i]!}
            {@const c = aut.pos[j]!}
            {#if i === j}
              <path d="M{a.x - 9},{a.y - 13} C{a.x - 32},{a.y - 52} {a.x + 32},{a.y - 52} {a.x + 9},{a.y - 13}" class="edge" marker-end="url(#arr)" />
            {:else}
              {@const dx = c.x - a.x}
              {@const dy = c.y - a.y}
              {@const d = Math.hypot(dx, dy) || 1}
              <line x1={a.x + (dx / d) * 18} y1={a.y + (dy / d) * 18} x2={c.x - (dx / d) * 20} y2={c.y - (dy / d) * 20} class="edge" marker-end="url(#arr)" />
            {/if}
          {/each}
        {/each}
        {#each aut.b.initial as i (i)}
          {@const a = aut.pos[i]!}
          <line x1={a.x - 46} y1={a.y} x2={a.x - 20} y2={a.y} class="edge init" marker-end="url(#arr)" />
        {/each}
        {#each aut.b.nodes as nd, i (nd.id)}
          {@const a = aut.pos[i]!}
          <g class="node">
            <circle cx={a.x} cy={a.y} r="16" />
            {#if aut.acc(i)}<circle cx={a.x} cy={a.y} r="12" class="inner" />{/if}
            <text x={a.x} y={a.y + 32}>{aut.label(i)}</text>
          </g>
        {/each}
      </svg>
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
  .tracebox {
    overflow-x: auto;
  }
  .trace {
    border-collapse: collapse;
    font-size: 0.85rem;
    width: auto;
  }
  .trace th {
    text-transform: none;
    letter-spacing: normal;
    background: none;
  }
  .trace td,
  .trace th {
    border-bottom: none;
  }
  th,
  td {
    padding: 0.2rem 0.35rem;
    text-align: center;
  }
  thead th {
    color: var(--mute);
    font-weight: 600;
    font-size: 0.75rem;
  }
  .loophead {
    color: var(--cti);
  }
  .loopmark {
    margin-left: 0.15rem;
  }
  .back {
    color: var(--cti);
  }
  th.prop,
  th.formula {
    text-align: left;
    white-space: nowrap;
    padding-right: 0.8rem;
  }
  td button {
    width: 1.8rem;
    height: 1.8rem;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: var(--panel);
    color: var(--ink-blue);
    cursor: pointer;
    font-size: 0.9rem;
  }
  td button.on {
    background: color-mix(in srgb, var(--ink-blue) 18%, var(--panel));
  }
  td.inloop {
    background: color-mix(in srgb, var(--cti) 6%, transparent);
  }
  tr.frow {
    cursor: pointer;
  }
  tr.frow th,
  tr.frow td {
    border-top: 1px solid var(--line);
  }
  tr.frow.sel th code {
    background: var(--gold-soft);
  }
  .val {
    color: var(--pencil);
    font-weight: 700;
  }
  .val.t {
    color: var(--seal);
  }
  tr.frow td.val:nth-child(2) {
    font-size: 1.05rem;
    box-shadow: inset 0 0 0 1px var(--line-strong);
  }
  .error {
    color: var(--pencil);
    text-align: left;
    font-size: 0.8rem;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.8rem;
    align-items: center;
    margin-top: 0.6rem;
    font-size: 0.82rem;
  }
  .controls button,
  .controls select,
  .controls input {
    font: inherit;
    font-size: 0.82rem;
    padding: 0.25rem 0.6rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .controls button {
    cursor: pointer;
  }
  .addf {
    display: flex;
    gap: 0.3rem;
    flex: 1;
    min-width: 16rem;
  }
  .addf input {
    flex: 1;
    font-family: var(--font-mono);
  }
  .read {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
  .aut {
    margin-top: 0.8rem;
    color: var(--ink-2);
  }
  .aut .h {
    font-size: 0.82rem;
    margin: 0 0 0.3rem;
  }
  .edge {
    stroke: var(--edge);
    fill: none;
    stroke-width: 1.2;
  }
  .node circle {
    fill: var(--state);
    stroke: var(--fg);
  }
  .node .inner {
    fill: none;
  }
  .node text {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--fg);
    text-anchor: middle;
  }
  figcaption {
    margin-top: 0.7rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
