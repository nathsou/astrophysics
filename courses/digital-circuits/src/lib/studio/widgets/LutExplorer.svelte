<!--
  A single 4-input LUT: 16 stored bits and the tree of multiplexers that picks one. Flip the inputs to walk the tree,
  click a stored bit to change the function, or type a function (`I0 ^ I1`, `a & (b | c)`).

    ::lut-explorer{}
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '../../components/ui/Widget.svelte';
  import { LutExpressionError, hex4, lutExpression, lutRow, muxTree, truthFromExpression } from '../fpga/lut';

  let { title, caption, n, truth: initial = 0x6666 }: { title?: string; caption?: string; n?: string | number; truth?: number } = $props();

  let truth = $state(untrack(() => initial) & 0xffff);
  let inputs = $state<(0 | 1)[]>([0, 0, 0, 0]);
  let text = $state(lutExpression(untrack(() => initial) & 0xffff));
  let error = $state('');
  let editing = false;

  const tree = $derived(muxTree(truth, inputs));
  const row = $derived(lutRow(inputs));
  const presets: [string, string][] = [
    ['AND', 'I0 & I1 & I2 & I3'],
    ['OR', 'I0 | I1 | I2 | I3'],
    ['XOR', 'I0 ^ I1'],
    ['parity', 'I0 ^ I1 ^ I2 ^ I3'],
    ['majority', 'I0 & I1 | I0 & I2 | I1 & I2'],
    ['mux', 'I2 & I1 | !I2 & I0'],
    ['full-adder sum', 'I0 ^ I1 ^ I2'],
  ];

  $effect(() => {
    const t = truth;
    if (!editing) {
      text = lutExpression(t);
      error = '';
    }
  });
  function apply(src: string) {
    try {
      truth = truthFromExpression(src);
      error = '';
    } catch (e) {
      error = e instanceof LutExpressionError ? e.message : String(e);
    }
  }
  function flip(b: number) {
    truth = truth ^ (1 << b);
  }
  function key(ev: KeyboardEvent, b: number) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      flip(b);
    }
  }

  // Geometry (viewBox units).
  const BX = 60;
  const BW = 26;
  const TOP = 16;
  const BH = 13;
  const bitY = (b: number) => TOP + b * BH;
  const colX = (l: number) => BX + BW + 34 + l * 52;
  /** Vertical centre of node `i` at tree level `l` (level 0: the stored bits). */
  const nodeY = (l: number, i: number) => TOP + ((i + 0.5) * 2 ** l) * BH;
  const OUTX = $derived(colX(4) + 6);
</script>

