<!--
  Floating-point formats side by side: how a number is stored (sign, exponent, mantissa bits), what
  value survives rounding, and the range each format covers. The bfloat16 row uses the learner's
  toBf16 once their exercise passes.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { impl } from '$lib/exercise/impl.svelte';
  import { roundToFormat, FORMATS, type FloatFormat } from '../floats';

  const PRESETS: { label: string; x: number }[] = [
    { label: '0.1', x: 0.1 },
    { label: '1/3', x: 1 / 3 },
    { label: 'π', x: Math.PI },
    { label: '1 + 2⁻⁹', x: 1 + 2 ** -9 },
    { label: '1,000', x: 1000 },
    { label: '70,000', x: 70000 },
    { label: 'gradient 3 × 10⁻⁶', x: 3e-6 },
    { label: 'gradient 10⁻⁸', x: 1e-8 },
  ];

  let x = $state(Math.PI);
  let input = $state(String(Math.PI));
  const bf16 = $derived(impl.get('precision.toBf16', null as null | ((x: number) => number)));
  const mine = $derived(impl.isMine('precision.toBf16'));

  function setX(v: number) {
    x = v;
    input = String(v);
  }
  function parse(s: string) {
    input = s;
    const v = Number(s.replace(/[_,\s]/g, ''));
    if (Number.isFinite(v)) x = v;
  }

  interface Row {
    f: FloatFormat;
    value: number;
    bits: string;
    rel: number;
  }
  const rows = $derived(
    FORMATS.map((f): Row => {
      const r = roundToFormat(x, f);
      const value = f.name === 'bfloat16' && bf16 ? bf16(x) : r.value;
      return { f, value, bits: r.bits, rel: x === 0 ? 0 : Math.abs(value - x) / Math.abs(x) };
    }),
  );
  const lg = $derived(x === 0 ? -160 : Math.log2(Math.abs(x)));
  function show(v: number): string {
    if (!Number.isFinite(v)) return Number.isNaN(v) ? 'NaN' : v > 0 ? '+∞' : '−∞';
    if (v === 0) return '0';
    const a = Math.abs(v);
    return a >= 1e6 || a < 1e-4 ? v.toExponential(7) : v.toPrecision(10).replace(/\.?0+$/, '');
  }
  const pct = (r: number) => (!Number.isFinite(r) ? '—' : r === 0 ? 'exact' : r === 1 ? '100% (lost)' : r < 1e-3 ? `${r.toExponential(1)}` : `${(r * 100).toFixed(2)}%`);
</script>

<Widget
  title="Floating-point formats"
  subtitle="Type a number, or pick one. Each format stores a sign, an exponent (the range) and a mantissa (the precision); the number is rounded to the nearest value the format can hold."
  onreset={() => setX(Math.PI)}
