<!--
  The control store as a table: one row per micro-instruction, one column per field of the ROM word. With
  `editable`, every cell is a switch or a menu, and each change makes a new Microprogram for the parent to load
  into the ROM. The row the machine is executing is highlighted.
-->
<script lang="ts">
  import { ALU_OPS, DRIVERS, LINE_HELP, type FieldName } from '../../21-datapath/hardware/control-word';
  import type { Microprogram } from './microprogram';

  let {
    mp,
    active = -1,
    editable = false,
    onchange,
    maxHeight = '22rem',
  }: {
    mp: Microprogram;
    /** ROM address being executed (highlighted and kept in view). */
    active?: number;
    editable?: boolean;
    onchange?: (next: Microprogram) => void;
    maxHeight?: string;
  } = $props();

  const CHIPS: { f: FieldName; t: string; title: string; group: string }[] = [
    { f: 'ldMar', t: 'MAR', title: LINE_HELP.LD_MAR, group: 'ld' },
    { f: 'ldIr', t: 'IR', title: LINE_HELP.LD_IR, group: 'ld' },
    { f: 'ldA', t: 'A', title: LINE_HELP.LD_A, group: 'ld' },
    { f: 'ldB', t: 'B', title: LINE_HELP.LD_B, group: 'ld' },
    { f: 'ldT', t: 'T', title: LINE_HELP.LD_T, group: 'ld' },
    { f: 'weR', t: 'Rd', title: LINE_HELP.WE_R, group: 'ld' },
    { f: 'ldFlags', t: 'flg', title: LINE_HELP.LD_FLAGS, group: 'ld' },
    { f: 'pcLd', t: 'PC←', title: LINE_HELP.PC_LD, group: 'cnt' },
    { f: 'pcInc', t: 'PC+', title: LINE_HELP.PC_INC, group: 'cnt' },
    { f: 'cj', t: 'CJ', title: 'Conditional jump: PC_LD if the jump condition holds, else PC_INC.', group: 'cnt' },
    { f: 'spInc', t: 'SP+', title: LINE_HELP.SP_INC, group: 'cnt' },
    { f: 'spDec', t: 'SP−', title: LINE_HELP.SP_DEC, group: 'cnt' },
    { f: 'memWr', t: 'M←', title: LINE_HELP.MEM_WR, group: 'cnt' },
    { f: 'end', t: 'END', title: 'The last micro-step of the routine: the micro-program counter goes back to the fetch.', group: 'flow' },
    { f: 'halt', t: 'HLT', title: LINE_HELP.HALT, group: 'flow' },
    { f: 'disp', t: 'DSP', title: 'Dispatch: load the micro-program counter from the dispatch ROM, addressed by IR.', group: 'flow' },
  ];

  const starts = $derived(mp.starts());
  const hex = (n: number, w = 2) => n.toString(16).toUpperCase().padStart(w, '0');
  let box: HTMLDivElement | undefined = $state();

  function edit(ri: number, si: number, f: FieldName, v: number, also: Partial<Record<FieldName, number>> = {}) {
    if (!editable) return;
    const next = mp.clone();
    next.setField(ri, si, f, v);
    for (const [k, x] of Object.entries(also)) next.setField(ri, si, k as FieldName, x);
    onchange?.(next);
  }
  function addStep(ri: number, at: number) {
    const next = mp.clone();
    next.addStep(ri, at);
    onchange?.(next);
  }
  function removeStep(ri: number, si: number) {
    const next = mp.clone();
    next.removeStep(ri, si);
    onchange?.(next);
  }
  function setBytes(ri: number, text: string) {
    const name = mp.routines[ri]!.name;
    const bytes = text
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((t) => parseInt(t.replace(/^0x/i, ''), 16))
      .filter((n) => Number.isFinite(n) && n >= 0 && n < 256);
    const next = mp.clone();
    next.assignment = next.assignment.map((n, b) => (n === name && !bytes.includes(b) ? 'HLT' : n));
    for (const b of bytes) next.assign(b, name);
    onchange?.(next);
  }
  function removeRoutine(ri: number) {
    const next = mp.clone();
    next.removeRoutine(mp.routines[ri]!.name);
    onchange?.(next);
  }
  const bytesOf = (name: string) => mp.assignment.flatMap((n, b) => (n === name ? [b] : []));

  // Keep the executing row in view, inside the box only (never scroll the page).
  $effect(() => {
    const a = active;
    if (a < 0 || !box) return;
    const row = box.querySelector<HTMLElement>(`[data-addr="${a}"]`);
    if (!row) return;
    const top = row.offsetTop;
    if (top < box.scrollTop + 40 || top > box.scrollTop + box.clientHeight - 40) box.scrollTop = Math.max(0, top - box.clientHeight / 2);
  });
