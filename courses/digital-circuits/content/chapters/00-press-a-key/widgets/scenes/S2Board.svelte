<!-- Level 2: the board around the microcontroller, 35 mm across (18.3 px per mm). -->
<script lang="ts">
  const chip = { x: 266, y: 141, s: 128 };
  const pads = Array.from({ length: 12 }, (_, i) => i);
  // traces from the keys (bottom edge) into pads on the chip's lower edge
  const rowTraces = [
    { x0: 120, pad: 0 },
    { x0: 150, pad: 1 },
  ];
  const colTraces = [
    { x0: 200, pad: 2 },
    { x0: 235, pad: 3 },
    { x0: 270, pad: 4 },
    { x0: 305, pad: 5 },
  ];
  const padX = (k: number) => chip.x + 14 + k * 10;
  const trace = (x0: number, pad: number, i: number) => {
    const xp = padX(pad + 3);
    const ybend = 330 + i * 8;
    return `M${x0} 400V${ybend}L${x0 + (xp - x0) * 0.35} ${ybend - 12}H${xp}V${chip.y + chip.s + 9}`;
  };
</script>

<g class="s2">
  <rect class="pcb" x="0" y="0" width="640" height="400" />

  <!-- USB connector, half out of the frame at the top right -->
  <rect class="usb" x="502" y="-30" width="165" height="134" rx="8" />
  <rect class="usbin" x="522" y="-10" width="125" height="52" rx="10" />
  <rect class="tongue" x="538" y="4" width="93" height="10" rx="2" />
  <text class="cap" x="584" y="76">USB connector</text>
  <path class="dp" d="M545 104V150H{chip.x + chip.s + 9}" />
  <path class="dn" d="M562 104V166H{chip.x + chip.s + 9}" />
  <text class="wl" x="458" y="145">D+</text><text class="wl" x="458" y="181">D−</text>

  <!-- traces from the key matrix -->
  {#each rowTraces as t, i (i)}<path class="row" d={trace(t.x0, t.pad, i)} />{/each}
  {#each colTraces as t, i (i)}<path class="col" d={trace(t.x0, t.pad, i + 2)} />{/each}
  <text class="cap left" x="330" y="330">row and column wires,</text>
  <text class="cap left" x="330" y="345">from the keys, run in here</text>

  <!-- crystal and small parts -->
  <rect class="xtal" x="170" y="270" width="58" height="46" rx="4" />
  <rect class="xpad" x="178" y="296" width="14" height="12" /><rect class="xpad" x="206" y="296" width="14" height="12" />
  <text class="cap" x="199" y="290">16 MHz</text>
  <path class="row thin" d="M185 308V330H{padX(8)}V{chip.y + chip.s + 9}" />
  <path class="row thin" d="M213 308V318H{padX(9)}V{chip.y + chip.s + 9}" />
  {#each [[218, 180], [218, 196], [232, 180], [232, 196], [300, 110], [316, 110], [332, 110]] as [cx, cy], i (i)}
    <rect class="smd" x={cx} y={cy} width="12" height="6" />
  {/each}
  <path class="row thin" d="M230 183H{chip.x - 9}" /><path class="row thin" d="M230 199H{chip.x - 9}" />

  <!-- the chip: black plastic with pads peeking out at the edges -->
  {#each pads as k (k)}
    <rect class="pad" x={chip.x + 8 + k * 10} y={chip.y - 5} width="4.5" height="10" />
    <rect class="pad" x={chip.x + 8 + k * 10} y={chip.y + chip.s - 5} width="4.5" height="10" />
    <rect class="pad" x={chip.x - 5} y={chip.y + 8 + k * 10} width="10" height="4.5" />
    <rect class="pad" x={chip.x + chip.s - 5} y={chip.y + 8 + k * 10} width="10" height="4.5" />
  {/each}
  <rect class="chip" x={chip.x} y={chip.y} width={chip.s} height={chip.s} rx="4" />
  <circle class="dot" cx={chip.x + 14} cy={chip.y + 14} r="4" />
  <text class="mark" x={chip.x + chip.s / 2} y={chip.y + 58}>microcontroller</text>
  <text class="mark dim" x={chip.x + chip.s / 2} y={chip.y + 76}>7 × 7 mm</text>
  <text class="cap left" x={chip.x + chip.s + 18} y={chip.y + chip.s - 14}>44 connections</text>
</g>

<style>
  .pcb {
    fill: color-mix(in srgb, var(--phosphor) 22%, var(--panel));
  }
  .row,
  .col,
  .dp,
  .dn {
    fill: none;
    stroke-width: 4;
    stroke-linejoin: round;
  }
  .row {
    stroke: var(--copper);
  }
  .col {
    stroke: var(--sig-current);
    opacity: 0.85;
  }
  .thin {
    stroke-width: 2.4;
  }
  .dp {
    stroke: var(--sig-high);
  }
  .dn {
    stroke: var(--sig-x);
    opacity: 0.85;
  }
  .usb {
    fill: var(--surface-3);
    stroke: var(--wire);
    stroke-width: 2;
  }
  .usbin {
    fill: var(--pn);
    stroke: var(--wire);
    stroke-width: 1.4;
  }
  .tongue {
    fill: var(--silicon-metal);
    opacity: 0.85;
  }
  .xtal {
    fill: var(--surface-3);
    stroke: var(--wire);
    stroke-width: 1.6;
  }
  .xpad {
    fill: var(--silicon-metal);
  }
  .smd {
    fill: var(--silicon-metal);
    stroke: var(--wire);
    stroke-width: 0.8;
  }
  .pad {
    fill: var(--silicon-metal);
  }
  .chip {
    fill: var(--silicon);
    stroke: var(--wire);
    stroke-width: 1.6;
  }
  .dot {
    fill: var(--silicon-metal);
    opacity: 0.8;
  }
  .mark {
    fill: var(--silicon-metal);
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
    text-anchor: middle;
  }
  .mark.dim {
    font-size: 11px;
    opacity: 0.7;
    font-weight: 400;
  }
  .cap {
    fill: var(--fg);
    font-family: var(--font-mono);
    font-size: 11px;
    text-anchor: middle;
    opacity: 0.8;
  }
  .cap.left {
    text-anchor: start;
  }
  .wl {
    fill: var(--fg);
    font-family: var(--font-mono);
    font-size: 10px;
    opacity: 0.75;
  }
</style>
