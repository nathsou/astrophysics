<!--
  Lattice gauge demo (Chapter 17, optional): two-dimensional compact U(1) gauge theory by Monte Carlo.

    ::lattice-gauge{n="17.3" caption="…"}

  Link angles θ on an L × L torus, action S = β Σ_p (1 − cos θ_p), Metropolis or heat-bath updates (seeded). Shown: the
  average plaquette ⟨cos θ_p⟩ against the exact I₁(β)/I₀(β), and Wilson loops ⟨W(R,T)⟩ = exp(−σ·RT) plotted as ln W
  against the area RT (the area law, which in two dimensions is exact at every coupling).

  The CPU path is complete (32 × 32 at several hundred sweeps a second). WebGPU, where the browser has it, can run the
  Metropolis update on a 256 × 256 lattice: optional. The numerics are in `hep/fields/u1lattice.ts` and `bessel.ts`.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { rng } from '$lib/hep/random';
  import { U1Lattice, exactPlaquette, exactStringTension, exactWilson, blockStats, metropolisDelta } from '$lib/hep/fields';
  import { diverging, fitCanvas, fmt, parseRGB, prefersReducedMotion, readPalette, watchTheme, watchVisible, type RGB } from './canvas';
  import { gpuAvailable, GpuU1 } from './gpu';

  let { n, caption, title = 'A lattice gauge theory you can run' }: { n?: string | number; caption?: string; title?: string } = $props();

  const LOOPS: [number, number][] = [[1, 1], [1, 2], [2, 2], [1, 3], [2, 3], [3, 3], [1, 4], [2, 4], [3, 4], [4, 4]];
  const BLOCK = 10;
  const THERM = 40;
  const GPU_L = 256;

  let beta = $state(1.5);
  let algo = $state<'hb' | 'met'>('hb');
  let size = $state(32);
  let backend = $state<'cpu' | 'gpu'>('cpu');
  let playing = $state(true);
  let spf = $state(2);
  let seed = $state(1);
  let hasGpu = $state(false);
  let gpuMsg = $state('');
  let scanning = $state(false);
  let scanProgress = $state(0);
  let scan = $state<{ beta: number; mean: number; err: number }[]>([]);
  let reduced = $state(false);

  // simulation state (plain)
  let lat = new U1Lattice(32, rng(1));
  let mirror: U1Lattice | null = null; // holds a read-back of the GPU links
  let gpu: GpuU1 | null = null;
  let gpuBusy = false;
  let sweepsDone = 0;
  let accRate = NaN;
  const acc = LOOPS.map(() => ({ sum: 0, cnt: 0, blocks: [] as number[] }));
  let nMeas = 0;
  let lastRateT = 0;
  let lastRateSweeps = 0;
  let rate = $state(0);
  let res = $state<{ mean: number; err: number }[]>(LOOPS.map(() => ({ mean: NaN, err: NaN })));
  let resN = $state(0);
  let accShown = $state(NaN);
  let sweepsShown = $state(0);

  let host = $state<HTMLDivElement>();
  let cv = $state<HTMLCanvasElement>();
  let width = $state(340);
  let onScreen = true;
  let raf = 0;
  let off: HTMLCanvasElement | null = null;
  let pal = { bg: [250, 250, 250] as RGB, neg: [60, 110, 210] as RGB, pos: [212, 87, 59] as RGB, ink: 'rgb(60,60,60)' };

  function readColours() {
    if (!host) return;
    const c = readPalette(host, { bg: 'var(--panel)', neg: 'var(--volt-neg)', pos: 'var(--volt-pos)', ink: 'var(--ink-2)' });
    pal = { bg: parseRGB(c.bg), neg: parseRGB(c.neg), pos: parseRGB(c.pos), ink: c.ink };
  }

  function resetStats() {
    for (const a of acc) {
      a.sum = 0;
      a.cnt = 0;
      a.blocks = [];
    }
    nMeas = 0;
    sweepsDone = 0;
    res = LOOPS.map(() => ({ mean: NaN, err: NaN }));
    resN = 0;
  }
  function newLattice(hot = false) {
    resetStats();
    if (backend === 'cpu') {
      lat = new U1Lattice(size, rng(seed), hot);
    } else if (gpu) {
      gpu.cold();
    }
    seed += 1;
  }
  $effect(() => {
    void [size, beta, algo];
    if (backend === 'cpu') resetStats();
  });
  $effect(() => {
    const sz = size;
    if (backend === 'cpu') lat = new U1Lattice(sz, rng(untrack(() => seed)), false);
  });

  async function chooseBackend(b: 'cpu' | 'gpu') {
    gpuMsg = '';
    if (b === 'gpu') {
      try {
        gpu?.destroy();
        gpu = await GpuU1.create(GPU_L, seed);
        mirror = new U1Lattice(GPU_L, rng(1));
        backend = 'gpu';
        algo = 'met';
        resetStats();
      } catch (e) {
        gpuMsg = `WebGPU could not start (${e instanceof Error ? e.message : String(e)}); staying on the CPU.`;
        backend = 'cpu';
      }
    } else {
      gpu?.destroy();
      gpu = null;
      backend = 'cpu';
      resetStats();
    }
  }

  function measureFrom(l: U1Lattice, window: number) {
    for (let i = 0; i < LOOPS.length; i++) {
      const [R, T] = LOOPS[i]!;
      const w = l.wilsonLoop(R, T, window);
      const a = acc[i]!;
      a.sum += w;
      a.cnt++;
      if (a.cnt === BLOCK) {
        a.blocks.push(a.sum / BLOCK);
        a.sum = 0;
        a.cnt = 0;
      }
    }
    nMeas++;
  }
  function publish() {
    res = acc.map((a) => (a.blocks.length >= 6 ? blockStats(a.blocks, a.blocks.length) : { mean: a.blocks.length ? a.blocks[0]! : NaN, err: Infinity }));
    resN = nMeas;
    accShown = accRate;
    sweepsShown = sweepsDone;
  }

  function runCpu(k: number) {
    const d = metropolisDelta(beta);
    for (let i = 0; i < k; i++) {
      if (algo === 'hb') {
        lat.sweepHeatbath(beta);
        accRate = 1;
      } else accRate = lat.sweepMetropolis(beta, d, 2);
      sweepsDone++;
      if (sweepsDone > THERM && sweepsDone % 2 === 0) measureFrom(lat, lat.L);
    }
  }
  function runGpu(k: number) {
    if (!gpu || gpuBusy) return;
    gpuBusy = true;
    gpu.sweeps(k, beta, metropolisDelta(beta), 2);
    sweepsDone += k;
    gpu
      .read()
      .then((links) => {
        if (links && mirror) {
          mirror.loadLinks(links);
          if (sweepsDone > THERM) measureFrom(mirror, 48);
        }
      })
      .catch((e) => {
        gpuMsg = `WebGPU failed (${e instanceof Error ? e.message : String(e)}); back on the CPU.`;
        chooseBackend('cpu');
      })
      .finally(() => (gpuBusy = false));
  }

  // the β scan on a small CPU lattice, in chunks so that the page stays responsive
  const SCAN_BETAS = Array.from({ length: 24 }, (_, i) => 0.2 + i * 0.22);
  let scanState: { i: number; lat: U1Lattice; vals: number[]; sweeps: number } | null = null;
  function startScan() {
    scan = [];
    scanning = true;
    scanProgress = 0;
    scanState = { i: 0, lat: new U1Lattice(16, rng(1000 + seed)), vals: [], sweeps: 0 };
    seed += 1;
  }
  function scanStep() {
    const st = scanState;
    if (!st) return;
    const b = SCAN_BETAS[st.i]!;
    for (let k = 0; k < 60; k++) {
      st.lat.sweepHeatbath(b);
      st.sweeps++;
      if (st.sweeps > 30) st.vals.push(st.lat.meanPlaquette());
    }
    if (st.vals.length >= 240) {
      const bs = blockStats(st.vals, 12);
      scan = [...scan, { beta: b, mean: bs.mean, err: bs.err }];
      st.i++;
      st.vals = [];
      st.sweeps = 0;
      scanProgress = st.i / SCAN_BETAS.length;
      if (st.i >= SCAN_BETAS.length) {
        scanning = false;
        scanState = null;
      }
    }
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!host || !onScreen || host.offsetParent === null) return;
    if (scanning) scanStep();
    else if (playing) {
      if (backend === 'cpu') runCpu(spf);
      else runGpu(Math.max(1, spf));
    }
    draw();
    if (now - lastRateT > 500) {
      if (lastRateT) rate = Math.round(((sweepsDone - lastRateSweeps) / (now - lastRateT)) * 1000);
      lastRateT = now;
      lastRateSweeps = sweepsDone;
      publish();
    }
  }

  const CV = 260;
  function draw() {
    if (!cv) return;
    const S = Math.min(width, CV);
    const ctx = fitCanvas(cv, S, S, true);
    if (!ctx) return;
    const src = backend === 'gpu' && mirror ? mirror : lat;
    const L = src.L;
    if (!off || off.width !== L) {
      off = document.createElement('canvas');
      off.width = L;
      off.height = L;
    }
    const octx = off.getContext('2d')!;
    const img = octx.createImageData(L, L);
    for (let y = 0; y < L; y++)
      for (let x = 0; x < L; x++) {
        const c = diverging(src.plaquetteAngle(x, y) / Math.PI, pal.neg, pal.bg, pal.pos);
        const o = (y * L + x) * 4;
        img.data[o] = c[0];
        img.data[o + 1] = c[1];
        img.data[o + 2] = c[2];
        img.data[o + 3] = 255;
      }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, S, S);
  }

  onMount(() => {
    reduced = prefersReducedMotion();
    if (reduced) playing = false;
    hasGpu = gpuAvailable();
    readColours();
    const offTheme = watchTheme(() => {
      readColours();
      draw();
    });
    const offVis = watchVisible(host!, (v) => (onScreen = v));
    // a first burst so that the page opens with numbers
    runCpu(60);
    publish();
    draw();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      offTheme();
      offVis();
      gpu?.destroy();
    };
  });
  $effect(() => {
    void [width, backend];
    if (host) draw();
  });

  // ── derived theory and plot data ──
  const exactP = $derived(exactPlaquette(beta));
  const sigma = $derived(exactStringTension(beta));
  const curve = Array.from({ length: 121 }, (_, i) => 0.02 + (i / 120) * 5.98);
  const live = $derived(res[0]!);
  const loopPts = $derived(
    LOOPS.map(([R, T], i) => ({ R, T, A: R * T, m: res[i]!.mean, e: res[i]!.err }))
      .filter((p) => Number.isFinite(p.m) && p.m > 4 * p.e && p.m > 0 && p.e < Infinity)
      .map((p) => ({ ...p, y: Math.log(p.m), ey: p.e / p.m })),
  );
  // the measured slope: least squares through the origin, ln W = −σ A, weighted by 1/ey²
  const fitSigma = $derived.by(() => {
    let num = 0;
    let den = 0;
    for (const p of loopPts) {
      const w = 1 / Math.max(1e-6, p.ey * p.ey);
      num += w * p.A * -p.y;
      den += w * p.A * p.A;
    }
    return den > 0 ? { sigma: num / den, err: Math.sqrt(1 / den) } : null;
  });
  const maxArea = $derived(Math.max(6, ...loopPts.map((p) => p.A + 1)));
  const yMin = $derived(Math.min(-4, Math.floor(Math.min(...loopPts.map((p) => p.y - p.ey), -sigma * 4) - 0.5)));
  const pathTheory = (sx: (v: number) => number, sy: (v: number) => number) => curve.map((b, i) => `${i ? 'L' : 'M'}${sx(b).toFixed(1)},${sy(exactPlaquette(b)).toFixed(1)}`).join('');
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Slider bind:value={beta} min={0.1} max={6} step={0.05} label="Coupling β = 1/g² (small β = strong coupling)" />
    <Segmented
      label="Update"
      size="sm"
      bind:value={algo}
      options={[
        { value: 'hb', label: 'Heat bath', title: 'Exact draw from the conditional distribution (CPU only)' },
        { value: 'met', label: 'Metropolis' },
      ]}
    />
    {#if backend === 'cpu'}
      <Segmented
        label="Lattice size"
        size="sm"
        bind:value={size}
        options={[
          { value: 16, label: '16×16' },
          { value: 32, label: '32×32' },
          { value: 64, label: '64×64' },
        ]}
      />
    {/if}
  {/snippet}

  <div class="wrap" bind:this={host} bind:clientWidth={width}>
    <div class="btns ui">
      <Button size="sm" variant="primary" onclick={() => (playing = !playing)} aria-pressed={playing}>{playing ? 'Pause' : 'Run'}</Button>
      {#if !playing}<Button size="sm" onclick={() => (backend === 'cpu' ? (runCpu(10), publish(), draw()) : runGpu(10))}>10 sweeps</Button>{/if}
      <Button size="sm" onclick={() => newLattice(false)}>Cold start (all links 0)</Button>
      {#if backend === 'cpu'}<Button size="sm" onclick={() => newLattice(true)}>Hot start (random links)</Button>{/if}
      <Button size="sm" onclick={startScan} disabled={scanning}>{scanning ? `Scanning β… ${(scanProgress * 100).toFixed(0)}%` : 'Scan β (16×16, heat bath)'}</Button>
      {#if hasGpu}
        <Button size="sm" onclick={() => chooseBackend(backend === 'cpu' ? 'gpu' : 'cpu')}>{backend === 'cpu' ? 'Try WebGPU, 256×256 (optional)' : 'Back to the CPU'}</Button>
      {/if}
    </div>
    {#if gpuMsg}<p class="note ui">{gpuMsg}</p>{/if}
    {#if !hasGpu}<p class="note ui">This browser has no WebGPU: the CPU path is used. It is complete; WebGPU would only allow a bigger lattice.</p>{/if}

    <div class="top">
      <div class="pic">
        <canvas bind:this={cv} class="cv" aria-label="The plaquette angle on every square of the lattice: neutral where the link angles nearly cancel round the square, warm or cool where they do not"></canvas>
        <p class="cap ui">Plaquette angle θ<sub>p</sub> on each square, from −π (cool) through 0 (neutral) to +π (warm). Strong coupling: random. Weak coupling: nearly all neutral.</p>
      </div>
      <div class="nums ui" aria-live="polite">
        <dl>
          <div><dt>lattice</dt><dd>{backend === 'cpu' ? `${size}×${size}` : `${GPU_L}×${GPU_L}`} · {backend === 'cpu' ? 'CPU' : 'WebGPU'} · {backend === 'cpu' && algo === 'hb' ? 'heat bath' : 'Metropolis'}</dd></div>
          <div><dt>speed</dt><dd>{rate} sweeps/s</dd></div>
          <div><dt>sweeps, measurements</dt><dd>{sweepsShown.toLocaleString('en-GB')} · {resN}</dd></div>
          {#if algo === 'met' && backend === 'cpu'}<div><dt>Metropolis acceptance</dt><dd>{Number.isFinite(accShown) ? (accShown * 100).toFixed(0) + ' %' : '–'}</dd></div>{/if}
          <div><dt>⟨cos θ<sub>p</sub>⟩ measured</dt><dd>{Number.isFinite(live.mean) ? fmt(live.mean, 4) : '…'} {Number.isFinite(live.err) && live.err < 1 ? '± ' + fmt(live.err, 2) : ''}</dd></div>
          <div><dt>exact I₁(β)/I₀(β)</dt><dd>{fmt(exactP, 4)}</dd></div>
          <div><dt>string tension σ = −ln(I₁/I₀)</dt><dd>{fmt(sigma, 4)}{fitSigma ? ` · from the loops: ${fmt(fitSigma.sigma, 3)} ± ${fmt(fitSigma.err, 1)}` : ''}</dd></div>
        </dl>
        <div class="spf"><Slider bind:value={spf} min={1} max={10} step={1} label="Sweeps per frame" format={(v) => v.toFixed(0)} /></div>
      </div>
    </div>

    <div class="plots">
      <div>
        <h5 class="ui">The plaquette against the coupling</h5>
        <Plot
          height={230}
          label="Average plaquette against the coupling beta: the exact curve I1 over I0 rising from zero to one, with Monte Carlo points from the scan and the live measurement."
          x={{ domain: [0, 6], label: 'coupling β', ticks: 6 }}
          y={{ domain: [0, 1], label: '⟨cos θ_p⟩', ticks: 5 }}
        >
          {#snippet marks({ sx, sy })}
            <path d={pathTheory(sx, sy)} class="line" stroke="var(--series-2)" />
            {#each scan as p}
              <line x1={sx(p.beta)} x2={sx(p.beta)} y1={sy(p.mean - p.err)} y2={sy(p.mean + p.err)} stroke="var(--series-1)" stroke-width="1.5" />
              <circle cx={sx(p.beta)} cy={sy(p.mean)} r="3.2" fill="var(--series-1)" />
            {/each}
            {#if Number.isFinite(live.mean)}
              <rect x={sx(beta) - 5} y={sy(live.mean) - 5} width="10" height="10" fill="none" stroke="var(--series-7)" stroke-width="2" transform="rotate(45 {sx(beta)} {sy(live.mean)})" />
            {/if}
          {/snippet}
        </Plot>
        <ul class="key ui">
          <li><span class="sw line"></span> exact, infinite volume: I₁(β)/I₀(β)</li>
          <li><span class="sw dot"></span> Monte Carlo scan (16×16), error bars from blocks of sweeps</li>
          <li><span class="sw dia"></span> live run at the current β</li>
        </ul>
      </div>
      <div>
        <h5 class="ui">Wilson loops: ln W against the area</h5>
        <Plot
          height={230}
          label="Natural logarithm of the average Wilson loop against the area of the loop, with the exact straight line of slope minus sigma through the origin."
          x={{ domain: [0, maxArea], label: 'area R × T of the loop', ticks: 6 }}
          y={{ domain: [yMin, 0.3], label: 'ln ⟨W(R, T)⟩', ticks: 5 }}
        >
          {#snippet marks({ sx, sy })}
            <line x1={sx(0)} y1={sy(0)} x2={sx(maxArea)} y2={sy(-sigma * maxArea)} class="line" stroke="var(--series-2)" />
            {#each loopPts as p}
              <line x1={sx(p.A)} x2={sx(p.A)} y1={sy(p.y - p.ey)} y2={sy(p.y + p.ey)} stroke="var(--series-1)" stroke-width="1.5" />
              {#if p.R === p.T}
                <rect x={sx(p.A) - 4} y={sy(p.y) - 4} width="8" height="8" fill="var(--series-1)" />
              {:else}
                <circle cx={sx(p.A)} cy={sy(p.y)} r="3.5" fill="var(--series-1)" />
              {/if}
            {/each}
          {/snippet}
        </Plot>
        <ul class="key ui">
          <li><span class="sw line"></span> exact: ln W = −σ · area, with σ = −ln(I₁/I₀) at this β</li>
          <li><span class="sw sq"></span> square loops (R = T)</li>
          <li><span class="sw dot"></span> rectangles (R ≠ T). Loops whose signal is still smaller than a few times its error are left out.</li>
        </ul>
      </div>
    </div>

    <div class="text ui">
      <p>
        <strong>What a Wilson loop is.</strong> W(R, T) is the product of the link phases e<sup>iθ</sup> round an R × T rectangle: the phase a charged particle picks up when it is carried once round it. It is the lattice version of the flux of the field through the rectangle. Its average falls as e<sup>−σ·RT</sup>: exponentially in the <em>area</em>, the area law. Reading the rectangle as a pair of charges held R apart for a time T, this says that the energy cost of the pair grows as σR: a constant force, a confining potential, and σ is the string tension.
      </p>
      <p>
        <strong>What to look for.</strong> In two dimensions the plaquette and the loops can be computed exactly, ⟨W(R, T)⟩ = (I₁(β)/I₀(β))<sup>RT</sup>, and the measured points should lie on the line within their error bars, whatever β you choose, with the largest loops noisiest because they are the smallest signals. At strong coupling (small β) σ ≈ −ln(β/2) is large; at weak coupling σ ≈ 1/(2β) is small but never zero. That the area law holds at every coupling is a special property of two dimensions, where a pure gauge field has no photon to carry a Coulomb force. In four dimensions the same lattice theory with the group U(1) has a weak-coupling phase in which the loops fall with their perimeter instead; with SU(3), the group of the strong interaction, lattice calculations find an area law, which is how confinement shows up in them; Chapter 18 returns to it.
      </p>
    </div>
  </div>
</Widget>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    min-width: 0;
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .top {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 680px) {
    .top {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .cv {
    display: block;
    box-shadow: 0 0 0 1px var(--line);
    border-radius: 4px;
    background: var(--panel);
    image-rendering: pixelated;
  }
  .pic {
    max-width: 260px;
  }
  .cap {
    font-size: 0.74rem;
    color: var(--mute);
    margin: 0.4rem 0 0;
    line-height: 1.4;
  }
  dl {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  dl div {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.6rem;
    align-items: baseline;
  }
  dt {
    font-size: 0.76rem;
    color: var(--mute);
    min-width: 11rem;
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--fg);
  }
  .spf {
    margin-top: 0.6rem;
    max-width: 16rem;
  }
  .plots {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
  @media (max-width: 760px) {
    .plots {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  h5 {
    margin: 0 0 0.2rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink-2);
    text-transform: none;
    letter-spacing: 0;
  }
  .key {
    list-style: none;
    margin: 0.3rem 0 0;
    padding: 0;
    font-size: 0.74rem;
    color: var(--ink-2);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .key li {
    margin: 0 !important;
    display: flex;
    gap: 0.4rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .sw {
    display: inline-block;
    flex: none;
  }
  .sw.line {
    width: 20px;
    border-top: 2px solid var(--series-2);
  }
  .sw.dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--series-1);
  }
  .sw.sq {
    width: 8px;
    height: 8px;
    background: var(--series-1);
  }
  .sw.dia {
    width: 8px;
    height: 8px;
    border: 2px solid var(--series-7);
    transform: rotate(45deg);
  }
  .note {
    font-size: 0.78rem;
    color: var(--mute);
    margin: 0;
  }
  .text {
    font-size: 0.82rem;
    line-height: 1.55;
    color: var(--ink-2);
    border-top: 1px solid var(--line);
    padding-top: 0.5rem;
  }
  .text p {
    margin: 0.3rem 0;
  }
</style>