</script>

<div class="mt ui" bind:this={box} style:max-height={maxHeight} tabindex="-1">
  <table>
    <thead>
      <tr>
        <th class="addr">ROM</th>
        <th class="drv" title="Which block puts its value on the bus in this micro-step">bus driver</th>
        {#each CHIPS as c (c.f)}<th class="chip {c.group}" title={c.title}>{c.t}</th>{/each}
        <th class="sel" title="The ALU operation (used when the ALU drives the bus or the flags load)">ALU op</th>
        <th class="sel" title="The ALU's second input">2nd in</th>
        <th class="txt">what it does</th>
      </tr>
    </thead>
    <tbody>
      {#each mp.routines as r, ri (r.name)}
        <tr class="head">
          <th colspan={CHIPS.length + 5}>
            <span class="rn">{r.name === 'Jcc' ? 'Jcc (all 16 conditions)' : r.name}</span>
            {#if r.custom && editable}
              <label class="bytes">runs for bytes
                <input type="text" value={bytesOf(r.name).map((b) => '0x' + hex(b)).join(' ')} onchange={(e) => setBytes(ri, e.currentTarget.value)} size="14" aria-label="First bytes that run {r.name}, in hexadecimal" />
              </label>
              <button type="button" class="mini" onclick={() => removeRoutine(ri)}>delete routine</button>
            {:else if r.custom}
              <span class="bytes">bytes {bytesOf(r.name).map((b) => '0x' + hex(b)).join(' ')}</span>
            {/if}
            {#if r.custom && editable}<button type="button" class="mini" onclick={() => addStep(ri, r.steps.length)}>+ step</button>{/if}
          </th>
        </tr>
        {#each r.steps as s, si (si)}
          {@const addr = starts[ri]! + si}
          <tr class:on={addr === active} data-addr={addr}>
            <td class="addr">{hex(addr)}</td>
            <td class="drv">
              {#if editable}
                <select value={s.fields.drive} onchange={(e) => edit(ri, si, 'drive', Number(e.currentTarget.value))} aria-label="Bus driver at ROM address {hex(addr)}">
                  {#each DRIVERS as d, k (d)}<option value={k}>{d === 'none' ? '—' : d === 'MEM' ? 'M[MAR]' : d}</option>{/each}
                </select>
              {:else}<span class:mute={s.fields.drive === 0}>{s.fields.drive === 0 ? '—' : DRIVERS[s.fields.drive] === 'MEM' ? 'M[MAR]' : DRIVERS[s.fields.drive]}</span>{/if}
            </td>
            {#each CHIPS as c (c.f)}
              {@const v = s.fields[c.f]}
              <td class="chip {c.group}">
                {#if editable}
                  <button type="button" class="c" class:on={v === 1} aria-pressed={v === 1} title={c.title} aria-label="{c.t} at ROM address {hex(addr)}" onclick={() => edit(ri, si, c.f, v ? 0 : 1)}>{v ? 1 : 0}</button>
                {:else}<span class="c ro" class:on={v === 1}>{v ? 1 : '·'}</span>{/if}
              </td>
            {/each}
            <td class="sel">
              {#if editable}
                <select value={s.fields.aluOp} onchange={(e) => edit(ri, si, 'aluOp', Number(e.currentTarget.value))} aria-label="ALU operation at ROM address {hex(addr)}">
                  {#each ALU_OPS as o, k (k)}{#if o !== '–'}<option value={k}>{o}</option>{/if}{/each}
                </select>
              {:else}<span class:mute={!(s.fields.drive === 5 || s.fields.ldFlags)}>{s.fields.drive === 5 || s.fields.ldFlags ? ALU_OPS[s.fields.aluOp] : '·'}</span>{/if}
            </td>
            <td class="sel">
              {#if editable}
                <select value={s.fields.bselA ? 'A' : s.fields.bsel1 ? '1' : 'B'} onchange={(e) => { const v = e.currentTarget.value; edit(ri, si, 'bselA', v === 'A' ? 1 : 0, { bsel1: v === '1' ? 1 : 0 }); }} aria-label="ALU second input at ROM address {hex(addr)}">
                  <option value="B">B</option>
                  <option value="A">A</option>
                  <option value="1">1</option>
                </select>
              {:else}<span class:mute={!(s.fields.bselA || s.fields.bsel1)}>{s.fields.bselA ? 'A' : s.fields.bsel1 ? '1' : '·'}</span>{/if}
            </td>
            <td class="txt">
              {s.text}
              {#if r.custom && editable && r.steps.length > 1}<button type="button" class="mini x" onclick={() => removeStep(ri, si)} aria-label="Delete this step">×</button>{/if}
            </td>
          </tr>
        {/each}
      {/each}
    </tbody>
  </table>
</div>

<style>
  .mt {
    overflow: auto;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--panel);
    font-size: 0.74rem;
  }
  table {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    min-width: 62rem;
  }
  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--pn);
    border-bottom: 1px solid var(--line-strong);
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 0.66rem;
    color: var(--mute);
    padding: 0.3rem 0.1rem;
  }
  th.txt,
  td.txt {
    text-align: left;
    padding-left: 0.6rem;
    white-space: nowrap;
  }
  tr.head th {
    text-align: left;
    padding: 0.3rem 0.5rem;
    background: color-mix(in srgb, var(--copper) 9%, var(--panel));
    border-top: 1px solid var(--line);
    font-weight: 600;
    color: var(--copper-ink);
    font-family: var(--font-ui);
    font-size: 0.78rem;
  }
  .bytes {
    margin-left: 0.8rem;
    font-weight: 400;
    color: var(--ink-2);
    font-size: 0.74rem;
  }
  .bytes input {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    padding: 0.1rem 0.3rem;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: var(--panel);
    color: var(--fg);
  }
  td {
    padding: 0.12rem 0.08rem;
    text-align: center;
    border-bottom: 1px solid var(--line);
  }
  td.addr,
  th.addr {
    width: 2.4rem;
    font-family: var(--font-mono);
    color: var(--mute);
    position: sticky;
    left: 0;
    background: var(--panel);
    z-index: 1;
  }
  thead th.addr {
    z-index: 3;
    background: var(--pn);
  }
  tr.on td {
    background: var(--copper-soft);
  }
  tr.on td.addr {
    background: color-mix(in srgb, var(--copper) 25%, var(--panel));
    color: var(--copper-ink);
    font-weight: 700;
  }
  td.drv,
  th.drv {
    width: 5rem;
    font-family: var(--font-mono);
  }
  td.chip,
  th.chip {
    width: 2.15rem;
  }
  .chip.ld {
    background: color-mix(in srgb, var(--series-1) 5%, transparent);
  }
  .chip.cnt {
    background: color-mix(in srgb, var(--series-3) 5%, transparent);
  }
  .chip.flow {
    background: color-mix(in srgb, var(--series-4) 6%, transparent);
  }
  .c {
    width: 1.75rem;
    height: 1.5rem;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--panel);
    color: var(--mute);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    padding: 0;
    cursor: pointer;
  }
  .c.ro {
    display: inline-block;
    line-height: 1.5rem;
    border-color: transparent;
    background: transparent;
    cursor: default;
  }
  .c.on {
    background: color-mix(in srgb, var(--sig-high) 24%, var(--panel));
    color: var(--sig-high);
    border-color: var(--sig-high);
    font-weight: 700;
  }
  .c.ro.on {
    background: transparent;
    border-color: transparent;
  }
  button.c:hover {
    border-color: var(--copper);
  }
  td.sel,
  th.sel {
    width: 4.2rem;
    font-family: var(--font-mono);
  }
  select {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--panel);
    color: var(--fg);
    padding: 0.1rem 0.15rem;
    max-width: 100%;
  }
  .mute {
    color: var(--mute);
  }
  .mini {
    margin-left: 0.5rem;
    font-size: 0.7rem;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: var(--panel);
    color: var(--ink-2);
    padding: 0.05rem 0.4rem;
    cursor: pointer;
  }
  .mini.x {
    margin-left: 0.4rem;
  }
  button:focus-visible,
  select:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
</style>
