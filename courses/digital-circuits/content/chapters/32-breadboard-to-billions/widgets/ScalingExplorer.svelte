<!--
  Figure 32.1, the scaling explorer: real processors from 1971 to 2024 on log axes, with the course's own designs
  (Octet, the RV32I core) drawn as horizontal lines on the same scale.

    ::scaling-explorer{n="32.1" caption="…"}
-->
<script lang="ts">
  import { base } from '$app/paths';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import {
    CHIPS,
    METRICS,
    YOURS,
    everyTwoYears,
    fitTrend,
    fitValue,
    formatValue,
    isNodeName,
    points,
    valueOf,
    yearWhen,
    type Chip,
    type Family,
    type Fit,
    type Metric,
  } from './scaling';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let metric = $state<Metric>('transistors');
  let showFit = $state(true);
  let showLine = $state(false);
  let mark2004 = $state(false);
  let showYours = $state(false);
  let selectedId = $state<string | undefined>('4004');
  let hoverId = $state<string | undefined>();
  let width = $state(640);

  const X0 = 1970;
  const X1 = 2026;
  const compact = $derived(width < 520);
  const M = $derived({ top: 14, right: compact ? 12 : 20, bottom: 40, left: compact ? 52 : 64 });
  const H = $derived(compact ? 300 : 350);
  const iw = $derived(Math.max(120, width - M.left - M.right));
  const ih = $derived(H - M.top - M.bottom);

  const pts = $derived(points(metric));
  const meta = $derived(METRICS.find((m) => m.id === metric)!);
  const canSplit = $derived(metric === 'clock' || metric === 'powerDensity');
  const yoursOn = $derived(showYours && (metric === 'transistors' || metric === 'clock'));
  const yoursValue = (y: (typeof YOURS)[number]) => (metric === 'transistors' ? y.transistors : y.clockMHz);

  // The transistor fit is used to date the course's own designs whatever metric is shown.
  const transistorFit = $derived(fitTrend(points('transistors')));

  const fits = $derived.by((): { fit: Fit; from: number; to: number; label: string }[] => {
    if (!showFit) return [];
    const groups =
      mark2004 && canSplit
        ? [
            { label: 'until 2004', set: pts.filter((p) => p.chip.year <= 2004) },
            { label: 'after 2004', set: pts.filter((p) => p.chip.year >= 2004) },
          ]
        : [{ label: 'all chips', set: pts }];
    return groups
      .filter((g) => g.set.length >= 3)
      .map((g) => ({ label: g.label, fit: fitTrend(g.set), from: Math.min(...g.set.map((p) => p.chip.year)), to: Math.max(...g.set.map((p) => p.chip.year)) }));
  });

  const domain = $derived.by((): [number, number] => {
    const vals = pts.map((p) => p.value);
    if (yoursOn) vals.push(...YOURS.map(yoursValue));
    if (showLine && metric === 'transistors') vals.push(everyTwoYears(X0), everyTwoYears(X1));
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    return [10 ** Math.floor(Math.log10(lo)), 10 ** Math.ceil(Math.log10(hi))];
  });
  const decades = $derived.by(() => {
    const out: number[] = [];
    for (let k = Math.log10(domain[0]); k <= Math.log10(domain[1]) + 1e-9; k++) out.push(10 ** Math.round(k));
    return out;
  });

  const px = (year: number) => ((year - X0) / (X1 - X0)) * iw;
  const py = (v: number) => ih - ((Math.log10(v) - Math.log10(domain[0])) / (Math.log10(domain[1]) - Math.log10(domain[0]))) * ih;

  const SI = [
    [1e12, 'T'],
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
  ] as const;
  function tick(v: number): string {
    if (metric === 'transistors' || metric === 'density') {
      for (const [s, u] of SI) if (v >= s) return `${v / s}${u}`;
      return `${v}`;
    }
    if (metric === 'node') return v >= 1000 ? `${v / 1000} µm` : `${v} nm`;
    if (metric === 'clock') return v >= 1000 ? `${v / 1000} GHz` : v < 1 ? `${v * 1000} kHz` : `${v} MHz`;
    return `${v >= 1000 ? `${v / 1000}k` : v}`;
  }

  const FAMILIES: { id: Family; label: string; cls: string }[] = [
    { id: 'x86', label: 'Intel x86', cls: 'f1' },
    { id: 'other', label: 'Other CPUs', cls: 'f2' },
    { id: 'soc', label: 'Apple chips', cls: 'f3' },
    { id: 'accelerator', label: 'AI accelerators', cls: 'f4' },
  ];
  const famCls = (f: Family) => FAMILIES.find((x) => x.id === f)!.cls;

  const selected = $derived(CHIPS.find((c) => c.id === selectedId));
  const active = $derived(CHIPS.find((c) => c.id === (hoverId ?? selectedId)));
  const labelled = (c: Chip) => c.id === active?.id || c.id === selectedId;

  function move(dir: 1 | -1) {
    const order = [...pts].sort((a, b) => a.chip.year - b.chip.year || a.value - b.value).map((p) => p.chip.id);
    const i = selectedId ? order.indexOf(selectedId) : -1;
    const next = i < 0 ? 0 : Math.min(order.length - 1, Math.max(0, i + dir));
    selectedId = order[next];
  }
  function onkey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') (e.preventDefault(), move(1));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') (e.preventDefault(), move(-1));
  }

  const fitText = (f: Fit) => {
    if (!Number.isFinite(f.doublingYears)) return 'flat';
    const k = 2 ** f.slope;
    if (metric === 'clock' || metric === 'powerDensity') return `×${k.toFixed(2)} a year`;
    return f.slope >= 0 ? `doubles every ${f.doublingYears.toFixed(1)} years` : `halves every ${(-f.doublingYears).toFixed(1)} years`;
  };

  const trendLabel = $derived(fits.length ? fits.map((f) => `${fits.length > 1 ? `${f.label}: ` : ''}${fitText(f.fit)}`).join('; ') : '');
  const labelForChart = $derived(
    `${meta.label} of ${pts.length} processors from 1971 to 2024 on a logarithmic scale. ${trendLabel ? `Fitted trend: ${trendLabel}. ` : ''}Use the arrow keys to step through the chips.`,
  );

  const lines = (f: { fit: Fit; from: number; to: number }) => `M${px(f.from)} ${py(fitValue(f.fit, f.from))} L${px(f.to)} ${py(fitValue(f.fit, f.to))}`;
  const inDomain = (v: number) => v >= domain[0] && v <= domain[1];

  const refHref = (key: string) => `${base}/appendix/glossary-timeline/#ref-${key}`;
  const detail = $derived(
    selected
      ? ([
          ['Transistors', formatValue(selected.transistors, 'transistors')],
          ['Process name', selected.nodeNm !== undefined ? formatValue(selected.nodeNm, 'node') : undefined],
          ['Clock', selected.clockMHz !== undefined ? formatValue(selected.clockMHz, 'clock') : undefined],
          ['Die area', selected.areaMm2 !== undefined ? `${Number(selected.areaMm2.toPrecision(4)).toLocaleString('en-GB')} mm²` : undefined],
          ['Power', selected.powerW !== undefined ? formatValue(selected.powerW, 'power') : undefined],
          ['Power per cm²', valueOf(selected, 'powerDensity') !== undefined ? formatValue(valueOf(selected, 'powerDensity')!, 'powerDensity') : undefined],
          ['Per mm²', valueOf(selected, 'density') !== undefined ? formatValue(valueOf(selected, 'density')!, 'density') : undefined],
        ] as [string, string | undefined][]).filter((r): r is [string, string] => r[1] !== undefined)
      : [],
  );
