<!--
  The memory explorer: an address decoder, eight word lines, four columns of bit lines and a cell at every
  crossing. Choose the kind of cell (SRAM, DRAM or ROM), an address and a word, and write or read: the lines light
  up frame by frame, with their voltages, so that you can see what each kind of cell does and how differently.
  The model is array.ts (tested); this file draws its frames.

    ::memory-explorer{n="20.4" caption="…"}
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { Mem, type CellKind, type Frame } from './array';
  import { DRAM, cellsIn } from './dram';

  let { kind: firstKind = 'sram', n: fig, caption }: { kind?: CellKind; n?: string | number; caption?: string } = $props();

  const ROM_WORDS = [0x1, 0x2, 0x4, 0x8, 0xf, 0x0, 0xa, 0x5];
  const make = (k: CellKind) => new Mem(k, 3, 4, k === 'rom' ? ROM_WORDS : undefined);

  let kind = $state<CellKind>(untrack(() => firstKind));
  let mem = $state.raw<Mem>(untrack(() => make(firstKind)));
  let rev = $state(0);
  let addr = $state(3);
  let data = $state<number[]>([1, 0, 1, 0]);
  let frames = $state.raw<Frame[]>([]);
  let fi = $state(0);
  let playing = $state(false);
  let stepMode = $state(false);
  let what = $state('');
  let last = $state<string>('');
  let root: HTMLElement | undefined = $state();
  let visible = true;

  const idle = $derived.by(() => {
    void rev;
    return mem.idle();
  });
  const frame = $derived<Frame>(frames[fi] ?? idle);
  const facts = $derived.by(() => {
    void rev;
    return mem.facts();
  });
  const isRom = $derived(kind === 'rom');
  const word = $derived(data.reduce((n, b) => (n << 1) | b, 0));
  const hex = (w: number) => w.toString(16).toUpperCase();
  const bin = (w: number) => w.toString(2).padStart(4, '0');

  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) stepMode = true;
    if (!root) return;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(root);
    return () => io.disconnect();
  });

  // Play the frames one after another.
  $effect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (!visible || document.hidden) return;
      if (fi < frames.length - 1) fi++;
      else playing = false;
    }, 1100);
    return () => clearInterval(id);
  });

  function start(fs: Frame[], text: string) {
    frames = fs;
    fi = 0;
    what = text;
    playing = !stepMode;
  }
  function read() {
    const fs = mem.read(addr);
    start(fs, `Read address ${addr}`);
    const q = fs.at(-1)!.q;
    last = `Read address ${addr} (${bin(addr)}): ${q.join('')}  =  ${hex(mem.wordOf(q as number[]))}`;
  }
  function write() {
    if (isRom) {
      frames = [];
      what = '';
      last = 'A ROM cannot be written: its bits were fixed when it was made.';
      return;
    }
    const fs = mem.write(addr, word);
    rev++;
    start(fs, `Write ${bin(word)} to address ${addr}`);
    last = `Wrote ${bin(word)} (${hex(word)}) to address ${addr} (${bin(addr)}).`;
  }
  function setKind(k: CellKind) {
    kind = k;
    mem = make(k);
    frames = [];
    fi = 0;
    playing = false;
    what = '';
    last = '';
    rev++;
  }
  function reset() {
    setKind(kind);
  }
  function flip(i: number) {
    data = data.map((b, k) => (k === i ? 1 - b : b));
  }
  const next = () => {
    if (fi < frames.length - 1) fi++;
  };
  const back = () => {
    if (fi > 0) fi--;
  };

  // ── Drawing ─────────────────────────────────────────────────────────────────
  const W = 410;
  const ROW0 = 66;
  const PITCH = 31;
  const CX = (c: number) => 124 + 76 * c;
  const H = ROW0 + 8 * PITCH + 92;
  const vdd = DRAM.vdd;

  /** Line colour from its voltage: slate at 0 V, amber at the supply. */
  const tone = (v: number) => `color-mix(in srgb, var(--sig-high) ${Math.round(Math.max(0, Math.min(1, v / vdd)) * 100)}%, var(--sig-low))`;
  const lineStyle = (c: number, which: 'bl' | 'blb') => {
    const v = which === 'bl' ? frame.bl[c]! : frame.blb[c]!;
    return `stroke:${tone(v)}`;
  };
  const floating = (c: number) => frame.lines[c] === 'charged' || frame.lines[c] === 'shared';
  const mv = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 1000))} mV`;
  /** What to write under a column while its lines are being shared. */
  function annotation(c: number): string {
    if (frame.lines[c] !== 'shared') return '';
    if (kind === 'dram') return mv(frame.bl[c]! - vdd / 2);
    if (kind === 'sram') return mv(frame.bl[c]! - frame.blb[c]!);
    return frame.bl[c]! < 0.6 ? 'pulled low' : 'stays high';
  }
  const addrBits = $derived([(addr >> 2) & 1, (addr >> 1) & 1, addr & 1]);
  const fmt = (x: number) => (x >= 1e9 ? `${(x / 1e9).toFixed(1)} billion` : x.toLocaleString('en-GB'));
</script>

<Widget title="Memory explorer" n={fig} {caption} kind="Interactive" fullscreen onreset={reset}>
  {#snippet controls()}
    <Segmented
      size="sm"
      label="Kind of cell"
      value={kind}
      onchange={setKind}
      options={[
        { value: 'sram', label: 'SRAM (6T)', title: 'Six transistors per bit: two cross-coupled inverters and two access transistors' },
        { value: 'dram', label: 'DRAM (1T1C)', title: 'One transistor and one capacitor per bit' },
        { value: 'rom', label: 'ROM', title: 'A transistor at every 1, none at a 0' },
      ]}
    />
    <Segmented size="sm" label="Address" value={addr} onchange={(v) => (addr = v)} options={Array.from({ length: 8 }, (_, a) => ({ value: a, label: String(a), title: `Address ${a} = ${a.toString(2).padStart(3, '0')}` }))} />
  {/snippet}

  <div class="me ui" bind:this={root}>
    <div class="acts">
      <span class="sws" role="group" aria-label="The word to write">
        {#each data as b, i (i)}
          <button type="button" class="sw" class:on={b === 1} role="switch" aria-checked={b === 1} disabled={isRom} onclick={() => flip(i)}><span class="knob" aria-hidden="true"></span>D{3 - i}={b}</button>
        {/each}
      </span>
      <Button size="sm" variant="primary" onclick={write}>Write {bin(word)}</Button>
      <Button size="sm" variant="primary" onclick={read}>Read</Button>
      <label class="cb"><input type="checkbox" bind:checked={stepMode} /> Step by step</label>
      {#if stepMode || frames.length}
        <span class="stepper" role="group" aria-label="Step through the frames">
          <Button size="sm" onclick={back} disabled={fi === 0 || frames.length === 0}>◀ Back</Button>
          <Button size="sm" onclick={next} disabled={fi >= frames.length - 1}>Next ▶</Button>
        </span>
      {/if}
    </div>

    <svg class="mem" viewBox="0 0 {W} {H}" role="img" aria-label="A memory of eight words of four bits: an address decoder, eight word lines and four bit-line pairs. {frame.label}: {frame.text}">
      <!-- Write drivers -->
      {#each [0, 1, 2, 3] as c (c)}
        <g class="drv" class:on={frame.drivers}>
          <rect x={CX(c) - 22} y="8" width="44" height="22" rx="4" />
          <text x={CX(c)} y="23" text-anchor="middle">D{3 - c}</text>
        </g>
        <line class="stub" x1={CX(c) - 10} y1="30" x2={CX(c) - 10} y2={ROW0 - 14} style="stroke:{tone(frame.bl[c]!)}" />
        {#if !isRom}<line class="stub" x1={CX(c) + 10} y1="30" x2={CX(c) + 10} y2={ROW0 - 14} style="stroke:{tone(frame.blb[c]!)}" />{/if}
      {/each}
      <text class="tag" x="6" y="22">{frame.precharge ? 'precharge on' : frame.drivers ? 'drivers on' : ''}</text>

      <!-- Decoder -->
      <g class="dec">
        <rect x="6" y={ROW0 - 16} width="50" height={8 * PITCH + 2} rx="5" />
        <text x="31" y={ROW0 + 4 * PITCH - 12} text-anchor="middle">3→8</text>
        <text x="31" y={ROW0 + 4 * PITCH + 4} text-anchor="middle">decoder</text>
      </g>
      <text class="tag" x="6" y={ROW0 - 38}>address</text>
      <text class="addr" x="6" y={ROW0 - 24}>{addrBits.join(' ')}</text>

      <!-- Word lines -->
      {#each Array.from({ length: 8 }, (_, i) => i) as r (r)}
        {@const y = ROW0 + r * PITCH}
        <line class="wl" class:hi={frame.wl[r]} x1="56" y1={y} x2={W - 6} y2={y} />
        <text class="wlt" class:hi={frame.wl[r]} x="60" y={y - 4}>WL{r}</text>
      {/each}

      <!-- Bit lines -->
      {#each [0, 1, 2, 3] as c (c)}
        <line class="bl" class:float={floating(c)} x1={CX(c) - 10} y1={ROW0 - 14} x2={CX(c) - 10} y2={ROW0 + 8 * PITCH - 8} style={lineStyle(c, 'bl')} />
        {#if !isRom}<line class="bl" class:float={floating(c)} x1={CX(c) + 10} y1={ROW0 - 14} x2={CX(c) + 10} y2={ROW0 + 8 * PITCH - 8} style={lineStyle(c, 'blb')} />{/if}
        <text class="lt" x={CX(c) - 10} y={ROW0 - 18} text-anchor="middle">{isRom ? 'BL' : 'BL'}</text>
        {#if !isRom}<text class="lt" x={CX(c) + 10} y={ROW0 - 18} text-anchor="middle">B̄L</text>{/if}
      {/each}

      <!-- Cells -->
      {#each Array.from({ length: 8 }, (_, i) => i) as r (r)}
        {#each [0, 1, 2, 3] as c (c)}
          {@const y = ROW0 + r * PITCH}
          {@const bit = frame.cells[r]![c]!}
          {@const v = frame.cellV[r]![c]!}
          <g class="cell" class:sel={frame.wl[r]} class:one={bit === 1}>
            <rect x={CX(c) - 16} y={y - 10} width="32" height="20" rx="4" />
            {#if kind === 'dram'}
              <rect class="charge" x={CX(c) - 14} y={y + 8 - 16 * (v / vdd)} width="28" height={16 * (v / vdd)} rx="2" style="fill:{tone(v)}" />
              <text x={CX(c)} y={y + 4} text-anchor="middle" class="bitd">{Math.round(v * 100) / 100 >= 1 ? '1' : v < 0.05 ? '0' : ''}</text>
            {:else if kind === 'rom'}
              <text x={CX(c)} y={y + 4.5} text-anchor="middle">{bit ? '⏚' : '·'}</text>
            {:else}
              <text x={CX(c)} y={y + 5} text-anchor="middle" class="bitv">{bit}</text>
            {/if}
          </g>
        {/each}
      {/each}

      <!-- Sense amplifiers and outputs -->
      {#each [0, 1, 2, 3] as c (c)}
        {@const y = ROW0 + 8 * PITCH + 8}
        <g class="amp" class:on={frame.sense}>
          <rect x={CX(c) - 22} y={y} width="44" height="22" rx="4" />
          <text x={CX(c)} y={y + 15} text-anchor="middle">sense</text>
        </g>
        <circle class="q" class:on={frame.q[c] === 1} cx={CX(c)} cy={y + 40} r="8" />
        <text class="qt" x={CX(c)} y={y + 44} text-anchor="middle">{frame.q[c] === null ? '' : frame.q[c]}</text>
        <text class="ann" x={CX(c)} y={y + 66} text-anchor="middle">{annotation(c)}</text>
        <text class="lt" x={CX(c) + 28} y={y + 44}>Q{3 - c}</text>
      {/each}
      <text class="tag" x="6" y={ROW0 + 8 * PITCH + 66}>{frame.sense ? 'sense amps firing' : ''}</text>
    </svg>

    <div class="story" role="status" aria-live="polite">
      {#if frames.length}
        <div class="chips" role="group" aria-label="Steps of {what}">
          {#each frames as f, i (i)}<button type="button" class:now={i === fi} class:past={i < fi} aria-current={i === fi ? 'step' : undefined} onclick={() => { fi = i; playing = false; }}>{f.label}</button>{/each}
        </div>
        <p class="what"><b>{what}.</b> {frame.text}</p>
      {:else}
        <p class="what">{last || (isRom ? 'A ROM: pick an address and press Read.' : 'Set a word with the D switches, pick an address, and press Write; then Read it back.')} {frame.text}</p>
      {/if}
      {#if last && frames.length}<p class="last">{last}</p>{/if}
    </div>

    <p class="facts">
      {#if kind === 'sram'}<b>{facts.cellTransistors}</b> transistors in the {8 * 4} cells (6 per bit){:else if kind === 'dram'}<b>{facts.cellTransistors}</b> transistors and <b>{facts.capacitors}</b> capacitors in the {8 * 4} cells{:else}<b>{facts.cellTransistors}</b> transistors: one at each 1{/if};
      the decoder is <b>{facts.decoderGates.and}</b> AND gates of {facts.decoderGates.fanIn} inputs and {facts.decoderGates.not} inverters.
      {#if kind === 'dram'}A 16 Gbit DRAM chip has {fmt(cellsIn(16))} cells like these.{/if}
      Solid bit lines are driven; dashed ones are floating, holding only the charge they were given.
    </p>
  </div>
</Widget>

<style>
  .me {
    display: grid;
    gap: 0.6rem;
    padding: 0.8rem 1rem 1rem;
    min-width: 0;
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.6rem;
    align-items: center;
  }
  .sws {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .sw {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--line-strong);
    border-radius: 99px;
    background: var(--panel);
    padding: 0.15rem 0.6rem 0.15rem 0.3rem;
    font: inherit;
    font-size: 0.8rem;
    font-family: var(--font-mono);
    color: var(--ink-2);
    cursor: pointer;
    min-height: 1.9rem;
  }
  .sw .knob {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--sig-low);
  }
  .sw.on {
    color: var(--fg);
    border-color: var(--sig-high);
  }
  .sw.on .knob {
    background: var(--sig-high);
  }
  .sw:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .sw:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .cb {
    font-size: 0.8rem;
    color: var(--ink-2);
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .stepper {
    display: inline-flex;
    gap: 0.3rem;
  }
  .mem {
    width: 100%;
    height: auto;
    max-height: 30rem;
    display: block;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    font-family: var(--font-mono);
  }
  .mem text {
    font-size: 11px;
    fill: var(--ink-2);
  }
  .mem .addr {
    fill: var(--sig-high);
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.15em;
  }
  .tag {
    fill: var(--mute);
    font-size: 10.5px;
  }
  .drv rect,
  .amp rect,
  .dec rect {
    fill: var(--pn);
    stroke: var(--line-strong);
    stroke-width: 1.2;
  }
  .drv.on rect,
  .amp.on rect {
    fill: color-mix(in srgb, var(--sig-high) 22%, var(--panel));
    stroke: var(--sig-high);
  }
  .drv text,
  .amp text {
    fill: var(--fg);
    font-size: 11px;
  }
  .dec text {
    fill: var(--fg);
    font-size: 11px;
  }
  .wl {
    stroke: var(--line-strong);
    stroke-width: 1.2;
  }
  .wl.hi {
    stroke: var(--sig-high);
    stroke-width: 3;
  }
  .wlt {
    font-size: 10px;
    fill: var(--mute);
  }
  .wlt.hi {
    fill: var(--sig-high);
    font-weight: 700;
  }
  .bl,
  .stub {
    stroke-width: 2.2;
    fill: none;
  }
  .bl.float {
    stroke-dasharray: 5 3;
  }
  .lt {
    font-size: 10px;
    fill: var(--mute);
  }
  .cell rect:first-child {
    fill: var(--panel);
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .cell.sel rect:first-child {
    stroke: var(--sig-high);
    stroke-width: 1.8;
  }
  .cell .bitv {
    font-size: 14px;
    font-weight: 700;
    fill: var(--sig-low);
  }
  .cell.one .bitv {
    fill: var(--sig-high);
  }
  .cell .bitd {
    font-size: 11px;
    fill: var(--fg);
  }
  .cell.one text:not(.bitv):not(.bitd) {
    fill: var(--sig-high);
    font-size: 14px;
    font-weight: 700;
  }
  .charge {
    opacity: 0.75;
  }
  .q {
    fill: var(--surface-3);
    stroke: var(--line-strong);
  }
  .q.on {
    fill: var(--sig-high);
    stroke: var(--sig-high);
  }
  .qt {
    font-size: 10px;
    fill: var(--fg);
    font-weight: 700;
  }
  .ann {
    font-size: 11px;
    fill: var(--copper-ink);
    font-weight: 600;
  }
  .story {
    display: grid;
    gap: 0.4rem;
    min-height: 6.5rem;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .chips button {
    border: 1px solid var(--line-strong);
    background: var(--panel);
    border-radius: 99px;
    padding: 0.1rem 0.7rem;
    font: inherit;
    font-size: 0.78rem;
    color: var(--ink-2);
    cursor: pointer;
    min-height: 1.7rem;
  }
  .chips button.now {
    border-color: var(--sig-high);
    color: var(--fg);
    font-weight: 700;
    background: color-mix(in srgb, var(--sig-high) 14%, var(--panel));
  }
  .chips button.past {
    color: var(--mute);
  }
  .chips button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .what,
  .last,
  .facts {
    margin: 0;
    font-size: 0.86rem;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .last {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--fg);
  }
  .facts {
    font-size: 0.78rem;
    color: var(--mute);
  }
  .what b {
    color: var(--fg);
  }
</style>
