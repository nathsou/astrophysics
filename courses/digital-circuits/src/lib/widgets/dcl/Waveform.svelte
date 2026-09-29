<!-- A failing test's waveform: each port over a few cycles, the failing cycle marked. -->
<script lang="ts">
  import type { Waveform } from '$lib/hdl';

  let { wave }: { wave: Waveform } = $props();

  const cycles = $derived(wave.signals[0]?.values.length ?? 0);
  const CW = 46;
  const RH = 22;
  const LW = 96;
  const width = $derived(LW + cycles * CW + 8);
  const height = $derived(wave.signals.length * RH + 24);
  const bitsOf = (t: Waveform['signals'][number]['type']) => (t.k === 'bits' ? t.w : t.k === 'enum' ? t.w : 1);
  const label = (v: bigint, w: number) => (w === 1 ? String(v) : v.toString(16));
  /** A step trace: high near the top of the row, low near the bottom. */
  function trace(values: bigint[], y: number): string {
    let d = '';
    values.forEach((v, i) => {
      const yy = v === 1n ? y + 4 : y + RH - 4;
      const x = LW + i * CW;
      d += i === 0 ? `M${x},${yy}` : `V${yy}`;
      d += `H${x + CW}`;
    });
    return d;
  }
</script>

<svg viewBox="0 0 {width} {height}" width={width} height={height} role="img" aria-label="Waveform of {wave.sim}.{wave.module} around the failure, at cycle {wave.marker}" class="wave">
  <rect class="mark" x={LW + (wave.marker - wave.firstCycle) * CW} y="0" width={CW} height={height} />
  {#each Array.from({ length: cycles }, (_, i) => i) as i (i)}
    <text class="cyc" class:fail={wave.firstCycle + i === wave.marker} x={LW + i * CW + CW / 2} y="12" text-anchor="middle">{wave.firstCycle + i}</text>
  {/each}
  {#each wave.signals as s, r (s.name)}
    {@const w = bitsOf(s.type)}
    {@const y = 24 + r * RH}
    <text class="name" x="4" y={y + RH / 2 + 4}>{wave.sim}.{s.name}</text>
    {#if w === 1}
      <path class="bit" d={trace(s.values, y)} />
    {:else}
      {#each s.values as v, i (i)}
        {@const changed = i === 0 || s.values[i - 1] !== v}
        <rect class="bus" class:changed x={LW + i * CW + 1} y={y + 3} width={CW - 2} height={RH - 6} rx="3" />
        <text class="val" x={LW + i * CW + CW / 2} y={y + RH / 2 + 4} text-anchor="middle">{label(v, w)}</text>
      {/each}
    {/if}
  {/each}
</svg>

<style>
  .wave {
    max-width: none;
    overflow: visible;
    font-family: var(--font-mono);
    font-size: 10px;
  }
  .mark {
    fill: var(--bad-soft);
  }
  .cyc {
    fill: var(--mute);
  }
  .cyc.fail {
    fill: var(--bad);
    font-weight: 700;
  }
  .name {
    fill: var(--ink-2);
  }
  .bit {
    fill: none;
    stroke: var(--sig-current);
    stroke-width: 1.6;
  }
  .bus {
    fill: color-mix(in srgb, var(--sig-current) 10%, transparent);
    stroke: var(--sig-current);
    stroke-width: 1;
  }
  .bus.changed {
    fill: color-mix(in srgb, var(--sig-current) 24%, transparent);
  }
  .val {
    fill: var(--fg);
  }
</style>
