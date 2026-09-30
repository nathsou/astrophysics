<!--
  Run the chip from its bits. The 4-bit counter of Chapter 29, fitted on the vFPGA-S, runs as its decoded bitstream
  beside the RTL simulator. Flip bits of the six LUTs' truth tables and see whether the two still agree.

    ::corrupt-bits{n="30.7" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { lutExpression } from '$lib/studio/fpga/lut';
  import { run, setup, type Run, type Setup, type Stimulus } from './corrupt';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let s = $state.raw<Setup | null>(null);
  let bits = $state.raw<Uint8Array | null>(null);
  let flipped = $state<number[]>([]);
  let stimulus = $state<Stimulus>('held');
  let error = $state('');
  const CYCLES = 20;

  onMount(() => {
    try {
      const x = setup();
      s = x;
      bits = x.result.bits.slice();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  });

  const result = $derived.by<Run | null>(() => {
    if (!s || !bits) return null;
    try {
      return run(s, bits, CYCLES, stimulus);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      return null;
    }
  });

  function flip(index: number) {
    if (!bits) return;
    const b = bits.slice();
    b[index] = b[index] ? 0 : 1;
    bits = b;
    flipped = flipped.includes(index) ? flipped.filter((i) => i !== index) : [...flipped, index];
  }
  function invert(offset: number) {
    if (!bits) return;
    const b = bits.slice();
    const hit = [...flipped];
    for (let i = 0; i < 16; i++) {
      b[offset + i] = b[offset + i] ? 0 : 1;
      const k = hit.indexOf(offset + i);
      if (k >= 0) hit.splice(k, 1);
      else hit.push(offset + i);
    }
    bits = b;
    flipped = hit;
  }
  function restore() {
    if (s) bits = s.result.bits.slice();
    flipped = [];
  }
  const hex = (v: number | 'x') => (v === 'x' ? 'x' : v.toString(16));
  const table = (offset: number): number => {
    let t = 0;
    for (let i = 0; i < 16; i++) t |= (bits![offset + i]! & 1) << i;
    return t;
  };
</script>

<Widget {n} title="Corrupt the bitstream" subtitle="The chip runs its bits, not your source" {caption} kind="Fabric vs RTL" onreset={restore}>
  {#snippet controls()}
    <Segmented label="Stimulus" value={stimulus} onchange={(v) => (stimulus = v)} options={[{ value: 'held', label: 'Enable held high' }, { value: 'varied', label: 'Enable low every third cycle' }]} size="sm" />
    <Button size="sm" onclick={restore} disabled={flipped.length === 0}>Restore the bits</Button>
  {/snippet}

  <div class="cb">
    {#if error}
      <p class="err ui" role="alert">{error}</p>
    {:else if !s || !bits}
      <p class="wait ui">The counter is being fitted on the vFPGA-S (about 50 ms). Its six logic cells will appear here, each with the 16 bits of its lookup table, and the chip will run beside the RTL simulator.</p>
    {:else}
      <p class="lead ui">The two rows show the count after each clock, on the RTL simulator and on the chip decoded from the bits. Each box under them is one logic cell of the fitted counter, and each square one bit of its truth table (row number in the corner): click a bit to flip it.</p>
      {#if result}
        <div class="runs" aria-label="The count after each clock, on the RTL simulator and on the chip">
          <div class="row"><span class="rl ui">RTL</span>{#each result.rtl as v, i (i)}<span class="v">{hex(v)}</span>{/each}</div>
          <div class="row"><span class="rl ui">chip</span>{#each result.fabric as v, i (i)}<span class="v" class:bad={v !== result.rtl[i]}>{hex(v)}</span>{/each}</div>
        </div>
        <div class="verdict ui" class:bad={result.firstMismatch > 0} role="status">
          {#if result.firstMismatch}
            <b>Mismatch</b> on {result.mismatched.join(', ')}, first at clock {result.firstMismatch}: the device and the source disagree.
          {:else}
            <b>The device agrees with the RTL simulator</b> ({result.checked} output bits checked after each of {CYCLES} clocks){flipped.length ? ', although you flipped ' + flipped.length + ' bit' + (flipped.length === 1 ? '' : 's') + ': nothing in this run reached them' : ''}.
          {/if}
        </div>
      {/if}
      <div class="cells">
        {#each s.cells as c (c.label)}
          <div class="cell">
            <div class="ch ui"><b>{c.label}</b><span>tile ({c.x}, {c.y}) cell {c.k}</span></div>
            <div class="grid" role="group" aria-label="Truth table of {c.label}">
              {#each Array.from({ length: 16 }, (_, r) => r) as r (r)}
                {@const idx = c.offset + r}
                <button
                  type="button"
                  class:one={bits[idx] === 1}
                  class:hit={flipped.includes(idx)}
                  aria-pressed={bits[idx] === 1}
                  aria-label="{c.label} table bit {r}, now {bits[idx]}"
                  onclick={() => flip(idx)}
                ><i>{r}</i>{bits[idx]}</button>
              {/each}
            </div>
            <div class="fn ui"><code>{lutExpression(table(c.offset))}</code> <button type="button" class="inv" onclick={() => invert(c.offset)} title="Flip all 16 bits of this table">Invert</button></div>
          </div>
        {/each}
      </div>

    {/if}
  </div>
</Widget>

<style>
  .cb {
    display: grid;
    gap: 0.65rem;
    padding: 0.8rem 1rem 1rem;
  }
  .lead,
  .wait {
    margin: 0;
    font-size: 0.84rem;
    color: var(--ink-2);
  }
  .err {
    color: var(--bad);
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.4rem, 1fr));
    gap: 0.6rem;
  }
  .cell {
    border: 1px solid var(--line);
    border-radius: 7px;
    padding: 0.4rem 0.5rem 0.5rem;
    background: var(--panel);
    display: grid;
    gap: 0.3rem;
  }
  .ch {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .ch b {
    font: 600 0.82rem var(--font-mono);
    color: var(--fg);
  }
  .ch span {
    font-size: 0.66rem;
    color: var(--mute);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2px;
  }
  .grid button {
    position: relative;
    aspect-ratio: 1;
    min-height: 1.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    background: var(--pn);
    color: var(--mute);
    font: 600 0.78rem var(--font-mono);
    cursor: pointer;
    padding: 0;
  }
  .grid button.one {
    background: color-mix(in srgb, var(--sig-high) 30%, var(--panel));
    border-color: var(--sig-high);
    color: var(--fg);
  }
  .grid button.hit {
    outline: 2px solid var(--bad);
    outline-offset: 1px;
  }
  .grid i {
    position: absolute;
    top: 1px;
    left: 2px;
    font: 400 0.5rem var(--font-mono);
    font-style: normal;
    color: var(--mute);
  }
  .fn {
    font-size: 0.72rem;
    color: var(--mute);
    overflow-wrap: anywhere;
  }
  .fn code {
    font-family: var(--font-mono);
  }
  .inv {
    font: 600 0.68rem var(--font-ui);
    padding: 0.1rem 0.4rem;
    margin-left: 0.3rem;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: var(--panel);
    color: var(--ink-2);
    cursor: pointer;
  }
  .inv:hover {
    border-color: var(--copper);
  }
  .runs {
    display: grid;
    gap: 0.2rem;
    overflow-x: auto;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .rl {
    width: 2.6rem;
    flex: none;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  .v {
    width: 1.35rem;
    flex: none;
    text-align: center;
    font: 600 0.82rem var(--font-mono);
    padding: 0.1rem 0;
    border-radius: 3px;
    background: var(--pn);
    color: var(--fg);
  }
  .v.bad {
    background: var(--bad-soft);
    color: var(--bad);
    outline: 1px solid var(--bad);
  }
  .verdict {
    font-size: 0.84rem;
    padding: 0.45rem 0.7rem;
    border-radius: 6px;
    border-left: 3px solid var(--ok);
    background: var(--ok-soft);
    color: var(--ink-2);
  }
  .verdict.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .verdict b {
    color: var(--fg);
  }
</style>
