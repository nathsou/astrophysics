<!-- Level 5: a block of standard cells, 30 µm across (21 px per µm). Rows are 0.9 µm tall. -->
<script lang="ts">
  import { NAND, NAND_ROW, ROWS, ROW_H, TOP, X0, X1, buildBlock } from './gates';

  const { rows, hs, vs } = buildBlock();
</script>

<g class="s5">
  <rect class="bg" x={X0 - 6} y="2" width={X1 - X0 + 12} height={ROWS * ROW_H + 12} />
  {#each rows as cells, r (r)}
    {@const y = TOP + r * ROW_H}
    {#each cells as c, i (i)}
      <rect class="cell t{c.tint}" class:nand={c.nand} x={c.x} y={y + 0.6} width={Math.max(0.5, c.w - 0.5)} height={ROW_H - 1.2} />
    {/each}
    <line class="rail {r % 2 ? 'gnd' : 'vdd'}" x1={X0} x2={X1} y1={y} y2={y} />
  {/each}
  <line class="rail {ROWS % 2 ? 'gnd' : 'vdd'}" x1={X0} x2={X1} y1={TOP + ROWS * ROW_H} y2={TOP + ROWS * ROW_H} />

  <g class="m2">{#each hs as s, i (i)}<line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />{/each}</g>
  <g class="m3">{#each vs as s, i (i)}<line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />{/each}</g>

  <circle class="ring" cx={NAND.x + NAND.w / 2} cy={TOP + NAND_ROW * ROW_H + ROW_H / 2} r="8" />
  <text class="cap" x={NAND.x + 22} y={TOP + NAND_ROW * ROW_H - 12}>one NAND gate</text>
  <text class="cap end" x="624" y="392">rows of standard cells, 0.9 µm tall</text>
</g>

<style>
  .bg {
    fill: var(--silicon);
    opacity: 0.85;
  }
  .cell {
    stroke: none;
  }
  .t0 {
    fill: color-mix(in srgb, var(--series-1) 30%, var(--silicon));
  }
  .t1 {
    fill: color-mix(in srgb, var(--series-4) 26%, var(--silicon));
  }
  .t2 {
    fill: color-mix(in srgb, var(--series-6) 26%, var(--silicon));
  }
  .t3 {
    fill: var(--sig-high);
  }
  .rail {
    stroke-width: 1;
    opacity: 0.9;
  }
  .rail.vdd {
    stroke: var(--volt-pos);
  }
  .rail.gnd {
    stroke: var(--sig-current);
  }
  .m2 line {
    stroke: var(--silicon-metal);
    stroke-width: 1.1;
    opacity: 0.75;
  }
  .m3 line {
    stroke: var(--copper);
    stroke-width: 1.1;
    opacity: 0.75;
  }
  .ring {
    fill: none;
    stroke: var(--sig-high);
    stroke-width: 1.6;
  }
  .cap.end {
    text-anchor: end;
  }
  .cap {
    fill: var(--silicon-metal);
    font-family: var(--font-mono);
    font-size: 11px;
    paint-order: stroke;
    stroke: var(--silicon);
    stroke-width: 3px;
  }
</style>
