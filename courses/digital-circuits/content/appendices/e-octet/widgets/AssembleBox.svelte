<!--
  "Assemble this": Octet source in, machine code out, using the course's own two-pass assembler. Shows the
  listing (address, bytes, source line), the errors with line numbers, and, on request, what the reference
  interpreter does with the program.

    ::assemble-box{example="sum"}                       an editable box, starting from the example
    ::assemble-box{example="sum" readonly=true}          the same, read-only: a listing to read
    ::assemble-box{example="broken"}                     a program with mistakes, to see the messages
-->
<script lang="ts">
  import '../../a-reference/widgets/appendix.css';
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { OCTET_PROGRAMS } from '$lib/sim/cpu/octet/programs';
  import { BROKEN_SOURCE, SUM_SOURCE } from './example';
  import { assembleSource, byteHex, hexDump, runProgram, type RunSummary } from './run';

  let {
    example = 'sum',
    readonly = false,
    title = 'Assemble this',
    n,
    caption,
  }: { example?: string; readonly?: boolean; title?: string; n?: string | number; caption?: string } = $props();

  const START = (id: string) => (id === 'sum' ? SUM_SOURCE : id === 'broken' ? BROKEN_SOURCE : (OCTET_PROGRAMS.find((p) => p.id === id)?.source ?? SUM_SOURCE));
  const initial = untrack(() => example);
  let source = $state(START(initial));
  let result = $state<RunSummary | null>(null);

  const asm = $derived(assembleSource(source));
  const dump = $derived(hexDump(asm.program));
  const lines = $derived(source.split('\n'));
  // Listing rows keyed by source line (a line may emit no bytes).
  const byLine = $derived(new Map(asm.listing.map((l) => [l.line, l])));
  const errorsAt = $derived.by(() => {
    const m = new Map<number, string[]>();
    for (const e of asm.errors) m.set(e.line, [...(m.get(e.line) ?? []), `${e.severity === 'warning' ? 'Warning' : 'Error'}: ${e.message}`]);
    return m;
  });

  function run() {
    result = runProgram(asm.program);
  }
  $effect(() => {
    void source;
    result = null;
  });

  const choices = [{ id: 'sum', title: 'Sum 5 to 1 (the example)' }, { id: 'broken', title: 'A program with mistakes' }, ...OCTET_PROGRAMS.map((p) => ({ id: p.id, title: p.title }))];
  let chosen = $state(initial);
  function load(id: string) {
    chosen = id;
    source = START(id);
  }
  const hexs = (n: number) => '0x' + byteHex(n);
</script>

