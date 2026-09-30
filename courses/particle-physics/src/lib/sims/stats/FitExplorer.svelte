<!--
  The fit explorer. A toy histogram (a Gaussian peak on a falling exponential, generated from a seed) is fitted by the Poisson maximum-likelihood method.

  Drag the signal's position, width and size: the background is re-fitted for you at every step (it is profiled), and "−2 ln L" tells you how far you are from the best
  fit. Press "Fit" and the library's `fitBinned` finds the minimum and the parameter errors; the likelihood surface of position against size (with the
  width and the background profiled out) shows what "an error" is: the region where −2 ln L rises by less than a given amount. Click the surface to move the model there.

    ::fit-explorer{mode="diphoton" n="28.3" caption="…"}

  Props: `mode` 'diphoton' | 'fourlepton' | 'generic', `seed` (data), `n`, `caption`.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import HepHist from '$lib/charts/HepHist.svelte';
  import { fitBinned, fitChi2, guessStart, likelihoodChi2, poissonNll, pulls, type FitResult } from '$lib/hep/analysis';
  import { FIT_MODES, fitModel, toyHistogram, chunked, fmtP, sig, type FitModeKey } from './common';

  let { mode = 'diphoton', seed: seedProp, n, caption, title }: { mode?: FitModeKey; seed?: number; n?: string | number; caption?: string; title?: string } = $props();

  const cfg = $derived(FIT_MODES[mode] ?? FIT_MODES.generic);
  const model = fitModel();
  const PARAMS = ['sig.yield', 'sig.mean', 'sig.sigma', 'bkg.yield', 'bkg.slope'];
  const PRETTY = ['signal yield', 'signal position', 'signal width σ', 'background yield', 'background slope'];

  let seed = $state(untrack(() => seedProp ?? (FIT_MODES[mode] ?? FIT_MODES.generic).seed));
  let method = $state<'nll' | 'chi2'>('nll');
  let showTruth = $state(false);
  const hist = $derived(toyHistogram(cfg, seed));
  const edges = $derived(Array.from(hist.edges));

  // The manual model: position, width and yield from the sliders; the background is the best one for them.
  let mu = $state(0);
  let sg = $state(0);
  let yld = $state(0);
  let fit = $state<FitResult | null>(null);
  let initialised = '';
  $effect(() => {
    const key = `${mode}:${seed}`;
    if (initialised === key) return;
    initialised = key;
    const g = guessStart(hist, model);
    // Start deliberately off the best fit: a reader who presses "Fit" at once should still see the minimiser work.
    mu = Math.round((g[1]! + 0.35 * cfg.sigmaRange[1]! * 0.5) * 10) / 10;
    sg = Math.round(g[2]! * 1.5 * 10) / 10 || cfg.sigmaRange[0]!;
    yld = Math.round(g[0]! * 0.6);
    fit = null;
    surface = null;
  });

  const manual = $derived.by(() => {
    const p0 = guessStart(hist, model);
    const f = fitBinned(hist, model, [yld, mu, sg, p0[3]!, p0[4]!], { fixed: [true, true, true, false, false], hessian: false });
    return f;
  });
  const manualMinus2lnL = $derived(2 * manual.nll);

  async function runFit() {
    const f = method === 'nll' ? fitBinned(hist, model, manual.params.slice()) : fitChi2(hist, model, manual.params.slice(), { variance: 'neyman' });
    fit = f;
    void computeSurface(f);
  }

  // Likelihood surface in (position, yield), width and background profiled.
  interface Surface {
    mus: number[];
    ys: number[];
    delta: number[][]; // [iy][imu]
    best: { mu: number; y: number };
    done: number;
    total: number;
    kind: 'nll' | 'chi2';
  }
  let surface = $state<Surface | null>(null);
  let surfToken = 0;
  async function computeSurface(f: FitResult) {
    const my = ++surfToken;
    const N = 19;
    const errMu = Number.isFinite(f.errors[1]!) && f.errors[1]! > 0 ? f.errors[1]! : (cfg.hi - cfg.lo) / 60;
    const errY = Number.isFinite(f.errors[0]!) && f.errors[0]! > 0 ? f.errors[0]! : Math.max(1, f.params[0]! * 0.3);
    const mus = Array.from({ length: N }, (_, i) => f.params[1]! + (i - (N - 1) / 2) * ((8 * errMu) / (N - 1)));
    const y0 = Math.max(0, f.params[0]! - 4 * errY);
    const ys = Array.from({ length: N }, (_, i) => y0 + (i * (f.params[0]! + 4 * errY - y0)) / (N - 1));
    const delta: number[][] = Array.from({ length: N }, () => new Array<number>(N).fill(NaN));
    const kind = method;
    const s: Surface = { mus, ys, delta, best: { mu: f.params[1]!, y: f.params[0]! }, done: 0, total: N * N, kind };
    surface = s;
    const factor = kind === 'nll' ? 2 : 1;
    await chunked(
      N,
      1,
      (iy) => {
        for (let im = 0; im < N; im++) {
          const p0 = f.params.slice();
          p0[0] = ys[iy]!;
          p0[1] = mus[im]!;
          const r = kind === 'nll' ? fitBinned(hist, model, p0, { fixed: [true, true, false, false, false], hessian: false }) : fitChi2(hist, model, p0, { fixed: [true, true, false, false, false], hessian: false });
          delta[iy]![im] = Math.max(0, factor * (r.nll - f.nll));
        }
      },
      (d) => {
        if (my !== surfToken) return;
        s.done = d * N;
        surface = { ...s, delta: delta.map((r) => r.slice()) };
      },
      () => my !== surfToken,
    );
  }
  onMount(() => () => {
    surfToken++;
  });

  // Plot data.
  const curveFor = (p: number[]) => model.binned(p, edges);
  const manualCurve = $derived(curveFor(manual.params));
  const fitCurve = $derived(fit ? curveFor(fit.params) : null);
  const fitBkg = $derived(fit ? model.componentBinned(fit.params, edges)[1]! : null);
  const truthCurve = $derived(curveFor(cfg.truth));
  const ymax = $derived(Math.max(1, ...Array.from(hist.counts), ...manualCurve) * 1.2);
  const series = $derived([
    ...(showTruth ? [{ edges, counts: truthCurve, label: 'truth', color: 'var(--series-8)' }] : []),
    ...(fitBkg ? [{ edges, counts: fitBkg, label: 'fitted background', color: 'var(--series-2)' }] : []),
    { edges, counts: fit ? fitCurve! : manualCurve, label: fit ? (fit === null ? '' : method === 'nll' ? 'fit (Poisson likelihood)' : 'fit (χ² with √n errors)') : 'your model', color: fit ? 'var(--series-3)' : 'var(--series-5)' },
    { edges, counts: Array.from(hist.counts), label: 'data', points: true, errors: true, color: 'var(--series-1)' },
  ]);
  const pullValues = $derived(pulls(Array.from(hist.counts), fit ? fitCurve! : manualCurve));

  const goodness = $derived.by(() => {
    const exp = fit ? fitCurve! : manualCurve;
    const c = Array.from(hist.counts);
    return { chi2: likelihoodChi2(c, exp), nll: poissonNll(c, exp) };
  });

  // The surface as SVG.
  const SW = 360, SH = 300, PAD = { l: 52, r: 22, t: 8, b: 40 };
  const sx = (m: number) => {
    const s = surface!;
    const lo = s.mus[0]!, hi = s.mus[s.mus.length - 1]!;
    return PAD.l + ((m - lo) / (hi - lo)) * (SW - PAD.l - PAD.r);
  };
  const sy = (y: number) => {
    const s = surface!;
    const lo = s.ys[0]!, hi = s.ys[s.ys.length - 1]!;
    return SH - PAD.b - ((y - lo) / (hi - lo)) * (SH - PAD.t - PAD.b);
  };
  // Two-parameter confidence regions: Δ(−2 ln L) = 2.30 (68.3 %), 6.18 (95.4 %), 11.83 (99.7 %).
  const LEVELS = [2.3, 6.18, 11.83];
  const levelOf = (d: number) => (Number.isNaN(d) ? -1 : d < LEVELS[0]! ? 0 : d < LEVELS[1]! ? 1 : d < LEVELS[2]! ? 2 : 3);
  const CELL_FILL = ['color-mix(in srgb, var(--series-1) 85%, transparent)', 'color-mix(in srgb, var(--series-1) 52%, transparent)', 'color-mix(in srgb, var(--series-1) 26%, transparent)', 'color-mix(in srgb, var(--series-8) 10%, transparent)'];
  let surfEl = $state<SVGSVGElement | undefined>();
  function pick(e: PointerEvent | MouseEvent) {
    if (!surface || !surfEl) return;
    const r = surfEl.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * SW;
    const py = ((e.clientY - r.top) / r.height) * SH;
    const s = surface;
    const fx = (px - PAD.l) / (SW - PAD.l - PAD.r);
    const fy = 1 - (py - PAD.t) / (SH - PAD.t - PAD.b);
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
    mu = Math.round((s.mus[0]! + fx * (s.mus[s.mus.length - 1]! - s.mus[0]!)) * 100) / 100;
    yld = Math.max(0, Math.round(s.ys[0]! + fy * (s.ys[s.ys.length - 1]! - s.ys[0]!)));
  }

  function nudge(e: KeyboardEvent) {
    const dm = (cfg.massRange[1] - cfg.massRange[0]) / 200;
    const dy = Math.max(1, Math.round(cfg.yieldMax / 100));
    if (e.key === 'ArrowLeft') mu = Math.max(cfg.massRange[0], Math.round((mu - dm) * 100) / 100);
    else if (e.key === 'ArrowRight') mu = Math.min(cfg.massRange[1], Math.round((mu + dm) * 100) / 100);
    else if (e.key === 'ArrowUp') yld = Math.min(cfg.yieldMax, yld + dy);
    else if (e.key === 'ArrowDown') yld = Math.max(0, yld - dy);
    else return;
    e.preventDefault();
  }
  function reroll() {
    seed = seed + 1;
  }
