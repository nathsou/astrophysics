<!-- Level 6: a NAND gate as it is drawn on the chip, 1.6 µm across (400 px per µm). -->
<script lang="ts">
  import { CELL, CHANNELS, CONTACTS_N, CONTACTS_P, N_DIFF, P_DIFF, POLY_A, POLY_B, POLY_W, POLY_Y } from './cmos';

  const yMid = 200; // the output wire's level, between the diffusions
</script>

<g class="s6">
  <rect class="sub" x="0" y="0" width="640" height="400" />
  <rect class="nwell" x={CELL.x0 - 8} y="46" width={CELL.x1 - CELL.x0 + 16} height="150" rx="3" />
  <text class="cap" x={CELL.x0 - 14} y="66" text-anchor="end">n-well</text>
  <text class="cap" x={CELL.x0 - 14} y="340" text-anchor="end">p-type substrate</text>

  <!-- supply rails -->
  <rect class="rail vdd" x="150" y="20" width="340" height="16" />
  <rect class="rail gnd" x="150" y="364" width="340" height="16" />
  <text class="rl" x="158" y="32">VDD</text>
  <text class="rl" x="158" y="376">GND</text>

  <!-- diffusions -->
  <rect class="diff p" x={P_DIFF.x0} y={P_DIFF.y0} width={P_DIFF.x1 - P_DIFF.x0} height={P_DIFF.y1 - P_DIFF.y0} rx="4" />
  <rect class="diff n" x={N_DIFF.x0} y={N_DIFF.y0} width={N_DIFF.x1 - N_DIFF.x0} height={N_DIFF.y1 - N_DIFF.y0} rx="4" />
  <text class="cap" x={CELL.x0 - 14} y={P_DIFF.y0 + 38} text-anchor="end">p+ diffusion</text>
  <text class="cap" x={CELL.x0 - 14} y={N_DIFF.y0 + 38} text-anchor="end">n+ diffusion</text>

  <!-- gates (polysilicon) and the channels under them -->
  {#each CHANNELS as c (c.id)}
    <rect class="chan" x={c.x} y={c.y} width={c.w} height={c.h} />
  {/each}
  {#each [POLY_A, POLY_B] as x, i (x)}
    <rect class="poly" x={x - POLY_W / 2} y={POLY_Y.y0} width={POLY_W} height={POLY_Y.y1 - POLY_Y.y0} rx="2" />
    <text class="in" x={x} y={POLY_Y.y1 + 18}>{i ? 'B' : 'A'}</text>
  {/each}

  <!-- metal 1 -->
  <g class="metal">
    <path d="M250 126V36M390 126V36" />
    <path d="M250 274V364" />
    <path d="M320 126V{yMid}H390V274M390 {yMid}H426" />
  </g>
  {#each CONTACTS_P as x (x)}<rect class="ct" x={x - 6} y="120" width="12" height="12" />{/each}
  {#each CONTACTS_N as x (x)}<rect class="ct" x={x - 6} y="268" width="12" height="12" />{/each}
  <text class="out" x="430" y={yMid - 8}>Y</text>

  <!-- labels for the four transistors -->
  <text class="tr" x={POLY_A + 12} y="86">P1</text><text class="tr" x={POLY_B + 12} y="86">P2</text>
  <text class="tr" x={POLY_A + 12} y="322">N1</text><text class="tr" x={POLY_B + 12} y="322">N2</text>
  <path class="callout" d="M{POLY_A - 1} 262L150 262" />
  <text class="cap" x="146" y="258" text-anchor="end">channel: the gate</text>
  <text class="cap" x="146" y="272" text-anchor="end">is 30 nm long</text>

  <!-- the same gate as a circuit -->
  <g transform="translate(452 60)">
    <rect class="inset" x="-6" y="-14" width="188" height="290" rx="6" />
    <text class="cap" x="6" y="0">the circuit</text>
    <path class="sch" d="M40 14H130M40 14V44M130 14V44" />
    <rect class="tbox" x="28" y="44" width="24" height="30" /><rect class="tbox" x="118" y="44" width="24" height="30" />
    <text class="tl" x="40" y="63">P1</text><text class="tl" x="130" y="63">P2</text>
    <path class="sch" d="M40 74V96H130V74M85 96V128" />
    <circle class="node" cx="85" cy="96" r="3.5" /><path class="sch" d="M85 112H160" /><text class="tl left" x="164" y="116">Y</text>
    <rect class="tbox" x="73" y="128" width="24" height="30" /><text class="tl" x="85" y="147">N1</text>
    <path class="sch" d="M85 158V172" />
    <rect class="tbox" x="73" y="172" width="24" height="30" /><text class="tl" x="85" y="191">N2</text>
    <path class="sch" d="M85 202V226M65 226H105" />
    <text class="tl dim end" x="26" y="18">VDD</text>
    <text class="tl dim end" x="60" y="230">GND</text>
    <text class="tl good left" x="6" y="262">Y = NOT (A AND B)</text>
  </g>
</g>

<style>
  .sub {
    fill: var(--pn);
  }
  .nwell {
    fill: color-mix(in srgb, var(--series-1) 14%, transparent);
    stroke: var(--series-1);
    stroke-width: 1.2;
    stroke-dasharray: 6 4;
  }
  .rail {
    stroke: var(--wire);
    stroke-width: 1.2;
  }
  .rail.vdd {
    fill: color-mix(in srgb, var(--volt-pos) 55%, var(--panel));
  }
  .rail.gnd {
    fill: color-mix(in srgb, var(--sig-current) 55%, var(--panel));
  }
  .rl {
    fill: var(--fg);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
  }
  .diff {
    stroke-width: 1.2;
  }
  .diff.p {
    fill: color-mix(in srgb, var(--series-7) 34%, var(--panel));
    stroke: var(--series-7);
  }
  .diff.n {
    fill: color-mix(in srgb, var(--series-1) 34%, var(--panel));
    stroke: var(--series-1);
  }
  .poly {
    fill: color-mix(in srgb, var(--copper) 75%, var(--panel));
    stroke: var(--copper-ink);
    stroke-width: 1;
  }
  .chan {
    fill: var(--sig-high);
    opacity: 0.55;
  }
  .metal path {
    fill: none;
    stroke: var(--silicon-metal);
    stroke-width: 9;
    stroke-linejoin: round;
    opacity: 0.9;
  }
  .ct {
    fill: var(--silicon);
    stroke: var(--wire);
    stroke-width: 1;
  }
  .cap {
    fill: var(--ink-2);
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .in,
  .out {
    fill: var(--fg);
    font-family: var(--font-mono);
    font-size: 15px;
    font-weight: 700;
    text-anchor: middle;
  }
  .out {
    text-anchor: start;
  }
  .tr {
    fill: var(--fg);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
  }
  .callout {
    fill: none;
    stroke: var(--ink-2);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .inset {
    fill: var(--panel);
    stroke: var(--line-strong);
    stroke-width: 1.2;
  }
  .sch {
    fill: none;
    stroke: var(--fg);
    stroke-width: 1.8;
    stroke-linejoin: round;
  }
  .tbox {
    fill: var(--panel);
    stroke: var(--fg);
    stroke-width: 1.6;
  }
  .tl {
    fill: var(--fg);
    font-family: var(--font-mono);
    font-size: 10px;
    text-anchor: middle;
  }
  .tl.dim {
    fill: var(--mute);
  }
  .tl.end {
    text-anchor: end;
  }
  .tl.left {
    text-anchor: start;
  }
  .tl.good {
    fill: var(--ok);
    font-size: 10.5px;
  }
  .node {
    fill: var(--fg);
  }
</style>
