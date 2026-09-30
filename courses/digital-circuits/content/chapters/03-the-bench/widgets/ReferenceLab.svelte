<!--
  Where is zero? Choose which node the ground symbol sits on: every node voltage moves, but the voltage across each
  resistor does not. A voltage is always a difference between two points; "the voltage at a point" means relative
  to ground. Maths in reference.ts (the analog engine with a different ground net).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { formatSI } from '$lib/bench/format';
  import { voltages, type Node } from './reference';

  let { n }: { n?: string } = $props();

  let ground = $state<Node>('B');
  const v = $derived(voltages(ground));
  const sig = (x: number) => {
    const s = formatSI(Math.abs(x) < 1e-9 ? 0 : x, 'V', 3).replace(/ /g, ' ');
    return x > 1e-9 ? `+${s}` : s;
  };
  const Y = { T: 40, M: 110, B: 180 } as const;
</script>

<Widget title="Where is zero?" {n} kind="Interactive" caption="Move the ground symbol to the top, the middle or the bottom of the divider. Watch the node voltages change and the drops across R1 and R2 stay put.">
  <div class="rl ui">
    <svg viewBox="0 0 330 230" role="img" aria-label="A 9 V battery across R1 6 kΩ and R2 3 kΩ. Ground is at node {ground}.">
      <g class="w">
        <path d="M50 40 H200 M200 40 V54 M200 86 V110 M200 110 V124 M200 156 V180 M200 180 H50 M50 180 V130 M50 90 V40" />
      </g>
      <rect x="192" y="54" width="16" height="32" class="b" />
      <rect x="192" y="124" width="16" height="32" class="b" />
      <path d="M36 90 H64" class="plate" /><path d="M42 130 H58" class="plate short" />
      <text x="70" y="88" class="pm">+</text><text x="70" y="140" class="pm">−</text>
      <text x="20" y="114" text-anchor="end" class="nm">9 V</text>
      <text x="180" y="74" text-anchor="end" class="nm">R1</text><text x="180" y="144" text-anchor="end" class="nm">R2</text>
      <text x="180" y="88" text-anchor="end" class="lb">6 kΩ</text><text x="180" y="158" text-anchor="end" class="lb">3 kΩ</text>
      {#each ['T', 'M', 'B'] as const as node (node)}
        <circle cx="200" cy={Y[node]} r="5" class="node" class:g={ground === node} />
        <text x="222" y={Y[node] + 5} class="volt" class:g={ground === node}>{sig(v[node])}</text>
      {/each}
      <!-- The ground symbol, wherever it is. -->
      <g class="w gnd" transform="translate(200 {Y[ground]})" style="transition: transform 250ms">
        <path d="M0 5 V14 M0 14 H-13 M-13 14 H13 M-8 19 H8 M-3.5 24 H3.5" transform="translate(0 0)" />
      </g>
    </svg>
    <div class="side">
      <Segmented label="Ground is at" size="sm" bind:value={ground} options={[{ value: 'T', label: 'top' }, { value: 'M', label: 'middle' }, { value: 'B', label: 'bottom' }]} />
      <table>
        <thead><tr><th>Across</th><th>Voltage</th></tr></thead>
        <tbody>
          <tr><td>R1 (top relative to middle)</td><td class="same">{sig(v.r1)}</td></tr>
          <tr><td>R2 (middle relative to bottom)</td><td class="same">{sig(v.r2)}</td></tr>
          <tr><td>Battery (top relative to bottom)</td><td class="same">{sig(v.r1 + v.r2)}</td></tr>
        </tbody>
      </table>
      <p class="note">Node voltages depend on where you put zero. Differences between two nodes never do.</p>
    </div>
  </div>
</Widget>

<style>
  .rl {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.8rem 1.4rem;
    align-items: center;
  }
  @media (max-width: 700px) {
    .rl {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  svg {
    width: 100%;
    max-width: 340px;
    margin: 0 auto;
    display: block;
    font-family: var(--font-ui);
  }
  .w {
    fill: none;
    stroke: var(--wire);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .gnd {
    stroke: var(--copper-ink);
  }
  .b {
    fill: var(--panel);
    stroke: var(--wire);
    stroke-width: 2;
  }
  .plate {
    stroke: var(--fg);
    stroke-width: 2;
    fill: none;
  }
  .plate.short {
    stroke-width: 5;
  }
  .pm,
  .nm {
    fill: var(--fg);
    font-weight: 700;
    font-size: 13px;
  }
  .lb {
    fill: var(--mute);
    font-size: 11.5px;
  }
  .node {
    fill: var(--panel);
    stroke: var(--copper);
    stroke-width: 2.5;
  }
  .node.g {
    fill: var(--copper);
  }
  .volt {
    font-family: var(--font-mono);
    font-size: 15px;
    font-weight: 600;
    fill: var(--fg);
  }
  .volt.g {
    fill: var(--copper-ink);
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    align-items: flex-start;
  }
  table {
    border-collapse: collapse;
    font-size: 0.84rem;
    width: 100%;
  }
  th,
  td {
    text-align: left;
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid var(--line);
  }
  th {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
    font-weight: 500;
  }
  td.same {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--phosphor-ink);
  }
  .note {
    margin: 0;
    font-size: 0.84rem;
    color: var(--ink-2);
  }
</style>
