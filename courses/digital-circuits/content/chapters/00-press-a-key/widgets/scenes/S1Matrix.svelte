<!--
  Level 1: the keyboard's circuit board with the keycaps taken off, 12 cm across (5.33 px per mm).
  Four of the switches (Q W E R over A S D F) with their row and column traces, the microcontroller
  at the top right, and a cross-section of the pressed A switch.
-->
<script lang="ts">
  const PITCH = 101.6;
  const COLS = [90, 90 + PITCH, 90 + 2 * PITCH, 90 + 3 * PITCH];
  const ROWS = [232, 232 + PITCH];
  const KEYS = [
    ['Q', 'W', 'E', 'R'],
    ['A', 'S', 'D', 'F'],
  ];
  // pads of one switch, relative to its centre: column pad on the left, row pad up and to the right
  const colPad = { x: -20, y: 14 };
  const rowPad = { x: 14, y: -27 };
  const chip = { x: 520, y: 75, w: 37 };
  const rowY = ROWS.map((y) => y + rowPad.y);
  const colX = COLS.map((x) => x + colPad.x);
  // where the traces gather before they fan into the chip
  const busY = 150;
  const rowPath = (r: number) => {
    const x0 = COLS[0]! + rowPad.x;
    const x1 = COLS[3]! + rowPad.x + 24 + r * 8;
    return `M${x0} ${rowY[r]}H${x1}V${busY - r * 10}L${500 + r * 6} ${busY - 22 - r * 10}V${chip.y + chip.w / 2}`;
  };
  const colPath = (c: number) => {
    const x = colX[c]!;
    const yTop = 176 + c * 5;
    return `M${x} ${ROWS[1]! + colPad.y}V${yTop}H${420 + c * 8}L${512 + c * 6} ${busY - 40 + c * 5}V${chip.y + chip.w / 2}`;
  };
</script>

