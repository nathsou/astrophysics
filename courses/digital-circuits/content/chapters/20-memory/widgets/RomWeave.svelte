<!--
  A ROM as a crossing of lines. Eight words of seven bits. In a core rope a sense wire is threaded through the
  core of a word to make a 1 and passed by it to make a 0; in a mask ROM a transistor is fitted at the crossing
  of a 1. Click a crossing (or move with the arrow keys and press Space) to weave your own, pick an address to
  read it, or weave a text: the words are ASCII codes. The model is rom.ts (tested).

    ::rom-weave{n="20.6" caption="…"}
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { AGC, agcBits, blank, charOfBits, couplings, programText, readWord, textOf, toggle, ROM_BITS, type Rom } from './rom';

  let { text = 'APOLLO 8', n: fig, caption }: { text?: string; n?: string | number; caption?: string } = $props();

  let rom = $state.raw<Rom>(untrack(() => programText(text)));
  let tech = $state<'rope' | 'nor'>('rope');
  let addr = $state(0);
  let focus = $state({ r: 0, c: 0 });
  let focused = $state(false);
  let entry = $state(untrack(() => text));

  const out = $derived(readWord(rom, addr));
  const ch = $derived(charOfBits(out));
  const shown = $derived(ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127 ? ch : '·');
  const spelled = $derived(textOf(rom));

  const CELL = 34;
  const LEFT = 84;
  const TOP = 40;
  const W = LEFT + ROM_BITS * CELL + 16;
  const H = TOP + 8 * CELL + 72;
  const x = (c: number) => LEFT + c * CELL + CELL / 2;
  const y = (r: number) => TOP + r * CELL + CELL / 2;

  function flip(r: number, c: number) {
    rom = toggle(rom, r, c);
  }
  function key(ev: KeyboardEvent) {
    const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (d[ev.key]) {
      ev.preventDefault();
      focus = { r: Math.max(0, Math.min(7, focus.r + d[ev.key]![0])), c: Math.max(0, Math.min(ROM_BITS - 1, focus.c + d[ev.key]![1])) };
      addr = focus.r;
    } else if (ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault();
      flip(focus.r, focus.c);
    }
  }
  function weave() {
    rom = programText(entry);
    entry = spelled === entry ? entry : entry;
  }
  const ones = $derived(couplings(rom));
</script>

