<!--
  A small solderless breadboard, drawn from data (breadboard.ts), with a 74HC04 wired on it: how the strips and the
  rails connect, where the decoupling capacitor goes, and how a resistor and an LED share a strip with a chip's pin.
  Point at (or tap) a hole to see everything the board joins to it, or use the buttons. Every colour is a design token,
  and everything that colour says is also said in words.

    ::breadboard-diagram{n="D.3"}
-->
<script lang="ts">
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import {
    BOARD,
    BOTTOM_ROWS,
    CHIP,
    HOLES,
    LEADS,
    PLACED,
    RAILS,
    TOP_ROWS,
    WIRES,
    colX,
    describe,
    groupOf,
    holeAt,
    holesOf,
    pinHole,
    type Hole,
    type Wire,
  } from './breadboard';

  let { n }: { n?: string | number } = $props();

  interface Selection {
    groups: string[];
    text: string;
  }

  const PRESETS: Record<string, Selection> = {
    strip: { groups: ['t3'], text: describe('t3') },
    gap: {
      groups: ['t3', 'b3'],
      text: 'Holes 3e and 3f are next to each other and are not connected: the gap in the middle separates the two halves, and that is where a chip goes. Its two rows of pins are then on different strips, and each pin has four free holes to wire to.',
    },
    rail: { groups: ['top-plus'], text: describe('top-plus') },
    chip: {
      groups: ['t5', 'b6'],
      text: 'Each pin of the chip is in the top hole of its own strip. Pin 14 (VCC) is on strip 5a–5e, and the red wire in 5a takes it to the + rail. Pin 2, the inverter’s output, is on strip 6f–6j, and the resistor’s right-hand leg is in 6h.',
    },
  };

  let preset = $state<string>('strip');
  let picked = $state<Selection | undefined>();
  const sel = $derived(picked ?? PRESETS[preset]!);
  const isOn = (h: Hole) => sel.groups.indexOf(groupOf(h));

  function pick(h: Hole) {
    picked = { groups: [groupOf(h)], text: describe(groupOf(h)) };
  }

  const LEFT = 28;
  const RIGHT = 352;
  const strip = (group: string) => {
    const hs = holesOf(group);
    const a = hs[0]!;
    const b = hs.at(-1)!;
    return { x: a.x - 9, y: a.y - 9, w: b.x - a.x + 18, h: b.y - a.y + 18 };
  };
  const wirePath = (w: Wire) => [w.from, ...(w.via ?? []), w.to].map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  const wireTone = (c: Wire['colour']) => (c === 'red' ? 'red' : 'black');

  const pins = [1, 7, 8, 14].map((p) => ({ p, h: pinHole(p) }));
  const chipL = colX(CHIP.firstCol) - 12;
  const chipR = colX(CHIP.firstCol + 6) + 12;
  const rowLabelX = 58;
  const gapY = (holeAt('t', 1, 'e')!.y + holeAt('b', 1, 'f')!.y) / 2;
  const marks: { k: number; x: number; y: number }[] = [
    { k: 1, x: (colX(7) + colX(8)) / 2, y: 37 },
    { k: 2, x: (colX(3) + colX(4)) / 2, y: 132 },
    { k: 3, x: (colX(3) + colX(4)) / 2, y: gapY },
    { k: 4, x: (colX(4) + colX(5)) / 2, y: 37 },
    { k: 5, x: (colX(5) + colX(6)) / 2, y: 318 },
    { k: 6, x: (colX(3) + colX(4)) / 2, y: 278 },
  ];
  const cap = PLACED.capacitor;
  const res = PLACED.resistor;
  const led = PLACED.led;
  const resMid = (res.from.x + res.to.x) / 2;
  const ledMid = (led.anode.y + led.cathode.y) / 2;
</script>

<Widget
  title="A breadboard"
  {n}
  kind="Reference"
  live={false}
  caption="A 74HC04 on a small breadboard, with one inverter driving an LED. Its pin 1 input is tied to 0 V, so the output (pin 2) is high and the LED is lit. Point at any hole, or use the buttons, to see what the board joins to it. The black wires are drawn in the page’s ink colour."
