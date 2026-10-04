<!--
  A resolution refutation drawn as a DAG. The refutation is extracted from a run of the chapter-7 CDCL stepper:
  every learned clause is the end of a chain of resolutions, and the final conflict is resolved down to the empty
  clause. Input clauses are at the top; each derived clause sits below its two premises. Click a clause to see the
  step that produced it, which is re-checked on the spot.
-->
<script lang="ts">
  import { refutation, checkStep } from '$lib/fv/sat/resolution';

  let { clauses, nvars, names, caption }: { clauses: number[][]; nvars: number; names?: string[]; caption?: string } = $props();

  const name = (v: number) => names?.[v] ?? `x${v}`;
  const litText = (l: number) => `${l < 0 ? '¬' : ''}${name(Math.abs(l))}`;
  const clauseText = (c: readonly number[]) => (c.length ? c.map(litText).join(' ∨ ') : '∅');

  // svelte-ignore state_referenced_locally
  const ref = refutation(clauses, nvars);

  const layout = (() => {
    if (!ref) return undefined;
    const used = [...ref.used].sort((a, b) => a - b);
    const depth = new Map<number, number>();
    for (const i of used) {
      const st = ref.steps.get(i);
      depth.set(i, st ? 1 + Math.max(depth.get(st.left)!, depth.get(st.right)!) : 0);
    }
    const layers: number[][] = [];
    for (const i of used) (layers[depth.get(i)!] ??= []).push(i);
    const widthOf = (i: number) => 14 + 6.4 * clauseText(ref.clauses[i]!).length;
    const x = new Map<number, number>();
    const gap = 12;
    // Order each layer by the mean position of the premises (fewer crossings), then pack left to right.
    layers.forEach((layer, d) => {
      if (d > 0) {
        const key = (i: number) => {
          const st = ref.steps.get(i)!;
          return (x.get(st.left)! + x.get(st.right)!) / 2;
        };
        layer.sort((a, b) => key(a) - key(b));
      }
      let cur = 10;
      for (const i of layer) {
        const w = widthOf(i);
        const want = d > 0 ? (() => { const st = ref.steps.get(i)!; return (x.get(st.left)! + x.get(st.right)!) / 2; })() : cur + w / 2;
        const cx = Math.max(cur + w / 2, want);
        x.set(i, cx);
        cur = cx + w / 2 + gap;
      }
    });
    const W = Math.max(...used.map((i) => x.get(i)! + widthOf(i) / 2)) + 10;
    const rowH = 54;
    const H = layers.length * rowH + 10;
    const y = (i: number) => 22 + depth.get(i)! * rowH;
    return { used, x, y, widthOf, W, H };
  })();

  let selected = $state<number | undefined>(ref?.empty);
  const sel = $derived(selected !== undefined && ref ? ref.steps.get(selected) : undefined);
  const verdict = $derived(sel && ref && selected !== undefined ? checkStep(ref.clauses, { ...sel, clause: ref.clauses[selected]! }) : undefined);
  const derivedCount = ref ? [...ref.used].filter((i) => i >= ref.inputCount).length : 0;
</script>

<figure class="dag">
  {#if !ref || !layout}
    <p class="ui">This formula is satisfiable: there is no refutation to show.</p>
  {:else}
    <p class="ui info">{ref.inputCount} input clauses, {derivedCount} resolution steps, ending in the empty clause. Click a clause to see the step that produced it.</p>
    <div class="scroll">
      <svg viewBox="0 0 {layout.W} {layout.H}" width={layout.W} height={layout.H} role="img" aria-label="Resolution refutation as a graph">
        {#each layout.used as i (i)}
          {@const st = ref.steps.get(i)}
          {#if st}
            {#each [st.left, st.right] as p (p)}
              <line x1={layout.x.get(p)} y1={layout.y(p) + 11} x2={layout.x.get(i)} y2={layout.y(i) - 11} class="e" class:hot={selected === i} />
            {/each}
          {/if}
        {/each}
        {#each layout.used as i (i)}
          {@const w = layout.widthOf(i)}
          {@const cx = layout.x.get(i)!}
          {@const cy = layout.y(i)}
          <g class="node" class:input={i < ref.inputCount} class:empty={i === ref.empty} class:sel={selected === i} class:prem={sel && (sel.left === i || sel.right === i)} role="button" tabindex="0" onclick={() => (selected = i)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (selected = i)}>
            <rect x={cx - w / 2} y={cy - 11} width={w} height="22" rx="4" />
            <text x={cx} y={cy + 4}>{clauseText(ref.clauses[i]!)}</text>
          </g>
        {/each}
      </svg>
    </div>
    <p class="ui step" role="status">
      {#if selected !== undefined && sel}
        <code>{clauseText(ref.clauses[sel.left]!)}</code> and <code>{clauseText(ref.clauses[sel.right]!)}</code> resolved on {name(sel.pivot)} give <code>{clauseText(ref.clauses[selected]!)}</code>. {verdict ? `Checker: ${verdict}` : 'Checker: a correct resolution step.'}
      {:else if selected !== undefined}
        <code>{clauseText(ref.clauses[selected]!)}</code> is an input clause.
      {/if}
    </p>
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .dag {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .info,
  .step {
    font-size: 0.84rem;
    color: var(--ink-2);
    margin: 0 0 0.5rem;
  }
  .step {
    margin-top: 0.6rem;
    min-height: 2.6em;
  }
  .step code {
    font-family: var(--font-mono);
    font-size: 0.82rem;
  }
  .scroll {
    overflow-x: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  svg {
    display: block;
  }
  .e {
    stroke: var(--edge, var(--line-strong));
    stroke-width: 1;
  }
  .e.hot {
    stroke: var(--ink-blue);
    stroke-width: 2;
  }
  .node {
    cursor: pointer;
  }
  .node rect {
    fill: var(--pn);
    stroke: var(--line-strong);
  }
  .node.input rect {
    fill: var(--panel);
    stroke-dasharray: 3 2;
  }
  .node.empty rect {
    fill: var(--seal-soft);
    stroke: var(--seal);
    stroke-width: 2;
  }
  .node.prem rect {
    stroke: var(--ink-blue);
    stroke-width: 2;
  }
  .node.sel rect {
    stroke: var(--gold);
    stroke-width: 2.5;
  }
  .node:focus-visible rect {
    stroke: var(--ink-blue);
    stroke-width: 3;
  }
  .node:focus {
    outline: none;
  }
  text {
    font-family: var(--font-mono);
    font-size: 10.5px;
    fill: var(--fg);
    text-anchor: middle;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
