<!--
  The number wheel. Sixteen 4-bit patterns round a circle: the outer ring is the pattern, the inner ring what it
  means in the chosen encoding. Drag the pointer, or add a number: the pointer walks round the wheel and the flags
  say what happened. Adding is the same walk in every encoding; what changes is which crossing is an error. Only in
  two's complement is the wheel's seam (7 to −8) the only place the answer goes wrong.

    ::twos-wheel{n="14.1" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { ENCODINGS, add, angleOf, bits, decode, label, patternAt, range, subtract, zeros, type Encoding, type Sum } from './wheel';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  const N = 4;
  const SIZE = 2 ** N;
  let enc = $state<Encoding>('twos');
  let p = $state(5);
  let addend = $state(3);
  let last = $state<{ op: '+' | '−'; from: number; by: number; sum: Sum } | null>(null);
  let dragging = false;
  let svg: SVGSVGElement | undefined = $state();

  const cur = $derived(decode(enc, p, N));
  const [lo, hi] = $derived(range(enc, N));
  const nzero = $derived(zeros(enc, N));

  const C = 170;
  const R1 = 132;
  const R2 = 88;
  const RL = 152;
  const pt = (v: number, r: number): [number, number] => {
    const a = angleOf(v, N);
    return [C + r * Math.sin(a), C - r * Math.cos(a)];
  };
  /** The wedge of pattern v, between the angles of v − ½ and v + ½. */
  function wedge(v: number): string {
    const a0 = angleOf(v - 0.5, N);
    const a1 = angleOf(v + 0.5, N);
    const P = (a: number, r: number) => `${(C + r * Math.sin(a)).toFixed(2)} ${(C - r * Math.cos(a)).toFixed(2)}`;
    return `M${P(a0, R2)} L${P(a0, R1)} A${R1} ${R1} 0 0 1 ${P(a1, R1)} L${P(a1, R2)} A${R2} ${R2} 0 0 0 ${P(a0, R2)} Z`;
  }
  const fmt = (v: number) => (v < 0 ? `−${-v}` : `${v}`);
  const tip = $derived(pt(p, R2 - 6));
  const negative = (v: number) => decode(enc, v, N).value < 0 || decode(enc, v, N).negZero;

  function setP(v: number) {
    p = ((v % SIZE) + SIZE) % SIZE;
    last = null;
  }
  function apply(op: '+' | '−', by: number) {
    const sum = op === '+' ? add(p, by, N) : subtract(p, by, N);
    last = { op, from: p, by, sum };
    p = sum.result;
  }
  function pointerAt(e: PointerEvent) {
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const k = 2 * C + 0;
    const x = ((e.clientX - r.left) / r.width) * k - C;
    const y = ((e.clientY - r.top) / r.height) * k - C;
    setP(patternAt(x, y, N));
  }
  function down(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointerAt(e);
  }
  function move(e: PointerEvent) {
    if (dragging) pointerAt(e);
  }
  function up() {
    dragging = false;
  }
  function key(e: KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      setP(p + step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setP(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setP(SIZE - 1);
    }
  }
  function reset() {
    enc = 'twos';
    p = 5;
    addend = 3;
    last = null;
  }

  const explain = $derived.by(() => {
    if (!last) return '';
    const { op, from, by, sum } = last;
    const sign = op === '+' ? 1 : -1;
    const raw = from + sign * by;
    const wrapped = raw < 0 || raw > 15;
    const sf = decode('twos', from, N).value;
    const sb = decode('twos', by, N).value;
    const truth = sf + sign * sb;
    const num = (v: number) => (v < 0 ? `(−${-v})` : `${v}`);
    const unsigned = `Unsigned: ${from} ${op} ${by} = ${raw}${wrapped ? `, which does not fit, so the wheel wraps round to ${sum.result}` : ''}.`;
    const signed = `Signed: ${sf < 0 ? num(sf) : sf} ${op} ${num(sb)} = ${truth < 0 ? `−${-truth}` : truth}${sum.overflow ? `, which is outside −8 to 7, so the wheel shows ${label('twos', sum.result, N)}: wrong` : `, and the wheel shows ${label('twos', sum.result, N)}: right`}.`;
    return `${unsigned} ${signed}`;
  });
  const wheelLabel = $derived(`Number wheel: pointer at pattern ${bits(p, N)}, ${label(enc, p, N)} as ${ENCODINGS.find((e) => e.id === enc)!.label.toLowerCase()}.`);
</script>

<Widget title="The number wheel" subtitle="Sixteen patterns round a circle: adding is walking" {caption} n={fig} onreset={reset}>
  {#snippet controls()}
    <Segmented size="sm" label="Reading of the patterns" bind:value={enc} options={ENCODINGS.map((e) => ({ value: e.id, label: e.label }))} onchange={() => (last = null)} />
  {/snippet}

  <div class="tw">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <svg
      bind:this={svg}
      viewBox="0 0 {2 * C} {2 * C}"
      role="slider"
      tabindex="0"
      aria-label="Number wheel. Arrow keys move the pointer."
      aria-valuemin="0"
      aria-valuemax={SIZE - 1}
      aria-valuenow={p}
      aria-valuetext={wheelLabel}
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
      onkeydown={key}
    >
      {#each { length: SIZE } as _, v (v)}
        <path d={wedge(v)} class="wedge" class:neg={negative(v)} class:cur={v === p} />
      {/each}
      {#each { length: SIZE } as _, v (v)}
        {@const [x, y] = pt(v, (R1 + R2) / 2)}
        {@const [bx, by] = pt(v, RL)}
        <text class="val" class:cur={v === p} {x} y={y + 4} text-anchor="middle" aria-hidden="true">{label(enc, v, N)}</text>
        <text class="bin" class:cur={v === p} x={bx} y={by + 3} text-anchor="middle" aria-hidden="true">{bits(v, N)}</text>
      {/each}

      <!-- The seams: where an addition stops giving the right answer. -->
      {#if enc === 'unsigned' || enc === 'twos'}
        {@const [ax, ay] = pt(15.5, R2 - 10)}
        {@const [bx, by] = pt(15.5, R1 + 4)}
        <line class="seam carry" x1={ax} y1={ay} x2={bx} y2={by} />
      {/if}
      {#if enc === 'twos'}
        {@const [ax, ay] = pt(7.5, R2 - 10)}
        {@const [bx, by] = pt(7.5, R1 + 4)}
        <line class="seam over" x1={ax} y1={ay} x2={bx} y2={by} />
      {/if}

      <!-- The pointer. -->
      <line class="hand" x1={C} y1={C} x2={tip[0]} y2={tip[1]} />
      <circle class="hub" cx={C} cy={C} r="5" />

      <text class="centre big" x={C} y={C - 20} text-anchor="middle">{cur.negZero ? '−0' : label(enc, p, N)}</text>
      <text class="centre" x={C} y={C - 4} text-anchor="middle">{bits(p, N)}</text>
      {#if enc === 'unsigned' || enc === 'twos'}
        <text class="tag carry" x={C + 42} y={20} text-anchor="start" aria-hidden="true">{enc === 'twos' ? 'carry seam' : 'wraps 15 → 0'}</text>
      {/if}
      {#if enc === 'twos'}
        <text class="tag over" x={C + 46} y={2 * C - 10} text-anchor="start" aria-hidden="true">overflow seam</text>
      {/if}
    </svg>

    <div class="side ui">
      <p class="facts">
        {#if enc === 'unsigned'}<b>Unsigned</b>: 0 to {fmt(hi)}. Going past 15 wraps to 0.
        {:else if enc === 'twos'}<b>Two’s complement</b>: {fmt(lo)} to {fmt(hi)}, one zero. The top bit has weight −8.
        {:else if enc === 'ones'}<b>Ones’ complement</b>: {fmt(lo)} to {fmt(hi)}, and <b>two zeros</b>: 0000 and 1111. Negate by inverting every bit.
        {:else}<b>Sign–magnitude</b>: {fmt(lo)} to {fmt(hi)}, and <b>two zeros</b>: 0000 and 1000. The top bit is the sign.{/if}
        {#if nzero > 1}<span class="warn"> Two patterns for zero: a comparison with zero needs two tests.</span>{/if}
      </p>
      <div class="ops">
        <Slider label="Number to add" bind:value={addend} min={0} max={15} step={1} format={(v) => `${bits(v, N)} = ${label(enc, v, N)}`} />
        <div class="row">
          <Button size="sm" onclick={() => apply('+', addend)}>Add</Button>
          <Button size="sm" onclick={() => apply('−', addend)}>Subtract</Button>
          <Button size="sm" onclick={() => apply('+', 1)}>+1</Button>
          <Button size="sm" onclick={() => apply('−', 1)}>−1</Button>
        </div>
      </div>
      <div class="flags" role="status" aria-label="Flags of the last operation">
        {#each [{ k: 'C', t: 'carry out of the top bit: the unsigned result wrapped', on: last?.sum.carry }, { k: 'V', t: 'overflow: the two’s complement result does not fit', on: last?.sum.overflow }, { k: 'N', t: 'the top bit of the result', on: last?.sum.negative }, { k: 'Z', t: 'the result is zero', on: last?.sum.zero }] as f (f.k)}
          <span class="flag" class:on={f.on} class:bad={f.on && (f.k === 'V' || f.k === 'C')} title={f.t}><i>{f.k}</i>{f.on ? 1 : 0}</span>
        {/each}
      </div>
      <p class="explain" aria-live="polite">{explain || 'Drag the pointer, or add a number: the flags show what the hardware would report.'}</p>
    </div>
  </div>
</Widget>

<style>
  .tw {
    display: grid;
    grid-template-columns: minmax(0, 20rem) minmax(0, 1fr);
    gap: 1rem 1.6rem;
    align-items: center;
  }
  @media (max-width: 44rem) {
    .tw {
      grid-template-columns: minmax(0, 1fr);
      justify-items: center;
    }
  }
  svg {
    width: 100%;
    max-width: 21rem;
    height: auto;
    touch-action: none;
    cursor: grab;
    font-family: var(--font-mono);
    user-select: none;
  }
  svg:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 4px;
    border-radius: 12px;
  }
  .wedge {
    fill: var(--pn);
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .wedge.neg {
    fill: color-mix(in srgb, var(--volt-neg) 12%, var(--pn));
  }
  .wedge.cur {
    fill: var(--copper-soft);
    stroke: var(--copper);
    stroke-width: 2.4;
  }
  .val {
    font-size: 12px;
    font-weight: 700;
    fill: var(--fg);
    pointer-events: none;
  }
  .bin {
    font-size: 9.5px;
    fill: var(--mute);
    pointer-events: none;
  }
  .val.cur,
  .bin.cur {
    fill: var(--copper-ink);
  }
  .seam {
    stroke-width: 3;
    stroke-linecap: round;
    stroke-dasharray: 5 4;
  }
  .seam.carry {
    stroke: var(--sig-current);
  }
  .seam.over {
    stroke: var(--bad);
  }
  .tag {
    font-size: 9.5px;
    font-family: var(--font-ui);
  }
  .tag.carry {
    fill: var(--sig-current);
  }
  .tag.over {
    fill: var(--bad);
  }
  .hand {
    stroke: var(--copper);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .hub {
    fill: var(--copper);
  }
  .centre {
    font-size: 11px;
    fill: var(--mute);
  }
  .centre.big {
    font-size: 26px;
    font-weight: 700;
    fill: var(--fg);
  }
  .side {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
    width: 100%;
  }
  .facts {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-2);
    line-height: 1.55;
  }
  .warn {
    color: var(--maybe);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.4rem;
  }
  .flags {
    display: flex;
    gap: 6px;
  }
  .flag {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    min-width: 2.4rem;
    padding: 0.2rem 0.3rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--sig-low);
    background: var(--pn);
  }
  .flag i {
    font-style: normal;
    font-weight: 500;
    font-size: 0.68rem;
    color: var(--mute);
  }
  .flag.on {
    color: var(--sig-high);
    border-color: var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) 14%, var(--panel));
  }
  .flag.bad {
    color: var(--bad);
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .explain {
    margin: 0;
    min-height: 3.6em;
    font-size: 0.84rem;
    color: var(--ink-2);
    line-height: 1.55;
  }
</style>
