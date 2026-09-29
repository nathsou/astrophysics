<!--
  The noise gauntlet: the flagship of Chapter 8.

  A bit enters a chain of 20 stages. Every stage adds noise of the size you choose. You choose what a stage
  is: a plain wire (gain 1), the diode stage of Chapter 7 (gain a little below 1, and it loses 0.65 V), or
  the RTL inverter of Figure 8.6 (gain about −15 in the middle). The bars show the level at every node;
  a red bar with a cross is a level a receiver would misread. The curve on the right is the stage's
  transfer function with a "cobweb" showing what the chain does to a noiseless signal, and below it a
  16-bit word is sent through 16 copies of the chain.

  The transfer functions are not drawn by hand: ./vtc.ts sweeps a netlist on the course's analog engine
  once, and each stage here is a lookup in that table (see the notes in gauntlet.ts).

    ::noise-gauntlet{n="8.7" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { STAGES, STAGE_LABELS, THRESHOLD, cobweb, errorCount, firstError, runGauntlet, runWord, stageFunction, type StageKind } from './gauntlet';
  import { VCC, diodeVtc, gainBand, rtlVtc, steepest } from './vtc';

  let { title = 'The noise gauntlet', caption, n }: { title?: string; caption?: string; n?: string | number } = $props();

  const DEFAULTS = { kind: 'diode' as StageKind, sigma: 0.2, high: 5, seed: 1, bit: 1 as 0 | 1 };
  let kind = $state<StageKind>(DEFAULTS.kind);
  let sigma = $state(DEFAULTS.sigma);
  let high = $state(DEFAULTS.high);
  let seed = $state(DEFAULTS.seed);
  let bit = $state<0 | 1>(DEFAULTS.bit);

  const run = $derived(runGauntlet({ kind, bit, high, sigma, seed }));
  const WORD: (0 | 1)[] = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0, 0];
  const word = $derived(runWord({ kind, high, sigma, seed }, WORD));
  const lost = $derived(errorCount({ kind, high, sigma, seed }, 400));
  const lost100 = $derived(errorCount({ kind, high, sigma, seed, stages: 100 }, 400));
  const lost500 = $derived(errorCount({ kind, high, sigma, seed, stages: 500 }, 400));
  const first = $derived(firstError(run));
  const final = $derived(run.levels[STAGES]!);
  const table = $derived(kind === 'diode' ? diodeVtc() : kind === 'inverter' ? rtlVtc() : undefined);
  const steep = $derived(table ? steepest(table) : { gain: 1, at: 0 });
  const band = $derived(table ? gainBand(table) : undefined);
  const web = $derived(cobweb(kind, bit ? high : 0));

  // Bar chart geometry (viewBox units).
  const BW = 430;
  const BH = 230;
  const BL = 34;
  const BR = 8;
  const BT = 14;
  const BB = 30;
  const bx = (i: number) => BL + ((BW - BL - BR) * (i + 0.5)) / (STAGES + 1);
  const barW = ((BW - BL - BR) / (STAGES + 1)) * 0.72;
  const by = (v: number) => BT + (1 - v / VCC) * (BH - BT - BB);

  // Transfer plot geometry.
  const TS = 230;
  const TL = 34;
  const TB = 30;
  const tx = (v: number) => TL + (v / VCC) * (TS - TL - 10);
  const ty = (v: number) => 10 + (1 - v / VCC) * (TS - 10 - TB);
  const curve = $derived.by(() => {
    const f = stageFunction(kind);
    const pts: string[] = [];
    for (let i = 0; i <= 100; i++) {
      const v = (i / 100) * VCC;
      pts.push(`${i ? 'L' : 'M'}${tx(v).toFixed(1)} ${ty(Math.min(VCC, Math.max(0, f(v)))).toFixed(1)}`);
    }
    return pts.join(' ');
  });
  const webPath = $derived(web.map(([x, y], i) => `${i ? 'L' : 'M'}${tx(x).toFixed(1)} ${ty(y).toFixed(1)}`).join(' '));

  const volts = (v: number) => `${v.toFixed(2)} V`;
  const summary = $derived(
    `${STAGE_LABELS[kind]}, ${sigma.toFixed(2)} volts of noise per stage, a ${bit ? `1 sent as ${high.toFixed(1)} volts` : '0'}. After ${STAGES} stages the level is ${volts(final)}, which reads as ${run.read[STAGES]}${run.correct[STAGES] ? ', correct' : ', wrong'}. ${first === undefined ? 'No stage misreads.' : `The first stage that misreads is ${first}.`} ${lost} of 400 trial bits are misread at the end, ${lost100} if the chain had 100 stages and ${lost500} if it had 500.`,
  );

  function reset() {
    kind = DEFAULTS.kind;
    sigma = DEFAULTS.sigma;
    high = DEFAULTS.high;
    seed = DEFAULTS.seed;
    bit = DEFAULTS.bit;
  }
