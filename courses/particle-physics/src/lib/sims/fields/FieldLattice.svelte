<!--
  Field lattice (Chapter 14): a chain of coupled oscillators, the discretised scalar field
    φ̈ᵢ = c²(φᵢ₊₁ − 2φᵢ + φᵢ₋₁)/a² − m²φᵢ − λφᵢ³        (Klein–Gordon, with an optional φ⁴ interaction)
  integrated with the symplectic leapfrog. Pluck it, launch wave packets, turn the mass term on and watch the packets
  behave like relativistic particles (v = p/E, E² = p² + m²); measure ω(k) from a Fourier transform in space and time;
  switch on the interaction and watch two packets scatter; or look at a 2D sheet.

    ::field-lattice{n="14.1" caption="…"}

  Everything is the CLASSICAL field. The numerics live in `hep/fields` (seeded, no DOM).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { rng } from '$lib/hep/random';
  import {
    defaultKG,
    KGChain,
    KGSheet,
    measureDispersion,
    omegaContinuum,
    omegaNumerical,
    groupVelocityLattice,
    particleVelocity,
    fitVelocity,
  } from '$lib/hep/fields';
  import { diverging, fitCanvas, fmt, mix, parseRGB, prefersReducedMotion, readPalette, watchTheme, watchVisible, type RGB } from './canvas';

  let { n, caption, title = 'A field is a lattice of coupled oscillators' }: { n?: string | number; caption?: string; title?: string } = $props();

  // ── reader-controlled state ──
  let mode = $state<'chain' | 'sheet'>('chain');
  let m = $state(0);
  let k = $state(0.8);
  let lambda = $state(0);
  let shown = $state<'energy' | 'phase'>('energy');
  let panel = $state<'dispersion' | 'modes' | 'packet'>('dispersion');
  let playing = $state(true);
  let speed = $state(4);
  let seed = $state(1);

  const N = 256;
  const DT = 0.1;
  const SHEET_N = 96;
  const ROWS = 180;
  const ROW_STEPS = 8;

  // ── simulation objects (plain, non-reactive) ──
  let chain = new KGChain(defaultKG({ n: N, dt: DT }));
  let sheet = new KGSheet(SHEET_N, 0, 1, 0, 0.2);
  const hist = new Float32Array(ROWS * N); // rows of energy density (newest first)
  const histPhi = new Float32Array(ROWS * N);
  const histT = new Float64Array(ROWS);
  let histCount = 0;
  let emax = 1e-6;
  let phimax = 1e-6;
  let launches: { x0: number; t0: number; p: number; m: number }[] = [];
  const cent: { t: number[]; x: number[] } = { t: [], x: [] };
  let E0 = 0;
  let maxDrift = 0;
  let stepCount = 0;
  let pull: { x: number; v: number } | null = null;
  let cur = $state(N / 2);
  let pluckAmp = $state(0.8);

  // ── readouts (updated a few times per second) ──
  let ro = $state({ t: 0, E: 0, drift: 0, maxDrift: 0, vMeas: NaN, packets: 0 });

  // ── DOM ──
  let host = $state<HTMLDivElement>();
  let chainCv = $state<HTMLCanvasElement>();
  let stCv = $state<HTMLCanvasElement>();
  let sheetCv = $state<HTMLCanvasElement>();
  let width = $state(340);
  let pal = {
    bg: 'rgb(250,250,250)', ink: 'rgb(60,60,60)', mute: 'rgb(120,120,120)', line: 'rgb(200,200,200)', s1: 'rgb(30,110,200)',
    s2: 'rgb(200,100,40)', track: 'rgb(10,110,140)', neg: [60, 110, 210] as RGB, pos: [212, 87, 59] as RGB, bgRGB: [250, 250, 250] as RGB, trackRGB: [10, 110, 140] as RGB,
  };
  let reduced = $state(false);
  let onScreen = true;
  let stOff: HTMLCanvasElement | null = null;
  let sheetOff: HTMLCanvasElement | null = null;

  function readColours() {
    if (!host) return;
    const c = readPalette(host, {
      bg: 'var(--panel)', ink: 'var(--ink-2)', mute: 'var(--mute)', line: 'var(--line-strong)', s1: 'var(--series-1)', s2: 'var(--series-2)', track: 'var(--track)',
    });
    pal = { ...pal, ...c, bgRGB: parseRGB(c.bg), trackRGB: parseRGB(c.track) };
  }

  // ── actions ──
  function resetEnergy() {
    E0 = chain.energy();
    maxDrift = 0;
  }
  function clearField() {
    chain.clear();
    sheet.clear();
    launches = [];
    cent.t.length = 0;
    cent.x.length = 0;
    histCount = 0;
    emax = 1e-6;
    phimax = 1e-6;
    resetEnergy();
  }
  function launch(two = false) {
    if (two) {
      const kk = Math.max(k, 0.3);
      chain.addPacket(N * 0.25, 7, kk, 0.6);
      chain.addPacket(N * 0.75, 7, -kk, 0.6);
      launches = [
        { x0: N * 0.25, t0: chain.t, p: kk, m },
        { x0: N * 0.75, t0: chain.t, p: -kk, m },
      ];
    } else {
      chain.addPacket(N * 0.25, 8, k, 0.6);
      launches = [{ x0: N * 0.25, t0: chain.t, p: k, m }];
    }
    cent.t.length = 0;
    cent.x.length = 0;
    resetEnergy();
  }
  function pluck(x: number, amp: number) {
    chain.pluck(x, 3, amp);
    launches = [];
    resetEnergy();
  }
  function noise() {
    chain.addNoise(rng(seed).fork(chain.steps), 0.15, 0.15 * (0.3 + m));
    seed += 1;
    launches = [];
    resetEnergy();
  }
  function sheetPluck() {
    sheet.pluck(SHEET_N / 2, SHEET_N / 2, 3, 1.5);
  }

  // parameters → simulation
  $effect(() => {
    const mm = m;
    const ll = lambda;
    chain.set({ m: mm, lambda: ll });
    sheet.m = mm;
    sheet.lambda = ll;
    resetEnergy();
    cent.t.length = 0;
    cent.x.length = 0;
  });

  // ── the animation loop ──
  let raf = 0;
  let lastRo = 0;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!host || !onScreen || host.offsetParent === null) return;
    if (playing) advance(speed);
    draw();
    if (now - lastRo > 200) {
      lastRo = now;
      updateReadouts();
    }
  }
  function advance(steps: number) {
    if (mode === 'sheet') {
      for (let s = 0; s < Math.max(1, Math.round(steps / 2)); s++) sheet.step();
      return;
    }
    for (let s = 0; s < steps; s++) {
      if (pull) applyPull();
      chain.step();
      stepCount++;
      if (stepCount % ROW_STEPS === 0) recordRow();
    }
    if (!pull) {
      const d = Math.abs(chain.energy() / (E0 || 1) - 1);
      if (Number.isFinite(d)) maxDrift = Math.max(maxDrift, d);
    }
  }
  function applyPull() {
    if (!pull) return;
    const sg = 4;
    for (let i = 0; i < N; i++) {
      let d = i - pull.x;
      d -= N * Math.round(d / N);
      const g = Math.exp(-(d * d) / (2 * sg * sg));
      if (g < 0.01) continue;
      chain.phi[i] = chain.phi[i]! + g * (pull.v - chain.phi[i]!);
      chain.pi[i] = chain.pi[i]! * (1 - g);
    }
  }
  function recordRow() {
    // shift rows down by one (newest first)
    hist.copyWithin(N, 0, (ROWS - 1) * N);
    histPhi.copyWithin(N, 0, (ROWS - 1) * N);
    histT.copyWithin(1, 0, ROWS - 1);
    const e = chain.energyDensity();
    let mx = 0;
    let mp = 0;
    for (let i = 0; i < N; i++) {
      hist[i] = e[i]!;
      histPhi[i] = chain.phi[i]!;
      mx = Math.max(mx, e[i]!);
      mp = Math.max(mp, Math.abs(chain.phi[i]!));
    }
    histT[0] = chain.t;
    histCount = Math.min(ROWS, histCount + 1);
    emax = Math.max(emax * 0.998, mx, 1e-6);
    phimax = Math.max(phimax * 0.998, mp, 1e-6);
    if (launches.length === 1) {
      const c = chain.centroid();
      cent.t.push(chain.t);
      cent.x.push(c.x);
      if (cent.t.length > 500) {
        cent.t.shift();
        cent.x.shift();
      }
    }
  }
  function updateReadouts() {
    const E = chain.energy();
    let vMeas = NaN;
    if (launches.length === 1 && cent.t.length > 10) vMeas = fitVelocity(cent.t, cent.x, N, 60);
    ro = { t: chain.t, E, drift: E0 ? E / E0 - 1 : 0, maxDrift, vMeas, packets: launches.length };
    if (panel === 'modes' && mode === 'chain') modeData = chain.modeEnergies();
  }

  // ── drawing ──
  function draw() {
    if (mode === 'sheet') drawSheet();
    else {
      drawChain();
      drawSpacetime();
    }
  }
  const CH_H = 150;
  const ST_H = 190;
  function drawChain() {
    if (!chainCv) return;
    const ctx = fitCanvas(chainCv, width, CH_H);
    if (!ctx) return;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, width, CH_H);
    const mid = CH_H / 2;
    const yr = 1.1;
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(width, mid);
    ctx.stroke();
    ctx.setLineDash([]);
    const sx = width / N;
    const ys = (v: number) => mid - Math.max(-1.4, Math.min(1.4, v / yr)) * (mid - 10);
    // the chain: the line and a bead per site
    ctx.strokeStyle = pal.s1;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * sx;
      const y = ys(chain.phi[i]!);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // a bead per site, all in one path (one fill is much cheaper than hundreds)
    ctx.fillStyle = pal.s1;
    const br = sx > 3 ? 1.6 : 1.0;
    ctx.beginPath();
    for (let i = 0; i < N; i += sx > 2 ? 1 : 2) {
      const bx = (i + 0.5) * sx;
      ctx.moveTo(bx + br, ys(chain.phi[i]!));
      ctx.arc(bx, ys(chain.phi[i]!), br, 0, 6.3);
    }
    ctx.fill();
    // the pulled point and the keyboard cursor
    if (pull) {
      ctx.strokeStyle = pal.s2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc((pull.x + 0.5) * sx, ys(pull.v), 6, 0, 6.3);
      ctx.stroke();
    }
    ctx.fillStyle = pal.mute;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('φ(x)', 6, 14);
    ctx.textAlign = 'right';
    ctx.fillText(`${N} oscillators, periodic`, width - 6, 14);
    ctx.textAlign = 'left';
    if (document.activeElement === chainCv) {
      ctx.strokeStyle = pal.s2;
      ctx.lineWidth = 1.5;
      const cx = (cur + 0.5) * sx;
      ctx.beginPath();
      ctx.moveTo(cx, 18);
      ctx.lineTo(cx, CH_H - 4);
      ctx.stroke();
      ctx.fillStyle = pal.s2;
      ctx.fillText(`pluck ${pluckAmp > 0 ? '+' : '−'}${Math.abs(pluckAmp).toFixed(1)}`, Math.min(width - 70, cx + 4), CH_H - 8);
    }
  }
  function drawSpacetime() {
    if (!stCv) return;
    const ctx = fitCanvas(stCv, width, ST_H);
    if (!ctx) return;
    if (!stOff) {
      stOff = document.createElement('canvas');
      stOff.width = N;
      stOff.height = ROWS;
    }
    const octx = stOff.getContext('2d')!;
    const img = octx.createImageData(N, ROWS);
    const bg = pal.bgRGB;
    const tr = pal.trackRGB;
    for (let r = 0; r < ROWS; r++) {
      for (let i = 0; i < N; i++) {
        const o = (r * N + i) * 4;
        let c: RGB;
        if (r >= histCount) c = bg;
        else if (shown === 'energy') c = mix(bg, tr, Math.min(1, Math.sqrt(hist[r * N + i]! / (0.6 * emax))));
        else c = diverging(histPhi[r * N + i]! / phimax, pal.neg, bg, pal.pos);
        img.data[o] = c[0];
        img.data[o + 1] = c[1];
        img.data[o + 2] = c[2];
        img.data[o + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(stOff, 0, 0, width, ST_H);
    // predicted world-lines of launched packets: x = x0 + v (t − t0), v = p/E
    const rowDt = ROW_STEPS * DT;
    const pxPerT = ST_H / ROWS / rowDt;
    const sx = width / N;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = pal.s2;
    for (const L of launches) {
      const v = particleVelocity(L.p, L.m);
      const tAge = Math.min(chain.t - L.t0, ROWS * rowDt);
      const nseg = 80;
      ctx.beginPath();
      let prevX = NaN;
      for (let s = 0; s <= nseg; s++) {
        const tt = (tAge * s) / nseg; // time since launch
        const xx = (((L.x0 + v * tt) % N) + N) % N;
        const yy = (chain.t - (L.t0 + tt)) * pxPerT; // age of that moment, in pixels from the top
        if (Number.isNaN(prevX) || Math.abs(xx - prevX) > N / 2) ctx.moveTo(xx * sx, yy);
        else ctx.lineTo(xx * sx, yy);
        prevX = xx;
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = pal.ink;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('x →', width - 28, ST_H - 6);
    ctx.fillText('t ↑ (newest at the top)', 6, 14);
    if (launches.length) {
      ctx.fillStyle = pal.s2;
      ctx.textAlign = 'right';
      ctx.fillText('dashed: v = p/E', width - 6, 14);
      ctx.textAlign = 'left';
    }
  }
  function drawSheet() {
    if (!sheetCv) return;
    const S = Math.min(width, 420);
    const ctx = fitCanvas(sheetCv, S, S, true);
    if (!ctx) return;
    if (!sheetOff) {
      sheetOff = document.createElement('canvas');
      sheetOff.width = SHEET_N;
      sheetOff.height = SHEET_N;
    }
    const octx = sheetOff.getContext('2d')!;
    const img = octx.createImageData(SHEET_N, SHEET_N);
    const bg = pal.bgRGB;
    let mx = 0.05;
    for (let i = 0; i < sheet.phi.length; i++) mx = Math.max(mx, Math.abs(sheet.phi[i]!));
    const nn = SHEET_N;
    for (let y = 0; y < nn; y++)
      for (let x = 0; x < nn; x++) {
        const i = y * nn + x;
        const v = sheet.phi[i]! / mx;
        // a little fake lighting from the slope makes the ripples read as a surface
        const slope = (sheet.phi[y * nn + ((x + 1) % nn)]! - sheet.phi[y * nn + ((x + nn - 1) % nn)]!) / mx;
        const c = diverging(v, pal.neg, bg, pal.pos);
        const l = 1 + 0.9 * slope;
        const o = i * 4;
        img.data[o] = Math.max(0, Math.min(255, c[0] * l));
        img.data[o + 1] = Math.max(0, Math.min(255, c[1] * l));
        img.data[o + 2] = Math.max(0, Math.min(255, c[2] * l));
        img.data[o + 3] = 255;
      }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sheetOff, 0, 0, S, S);
    ctx.fillStyle = pal.ink;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`${nn}×${nn} oscillators, periodic · click or drag to pluck`, 8, S - 8);
  }

  // ── pointer and keyboard ──
  function chainPoint(e: PointerEvent) {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * N;
    const y = (e.clientY - r.top) / r.height;
    const v = (0.5 - y) * 2 * 1.1 * ((CH_H / 2) / (CH_H / 2 - 10));
    return { x, v };
  }
  function down(e: PointerEvent) {
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    pull = chainPoint(e);
    launches = [];
    if (!playing) playing = true;
  }
  function move(e: PointerEvent) {
    if (pull) pull = chainPoint(e);
  }
  function up() {
    if (pull) {
      pull = null;
      resetEnergy();
    }
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') cur = (cur - 8 + N) % N;
    else if (e.key === 'ArrowRight') cur = (cur + 8) % N;
    else if (e.key === 'ArrowUp') pluckAmp = Math.min(1.2, pluckAmp + 0.2);
    else if (e.key === 'ArrowDown') pluckAmp = Math.max(-1.2, pluckAmp - 0.2);
    else if (e.key === 'Enter' || e.key === ' ') pluck(cur, pluckAmp);
    else return;
    e.preventDefault();
    draw();
  }
  function sheetDown(e: PointerEvent) {
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    sheetAt(e);
  }
  function sheetAt(e: PointerEvent) {
    if (e.type === 'pointermove' && e.buttons === 0) return;
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    sheet.pluck(((e.clientX - r.left) / r.width) * SHEET_N, ((e.clientY - r.top) / r.height) * SHEET_N, 2.5, e.type === 'pointerdown' ? 1.5 : 0.25);
  }
  function stepOnce() {
    advance(speed * 10);
    draw();
    updateReadouts();
  }

  onMount(() => {
    reduced = prefersReducedMotion();
    if (reduced) playing = false;
    readColours();
    const off = watchTheme(() => {
      readColours();
      draw();
    });
    const offVis = watchVisible(host!, (v) => (onScreen = v));
    resetEnergy();
    launch(false);
    // warm start so that the first picture is not empty
    for (let i = 0; i < 400; i++) {
      chain.step();
      stepCount++;
      if (stepCount % ROW_STEPS === 0) recordRow();
    }
    draw();
    updateReadouts();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      off();
      offVis();
    };
  });
  // redraw when paused and something changes
  $effect(() => {
    void [width, shown, mode, panel, m, lambda];
    if (host) draw();
  });

  // ── the dispersion measurement (separate noise-driven run of the same integrator) ──
  const disp = $derived(browser ? measureDispersion(defaultKG({ m, dt: 0.25 }), rng(seed), 512, 4) : null);
  let heatUrl = $state('');
  $effect(() => {
    const d = disp;
    if (!d || !browser) return;
    const c = document.createElement('canvas');
    c.width = d.nk;
    c.height = d.nw;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(d.nk, d.nw);
    // normalise to the ridge: leave out the k = 0 column (a free zero mode drifts, and would dominate the scale)
    let mx = 0;
    for (let j = 1; j < d.nk; j++) for (let l = 1; l < d.nw; l++) mx = Math.max(mx, d.power[j * d.nw + l]!);
    const lo = Math.log10(mx) - 4;
    for (let j = 0; j < d.nk; j++)
      for (let l = 0; l < d.nw; l++) {
        const v = Math.max(0, Math.min(1, (Math.log10(d.power[j * d.nw + l]! + 1e-300) - lo) / 4));
        const o = ((d.nw - 1 - l) * d.nk + j) * 4; // ω increases upwards
        const cc = mix(pal.bgRGB, pal.trackRGB, v * v);
        img.data[o] = cc[0];
        img.data[o + 1] = cc[1];
        img.data[o + 2] = cc[2];
        img.data[o + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    heatUrl = c.toDataURL();
  });
  const curveK = Array.from({ length: 121 }, (_, i) => (i / 120) * Math.PI);
  const points = $derived(
    disp
      ? Array.from({ length: disp.nk }, (_, j) => ({ k: disp.k[j]!, w: disp.omega[j]! })).filter((p) => p.k > 0.1 && Number.isFinite(p.w) && (p.w > 0 || m === 0))
      : [],
  );
  const pathOf = (f: (x: number) => number, sx: (v: number) => number, sy: (v: number) => number) => curveK.map((x, i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(f(x)).toFixed(1)}`).join('');

  // ── the packet as a particle ──
  const pp = $derived({
    E: omegaContinuum(k, m),
    v: particleVelocity(k, m),
    vLat: groupVelocityLattice(k, m),
    phase: k > 0 ? omegaContinuum(k, m) / k : Infinity,
    gamma: m > 0 ? omegaContinuum(k, m) / m : Infinity,
  });
  let modeData = $state<{ q: Float64Array; E: Float64Array; omega: Float64Array } | null>(null);
  $effect(() => {
    if (panel === 'modes' && mode === 'chain' && browser) modeData = chain.modeEnergies();
  });
  const modeBars = $derived.by(() => {
    if (!modeData) return { max: 1, bars: [] as { q: number; e: number }[] };
    const bars: { q: number; e: number }[] = [];
    let mx = 1e-9;
    for (let j = 1; j < modeData.q.length; j++) {
      bars.push({ q: modeData.q[j]!, e: modeData.E[j]! });
      mx = Math.max(mx, modeData.E[j]!);
    }
    return { max: mx, bars };
  });
  const dispPointsLabel = $derived(points.length ? `${points.length} measured points` : '');
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Segmented
      label="Dimensions"
      size="sm"
      bind:value={mode}
      options={[
        { value: 'chain', label: '1D chain' },
        { value: 'sheet', label: '2D sheet' },
      ]}
    />
    <Slider bind:value={m} min={0} max={1.5} step={0.01} label="Mass term m (0 = massless)" />
    {#if mode === 'chain'}
      <Slider bind:value={k} min={0} max={1.5} step={0.01} label="Packet momentum p (wave number k)" />
    {/if}
    <Slider bind:value={lambda} min={0} max={3} step={0.05} label="Interaction λ (φ⁴; 0 = free field)" />
  {/snippet}

  <div class="wrap" bind:this={host} bind:clientWidth={width}>
    <div class="btns ui">
      {#if mode === 'chain'}
        <Button size="sm" variant="primary" onclick={() => launch(false)}>Launch a packet →</Button>
        <Button size="sm" onclick={() => launch(true)}>Two packets</Button>
        <Button size="sm" onclick={() => pluck(N / 2, 0.8)}>Pluck the middle</Button>
        <Button size="sm" onclick={noise}>Noise (seed {seed})</Button>
      {:else}
        <Button size="sm" variant="primary" onclick={sheetPluck}>Pluck the middle</Button>
      {/if}
      <Button size="sm" onclick={clearField}>Clear</Button>
      <Button size="sm" onclick={() => (playing = !playing)} aria-pressed={playing}>{playing ? 'Pause' : 'Play'}</Button>
      {#if !playing}<Button size="sm" onclick={stepOnce}>Step</Button>{/if}
    </div>

    {#if mode === 'chain'}
      <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
      <canvas
        bind:this={chainCv}
        class="cv"
        tabindex="0"
        role="application"
        aria-label="The field along the chain. Drag to pull the field and let go to pluck it. With the keyboard: left and right arrows move the cursor, up and down set the size of the pluck, Enter plucks."
        onpointerdown={down}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={up}
        onkeydown={key}
        onblur={() => draw()}
        onfocus={() => draw()}
      ></canvas>
      <div class="row ui">
        <span class="lab">Space–time picture, showing</span>
        <Segmented
          label="Show energy density or the field"
          size="sm"
          bind:value={shown}
          options={[
            { value: 'energy', label: 'energy density' },
            { value: 'phase', label: 'field φ (crests and troughs)' },
          ]}
        />
      </div>
      <div role="img" aria-label="Space–time diagram of the chain: position across, time upwards. Wave packets appear as straight bright lines whose slope is their velocity."><canvas bind:this={stCv} class="cv" aria-hidden="true"></canvas></div>

      <div class="readout ui" aria-live="polite">
        <dl>
          <div><dt>time</dt><dd>{fmt(ro.t, 3)}</dd></div>
          <div><dt>energy</dt><dd>{fmt(ro.E, 4)}</dd></div>
          <div><dt>energy drift ΔE/E</dt><dd>{fmt(ro.drift, 2)} <small>(largest {fmt(ro.maxDrift, 2)})</small></dd></div>
        </dl>
        <p class="hint">
          The energy is conserved by the equations; the symplectic leapfrog keeps it to within a small wobble of order Δt² that never grows, however long it runs.
        </p>
      </div>

      <div class="tabs ui">
        <Segmented
          label="Analysis"
          bind:value={panel}
          options={[
            { value: 'dispersion', label: 'Dispersion ω(k)' },
            { value: 'packet', label: 'A packet is a particle' },
            { value: 'modes', label: 'Normal modes' },
          ]}
        />
      </div>

      {#if panel === 'dispersion'}
        <p class="note ui">
          Measured: a separate run of this same integrator, started from seeded random noise, recorded as φ(x, t) and Fourier transformed in space and in time (the shading is |φ̃(k, ω)|²). A plane wave e<sup>i(kx−ωt)</sup> shows up as a bright spot at (k, ω), so the bright ridge is the dispersion relation.
        </p>
        <Plot
          height={300}
          label="Measured dispersion relation: frequency ω against wave number k, with the theory curves. With mass m the curve starts at ω = m instead of 0."
          x={{ domain: [0, Math.PI], label: 'wave number k = momentum p', ticks: 6, format: (v) => v.toFixed(1) }}
          y={{ domain: [0, 2.6], label: 'frequency ω = energy E', ticks: 6, format: (v) => v.toFixed(1) }}
        >
          {#snippet marks({ sx, sy })}
            {#if heatUrl}
              <image href={heatUrl} x={sx(0)} y={sy(disp?.omegaMax ?? 3.14)} width={sx(Math.PI) - sx(0)} height={sy(0) - sy(disp?.omegaMax ?? 3.14)} preserveAspectRatio="none" opacity="0.85" />
            {/if}
            <path d={pathOf((x) => omegaContinuum(x, m), sx, sy)} class="line" stroke="var(--series-2)" stroke-dasharray="6 4" />
            <path d={pathOf((x) => omegaNumerical(x, { m, c: 1, a: 1, dt: 0.25 }), sx, sy)} class="line" stroke="var(--fg)" stroke-width="1.2" />
            {#each points as p}
              <circle cx={sx(p.k)} cy={sy(p.w)} r="1.8" fill="var(--series-3)" />
            {/each}
            {#if m > 0}
              <line x1={sx(0)} x2={sx(0.5)} y1={sy(m)} y2={sy(m)} stroke="var(--series-7)" stroke-width="1.2" />
            {/if}
            <!-- the packet: phase velocity is the slope of the chord from the origin, group velocity the slope of the tangent -->
            <circle cx={sx(k)} cy={sy(pp.E)} r="5" fill="none" stroke="var(--series-7)" stroke-width="2" />
            <line x1={sx(Math.max(0, k - 0.5))} x2={sx(Math.min(Math.PI, k + 0.5))} y1={sy(pp.E - 0.5 * pp.vLat)} y2={sy(pp.E + 0.5 * pp.vLat)} stroke="var(--series-7)" stroke-width="2" />
          {/snippet}
        </Plot>
        <ul class="key ui">
          <li><span class="sw dots"></span> measured ridge, {dispPointsLabel}</li>
          <li><span class="sw dash"></span> continuum theory ω = √(k² + m²), i.e. E² = p² + m²</li>
          <li><span class="sw solid"></span> this lattice and leapfrog: ω² = m² + 4 sin²(k/2), bending below the continuum curve near k = π (short waves feel the graininess)</li>
          <li><span class="sw ring"></span> the packet launched with the momentum slider; the short line through it is the tangent, whose slope dω/dk is the packet's velocity</li>
        </ul>
      {:else if panel === 'packet'}
        <table class="ui">
          <thead>
            <tr><th>quantity</th><th>value</th><th>how</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">p (= k)</th><td>{fmt(k, 3)}</td><td>slider</td></tr>
            <tr><th scope="row">E = √(p² + m²)</th><td>{fmt(pp.E, 4)}</td><td>ω of the mode with wave number k</td></tr>
            <tr><th scope="row">v = p/E</th><td>{fmt(pp.v, 3)} c</td><td>the relativistic particle relation (dashed line in the picture)</td></tr>
            <tr><th scope="row">dω/dk on this lattice</th><td>{fmt(pp.vLat, 3)} c</td><td>group velocity of the lattice equations</td></tr>
            <tr><th scope="row">measured v of the packet</th><td>{ro.packets === 1 ? fmt(ro.vMeas, 3) + ' c' : 'launch one packet'}</td><td>straight-line fit to the energy centroid over the last 60 time units</td></tr>
            <tr><th scope="row">phase velocity ω/k</th><td>{m > 0 ? fmt(pp.phase, 3) + ' c' : '1 c'}</td><td>speed of the crests: above c when m &gt; 0, never carrying energy</td></tr>
            <tr><th scope="row">γ = E/m</th><td>{m > 0 ? fmt(pp.gamma, 3) : '∞ (massless)'}</td><td>how relativistic the packet is</td></tr>
          </tbody>
        </table>
        <p class="note ui">
          With m = 0 every packet moves at exactly c, whatever its momentum. With m &gt; 0, slow packets move slowly, fast ones approach c, and p/E is the velocity of the packet you launched. Nothing here was built in as a particle: only oscillators coupled to their neighbours.
        </p>
      {:else}
        <p class="note ui">
          Each normal mode (a plane wave of wave number q) is an independent oscillator of frequency ω<sub>q</sub>, with classical energy E<sub>q</sub> = ½|π̃<sub>q</sub>|² + ½ω<sub>q</sub>²|φ̃<sub>q</sub>|². For the free field (λ = 0) every bar stays put as the packets move: the modes do not exchange energy. Turn λ up and they do.
        </p>
        <Plot
          height={220}
          label="Energy in each normal mode of the chain against wave number q"
          x={{ domain: [0, Math.PI], label: 'wave number q', ticks: 6, format: (v) => v.toFixed(1) }}
          y={{ domain: [0, modeBars.max * 1.1], label: 'mode energy E_q', ticks: 4, format: (v) => v.toPrecision(2) }}
        >
          {#snippet marks({ sx, sy })}
            {#each modeBars.bars as b}
              <line x1={sx(b.q)} x2={sx(b.q)} y1={sy(0)} y2={sy(b.e)} stroke="var(--series-1)" stroke-width="2" />
            {/each}
          {/snippet}
        </Plot>
      {/if}
    {:else}
      <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
      <canvas
        bind:this={sheetCv}
        class="cv sheet"
        role="img"
        aria-label="A two-dimensional sheet of coupled oscillators. Click or drag on it to pluck the field; rings of waves spread out."
        onpointerdown={sheetDown}
        onpointermove={sheetAt}
      ></canvas>
      <p class="note ui">
        The same equation on a square grid. Pluck it and a ring of waves spreads out at speed c. With m &gt; 0 the ring leaves a ringing wake that oscillates at frequency m (the lowest frequency a massive field can have), and the wavefronts are no longer sharp, because waves of different wavelength travel at different speeds.
      </p>
    {/if}

    <p class="quant ui">
      <strong>What this is, and is not.</strong> This is the <em>classical</em> field: every oscillator has a definite position and velocity, and the energy can take any value. In the quantum field theory each normal mode is a quantum oscillator, whose energy comes in steps of ħω, and the quanta of the field, the particles, are those steps. A coherent quantum state with the same amplitudes would hold on average E<sub>q</sub>/ħω<sub>q</sub> quanta in mode q, but nothing on this page counts quanta or shows quantum fluctuations.
    </p>
  </div>
</Widget>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .cv {
    width: 100%;
    display: block;
    box-shadow: 0 0 0 1px var(--line);
    border-radius: 6px;
    background: var(--panel);
    touch-action: none;
    cursor: crosshair;
  }
  .cv:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .sheet {
    max-width: 420px;
    margin: 0 auto;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }
  .lab {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .readout dl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.4rem;
    margin: 0;
  }
  .readout dl div {
    display: flex;
    gap: 0.4rem;
    align-items: baseline;
  }
  dt {
    font-size: 0.78rem;
    color: var(--mute);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    color: var(--fg);
  }
  dd small {
    color: var(--mute);
  }
  .hint,
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.3rem 0 0;
    line-height: 1.5;
  }
  .quant {
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--ink-2);
    border-left: 3px solid var(--line-strong);
    padding: 0.1rem 0 0.1rem 0.7rem;
    margin: 0.3rem 0 0;
  }
  table {
    border-collapse: collapse;
    font-size: 0.8rem;
    width: 100%;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 0.25rem 0.5rem;
    text-align: left;
    border-bottom: 1px solid var(--line);
    text-transform: none;
    letter-spacing: 0;
    vertical-align: top;
  }
  thead th {
    color: var(--mute);
    font-weight: 500;
  }
  tbody th {
    font-weight: 500;
    color: var(--fg);
  }
  td:nth-child(2) {
    font-family: var(--font-mono);
    white-space: nowrap;
  }
  .key {
    list-style: none;
    margin: 0.3rem 0 0;
    padding: 0;
    font-size: 0.76rem;
    color: var(--ink-2);
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .key li {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    margin: 0 !important;
  }
  .sw {
    flex: none;
    display: inline-block;
    width: 22px;
    height: 0;
    border-top: 2px solid var(--series-2);
    transform: translateY(-3px);
  }
  .sw.dash {
    border-top-style: dashed;
  }
  .sw.solid {
    border-top-color: var(--fg);
    border-top-width: 1.5px;
  }
  .sw.dots {
    border-top: 3px dotted var(--series-3);
  }
  .sw.ring {
    border-top-color: var(--series-7);
  }
  @media (max-width: 420px) {
    .btns :global(.btn) {
      flex: 1 1 auto;
    }
  }
</style>