<g class="s1">
  <rect class="pcb" x="8" y="8" width="624" height="384" rx="10" />

  <!-- traces: rows on the top copper, columns on the bottom copper -->
  {#each [0, 1, 2, 3] as c (c)}
    <path class="col" d={colPath(c)} />
  {/each}
  {#each [0, 1] as r (r)}
    <path class="row" d={rowPath(r)} />
  {/each}

  <!-- switches -->
  {#each ROWS as ry, r (r)}
    {#each COLS as cx, c (c)}
      {@const isA = r === 1 && c === 0}
      <g transform="translate({cx} {ry})">
        <rect class="silk" class:hot={isA} x="-38" y="-38" width="76" height="76" rx="4" />
        <circle class="hole" cx="0" cy="0" r="11" />
        <circle class="pin" cx="-14" cy="-19" r="2.4" /><circle class="pin" cx="14" cy="-19" r="2.4" />
        <circle class="pad col" cx={colPad.x} cy={colPad.y} r="5.5" />
        <circle class="pad row" cx={rowPad.x} cy={rowPad.y} r="5.5" />
        <text class="key" x="0" y="32">{KEYS[r]![c]}</text>
      </g>
    {/each}
  {/each}

  <!-- the controller, a crystal, the USB connector -->
  <g class="mcu">
    <rect class="usb" x="566" y="8" width="54" height="34" rx="3" />
    <rect class="usbin" x="574" y="12" width="38" height="14" rx="2" />
    <rect class="xtal" x="474" y="98" width="17" height="13" rx="2" />
    <rect class="smd" x="440" y="60" width="9" height="5" /><rect class="smd" x="440" y="70" width="9" height="5" /><rect class="smd" x="440" y="80" width="9" height="5" />
    <rect class="smd" x="588" y="70" width="5" height="9" /><rect class="smd" x="598" y="70" width="5" height="9" />
    <rect class="chip" x={chip.x - chip.w / 2} y={chip.y - chip.w / 2} width={chip.w} height={chip.w} rx="2" />
    <circle class="dot" cx={chip.x - chip.w / 2 + 6} cy={chip.y - chip.w / 2 + 6} r="2" />
    <text class="lab" x={chip.x} y={chip.y + 3}>MCU</text>
    <text class="lab dim" x="597" y="60" >USB</text>
    <path class="dp" d="M566 24H{chip.x + chip.w / 2}V{chip.y - chip.w / 2}" />
  </g>

  <!-- cross-section of the pressed switch -->
  <g transform="translate(22 20)" class="inset">
    <rect class="frame" x="0" y="0" width="256" height="122" rx="6" />
    <text class="cap" x="10" y="15">cross-section: the A key, pressed</text>
    <!-- keycap and stem -->
    <path class="keycap" d="M78 24 h84 l8 30 h-100 z" />
    <rect class="stem" x="112" y="54" width="16" height="30" />
    <!-- spring, compressed -->
    <path class="spring" d="M104 54 l-8 3 l16 4 l-16 4 l16 4 l-16 4 l8 3" />
    <!-- contacts touching -->
    <path class="leaf" d="M40 100 H92 Q110 100 114 91" />
    <path class="leaf" d="M200 100 H150 Q132 100 128 91" />
    <circle class="touch" cx="121" cy="90" r="4" />
    <rect class="base" x="30" y="100" width="196" height="8" />
    <text class="lbl" x="34" y="94">row wire</text>
    <text class="lbl" x="172" y="94">column wire</text>
    <path class="arrow" d="M46 30 v20 m-4 -6 l4 6 l4 -6" />
    <text class="lbl" x="56" y="44">press</text>
    <text class="lbl good" x="121" y="118" text-anchor="middle">closed: row 1 is joined to column 0</text>
  </g>
</g>

<style>
  .pcb {
    fill: color-mix(in srgb, var(--phosphor) 22%, var(--panel));
    stroke: var(--line-strong);
    stroke-width: 1.6;
  }
  .row {
    fill: none;
    stroke: var(--copper);
    stroke-width: 2.4;
    stroke-linejoin: round;
  }
  .col {
    fill: none;
    stroke: var(--sig-current);
    stroke-width: 2.4;
    stroke-linejoin: round;
    opacity: 0.75;
    stroke-dasharray: 1 0;
  }
  .silk {
    fill: none;
    stroke: var(--fg);
    stroke-width: 1;
    opacity: 0.55;
  }
  .silk.hot {
    stroke: var(--sig-high);
    stroke-width: 2.2;
    opacity: 1;
  }
  .hole {
    fill: var(--pn);
    stroke: var(--wire);
    stroke-width: 1;
  }
  .pin {
    fill: var(--pn);
    stroke: var(--wire);
    stroke-width: 1;
  }
  .pad {
    stroke: var(--silicon-metal);
    stroke-width: 2;
  }
  .pad.col {
    fill: color-mix(in srgb, var(--sig-current) 55%, var(--panel));
  }
  .pad.row {
    fill: color-mix(in srgb, var(--copper) 60%, var(--panel));
  }
  .key {
    fill: var(--fg);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    text-anchor: middle;
    opacity: 0.85;
  }
  .chip {
    fill: var(--silicon);
    stroke: var(--wire);
    stroke-width: 1.2;
  }
  .dot {
    fill: var(--silicon-metal);
  }
  .lab {
    fill: var(--silicon-metal);
    font-family: var(--font-mono);
    font-size: 8px;
    font-weight: 600;
    text-anchor: middle;
  }
  .lab.dim {
    fill: var(--ink-2);
  }
  .usb {
    fill: var(--surface-3);
    stroke: var(--wire);
    stroke-width: 1.2;
  }
  .usbin {
    fill: var(--pn);
    stroke: var(--wire);
    stroke-width: 1;
  }
  .xtal {
    fill: var(--surface-3);
    stroke: var(--wire);
    stroke-width: 1;
  }
  .smd {
    fill: var(--silicon-metal);
    opacity: 0.85;
  }
  .dp {
    fill: none;
    stroke: var(--sig-high);
    stroke-width: 1.6;
    opacity: 0.85;
  }
  .frame {
    fill: var(--panel);
    stroke: var(--line-strong);
    stroke-width: 1.2;
  }
  .cap {
    fill: var(--ink-2);
    font-family: var(--font-mono);
    font-size: 9.5px;
  }
  .keycap {
    fill: color-mix(in srgb, var(--sig-high) 28%, var(--panel));
    stroke: var(--sig-high);
    stroke-width: 1.4;
  }
  .stem {
    fill: var(--surface-3);
    stroke: var(--wire);
    stroke-width: 1;
  }
  .spring {
    fill: none;
    stroke: var(--copper-ink);
    stroke-width: 1.4;
  }
  .leaf {
    fill: none;
    stroke: var(--silicon-metal);
    stroke-width: 2.6;
    stroke-linecap: round;
  }
  .touch {
    fill: var(--sig-high);
    stroke: none;
    opacity: 0.9;
  }
  .base {
    fill: color-mix(in srgb, var(--phosphor) 30%, var(--pn));
    stroke: var(--wire);
    stroke-width: 1;
  }
  .lbl {
    fill: var(--mute);
    font-family: var(--font-mono);
    font-size: 8.5px;
  }
  .lbl.good {
    fill: var(--ok);
  }
  .arrow {
    fill: none;
    stroke: var(--fg);
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
