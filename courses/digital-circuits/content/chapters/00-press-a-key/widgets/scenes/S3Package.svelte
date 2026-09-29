<!-- Level 3: the chip package, seen as if the plastic were glass. 14.4 mm across (44 px per mm). -->
<script lang="ts">
  const body = { x: 164, y: 44, s: 312 };
  const die = { x: 253, y: 133, s: 134 };
  const N = 11; // leads per side
  const pitch = 22;
  const dpitch = 10.4;
  const off = (body.s - (N - 1) * pitch) / 2;
  const doff = (die.s - (N - 1) * dpitch) / 2;
  const idx = Array.from({ length: N }, (_, i) => i);
  const lx = (i: number) => body.x + off + i * pitch;
  const ly = (i: number) => body.y + off + i * pitch;
  const dx = (i: number) => die.x + doff + i * dpitch;
  const dy = (i: number) => die.y + doff + i * dpitch;
</script>

<g class="s3">
  <rect class="pcb" x="0" y="0" width="640" height="400" />
  <!-- board pads -->
  {#each idx as i (i)}
    <rect class="bpad" x={lx(i) - 5} y={body.y - 10} width="10" height="22" />
    <rect class="bpad" x={lx(i) - 5} y={body.y + body.s - 12} width="10" height="22" />
    <rect class="bpad" x={body.x - 10} y={ly(i) - 5} width="22" height="10" />
    <rect class="bpad" x={body.x + body.s - 12} y={ly(i) - 5} width="22" height="10" />
  {/each}

  <rect class="body" x={body.x} y={body.y} width={body.s} height={body.s} rx="10" />

  <!-- lead frame: fingers into the package and the die pad -->
  <g class="frame">
    {#each idx as i (i)}
      <rect x={lx(i) - 4} y={body.y + 8} width="8" height="46" />
      <rect x={lx(i) - 4} y={body.y + body.s - 54} width="8" height="46" />
      <rect x={body.x + 8} y={ly(i) - 4} width="46" height="8" />
      <rect x={body.x + body.s - 54} y={ly(i) - 4} width="46" height="8" />
    {/each}
    <rect class="dieattach" x={die.x - 10} y={die.y - 10} width={die.s + 20} height={die.s + 20} rx="3" />
  </g>

  <!-- bond wires: die pads to fingers -->
  <g class="wires">
    {#each idx as i (i)}
      <path d="M{dx(i)} {die.y + 4} L{lx(i)} {body.y + 54}" />
      <path d="M{dx(i)} {die.y + die.s - 4} L{lx(i)} {body.y + body.s - 54}" />
      <path d="M{die.x + 4} {dy(i)} L{body.x + 54} {ly(i)}" />
      <path d="M{die.x + die.s - 4} {dy(i)} L{body.x + body.s - 54} {ly(i)}" />
    {/each}
  </g>

  <!-- the die -->
  <rect class="die" x={die.x} y={die.y} width={die.s} height={die.s} rx="2" />
  {#each idx as i (i)}
    <rect class="dpad" x={dx(i) - 2.4} y={die.y + 2} width="4.8" height="4.8" />
    <rect class="dpad" x={dx(i) - 2.4} y={die.y + die.s - 7} width="4.8" height="4.8" />
    <rect class="dpad" x={die.x + 2} y={dy(i) - 2.4} width="4.8" height="4.8" />
    <rect class="dpad" x={die.x + die.s - 7} y={dy(i) - 2.4} width="4.8" height="4.8" />
  {/each}
  <rect class="core" x={die.x + 14} y={die.y + 14} width={die.s - 28} height={die.s - 28} />

  <!-- the plastic, semi-transparent, with its marking -->
  <rect class="glass" x={body.x} y={body.y} width={body.s} height={body.s} rx="10" />
  <circle class="dot" cx={body.x + 20} cy={body.y + 20} r="5" />
  <text class="mark" x={body.x + 34} y={body.y + 26}>MCU-44</text>

  <text class="cap" x="320" y="26">the package, 7 × 7 mm</text>
  <text class="cap left" x={body.x + body.s + 20} y="140">bond wires,</text>
  <text class="cap left" x={body.x + body.s + 20} y="155">thinner than a hair</text>
  <text class="cap left" x={body.x + body.s + 20} y="250">the die: 3 × 3 mm</text>
</g>

<style>
  .pcb {
    fill: color-mix(in srgb, var(--phosphor) 22%, var(--panel));
  }
  .bpad {
    fill: var(--silicon-metal);
    opacity: 0.9;
  }
  .body {
    fill: var(--silicon);
    stroke: var(--wire);
    stroke-width: 2;
  }
  .frame rect {
    fill: var(--copper);
    opacity: 0.85;
  }
  .frame .dieattach {
    fill: var(--silicon-metal);
    opacity: 0.6;
    stroke: var(--copper-ink);
    stroke-width: 1;
  }
  .wires path {
    fill: none;
    stroke: var(--silicon-metal);
    stroke-width: 1;
  }
  .die {
    fill: color-mix(in srgb, var(--series-1) 35%, var(--silicon));
    stroke: var(--wire);
    stroke-width: 1.4;
  }
  .dpad {
    fill: var(--silicon-metal);
  }
  .core {
    fill: none;
    stroke: var(--sig-current);
    stroke-width: 0.8;
    stroke-dasharray: 2 3;
    opacity: 0.7;
  }
  .glass {
    fill: color-mix(in srgb, var(--silicon) 42%, transparent);
    stroke: none;
  }
  .dot {
    fill: var(--silicon-metal);
    opacity: 0.7;
  }
  .mark {
    fill: var(--silicon-metal);
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
    opacity: 0.85;
  }
  .cap {
    fill: var(--fg);
    font-family: var(--font-mono);
    font-size: 11.5px;
    text-anchor: middle;
    opacity: 0.85;
  }
  .cap.left {
    text-anchor: start;
  }
</style>
