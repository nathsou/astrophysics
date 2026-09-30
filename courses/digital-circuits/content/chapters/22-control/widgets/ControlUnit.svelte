<!--
  The control unit at work. The gate-level Octet (datapath and control unit, on the digital engine) runs a small
  program a clock cycle at a time; the control lines the control unit is asking for light up, and the datapath
  does what they say. Switch between the hardwired unit (a step counter, AND gates and OR gates) and the microcoded
  one (a ROM you can edit). Both make the same lines, cycle for cycle.

    ::control-unit{n="22.4" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import TimingDiagram from '$lib/bench/TimingDiagram.svelte';
  import { prefersReducedMotion } from '$lib/theme/signals';
  import { defaultParts } from '$lib/partsbin/flatten';
  import DatapathDiagram from '../../21-datapath/widgets/DatapathDiagram.svelte';
  import { irText } from '../../21-datapath/widgets/diagram';
  import { LINE_HELP, type ControlLine } from '../../21-datapath/hardware/control-word';
  import type { ControlKind } from '../hardware/cpu';
  import { ControlBench, PROGRAMS, STEP_LABELS, STEP_NAMES, type BenchState } from './bench';
  import { Microprogram } from './microprogram';
  import { Verifier, addDec, checkDec, type DecResult, DEC_BYTES } from './verify';
  import type { Verdict } from './verify';
  import MicrocodeTable from './MicrocodeTable.svelte';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  const NO_LINES = Object.fromEntries(
    ['OE_RD', 'OE_RS', 'OE_PC', 'OE_SP', 'OE_ALU', 'OE_MEM', 'OE_T', 'LD_MAR', 'LD_IR', 'LD_A', 'LD_B', 'LD_T', 'WE_R', 'LD_FLAGS', 'PC_LD', 'PC_INC', 'SP_INC', 'SP_DEC', 'MEM_WR', 'ALU_OP0', 'ALU_OP1', 'ALU_OP2', 'BSEL_A', 'BSEL_1', 'HALT'].map((n) => [n, 0]),
  ) as Record<ControlLine, number>;
  const EMPTY: BenchState = { r: [undefined, undefined, undefined, undefined], flags: undefined, bus: 'zzzzzzzz', contention: false, step: 0, counter: 0, halted: false, cycles: 0 };

  const COURSE = new Microprogram();

  let kind = $state<ControlKind>('hardwired');
  let bench: ControlBench | undefined = $state.raw();
  let st = $state.raw<BenchState>(EMPTY);
  let lines = $state.raw<Record<ControlLine, number>>(NO_LINES);
  let act = $state.raw<{ drivers: never[]; listeners: never[]; counting: string[] }>({ drivers: [], listeners: [], counting: [] });
  let mp = $state.raw<Microprogram>(new Microprogram());
  let programId = $state('add');
  let source = $state(PROGRAMS[0]!.source);
  let errors = $state<string[]>([]);
  let building = $state(false);
  let playing = $state(false);
  let rate = $state(4);
  let reduced = $state(false);
  let verdict = $state.raw<Verdict | undefined>();
  let romProblem = $state<string | undefined>();
  let dec = $state.raw<DecResult | undefined>();
  let decStarted = $state(false);
  let root: HTMLDivElement | undefined = $state();
  let timing: TimingDiagram | undefined = $state();
  let verifier: Verifier | undefined;
  let verifyTimer: ReturnType<typeof setTimeout> | undefined;
  const benches: Partial<Record<ControlKind, ControlBench>> = {};

  const current = $derived(PROGRAMS.find((p) => p.id === programId));

  function refresh() {
    if (!bench) return;
    st = bench.state();
    lines = bench.lines();
    act = bench.activity() as never;
    timing?.frame();
  }

  async function select(k: ControlKind) {
    kind = k;
    playing = false;
    if (!benches[k]) {
      building = true;
      await new Promise((r) => setTimeout(r, 30));
      benches[k] = new ControlBench(k, { level: 'parts', resolver: defaultParts });
    }
    building = false;
    bench = benches[k];
    if (k === 'microcoded') romProblem = bench!.applyMicroprogram(mp);
    restart();
  }

  function restart() {
    if (!bench) return;
    errors = bench.load(source);
    refresh();
  }

  function pick(id: string) {
    programId = id;
    const p = PROGRAMS.find((x) => x.id === id);
    if (p) source = p.source;
    restart();
  }

  function clock() {
    bench?.cycle();
    refresh();
  }
  function instruction() {
    bench?.instruction();
    refresh();
  }

  onMount(() => {
    reduced = prefersReducedMotion();
    void select('hardwired');
    let raf = 0;
    let visible = true;
    let last = performance.now();
    let acc = 0;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    if (root) io.observe(root);
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (playing && visible && !document.hidden && bench) {
        acc += dt * rate;
        while (acc >= 1) {
          acc -= 1;
          bench.cycle();
          if (bench.halted) {
            playing = false;
            break;
          }
        }
        refresh();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      clearTimeout(verifyTimer);
    };
  });

  // Editing the microprogram: load it into the running ROM and, a moment later, check it against the interpreter.
  function edited(next: Microprogram) {
    mp = next;
    dec = undefined;
    if (bench && kind === 'microcoded') {
      romProblem = bench.applyMicroprogram(next);
      bench.mp.routines = next.routines;
      bench.mp.assignment = next.assignment;
      refresh();
    }
    verdict = undefined;
    clearTimeout(verifyTimer);
    verifyTimer = setTimeout(verify, 250);
  }
  function verify() {
    verifier ??= new Verifier();
    const p = verifier.load(mp);
    verdict = p ? { ok: false, passed: 0, total: 0, failure: p } : verifier.regression(8);
  }
  function resetMicrocode() {
    decStarted = false;
    edited(new Microprogram());
  }
  function startDec() {
    const next = new Microprogram();
    const i = next.addRoutine('DEC', 'DEC');
    next.setField(i, 0, 'end', 0);
    next.addStep(i);
    next.setField(i, 1, 'end', 1);
    for (const b of DEC_BYTES) next.assign(b, 'DEC');
    decStarted = true;
    edited(next);
  }
  function solveDec() {
    const next = new Microprogram();
    addDec(next);
    decStarted = true;
    edited(next);
  }
  function checkTheDec() {
    verifier ??= new Verifier();
    const p = verifier.load(mp);
    dec = p ? { ok: false, failures: [p], tried: 0 } : checkDec(verifier);
  }

  const BASE_NAME = (ir: number | undefined) => (ir === undefined ? undefined : COURSE.assignment[ir]);
  const view = $derived(kind === 'microcoded' ? mp : COURSE);
  const stepText = $derived.by(() => {
    const s = st.step;
    if (s < 2) return view.routines[0]!.steps[s]!.text;
    if (s === 2) return 'decode IR';
    const name = view.assignment[st.ir ?? 0];
    return view.routine(name ?? '')?.steps[s - 3]?.text ?? 'no micro-step (the routine has ended)';
  });
  const romAddress = $derived.by(() => {
    if (kind === 'microcoded') return st.counter;
    const s = st.step;
    if (s < 3) return s;
    const name = BASE_NAME(st.ir);
    const ri = COURSE.routines.findIndex((r) => r.name === name);
    return ri < 0 ? -1 : COURSE.starts()[ri]! + (s - 3);
  });
  const spec = $derived(st.step >= 2 ? bench?.instructionCycles() : undefined);
  const chips = $derived(Math.max(3, spec ?? 3, st.step + 1));
  const word = $derived.by(() => {
    try {
      return mp.words()[st.counter] ?? 0;
    } catch {
      return 0;
    }
  });
  const hex = (v: number | undefined, w = 2) => (v === undefined ? '??' : v.toString(16).toUpperCase().padStart(w, '0'));

  const GROUPS: { title: string; lines: ControlLine[] }[] = [
    { title: 'Who drives the bus', lines: ['OE_RD', 'OE_RS', 'OE_PC', 'OE_SP', 'OE_ALU', 'OE_MEM', 'OE_T'] },
    { title: 'Who listens', lines: ['LD_MAR', 'LD_IR', 'LD_A', 'LD_B', 'LD_T', 'WE_R', 'LD_FLAGS', 'MEM_WR'] },
    { title: 'Counters', lines: ['PC_LD', 'PC_INC', 'SP_INC', 'SP_DEC'] },
    { title: 'ALU', lines: ['ALU_OP0', 'ALU_OP1', 'ALU_OP2', 'BSEL_A', 'BSEL_1'] },
  ];
  const traceNames = ['CLK', 'BUSWIN', 'OE_PC', 'OE_MEM', 'LD_MAR', 'LD_IR', 'PC_INC', 'BUS0'];
  const traces = $derived(bench ? traceNames.map((name) => ({ name, net: bench!.gate.rig.net(name) })) : []);
</script>

<Widget title="The control unit at work" subtitle="Fetch, decode, execute: which lines, in which cycle" {caption} n={fig} onreset={restart}>
  {#snippet controls()}
    <Segmented
      size="sm"
      label="Control unit"
      value={kind}
      onchange={select}
      options={[
        { value: 'hardwired', label: 'Hardwired', title: 'A step counter, AND gates and OR gates' },
        { value: 'microcoded', label: 'Microcoded', title: 'A micro-program counter and a ROM' },
      ]}
    />
    <Segmented size="sm" label="Program" value={programId} onchange={pick} options={PROGRAMS.map((p) => ({ value: p.id, label: p.title }))} />
  {/snippet}

  <div class="cu" bind:this={root}>
    {#if building || !bench}<p class="wait ui" role="status">Building the gates…</p>{/if}

    <div class="chips ui" role="group" aria-label="Cycles of the current instruction">
      {#each Array.from({ length: chips }, (_, i) => i) as i (i)}
        <span class="chip" class:now={i === st.step && !st.halted} class:past={i < st.step || (i === st.step && st.halted)} title={STEP_NAMES[i]}>{STEP_LABELS[i]}</span>
      {/each}
      <span class="who">
        {#if st.step >= 2}<b>{irText(st.ir)}</b> · {spec ?? '?'} cycles{:else}fetching the next instruction{/if}
        · cycle {st.cycles}
      </span>
    </div>
    <p class="rtl ui" role="status" aria-live="polite">
      <span class="k">{st.halted ? 'Halted:' : 'This cycle:'}</span> <b>{st.halted ? 'the sequencer has stopped, HALT is on' : stepText}</b>
    </p>

    <div class="dp"><DatapathDiagram s={st} drivers={act.drivers} listeners={act.listeners} counting={act.counting} aluLabel="" /></div>

    <div class="grid">
      <div class="side ui">
        <section aria-label="Control lines">
          <h5>Control lines <span>{Object.values(lines).filter(Boolean).length} on</span></h5>
          {#each GROUPS as g (g.title)}
            <div class="grp">
              <span class="gt">{g.title}</span>
              {#each g.lines as l (l)}<span class="line" class:on={!!lines[l]} title={LINE_HELP[l]}>{l.replace('OE_', '').replace('LD_', '').replace('_', ' ')}</span>{/each}
            </div>
          {/each}
          <div class="grp"><span class="gt">Stop</span><span class="line" class:on={!!lines.HALT} title={LINE_HELP.HALT}>HALT</span></div>
        </section>
      </div>
      <div class="side ui">
        <section aria-label="The sequencer">
          <h5>{kind === 'hardwired' ? 'Step counter and decoder' : 'Micro-program counter and ROMs'}</h5>
          {#if kind === 'hardwired'}
            <p>Step counter <b>{st.counter}</b> ({(st.counter >>> 0).toString(2).padStart(3, '0')}) makes STEP{st.counter} high. IR = <b>0x{hex(st.ir)}</b> makes the AND gate for <b>{irText(st.ir).split(' ')[0]}</b> high. Their AND, and every OR that collects it, gives the lines above.</p>
          {:else}
            <p>µPC = <b>0x{hex(st.counter)}</b> addresses the control store, whose word is <b>0x{hex(word, 6)}</b>. After the decode cycle the dispatch ROM, addressed by IR = <b>0x{hex(st.ir)}</b>, loads the µPC with <b>0x{hex(view.dispatch()[st.ir ?? 0])}</b>; the END bit sends it back to 0.</p>
          {/if}
        </section>
      </div>
    </div>

    <div class="actions ui">
      <Button variant="primary" onclick={clock} disabled={!bench || st.halted}>Clock</Button>
      <Button onclick={instruction} disabled={!bench || st.halted}>Instruction</Button>
      <Button onclick={() => (playing = !playing)} disabled={!bench || st.halted || reduced} title={reduced ? 'Automatic running is off because you asked your system for reduced motion' : undefined}>{playing ? 'Pause' : 'Run'}</Button>
      <Segmented size="sm" label="Clock rate" bind:value={rate} options={[{ value: 1, label: '1 Hz' }, { value: 4, label: '4 Hz' }, { value: 20, label: '20 Hz' }]} />
      <Button onclick={restart} disabled={!bench}>Reset</Button>
    </div>
    {#if errors.length}<p class="bad ui" role="alert">{errors.join(' · ')}</p>{/if}
    {#if current}<p class="note ui">{current.note}</p>{/if}

    <details class="ui prog">
      <summary>The program ({source.split('\n').filter((l) => l.trim()).length} lines): edit it</summary>
      <textarea bind:value={source} rows="6" spellcheck="false" aria-label="Octet assembly source"></textarea>
      <Button size="sm" onclick={restart}>Assemble and reset</Button>
    </details>

    <details class="ui prog">
      <summary>The clock cycle at the gates (CLK, the bus window, some control lines, bus bits 0)</summary>
      {#key bench}
        <TimingDiagram bind:this={timing} engine={bench?.gate.rig.engine ?? null} {traces} window={1.2e-6} live={false} rowHeight={22} label="Timing diagram of the control unit and the bus" />
      {/key}
      <p class="mute">A cycle is 200 ns here. The control lines change just after each rising edge. BUSWIN opens the bus drivers only in the second half of the cycle, when the lines have settled, and shuts them as the clock rises.</p>
    </details>

    <section class="store" aria-label="The control store">
      <h5>
        {kind === 'microcoded' ? 'The microcode ROM: edit any cell' : 'What the gates compute: the same table'}
        <span>{mp.length} of 64 words used</span>
        {#if kind === 'microcoded'}<Button size="sm" onclick={resetMicrocode}>Restore the course’s</Button>{/if}
      </h5>
      <MicrocodeTable mp={kind === 'microcoded' ? mp : COURSE} active={romAddress} editable={kind === 'microcoded'} onchange={edited} />
      {#if kind === 'microcoded'}
        {#if romProblem}<p class="bad ui" role="alert">{romProblem}</p>{/if}
        {#each mp.problems() as p (p)}<p class="warn ui">{p}</p>{/each}
        <p class="verdict ui" role="status" class:ok={verdict?.ok} class:bad={verdict && !verdict.ok}>
          {#if !verdict}Checking against the interpreter…
          {:else if verdict.ok}Still agrees with the reference interpreter, instruction by instruction, on {verdict.passed} random programs.
          {:else}{verdict.failure ?? 'Disagrees with the interpreter.'}{/if}
        </p>
        <details class="ui prog" open={decStarted}>
          <summary>Challenge: give Octet a DEC instruction, with no new hardware</summary>
          <p>Octet has no <code>DEC</code>. But every byte is an instruction, and the bytes <code>0x01</code>–<code>0x0F</code> are just aliases of HLT. Make <code>0x04</code>, <code>0x08</code> and <code>0x0C</code> run a new routine, <b>DEC R1, R2, R3</b> (the register is in bits 3–2): Rd ← Rd − 1, with the flags of <code>SUB Rd, 1</code>. The ALU can already subtract and can already use 1 as its second input.</p>
          <div class="actions">
            <Button size="sm" onclick={startDec}>Start: add an empty DEC routine</Button>
            <Button size="sm" variant="primary" onclick={checkTheDec} disabled={!decStarted}>Check it</Button>
            <Button size="sm" onclick={solveDec}>Show a solution</Button>
          </div>
          {#if dec}
            <p class="verdict" class:ok={dec.ok} class:bad={!dec.ok} role="status">
              {#if dec.ok}DEC works: all {dec.tried} cases (three registers, six values each) give the right result and flags.
              {:else}{dec.failures.length} of {dec.tried || 18} cases fail. First: {dec.failures[0]}.{/if}
            </p>
          {/if}
        </details>
      {:else}
        <p class="mute ui">Each OR gate of the hardwired unit collects the rows of this table that have its line set, and each AND gate is one row: the instruction’s AND gate and the step’s. Switch to the microcoded unit to edit the table.</p>
      {/if}
    </section>
  </div>
</Widget>

<style>
  .cu {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .wait {
    margin: 0;
    color: var(--mute);
    font-size: 0.84rem;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
  }
  .chip {
    min-width: 2.3rem;
    text-align: center;
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--mute);
    background: var(--panel);
  }
  .chip.past {
    color: var(--fg);
    background: var(--pn);
  }
  .chip.now {
    background: color-mix(in srgb, var(--sig-high) 24%, var(--panel));
    border-color: var(--sig-high);
    color: var(--fg);
    box-shadow: 0 0 8px var(--sig-high-glow);
  }
  .who {
    margin-left: 0.6rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .who b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .rtl {
    margin: 0;
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--pn);
    font-size: 0.86rem;
  }
  .rtl b {
    font-family: var(--font-mono);
  }
  .k {
    color: var(--mute);
    margin-right: 0.3rem;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    gap: 0.8rem 1.2rem;
    align-items: start;
  }
  @media (max-width: 62rem) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .dp {
    min-width: 0;
  }
  h5 {
    margin: 0 0 0.35rem;
    font-size: 0.86rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.8rem;
    align-items: center;
  }
  h5 span {
    font-weight: 400;
    color: var(--mute);
    font-size: 0.76rem;
    font-family: var(--font-mono);
  }
  .side {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .grp {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
    margin: 0.25rem 0;
  }
  .gt {
    width: 8.2rem;
    font-size: 0.72rem;
    color: var(--mute);
  }
  .line {
    padding: 0.1rem 0.4rem;
    border: 1px solid var(--line);
    border-radius: 5px;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--mute);
    background: var(--panel);
  }
  .line.on {
    background: color-mix(in srgb, var(--sig-high) 24%, var(--panel));
    border-color: var(--sig-high);
    color: var(--fg);
    font-weight: 700;
    box-shadow: 0 0 6px var(--sig-high-glow);
  }
  .side p {
    margin: 0;
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
  .side p b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.8rem;
    align-items: center;
  }
  .note {
    margin: 0;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .mute {
    color: var(--mute);
    font-size: 0.78rem;
    margin: 0.3rem 0 0;
  }
  .bad {
    margin: 0;
    color: var(--bad);
    font-size: 0.84rem;
  }
  .warn {
    margin: 0.2rem 0 0;
    color: var(--maybe);
    font-size: 0.8rem;
  }
  .verdict {
    margin: 0.4rem 0 0;
    padding: 0.4rem 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--line);
    font-size: 0.84rem;
    background: var(--pn);
  }
  .verdict.ok {
    color: var(--ok);
    border-color: var(--ok);
    background: var(--ok-soft);
  }
  .verdict.bad {
    color: var(--bad);
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .prog {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.4rem 0.8rem;
    font-size: 0.86rem;
  }
  .prog summary {
    cursor: pointer;
    font-weight: 600;
  }
  .prog p {
    margin: 0.5rem 0;
    line-height: 1.5;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    margin: 0.5rem 0;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    resize: vertical;
  }
  .store {
    min-width: 0;
  }
  button:focus-visible,
  summary:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
