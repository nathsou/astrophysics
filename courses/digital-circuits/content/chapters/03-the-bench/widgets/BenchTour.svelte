<!--
  Bench tour: a guided lab. Measure a divider with a multimeter (voltage, current, resistance, continuity), then
  find an open resistor in a dead circuit using only the meter. Every reading is computed by the analog engine
  on a netlist that includes the meter, so the meter loads the circuit as a real one does and mistakes have
  consequences (a blown fuse, a nonsense resistance). The logic is in tour.ts.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { formatSI } from '$lib/bench/format';
  import {
    VALUES,
    ledBrightness,
    measure,
    nextFault,
    parts,
    taskStatus,
    testPoints,
    type Meter,
    type Mode,
    type Rig,
    type Sample,
    type Scenario,
    type TP,
  } from './tour';

  let { n }: { n?: string } = $props();

  const STEPS = [
    { label: '1 Voltage', intro: 'Voltage is measured across a part: the meter goes in parallel with it. Click a test point (or use the boxes under the meter) to move the probes.' },
    { label: '2 Current', intro: 'Current is measured through a part, so the meter has to be part of the path. To do that you break the circuit and let the current flow through the meter.' },
    { label: '3 Resistance', intro: 'The meter measures resistance by pushing a tiny current of its own through the part, so the circuit’s own power must be off.' },
    { label: '4 Find the fault', intro: 'The LED is dark. One of the three resistors has gone open-circuit. Use the meter to find which, then say so.' },
  ];

  let step = $state(0);
  let mode = $state<Mode>('V');
  let red = $state<TP>('B');
  let black = $state<TP>('C');
  let power = $state(true);
  let linkClosed = $state(true);
  let fault = $state(2);
  let repaired = $state(false);
  let fuseBlown = $state(false);
  let placing = $state<'red' | 'black'>('red');
  let log = $state<Sample[]>([]);
  let verdict = $state<{ ok: boolean; text: string } | null>(null);

  const scenario = $derived<Scenario>(step === 3 ? 'fault' : 'divider');
  const rig = $derived<Rig>({ scenario, power, linkClosed, fault: repaired ? -1 : fault });
  const meter = $derived<Meter>({ mode, red, black });
  const reading = $derived(measure(rig, meter, fuseBlown));
  const lit = $derived(ledBrightness(rig));
  const tps = $derived(testPoints(scenario));
  const partList = $derived(parts(scenario));
  const tasks = $derived(taskStatus(step, log));
  const allDone = $derived(tasks.length > 0 && tasks.every((t) => t.done));

  function changeStep(s: number) {
    step = s;
    verdict = null;
    placing = 'red';
    linkClosed = true;
    repaired = false;
    power = s !== 2;
    if (s === 0) [mode, red, black] = ['V', 'B', 'C'];
    else if (s === 1) [mode, red, black] = ['A', 'C', 'G'];
    else if (s === 2) [mode, red, black] = ['R', 'B', 'C'];
    else [mode, red, black] = ['V', 'A', 'G'];
  }

  // Log every distinct reading the reader produces, and blow the fuse when the reading says so.
  $effect(() => {
    const r = reading;
    const s: Sample = { mode, scenario, power, linkClosed, a: red, b: black, reading: r, blew: r.blew };
    untrack(() => {
      const last = log[log.length - 1];
      const same = last && last.mode === s.mode && last.scenario === s.scenario && last.power === s.power && last.linkClosed === s.linkClosed && last.a === s.a && last.b === s.b && last.reading.text === r.text;
      if (!same || r.blew) log = [...log.slice(-199), s];
      if (r.blew) fuseBlown = true;
    });
  });

  function place(tp: TP) {
    if (placing === 'red') {
      red = tp;
      placing = 'black';
    } else {
      black = tp;
      placing = 'red';
    }
  }

  function answer(i: number) {
    if (i === fault) {
      repaired = true;
      verdict = { ok: true, text: `Yes: R${i + 1} is open. Across it the meter sees nearly the whole battery voltage, because it is the only part in the loop that carries no current. With it replaced the LED lights.` };
    } else {
      const off: Rig = { scenario: 'fault', power: false, linkClosed: true, fault };
      const p = partList[i]!;
      const m = measure(off, { mode: 'R', red: p.top, black: p.bottom }, false);
      verdict = { ok: false, text: `Not R${i + 1}: with the power off it reads ${m.text.replace(/ /g, ' ')}, so it is intact. Keep looking: which part shows the battery voltage across it?` };
    }
  }
  function newFault() {
    fault = nextFault(fault);
    repaired = false;
    verdict = null;
  }

  // Diagram geometry (SVG units).
  const COL = 232;
  const BAT = 64;
  const Y0 = 52;
  const DY = 64;
  const yOf = (t: TP) => Y0 + tps.indexOf(t) * DY;
  const yG = $derived(Y0 + (tps.length - 1) * DY);
  const H = $derived(yG + 58);
  const yMid = $derived((Y0 + yG) / 2);
  const valueText = (id: string) => {
    const r = scenario === 'divider' ? VALUES[id] : VALUES[`F${id.slice(1)}`];
    return r ? formatSI(r, 'Ω', 3).replace(/ /g, ' ') : '';
  };
  const fmt = (t: string) => t.replace(/ /g, ' ');
  const modeHint = $derived(
    mode === 'V' ? 'red probe relative to black' : mode === 'A' ? 'current entering the red probe' : mode === 'R' ? 'resistance between the probes' : 'beeps below 50 Ω',
  );
  const unitHint = $derived(mode === 'V' ? 'V DC' : mode === 'A' ? 'A DC' : mode === 'R' ? 'Ω' : 'Ω · continuity');
