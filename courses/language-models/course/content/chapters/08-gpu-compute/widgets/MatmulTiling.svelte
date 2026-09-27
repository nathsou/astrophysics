<!--
  Tiled matrix multiplication, step by step: one workgroup owns a T×T tile of C and walks along K,
  staging a tile of A and a tile of B in workgroup memory at each step.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';

  const S = 12; // matrix size (cells)
  const cell = 15;
  const gap = 18;
  let T = $state(4);
  let ti = $state(1);
  let tj = $state(2);
  let step = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;
  let playing = $state(false);

  const steps = $derived(S / T);
  const k0 = $derived(step * T);
  const size = S * cell;
  const ox = size + gap; // x of B and C
  const oy = size + gap; // y of A and C

  // Global-memory loads for this C tile after `step + 1` steps, tiled vs naive.
  const tiledLoads = $derived(2 * T * T * (step + 1));
  const naiveLoads = $derived(2 * T * T * T * (step + 1));

  function play() {
    if (playing) {
      stop();
      return;
    }
    playing = true;
    if (step >= steps - 1) step = 0;
    timer = setInterval(() => {
      if (step >= steps - 1) stop();
      else step++;
    }, 900);
  }
  function stop() {
    playing = false;
    clearInterval(timer);
  }
  onDestroy(stop);

  function pick(i: number, j: number) {
    ti = Math.floor(i / T);
    tj = Math.floor(j / T);
    step = 0;
  }

  const inTile = (r: number, c: number, r0: number, c0: number) => r >= r0 && r < r0 + T && c >= c0 && c < c0 + T;
  function fillA(r: number, c: number): string {
    if (inTile(r, c, ti * T, k0)) return 'var(--series-1)';
    if (r >= ti * T && r < ti * T + T && c < k0) return 'color-mix(in srgb, var(--series-1) 25%, var(--surface))';
    return 'var(--surface-2)';
  }
  function fillB(r: number, c: number): string {
    if (inTile(r, c, k0, tj * T)) return 'var(--series-2)';
    if (c >= tj * T && c < tj * T + T && r < k0) return 'color-mix(in srgb, var(--series-2) 25%, var(--surface))';
    return 'var(--surface-2)';
  }
  function fillC(r: number, c: number): string {
    if (inTile(r, c, ti * T, tj * T)) return `color-mix(in srgb, var(--series-3) ${30 + (70 * (step + 1)) / steps}%, var(--surface))`;
    return 'var(--surface-2)';
  }
</script>

<Widget
  title="Tiling: reuse every load many times"
  subtitle="Click a tile of C. Its workgroup walks along K; at each step all threads load one tile of A and one of B into workgroup memory, then compute from there."
  onreset={() => {
    stop();
    T = 4;
    ti = 1;
    tj = 2;
    step = 0;
  }}
