<!--
  Appendix E's reference card, drawn from the ISA data in src/lib/sim/cpu/octet/spec.ts. One component, one part
  per figure so that the prose can come between them:

    ::octet-card{part="encoding"}      the shape of an instruction, with the colour key
    ::octet-card{part="registers"}     registers and flags
    ::octet-card{part="instructions"}  every instruction: encoding, bytes, cycles, flags, operation
    ::octet-card{part="conditions"}    the sixteen jump conditions, with a flag tester
    ::octet-card{part="flags"}         how each instruction group sets the flags
    ::octet-card{part="memory"}        the memory map as a diagram
    ::octet-card{part="io"}            the I/O registers
    ::octet-card{part="assembler"}     assembler syntax
    ::octet-card{part="idioms"}        how to say what Octet has no instruction for
-->
<script lang="ts">
  import '../../a-reference/widgets/appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { OCTET_ALIASES, OCTET_CONDITIONS, OCTET_INSTRUCTIONS, OCTET_IO_REGISTERS, referenceCard } from '$lib/sim/cpu/octet/spec';
  import BitBoxes from './BitBoxes.svelte';
  import { IDIOMS } from './example';
  import { FLAGS, GROUPS, REGISTERS, canonicalByte, conditionsTaken, cyclePlan, firstByteCells, hex2, memoryBlocks, rowsByGroup, secondByteCells, type Row } from './card';

  let { part = 'instructions', n }: { part?: 'encoding' | 'registers' | 'instructions' | 'conditions' | 'flags' | 'memory' | 'io' | 'assembler' | 'idioms'; n?: string | number } = $props();

  const card = referenceCard();
  const section = (id: string) => card.sections.find((s) => s.id === id)!;
  const groups = rowsByGroup();

  // Instructions
  let filter = $state<string>('all');
  let open = $state<string | null>(null);
  const shownGroups = $derived(filter === 'all' ? groups : groups.filter((g) => g.group.id === filter));
  const key = (r: Row) => r.mnemonic;

  // Conditions
  let z = $state(true);
  let c = $state(false);
  let neg = $state(false);
  let v = $state(false);
  const taken = $derived(new Map(conditionsTaken({ z, c, n: neg, v }).map((t) => [t.code, t.taken])));

  // Text with `code` spans.
  const spans = (s: string): { t: string; code: boolean }[] => s.split('`').map((t, i) => ({ t, code: i % 2 === 1 }));

  const blocks = memoryBlocks();
  const bitLabel = (i: number) => 7 - i;
</script>

