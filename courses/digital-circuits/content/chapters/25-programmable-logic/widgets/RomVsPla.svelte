<!--
  ROM against PLA. Pick a function and slide the number of inputs: the ROM's size doubles with every input, the
  PLA's depends on how many product terms the function needs. The plot is logarithmic, so a straight line is an
  exponential.

    ::rom-vs-pla{n="25.4" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { FAMILIES, PLAS, count, family, fits, grouped, point, series, type FamilyId } from './romvspla';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  let id = $state<FamilyId>('any');
  let inputs = $state(12);
  const fam = $derived(family(id));
  const pt = $derived(point(fam, inputs));
  const data = $derived(series(fam));
  const ratio = $derived(pt.rom / pt.pla);

  const X0 = 52;
  const X1 = 404;
  const Y0 = 10;
  const Y1 = 168;
  const NMAX = 24;
  const DECADES = 9; // 1 … 10⁹ fuses (parity at 24 inputs needs about 4 × 10⁸)
  const px = (n: number) => X0 + ((n - 1) / (NMAX - 1)) * (X1 - X0);
  const py = (v: number) => Y1 - (Math.min(Math.log10(Math.max(v, 1)), DECADES) / DECADES) * (Y1 - Y0);
  const path = (key: 'rom' | 'pla') => data.map((p, i) => `${i ? 'L' : 'M'}${px(p.n).toFixed(1)} ${py(p[key]).toFixed(1)}`).join('');
  const verdict = $derived(
    ratio >= 2 ? `The PLA is ${ratio >= 100 ? grouped(ratio) : ratio.toFixed(1)} times smaller.` : ratio > 0.5 ? 'About the same size.' : `The ROM is ${(1 / ratio).toFixed(1)} times smaller.`,
  );
  const label = $derived(`${fam.label} of ${inputs} inputs: a ROM needs ${grouped(pt.rom)} fuses, a PLA needs ${grouped(pt.pla)} (${grouped(pt.terms)} product terms).`);
</script>

<Widget n={fig} title="ROM or PLA?" subtitle="Fuses needed for one output, as the inputs grow" {caption} onreset={() => ((id = 'any'), (inputs = 12))}>
  {#snippet controls()}
    <Segmented label="Function" value={id} onchange={(v) => (id = v)} options={FAMILIES.map((f) => ({ value: f.id, label: f.label, title: f.blurb }))} />
    <Slider label="Inputs" bind:value={inputs} min={1} max={NMAX} step={1} format={(v) => `${v}`} />
  {/snippet}

  <div class="rp">
    <p class="what ui">{fam.blurb}</p>
    <svg viewBox="0 0 420 200" class="plot" role="img" aria-label={label}>
      {#each [0, 2, 4, 6, 8] as d (d)}
        <line class="grid" x1={X0} x2={X1} y1={py(10 ** d)} y2={py(10 ** d)} />
        <text class="tick" x={X0 - 6} y={py(10 ** d) + 3} text-anchor="end">{d === 0 ? '1' : `10${'⁰¹²³⁴⁵⁶⁷⁸⁹'[d]}`}</text>
      {/each}
      {#each [1, 4, 8, 12, 16, 20, 24] as g (g)}
        <line class="grid" x1={px(g)} x2={px(g)} y1={Y0} y2={Y1} />
        <text class="tick" x={px(g)} y={Y1 + 14} text-anchor="middle">{g}</text>
      {/each}
      <rect class="frame" x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} />
      <text class="axis" x={(X0 + X1) / 2} y="196" text-anchor="middle">inputs</text>
      <text class="axis" x="10" y={(Y0 + Y1) / 2} text-anchor="middle" transform="rotate(-90 10 {(Y0 + Y1) / 2})">fuses</text>
      <path class="ln rom" d={path('rom')} />
      <path class="ln pla" d={path('pla')} />
      <line class="cur" x1={px(inputs)} x2={px(inputs)} y1={Y0} y2={Y1} />
      <circle class="dot rom" cx={px(inputs)} cy={py(pt.rom)} r="4.5" />
      <circle class="dot pla" cx={px(inputs)} cy={py(pt.pla)} r="4.5" />
      <text class="key rom" x={X0 + 8} y={py(2 ** 10) - 8}>ROM: 2ⁿ</text>
      <text class="key pla" x={X1 - 6} y={Y1 - 8} text-anchor="end">PLA</text>
    </svg>

    <dl class="ui">
      <div class="rom"><dt>ROM</dt><dd>{count(pt.rom)} words</dd><small>{grouped(pt.rom)} fuses</small></div>
      <div class="pla"><dt>PLA</dt><dd>{grouped(pt.terms)} product term{pt.terms === 1 ? '' : 's'}</dd><small>{grouped(pt.pla)} fuses</small></div>
      <div class="v"><dt>{verdict}</dt>
        <dd class="chips">
          {#each PLAS as s (s.name)}
            {@const ok = fits(s, inputs, pt.terms)}
            <span class="chip" class:ok>{ok ? '✓' : '✗'} fits a {s.name} ({s.inputs} in, {s.terms} terms)</span>
          {/each}
        </dd>
      </div>
    </dl>
  </div>
</Widget>

<style>
  .rp {
    display: grid;
    gap: 0.8rem;
    padding: 0.9rem 1rem 1rem;
  }
  .what {
    margin: 0;
    font-size: 0.88rem;
    color: var(--ink-2);
  }
  .plot {
    display: block;
    width: 100%;
    max-width: 40rem;
    justify-self: center;
    height: auto;
    overflow: visible;
    font-family: var(--font-mono);
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }
  .frame {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 1.2;
  }
  .tick,
  .axis {
    fill: var(--mute);
    font-size: 9.5px;
  }
  .ln {
    fill: none;
    stroke-width: 2.4;
    stroke-linejoin: round;
  }
  .ln.rom,
  .dot.rom {
    stroke: var(--series-1);
  }
  .ln.pla,
  .dot.pla {
    stroke: var(--series-2);
  }
  .dot {
    stroke-width: 2;
  }
  .dot.rom {
    fill: var(--series-1);
  }
  .dot.pla {
    fill: var(--series-2);
  }
  .cur {
    stroke: var(--mute);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .key {
    font-size: 10.5px;
    font-weight: 600;
  }
  .key.rom {
    fill: var(--series-1);
  }
  .key.pla {
    fill: var(--series-2);
  }
  dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem 1rem;
    margin: 0;
  }
  dl div {
    display: grid;
    gap: 0.05rem;
    border-left: 3px solid var(--line-strong);
    padding-left: 0.55rem;
  }
  dl .rom {
    border-left-color: var(--series-1);
  }
  dl .pla {
    border-left-color: var(--series-2);
  }
  dl .v {
    grid-column: 1 / -1;
  }
  dt {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 1.05rem;
  }
  small {
    font-size: 0.72rem;
    color: var(--mute);
  }
  dd.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: 0.74rem;
    margin-top: 0.3rem;
  }
  .chip {
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    color: var(--bad);
    font-weight: 500;
  }
  .chip.ok {
    color: var(--ok);
  }
</style>
