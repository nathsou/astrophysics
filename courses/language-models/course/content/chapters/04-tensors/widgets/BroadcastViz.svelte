<!-- Broadcasting rules made visible: align shapes on the right, stretch size-1 dimensions. -->
<script lang="ts">
  import { Tensor, broadcastShapes } from '@lm/core/tensor';
  import Widget from '$lib/components/ui/Widget.svelte';

  const PRESETS = [
    { label: 'Add a bias', a: 'B, T, C', b: 'C', note: 'The canonical case: one bias vector added to every position of every sequence in the batch.' },
    { label: 'Outer sum', a: '3, 1', b: '1, 4', note: 'Both inputs stretch: a column plus a row gives a full matrix.' },
    { label: 'Row scaling', a: '3, 4', b: '3, 1', note: 'Per-row values (e.g. a softmax denominator kept with keepdim) broadcast across columns.' },
    { label: 'Attention mask', a: 'B, H, T, T', b: 'T, T', note: 'One causal mask shared by every head of every sequence (Chapter 10).' },
    { label: 'Mismatch', a: '3, 4', b: '3', note: 'Shapes align from the right: 4 against 3 — neither is 1, so this is an error. You probably meant shape (3, 1).' },
  ];
  const SYM: Record<string, number> = { B: 2, T: 3, C: 4, H: 2 };

  let a = $state(PRESETS[1]!.a);
  let b = $state(PRESETS[1]!.b);

  const parse = (s: string) =>
    s
      .split(/[\s,×x]+/)
      .filter(Boolean)
      .map((x) => (/^\d+$/.test(x) ? { n: Number(x), sym: x } : { n: SYM[x] ?? NaN, sym: x }));
  const A = $derived(parse(a));
  const Bs = $derived(parse(b));
  const n = $derived(Math.max(A.length, Bs.length));
  const rows = $derived(
    Array.from({ length: n }, (_, i) => {
      const x = A[A.length - n + i];
      const y = Bs[Bs.length - n + i];
      const xs = x?.n ?? 1, ys = y?.n ?? 1;
      const ok = xs === ys || xs === 1 || ys === 1;
      return { x, y, out: ok ? (xs === 1 ? y?.sym ?? '1' : x?.sym ?? '1') : '✗', ok, stretchA: xs === 1 && ys !== 1, stretchB: ys === 1 && xs !== 1 };
    }),
  );
  const ok = $derived(rows.every((r) => r.ok) && A.every((d) => !isNaN(d.n)) && Bs.every((d) => !isNaN(d.n)));
  const note = $derived(PRESETS.find((p) => p.a === a && p.b === b)?.note);

  // Concrete 2-D demo when both fit.
  const demo = $derived.by(() => {
    if (!ok || n > 2) return null;
    const sa = A.map((d) => d.n), sb = Bs.map((d) => d.n);
    if ([...sa, ...sb].some((d) => d > 6)) return null;
    const ta = Tensor.arange(sa.reduce((p, q) => p * q, 1)).reshape(...(sa.length ? sa : [1])).mul(10);
    const tb = Tensor.arange(sb.reduce((p, q) => p * q, 1)).reshape(...(sb.length ? sb : [1]));
    const out = ta.add(tb);
    const shape = broadcastShapes(ta.shape, tb.shape);
    const R = shape.length === 2 ? shape[0]! : 1, C = shape.at(-1)!;
    const at = (t: Tensor, r: number, c: number) => {
      const s = t.shape.length === 2 ? t.shape : [1, t.shape[0]!];
      return { v: t.toFloat32Array()[(s[0] === 1 ? 0 : r) * s[1]! + (s[1] === 1 ? 0 : c)]!, ghost: (s[0] === 1 && r > 0) || (s[1] === 1 && c > 0) };
    };
    return { R, C, a: (r: number, c: number) => at(ta, r, c), b: (r: number, c: number) => at(tb, r, c), o: (r: number, c: number) => out.toFloat32Array()[r * C + c]! };
  });
</script>

<Widget
  title="Broadcasting"
  subtitle="Line the shapes up on the right. Each pair of sizes must match, or one of them must be 1 — which is then stretched (stride 0) to match. Missing leading dimensions count as 1."