</script>

<Widget title={title ?? cfg.title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Slider bind:value={mu} min={cfg.massRange[0]} max={cfg.massRange[1]} step={0.1} label="Signal position" format={(v) => `${v.toFixed(1)} ${cfg.unit}`} />
    <Slider bind:value={sg} min={cfg.sigmaRange[0]} max={cfg.sigmaRange[1]} step={0.05} label="Signal width σ" format={(v) => `${v.toFixed(2)} ${cfg.unit}`} />
    <Slider bind:value={yld} min={0} max={cfg.yieldMax} step={1} label="Signal yield" format={(v) => v.toFixed(0)} />
    <div class="buttons ui">
      <Button variant="primary" onclick={runFit}>Fit</Button>
      <Button onclick={reroll}>New data <span class="seed">seed {seed}</span></Button>
      <Segmented
        label="Fit method"
        size="sm"
        bind:value={method}
        options={[{ value: 'nll', label: 'Poisson likelihood' }, { value: 'chi2', label: 'χ², errors √n' }]}
        onchange={() => {
          if (fit) void runFit();
        }}
      />
      <Toggle bind:checked={showTruth} label="Show truth" />
    </div>
  {/snippet}

  <p class="ui note">{cfg.note}</p>
  <div class="grid">
    <div class="pane">
      <HepHist {series} x={{ domain: [cfg.lo, cfg.hi], label: cfg.xLabel }} y={{ domain: [0, ymax], label: `Events per ${((cfg.hi - cfg.lo) / cfg.bins).toFixed(1)} ${cfg.unit}`.trim() }} height={280} label="Toy histogram with the model curve and, after a fit, the fitted curve" />
      <svg class="pulls" viewBox="0 0 {cfg.bins * 10} 60" role="img" aria-label="Pull of each bin: (data − model)/√model">
        <line x1="0" x2={cfg.bins * 10} y1="30" y2="30" stroke="var(--line-strong)" />
        {#each [-2, 2] as l}<line x1="0" x2={cfg.bins * 10} y1={30 - l * 9} y2={30 - l * 9} stroke="var(--line)" stroke-dasharray="3 3" />{/each}
        {#each pullValues as pv, i}
          {@const h = Math.max(-27, Math.min(27, pv * 9))}
          <rect x={i * 10 + 1} width="8" y={h >= 0 ? 30 - h : 30} height={Math.abs(h)} fill={Math.abs(pv) > 3 ? 'var(--bad)' : Math.abs(pv) > 2 ? 'var(--maybe)' : 'var(--series-8)'} />
        {/each}
      </svg>
      <p class="ui pulls-cap">Pulls (data − model)/√model per bin; dashed lines at ±2.</p>
    </div>

    <div class="pane">
      <h5 class="ui">Likelihood surface: signal position against yield</h5>
      {#if surface}
        <button type="button" class="surf-btn" aria-label="Likelihood surface: the change in −2 ln L against signal position and yield. Click, or use the arrow keys, to move your model; the sliders do the same." onclick={pick} onkeydown={nudge}>
        <svg bind:this={surfEl} viewBox="0 0 {SW} {SH}" class="surf" aria-hidden="true">
          {#each surface.delta as row, iy}
            {#each row as d, im}
              {@const dx = (surface.mus[1]! - surface.mus[0]!)}
              {@const dy = (surface.ys[1]! - surface.ys[0]!)}
              {#if levelOf(d) >= 0}
                <rect x={sx(surface.mus[im]! - dx / 2)} y={sy(surface.ys[iy]! + dy / 2)} width={sx(surface.mus[im]! + dx / 2) - sx(surface.mus[im]! - dx / 2) + 0.5} height={sy(surface.ys[iy]! - dy / 2) - sy(surface.ys[iy]! + dy / 2) + 0.5} fill={CELL_FILL[levelOf(d)]} />
              {/if}
            {/each}
          {/each}
          <line x1={PAD.l} x2={SW - PAD.r} y1={SH - PAD.b} y2={SH - PAD.b} stroke="var(--axis)" />
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={SH - PAD.b} stroke="var(--axis)" />
          {#each [0, 0.25, 0.5, 0.75, 1] as f}
            {@const mv = surface.mus[0]! + f * (surface.mus[surface.mus.length - 1]! - surface.mus[0]!)}
            {@const yv = surface.ys[0]! + f * (surface.ys[surface.ys.length - 1]! - surface.ys[0]!)}
            <text x={sx(mv)} y={SH - PAD.b + 14} text-anchor="middle" class="tick">{sig(mv, 4)}</text>
            <text x={PAD.l - 6} y={sy(yv) + 4} text-anchor="end" class="tick">{sig(yv, 3)}</text>
          {/each}
          <text x={(PAD.l + SW - PAD.r) / 2} y={SH - 6} text-anchor="middle" class="axl">signal position {cfg.unit ? `[${cfg.unit}]` : ''}</text>
          <text transform="translate(12,{(PAD.t + SH - PAD.b) / 2}) rotate(-90)" text-anchor="middle" class="axl">signal yield</text>
          <!-- best fit, truth, your model -->
          <path d="M{sx(surface.best.mu) - 5},{sy(surface.best.y)}h10M{sx(surface.best.mu)},{sy(surface.best.y) - 5}v10" stroke="var(--fg)" stroke-width="2" />
          {#if showTruth}<circle cx={sx(cfg.truth[1]!)} cy={sy(cfg.truth[0]!)} r="4.5" fill="none" stroke="var(--series-8)" stroke-width="2" />{/if}
          {#if mu >= surface.mus[0]! && mu <= surface.mus[surface.mus.length - 1]! && yld >= surface.ys[0]! && yld <= surface.ys[surface.ys.length - 1]!}
            <circle cx={sx(mu)} cy={sy(yld)} r="5" fill="var(--sig-high)" stroke="var(--panel)" stroke-width="1.5" />
          {/if}
        </svg>
        </button>
        <p class="ui legend">
          <span class="sw" style:background={CELL_FILL[0]}></span>68 %
          <span class="sw" style:background={CELL_FILL[1]}></span>95 %
          <span class="sw" style:background={CELL_FILL[2]}></span>99.7 %
          · <span class="dot" style:background="var(--fg)"></span>best fit · <span class="dot" style:background="var(--sig-high)"></span>your model
          {#if surface.done < surface.total}· computing {Math.round((100 * surface.done) / surface.total)} %{/if}
        </p>
      {:else}
        <p class="ui empty">Press <strong>Fit</strong>: the surface is computed from the best fit.</p>
      {/if}
    </div>
  </div>

  <div class="results ui" aria-live="polite">
    <table>
      <thead><tr><th>Parameter</th><th>{fit ? 'Fit' : 'Your model'}</th><th>±</th>{#if showTruth || fit}<th>Truth</th>{/if}{#if fit}<th>Pull</th>{/if}</tr></thead>
      <tbody>
        {#each PARAMS as nm, i}
          {@const v = fit ? fit.params[i]! : manual.params[i]!}
          <tr>
            <th scope="row">{PRETTY[i]}</th>
            <td>{sig(v, 4)}</td>
            <td>{fit ? (Number.isFinite(fit.errors[i]!) ? sig(fit.errors[i]!, 2) : 'n/a') : i < 3 ? 'set' : 'fitted'}</td>
            {#if showTruth || fit}<td>{sig(cfg.truth[i]!, 4)}</td>{/if}
            {#if fit}<td>{Number.isFinite(fit.errors[i]!) && fit.errors[i]! > 0 ? ((fit.params[i]! - cfg.truth[i]!) / fit.errors[i]!).toFixed(2) : 'n/a'}</td>{/if}
          </tr>
        {/each}
      </tbody>
    </table>
    <div class="quality">
      {#if fit}
        <p><strong>{fit.converged ? 'Converged' : 'Did not converge'}.</strong> {method === 'nll' ? 'Baker–Cousins χ²' : 'χ² (errors √n)'} = {sig(fit.chi2, 4)} for {fit.ndf} degrees of freedom (p = {fmtP(fit.pValue)}). {#if method === 'chi2' && mode === 'fourlepton'}With so few events the √n errors are wrong; compare with the likelihood fit.{/if}</p>
        <p class="sub">{method === 'nll' ? '−2 ln L at the minimum' : '−2 ln L of these parameters'} = {sig(2 * goodness.nll, 6)}</p>
      {:else}
        <p>−2 ln L of your model (background re-fitted) = <strong>{sig(manualMinus2lnL, 6)}</strong>. Lower is better; press <strong>Fit</strong> to let the minimiser find the lowest.</p>
        <p class="sub">Baker–Cousins χ² = {sig(goodness.chi2, 4)}</p>
      {/if}
    </div>
  </div>
</Widget>

<style>
  .note {
    margin: 0 0 0.7rem;
    font-size: 0.84rem;
    color: var(--ink-2);
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
    gap: 1rem;
  }
  @media (max-width: 820px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .pane {
    min-width: 0;
  }
  h5 {
    margin: 0 0 0.35rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--ink-2);
    text-transform: none;
    letter-spacing: 0;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .seed {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--mute);
    margin-left: 0.3rem;
  }
  .pulls {
    width: 100%;
    height: 54px;
    display: block;
    margin-top: 0.2rem;
  }
  .pulls-cap {
    margin: 0.1rem 0 0;
    font-size: 0.72rem;
    color: var(--mute);
  }
  .surf-btn {
    display: block;
    width: 100%;
    padding: 0;
    border: 1px solid var(--line);
    background: var(--chart-surface);
    cursor: crosshair;
  }
  .surf-btn:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .surf {
    width: 100%;
    height: auto;
    background: var(--chart-surface);
    cursor: crosshair;
    display: block;
    touch-action: none;
  }
  .tick {
    font-size: 10px;
    fill: var(--ink-3);
    font-variant-numeric: tabular-nums;
  }
  .axl {
    font-size: 11px;
    fill: var(--ink-2);
  }
  .legend {
    margin: 0.3rem 0 0;
    font-size: 0.74rem;
    color: var(--ink-2);
  }
  .sw {
    display: inline-block;
    width: 0.8rem;
    height: 0.6rem;
    margin: 0 0.25rem 0 0.4rem;
    border: 1px solid var(--line);
    vertical-align: middle;
  }
  .dot {
    display: inline-block;
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    margin: 0 0.25rem 0 0.1rem;
    vertical-align: middle;
  }
  .empty {
    color: var(--mute);
    font-size: 0.86rem;
    padding: 2rem 0.5rem;
    text-align: center;
    border: 1px dashed var(--line);
    border-radius: 6px;
  }
  .results {
    margin-top: 0.9rem;
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 820px) {
    .results {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  table {
    border-collapse: collapse;
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
    width: 100%;
  }
  th,
  td {
    padding: 0.2rem 0.5rem;
    text-align: right;
    text-transform: none;
    letter-spacing: 0;
    border-bottom: 1px solid var(--line);
  }
  th:first-child,
  tbody th {
    text-align: left;
    font-weight: 500;
    color: var(--ink-2);
  }
  .quality p {
    margin: 0 0 0.3rem;
    font-size: 0.84rem;
    line-height: 1.45;
  }
  .quality .sub {
    color: var(--mute);
    font-size: 0.78rem;
  }
</style>
