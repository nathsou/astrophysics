<!--
  Development gallery for the bench renderer (not linked from the course): the example circuits in
  live widgets, and a symbol sheet of every catalog type with its pins marked.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import CircuitWidget from '$lib/bench/CircuitWidget.svelte';
  import Schematic from '$lib/bench/Schematic.svelte';
  import { allDefs, pinsOf, withDefaults } from '$lib/sim/netlist/catalog';
  import { G } from '$lib/bench/geometry';
  import { engineAvailable } from '$lib/bench/engines';
  import type { ElementState } from '$lib/sim/engine';
  import type { Circuit, Placed } from '$lib/sim/netlist/types';
  import staircase from '$lib/bench/examples/staircase.json';
  import relayLamp from '$lib/bench/examples/relay-lamp.json';
  import led from '$lib/bench/examples/led.json';
  import halfAdder from '$lib/bench/examples/half-adder.json';
  import ring from '$lib/bench/examples/ring-oscillator.json';

  const asCircuit = (c: unknown) => c as Circuit;
  const one = (p: Omit<Placed, 'x' | 'y'> & { x?: number; y?: number }, extra: Partial<Circuit> = {}): Circuit => ({
    version: 1,
    components: [{ x: 0, y: 0, ...p }],
    wires: [],
    ...extra,
  });

  // A subcircuit to show the generic block: a D flip-flop with an active-low clear.
  const dff: Circuit = {
    version: 1,
    title: 'D flip-flop',
    components: [
      { id: 'pD', type: 'port', x: 0, y: 0, params: { name: 'D', dir: 'in' } },
      { id: 'pC', type: 'port', x: 0, y: 2, params: { name: 'CLK', dir: 'in' } },
      { id: 'pR', type: 'port', x: 0, y: 4, params: { name: 'CLRn', dir: 'in' } },
      { id: 'pQ', type: 'port', x: 10, y: 0, params: { name: 'Q', dir: 'out' } },
      { id: 'pQn', type: 'port', x: 10, y: 2, params: { name: 'Qn', dir: 'out' } },
    ],
    wires: [],
  };

  const defs = allDefs();
  const sheet = [
    ...defs.map((d) => ({ key: d.type, name: d.name, circuit: one({ id: 'X1', type: d.type }) })),
    { key: 'sub:dff', name: 'Subcircuit block', circuit: one({ id: 'U1', type: 'sub:dff' }, { subcircuits: { dff } }) },
  ];

  const states: { key: string; name: string; circuit: Circuit; state: ElementState }[] = [
    { key: 'switch', name: 'closed', circuit: one({ id: 'S1', type: 'switch', params: { closed: true } }), state: {} },
    { key: 'spdt', name: 'thrown to 1', circuit: one({ id: 'S2', type: 'spdt', params: { throw: 1 } }), state: {} },
    { key: 'pushbutton', name: 'pressed', circuit: one({ id: 'S3', type: 'pushbutton', params: { pressed: true } }), state: {} },
    { key: 'relay', name: 'energised', circuit: one({ id: 'K1', type: 'relay' }), state: { closed: true } },
    { key: 'lamp', name: 'brightness 1', circuit: one({ id: 'L1', type: 'lamp' }), state: { brightness: 1 } },
    { key: 'lamp2', name: 'brightness 0.4', circuit: one({ id: 'L2', type: 'lamp' }), state: { brightness: 0.4 } },
    { key: 'led', name: 'green, lit', circuit: one({ id: 'D1', type: 'led', params: { color: 'green' } }), state: { brightness: 1 } },
    { key: 'ledb', name: 'blue, dim', circuit: one({ id: 'D2', type: 'led', params: { color: 'blue' } }), state: { brightness: 0.35 } },
    { key: 'indicator', name: 'lit', circuit: one({ id: 'Y', type: 'indicator', params: { color: 'amber' } }), state: { brightness: 1 } },
    { key: 'toggle', name: 'on', circuit: one({ id: 'A', type: 'toggle', params: { on: true } }), state: {} },
    { key: 'button', name: 'pressed', circuit: one({ id: 'B', type: 'button', params: { pressed: true } }), state: {} },
    { key: 'probe0', name: 'probe 0', circuit: one({ id: 'P0', type: 'probe' }), state: { logic: 0 } },
    { key: 'probe1', name: 'probe 1', circuit: one({ id: 'P1', type: 'probe' }), state: { logic: 1 } },
    { key: 'probeX', name: 'probe X', circuit: one({ id: 'P2', type: 'probe' }), state: { logic: 2 } },
    { key: 'probeZ', name: 'probe Z', circuit: one({ id: 'P3', type: 'probe' }), state: { logic: 3 } },
    { key: 'voltmeter', name: 'reading', circuit: one({ id: 'V1', type: 'voltmeter' }), state: { reading: 3.3 } },
    { key: 'ammeter', name: 'reading', circuit: one({ id: 'A1', type: 'ammeter' }), state: { reading: 0.0123 } },
    { key: 'seven', name: 'showing 5', circuit: one({ id: 'DS1', type: 'seven-seg' }), state: { segments: 0x6d | 0x80 } },
    { key: 'hex', name: 'showing A', circuit: one({ id: 'DS2', type: 'hex-display' }), state: { value: 10 } },
    { key: 'burned', name: 'burned out', circuit: one({ id: 'R9', type: 'resistor', params: { resistance: 10 } }), state: { burned: true } },
    { key: 'supplycc', name: 'current limit', circuit: one({ id: 'PS1', type: 'supply' }), state: { cc: true } },
    { key: 'polcap', name: 'electrolytic', circuit: one({ id: 'C1', type: 'capacitor', params: { polarised: true, capacitance: 1e-4 } }), state: {} },
    { key: 'nand4', name: '4-input NAND', circuit: one({ id: 'U4', type: 'nand', params: { inputs: 4 } }), state: {} },
    { key: 'xnor3', name: '3-input XNOR', circuit: one({ id: 'U5', type: 'xnor', params: { inputs: 3 } }), state: {} },
  ];

  // Rotations, flips and labels.
  const poses: Circuit = {
    version: 1,
    components: [
      { id: 'R1', type: 'resistor', x: 0, y: 2, params: { resistance: 4700 } },
      { id: 'R2', type: 'resistor', x: 10, y: 0, rot: 90, params: { resistance: 1e5 } },
      { id: 'R3', type: 'resistor', x: 20, y: 2, rot: 180, params: { resistance: 22 } },
      { id: 'R4', type: 'resistor', x: 24, y: 4, rot: 270, params: { resistance: 1e6 } },
      { id: 'C1', type: 'capacitor', x: 30, y: 0, rot: 90, params: { capacitance: 1e-7 } },
      { id: 'V1', type: 'voltmeter', x: 38, y: 4, rot: 270 },
      { id: 'U1', type: 'and', x: 0, y: 10, rot: 90 },
      { id: 'U2', type: 'or', x: 12, y: 12, flip: true },
      { id: 'Q1', type: 'npn', x: 18, y: 12, flip: true },
      { id: 'L1', type: 'label', x: 24, y: 12, rot: 180, params: { name: 'CLK' } },
      { id: 'P1', type: 'port', x: 30, y: 12, rot: 180, params: { name: 'OUT', dir: 'out' } },
      { id: 'V2', type: 'rail', x: 36, y: 12, rot: 180, params: { voltage: -12 } },
      { id: 'B1', type: 'battery', x: 42, y: 14, rot: 270, params: { voltage: 1.5 } },
    ],
    wires: [],
    notes: [{ x: 0, y: 20, text: 'Rotations, flips, labels (upright text)' }],
  };

  // No resistor: the LED burns out after a moment (scorch and smoke).
  const burnt: Circuit = {
    version: 1,
    title: 'No resistor',
    engine: 'analog',
    components: [
      { id: 'B1', type: 'battery', x: 4, y: 10, rot: 270, params: { voltage: 9 } },
      { id: 'D1', type: 'led', x: 12, y: 4, rot: 90, params: { color: 'green' } },
      { id: 'G1', type: 'ground', x: 4, y: 12 },
    ],
    wires: [
      { points: [[4, 6], [4, 2], [12, 2], [12, 4]] },
      { points: [[12, 8], [12, 12], [4, 12], [4, 10]] },
    ],
  };

  // The four signal values side by side: HIGH, LOW, Z (a disabled tri-state buffer) and X (contention).
  const levels: Circuit = {
    version: 1,
    title: 'Signal values',
    engine: 'digital',
    components: [
      { id: 'H', type: 'const', x: 0, y: 0, params: { value: 1 } },
      { id: 'PH', type: 'probe', x: 10, y: 0, label: '' },
      { id: 'L', type: 'const', x: 0, y: 4, params: { value: 0 } },
      { id: 'PL', type: 'probe', x: 10, y: 4, label: '' },
      { id: 'D', type: 'const', x: 0, y: 12, params: { value: 1 } },
      { id: 'E', type: 'const', x: 5, y: 8, params: { value: 0 } },
      { id: 'T1', type: 'tristate', x: 5, y: 12 },
      { id: 'PZ', type: 'probe', x: 12, y: 12, label: '' },
      { id: 'X1', type: 'const', x: 0, y: 20, params: { value: 1 } },
      { id: 'X0', type: 'const', x: 0, y: 22, params: { value: 0 } },
      { id: 'PX', type: 'probe', x: 10, y: 20, label: '' },
    ],
    wires: [
      { points: [[2, 0], [10, 0]] },
      { points: [[2, 4], [10, 4]] },
      { points: [[2, 12], [5, 12]] },
      { points: [[7, 8], [7, 10]] },
      { points: [[10, 12], [12, 12]] },
      { points: [[2, 20], [10, 20]] },
      { points: [[2, 22], [6, 22], [6, 20]] },
    ],
    notes: [
      { x: 14, y: 0.3, text: 'HIGH: amber, thick' },
      { x: 14, y: 4.3, text: 'LOW: slate' },
      { x: 17, y: 12.3, text: 'Z (nothing drives it): dashed grey' },
      { x: 14, y: 20.3, text: 'X (a 1 and a 0 fight): red, hatched' },
    ],
  };

  // Stress test: 25 three-inverter rings with a probe each (100 components, all animating).
  const stress: Circuit = { version: 1, engine: 'digital', components: [], wires: [] };
  for (let r = 0; r < 25; r++) {
    const ox = (r % 5) * 28;
    const oy = Math.floor(r / 5) * 10;
    for (let k = 0; k < 3; k++) stress.components.push({ id: `U${r}_${k}`, type: 'not', x: ox + 2 + 7 * k, y: oy + 2, params: { delay: 1 + (r % 7) * 0.13 } });
    stress.components.push({ id: `P${r}`, type: 'probe', x: ox + 23, y: oy, rot: 270, label: '' });
    stress.wires.push(
      { points: [[ox + 7, oy + 2], [ox + 9, oy + 2]] },
      { points: [[ox + 14, oy + 2], [ox + 16, oy + 2]] },
      { points: [[ox + 21, oy + 2], [ox + 23, oy + 2], [ox + 23, oy + 6], [ox, oy + 6], [ox, oy + 2], [ox + 2, oy + 2]] },
      { points: [[ox + 23, oy], [ox + 23, oy + 2]] },
    );
  }

  let checks: string[] = $state([]);
  let engines = $state('');
  onMount(async () => {
    // Every pin must have a stub that starts exactly on it.
    const out: string[] = [];
    for (const cell of document.querySelectorAll<HTMLElement>('[data-sheet]')) {
      const type = cell.dataset.sheet!;
      const def = defs.find((d) => d.type === type);
      if (!def) continue;
      const pins = pinsOf(def, withDefaults(def, {}));
      const stubs = [...cell.querySelectorAll<SVGPathElement>('g.comp .stub[data-pin]')];
      pins.forEach((p, i) => {
        const s = stubs.find((el) => el.dataset.pin === String(i));
        const m = s?.getAttribute('d')?.match(/^M\s*(-?[\d.]+)[ ,](-?[\d.]+)/);
        if (!m) out.push(`${type}.${p.name}: no stub`);
        else if (Math.abs(Number(m[1]) - p.x * G) > 0.01 || Math.abs(Number(m[2]) - p.y * G) > 0.01)
          out.push(`${type}.${p.name}: stub starts at (${m[1]}, ${m[2]}), pin at (${p.x * G}, ${p.y * G})`);
      });
    }
    checks = out.length ? out : ['All stubs start on their pins.'];
    engines = `digital: ${await engineAvailable('digital')}, analog: ${await engineAvailable('analog')}`;
  });
