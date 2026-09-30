<!--
  Charge counter: drag the handle along a logarithmic axis from one electron to a phone battery's worth
  (10²³), and read the charge in coulombs and how long a 1 A current takes to carry it. Landmark chips jump
  to familiar amounts. Pointer, keyboard (arrow keys, Page Up/Down, Home/End) and the chips all work.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { supHtml } from './wire';
  import { E_CHARGE } from './wire';
  import { chargeOf, electronsAt, formatCharge, formatDuration, formatElectrons, LANDMARKS, MAX_EXPONENT, MIN_EXPONENT, nearestLandmark } from './charge';

  let { title = 'Charge counter', caption, n }: { title?: string; caption?: string; n?: string | number } = $props();

  let exponent = $state(Math.log10(1 / E_CHARGE)); // one coulomb
  let svg: SVGSVGElement | undefined = $state();
  let dragging = $state(false);

  // The axis is laid out in real pixels (the wrapper's width), so its text stays readable on a phone.
  let W = $state(600);
  const X0 = 22;
  const X1 = $derived(Math.max(X0 + 100, W - 22));
  const Y = 44;
  const xOf = (e: number) => X0 + ((e - MIN_EXPONENT) / (MAX_EXPONENT - MIN_EXPONENT)) * (X1 - X0);
  const clamp = (e: number) => Math.min(MAX_EXPONENT, Math.max(MIN_EXPONENT, e));

  const electrons = $derived(electronsAt(exponent));
  const coulombs = $derived(chargeOf(electrons));
  const near = $derived(nearestLandmark(exponent));
  const ratioText = $derived.by(() => {
    const r = near.ratio;
    if (r > 0.9 && r < 1.1) return 'about';
    if (r >= 1.1) return `about ${r < 10 ? r.toFixed(1) : Math.round(r).toLocaleString('en-GB')} times`;
    if (1 / r < 1.5) return 'a little less than';
    return `about 1/${Math.round(1 / r).toLocaleString('en-GB')} of`;
  });
  const valueText = $derived(`${formatElectrons(electrons)} electrons, ${formatCharge(coulombs)}`);

  function setFromPointer(ev: PointerEvent) {
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    exponent = clamp(MIN_EXPONENT + ((x - X0) / (X1 - X0)) * (MAX_EXPONENT - MIN_EXPONENT));
  }
  function down(ev: PointerEvent) {
    if (ev.button !== 0) return;
    dragging = true;
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    setFromPointer(ev);
    svg?.querySelector<SVGElement>('[role=slider]')?.focus({ preventScroll: true });
  }
  function move(ev: PointerEvent) {
    if (dragging) setFromPointer(ev);
  }
  function up() {
    dragging = false;
  }
  function key(ev: KeyboardEvent) {
    const small = ev.shiftKey ? 0.05 : 0.25;
    let next: number | undefined;
    switch (ev.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = exponent + small;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = exponent - small;
        break;
      case 'PageUp':
        next = exponent + 1;
        break;
      case 'PageDown':
        next = exponent - 1;
        break;
      case 'Home':
        next = MIN_EXPONENT;
        break;
      case 'End':
        next = MAX_EXPONENT;
        break;
    }
    if (next !== undefined) {
      ev.preventDefault();
      exponent = clamp(next);
    }
  }
  const jump = (electrons: number) => (exponent = clamp(Math.log10(electrons)));
</script>

