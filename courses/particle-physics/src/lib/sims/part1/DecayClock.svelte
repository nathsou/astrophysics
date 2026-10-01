<!--
  The decay clock: N identical unstable particles, each with the same constant chance per unit time of decaying. One slider sets the mean
  lifetime τ, and the width Γ = ħ/τ follows. Decay times are drawn by inverse transform from a seeded generator; each decay picks its mode
  from the branching ratios. Optional Geiger clicks (off by default, remembered under 'particle-physics:sound'): one click per decay, at most
  a few per frame.

    ::decay-clock{n="3.1" caption="…" preset="mu" count=300 seed=11}

  This is a simulation of a random process with the real lifetimes and branching ratios of the particle table, not a recording.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { rng } from '$lib/hep/random';
  import { formatTime } from '$lib/hep/units';
  import { Geiger, readSoundPreference, writeSoundPreference } from '$lib/sims/chambers/audio';
  import { PRESETS, decayedBy, formatWidth, lifetimeEstimate, sampleDecays, widthOf } from './decay';

  let { preset = 'mu', count = 300, seed: seed0 = 11, n, caption, title = 'The decay clock' }: { preset?: string; count?: number; seed?: number; n?: string | number; caption?: string; title?: string } = $props();

  const T_MAX = 6; // in units of τ
  const MODE_COLOURS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];

  let presetId = $state(untrack(() => preset));
  let logTau = $state(untrack(() => Math.log10(PRESETS.find((p) => p.id === preset)?.tauS ?? 2.2e-6)));
  let N = $state(untrack(() => count));
  let seed = $state(untrack(() => seed0));
  let t = $state(1); // time in units of τ
  let playing = $state(false);
  let logY = $state(false);
  let sound = $state(false);
  let speed = 0.5; // τ per second of real time

  const current = $derived(PRESETS.find((p) => p.id === presetId));
  const tauS = $derived(current ? current.tauS : 10 ** logTau);
  const gammaGeV = $derived(current ? current.widthGeV : widthOf(10 ** logTau));
  const modes = $derived(current ? current.modes : [{ label: 'decay', br: 1 }]);
  const weights = $derived(modes.map((m) => m.br));
  const run = $derived(sampleDecays(rng(seed), N, 1, weights));
  const k = $derived(decayedBy(run.t, t));
  const est = $derived(lifetimeEstimate(run.t, t));

  const preferReduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const geiger = new Geiger();
  onMount(() => {
    sound = readSoundPreference();
    return () => {
      playing = false;
      geiger.close();
    };
  });
  function setSound(on: boolean) {
    if (on && !geiger.enable()) {
      sound = false;
      return;
    }
    writeSoundPreference(on);
  }

  function pick(id: string) {
    presetId = id;
    const p = PRESETS.find((x) => x.id === id);
    if (p) logTau = Math.log10(p.tauS);
  }
  function onTau(v: number) {
    presetId = 'custom';
    logTau = v;
  }
  function reroll() {
    seed += 1;
    t = 0;
  }

  // animation
  let last = 0;
  let raf = 0;
  function frame(now: number) {
    if (!playing) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const t0 = t;
    t = Math.min(T_MAX, t + speed * dt);
    if (sound) {
      const a = decayedBy(run.t, t0);
      const b = decayedBy(run.t, t);
      const span = Math.max(1e-9, t - t0);
      for (let i = a; i < Math.min(b, a + 4); i++) {
        const delay = ((run.t[i]! - t0) / span) * dt * 1000;
        setTimeout(() => geiger.click(), delay);
      }
    }
    if (t >= T_MAX) playing = false;
    else raf = requestAnimationFrame(frame);
  }
  function toggle() {
    if (playing) {
      playing = false;
      return;
    }
    if (t >= T_MAX) t = 0;
    if (sound) geiger.enable();
    playing = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  $effect(() => () => cancelAnimationFrame(raf));

  // the grid of particles
  const GW = 560;
  const cols = $derived(Math.max(1, Math.ceil(Math.sqrt(N * 1.6))));
  const rows = $derived(Math.ceil(N / cols));
  const cell = $derived(GW / cols);
  const size = $derived(Math.max(1.2, cell * 0.68));
  const GH = $derived(Math.ceil(rows * cell));
  const pathOf = (idx: number[]): string => {
    let d = '';
    for (const i of idx) {
      const x = (i % cols) * cell + (cell - size) / 2;
      const y = Math.floor(i / cols) * cell + (cell - size) / 2;
      d += `M${x.toFixed(1)} ${y.toFixed(1)}h${size.toFixed(1)}v${size.toFixed(1)}h${(-size).toFixed(1)}z`;
    }
    return d;
  };
  // particles are laid out in a fixed shuffled order, so the decays are scattered over the grid
  const order = $derived.by(() => {
    const r = rng(seed ^ 0x9e37);
    const a = Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a; // a[slot] = which particle sits in the slot
  });
  const gridPaths = $derived.by(() => {
    const alive: number[] = [];
    const dead: number[][] = modes.map(() => []);
    for (let s = 0; s < N; s++) {
      const p = order[s]!;
      // particle p decays at the time with sorted index rank[p]; we lay the particles out by sorted index
      if (p < k) dead[run.mode[p]!]!.push(s);
      else alive.push(s);
    }
    return { alive: pathOf(alive), dead: dead.map(pathOf) };
  });

  // survival curve
  const grid = Array.from({ length: 241 }, (_, i) => (T_MAX * i) / 240);
  const observed = $derived(grid.map((x) => ({ x, y: N - decayedBy(run.t, x) })));
  const shown = $derived(observed.filter((p) => p.x <= t + 1e-9));
  const yDomain = $derived<[number, number]>(logY ? [0.5, N * 1.3] : [0, N * 1.05]);
  const modeCounts = $derived.by(() => {
    const c = modes.map(() => 0);
    for (let i = 0; i < k; i++) c[run.mode[i]!]!++;
    return c;
  });
  const brSum = $derived(weights.reduce((a, b) => a + b, 0));

  // the ruler: log τ from 10⁻²⁵ to 10⁻⁵ s
  const R_LO = -25.5, R_HI = -5;
  const rx = (lt: number) => ((lt - R_LO) / (R_HI - R_LO)) * 100;
  const fmtE = (v: number) => (v === 0 ? '0' : (v < 0 ? '−' : '+') + formatWidth(Math.abs(v)));
  const bwX = $derived<[number, number]>([-2.5 * gammaGeV, 2.5 * gammaGeV]);
</script>

<Widget {title} subtitle="Every particle has the same chance per unit time of decaying. Lifetime τ and width Γ are one number." {n} {caption} kind="Simulation" onreset={() => { pick(preset); N = count; seed = seed0; t = 1; playing = false; }}>
  {#snippet controls()}
    <div class="ui presets" role="group" aria-label="Particle presets">
      {#each PRESETS as p}
        <button type="button" class:on={presetId === p.id} onclick={() => pick(p.id)} aria-pressed={presetId === p.id}>{p.label}</button>
      {/each}
    </div>
    <Slider bind:value={logTau} min={-25.5} max={-5} step={0.05} label="Mean lifetime τ" oninput={onTau} format={() => formatTime(tauS)} />
    <Slider bind:value={N} min={20} max={3000} step={10} log label="Particles N" oninput={(v) => (N = Math.round(v))} format={(v) => Math.round(v).toString()} />
    <Toggle bind:checked={sound} onchange={setSound} label="Geiger clicks (off by default)" />
  {/snippet}

  <div class="readouts ui" aria-live="polite">
    <div><span class="k">τ</span><strong>{formatTime(tauS)}</strong></div>
    <div><span class="k">Γ = ħ/τ</span><strong>{formatWidth(gammaGeV)}</strong></div>
    <div><span class="k">half-life τ ln 2</span><strong>{formatTime(tauS * Math.LN2)}</strong></div>
    <div><span class="k">light travels cτ</span><strong>{tauS * 299792458 >= 1 ? `${(tauS * 299792458).toPrecision(3)} m` : tauS * 299792458 >= 1e-3 ? `${(tauS * 299792458 * 1e3).toPrecision(3)} mm` : `${(tauS * 299792458 * 1e15).toPrecision(3)} fm`}</strong></div>
  </div>

  <div class="ruler ui" aria-hidden="true">
    <div class="axis">
      {#each [-24, -21, -18, -15, -12, -9, -6] as e}
        <span class="tick" style:left="{rx(e)}%">10<sup>{e}</sup> s</span>
      {/each}
    </div>
    <div class="bar">
      {#each PRESETS as p}
        <span class="dot" class:on={presetId === p.id} style:left="{rx(Math.log10(p.tauS))}%" title="{p.label}: τ = {formatTime(p.tauS)}"></span>
        <span class="plabel" class:on={presetId === p.id} style:left="{rx(Math.log10(p.tauS))}%">{p.label}</span>
      {/each}
      <span class="cursor" style:left="{rx(logTau)}%"></span>
    </div>
    <div class="axis low">
      {#each [-24, -21, -18, -15, -12, -9, -6] as e}
        <span class="tick" style:left="{rx(e)}%">{formatWidth(widthOf(10 ** e))}</span>
      {/each}
    </div>
  </div>

  <div class="panes">
    <div class="pane">
      <h5 class="ui">{N} particles at t = {(t).toFixed(2)} τ ({t === 0 ? '0 s' : formatTime(t * tauS)})</h5>
      <svg viewBox="0 0 {GW} {GH}" role="img" aria-label="{N - k} of {N} particles have not decayed at t = {t.toFixed(2)} lifetimes; {k} have decayed" class="grid">
        <path d={gridPaths.alive} fill="var(--fg)" opacity="0.85" />
        {#each gridPaths.dead as d, i}
          <path {d} fill={MODE_COLOURS[i % MODE_COLOURS.length]} opacity="0.75" />
        {/each}
      </svg>
      <div class="ui legend">
        <span><i style:background="var(--fg)"></i>not yet decayed: {N - k}</span>
        {#each modes as m, i}
          {#if modes.length > 1}<span><i style:background={MODE_COLOURS[i % MODE_COLOURS.length]}></i>{m.label}: {modeCounts[i]}</span>{/if}
        {/each}
        {#if modes.length === 1}<span><i style:background={MODE_COLOURS[0]}></i>decayed: {k}</span>{/if}
      </div>
    </div>

    <div class="pane">
      <h5 class="ui">Survivors N(t) against the expectation N₀ e<sup>−t/τ</sup></h5>
      <Plot
        label="Number of surviving particles against time in units of the mean lifetime: the simulated steps follow the exponential curve"
        x={{ domain: [0, T_MAX], label: 't / τ', ticks: 6 }}
        y={{ type: logY ? 'log' : 'linear', domain: yDomain, label: 'particles left', ticks: 5 }}
        height={230}
      >
        {#snippet marks({ sx, sy })}
          <path d={grid.map((x, i) => `${i ? 'L' : 'M'}${sx(x)} ${sy(Math.max(yDomain[0], N * Math.exp(-x)))}`).join('')} fill="none" stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="5 4" />
          {#if shown.length > 1}
            <path d={shown.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)} ${sy(Math.max(yDomain[0], p.y))}`).join('')} fill="none" stroke="var(--sig-high)" stroke-width="2.2" stroke-linejoin="round" />
          {/if}
          <line x1={sx(t)} x2={sx(t)} y1="0" y2={sy(yDomain[0])} stroke="var(--track)" stroke-width="1" />
          <line x1={sx(1)} x2={sx(1)} y1="0" y2={sy(yDomain[0])} stroke="var(--line-strong)" stroke-dasharray="2 3" />
        {/snippet}
      </Plot>
      <div class="ui small">Dashed: N₀ e<sup>−t/τ</sup>. On the log axis it is a straight line of slope −1/τ. The dotted line marks t = τ, where e⁻¹ = 37 % are left.</div>
    </div>
  </div>

  <div class="ui row">
    <Button variant="primary" onclick={toggle}>{playing ? 'Pause' : t >= T_MAX ? 'Run again' : 'Run'}</Button>
    <Button onclick={reroll}>New seed</Button>
    <div class="scrub"><Slider bind:value={t} min={0} max={T_MAX} step={0.01} label="Time t / τ" format={(v) => v.toFixed(2)} oninput={() => (playing = false)} /></div>
    <Toggle bind:checked={logY} label="Log scale" />
  </div>

  <div class="panes low">
    <div class="pane">
      <h5 class="ui">Measuring τ from what has been seen</h5>
      <p class="ui small" aria-live="polite">
        After {(t).toFixed(2)} τ, {k} decays: total watching time per decay gives
        {#if k > 0}<strong>τ̂ = {est.tau.toFixed(2)} ± {est.err.toFixed(2)}</strong> in units of the true τ = 1 ({Math.abs(est.tau - 1) <= est.err ? 'within one error' : `${(Math.abs(est.tau - 1) / est.err).toFixed(1)} errors away`}){:else}nothing yet{/if}.
        The error is τ̂/√k: a precision of 1 % needs about 10,000 decays. Seed {seed}.
      </p>
      {#if modes.length > 1}
        <div class="bars ui" role="img" aria-label="Number of decays in each mode against the branching ratio">
          {#each modes as m, i}
            {@const exp = (m.br / brSum) * k}
            <div class="brow">
              <span class="bl">{m.label}</span>
              <span class="bt"><i style:width="{Math.min(100, (modeCounts[i]! / Math.max(1, N * (m.br / brSum) * 1.4 + 3)) * 100)}%" style:background={MODE_COLOURS[i % MODE_COLOURS.length]}></i><b style:left="{Math.min(100, (exp / Math.max(1, N * (m.br / brSum) * 1.4 + 3)) * 100)}%"></b></span>
              <span class="bv">{modeCounts[i]} <small>(BR {(100 * m.br).toFixed(m.br < 0.01 ? 3 : 2)} %)</small></span>
            </div>
          {/each}
        </div>
        <div class="ui small">Bars: decays so far in each mode. Tick: the expectation from the branching ratio. Each decay chooses its mode at random.</div>
      {/if}
    </div>
    <div class="pane">
      <h5 class="ui">The same number as a line shape</h5>
      <Plot
        label="Breit–Wigner line shape with full width at half maximum equal to the width Γ = ħ/τ"
        x={{ domain: bwX, label: 'E − M (axis scaled to Γ)', format: fmtE, tickValues: [-gammaGeV, 0, gammaGeV] }}
        y={{ domain: [0, 1.1], label: 'relative rate', ticks: 4 }}
        height={190}
        crosshair={false}
      >
        {#snippet marks({ sx, sy })}
          <path d={Array.from({ length: 121 }, (_, i) => { const e = bwX[0] + ((bwX[1] - bwX[0]) * i) / 120; return `${i ? 'L' : 'M'}${sx(e)} ${sy(1 / (1 + (2 * e / gammaGeV) ** 2))}`; }).join('')} fill="none" stroke="var(--series-1)" stroke-width="2.2" />
          <line x1={sx(-gammaGeV / 2)} x2={sx(gammaGeV / 2)} y1={sy(0.5)} y2={sy(0.5)} stroke="var(--bad)" stroke-width="2" />
          <text x={sx(gammaGeV / 2) + 6} y={sy(0.5) - 6} fill="var(--bad)" font-size="11">FWHM = Γ</text>
        {/snippet}
      </Plot>
      <div class="ui small">A short life is a wide line: Γ = ħ/τ = {formatWidth(gammaGeV)}. The shape is the same at every Γ, so the axis is scaled to it; read the tick labels.</div>
    </div>
  </div>
</Widget>

<style>
  .presets {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .presets button {
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    border-radius: 6px;
    padding: 0.25rem 0.65rem;
    font-size: 0.82rem;
    cursor: pointer;
    font-family: var(--font-ui);
  }
  .presets button.on {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
  }
  .presets button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .readouts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.5rem;
    margin-bottom: 0.7rem;
  }
  .readouts div {
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--pn);
    padding: 0.35rem 0.6rem;
    display: flex;
    flex-direction: column;
  }
  .k {
    font-size: 0.7rem;
    color: var(--mute);
    text-transform: none;
    letter-spacing: 0;
  }
  strong {
    font-family: var(--font-mono);
    font-size: 0.92rem;
  }
  .ruler {
    position: relative;
    margin: 0.2rem 1.2rem 1.6rem;
    height: 4.2rem;
  }
  .axis,
  .bar {
    position: relative;
    height: 1rem;
  }
  .axis .tick {
    position: absolute;
    transform: translateX(-50%);
    font-size: 0.62rem;
    color: var(--mute);
    white-space: nowrap;
  }
  .axis.low {
    margin-top: 1.5rem;
  }
  .bar {
    border-top: 2px solid var(--line-strong);
    margin-top: 0.15rem;
    height: 1.3rem;
  }
  .dot {
    position: absolute;
    top: -6px;
    width: 10px;
    height: 10px;
    margin-left: -5px;
    border-radius: 50%;
    background: var(--ink-3);
  }
  .dot.on {
    background: var(--sig-high);
  }
  .plabel {
    position: absolute;
    top: 7px;
    transform: translateX(-50%);
    font-size: 0.7rem;
    color: var(--ink-2);
    white-space: nowrap;
  }
  .cursor {
    position: absolute;
    top: -12px;
    width: 2px;
    height: 24px;
    margin-left: -1px;
    background: var(--track);
  }
  .panes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
    gap: 1rem;
    align-items: start;
  }
  .panes.low {
    margin-top: 0.8rem;
  }
  .pane {
    min-width: 0;
  }
  h5 {
    margin: 0 0 0.3rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--ink-2);
  }
  .grid {
    width: 100%;
    height: auto;
    background: var(--chart-surface);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.9rem;
    font-size: 0.74rem;
    color: var(--ink-2);
    margin-top: 0.3rem;
  }
  .legend i {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    margin-right: 0.3rem;
    vertical-align: -1px;
    border-radius: 2px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem 1rem;
    align-items: flex-end;
    margin-top: 0.8rem;
  }
  .scrub {
    flex: 1 1 14rem;
  }
  .small {
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.45;
    margin: 0.3rem 0 0;
  }
  .bars {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.4rem;
  }
  .brow {
    display: grid;
    grid-template-columns: 7.5rem 1fr 8rem;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.76rem;
  }
  .bt {
    position: relative;
    height: 0.8rem;
    background: var(--pn);
    border-radius: 3px;
  }
  .bt i {
    display: block;
    height: 100%;
    border-radius: 3px;
  }
  .bt b {
    position: absolute;
    top: -2px;
    width: 2px;
    height: calc(100% + 4px);
    background: var(--fg);
  }
  .bv small {
    color: var(--mute);
  }
  @media (max-width: 560px) {
    .axis .tick:nth-child(even) {
      display: none;
    }
    .plabel:not(.on) {
      display: none;
    }
    .ruler {
      margin-left: 0.6rem;
      margin-right: 0.6rem;
    }
  }
  @media (max-width: 520px) {
    .brow {
      grid-template-columns: 5.5rem 1fr 6.5rem;
    }
  }
</style>
