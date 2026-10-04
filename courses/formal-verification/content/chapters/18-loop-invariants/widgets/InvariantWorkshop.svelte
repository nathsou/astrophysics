<!--
  The invariant workshop: a loop's reachable states (from a real run) plotted over two of its variables, a
  candidate invariant shaded as a region, and the three lights: the invariant holds on entry, is preserved by every
  iteration, and gives the postcondition at the exit. A failed preservation check shows its counterexample to
  induction as a pair of states. With a measure, a fourth light and a bar chart of the measure along the run.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { checkLoop, formulaFromText, fromVouch, holdsAt, loopStates, showFormula, valueAt, WpError, type Env, type LoopReport, type Validity } from '$lib/fv/wp/wp';
  import { progress } from '$lib/state/progress.svelte';
  import type { Term } from '$lib/fv/logic/term';

  let {
    code,
    x: xv,
    y: yv,
    params = {},
    invariant: inv0 = '',
    measure: m0 = '',
    id,
    title,
    caption,
  }: { code: string; x: string; y: string; params?: Record<string, number>; invariant?: string; measure?: string; id?: string; title?: string; caption?: string } = $props();

  // svelte-ignore state_referenced_locally
  const prog = fromVouch(code);
  // svelte-ignore state_referenced_locally
  const paramEnv: Env = new Map(Object.entries(params).map(([k, n]) => [k, BigInt(n)]));
  const states = loopStates(prog, paramEnv);
  // svelte-ignore state_referenced_locally
  let invText = $state(inv0);
  // svelte-ignore state_referenced_locally
  let mText = $state(m0);
  let report = $state.raw<LoopReport | undefined>();
  let invTerm = $state.raw<Term | undefined>();
  let mTerm = $state.raw<Term | undefined>();
  let error = $state('');

  onMount(() => {
    if (id) {
      progress.load();
      const d = progress.draft<{ inv: string; m: string } | undefined>(id, undefined);
      if (d) {
        invText = d.inv;
        mText = d.m;
      }
    }
    if (invText.trim()) run();
  });

  function run() {
    error = '';
    try {
      invTerm = formulaFromText(prog, invText.trim() || 'true');
      mTerm = mText.trim() ? formulaFromText(prog, mText) : undefined;
      report = checkLoop(prog, invTerm, mTerm);
      if (id) {
        progress.saveDraft(id, { inv: invText, m: mText });
        if (report.entry.valid && report.preserved.valid && report.exit.valid && (!m0 || (report.bounded?.valid && report.decreases?.valid))) progress.markSolved(id);
      }
    } catch (e) {
      error = e instanceof WpError ? e.message : String(e);
      report = undefined;
    }
  }

  // ── The plot ──
  const W = 340;
  const H = 260;
  const num = (e: Env, k: string) => Number(e.get(k) ?? 0n);
  const pts = states.map((s) => ({ x: num(s, xv), y: num(s, yv) }));
  const ctiPts = $derived(report?.cti ? [report.cti.before, report.cti.after].filter((e): e is Env => !!e).map((e) => ({ x: num(e, xv), y: num(e, yv) })) : []);
  const box = $derived.by(() => {
    const all = [...pts, ...ctiPts];
    let x0 = Math.min(...all.map((p) => p.x));
    let x1 = Math.max(...all.map((p) => p.x));
    let y0 = Math.min(...all.map((p) => p.y));
    let y1 = Math.max(...all.map((p) => p.y));
    const padX = Math.max(2, Math.ceil((x1 - x0) * 0.25));
    const padY = Math.max(2, Math.ceil((y1 - y0) * 0.25));
    x0 -= padX;
    x1 += padX;
    y0 -= padY;
    y1 += padY;
    return { x0, x1, y0, y1 };
  });
  const sx = (x: number) => 30 + ((x - box.x0) / Math.max(1, box.x1 - box.x0)) * (W - 40);
  const sy = (y: number) => H - 24 - ((y - box.y0) / Math.max(1, box.y1 - box.y0)) * (H - 34);
  // The invariant's region: grid cells (other variables as in the first reachable state).
  const cells = $derived.by(() => {
    if (!invTerm) return [];
    const base = new Map(states[0]);
    const stepX = Math.max(1, Math.ceil((box.x1 - box.x0) / 40));
    const stepY = Math.max(1, Math.ceil((box.y1 - box.y0) / 30));
    const out: { x: number; y: number; w: number; h: number }[] = [];
    for (let x = box.x0; x <= box.x1; x += stepX) {
      for (let y = box.y0; y <= box.y1; y += stepY) {
        const e = new Map(base);
        e.set(xv, BigInt(x));
        e.set(yv, BigInt(y));
        if (holdsAt(invTerm, e)) out.push({ x: sx(x - stepX / 2), y: sy(y + stepY / 2), w: sx(x + stepX / 2) - sx(x - stepX / 2), h: sy(y - stepY / 2) - sy(y + stepY / 2) });
      }
    }
    return out;
  });
  const outside = $derived(invTerm ? states.filter((s) => !holdsAt(invTerm!, s)).length : 0);
  const measures = $derived(mTerm ? states.map((s) => valueAt(mTerm!, s)) : []);
  const mMax = $derived(Math.max(1, ...measures.map((m) => (m === undefined ? 0 : Math.abs(Number(m))))));

  const lights = $derived.by(() => {
    if (!report) return [];
    const L: { label: string; v: Validity; note: string }[] = [
      { label: 'Holds on entry', v: report.entry, note: 'the precondition and the code before the loop establish it' },
      { label: 'Preserved', v: report.preserved, note: 'one iteration from any state satisfying it and the loop condition leads to a state satisfying it' },
      { label: 'Strong enough', v: report.exit, note: 'with the loop condition false, it gives what the rest of the function needs' },
    ];
    if (report.bounded && report.decreases) {
      const ok = report.bounded.valid && report.decreases.valid;
      L.push({ label: 'Terminates', v: ok ? report.bounded : !report.bounded.valid ? report.bounded : report.decreases, note: 'the measure is non-negative while the loop runs and decreases at each iteration' });
    }
    return L;
  });
  const showEnv = (e: Env) => [...e].filter(([k]) => k !== 'result').map(([k, val]) => `${k} = ${val}`).join(', ');
