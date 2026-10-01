<!--
  One histogram of a run: the simulated samples stacked (backgrounds below, signals on top), pseudo-data points with √N error bars if the configuration
  asks for them, the fit, the main observable at truth level, the signal window, and real data if a real-data file is shown. Built on HepHist.
  Every simulated histogram carries the tag "simulation".
-->
<script lang="ts">
  import HepHist, { type HistSeries, type HistMarker } from '$lib/charts/HepHist.svelte';
  import { OBSERVABLES, type ObservableSummary, type Summary } from '$lib/hep/pipeline/index.ts';

  let {
    obs,
    summary,
    main = false,
    log = false,
    showTruth = false,
    showFit = true,
    real = null,
    height = 320,
  }: {
    obs: ObservableSummary;
    summary: Summary;
    /** The main observable (the one fitted, with pseudo-data and the signal window). */
    main?: boolean;
    log?: boolean;
    showTruth?: boolean;
    showFit?: boolean;
    real?: { edges: number[]; counts: number[]; manifest: { title: string } } | null;
    height?: number;
  } = $props();

  const def = $derived(OBSERVABLES[obs.name]!);
  const SIGNAL_COLOURS = ['var(--series-5)', 'var(--series-3)', 'var(--series-7)'];
  const BACKGROUND_COLOURS = ['var(--series-1)', 'var(--series-4)', 'var(--series-6)', 'var(--series-2)', 'var(--series-8)'];

  const scaled = $derived(summary.lumiFb !== null);

  const series = $derived.by((): HistSeries[] => {
    const out: HistSeries[] = [];
    // stack: cumulative sums, the top layer first so that the lower layers are drawn over it
    const n = obs.edges.length - 1;
    const cum: number[][] = [];
    let run = new Array<number>(n).fill(0);
    for (const s of obs.stack) {
      run = run.map((v, i) => v + s.counts[i]!);
      cum.push(run);
    }
    let bi = 0, si = 0;
    const colours = obs.stack.map((s) => (s.role === 'signal' ? SIGNAL_COLOURS[si++ % SIGNAL_COLOURS.length]! : BACKGROUND_COLOURS[bi++ % BACKGROUND_COLOURS.length]!));
    for (let k = obs.stack.length - 1; k >= 0; k--) out.push({ edges: obs.edges, counts: cum[k]!, label: `${obs.stack[k]!.label} (simulation)`, color: colours[k], fill: true });
    if (main && showTruth && obs.truth) out.push({ edges: obs.edges, counts: obs.truth.counts, label: 'truth level, before detector and trigger (simulation)', color: 'var(--series-4)' });
    if (main && showFit && summary.fit?.reliable) out.push({ edges: obs.edges, counts: summary.fit.expected, label: `fit: ${summary.fit.model}`, color: 'var(--series-7)' });
    if (main && obs.pseudo) out.push({ edges: obs.edges, counts: obs.pseudo.counts, label: 'pseudo-data (Poisson fluctuation of the simulation)', color: 'var(--fg)', points: true, errors: true });
    if (main && real) out.push({ edges: real.edges, counts: real.counts, label: `real data: ${real.manifest.title}`, color: 'var(--fg)', points: true, errors: true });
    return out;
  });

  const ymax = $derived(Math.max(1e-9, ...series.flatMap((s) => Array.from(s.counts as ArrayLike<number>)).filter(Number.isFinite)));
  const ymin = $derived.by(() => {
    let m = Infinity;
    for (const s of series) for (const c of Array.from(s.counts as ArrayLike<number>)) if (c > 0 && c < m) m = c;
    return Number.isFinite(m) ? m : 1;
  });
  const useLog = $derived(log || def.log === true);
  const y = $derived(
    useLog
      ? { type: 'log' as const, domain: [Math.max(ymin / 3, 1e-6), ymax * 4] as [number, number], label: scaled ? 'expected events per bin' : 'simulated events per bin' }
      : { type: 'linear' as const, domain: [0, ymax * 1.12] as [number, number], label: scaled ? 'expected events per bin' : 'simulated events per bin' },
  );
  const x = $derived(
    def.log && obs.edges[0]! > 0
      ? { type: 'log' as const, domain: [obs.edges[0]!, obs.edges[obs.edges.length - 1]!] as [number, number], label: `${def.label}${def.unit ? ` [${def.unit}]` : ''}` }
      : { type: 'linear' as const, domain: [obs.edges[0]!, obs.edges[obs.edges.length - 1]!] as [number, number], label: `${def.label}${def.unit ? ` [${def.unit}]` : ''}` },
  );
  const markers = $derived.by((): HistMarker[] => {
    const w = summary.window;
    if (!main || !w) return [];
    return [{ x: w.lo, label: 'signal window', at: 0.96 }, { x: w.hi, label: '' }];
  });
  const description = $derived(
    `Histogram of ${def.label}${def.unit ? ` in ${def.unit}` : ''} from ${obs.stack.map((s) => s.label).join(', ')}, simulation${obs.pseudo ? ', with pseudo-data points' : ''}${summary.fit && main ? ' and a fit' : ''}.`,
  );
</script>

<div class="hist">
  <span class="tag ui" aria-hidden="true">simulation</span>
  <HepHist {series} {x} {y} {markers} {height} label={description} legend={true} />
</div>

<style>
  .hist {
    position: relative;
  }
  .tag {
    position: absolute;
    right: 0.4rem;
    top: 0.1rem;
    z-index: 2;
    font-size: 0.66rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
    border: 1px solid var(--line-strong);
    border-radius: 99px;
    padding: 0.05rem 0.5rem;
    background: var(--panel);
    pointer-events: none;
  }
</style>
