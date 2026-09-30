<!--
  From Ørsted's compass to an electromagnet, in three stages:
    1. a straight wire: a compass beside it swings away from north, by an amount that depends on the
       current and the distance (the wire's field at 1 A and 1 cm is as strong as the Earth's);
    2. the same wire wound into a coil of N turns: the fields of the turns add up inside;
    3. a soft-iron core in the coil: the field is hundreds of times stronger (until the iron saturates)
       and an iron plate near the end is pulled with a force that grows as the field squared.
  The numbers are from magnetics.ts (all SI, tested); the drawing is schematic.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { EARTH_HORIZONTAL, IRON_SATURATION, compassDeflection, formatTesla, ironCoreField, liftableMass, pullForce, solenoidField, wireField } from './magnetics';

  let { n, title = 'From a wire to an electromagnet' }: { n?: string | number; title?: string } = $props();

  type Stage = 'wire' | 'coil' | 'core';
  let stage = $state<Stage>('wire');
  let current = $state(1);
  let distanceCm = $state(1);
  let turns = $state(50);
  let reversed = $state(false);

  const LENGTH = 0.05; // solenoid length, m
  const AREA = 1e-4; // pole face, m²
  const sign = $derived(reversed ? -1 : 1);

  const bWire = $derived(wireField(current, distanceCm / 100));
  const deflection = $derived(compassDeflection(bWire) * sign);
  const bCoil = $derived(solenoidField(turns, current, LENGTH));
  const bCore = $derived(ironCoreField(turns, current, LENGTH));
  const b = $derived(stage === 'wire' ? bWire : stage === 'coil' ? bCoil : bCore);
  const force = $derived(pullForce(stage === 'core' ? bCore : bCoil, AREA));
  const saturated = $derived(stage === 'core' && bCore > 0.95 * IRON_SATURATION);

  /** Field strength as a 0–1 brightness on a log scale from 10 µT to 2 T. */
  const level = $derived(Math.max(0, Math.min(1, (Math.log10(Math.max(b, 1e-9)) + 5) / (Math.log10(2) + 5))));

  function fmtForce(f: number): string {
    if (f >= 1) return `${f.toFixed(1)} N`;
    if (f >= 1e-3) return `${(f * 1e3).toPrecision(2)} mN`;
    if (f >= 1e-6) return `${(f * 1e6).toPrecision(2)} µN`;
    return `${(f * 1e9).toPrecision(2)} nN`;
  }
  const fmtMass = (kg: number) => (kg >= 1 ? `${kg.toFixed(1)} kg` : kg >= 1e-3 ? `${(kg * 1e3).toPrecision(2)} g` : `${(kg * 1e6).toPrecision(2)} mg`);

  // ── Wire stage geometry ────────────────────────────────────────────────────
  const WC = { x: 170, y: 132 };
  const rPx = $derived(26 + distanceCm * 16);
  const earthLen = 42;
  const wireLen = $derived(Math.min(84, (bWire / EARTH_HORIZONTAL) * earthLen));
  const fieldRadii = [30, 58, 86, 114];

  // ── Coil stage geometry ─────────────────────────────────────────────────────
  const CX0 = 150;
  const CX1 = 340;
  const CY = 130;
  const drawnTurns = 12;
  const offsets = [-24, -12, 0, 12, 24];
  function loop(o: number, up: boolean): string {
    const y = CY + o;
    const H = 66 + Math.abs(o) * 1.6;
    const yt = up ? CY - H : CY + H;
    return `M${CX0 + 14} ${y}L${CX1 - 14} ${y}C${CX1 + 64} ${y} ${CX1 + 64} ${yt} ${(CX0 + CX1) / 2} ${yt}S${CX0 - 64} ${y} ${CX0 + 14} ${y}`;
  }
  const loops = offsets.flatMap((o) => (o === 0 ? [{ o, d: loop(0, true) }, { o: 1, d: loop(0, false) }] : [{ o, d: loop(o, o < 0) }]));
  const plateGap = 12;

  const readout = $derived(
    stage === 'wire'
      ? `Wire field ${formatTesla(bWire)} at ${distanceCm.toFixed(1)} cm; the needle turns ${Math.abs(deflection).toFixed(0)}° from north.`
      : `Field inside the coil ${formatTesla(b)}; pull on an iron plate ${fmtForce(force)}.`,
  );
</script>