</script>

<Widget
  {n}
  title="Fifty years of chips"
  subtitle="Real processors on logarithmic axes, with Octet and the RV32I core beside them"
  kind="Interactive"
  {caption}
  onreset={() => {
    metric = 'transistors';
    showFit = true;
    showLine = false;
    mark2004 = false;
    showYours = false;
    selectedId = '4004';
  }}
>
  {#snippet controls()}
    <Segmented label="What to plot" value={metric} onchange={(v) => (metric = v)} options={METRICS.map((m) => ({ value: m.id, label: m.label, title: m.blurb }))} size="sm" />
    <Toggle label="Fitted trend" bind:checked={showFit} />
    {#if metric === 'transistors'}<Toggle label="Doubling every two years, from the 4004" bind:checked={showLine} />{/if}
    {#if canSplit}<Toggle label="Split at 2004" bind:checked={mark2004} />{/if}
    {#if metric === 'transistors' || metric === 'clock'}<Toggle label="Octet and RV32I" bind:checked={showYours} />{/if}
  {/snippet}

  <div class="se" bind:clientWidth={width}>
    <div class="plotwrap" role="group" aria-label={labelForChart} onkeydown={onkey}>
      <svg {width} height={H} role="presentation">
        <g transform="translate({M.left},{M.top})">
          {#each decades as d (d)}
            <line class="grid" x1="0" x2={iw} y1={py(d)} y2={py(d)} />
            <text class="tick" x="-8" y={py(d)} dy="0.32em" text-anchor="end">{tick(d)}</text>
          {/each}
          {#each [1970, 1980, 1990, 2000, 2010, 2020] as y (y)}
            <line class="grid v" x1={px(y)} x2={px(y)} y1="0" y2={ih} />
            <text class="tick" x={px(y)} y={ih + 16} text-anchor="middle">{y}</text>
          {/each}
          <line class="axis" x1="0" x2={iw} y1={ih} y2={ih} />
          <text class="axis-label" x={iw / 2} y={ih + 34} text-anchor="middle">year of launch</text>
          <text class="axis-label" transform="translate({-M.left + 12},{ih / 2}) rotate(-90)" text-anchor="middle">{meta.label}{meta.unit ? ` (${meta.unit})` : ''}</text>

          {#if mark2004 && canSplit}
            <line class="era" x1={px(2004.5)} x2={px(2004.5)} y1="0" y2={ih} />
            <text class="era-label" x={px(2004.5) + 5} y="11">2004: Tejas cancelled</text>
          {/if}

          {#if showLine && metric === 'transistors'}
            <path class="ref" d="M{px(X0)} {py(everyTwoYears(X0))} L{px(X1)} {py(everyTwoYears(X1))}" />
          {/if}

          {#each fits as f (f.label)}
            <path class="fit" d={lines(f)} />
          {/each}

          {#if yoursOn}
            {#each YOURS as y, i (y.id)}
              {#if inDomain(yoursValue(y))}
                <line class="yours" x1="0" x2={iw} y1={py(yoursValue(y))} y2={py(yoursValue(y))} />
                <text class="yours-label" x={iw - 4} y={py(yoursValue(y)) + (i === 0 ? -5 : 13)} text-anchor="end">{y.id === 'octet' ? 'Octet' : 'RV32I core'}: {formatValue(yoursValue(y), metric)}</text>
              {/if}
            {/each}
          {/if}

          {#each pts as p (p.chip.id)}
            {@const c = p.chip}
            {@const x = px(c.year)}
            {@const y = py(p.value)}
            {@const hollow = metric === 'node' && isNodeName(c)}
            <g
              class="pt {famCls(c.family)}"
              class:sel={c.id === selectedId}
              class:hollow
              role="button"
              tabindex="0"
              aria-pressed={c.id === selectedId}
              aria-label="{c.name}, {c.year}: {formatValue(p.value, metric)}"
              onclick={() => (selectedId = c.id)}
              onpointerenter={() => (hoverId = c.id)}
              onpointerleave={() => (hoverId = undefined)}
              onfocus={() => (hoverId = c.id)}
              onblur={() => (hoverId = undefined)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') (e.preventDefault(), (selectedId = c.id));
              }}
            >
              <circle class="hit" cx={x} cy={y} r="13" />
              {#if c.family === 'x86'}
                <circle class="mark" cx={x} cy={y} r="5.5" />
              {:else if c.family === 'other'}
                <rect class="mark" x={x - 5} y={y - 5} width="10" height="10" />
              {:else if c.family === 'soc'}
                <path class="mark" d="M{x} {y - 7} L{x + 6.5} {y} L{x} {y + 7} L{x - 6.5} {y} Z" />
              {:else}
                <path class="mark" d="M{x} {y - 6.5} L{x + 6.5} {y + 5} L{x - 6.5} {y + 5} Z" />
              {/if}
              {#if labelled(c)}
                <text class="lab" x={c.year > 2008 ? x - 9 : x + 9} y={y - 8} text-anchor={c.year > 2008 ? 'end' : 'start'}>{c.name}</text>
              {/if}
            </g>
          {/each}
        </g>
      </svg>
    </div>

    <ul class="legend ui" aria-label="Key">
      {#each FAMILIES as f (f.id)}
        <li class={f.cls}>
          <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true">
            {#if f.id === 'x86'}<circle class="mark" r="5.5" />{:else if f.id === 'other'}<rect class="mark" x="-5" y="-5" width="10" height="10" />{:else if f.id === 'soc'}<path class="mark" d="M0 -7 L6.5 0 L0 7 L-6.5 0 Z" />{:else}<path class="mark" d="M0 -6.5 L6.5 5 L-6.5 5 Z" />{/if}
          </svg>
          {f.label}
        </li>
      {/each}
      {#if metric === 'node'}<li class="note">Hollow: since about 1997 a name, not a measurement</li>{/if}
    </ul>

    <div class="read ui" aria-live="polite">
      {#if trendLabel}<p class="trend"><strong>Trend:</strong> {trendLabel}{#if fits.length === 1}, r² = {fits[0]!.fit.r2.toFixed(2)}{/if}.</p>{/if}
      {#if yoursOn}
        <p class="yours-read">
          {#each YOURS as y (y.id)}
            {@const v = yoursValue(y)}
            <span>
              <strong>{y.id === 'octet' ? 'Octet' : 'RV32I core'}</strong>: {formatValue(v, metric)}{#if metric === 'transistors'}, which the trend line reached in <strong>{Math.round(yearWhen(transistorFit, v))}</strong>{/if}.
            </span>
          {/each}
        </p>
      {/if}
      {#if active}
        <div class="card">
          <h5>{active.name} <span class="yr">{active.year}</span></h5>
          <dl>
            {#if active.id === selectedId || !hoverId}
              {#each detail as [k, v] (k)}<div><dt>{k}</dt><dd>{v}</dd></div>{/each}
            {:else}
              <div><dt>{meta.label}</dt><dd>{valueOf(active, metric) !== undefined ? formatValue(valueOf(active, metric)!, metric) : 'no data'}</dd></div>
            {/if}
          </dl>
          {#if selected && (active.id === selectedId || !hoverId)}
            {#if selected.note}<p class="cnote">{selected.note}</p>{/if}
            <p class="src">Sources: {#each [selected.source, ...(selected.extra ?? [])] as k, i (k)}{i ? ', ' : ''}<a href={refHref(k)}>{k}</a>{/each}</p>
          {:else}
            <p class="cnote">Click or press Enter to select and see every number and source.</p>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</Widget>

<style>
  .se {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .plotwrap {
    min-width: 0;
  }
  svg {
    display: block;
    overflow: visible;
    font-family: var(--font-ui);
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }
  .grid.v {
    stroke-dasharray: 2 4;
  }
  .axis {
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .tick {
    fill: var(--mute);
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
  }
  .axis-label {
    fill: var(--ink-2);
    font-size: 11.5px;
  }
  .fit {
    fill: none;
    stroke: var(--ink-2);
    stroke-width: 1.6;
    opacity: 0.8;
  }
  .ref {
    fill: none;
    stroke: var(--sig-high);
    stroke-width: 1.6;
    stroke-dasharray: 6 4;
  }
  .era {
    stroke: var(--bad);
    stroke-width: 1.3;
    stroke-dasharray: 3 3;
  }
  .era-label {
    fill: var(--bad);
    font-size: 10.5px;
  }
  .yours {
    stroke: var(--c-lab);
    stroke-width: 1.6;
    stroke-dasharray: 8 4;
  }
  .yours-label {
    fill: var(--c-lab);
    font-size: 11px;
    font-weight: 600;
  }
  .pt {
    cursor: pointer;
    outline: none;
  }
  .pt .hit {
    fill: transparent;
  }
  .pt .mark {
    stroke: var(--panel);
    stroke-width: 1.5;
    transition: transform 120ms;
  }
  .pt:hover .mark,
  .pt:focus-visible .mark {
    stroke: var(--fg);
  }
  .pt:focus-visible .hit {
    stroke: var(--copper);
    stroke-width: 2;
  }
  .pt.sel .mark {
    stroke: var(--fg);
    stroke-width: 2.5;
  }
  .pt.hollow .mark {
    fill: var(--panel) !important;
    stroke-width: 2;
  }
  .lab {
    fill: var(--fg);
    font-size: 10.5px;
    font-weight: 600;
    paint-order: stroke;
    stroke: var(--panel);
    stroke-width: 3px;
    pointer-events: none;
  }
  .f1 .mark {
    fill: var(--series-1);
  }
  .f2 .mark {
    fill: var(--series-2);
  }
  .f3 .mark {
    fill: var(--series-3);
  }
  .f4 .mark {
    fill: var(--series-4);
  }
  .pt.hollow.f1 .mark {
    stroke: var(--series-1);
  }
  .pt.hollow.f2 .mark {
    stroke: var(--series-2);
  }
  .pt.hollow.f3 .mark {
    stroke: var(--series-3);
  }
  .pt.hollow.f4 .mark {
    stroke: var(--series-4);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
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
    margin: 0;
  }
  .legend .note {
    color: var(--mute);
  }
  .read {
    display: grid;
    gap: 0.5rem;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .read p {
    margin: 0;
  }
  .yours-read {
    display: grid;
    gap: 0.15rem;
    color: var(--c-lab);
  }
  .card {
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--pn);
    padding: 0.6rem 0.8rem;
    min-width: 0;
  }
  h5 {
    margin: 0 0 0.4rem !important;
    font-family: var(--font-display);
    font-size: 0.98rem;
    color: var(--fg);
  }
  .yr {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 0.8rem;
    color: var(--mute);
    margin-left: 0.4rem;
  }
  dl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1.3rem;
    margin: 0;
  }
  dl div {
    min-width: 0;
  }
  dt {
    font-size: 0.7rem;
    color: var(--mute);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 0.86rem;
    color: var(--fg);
    overflow-wrap: anywhere;
  }
  .cnote,
  .src {
    margin: 0.45rem 0 0 !important;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .src {
    color: var(--mute);
  }
  .src a {
    color: var(--copper-ink);
  }
</style>