</script>

<svelte:head><title>Bench gallery</title><meta name="robots" content="noindex" /></svelte:head>

<article class="gallery">
  <h1>Bench gallery</h1>
  <p class="meta ui">Engines: <span data-engines>{engines || '…'}</span></p>

  <h2>Live circuits</h2>
  <CircuitWidget circuit={asCircuit(staircase)} title="Staircase light" subtitle="Flip either switch: each one toggles the lamp." speed={1} current={true} />
  <CircuitWidget circuit={asCircuit(relayLamp)} title="A relay switches a lamp" subtitle="Close S1: the coil pulls the contact over to NO." speed={1} current={true} />
  <CircuitWidget circuit={asCircuit(led)} title="An LED and its resistor" speed={1} current={true} />
  <CircuitWidget circuit={asCircuit(halfAdder)} title="Half adder" subtitle="Click A and B (or Tab to them and press Space)." speed={1e-6} />
  <CircuitWidget circuit={asCircuit(ring)} title="Ring oscillator" speed={4e-9} traces="U1.Y,U2.Y,U3.Y" window={24e-9} />

  <CircuitWidget circuit={burnt} title="An LED without a resistor" subtitle="Watch it for a moment." speed={1} current={true} />
  <CircuitWidget circuit={levels} title="Signal values" subtitle="Logic mode: the colour is never the only cue." speed={1e-9} />
  <CircuitWidget circuit={stress} title="Stress: 100 components" speed={1e-9} scale={1} />

  <h2>Symbol sheet</h2>
  <p class="ui">Every catalog type at rotation 0; pink dots mark the pins.</p>
  <ul class="checks ui" data-checks>
    {#each checks as c (c)}<li>{c}</li>{/each}
  </ul>
  <div class="sheet">
    {#each sheet as s (s.key)}
      <figure data-sheet={s.key}>
        <Schematic circuit={s.circuit} interactive={false} pinMarks scale={2} live={false} />
        <figcaption><code>{s.key}</code> {s.name}</figcaption>
      </figure>
    {/each}
  </div>

  <h2>States</h2>
  <div class="sheet">
    {#each states as s (s.key)}
      <figure>
        <Schematic circuit={s.circuit} interactive={false} scale={2} live={false} staticState={{ [s.circuit.components[0]!.id]: s.state }} />
        <figcaption><code>{s.circuit.components[0]!.type}</code> {s.name}</figcaption>
      </figure>
    {/each}
  </div>

  <h2>Rotations and labels</h2>
  <div class="poses"><Schematic circuit={poses} interactive={false} pinMarks scale={2} live={false} /></div>
</article>

<style>
  .gallery {
    max-width: 64rem;
    margin: 0 auto;
    padding: 2rem 1rem 4rem;
  }
  .meta {
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
  .sheet {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: 1rem;
  }
  figure {
    margin: 0;
    padding: 0.5rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--chart-surface);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    gap: 0.4rem;
  }
  figcaption {
    font-family: var(--font-ui);
    font-size: 0.75rem;
    color: var(--ink-2);
    text-align: center;
  }
  .checks {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .poses {
    border: 1px solid var(--rule);
    background: var(--chart-surface);
    padding: 1rem;
    overflow-x: auto;
  }
</style>
