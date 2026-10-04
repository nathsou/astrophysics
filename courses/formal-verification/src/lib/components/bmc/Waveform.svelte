<!--
  A counterexample as a waveform, the way a hardware engineer reads a simulation: one row per state variable, one
  column per step. Booleans are drawn as a digital signal (high or low); other values as a bus, a band with the
  value written in it, pinched where the value changes. The step taken is written above each column; the last
  column is where the property fails.
-->
<script lang="ts">
  import type { Trace } from '$lib/fv/engines';

  let { trace, highlight, radix = $bindable('dec') }: { trace: Trace; highlight?: string[]; radix?: 'dec' | 'hex' | 'bin' } = $props();

  const rows = $derived.by(() => {
    const names = trace.steps[0]?.state.values.map((v) => v.name) ?? [];
    return names.map((name) => {
      const vals = trace.steps.map((s) => s.state.values.find((v) => v.name === name)?.value ?? '');
      const isBool = vals.every((x) => x === 'true' || x === 'false');
      return { name, vals, isBool, hot: highlight?.includes(name) ?? false };
    });
  });
  const n = $derived(trace.steps.length);
  const COL = 74;
  const LEFT = 104;
  const ROW = 30;
  const TOP = 34;
  const W = $derived(LEFT + n * COL + 8);
  const H = $derived(TOP + rows.length * ROW + 6);

  function fmt(v: string): string {
    if (!/^-?\d+$/.test(v) || radix === 'dec') return v;
    const x = BigInt(v);
    if (x < 0n) return v;
    return radix === 'hex' ? `0x${x.toString(16)}` : `0b${x.toString(2)}`;
  }
</script>

<div class="wave">
  <div class="opts ui">
    <span>Numbers in</span>
    {#each ['dec', 'hex', 'bin'] as r (r)}<label><input type="radio" bind:group={radix} value={r} /> {r}</label>{/each}
  </div>
  <div class="scroll">
    <svg width={W} height={H} viewBox="0 0 {W} {H}" role="img" aria-label="The counterexample as a waveform: one row per variable, one column per step">
      {#each trace.steps as s, i (i)}
        <text x={LEFT + i * COL + COL / 2} y="12" class="step" class:last={i === n - 1}>{i}</text>
        {#if s.label}<text x={LEFT + i * COL + 2} y="26" class="lab"><title>{s.label}</title>{s.label.length > 11 ? `${s.label.slice(0, 10)}…` : s.label}</text>{/if}
        <line x1={LEFT + i * COL} y1={TOP - 4} x2={LEFT + i * COL} y2={H} class="grid" />
      {/each}
      <rect x={LEFT + (n - 1) * COL} y={TOP - 4} width={COL} height={H - TOP + 4} class="fail" />
      {#each rows as r, j (r.name)}
        {@const y = TOP + j * ROW}
        <text x={LEFT - 8} y={y + ROW / 2 + 4} class="name" class:hot={r.hot}>{r.name}</text>
        {#if r.isBool}
          {@const pts = r.vals.flatMap((v, i) => {
            const yy = v === 'true' ? y + 6 : y + ROW - 8;
            return [`${LEFT + i * COL},${yy}`, `${LEFT + (i + 1) * COL},${yy}`];
          })}
          <polyline points={pts.join(' ')} class="sig" />
        {:else}
          {#each r.vals as v, i (i)}
            {@const x0 = LEFT + i * COL}
            {@const changed = i > 0 && r.vals[i - 1] !== v}
            {@const pinch = 5}
            <path d="M{x0 + (i === 0 || changed ? pinch : 0)},{y + 6} L{x0 + COL - (i === n - 1 || r.vals[i + 1] !== v ? pinch : 0)},{y + 6} L{x0 + COL},{y + ROW / 2 - 1} L{x0 + COL - (i === n - 1 || r.vals[i + 1] !== v ? pinch : 0)},{y + ROW - 8} L{x0 + (i === 0 || changed ? pinch : 0)},{y + ROW - 8} L{x0},{y + ROW / 2 - 1} Z" class="bus" class:changed />
            {#if i === 0 || changed}<text x={x0 + 8} y={y + ROW / 2 + 3} class="val"><title>{v}</title>{fmt(v).length > 9 ? `${fmt(v).slice(0, 8)}…` : fmt(v)}</text>{/if}
          {/each}
        {/if}
      {/each}
    </svg>
  </div>
</div>

<style>
  .wave {
    margin-top: 0.5rem;
  }
  .opts {
    display: flex;
    gap: 0.7rem;
    align-items: center;
    font-size: 0.78rem;
    color: var(--ink-2);
    margin-bottom: 0.3rem;
  }
  .opts input {
    accent-color: var(--ink-blue);
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
  .step {
    font-family: var(--font-ui);
    font-size: 10px;
    fill: var(--mute);
    text-anchor: middle;
  }
  .step.last {
    fill: var(--pencil);
    font-weight: 700;
  }
  .lab {
    font-family: var(--font-mono);
    font-size: 9px;
    fill: var(--ink-2);
  }
  .grid {
    stroke: var(--line);
    stroke-dasharray: 2 3;
  }
  .fail {
    fill: color-mix(in srgb, var(--pencil) 9%, transparent);
  }
  .name {
    font-family: var(--font-mono);
    font-size: 11px;
    fill: var(--fg);
    text-anchor: end;
  }
  .name.hot {
    fill: var(--pencil);
    font-weight: 700;
  }
  .sig {
    fill: none;
    stroke: var(--seal);
    stroke-width: 2;
  }
  .bus {
    fill: color-mix(in srgb, var(--ink-blue) 10%, transparent);
    stroke: var(--ink-blue);
    stroke-width: 1.2;
  }
  .bus.changed {
    fill: color-mix(in srgb, var(--gold) 22%, transparent);
  }
  .val {
    font-family: var(--font-mono);
    font-size: 10.5px;
    fill: var(--fg);
  }
</style>
