<!--
  A cosmic ray in the configuration memory. The 1,772 bits of a configured vFPGA-S (the XOR of Figure 28.5) are drawn
  as a grid. Strike a bit, at random or by number or by clicking it, and the decoded bits are simulated again. The
  census flips every bit in turn and marks the ones that break the circuit.

    ::upset-census{n="28.6" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { checkGoal, XOR_GOAL } from '$lib/studio/fpga/hand';
  import { describeBit } from '$lib/pld/devices/vfpga-config';
  import { onThemeChange, readSignals, type Signals } from '$lib/theme/signals';
  import { census, device, loaderVerdict, ray, reference, strike, type Census } from './upset';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  const dev = device();
  const ref = reference();
  const TOTAL = dev.totalBits;

  let bits = $state(ref.slice());
  let flipped = $state<number[]>([]);
  let rays = $state(0);
  let last = $state<{ index: number; text: string; harmless: boolean; file?: string } | null>(null);
  let where = $state<'memory' | 'file'>('memory');
  let cen = $state<Census | null>(null);
  let running = $state(false);
  let progress = $state(0);
  let hover = $state<number | null>(null);
  let bitNumber = $state('0');

  const now = $derived(checkGoal(dev, bits, XOR_GOAL));
  const critical = $derived(new Set(cen?.critical ?? []));

  function hit(index: number) {
    if (index < 0 || index >= TOTAL || !Number.isInteger(index)) return;
    rays++;
    const s = strike(bits, index, dev);
    if (where === 'file') {
      const v = loaderVerdict(bits, index, dev);
      last = { index, text: s.what.text, harmless: s.harmless, file: v ?? 'the loader accepts the file' };
      return;
    }
    const next = bits.slice();
    next[index] = next[index] ? 0 : 1;
    bits = next;
    flipped = flipped.includes(index) ? flipped.filter((i) => i !== index) : [...flipped, index];
    last = { index, text: s.what.text, harmless: s.harmless };
  }
  const random = () => hit(ray(rays, TOTAL));
  function scrub() {
    bits = ref.slice();
    flipped = [];
    last = null;
  }
  function reset() {
    scrub();
    rays = 0;
    cen = null;
    progress = 0;
    running = false;
  }

  let stop = false;
  async function runCensus() {
    if (running) return;
    running = true;
    stop = false;
    progress = 0;
    let c: Census = { total: TOTAL, critical: [], byCategory: [] };
    const CHUNK = 60;
    for (let i = 0; i < TOTAL && !stop; i += CHUNK) {
      c = census(ref, dev, i, Math.min(TOTAL, i + CHUNK), c);
      progress = Math.min(TOTAL, i + CHUNK) / TOTAL;
      cen = { ...c, critical: [...c.critical], byCategory: c.byCategory.map((r) => ({ ...r })) };
      await new Promise((r) => setTimeout(r, 0));
    }
    running = false;
  }

  // ── The grid ───────────────────────────────────────────────────────
  const CELL = 6;
  const GAP = 1;
  let box: HTMLDivElement | undefined = $state();
  let canvas: HTMLCanvasElement | undefined = $state();
  let width = $state(340);
  const cols = $derived(Math.max(16, Math.floor((width + GAP) / (CELL + GAP))));
  const rows = $derived(Math.ceil(TOTAL / cols));
  const heightPx = $derived(rows * (CELL + GAP) - GAP);
  let sig: Signals | undefined;
  let themeTick = $state(0);

  const cat = new Uint8Array(TOTAL);
  const CATS = ['lut', 'lc-flag', 'clock', 'pad', 'mux', 'bram', 'bram-init'] as const;
  for (let i = 0; i < TOTAL; i++) cat[i] = CATS.indexOf(describeBit(dev, i).category);

  function draw() {
    void themeTick;
    if (!canvas) return;
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(heightPx * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    sig = readSignals(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, heightPx);
    const colour = [sig.copper, sig.high, sig.current, sig.phosphor, sig.fg, sig.low, sig.low];
    const set = new Set(flipped);
    for (let i = 0; i < TOTAL; i++) {
      const x = (i % cols) * (CELL + GAP);
      const y = Math.floor(i / cols) * (CELL + GAP);
      ctx.globalAlpha = 1;
      if (bits[i]) {
        ctx.fillStyle = colour[cat[i]!]!;
        ctx.globalAlpha = cat[i] === 4 ? 0.7 : 1;
        ctx.fillRect(x, y, CELL, CELL);
      } else {
        ctx.fillStyle = sig.line;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x, y, CELL, CELL);
      }
      ctx.globalAlpha = 1;
      if (critical.has(i)) {
        ctx.fillStyle = sig.x;
        ctx.fillRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3);
      }
      if (set.has(i) || i === hover) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = set.has(i) ? sig.x : sig.fg;
        ctx.strokeRect(x - 0.5, y - 0.5, CELL + 1, CELL + 1);
      }
    }
  }
  $effect(() => {
    void bits;
    void flipped;
    void critical;
    void hover;
    void cols;
    void themeTick;
    void heightPx;
    draw();
  });

  const at = (ev: PointerEvent | MouseEvent): number => {
    const r = canvas!.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - r.left) * (width / r.width)) / (CELL + GAP));
    const y = Math.floor(((ev.clientY - r.top) * (heightPx / r.height)) / (CELL + GAP));
    const i = y * cols + x;
    return x >= 0 && x < cols && y >= 0 && i < TOTAL ? i : -1;
  };
  const hoverText = $derived(hover !== null ? describeBit(dev, hover, bits).text : '');

  onMount(() => {
    const ro = new ResizeObserver(([e]) => {
      if (e) width = Math.max(120, Math.floor(e.contentRect.width));
    });
    if (box) ro.observe(box);
    const off = onThemeChange(() => themeTick++);
    return () => {
      stop = true;
      ro.disconnect();
      off();
    };
  });
  const pct = (k: number) => ((100 * k) / TOTAL).toFixed(1);
