<!--
  From network to expression: three clickable switches in a series–parallel network, the Boolean
  expression the network computes with each variable replaced by its value, and the truth table with
  the current row marked. Wires that carry current are lit amber; the wires of a branch that is broken
  stay dark. Rows of the truth table are buttons that set the switches.

    ::series-parallel{caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { NETWORKS, litCount, rowIndex, rows, substituted, type NetworkId, type Switches } from './network';

  let { caption, n }: { caption?: string; n?: string | number } = $props();

  let id = $state<NetworkId>('ab-c');
  let sw = $state<Switches>({ a: false, b: false, c: false });
  const net = $derived(NETWORKS[id]);
  const lit = $derived(net.conducts(sw));
  const active = $derived(rowIndex(sw));
  const table = rows();

  const key = (k: 'a' | 'b' | 'c') => (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      sw[k] = !sw[k];
    }
  };

  const NAMES = { a: 'A', b: 'B', c: 'C' } as const;

  // Geometry of the two drawings, in SVG units. Each switch is 40 wide with its pins at the ends.
  type Sw = { k: 'a' | 'b' | 'c'; x: number; y: number };
  interface Wire {
    d: string;
    /** Which switch's branch this wire belongs to, or null for wires shared by all paths. */
    of: 'a' | 'b' | 'c' | null;
  }
  interface Drawing {
    switches: Sw[];
    wires: Wire[];
  }
  const DRAWINGS: Record<NetworkId, Drawing> = {
    'ab-c': {
      switches: [
        { k: 'a', x: 84, y: 50 },
        { k: 'b', x: 160, y: 50 },
        { k: 'c', x: 122, y: 110 },
      ],
      wires: [
        { d: 'M28 80 H48', of: null },
        { d: 'M48 50 V110', of: null },
        { d: 'M48 50 H84 M124 50 H160 M200 50 H262', of: 'a' },
        { d: 'M48 110 H122 M162 110 H262', of: 'c' },
        { d: 'M262 50 V110', of: null },
        { d: 'M262 80 H317', of: null },
      ],
    },
    'a-bc': {
      switches: [
        { k: 'a', x: 52, y: 80 },
        { k: 'b', x: 166, y: 50 },
        { k: 'c', x: 166, y: 110 },
      ],
      wires: [
        { d: 'M28 80 H52 M92 80 H130', of: 'a' },
        { d: 'M130 50 V110', of: null },
        { d: 'M130 50 H166 M206 50 H262', of: 'b' },
        { d: 'M130 110 H166 M206 110 H262', of: 'c' },
        { d: 'M262 50 V110', of: null },
        { d: 'M262 80 H317', of: null },
      ],
    },
  };
  const drawing = $derived(DRAWINGS[id]);
  const wireOn = (w: Wire) => (w.of === null ? lit : net.branch(sw, w.of));

  function reset() {
    sw = { a: false, b: false, c: false };
  }
</script>