<Widget {title} {caption} {n} kind="Interactive" live={false} onreset={() => (exponent = Math.log10(1 / E_CHARGE))}>
  <div class="cc">
    <div class="trackwrap" bind:clientWidth={W}>
    <svg bind:this={svg} viewBox="0 0 {W} 88" width={W} height="88" class="track" role="presentation" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
      <line x1={X0} x2={X1} y1={Y} y2={Y} class="rail" />
      <line x1={X0} x2={xOf(exponent)} y1={Y} y2={Y} class="fill" />
      {#each [0, 5, 10, 15, 20] as e (e)}
        <line x1={xOf(e)} x2={xOf(e)} y1={Y - 6} y2={Y + 6} class="tick" />
        <text x={xOf(e)} y={Y + 24} text-anchor="middle" class="num">10<tspan dy="-5" font-size="9">{e}</tspan></text>
      {/each}
      <text x={X1} y={Y + 24} text-anchor="end" class="num">10<tspan dy="-5" font-size="9">23</tspan></text>
      {#each LANDMARKS as l (l.id)}
        <circle cx={xOf(Math.log10(l.electrons))} cy={Y} r="4" class="mark" class:here={near.landmark.id === l.id} />
      {/each}
      <text x="8" y="12" class="axis">electrons →</text>
      <g
        role="slider"
        tabindex="0"
        aria-label="Number of electrons, on a logarithmic scale"
        aria-orientation="horizontal"
        aria-valuemin={MIN_EXPONENT}
        aria-valuemax={MAX_EXPONENT}
        aria-valuenow={Number(exponent.toFixed(2))}
        aria-valuetext={valueText}
        onkeydown={key}
        class="handle"
        class:drag={dragging}
      >
        <circle cx={xOf(exponent)} cy={Y} r="17" class="hit" />
        <circle cx={xOf(exponent)} cy={Y} r="10" class="knob" />
        <path d="M {xOf(exponent) - 3.5} {Y - 3} L {xOf(exponent) - 6.5} {Y} L {xOf(exponent) - 3.5} {Y + 3} M {xOf(exponent) + 3.5} {Y - 3} L {xOf(exponent) + 6.5} {Y} L {xOf(exponent) + 3.5} {Y + 3}" class="grip" />
      </g>
    </svg>
    </div>

    <div class="chips ui" role="group" aria-label="Jump to a familiar amount">
      {#each LANDMARKS as l (l.id)}
        <button type="button" class:on={near.landmark.id === l.id && Math.abs(Math.log10(near.ratio)) < 0.02} onclick={() => jump(l.electrons)}>{l.label}</button>
      {/each}
    </div>

    <dl class="read ui" aria-live="polite">
      <div>
        <dt>Electrons</dt>
        <dd class="big">{@html supHtml(formatElectrons(electrons))}</dd>
      </div>
      <div>
        <dt>Charge</dt>
        <dd class="big">{@html supHtml(formatCharge(coulombs))}</dd>
      </div>
      <div>
        <dt>1 A carries it in</dt>
        <dd class="big">{formatDuration(coulombs / 1)}</dd>
      </div>
      <div>
        <dt>A 20 mA LED, in</dt>
        <dd class="big">{formatDuration(coulombs / 0.02)}</dd>
      </div>
    </dl>
    <p class="about ui">
      That is {ratioText} <strong>{near.landmark.phrase}</strong>. {@html supHtml(near.landmark.about)}
    </p>
  </div>
</Widget>

<style>
  .cc {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    min-width: 0;
  }
  .trackwrap {
    width: 100%;
    min-width: 0;
  }
  .track {
    display: block;
    max-width: 100%;
    touch-action: pan-y;
    cursor: ew-resize;
    user-select: none;
  }
  .rail {
    stroke: var(--line-strong);
    stroke-width: 4;
    stroke-linecap: round;
  }
  .fill {
    stroke: var(--copper);
    stroke-width: 4;
    stroke-linecap: round;
  }
  .tick {
    stroke: var(--line-strong);
    stroke-width: 1.5;
  }
  .num,
  .axis {
    fill: var(--mute);
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .mark {
    fill: var(--panel);
    stroke: var(--copper);
    stroke-width: 2;
  }
  .mark.here {
    fill: var(--copper);
  }
  .handle {
    outline: none;
    cursor: grab;
  }
  .handle.drag {
    cursor: grabbing;
  }
  .hit {
    fill: transparent;
  }
  .knob {
    fill: var(--panel);
    stroke: var(--copper);
    stroke-width: 3;
    filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.3));
  }
  .grip {
    fill: none;
    stroke: var(--copper);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .handle:focus-visible .hit {
    stroke: var(--focus);
    stroke-width: 2.5;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .chips button {
    border: 1px solid var(--line-strong);
    border-radius: 99px;
    background: var(--panel);
    color: var(--ink-2);
    font-size: 0.78rem;
    padding: 0.2rem 0.65rem;
    cursor: pointer;
  }
  .chips button:hover {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .chips button.on {
    background: var(--copper-soft);
    border-color: var(--copper);
    color: var(--fg);
    font-weight: 600;
  }
  .chips button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .read {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.6rem;
    margin: 0;
  }
  .read > div {
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--pn);
    min-width: 0;
  }
  dt {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  dd {
    margin: 0;
  }
  .big {
    font-family: var(--font-mono);
    font-size: 1.02rem;
    font-weight: 500;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .about {
    margin: 0;
    font-size: 0.88rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
  .about strong {
    color: var(--fg);
  }
</style>