<Widget title={title ?? 'A 4-input lookup table'} kind="Lookup table" {caption} {n} wide={false} grid>
  {#snippet children()}
    <div class="lut ui">
      <svg viewBox="0 0 {OUTX + 70} {TOP + 16 * BH + 34}" role="group" aria-label="A 4-input lookup table: 16 stored bits and a multiplexer tree">
        <!-- Stored bits -->
        {#each { length: 16 } as _, b (b)}
          {@const on = ((truth >> b) & 1) === 1}
          <g class="bit" class:on class:hit={row === b} role="switch" aria-checked={on} aria-label="Stored bit {b}, row I3 I2 I1 I0 = {b.toString(2).padStart(4, '0')}" tabindex="0" onclick={() => flip(b)} onkeydown={(ev) => key(ev, b)}>
            <text x={BX - 8} y={bitY(b) + BH / 2 + 3} class="idx" text-anchor="end">{b.toString(2).padStart(4, '0')}</text>
            <rect x={BX} y={bitY(b) + 1} width={BW} height={BH - 2} rx="2" />
            <text x={BX + BW / 2} y={bitY(b) + BH / 2 + 3.5} text-anchor="middle" class="val">{on ? 1 : 0}</text>
          </g>
        {/each}
        <text x={BX - 8} y={TOP - 5} class="cap" text-anchor="end">I3 I2 I1 I0</text>
        <text x={BX + BW / 2} y={TOP - 5} class="cap" text-anchor="middle">bit</text>

        <!-- The multiplexer tree: level l has 8 / 4 / 2 / 1 multiplexers selected by I(l). -->
        {#each { length: 4 } as _, l (l)}
          {@const count = 8 >> l}
          {#each { length: count } as __, i (i)}
            {@const ya = nodeY(l, 2 * i)}
            {@const yb = nodeY(l, 2 * i + 1)}
            {@const ym = nodeY(l + 1, i)}
            {@const sel = tree.selected[l]!}
            {@const x = colX(l)}
            {@const xin = l === 0 ? BX + BW : colX(l - 1) + 22}
            <path d="M{x} {ya - 4} L{x + 22} {ym - 5} L{x + 22} {ym + 5} L{x} {yb + 4} Z" class="mux" />
            <line x1={xin} y1={ya} x2={x} y2={ya} class="w" class:hi={tree.levels[l]![2 * i] === 1} />
            <line x1={xin} y1={yb} x2={x} y2={yb} class="w" class:hi={tree.levels[l]![2 * i + 1] === 1} />
            <line x1={x} y1={sel === 0 ? ya : yb} x2={x + 22} y2={ym} class="chosen" class:hi={tree.levels[l + 1]![i] === 1} class:unk={sel < 0} />
            {#if l < 3}<line x1={x + 22} y1={ym} x2={colX(l + 1)} y2={ym} class="w" class:hi={tree.levels[l + 1]![i] === 1} />{/if}
          {/each}
        {/each}
        <line x1={colX(3) + 22} y1={nodeY(4, 0)} x2={OUTX + 8} y2={nodeY(4, 0)} class="w" class:hi={tree.output === 1} />

        <!-- Selects -->
        {#each { length: 4 } as _, l (l)}
          {@const x = colX(l) + 11}
          <g class="sel" class:on={inputs[l] === 1} role="switch" aria-checked={inputs[l] === 1} aria-label="Input I{l}" tabindex="0" onclick={() => (inputs[l] = inputs[l] ? 0 : 1)} onkeydown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), (inputs[l] = inputs[l] ? 0 : 1))}>
            <rect x={x - 15} y={TOP + 16 * BH + 8} width="30" height="18" rx="9" />
            <text x={x - 4} y={TOP + 16 * BH + 20} text-anchor="end" class="in">I{l}</text>
            <text x={x + 5} y={TOP + 16 * BH + 20} text-anchor="middle" class="in v">{inputs[l]}</text>
          </g>
        {/each}

        <!-- Output -->
        <g class="out" class:on={tree.output === 1} class:unk={tree.output < 0}>
          <circle cx={OUTX + 22} cy={nodeY(4, 0)} r="9" />
          <text x={OUTX + 22} y={nodeY(4, 0) + 3.5} text-anchor="middle">{tree.output < 0 ? 'x' : tree.output}</text>
          <text x={OUTX + 22} y={nodeY(4, 0) - 14} text-anchor="middle" class="cap">O</text>
        </g>
      </svg>

      <div class="side">
        <label class="fn">
          <span>Function of I0, I1, I2, I3</span>
          <input
            type="text"
            bind:value={text}
            onfocus={() => (editing = true)}
            onblur={() => {
              editing = false;
              if (!error) text = lutExpression(truth);
            }}
            oninput={() => apply(text)}
            spellcheck="false"
            autocomplete="off"
            aria-invalid={!!error}
          />
        </label>
        {#if error}<p class="err" role="alert">{error}</p>{/if}
        <p class="facts">
          <span>truth table <code>{hex4(truth)}</code></span>
          <span>row <code>{row < 0 ? '?' : row}</code></span>
          <span>output <code>{tree.output < 0 ? 'x' : tree.output}</code></span>
        </p>
        <div class="presets" role="group" aria-label="Example functions">
          {#each presets as [name, src] (name)}<button type="button" onclick={() => apply(src)}>{name}</button>{/each}
          <button type="button" onclick={() => (truth = 0)}>clear</button>
        </div>
        <p class="hint">16 bits hold any function of four inputs: 2<sup>16</sup> = 65,536 of them. The inputs only choose which bit reaches the output.</p>
      </div>
    </div>
  {/snippet}
</Widget>

<style>
  .lut {
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem 1.2rem;
    align-items: flex-start;
    padding: 0.5rem 0.6rem;
  }
  svg {
    flex: 1 1 22rem;
    max-width: 30rem;
    min-width: 16rem;
    height: auto;
    font-family: var(--font-mono);
  }
  .side {
    flex: 1 1 14rem;
    min-width: 12rem;
  }
  .bit {
    cursor: pointer;
    outline: none;
  }
  .bit rect {
    fill: var(--surface-3);
    stroke: var(--line-strong);
  }
  .bit.on rect {
    fill: var(--sig-high);
    stroke: var(--sig-high);
  }
  .bit.hit rect {
    stroke: var(--phosphor);
    stroke-width: 2.4;
  }
  .bit:focus-visible rect {
    stroke: var(--focus);
    stroke-width: 2.4;
  }
  .val {
    font-size: 9px;
    fill: var(--fg);
    font-weight: 700;
  }
  .bit.on .val {
    fill: #1b1204;
  }
  .idx,
  .cap {
    font-size: 7.5px;
    fill: var(--mute);
  }
  .mux {
    fill: var(--surface);
    stroke: var(--wire);
    stroke-width: 1.2;
  }
  .w {
    stroke: var(--wire);
    stroke-width: 1.2;
    opacity: 0.6;
  }
  .w.hi {
    stroke: var(--sig-high);
    opacity: 1;
  }
  .chosen {
    stroke: var(--sig-low);
    stroke-width: 2;
  }
  .chosen.hi {
    stroke: var(--sig-high);
  }
  .chosen.unk {
    stroke: var(--sig-x);
    stroke-dasharray: 3 2;
  }
  .sel {
    cursor: pointer;
    outline: none;
  }
  .sel rect {
    fill: var(--surface);
    stroke: var(--line-strong);
  }
  .sel.on rect {
    stroke: var(--sig-high);
  }
  .sel:focus-visible rect {
    stroke: var(--focus);
    stroke-width: 2.4;
  }
  .in {
    font-size: 8px;
    fill: var(--fg);
  }
  .in.v {
    font-weight: 700;
    fill: var(--sig-low);
  }
  .sel.on .in.v {
    fill: var(--sig-high);
  }
  .out circle {
    fill: var(--surface-3);
    stroke: var(--line-strong);
  }
  .out text {
    font-size: 10px;
    fill: var(--fg);
    font-weight: 700;
  }
  .out.on circle {
    fill: var(--sig-high);
    stroke: var(--sig-high);
  }
  .out.on text:not(.cap) {
    fill: #1b1204;
  }
  .out.unk circle {
    fill: transparent;
    stroke: var(--sig-x);
    stroke-dasharray: 3 2;
  }
  .fn {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .fn input {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    padding: 0.3rem 0.5rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
  }
  .fn input[aria-invalid='true'] {
    border-color: var(--bad);
  }
  .err {
    margin: 0.3rem 0;
    color: var(--bad);
    font-size: 0.78rem;
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.9rem;
    margin: 0.5rem 0;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  code {
    font-family: var(--font-mono);
    color: var(--copper-ink);
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .presets button {
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
    font: inherit;
    font-size: 0.74rem;
    padding: 0.15rem 0.55rem;
    border-radius: 6px;
    cursor: pointer;
  }
  .presets button:hover {
    border-color: var(--copper);
  }
  .hint {
    margin: 0.6rem 0 0;
    font-size: 0.74rem;
    color: var(--mute);
  }
</style>
