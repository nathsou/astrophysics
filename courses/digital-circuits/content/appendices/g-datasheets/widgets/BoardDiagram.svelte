<!--
  The virtual board, and the segment patterns of its digits, from the board model (studio/fpga/board.ts).

    ::board-diagram{part="board"}       the board's resources
    ::board-diagram{part="segments"}    the seven-segment pattern of every hexadecimal digit
-->
<script lang="ts">
  import '../../a-reference/widgets/appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import SevenSeg from '$lib/studio/chips/SevenSeg.svelte';
  import { HEX_SEGMENTS } from '$lib/studio/fpga/board';

  let { part = 'board', n, caption }: { part?: 'board' | 'segments'; n?: string | number; caption?: string } = $props();

  const hex = (v: number) => `0x${v.toString(16).padStart(2, '0')}`;
</script>

{#if part === 'board'}
  <Widget title="The virtual board" {n} kind="Diagram" live={false} {caption}>
    <div class="wrap">
      <svg viewBox="0 0 640 300" role="img" aria-label="The virtual board: a clock and a reset button, four push buttons, eight switches, eight LEDs and four seven-segment digits">
        <rect class="pcb" x="4" y="4" width="632" height="292" rx="10" />
        <!-- clock and reset -->
        <rect class="btn" x="24" y="24" width="60" height="30" rx="5" />
        <text class="t" x="54" y="43" text-anchor="middle">clk</text>
        <rect class="btn" x="98" y="24" width="60" height="30" rx="5" />
        <text class="t" x="128" y="43" text-anchor="middle">rst</text>
        <text class="s" x="24" y="72">clock (rates 1 Hz … 1 kHz, or as fast as it goes) and reset</text>
        <!-- buttons -->
        {#each [0, 1, 2, 3] as i (i)}
          <circle class="btn" cx={44 + i * 52} cy="112" r="16" />
          <text class="t" x={44 + i * 52} y="116" text-anchor="middle">{i}</text>
        {/each}
        <text class="s" x="24" y="146">btn[3:0], four push buttons</text>
        <!-- switches -->
        {#each [7, 6, 5, 4, 3, 2, 1, 0] as b, i (b)}
          <rect class="sw" x={24 + i * 34} y="166" width="22" height="40" rx="4" />
          <rect class="knob" x={27 + i * 34} y="170" width="16" height="16" rx="3" />
          <text class="t" x={35 + i * 34} y="222" text-anchor="middle">{b}</text>
        {/each}
        <text class="s" x="24" y="244">sw[7:0], eight switches</text>
        <!-- LEDs -->
        {#each [7, 6, 5, 4, 3, 2, 1, 0] as b, i (b)}
          <circle class="led" cx={35 + i * 34} cy="268" r="8" />
        {/each}
        <text class="s" x="24" y="292">led[7:0], eight LEDs</text>
        <!-- digits -->
        {#each [3, 2, 1, 0] as d, i (d)}
          <g transform="translate({372 + i * 66} 30)">
            <SevenSeg segments={HEX_SEGMENTS[[0xa, 0xb, 0xc, 0xd][i]!]} size={52} label="digit {d}" />
          </g>
          <text class="t" x={398 + i * 66} y="140" text-anchor="middle">seg{d}</text>
        {/each}
        <text class="s" x="372" y="166">four digits: seg3 (left) to seg0 (right),</text>
        <text class="s" x="372" y="182">or seg with an (multiplexed)</text>
      </svg>
    </div>
  </Widget>
{:else}
  <Widget title="Segment patterns" {n} kind="Reference" live={false} {caption}>
    <div class="grid">
      {#each HEX_SEGMENTS as v, d (d)}
        <div class="cell">
          <SevenSeg segments={v} size={40} label="hexadecimal digit {d.toString(16).toUpperCase()}" />
          <span class="d">{d.toString(16).toUpperCase()}</span>
          <code>{hex(v)}</code>
          <code class="bin">{v.toString(2).padStart(7, '0')}</code>
        </div>
      {/each}
    </div>
  </Widget>
{/if}

<style>
  .wrap {
    padding: 0.8rem;
    display: flex;
    justify-content: center;
  }
  svg {
    width: 100%;
    max-width: 40rem;
    height: auto;
  }
  .pcb {
    fill: var(--panel);
    stroke: var(--line-strong);
    stroke-width: 1.5;
  }
  .btn {
    fill: var(--pn);
    stroke: var(--line-strong);
    stroke-width: 1.5;
  }
  .sw {
    fill: var(--pn);
    stroke: var(--line-strong);
    stroke-width: 1.5;
  }
  .knob {
    fill: var(--copper);
  }
  .led {
    fill: var(--sig-high);
    opacity: 0.55;
    stroke: var(--line-strong);
  }
  .t {
    font: 600 11px var(--font-mono);
    fill: var(--fg);
  }
  .s {
    font: 11px var(--font-ui);
    fill: var(--ink-2);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
    gap: 0.8rem 0.6rem;
    padding: 1rem 0.9rem;
  }
  .cell {
    display: grid;
    justify-items: center;
    gap: 0.15rem;
    font-family: var(--font-ui);
  }
  .d {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--fg);
  }
  code {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .bin {
    color: var(--mute);
    font-size: 0.72rem;
  }
</style>
