<!--
  Two ways to see C = A B: each output is a dot product of a row of A with a column of B; or C is
  a sum of k outer products (column k of A times row k of B). Same numbers, different loop orders.
-->
<script lang="ts">
  import { focus } from '$lib/state/params.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  const A = [
    [1, 2, 0, -1],
    [0, 1, 3, 1],
    [2, -1, 1, 0],
  ];
  const B = [
    [1, 0],
    [2, 1],
    [0, -1],
    [1, 3],
  ];
  const M = 3, K = 4, N = 2;
  const C = A.map((row) => Array.from({ length: N }, (_, j) => row.reduce((s, a, k) => s + a * B[k]![j]!, 0)));

  let view: 'dot' | 'outer' = $state('dot');
  let step = $state(0); // dot: cell index i*N+j; outer: k
  const maxStep = $derived(view === 'dot' ? M * N - 1 : K - 1);
  const i = $derived(Math.floor(step / N)), j = $derived(step % N);
  const partial = $derived(A.map((row) => Array.from({ length: N }, (_, jj) => row.reduce((s, a, k) => (k <= step ? s + a * B[k]![jj]! : s), 0))));

  let timer: ReturnType<typeof setInterval> | undefined;
  let playing = $state(false);
  function play() {
    playing = !playing;
    clearInterval(timer);
    if (playing)
      timer = setInterval(() => {
        step = step >= maxStep ? 0 : step + 1;
      }, 900);
  }

  const hlA = (r: number, c: number) => (view === 'dot' ? r === i : c === step);
  const hlB = (r: number, c: number) => (view === 'dot' ? c === j : r === step);
  const shownC = (r: number, c: number) => (view === 'dot' ? (r * N + c <= step ? C[r]![c] : '') : partial[r]![c]);
</script>

<Widget
  title="Two views of matrix multiplication"
  subtitle="C (3×2) = A (3×4) · B (4×2). Step through it as dot products, one output at a time, or as a sum of outer products, one k at a time."
  onreset={() => (step = 0)}
>
  {#snippet controls()}
    <Segmented
      label="View"
      options={[
        { value: 'dot', label: 'Dot products (i, j loop)' },
        { value: 'outer', label: 'Outer products (k loop)' },
      ]}
      bind:value={view}
      onchange={() => (step = 0)}
    />
    <Button onclick={() => (step = Math.max(0, step - 1))}>‹ Back</Button>
    <Button variant="primary" onclick={() => (step = Math.min(maxStep, step + 1))}>Step ›</Button>
    <Button variant="ghost" onclick={play}>{playing ? 'Pause' : 'Play'}</Button>
  {/snippet}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="row" onpointerenter={() => focus.set('Cij', 'matmul')} onpointerleave={() => focus.set(null)}>
    <div>
      <div class="k">A (3 × 4)</div>
      <div class="g" style:grid-template-columns="repeat(4, 2rem)">
        {#each A as row, r (r)}{#each row as v, c (c)}<span class:hl={hlA(r, c)}>{v}</span>{/each}{/each}
      </div>
    </div>
    <div class="op">·</div>
    <div>
      <div class="k">B (4 × 2)</div>
      <div class="g" style:grid-template-columns="repeat(2, 2rem)">
        {#each B as row, r (r)}{#each row as v, c (c)}<span class:hl={hlB(r, c)}>{v}</span>{/each}{/each}
      </div>
    </div>
    <div class="op">=</div>
    <div>
      <div class="k">C (3 × 2){view === 'outer' ? ` — partial sum after k = ${step}` : ''}</div>
      <div class="g" style:grid-template-columns="repeat(2, 2.4rem)">
        {#each C as row, r (r)}{#each row as _, c (c)}<span class="c" class:hl={view === 'dot' && r === i && c === j}>{shownC(r, c)}</span>{/each}{/each}
      </div>
    </div>
  </div>

  <div class="explain">
    {#if view === 'dot'}
      <code>C[{i}][{j}] = </code>{#each A[i]! as a, k (k)}{k ? ' + ' : ''}<code>{a}·{B[k]![j]}</code>{/each}<code> = {C[i]![j]}</code>
      <p>Row {i} of A dotted with column {j} of B. There are M·N = {M * N} such dot products, each of length K = {K}: {2 * M * N * K} floating-point operations in all (2MNK).</p>
    {:else}
      <code>C += A[:, {step}] ⊗ B[{step}, :]</code>
      <p>Column {step} of A times row {step} of B is a whole 3×2 matrix (an outer product); C is the sum of K = {K} of them. This order streams through B row by row — the cache-friendly loop order our library uses.</p>
    {/if}
  </div>
</Widget>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.9rem;
  }
  .k {
    font-size: 0.72rem;
    color: var(--ink-2);
    margin-bottom: 0.25rem;
  }
  .g {
    display: grid;
    gap: 3px;
  }
  .g span {
    height: 2rem;
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    background: var(--surface-2);
    border-radius: 4px;
    transition: background-color 150ms;
  }
  .g span.hl {
    background: color-mix(in srgb, var(--series-2) 35%, var(--surface));
    font-weight: 650;
  }
  .g span.c {
    background: var(--accent-soft);
  }
  .g span.c.hl {
    background: var(--series-2);
    color: #fff;
  }
  .op {
    font-size: 1.3rem;
    color: var(--ink-3);
  }
  .explain {
    margin-top: 0.9rem;
    font-size: 0.85rem;
  }
  .explain p {
    margin: 0.4rem 0 0;
    color: var(--ink-2);
    font-size: 0.8rem;
  }
</style>
