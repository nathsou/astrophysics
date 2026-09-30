<!--
  Glitch hunt: a live circuit with a hazard, a timing diagram that shows the glitch in slow motion, a switch
  that adds the consensus term, and a game: flip the inputs and find every transition that glitches.

    ::glitch-hunt{n="15.3"}

  The circuit runs on the digital engine (the drawing's own switches are the controls). Underneath, the same
  engine is run headless for every transition of the circuit (hazards.ts), which is how the grid knows what each
  flip should have shown: the live run and the grid are the same simulation.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import type { Engine } from '$lib/sim/engine';
  import type { ParamValue } from '$lib/sim/netlist/types';
  import LiveBench from './LiveBench.svelte';
  import { allTransitions, bitsOf, withNotDelay, type DelayModelName, type Transition } from './hazards';
  import { LEVELS, cellKey, hunt as huntOf, initialState, verdict } from './hunt';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let levelIdx = $state(0);
  let fixed = $state(false);
  let notDelay = $state(2);
  let model: DelayModelName = $state('inertial');
  let pace: 'slow' | 'normal' | 'instant' = $state('normal');
  const PACE = { slow: 2e-9, normal: 5e-9, instant: 5e-9 };

  const level = $derived(LEVELS[levelIdx]!);
  const base = $derived(fixed ? level.fixed : level.plain);
  const circuit = $derived(withNotDelay(base, notDelay));
  const options = $derived({ delayModel: model });
  const hunt = $derived(huntOf(level));
  const table = $derived(allTransitions(base, hunt, { delayModel: model, notDelay }));
  const nIn = $derived(level.inputs.length);

  let engine: Engine | null = $state(null);
  let explored: Record<string, boolean> = $state({});
  let flips = $state(0);
  let bits = $state(0);
  let lastFlip = -Infinity;
  let said = $state('');
  let saidKind: 'ok' | 'bad' | 'note' = $state('note');
  const GAP = 10e-9;

  // Every new circuit starts in its file's input state.
  $effect(() => {
    const c = base;
    const l = level;
    untrack(() => {
      bits = initialState(c, l.inputs);
      lastFlip = -Infinity;
    });
  });

  function find(state: number, input: number): Transition | undefined {
    return table[state * nIn + input];
  }

  function onparam(id: string, key: string, _value: ParamValue) {
    if (key !== 'on') return;
    const i = level.inputs.indexOf(id);
    if (i < 0 || !engine) return;
    const now = engine.time;
    const settled = now - lastFlip >= GAP;
    const state = bits;
    bits = state ^ (1 << (nIn - 1 - i));
    lastFlip = now;
    if (!settled) {
      said = 'That flip came before the last one had settled, so it does not count. Wait for the waveforms to go flat, or choose Instant.';
      saidKind = 'note';
      return;
    }
    const t = find(state, i);
    if (!t) return;
    flips++;
    explored[cellKey(level.id, state, i)] = true;
    said = verdict(t, level);
    saidKind = t.kind === 'glitch' ? 'bad' : 'ok';
  }

  function reset() {
    explored = {};
    flips = 0;
    said = '';
    fixed = false;
    notDelay = 2;
    model = 'inertial';
  }

  function chooseLevel(i: number) {
    levelIdx = i;
    said = LEVELS[i]!.intro;
    saidKind = 'note';
    flips = 0;
  }
  $effect(() => {
    // The first message, before the reader has done anything.
    untrack(() => {
      if (!said) said = LEVELS[levelIdx]!.intro;
    });
  });

  const glitching = $derived(table.filter((t) => t.kind === 'glitch'));
  const found = $derived(glitching.filter((t) => explored[cellKey(level.id, t.state, t.input)]).length);
  const rows = $derived(
    Array.from({ length: 1 << nIn }, (_, s) => ({
      state: s,
      label: bitsOf(s, nIn).join(''),
      cells: level.inputs.map((_, i) => {
        const t = find(s, i)!;
        return { t, seen: !!explored[cellKey(level.id, s, i)], i };
      }),
    })),
  );
  const half = $derived(nIn === 4);

  function glyph(t: Transition): string {
    const H = 2;
    const L = 10;
    const y = (v: number) => (v ? H : L);
    if (t.kind === 'steady') return `M1 ${y(t.before)} H19`;
    if (t.kind === 'changes') return `M1 ${y(t.before)} H8 L10 ${y(t.after)} H19`;
    if (t.hazard === 'dynamic') return `M1 ${y(t.before)} H4 L5 ${y(t.after)} H8 L9 ${y(t.before)} H12 L13 ${y(t.after)} H19`;
    return `M1 ${y(t.before)} H6 L7 ${y(1 - t.before)} H11 L12 ${y(t.before)} H19`;
  }
  function describe(t: Transition, state: number, seen: boolean): string {
    const flipped = level.inputs[t.input]!;
    if (!seen) return `From ${bitsOf(state, nIn).join('')}, flip ${flipped}: not tried yet`;
    const what = t.kind === 'steady' ? `${level.out} stays ${t.before}` : t.kind === 'changes' ? `${level.out} changes ${t.before} to ${t.after}` : `${level.out} glitches (${t.hazard} hazard)`;
    return `From ${bitsOf(state, nIn).join('')}, flip ${flipped}: ${what}`;
  }
</script>

<Widget {n} title="Glitch hunt" subtitle="Find the transitions that make a correct circuit blink" kind="Lab bench" {caption} onreset={reset}>
  {#snippet controls()}
    <Segmented
      label="Circuit"
      size="sm"
      value={levelIdx}
      options={LEVELS.map((l, i) => ({ value: i, label: l.name }))}
      onchange={chooseLevel}
    />
    <Toggle label="Add the consensus term ({level.consensus})" bind:checked={fixed} />
    <Slider label="Inverter delay" bind:value={notDelay} min={0} max={4} step={0.5} compact format={(v) => `${v.toFixed(1)} ns`} />
    <Segmented
      label="Delay model"
      size="sm"
      bind:value={model}
      options={[
        { value: 'inertial', label: 'Inertial', title: 'A gate ignores pulses shorter than its own delay' },
        { value: 'transport', label: 'Transport', title: 'Every change is passed on, however short' },
      ]}
    />
    <Segmented
      label="Playback speed"
      size="sm"
      bind:value={pace}
      options={[
        { value: 'slow', label: 'Slow', title: '2 ns per second' },
        { value: 'normal', label: 'Normal', title: '5 ns per second' },
        { value: 'instant', label: 'Instant', title: 'Jump straight to the result' },
      ]}
    />
  {/snippet}

  <div class="gh">
    <p class="fn ui"><code>{level.expression}</code>{#if fixed}<span> + {level.consensus}</span>{/if}</p>
    <LiveBench
      {circuit}
      {options}
      traces={level.traces}
      window={24e-9}
      speed={PACE[pace]}
      instant={pace === 'instant'}
      scale={1.15}
      bind:engine
      label="{level.name}: {level.expression}"
      {onparam}
    />
    <p class="said ui {saidKind}" role="status" aria-live="polite">{said}</p>

    <div class="hunt">
      <div class="score ui">
        {#if glitching.length === 0}
          <strong>No transition glitches</strong> with these settings.
          {#if fixed}The consensus term covers every hand-over.{:else if notDelay === 0}Both paths change at the same instant, so there is nothing to race.{:else if model === 'inertial'}The inverter is faster than the gates that follow it, which ignore the short pulse.{/if}
        {:else}
          <strong>{found} of {glitching.length}</strong> glitching transitions found in {flips} {flips === 1 ? 'flip' : 'flips'}.
        {/if}
      </div>
      <div class="tables" class:two={half}>
        {#each half ? [rows.slice(0, 8), rows.slice(8)] : [rows] as part, k (k)}
          <table class="grid ui">
            <caption class="sr-only">Every transition of the circuit: rows are the input values before the flip, columns the input that flips</caption>
            <thead>
              <tr>
                <th scope="col">{level.inputs.join('')}</th>
                {#each level.inputs as name (name)}<th scope="col">flip {name}</th>{/each}
              </tr>
            </thead>
            <tbody>
              {#each part as r (r.state)}
                <tr class:here={r.state === bits}>
                  <th scope="row">{r.label}</th>
                  {#each r.cells as c (c.i)}
                    <td class:seen={c.seen} class:glitch={c.seen && c.t.kind === 'glitch'} title={describe(c.t, r.state, c.seen)}>
                      {#if c.seen}
                        <svg viewBox="0 0 20 12" width="24" height="14" role="img" aria-label={describe(c.t, r.state, true)}><path d={glyph(c.t)} /></svg>
                      {:else}
                        <span aria-label={describe(c.t, r.state, false)}>·</span>
                      {/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        {/each}
      </div>
      <p class="key ui">
        <span><svg viewBox="0 0 20 12" width="22" height="13" aria-hidden="true"><path d="M1 2 H19" /></svg>steady</span>
        <span><svg viewBox="0 0 20 12" width="22" height="13" aria-hidden="true"><path d="M1 10 H8 L10 2 H19" /></svg>changes once</span>
        <span class="g"><svg viewBox="0 0 20 12" width="22" height="13" aria-hidden="true"><path d="M1 2 H6 L7 10 H11 L12 2 H19" /></svg>glitch</span>
        <span class="sr-only">Try a transition by clicking a logic switch in the drawing.</span>
      </p>
    </div>
  </div>
</Widget>

<style>
  .gh {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }
  .fn {
    margin: 0;
    font-size: 0.9rem;
    color: var(--ink-2);
  }
  .fn code {
    font-family: var(--font-mono);
    color: var(--fg);
    font-weight: 600;
  }
  .fn span {
    font-family: var(--font-mono);
    color: var(--phosphor);
    font-weight: 600;
  }
  .said {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--surface-2, var(--panel));
    font-size: 0.86rem;
    color: var(--ink-2);
    min-height: 2.6em;
  }
  .said.bad {
    border-color: var(--bad);
    color: var(--fg);
    background: color-mix(in srgb, var(--bad) 9%, var(--panel));
  }
  .said.ok {
    border-color: var(--line-strong);
  }
  .hunt {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .score {
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .score strong {
    color: var(--fg);
  }
  .tables {
    display: grid;
    gap: 0.75rem;
    justify-content: start;
    grid-template-columns: max-content;
  }
  .tables.two {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), max-content));
  }
  table.grid {
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.74rem;
    font-family: var(--font-mono);
  }
  .grid th,
  .grid td {
    padding: 0.18rem 0.55rem;
    text-align: center;
    border-bottom: 1px solid var(--line);
  }
  .grid thead th {
    color: var(--mute);
    font-weight: 500;
    white-space: nowrap;
  }
  .grid tbody th {
    color: var(--fg);
    font-weight: 600;
    text-align: right;
  }
  .grid td {
    color: var(--mute);
    min-width: 4.2rem;
  }
  .grid td svg {
    display: block;
    margin: 0 auto;
    fill: none;
    stroke: var(--ink-2);
    stroke-width: 1.6;
    stroke-linejoin: round;
    stroke-linecap: round;
    overflow: visible;
  }
  .grid td.glitch {
    background: color-mix(in srgb, var(--bad) 14%, transparent);
  }
  .grid td.glitch svg {
    stroke: var(--bad);
    stroke-width: 2;
  }
  .grid tr.here th {
    color: var(--phosphor);
  }
  .grid tr.here th::after {
    content: ' ◂';
  }
  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    margin: 0;
    font-size: 0.74rem;
    color: var(--ink-3, var(--mute));
  }
  .key span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .key svg {
    fill: none;
    stroke: var(--ink-2);
    stroke-width: 1.6;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .key .g svg {
    stroke: var(--bad);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