>
  {#snippet controls()}
    <label class="f"><span>A shape</span><input bind:value={a} /></label>
    <label class="f"><span>B shape</span><input bind:value={b} /></label>
    <div class="presets">
      {#each PRESETS as p (p.label)}<button class="chip" class:on={p.a === a && p.b === b} onclick={() => ((a = p.a), (b = p.b))}>{p.label}</button>{/each}
    </div>
  {/snippet}

  <table class="align">
    <tbody>
      <tr><th>A</th>{#each rows as r, i (i)}<td class:stretch={r.stretchA} class:missing={!r.x}>{r.x?.sym ?? '·'}</td>{/each}</tr>
      <tr><th>B</th>{#each rows as r, i (i)}<td class:stretch={r.stretchB} class:missing={!r.y}>{r.y?.sym ?? '·'}</td>{/each}</tr>
      <tr class="res"><th>A + B</th>{#each rows as r, i (i)}<td class:bad={!r.ok}>{r.out}</td>{/each}</tr>
    </tbody>
  </table>
  <p class="verdict" class:bad={!ok}>
    {ok ? `Result shape (${rows.map((r) => r.out).join(', ')})` : 'Error: these shapes cannot be broadcast together.'}
    <span class="legend"><i class="st"></i> stretched from 1 · <i class="ms"></i> missing, treated as 1</span>
  </p>
  {#if note}<p class="note">{note}</p>{/if}

  {#if demo}
    <div class="demo">
      {#each [{ name: 'A', f: demo.a }, { name: 'B', f: demo.b }] as m (m.name)}
        <div>
          <div class="k">{m.name} (stretched copies faded)</div>
          <div class="g" style:grid-template-columns="repeat({demo.C}, 2rem)">
            {#each { length: demo.R } as _, r (r)}{#each { length: demo.C } as _, c (c)}{@const e = m.f(r, c)}<span class:ghost={e.ghost}>{e.v}</span>{/each}{/each}
          </div>
        </div>
        <div class="op">{m.name === 'A' ? '+' : '='}</div>
      {/each}
      <div>
        <div class="k">A + B</div>
        <div class="g" style:grid-template-columns="repeat({demo.C}, 2rem)">
          {#each { length: demo.R } as _, r (r)}{#each { length: demo.C } as _, c (c)}<span class="res">{demo.o(r, c)}</span>{/each}{/each}
        </div>
      </div>
    </div>
  {/if}
</Widget>

<style>
  .f {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.74rem;
    color: var(--ink-2);
  }
  .f input {
    width: 8rem;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .chip {
    border: 1px solid var(--border-control);
    background: var(--surface);
    border-radius: 99px;
    padding: 0.2rem 0.6rem;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--ink-2);
  }
  .chip.on {
    background: var(--accent-soft);
    border-color: var(--accent-2);
    color: var(--accent-ink);
  }
  .align {
    border-collapse: separate;
    border-spacing: 4px;
    font-family: var(--font-mono);
  }
  .align th {
    text-align: right;
    font-family: var(--font-ui);
    font-size: 0.8rem;
    color: var(--ink-2);
    padding-right: 0.5rem;
  }
  .align td {
    width: 3rem;
    text-align: center;
    padding: 0.35rem 0;
    border-radius: 5px;
    background: var(--surface-2);
    font-size: 0.95rem;
  }
  .align td.stretch,
  .st {
    background: color-mix(in srgb, var(--series-2) 25%, var(--surface));
  }
  .align td.missing,
  .ms {
    background: transparent;
    border: 1px dashed var(--rule-strong);
    color: var(--ink-3);
  }
  .res td {
    background: var(--accent-soft);
    font-weight: 650;
  }
  .res td.bad {
    background: color-mix(in srgb, var(--critical) 20%, var(--surface));
  }
  .verdict {
    font-size: 0.85rem;
    margin: 0.5rem 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
  }
  .verdict.bad {
    color: var(--critical);
    font-weight: 600;
  }
  .legend {
    font-size: 0.74rem;
    color: var(--ink-2);
    font-weight: 400;
  }
  .legend i {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 2px;
    vertical-align: -1px;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0 0 0.6rem;
  }
  .demo {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.8rem;
    margin-top: 0.4rem;
  }
  .k {
    font-size: 0.72rem;
    color: var(--ink-3);
    margin-bottom: 0.2rem;
  }
  .g {
    display: grid;
    gap: 2px;
  }
  .g span {
    height: 1.8rem;
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    background: var(--surface-2);
    border-radius: 3px;
  }
  .g span.ghost {
    opacity: 0.35;
    background: color-mix(in srgb, var(--series-2) 18%, var(--surface));
  }
  .g span.res {
    background: var(--accent-soft);
  }
  .op {
    font-size: 1.2rem;
    color: var(--ink-3);
  }
</style>
