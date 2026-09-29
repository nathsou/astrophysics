<!--
  A rotary knob for instrument panels. Drag up or right to turn it up (Shift for fine steps), scroll over
  it, or use the arrow, Page and Home/End keys. The readout under it is a text box that understands SI
  prefixes ("4.7k"). Logarithmic knobs move by ratio (frequencies, current limits).
-->
<script lang="ts">
  import { formatParam, parseSI, round3 } from '../editor/units';

  let {
    value,
    min,
    max,
    log = false,
    step,
    unit,
    label,
    size = 54,
    disabled = false,
    onchange,
  }: {
    value: number;
    min: number;
    max: number;
    log?: boolean;
    /** Linear knobs snap to multiples of this. */
    step?: number;
    unit?: string;
    label: string;
    size?: number;
    disabled?: boolean;
    onchange: (v: number) => void;
  } = $props();

  const uid = $props.id();
  const toT = (v: number) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
  const fromT = (t: number) => {
    const c = Math.max(0, Math.min(1, t));
    if (log) return round3(min * (max / min) ** c);
    const v = min + c * (max - min);
    return step ? Math.min(max, Math.max(min, Math.round(v / step) * step)) : Number(v.toPrecision(4));
  };
  const t = $derived(Math.max(0, Math.min(1, toT(Math.max(min, Math.min(max, value))))));
  const START = -135;
  const SWEEP = 270;
  const angle = $derived(START + SWEEP * t);

  const R = 22;
  const polar = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [30 + r * Math.cos(a), 30 + r * Math.sin(a)] as const;
  };
  const arc = (from: number, to: number, r: number) => {
    const [x0, y0] = polar(from, r);
    const [x1, y1] = polar(to, r);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const ticks = Array.from({ length: 11 }, (_, i) => START + (SWEEP * i) / 10);

  let drag: { y: number; x: number; t0: number } | null = null;
  function down(ev: PointerEvent) {
    if (disabled) return;
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    (ev.currentTarget as HTMLElement).focus();
    drag = { y: ev.clientY, x: ev.clientX, t0: t };
  }
  function move(ev: PointerEvent) {
    if (!drag) return;
    const d = drag.y - ev.clientY + (ev.clientX - drag.x);
    set(fromT(drag.t0 + d / (ev.shiftKey ? 900 : 180)));
  }
  function up() {
    drag = null;
  }
  function set(v: number) {
    if (v !== value) onchange(v);
  }
  function wheel(ev: WheelEvent) {
    if (disabled) return;
    ev.preventDefault();
    set(fromT(t - ev.deltaY * (ev.shiftKey ? 0.0002 : 0.0009)));
  }
  function key(ev: KeyboardEvent) {
    if (disabled) return;
    const fine = ev.shiftKey ? 0.2 : 1;
    const moves: Record<string, number> = { ArrowUp: 0.01, ArrowRight: 0.01, ArrowDown: -0.01, ArrowLeft: -0.01, PageUp: 0.1, PageDown: -0.1 };
    if (ev.key in moves) {
      ev.preventDefault();
      ev.stopPropagation();
      set(fromT(t + moves[ev.key]! * fine));
    } else if (ev.key === 'Home') (ev.preventDefault(), set(min));
    else if (ev.key === 'End') (ev.preventDefault(), set(max));
  }

  let text = $state('');
  let editing = $state(false);
  $effect(() => {
    if (!editing) text = formatParam(value, unit);
  });
  function commit() {
    editing = false;
    const v = parseSI(text);
    if (v !== undefined && v >= min && v <= max) set(v);
    else if (v !== undefined) set(Math.max(min, Math.min(max, v)));
    text = formatParam(value, unit);
  }
</script>

<div class="knob ui" class:disabled>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <svg
    class="dial"
    width={size}
    height={size}
    viewBox="0 0 60 60"
    role="slider"
    tabindex={disabled ? -1 : 0}
    aria-label={label}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={value}
    aria-valuetext={formatParam(value, unit)}
    aria-disabled={disabled}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    onwheel={wheel}
    onkeydown={key}
  >
    <circle cx="30" cy="30" r="27" class="rim" />
    {#each ticks as a, i (i)}
      {@const [x0, y0] = polar(a, 25.5)}
      {@const [x1, y1] = polar(a, i % 5 === 0 ? 22 : 23.6)}
      <line x1={x0} y1={y0} x2={x1} y2={y1} class="tick" />
    {/each}
    <path d={arc(START, START + SWEEP, R - 6.5)} class="track" />
    {#if t > 0.002}<path d={arc(START, angle, R - 6.5)} class="fill" />{/if}
    <circle cx="30" cy="30" r="13.5" class="cap" />
    <line x1="30" y1="30" x2={polar(angle, 12)[0]} y2={polar(angle, 12)[1]} class="pointer" />
  </svg>
  <span class="lbl label-caps" id="{uid}-l">{label}</span>
  <input
    class="readout num"
    type="text"
    inputmode="decimal"
    spellcheck="false"
    autocomplete="off"
    aria-labelledby="{uid}-l"
    {disabled}
    bind:value={text}
    onfocus={(ev) => {
      editing = true;
      (ev.currentTarget as HTMLInputElement).select();
    }}
    onblur={commit}
    onkeydown={(ev) => {
      if (ev.key === 'Enter') (ev.currentTarget as HTMLInputElement).blur();
      else if (ev.key === 'Escape') {
        editing = false;
        text = formatParam(value, unit);
        (ev.currentTarget as HTMLInputElement).blur();
      }
      ev.stopPropagation();
    }}
  />
</div>

<style>
  .knob {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    min-width: 4.4rem;
  }
  .dial {
    cursor: ns-resize;
    touch-action: none;
    border-radius: 50%;
  }
  .dial:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .rim {
    fill: color-mix(in srgb, var(--pn) 70%, var(--panel));
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .tick {
    stroke: var(--mute);
    stroke-width: 1;
    stroke-linecap: round;
    opacity: 0.7;
  }
  .track {
    fill: none;
    stroke: var(--surface-3);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .fill {
    fill: none;
    stroke: var(--copper);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .cap {
    fill: var(--panel);
    stroke: var(--line-strong);
    stroke-width: 1.2;
    filter: drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.25));
  }
  .pointer {
    stroke: var(--copper-ink);
    stroke-width: 2.4;
    stroke-linecap: round;
  }
  .lbl {
    font-size: 0.6rem;
    color: var(--mute);
  }
  .readout {
    width: 4.6rem;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 5px;
    padding: 0.1rem 0.2rem;
  }
  .readout:focus {
    outline: none;
    border-color: var(--focus);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus) 25%, transparent);
  }
  .disabled {
    opacity: 0.5;
  }
</style>
