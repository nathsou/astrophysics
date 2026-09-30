<!--
  The RV32I core on the virtual board, on a vFPGA-L. The reference core (content/designs/rv32i.dcl) has no memory of its
  own; a wrapper gives it a ROM made of logic, holding the program, and the board's devices at the top of the address
  space. The program is RISC-V assembly, which the course's assembler turns into words. Because the ROM is logic, a new
  program means a new fit: about half a minute with the register file in flip-flops (as the reference has it), a few
  seconds with it in block RAM. Nothing is fitted until you press Fit.

    ::rv32-board{n="31.7" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import '$lib/studio/studio.css';
  import { FpgaSession } from '$lib/studio/fpga/session.svelte';
  import FpgaWorkspace from '$lib/studio/panes/fpga/FpgaWorkspace.svelte';
  import { assemble, type Rv32Program } from '$lib/sim/cpu/rv32i';
  import { fitReliably } from './fit';
  import { RV32_ROM_WORDS, rv32BoardSource } from './rv32-board';
  import { RV32_BOARD_PROGRAMS } from './programs';

  let { n, caption, views = 'source,chip,board,logic,report' }: { n?: string | number; caption?: string; views?: string } = $props();

  type Registers = 'flip-flops' | 'block RAM';
  const first = RV32_BOARD_PROGRAMS[0]!;
  let registers = $state<Registers>('flip-flops');
  let text = $state(first.source);
  let program = $state.raw<Rv32Program>(assemble(first.source));
  const session = new FpgaSession({ source: rv32BoardSource(assemble(first.source), 'flip-flops'), size: 'L', auto: false });
  const list = $derived(views.split(',').map((v) => v.trim()).filter(Boolean));
  const errors = $derived(program.diagnostics.filter((d) => d.severity === 'error'));
  const tooLong = $derived(program.instructions > RV32_ROM_WORDS);
  let lastSource = $state(session.source);

  function edit(next: string) {
    text = next;
    program = assemble(next);
  }

  /** Put the program and the choice of register file into the design's source. Press Fit to put it on the chip. */
  function apply() {
    if (errors.length || tooLong) return;
    session.run.pause();
    const source = rv32BoardSource(program, registers);
    lastSource = source;
    session.setSource(source);
  }

  function choose(r: Registers) {
    registers = r;
    apply();
  }

  const pending = $derived(session.source !== lastSource);
  const seconds = $derived(session.result ? (session.result.report.totalMs / 1000).toFixed(1) : '');
  const cells = $derived(session.result ? session.result.report.utilisation.cells.used.toLocaleString('en-GB') : '');

  onMount(() => {
    session.run.speed = 256;
    return () => session.destroy();
  });
</script>

<Widget {n} title="RV32I on the virtual board" kind="FPGA Studio" subtitle="a 32-bit core on a vFPGA-L" {caption} fullscreen>
  <div class="rb">
    <div class="asm ui">
      <div class="bar">
        <span class="lbl">Register file in</span>
        <Segmented size="sm" label="Where the register file lives" value={registers} onchange={choose} options={[{ value: 'flip-flops', label: 'Flip-flops', title: '32 × 32 flip-flops, as the reference design has it' }, { value: 'block RAM', label: 'Block RAM', title: 'Four block RAMs; the registers are read during the fetch cycle' }]} />
        <span class="grow"></span>
        <Button size="sm" variant="primary" onclick={() => void fitReliably(session)} disabled={session.status === 'running' || errors.length > 0 || tooLong} title={registers === 'flip-flops' ? 'About half a minute' : 'A few seconds'}>
          {session.status === 'running' ? 'Fitting…' : `Fit (${registers === 'flip-flops' ? 'about 30 s' : 'a few seconds'})`}
        </Button>
      </div>
      <div class="edit">
        <textarea
          value={text}
          oninput={(ev) => edit((ev.currentTarget as HTMLTextAreaElement).value)}
          onchange={apply}
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          rows="9"
          aria-label="RISC-V assembly"
        ></textarea>
        <div class="side">
          {#if errors.length}
            <ul class="errs" role="alert">
              {#each errors.slice(0, 4) as d (d.line + d.message)}<li><b>Line {d.line}</b> {d.message}</li>{/each}
            </ul>
          {:else if tooLong}
            <p class="errs" role="alert">{program.instructions} instructions: the ROM holds {RV32_ROM_WORDS}.</p>
          {:else}
            <p class="ok"><b>{program.instructions}</b> instructions, {program.instructions} of the ROM’s {RV32_ROM_WORDS} words.{pending ? ' Edited: the source below has it, Fit puts it on the chip.' : ''}</p>
          {/if}
          <p class="ok">The devices are where the interpreter puts them: <code>LEDS</code>, <code>SWITCHES</code>, <code>BUTTONS</code> and <code>HEX</code> at the top of memory, reached with a 12-bit offset from <code>zero</code>. The Reset button does nothing (the core has none): use Power-up.</p>
        </div>
      </div>
      <p class="state" role="status">
        {#if session.status === 'running'}
          Fitting the core on vFPGA-L: {registers === 'flip-flops' ? 'placement and routing of about 4,700 cells take about half a minute, in a worker; the page stays usable' : 'about 1,500 cells: a few seconds'}.
        {:else if session.status === 'error'}
          The fit failed: {session.error?.message}
        {:else if session.result}
          Fitted: {cells} logic cells, {session.result.report.timing.fmaxMHz.toFixed(1)} MHz, in {seconds} s.
        {:else}
          Not fitted yet. Press Fit; the board and the chip appear when it is done.
        {/if}
      </p>
    </div>
    <div class="studio compact">
      <FpgaWorkspace {session} views={list} compact autofit={false} />
    </div>
  </div>
</Widget>

<style>
  .rb {
    display: flex;
    flex-direction: column;
  }
  .asm {
    padding: 0.6rem 0.8rem 0.7rem;
    border-bottom: 1px solid var(--line-strong);
    background: var(--panel);
    font-size: 0.82rem;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.6rem;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .grow {
    flex: 1;
  }
  .lbl {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--mute);
  }
  .edit {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
    gap: 0.6rem;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    line-height: 1.35;
    tab-size: 8;
    resize: vertical;
    min-height: 9rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--fg);
    padding: 0.4rem 0.5rem;
    white-space: pre;
    overflow: auto;
  }
  textarea:focus-visible {
    outline: 2px solid var(--copper);
    outline-offset: 1px;
  }
  .side {
    min-width: 0;
  }
  .ok {
    margin: 0 0 0.4rem;
    color: var(--ink-2);
    font-size: 0.76rem;
  }
  .errs {
    margin: 0 0 0.4rem;
    padding-left: 1rem;
    color: var(--bad);
    font-size: 0.76rem;
  }
  .state {
    margin: 0.5rem 0 0;
    color: var(--ink-2);
    font-size: 0.76rem;
  }
  @media (max-width: 640px) {
    .edit {
      grid-template-columns: 1fr;
    }
  }
</style>
