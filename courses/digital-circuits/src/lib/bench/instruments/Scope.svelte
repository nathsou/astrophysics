<!--
  The oscilloscope: two to four channels on a dark phosphor screen (Canvas 2D), fed by engine.watch() so
  short glitches are not lost between frames. Timebase and volts per division step through the 1–2–5
  ladder; the trigger (source, level, slope, auto or normal) locks repeating signals in place, like a real
  scope; two time cursors and two voltage cursors read out differences; persistence leaves a fading trail.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Slider from '../../components/ui/Slider.svelte';
  import Toggle from '../../components/ui/Toggle.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import type { Recorder } from '../../sim/engine';
  import { formatSI } from '../format';
  import { readSignals, type Signals, FALLBACK } from '../../theme/signals';
  import type { Bench } from '../editor/bench.svelte';
  import { CHANNEL_TOKENS, type Instrument, type ScopeConfig } from './kinds';
  import { probeNet } from './probes';
  import { chooseCapture, crossings, cursorDelta, decimate, logicToVolts, PRE_TRIGGER, statistics, stepLadder, TIMEBASE_MAX, TIMEBASE_MIN, valueAt, VDIV_MAX, VDIV_MIN, type Capture } from './scope-math';
  import ProbeButton from './ProbeButton.svelte';
  import Stepper from './Stepper.svelte';

  let { bench, inst }: { bench: Bench; inst: Instrument } = $props();
  const cfg = $derived(inst.config as ScopeConfig);

  const COLS = 10;
  const ROWS = 8;

  let canvas: HTMLCanvasElement | undefined = $state();
  let wrap: HTMLDivElement | undefined = $state();
  let cssW = $state(340);
  const cssH = $derived(Math.round((cssW * ROWS) / COLS));

  // The phosphor layer keeps the traces between frames, so persistence can fade them.
  let phos: HTMLCanvasElement | undefined;
  let colours: string[] = CHANNEL_TOKENS.map(() => '#5cf0a0');
  let sig: Signals = FALLBACK.dark;

  // ── The recording ────────────────────────────────────────────────────────
  let rec: Recorder | null = null;
  let recMap: number[] = [];
  let lastCapture: Capture | undefined;
  let resetLayer = true;

  $effect(() => {
    const e = bench.engine;
    const conn = bench.conn;
    const circuit = bench.circuit;
    const nets: number[] = [];
    const map: number[] = [];
    cfg.channels.forEach((ch, i) => {
      map[i] = -1;
      if (!ch.on || !conn) return;
      const n = probeNet(ch.probe, circuit, conn);
      if (n === undefined) return;
      const en = bench.engineNet(n);
      let k = nets.indexOf(en);
      if (k < 0) {
        k = nets.length;
        nets.push(en);
      }
      map[i] = k;
    });
    untrack(() => {
      lastCapture = undefined;
      resetLayer = true;
      dirty = true;
    });
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

  /** Voltages of channel i over the recording (logic values become 0 V / 5 V). */
  function voltsOf(values: Float64Array[], i: number, logic: boolean): Float64Array | undefined {
    const k = recMap[i];
    const v = k !== undefined && k >= 0 ? values[k] : undefined;
    if (!v) return undefined;
    if (!logic) return v;
    const out = new Float64Array(v.length);
    for (let j = 0; j < v.length; j++) out[j] = logicToVolts(v[j]!);
    return out;
  }

  // Redraw only when time has moved or a setting changed (a paused scope costs nothing).
  let dirty = true;
  let lastNow = -1;
  $effect(() => {
    void JSON.stringify($state.snapshot(cfg));
    void cssW;
    void rec;
    untrack(() => (dirty = true));
  });

  // ── Readouts (strings, written only when they change) ────────────────────
  let stats = $state<string[]>(['', '', '', '']);
  let cursorText = $state({ dt: '', freq: '', v1: '', v2: '', dv: '', a1: '', a2: '', da: '' });
  let status = $state('STOP');
  let win = { t0: 0, w: 1 };

  const fmtV = (v: number) => (Number.isFinite(v) ? formatSI(v, 'V', 3) : '–');

  function draw() {
    const c = canvas;
    if (!c || !wrap) return;
    // Collapsed or off screen: nothing to draw, but keep the recording bounded.
    if (c.offsetParent === null) {
      rec?.trim(7 * cfg.timebase * COLS);
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (c.width !== pw || c.height !== ph) {
      c.width = pw;
      c.height = ph;
      resetLayer = true;
    }
    if (!phos) phos = document.createElement('canvas');
    if (phos.width !== pw || phos.height !== ph) {
      phos.width = pw;
      phos.height = ph;
      resetLayer = true;
    }
    const ctx = c.getContext('2d');
    const pctx = phos.getContext('2d');
    if (!ctx || !pctx) return;
    const W = pw;
    const H = ph;
    const divW = W / COLS;
    const divH = H / ROWS;
    const e = bench.engine;
    const now = e?.time ?? 0;
    if (!dirty && now === lastNow && !(e && bench.sim === 'running')) return;
    dirty = false;
    lastNow = now;
    const span = cfg.timebase * COLS;
    const logic = !!e && e.kind !== 'analog';

    // Data and capture window.
    const r = rec;
    const times = r?.times();
    const values = r?.values();
    const chVolts = cfg.channels.map((_, i) => (values ? voltsOf(values, i, logic) : undefined));
    let cap: Capture | undefined = { t0: Math.max(0, now - span), triggered: false };
    const src = chVolts[cfg.trigger.source];
    if (times && src && times.length > 1) {
      cap = chooseCapture(times, src, now, span, { level: cfg.trigger.level, slope: cfg.trigger.slope, mode: cfg.trigger.mode }, logic, lastCapture);
      if (cap?.triggered) lastCapture = cap;
    } else if (!e) cap = { t0: 0, triggered: false };
    const t0 = cap?.t0 ?? 0;
    win = { t0, w: span };
    const t1 = t0 + span;
    const yOf = (v: number, i: number) => H / 2 - (v / cfg.channels[i]!.vdiv + cfg.channels[i]!.pos) * divH;
    const xOf = (t: number) => ((t - t0) / span) * W;
    const nextStatus = !e ? 'STOP' : !cap ? 'WAIT' : cap.triggered ? "TRIG'D" : cfg.trigger.mode === 'auto' ? 'AUTO' : 'WAIT';
    if (nextStatus !== status) status = nextStatus;

    // Phosphor layer: fade the old picture, then add the traces.
    if (resetLayer || !cfg.persistence) {
      pctx.clearRect(0, 0, W, H);
      resetLayer = false;
    } else {
      pctx.globalCompositeOperation = 'destination-out';
      pctx.fillStyle = 'rgba(0,0,0,0.16)';
      pctx.fillRect(0, 0, W, H);
      pctx.globalCompositeOperation = 'source-over';
    }
    if (cap && times && times.length) {
      pctx.save();
      pctx.beginPath();
      pctx.rect(0, 0, W, H);
      pctx.clip();
      pctx.lineJoin = 'round';
      pctx.lineCap = 'round';
      cfg.channels.forEach((ch, i) => {
        const v = chVolts[i];
        if (!ch.on || !v) return;
        const poly = decimate(times, v, t0, t1, W / dpr, logic, now);
        if (poly.t.length < 2) return;
        pctx.beginPath();
        let pen = false;
        for (let k = 0; k < poly.t.length; k++) {
          const val = poly.v[k]!;
          if (Number.isNaN(val)) {
            pen = false;
            continue;
          }
          const x = xOf(poly.t[k]!);
          const y = yOf(val, i);
          if (pen) pctx.lineTo(x, y);
          else pctx.moveTo(x, y);
          pen = true;
        }
        pctx.strokeStyle = colours[i]!;
        pctx.shadowColor = colours[i]!;
        pctx.shadowBlur = 6 * dpr;
        pctx.lineWidth = 1.7 * dpr;
        pctx.stroke();
      });
      pctx.restore();
    }

    // The screen: background, graticule, layer, markers, cursors.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = sig.scopeBg;
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1;
    ctx.strokeStyle = sig.scopeGrid;
    ctx.beginPath();
    for (let i = 0; i <= COLS; i++) {
      const x = Math.round(i * divW) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let j = 0; j <= ROWS; j++) {
      const y = Math.round(j * divH) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    // Centre axes with five ticks per division.
    ctx.strokeStyle = sig.scopeGrid.replace(/[\d.]+\)$/, '0.32)');
    ctx.beginPath();
    ctx.moveTo(0, Math.round(H / 2) + 0.5);
    ctx.lineTo(W, Math.round(H / 2) + 0.5);
    ctx.moveTo(Math.round(W / 2) + 0.5, 0);
    ctx.lineTo(Math.round(W / 2) + 0.5, H);
    const tick = 3 * dpr;
    for (let i = 0; i <= COLS * 5; i++) {
      const x = Math.round((i * divW) / 5) + 0.5;
      ctx.moveTo(x, H / 2 - tick);
      ctx.lineTo(x, H / 2 + tick);
    }
    for (let j = 0; j <= ROWS * 5; j++) {
      const y = Math.round((j * divH) / 5) + 0.5;
      ctx.moveTo(W / 2 - tick, y);
      ctx.lineTo(W / 2 + tick, y);
    }
    ctx.stroke();

    ctx.drawImage(phos, 0, 0);

    const font = (px: number, weight = 500) => `${weight} ${px * dpr}px "JetBrains Mono Variable", ui-monospace, monospace`;
    ctx.textBaseline = 'middle';

    // Ground markers at the left edge (a small triangle per channel) and the trigger level.
    cfg.channels.forEach((ch, i) => {
      if (!ch.on) return;
      const y = yOf(0, i);
      ctx.fillStyle = colours[i]!;
      ctx.beginPath();
      ctx.moveTo(0, y - 5 * dpr);
      ctx.lineTo(9 * dpr, y);
      ctx.lineTo(0, y + 5 * dpr);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = sig.scopeBg;
      ctx.font = font(7, 700);
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), 1.2 * dpr, y + 0.5 * dpr);
    });
    const trigCh = cfg.channels[cfg.trigger.source];
    if (trigCh) {
      const y = yOf(cfg.trigger.level, cfg.trigger.source);
      ctx.strokeStyle = colours[cfg.trigger.source]!;
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([2 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(W, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = colours[cfg.trigger.source]!;
      ctx.beginPath();
      ctx.moveTo(W, y - 5 * dpr);
      ctx.lineTo(W - 9 * dpr, y);
      ctx.lineTo(W, y + 5 * dpr);
      ctx.closePath();
      ctx.fill();
    }
    if (cap?.triggered) {
      const x = W * PRE_TRIGGER;
      ctx.fillStyle = sig.phosphor;
      ctx.beginPath();
      ctx.moveTo(x - 5 * dpr, 0);
      ctx.lineTo(x + 5 * dpr, 0);
      ctx.lineTo(x, 8 * dpr);
      ctx.closePath();
      ctx.fill();
    }

    // Cursors.
    const cur = cfg.cursors;
    if (cur.on) {
      ctx.lineWidth = dpr;
      ctx.setLineDash([5 * dpr, 4 * dpr]);
      ctx.font = font(9, 700);
      const cch = cur.channel;
      cur.t.forEach((f, k) => {
        const x = Math.round(f * W) + 0.5;
        ctx.strokeStyle = sig.high;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.fillStyle = sig.high;
        ctx.textAlign = f > 0.94 ? 'right' : 'left';
        ctx.fillText(`T${k + 1}`, x + (f > 0.94 ? -4 : 4) * dpr, H - 9 * dpr);
      });
      cur.v.forEach((v, k) => {
        const y = Math.round(yOf(v, cch)) + 0.5;
        ctx.strokeStyle = sig.current;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.fillStyle = sig.current;
        ctx.textAlign = 'right';
        ctx.fillText(`V${k + 1}`, W - 12 * dpr, y - 8 * dpr);
      });
      ctx.setLineDash([]);
    }

    // Text: time per division, volts per division, status.
    ctx.font = font(10, 600);
    ctx.textAlign = 'left';
    ctx.fillStyle = sig.phosphor;
    ctx.fillText(formatSI(cfg.timebase, 's', 2) + '/div', 14 * dpr, 12 * dpr);
    ctx.textAlign = 'right';
    ctx.fillStyle = cap?.triggered ? sig.phosphor : sig.mute;
    ctx.fillText(status, W - 14 * dpr, 12 * dpr);
    ctx.textAlign = 'left';
    let lx = 8 * dpr;
    cfg.channels.forEach((ch, i) => {
      if (!ch.on) return;
      const label = `${i + 1}  ${formatSI(ch.vdiv, 'V', 2)}/div`;
      ctx.fillStyle = colours[i]!;
      ctx.font = font(9.5, 600);
      ctx.fillText(label, lx, H - 8 * dpr);
      lx += ctx.measureText(label).width + 12 * dpr;
    });

    // Readouts under the screen.
    if (times && times.length && cap) {
      const next = cfg.channels.map((ch, i) => {
        const v = chVolts[i];
        if (!ch.on || !v) return '';
        const s = statistics(times, v, t0, Math.min(t1, now));
        return s ? `pk-pk ${fmtV(s.pkpk)} · mean ${fmtV(s.mean)}` : '';
      });
      if (next.some((s, i) => s !== stats[i])) stats = next;
      if (cur.on) {
        const ct = cur.t.map((f) => t0 + f * span);
        const d = cursorDelta(ct[0]!, ct[1]!);
        const sv = chVolts[cur.channel];
        const va = ct.map((t) => (sv ? valueAt(times, sv, t, logic) : NaN));
        const nextC = {
          dt: formatSI(Math.abs(d.delta), 's', 3),
          freq: Number.isFinite(d.inverse) ? formatSI(d.inverse, 'Hz', 3) : '–',
          v1: fmtV(cur.v[0]),
          v2: fmtV(cur.v[1]),
          dv: fmtV(cur.v[1] - cur.v[0]),
          a1: fmtV(va[0]!),
          a2: fmtV(va[1]!),
          da: fmtV(va[1]! - va[0]!),
        };
        if (JSON.stringify(nextC) !== JSON.stringify(cursorText)) cursorText = nextC;
      }
    } else if (stats.some(Boolean)) stats = ['', '', '', ''];

    // Keep the recording bounded (a few screens' worth).
    r?.trim(7 * span);
  }

  onMount(() => {
    const ro = new ResizeObserver(([entry]) => {
      if (entry) cssW = Math.max(200, Math.floor(entry.contentRect.width));
    });
    if (wrap) ro.observe(wrap);
    // The screen is always dark, so its colours never change with the page theme.
    if (canvas) sig = readSignals(canvas);
    const probe = document.createElement('span');
    canvas?.parentElement?.appendChild(probe);
    colours = CHANNEL_TOKENS.map((t) => {
      probe.style.color = `var(${t})`;
      return getComputedStyle(probe).color;
    });
    probe.remove();
    const off = bench.onFrame(draw);
    return () => {
      ro.disconnect();
      off();
    };
  });
  $effect(() => {
    void cssW;
    untrack(draw);
  });

  // ── Cursor dragging ──────────────────────────────────────────────────────
  let drag: { kind: 't' | 'v'; k: number } | null = null;
  function pointerDown(ev: PointerEvent) {
    if (!cfg.cursors.on || !canvas) return;
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    const divH = cssH / ROWS;
    const ch = cfg.channels[cfg.cursors.channel]!;
    let best: { kind: 't' | 'v'; k: number; d: number } | null = null;
    cfg.cursors.t.forEach((f, k) => {
      const d = Math.abs(f * cssW - x);
      if (d < 12 && (!best || d < best.d)) best = { kind: 't', k, d };
    });
    cfg.cursors.v.forEach((v, k) => {
      const yy = cssH / 2 - (v / ch.vdiv + ch.pos) * divH;
      const d = Math.abs(yy - y);
      if (d < 12 && (!best || d < best.d)) best = { kind: 'v', k, d };
    });
    if (!best) return;
    const b = best as { kind: 't' | 'v'; k: number };
    drag = { kind: b.kind, k: b.k };
    canvas.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  }
  function pointerMove(ev: PointerEvent) {
    if (!drag || !canvas) return;
    const r = canvas.getBoundingClientRect();
    if (drag.kind === 't') {
      const f = Math.max(0, Math.min(1, (ev.clientX - r.left) / cssW));
      const t: [number, number] = [...cfg.cursors.t];
      t[drag.k] = f;
      cfg.cursors.t = t;
    } else {
      const ch = cfg.channels[cfg.cursors.channel]!;
      const y = ev.clientY - r.top;
      const v = ((cssH / 2 - y) / (cssH / ROWS) - ch.pos) * ch.vdiv;
      const vv: [number, number] = [...cfg.cursors.v];
      vv[drag.k] = Number(v.toPrecision(4));
      cfg.cursors.v = vv;
    }
  }
  function pointerUp() {
    drag = null;
  }

  // ── Controls ─────────────────────────────────────────────────────────────
  const stepTime = (d: 1 | -1) => (cfg.timebase = stepLadder(cfg.timebase, d, TIMEBASE_MIN, TIMEBASE_MAX));
  const stepVolts = (i: number, d: 1 | -1) => (cfg.channels[i]!.vdiv = stepLadder(cfg.channels[i]!.vdiv, d, VDIV_MIN, VDIV_MAX));
  const move = (i: number, d: number) => (cfg.channels[i]!.pos = Math.max(-4, Math.min(4, cfg.channels[i]!.pos + d)));

  const trigCh = $derived(cfg.channels[cfg.trigger.source]!);
  const levelMin = $derived((-4 - trigCh.pos) * trigCh.vdiv);
  const levelMax = $derived((4 - trigCh.pos) * trigCh.vdiv);
  let levelValue = $state(0);
  $effect(() => {
    levelValue = cfg.trigger.level;
  });

  /** Autoset: scale each channel to its signal, centre it, put the trigger mid-signal, and fit a few periods. */
  function autoset() {
    const r = rec;
    const e = bench.engine;
    if (!r || !e) return;
    const times = r.times();
    const values = r.values();
    const logic = e.kind !== 'analog';
    let period: number | undefined;
    cfg.channels.forEach((ch, i) => {
      if (!ch.on) return;
      const v = voltsOf(values, i, logic);
      if (!v || v.length < 2) return;
      const s = statistics(times, v, times[0]!, times[times.length - 1]!);
      if (!s) return;
      const mid = (s.min + s.max) / 2;
      const swing = Math.max(s.pkpk, 1e-3);
      let vdiv = VDIV_MIN;
      while (vdiv * 6 < swing && vdiv < VDIV_MAX) vdiv = stepLadder(vdiv, 1, VDIV_MIN, VDIV_MAX);
      ch.vdiv = vdiv;
      ch.pos = Math.max(-3, Math.min(3, -mid / vdiv));
      if (i === cfg.trigger.source) {
        cfg.trigger.level = Number(mid.toPrecision(3));
        const c = crossings(times, v, mid, cfg.trigger.slope, times[0]!, times[times.length - 1]!, logic);
        if (c.length >= 2) period = (c[c.length - 1]! - c[0]!) / (c.length - 1);
      }
    });
    if (period) {
      let tb = TIMEBASE_MIN;
      while (tb * COLS < period * 2.5 && tb < TIMEBASE_MAX) tb = stepLadder(tb, 1, TIMEBASE_MIN, TIMEBASE_MAX);
      cfg.timebase = tb;
    }
    lastCapture = undefined;
    resetLayer = true;
  }

  const onNames = $derived(cfg.channels.map((c, i) => ({ c, i })).filter((x) => x.c.on));
  $effect(() => {
    // The trigger and cursors follow a channel that exists.
    if (!cfg.channels[cfg.trigger.source]?.on) {
      const first = cfg.channels.findIndex((c) => c.on);
      if (first >= 0) cfg.trigger.source = first;
    }
    if (!cfg.channels[cfg.cursors.channel]?.on) {
      const first = cfg.channels.findIndex((c) => c.on);
      if (first >= 0) cfg.cursors.channel = first;
    }
  });
</script>

<div class="scope">
  <div class="screen frame" bind:this={wrap}>
    <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
    <canvas
      bind:this={canvas}
      style:width="{cssW}px"
      style:height="{cssH}px"
      class:grab={cfg.cursors.on}
      role="img"
      aria-label="Oscilloscope screen: {onNames.map((x) => `channel ${x.i + 1}`).join(', ') || 'no channels'}"
      onpointerdown={pointerDown}
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerUp}
    ></canvas>
  </div>

  {#if stats.some(Boolean)}
    <ul class="stats num" aria-label="Measurements">
      {#each cfg.channels as ch, i (i)}
        {#if ch.on && stats[i]}<li><i style:background="var({CHANNEL_TOKENS[i]})"></i><b>{i + 1}</b>{stats[i]}</li>{/if}
      {/each}
    </ul>
  {/if}

  <div class="row">
    <span class="cap label-caps">Time</span>
    <Stepper label="time per division" text="{formatSI(cfg.timebase, 's', 2)}/div" onstep={stepTime} minusDisabled={cfg.timebase <= TIMEBASE_MIN} plusDisabled={cfg.timebase >= TIMEBASE_MAX} />
    <button type="button" class="auto" onclick={autoset} disabled={!bench.engine} title="Scale the channels and timebase to the signals">Autoset</button>
  </div>

  <details class="sec" open>
    <summary class="label-caps">Channels</summary>
  <div class="channels">
    {#each cfg.channels as ch, i (i)}
      <div class="ch" class:off={!ch.on} style:--cc="var({CHANNEL_TOKENS[i]})">
        <div class="ch-top">
          <Toggle label="CH{i + 1}" bind:checked={ch.on} />
          {#if ch.on}
            <ProbeButton {bench} label="CH{i + 1}" value={ch.probe} colour={CHANNEL_TOKENS[i]} onpick={(r) => (ch.probe = r)} />
          {/if}
        </div>
        {#if ch.on}
          <div class="ch-bot">
            <Stepper label="volts per division, channel {i + 1}" text="{formatSI(ch.vdiv, 'V', 2)}/div" onstep={(d) => stepVolts(i, d)} minusDisabled={ch.vdiv <= VDIV_MIN} plusDisabled={ch.vdiv >= VDIV_MAX} />
            <span class="pos ui">
              <button type="button" onclick={() => move(i, 0.5)} aria-label="Move channel {i + 1} up" title="Move up">▲</button>
              <button type="button" onclick={() => move(i, -0.5)} aria-label="Move channel {i + 1} down" title="Move down">▼</button>
              <button type="button" onclick={() => (ch.pos = 0)} aria-label="Centre channel {i + 1}" title="Centre" disabled={ch.pos === 0}>0</button>
            </span>
          </div>
        {/if}
      </div>
    {/each}
  </div>
  </details>

  <details class="sec" open>
    <summary class="label-caps">Trigger</summary>
  <div class="trig">
    <div class="trow">
      <label class="src ui">
        <span>Source</span>
        <select value={cfg.trigger.source} onchange={(ev) => (cfg.trigger.source = Number(ev.currentTarget.value))} aria-label="Trigger source">
          {#each onNames as x (x.i)}<option value={x.i}>CH{x.i + 1}</option>{/each}
        </select>
      </label>
      <Segmented size="sm" label="Trigger slope" options={[{ value: 'rise', label: '↗ Rise' }, { value: 'fall', label: '↘ Fall' }]} bind:value={cfg.trigger.slope} />
      <Segmented size="sm" label="Trigger mode" options={[{ value: 'auto', label: 'Auto' }, { value: 'normal', label: 'Normal' }]} bind:value={cfg.trigger.mode} />
    </div>
    <Slider bind:value={levelValue} min={levelMin} max={levelMax} step={Math.max(0.001, trigCh.vdiv / 50)} label="Level" format={(v) => formatSI(v, 'V', 3)} oninput={(v) => (cfg.trigger.level = v)} compact />
  </div>
  </details>

  <details class="sec" open={cfg.cursors.on}>
    <summary class="label-caps">Display and cursors</summary>
  <div class="tog">
    <Toggle label="Persistence" bind:checked={cfg.persistence} />
    <Toggle label="Cursors" bind:checked={cfg.cursors.on} />
  </div>

  {#if cfg.cursors.on}
    <div class="cursors num" role="group" aria-label="Cursor readouts">
      <label class="ui"
        >on
        <select value={cfg.cursors.channel} onchange={(ev) => (cfg.cursors.channel = Number(ev.currentTarget.value))} aria-label="Cursor channel">
          {#each onNames as x (x.i)}<option value={x.i}>CH{x.i + 1}</option>{/each}
        </select>
      </label>
      <dl>
        <dt class="t">ΔT</dt><dd>{cursorText.dt}</dd>
        <dt class="t">1/ΔT</dt><dd>{cursorText.freq}</dd>
        <dt class="t">@T1</dt><dd>{cursorText.a1}</dd>
        <dt class="t">@T2</dt><dd>{cursorText.a2}</dd>
        <dt class="t">Δ(@T)</dt><dd>{cursorText.da}</dd>
        <dt class="v">V1</dt><dd>{cursorText.v1}</dd>
        <dt class="v">V2</dt><dd>{cursorText.v2}</dd>
        <dt class="v">ΔV</dt><dd>{cursorText.dv}</dd>
      </dl>
      <p class="help ui">Drag the dashed lines on the screen.</p>
    </div>
  {/if}
  </details>
</div>

<style>
  .scope {
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
  canvas.grab {
    cursor: crosshair;
  }
  .stats {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--ink-2);
  }
  .stats li {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }
  .stats i {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
  }
  .stats b {
    color: var(--fg);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .cap {
    font-size: 0.62rem;
    color: var(--mute);
    min-width: 2.2rem;
  }
  .auto {
    margin-left: auto;
    padding: 0.25rem 0.7rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font: inherit;
    font-family: var(--font-ui);
    font-size: 0.78rem;
    cursor: pointer;
  }
  .auto:hover:not(:disabled) {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .auto:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .channels {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .ch {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--line);
    border-left: 3px solid var(--cc);
    border-radius: 6px;
    background: color-mix(in srgb, var(--pn) 45%, transparent);
  }
  .ch.off {
    border-left-color: var(--line-strong);
  }
  .ch-top {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.6rem;
  }
  .ch.off .ch-top {
    grid-template-columns: auto;
  }
  .ch-bot {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .pos {
    display: inline-flex;
    gap: 0.15rem;
  }
  .pos button {
    width: 1.6rem;
    height: 1.6rem;
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    background: var(--panel);
    color: var(--ink-2);
    font-size: 0.62rem;
    font-family: var(--font-mono);
    cursor: pointer;
  }
  .pos button:hover:not(:disabled) {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .pos button:disabled {
    opacity: 0.4;
  }
  .sec {
    border-top: 1px solid var(--line);
    padding-top: 0.5rem;
  }
  .sec > summary {
    cursor: pointer;
    font-size: 0.64rem;
    color: var(--mute);
    padding: 0.1rem 0 0.4rem;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .sec > summary::before {
    content: '';
    width: 0.4rem;
    height: 0.4rem;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg);
    transition: transform 120ms;
  }
  .sec[open] > summary::before {
    transform: rotate(45deg);
  }
  .sec > summary::-webkit-details-marker {
    display: none;
  }
  .trig {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .trow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.6rem;
  }
  .src {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  select {
    font: inherit;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 0.15rem 0.3rem;
  }
  .tog {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.4rem;
    margin-bottom: 0.5rem;
  }
  .cursors {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: color-mix(in srgb, var(--pn) 45%, transparent);
    font-size: 0.76rem;
  }
  .cursors label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--mute);
    font-size: 0.74rem;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr auto 1fr;
    gap: 0.15rem 0.7rem;
    margin: 0;
    font-family: var(--font-mono);
  }
  dt {
    font-weight: 700;
    font-size: 0.7rem;
  }
  dt.t {
    color: var(--sig-high);
  }
  dt.v {
    color: var(--sig-current);
  }
  dd {
    margin: 0;
    text-align: right;
    color: var(--fg);
  }
  .help {
    margin: 0;
    font-size: 0.72rem;
    color: var(--mute);
  }
</style>
