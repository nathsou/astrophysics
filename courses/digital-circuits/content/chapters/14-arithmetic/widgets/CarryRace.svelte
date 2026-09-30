<!--
  The carry race. A ripple-carry adder and a carry-lookahead adder, both built gate by gate on the digital engine with
  a 1 ns delay per gate, add the same two numbers. Every output is recorded, so the time slider (or Play) shows the
  sum at any moment: red is an output that still shows the wrong value. The chart below shows the longest path
  through each adder as the width grows from 4 to 16 bits, which is where the race is decided.

    ::carry-race{n="14.5" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { prefersReducedMotion } from '$lib/theme/signals';
  import { buildAdder, measure, sweep, valueAt, worstCase, type Adder, type AdderKind, type Measurement } from './carry';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  let width = $state(8);
  let preset = $state<'worst' | 'quiet' | 'random'>('worst');
  let seed = $state(7);
  let t = $state(0);
  let playing = $state(false);
  let mult = $state(1);
  let reduced = $state(false);
  let root: HTMLDivElement | undefined = $state();

  const cache = new Map<string, Adder>();
  const adderFor = (kind: AdderKind, w: number): Adder => {
    const key = `${kind}${w}`;
    let a = cache.get(key);
    if (!a) cache.set(key, (a = buildAdder(kind, w)));
    return a;
  };
  const rnd = (s: number) => {
    let x = (s * 2654435761) >>> 0;
    x = (Math.imul(x ^ (x >>> 15), 2246822519) >>> 0) ^ (x >>> 13);
    return (x >>> 0) / 4294967296;
  };
  const operands = $derived.by((): [number, number] => {
    const m = 2 ** width - 1;
    if (preset === 'worst') return worstCase(width);
    if (preset === 'quiet') {
      const a = Math.floor(m / 3);
      return [a, m - a];
    }
    return [Math.floor(rnd(seed) * (m + 1)), Math.floor(rnd(seed + 1000) * (m + 1))];
  });
  const [a, b] = $derived(operands);

  const mr = $derived(measure('ripple', width, a, b, adderFor('ripple', width)));
  const ml = $derived(measure('lookahead', width, a, b, adderFor('lookahead', width)));
  const ar = $derived(adderFor('ripple', width));
  const al = $derived(adderFor('lookahead', width));
  const T = $derived(Math.max(8, Math.ceil(Math.max(mr.settleNs, ml.settleNs)) + 3));
  const pts = sweep(4, 16);
  const here = $derived(pts.find((p) => p.n === width)!);

  const hexDigits = $derived(Math.ceil((width + 1) / 4));
  const hex = (v: number) => v.toString(16).toUpperCase().padStart(hexDigits, '0');
  const settled = (m: Measurement) => (t >= m.settleNs - 1e-9 ? 'settled' : 'still changing');

  // Waveform geometry.
  const W = 420;
  const X0 = 40;
  const X1 = W - 8;
  const ROW = $derived(width > 12 ? 10 : 12);
  const AXIS = 20;
  const px = (ns: number) => X0 + (Math.min(ns, T) / T) * (X1 - X0);

  interface RowPaths {
    name: string;
    hi: string;
    lo: string;
    wrong: string;
    edges: string;
  }
  function paths(m: Measurement): RowPaths[] {
    return m.rows.map((row, j) => {
      const top = j * ROW + 3;
      const yHi = top + 1.5;
      const yLo = top + ROW - 4;
      const fin = row[row.length - 1] === 1 ? 1 : 0;
      let hi = '';
      let lo = '';
      let wrong = '';
      let edges = '';
      for (let i = 0; i < row.length; i++) {
        const v = row[i] === 1 ? 1 : 0;
        const x1 = px(m.t[i]!);
        const x2 = px(i + 1 < row.length ? m.t[i + 1]! : T);
        const y = v ? yHi : yLo;
        const seg = `M${x1.toFixed(1)} ${y}H${x2.toFixed(1)}`;
        if (v !== fin) wrong += seg;
        else if (v) hi += seg;
        else lo += seg;
        if (i + 1 < row.length && (row[i + 1] === 1 ? 1 : 0) !== v) edges += `M${x2.toFixed(1)} ${yHi}V${yLo}`;
      }
      return { name: m.names[j]!, hi, lo, wrong, edges };
    });
  }
  const pathsR = $derived(paths(mr));
  const pathsL = $derived(paths(ml));

  const ticks = $derived.by(() => {
    const step = T <= 12 ? 2 : T <= 30 ? 5 : 10;
    return Array.from({ length: Math.floor(T / step) + 1 }, (_, i) => i * step);
  });

  // Chart geometry.
  const CW = 420;
  const CH = 200;
  const CX0 = 44;
  const CX1 = CW - 16;
  const CY0 = 16;
  const CY1 = CH - 30;
  const YMAX = 32;
  const cx = (w: number) => CX0 + ((w - 4) / 12) * (CX1 - CX0);
  const cy = (ns: number) => CY1 - (ns / YMAX) * (CY1 - CY0);
  const line = (key: 'ripple' | 'lookahead') => pts.map((p, i) => `${i ? 'L' : 'M'}${cx(p.n).toFixed(1)} ${cy(p[key]).toFixed(1)}`).join('');

  function setPreset(p: 'worst' | 'quiet' | 'random') {
    preset = p;
    t = 0;
  }
  function setWidth(v: number) {
    width = Math.round(v);
    t = 0;
  }
  function again() {
    seed += 1;
    preset = 'random';
    t = 0;
  }
  function play() {
    if (t >= T - 0.05) t = 0;
    playing = !playing;
  }
  function reset() {
    width = 8;
    preset = 'worst';
    t = 0;
    playing = false;
  }

  onMount(() => {
    reduced = prefersReducedMotion();
    if (!root) return;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(root);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playing && visible && !document.hidden) {
        t = Math.min(T, t + dt * 4 * mult);
        if (t >= T) playing = false;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  });

  const stateText = (m: Measurement) => {
    const v = valueAt(m, t);
    return { v, ok: v === m.expected };
  };
  const sr = $derived(stateText(mr));
  const sl = $derived(stateText(ml));
</script>

{#snippet panel(title: string, m: Measurement, ad: Adder, ps: RowPaths[], st: { v: number; ok: boolean }, note: string)}
  <section class="pn" aria-label={title}>
    <header class="ui">
      <h5>{title}</h5>
      <p class="meta">{ad.gates} gates · longest path {ad.depth} ns · {note}</p>
      <p class="read" role="status" class:ok={st.ok}>
        Sum at {t.toFixed(1)} ns: <b>0x{hex(st.v)}</b>
        <span class="verdict">{st.ok ? 'correct' : 'wrong'} · {settled(m)}</span>
      </p>
    </header>
    <svg viewBox="0 0 {W} {m.rows.length * ROW + AXIS}" role="img" aria-label="{title}: waveforms of the sum bits and the carry out for {m.a} + {m.b}. The last output changes at {m.settleNs} nanoseconds.">
      {#each ticks as tk (tk)}
        <line class="grid" x1={px(tk)} x2={px(tk)} y1="0" y2={m.rows.length * ROW + 2} />
        <text class="tk" x={px(tk)} y={m.rows.length * ROW + 14} text-anchor="middle">{tk}</text>
      {/each}
      <text class="tk" x={X1} y={m.rows.length * ROW + 14} text-anchor="end" aria-hidden="true">ns</text>
      {#each ps as r, j (r.name)}
        <text class="nm" x={X0 - 5} y={j * ROW + ROW / 2 + 3} text-anchor="end">{r.name}</text>
        <path class="edge" d={r.edges} />
        <path class="lo" d={r.lo} />
        <path class="hi" d={r.hi} />
        <path class="wrong" d={r.wrong} />
      {/each}
      <line class="now" x1={px(t)} x2={px(t)} y1="0" y2={m.rows.length * ROW + 2} />
    </svg>
  </section>
{/snippet}

<Widget title="Carry race" subtitle="Ripple carry against carry lookahead, gate by gate" {caption} n={fig} onreset={reset}>
  {#snippet controls()}
    <Slider label="Width in bits" bind:value={width} min={4} max={16} step={1} format={(v) => `${Math.round(v)}`} oninput={setWidth} />
    <Segmented
      size="sm"
      label="Numbers to add"
      value={preset}
      onchange={setPreset}
      options={[
        { value: 'worst', label: 'All ones + 1', title: 'The carry has to pass through every bit' },
        { value: 'quiet', label: 'No carries', title: 'Every column adds 0 + 1 or 1 + 0: no carry is ever made' },
        { value: 'random', label: 'Random' },
      ]}
    />
    {#if preset === 'random'}<Button size="sm" onclick={again}>Another pair</Button>{/if}
  {/snippet}

  <div class="cr" bind:this={root}>
    <p class="sum ui">
      <b>{a}</b> + <b>{b}</b> = <b>{a + b}</b> <span class="mute">(0x{hex(a)} + 0x{hex(b)} = 0x{hex(a + b)}, {width} bits and a carry out)</span>
    </p>

    <div class="panels">
      {@render panel('Ripple carry', mr, ar, pathsR, sr, 'each carry waits for the one before')}
      {@render panel('Carry lookahead', ml, al, pathsL, sl, 'all carries from a prefix tree')}
    </div>

    <div class="clock ui">
      <Button size="sm" variant={playing ? 'primary' : 'secondary'} onclick={play} disabled={reduced} title={reduced ? 'Automatic playback is off because you asked your system for reduced motion: drag the time slider' : undefined}>{playing ? 'Pause' : 'Play'}</Button>
      <Button size="sm" onclick={() => { t = 0; playing = false; }}>Back to 0</Button>
      <Segmented size="sm" label="Playback speed" bind:value={mult} options={[{ value: 0.5, label: '½×' }, { value: 1, label: '1×' }, { value: 2, label: '2×' }]} />
      <div class="scrub"><Slider label="Time" bind:value={t} min={0} max={T} step={0.1} format={(v) => `${v.toFixed(1)} ns`} oninput={() => (playing = false)} /></div>
    </div>
    <p class="legend ui">Amber: an output that is 1, and right. Slate: 0, and right. <span class="red">Red: an output that shows the wrong value for the sum</span>, because a carry has not reached it yet. Each gate takes 1 ns.</p>

    <figure class="chart">
      <svg viewBox="0 0 {CW} {CH}" role="img" aria-label="Longest path through the adder in nanoseconds against width in bits, for {pts.length} widths. The ripple adder grows in a straight line, from {pts[0]!.ripple} ns at 4 bits to {pts.at(-1)!.ripple} ns at 16; the lookahead adder from {pts[0]!.lookahead} to {pts.at(-1)!.lookahead} ns.">
        {#each [0, 8, 16, 24, 32] as y (y)}
          <line class="grid" x1={CX0} x2={CX1} y1={cy(y)} y2={cy(y)} />
          <text class="tk" x={CX0 - 6} y={cy(y) + 3} text-anchor="end">{y}</text>
        {/each}
        {#each [4, 6, 8, 10, 12, 14, 16] as w (w)}
          <text class="tk" x={cx(w)} y={CY1 + 14} text-anchor="middle">{w}</text>
        {/each}
        <text class="axis" x={(CX0 + CX1) / 2} y={CH - 4} text-anchor="middle">bits</text>
        <text class="axis" x="10" y={CY0 - 4} text-anchor="start">ns</text>
        <line class="here" x1={cx(width)} x2={cx(width)} y1={CY0} y2={CY1} />
        <path class="ln rip" d={line('ripple')} />
        <path class="ln look" d={line('lookahead')} />
        {#each pts as p (p.n)}
          <circle class="dot rip" cx={cx(p.n)} cy={cy(p.ripple)} r={p.n === width ? 4.5 : 2.3} />
          <circle class="dot look" cx={cx(p.n)} cy={cy(p.lookahead)} r={p.n === width ? 4.5 : 2.3} />
        {/each}
        <circle class="meas" cx={cx(width)} cy={cy(mr.settleNs)} r="6.5" />
        <circle class="meas" cx={cx(width)} cy={cy(ml.settleNs)} r="6.5" />
        <text class="lab rip" x={Math.min(cx(width) + 8, CX1 - 40)} y={cy(here.ripple) - 8} text-anchor="start">ripple {here.ripple} ns</text>
        <text class="lab look" x={Math.min(cx(width) + 8, CX1 - 62)} y={cy(here.lookahead) + 20} text-anchor="start">lookahead {here.lookahead} ns</text>
      </svg>
      <figcaption class="ui">
        Longest path through each adder, from any input to any output. The rings mark what these particular numbers took ({mr.settleNs} ns and {ml.settleNs} ns). At {width} bits the lookahead adder has <b>{here.lookaheadGates}</b> gates against the ripple adder’s <b>{here.rippleGates}</b>.
      </figcaption>
    </figure>
  </div>
</Widget>

<style>
  .cr {
    display: grid;
    gap: 0.9rem;
  }
  .sum {
    margin: 0;
    text-align: center;
    font-size: 0.9rem;
    color: var(--ink-2);
  }
  .sum b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .mute {
    color: var(--mute);
    font-size: 0.8rem;
  }
  .panels {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem 1.2rem;
  }
  @media (max-width: 52rem) {
    .panels {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .pn {
    min-width: 0;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.6rem 0.7rem 0.4rem;
    background: var(--pn);
  }
  h5 {
    margin: 0;
    font-size: 0.95rem;
  }
  .meta {
    margin: 0.1rem 0 0.35rem;
    font-size: 0.74rem;
    color: var(--mute);
  }
  .read {
    margin: 0 0 0.3rem;
    font-size: 0.84rem;
    color: var(--bad);
  }
  .read.ok {
    color: var(--ok);
  }
  .read b {
    font-family: var(--font-mono);
  }
  .verdict {
    font-size: 0.76rem;
    margin-left: 0.4rem;
    color: var(--mute);
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    font-family: var(--font-mono);
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }
  .tk {
    font-size: 8.5px;
    fill: var(--mute);
  }
  .axis {
    font-size: 9px;
    fill: var(--mute);
    font-family: var(--font-ui);
  }
  .nm {
    font-size: 8px;
    fill: var(--ink-2);
  }
  .edge {
    stroke: var(--sig-low);
    stroke-width: 0.8;
    fill: none;
    opacity: 0.55;
  }
  .lo,
  .hi,
  .wrong {
    fill: none;
    stroke-linecap: butt;
  }
  .lo {
    stroke: var(--sig-low);
    stroke-width: 1.3;
  }
  .hi {
    stroke: var(--sig-high);
    stroke-width: 2.2;
  }
  .wrong {
    stroke: var(--sig-x);
    stroke-width: 2.2;
  }
  .now {
    stroke: var(--copper);
    stroke-width: 1.5;
    stroke-dasharray: 3 2;
  }
  .clock {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 0.9rem;
  }
  .scrub {
    flex: 1 1 14rem;
    min-width: 0;
  }
  .legend {
    margin: 0;
    font-size: 0.78rem;
    color: var(--mute);
    line-height: 1.5;
  }
  .red {
    color: var(--sig-x);
  }
  .chart {
    margin: 0;
    max-width: 34rem;
    justify-self: center;
    width: 100%;
  }
  .chart figcaption {
    font-size: 0.78rem;
    color: var(--mute);
    line-height: 1.5;
    margin-top: 0.3rem;
  }
  .chart figcaption b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .ln {
    fill: none;
    stroke-width: 2;
  }
  .ln.rip {
    stroke: var(--series-2);
  }
  .ln.look {
    stroke: var(--series-1);
  }
  .dot.rip {
    fill: var(--series-2);
  }
  .dot.look {
    fill: var(--series-1);
  }
  .meas {
    fill: none;
    stroke: var(--fg);
    stroke-width: 1.3;
  }
  .here {
    stroke: var(--line-strong);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .lab {
    font-size: 9.5px;
    font-weight: 700;
  }
  .lab.rip {
    fill: var(--series-2);
  }
  .lab.look {
    fill: var(--series-1);
  }
</style>
