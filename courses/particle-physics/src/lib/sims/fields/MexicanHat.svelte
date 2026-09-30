<!--
  The Mexican hat (Chapter 26): V(φ) = −μ²|φ|² + λ|φ|⁴ over the complex plane of φ, drawn as an orthographic surface
  (Canvas 2D; orbit with the mouse or the arrow keys). A damped ball rolls on it: the symmetric point at the top is
  unstable, and the ball settles somewhere on the circle of minima |φ| = v/√2. Kick it radially (it oscillates: the massive
  Higgs mode, m_H² = 2λv²) or round the brim (no restoring force: the massless Goldstone mode). Flip the sign of μ² and the
  hat becomes a bowl.

    ::mexican-hat{n="26.1" caption="…"}

  Dimensionless variables: z = φ/(v₀/√2) (so the brim of the real hat is |z| = 1), time in units of 1/m_H, s = μ²/μ₀².
  The numerics are in `hep/fields/higgs.ts`; the projection in `view3d.ts`.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { rng } from '$lib/hep/random';
  import { HatBall, hatU, lambdaFromMass, M_HIGGS_GEV, V_EW_GEV } from '$lib/hep/fields';
  import { fitCanvas, fmt, mix, parseRGB, prefersReducedMotion, readPalette, watchTheme, watchVisible, type RGB } from './canvas';
  import { polarMesh, project, shade } from './view3d';

  let { n, caption, title = 'The Mexican hat: a ball, a symmetry and a choice' }: { n?: string | number; caption?: string; title?: string } = $props();

  // physical numbers (the real Higgs potential, s = 1)
  const lambda = lambdaFromMass(M_HIGGS_GEV, V_EW_GEV);
  const mu0 = M_HIGGS_GEV / Math.SQRT2;

  let s = $state(1); // μ²/μ₀²
  let friction = $state(0.15);
  let az = $state(0.6);
  let el = $state(0.5);
  let playing = $state(true);
  let seed = $state(1);
  let reduced = $state(false);

  const H = 340;
  const R_MAX = 1.35;
  const H_SCALE = 3.2;
  const hfun = (r: number) => H_SCALE * hatU(r, 0, s);

  let ball = new HatBall(0.03, 0.02, 1, 0.15);
  let trail: { x: number; y: number }[] = [];
  const rad: number[] = [];
  const angl: number[] = [];
  const TMAX = 360;
  let ro = $state({ r: 0.04, a: 0.6, E: 0, t: 0 });
  let host = $state<HTMLDivElement>();
  let cv = $state<HTMLCanvasElement>();
  let width = $state(340);
  let raf = 0;
  let onScreen = true;
  let meshS = NaN;
  let meshCache: ReturnType<typeof polarMesh> = [];
  let pal = {
    bg: [250, 250, 250] as RGB, line: [170, 170, 170] as RGB, track: [10, 110, 140] as RGB, high: [200, 120, 0] as RGB, ink: 'rgb(60,60,60)', mute: 'rgb(120,120,120)', s7: 'rgb(200,50,50)', fg: 'rgb(20,20,20)',
  };

  function readColours() {
    if (!host) return;
    const c = readPalette(host, { bg: 'var(--panel)', line: 'var(--line-strong)', track: 'var(--track)', high: 'var(--sig-high)', ink: 'var(--ink-2)', mute: 'var(--mute)', s7: 'var(--series-7)', fg: 'var(--fg)' });
    palVersion++;
    pal = { bg: parseRGB(c.bg), line: parseRGB(c.line), track: parseRGB(c.track), high: parseRGB(c.high), ink: c.ink, mute: c.mute, s7: c.s7, fg: c.fg };
  }
  const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  function drop() {
    const r = rng(seed);
    const a = r() * 2 * Math.PI;
    ball = new HatBall(0.04 * Math.cos(a), 0.04 * Math.sin(a), s, friction);
    trail = [];
    rad.length = 0;
    angl.length = 0;
    seed += 1;
  }
  function kick(radial: boolean) {
    ball.kick(radial, radial ? 0.35 : 0.25);
    if (!playing) playing = true;
  }
  function stepMany(k: number) {
    for (let i = 0; i < k; i++) {
      ball.s = s;
      ball.gamma = friction;
      ball.step(0.02);
      if (i % 3 === 0) {
        trail.push({ x: ball.re, y: ball.im });
        if (trail.length > 160) trail.shift();
        rad.push(ball.radius);
        angl.push(ball.angle);
        if (rad.length > TMAX) {
          rad.shift();
          angl.shift();
        }
      }
    }
  }
  let lastRo = 0;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!host || !onScreen || host.offsetParent === null) return;
    if (playing) stepMany(3);
    draw();
    if (now - lastRo > 150) {
      lastRo = now;
      ro = { r: ball.radius, a: ball.angle, E: ball.energy(), t: ball.t };
    }
  }

  // The surface is expensive to paint (about 1000 cells), so it is painted once into an offscreen canvas and only repainted when
  // the view, μ² or the colours change. Each frame then copies it and draws the ball and its trail on top.
  let surf: HTMLCanvasElement | null = null;
  let surfKey = '';
  let palVersion = 0;
  let view = { sc: 1, ox: 0, oy: 0 };
  const proj = (x: number, y: number, z: number) => {
    const p = project({ x, y, z }, az, el);
    return { x: view.ox + p.X * view.sc, y: view.oy - p.Y * view.sc, depth: p.depth };
  };

  function paintSurface(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = css(pal.bg);
    ctx.fillRect(0, 0, width, H);
    if (meshS !== s) {
      meshCache = polarMesh(hfun, R_MAX, 18, 40);
      meshS = s;
    }
    const quads = meshCache;
    // fit to the canvas: the bounding box of the projected surface
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const q of quads)
      for (const p of q.pts) {
        const pr = project(p, az, el);
        minX = Math.min(minX, pr.X); maxX = Math.max(maxX, pr.X);
        minY = Math.min(minY, pr.Y); maxY = Math.max(maxY, pr.Y);
      }
    const sc = Math.min((width - 24) / (maxX - minX), (H - 40) / (maxY - minY));
    view = { sc, ox: width / 2 - ((minX + maxX) / 2) * sc, oy: H / 2 + ((minY + maxY) / 2) * sc + 6 };
    const light = { x: -0.4, y: -0.5, z: 1 };
    let zLo = Infinity, zHi = -Infinity;
    for (const q of quads) {
      zLo = Math.min(zLo, q.zMean);
      zHi = Math.max(zHi, q.zMean);
    }
    const order = quads
      .map((q) => ({ q, depth: q.pts.reduce((a, p) => a + project(p, az, el).depth, 0) / 4 }))
      .sort((a, b) => a.depth - b.depth);
    for (const { q } of order) {
      const t = (q.zMean - zLo) / (zHi - zLo || 1);
      const lit = 0.35 + 0.65 * shade(q.normal, light);
      const checker = (q.i + q.j) % 2 ? 0.9 : 1; // the cells' alternating tone shows the polar grid without any stroked lines
      const base = mix(mix(pal.bg, pal.track, 0.12 + 0.3 * t), mix(pal.bg, pal.track, 0.95), lit * 0.75 * checker);
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const p = proj(q.pts[k]!.x, q.pts[k]!.y, q.pts[k]!.z);
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = css(base);
      ctx.fill();
    }
    // the circle of minima, drawn over the surface so that a wall never hides it
    const rim = s > 0 ? Math.sqrt(s) : 0;
    if (rim > 0 && rim < R_MAX) {
      ctx.beginPath();
      for (let i = 0; i <= 72; i++) {
        const t = (i / 72) * 2 * Math.PI;
        const p = proj(rim * Math.cos(t), rim * Math.sin(t), hfun(rim) + 0.012);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = css(pal.high);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // axes key
    ctx.fillStyle = pal.mute;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(s > 0 ? 'V(φ) = −μ²|φ|² + λ|φ|⁴   (μ² > 0: a hat)' : 'V(φ) = −μ²|φ|² + λ|φ|⁴   (μ² < 0: a bowl)', 8, 14);
    const a0 = proj(0, 0, hfun(0));
    const axis = (x: number, y: number, label: string) => {
      const p = proj(x, y, hfun(0));
      ctx.strokeStyle = css(pal.line, 0.9);
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = pal.ink;
      ctx.fillText(label, p.x + 3, p.y - 3);
    };
    axis(R_MAX * 0.9, 0, 'Re φ');
    axis(0, R_MAX * 0.9, 'Im φ');
  }

  function draw() {
    if (!cv) return;
    const ctx = fitCanvas(cv, width, H);
    if (!ctx) return;
    const key = `${az.toFixed(3)}|${el.toFixed(3)}|${s.toFixed(3)}|${width}|${palVersion}`;
    if (!surf) surf = document.createElement('canvas');
    if (key !== surfKey) {
      const sctx = fitCanvas(surf, width, H);
      if (sctx) paintSurface(sctx);
      surfKey = key;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(surf, 0, 0);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // trail and ball
    ctx.beginPath();
    trail.forEach((p, i) => {
      const q = proj(p.x, p.y, hfun(Math.hypot(p.x, p.y)) + 0.03);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.strokeStyle = css(pal.high, 0.85);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    const bp = proj(ball.re, ball.im, hfun(Math.min(R_MAX, ball.radius)) + 0.07);
    const rr = 7;
    const g = ctx.createRadialGradient(bp.x - 2, bp.y - 2, 1, bp.x, bp.y, rr);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, pal.s7);
    g.addColorStop(1, pal.fg);
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, rr, 0, 6.3);
    ctx.fillStyle = g;
    ctx.fill();
    if (document.activeElement === cv) {
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, width - 1, H - 1);
    }
  }

  // orbit
  let drag: { x: number; y: number } | null = null;
  function down(e: PointerEvent) {
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY };
  }
  function move(e: PointerEvent) {
    if (!drag) return;
    az += (e.clientX - drag.x) * 0.01;
    el = Math.max(0.08, Math.min(1.5, el + (e.clientY - drag.y) * 0.008));
    drag = { x: e.clientX, y: e.clientY };
  }
  function up() {
    drag = null;
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') az -= 0.12;
    else if (e.key === 'ArrowRight') az += 0.12;
    else if (e.key === 'ArrowUp') el = Math.min(1.5, el + 0.08);
    else if (e.key === 'ArrowDown') el = Math.max(0.08, el - 0.08);
    else return;
    e.preventDefault();
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
    ball = new HatBall(0.03, 0.02, s, friction);
    // a short warm-up so that the first picture is not the ball at rest at the top
    stepMany(0);
    draw();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      off();
      offVis();
    };
  });
  $effect(() => {
    void [az, el, s, width];
    if (host) draw();
  });

  // numbers
  const v = $derived(s > 0 ? V_EW_GEV * Math.sqrt(s) : 0);
  const mH = $derived(s > 0 ? M_HIGGS_GEV * Math.sqrt(s) : 0);
  const mBowl = $derived(Math.sqrt(Math.max(0, -s)) * mu0);
  const lambdaCheck = $derived(s > 0 ? (mH * mH) / (2 * v * v) : NaN);

  function sparkPath(a: number[], lo: number, hi: number, w: number, h: number, wrap = false): string {
    if (a.length < 2) return '';
    let d = '';
    for (let i = 0; i < a.length; i++) {
      const x = (i / (TMAX - 1)) * w;
      const y = h - ((a[i]! - lo) / (hi - lo || 1)) * h;
      const jump = wrap && i > 0 && Math.abs(a[i]! - a[i - 1]!) > Math.PI;
      d += `${i === 0 || jump ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return d;
  }
  const radMax = $derived(Math.max(1.3, Math.sqrt(Math.max(s, 0.01)) * 1.4));
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Slider
      bind:value={s}
      min={-1}
      max={1.2}
      step={0.05}
      label="μ² in units of its real value (88.5 GeV)². Below 0 the hat becomes a bowl"
      format={(x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2)}
      oninput={() => {
        ball.s = s;
      }}
    />
    <Slider bind:value={friction} min={0} max={0.8} step={0.01} label="Friction" />
  {/snippet}

  <div class="wrap" bind:this={host} bind:clientWidth={width}>
    <div class="btns ui">
      <Button size="sm" variant="primary" onclick={drop}>Drop the ball near the top</Button>
      <Button size="sm" onclick={() => kick(true)}>Kick it outwards or inwards (radial)</Button>
      <Button size="sm" onclick={() => kick(false)}>Kick it round the brim (angular)</Button>
      <Button size="sm" onclick={() => (playing = !playing)} aria-pressed={playing}>{playing ? 'Pause' : 'Play'}</Button>
      {#if !playing}<Button size="sm" onclick={() => { stepMany(30); draw(); }}>Step</Button>{/if}
      <Button size="sm" variant="ghost" onclick={() => { az = 0.6; el = 0.5; }}>Reset view</Button>
    </div>
    <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
    <canvas
      bind:this={cv}
      class="cv"
      tabindex="0"
      role="application"
      aria-label="The Mexican-hat potential as a three-dimensional surface with a ball on it. Drag to turn the view; with the keyboard use the arrow keys."
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
      onkeydown={key}
      onfocus={() => draw()}
      onblur={() => draw()}
    ></canvas>

    <div class="cols">
      <div class="charts ui" aria-hidden="false">
        <figure>
          <svg viewBox="0 0 {TMAX} 60" role="img" aria-label="Radius of the ball against time">
            <line x1="0" x2={TMAX} y1={60 - (Math.sqrt(Math.max(s, 0)) / radMax) * 60} y2={60 - (Math.sqrt(Math.max(s, 0)) / radMax) * 60} class="ref" />
            <path d={sparkPath(rad, 0, radMax, TMAX, 60)} class="tr r" />
          </svg>
          <figcaption>Radius |φ| of the ball (dashed: the brim). A radial kick rings at the Higgs mass, and the ringing dies away with friction.</figcaption>
        </figure>
        <figure>
          <svg viewBox="0 0 {TMAX} 60" role="img" aria-label="Angle of the ball round the brim against time">
            <path d={sparkPath(angl, -Math.PI, Math.PI, TMAX, 60, true)} class="tr a" />
          </svg>
          <figcaption>Angle arg φ of the ball. An angular kick never rings: nothing pushes the ball back, so it just keeps going round until friction stops it. That is a massless mode.</figcaption>
        </figure>
      </div>

      <div class="numbers ui" aria-live="polite">
        {#if s > 0}
          <dl>
            <div><dt>minimum at</dt><dd>|φ| = v/√2 = {fmt(v / Math.SQRT2, 4)} GeV, v = {fmt(v, 4)} GeV</dd></div>
            <div><dt>radial mode (up the side)</dt><dd>m<sub>H</sub>² = 2λv² = 2μ², m<sub>H</sub> = {fmt(mH, 4)} GeV</dd></div>
            <div><dt>angular mode (round the brim)</dt><dd>m = 0: the Goldstone boson</dd></div>
            <div><dt>ball now</dt><dd>|φ| = {fmt(ro.r * (V_EW_GEV / Math.SQRT2), 3)} GeV, angle {fmt((ro.a * 180) / Math.PI, 3)}°</dd></div>
          </dl>
        {:else}
          <dl>
            <div><dt>minimum at</dt><dd>φ = 0: the symmetry is unbroken, v = 0</dd></div>
            <div><dt>both modes</dt><dd>the same mass² = −μ² = {fmt(-s * mu0 * mu0, 4)} GeV², m = {fmt(mBowl, 3)} GeV: no Goldstone boson</dd></div>
          </dl>
        {/if}
      </div>
    </div>

    <div class="lambda ui">
      <p>
        <strong>The one number that is measured.</strong> With the real values v = {fmt(V_EW_GEV, 5)} GeV (from the Fermi constant of the weak interaction) and m<sub>H</sub> = {fmt(M_HIGGS_GEV, 4)} GeV, the formula m<sub>H</sub>² = 2λv² gives
        <span class="big">λ = m<sub>H</sub>²/(2v²) = {fmt(lambda, 3)}</span>,
        the strength of the Higgs field's interaction with itself, and μ = m<sub>H</sub>/√2 = {fmt(mu0, 3)} GeV. Nobody predicted λ; it was worked out from m<sub>H</sub> once that was measured. {#if s > 0 && Math.abs(s - 1) > 1e-6}At this μ² the same λ gives v = {fmt(v, 4)} GeV and m<sub>H</sub> = {fmt(mH, 4)} GeV: both scale as √μ², so the masses of the W and Z, which are proportional to v, would scale too.{/if}
      </p>
      <p>
        <strong>Why sign matters, and an analogy.</strong> When μ² is positive the symmetric point is a hilltop: the lowest-energy states break the symmetry by picking one direction round the brim, though the equations treat every direction alike. When μ² is negative there is a single minimum in the middle and the symmetry is intact. A ferromagnet does something like it: above the Curie temperature the atoms' spins point every which way and there is no preferred direction; below it they line up along one chosen direction. In the early universe the Higgs field is thought to have sat at the middle of a bowl at very high temperature, and to have rolled into the brim as the universe cooled. The slider is the analogy, not a calculation of that transition.
      </p>
      <details>
        <summary>Where m<sub>H</sub>² = 2λv² comes from</summary>
        <p>
          Write φ = (v + h)e<sup>iθ</sup>/√2 with v² = μ²/λ. Then |φ|² = (v + h)²/2 and V = −μ²(v+h)²/2 + λ(v+h)⁴/4. Expanding to second order in h, the terms linear in h cancel (that is what being at the minimum means), and what is left is V ≈ const + ½(2λv²)h². A field with potential ½m²h² has mass m, so m<sub>H</sub>² = 2λv² = 2μ². The angle θ does not appear in V at all, so it has no mass term: m = 0.
        </p>
      </details>
    </div>
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
    cursor: grab;
  }
  .cv:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .cv:active {
    cursor: grabbing;
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem;
  }
  @media (max-width: 760px) {
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  figure {
    margin: 0 0 0.5rem;
  }
  figure svg {
    width: 100%;
    height: 60px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 4px;
    display: block;
  }
  figcaption {
    font-size: 0.74rem;
    color: var(--ink-2);
    line-height: 1.4;
    margin-top: 0.2rem;
  }
  .tr {
    fill: none;
    stroke-width: 1.6;
    vector-effect: non-scaling-stroke;
  }
  .tr.r {
    stroke: var(--series-1);
  }
  .tr.a {
    stroke: var(--series-4);
  }
  .ref {
    stroke: var(--sig-high);
    stroke-dasharray: 4 3;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  dl {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  dt {
    font-size: 0.74rem;
    color: var(--mute);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--fg);
  }
  .lambda {
    font-size: 0.82rem;
    line-height: 1.55;
    color: var(--ink-2);
    border-top: 1px solid var(--line);
    padding-top: 0.6rem;
  }
  .lambda p {
    margin: 0.3rem 0;
  }
  .big {
    font-family: var(--font-mono);
    color: var(--fg);
    white-space: nowrap;
  }
  summary {
    cursor: pointer;
    color: var(--fg);
    font-weight: 500;
  }
  summary:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
