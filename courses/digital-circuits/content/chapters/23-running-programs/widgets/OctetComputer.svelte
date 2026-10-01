<!--
  The Octet computer: an assembly editor with the assembler's listing beside it (address, bytes), a clock that runs
  from one cycle at a time to millions per second, breakpoints, the registers (including the hidden ones of the
  datapath), the flags, all 256 bytes of memory, and the board's devices.

    ::octet-computer{program="sum" n="23.4" caption="…"}
    ::octet-computer{program="stack" devices="leds" panels="registers,memory" rate=2}

  `program`: an id from programs.ts or the course's demonstration programs. `panels`: which of registers, cycles,
  history and memory to show. `devices`: the board devices to show (default: what the program uses). `rate`: the
  starting index on the speed slider. `editable=false` makes the source read-only.
  The machine is `computer.ts`; its cycle-level stepping is `cycles.ts`. At speeds up to 200 Hz it steps clock
  cycles (every register transfer visible); above that the reference interpreter runs whole instructions.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { OCTET_PROGRAMS } from '$lib/sim/cpu/octet';
  import { OctetComputer } from './computer';
  import { CHAPTER_PROGRAMS, programById } from './programs';
  import Devices, { type Device } from './Devices.svelte';
  import type { CycleInfo, Node } from './cycles';

  const instanceId = $props.id();
  let {
    program = 'sum',
    title = 'The Octet computer',
    subtitle,
    n,
    caption,
    panels = 'registers,cycles,history,memory',
    devices,
    rate = 3,
    editable = true,
    picker = true,
  }: {
    program?: string;
    title?: string;
    subtitle?: string;
    n?: string | number;
    caption?: string;
    panels?: string;
    devices?: string;
    rate?: number;
    editable?: boolean | string;
    picker?: boolean | string;
  } = $props();

  const RATES = [1, 2, 5, 10, 50, 200, 1e3, 1e4, 1e5, 1e6, 1e7];
  /** At or below this many cycles per second the machine is stepped a cycle at a time. */
  const CYCLE_LEVEL = 200;
  const rateLabel = (i: number) => {
    const r = RATES[Math.round(i)] ?? 1;
    return r >= 1e6 ? `${r / 1e6} MHz` : r >= 1e3 ? `${r / 1e3} kHz` : `${r} Hz`;
  };

  const initial = untrack(() => programById(program));
  const can = (v: boolean | string) => v !== false && v !== 'false';
  const isEditable = untrack(() => can(editable));
  const showPicker = untrack(() => can(picker));
  const show = untrack(() => new Set(panels.split(',').map((s) => s.trim())));
  const computer = new OctetComputer(initial.source);
  let chosen = $state(initial.id);
  let source = $state(initial.source);
  let rateIndex = $state(untrack(() => rate));
  let running = $state(false);
  let note = $state('');
  let tick = $state(0);
  let visible = true;
  let root: HTMLDivElement | undefined = $state();
  let ta: HTMLTextAreaElement | undefined = $state();

  // Devices: what the program uses, or the author's list.
  let deviceList = $state<Device[]>(untrack(() => (devices ? (devices.split(',').map((s) => s.trim()).filter(Boolean) as Device[]) : initial.devices)));

  interface Snap {
    pc: number;
    sp: number;
    r: number[];
    z: boolean;
    c: boolean;
    n: boolean;
    v: boolean;
    mar: number;
    ir: number;
    a: number;
    b: number;
    t: number;
    cycles: number;
    steps: number;
    halted: boolean;
    boundary: boolean;
    mem: number[];
    last: CycleInfo | null;
    line: number;
    history: { address: number; text: string; cycles: number }[];
    stale: boolean;
    stamps: number[];
  }

  function take(): Snap {
    const m = computer.machine;
    const cpu = computer.cpu;
    return {
      pc: m.pc,
      sp: m.sp,
      r: [...m.r],
      z: m.z,
      c: m.c,
      n: m.n,
      v: m.v,
      mar: cpu.mar,
      ir: cpu.ir,
      a: cpu.a,
      b: cpu.b,
      t: cpu.t,
      cycles: m.cycles,
      steps: m.steps,
      halted: computer.halted,
      boundary: cpu.atBoundary,
      mem: computer.memoryView(),
      last: cpu.last,
      line: computer.currentLine,
      history: computer.history.map((h) => ({ address: h.address, text: h.text, cycles: h.cycles })),
      stale: computer.stale,
      stamps: [...m.stamps],
    };
  }
  let snap = $state.raw<Snap>(take());
  /** Memory cells that changed recently, with the time (ms) they stop being highlighted. */
  let flashes = $state.raw(new Map<number, number>());
  let prevMem = untrack(() => snap.mem);

  function refresh() {
    const s = take();
    const now = performance.now();
    const next = new Map<number, number>();
    for (const [a, t] of flashes) if (t > now) next.set(a, t);
    for (let a = 0; a < 256; a++) if (s.mem[a] !== prevMem[a] && a < 0xf0) next.set(a, now + 700);
    prevMem = s.mem;
    flashes = next;
    snap = s;
    tick++;
  }

  const cycleLevel = $derived(RATES[Math.round(rateIndex)]! <= CYCLE_LEVEL);
  const cur = $derived(snap.last);
  const hot = $derived(new Set<Node>(!snap.boundary || cycleLevel ? (cur?.writes ?? []) : []));
  const src = $derived(!snap.boundary || cycleLevel ? cur?.from : undefined);
  const dst = $derived(!snap.boundary || cycleLevel ? cur?.to : undefined);
  const hex2 = (v: number) => v.toString(16).toUpperCase().padStart(2, '0');

  // ---- The clock.

  let budget = 0;
  let lastFrame = 0;
  let raf = 0;

  function frame(t: number) {
    raf = requestAnimationFrame(frame);
    if (!running || !visible || document.hidden) {
      lastFrame = t;
      return;
    }
    const dt = Math.min(0.1, Math.max(0, (t - lastFrame) / 1000));
    lastFrame = t;
    budget += dt * RATES[Math.round(rateIndex)]!;
    const cycles = Math.floor(budget);
    if (cycles < 1) return;
    budget -= cycles;
    const r = computer.run(cycles);
    if (r.reason !== 'budget') {
      running = false;
      note = r.reason === 'halted' ? `Halted after ${computer.machine.cycles} clock cycles.` : 'Stopped at a breakpoint.';
    }
    refresh();
  }

  onMount(() => {
    let io: IntersectionObserver | undefined;
    if (root) {
      io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
      io.observe(root);
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  });

  function toggleRun() {
    if (computer.halted) return;
    if (!ensureLoaded()) return;
    note = '';
    running = !running;
  }
  /** A source that has errors cannot run; a changed one is loaded first if the machine has not started. */
  function ensureLoaded(): boolean {
    if (!computer.ok) {
      note = 'Fix the errors in the source first.';
      return false;
    }
    return true;
  }
  function stepCycle() {
    running = false;
    if (!ensureLoaded()) return;
    note = '';
    if (!computer.stepCycle() && computer.halted) note = 'Halted.';
    refresh();
  }
  function stepInstruction() {
    running = false;
    if (!ensureLoaded()) return;
    note = '';
    if (!computer.stepInstruction() && computer.halted) note = 'Halted.';
    refresh();
  }
  function reset() {
    running = false;
    budget = 0;
    note = '';
    computer.reset();
    refresh();
  }
  function edit() {
    computer.setSource(source);
    // Until the program has run, keep memory in step with what is typed.
    if (computer.machine.cycles === 0 && computer.cpu.atBoundary && computer.ok) computer.load();
    refresh();
  }
  function pick(id: string) {
    chosen = id;
    const p = programById(id);
    source = p.source;
    if (!devices) deviceList = p.devices;
    running = false;
    computer.setSource(source);
    computer.breakpoints.clear();
    computer.load();
    note = '';
    refresh();
  }
  function toggleBreakpoint(line: number) {
    computer.toggleBreakpoint(line);
    refresh();
  }
  /** Tab inserts spaces; Escape then Tab leaves the box, so the keyboard is never trapped. */
  let escaped = false;
  function key(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      escaped = true;
      return;
    }
    if (ev.key === 'Tab' && !ev.shiftKey && !escaped && ta) {
      ev.preventDefault();
      const { selectionStart: s, selectionEnd: e } = ta;
      source = source.slice(0, s) + '    ' + source.slice(e);
      requestAnimationFrame(() => ta!.setSelectionRange(s + 4, s + 4));
      edit();
      return;
    }
    escaped = false;
  }

  const lines = $derived(source.split('\n'));
  const listing = $derived.by(() => {
    void tick;
    return lines.map((_, i) => {
      const l = computer.program.listing[i];
      const b = l?.bytes ?? [];
      return {
        addr: l?.address !== undefined && b.length ? hex2(l.address) : '',
        bytes: b.slice(0, 3).map(hex2).join(' ') + (b.length > 3 ? ' …' : ''),
        instr: computer.isInstructionLine(i + 1),
        bp: computer.breakpoints.has(i + 1),
      };
    });
  });
  const errors = $derived.by(() => {
    void tick;
    return computer.diagnostics.filter((d) => d.severity === 'error');
  });
  const errorLines = $derived(new Set(errors.map((e) => e.line)));
  const size = $derived((void tick, computer.program.size));
  const programBytes = $derived((void tick, computer.programBytes()));
  const bpAddrs = $derived((void tick, computer.breakpointAddresses()));

  const cpi = $derived(snap.steps ? (snap.cycles / snap.steps).toFixed(2) : '–');
  const phaseName = { fetch: 'Fetch', decode: 'Decode', execute: 'Execute' } as const;
  const chips = $derived.by(() => {
    if (!cur) return [];
    const out: { phase: string; done: boolean; now: boolean }[] = [];
    for (let i = 0; i < cur.of; i++) {
      out.push({ phase: i < 2 ? 'fetch' : i === 2 ? 'decode' : 'execute', done: i <= cur.index, now: i === cur.index && !cur.last });
    }
    return out;
  });
  const cellClass = (a: number) => {
    const c: string[] = [];
    if (a === snap.pc) c.push('pc');
    if (a === snap.sp && snap.sp < 0xf0) c.push('sp');
    if (a >= 0xf0) c.push('io');
    else if (a >= snap.sp) c.push('stack');
    else if (programBytes[a]) c.push('code');
    if (flashes.has(a)) c.push('flash');
    if (bpAddrs.has(a)) c.push('bp');
    return c.join(' ');
  };
