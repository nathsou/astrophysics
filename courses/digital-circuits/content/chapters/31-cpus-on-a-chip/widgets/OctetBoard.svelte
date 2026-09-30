<!--
  Octet on the virtual board, from your own assembly. The DCL Octet (designs/octet.dcl) is fitted on a vFPGA-M once. A
  program is then written in assembly, assembled to bytes, and put into the block RAMs' initial contents in the bitstream
  itself, with no new fit; the board runs the decoded bitstream. Hover a line of the source and its cells light on the
  chip, or the other way round.

    ::octet-board{n="31.4" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import '$lib/studio/studio.css';
  import { FpgaSession } from '$lib/studio/fpga/session.svelte';
  import FpgaWorkspace from '$lib/studio/panes/fpga/FpgaWorkspace.svelte';
  import { check, elaborate } from '$lib/hdl';
  import { writeYosysJson } from '$lib/pld/interchange';
  import { assemble, type OctetProgram } from '$lib/sim/cpu/octet';
  import { octetSource, withProgram } from './octet-dcl';
  import { fitReliably } from './fit';
  import { loadProgram } from './octet-fpga';
  import { OCTET_BOARD_PROGRAMS, defaultOctetProgram } from './programs';

  let { n, caption, views = 'source,chip,board,logic,bits,report' }: { n?: string | number; caption?: string; views?: string } = $props();

  const session = new FpgaSession({ source: octetSource, size: 'M', auto: false });
  const list = $derived(views.split(',').map((v) => v.trim()).filter(Boolean));

  let choice = $state(defaultOctetProgram.id);
  let text = $state(defaultOctetProgram.source);
  let program = $state.raw<OctetProgram>(assemble(defaultOctetProgram.source));
  let inChip = $state(defaultOctetProgram.title);
  let lastLoaded = $state(defaultOctetProgram.source);
  let message = $state('');
  let loadMs = $state<number | null>(null);
  let changed = $state<number | null>(null);
  let refitting = $state(false);
  let box: HTMLElement | undefined = $state();
  let terminal = $state('');

  const note = $derived(OCTET_BOARD_PROGRAMS.find((p) => p.id === choice)?.note ?? 'Your own program.');
  const errors = $derived(program.diagnostics.filter((d) => d.severity === 'error'));
  const fitted = $derived(session.result !== null && session.status !== 'running');
  const edited = $derived(fitted && !errors.length && text !== lastLoaded);
  const fitSeconds = $derived(session.result ? (session.result.report.totalMs / 1000).toFixed(1) : '');
  const listing = $derived(
    program.listing
      .filter((l) => l.bytes.length)
      .map((l) => `${(l.address ?? 0).toString(16).toUpperCase().padStart(2, '0')}  ${l.bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ').padEnd(5)}  ${l.source.trim()}`)
      .join('\n'),
  );

  function pick(id: string) {
    choice = id;
    const p = OCTET_BOARD_PROGRAMS.find((x) => x.id === id);
    if (p) edit(p.source);
  }

  function edit(next: string) {
    text = next;
    program = assemble(next);
  }

  /** The new program goes into the bitstream: no placement, no routing. */
  function load() {
    const result = session.result;
    const device = session.device;
    if (!result || !device || errors.length) return;
    if (!/module Octet\b/.test(session.fittedSource)) {
      message = 'The chip holds another design: choose Fit again to put Octet and this program on it.';
      return;
    }
    const t0 = performance.now();
    try {
      const base = /module Octet\b/.test(session.source) ? session.source : octetSource;
      const l = loadProgram(result, device, base, program);
      session.run.pause();
      session.setSource(l.source);
      session.fittedSource = l.source;
      session.result = l.result;
      session.run.load(l.result, device, l.design);
      session.run.speed = session.run.speed || 1000;
      terminal = '';
      loadMs = performance.now() - t0;
      changed = l.patch.changed;
      inChip = choice === 'custom' ? 'your program' : (OCTET_BOARD_PROGRAMS.find((p) => p.id === choice)?.title ?? 'your program');
      lastLoaded = text;
      message = '';
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
  }

  /** The slow way: the program goes into the source's table, and the whole flow runs again. */
  async function refit() {
    if (errors.length) return;
    refitting = true;
    session.run.pause();
    session.setSource(withProgram(/module Octet\b/.test(session.source) ? session.source : octetSource, program));
    inChip = choice === 'custom' ? 'your program' : (OCTET_BOARD_PROGRAMS.find((p) => p.id === choice)?.title ?? 'your program');
    lastLoaded = text;
    loadMs = null;
    changed = null;
    await fitReliably(session);
    refitting = false;
    terminal = '';
  }

  /** The design, with the program in its RAM, as the netlist that Yosys reads: for the real tools (see the lab at the end of the chapter). */
  function download() {
    try {
      const design = elaborate(check(session.source, { file: 'octet.dcl' }).program, 'Octet');
      const url = URL.createObjectURL(new Blob([writeYosysJson(design)], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'octet.json' });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
  }

  onMount(() => {
    session.run.speed = 1000;
    // The console: one byte for the one cycle in which CONSOLE is written.
    const before = session.run.onop;
    session.run.onop = (op) => {
      before?.(op);
      if (op.op === 'reset') terminal = '';
      if (op.op !== 'tick') return;
      const sim = session.run.sim;
      if (!sim || sim.output('console_write') !== 1) return;
      let byte = 0;
      for (let i = 0; i < 8; i++) byte |= (sim.output(`console[${i}]`) === 1 ? 1 : 0) << i;
      terminal = (terminal + String.fromCharCode(byte)).slice(-400);
    };
    // Fit when the figure first comes into view: a few seconds in a worker.
    let io: IntersectionObserver | undefined;
    if (box && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting) && !session.result && session.status === 'idle') {
          void fitReliably(session);
          io?.disconnect();
        }
      }, { rootMargin: '200px' });
      io.observe(box);
    } else void fitReliably(session);
    return () => {
      io?.disconnect();
      session.destroy();
    };
  });

