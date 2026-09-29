<!--
  Logic levels of common families: a table of the guaranteed thresholds and output levels drawn as bars, and a
  "can this drive that?" checker built on the same numbers.

    ::logic-levels{}
-->
<script lang="ts">
  import './appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import { FAMILIES, family, link } from './levels';

  let { n }: { n?: string | number } = $props();

  let from = $state('hc');
  let to = $state('lvcmos33');
  const result = $derived(link(family(from), family(to)));
  const fmt = (v: number) => v.toFixed(2).replace(/\.?0+$/, '');

  // One bar per family on a common 0–5.5 V axis: forbidden zone between VIL and VIH.
  const AXIS = 5.5;
  const H = 120;
  const y = (v: number) => H - (v / AXIS) * H;
</script>

<Widget title="Logic levels" {n} kind="Reference" live={false} caption="Each bar is one family on a common voltage scale: the amber region is read as a 1, the slate region as a 0, and the gap between them is a forbidden zone. Choose a driver and a receiver below to see whether they can be wired together.">
  <div class="ll">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="table" role="region" aria-label="Logic levels of five families" tabindex="0">
      <table>
        <thead>
          <tr>
            <th scope="col">Family</th>
            <th scope="col">Supply</th>
            <th scope="col">V<sub>IH</sub> min</th>
            <th scope="col">V<sub>IL</sub> max</th>
            <th scope="col">V<sub>OH</sub> min</th>
            <th scope="col">V<sub>OL</sub> max</th>
            <th scope="col">Used for</th>
          </tr>
        </thead>
        <tbody>
          {#each FAMILIES as f (f.id)}
            <tr>
              <th scope="row">{f.name}</th>
              <td>{f.vcc} V</td>
              <td>{fmt(f.vih)} V</td>
              <td>{fmt(f.vil)} V</td>
              <td>{fmt(f.voh)} V<span class="at">at −{f.ioh} mA</span></td>
              <td>{fmt(f.vol)} V<span class="at">at {f.iol} mA</span></td>
              <td class="where">{f.where}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="bars" role="img" aria-label="Bar chart of the input and output levels of each family, described in the table above">
      {#each FAMILIES as f (f.id)}
        <figure>
          <svg viewBox="0 0 118 {H + 8}" width="118" height={H + 8}>
            {#each [0, 1, 2, 3, 4, 5] as v (v)}
              <path class="grid" d="M22 {y(v) + 4} H114" />
              <text class="tick" x="18" y={y(v) + 7} text-anchor="end">{v}</text>
            {/each}
            <g transform="translate(20 4)">
              <rect class="zone hi" x="4" y={y(Math.min(f.vcc + 0.4, AXIS))} width="40" height={y(f.vih) - y(Math.min(f.vcc + 0.4, AXIS))} />
              <rect class="zone lo" x="4" y={y(f.vil)} width="40" height={y(0) - y(f.vil)} />
              <rect class="outb hi" x="52" y={y(f.vcc)} width="40" height={y(f.voh) - y(f.vcc)} />
              <rect class="outb lo" x="52" y={y(f.vol)} width="40" height={y(0) - y(f.vol)} />
              <path class="axis" d="M4 {y(f.vih)} H44 M4 {y(f.vil)} H44 M52 {y(f.voh)} H92 M52 {y(f.vol)} H92" />
            </g>
          </svg>
          <figcaption>{f.name}</figcaption>
        </figure>
      {/each}
      <p class="key"><span class="k in">inputs read</span> left bar · <span class="k out">outputs guarantee</span> right bar · scale in volts</p>
    </div>

    <div class="check">
      <h5>Can it drive it?</h5>
      <div class="row">
        <label class="ap-label">
          <span>Driver</span>
          <select class="ap-input" bind:value={from}>
            {#each FAMILIES as f (f.id)}<option value={f.id}>{f.name} ({f.vcc} V)</option>{/each}
          </select>
        </label>
        <span class="arrow" aria-hidden="true">→</span>
        <label class="ap-label">
          <span>Receiver</span>
          <select class="ap-input" bind:value={to}>
            {#each FAMILIES as f (f.id)}<option value={f.id}>{f.name} ({f.vcc} V)</option>{/each}
          </select>
        </label>
      </div>
      <p class="verdict" class:ap-ok={result.ok} class:ap-bad={!result.ok} aria-live="polite">{result.verdict}</p>
      <p class="ap-note">Uses the output levels at light load (a CMOS input takes microamps) and the receiver’s absolute-maximum input voltage. A TTL input draws about 0.4 mA when low, which pulls a CMOS output’s levels closer to the thresholds.</p>
    </div>
  </div>
</Widget>

<style>
  .ll {
    display: grid;
    gap: 1.2rem;
    padding: 1rem 1.1rem 1.2rem;
  }
  .table {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-ui);
    font-size: 0.84rem;
  }
  tbody th {
    font-family: var(--font-ui);
    font-size: 0.86rem;
    text-transform: none;
    letter-spacing: 0;
    color: var(--fg);
  }
  th,
  td {
    padding: 0.4rem 0.6rem;
    text-align: left;
    border-bottom: 1px solid var(--line);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  thead th {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--mute);
  }
  .at {
    margin-left: 0.35em;
    font-size: 0.72rem;
    color: var(--mute);
  }
  .where {
    white-space: normal;
    min-width: 12rem;
    color: var(--ink-2);
  }
  .bars {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.4rem;
    justify-content: center;
    align-items: flex-end;
  }
  figure {
    margin: 0;
    display: grid;
    justify-items: center;
    gap: 0.3rem;
  }
  figcaption {
    font-family: var(--font-ui);
    font-size: 0.74rem;
    color: var(--ink-2);
  }
  .zone.hi,
  .outb.hi {
    fill: color-mix(in srgb, var(--sig-high) 45%, transparent);
    stroke: var(--sig-high);
  }
  .zone.lo,
  .outb.lo {
    fill: color-mix(in srgb, var(--sig-low) 40%, transparent);
    stroke: var(--sig-low);
  }
  .zone,
  .outb {
    stroke-width: 1;
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }
  .tick {
    fill: var(--mute);
    font-family: var(--font-mono);
    font-size: 8px;
  }
  .axis {
    stroke: var(--fg);
    stroke-width: 1.4;
    fill: none;
  }
  .key {
    flex-basis: 100%;
    margin: 0 !important;
    text-align: center;
    font-family: var(--font-ui);
    font-size: 0.76rem;
    color: var(--mute);
  }
  .check {
    padding: 0.9rem 1rem;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 8px;
  }
  h5 {
    margin: 0 0 0.6rem !important;
    padding: 0 !important;
    border: 0 !important;
    font-family: var(--font-display) !important;
    font-size: 0.98rem !important;
  }
  h5::before,
  h5::after {
    display: none !important;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
    align-items: end;
  }
  .row .ap-label {
    flex: 1 1 11rem;
  }
  .arrow {
    font-size: 1.3rem;
    color: var(--mute);
    padding-bottom: 0.25rem;
  }
  .verdict {
    margin: 0.8rem 0 0.3rem !important;
    font-family: var(--font-ui);
    font-weight: 600;
    font-size: 0.95rem;
  }
</style>