</script>

<figure class="iw">
  {#if title}<h4 class="ui ttl">{title}</h4>{/if}
  <pre class="code"><code>{code.replace(/\n$/, '')}</code></pre>
  <div class="inputs ui">
    <label>invariant <input bind:value={invText} spellcheck="false" autocomplete="off" placeholder="e.g. 0 <= i <= n" onkeydown={(e) => e.key === 'Enter' && run()} /></label>
    <label>decreases <input bind:value={mText} spellcheck="false" autocomplete="off" placeholder="optional, e.g. n - i" onkeydown={(e) => e.key === 'Enter' && run()} /></label>
    <button type="button" class="go" onclick={run}>Check</button>
  </div>
  {#if error}<p class="err ui">{error}</p>{/if}
  <div class="cols">
    <div>
      <svg viewBox="0 0 {W} {H}" role="img" aria-label="Reachable states and the invariant">
        {#each cells as c, i (i)}<rect class="cell" x={c.x} y={c.y} width={c.w} height={c.h} />{/each}
        <line class="axis" x1="30" y1={H - 24} x2={W - 10} y2={H - 24} />
        <line class="axis" x1="30" y1="10" x2="30" y2={H - 24} />
        <text class="tick" x={W - 10} y={H - 8} text-anchor="end">{xv}</text>
        <text class="tick" x="6" y="16">{yv}</text>
        <text class="tick" x="30" y={H - 8}>{box.x0}</text>
        <text class="tick" x="26" y={H - 26} text-anchor="end">{box.y0}</text>
        <text class="tick" x="26" y="18" text-anchor="end">{box.y1}</text>
        {#each pts as p, i (i)}
          {#if i > 0}<line class="path" x1={sx(pts[i - 1]!.x)} y1={sy(pts[i - 1]!.y)} x2={sx(p.x)} y2={sy(p.y)} />{/if}
        {/each}
        {#each pts as p, i (i)}<circle class="pt" class:out={invTerm && !holdsAt(invTerm, states[i]!)} cx={sx(p.x)} cy={sy(p.y)} r="3.2" />{/each}
        {#if ctiPts.length}
          <circle class="cti" cx={sx(ctiPts[0]!.x)} cy={sy(ctiPts[0]!.y)} r="5" />
          {#if ctiPts[1]}
            <line class="ctiarrow" x1={sx(ctiPts[0]!.x)} y1={sy(ctiPts[0]!.y)} x2={sx(ctiPts[1]!.x)} y2={sy(ctiPts[1]!.y)} />
            <circle class="cti2" cx={sx(ctiPts[1]!.x)} cy={sy(ctiPts[1]!.y)} r="5" />
          {/if}
        {/if}
      </svg>
      <p class="ui legend"><span class="sw reach"></span> states the loop reaches ({showEnv(paramEnv)}) <span class="sw inv"></span> where the invariant holds {#if ctiPts.length}<span class="sw ctis"></span> counterexample to induction{/if}</p>
      {#if invTerm && outside}<p class="ui bad">{outside} reachable state{outside === 1 ? ' is' : 's are'} outside the invariant: it cannot be invariant.</p>{/if}
    </div>
    <div>
      {#if report}
        <ul class="lights ui">
          {#each lights as l (l.label)}
            <li class:ok={l.v.valid} class:bad={!l.v.valid}>
              <span class="lamp" aria-hidden="true"></span>
              <span><b>{l.label}</b>: {l.note}. {#if !l.v.valid}{#if l.v.counterexample && l.label !== 'Preserved'}<span class="cex">Fails for {l.v.counterexample.map(([k, val]) => `${k} = ${val}`).join(', ')}.</span>{:else if l.v.status === 'unknown'}<span class="cex">The solver could not decide.</span>{/if}{/if}</span>
            </li>
          {/each}
        </ul>
        {#if report.cti}
          <div class="ctibox ui">
            <p><b>Counterexample to induction.</b> This state satisfies the invariant and the loop condition:</p>
            <p><code>{showEnv(report.cti.before)}</code></p>
            {#if report.cti.after}<p>One iteration later, the invariant fails:</p><p><code>{showEnv(report.cti.after)}</code></p>{/if}
            <p class="note">Is the first state reachable? If not, the invariant is true but not inductive: strengthen it so that it excludes this state.</p>
          </div>
        {/if}
        {#if invTerm}<p class="ui shown">Checked: <code>{showFormula(invTerm)}</code></p>{/if}
      {:else}
        <p class="ui hint">Type an invariant and press Check.</p>
      {/if}
      {#if measures.length}
        <div class="bars ui" aria-label="The measure along the run">
          {#each measures as m, i (i)}<span class="b" class:neg={m !== undefined && m < 0n} style="height: {m === undefined ? 0 : (40 * Math.abs(Number(m))) / mMax + 2}px" title="iteration {i}: {m}"></span>{/each}
        </div>
        <p class="ui note">The measure at the loop head, iteration by iteration.</p>
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
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .code {
    margin: 0 0 0.6rem;
    padding: 0.5rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: var(--panel);
    font-size: 0.78rem;
    overflow-x: auto;
  }
  .iw code {
    all: unset;
    font-family: var(--font-mono);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .code code {
    white-space: pre;
  }
  .inputs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.8rem;
    align-items: center;
    font-size: 0.82rem;
  }
  .inputs label {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    flex: 1;
    min-width: 14rem;
    font-family: var(--font-mono);
    color: var(--ink-2);
  }
  .inputs input {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    padding: 0.22rem 0.4rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
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
  .err,
  .bad {
    color: var(--pencil);
    font-size: 0.82rem;
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.9rem;
    margin-top: 0.7rem;
  }
  @media (max-width: 760px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  svg {
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  .cell {
    fill: color-mix(in srgb, var(--seal) 20%, transparent);
  }
  .axis {
    stroke: var(--line-strong);
  }
  .tick {
    font-family: var(--font-ui);
    font-size: 10px;
    fill: var(--mute);
  }
  .path {
    stroke: var(--ink-blue);
    stroke-width: 1;
    opacity: 0.5;
  }
  .pt {
    fill: var(--ink-blue);
  }
  .pt.out {
    fill: var(--pencil);
  }
  .cti,
  .cti2 {
    fill: none;
    stroke: var(--pencil);
    stroke-width: 2;
  }
  .cti2 {
    stroke-dasharray: 3 2;
  }
  .ctiarrow {
    stroke: var(--pencil);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }
  .legend {
    font-size: 0.75rem;
    color: var(--ink-2);
  }
  .sw {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    vertical-align: middle;
    margin: 0 0.2rem 0 0.5rem;
  }
  .sw.reach {
    background: var(--ink-blue);
    border-radius: 50%;
  }
  .sw.inv {
    background: color-mix(in srgb, var(--seal) 30%, transparent);
  }
  .sw.ctis {
    border: 2px solid var(--pencil);
    border-radius: 50%;
  }
  .lights {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.45rem;
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
  .lights .bad {
    color: var(--fg);
  }
  .cex {
    color: var(--pencil);
  }
  .ctibox {
    margin-top: 0.7rem;
    padding: 0.5rem 0.7rem;
    border-left: 3px solid var(--pencil);
    background: color-mix(in srgb, var(--pencil) 6%, transparent);
    font-size: 0.82rem;
  }
  .ctibox p {
    margin: 0.2rem 0;
  }
  .note,
  .hint,
  .shown {
    font-size: 0.78rem;
    color: var(--mute);
  }
  .bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 46px;
    margin-top: 0.8rem;
    border-bottom: 1px solid var(--line-strong);
  }
  .b {
    flex: 1;
    max-width: 14px;
    background: var(--gold);
    border-radius: 2px 2px 0 0;
  }
  .b.neg {
    background: var(--pencil);
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
