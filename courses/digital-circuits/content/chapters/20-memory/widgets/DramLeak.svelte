<!--
  Leaking DRAM. Sixty-four cells hold a pattern as charge on tiny capacitors; every stored 1 drains through the
  off transistor, each at its own rate, and hotter chips drain faster. A refresh reads a row and writes it back at
  full strength. Choose the pattern, the refresh interval and the temperature, and let time run: watch the charge
  fall, and the first bits die. The model is dram.ts (tested).

    ::dram-leak{n="20.5" caption="…"}
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { DRAM, advance, createDram, firstFailure, load, minCellVoltage, tally, type DramSim } from './dram';

  let { pattern: firstPattern = 'ones', interval: firstInterval = 0, n: fig, caption }: { pattern?: string; interval?: number; n?: string | number; caption?: string } = $props();

  const ROWS = 8;
  const COLS = 8;
  const patterns: Record<string, (r: number, c: number) => number> = {
    ones: () => 1,
    checker: (r, c) => (r + c) % 2,
    stripes: (r) => (r % 2 ? 0 : 1),
  };

  let sim = $state.raw<DramSim>(createDram(ROWS, COLS));
  let rev = $state(0);
  let pat = $state(untrack(() => firstPattern));
  /** Refresh interval in ms; 0 means never. */
  let interval = $state(untrack(() => firstInterval));
  let temp = $state(85);
  let speed = $state(0.1);
  let playing = $state(false);
  let root: HTMLElement | undefined = $state();
  let visible = true;
  let reduced = false;

  interface Trace {
    label: string;
    row: number;
    col: number;
    colour: string;
    t: number[];
    v: number[];
  }
  let traces = $state.raw<Trace[]>([]);
  let flash = $state(-1);

  function pickTraces(): Trace[] {
    const ones: { r: number; c: number; ret: number }[] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (sim.data[r]![c]) ones.push({ r, c, ret: sim.retention[r]![c]! });
    ones.sort((a, b) => a.ret - b.ret);
    if (!ones.length) return [];
    const pick = [ones[0]!, ones[Math.floor(ones.length / 2)]!, ones[ones.length - 1]!];
    const names = ['weakest cell', 'median cell', 'strongest cell'];
    return pick.map((p, i) => ({ label: names[i]!, row: p.r, col: p.c, colour: `var(--series-${[1, 3, 5][i]})`, t: [0], v: [sim.v[p.r]![p.c]!] }));
  }

  function restart() {
    playing = false;
    load(sim, Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => patterns[pat]!(r, c))));
    traces = pickTraces();
    flash = -1;
    rev++;
  }
  restart();

  onMount(() => {
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!root) return;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(root);
    return () => io.disconnect();
  });

  /** Let `dt` seconds pass, in slices short enough to catch every refresh, recording the traced cells. */
  function run(dt: number) {
    const gap = interval > 0 ? interval / 1000 / ROWS : Infinity;
    const slice = Math.min(dt, Math.max(dt / 40, Math.min(gap / 3, dt)));
    let left = dt;
    while (left > 1e-12) {
      const d = Math.min(slice, left);
      const before = sim.refreshes;
      advance(sim, d, temp, interval > 0 ? interval / 1000 : null);
      if (sim.refreshes !== before) flash = (sim.nextRow + ROWS - 1) % ROWS;
      for (const tr of traces) {
        tr.t.push(sim.time);
        tr.v.push(sim.v[tr.row]![tr.col]!);
        if (tr.t.length > 900) {
          tr.t = tr.t.filter((_, i) => i % 2 === 0);
          tr.v = tr.v.filter((_, i) => i % 2 === 0);
        }
      }
      left -= d;
    }
    rev++;
  }

  let last = 0;
  $effect(() => {
    if (!playing) return;
    let raf = 0;
    last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visible && !document.hidden) run(dt * speed);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  function stepForward() {
    run(speed * 0.5);
  }

  const stats = $derived.by(() => {
    void rev;
    return tally(sim);
  });
  const weakest = $derived.by(() => {
    void rev;
    return firstFailure(sim, temp);
  });
  /** Reading the simulation through this makes the markup follow it: the simulation object itself is not reactive. */
  const snap = $derived.by(() => {
    void rev;
    return { ...sim };
  });
  const vmin = minCellVoltage();
  const CELL = 40;
  const GAP = 4;
  const GW = COLS * (CELL + GAP) + 26;
  const GH = ROWS * (CELL + GAP);
  const ms = (s: number) => (s >= 1 ? `${s.toFixed(2)} s` : `${(s * 1000).toFixed(s < 0.01 ? 1 : 0)} ms`);
  const tone = (v: number) => `color-mix(in srgb, var(--sig-high) ${Math.round(Math.max(0, Math.min(1, v / DRAM.vdd)) * 100)}%, var(--sig-low))`;

  // The chart: charge of three cells against time.
  const CW = 500;
  const CH = 200;
  const PL = 44;
  const PB = 26;
  const tMax = $derived.by(() => {
    void rev;
    return Math.max(0.2, sim.time);
  });
  const px = (t: number) => PL + (t / tMax) * (CW - PL - 34);
  const py = (v: number) => 10 + (1 - v / DRAM.vdd) * (CH - PB - 10);
  const path = (tr: Trace) => tr.t.map((t, i) => `${i ? 'L' : 'M'}${px(t).toFixed(1)} ${py(tr.v[i]!).toFixed(1)}`).join(' ');
  const ticks = $derived(Array.from({ length: 5 }, (_, i) => (tMax * i) / 4));
</script>

<Widget title="Leaking DRAM" n={fig} {caption} kind="Interactive" onreset={restart}>
  {#snippet controls()}
    <Segmented size="sm" label="Stored pattern" value={pat} onchange={(v) => { pat = v; restart(); }} options={[{ value: 'ones', label: 'All 1s' }, { value: 'checker', label: 'Checkerboard' }, { value: 'stripes', label: 'Stripes' }]} />
    <Segmented
      size="sm"
      label="Refresh interval"
      value={interval}
      onchange={(v) => (interval = v)}
      options={[
        { value: 0, label: 'No refresh' },
        { value: 32, label: '32 ms' },
        { value: 64, label: '64 ms', title: 'The DDR4 standard: every row once in 64 ms' },
        { value: 250, label: '250 ms' },
        { value: 1000, label: '1 s' },
      ]}
    />
  {/snippet}

  <div class="dl ui" bind:this={root}>
    <div class="row">
      <Button size="sm" variant="primary" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Run'}</Button>
      <Button size="sm" onclick={stepForward}>Step</Button>
      <Button size="sm" variant="ghost" onclick={restart}>Rewrite the data</Button>
      <Segmented size="sm" label="Simulation speed" value={speed} onchange={(v) => (speed = v)} options={[{ value: 0.01, label: '10 ms/s' }, { value: 0.1, label: '100 ms/s' }, { value: 1, label: '1 s/s' }, { value: 10, label: '10 s/s' }]} />
    </div>
    <div class="temp">
      <Slider label="Temperature" bind:value={temp} min={25} max={105} step={5} format={(v) => `${v} °C`} />
    </div>

    <div class="cols">
      <svg class="grid" viewBox="0 0 {GW} {GH}" role="img" aria-label="Sixty-four DRAM cells, each shown as a capacitor filled with charge. {stats.lost} bits lost, {stats.readable} of {stats.ones} stored ones still readable.">
        {#each Array.from({ length: ROWS }, (_, i) => i) as r (r)}
          {#if flash === r}<rect class="fl" x="0" y={r * (CELL + GAP) - 2} width={GW} height={CELL + 4} rx="4" />{/if}
          <text class="rn" x="0" y={r * (CELL + GAP) + CELL / 2 + 4}>{r}</text>
          {#each Array.from({ length: COLS }, (_, i) => i) as c (c)}
            {@const v = snap.v[r]![c]!}
            {@const x = 22 + c * (CELL + GAP)}
            {@const y = r * (CELL + GAP)}
            {@const bad = snap.lost[r]![c]}
            {@const weak = snap.data[r]![c] === 1 && v < vmin}
            <g class="c" class:bad class:weak>
              <rect class="box" {x} {y} width={CELL} height={CELL} rx="5" />
              {#if v > 0.01}<rect class="fill" x={x + 3} y={y + CELL - 3 - (CELL - 6) * (v / DRAM.vdd)} width={CELL - 6} height={(CELL - 6) * (v / DRAM.vdd)} rx="3" style="fill:{tone(v)}" />{/if}
              <line class="lim" x1={x + 1} x2={x + CELL - 1} y1={y + CELL - 3 - (CELL - 6) * (vmin / DRAM.vdd)} y2={y + CELL - 3 - (CELL - 6) * (vmin / DRAM.vdd)} />
              <text {x} y={y + CELL / 2 + 4} dx={CELL / 2} text-anchor="middle" class="bit">{bad ? '✗' : snap.data[r]![c]}</text>
            </g>
          {/each}
        {/each}
      </svg>

      <div class="side">
        <dl class="nums">
          <div><dt>time</dt><dd>{ms(snap.time)}</dd></div>
          <div><dt>refreshes</dt><dd>{snap.refreshes}</dd></div>
          <div><dt>1s still readable</dt><dd>{stats.readable} of {stats.ones}</dd></div>
          <div class:bad={stats.lost > 0}><dt>bits lost</dt><dd>{stats.lost}</dd></div>
          <div><dt>weakest 1 lasts</dt><dd>{stats.ones ? ms(weakest) : '–'}</dd></div>
        </dl>
        <p class="hint">Each square is a cell; the fill is the charge on its capacitor, and the dotted line is the lowest charge the sense amplifier can still read as a 1 ({vmin.toFixed(2)} V of {DRAM.vdd} V). A cell below it is on its way out; once a refresh or read finds it there, the bit is lost for good (✗). The highlighted row was refreshed last.</p>
      </div>
    </div>

    <svg class="chart" viewBox="0 0 {CW} {CH}" role="img" aria-label="Charge of the weakest, median and strongest stored cell against time, with the sense limit and the refreshes">
      <line class="ax" x1={PL} y1={py(0)} x2={CW - 10} y2={py(0)} />
      <line class="ax" x1={PL} y1={py(DRAM.vdd)} x2={PL} y2={py(0)} />
      <line class="lim" x1={PL} y1={py(vmin)} x2={CW - 10} y2={py(vmin)} />
      <text class="tl" x={CW - 12} y={py(vmin) - 4} text-anchor="end">sense limit {vmin.toFixed(2)} V</text>
      <text class="tl" x={PL - 6} y={py(DRAM.vdd) + 4} text-anchor="end">1.2 V</text>
      <text class="tl" x={PL - 6} y={py(0) + 4} text-anchor="end">0</text>
      {#each ticks as t, i (i)}<text class="tl" x={px(t)} y={CH - 8} text-anchor="middle">{ms(t)}</text>{/each}
      {#each traces as tr (tr.label)}
        <path class="line" d={path(tr)} style="stroke:{tr.colour}" />
      {/each}
    </svg>
    <ul class="leg" aria-label="Legend">{#each traces as tr (tr.label)}<li><i style="background:{tr.colour}"></i>{tr.label} (row {tr.row}, column {tr.col})</li>{/each}</ul>
  </div>
</Widget>

<style>
  .dl {
    display: grid;
    gap: 0.7rem;
    padding: 0.8rem 1rem 1rem;
    min-width: 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.6rem;
    align-items: center;
  }
  .temp {
    max-width: 26rem;
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 20rem) minmax(0, 1fr);
    gap: 1rem 1.4rem;
    align-items: start;
  }
  @media (max-width: 48rem) {
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .grid {
    width: 100%;
    height: auto;
    display: block;
    font-family: var(--font-mono);
  }
  .rn {
    font-size: 10px;
    fill: var(--mute);
  }
  .fl {
    fill: color-mix(in srgb, var(--sig-high) 12%, transparent);
    stroke: var(--sig-high);
    stroke-width: 1;
  }
  .box {
    fill: var(--panel);
    stroke: var(--line-strong);
    stroke-width: 1.2;
  }
  .fill {
    opacity: 0.8;
  }
  .lim {
    stroke: var(--sig-x);
    stroke-width: 1;
    stroke-dasharray: 2 3;
    opacity: 0.8;
  }
  .bit {
    font-size: 13px;
    font-weight: 700;
    fill: var(--fg);
    paint-order: stroke;
    stroke: var(--panel);
    stroke-width: 3px;
  }
  .c.weak .box {
    stroke: var(--sig-x);
    stroke-width: 1.8;
  }
  .c.bad .box {
    stroke: var(--sig-x);
    stroke-width: 2;
    fill: color-mix(in srgb, var(--sig-x) 12%, var(--panel));
  }
  .c.bad .bit {
    fill: var(--sig-x);
  }
  .nums {
    margin: 0;
    display: grid;
    gap: 0.25rem;
  }
  .nums div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--line);
    padding: 0.15rem 0;
    font-size: 0.85rem;
  }
  .nums dt {
    color: var(--mute);
  }
  .nums dd {
    margin: 0;
    font-family: var(--font-mono);
    font-weight: 600;
  }
  .nums .bad dd {
    color: var(--sig-x);
  }
  .hint {
    margin: 0.5rem 0 0;
    font-size: 0.78rem;
    color: var(--mute);
    line-height: 1.45;
  }
  .chart {
    width: 100%;
    max-width: 38rem;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    font-family: var(--font-mono);
  }
  .leg {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1.1rem;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .leg i {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    margin-right: 0.35rem;
    vertical-align: -1px;
  }
  .ax {
    stroke: var(--line-strong);
  }
  .tl {
    font-size: 12px;
    fill: var(--mute);
  }
  .line {
    fill: none;
    stroke-width: 1.8;
    stroke-linejoin: round;
  }
</style>
