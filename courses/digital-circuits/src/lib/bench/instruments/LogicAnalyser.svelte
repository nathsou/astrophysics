<!--
  The logic analyser: eight to sixteen channels as timing traces on a dark screen, from engine.watch(), so
  glitches are kept. Digital nets show their four values (HIGH amber, LOW slate, Z dashed, X hatched red);
  analog nets are thresholded like a logic input. Hold freezes the picture; two cursors read the levels and
  the time between them. Protocol decoders plug in through decoders.ts.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Toggle from '../../components/ui/Toggle.svelte';
  import type { Recorder } from '../../sim/engine';
  import { formatSI, logicChar } from '../format';
  import { spans, ticks, voltageToLogic } from '../waves';
  import { FALLBACK, readSignals, type Signals } from '../../theme/signals';
  import Glyph from '../editor/Glyph.svelte';
  import type { Bench } from '../editor/bench.svelte';
  import { getDecoder, decoders } from './decoders';
  import { MAX_ANALYSER_CHANNELS, type AnalyserConfig, type Instrument } from './kinds';
  import { probeLabel, probeNet } from './probes';
  import { indexAtOrBefore, stepLadder } from './scope-math';
  import ProbeButton from './ProbeButton.svelte';
  import Stepper from './Stepper.svelte';

  let { bench, inst }: { bench: Bench; inst: Instrument } = $props();
  const cfg = $derived(inst.config as AnalyserConfig);

  const ROW = 26;
  const AXIS = 22;
  const NAMES = 58;
  let canvas: HTMLCanvasElement | undefined = $state();
  let wrap: HTMLDivElement | undefined = $state();
  let cssW = $state(340);
  const decoder = $derived(getDecoder(cfg.decoder));
  const cssH = $derived(cfg.channels.length * ROW + AXIS + 6 + (decoder ? ROW : 0));
  let sig: Signals = FALLBACK.dark;

  let rec: Recorder | null = null;
  let recMap: number[] = [];
  let frozen = $state<number | null>(null);
  let cursorText = $state({ dt: '', freq: '' });

  $effect(() => {
    const e = bench.engine;
    const conn = bench.conn;
    const circuit = bench.circuit;
    const nets: number[] = [];
    const map: number[] = [];
    cfg.channels.forEach((ch, i) => {
      map[i] = -1;
      const n = conn ? probeNet(ch.probe, circuit, conn) : undefined;
      if (n === undefined) return;
      const en = bench.engineNet(n);
      let k = nets.indexOf(en);
      if (k < 0) {
        k = nets.length;
        nets.push(en);
      }
      map[i] = k;
    });
    dirty = true;
    if (!e || !nets.length) {
      rec = null;
      recMap = map;
      return;
    }
    const r = e.watch(nets);
    rec = r;
    recMap = map;
    return () => {
      r.close();
      if (rec === r) rec = null;
    };
  });

  // Hold: freeze the end of the window at the time of the click.
  let dirty = true;
  let lastNow = -1;
  $effect(() => {
    void JSON.stringify($state.snapshot(cfg));
    void [cssW, cssH, rec, frozen];
    untrack(() => (dirty = true));
  });

  $effect(() => {
    const h = cfg.hold;
    untrack(() => {
      frozen = h ? (bench.engine?.time ?? 0) : null;
    });
  });

  function draw() {
    const c = canvas;
    if (!c) return;
    if (c.offsetParent === null) {
      if (!cfg.hold) rec?.trim(cfg.window * 1.5);
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (c.width !== pw || c.height !== ph) {
      c.width = pw;
      c.height = ph;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = cssW;
    const h = cssH;
    ctx.fillStyle = sig.scopeBg;
    ctx.fillRect(0, 0, w, h);

    const e = bench.engine;
    const analog = e?.kind === 'analog';
    const liveNow = e?.time ?? 0;
    const now = frozen ?? liveNow;
    if (!dirty && now === lastNow) return;
    dirty = false;
    lastNow = now;
    const span = cfg.window;
    const t1 = Math.max(span, now);
    const t0 = t1 - span;
    const x0 = NAMES;
    const x1 = w - 8;
    const X = (t: number) => x0 + ((t - t0) / span) * (x1 - x0);
    const axisY = cfg.channels.length * ROW + 4;

    ctx.font = '10px "JetBrains Mono Variable", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    ctx.strokeStyle = sig.scopeGrid;
    ctx.fillStyle = sig.mute;
    ctx.textAlign = 'center';
    for (const t of ticks(t0, t1, Math.max(2, Math.floor((x1 - x0) / 70)))) {
      const x = Math.round(X(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 2);
      ctx.lineTo(x, axisY + 3);
      ctx.stroke();
      ctx.fillText(formatSI(t, 's', 3), x, axisY + 13);
    }
    ctx.strokeStyle = sig.mute;
    ctx.beginPath();
    ctx.moveTo(x0, axisY + 0.5);
    ctx.lineTo(x1, axisY + 0.5);
    ctx.stroke();

    const times = rec?.times();
    const values = rec?.values();
    cfg.channels.forEach((ch, row) => {
      const top = row * ROW + 5;
      const yHi = top + 3;
      const yLo = top + ROW - 9;
      const yMid = (yHi + yLo) / 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = ch.probe ? sig.fg : sig.mute;
      ctx.font = '600 10.5px "JetBrains Mono Variable", ui-monospace, monospace';
      const name = ch.name || (ch.probe ? probeLabel(ch.probe, bench.conn, bench.circuit) : `D${row}`);
      ctx.fillText(name.length > 7 ? `${name.slice(0, 6)}…` : name, 6, yMid);
      const k = recMap[row];
      const data = k !== undefined && k >= 0 ? values?.[k] : undefined;
      if (!times || !data) {
        ctx.strokeStyle = sig.scopeGrid;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(x0, yMid);
        ctx.lineTo(x1, yMid);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      const ss = spans(times, data, t0, now, analog);
      const slant = Math.min(3, (x1 - x0) / 200);
      for (const s of ss) {
        const a = X(s.t0);
        const b = X(s.t1);
        if (s.v === 1) {
          ctx.fillStyle = sig.high;
          ctx.globalAlpha = 0.16;
          ctx.fillRect(a, yHi, b - a, yLo - yHi);
          ctx.globalAlpha = 1;
        } else if (s.v === 2) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(a, yHi, Math.max(1, b - a), yLo - yHi);
          ctx.clip();
          ctx.fillStyle = sig.x;
          ctx.globalAlpha = 0.14;
          ctx.fillRect(a, yHi, b - a, yLo - yHi);
          ctx.globalAlpha = 0.8;
          ctx.strokeStyle = sig.x;
          ctx.beginPath();
          for (let x = a - (yLo - yHi); x < b; x += 5) {
            ctx.moveTo(x, yLo);
            ctx.lineTo(x + (yLo - yHi), yHi);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
      let prevY: number | undefined;
      for (const s of ss) {
        const a = X(s.t0);
        const b = X(s.t1);
        const y = s.v === 1 ? yHi : s.v === 0 ? yLo : yMid;
        ctx.lineWidth = s.v === 1 ? 2.4 : 1.7;
        ctx.strokeStyle = s.v === 1 ? sig.high : s.v === 0 ? sig.low : s.v === 3 ? sig.z : sig.x;
        ctx.setLineDash(s.v === 3 ? [4, 3] : []);
        ctx.beginPath();
        if (s.v === 2) {
          ctx.moveTo(a, yHi);
          ctx.lineTo(b, yHi);
          ctx.moveTo(a, yLo);
          ctx.lineTo(b, yLo);
        } else {
          const start = prevY !== undefined && prevY !== y ? a + slant : a;
          if (prevY !== undefined && prevY !== y) {
            ctx.moveTo(a, prevY);
            ctx.lineTo(start, y);
          } else ctx.moveTo(a, y);
          ctx.lineTo(Math.max(start, b), y);
        }
        ctx.stroke();
        prevY = s.v === 2 ? undefined : y;
      }
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
    });

    // Decoder annotations.
    if (decoder && times && rec) {
      const chans = decoder.channels.map((_, j) => {
        const k = recMap[j];
        const d = k !== undefined && k >= 0 ? values?.[k] : undefined;
        if (!d) return new Float64Array(0);
        return analog ? Float64Array.from(d, (v) => voltageToLogic(v)) : d;
      });
      const notes = decoder.decode({ times, channels: chans, names: cfg.channels.map((c, i) => c.name || (c.probe ? probeLabel(c.probe, bench.conn, bench.circuit) : `D${i}`)) });
      const y = cfg.channels.length * ROW + AXIS + 2;
      ctx.font = '600 9.5px "JetBrains Mono Variable", ui-monospace, monospace';
      for (const n of notes) {
        if (n.t1 < t0 || n.t0 > now) continue;
        const a = Math.max(x0, X(n.t0));
        const b = Math.min(x1, X(n.t1));
        if (b - a < 3) continue;
        ctx.fillStyle = n.error ? sig.x : sig.phosphor;
        ctx.globalAlpha = 0.22;
        ctx.fillRect(a, y, b - a, ROW - 6);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = n.error ? sig.x : sig.phosphor;
        ctx.strokeRect(a + 0.5, y + 0.5, b - a - 1, ROW - 7);
        ctx.fillStyle = sig.fg;
        ctx.textAlign = 'center';
        ctx.fillText(n.text, (a + b) / 2, y + (ROW - 6) / 2);
      }
    }

    // Cursors: dashed lines with the level of each channel beside them.
    if (cfg.cursors.on) {
      const ct = cfg.cursors.t.map((f) => t0 + f * span);
      ctx.setLineDash([5, 4]);
      cfg.cursors.t.forEach((f, k) => {
        const x = Math.round(x0 + f * (x1 - x0)) + 0.5;
        ctx.strokeStyle = sig.high;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, axisY + 3);
        ctx.stroke();
        ctx.fillStyle = sig.high;
        ctx.font = '700 9px "JetBrains Mono Variable", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(k ? 'B' : 'A', x, axisY + 13 + (k ? 0 : 0));
        if (times) {
          cfg.channels.forEach((_, row) => {
            const kk = recMap[row];
            const d = kk !== undefined && kk >= 0 ? values?.[kk] : undefined;
            if (!d) return;
            const i = indexAtOrBefore(times, ct[k]!);
            if (i < 0) return;
            const lv = analog ? voltageToLogic(d[i]!) : d[i]!;
            ctx.fillStyle = sig.scopeBg;
            ctx.fillRect(x + 2, row * ROW + 5 + 1, 10, 12);
            ctx.fillStyle = lv === 1 ? sig.high : lv === 0 ? sig.low : lv === 3 ? sig.z : sig.x;
            ctx.textAlign = 'left';
            ctx.fillText(logicChar(lv), x + 4, row * ROW + 5 + 8);
          });
        }
      });
      ctx.setLineDash([]);
      const dt = Math.abs(ct[1]! - ct[0]!);
      const next = { dt: formatSI(dt, 's', 3), freq: dt > 0 ? formatSI(1 / dt, 'Hz', 3) : '–' };
      if (next.dt !== cursorText.dt || next.freq !== cursorText.freq) cursorText = next;
    }

    if (!cfg.hold) rec?.trim(span * 1.5);
  }

  onMount(() => {
    const ro = new ResizeObserver(([entry]) => {
      if (entry) cssW = Math.max(200, Math.floor(entry.contentRect.width));
    });
    if (wrap) ro.observe(wrap);
    if (canvas) sig = readSignals(canvas);
    const off = bench.onFrame(draw);
    return () => {
      ro.disconnect();
      off();
    };
  });
  $effect(() => {
    void [cssW, cssH, cfg.cursors.on];
    untrack(draw);
  });

  // Cursor dragging.
  let drag: number | null = null;
  function pointerDown(ev: PointerEvent) {
    if (!cfg.cursors.on || !canvas) return;
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left;
    let best = -1;
    let bd = 14;
    cfg.cursors.t.forEach((f, k) => {
      const d = Math.abs(NAMES + f * (cssW - 8 - NAMES) - x);
      if (d < bd) {
        bd = d;
        best = k;
      }
    });
    if (best < 0) return;
    drag = best;
    canvas.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  }
  function pointerMove(ev: PointerEvent) {
    if (drag === null || !canvas) return;
    const r = canvas.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (ev.clientX - r.left - NAMES) / (cssW - 8 - NAMES)));
    const t: [number, number] = [...cfg.cursors.t];
    t[drag] = f;
    cfg.cursors.t = t;
  }
  const pointerUp = () => (drag = null);

  const step = (d: 1 | -1) => (cfg.window = stepLadder(cfg.window / 10, d, 1e-9, 100) * 10);
  function addChannel() {
    if (cfg.channels.length < MAX_ANALYSER_CHANNELS) cfg.channels.push({});
  }
  function removeChannel() {
    if (cfg.channels.length > 1) cfg.channels.pop();
  }
  const available = $derived(decoders());
</script>

<div class="la">
  <div class="screen frame" bind:this={wrap}>
    <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
    <canvas
      bind:this={canvas}
      style:width="{cssW}px"
      style:height="{cssH}px"
      role="img"
      aria-label="Logic analyser: {cfg.channels.length} channels"
      onpointerdown={pointerDown}
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerUp}
    ></canvas>
  </div>

  <div class="row">
    <span class="cap label-caps">Time</span>
    <Stepper label="time per division" text="{formatSI(cfg.window / 10, 's', 2)}/div" onstep={step} />
  </div>
  <div class="tog">
    <Toggle label="Hold" bind:checked={cfg.hold} />
    <Toggle label="Cursors" bind:checked={cfg.cursors.on} />
  </div>
  {#if cfg.cursors.on}
    <p class="cur num">A–B <b>{cursorText.dt}</b> · <b>{cursorText.freq}</b></p>
  {/if}

  {#if available.length}
    <label class="dec ui">
      <span>Decode</span>
      <select value={cfg.decoder ?? ''} onchange={(ev) => (cfg.decoder = ev.currentTarget.value || undefined)}>
        <option value="">none</option>
        {#each available as d (d.id)}<option value={d.id}>{d.name}</option>{/each}
      </select>
    </label>
  {/if}

  <div class="chan">
    <h4 class="label-caps">Channels <span>{cfg.channels.length} of {MAX_ANALYSER_CHANNELS}</span></h4>
    {#each cfg.channels as ch, i (i)}
      <div class="one">
        <input class="nm" type="text" value={ch.name ?? ''} placeholder="D{i}" aria-label="Name of channel {i}" oninput={(ev) => (ch.name = ev.currentTarget.value || undefined)} maxlength="8" spellcheck="false" />
        <ProbeButton {bench} label="D{i}" value={ch.probe} colour="--series-6" onpick={(r) => (ch.probe = r)} empty="not attached" />
      </div>
    {/each}
    <div class="add">
      <button type="button" onclick={addChannel} disabled={cfg.channels.length >= MAX_ANALYSER_CHANNELS}><Glyph name="plus" size={14} />Add channel</button>
      <button type="button" onclick={removeChannel} disabled={cfg.channels.length <= 1}><Glyph name="minus" size={14} />Remove last</button>
    </div>
    <p class="help ui">A channel without a name is called after the pin or net it is attached to.</p>
  </div>
</div>

<style>
  .la {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    min-width: 0;
  }
  .frame {
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--line-strong) 60%, black);
    box-shadow: inset 0 2px 8px rgb(0 0 0 / 0.5), 0 1px 0 var(--line);
    background: var(--scope-bg);
    line-height: 0;
    overflow: hidden;
  }
  canvas {
    display: block;
    touch-action: none;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .cap {
    font-size: 0.62rem;
    color: var(--mute);
    min-width: 2.2rem;
  }
  .tog {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.4rem;
  }
  .cur {
    margin: 0;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .cur b {
    color: var(--fg);
  }
  .dec {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  select,
  .nm {
    font: inherit;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 0.2rem 0.4rem;
  }
  .chan {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--line);
  }
  h4 {
    display: flex;
    justify-content: space-between;
    margin: 0 0 0.15rem;
    font-size: 0.64rem;
    color: var(--mute);
  }
  h4 span {
    font-weight: 400;
    opacity: 0.75;
  }
  .one {
    display: grid;
    grid-template-columns: 4.2rem 1fr;
    gap: 0.4rem;
  }
  .add {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.2rem;
  }
  .add button {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.6rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font-family: var(--font-ui);
    font-size: 0.76rem;
    cursor: pointer;
  }
  .add button:hover:not(:disabled) {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .add button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .help {
    margin: 0;
    font-size: 0.72rem;
    color: var(--mute);
  }
</style>
