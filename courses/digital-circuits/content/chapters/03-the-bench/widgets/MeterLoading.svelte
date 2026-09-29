<!--
  Meter loading. A voltmeter is a resistor across the thing it measures. Put a 10 MΩ meter on a divider made of two
  10 MΩ resistors and it reads 3.33 V instead of 5 V. Shrink the divider and the error vanishes.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { formatSI } from '$lib/bench/format';
  import { loading } from './loading';

  let { n }: { n?: string } = $props();

  const VS = 10;
  let r = $state(1e7);
  let rin = $state(1e7);
  const l = $derived(loading(VS, r, r, rin));
  const nb = (s: string) => s.replace(/ /g, ' ');
  const pct = $derived(`${l.error > 0 ? '+' : '−'}${Math.abs(l.error * 100).toFixed(Math.abs(l.error) < 0.001 ? 2 : 1)} %`);
  const bad = $derived(Math.abs(l.error) > 0.02);
</script>

<Widget title="The meter is part of the circuit" {n} kind="Interactive" caption="Two equal resistors divide 10 V exactly in half. Start with 10 MΩ each and a 10 MΩ meter, then shrink the resistors.">
  <div class="ml ui">
    <svg viewBox="0 0 320 160" role="img" aria-label="A 10 V source across two resistors R and R in series, with a voltmeter of input resistance Rin across the lower one">
      <g class="w">
        <path d="M40 24 H150 V40 M150 70 V98 M150 128 V144 H40 V100 M40 68 V24" />
        <path d="M150 84 H230 V94 M230 126 V144 H150" />
      </g>
      <rect x="142" y="40" width="16" height="30" class="b" />
      <rect x="142" y="98" width="16" height="30" class="b" />
      <circle cx="150" cy="84" r="3.5" class="dot" />
      <rect x="208" y="94" width="44" height="32" rx="6" class="meter" />
      <text x="230" y="116" text-anchor="middle" class="mt">V</text>
      <g class="src"><circle cx="40" cy="84" r="16" /><text x="40" y="88" text-anchor="middle">10 V</text></g>
      <text x="130" y="59" text-anchor="end" class="t">R</text>
      <text x="130" y="117" text-anchor="end" class="t">R</text>
      <text x="262" y="114" class="t mute">Rin</text>
      <text x="168" y="59" class="v">{nb(formatSI(VS - l.reading, 'V', 3))}</text>
      <text x="168" y="76" class="v" class:bad>{nb(formatSI(l.reading, 'V', 3))}</text>
    </svg>
    <div class="cards">
      <div class="card"><span class="k">the voltage there really is</span><span class="n">{nb(formatSI(l.ideal, 'V', 3))}</span></div>
      <div class="card" class:bad><span class="k">what the meter says</span><span class="n">{nb(formatSI(l.reading, 'V', 3))}</span><span class="e">{pct}</span></div>
    </div>
    <div class="ctl">
      <Slider label="Divider resistors (each)" min={1e3} max={1e8} log bind:value={r} format={(v) => nb(formatSI(v, 'Ω', 2))} />
      <div class="rin">
        <span class="lbl">Meter input resistance</span>
        <Segmented
          size="sm"
          label="Meter input resistance"
          bind:value={rin}
          options={[
            { value: 2e5, label: '200 kΩ', title: 'An analogue meter (20 kΩ per volt on its 10 V range)' },
            { value: 1e6, label: '1 MΩ' },
            { value: 1e7, label: '10 MΩ', title: 'A typical digital multimeter' },
            { value: 1e8, label: '100 MΩ' },
          ]}
        />
      </div>
    </div>
  </div>
</Widget>

<style>
  .ml {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.8rem 1.4rem;
    align-items: center;
  }
  @media (max-width: 700px) {
    .ml {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  svg {
    width: 100%;
    max-width: 340px;
    margin: 0 auto;
    display: block;
    font-family: var(--font-ui);
  }
  .w {
    fill: none;
    stroke: var(--wire);
    stroke-width: 2;
    stroke-linecap: round;
  }
  .b {
    fill: var(--panel);
    stroke: var(--wire);
    stroke-width: 2;
  }
  .dot {
    fill: var(--wire);
  }
  .meter {
    fill: color-mix(in srgb, var(--copper) 12%, var(--panel));
    stroke: var(--copper);
    stroke-width: 2;
  }
  .mt {
    font-size: 18px;
    font-weight: 700;
    fill: var(--copper-ink);
  }
  .src circle {
    fill: var(--panel);
    stroke: var(--wire);
    stroke-width: 2;
  }
  .src text {
    font-size: 11px;
    font-weight: 700;
    fill: var(--fg);
  }
  .t {
    font-size: 13px;
    fill: var(--fg);
    font-weight: 600;
  }
  .t.mute {
    fill: var(--mute);
    font-weight: 500;
  }
  .v {
    font-family: var(--font-mono);
    font-size: 12px;
    fill: var(--ink-2);
  }
  .v.bad {
    fill: var(--bad);
    font-weight: 700;
  }
  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  .card {
    flex: 1 1 9rem;
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--pn);
  }
  .card.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .k {
    font-size: 0.72rem;
    color: var(--mute);
  }
  .n {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--fg);
  }
  .e {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--bad);
    font-weight: 600;
  }
  .ctl {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem 2rem;
    align-items: flex-end;
  }
  .rin {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .lbl {
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