</script>

<Widget {n} title="A cosmic ray" subtitle="One flipped bit of the configuration memory" {caption} kind="Fault injection" onreset={reset}>
  {#snippet controls()}
    <Segmented label="Where the ray hits" value={where} onchange={(v) => (where = v)} options={[{ value: 'memory', label: 'The memory', title: 'A bit of the configuration SRAM flips after loading' }, { value: 'file', label: 'The file', title: 'A bit of the bitstream file flips before loading' }]} size="sm" />
    <Button size="sm" onclick={random}>Strike at random</Button>
    <Button size="sm" onclick={scrub} disabled={flipped.length === 0}>Scrub</Button>
    <Button size="sm" onclick={runCensus} disabled={running}>{running ? `Census… ${Math.round(progress * 100)} %` : cen && cen.total && progress >= 1 ? 'Run the census again' : 'Run the census'}</Button>
  {/snippet}

  <div class="uc">
    <div class="verdict ui" class:bad={!now.ok} role="status">
      <b>{now.ok ? 'Still an XOR gate' : 'Broken'}</b>
      <span>after {rays} ray{rays === 1 ? '' : 's'}; {flipped.length} bit{flipped.length === 1 ? '' : 's'} of the memory flipped{now.ok ? '' : `; ${now.problems[0] ?? 'P2 no longer follows P0 xor P1'}`}</span>
    </div>

    <div class="gridbox" bind:this={box}>
      <canvas
        bind:this={canvas}
        style:width="100%"
        style:height="{heightPx}px"
        role="img"
        aria-label="The {TOTAL} configuration bits of the vFPGA-S, {bits.reduce((a, b) => a + b, 0)} of them set. Use the buttons or the bit number to strike one."
        onpointermove={(ev) => (hover = at(ev) >= 0 ? at(ev) : null)}
        onpointerleave={() => (hover = null)}
        onclick={(ev) => {
          const i = at(ev);
          if (i >= 0) hit(i);
        }}
      ></canvas>
    </div>
    <p class="hover ui" aria-live="polite">{hoverText || 'Point at a bit to see what it controls; click it to flip it.'}</p>

    <form
      class="num ui"
      onsubmit={(ev) => {
        ev.preventDefault();
        hit(Number(bitNumber));
      }}
    >
      <label>Bit <input type="number" min="0" max={TOTAL - 1} step="1" bind:value={bitNumber} /></label>
      <Button size="sm" type="submit">Flip it</Button>
      <span class="key ui" aria-hidden="true">
        <i style="background: var(--copper)"></i>LUT <i style="background: var(--sig-high)"></i>flags <i style="background: var(--sig-current)"></i>clock <i style="background: var(--phosphor)"></i>pad <i style="background: var(--fg); opacity: 0.7"></i>routing <i class="crit"></i>critical
      </span>
    </form>

    {#if last}
      <div class="last ui" class:bad={!last.harmless}>
        <b>Bit {last.index}</b>: {last.text}
        <span class="fx">{last.harmless ? 'Alone, this flip does not change what the circuit does.' : 'Alone, this flip breaks the circuit.'}</span>
        {#if last.file}<span class="fx"><b>The loader:</b> {last.file}.</span>{/if}
      </div>
    {/if}

    {#if cen && cen.byCategory.length}
      <table class="tab ui" aria-label="Census of single-bit upsets">
        <thead><tr><th>Kind of bit</th><th>Bits</th><th>Critical</th><th></th></tr></thead>
        <tbody>
          {#each cen.byCategory as r (r.category)}
            <tr><th scope="row">{r.label}</th><td>{r.bits}</td><td class:bad={r.critical > 0}>{r.critical}</td><td class="bar"><span style:width="{(100 * r.critical) / Math.max(1, r.bits)}%"></span></td></tr>
          {/each}
          <tr class="sum"><th scope="row">All</th><td>{cen.byCategory.reduce((a, r) => a + r.bits, 0)}</td><td>{cen.critical.length}</td><td class="pc">{pct(cen.critical.length)} %</td></tr>
        </tbody>
      </table>
    {/if}
  </div>
</Widget>

<style>
  .uc {
    display: grid;
    gap: 0.6rem;
    padding: 0.8rem 1rem 1rem;
  }
  .verdict {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.7rem;
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
  .gridbox {
    min-width: 0;
  }
  canvas {
    display: block;
    cursor: crosshair;
    background: var(--panel);
  }
  .hover {
    margin: 0;
    min-height: 2.6em;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .num {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.8rem;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .num input {
    width: 5.5rem;
    font: inherit;
    font-family: var(--font-mono);
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    background: var(--panel);
    color: var(--fg);
  }
  .key {
    color: var(--mute);
    font-size: 0.72rem;
  }
  .key i {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    margin: 0 0.25rem 0 0.6rem;
    vertical-align: -1px;
  }
  .key i.crit {
    background: var(--sig-x);
    border-radius: 1px;
  }
  .last {
    font-size: 0.84rem;
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    border-left: 3px solid var(--ok);
    background: var(--ok-soft);
    color: var(--ink-2);
  }
  .last.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .fx {
    display: block;
    margin-top: 0.2rem;
  }
  .tab {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  .tab th,
  .tab td {
    padding: 0.2rem 0.5rem 0.2rem 0;
    text-align: right;
    font-family: var(--font-mono);
  }
  .tab thead th {
    color: var(--mute);
    font-weight: 500;
    font-family: var(--font-ui);
  }
  .tab thead th:first-child {
    text-align: left;
  }
  .tab tbody th {
    text-align: left;
    font-weight: 500;
    font-family: var(--font-ui);
    color: var(--ink-2);
  }
  .tab td.bad {
    color: var(--bad);
    font-weight: 600;
  }
  .tab .bar {
    width: 30%;
    padding-right: 0;
  }
  .tab .bar span {
    display: block;
    height: 0.55rem;
    background: var(--bad);
    border-radius: 2px;
    min-width: 0;
  }
  .tab .sum th,
  .tab .sum td {
    border-top: 1px solid var(--line);
    color: var(--fg);
  }
  .pc {
    text-align: left !important;
    color: var(--mute);
  }
</style>