{#snippet controls()}
  <Segmented
    label="Stage"
    bind:value={stage}
    options={[
      { value: 'wire', label: '1  Straight wire' },
      { value: 'coil', label: '2  Coil' },
      { value: 'core', label: '3  Coil with iron core' },
    ]}
  />
  <Slider label="Current" bind:value={current} min={0} max={5} step={0.05} format={(v) => `${v.toFixed(2)} A`} />
  {#if stage === 'wire'}
    <Slider label="Compass distance" bind:value={distanceCm} min={0.5} max={5} step={0.1} format={(v) => `${v.toFixed(1)} cm`} />
    <Toggle label="Reverse the current" bind:checked={reversed} />
  {:else}
    <Slider label="Turns" bind:value={turns} min={1} max={500} step={1} log format={(v) => `${Math.round(v)}`} />
  {/if}
{/snippet}

<Widget {title} {n} kind="Interactive" caption={stage === 'wire' ? 'A compass beside a wire (the Earth’s field, about 20 µT, points north on the page). Turn the current up: the needle swings toward the wire’s own field. Reverse it and the needle swings the other way, as Ørsted saw.' : stage === 'coil' ? 'Winding the wire into N turns multiplies the field by N. Even so, a coil of air is weak: look at the pull.' : 'Slide a soft-iron core into the coil: the field jumps by a factor of hundreds and the pull by the square of that, until the iron saturates near 1.6 T.'} {controls}>
  <div class="em">
    <svg viewBox="0 0 480 264" class="fig" role="img" aria-label={readout}>
      <defs>
        <marker id="em-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 1L9 5L0 9z" class="head" />
        </marker>
      </defs>
      {#if stage === 'wire'}
        <!-- field circles around the wire -->
        {#each fieldRadii as r, i (r)}
          <circle cx={WC.x} cy={WC.y} {r} class="ring" style:opacity={Math.max(0.08, level * (1 - i * 0.18))} style:stroke-width={1 + level * 2.5} />
          <path d="M{WC.x - r} {WC.y - 4}l0 {reversed ? -8 : 8}" class="head-line" marker-end="url(#em-arrow)" style:opacity={Math.max(0.15, level)} />
        {/each}
        <!-- the wire: current toward the reader (dot), or away (cross) -->
        <circle cx={WC.x} cy={WC.y} r="10" class="cu" />
        {#if reversed}
          <path d="M{WC.x - 4} {WC.y - 4}l8 8m0-8l-8 8" class="mark" />
        {:else}
          <circle cx={WC.x} cy={WC.y} r="3" class="mark-dot" />
        {/if}
        <text x={WC.x} y={WC.y + 26} text-anchor="middle" class="lbl">wire, {current.toFixed(2)} A {reversed ? 'away' : 'toward you'}</text>

        <!-- the compass -->
        <g transform="translate({WC.x} {WC.y - rPx})">
          <circle r="22" class="dial" />
          <text y="-26" text-anchor="middle" class="lbl">N</text>
          <g transform="rotate({-deflection})" class="needle">
            <path d="M0 -18L4 0L-4 0z" class="north" />
            <path d="M0 18L4 0L-4 0z" class="south" />
            <circle r="2" class="pivot" />
          </g>
        </g>

        <!-- vector diagram -->
        <g transform="translate(396 176)">
          <text x="-40" y="-104" text-anchor="middle" class="lbl">what the needle feels</text>
          <line x1="0" y1="0" x2="0" y2={-earthLen} class="vec earth" marker-end="url(#em-arrow)" />
          <line x1="0" y1="0" x2={-sign * wireLen} y2="0" class="vec wire" marker-end="url(#em-arrow)" />
          <line x1="0" y1="0" x2={-sign * wireLen} y2={-earthLen} class="vec sum" marker-end="url(#em-arrow)" />
          <line x1={-sign * wireLen} y1="0" x2={-sign * wireLen} y2={-earthLen} class="guide" />
          <line x1="0" y1={-earthLen} x2={-sign * wireLen} y2={-earthLen} class="guide" />
          <text x="8" y={-earthLen - 6} class="lbl earth-t">Earth 20 µT</text>
          <text x={-sign * wireLen / 2} y="18" text-anchor="middle" class="lbl wire-t">wire {formatTesla(bWire)}</text>
        </g>
      {:else}
        <!-- field lines -->
        {#each loops as l (l.o)}
          <path d={l.d} class="fline" style:opacity={0.12 + 0.88 * level} style:stroke-width={0.8 + 2.4 * level} />
        {/each}
        <!-- core -->
        {#if stage === 'core'}
          <rect x={CX0 - 4} y={CY - 13} width={CX1 - CX0 + 8} height="26" rx="2" class="iron" />
        {/if}
        <!-- winding cross-sections: current into the page along the top (×), out along the bottom (•) -->
        {#each Array.from({ length: drawnTurns }, (_, i) => i) as i (i)}
          {@const x = CX0 + 8 + (i * (CX1 - CX0 - 16)) / (drawnTurns - 1)}
          <circle cx={x} cy={CY - 30} r="6" class="cu" />
          <path d="M{x - 3} {CY - 33}l6 6m0-6l-6 6" class="mark" />
          <circle cx={x} cy={CY + 30} r="6" class="cu" />
          <circle cx={x} cy={CY + 30} r="2" class="mark-dot" />
        {/each}
        <text x={(CX0 + CX1) / 2} y={CY + 122} text-anchor="middle" class="lbl">{Math.round(turns)} turns, {current.toFixed(2)} A{turns > drawnTurns ? ' (12 drawn)' : ''}</text>
        <!-- the iron plate near the right end, and the pull on it -->
        <rect x={CX1 + 8 + plateGap} y={CY - 26} width="12" height="52" rx="2" class="iron plate" />
        <line
          x1={CX1 + 8 + plateGap + 12 + Math.max(8, Math.min(70, 8 + 12 * Math.log10(1 + force * 1e3)))}
          x2={CX1 + 8 + plateGap + 14}
          y1={CY}
          y2={CY}
          class="pull"
          marker-end="url(#em-arrow)"
        />
        <text x={CX1 + 8 + plateGap + 6} y={CY - 34} text-anchor="middle" class="lbl">plate</text>
        <text x={CX1 + 8 + plateGap + 52} y={CY - 8} text-anchor="middle" class="lbl">pull</text>
        {#if saturated}<text x={(CX0 + CX1) / 2} y={CY - 56} text-anchor="middle" class="lbl warn">the iron is saturated</text>{/if}
      {/if}
    </svg>

    <dl class="stats ui" aria-live="polite">
      <div>
        <dt>{stage === 'wire' ? 'Field at the compass' : 'Field inside'}</dt>
        <dd>{formatTesla(b)}</dd>
        <dd class="sub">{(b / 50e-6 >= 10 ? (b / 50e-6).toFixed(0) : (b / 50e-6).toFixed(1))}× the Earth’s total field</dd>
      </div>
      {#if stage === 'wire'}
        <div>
          <dt>Needle turns</dt>
          <dd>{Math.abs(deflection).toFixed(0)}°</dd>
          <dd class="sub">{deflection === 0 ? 'not at all' : deflection > 0 ? 'to the west' : 'to the east'}</dd>
        </div>
      {:else}
        <div>
          <dt>Pull on a 1 cm² plate</dt>
          <dd>{fmtForce(force)}</dd>
          <dd class="sub">lifts {fmtMass(liftableMass(force))}</dd>
        </div>
        <div>
          <dt>Ampere-turns</dt>
          <dd>{(turns * current).toFixed(turns * current >= 100 ? 0 : 1)}</dd>
          <dd class="sub">N × I</dd>
        </div>
      {/if}
    </dl>
  </div>
</Widget>

<style>
  .em {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    min-width: 0;
  }
  .fig {
    width: 100%;
    max-width: 640px;
    height: auto;
    margin: 0 auto;
    display: block;
    font-family: var(--font-mono);
  }
  .ring {
    fill: none;
    stroke: var(--sig-current);
  }
  .head,
  .head-line {
    fill: var(--sig-current);
    stroke: var(--sig-current);
  }
  .cu {
    fill: var(--copper);
    stroke: var(--copper-ink);
    stroke-width: 1;
  }
  .mark {
    stroke: var(--bg);
    stroke-width: 1.5;
    fill: none;
  }
  .mark-dot {
    fill: var(--bg);
  }
  .dial {
    fill: var(--panel);
    stroke: var(--wire);
    stroke-width: 1.6;
  }
  .north {
    fill: var(--sig-x);
  }
  .south {
    fill: var(--mute);
  }
  .pivot {
    fill: var(--fg);
  }
  .needle {
    transition: transform 160ms ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    .needle {
      transition: none;
    }
  }
  .lbl {
    font-size: 10.5px;
    fill: var(--mute);
  }
  .lbl.warn {
    fill: var(--sig-x);
    font-weight: 600;
  }
  .vec {
    stroke-width: 2.4;
  }
  .vec.earth {
    stroke: var(--mute);
    fill: var(--mute);
  }
  .vec.wire {
    stroke: var(--sig-current);
    fill: var(--sig-current);
  }
  .vec.sum {
    stroke: var(--sig-x);
    fill: var(--sig-x);
  }
  .earth-t {
    fill: var(--mute);
  }
  .wire-t {
    fill: var(--sig-current);
  }
  .guide {
    stroke: var(--line-strong);
    stroke-dasharray: 3 4;
  }
  .fline {
    fill: none;
    stroke: var(--sig-current);
    stroke-linecap: round;
  }
  .iron {
    fill: var(--surface-3);
    stroke: var(--wire);
    stroke-width: 1.4;
  }
  .pull {
    stroke: var(--sig-high);
    stroke-width: 3;
    fill: var(--sig-high);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
    gap: 0.5rem;
    margin: 0;
  }
  .stats > div {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.4rem 0.7rem;
    background: var(--pn);
  }
  dt {
    font-family: var(--font-mono);
    font-size: 0.64rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 1.02rem;
    font-weight: 600;
    color: var(--fg);
  }
  dd.sub {
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--mute);
  }
</style>