</script>

<Widget {title} {subtitle} {n} {caption} kind="Computer" onreset={reset}>
  {#snippet controls()}
    {#if showPicker}
      <label class="pick ui">
        <span>Program</span>
        <select value={chosen} onchange={(e) => pick(e.currentTarget.value)}>
          {#if !CHAPTER_PROGRAMS.some((p) => p.id === chosen) && !OCTET_PROGRAMS.some((p) => p.id === chosen)}<option value={chosen}>{chosen}</option>{/if}
          <optgroup label="This chapter">
            {#each CHAPTER_PROGRAMS as p (p.id)}<option value={p.id}>{p.title}</option>{/each}
          </optgroup>
          <optgroup label="Course programs">
            {#each OCTET_PROGRAMS as p (p.id)}<option value={p.id}>{p.title}</option>{/each}
          </optgroup>
        </select>
      </label>
    {/if}
    <div class="run ui">
      <Button size="sm" variant="primary" onclick={toggleRun} disabled={snap.halted} aria-pressed={running}>{running ? 'Pause' : 'Run'}</Button>
      <Button size="sm" onclick={stepCycle} disabled={snap.halted} title="Run one clock cycle">Cycle</Button>
      <Button size="sm" onclick={stepInstruction} disabled={snap.halted} title="Run one whole instruction">Instruction</Button>
      <Button size="sm" onclick={reset} title="Reload the program and start again">Reset</Button>
    </div>
    <div class="speed">
      <Slider label="Clock" bind:value={rateIndex} min={0} max={RATES.length - 1} step={1} format={rateLabel} />
    </div>
  {/snippet}

  <div class="oc" bind:this={root}>
    <div class="main">
      <section class="code" aria-label="Assembly source and listing">
        <div class="scroll" style="--rows:{Math.max(lines.length, 8)}">
          <div class="hls" aria-hidden="true">
            {#each lines as _, i (i)}
              {#if i + 1 === snap.line && !snap.halted}<div class="hl now" style="top: calc(var(--pad) + {i} * var(--lh))"></div>{/if}
              {#if errorLines.has(i + 1)}<div class="hl err" style="top: calc(var(--pad) + {i} * var(--lh))"></div>{/if}
            {/each}
          </div>
          <div class="gutter" role="group" aria-label="Breakpoints, addresses and bytes">
            {#each listing as l, i (i)}
              <div class="gl">
                {#if l.instr}
                  <button type="button" class="bpb" class:on={l.bp} aria-pressed={l.bp} aria-label="Breakpoint on line {i + 1}" onclick={() => toggleBreakpoint(i + 1)}><span></span></button>
                {:else}<span class="bpb blank"></span>{/if}
                <span class="ad">{l.addr}</span>
                <span class="by">{l.bytes}</span>
              </div>
            {/each}
          </div>
          <textarea
            bind:this={ta}
            bind:value={source}
            oninput={edit}
            onkeydown={key}
            readonly={!isEditable}
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            wrap="off"
            aria-label="Octet assembly source"
            aria-describedby={`${instanceId}-oc-keys`}></textarea>
        </div>
        <div class="status ui" aria-live="polite">
          {#if errors.length}
            <ul class="errs">
              {#each errors.slice(0, 3) as e (e.line + ':' + e.column)}<li><b>Line {e.line}:</b> {e.message}</li>{/each}
              {#if errors.length > 3}<li>… and {errors.length - 3} more</li>{/if}
            </ul>
          {:else}
            <span><b>{size}</b> byte{size === 1 ? '' : 's'} of 240{#if snap.stale}, <span class="stale">source changed: Reset loads it</span>{/if}</span>
          {/if}
          {#if note}<span class="note">{note}</span>{/if}
        </div>
        <p id={`${instanceId}-oc-keys`} class="hint ui">
          {#if isEditable}Edit the source and the listing follows. Click a dot in the gutter for a breakpoint. Tab indents; Escape then Tab leaves the box.{:else}Click a dot in the gutter for a breakpoint.{/if}
        </p>
      </section>

      <div class="side">
        {#if show.has('registers')}
          <section class="regs" aria-label="Registers and flags">
            {#snippet reg(name: Node, value: number, dim = false)}
              <div class="reg" class:dim class:to={hot.has(name)} class:from={src === name} class:dst={dst === name}>
                <span class="rn">{name}</span>
                <span class="rv">{hex2(value)}</span>
                <span class="rd">{value}</span>
              </div>
            {/snippet}
            <div class="rows">
              {@render reg('R0', snap.r[0]!)}
              {@render reg('R1', snap.r[1]!)}
              {@render reg('R2', snap.r[2]!)}
              {@render reg('R3', snap.r[3]!)}
              {@render reg('PC', snap.pc)}
              {@render reg('SP', snap.sp)}
              {@render reg('IR', snap.ir, true)}
              {@render reg('MAR', snap.mar, true)}
              {@render reg('A', snap.a, true)}
              {@render reg('B', snap.b, true)}
              {@render reg('T', snap.t, true)}
              <div class="reg flags" class:to={hot.has('FLAGS')} aria-label="Flags Z {+snap.z} C {+snap.c} N {+snap.n} V {+snap.v}">
                <span class="rn">FLAGS</span>
                <span class="fl">
                  {#each [['Z', snap.z], ['C', snap.c], ['N', snap.n], ['V', snap.v]] as [f, on] (f)}<span class:on>{f}</span>{/each}
                </span>
              </div>
            </div>
            <p class="cap ui">R0–R3, PC, SP and the flags are the programmer’s; IR, MAR, A, B and T (dimmed) are the datapath’s own.</p>
          </section>
        {/if}

        {#if show.has('cycles')}
          <section class="cyc" aria-label="The current clock cycle">
            <div class="chips" aria-hidden="true">
              {#each chips as c, i (i)}<span class="chip {c.phase}" class:done={c.done} class:now={c.now}></span>{/each}
            </div>
            <div class="xfer" aria-live="off">
              {#if cur}
                <span class="ph {cur.phase}">{phaseName[cur.phase]}</span>
                <code>{cur.text}</code>
                {#if cur.value !== undefined}<span class="bus">bus {hex2(cur.value)}</span>{/if}
                <span class="of">cycle {cur.index + 1} of {cur.of}{cur.last ? ', instruction done' : ''}</span>
              {:else}
                <span class="of">Press Cycle to run one clock cycle.</span>
              {/if}
            </div>
            <div class="counts ui">
              <span><b>{snap.cycles}</b> cycles</span>
              <span><b>{snap.steps}</b> instructions</span>
              <span>CPI <b>{cpi}</b></span>
            </div>
          </section>
        {/if}

        {#if show.has('history')}
          <section class="hist" aria-label="Recent instructions">
            <ol>
              {#each snap.history.slice(-5) as h, i (h.address + ':' + i + ':' + snap.steps)}
                <li><span class="ad">{hex2(h.address)}</span><code>{h.text}</code><span class="cy">{h.cycles}</span></li>
              {:else}
                <li class="empty">No instruction has run yet.</li>
              {/each}
            </ol>
          </section>
        {/if}
      </div>
    </div>

    {#if deviceList.length}
      <section class="dv" aria-label="Board devices">
        <Devices {computer} {tick} show={deviceList} />
      </section>
    {/if}

    {#if show.has('memory')}
      <section class="mem" aria-label="Memory, 256 bytes">
        <div class="mgrid" role="table" aria-label="Memory contents in hexadecimal">
          <div class="mrow head" role="row">
            <span></span>
            {#each Array(16) as _, c (c)}<span role="columnheader">{c.toString(16).toUpperCase()}</span>{/each}
          </div>
          {#each Array(16) as _, r (r)}
            <div class="mrow" role="row">
              <span class="ml" role="rowheader">{(r * 16).toString(16).toUpperCase().padStart(2, '0')}</span>
              {#each Array(16) as _, c (c)}
                {@const a = r * 16 + c}
                <span class="mc {cellClass(a)}" role="cell" title="0x{hex2(a)} = {snap.mem[a]}">{hex2(snap.mem[a]!)}</span>
              {/each}
            </div>
          {/each}
        </div>
        <ul class="legend ui" aria-label="Legend">
          <li><span class="key pc"></span>PC</li>
          <li><span class="key code"></span>program</li>
          <li><span class="key stack"></span>stack (SP and above)</li>
          <li><span class="key io"></span>devices</li>
          <li><span class="key flash"></span>just written</li>
        </ul>
      </section>
    {/if}
  </div>
</Widget>

<style>
  .pick {
    display: grid;
    gap: 0.2rem;
    font-size: 0.72rem;
    color: var(--mute);
  }
  .pick select {
    height: 2rem;
    max-width: 100%;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font-family: var(--font-ui);
    font-size: 0.84rem;
    padding: 0 0.4rem;
  }
  .run {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .speed {
    flex: 1 1 11rem;
    min-width: 10rem;
    max-width: 18rem;
  }
  .oc {
    container-type: inline-size;
    display: grid;
    gap: 1rem;
    min-width: 0;
  }
  .main {
    display: grid;
    gap: 1rem;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
  }
  @container (min-width: 760px) {
    .main {
      grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    }
  }
  section {
    min-width: 0;
  }

  /* The editor. */
  .code {
    --lh: 1.45rem;
    --pad: 0.5rem;
    min-width: 0;
  }
  .scroll {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    max-height: calc(var(--lh) * 20 + var(--pad) * 2);
    overflow-y: auto;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--panel);
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .hls {
    position: absolute;
    inset: 0 0 auto 0;
    height: calc(var(--pad) * 2 + var(--lh) * var(--rows));
    pointer-events: none;
  }
  .hl {
    position: absolute;
    left: 0;
    right: 0;
    height: var(--lh);
  }
  .hl.now {
    background: var(--copper-soft);
    box-shadow: inset 3px 0 0 var(--copper);
  }
  .hl.err {
    background: var(--bad-soft);
  }
  .gutter {
    position: relative;
    padding: var(--pad) 0;
    border-right: 1px solid var(--line);
    background: color-mix(in srgb, var(--pn) 60%, transparent);
    color: var(--mute);
    user-select: none;
  }
  .gl {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    height: var(--lh);
    padding-right: 0.5rem;
    white-space: pre;
  }
  .bpb {
    flex: none;
    width: 1.2rem;
    height: var(--lh);
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .bpb span {
    width: 0.62rem;
    height: 0.62rem;
    border-radius: 50%;
    border: 1.5px solid transparent;
  }
  .bpb:hover span,
  .bpb:focus-visible span {
    border-color: var(--sig-x);
  }
  .bpb:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .bpb.on span {
    background: var(--sig-x);
    border-color: var(--sig-x);
  }
  .bpb.blank {
    cursor: default;
  }
  .ad {
    width: 1.5ch;
    color: var(--copper-ink);
    font-weight: 600;
  }
  .by {
    min-width: 8ch;
    color: var(--mute);
  }
  textarea {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    height: calc(var(--pad) * 2 + var(--lh) * var(--rows));
    margin: 0;
    padding: var(--pad) 0.7rem;
    border: 0;
    outline: 0;
    resize: none;
    background: transparent;
    color: var(--fg);
    font: inherit;
    line-height: var(--lh);
    white-space: pre;
    overflow-x: auto;
    overflow-y: hidden;
    tab-size: 4;
  }
  textarea:focus-visible {
    box-shadow: inset 0 0 0 2px var(--focus);
  }
  .status {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.3rem 1rem;
    margin-top: 0.4rem;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .status b {
    font-family: var(--font-mono);
  }
  .stale {
    color: var(--maybe);
  }
  .note {
    color: var(--copper-ink);
    font-weight: 500;
  }
  .errs {
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--bad);
  }
  .hint {
    margin: 0.2rem 0 0;
    font-size: 0.74rem;
    color: var(--mute);
  }

  /* Registers. */
  .side {
    display: grid;
    gap: 0.9rem;
    align-content: start;
    min-width: 0;
  }
  .rows {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4.4rem, 1fr));
    gap: 0.4rem;
  }
  .reg {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    align-items: baseline;
    padding: 0.28rem 0.45rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    font-family: var(--font-mono);
    transition: background-color 120ms, border-color 120ms;
  }
  .reg.dim {
    background: transparent;
    border-style: dashed;
    color: var(--ink-2);
  }
  .rn {
    grid-column: 1 / 3;
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  .rv {
    font-size: 1rem;
    font-weight: 700;
    color: var(--fg);
  }
  .reg.dim .rv {
    font-weight: 500;
  }
  .rd {
    font-size: 0.66rem;
    color: var(--mute);
  }
  .reg.to {
    border-color: var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) 16%, var(--panel));
  }
  .reg.from {
    border-color: var(--sig-current);
    box-shadow: inset 0 0 0 1px var(--sig-current);
  }
  .flags {
    grid-column: span 2;
    grid-template-columns: 1fr;
  }
  .fl {
    display: flex;
    gap: 3px;
  }
  .fl span {
    flex: 1;
    text-align: center;
    padding: 0.1rem 0;
    border-radius: 3px;
    border: 1px solid var(--line-strong);
    font-size: 0.78rem;
    color: var(--mute);
  }
  .fl span.on {
    background: var(--sig-high);
    border-color: var(--sig-high);
    color: var(--on-accent);
    font-weight: 700;
  }
  .cap {
    margin: 0.4rem 0 0;
    font-size: 0.72rem;
    color: var(--mute);
    line-height: 1.4;
  }

  /* The current cycle. */
  .cyc {
    display: grid;
    gap: 0.45rem;
    padding: 0.6rem 0.7rem;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--pn);
  }
  .chips {
    display: flex;
    gap: 3px;
  }
  .chip {
    flex: 1;
    max-width: 2.2rem;
    height: 0.5rem;
    border-radius: 2px;
    background: var(--line);
  }
  .chip.done.fetch {
    background: var(--series-1);
  }
  .chip.done.decode {
    background: var(--series-4);
  }
  .chip.done.execute {
    background: var(--series-2);
  }
  .chip.now {
    box-shadow: 0 0 0 2px var(--sig-high);
  }
  .xfer {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2rem 0.6rem;
    font-size: 0.82rem;
    min-height: 2.5rem;
  }
  .xfer code {
    font-family: var(--font-mono);
    font-size: 0.86rem;
    color: var(--fg);
    background: none;
    padding: 0;
  }
  .ph {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0.05rem 0.4rem;
    border-radius: 3px;
    border: 1px solid currentColor;
  }
  .ph.fetch {
    color: var(--series-1);
  }
  .ph.decode {
    color: var(--series-4);
  }
  .ph.execute {
    color: var(--series-2);
  }
  .bus {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--sig-current);
  }
  .of {
    font-size: 0.74rem;
    color: var(--mute);
  }
  .counts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1rem;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .counts b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .hist ol {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 2px;
    font-family: var(--font-mono);
    font-size: 0.76rem;
  }
  .hist li {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    padding: 1px 0.4rem;
    border-left: 2px solid var(--line-strong);
    color: var(--ink-2);
  }
  .hist li:last-child {
    border-left-color: var(--copper);
    color: var(--fg);
  }
  .hist code {
    flex: 1;
    background: none;
    padding: 0;
    font-size: inherit;
    color: inherit;
  }
  .hist .cy {
    color: var(--mute);
    font-size: 0.68rem;
  }
  .hist .cy::after {
    content: ' cycles';
  }
  .hist .empty {
    border-left-color: transparent;
    color: var(--mute);
  }
  .dv {
    padding-top: 0.9rem;
    border-top: 1px solid var(--line);
  }

  /* Memory. */
  .mem {
    padding-top: 0.9rem;
    border-top: 1px solid var(--line);
  }
  .mgrid {
    display: grid;
    gap: 2px;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    max-width: 36rem;
  }
  .mrow {
    display: grid;
    grid-template-columns: 1.6rem repeat(16, minmax(0, 1fr));
    gap: 2px;
    text-align: center;
  }
  .mrow.head span,
  .ml {
    color: var(--mute);
    font-size: 0.62rem;
    align-self: center;
  }
  .mc {
    padding: 0.14rem 0;
    border-radius: 3px;
    background: color-mix(in srgb, var(--line) 35%, var(--panel));
    color: var(--mute);
  }
  .mc.code {
    background: color-mix(in srgb, var(--series-1) 18%, var(--panel));
    color: var(--fg);
  }
  .mc.stack {
    background: color-mix(in srgb, var(--series-3) 14%, var(--panel));
  }
  .mc.io {
    background: color-mix(in srgb, var(--series-8) 22%, var(--panel));
    color: var(--ink-2);
  }
  .mc.pc {
    outline: 2px solid var(--copper);
    outline-offset: -1px;
    color: var(--fg);
    font-weight: 700;
  }
  .mc.sp {
    box-shadow: inset 0 -3px 0 var(--series-3);
  }
  .mc.bp {
    box-shadow: inset 0 0 0 1.5px var(--sig-x);
  }
  .mc.flash {
    background: var(--sig-high);
    color: var(--on-accent);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1rem;
    margin: 0.5rem 0 0;
    padding: 0;
    list-style: none;
    font-size: 0.72rem;
    color: var(--mute);
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .key {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 3px;
    background: color-mix(in srgb, var(--line) 35%, var(--panel));
    border: 1px solid var(--line-strong);
  }
  .key.pc {
    outline: 2px solid var(--copper);
    outline-offset: -2px;
  }
  .key.code {
    background: color-mix(in srgb, var(--series-1) 18%, var(--panel));
  }
  .key.stack {
    background: color-mix(in srgb, var(--series-3) 14%, var(--panel));
  }
  .key.io {
    background: color-mix(in srgb, var(--series-8) 22%, var(--panel));
  }
  .key.flash {
    background: var(--sig-high);
  }
  @media (prefers-reduced-motion: reduce) {
    .reg {
      transition: none;
    }
  }
</style>
