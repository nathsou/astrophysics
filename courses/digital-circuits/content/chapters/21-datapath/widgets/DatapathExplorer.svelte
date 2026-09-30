<!--
  Be the control unit. Octet's datapath, gate by gate (about 3,100 gates from the parts bin, on the digital engine),
  with a switch for every control line. Set the lines, press Clock: every register whose load line is on listens to
  the bus at that edge. Nothing here is animated by the page: the picture reads the circuit.

    ::datapath-explorer{n="21.5" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { prefersReducedMotion } from '$lib/theme/signals';
  import { defaultParts } from '$lib/partsbin/flatten';
  import { CHALLENGES, Explorer, type ExplorerLine, type ExplorerState, type LineSet, type Block } from './explorer';
  import { describe, fieldsOfLines } from '../hardware/describe';
  import { aluCode, ALU_OPS, LINE_HELP } from '../hardware/control-word';
  import DatapathDiagram from './DatapathDiagram.svelte';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  const EMPTY: ExplorerState = { r: [undefined, undefined, undefined, undefined], flags: undefined, bus: 'zzzzzzzz', contention: false };

  let ex: Explorer | undefined = $state.raw();
  let st = $state.raw<ExplorerState>(EMPTY);
  let on = $state<Record<string, boolean>>({});
  let sw = $state(0);
  let drivers = $state<Block[]>([]);
  let listeners = $state<Block[]>([]);
  let clocks = $state(0);
  let log = $state<string[]>([]);
  let challenge = $state('free');
  let keep = $state(false);
  let failed = $state<string | undefined>();
  let showing = $state(false);
  let reduced = false;

  onMount(() => {
    reduced = prefersReducedMotion();
    // Building 3,000 gates takes a moment: let the page paint first.
    const t = setTimeout(() => {
      ex = new Explorer({ level: 'parts', resolver: defaultParts });
      refresh();
    }, 30);
    return () => clearTimeout(t);
  });

  const cur = $derived(CHALLENGES.find((c) => c.id === challenge));
  const solved = $derived(cur ? cur.goal(st) : false);

  function refresh() {
    if (!ex) return;
    st = ex.state();
    on = Object.fromEntries([...ex.on].map((n) => [n, true]));
    sw = ex.switches;
    const a = ex.activity();
    drivers = a.drivers;
    listeners = a.listeners;
    clocks = ex.clocks;
  }

  const isOn = (n: string) => !!on[n];
  function flip(n: ExplorerLine) {
    if (!ex) return;
    ex.set(n, !ex.on.has(n));
    refresh();
  }
  const ALU_LINES = ['ALU_OP0', 'ALU_OP1', 'ALU_OP2', 'BSEL_A', 'BSEL_1'] as const;
  const aluOp = $derived((isOn('ALU_OP0') ? 1 : 0) | (isOn('ALU_OP1') ? 2 : 0) | (isOn('ALU_OP2') ? 4 : 0));
  const bsel = $derived(isOn('BSEL_A') ? 'A' : isOn('BSEL_1') ? 'ONE' : 'B');
  function setAlu(code: number, b: string) {
    if (!ex) return;
    const lines = Explorer.aluLines((ALU_OPS[code] as never) ?? 'ADD', b as never);
    for (const n of ALU_LINES) ex.set(n, lines[n]!);
    refresh();
  }
  function setBit(i: number) {
    if (!ex) return;
    ex.setSwitches(ex.switches ^ (1 << i));
    refresh();
  }

  const pending = $derived.by(() => {
    const { fields, drivers: d } = fieldsOfLines((n) => isOn(n));
    const usesAlu = isOn('OE_ALU') || isOn('LD_FLAGS');
    const anything = Object.entries(on).some(([k, v]) => v && !(k.startsWith('ALU_OP') || k.startsWith('BSEL')) && k !== 'OE_SW') || isOn('OE_SW');
    if (!anything && !usesAlu) return 'nothing (no line is on)';
    return describe(fields, d.length === 1 && d[0] === 'the panel' ? { source: `panel (0x${sw.toString(16).toUpperCase().padStart(2, '0')})` } : {});
  });

  const warning = $derived.by(() => {
    if (drivers.length > 1) return `Contention: ${drivers.join(' and ')} are both driving the bus. Where they disagree the wire is unknown, and real chips would fight each other, hot.`;
    const loads = listeners.filter((l) => l !== 'MEM');
    if (loads.length && drivers.length === 0) return `${loads.join(', ')} would load from a bus that nothing is driving: the value is unknown.`;
    if (isOn('MEM_WR') && drivers.length === 0) return 'The memory would store a bus that nothing is driving.';
    return '';
  });

  function clock() {
    if (!ex) return;
    const text = pending;
    ex.tick();
    if (!keep) ex.allOff();
    log = [...log.slice(-7), `${ex.clocks}. ${text}`];
    refresh();
    failed = undefined;
  }
  function clear() {
    ex?.allOff();
    refresh();
  }
  function start(id: string) {
    challenge = id;
    log = [];
    showing = false;
    if (!ex) return;
    const c = CHALLENGES.find((x) => x.id === id);
    ex.setup(c?.preset ?? {});
    refresh();
  }
  function reset() {
    start(challenge);
  }
  async function show() {
    if (!ex || !cur || showing) return;
    showing = true;
    ex.setup(cur.preset);
    log = [];
    refresh();
    for (const s of cur.solution) {
      ex.apply(s.lines);
      refresh();
      if (!reduced) await new Promise((r) => setTimeout(r, 900));
      if (!showing) return;
      ex.tick();
      ex.allOff();
      log = [...log, `${ex.clocks}. ${s.text}`];
      refresh();
      if (!reduced) await new Promise((r) => setTimeout(r, 500));
    }
    showing = false;
  }

  const OE: [ExplorerLine, string][] = [
    ['OE_RD', 'Rd'],
    ['OE_RS', 'Rs'],
    ['OE_PC', 'PC'],
    ['OE_SP', 'SP'],
    ['OE_ALU', 'ALU'],
    ['OE_MEM', 'M[MAR]'],
    ['OE_T', 'T'],
    ['OE_SW', 'panel'],
  ];
  const LD: [ExplorerLine, string][] = [
    ['LD_MAR', 'MAR'],
    ['LD_IR', 'IR'],
    ['LD_A', 'A'],
    ['LD_B', 'B'],
    ['LD_T', 'T'],
    ['WE_R', 'Rd'],
    ['LD_FLAGS', 'flags'],
    ['PC_LD', 'PC'],
    ['MEM_WR', 'M[MAR]'],
  ];
  const COUNT: [ExplorerLine, string][] = [
    ['PC_INC', 'PC + 1'],
    ['SP_INC', 'SP + 1'],
    ['SP_DEC', 'SP − 1'],
  ];
  const counting = $derived([isOn('PC_INC') ? 'PC' : '', isOn('SP_INC') ? 'SP+' : '', isOn('SP_DEC') ? 'SP−' : ''].filter(Boolean));
  const aluName = $derived(isOn('OE_ALU') || isOn('LD_FLAGS') ? `${aluOp === 0 && bsel === 'A' ? 'A+A' : aluOp === 0 && bsel === 'ONE' ? 'A+1' : ALU_OPS[aluOp]}` : ALU_OPS[aluOp] ?? '');
  const hex2 = (v: number) => v.toString(16).toUpperCase().padStart(2, '0');
</script>

<Widget title="Be the control unit" subtitle="Octet’s datapath, gate by gate: you set the control lines" {caption} n={fig} onreset={reset}>
  {#snippet controls()}
    <Segmented
      size="sm"
      label="Challenge"
      value={challenge}
      onchange={start}
      options={[
        { value: 'free', label: 'Free play' },
        ...CHALLENGES.map((c, i) => ({ value: c.id, label: `${i + 1}. ${c.title.split(' ')[0]}`, title: c.title })),
      ]}
    />
  {/snippet}

  <div class="ex">
    {#if cur}
      <div class="task ui" class:done={solved}>
        <p><b>{cur.title}.</b> {cur.task}</p>
        <p class="goal">
          Goal: {cur.goalText}. Fewest clocks: {cur.par}.
          {#if solved}<b class="ok">Solved in {clocks} clock{clocks === 1 ? '' : 's'}{clocks === cur.par ? ', which is the fewest possible' : clocks < cur.par ? '' : `; it can be done in ${cur.par}`}.</b>{/if}
        </p>
      </div>
    {/if}

    {#if !ex}
      <p class="ui wait" role="status">Powering up 3,100 gates…</p>
    {/if}
    <DatapathDiagram s={st} {drivers} {listeners} sw={ex ? sw : undefined} aluLabel={aluName} {counting} />

    <p class="read ui" role="status" aria-live="polite">
      <span class="k">Next clock edge:</span> <span class="rtl">{pending}</span>
    </p>
    {#if warning}<p class="warn ui" role="alert">{warning}</p>{/if}

    <div class="keys ui">
      <fieldset>
        <legend>Who drives the bus <span>(should be one)</span></legend>
        <div class="row">
          {#each OE as [n, t] (n)}
            <button type="button" class="key drv" aria-pressed={isOn(n)} title={LINE_HELP[n as keyof typeof LINE_HELP] ?? 'The eight front-panel switches put a byte of your choice on the bus.'} onclick={() => flip(n)} disabled={!ex}>{t}<i>{n}</i></button>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Who listens at the edge</legend>
        <div class="row">
          {#each LD as [n, t] (n)}
            <button type="button" class="key ld" aria-pressed={isOn(n)} title={LINE_HELP[n as keyof typeof LINE_HELP]} onclick={() => flip(n)} disabled={!ex}>{t}<i>{n}</i></button>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Count</legend>
        <div class="row">
          {#each COUNT as [n, t] (n)}
            <button type="button" class="key cnt" aria-pressed={isOn(n)} title={LINE_HELP[n as keyof typeof LINE_HELP]} onclick={() => flip(n)} disabled={!ex}>{t}<i>{n}</i></button>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>ALU</legend>
        <div class="row alu">
          <Segmented
            size="sm"
            label="ALU operation"
            value={aluOp}
            onchange={(c) => setAlu(c, bsel)}
            options={[0, 1, 2, 3, 4, 6, 7].map((c) => ({ value: c, label: ALU_OPS[c] as string, title: `ALU_OP = ${c}` }))}
          />
          <Segmented
            size="sm"
            label="ALU second input"
            value={bsel}
            onchange={(b) => setAlu(aluOp, b)}
            options={[
              { value: 'B', label: 'B', title: 'The B register' },
              { value: 'A', label: 'A', title: 'A again (BSEL_A): A + A is SHL' },
              { value: 'ONE', label: '1', title: 'The constant 1 (BSEL_1): A + 1 is INC' },
            ]}
          />
        </div>
      </fieldset>
      <fieldset>
        <legend>Panel switches <span>0x{hex2(sw)}</span></legend>
        <div class="row bits" role="group" aria-label="Panel switches, most significant bit first">
          {#each [7, 6, 5, 4, 3, 2, 1, 0] as i (i)}
            <button type="button" class="bit" aria-pressed={((sw >> i) & 1) === 1} aria-label="Switch {i}" onclick={() => setBit(i)} disabled={!ex}>{(sw >> i) & 1}</button>
          {/each}
        </div>
      </fieldset>
    </div>

    <div class="actions ui">
      <Button variant="primary" onclick={clock} disabled={!ex || showing}>Clock</Button>
      <Button onclick={clear} disabled={!ex || showing}>Lines off</Button>
      <Toggle label="Keep the lines after the edge" bind:checked={keep} />
      {#if cur}<Button size="sm" onclick={show} disabled={!ex || showing}>{showing ? 'Playing…' : 'Show me'}</Button>{/if}
    </div>

    {#if log.length}
      <ol class="log ui" aria-label="Micro-steps so far">
        {#each log as l, i (i)}<li>{l}</li>{/each}
      </ol>
    {/if}
  </div>
</Widget>

<style>
  .ex {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .task {
    border: 1px solid var(--line-strong);
    border-left: 4px solid var(--challenge);
    border-radius: 6px;
    padding: 0.5rem 0.8rem;
    background: var(--pn);
    font-size: 0.86rem;
  }
  .task.done {
    border-left-color: var(--ok);
    background: var(--ok-soft);
  }
  .task p {
    margin: 0.15rem 0;
  }
  .goal {
    color: var(--ink-2);
    font-size: 0.82rem;
  }
  .ok {
    color: var(--ok);
  }
  .wait {
    margin: 0;
    color: var(--mute);
    font-size: 0.84rem;
  }
  .read {
    margin: 0;
    font-size: 0.86rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--pn);
  }
  .k {
    color: var(--mute);
    margin-right: 0.3rem;
  }
  .rtl {
    font-family: var(--font-mono);
    font-weight: 600;
  }
  .warn {
    margin: 0;
    padding: 0.4rem 0.7rem;
    border-radius: 6px;
    background: var(--bad-soft);
    border: 1px solid var(--bad);
    color: var(--bad);
    font-size: 0.84rem;
  }
  .keys {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 0.6rem 0.8rem;
  }
  fieldset {
    margin: 0;
    padding: 0.35rem 0.55rem 0.55rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    min-width: 0;
  }
  legend {
    font-size: 0.76rem;
    color: var(--ink-2);
    padding: 0 0.3rem;
    font-weight: 600;
  }
  legend span {
    font-weight: 400;
    color: var(--mute);
    font-family: var(--font-mono);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .row.alu {
    gap: 0.5rem;
  }
  .key {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    min-width: 3.2rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font-family: var(--font-mono);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    line-height: 1.15;
  }
  .key i {
    font-style: normal;
    font-size: 0.58rem;
    font-weight: 400;
    color: var(--mute);
    letter-spacing: 0.02em;
  }
  .key:hover:not(:disabled) {
    border-color: var(--copper);
  }
  .key[aria-pressed='true'].drv {
    background: color-mix(in srgb, var(--sig-high) 22%, var(--panel));
    border-color: var(--sig-high);
    box-shadow: 0 0 8px var(--sig-high-glow);
  }
  .key[aria-pressed='true'].ld,
  .key[aria-pressed='true'].cnt {
    background: var(--copper-soft);
    border-color: var(--copper);
    box-shadow: 0 0 8px var(--copper-soft);
  }
  .key:disabled,
  .bit:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .bits {
    gap: 0.15rem;
    flex-wrap: nowrap;
  }
  .bit {
    width: 1.75rem;
    height: 2.1rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--sig-low);
    font-family: var(--font-mono);
    font-weight: 700;
    cursor: pointer;
  }
  .bit[aria-pressed='true'] {
    background: color-mix(in srgb, var(--sig-high) 22%, var(--panel));
    color: var(--sig-high);
    border-color: var(--sig-high);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1rem;
    align-items: center;
  }
  .log {
    margin: 0;
    padding: 0.4rem 0.8rem 0.4rem 2rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--ink-2);
    columns: 2 16rem;
  }
  .log li {
    list-style: none;
    margin-left: -1.4rem;
  }
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
