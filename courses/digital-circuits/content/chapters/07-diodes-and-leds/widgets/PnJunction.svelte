<!--
  The pn junction: the flagship of Chapter 7.

  An animated Canvas 2D picture of a silicon junction: holes on the p side, electrons on the n side, and
  between them the depletion region, where the fixed ions of the dopants are left uncovered. The bias
  slider (−5 V … +1 V) widens and narrows the region and lets carriers over the barrier; the doping
  slider changes how many carriers there are and how high the built-in voltage is. Below the picture, a
  live I–V plot (linear or logarithmic) shows the operating point, and the readouts give the real
  numbers. Drag on the plot, or focus it and use the arrow keys, to set the bias from the curve.

  The physics (built-in voltage, depletion width, the I–V curve) is exact, in ./pn.ts; the animation
  is qualitative: see the notes at the top of that file. Canvas 2D; paused off-screen and in hidden tabs;
  starts paused for readers who prefer reduced motion.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { onThemeChange, prefersReducedMotion, readSignals, withAlpha, type Signals } from '$lib/theme/signals';
  import {
    BIAS_MAX,
    BIAS_MIN,
    DECADE_VOLTS,
    DOPING_DEFAULT,
    DOPING_MAX,
    DOPING_MIN,
    FLASH_SECONDS,
    PnSim,
    builtInVoltage,
    depletionWidth,
    diodeCurrent,
    dopingRatio,
    formatCurrent,
    junctionVoltage,
  } from './pn';

  let { title = 'The pn junction', caption, n }: { title?: string; caption?: string; n?: string | number } = $props();

  // ── state ───────────────────────────────────────────────────────────────
  let bias = $state(0);
  let doping = $state(DOPING_DEFAULT);
  let scale = $state<'linear' | 'log'>('linear');
  let playing = $state(true);
  let reducedMotion = $state(false);

  const vbi = $derived(builtInVoltage(doping));
  const width = $derived(depletionWidth(bias, doping));
  const barrier = $derived(Math.max(0, vbi - junctionVoltage(bias, doping)));
  const current = $derived(diodeCurrent(bias, doping));

  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sup = (k: number) => String(k).replace(/\d/g, (d) => SUP[+d]!);
  const fmtDoping = (v: number) => `1×10${sup(Math.round(Math.log10(v)))}`;
  const signed = (v: number, d = 2) => `${v > 0.0005 ? '+' : v < -0.0005 ? '−' : ''}${Math.abs(v).toFixed(d)} V`;
  const fmtWidth = (w: number) => (w >= 1 ? `${w.toFixed(2)} µm` : `${(w * 1000).toFixed(0)} nm`);

  const regime = $derived(
    bias > 0.45
      ? 'Forward bias: the barrier is low, carriers pour across and recombine, and a current flows.'
      : bias > 0.05
        ? 'Forward bias, below the knee: a few carriers get over the barrier, so only a small current flows.'
        : bias < -0.05
          ? 'Reverse bias: the region widens and the barrier grows. Nothing crosses but a trickle of thermally made pairs.'
          : 'No bias: diffusion and the built-in field balance exactly, and no current flows.',
  );
  const status = $derived(
    `Bias ${signed(bias)}, doping ${fmtDoping(doping)} per cubic centimetre. Depletion region ${fmtWidth(width)} wide, barrier ${barrier.toFixed(2)} volts, current ${formatCurrent(current)}. ${regime}`,
  );

  // ── canvases ────────────────────────────────────────────────────────────
  const PIC_TOP = 34;
  const PIC_H = 150;
  const PIC_HEIGHT = 322;
  const IV_HEIGHT = 240;

  let pic: HTMLCanvasElement | undefined = $state();
  let iv: HTMLCanvasElement | undefined = $state();
  let root: HTMLDivElement | undefined = $state();
  let sim: PnSim | undefined;
  let picCtx: CanvasRenderingContext2D | null = null;
  let ivCtx: CanvasRenderingContext2D | null = null;
  let sig: Signals | undefined;
  let font = 'system-ui, sans-serif';
  let dpr = 1;
  let picW = 0;
  let ivW = 0;
  let visible = false;
  let raf = 0;
  let last = 0;

  function sizeCanvas(c: HTMLCanvasElement, height: number, minW: number): number {
    const w = Math.max(minW, Math.floor(c.parentElement?.clientWidth ?? c.clientWidth));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(height * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(height * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${height}px`;
    }
    return w;
  }

  function measure() {
    if (pic) {
      picW = sizeCanvas(pic, PIC_HEIGHT, 240);
      picCtx = pic.getContext('2d');
      if (!sim) {
        sim = new PnSim(picW, PIC_H, 42);
        sim.setDoping(doping);
        sim.setBias(bias);
      } else if (Math.abs(sim.width - picW) > 0.5) sim.resize(picW, PIC_H);
    }
    if (iv) {
      ivW = sizeCanvas(iv, IV_HEIGHT, 240);
      ivCtx = iv.getContext('2d');
    }
  }

  // ── drawing: the junction ───────────────────────────────────────────────
  function arrow(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, head = 6) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.moveTo(x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45));
    c.lineTo(x1, y1);
    c.lineTo(x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45));
    c.stroke();
  }

  function drawPicture() {
    const c = picCtx;
    const s = sim;
    if (!c || !s || !sig || !pic) return;
    const W = s.width;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, PIC_HEIGHT);
    c.font = `500 12px ${font}`;
    c.textBaseline = 'middle';
    const top = PIC_TOP;
    const bot = PIC_TOP + PIC_H;
    const m = PnSim.margin;

    // Silicon: p side tinted amber, n side blue, the depletion region copper.
    c.fillStyle = withAlpha(sig.high, 0.07);
    c.fillRect(0, top, s.centre, PIC_H);
    c.fillStyle = withAlpha(sig.current, 0.07);
    c.fillRect(s.centre, top, W - s.centre, PIC_H);
    const dep = s.right - s.left;
    c.fillStyle = withAlpha(sig.copper, 0.2);
    c.fillRect(s.left, top, dep, PIC_H);

    // The lattice of fixed ions: faint where carriers hide them, bold and signed where they are exposed.
    const pitch = 15;
    c.textAlign = 'center';
    for (let ix = pitch / 2; ix < W; ix += pitch) {
      const inP = ix < s.centre;
      const exposed = ix > s.left && ix < s.right;
      for (let iy = pitch / 2 + 1; iy < PIC_H; iy += pitch) {
        if (exposed) {
          c.fillStyle = inP ? sig.current : sig.high;
          c.font = `700 11px ${font}`;
          c.fillText(inP ? '−' : '+', ix, top + iy);
        } else {
          c.fillStyle = withAlpha(sig.mute, 0.22);
          c.fillRect(ix - 1.5, top + iy - 1.5, 3, 3);
        }
      }
    }
    c.font = `500 12px ${font}`;

    // Depletion edges.
    c.strokeStyle = withAlpha(sig.copper, 0.9);
    c.lineWidth = 1.5;
    c.setLineDash([4, 3]);
    for (const x of [s.left, s.right]) {
      c.beginPath();
      c.moveTo(x, top);
      c.lineTo(x, bot);
      c.stroke();
    }
    c.setLineDash([]);
    // Junction plane.
    c.strokeStyle = withAlpha(sig.fg, 0.35);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(s.centre, top);
    c.lineTo(s.centre, bot);
    c.stroke();

    // Field arrow inside the region (from the + ions to the − ions: n to p).
    if (dep > 26) {
      c.strokeStyle = sig.copper;
      c.fillStyle = sig.copper;
      c.lineWidth = 2;
      arrow(c, s.right - 6, top + PIC_H / 2, s.left + 6, top + PIC_H / 2, 7);
      c.textAlign = 'center';
      c.font = `700 12px ${font}`;
      c.fillText('E', s.centre, top + PIC_H / 2 - 12);
      c.font = `500 12px ${font}`;
    }

    // Carriers.
    for (const p of s.carriers) {
      const x = p.x;
      const y = top + p.y;
      c.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      if (p.kind === 'hole') {
        c.beginPath();
        c.arc(x, y, p.mode === 'minor' ? 5 : 4.2, 0, Math.PI * 2);
        c.fillStyle = withAlpha(sig.panel, 0.9);
        c.fill();
        c.lineWidth = p.mode === 'minor' ? 2.2 : 1.6;
        c.strokeStyle = sig.high;
        c.stroke();
        c.beginPath();
        c.moveTo(x - 2, y);
        c.lineTo(x + 2, y);
        c.moveTo(x, y - 2);
        c.lineTo(x, y + 2);
        c.lineWidth = 1.2;
        c.stroke();
      } else {
        c.beginPath();
        c.arc(x, y, p.mode === 'minor' ? 4.6 : 3.7, 0, Math.PI * 2);
        c.fillStyle = sig.current;
        c.fill();
        if (p.mode === 'minor') {
          c.lineWidth = 1.6;
          c.strokeStyle = sig.panel;
          c.stroke();
        }
      }
      if (p.mode === 'swept') {
        c.strokeStyle = p.kind === 'hole' ? sig.high : sig.current;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + (p.kind === 'hole' ? 22 : -22), y);
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    // Recombination flashes (in an LED each is a photon).
    for (const f of s.flashes) {
      const t = f.age / FLASH_SECONDS;
      c.strokeStyle = withAlpha(sig.phosphor, 1 - t);
      c.lineWidth = 2.4 * (1 - t) + 0.5;
      c.beginPath();
      c.arc(f.x, top + f.y, 4 + 16 * t, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = withAlpha(sig.phosphor, 0.5 * (1 - t));
      c.beginPath();
      c.arc(f.x, top + f.y, 4 + 6 * t, 0, Math.PI * 2);
      c.fill();
    }

    // Metal contacts with the polarity of the applied voltage (+ on the p side when forward).
    c.fillStyle = sig.siliconMetal;
    c.fillRect(0, top, 8, PIC_H);
    c.fillRect(W - 8, top, 8, PIC_H);
    c.strokeStyle = withAlpha(sig.fg, 0.5);
    c.lineWidth = 1.5;
    c.strokeRect(0.75, top + 0.75, W - 1.5, PIC_H - 1.5);
    c.textAlign = 'center';
    const fwd = bias >= 0;
    c.font = `700 13px ${font}`;
    c.fillStyle = bias > 0.03 || bias < -0.03 ? sig.fg : sig.mute;
    c.fillText(bias > 0.03 ? '+' : bias < -0.03 ? '−' : '·', 20, top - 10);
    c.fillText(bias > 0.03 ? '−' : bias < -0.03 ? '+' : '·', W - 20, top - 10);
    c.font = `500 12px ${font}`;

    // External current arrow along the top edge when there is a current worth showing.
    if (Math.abs(bias) > 0.03 && current > 1e-4) {
      const len = 30 + 40 * Math.min(1, (Math.log10(current) + 4) / 3);
      c.strokeStyle = sig.high;
      c.fillStyle = sig.high;
      c.lineWidth = 2.5;
      arrow(c, W / 2 - len / 2, top - 12, W / 2 + len / 2, top - 12, 7);
      c.textAlign = 'center';
      c.font = `600 11px ${font}`;
      c.fillText(formatCurrent(current), W / 2, top - 26);
      c.font = `500 12px ${font}`;
    }
    void fwd;

    // Side labels.
    c.textAlign = 'left';
    c.fillStyle = sig.high;
    c.font = `600 12px ${font}`;
    c.fillText(W < 400 ? 'p-type (holes)' : 'p-type: boron, holes', 34, 12);
    c.textAlign = 'right';
    c.fillStyle = sig.current;
    c.fillText(W < 400 ? 'n-type (electrons)' : 'n-type: phosphorus, electrons', W - 34, 12);
    c.font = `500 12px ${font}`;
    c.textAlign = 'center';
    c.fillStyle = sig.copper;
    c.fillText(`depletion region ${fmtWidth(width)}`, Math.min(W - 70, Math.max(70, s.centre)), bot + 14);

    drawBarrier(c, s, W, bot + 28);
  }

  /** The electron's energy across the junction: a hill of height q(Vbi − V) between the n side (low) and the p side (high). */
  function drawBarrier(c: CanvasRenderingContext2D, s: PnSim, W: number, y0: number) {
    // The top 22 px hold the labels; the hill is drawn below them.
    const H = PIC_HEIGHT - (y0 + 22) - 6;
    const base = PIC_HEIGHT - 6;
    const hpx = H * Math.pow(Math.min(1, Math.max(0, barrier) / 6.2), 0.6);
    const yHigh = base - Math.max(3, hpx) - 4;
    const yLow = base - 4;
    c.lineWidth = 1;
    c.strokeStyle = withAlpha(sig!.fg, 0.25);
    c.beginPath();
    c.moveTo(0, y0 - 2);
    c.lineTo(W, y0 - 2);
    c.stroke();

    // Two parabolas, as for uniform doping: steepest at the junction plane.
    const xl = s.left;
    const xr = s.right;
    const xc = s.centre;
    c.beginPath();
    c.moveTo(8, yHigh);
    c.lineTo(xl, yHigh);
    const N = 24;
    for (let i = 1; i <= N; i++) {
      const x = xl + ((xr - xl) * i) / N;
      let f: number; // 0 at the p edge, 1 at the n edge
      if (x <= xc) {
        const u = (x - xl) / Math.max(1e-6, xc - xl);
        f = 0.5 * u * u;
      } else {
        const u = (xr - x) / Math.max(1e-6, xr - xc);
        f = 1 - 0.5 * u * u;
      }
      c.lineTo(x, yHigh + (yLow - yHigh) * f);
    }
    c.lineTo(W - 8, yLow);
    c.strokeStyle = sig!.copper;
    c.lineWidth = 3;
    c.lineJoin = 'round';
    c.stroke();
    c.lineWidth = 1;

    // Height marker and label.
    c.strokeStyle = withAlpha(sig!.fg, 0.55);
    c.setLineDash([3, 3]);
    c.beginPath();
    c.moveTo(xc, yHigh);
    c.lineTo(W - 8, yHigh);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = sig!.fg;
    c.font = `500 12px ${font}`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('electron energy', 12, y0 + 8);
    c.textAlign = 'right';
    const label = `barrier ${barrier.toFixed(2)} eV`;
    c.fillText(label, W - 12, y0 + 8);
    if (hpx > 10) {
      c.strokeStyle = sig!.fg;
      c.lineWidth = 1.5;
      const ax = Math.min(W - 40, xr + 26);
      arrow(c, ax, yLow, ax, yHigh, 5);
      arrow(c, ax, yHigh, ax, yLow, 5);
    }
  }

  // ── drawing: the I–V plot ───────────────────────────────────────────────
  const PL = 50;
  const PR = 12;
  const PT = 12;
  const PB = 36;
  const MA_MAX = 20; // mA at the top of the linear plot
  const MA_MIN = -4;
  const LOG_MIN = -12;
  const LOG_MAX = 0;

  const xOf = (v: number, W: number) => PL + ((v - BIAS_MIN) / (BIAS_MAX - BIAS_MIN)) * (W - PL - PR);
  const vOf = (x: number, W: number) => BIAS_MIN + ((x - PL) / (W - PL - PR)) * (BIAS_MAX - BIAS_MIN);
  const yOf = (i: number, H: number) => {
    const h = H - PT - PB;
    if (scale === 'linear') return PT + (1 - (i * 1e3 - MA_MIN) / (MA_MAX - MA_MIN)) * h;
    const l = Math.log10(Math.max(Math.abs(i), 1e-15));
    return PT + (1 - (l - LOG_MIN) / (LOG_MAX - LOG_MIN)) * h;
  };

  function drawIV() {
    const c = ivCtx;
    if (!c || !sig || !iv) return;
    const W = ivW;
    const H = IV_HEIGHT;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    c.font = `500 11px ${font}`;
    c.textBaseline = 'middle';
    const left = PL;
    const right = W - PR;
    const topY = PT;
    const botY = H - PB;

    // Grid and axes.
    c.lineWidth = 1;
    c.strokeStyle = withAlpha(sig.fg, 0.1);
    c.fillStyle = sig.mute;
    c.textAlign = 'center';
    for (let v = BIAS_MIN; v <= BIAS_MAX; v++) {
      const x = xOf(v, W);
      c.beginPath();
      c.moveTo(x, topY);
      c.lineTo(x, botY);
      c.stroke();
      c.fillText(String(v), x, botY + 12);
    }
    c.fillText('voltage across the diode (V)', (left + right) / 2, H - 5);
    c.textAlign = 'right';
    if (scale === 'linear') {
      for (let ma = 0; ma <= MA_MAX; ma += 5) {
        const y = yOf(ma * 1e-3, H);
        c.beginPath();
        c.moveTo(left, y);
        c.lineTo(right, y);
        c.stroke();
        c.fillText(`${ma}`, left - 6, y);
      }
      const y = yOf(-2e-3, H);
      c.fillText('−2', left - 6, y);
      c.save();
      c.translate(11, (topY + botY) / 2);
      c.rotate(-Math.PI / 2);
      c.textAlign = 'center';
      c.fillText('current (mA)', 0, 0);
      c.restore();
    } else {
      for (let e = LOG_MIN; e <= LOG_MAX; e += 2) {
        const y = yOf(Math.pow(10, e), H);
        c.beginPath();
        c.moveTo(left, y);
        c.lineTo(right, y);
        c.stroke();
        c.fillText(e === 0 ? '1 A' : e === -3 ? '1 mA' : e === -6 ? '1 µA' : e === -9 ? '1 nA' : e === -12 ? '1 pA' : `10${sup(e)}`, left - 6, y);
      }
      c.save();
      c.translate(11, (topY + botY) / 2);
      c.rotate(-Math.PI / 2);
      c.textAlign = 'center';
      c.fillText('|current|', 0, 0);
      c.restore();
    }
    // Axes through zero.
    c.strokeStyle = withAlpha(sig.fg, 0.5);
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(xOf(0, W), topY);
    c.lineTo(xOf(0, W), botY);
    c.stroke();
    if (scale === 'linear') {
      const y0 = yOf(0, H);
      c.beginPath();
      c.moveTo(left, y0);
      c.lineTo(right, y0);
      c.stroke();
    }

    // The curve.
    c.save();
    c.beginPath();
    c.rect(left, topY - 2, right - left, botY - topY + 4);
    c.clip();
    const steps = 260;
    const draw = (from: number, to: number, colour: string, dash: number[]) => {
      c.beginPath();
      let started = false;
      for (let k = 0; k <= steps; k++) {
        const v = from + ((to - from) * k) / steps;
        const i = diodeCurrent(v, doping);
        const x = xOf(v, W);
        const y = yOf(i, H);
        if (!started) {
          c.moveTo(x, y);
          started = true;
        } else c.lineTo(x, y);
      }
      c.strokeStyle = colour;
      c.lineWidth = 2.8;
      c.setLineDash(dash);
      c.stroke();
      c.setLineDash([]);
    };
    draw(BIAS_MIN, 0, sig.low, scale === 'log' ? [5, 4] : []);
    draw(0, BIAS_MAX, sig.high, []);
    c.restore();

    // Operating point.
    const x = xOf(bias, W);
    let y = yOf(current, H);
    const off = y < topY;
    y = Math.min(botY, Math.max(topY, y));
    c.strokeStyle = withAlpha(sig.copper, 0.6);
    c.lineWidth = 1;
    c.setLineDash([3, 3]);
    c.beginPath();
    c.moveTo(x, botY);
    c.lineTo(x, y);
    if (scale === 'log') {
      c.moveTo(left, y);
      c.lineTo(x, y);
    }
    c.stroke();
    c.setLineDash([]);
    c.beginPath();
    c.arc(x, y, 6, 0, Math.PI * 2);
    c.fillStyle = sig.copper;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = sig.panel;
    c.stroke();
    if (off) {
      c.fillStyle = sig.copper;
      c.textAlign = x > W - 110 ? 'right' : 'left';
      c.font = `600 11px ${font}`;
      c.fillText(`${formatCurrent(current)} (off the scale)`, x + (x > W - 110 ? -10 : 10), topY + 10);
    }
    // Knee note.
    c.font = `500 11px ${font}`;
    c.textAlign = 'left';
    c.fillStyle = sig.mute;
    if (scale === 'linear') c.fillText('reverse: about 0', xOf(-4.9, W), yOf(0, H) - 10);
    else c.fillText('forward: ×10 per 60 mV', xOf(-4.9, W), yOf(1e-1, H));
  }

  function draw() {
    drawPicture();
    drawIV();
  }

  // ── animation ───────────────────────────────────────────────────────────
  function frame(t: number) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    if (playing && sim) sim.step(dt);
    drawPicture();
    if (playing) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && visible && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function reset() {
    bias = 0;
    doping = DOPING_DEFAULT;
    sim = undefined;
    measure();
    draw();
  }

  // The IV plot is also a control: drag on it, or use the arrow keys when it has focus.
  let dragging = false;
  function setFromPointer(e: PointerEvent) {
    if (!iv) return;
    const r = iv.getBoundingClientRect();
    const v = vOf(e.clientX - r.left, ivW);
    bias = Math.round(Math.min(BIAS_MAX, Math.max(BIAS_MIN, v)) * 100) / 100;
  }
  function onKey(e: KeyboardEvent) {
    const step = e.shiftKey ? 0.25 : 0.05;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') bias = Math.min(BIAS_MAX, Math.round((bias + step) * 100) / 100);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') bias = Math.max(BIAS_MIN, Math.round((bias - step) * 100) / 100);
    else if (e.key === 'Home') bias = BIAS_MIN;
    else if (e.key === 'End') bias = BIAS_MAX;
    else return;
    e.preventDefault();
  }

  onMount(() => {
    reducedMotion = prefersReducedMotion();
    if (reducedMotion) playing = false;
    font = getComputedStyle(pic!).fontFamily || font;
    sig = readSignals(pic);
    measure();
    draw();
    const stopTheme = onThemeChange(() => {
      sig = readSignals(pic);
      draw();
    });
    const ro = new ResizeObserver(() => {
      measure();
      draw();
    });
    if (pic?.parentElement) ro.observe(pic.parentElement);
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      if (visible) kick();
    });
    if (root) io.observe(root);
    const vis = () => !document.hidden && kick();
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      stopTheme();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
    };
  });

  // The reader's changes show at once, even when the animation is paused.
  $effect(() => {
    const v = bias;
    const d = doping;
    untrack(() => {
      if (sim) {
        if (sim.doping !== d) sim.setDoping(d);
        sim.setBias(v);
      }
      draw();
      kick();
    });
  });
  $effect(() => {
    void scale;
    untrack(draw);
  });
  $effect(() => {
    if (playing) untrack(kick);
  });
</script>

<Widget {title} {caption} {n} kind="Flagship interactive" onreset={reset} fullscreen>
  {#snippet controls()}
    <Slider bind:value={bias} min={BIAS_MIN} max={BIAS_MAX} step={0.05} label="Applied voltage" format={(v) => signed(v)} />
    <Slider bind:value={doping} min={DOPING_MIN} max={DOPING_MAX} log label="Doping (each side)" format={fmtDoping} />
    <button class="play ui" type="button" onclick={() => (playing = !playing)} aria-pressed={playing}>
      <Icon name={playing ? 'close' : 'play'} size={13} />
      {playing ? 'Pause' : reducedMotion ? 'Animate' : 'Play'}
    </button>
  {/snippet}

  <div class="wrap" bind:this={root}>
    <div class="cv" role="img" aria-label="A silicon pn junction with holes on the left and electrons on the right. {status}">
      <canvas bind:this={pic} aria-hidden="true"></canvas>
    </div>

    <ul class="legend ui" aria-label="Key">
      <li><i class="dot h"></i> hole (a missing electron)</li>
      <li><i class="dot e"></i> electron</li>
      <li><i class="ion">−</i><i class="ion pl">+</i> fixed ions, uncovered</li>
      <li><i class="dot f"></i> recombination (in an LED: a photon)</li>
    </ul>

    <div class="lower">
      <div class="plot">
        <div class="plot-head ui">
          <span class="plot-title">Current against voltage</span>
          <Segmented
            options={[
              { value: 'linear', label: 'Linear', title: 'Current in milliamps: the familiar hockey stick' },
              { value: 'log', label: 'Log', title: 'Magnitude on a logarithmic axis: the forward branch is a straight line' },
            ]}
            bind:value={scale}
            label="Current axis"
            size="sm"
          />
        </div>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="cv iv"
          role="slider"
          tabindex="0"
          aria-label="Applied voltage, set from the I–V curve"
          aria-valuemin={BIAS_MIN}
          aria-valuemax={BIAS_MAX}
          aria-valuenow={bias}
          aria-valuetext={signed(bias)}
          onkeydown={onKey}
          onpointerdown={(e) => {
            dragging = true;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setFromPointer(e);
          }}
          onpointermove={(e) => dragging && setFromPointer(e)}
          onpointerup={() => (dragging = false)}
          onpointercancel={() => (dragging = false)}
        >
          <canvas bind:this={iv} aria-hidden="true"></canvas>
        </div>
      </div>

      <dl class="read ui">
        <div class="wide">
          <dt>State</dt>
          <dd class="say">{regime}</dd>
        </div>
        <div>
          <dt>Current</dt>
          <dd class="big" class:fwd={current > 1e-6}>{formatCurrent(current)}</dd>
          <dd class="sub">at {signed(bias)}</dd>
        </div>
        <div>
          <dt>Depletion region</dt>
          <dd class="big">{fmtWidth(width)}</dd>
          <dd class="sub">the wire-thin gap with no free carriers</dd>
        </div>
        <div>
          <dt>Barrier for carriers</dt>
          <dd class="big">{barrier.toFixed(2)} eV</dd>
          <dd class="sub">built in: {vbi.toFixed(2)} V, minus the forward bias</dd>
        </div>
        <div>
          <dt>Doping</dt>
          <dd class="big">{dopingRatio(doping)}</dd>
          <dd class="sub">silicon atoms are a dopant</dd>
        </div>
        <div class="wide">
          <dt>Rule of thumb</dt>
          <dd class="sub">Every extra {(DECADE_VOLTS * 1000).toFixed(0)} mV of forward bias multiplies the current by 10. The animation shows the crossings less steeply than that; the plot and the numbers are exact.</dd>
        </div>
      </dl>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{status}</p>
  </div>
</Widget>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }
  .cv {
    width: 100%;
    overflow: hidden;
    border-radius: 6px;
  }
  canvas {
    display: block;
    max-width: 100%;
  }
  .play {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 1.9rem;
    padding: 0 0.75rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
  }
  .play:hover {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1.1rem;
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .dot {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 50%;
  }
  .dot.h {
    border: 2px solid var(--sig-high);
    background: var(--panel);
  }
  .dot.e {
    background: var(--sig-current);
  }
  .dot.f {
    border: 2px solid var(--phosphor);
    background: color-mix(in srgb, var(--phosphor) 35%, transparent);
  }
  .ion {
    font-style: normal;
    font-weight: 700;
    color: var(--sig-current);
    width: 0.6rem;
    text-align: center;
  }
  .ion.pl {
    color: var(--sig-high);
  }
  .lower {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 1rem 1.25rem;
    align-items: start;
  }
  @media (max-width: 46rem) {
    .lower {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .plot {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 0;
  }
  .plot-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem 0.8rem;
  }
  .plot-title {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--mute);
  }
  .iv {
    cursor: ew-resize;
    touch-action: pan-y;
    border: 1px solid var(--line);
    background: var(--panel);
  }
  .iv:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .read {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
  .read .wide {
    grid-column: 1 / -1;
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
    font-size: 1.02rem;
    font-weight: 500;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }
  .big.fwd {
    color: var(--sig-high);
  }
  .sub,
  .say {
    font-size: 0.78rem;
    line-height: 1.4;
    color: var(--ink-2);
  }
  .say {
    font-size: 0.84rem;
    color: var(--fg);
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
