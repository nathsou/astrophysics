<!--
  The aperture: move the instant at which the data changes across the clock edge, and see what one flip-flop
  does. Outside the window it is clean; inside, Q goes unknown for a random time. Run it many times to see
  the distribution of that time.

    ::aperture-lab{n="17.5" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Strip, { type Band, type Mark, type Row } from './Strip.svelte';
  import { APERTURE, expected, tally, trial, type ApertureParams, type Tally } from './aperture';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  let dt = $state(-0.6);
  let tau = $state(APERTURE.tau);
  let seed = $state(1);
  let many: { key: string; t: Tally } | undefined = $state.raw();

  const params: ApertureParams = $derived({ ...APERTURE, tau });
  const t = $derived(trial(dt, seed, params));
  const promise = $derived(expected(dt, params));
  const key = $derived(`${dt}|${tau}`);
  const shown = $derived(many && many.key === key ? many.t : undefined);

  const rows: Row[] = $derived([
    { name: 'CLK', segs: t.clk },
    { name: 'D', segs: t.d },
    { name: 'Q', segs: t.q },
  ]);
  const bands: Band[] = $derived([{ from: -params.setup, to: params.hold, tone: 'setup' }]);
  const marks: Mark[] = $derived([
    {
      t: 0,
      symbol: t.outcome === 'metastable' ? '?' : '✓',
      tone: t.outcome === 'metastable' ? 'bad' : 'ok',
      title: 'The rising clock edge',
    },
  ]);

  const words = $derived(
    t.outcome === 'new'
      ? 'Set-up was met: Q takes the new value, 3 ns after the edge.'
      : t.outcome === 'old'
        ? 'The change came after the hold time: the flip-flop had already looked, and Q keeps the old value.'
        : `Inside the aperture: Q was unknown for ${t.unknownFor.toFixed(1)} ns, then settled to ${t.final} (${t.final === 1 ? 'the new' : 'the old'} value).`,
  );

  // Histogram of the time spent unknown.
  const BIN = 0.5;
  const NB = 16;
  const hist = $derived.by(() => {
    if (!shown) return [];
    const h = Array<number>(NB).fill(0);
    for (const d of shown.durations) h[Math.min(NB - 1, Math.floor(d / BIN))]!++;
    return h;
  });
  const maxH = $derived(Math.max(1, ...hist));
  const expo = (i: number) => (shown ? shown.metastable * (Math.exp(-(i * BIN) / tau) - Math.exp(-((i + 1) * BIN) / tau)) : 0);

  function again() {
    seed = seed + 1;
  }
  function run() {
    many = { key, t: tally(dt, 200, params) };
  }
  function reset() {
    dt = -0.6;
    tau = APERTURE.tau;
    seed = 1;
    many = undefined;
  }
  const sgn = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
</script>

<Widget title="The aperture" subtitle="What one flip-flop does when the data moves through the clock edge" {caption} n={fig} onreset={reset}>
  {#snippet controls()}
    <div class="ctl">
      <Slider label="Data changes" bind:value={dt} min={-6} max={4} step={0.1} format={(v) => `${sgn(v)} ns from the edge`} />
      <Slider label="Time constant τ" bind:value={tau} min={0.3} max={4} step={0.1} format={(v) => `${v.toFixed(1)} ns`} />
    </div>
  {/snippet}

  <div class="w">
    <Strip {rows} {bands} {marks} from={-10} to={22} label="Clock, data and output of one flip-flop around a rising clock edge at time zero. The shaded band is the aperture: from {params.setup} ns before the edge to {params.hold} ns after it." />

    <p class="says ui" class:ok={t.outcome !== 'metastable'} class:bad={t.outcome === 'metastable'} role="status">
      <b>{t.outcome === 'metastable' ? 'Metastable.' : 'Clean.'}</b>
      {words}
      <span class="fine">Data sheet: set-up {params.setup} ns, hold {params.hold} ns, so the aperture is {params.setup + params.hold} ns wide{promise === 'metastable' ? ', and this change is inside it' : ''}.</span>
    </p>

    <div class="btns ui">
      <Button size="sm" onclick={again} disabled={promise !== 'metastable'}>Try again (another random outcome)</Button>
      <Button size="sm" variant="primary" onclick={run}>Run 200 times</Button>
    </div>

    {#if shown}
      <div class="many ui">
        <div class="tallies">
          <span>Kept old: <b>{shown.old}</b></span>
          <span>Took new: <b>{shown.new}</b></span>
          <span class:badn={shown.metastable > 0}>Metastable: <b>{shown.metastable}</b></span>
          {#if shown.metastable}<span>of which settled to the new value: <b>{shown.settledNew}</b></span>{/if}
        </div>
        {#if shown.metastable}
          <svg viewBox="0 0 320 118" role="img" aria-label="Histogram of how long Q stayed unknown over {shown.metastable} runs, with the exponential curve of mean τ = {tau.toFixed(1)} ns drawn over it.">
            {#each hist as c, i (i)}
              <rect class="bin" x={12 + i * 18.5} y={90 - (c / maxH) * 78} width="16.5" height={(c / maxH) * 78} />
            {/each}
            <polyline
              class="curve"
              points={hist.map((_, i) => `${12 + i * 18.5 + 8.25},${90 - (Math.min(expo(i), maxH * 1.4) / maxH) * 78}`).join(' ')}
            />
            <line class="axis" x1="10" x2="310" y1="90.5" y2="90.5" />
            {#each [0, 2, 4, 6, 8] as v (v)}
              <text x={12 + (v / BIN) * 18.5} y="103" class="lab" text-anchor="middle">{v}</text>
            {/each}
            <text x="310" y="115" class="lab" text-anchor="end">time spent unknown, ns</text>
          </svg>
          <p class="fine">Bars: the {shown.metastable} runs; line: the exponential with mean τ. The mean here is {(shown.durations.reduce((a, b) => a + b, 0) / shown.durations.length).toFixed(2)} ns.</p>
        {/if}
      </div>
    {/if}
  </div>
</Widget>

<style>
  .ctl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.4rem 1.2rem;
    width: 100%;
  }
  .w {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .says {
    margin: 0;
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    font-size: 0.86rem;
    line-height: 1.45;
  }
  .says.ok {
    background: var(--ok-soft);
    border: 1px solid var(--ok);
  }
  .says.bad {
    background: var(--bad-soft);
    border: 1px solid var(--bad);
  }
  .fine {
    display: block;
    margin-top: 0.2rem;
    font-size: 0.74rem;
    color: var(--mute);
  }
  p.fine {
    margin: 0;
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .many {
    display: grid;
    gap: 0.4rem;
  }
  .tallies {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.2rem;
    font-size: 0.84rem;
  }
  .tallies b {
    font-family: var(--font-mono);
  }
  .badn b {
    color: var(--bad);
  }
  svg {
    width: 100%;
    max-width: 30rem;
    font-family: var(--font-mono);
  }
  .bin {
    fill: var(--sig-x);
    fill-opacity: 0.55;
  }
  .curve {
    fill: none;
    stroke: var(--fg);
    stroke-width: 1.6;
  }
  .axis {
    stroke: var(--mute);
  }
  .lab {
    fill: var(--mute);
    font-size: 9px;
  }
</style>