<Widget title="From network to expression" {n} {caption} onreset={reset}>
  {#snippet controls()}
    <Segmented
      label="Network"
      value={id}
      onchange={(v) => (id = v)}
      options={[
        { value: 'ab-c', label: '(A · B) + C', title: 'A in series with B, in parallel with C' },
        { value: 'a-bc', label: 'A · (B + C)', title: 'A in series with the parallel pair B, C' },
      ]}
    />
    <span class="count">{litCount(net)} of 8 rows light the lamp</span>
  {/snippet}

  <div class="sp">
    <svg class="net" viewBox="0 0 380 150" role="group" aria-label="The network: {net.tokens.join('')}">
      {#each drawing.wires as w, i (id + i)}
        <path class="wire" class:on={wireOn(w)} d={w.d} />
      {/each}

      <!-- The supply on the left, the lamp on the right. -->
      <circle class="node" cx="28" cy="80" r="4" />
      <text class="txt" x="28" y="102" text-anchor="middle">+</text>
      <g class="lamp" class:lit>
        <circle class="bulb" cx="330" cy="80" r="13" />
        {#if lit}
          <path class="rays" d="M330 56 V60 M330 100 V104 M306 80 H310 M350 80 H354 M313 63 l3 3 M347 97 l-3 -3 M347 63 l-3 3 M313 97 l3 -3" />
        {/if}
        <path class="fil" d="M321 89 L339 71 M321 71 L339 89" />
      </g>
      <path class="wire" class:on={lit} d="M343 80 H360 V118" />
      <path class="gnd" d="M350 118 H370 M354 123 H366 M358 128 H362" />
      <text class="txt state" x="330" y="34" text-anchor="middle">{lit ? 'lit' : 'dark'}</text>

      {#each drawing.switches as s (id + s.k)}
        {@const closed = sw[s.k]}
        <g
          class="sw"
          class:closed
          role="switch"
          tabindex="0"
          aria-checked={closed}
          aria-label="Switch {NAMES[s.k]}, {closed ? 'closed' : 'open'}"
          onclick={() => (sw[s.k] = !sw[s.k])}
          onkeydown={key(s.k)}
        >
          <rect class="hit" x={s.x - 4} y={s.y - 24} width="48" height="48" />
          <path class="stub" d="M{s.x} {s.y} H{s.x + 8} M{s.x + 32} {s.y} H{s.x + 40}" />
          <circle class="pin" cx={s.x + 8} cy={s.y} r="3" />
          <circle class="pin" cx={s.x + 32} cy={s.y} r="3" />
          <path class="lever" d={closed ? `M${s.x + 8} ${s.y} L${s.x + 32} ${s.y}` : `M${s.x + 8} ${s.y} L${s.x + 30} ${s.y - 15}`} />
          <text class="txt name" x={s.x + 20} y={s.y + 24} text-anchor="middle">{NAMES[s.k]} = {+closed}</text>
        </g>
      {/each}
    </svg>

    <div class="side">
      <div class="expr" aria-live="polite">
        <div class="line sym">
          {#each net.tokens as t, i (i)}
            {#if t === 'A' || t === 'B' || t === 'C'}<span class="var" class:one={sw[t.toLowerCase() as 'a' | 'b' | 'c']}>{t}</span>{:else}<span>{t}</span>{/if}
          {/each}
        </div>
        <div class="line val">{substituted(net, sw)}</div>
        <div class="line res" class:one={lit}>= {+lit}<span class="say">{lit ? 'the lamp is lit' : 'the lamp is dark'}</span></div>
      </div>

      <div class="table" role="group" aria-label="Truth table: pick a row to set the switches">
        <div class="head" aria-hidden="true"><span>A</span><span>B</span><span>C</span><span>lamp</span></div>
        {#each table as r, i (i)}
          {@const on = net.conducts(r)}
          <button
            type="button"
            class="tr"
            class:current={i === active}
            class:on
            aria-pressed={i === active}
            aria-label="A {+r.a}, B {+r.b}, C {+r.c}: lamp {on ? 'lit' : 'dark'}"
            onclick={() => (sw = { ...r })}
          >
            <span>{+r.a}</span><span>{+r.b}</span><span>{+r.c}</span><span class="out">{+on}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
</Widget>

<style>
  .sp {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
    gap: 1rem 1.5rem;
    align-items: center;
    padding: 1rem 1.1rem 1.1rem;
  }
  @media (max-width: 40rem) {
    .sp {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .count {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--mute);
  }
  .net {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }
  .wire {
    fill: none;
    stroke: var(--wire);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: stroke 120ms;
  }
  .wire.on {
    stroke: var(--sig-high);
    stroke-width: 3.2;
    filter: drop-shadow(0 0 3px var(--sig-high-glow));
  }
  .node {
    fill: var(--fg);
  }
  .gnd {
    fill: none;
    stroke: var(--wire);
    stroke-width: 2;
    stroke-linecap: round;
  }
  .txt {
    fill: var(--fg);
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .state {
    fill: var(--mute);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-size: 10px;
  }
  .lamp .bulb {
    fill: var(--panel);
    stroke: var(--wire);
    stroke-width: 2;
  }
  .lamp .fil {
    fill: none;
    stroke: var(--wire);
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  .lamp.lit .bulb {
    fill: color-mix(in srgb, var(--sig-high) 45%, var(--panel));
    stroke: var(--sig-high);
    filter: drop-shadow(0 0 7px var(--sig-high-glow));
  }
  .lamp.lit .fil {
    stroke: var(--sig-high);
  }
  .rays {
    fill: none;
    stroke: var(--sig-high);
    stroke-width: 2;
    stroke-linecap: round;
  }
  .sw {
    cursor: pointer;
    outline: none;
  }
  .sw .hit {
    fill: transparent;
  }
  .sw .stub {
    fill: none;
    stroke: var(--wire);
    stroke-width: 2;
  }
  .sw .pin {
    fill: var(--panel);
    stroke: var(--fg);
    stroke-width: 1.6;
  }
  .sw .lever {
    fill: none;
    stroke: var(--fg);
    stroke-width: 2.6;
    stroke-linecap: round;
    transition: d 140ms;
  }
  .sw.closed .lever {
    stroke: var(--sig-high);
  }
  .sw .name {
    fill: var(--ink-2, var(--fg));
    font-weight: 600;
  }
  .sw.closed .name {
    fill: var(--sig-high);
  }
  .sw:hover .hit {
    fill: color-mix(in srgb, var(--sig-high) 9%, transparent);
  }
  .sw:focus-visible .hit {
    stroke: var(--focus);
    stroke-width: 2;
    rx: 6;
  }

  .side {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .expr {
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.55rem 0.75rem;
    font-family: var(--font-mono);
    font-size: 0.86rem;
    overflow-x: auto;
  }
  .line {
    line-height: 1.6;
    white-space: pre;
  }
  .val {
    color: var(--ink-2, var(--fg));
  }
  .res {
    font-weight: 600;
    color: var(--sig-low);
  }
  .res.one {
    color: var(--sig-high);
  }
  .say {
    font-family: var(--font-ui);
    font-weight: 500;
    font-size: 0.8rem;
    margin-left: 0.7rem;
    color: var(--mute);
  }
  .var {
    color: var(--sig-low);
    font-weight: 600;
  }
  .var.one {
    color: var(--sig-high);
  }

  .table {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 2px;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    text-align: center;
  }
  .head {
    display: contents;
    color: var(--mute);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .tr {
    display: contents;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .tr span,
  .head span {
    padding: 0.2rem 0;
    border-radius: 3px;
  }
  .tr span {
    background: color-mix(in srgb, var(--pn) 70%, transparent);
    color: var(--ink-2, var(--fg));
  }
  .tr:hover span {
    background: var(--pn);
  }
  .tr .out {
    font-weight: 700;
    color: var(--sig-low);
  }
  .tr.on .out {
    color: var(--sig-high);
  }
  .tr.current span {
    background: var(--copper-soft);
    color: var(--fg);
    box-shadow: inset 0 0 0 1px var(--copper);
  }
  .tr:focus-visible span {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .wire,
    .sw .lever {
      transition: none;
    }
  }
</style>