{#snippet code(s: string)}{#each spans(s) as p, i (i)}{#if p.code}<code>{p.t}</code>{:else}{p.t}{/if}{/each}{/snippet}

{#if part === 'encoding'}
  <Widget title="Encoding at a glance" {n} kind="Reference" live={false} caption="Hover a box to see what it is. Every one of the 256 byte values is a valid first byte; bits an instruction does not use are ignored by the CPU and written as 0 by the assembler.">
    <div class="pad">
      <ul class="legend" aria-label="Colour key">
        <li><BitBoxes label="opcode" cells={[{ text: '1', kind: 'op' }]} /> opcode <em>oooo</em>: which of 16 operations</li>
        <li><BitBoxes label="destination" cells={[{ text: 'd', kind: 'dd' }]} /> <em>dd</em>: the register written (or the only register named)</li>
        <li><BitBoxes label="source" cells={[{ text: 's', kind: 'ss' }]} /> <em>ss</em>: the second register</li>
        <li><BitBoxes label="fixed" cells={[{ text: '1', kind: 'fixed' }]} /> fixed: part of the instruction (PUSH, POP, CALL, RET; the jump condition)</li>
        <li><BitBoxes label="ignored" cells={[{ text: '0', kind: 'ignored' }]} /> ignored: written as 0, read as anything</li>
        <li><BitBoxes label="immediate" cells={[{ text: 'i', kind: 'imm' }]} /> <em>i</em>: an 8-bit constant, in the second byte</li>
        <li><BitBoxes label="address" cells={[{ text: 'a', kind: 'addr' }]} /> <em>a</em>: an 8-bit address, in the second byte</li>
      </ul>
      <div class="examples">
        {#each ['ADD', 'LDI', 'PUSH', 'CALL', 'HLT'] as m (m)}
          {@const i = OCTET_INSTRUCTIONS.find((x) => x.mnemonic === m)!}
          <div class="ex">
            <span class="syn">{i.syntax}</span>
            <BitBoxes label="Encoding of {i.syntax}" cells={firstByteCells(i)} second={secondByteCells(i)} />
            <span class="hexv">{hex2(canonicalByte(i))} with R0{i.operands.includes('rs') || i.operands.includes('[rs]') ? ', R0' : ''}</span>
          </div>
        {/each}
        <div class="ex">
          <span class="syn">Jcc addr</span>
          <BitBoxes label="Encoding of a conditional jump" cells={firstByteCells(OCTET_INSTRUCTIONS.find((x) => x.mnemonic === 'JZ')!, true)} second={secondByteCells(OCTET_INSTRUCTIONS.find((x) => x.mnemonic === 'JZ')!)} />
          <span class="hexv">cccc = the condition</span>
        </div>
      </div>
    </div>
  </Widget>
{/if}

{#if part === 'registers'}
  <Widget title="Registers and flags" {n} kind="Reference" live={false} caption="Solid boxes are what a program can name. Dashed boxes exist only inside the hardware: the datapath of Chapter 21 uses them to move a byte per clock cycle.">
    <div class="pad regs">
      <div class="rowlabel">Programmer’s registers</div>
      <div class="regrow">
        {#each REGISTERS.filter((r) => r.visible) as r (r.name)}
          <div class="reg">
            <div class="rname">{r.name}</div>
            <div class="rbits" aria-hidden="true">{#each Array(8) as _, i (i)}<span>{bitLabel(i)}</span>{/each}</div>
          </div>
        {/each}
      </div>
      <div class="rowlabel">Flags (each one bit, written only by the ALU group)</div>
      <div class="regrow">
        {#each FLAGS as f (f.name)}
          <div class="reg flag"><div class="rname">{f.name}</div><div class="fsub">{f.title}</div></div>
        {/each}
      </div>
      <div class="rowlabel">Inside the datapath</div>
      <div class="regrow">
        {#each REGISTERS.filter((r) => !r.visible) as r (r.name)}
          <div class="reg hidden"><div class="rname">{r.name}</div></div>
        {/each}
      </div>
      <div class="table">
        <table>
          <thead><tr><th>Register</th><th>Bits</th><th>Reset</th><th>Use</th></tr></thead>
          <tbody>
            {#each REGISTERS as r (r.name)}
              <tr><th scope="row">{r.name}{#if !r.visible}<span class="tag">hardware only</span>{/if}</th><td>{r.width}</td><td>{r.reset}</td><td>{r.use}</td></tr>
            {/each}
            {#each FLAGS as f (f.name)}
              <tr><th scope="row">{f.name}</th><td>1</td><td>0</td><td><b>{f.title}.</b> {f.meaning}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </Widget>
{/if}

{#if part === 'instructions'}
  <Widget title="Instruction set" {n} kind="Reference" live={false} caption="Click a row to see its cycles: two to fetch, one to decode, then one bus transfer per execute cycle. Cycle counts are for the multi-cycle CPU of Chapter 22 (4 to 8 per instruction).">
    {#snippet controls()}
      <Segmented label="Show group" value={filter} onchange={(x) => (filter = x)} options={[{ value: 'all', label: 'All' }, ...GROUPS.map((g) => ({ value: g.id, label: g.title }))]} size="sm" />
    {/snippet}
    <div class="table pad">
      <table class="ins">
        <thead>
          <tr><th>Syntax</th><th>Encoding</th><th>Byte</th><th title="Length in bytes">Len</th><th title="Clock cycles">Clk</th><th>Flags</th><th>Operation</th></tr>
        </thead>
        {#each shownGroups as g (g.group.id)}
          <tbody>
            <tr class="grp"><th colspan="7">{g.group.title}<span>{g.group.blurb}</span></th></tr>
            {#each g.rows as r (key(r))}
              {@const isOpen = open === key(r)}
              <tr class="row" class:isOpen>
                <th scope="row" class="sy">
                  <button type="button" class="syn" aria-expanded={isOpen} onclick={() => (open = isOpen ? null : key(r))}>{r.syntax}</button>
                  <span class="sum">{r.summary}</span>
                </th>
                <td><BitBoxes label="Encoding of {r.syntax}" cells={firstByteCells(r.ins, r.generic)} second={secondByteCells(r.ins)} /></td>
                <td class="num">{r.generic ? '0xF·' : hex2(canonicalByte(r.ins))}</td>
                <td class="num">{r.ins.bytes}</td>
                <td class="num">{r.ins.cycles}</td>
                <td class="num">{r.ins.flags ? 'ZCNV' : '—'}</td>
                <td class="op">{r.operation}</td>
              </tr>
              {#if isOpen}
                <tr class="plan">
                  <td colspan="7">
                    <ol aria-label="Cycles of {r.syntax}">
                      {#each cyclePlan(r.ins) as p, i (i)}<li class={p.phase}><span class="ph">{p.phase}</span>{p.text}</li>{/each}
                    </ol>
                    {#if r.generic}<p class="ap-note">The same five cycles whether or not the jump is taken; the condition only decides whether PC takes the address or skips it.</p>{/if}
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        {/each}
      </table>
      <p class="ap-note">Aliases: {OCTET_ALIASES.filter((a) => a.alias === 'NOP').map((a) => `${a.alias} = ${a.expansion}`).join('')}; {OCTET_ALIASES.filter((a) => a.alias !== 'NOP').map((a) => `${a.alias} = ${a.expansion}`).join(', ')}.</p>
    </div>
  </Widget>
{/if}

{#if part === 'conditions'}
  <Widget title="Jump conditions" {n} kind="Reference" live={false} caption="Set the four flags and see which jumps would be taken. Bits 3–1 of the condition choose one of eight tests and bit 0 inverts it, so the hardware is an 8-to-1 multiplexer and one XOR gate.">
    {#snippet controls()}
      <fieldset class="flagset">
        <legend>Flags</legend>
        {#each [['Z', z], ['C', c], ['N', neg], ['V', v]] as [name, val] (name)}
          <label class="fl" class:on={val}>
            <input
              type="checkbox"
              checked={val as boolean}
              onchange={(e) => {
                const on = e.currentTarget.checked;
                if (name === 'Z') z = on;
                else if (name === 'C') c = on;
                else if (name === 'N') neg = on;
                else v = on;
              }}
            />
            {name}
          </label>
        {/each}
      </fieldset>
    {/snippet}
    <div class="table pad">
      <table>
        <thead><tr><th>cccc</th><th>Mnemonic</th><th>Jumps if</th><th>Meaning</th><th>Taken?</th></tr></thead>
        <tbody>
          {#each OCTET_CONDITIONS as cc (cc.code)}
            {@const yes = taken.get(cc.code)}
            <tr class:yes class:inv={cc.code % 2 === 1}>
              <td class="num"><span class="cc">{cc.code.toString(2).padStart(4, '0').slice(0, 3)}<b>{cc.code % 2}</b></span></td>
              <td class="mn">{[cc.mnemonic, ...cc.aliases].join(' / ')}</td>
              <td class="fm">{cc.formula}</td>
              <td>{cc.meaning}</td>
              <td class="tk"><span class="pill" class:pill-on={yes}>{yes ? 'jumps' : 'falls through'}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="ap-note">After <code>CMP a, b</code>: JC / JLO means <em>a &lt; b unsigned</em>, JLT means <em>a &lt; b signed</em>; JZ / JEQ means <em>a = b</em>. The bold last bit is the inversion bit.</p>
    </div>
  </Widget>
{/if}

{#if part === 'flags'}
  {@const s = section('flags')}
  <Widget title="How instructions set the flags" {n} kind="Reference" live={false} caption="r is the result, a and b the operands; a₇ is bit 7 of a. Only the ALU group writes flags, and it always writes all four; loads, moves, stack operations and jumps leave them alone.">
    <div class="table pad">
      <table>
        <thead><tr>{#each s.table!.columns as col (col)}<th>{col}</th>{/each}</tr></thead>
        <tbody>
          {#each s.table!.rows as row (row[0])}
            <tr>{#each row as cell, i (i)}{#if i === 0}<th scope="row">{cell}</th>{:else}<td>{cell}</td>{/if}{/each}</tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Widget>
{/if}

{#if part === 'memory'}
  <Widget title="Memory map" {n} kind="Reference" live={false} caption="256 bytes, one address space for program, data, stack and devices (a von Neumann machine). The block heights are not to scale: the 240 bytes of RAM would be thirty times taller than the matrix.">
    <div class="pad memmap">
      <div class="mem" role="group" aria-label="Memory map">
        {#each blocks as b (b.id)}
          <div class="mb {b.id}">
            <div class="addr top">{hex2(b.from)}</div>
            <div class="mbody">
              <div class="mtitle">{b.title}<span>{b.to - b.from + 1} bytes</span></div>
              {#if b.id === 'ram'}
                <div class="ramin">
                  <div class="prog"><span>program</span><em>grows up ↓</em></div>
                  <div class="free">free RAM: data</div>
                  <div class="stack"><span>stack</span><em>grows down ↑</em></div>
                </div>
                <p>PC starts at {hex2(0)}. SP starts at {hex2(0xf0)}, so the first PUSH writes {hex2(0xef)}.</p>
              {:else if b.id === 'matrix'}
                <div class="mx" aria-hidden="true">{#each Array(8) as _, r (r)}<span>{hex2(0xf0 + r)}<i>row {r}</i></span>{/each}</div>
                <p>{b.detail}</p>
              {:else}
                <ul class="ioreg">
                  {#each OCTET_IO_REGISTERS.slice(1) as r (r.name)}<li><code>{r.address}</code> {r.name}</li>{/each}
                </ul>
              {/if}
            </div>
            <div class="addr bottom">{hex2(b.to)}</div>
          </div>
        {/each}
      </div>
    </div>
  </Widget>
{/if}

{#if part === 'io'}
  <Widget title="I/O registers" {n} kind="Reference" live={false} caption="Reading or writing these addresses talks to the board instead of RAM. The names are predefined in the assembler: ST [LEDS], R0.">
    <div class="table pad">
      <table>
        <thead><tr><th>Address</th><th>Name</th><th>Read</th><th>Write</th></tr></thead>
        <tbody>
          {#each OCTET_IO_REGISTERS as r (r.name)}
            <tr><td class="num">{r.address}</td><th scope="row" class="mn">{r.name}</th><td>{r.read}</td><td>{r.write}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Widget>
{/if}

{#if part === 'assembler'}
  {@const s = section('assembler')}
  <Widget title="Assembler syntax" {n} kind="Reference" live={false} caption="One statement per line: an optional label, a mnemonic and its operands, an optional comment. Mnemonics and register names ignore case; labels and constants do not.">
    <div class="table pad">
      <table>
        <thead><tr>{#each s.table!.columns as col (col)}<th>{col}</th>{/each}</tr></thead>
        <tbody>
          {#each s.table!.rows as row (row[0])}
            <tr><th scope="row" class="mn"><code>{row[0]}</code></th><td>{row[1]}</td></tr>
          {/each}
        </tbody>
      </table>
      {#each s.notes ?? [] as note (note)}<p class="ap-note">{@render code(note)}</p>{/each}
    </div>
  </Widget>
{/if}

{#if part === 'idioms'}
  <Widget title="Idioms" {n} kind="Reference" live={false} caption="What to write when Octet has no instruction for it. Each snippet is assembled by the page’s tests.">
    <div class="table pad">
      <table>
        <thead><tr><th>To…</th><th>Write</th><th>Notes</th></tr></thead>
        <tbody>
          {#each IDIOMS as i (i.task)}
            <tr><th scope="row" class="plain">{i.task}</th><td><pre>{i.code}</pre></td><td>{i.note}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Widget>
{/if}

<style>
  pre {
    margin: 0 !important;
    padding: 0 !important;
    background: none !important;
    border: 0 !important;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    line-height: 1.5;
    white-space: pre;
  }
  th.plain {
    font-family: var(--font-ui);
    font-weight: 600;
    white-space: normal;
    min-width: 9rem;
  }
  .pad {
    padding: 1rem 1.1rem 1.2rem;
  }
  .table {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-family: var(--font-ui);
    font-size: 0.84rem;
  }
  th,
  td {
    text-align: left;
    vertical-align: top;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--line);
  }
  thead th {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
    white-space: nowrap;
  }
  tbody th {
    font-family: var(--font-mono);
    font-size: 0.84rem;
    text-transform: none;
    letter-spacing: 0;
    color: var(--fg);
    white-space: nowrap;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: none !important;
    border: 0 !important;
    padding: 0 !important;
  }
  .num {
    font-family: var(--font-mono);
    white-space: nowrap;
  }
  .mn {
    font-family: var(--font-mono);
    font-weight: 600;
    white-space: nowrap;
  }
  .fm {
    font-family: var(--font-mono);
    white-space: nowrap;
  }
  .tag {
    display: block;
    font-family: var(--font-ui);
    font-weight: 400;
    font-size: 0.68rem;
    color: var(--mute);
  }

  /* encoding */
  .legend {
    list-style: none;
    margin: 0 0 1rem !important;
    padding: 0 !important;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
    gap: 0.4rem 1rem;
    font-family: var(--font-ui);
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .legend li {
    margin: 0 !important;
    padding: 0 !important;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .legend li::marker {
    content: '';
  }
  .legend em {
    font-style: normal;
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .examples {
    display: grid;
    gap: 0.5rem;
  }
  .ex {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 1rem;
    padding: 0.5rem 0.7rem;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 7px;
  }
  .syn {
    min-width: 6.5rem;
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 0.86rem;
  }
  .hexv {
    font-family: var(--font-mono);
    font-size: 0.76rem;
    color: var(--mute);
  }

  /* registers */
  .rowlabel {
    margin: 0.8rem 0 0.4rem;
    font-family: var(--font-ui);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    font-weight: 600;
    color: var(--mute);
  }
  .rowlabel:first-child {
    margin-top: 0;
  }
  .regrow {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .reg {
    padding: 0.4rem 0.55rem 0.35rem;
    border: 1.5px solid var(--fg);
    border-radius: 6px;
    background: var(--panel);
    min-width: 4.6rem;
  }
  .reg.flag {
    border-color: var(--series-2);
    text-align: center;
    min-width: 5rem;
  }
  .reg.hidden {
    border-style: dashed;
    border-color: var(--mute);
    color: var(--ink-2);
    min-width: 3.6rem;
  }
  .rname {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 0.9rem;
  }
  .rbits {
    display: flex;
    gap: 1px;
    margin-top: 0.15rem;
  }
  .rbits span {
    width: 0.62rem;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.5rem;
    color: var(--mute);
    border-top: 1px solid var(--line-strong);
  }
  .fsub {
    font-family: var(--font-ui);
    font-size: 0.68rem;
    color: var(--mute);
  }
  .regs .table {
    margin-top: 1rem;
  }

  /* instruction table */
  .ins {
    min-width: 54rem;
  }
  .ins th,
  .ins td {
    padding: 0.4rem 0.45rem;
  }
  th.sy {
    white-space: normal;
    min-width: 11rem;
    max-width: 14rem;
  }
  tr.grp th {
    padding: 0.7rem 0.6rem 0.3rem;
    font-family: var(--font-display);
    font-size: 0.86rem;
    color: var(--fg);
    border-bottom: 2px solid var(--line-strong);
    white-space: normal;
  }
  tr.grp th span {
    margin-left: 0.7rem;
    font-family: var(--font-ui);
    font-weight: 400;
    font-size: 0.76rem;
    color: var(--mute);
  }
  .syn {
    background: none;
    border: 0;
    padding: 0;
    color: var(--copper-ink);
    cursor: pointer;
    text-align: left;
    text-decoration: underline dotted;
    text-underline-offset: 3px;
  }
  .row .syn {
    min-width: 0;
    font-size: 0.84rem;
  }
  tr.isOpen > * {
    background: var(--copper-soft);
  }
  .op {
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
  .sum {
    display: block;
    font-family: var(--font-ui);
    font-weight: 400;
    font-size: 0.74rem;
    line-height: 1.35;
    color: var(--mute);
    margin-top: 0.1rem;
  }
  tr.plan td {
    background: var(--pn);
  }
  tr.plan ol {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0 !important;
    padding: 0 !important;
    counter-reset: cyc;
  }
  tr.plan li {
    counter-increment: cyc;
    margin: 0 !important;
    padding: 0.25rem 0.5rem !important;
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    background: var(--panel);
    font-family: var(--font-mono);
    font-size: 0.76rem;
  }
  tr.plan li::marker {
    content: '';
  }
  tr.plan li::before {
    content: counter(cyc) '  ';
    color: var(--mute);
  }
  .ph {
    font-family: var(--font-ui);
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
    margin-right: 0.4rem;
  }
  li.fetch {
    border-left: 3px solid var(--series-1);
  }
  li.decode {
    border-left: 3px solid var(--series-4);
  }
  li.execute {
    border-left: 3px solid var(--series-3);
  }

  /* conditions */
  .flagset {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    border: 0;
    margin: 0;
    padding: 0;
  }
  .flagset legend {
    float: left;
    margin-right: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
    color: var(--mute);
    padding: 0;
    line-height: 2rem;
  }
  .fl {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.7rem;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    font-family: var(--font-mono);
    font-weight: 600;
    background: var(--panel);
    cursor: pointer;
  }
  .fl.on {
    border-color: var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) 16%, var(--panel));
  }
  tr.yes td {
    background: color-mix(in srgb, var(--sig-high) 9%, transparent);
  }
  tr.inv td:first-child {
    border-left: 3px solid var(--line-strong);
  }
  .cc b {
    color: var(--copper-ink);
  }
  .pill {
    display: inline-block;
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    font-size: 0.74rem;
    color: var(--mute);
    white-space: nowrap;
  }
  .pill-on {
    border-color: var(--sig-high);
    color: var(--fg);
    font-weight: 600;
  }

  /* memory map */
  .mem {
    display: grid;
    gap: 0;
    max-width: 34rem;
    margin: 0 auto;
    border: 2px solid var(--fg);
    border-radius: 6px;
    overflow: hidden;
  }
  .mb {
    position: relative;
    display: grid;
    grid-template-columns: 3.6rem 1fr;
    grid-template-rows: 1fr;
    border-bottom: 2px solid var(--fg);
  }
  .mb:last-child {
    border-bottom: 0;
  }
  .addr {
    position: absolute;
    left: 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--mute);
  }
  .addr.top {
    top: 0.3rem;
  }
  .addr.bottom {
    bottom: 0.3rem;
  }
  .mbody {
    grid-column: 2;
    padding: 0.6rem 0.8rem;
    border-left: 1px solid var(--line-strong);
    background: var(--panel);
  }
  .mb.matrix .mbody {
    background: color-mix(in srgb, var(--series-4) 9%, var(--panel));
  }
  .mb.io .mbody {
    background: color-mix(in srgb, var(--series-5) 10%, var(--panel));
  }
  .mtitle {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 0.95rem;
  }
  .mtitle span {
    margin-left: 0.7rem;
    font-family: var(--font-mono);
    font-weight: 400;
    font-size: 0.72rem;
    color: var(--mute);
  }
  .mbody p {
    margin: 0.35rem 0 0 !important;
    font-family: var(--font-ui);
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.45;
  }
  .ramin {
    display: grid;
    grid-template-rows: auto 3.2rem auto;
    margin-top: 0.4rem;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    overflow: hidden;
    font-family: var(--font-ui);
    font-size: 0.78rem;
  }
  .ramin > div {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.35rem 0.6rem;
  }
  .ramin em {
    font-style: normal;
    color: var(--mute);
    font-size: 0.72rem;
  }
  .prog {
    background: color-mix(in srgb, var(--series-1) 20%, var(--panel));
  }
  .stack {
    background: color-mix(in srgb, var(--series-3) 20%, var(--panel));
  }
  .free {
    justify-content: center !important;
    color: var(--mute);
    background: repeating-linear-gradient(135deg, transparent 0 8px, color-mix(in srgb, var(--mute) 12%, transparent) 8px 9px);
  }
  .mx {
    display: grid;
    gap: 1px;
    margin-top: 0.4rem;
  }
  .mx span {
    display: flex;
    justify-content: space-between;
    padding: 0 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    line-height: 1.35rem;
    background: color-mix(in srgb, var(--series-4) 14%, var(--panel));
  }
  .mx i {
    font-style: normal;
    color: var(--mute);
  }
  .ioreg {
    list-style: none;
    margin: 0.4rem 0 0 !important;
    padding: 0 !important;
    display: grid;
    gap: 1px;
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .ioreg li {
    margin: 0 !important;
    padding: 0 0.5rem !important;
    line-height: 1.6rem;
    background: color-mix(in srgb, var(--series-5) 15%, var(--panel));
  }
  .ioreg li::marker {
    content: '';
  }
  .ioreg code {
    color: var(--mute);
    margin-right: 0.6rem;
  }
</style>