</script>

<Widget {title} {caption} {n} kind="Flagship interactive" onreset={reset}>
  {#snippet controls()}
    <Segmented
      label="Kind of stage"
      bind:value={kind}
      options={[
        { value: 'wire', label: 'Wire', title: STAGE_LABELS.wire },
        { value: 'diode', label: 'Diode stage', title: STAGE_LABELS.diode },
        { value: 'inverter', label: 'Inverter', title: STAGE_LABELS.inverter },
      ]}
    />
    <Slider bind:value={sigma} min={0} max={1.5} step={0.05} label="Noise added per stage" format={(v) => `${v.toFixed(2)} V`} />
    <Slider bind:value={high} min={1.5} max={5} step={0.1} label="Level sent for a 1" format={(v) => `${v.toFixed(1)} V`} />
    <Segmented
      label="Bit sent"
      size="sm"
      value={bit}
      onchange={(v) => (bit = v)}
      options={[
        { value: 1, label: 'Send 1' },
        { value: 0, label: 'Send 0' },
      ]}
    />
    <Button size="sm" onclick={() => seed++}>New noise</Button>
  {/snippet}

  <div class="ng">
    <div class="panels">
      <figure class="panel">
        <figcaption class="cap ui">Level at each stage</figcaption>
        <svg viewBox="0 0 {BW} {BH}" role="img" aria-label="Bar chart of the voltage at the input and after each of {STAGES} stages. {summary}">
          <!-- Grid and axes -->
          {#each [0, 1, 2, 3, 4, 5] as v (v)}
            <line class="grid" x1={BL} x2={BW - BR} y1={by(v)} y2={by(v)} />
            <text class="tick" x={BL - 6} y={by(v)} text-anchor="end" dominant-baseline="middle">{v}</text>
          {/each}
          <line class="thr" x1={BL} x2={BW - BR} y1={by(THRESHOLD)} y2={by(THRESHOLD)} />
          <text class="thr-label" x={BW - BR - 2} y={by(THRESHOLD) - 4} text-anchor="end">reads as 1 above this line</text>
          {#each [0, 5, 10, 15, 20] as k (k)}
            <text class="tick" x={bx(k)} y={BH - BB + 14} text-anchor="middle">{k === 0 ? 'in' : k}</text>
          {/each}
          <text class="tick" x={(BL + BW - BR) / 2} y={BH - 4} text-anchor="middle">stage</text>
          <text class="tick" x="6" y={(BT + BH - BB) / 2} text-anchor="middle" transform="rotate(-90 6 {(BT + BH - BB) / 2})">volts</text>

          {#each run.levels as v, i (i)}
            <rect
              class="bar"
              class:hi={run.read[i] === 1 && run.correct[i]}
              class:lo={run.read[i] === 0 && run.correct[i]}
              class:bad={!run.correct[i]}
              x={bx(i) - barW / 2}
              y={by(v)}
              width={barW}
              height={Math.max(1.5, by(0) - by(v))}
              rx="1.5"
            >
              <title>Stage {i}: {volts(v)}, reads as {run.read[i]} (should be {run.expected[i]})</title>
            </rect>
            {#if !run.correct[i]}
              <text class="cross" x={bx(i)} y={Math.min(by(v), by(0)) - 4} text-anchor="middle">×</text>
            {/if}
          {/each}
          <!-- The same signal without noise -->
          <path class="clean" d={run.clean.map((v, i) => `${i ? 'L' : 'M'}${bx(i).toFixed(1)} ${by(v).toFixed(1)}`).join(' ')} />
        </svg>
        <ul class="legend ui" aria-label="Key">
          <li><i class="sw hi"></i> reads as 1</li>
          <li><i class="sw lo"></i> reads as 0</li>
          <li><i class="sw bad"></i> × misread</li>
          <li><i class="ln"></i> the same signal with no noise</li>
        </ul>
      </figure>

      <figure class="panel">
        <figcaption class="cap ui">One stage, and what a chain of them does</figcaption>
        <svg viewBox="0 0 {TS} {TS}" role="img" aria-label="Transfer curve of one stage: output voltage against input voltage, with the path of a noiseless signal through the chain">
          {#if band}
            <rect class="band" x={tx(band.from)} y="10" width={tx(band.to) - tx(band.from)} height={TS - 10 - TB} />
          {/if}
          {#each [0, 1, 2, 3, 4, 5] as v (v)}
            <line class="grid" x1={tx(v)} x2={tx(v)} y1="10" y2={TS - TB} />
            <line class="grid" x1={TL} x2={TS - 10} y1={ty(v)} y2={ty(v)} />
            <text class="tick" x={tx(v)} y={TS - TB + 14} text-anchor="middle">{v}</text>
            <text class="tick" x={TL - 6} y={ty(v)} text-anchor="end" dominant-baseline="middle">{v}</text>
          {/each}
          <text class="tick" x={(TL + TS - 10) / 2} y={TS - 4} text-anchor="middle">input (V)</text>
          <text class="tick" x="6" y={(10 + TS - TB) / 2} text-anchor="middle" transform="rotate(-90 6 {(10 + TS - TB) / 2})">output (V)</text>
          <line class="diag" x1={tx(0)} y1={ty(0)} x2={tx(VCC)} y2={ty(VCC)} />
          <text class="diag-label" x={tx(4.9)} y={ty(4.9) + 14} text-anchor="end">out = in</text>
          <path class="curve" d={curve} />
          <path class="web" d={webPath} />
          <circle class="start" cx={tx(bit ? high : 0)} cy={ty(0)} r="4" />
        </svg>
        <p class="note ui">
          {#if kind === 'inverter'}
            Steepest gain {steep.gain.toFixed(0)}, shaded where the slope is steeper than 1 (input {band ? `${band.from.toFixed(1)}–${band.to.toFixed(1)} V` : ''}). The staircase homes in on two levels.
          {:else if kind === 'diode'}
            Slope just under 1 and shifted down by 0.65 V: the staircase slides down to zero.
          {:else}
            Slope exactly 1: the staircase never moves. Nothing corrects, nothing decays.
          {/if}
        </p>
      </figure>
    </div>

    <dl class="read ui">
      <div>
        <dt>Level after stage {STAGES}</dt>
        <dd class="big" class:bad={!run.correct[STAGES]}>{volts(final)}</dd>
        <dd class="sub">reads as {run.read[STAGES]}, should be {run.expected[STAGES]}</dd>
      </div>
      <div>
        <dt>First stage that misreads</dt>
        <dd class="big" class:bad={first !== undefined}>{first === undefined ? 'none' : first === 0 ? 'the input' : `stage ${first}`}</dd>
      </div>
      <div>
        <dt>Bits lost, of 400 sent</dt>
        <dd class="big" class:bad={lost > 0}>{lost}</dd>
        <dd class="sub">200 ones and 200 zeros, each with fresh noise</dd>
      </div>
      <div>
        <dt>If the chain were longer</dt>
        <dd class="big" class:bad={lost100 > 0}>{lost100} <span class="of">at 100 stages</span></dd>
        <dd class="big" class:bad={lost500 > 0}>{lost500} <span class="of">at 500 stages</span></dd>
      </div>
    </dl>

    <div class="word ui" role="group" aria-label="A 16-bit word sent through 16 copies of the chain">
      <div class="row">
        <span class="rl">sent</span>
        {#each WORD as b, i (i)}<span class="cell" class:one={b === 1}>{b}</span>{/each}
      </div>
      <div class="row">
        <span class="rl">got</span>
        {#each word.received as b, i (i)}<span class="cell" class:one={b === 1} class:bad={b !== WORD[i]}>{b}</span>{/each}
      </div>
      <p class="sub">{word.errors === 0 ? 'The word arrives intact.' : `${word.errors} of 16 bits arrive wrong.`}</p>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{summary}</p>
  </div>
</Widget>

<style>
  .ng {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    min-width: 0;
  }
  .panels {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
    gap: 1rem 1.25rem;
    align-items: start;
  }
  @media (max-width: 52rem) {
    .panels {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .panel {
    margin: 0;
    min-width: 0;
  }
  .cap {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--mute);
    margin-bottom: 0.3rem;
    padding: 0;
    border: 0;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .panel:last-child svg {
    max-width: 24rem;
  }
  .grid {
    stroke: color-mix(in srgb, var(--fg) 10%, transparent);
    stroke-width: 1;
  }
  .tick {
    fill: var(--mute);
    font-family: var(--font-mono);
    font-size: 10px;
  }
  .thr {
    stroke: var(--fg);
    stroke-width: 1.2;
    stroke-dasharray: 5 4;
    opacity: 0.55;
  }
  .thr-label {
    fill: var(--ink-2);
    font-family: var(--font-ui);
    font-size: 10px;
  }
  .bar {
    stroke: none;
  }
  .bar.hi {
    fill: var(--sig-high);
  }
  .bar.lo {
    fill: var(--sig-low);
  }
  .bar.bad {
    fill: var(--sig-x);
  }
  .cross {
    fill: var(--sig-x);
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
  }
  .clean {
    fill: none;
    stroke: var(--fg);
    stroke-width: 1.4;
    stroke-dasharray: 3 3;
    opacity: 0.6;
  }
  .band {
    fill: color-mix(in srgb, var(--copper) 16%, transparent);
  }
  .diag {
    stroke: var(--fg);
    stroke-width: 1;
    stroke-dasharray: 4 4;
    opacity: 0.5;
  }
  .diag-label {
    fill: var(--mute);
    font-family: var(--font-mono);
    font-size: 10px;
  }
  .curve {
    fill: none;
    stroke: var(--copper);
    stroke-width: 3;
    stroke-linejoin: round;
  }
  .web {
    fill: none;
    stroke: var(--sig-current);
    stroke-width: 1.6;
    stroke-linejoin: round;
  }
  .start {
    fill: var(--sig-current);
    stroke: var(--panel);
    stroke-width: 1.5;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    list-style: none;
    margin: 0.4rem 0 0;
    padding: 0;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .sw {
    display: inline-block;
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 2px;
  }
  .sw.hi {
    background: var(--sig-high);
  }
  .sw.lo {
    background: var(--sig-low);
  }
  .sw.bad {
    background: var(--sig-x);
  }
  .ln {
    display: inline-block;
    width: 1.2rem;
    border-top: 2px dashed var(--fg);
    opacity: 0.6;
  }
  .note {
    margin: 0.4rem 0 0;
    font-size: 0.8rem;
    line-height: 1.45;
    color: var(--ink-2);
  }
  .read {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
    gap: 0.5rem;
    margin: 0;
  }
  .read > div {
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--pn);
    min-width: 0;
  }
  dt {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  dd {
    margin: 0;
  }
  .big {
    font-family: var(--font-mono);
    font-size: 1.05rem;
    font-weight: 500;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }
  .big.bad {
    color: var(--sig-x);
  }
  .of {
    font-family: var(--font-ui);
    font-size: 0.72rem;
    font-weight: 400;
    color: var(--ink-2);
  }
  .sub {
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.4;
  }
  .word {
    display: grid;
    gap: 0.3rem;
  }
  .row {
    display: grid;
    grid-template-columns: 4.6rem repeat(16, minmax(0, 1fr));
    align-items: center;
    gap: 2px;
    max-width: 30rem;
  }
  @media (max-width: 34rem) {
    .row {
      grid-template-columns: 2.9rem repeat(16, minmax(0, 1fr));
    }
    .cell {
      font-size: 0.7rem;
    }
  }
  .rl {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  .cell {
    text-align: center;
    padding: 0.12rem 0;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    font-weight: 600;
    background: color-mix(in srgb, var(--sig-low) 22%, var(--panel));
    color: var(--ink-2);
  }
  .cell.one {
    background: color-mix(in srgb, var(--sig-high) 30%, var(--panel));
    color: var(--fg);
  }
  .cell.bad {
    background: var(--sig-x);
    color: var(--panel);
    text-decoration: underline;
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
