<!--
  Where the cells go: Octet, and the RV32I core with its register file in flip-flops and in block RAM, as bars on one scale
  (the numbers are in budget.ts, and the tests that measure them). Hover or focus a segment for its size.

    ::cell-budget{n="31.6" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { FITS, type Fit } from './budget';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  const scale = 4800;
  const fmt = (v: number) => v.toLocaleString('en-GB');
  let hot = $state<{ fit: string; i: number } | null>(null);
  const tone = ['var(--sig-high)', 'var(--copper)', 'var(--line-strong)'];
  const width = (cells: number) => `${(100 * cells) / scale}%`;
  const detail = (f: Fit) => `${f.title}: ${fmt(f.total)} cells of ${fmt(f.capacity)} on the ${f.device}, ${fmt(f.flipFlops)} flip-flops, ${f.blockRams} block RAMs, ${f.fmaxMHz.toFixed(1)} MHz, ${f.seconds.toFixed(1)} s to fit`;
</script>

<Widget {n} title="The cell budget" subtitle="logic cells, on one scale" {caption} kind="Fit results">
  <div class="cb ui">
    {#each FITS as f (f.id)}
      <section aria-label={detail(f)}>
        <header>
          <h4>{f.title}</h4>
          <span class="dev">{f.device}</span>
        </header>
        <div class="track" style:--cap={width(f.capacity)}>
          {#each f.segments as s, i (s.label)}
            <button
              type="button"
              class="seg"
              class:hot={hot?.fit === f.id && hot.i === i}
              style:width={width(s.cells)}
              style:background={tone[i]}
              aria-label="{s.label}: {fmt(s.cells)} cells"
              onmouseenter={() => (hot = { fit: f.id, i })}
              onmouseleave={() => (hot = null)}
              onfocus={() => (hot = { fit: f.id, i })}
              onblur={() => (hot = null)}
            ></button>
          {/each}
          {#if f.capacity < scale}<span class="cap" title="The vFPGA-M has {fmt(f.capacity)} logic cells"></span>{/if}
        </div>
        <p class="line">
          <b>{fmt(f.total)}</b> cells{f.capacity < scale ? ` of ${fmt(f.capacity)}` : ''} · {fmt(f.flipFlops)} flip-flops · {f.blockRams} block RAM{f.blockRams === 1 ? '' : 's'} · <b>{f.fmaxMHz.toFixed(1)} MHz</b> · {f.seconds.toFixed(1)} s of CPU to fit
        </p>
        <p class="key">
          {#each f.segments as s, i (s.label)}
            <span class:hot={hot?.fit === f.id && hot.i === i}><i style:background={tone[i]}></i>{s.label} {fmt(s.cells)}</span>
          {/each}
        </p>
      </section>
    {/each}
    <p class="scale">Full width = {fmt(scale)} cells. The mark on Octet’s bar is the whole vFPGA-M (1,152 cells); the vFPGA-L (8,192) is off the scale.</p>
  </div>
</Widget>

<style>
  .cb {
    padding: 0.8rem 1rem 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    background: var(--panel);
  }
  header {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }
  h4 {
    margin: 0;
    font-size: 0.86rem;
    font-weight: 600;
  }
  .dev {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    color: var(--mute);
  }
  .track {
    position: relative;
    display: flex;
    height: 1.5rem;
    margin: 0.3rem 0 0.25rem;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: var(--pn);
    overflow: visible;
  }
  .seg {
    border: 0;
    border-right: 1px solid var(--panel);
    padding: 0;
    cursor: default;
    min-width: 2px;
  }
  .seg:first-of-type {
    border-radius: 3px 0 0 3px;
  }
  .seg.hot,
  .seg:focus-visible {
    outline: 2px solid var(--fg);
    outline-offset: 1px;
    z-index: 1;
  }
  .cap {
    position: absolute;
    top: -3px;
    bottom: -3px;
    left: var(--cap);
    border-left: 2px dashed var(--fg);
  }
  .line,
  .key {
    margin: 0.15rem 0;
    font-size: 0.76rem;
    color: var(--ink-2);
  }
  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.9rem;
    font-size: 0.7rem;
  }
  .key span {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .key span.hot {
    color: var(--fg);
    font-weight: 600;
  }
  .key i {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    border: 1px solid var(--line-strong);
  }
  .scale {
    margin: 0;
    font-size: 0.7rem;
    color: var(--mute);
  }
</style>
