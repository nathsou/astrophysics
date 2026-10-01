<!--
  Why naive accept–reject fails for Rutherford scattering, and how importance sampling fixes it. Each dot is one trial: a proposed angle θ and a
  uniform height under the envelope. Grey dots fall above the density and are rejected; coloured dots are accepted. With a flat envelope almost
  every dot is rejected, because the density is huge at θmin and tiny everywhere else. With the envelope 16/θ³ (sampled exactly by inverse
  transform) almost every dot is accepted.

  The efficiencies are exact (closed forms of `hep/scattering`); the dots are a seeded sample of trials drawn the same way the library draws them.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { rng } from '$lib/hep/random';
  import { flatEfficiency, importanceEfficiency, rutherfordAngleDensity } from '$lib/hep/scattering';

  let { n, caption, title = 'Two ways to sample Rutherford scattering' }: { n?: string | number; caption?: string; title?: string } = $props();

  let method = $state<'flat' | 'importance'>('flat');
  let logMin = $state(-1); // log10 of θmin in radians
  let seed = $state(1);
  const thetaMin = $derived(10 ** logMin);
  const NDOT = 400;

  /** Trials in the coordinates (θ, y) with y = u · (envelope height) / (envelope height at θmin) for the flat case, and y = u for importance. */
  const dots = $derived.by(() => {
    const r = rng(seed);
    const out: { th: number; y: number; ok: boolean }[] = [];
    const top = rutherfordAngleDensity(thetaMin);
    const inv0 = 1 / (thetaMin * thetaMin), inv1 = 1 / (Math.PI * Math.PI);
    for (let i = 0; i < NDOT; i++) {
      if (method === 'flat') {
        const th = thetaMin + (Math.PI - thetaMin) * r();
        const u = r();
        out.push({ th, y: u, ok: u * top <= rutherfordAngleDensity(th) });
      } else {
        const th = 1 / Math.sqrt(inv0 - r() * (inv0 - inv1));
        const x = th / 2;
        const u = r();
        out.push({ th, y: u, ok: u <= Math.cos(x) * (x / Math.sin(x)) ** 3 });
      }
    }
    return out;
  });
  const accepted = $derived(dots.filter((d) => d.ok).length);
  const effFlat = $derived(flatEfficiency(thetaMin));
  const effImp = $derived(importanceEfficiency(thetaMin));
  const eff = $derived(method === 'flat' ? effFlat : effImp);
  const curve = $derived.by(() => {
    const top = rutherfordAngleDensity(thetaMin);
    return Array.from({ length: 200 }, (_, i) => {
      const th = thetaMin * (Math.PI / thetaMin) ** (i / 199);
      const x = th / 2;
      return { th, y: method === 'flat' ? rutherfordAngleDensity(th) / top : Math.cos(x) * (x / Math.sin(x)) ** 3 };
    });
  });
  const degMin = $derived((thetaMin * 180) / Math.PI);
  const fmt = (x: number) => (x >= 0.1 ? `${(100 * x).toFixed(1)} %` : x >= 0.001 ? `${(100 * x).toFixed(2)} %` : `${(100 * x).toPrecision(2)} %`);
  const perSample = (e: number) => (1 / e >= 100 ? Math.round(1 / e).toLocaleString('en-GB') : (1 / e).toFixed(2));
</script>

<Widget {title} subtitle="Each dot is one trial; coloured dots are kept" {n} {caption} kind="Simulation" onreset={() => { method = 'flat'; logMin = -1; seed = 1; }}>
  {#snippet controls()}
    <Segmented label="Method" size="sm" bind:value={method} options={[{ value: 'flat', label: 'Flat envelope' }, { value: 'importance', label: 'Envelope 16/θ³' }]} />
    <Slider bind:value={logMin} min={-3} max={0} step={0.02} label="Smallest angle θmin" format={() => (degMin >= 1 ? `${degMin.toFixed(1)}° (${thetaMin.toFixed(3)} rad)` : `${degMin.toFixed(2)}° (${thetaMin.toFixed(4)} rad)`)} />
  {/snippet}

  <Plot
    label={method === 'flat' ? 'Trials under a flat envelope: nearly all fall above the density and are rejected' : 'Trials under the 16 over theta cubed envelope: nearly all are accepted'}
    x={{ type: 'log', domain: [thetaMin, Math.PI], label: 'trial angle θ [rad]', tickValues: [0.001, 0.01, 0.1, 1, Math.PI].filter((v) => v >= thetaMin * 0.999), format: (v) => (Math.abs(v - Math.PI) < 1e-6 ? 'π' : String(v)) }}
    y={{ domain: [0, 1.04], label: method === 'flat' ? 'height u (units of the envelope)' : 'height u (units of the envelope 16/θ³)', ticks: 5 }}
    height={290}
  >
    {#snippet marks({ sx, sy })}
      {#each dots as d}
        <circle cx={sx(d.th)} cy={sy(d.y)} r="2.6" fill={d.ok ? 'var(--ok)' : 'var(--series-8)'} opacity={d.ok ? 0.95 : 0.45} />
      {/each}
      <path d={curve.map((p, i) => `${i ? 'L' : 'M'}${sx(p.th)} ${sy(p.y)}`).join('')} fill="none" stroke="var(--sig-high)" stroke-width="2.2" />
    {/snippet}
  </Plot>

  <div class="cards ui" aria-live="polite">
    <div><span class="k">kept in this picture</span><strong>{accepted} of {NDOT}</strong></div>
    <div><span class="k">efficiency of this method</span><strong>{fmt(eff)}</strong><span class="s">{perSample(eff)} trials per accepted angle</span></div>
    <div><span class="k">flat envelope, for comparison</span><strong>{fmt(effFlat)}</strong><span class="s">about θmin/2π: {perSample(effFlat)} trials per angle</span></div>
    <div><span class="k">envelope 16/θ³</span><strong>{fmt(effImp)}</strong><span class="s">{perSample(effImp)} trials per angle, at every θmin</span></div>
  </div>
  <p class="ui note">The orange curve is the wanted density divided by the envelope: {method === 'flat' ? 'f(θ)/f(θmin), which falls by orders of magnitude within a small fraction of the range, so the box of trials is almost empty under it' : 'cos(θ/2)(θ/2 ÷ sin(θ/2))³, which never exceeds 1 and stays close to it over most of the range'}. <Button size="sm" onclick={() => (seed += 1)}>New trials (seed {seed})</Button></p>
</Widget>

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.5rem;
    margin-top: 0.7rem;
  }
  .cards div {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--pn);
    padding: 0.4rem 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .k {
    font-size: 0.7rem;
    color: var(--mute);
    text-transform: none;
    letter-spacing: 0;
  }
  strong {
    font-family: var(--font-mono);
    font-size: 0.95rem;
  }
  .s {
    font-size: 0.72rem;
    color: var(--ink-2);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
    margin: 0.6rem 0 0;
  }
</style>