<Widget title="Weave a ROM" n={fig} {caption} kind="Interactive" onreset={() => { rom = programText(text); entry = text; }}>
  {#snippet controls()}
    <Segmented size="sm" label="Technology" value={tech} onchange={(v) => (tech = v)} options={[{ value: 'rope', label: 'Core rope', title: 'Apollo Guidance Computer, 1960s' }, { value: 'nor', label: 'Mask ROM', title: 'A transistor at each 1' }]} />
    <Segmented size="sm" label="Address" value={addr} onchange={(v) => { addr = v; focus = { ...focus, r: v }; }} options={Array.from({ length: 8 }, (_, a) => ({ value: a, label: String(a) }))} />
  {/snippet}

  <div class="rw ui">
    <div class="acts">
      <label class="txt">Weave the text <input type="text" maxlength="8" bind:value={entry} aria-label="Eight characters to store" onkeydown={(e) => e.key === 'Enter' && weave()} /></label>
      <Button size="sm" variant="primary" onclick={weave}>{tech === 'rope' ? 'Weave' : 'Program'}</Button>
      <Button size="sm" onclick={() => (rom = blank())}>Clear</Button>
    </div>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <svg
      class="rom"
      viewBox="0 0 {W} {H}"
      role="application"
      tabindex="0"
      aria-label="A read-only memory of 8 words of 7 bits. Arrow keys move between crossings, Space or Enter changes one. Word {addr} reads {out.join('')}, the character {shown}."
      onkeydown={key}
      onfocus={() => (focused = true)}
      onblur={() => (focused = false)}
    >
      <!-- Sense lines -->
      {#each Array.from({ length: ROM_BITS }, (_, i) => i) as c (c)}
        <line class="sense" class:hi={out[c] === 1} x1={x(c)} y1={TOP - 8} x2={x(c)} y2={TOP + 8 * CELL + 6} />
        <text class="ct" x={x(c)} y={TOP - 14} text-anchor="middle">b{ROM_BITS - 1 - c}</text>
      {/each}
      <!-- Word lines / set lines -->
      {#each Array.from({ length: 8 }, (_, i) => i) as r (r)}
        <line class="word" class:hi={r === addr} x1={LEFT - 30} y1={y(r)} x2={LEFT + ROM_BITS * CELL} y2={y(r)} />
        <text class="rt" class:hi={r === addr} x="6" y={y(r) + 4}>{tech === 'rope' ? 'set' : 'WL'} {r}</text>
        <text class="rc" x={LEFT - 34} y={y(r) + 4} text-anchor="end">{charOfBits(rom.words[r]!).replace(/[^ -~]/g, '·')}</text>
      {/each}
      <!-- Crossings -->
      {#each Array.from({ length: 8 }, (_, i) => i) as r (r)}
        {#each Array.from({ length: ROM_BITS }, (_, i) => i) as c (c)}
          {@const on = rom.words[r]![c] === 1}
          <g class="x" class:on class:row={r === addr} role="presentation" onclick={() => { flip(r, c); focus = { r, c }; addr = r; }}>
            <rect class="hit" x={x(c) - CELL / 2} y={y(r) - CELL / 2} width={CELL} height={CELL} />
            {#if tech === 'rope'}
              {#if on}<ellipse class="core" cx={x(c)} cy={y(r)} rx="11" ry="8" />{:else}<path class="pass" d="M{x(c) - 5} {y(r) - 12} q10 12 0 24" />{/if}
            {:else if on}
              <rect class="tr" x={x(c) - 6} y={y(r) - 6} width="12" height="12" rx="2" />
              <line class="tr-g" x1={x(c) - 12} y1={y(r) - 6} x2={x(c) - 6} y2={y(r) - 6} />
            {:else}
              <circle class="none" cx={x(c)} cy={y(r)} r="2" />
            {/if}
          </g>
        {/each}
      {/each}
      {#if focused}<rect class="focus" x={x(focus.c) - CELL / 2 + 1} y={y(focus.r) - CELL / 2 + 1} width={CELL - 2} height={CELL - 2} rx="4" />{/if}
      <!-- Outputs -->
      {#each Array.from({ length: ROM_BITS }, (_, i) => i) as c (c)}
        <circle class="led" class:on={out[c] === 1} cx={x(c)} cy={TOP + 8 * CELL + 26} r="9" />
        <text class="lt" x={x(c)} y={TOP + 8 * CELL + 30} text-anchor="middle">{out[c]}</text>
      {/each}
      <text class="ch" x={LEFT - 34} y={TOP + 8 * CELL + 34} text-anchor="end">{shown}</text>
      <text class="tag" x={LEFT} y={TOP + 8 * CELL + 58}>word {addr} reads {out.join('')} = {String(out.reduce((n, b) => (n << 1) | b, 0)).padStart(3, ' ')} = “{shown}”</text>
    </svg>

    <p class="note">
      {#if tech === 'rope'}
        A rope has one core for each word, and every sense wire either <b>threads</b> it (a ring: a 1) or <b>bypasses</b> it (a 0). Pulsing a word's set line makes its core flip, and the flip induces a voltage in the wires threaded through it: <b>{ones}</b> of 56 crossings are threaded here. The Apollo Guidance Computer's fixed memory held {AGC.words.toLocaleString('en-GB')} words of {AGC.wordBits} bits ({agcBits().toLocaleString('en-GB')} bits), woven by hand.
      {:else}
        A mask ROM has a transistor at each crossing that stores a 1 (<b>{ones}</b> here), gate to the word line, drain to the bit line. Raising the word line turns those transistors on and they pull their bit lines low; the crossings without one leave the line high. The pattern of transistors is fixed by the mask when the chip is made.
      {/if}
      The letters at the left are the ASCII codes of the words: the text stored is “{spelled}”.
    </p>
  </div>
</Widget>

<style>
  .rw {
    display: grid;
    gap: 0.6rem;
    padding: 0.8rem 1rem 1rem;
    min-width: 0;
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.7rem;
    align-items: center;
  }
  .txt {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .txt input {
    font: inherit;
    font-family: var(--font-mono);
    width: 8.5em;
    padding: 0.25rem 0.4rem;
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    background: var(--bg);
    color: var(--fg);
    text-transform: none;
  }
  .rom {
    width: 100%;
    max-width: 30rem;
    height: auto;
    display: block;
    margin: 0 auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    font-family: var(--font-mono);
    outline: none;
  }
  .rom:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .sense {
    stroke: var(--line-strong);
    stroke-width: 1.6;
  }
  .sense.hi {
    stroke: var(--sig-high);
    stroke-width: 3;
  }
  .word {
    stroke: var(--line-strong);
    stroke-width: 1.4;
  }
  .word.hi {
    stroke: var(--sig-high);
    stroke-width: 3;
  }
  .ct,
  .rt,
  .rc,
  .tag {
    font-size: 11px;
    fill: var(--mute);
  }
  .rt.hi {
    fill: var(--sig-high);
    font-weight: 700;
  }
  .rc {
    fill: var(--fg);
    font-size: 13px;
    font-weight: 600;
  }
  .hit {
    fill: transparent;
    cursor: pointer;
  }
  .core {
    fill: none;
    stroke: var(--copper);
    stroke-width: 3;
  }
  .x.row .core {
    stroke: var(--sig-high);
    stroke-width: 3.6;
  }
  .pass {
    fill: none;
    stroke: var(--mute);
    stroke-width: 1.2;
    stroke-dasharray: 2 3;
    opacity: 0.6;
  }
  .tr {
    fill: var(--copper);
    stroke: none;
  }
  .x.row .tr {
    fill: var(--sig-high);
  }
  .tr-g {
    stroke: var(--copper);
    stroke-width: 2;
  }
  .none {
    fill: var(--line-strong);
  }
  .focus {
    fill: none;
    stroke: var(--focus);
    stroke-width: 2;
    pointer-events: none;
  }
  .led {
    fill: var(--surface-3);
    stroke: var(--line-strong);
  }
  .led.on {
    fill: var(--sig-high);
    stroke: var(--sig-high);
  }
  .lt {
    font-size: 11px;
    font-weight: 700;
    fill: var(--fg);
  }
  .ch {
    font-size: 26px;
    font-weight: 700;
    fill: var(--sig-high);
  }
  .note {
    margin: 0;
    font-size: 0.82rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