>
  {#snippet controls()}
    <label class="inp ui">x = <input value={input} oninput={(e) => parse(e.currentTarget.value)} spellcheck="false" aria-label="Number" /></label>
    <div class="sl"><Slider label="log₂ |x|" min={-140} max={130} step={0.25} value={Math.max(-140, Math.min(130, lg))} oninput={(v) => setX(Math.sign(x || 1) * 2 ** v)} format={(v) => v.toFixed(1)} /></div>
  {/snippet}

  <div class="presets">
    {#each PRESETS as p (p.label)}<button class="chip" class:on={p.x === x} onclick={() => setX(p.x)}>{p.label}</button>{/each}
  </div>

  <div class="scroll">
    <table class="fmt">
      <thead><tr><th>format</th><th>bits: <span class="s">sign</span> <span class="e">exponent</span> <span class="m">mantissa</span></th><th>stored value</th><th>relative error</th></tr></thead>
      <tbody>
        {#each rows as r (r.f.name)}
          <tr>
            <td class="name">{r.f.name}{#if r.f.name === 'bfloat16' && mine}<span class="mine">your code</span>{/if}<span class="sub">{r.f.note}</span></td>
            <td class="bits"><span class="s">{r.bits[0]}</span><span class="e">{r.bits.slice(1, 1 + r.f.e)}</span><span class="m">{r.bits.slice(1 + r.f.e)}</span></td>
            <td class="num">{show(r.value)}</td>
            <td class="num" class:bad={!Number.isFinite(r.value) || (r.value === 0 && x !== 0)}>{pct(r.rel)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <Plot label="Range of each format on a log scale" height={200} margin={{ top: 8, right: 16, bottom: 42, left: 84 }} x={{ domain: [-150, 130], label: 'log₂ |value|', tickValues: [-149, -126, -24, -14, 0, 16, 128] }} y={{ domain: [FORMATS.length, 0], tickValues: FORMATS.map((_, i) => i + 0.5), format: (v) => FORMATS[Math.floor(v)]?.name ?? '' }} crosshair={false}>
    {#snippet marks({ sx, sy })}
      {#each FORMATS as f, i (f.name)}
        {@const lo = Math.log2(f.minSub)}
        {@const mid = Math.log2(f.minNormal)}
        {@const hi = Math.log2(f.max)}
        <rect x={sx(lo)} y={sy(i + 0.25)} width={sx(mid) - sx(lo)} height={sy(i + 0.75) - sy(i + 0.25)} fill="var(--series-{i + 1})" opacity="0.35" />
        <rect x={sx(mid)} y={sy(i + 0.25)} width={sx(hi) - sx(mid)} height={sy(i + 0.75) - sy(i + 0.25)} fill="var(--series-{i + 1})" />
      {/each}
      {#if x !== 0}<line x1={sx(Math.max(-150, lg))} x2={sx(Math.max(-150, lg))} y1={0} y2={sy(FORMATS.length)} stroke="var(--ink)" stroke-dasharray="3 3" />{/if}
    {/snippet}
  </Plot>
  <p class="note ui">Solid: normal numbers, with full precision. Faded: subnormal numbers, which trade precision for range near zero. Anything smaller than the faded bar rounds to 0; anything beyond the right end overflows. float16 covers only 2⁻²⁴ to 65,504, which is why training in it needs loss scaling. bfloat16 has float32’s range, with values spaced eight times more coarsely than float16’s.</p>
</Widget>

<style>
  .inp {
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  .inp input {
    font-family: var(--font-mono);
    width: 12rem;
    padding: 0.25rem 0.4rem;
    border: 1px solid var(--rule-strong);
    border-radius: 5px;
    background: var(--surface);
    color: var(--ink);
  }
  .sl {
    flex: 1 1 14rem;
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin: 0 0 0.6rem;
  }
  .chip {
    border: 1px solid var(--border-control);
    background: var(--surface);
    border-radius: 99px;
    padding: 0.18rem 0.6rem;
    font-size: 0.74rem;
    cursor: pointer;
    color: var(--ink-2);
  }
  .chip.on {
    background: var(--accent-soft);
    border-color: var(--accent-2);
    color: var(--accent-ink);
  }
  .scroll {
    overflow-x: auto;
  }
  .fmt {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    margin-bottom: 0.8rem;
  }
  .fmt th {
    text-align: left;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--ink-2);
  }
  .fmt td {
    border-top: 1px solid var(--rule);
    padding: 0.25rem 0.4rem;
    vertical-align: top;
  }
  .name {
    white-space: nowrap;
  }
  .sub {
    display: block;
    font-size: 0.7rem;
    color: var(--ink-3);
  }
  .mine {
    margin-left: 0.4rem;
    font-size: 0.66rem;
    padding: 0 0.3rem;
    border-radius: 3px;
    background: var(--accent-soft);
    color: var(--accent-ink);
  }
  .bits {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .s {
    color: var(--ink-3);
  }
  .e {
    color: var(--series-2);
  }
  .m {
    color: var(--series-1);
  }
  th .s,
  th .e,
  th .m {
    font-weight: 700;
  }
  .bad {
    color: var(--critical);
    font-weight: 600;
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.4rem 0 0;
  }
</style>
