<!--
  A barrel shifter. Eight bits go in at the top and pass through three stages of two-way multiplexers, one per bit of
  the shift amount: stage 0 shifts by 1 or not, stage 1 by 2 or not, stage 2 by 4 or not. Any shift from 0 to 7 is
  the sum of some of them, so three stages do what seven would. Click a bit of the input to change it.

    ::barrel-shifter{n="14.6" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { MODES, fromBits, shift, stages, toBits, type ShiftMode } from './shift';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  const N = 8;
  let x = $state(0b10110110);
  let amount = $state(3);
  let mode = $state<ShiftMode>('lsl');

  const st = $derived(stages(x, amount, mode, N));
  const out = $derived(fromBits(st[st.length - 1]!.bits));
  const inBits = $derived(toBits(x, N));
  const rows = $derived([{ label: 'input', bits: inBits, on: false, by: 0 }, ...st.map((s, j) => ({ label: `after stage ${j}`, bits: s.bits, on: s.enabled, by: s.by }))]);

  const CELL = 30;
  const GAP = 6;
  const PITCH = CELL + GAP;
  const X0 = 64;
  const ROWH = 62;
  const W = X0 + N * PITCH + 10;
  const H = 4 * ROWH + 10;
  const cx = (i: number) => X0 + i * PITCH + CELL / 2;
  const ry = (r: number) => 8 + r * ROWH;

  /** Where output position i (from the left) reads from in a stage that shifts by `by`, or −1 for a filled place. */
  function source(i: number, by: number, enabled: boolean): number {
    if (!enabled) return i;
    if (mode === 'lsl' || mode === 'rol') {
      const s = i + by;
      return s < N ? s : mode === 'rol' ? s - N : -1;
    }
    const s = i - by;
    return s >= 0 ? s : -1;
  }
  const flip = (i: number) => (x ^= 1 << (N - 1 - i));
  function keyFlip(e: KeyboardEvent, i: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      flip(i);
    }
  }
  const signed = (v: number) => (v >= 128 ? v - 256 : v);
  const meaning = $derived.by(() => {
    const k = amount;
    if (mode === 'lsl') return `Shift left by ${k}: ${x} × ${2 ** k} = ${x * 2 ** k}${x * 2 ** k > 255 ? `, which needs more than 8 bits, so the top ${Math.ceil(Math.log2(x * 2 ** k + 1)) - 8} bit(s) are lost and ${out} is left` : ''}.`;
    if (mode === 'lsr') return `Logical shift right by ${k}: ${x} ÷ ${2 ** k}, rounded down, is ${out}.`;
    if (mode === 'asr') return `Arithmetic shift right by ${k}: ${signed(x)} ÷ ${2 ** k}, rounded towards −∞, is ${signed(out)} (the sign bit is copied in).`;
    return `Rotate left by ${k}: the ${k} bit(s) that fall off the top come back in at the bottom.`;
  });
  function reset() {
    x = 0b10110110;
    amount = 3;
    mode = 'lsl';
  }
  const dir = (by: number) => (mode === 'lsl' || mode === 'rol' ? `left ${by}` : `right ${by}`);
</script>

