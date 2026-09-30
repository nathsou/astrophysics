<!--
  How a chip remembers its program: three cells you can program.

    ::programming-cells{n="25.6" mode="floating" caption="…"}

  - fuse: a current pulse heats a thin link (model: cells.ts); it melts only if the pulse is strong enough *and*
    long enough, and it cannot be repaired;
  - antifuse: a high voltage punches through a thin insulator and leaves a conducting filament;
  - floating gate: charge trapped on an insulated gate moves the transistor's threshold voltage; ultraviolet light
    or tunnelling takes it away again.

  The numbers are illustrative and round (see cells.ts).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { ANTIFUSE, Antifuse, FUSE, FLOATING_GATE, FloatingGateCell, blowingCurrent, fusePulse, timeToBlow, type FuseSample } from './cells';

  type Mode = 'fuse' | 'antifuse' | 'floating';
  let { n, mode: start = 'fuse', caption }: { n?: string | number; mode?: Mode; caption?: string } = $props();

  // svelte-ignore state_referenced_locally
  let mode = $state<Mode>(start);
  let msg = $state('');

  // ── Fuse ────────────────────────────────────────────────────────────────────────────────────
  let mA = $state(25);
  let us = $state(4);
  let blown = $state(false);
  let trace = $state.raw<FuseSample[]>([]);
  let cursor = $state(0);
  let playing = $state(false);
  let raf = 0;
  const SLOW = 0.5; // real seconds per simulated microsecond
  const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = $derived(trace.length ? trace[Math.min(cursor, trace.length - 1)]! : null);
  const temperature = $derived(now ? now.temperature : FUSE.ambient);
  const glow = $derived(Math.max(0, Math.min(1, (temperature - FUSE.ambient) / (FUSE.melt - FUSE.ambient))));
  const needI = blowingCurrent() * 1000;

  function pulse() {
    if (playing) return;
    if (blown) {
      msg = 'The link is already open, so the pulse has nothing to heat. A blown fuse cannot be repaired.';
      trace = [];
      return;
    }
    trace = fusePulse(mA / 1000, us * 1e-6, { tail: 2 * FUSE.tau });
    cursor = 0;
    const willBlow = trace.some((s) => s.blown);
    const tb = timeToBlow(mA / 1000) * 1e6;
    const finish = () => {
      playing = false;
      cursor = trace.length - 1;
      if (willBlow) {
        blown = true;
        msg = `Blown, ${tb.toFixed(1)} µs into the pulse. The link melted and the current stopped.`;
      } else if (mA < needI) {
        msg = `Intact. ${mA} mA can only warm this link to ${Math.round(Math.max(...trace.map((s) => s.temperature)))} °C: at least ${needI.toFixed(0)} mA is needed, however long the pulse.`;
      } else {
        msg = `Intact. ${mA} mA would melt it, but only after ${tb.toFixed(1)} µs, and the pulse lasted ${us} µs. The link cooled again.`;
      }
    };
    if (reduced()) return finish();
    playing = true;
    msg = 'Pulsing…';
    let t0 = 0;
    const step = (t: number) => {
      if (!t0) t0 = t;
      const sim = ((t - t0) / 1000 / SLOW) * 1e-6; // simulated seconds
      const k = trace.findIndex((s) => s.t >= sim);
      if (k < 0) return finish();
      cursor = k;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function readFuse() {
    msg = blown ? 'Read with 1 mA: no current flows through the open link, so the sense amplifier reads a 1.' : 'Read with 1 mA: the link carries it (0.1 V across 100 Ω) and warms by 6 K. The sense amplifier reads a 0.';
  }

  // ── Antifuse ────────────────────────────────────────────────────────────────────────────────
  let volts = $state(6);
  const af = $state({ programmed: false });
  const anti = new Antifuse();
  function applyVolts() {
    const before = anti.programmed;
    anti.apply(volts);
    af.programmed = anti.programmed;
    msg = before
      ? 'Already programmed: the filament is there for good. More voltage changes nothing useful.'
      : anti.programmed
        ? `${volts} V is above the ${ANTIFUSE.breakdown} V the insulator can stand: it broke down and a filament of metal grew through it. It now conducts, with about ${ANTIFUSE.closed} Ω.`
        : `${volts} V is below the breakdown voltage (${ANTIFUSE.breakdown} V in this model): the insulator holds, nothing changes.`;
  }

  // ── Floating gate ───────────────────────────────────────────────────────────────────────────
  const cell = new FloatingGateCell();
  const fg = $state({ charge: 0, vt: FLOATING_GATE.vtErased, pulses: 0, cycles: 0, reading: null as null | 0 | 1 });
  function sync() {
    fg.charge = cell.charge;
    fg.vt = cell.vt;
    fg.pulses = cell.programPulses;
    fg.cycles = cell.cycles;
  }
  const doProgram = () => {
    cell.program();
    sync();
    fg.reading = null;
    msg = `Pulse ${cell.programPulses}: electrons cross the oxide onto the floating gate, and the threshold rises to ${cell.vt.toFixed(1)} V. Each pulse adds a smaller share than the last.`;
  };
  const doUv = () => {
    cell.uvErase(2.5);
    sync();
    fg.reading = null;
    msg = `2½ minutes of ultraviolet light. Photons lift electrons over the oxide barrier, and the charge falls by 40 %. The threshold is ${cell.vt.toFixed(1)} V.`;
  };
  const doTunnel = () => {
    cell.tunnelErase();
    sync();
    fg.reading = null;
    msg = `An erase pulse: a high voltage of the opposite sign drives the electrons back through the oxide by tunnelling. Cycle ${cell.cycles}; a real cell survives some 10⁴ to 10⁶ of them.`;
  };
  const doRead = () => {
    fg.reading = cell.read();
    msg = cell.read()
      ? `Read with ${FLOATING_GATE.vRead} V on the gate: the threshold is ${cell.vt.toFixed(1)} V, so the transistor conducts and the sense amplifier reads a 1 (erased).`
      : `Read with ${FLOATING_GATE.vRead} V on the gate: the threshold is ${cell.vt.toFixed(1)} V, so the transistor stays off and the sense amplifier reads a 0 (programmed).`;
  };
  const electrons = $derived(Math.round(fg.charge * 14));

  function reset() {
    cancelAnimationFrame(raf);
    playing = false;
    blown = false;
    trace = [];
    cursor = 0;
    anti.programmed = false;
    af.programmed = false;
    cell.charge = 0;
    cell.programPulses = 0;
    cell.cycles = 0;
    sync();
    fg.reading = null;
    msg = '';
  }
  function setMode(m: Mode) {
    if (playing) return;
    mode = m;
    msg = '';
  }
  onMount(() => () => cancelAnimationFrame(raf));

  // Temperature plot.
  const PX0 = 30;
  const PX1 = 290;
  const PY0 = 6;
  const PY1 = 70;
  const TMAX = 1600;
  const span = $derived(Math.max(us * 1e-6 + 3 * FUSE.tau, trace.length ? trace[trace.length - 1]!.t : 0));
  const tx = (t: number) => PX0 + (t / span) * (PX1 - PX0);
  const ty = (T: number) => PY1 - (Math.min(T, TMAX) / TMAX) * (PY1 - PY0);
  const curve = $derived(trace.length ? trace.slice(0, cursor + 1).filter((_, i) => i % 4 === 0 || i === cursor).map((s, i) => `${i ? 'L' : 'M'}${tx(s.t).toFixed(1)} ${ty(s.temperature).toFixed(1)}`).join('') : '');
</script>

<Widget {n} title="How a chip remembers" subtitle="A fuse, an antifuse and a floating-gate cell" {caption} onreset={reset} kind="Interactive">
  {#snippet controls()}
    <Segmented
      label="Cell"
      value={mode}
      onchange={setMode}
      options={[
        { value: 'fuse', label: 'Fuse', title: 'A metal link blown by a current pulse' },
        { value: 'antifuse', label: 'Antifuse', title: 'An insulator punched through by a voltage' },
        { value: 'floating', label: 'Floating gate', title: 'A transistor whose threshold voltage is moved by trapped charge (EPROM, EEPROM, flash)' },
      ]}
    />
  {/snippet}

  <div class="pc">
    {#if mode === 'fuse'}
      <svg viewBox="0 0 420 110" class="cell" role="img" aria-label={blown ? 'A blown fuse: the metal link has a gap' : `A fuse link at ${Math.round(temperature)} degrees Celsius`}>
        <rect class="pad" x="20" y="30" width="110" height="50" rx="3" />
        <rect class="pad" x="290" y="30" width="110" height="50" rx="3" />
        <text class="tx" x="75" y="60" text-anchor="middle">metal</text>
        <text class="tx" x="345" y="60" text-anchor="middle">metal</text>
        {#if blown}
          <path class="link" d="M130 55 H185 L192 48" style:stroke="color-mix(in srgb, var(--sig-high) {Math.round(glow * 100)}%, var(--wire))" />
          <path class="link" d="M290 55 H235 L228 62" style:stroke="color-mix(in srgb, var(--sig-high) {Math.round(glow * 100)}%, var(--wire))" />
          <text class="tx gap" x="210" y="92" text-anchor="middle">gap</text>
        {:else}
          <rect class="neck" x="130" y="50" width="160" height="10" rx="2" style:fill="color-mix(in srgb, var(--sig-high) {Math.round(glow * 100)}%, var(--wire))" style:filter={glow > 0.5 ? `drop-shadow(0 0 ${Math.round(glow * 8)}px var(--sig-high-glow))` : 'none'} />
        {/if}
        <text class="tx" x="210" y="34" text-anchor="middle">{blown ? 'open' : `${Math.round(temperature)} °C`}</text>
        {#if now && now.current > 0}
          <path class="arrow" d="M138 72 H282 M274 67 L282 72 L274 77" />
          <text class="tx" x="210" y="104" text-anchor="middle">{(now.current * 1000).toFixed(0)} mA</text>
        {/if}
      </svg>
      <svg viewBox="0 0 300 92" class="temp" role="img" aria-label="Temperature of the link over the pulse">
        <line class="grid" x1={PX0} x2={PX1} y1={ty(FUSE.melt)} y2={ty(FUSE.melt)} />
        <text class="tick" x={PX0 - 4} y={ty(FUSE.melt) + 3} text-anchor="end">melts</text>
        <rect class="frame" x={PX0} y={PY0} width={PX1 - PX0} height={PY1 - PY0} />
        {#if curve}<path class="ln" d={curve} />{/if}
        <text class="tick" x={PX0} y="86">0</text>
        <text class="tick" x={PX1} y="86" text-anchor="end">{(span * 1e6).toFixed(0)} µs</text>
        <text class="tick" x={PX0 - 4} y={PY1 + 3} text-anchor="end">25 °C</text>
      </svg>
      <div class="ctl">
        <Slider label="Pulse current" bind:value={mA} min={1} max={40} step={1} format={(v) => `${v} mA`} />
        <Slider label="Pulse width" bind:value={us} min={0.5} max={10} step={0.5} format={(v) => `${v} µs`} />
      </div>
      <div class="btns">
        <button type="button" class="go" onclick={pulse} disabled={playing}><Icon name="bolt" size={14} /> Pulse</button>
        <button type="button" onclick={readFuse} disabled={playing}>Read (1 mA)</button>
        <span class="state" class:on={blown}>{blown ? 'BLOWN: reads 1' : 'intact: reads 0'}</span>
      </div>
    {:else if mode === 'antifuse'}
      <svg viewBox="0 0 420 130" class="cell" role="img" aria-label={af.programmed ? 'A programmed antifuse: a filament joins the two plates' : 'An antifuse: two plates with insulator between'}>
        <rect class="pad" x="30" y="14" width="270" height="34" rx="3" />
        <rect class="ins" x="30" y="48" width="270" height="10" />
        <rect class="pad" x="30" y="58" width="270" height="34" rx="3" />
        <text class="tx" x="165" y="35" text-anchor="middle">metal</text>
        <text class="tx" x="165" y="79" text-anchor="middle">metal</text>
        <text class="tx" x="310" y="56" text-anchor="start">thin insulator</text>
        {#if af.programmed}
          <path class="fil" d="M160 48 L168 52 L161 56 L167 58" />
        {/if}
        <text class="tx" x="165" y="115" text-anchor="middle">{af.programmed ? `conducts: about ${ANTIFUSE.closed} Ω` : 'open: more than 1 GΩ'}</text>
      </svg>
      <div class="ctl">
        <Slider label="Programming voltage" bind:value={volts} min={0} max={15} step={0.5} format={(v) => `${v} V`} />
      </div>
      <div class="btns">
        <button type="button" class="go" onclick={applyVolts}><Icon name="bolt" size={14} /> Apply</button>
        <span class="state" class:on={af.programmed}>{af.programmed ? 'PROGRAMMED: connected' : 'virgin: not connected'}</span>
      </div>
    {:else}
      <svg viewBox="0 0 420 200" class="cell" role="img" aria-label="A floating-gate transistor with {electrons} electrons on its floating gate; threshold {fg.vt.toFixed(1)} volts">
        <rect class="pad" x="90" y="16" width="240" height="26" rx="3" />
        <text class="tx" x="210" y="33" text-anchor="middle">control gate</text>
        <rect class="ins" x="90" y="42" width="240" height="14" />
        <rect class="floating" x="110" y="56" width="200" height="32" rx="3" />
        {#each Array.from({ length: electrons }, (_, i) => i) as i (i)}
          <circle class="e" cx={124 + (i % 7) * 27} cy={68 + Math.floor(i / 7) * 14} r="4.5" />
        {/each}
        <text class="tx" x="322" y="76" text-anchor="start">floating gate</text>
        <rect class="ins" x="90" y="88" width="240" height="8" />
        <text class="tx" x="342" y="94" text-anchor="start">oxide</text>
        <rect class="si" x="60" y="96" width="300" height="60" />
        <rect class="n" x="60" y="96" width="60" height="32" />
        <rect class="n" x="300" y="96" width="60" height="32" />
        <text class="tx" x="90" y="116" text-anchor="middle">source</text>
        <text class="tx" x="330" y="116" text-anchor="middle">drain</text>
        <text class="tx" x="210" y="128" text-anchor="middle">channel {fg.reading === 1 ? '(conducting)' : fg.reading === 0 ? '(off)' : ''}</text>
        {#if fg.reading === 1}<path class="cur" d="M96 108 H324 M316 103 L324 108 L316 113" />{/if}
        <g class="vt">
          <line x1="60" x2="360" y1="178" y2="178" />
          {#each [0, 2, 4, 6, 8] as v (v)}
            <line x1={60 + v * 37.5} x2={60 + v * 37.5} y1="174" y2="182" />
            <text class="tick" x={60 + v * 37.5} y="194" text-anchor="middle">{v} V</text>
          {/each}
          <path class="read" d="M{60 + FLOATING_GATE.vRead * 37.5} 166 V186" />
          <text class="tick" x={60 + FLOATING_GATE.vRead * 37.5} y="162" text-anchor="middle">read</text>
          <circle class="mark" cx={60 + fg.vt * 37.5} cy="178" r="5.5" />
          <text class="tick" x="52" y="181" text-anchor="end">Vt</text>
        </g>
      </svg>
      <div class="btns">
        <button type="button" class="go" onclick={doProgram}><Icon name="bolt" size={14} /> Program pulse</button>
        <button type="button" onclick={doUv}>UV light, 2½ min</button>
        <button type="button" onclick={doTunnel}>Erase pulse (tunnelling)</button>
        <button type="button" onclick={doRead}>Read</button>
      </div>
      <div class="btns">
        <span class="state" class:on={fg.reading === 0}>Vt = {fg.vt.toFixed(1)} V · {electrons} electrons · {fg.pulses} program pulses · {fg.cycles} erase cycles{fg.reading === null ? '' : ` · read ${fg.reading}`}</span>
      </div>
    {/if}
    <p class="msg ui" role="status" aria-live="polite">{msg || (mode === 'fuse' ? `Try 10 mA for 10 µs, then 25 mA for 0.5 µs, then 25 mA for 4 µs.` : mode === 'antifuse' ? 'Try 6 V, then 12 V.' : 'Program it with three pulses, read it, then erase it two ways.')}</p>
  </div>
</Widget>

<style>
  .pc {
    display: grid;
    gap: 0.7rem;
    padding: 0.8rem 1rem 1rem;
  }
  .cell {
    display: block;
    width: 100%;
    max-width: 34rem;
    justify-self: center;
    height: auto;
    font-family: var(--font-mono);
  }
  .temp {
    display: block;
    width: 100%;
    max-width: 26rem;
    justify-self: center;
    height: auto;
    font-family: var(--font-mono);
  }
  .pad {
    fill: color-mix(in srgb, var(--wire) 30%, var(--panel));
    stroke: var(--wire);
    stroke-width: 1.5;
  }
  .ins {
    fill: color-mix(in srgb, var(--sig-z, var(--mute)) 30%, var(--panel));
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .neck {
    stroke: var(--wire);
    stroke-width: 1;
    transition: fill 60ms;
  }
  .link {
    fill: none;
    stroke-width: 10;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .fil {
    fill: none;
    stroke: var(--sig-high);
    stroke-width: 3;
    stroke-linecap: round;
    filter: drop-shadow(0 0 3px var(--sig-high-glow));
  }
  .arrow {
    fill: none;
    stroke: var(--sig-current, var(--sig-high));
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .tx {
    fill: var(--ink-2);
    font-size: 10.5px;
  }
  .tx.gap {
    fill: var(--bad);
    font-weight: 600;
  }
  .tick {
    fill: var(--mute);
    font-size: 9px;
  }
  .grid {
    stroke: var(--bad);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }
  .frame {
    fill: none;
    stroke: var(--line-strong);
  }
  .ln {
    fill: none;
    stroke: var(--sig-high);
    stroke-width: 2.2;
    stroke-linejoin: round;
  }
  .floating {
    fill: color-mix(in srgb, var(--sig-high) 12%, var(--panel));
    stroke: var(--sig-high);
    stroke-width: 1.5;
    stroke-dasharray: 5 3;
  }
  .e {
    fill: var(--fx-blue, var(--series-1));
    stroke: var(--panel);
    stroke-width: 1;
  }
  .si {
    fill: color-mix(in srgb, var(--mute) 22%, var(--panel));
    stroke: var(--line-strong);
  }
  .n {
    fill: color-mix(in srgb, var(--copper) 35%, var(--panel));
    stroke: var(--line-strong);
  }
  .cur {
    fill: none;
    stroke: var(--sig-high);
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .vt line {
    stroke: var(--mute);
    stroke-width: 1.2;
  }
  .vt .read {
    stroke: var(--bad);
    stroke-width: 2;
    stroke-dasharray: 3 2;
  }
  .vt .mark {
    fill: var(--copper);
    stroke: var(--panel);
    stroke-width: 1.5;
    transition: cx 300ms;
  }
  .ctl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.4rem 1.2rem;
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.5rem;
    align-items: center;
  }
  .btns button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.75rem;
    min-height: 2rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    font: inherit;
    font-size: 0.84rem;
    cursor: pointer;
  }
  .btns button:hover:not(:disabled) {
    background: var(--pn);
  }
  .btns button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .btns button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .btns .go {
    background: var(--copper-soft);
    border-color: var(--copper);
  }
  .state {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--mute);
    margin-left: 0.2rem;
  }
  .state.on {
    color: var(--sig-high);
    font-weight: 600;
  }
  .msg {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-2);
    min-height: 2.6em;
  }
  @media (prefers-reduced-motion: reduce) {
    .neck,
    .vt .mark {
      transition: none;
    }
  }
</style>