>
  {#snippet controls()}
    <Button variant="primary" onclick={play}>{playing ? 'Pause' : 'Play'}</Button>
    <Button onclick={() => (stop(), (step = Math.max(0, step - 1)))} disabled={step === 0}>◀ Step</Button>
    <Button onclick={() => (stop(), (step = Math.min(steps - 1, step + 1)))} disabled={step >= steps - 1}>Step ▶</Button>
    <div class="grp">
      <span class="lbl">Tile size T</span>
      <Segmented
        label="Tile size"
        size="sm"
        options={[2, 3, 4, 6].map((v) => ({ value: v, label: String(v) }))}
        value={T}
        onchange={(v) => {
          stop();
          T = v;
          ti = Math.min(ti, S / v - 1);
          tj = Math.min(tj, S / v - 1);
          step = 0;
        }}
      />
    </div>
  {/snippet}

  <div class="layout">
    <svg viewBox="-24 -20 {2 * size + gap + 30} {2 * size + gap + 44}" role="img" aria-label="Tiled matrix multiplication: tiles of A and B combine into a tile of C">
      <text x={-8} y={oy + size / 2} class="mlabel" text-anchor="end">A</text>
      <text x={ox + size / 2} y={-6} class="mlabel" text-anchor="middle">B</text>
      {#each { length: S } as _, r (r)}
        {#each { length: S } as _, c (c)}
          <rect x={c * cell} y={oy + r * cell} width={cell - 1.5} height={cell - 1.5} rx="2" fill={fillA(r, c)} />
          <rect x={ox + c * cell} y={r * cell} width={cell - 1.5} height={cell - 1.5} rx="2" fill={fillB(r, c)} />
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <rect class="pick" x={ox + c * cell} y={oy + r * cell} width={cell - 1.5} height={cell - 1.5} rx="2" fill={fillC(r, c)} onclick={() => pick(r, c)} />
        {/each}
      {/each}
      <!-- tile outlines -->
      <rect class="outline" x={k0 * cell - 1} y={oy + ti * T * cell - 1} width={T * cell + 0.5} height={T * cell + 0.5} />
      <rect class="outline" x={ox + tj * T * cell - 1} y={k0 * cell - 1} width={T * cell + 0.5} height={T * cell + 0.5} />
      <rect class="outline" x={ox + tj * T * cell - 1} y={oy + ti * T * cell - 1} width={T * cell + 0.5} height={T * cell + 0.5} />
      <text x={ox + size / 2} y={oy + size + 16} class="mlabel" text-anchor="middle">C = A · B</text>
    </svg>

    <div class="side ui">
      <p class="stepline">
        Step <strong>{step + 1}</strong> of {steps}: <code>k0 = {k0}</code>
      </p>
      <ol class="phases">
        <li><span class="sw" style:background="var(--series-1)"></span>Load A[{ti * T}…{ti * T + T - 1}][{k0}…{k0 + T - 1}] into <code>As</code></li>
        <li><span class="sw" style:background="var(--series-2)"></span>Load B[{k0}…{k0 + T - 1}][{tj * T}…{tj * T + T - 1}] into <code>Bs</code></li>
        <li><code>workgroupBarrier()</code></li>
        <li><span class="sw" style:background="var(--series-3)"></span>Each of the {T * T} threads adds {T} products from <code>As</code>, <code>Bs</code></li>
        <li><code>workgroupBarrier()</code></li>
      </ol>
      <table class="loads">
        <thead><tr><th></th><th>global loads so far</th></tr></thead>
        <tbody>
          <tr><td>naive (each thread reads its own row and column)</td><td class="num">{naiveLoads}</td></tr>
          <tr><td>tiled (each value loaded once per workgroup)</td><td class="num">{tiledLoads}</td></tr>
        </tbody>
      </table>
      <p class="note">Tiling divides the global-memory traffic by <strong>T = {T}</strong>. Real kernels use T = 16 to 128.</p>
    </div>
  </div>
</Widget>

<style>
  .grp {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .lbl {
    font-size: 0.72rem;
    color: var(--ink-2);
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.5rem;
    align-items: center;
  }
  @media (max-width: 700px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  svg {
    width: 100%;
    max-width: 26rem;
  }
  .mlabel {
    font: 600 13px var(--font-ui);
    fill: var(--ink-2);
  }
  .outline {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.5;
    pointer-events: none;
  }
  .pick {
    cursor: pointer;
  }
  .side {
    font-size: 0.84rem;
  }
  .stepline {
    margin: 0 0 0.4rem;
  }
  .phases {
    margin: 0 0 0.8rem;
    padding-left: 1.2rem;
    line-height: 1.7;
  }
  .sw {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    margin-right: 0.4rem;
    vertical-align: -0.05rem;
  }
  .loads {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  .loads th {
    text-align: right;
    font-weight: 600;
    color: var(--ink-2);
    font-size: 0.72rem;
  }
  .loads td {
    padding: 0.2rem 0;
    border-top: 1px solid var(--rule);
  }
  .loads td.num {
    text-align: right;
    font-weight: 600;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
</style>