<Widget {title} {n} kind="Assembler" live={false} onreset={() => load(initial)} {caption}>
  {#snippet controls()}
    {#if !readonly}
      <label class="ap-label sel">
        <span>Program</span>
        <select class="ap-input" value={chosen} onchange={(e) => load(e.currentTarget.value)}>
          {#each choices as c (c.id)}<option value={c.id}>{c.title}</option>{/each}
        </select>
      </label>
    {/if}
    <span class="stat" aria-live="polite">
      {#if asm.ok}<b class="ap-ok">{asm.size} byte{asm.size === 1 ? '' : 's'}</b> of 240{:else}<b class="ap-bad">{asm.errors.filter((e) => e.severity === 'error').length} error{asm.errors.filter((e) => e.severity === 'error').length === 1 ? '' : 's'}</b>{/if}
    </span>
    <Button size="sm" variant="primary" onclick={run} disabled={!asm.ok}>Run it</Button>
  {/snippet}

  <div class="ab">
    {#if !readonly}
      <label class="ap-label">
        <span>Source</span>
        <textarea class="ap-input src" rows={Math.min(16, Math.max(6, lines.length + 1))} bind:value={source} spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" aria-label="Octet assembly source"></textarea>
      </label>
    {/if}

    <div class="table">
      <table class="lst">
        <thead><tr><th>Line</th><th>Address</th><th>Bytes</th><th>Source</th></tr></thead>
        <tbody>
          {#each lines as text, k (k)}
            {@const row = byLine.get(k + 1)}
            {@const errs = errorsAt.get(k + 1)}
            {#if text.trim() !== '' || row?.bytes.length}
              <tr class:err={!!errs}>
                <td class="ln">{k + 1}</td>
                <td class="ad">{row?.address !== undefined && row.bytes.length ? hexs(row.address) : ''}</td>
                <td class="by">{#if row?.bytes.length}{#each row.bytes as b, i (i)}<span>{byteHex(b)}</span>{/each}{/if}</td>
                <td class="sr"><code>{text}</code>{#if errs}{#each errs as e (e)}<div class="msg">{e}</div>{/each}{/if}</td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>

    {#if dump.length && asm.ok}
      <div class="dump" aria-label="Memory image">
        <div class="dl">Memory image</div>
        {#each dump as row (row.address)}
          <div class="dr"><span class="da">{hexs(row.address)}</span>{#each row.bytes as b, i (i)}<span class="db" class:none={b === undefined}>{b === undefined ? '··' : byteHex(b)}</span>{/each}</div>
        {/each}
      </div>
    {/if}

    {#if result}
      <div class="result" aria-live="polite">
        <div class="rl">{result.reason === 'halted' ? 'Halted' : 'Stopped after 200,000 instructions (it is still running)'} · {result.steps} instructions · {result.cycles} cycles</div>
        <div class="rg">
          {#each result.r as v, i (i)}<span><i>R{i}</i>{hexs(v)} <em>{v}</em></span>{/each}
          <span><i>PC</i>{hexs(result.pc)}</span>
          <span><i>SP</i>{hexs(result.sp)}</span>
          <span><i>ZCNV</i>{result.flags.z ? 'Z' : '·'}{result.flags.c ? 'C' : '·'}{result.flags.n ? 'N' : '·'}{result.flags.v ? 'V' : '·'}</span>
        </div>
        <div class="leds" aria-label="LEDs {result.leds.toString(2).padStart(8, '0')}">
          {#each result.leds.toString(2).padStart(8, '0').split('') as b, i (i)}<span class="led" class:on={b === '1'}></span>{/each}
          <span class="lv">LEDS {hexs(result.leds)}</span>
          <span class="lv">HEX {hexs(result.hex)}</span>
        </div>
        {#if result.console}<div class="con">Console: <code>{result.console}</code></div>{/if}
      </div>
    {/if}
  </div>
</Widget>

<style>
  .ab {
    display: grid;
    gap: 0.9rem;
    padding: 0.9rem 1.1rem 1.2rem;
  }
  .sel {
    min-width: 13rem;
  }
  .stat {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--ink-2);
    align-self: center;
  }
  .src {
    width: 100%;
    resize: vertical;
    font-size: 0.82rem;
    line-height: 1.5;
    white-space: pre;
    overflow: auto;
    tab-size: 8;
  }
  .table {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.18rem 0.6rem;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
  }
  thead th {
    font-family: var(--font-ui);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
  }
  .ln {
    color: var(--mute);
    text-align: right;
  }
  .ad {
    color: var(--copper-ink);
    white-space: nowrap;
  }
  .by span {
    display: inline-block;
    min-width: 1.5rem;
    margin-right: 0.3rem;
    padding: 0 0.2rem;
    text-align: center;
    background: color-mix(in srgb, var(--series-1) 16%, var(--panel));
    border-radius: 3px;
    font-weight: 600;
  }
  .sr code {
    white-space: pre;
    font-family: var(--font-mono);
    background: none !important;
    border: 0 !important;
    padding: 0 !important;
  }
  tr.err td {
    background: var(--bad-soft);
  }
  .msg {
    font-family: var(--font-ui);
    color: var(--bad);
    font-size: 0.8rem;
    white-space: normal;
  }
  .dump {
    padding: 0.6rem 0.8rem;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 8px;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    overflow-x: auto;
  }
  .dl {
    font-family: var(--font-ui);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
    color: var(--mute);
    margin-bottom: 0.25rem;
  }
  .dr {
    white-space: nowrap;
    line-height: 1.6;
  }
  .da {
    color: var(--copper-ink);
    margin-right: 0.8rem;
  }
  .db {
    margin-right: 0.55rem;
    font-weight: 600;
  }
  .db.none {
    color: var(--mute);
    font-weight: 400;
  }
  .result {
    padding: 0.7rem 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--panel);
    display: grid;
    gap: 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.82rem;
  }
  .rl {
    font-family: var(--font-ui);
    font-weight: 600;
    font-size: 0.86rem;
  }
  .rg {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.1rem;
  }
  .rg i {
    font-style: normal;
    color: var(--mute);
    margin-right: 0.4rem;
    font-size: 0.72rem;
  }
  .rg em {
    font-style: normal;
    color: var(--mute);
  }
  .leds {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-wrap: wrap;
  }
  .led {
    width: 0.9rem;
    height: 0.9rem;
    border-radius: 50%;
    border: 1.5px solid var(--sig-low);
  }
  .led.on {
    background: var(--sig-high);
    border-color: var(--sig-high);
    box-shadow: 0 0 6px var(--sig-high-glow);
  }
  .lv {
    margin-left: 0.7rem;
    color: var(--mute);
    font-size: 0.74rem;
  }
  .con code {
    font-family: var(--font-mono);
    white-space: pre-wrap;
  }
</style>