</script>

<Widget title="Bench tour" {n} kind="Guided lab" caption="Work through the four steps. Every reading comes from the simulator running a circuit that includes the meter itself.">
  <div class="tour ui">
    <Segmented label="Step" options={STEPS.map((s, i) => ({ value: i, label: s.label }))} bind:value={step} onchange={changeStep} />
    <p class="intro">{STEPS[step]!.intro}</p>

    <div class="grid">
      <!-- The circuit under test. -->
      <div class="circuit">
        <svg viewBox="0 0 340 {H}" role="group" aria-label="The circuit under test, with test points {tps.join(', ')}">
          <!-- Wires. -->
          <g class="wire">
            <path d="M{BAT} {Y0} H{COL - 0}" />
            <path d="M{COL} {Y0} V{yG}" />
            <path d="M{BAT} {yG} H{COL}" />
            <path d="M{BAT} {Y0} V{yMid - 6}" />
            <path d="M{BAT} {yMid + 6} V{yG}" />
          </g>
          <!-- Battery. -->
          <g class="bat">
            <path d="M{BAT - 15} {yMid - 6} H{BAT + 15}" class="plate long" />
            <path d="M{BAT - 8} {yMid + 6} H{BAT + 8}" class="plate short" />
            <text x={BAT + 22} y={yMid - 2}>+</text>
            <text x={BAT + 22} y={yMid + 14}>−</text>
            <text x={BAT - 22} y={yMid + 4} text-anchor="end" class="lbl">9 V</text>
          </g>
          <!-- Ground symbol. -->
          <g class="wire" transform="translate({BAT} {yG})">
            <path d="M0 0 V6 M-10 6 H10 M-6 10 H6 M-2.5 14 H2.5" />
          </g>
          <!-- Power switch. -->
          <g
            class="sw"
            role="button"
            tabindex="0"
            aria-label={power ? 'Power switch, on. Press to switch off.' : 'Power switch, off. Press to switch on.'}
            onclick={() => (power = !power)}
            onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), (power = !power))}
          >
            <rect x="112" y={Y0 - 16} width="64" height="32" fill="transparent" />
            <circle cx="120" cy={Y0} r="3.5" class="dot" />
            <circle cx="168" cy={Y0} r="3.5" class="dot" />
            <path d={power ? `M120 ${Y0} L168 ${Y0}` : `M120 ${Y0} L160 ${Y0 - 16}`} class="lever" />
            <text x="144" y={Y0 - 22} text-anchor="middle" class="lbl">Power {power ? 'on' : 'off'}</text>
          </g>

          <!-- Parts. -->
          {#each partList as p (p.id)}
            {@const y1 = yOf(p.top)}
            {@const y2 = yOf(p.bottom)}
            {@const yc = (y1 + y2) / 2}
            {#if p.kind === 'res'}
              <rect x={COL - 8} y={yc - 16} width="16" height="32" class="body" />
              <text x={COL - 18} y={yc - 2} text-anchor="end" class="name">{p.label}</text>
              <text x={COL - 18} y={yc + 13} text-anchor="end" class="lbl">{valueText(p.id)}</text>
            {:else if p.kind === 'led'}
              <circle cx={COL} cy={yc} r="22" class="glow" style:opacity={Math.min(1, lit * 6)} />
              <path d="M{COL - 11} {yc - 12} H{COL + 11} L{COL} {yc + 9} Z" class="body" />
              <path d="M{COL - 11} {yc + 9} H{COL + 11}" class="wireline" />
              <path d="M{COL + 14} {yc - 4} l7 -7 m-3 0 h3 v3 M{COL + 18} {yc + 4} l7 -7 m-3 0 h3 v3" class="arrow" />
              <text x={COL - 18} y={yc - 2} text-anchor="end" class="name">{p.label}</text>
              <text x={COL - 18} y={yc + 13} text-anchor="end" class="lbl">{lit > 0.01 ? 'lit' : 'dark'}</text>
            {:else}
              <g
                class="sw"
                role="button"
                tabindex="0"
                aria-label={linkClosed ? 'Jumper J, in place. Press to remove it.' : 'Jumper J, removed. Press to put it back.'}
                onclick={() => (linkClosed = !linkClosed)}
                onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), (linkClosed = !linkClosed))}
              >
                <rect x={COL - 30} y={yc - 26} width="60" height="52" fill="transparent" />
                <rect x={COL - 8} y={yc - 12} width="16" height="24" class="jump" class:open={!linkClosed} />
                {#if !linkClosed}
                  <circle cx={COL} cy={yc - 12} r="3.5" class="dot" />
                  <circle cx={COL} cy={yc + 12} r="3.5" class="dot" />
                  <path d="M{COL} {yc - 12} L{COL + 13} {yc + 2}" class="lever" />
                {:else}
                  <path d="M{COL} {yc - 12} V{yc + 12}" class="lever" />
                {/if}
              </g>
              <text x={COL - 18} y={yc - 2} text-anchor="end" class="name">J</text>
              <text x={COL - 18} y={yc + 13} text-anchor="end" class="lbl">{linkClosed ? 'jumper' : 'removed'}</text>
            {/if}
          {/each}

          <!-- Test points and probe markers. -->
          {#each tps as t (t)}
            {@const y = yOf(t)}
            <g
              class="tp"
              role="button"
              tabindex="0"
              aria-label="Test point {t}: place the {placing} probe here"
              onclick={() => place(t)}
              onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), place(t))}
            >
              <circle cx={COL} cy={y} r="18" fill="transparent" />
              <circle cx={COL} cy={y} r="6" class="tpdot" />
              <text x={COL + 24} y={y + 5} class="tpname">{t}</text>
              {#if red === t}
                <circle cx={COL} cy={y} r="12" class="ring red" />
              {/if}
              {#if black === t}
                <circle cx={COL} cy={y} r={red === t ? 16 : 12} class="ring black" />
              {/if}
            </g>
          {/each}
        </svg>
        <p class="legend"><span class="sw-red" aria-hidden="true"></span> red probe on <b>{red}</b> <span class="sw-black" aria-hidden="true"></span> black probe on <b>{black}</b></p>
      </div>

      <!-- The meter. -->
      <div class="meter" class:blown={fuseBlown && mode === 'A'}>
        <div class="lcd" role="status" aria-live="polite" aria-label="Meter reading">
          <span class="digits" class:err={reading.kind !== 'ok'}>{reading.text ? fmt(reading.text) : '----'}</span>
          <span class="unit">{unitHint}</span>
          {#if reading.beep}<span class="beep">))) BEEP</span>{/if}
        </div>
        <p class="hint">{modeHint}</p>
        <Segmented
          size="sm"
          label="Meter range"
          bind:value={mode}
          options={[
            { value: 'V', label: 'V', title: 'DC volts' },
            { value: 'A', label: 'A', title: 'DC amps (in series!)' },
            { value: 'R', label: 'Ω', title: 'Ohms (power off!)' },
            { value: 'C', label: '•))', title: 'Continuity' },
          ]}
        />
        <div class="probes">
          <label>Red probe on
            <select bind:value={red}>{#each tps as t (t)}<option value={t}>{t}</option>{/each}</select>
          </label>
          <label>Black probe on
            <select bind:value={black}>{#each tps as t (t)}<option value={t}>{t}</option>{/each}</select>
          </label>
        </div>
        <p class="next">Next click on the diagram moves the <b class={placing}>{placing}</b> probe.</p>
        <div class="toggles">
          <Toggle label="Power" bind:checked={power} />
          {#if scenario === 'divider'}<Toggle label="Jumper J in place" bind:checked={linkClosed} />{/if}
        </div>
        {#if reading.note}<p class="warn" class:bad={reading.kind !== 'open'}>{reading.note}</p>{/if}
        {#if fuseBlown}
          <div class="fuse">
            <span>Fuse blown.</span>
            <Button size="sm" onclick={() => (fuseBlown = false)}>Replace fuse</Button>
          </div>
        {/if}
      </div>
    </div>

    <!-- Tasks. -->
    {#if step < 3}
      <ul class="tasks" aria-label="Things to try">
        {#each tasks as t (t.task.id)}
          <li class:done={t.done}>
            <span class="tick" aria-hidden="true">{#if t.done}<Icon name="check" size={13} />{/if}</span>
            <span>{t.task.text}<span class="sr-only">{t.done ? ' (done)' : ''}</span></span>
          </li>
        {/each}
      </ul>
      {#if allDone && step === 0}
        <p class="finding">3 V + 6 V = 9 V: the two drops add up to the battery voltage, and the smaller resistor gets the smaller share.</p>
      {:else if allDone && step === 1}
        <p class="finding">The same 1 mA flows at every point of a series loop. Put the meter across a battery and a 0.1 Ω “wire” meets a source that can supply tens of amps.</p>
      {:else if allDone && step === 2}
        <p class="finding">OL means “over limit”: an open circuit reads as an infinite resistance. A resistor still in a live circuit cannot be measured this way.</p>
      {/if}
    {:else}
      <div class="fault">
        <p class="q">Which resistor is open?</p>
        <div class="answers">
          {#each [0, 1, 2] as i (i)}
            <Button onclick={() => answer(i)} disabled={repaired}>R{i + 1}</Button>
          {/each}
          <Button variant="ghost" onclick={newFault}>New fault</Button>
        </div>
        {#if verdict}<p class="verdict" class:ok={verdict.ok} role="status">{verdict.text}</p>{/if}
        <details>
          <summary>Hint</summary>
          <p>Two methods. <b>Power on:</b> measure the voltage across each resistor. In a series loop that carries no current, a working resistor drops nothing; the open one drops nearly the whole battery. <b>Power off:</b> measure each resistor’s resistance; an open one reads OL.</p>
        </details>
      </div>
    {/if}
  </div>
</Widget>

<style>
  .tour {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    min-width: 0;
  }
  .intro {
    margin: 0;
    font-size: 0.9rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem 1.4rem;
    align-items: start;
  }
  @media (max-width: 700px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .circuit {
    min-width: 0;
  }
  svg {
    width: 100%;
    max-width: 380px;
    height: auto;
    display: block;
    margin: 0 auto;
    font-family: var(--font-ui);
    font-size: 12.5px;
  }
  .wire path,
  .wire {
    fill: none;
    stroke: var(--wire);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .body {
    fill: var(--panel);
    stroke: var(--wire);
    stroke-width: 2;
  }
  .wireline {
    stroke: var(--wire);
    stroke-width: 2;
  }
  .arrow {
    fill: none;
    stroke: var(--wire);
    stroke-width: 1.5;
  }
  .glow {
    fill: var(--sig-high);
    opacity: 0;
    filter: blur(5px);
  }
  .plate {
    stroke: var(--fg);
    stroke-linecap: butt;
  }
  .plate.long {
    stroke-width: 2;
  }
  .plate.short {
    stroke-width: 5;
  }
  .bat text,
  .name {
    fill: var(--fg);
    font-weight: 600;
  }
  .lbl {
    fill: var(--mute);
    font-size: 11.5px;
    font-weight: 500;
  }
  .lever {
    stroke: var(--fg);
    stroke-width: 2.5;
    stroke-linecap: round;
    fill: none;
  }
  .dot {
    fill: var(--fg);
  }
  .jump {
    fill: color-mix(in srgb, var(--copper) 14%, var(--panel));
    stroke: var(--copper);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
  }
  .jump.open {
    fill: transparent;
  }
  .sw,
  .tp {
    cursor: pointer;
    outline: none;
  }
  .sw:focus-visible .dot,
  .sw:focus-visible .lever,
  .tp:focus-visible .tpdot {
    stroke: var(--focus);
    stroke-width: 3;
  }
  .sw:hover .lever {
    stroke: var(--copper);
  }
  .tpdot {
    fill: var(--panel);
    stroke: var(--copper);
    stroke-width: 2.5;
  }
  .tp:hover .tpdot {
    fill: var(--copper-soft);
  }
  .tpname {
    fill: var(--copper-ink);
    font-weight: 700;
    font-size: 15px;
    font-family: var(--font-mono);
  }
  .ring {
    fill: none;
    stroke-width: 3.5;
  }
  .ring.red {
    stroke: var(--sig-x);
  }
  .ring.black {
    stroke: var(--fg);
  }
  .legend {
    margin: 0.3rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-2);
    text-align: center;
  }
  .sw-red,
  .sw-black {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
    border: 3px solid var(--sig-x);
    vertical-align: -1px;
    margin-left: 0.5rem;
  }
  .sw-black {
    border-color: var(--fg);
  }
  .sw-red {
    margin-left: 0;
  }

  /* The meter. */
  .meter {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.8rem;
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    background: light-dark(#f0e7d3, #16202d);
    box-shadow: var(--shadow);
    min-width: 0;
  }
  .lcd {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2rem 0.7rem;
    padding: 0.55rem 0.8rem;
    border-radius: 6px;
    background: #1c2a24;
    color-scheme: dark;
    box-shadow: inset 0 2px 6px rgb(0 0 0 / 0.5);
  }
  .digits {
    font-family: var(--font-mono);
    font-size: 1.9rem;
    font-weight: 600;
    color: #5cf0a0;
    letter-spacing: 0.03em;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 0 8px rgb(92 240 160 / 0.4);
  }
  .digits.err {
    color: #ffb23e;
    text-shadow: 0 0 8px rgb(255 178 62 / 0.4);
  }
  .unit {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: #7fbf9f;
  }
  .beep {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: #ffb23e;
    font-weight: 700;
  }
  .hint {
    margin: -0.2rem 0 0.1rem;
    font-size: 0.78rem;
    color: var(--mute);
  }
  .probes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .probes label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  select {
    font: inherit;
    font-family: var(--font-mono);
    padding: 0.15rem 0.35rem;
    background: var(--panel);
    color: var(--fg);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
  }
  select:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .next {
    margin: 0;
    font-size: 0.78rem;
    color: var(--mute);
  }
  .next b.red {
    color: var(--sig-x);
  }
  .toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.2rem;
  }
  .warn {
    margin: 0;
    padding: 0.45rem 0.6rem;
    font-size: 0.8rem;
    line-height: 1.45;
    border-left: 3px solid var(--maybe);
    background: var(--maybe-soft);
    border-radius: 0 5px 5px 0;
    color: var(--fg);
  }
  .warn.bad {
    border-left-color: var(--bad);
    background: var(--bad-soft);
  }
  .fuse {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.82rem;
    color: var(--bad);
    font-weight: 600;
  }
  .tasks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .tasks li {
    display: flex;
    gap: 0.55rem;
    align-items: flex-start;
    font-size: 0.88rem;
    color: var(--ink-2);
    line-height: 1.45;
  }
  .tasks li.done {
    color: var(--fg);
  }
  .tick {
    flex: none;
    width: 1.1rem;
    height: 1.1rem;
    margin-top: 0.1rem;
    border: 1.5px solid var(--line-strong);
    border-radius: 4px;
    display: grid;
    place-items: center;
    color: var(--on-accent);
  }
  li.done .tick {
    background: var(--ok);
    border-color: var(--ok);
  }
  .finding {
    margin: 0;
    padding: 0.5rem 0.7rem;
    border-left: 3px solid var(--ok);
    background: var(--ok-soft);
    border-radius: 0 5px 5px 0;
    font-size: 0.86rem;
    line-height: 1.5;
  }
  .fault {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .q {
    margin: 0;
    font-weight: 600;
  }
  .answers {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .verdict {
    margin: 0;
    padding: 0.5rem 0.7rem;
    border-left: 3px solid var(--bad);
    background: var(--bad-soft);
    border-radius: 0 5px 5px 0;
    font-size: 0.86rem;
    line-height: 1.5;
  }
  .verdict.ok {
    border-left-color: var(--ok);
    background: var(--ok-soft);
  }
  details {
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  summary {
    cursor: pointer;
    color: var(--copper-ink);
    font-weight: 600;
  }
  details p {
    margin: 0.4rem 0 0;
    line-height: 1.5;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
