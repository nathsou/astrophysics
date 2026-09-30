<!--
  The live seven-segment decoder. Four bits go in (toggle them, press a hex key, or let it count), seven
  segments come out. The display is driven by the minimised equations of the segments, evaluated exactly as
  the gates would, so what it shows is what the logic says. In Equations mode every segment has its formula
  (click a segment or a row), the digits that light it, and the gate circuit for it, running on the digital
  engine; switching between hexadecimal and decimal shows what don't-cares are worth.

    ::seven-seg-decoder{n="13.8" caption="…"}
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { prefersReducedMotion } from '$lib/theme/signals';
  import type { ParamValue } from '$lib/sim/netlist/types';
  import LiveDag from '../../11-boolean-algebra/widgets/LiveDag.svelte';
  import { layoutDag } from '../../11-boolean-algebra/widgets/layout';
  import { DC_CODES, HEX, INPUTS, SEG_NAMES, allEquations, decoded, segmentDag, segmentLit, sharedCost, sharedNetwork, type SegMode } from './seg';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  let mode = $state<SegMode>('hex');
  let view = $state<'explore' | 'equations'>('explore');
  let digit = $state(5);
  let selected = $state(0);
  let playing = $state(false);
  let reduced = $state(false);
  let generation = $state(0);
  let root: HTMLDivElement | undefined = $state();

  const eqs = $derived(allEquations(mode));
  const mask = $derived(decoded(digit, mode));
  const bits = $derived([3, 2, 1, 0].map((b) => (digit >> b) & 1));
  const never = $derived(mode === 'bcd' && digit > 9);
  const lit = $derived(SEG_NAMES.filter((_, s) => (mask >> s) & 1));
  const cur = $derived(eqs[selected]!);
  const alone = $derived(sharedCost(mode));
  const shared = $derived(sharedNetwork(mode));
  const aloneLiterals = $derived(eqs.reduce((a, e) => a + e.literals, 0));

  const circuit = $derived.by(() => {
    void generation;
    const values = untrack(() => Object.fromEntries(INPUTS.map((nm, v) => [nm, !!bits[v]])));
    return layoutDag(segmentDag(selected, mode), { title: `Segment ${SEG_NAMES[selected]}`, values });
  });

  function setDigit(d: number) {
    digit = d & 15;
    generation++;
  }
  function flipBit(b: number) {
    setDigit(digit ^ (1 << b));
  }
  function onparam(id: string, key: string, value: ParamValue) {
    const v = INPUTS.findIndex((nm) => id === `in_${nm}`);
    if (v < 0 || key !== 'on') return;
    const b = 3 - v;
    digit = value ? digit | (1 << b) : digit & ~(1 << b);
  }
  function setMode(m: SegMode) {
    mode = m;
    generation++;
  }
  function reset() {
    mode = 'hex';
    view = 'explore';
    digit = 5;
    selected = 0;
    playing = false;
    generation++;
  }

  onMount(() => {
    reduced = prefersReducedMotion();
    if (!root) return;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(root);
    const timer = setInterval(() => {
      if (playing && visible && !document.hidden) setDigit(digit + 1);
    }, 900);
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
  });

  // ── The display ───────────────────────────────────────────────────────────────
  const T = 10;
  const hseg = (cx: number, cy: number, L: number) => `${cx - L / 2 - T / 2},${cy} ${cx - L / 2},${cy - T / 2} ${cx + L / 2},${cy - T / 2} ${cx + L / 2 + T / 2},${cy} ${cx + L / 2},${cy + T / 2} ${cx - L / 2},${cy + T / 2}`;
  const vseg = (cx: number, cy: number, L: number) => `${cx},${cy - L / 2 - T / 2} ${cx + T / 2},${cy - L / 2} ${cx + T / 2},${cy + L / 2} ${cx},${cy + L / 2 + T / 2} ${cx - T / 2},${cy + L / 2} ${cx - T / 2},${cy - L / 2}`;
  const SHAPES = [hseg(50, 14, 50), vseg(85, 50, 48), vseg(85, 121, 48), hseg(50, 157, 50), vseg(15, 121, 48), vseg(15, 50, 48), hseg(50, 85.5, 50)];

  const litText = (digitValue: number) => SEG_NAMES.filter((_, s) => segmentLit(digitValue, s)).join(' ');
  const digitLabel = $derived(`${HEX[digit]} (${bits.join('')})`);