</script>

<Widget {n} title="Octet on the virtual board" kind="FPGA Studio" subtitle="assembly → bytes → block RAM → chip" {caption} fullscreen>
  <div class="ob" bind:this={box}>
    <div class="asm ui">
      <div class="bar">
        <label class="pick">
          <span class="lbl">Program</span>
          <select value={choice} onchange={(ev) => pick((ev.currentTarget as HTMLSelectElement).value)} aria-label="Program">
            {#each OCTET_BOARD_PROGRAMS as p (p.id)}<option value={p.id}>{p.title}</option>{/each}
            {#if choice === 'custom'}<option value="custom">Your own</option>{/if}
          </select>
        </label>
        <span class="grow"></span>
        <Button size="sm" variant="primary" onclick={load} disabled={!fitted || errors.length > 0 || refitting} title="Write the program into the bitstream's block RAMs: no placement, no routing">Load into the chip</Button>
        <Button size="sm" onclick={download} disabled={session.hasErrors} title="The design and its program as a Yosys JSON netlist, for Yosys and nextpnr">Yosys netlist</Button>
        <Button size="sm" onclick={refit} disabled={!session.result || errors.length > 0 || session.status === 'running'} title="Put the program in the source's table and fit again: placement, routing, everything">Fit again</Button>
      </div>
      <p class="note">{note}</p>
      <div class="edit">
        <textarea
          value={text}
          oninput={(ev) => {
            choice = 'custom';
            edit((ev.currentTarget as HTMLTextAreaElement).value);
          }}
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          rows="9"
          aria-label="Octet assembly"
        ></textarea>
        <div class="side">
          {#if errors.length}
            <ul class="errs" role="alert">
              {#each errors.slice(0, 4) as d (d.line + d.message)}<li><b>Line {d.line}</b> {d.message}</li>{/each}
            </ul>
          {:else}
            <p class="ok"><b>{program.size}</b> byte{program.size === 1 ? '' : 's'}, assembled{edited ? ' (not in the chip yet)' : ''}.</p>
            <details>
              <summary>Bytes and listing</summary>
              <pre class="lst">{listing}</pre>
            </details>
          {/if}
        </div>
      </div>
      <p class="state" role="status">
        {#if session.status === 'running'}
          {refitting ? 'Fitting again' : 'Fitting Octet on vFPGA-M'}: placement and routing take a few seconds.
        {:else if session.status === 'error'}
          The fit failed: {session.error?.message}
        {:else if session.result}
          In the chip: <b>{inChip}</b>.
          {#if loadMs !== null && changed !== null}
            Loaded in {loadMs.toFixed(0)} ms: {changed.toLocaleString('en-GB')} configuration bits changed, all of them in the two block RAMs, and the placement and routing were kept.
          {:else}
            The fit took {fitSeconds} s.
          {/if}
        {:else}
          Scroll here and Octet will be fitted.
        {/if}
        {#if message}<span class="bad"> {message}</span>{/if}
      </p>
    </div>

    <div class="studio compact">
      <FpgaWorkspace {session} views={list} compact autofit={false} />
    </div>

    <div class="console ui" aria-live="off">
      <span class="cap">Console</span>
      <pre>{terminal || ' '}</pre>
    </div>
  </div>
</Widget>

<style>
  .ob {
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
  }
  .grow {
    flex: 1;
  }
  .pick {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .lbl {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--mute);
  }
  select {
    font: inherit;
    font-size: 0.82rem;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
    border-radius: 6px;
    padding: 0.2rem 0.4rem;
    max-width: 100%;
  }
  .note {
    margin: 0.4rem 0 0.5rem;
    color: var(--ink-2);
    font-size: 0.78rem;
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
    margin: 0 0 0.3rem;
    color: var(--ink-2);
  }
  .errs {
    margin: 0;
    padding-left: 1rem;
    color: var(--bad);
    font-size: 0.76rem;
  }
  details summary {
    cursor: pointer;
    color: var(--copper-ink);
    font-size: 0.76rem;
  }
  .lst {
    margin: 0.3rem 0 0;
    max-height: 9rem;
    overflow: auto;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    line-height: 1.3;
    color: var(--ink-2);
    white-space: pre;
  }
  .state {
    margin: 0.5rem 0 0;
    color: var(--ink-2);
    font-size: 0.76rem;
  }
  .bad {
    color: var(--bad);
  }
  .console {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    padding: 0.35rem 0.8rem;
    border-top: 1px solid var(--line-strong);
    background: var(--pn);
    min-height: 1.6rem;
  }
  .cap {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--mute);
  }
  .console pre {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--fg);
  }
  @media (max-width: 640px) {
    .edit {
      grid-template-columns: 1fr;
    }
  }
</style>
