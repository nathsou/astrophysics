<!--
  The resistor colour code, both ways. "Bands to value": choose the colour of each band and read the value,
  tolerance and range. "Value to bands": type a value (4.7k, 4k7, 220, 0R47) and see the bands, with the nearest
  preferred values if it is not one.

    ::colour-code{}
-->
<script lang="ts">
  import './appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { formatSI } from '$lib/bench/format';
  import {
    COLOURS,
    DIGIT_COLOURS,
    MULTIPLIER_COLOURS,
    NO_TOLERANCE,
    TEMPCO_COLOURS,
    TOLERANCE_COLOURS,
    colour,
    decode,
    encode,
    multiplierLabel,
    nearestPreferred,
    parseResistance,
    shopCode,
    type BandCount,
    type Colour,
  } from './colour-code';

  let { n }: { n?: string | number } = $props();

  let mode = $state<'bands' | 'value'>('bands');
  let count = $state<BandCount>(4);
  let digitBands = $state(['yellow', 'violet', 'black']);
  let multBand = $state('red');
  let tolBand = $state('gold');
  let tempBand = $state('brown');
  let text = $state('4.7k');
  let toleranceIn = $state(5);

  const nd = $derived(count === 4 ? 2 : 3);
  const digits = $derived(nd as 2 | 3);
  const bands = $derived([...digitBands.slice(0, nd), multBand, tolBand, ...(count === 6 ? [tempBand] : [])]);

  /** Which colours a band may take, by its position. */
  function choices(i: number): Colour[] {
    if (i < nd) return DIGIT_COLOURS;
    if (i === nd) return MULTIPLIER_COLOURS;
    if (i === nd + 1) return TOLERANCE_COLOURS;
    return TEMPCO_COLOURS;
  }
  function roleName(i: number): string {
    if (i < nd) return `Digit ${i + 1}`;
    if (i === nd) return 'Multiplier';
    if (i === nd + 1) return 'Tolerance';
    return 'Temp. coeff.';
  }
  function setBand(i: number, v: string) {
    if (i < nd) digitBands[i] = v;
    else if (i === nd) multBand = v;
    else if (i === nd + 1) tolBand = v;
    else tempBand = v;
  }

  const shown = $derived(bands);
  const decoded = $derived(decode(shown));

  const value = $derived(parseResistance(text));
  const encoded = $derived(value === undefined ? undefined : encode(value, digits, toleranceIn));
  const bandsShown = $derived<string[]>(mode === 'bands' ? shown : encoded?.ok ? [...encoded.bands, ...(count === 6 ? [tempBand] : [])] : []);

  const fmt = (ohms: number) => formatSI(ohms, 'Ω', 3);
  const range = (ohms: number, tol: number) => `${fmt(ohms * (1 - tol / 100))} to ${fmt(ohms * (1 + tol / 100))}`;

  // Geometry of the drawing: a resistor lying down, bands bunched towards the left end.
  const bandX = $derived(bandsShown.length === 4 ? [58, 84, 110, 152] : bandsShown.length === 5 ? [54, 76, 98, 120, 160] : [50, 70, 90, 110, 130, 168]);
  const aria = $derived(bandsShown.length ? `Resistor with bands ${bandsShown.join(', ')}` : 'Resistor');
</script>