</script>

<Widget title="Seven-segment decoder" subtitle="Four bits in, seven segments out" {caption} n={fig} onreset={reset}>
  {#snippet controls()}
    <Segmented
      size="sm"
      label="Which codes occur"
      value={mode}
      onchange={setMode}
      options={[
        { value: 'hex', label: 'Hex 0–F', title: 'All sixteen codes are shown, as digits and letters' },
        { value: 'bcd', label: 'Decimal 0–9', title: 'The codes 10–15 never occur: don’t-cares' },
      ]}
    />
    <Segmented
      size="sm"
      label="View"
      bind:value={view}
      options={[
        { value: 'explore', label: 'Explore' },
        { value: 'equations', label: 'Equations', title: 'The minimised formula of each segment' },
      ]}
    />
  {/snippet}

  <div class="sd" bind:this={root}>
    <div class="top">
      <div class="input ui">
        <div class="bits" role="group" aria-label="Input bits D3 to D0">
          {#each [3, 2, 1, 0] as b (b)}
            <button type="button" class="bitbtn" class:on={(digit >> b) & 1} aria-pressed={!!((digit >> b) & 1)} aria-label="D{b}: {(digit >> b) & 1}. Press to change." onclick={() => flipBit(b)}>
              <i>D{b}</i><span>{(digit >> b) & 1}</span>
            </button>
          {/each}
        </div>
        <div class="keypad" role="group" aria-label="Hexadecimal keypad">
          {#each HEX as h, d (h)}
            <button type="button" class="hexkey" class:cur={d === digit} class:dc={mode === 'bcd' && DC_CODES.includes(d)} aria-pressed={d === digit} aria-label="Digit {h}{mode === 'bcd' && d > 9 ? ' (never occurs in decimal)' : ''}" onclick={() => setDigit(d)}>{h}</button>
          {/each}
        </div>
        <div class="run">
          <Button size="sm" onclick={() => setDigit(digit + 1)}>Next digit</Button>
          <Button size="sm" variant={playing ? 'primary' : 'secondary'} disabled={reduced} title={reduced ? 'Automatic counting is off because you asked your system for reduced motion' : undefined} onclick={() => (playing = !playing)}>{playing ? 'Stop' : 'Count'}</Button>
        </div>
      </div>

      <div class="disp">
        <svg viewBox="-2 -2 104 174" role="img" aria-label="Seven-segment display showing {lit.length ? `segments ${lit.join(', ')}` : 'nothing'} for the input {digitLabel}{never ? ', a code that never occurs in decimal' : ''}">
          {#each SHAPES as pts, s (s)}
            {@const on = (mask >> s) & 1}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <polygon
              points={pts}
              class="seg"
              class:on
              class:pick={view === 'equations' && selected === s}
              role={view === 'equations' ? 'button' : undefined}
              tabindex={view === 'equations' ? 0 : undefined}
              aria-label={view === 'equations' ? `Segment ${SEG_NAMES[s]}: ${on ? 'lit' : 'dark'}. Press to show its equation.` : undefined}
              onclick={() => view === 'equations' && (selected = s)}
              onkeydown={(e) => {
                if (view === 'equations' && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  selected = s;
                }
              }}
            />
            <text class="segname" x={[50, 98, 98, 50, 2, 2, 50][s]} y={[5, 40, 111, 170, 111, 40, 103][s]} text-anchor="middle" aria-hidden="true" class:hot={on}>{SEG_NAMES[s]}</text>
          {/each}
        </svg>
        <p class="reading ui" role="status">
          <b>{bits.join('')}</b> = <b>{HEX[digit]}</b>
          {#if lit.length}lights <b>{lit.join(' ')}</b>{:else}lights nothing{/if}.
          {#if never}<span class="never">This code never occurs in a decimal display, so the equations were free to do anything with it.</span>{/if}
        </p>
      </div>
    </div>

    {#if view === 'equations'}
      <div class="eqs ui">
        <table>
          <thead>
            <tr><th scope="col">Seg.</th><th scope="col">Smallest sum of products</th><th scope="col" class="num">Literals</th></tr>
          </thead>
          <tbody>
            {#each eqs as e (e.segment)}
              <tr class:pick={selected === e.segment} class:on={(mask >> e.segment) & 1}>
                <th scope="row">
                  <button type="button" onclick={() => (selected = e.segment)} aria-pressed={selected === e.segment} aria-label="Segment {e.name}: {e.text}">
                    <span class="dot" aria-hidden="true"></span>{e.name}
                  </button>
                </th>
                <td class="formula">
                  {#if e.constant}<span class="lit">{e.constant}</span>
                  {:else}
                    {#each e.terms as t, ti (ti)}{#if ti}<wbr /><span class="op">+</span>{/if}{#each t as l, li (li)}{#if li}<span class="op">·</span>{/if}<span class="lit" class:neg={l.neg}>{INPUTS[l.v]}</span>{/each}{/each}
                  {/if}
                </td>
                <td class="num">{e.literals}</td>
              </tr>
            {/each}
          </tbody>
        </table>

        <div class="detail">
          <p class="which">
            Segment <b>{cur.name}</b> is lit for
            {#each Array.from({ length: 16 }, (_, d) => d) as d (d)}
              <span class="chip" class:on={mode === 'hex' || d < 10 ? segmentLit(d, selected) : false} class:dc={mode === 'bcd' && d > 9} class:cur={d === digit} title={mode === 'bcd' && d > 9 ? 'never occurs: don’t-care' : `${HEX[d]}: ${litText(d)}`}>{HEX[d]}</span>
            {/each}
          </p>
          <p class="legend">Lit digits are amber; in decimal mode the six codes with a dashed edge are don’t-cares, and the equation is allowed to treat each of them as 0 or 1, whichever makes it smaller.</p>
          <LiveDag {circuit} scale={1.1} {onparam} label="Gate circuit for segment {cur.name}: {cur.text}" />
        </div>
      </div>
    {/if}

    <p class="cost ui">
      Seven equations, each minimised alone: <b>{aloneLiterals}</b> literals, <b>{alone.terms}</b> different product terms.
      Minimised <em>together</em>, so that segments share terms: <b>{shared.terms.length}</b> product terms and <b>{shared.gates}</b> gates ({shared.inverters} inverters, {shared.ands} ANDs, {shared.ors} ORs).
    </p>
  </div>
</Widget>

<style>
  .sd {
    display: grid;
    gap: 1rem;
  }
  .top {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(9rem, 13rem);
    gap: 1rem 1.6rem;
    align-items: center;
  }
  @media (max-width: 34rem) {
    .top {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .input {
    display: grid;
    gap: 0.7rem;
    justify-items: start;
  }
  .bits {
    display: flex;
    gap: 6px;
  }
  .bitbtn {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    width: 3.1rem;
    padding: 0.3rem 0;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--pn);
    box-shadow: 0 2px 0 var(--line-strong);
    color: var(--sig-low);
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 1.15rem;
    cursor: pointer;
  }
  .bitbtn i {
    font-style: normal;
    font-weight: 500;
    font-size: 0.66rem;
    color: var(--mute);
  }
  .bitbtn.on {
    color: var(--sig-high);
    border-color: var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) 14%, var(--panel));
    box-shadow: 0 2px 0 var(--sig-high);
  }
  .keypad {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 2.1rem));
    gap: 4px;
  }
  .hexkey {
    aspect-ratio: 1;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--ink-2);
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0;
  }
  .hexkey.dc {
    border-style: dashed;
    color: var(--mute);
  }
  .hexkey.cur {
    border-color: var(--copper);
    background: var(--copper-soft);
    color: var(--fg);
    box-shadow: inset 0 0 0 1px var(--copper);
  }
  .hexkey:hover {
    border-color: var(--copper);
  }
  button:focus-visible,
  .seg:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .run {
    display: flex;
    gap: 0.5rem;
  }
  .disp {
    display: grid;
    gap: 0.5rem;
    justify-items: center;
  }
  svg {
    width: 100%;
    max-width: 9.5rem;
    height: auto;
    overflow: visible;
  }
  .seg {
    fill: color-mix(in srgb, var(--sig-low) 14%, var(--panel));
    stroke: var(--line-strong);
    stroke-width: 0.8;
    stroke-linejoin: round;
    transition: fill 0.08s;
  }
  .seg.on {
    fill: var(--sig-high);
    stroke: var(--sig-high);
    filter: drop-shadow(0 0 3px var(--sig-high-glow));
  }
  .seg.pick {
    stroke: var(--copper);
    stroke-width: 2.4;
  }
  svg :global(polygon[role='button']) {
    cursor: pointer;
  }
  .segname {
    font-family: var(--font-mono);
    font-size: 9px;
    fill: var(--mute);
    pointer-events: none;
  }
  .segname.hot {
    fill: var(--copper-ink);
    font-weight: 700;
  }
  .reading {
    margin: 0;
    font-size: 0.85rem;
    color: var(--ink-2);
    text-align: center;
    line-height: 1.5;
  }
  .reading b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .never {
    display: block;
    color: var(--maybe);
    font-size: 0.78rem;
    margin-top: 0.2rem;
  }
  .eqs {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 1rem 1.4rem;
    align-items: start;
    border-top: 1px solid var(--line);
    padding-top: 1rem;
  }
  @media (max-width: 46rem) {
    .eqs {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.82rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.28rem 0.4rem;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
  }
  thead th {
    color: var(--mute);
    font-weight: 500;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .num {
    text-align: right;
    font-family: var(--font-mono);
  }
  tbody th button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 0;
    background: none;
    font: inherit;
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--fg);
    cursor: pointer;
    padding: 0;
  }
  .dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    background: var(--pn);
  }
  tr.on .dot {
    background: var(--sig-high);
    border-color: var(--sig-high);
    box-shadow: 0 0 5px var(--sig-high-glow);
  }
  tr.pick {
    background: var(--copper-soft);
  }
  .formula {
    font-family: var(--font-mono);
    line-height: 1.6;
  }
  .lit {
    font-weight: 600;
  }
  .lit.neg {
    text-decoration: overline;
    text-decoration-thickness: 1.5px;
  }
  .op {
    color: var(--mute);
    margin: 0 0.12em;
  }
  .detail {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
  }
  .which {
    margin: 0;
    font-size: 0.85rem;
    color: var(--ink-2);
    line-height: 2;
  }
  .chip {
    display: inline-block;
    min-width: 1.5rem;
    text-align: center;
    margin: 0 1px;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--sig-low);
    line-height: 1.4;
  }
  .chip.on {
    color: var(--sig-high);
    border-color: var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) 14%, var(--panel));
    font-weight: 700;
  }
  .chip.dc {
    border-style: dashed;
    color: var(--mute);
  }
  .chip.cur {
    box-shadow: 0 0 0 2px var(--copper);
  }
  .legend {
    margin: 0;
    font-size: 0.78rem;
    color: var(--mute);
    line-height: 1.5;
  }
  .cost {
    margin: 0;
    font-size: 0.82rem;
    color: var(--ink-2);
    line-height: 1.55;
    border-top: 1px solid var(--line);
    padding-top: 0.7rem;
  }
  .cost b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  @media (prefers-reduced-motion: reduce) {
    .seg {
      transition: none;
    }
  }
</style>