<Widget title="Barrel shifter" subtitle="Any shift in three layers of multiplexers" {caption} n={fig} onreset={reset}>
  {#snippet controls()}
    <Segmented size="sm" label="Kind of shift" bind:value={mode} options={MODES.map((m) => ({ value: m.id, label: m.label, title: m.title }))} />
    <div class="amt ui" role="group" aria-label="Shift amount, one button per bit">
      {#each [2, 1, 0] as j (j)}
        <button type="button" class:on={(amount >> j) & 1} aria-pressed={!!((amount >> j) & 1)} onclick={() => (amount ^= 1 << j)} aria-label="Shift amount bit {j}, shifts by {2 ** j}: {(amount >> j) & 1}. Press to change.">
          <i>S{j}</i><span>{(amount >> j) & 1}</span>
        </button>
      {/each}
      <span class="eq">= shift by <b>{amount}</b></span>
    </div>
  {/snippet}

  <div class="bs">
    <svg viewBox="0 0 {W} {H}" role="group" aria-label="Barrel shifter: the input {inBits.join('')} shifted by {amount} gives {toBits(out, N).join('')}.">
      {#each rows as row, r (r)}
        {#if r > 0}
          {@const prev = rows[r - 1]!}
          {#each row.bits as _, i (i)}
            {@const s = source(i, row.by, row.on)}
            {#if s >= 0}
              <path class="w" class:hi={prev.bits[s]} class:live={row.on && s !== i} d="M{cx(s)} {ry(r - 1) + CELL} V{ry(r - 1) + CELL + 8} L{cx(i)} {ry(r) - 8} V{ry(r)}" />
            {:else}
              <path class="w fill" class:hi={row.bits[i]} d="M{cx(i)} {ry(r) - 10} V{ry(r)}" />
            {/if}
          {/each}
          <text class="lbl" x="4" y={ry(r) - 16 + 3}>stage {r - 1}: {row.on ? dir(row.by) : 'straight'}</text>
        {/if}
        <text class="row" x="4" y={ry(r) + CELL / 2 + 4}>{r === 0 ? 'input' : r === 3 ? 'output' : ''}</text>
        {#each row.bits as v, i (i)}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <g
            class="cell"
            class:hi={v}
            class:live={r === 0}
            role={r === 0 ? 'button' : undefined}
            tabindex={r === 0 ? 0 : undefined}
            aria-pressed={r === 0 ? !!v : undefined}
            aria-label={r === 0 ? `Input bit ${N - 1 - i}: ${v}. Press to change.` : undefined}
            onclick={() => r === 0 && flip(i)}
            onkeydown={(e) => r === 0 && keyFlip(e, i)}
          >
            <rect x={X0 + i * PITCH} y={ry(r)} width={CELL} height={CELL} rx="4" />
            <text x={cx(i)} y={ry(r) + CELL / 2 + 5} text-anchor="middle">{v}</text>
          </g>
        {/each}
      {/each}
    </svg>
    <p class="read ui" role="status">
      <code>{inBits.join('')}</code> ({x}) shifted becomes <code>{toBits(out, N).join('')}</code> ({out}). {meaning}
    </p>
  </div>
</Widget>

<style>
  .bs {
    display: grid;
    gap: 0.6rem;
  }
  svg {
    display: block;
    width: 100%;
    max-width: 30rem;
    height: auto;
    margin: 0 auto;
    font-family: var(--font-mono);
  }
  .cell rect {
    fill: var(--pn);
    stroke: var(--line-strong);
    stroke-width: 1.2;
  }
  .cell text {
    font-size: 13px;
    font-weight: 700;
    fill: var(--sig-low);
    pointer-events: none;
  }
  .cell.hi rect {
    fill: color-mix(in srgb, var(--sig-high) 20%, var(--panel));
    stroke: var(--sig-high);
  }
  .cell.hi text {
    fill: var(--sig-high);
  }
  .cell.live {
    cursor: pointer;
  }
  .cell.live:hover rect {
    stroke: var(--copper);
  }
  .cell:focus-visible {
    outline: none;
  }
  .cell:focus-visible rect {
    stroke: var(--focus);
    stroke-width: 3;
  }
  .w {
    fill: none;
    stroke: var(--sig-low);
    stroke-width: 1.2;
    opacity: 0.4;
    stroke-linejoin: round;
  }
  .w.hi {
    stroke: var(--sig-high);
  }
  .w.live {
    stroke-width: 2.4;
    opacity: 1;
  }
  .w.fill {
    stroke-dasharray: 2 2;
    opacity: 0.8;
  }
  .lbl,
  .row {
    font-size: 9px;
    fill: var(--mute);
    font-family: var(--font-ui);
  }
  .amt {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .amt button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--pn);
    color: var(--ink-2);
    font: inherit;
    font-size: 0.82rem;
    padding: 0.25rem 0.6rem;
    cursor: pointer;
  }
  .amt button i {
    font-style: normal;
  }
  .amt button span {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--sig-low);
  }
  .amt button.on {
    border-color: var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) 14%, var(--panel));
  }
  .amt button.on span {
    color: var(--sig-high);
  }
  .amt button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .eq {
    margin-left: 0.4rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .read {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-2);
    line-height: 1.55;
    text-align: center;
  }
  code {
    font-family: var(--font-mono);
    color: var(--fg);
    background: var(--pn);
    border-radius: 4px;
    padding: 0.05rem 0.3rem;
  }
</style>