<Widget title="Resistor colour code" {n} kind="Decoder" live={false} caption="Pick colours and read the value, or type a value and read the colours. Hold the resistor with the gold or silver band on the right: reading starts at the end where the bands are bunched together.">
  {#snippet controls()}
    <Segmented label="Direction" value={mode} onchange={(v) => (mode = v)} options={[{ value: 'bands', label: 'Bands → value' }, { value: 'value', label: 'Value → bands' }]} />
    <Segmented label="Number of bands" value={count} onchange={(v) => (count = v)} options={[{ value: 4, label: '4 bands' }, { value: 5, label: '5 bands' }, { value: 6, label: '6 bands' }]} />
  {/snippet}

  <div class="cc">
    <svg class="resistor" viewBox="0 0 240 70" role="img" aria-label={aria}>
      <path class="lead" d="M4 35 H42 M198 35 H236" />
      <rect class="tube" x="40" y="14" width="160" height="42" rx="20" />
      {#each bandsShown as b, i (i)}
        {@const c = colour(b)}
        <rect class="band" x={bandX[i]} y="14" width="12" height="42" fill={c.paint} />
      {/each}
      {#if bandsShown.length === 0}
        <text class="empty" x="120" y="40" text-anchor="middle">—</text>
      {/if}
    </svg>

    {#if mode === 'bands'}
      <div class="pickers">
        {#each shown as b, i (i)}
          {@const c = colour(b)}
          <label class="ap-label">
            <span>{roleName(i)}</span>
            <span class="pick">
              <span class="swatch" style:background={c.paint} aria-hidden="true"></span>
              <select class="ap-input" value={b} onchange={(e) => setBand(i, e.currentTarget.value)} aria-label="Band {i + 1}: {roleName(i)}">
                {#each choices(i) as o (o.name)}
                  <option value={o.name}>
                    {o.name}
                    {#if i < nd}({o.digit}){:else if i === nd}({multiplierLabel(o.power!)}){:else if i === nd + 1}(±{o.tolerance} %){:else}({o.tempco} ppm/K){/if}
                  </option>
                {/each}
              </select>
            </span>
          </label>
        {/each}
      </div>

      <div class="result" aria-live="polite">
        {#if decoded.ok}
          <div class="big">{fmt(decoded.ohms)} <span class="tol">±{decoded.tolerance} %</span></div>
          <div class="sub">
            Shop code <code>{shopCode(decoded.ohms)}</code> · between {range(decoded.ohms, decoded.tolerance)}{#if decoded.tempco}
              · drifts up to {decoded.tempco} ppm per kelvin{/if}
          </div>
        {:else}
          <div class="ap-bad">{decoded.message}</div>
        {/if}
      </div>
    {:else}
      <div class="entry">
        <label class="ap-label">
          <span>Resistance</span>
          <input class="ap-input" type="text" inputmode="text" bind:value={text} aria-invalid={value === undefined || encoded?.ok === false} placeholder="4.7k, 4k7, 220, 0R47" spellcheck="false" autocomplete="off" />
        </label>
        <label class="ap-label">
          <span>Tolerance</span>
          <select class="ap-input" bind:value={toleranceIn}>
            {#each TOLERANCE_COLOURS as t (t.name)}
              <option value={t.tolerance}>±{t.tolerance} % ({t.name})</option>
            {/each}
          </select>
        </label>
        {#if count === 6}
          <label class="ap-label">
            <span>Temp. coeff.</span>
            <select class="ap-input" bind:value={tempBand}>
              {#each TEMPCO_COLOURS as t (t.name)}
                <option value={t.name}>{t.tempco} ppm/K ({t.name})</option>
              {/each}
            </select>
          </label>
        {/if}
      </div>

      <div class="result" aria-live="polite">
        {#if value === undefined}
          <div class="ap-bad">Type a resistance such as 4.7k, 4k7, 2M2 or 220.</div>
        {:else if encoded && !encoded.ok}
          <div class="ap-bad">{encoded.message}</div>
        {:else if encoded?.ok}
          <div class="names">
            {#each encoded.bands as b, i (i)}
              {@const c = colour(b)}
              <span class="chip" style:background={c.paint} style:color={c.ink}>{b}</span>
            {/each}
            {#if count === 6}<span class="chip" style:background={colour(tempBand).paint} style:color={colour(tempBand).ink}>{tempBand}</span>{/if}
          </div>
          {#if encoded.exact}
            <div class="sub">Exactly {fmt(encoded.ohms)}, tolerance ±{toleranceIn} %. Shop code <code>{shopCode(encoded.ohms)}</code>.</div>
          {:else}
            <div class="sub">
              With {digits} digits the bands say {fmt(encoded.ohms)}, not {fmt(value!)}. {#if digits === 2}Try five bands for three digits.{/if}
            </div>
          {/if}
          {@const e12 = nearestPreferred(value!, 'E12')}
          {@const e24 = nearestPreferred(value!, 'E24')}
          {@const e96 = nearestPreferred(value!, 'E96')}
          <div class="sub">
            Nearest preferred values: E12 {fmt(e12)}, E24 {fmt(e24)}, E96 {fmt(e96)}.
            {#if value === e24}This is an E24 value, so a shop will have it at 5 %.{:else}It is not an E24 value: expect to use one of these instead.{/if}
          </div>
        {/if}
      </div>
    {/if}

    <details class="table">
      <summary>The whole code</summary>
      <table>
        <thead><tr><th>Colour</th><th>Digit</th><th>Multiplier</th><th>Tolerance</th><th>Temp. coeff.</th></tr></thead>
        <tbody>
          {#each COLOURS as c (c.name)}
            <tr>
              <th scope="row"><span class="sw2" style:background={c.paint}></span>{c.name}</th>
              <td>{c.digit ?? ''}</td>
              <td>{c.power === undefined ? '' : multiplierLabel(c.power)}</td>
              <td>{c.tolerance === undefined ? '' : `±${c.tolerance} %`}</td>
              <td>{c.tempco === undefined ? '' : `${c.tempco} ppm/K`}</td>
            </tr>
          {/each}
          <tr><th scope="row">no band</th><td></td><td></td><td>±{NO_TOLERANCE} %</td><td></td></tr>
        </tbody>
      </table>
    </details>
  </div>
</Widget>

<style>
  .cc {
    display: grid;
    gap: 1rem;
    padding: 1rem 1.1rem 1.2rem;
  }
  .resistor {
    display: block;
    width: min(100%, 26rem);
    height: auto;
    margin: 0 auto;
  }
  .lead {
    stroke: var(--wire);
    stroke-width: 3;
    stroke-linecap: round;
    fill: none;
  }
  .tube {
    fill: light-dark(#d8c7a0, #8b7d5c);
    stroke: var(--line-strong);
    stroke-width: 1.5;
  }
  .band {
    stroke: color-mix(in srgb, var(--fg) 40%, transparent);
    stroke-width: 0.6;
  }
  .empty {
    fill: var(--mute);
    font-size: 20px;
  }
  .pickers,
  .entry {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
    gap: 0.7rem;
  }
  .pick {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .pick select {
    flex: 1;
    min-width: 0;
  }
  .swatch,
  .sw2 {
    flex: none;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
  }
  .sw2 {
    display: inline-block;
    vertical-align: -0.2em;
    margin-right: 0.5rem;
  }
  .result {
    display: grid;
    gap: 0.35rem;
    padding: 0.8rem 0.95rem;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 8px;
  }
  .big {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--fg);
  }
  .tol {
    font-size: 1rem;
    color: var(--copper-ink);
    font-weight: 500;
  }
  .sub {
    font-family: var(--font-ui);
    font-size: 0.86rem;
    line-height: 1.5;
    color: var(--ink-2);
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.85em;
  }
  .names {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .chip {
    padding: 0.25rem 0.65rem;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    font-family: var(--font-ui);
    font-size: 0.85rem;
    font-weight: 600;
  }
  .table summary {
    cursor: pointer;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    font-weight: 600;
    color: var(--ink-2);
  }
  table {
    width: 100%;
    margin-top: 0.6rem;
    border-collapse: collapse;
    font-family: var(--font-ui);
    font-size: 0.84rem;
  }
  th,
  td {
    padding: 0.3rem 0.5rem;
    text-align: left;
    border-bottom: 1px solid var(--line);
    white-space: nowrap;
  }
  tbody th {
    font-family: var(--font-ui);
    font-size: 0.84rem;
    text-transform: none;
    letter-spacing: 0;
    color: var(--fg);
  }
  thead th {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
  }
  .table {
    overflow-x: auto;
  }
</style>