>
  {#snippet controls()}
    <Segmented
      label="Show what is joined"
      size="sm"
      bind:value={preset}
      onchange={() => (picked = undefined)}
      options={[
        { value: 'strip', label: 'One strip' },
        { value: 'gap', label: 'Across the gap' },
        { value: 'rail', label: 'A power rail' },
        { value: 'chip', label: 'Under the chip' },
      ]}
    />
  {/snippet}

  <div class="bb ui">
    <svg
      viewBox="22 0 {BOARD.width - 26} {BOARD.height}"
      role="img"
      aria-label="A breadboard seen from above. Columns 1 to 12 have two halves of five holes, separated by a central gap; each half-column is one strip of metal. Four power rails run along the top and bottom. A 74HC04 straddles the gap in columns 5 to 11, with a red wire from pin 14 to the top plus rail, a black wire from pin 7 to the bottom minus rail, and pin 1 tied to the minus rail. A resistor joins pin 2 to an LED, whose other leg is in the bottom minus rail. A 100 nanofarad capacitor sits across the top rails."
    >
      <rect class="board" x={LEFT} y="6" width={RIGHT - LEFT} height={BOARD.height - 12} rx="9" />
      <rect class="groove" x={LEFT + 8} y={gapY - 6} width={RIGHT - LEFT - 16} height="12" rx="3" />

      <!-- rail stripes and signs -->
      {#each RAILS as r (r.id)}
        <path class="stripe {r.sign === '+' ? 'plus' : 'minus'}" d="M{colX(1) - 10} {r.y + (r.id.startsWith('top') ? -11 : 11)} H{colX(BOARD.cols) + 10}" />
      {/each}
      {#each TOP_ROWS as r, k (r)}<text class="rowl" x={rowLabelX} y={BOARD.topY + k * BOARD.pitch + 3.5} text-anchor="middle">{r}</text>{/each}
      {#each BOTTOM_ROWS as r, k (r)}<text class="rowl" x={rowLabelX} y={BOARD.bottomY + k * BOARD.pitch + 3.5} text-anchor="middle">{r}</text>{/each}
      {#each Array.from({ length: BOARD.cols }, (_, i) => i + 1) as c (c)}
        <text class="coll" x={colX(c)} y={BOARD.topY - 15} text-anchor="middle">{c}</text>
      {/each}

      <!-- the strips that are lit -->
      {#each sel.groups as g, i (g)}
        {@const s = strip(g)}
        <rect class="lit l{i}" x={s.x} y={s.y} width={s.w} height={s.h} rx="8" />
      {/each}

      <!-- holes -->
      <g>
        {#each HOLES as h (`${h.zone}${h.col}${h.row}`)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <g class="hole-hit" onclick={() => pick(h)} onpointerenter={(e) => e.pointerType === 'mouse' && pick(h)}>
            <circle class="hole" class:on0={isOn(h) === 0} class:on1={isOn(h) === 1} cx={h.x} cy={h.y} r="4.4" />
            <circle class="hit" cx={h.x} cy={h.y} r="10" />
          </g>
        {/each}
      </g>

      <!-- the chip -->
      <g class="chip" pointer-events="none">
        <rect class="body" x={chipL} y={holeAt('t', 1, 'e')!.y - 12} width={chipR - chipL} height={holeAt('b', 1, 'f')!.y - holeAt('t', 1, 'e')!.y + 24} rx="3" />
        <path class="notch" d="M{chipL} {gapY - 6} a6 6 0 0 1 0 12" />
        <circle class="pin1" cx={chipL + 7} cy={holeAt('b', 1, 'f')!.y + 5} r="2.2" />
        {#each Array.from({ length: CHIP.pins }, (_, i) => i + 1) as p (p)}
          {@const h = pinHole(p)}
          <rect class="leg" x={h.x - 2.6} y={h.y - 5} width="5.2" height="10" rx="1" />
        {/each}
        <text class="cname" x={(chipL + chipR) / 2 + 3} y={gapY + 3.5} text-anchor="middle">{CHIP.name}</text>
        {#each pins as { p, h } (p)}
          <text class="pinl" x={p === 14 ? h.x - 7 : p === 7 ? h.x + 7 : h.x} y={p > 7 ? h.y + 13 : h.y - 8} text-anchor={p === 14 ? 'start' : p === 7 ? 'end' : 'middle'}>
            {p === 14 ? '14 VCC' : p === 7 ? '7 GND' : p}
          </text>
        {/each}
      </g>

      <!-- wires -->
      {#each WIRES as w (w.id)}
        <path class="wire {wireTone(w.colour)}" d={wirePath(w)} />
        {#each [w.from, w.to] as e, i (i)}<circle class="end {wireTone(w.colour)}" cx={e.x} cy={e.y} r="3.6" />{/each}
      {/each}
      {#each LEADS as l (l.id)}
        <path class="wire {wireTone(l.colour)}" d="M{l.to.x} {l.to.y} H{BOARD.width - 12}" />
        <circle class="end {wireTone(l.colour)}" cx={l.to.x} cy={l.to.y} r="3.6" />
        <text class="lead" x={BOARD.width - 12} y={l.to.y + (l.colour === 'red' ? 13 : -6)} text-anchor="end">{l.label}</text>
      {/each}

      {#each RAILS as r (r.id)}
        <text class="sign {r.sign === '+' ? 'plus' : 'minus'}" x={rowLabelX} y={r.y + 5} text-anchor="middle">{r.sign}</text>
      {/each}

      <!-- a capacitor between the top rails -->
      <g pointer-events="none">
        <path class="leg2" d="M{cap.from.x} {cap.from.y} V{cap.to.y}" />
        <rect class="capbody" x={cap.from.x - 6} y={cap.to.y + 4} width="12" height={cap.from.y - cap.to.y - 8} rx="3" />
      </g>

      <!-- a resistor from pin 2's strip to the LED's strip -->
      <g pointer-events="none">
        <path class="leg2" d="M{res.from.x} {res.from.y} H{res.to.x}" />
        <rect class="resbody" x={resMid - 20} y={res.from.y - 6} width="40" height="12" rx="4" />
        <path class="band" d="M{resMid - 11} {res.from.y - 6} v12 M{resMid - 3} {res.from.y - 6} v12 M{resMid + 5} {res.from.y - 6} v12" />
        <text class="val" x={resMid} y={res.from.y - 10} text-anchor="middle">{res.label}</text>
      </g>

      <!-- the LED -->
      <g pointer-events="none">
        <path class="leg2" d="M{led.anode.x} {led.anode.y} V{led.cathode.y}" />
        <circle class="glow" cx={led.anode.x} cy={ledMid} r="17" />
        <circle class="ledbody" cx={led.anode.x} cy={ledMid} r="9" />
        <text class="val" x={led.anode.x + 14} y={led.anode.y + 5}>+</text>
        <text class="val" x={led.anode.x + 14} y={led.cathode.y - 1}>−</text>
      </g>

      <!-- numbered markers -->
      {#each marks as m (m.k)}
        <g pointer-events="none">
          <circle class="mark" cx={m.x} cy={m.y} r="7.2" />
          <text class="markn" x={m.x} y={m.y + 3.2} text-anchor="middle">{m.k}</text>
        </g>
      {/each}
    </svg>

    <p class="says" aria-live="polite">{sel.text}</p>

    <ol class="key">
      <li><b>The rails.</b> Each of the four rails is one wire along the whole board. The supply’s red lead is in the top + rail (5 V), its black lead in the top − rail (0 V), and a black wire on the left joins the two − rails, so that ground is also at the bottom.</li>
      <li><b>A strip.</b> The five holes of a column, on one side of the gap, are one wire. Rows a to e are one half, f to j the other.</li>
      <li><b>The gap.</b> The two halves are not joined, so a chip pushed across it has each of its pins on a strip of its own.</li>
      <li><b>Decoupling.</b> The 100 nF capacitor is across the supply rails, as close to the chip as it will go: the chip’s switching current comes from it and not from the supply’s long leads.</li>
      <li><b>A tied-off input.</b> Pin 1 goes to ground, not to nothing. The other five inverters’ inputs (pins 3, 5, 9, 11 and 13) would be tied too; they are left out to keep the drawing clear.</li>
      <li><b>A series resistor.</b> Its left leg is in pin 2’s strip and its right leg in the LED’s: the resistor is what limits the current, and it needs a strip of its own at each end.</li>
    </ol>
  </div>
</Widget>

<style>
  .bb {
    padding: 0.8rem 1rem 1.1rem;
    display: grid;
    gap: 0.8rem;
  }
  svg {
    display: block;
    width: 100%;
    max-width: 30rem;
    height: auto;
    margin: 0 auto;
    font-family: var(--font-mono);
    touch-action: manipulation;
  }
  .board {
    fill: var(--pn);
    stroke: var(--line-strong);
    stroke-width: 1.5;
  }
  .groove {
    fill: var(--line);
  }
  .stripe {
    stroke-width: 1.8;
    fill: none;
  }
  .stripe.plus,
  .sign.plus {
    stroke: var(--volt-pos);
    fill: var(--volt-pos);
  }
  .stripe.minus,
  .sign.minus {
    stroke: var(--volt-neg);
    fill: var(--volt-neg);
  }
  .sign {
    font-size: 15px;
    font-weight: 700;
    stroke: var(--pn) !important;
    stroke-width: 4;
    paint-order: stroke;
  }
  .rowl,
  .coll {
    fill: var(--mute);
    font-size: 11px;
  }
  .hole {
    fill: var(--bg);
    stroke: var(--line-strong);
    stroke-width: 1;
    transition: fill 0.12s;
  }
  .hole.on0 {
    fill: var(--copper);
    stroke: var(--copper-ink);
  }
  .hole.on1 {
    fill: var(--series-1);
    stroke: var(--series-1);
  }
  .hit {
    fill: transparent;
  }
  .hole-hit {
    cursor: pointer;
  }
  .lit {
    stroke-width: 1.4;
  }
  .lit.l0 {
    fill: color-mix(in srgb, var(--copper) 22%, transparent);
    stroke: var(--copper);
  }
  .lit.l1 {
    fill: color-mix(in srgb, var(--series-1) 20%, transparent);
    stroke: var(--series-1);
  }
  .body {
    fill: var(--silicon);
    stroke: var(--fg);
    stroke-width: 1;
  }
  .notch {
    fill: var(--pn);
    stroke: var(--fg);
    stroke-width: 1;
  }
  .pin1 {
    fill: var(--silicon-metal);
  }
  .leg {
    fill: var(--silicon-metal);
    stroke: var(--fg);
    stroke-width: 0.6;
  }
  .cname {
    fill: var(--silicon-metal);
    font-size: 12px;
    font-weight: 600;
  }
  .pinl {
    fill: var(--silicon-metal);
    font-size: 10px;
  }
  .wire {
    fill: none;
    stroke-width: 3.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .wire.red,
  .end.red {
    stroke: var(--volt-pos);
    fill: var(--volt-pos);
  }
  .wire.black,
  .end.black {
    stroke: var(--fg);
    fill: var(--fg);
  }
  .wire {
    fill: none !important;
  }
  .end {
    stroke: none !important;
  }
  .lead {
    fill: var(--fg);
    font-size: 11px;
    font-weight: 600;
  }
  .leg2 {
    stroke: var(--wire);
    stroke-width: 2;
    fill: none;
  }
  .capbody {
    fill: var(--copper);
    stroke: var(--copper-ink);
    stroke-width: 1;
  }
  .resbody {
    fill: color-mix(in srgb, var(--copper) 35%, var(--panel));
    stroke: var(--copper-ink);
    stroke-width: 1.2;
  }
  .band {
    stroke: var(--copper-ink);
    stroke-width: 2;
    fill: none;
  }
  .val {
    fill: var(--ink-2);
    font-size: 10.5px;
    font-weight: 600;
  }
  .glow {
    fill: var(--sig-high-glow);
  }
  .ledbody {
    fill: var(--sig-high);
    stroke: var(--fg);
    stroke-width: 1.2;
  }
  .mark {
    fill: var(--copper-ink);
    stroke: var(--panel);
    stroke-width: 1.2;
  }
  .markn {
    fill: var(--on-accent);
    font-family: var(--font-ui);
    font-size: 10px;
    font-weight: 700;
  }
  .says {
    margin: 0 !important;
    min-height: 4.2em;
    padding: 0.55rem 0.8rem;
    border-left: 3px solid var(--copper);
    background: var(--pn);
    border-radius: 0 6px 6px 0;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .key {
    margin: 0;
    padding-left: 1.3rem;
    display: grid;
    gap: 0.35rem;
    font-size: 0.84rem;
    color: var(--ink-2);
  }
  .key li {
    margin: 0;
    padding-left: 0.2rem;
  }
  .key b {
    color: var(--fg);
  }
  @media (max-width: 560px) {
    .bb {
      padding: 0.6rem 0.4rem 0.9rem;
    }
    .key {
      padding-left: 1.6rem;
      padding-right: 0.5rem;
    }
  }
</style>
