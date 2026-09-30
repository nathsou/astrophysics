<!--
  The two passes of the assembler, one line at a time. Pass 1 gives every line an address and every label a value, and
  leaves a hole where an operand names a label that is defined further down; pass 2 fills the holes from the symbol table.
  The figure runs the course's real assembler and replays what each pass knew (passes.ts).

    ::assembler-passes{n="23.2" caption="…"}
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { OCTET_PROGRAMS } from '$lib/sim/cpu/octet';
  import { PASSES_SOURCE, twoPass } from './passes';

  let { n, caption, program = 'demo' }: { n?: string | number; caption?: string; program?: string } = $props();

  const CHOICES = [{ id: 'demo', title: 'Countdown', source: PASSES_SOURCE }, ...['blink', 'hello', 'fibonacci'].map((id) => ({ id, title: OCTET_PROGRAMS.find((p) => p.id === id)!.title, source: OCTET_PROGRAMS.find((p) => p.id === id)!.source }))];
  let chosen = $state(untrack(() => program));
  let k = $state(0);
  const t = $derived(twoPass(CHOICES.find((c) => c.id === chosen)?.source ?? PASSES_SOURCE));
  const L = $derived(t.rows.length);
  const phase = $derived(k <= L ? 1 : 2);
  /** Rows finished by pass 1 and by pass 2. */
  const done1 = $derived(Math.min(k, L));
  const done2 = $derived(Math.max(0, k - L));
  const hex2 = (v: number) => v.toString(16).toUpperCase().padStart(2, '0');

  const symbols = $derived(t.symbols.filter((s) => s.line <= done1));
  const current = $derived(k === 0 ? undefined : phase === 1 ? t.rows[k - 1] : t.rows[k - L - 1]);
  const status = $derived.by(() => {
    if (k === 0) return 'Pass 1 has not started. Step to read the first line.';
    if (k === 2 * L) return 'Both passes are done: every byte is known.';
    const r = current;
    if (!r) return '';
    const what = r.bytes.length ? `${r.bytes.length} byte${r.bytes.length === 1 ? '' : 's'}` : 'no bytes';
    if (phase === 1) {
      const parts: string[] = [];
      if (r.labels.length) parts.push(`${r.labels.join(', ')} is defined here: it goes into the symbol table with the address ${r.address !== undefined ? '0x' + hex2(r.address) : '?'}`);
      if (r.bytes.length) parts.push(`the line takes ${what}, so the next one starts at 0x${hex2((r.address ?? 0) + r.bytes.length)}`);
      if (r.holes.length) parts.push(`${r.refs.map((x) => x.name).join(', ')} is not in the table yet, so the operand byte stays a hole`);
      return `Pass 1, line ${r.line}: ${parts.length ? parts.join('; ') : 'nothing to assemble here'}.`;
    }
    if (r.holes.length) return `Pass 2, line ${r.line}: the symbol table says ${r.refs.map((x) => `${x.name} = 0x${hex2(x.address)}`).join(', ')}, so the operand byte is ${hex2(r.bytes[r.bytes.length - 1]!)}.`;
    if (r.bytes.length) return `Pass 2, line ${r.line}: the bytes of this line are now known: ${r.bytes.map(hex2).join(' ')}.`;
    return `Pass 2, line ${r.line}: nothing to emit.`;
  });

  function step() {
    if (k < 2 * L) k++;
  }
  function back() {
    if (k > 0) k--;
  }
  function finishPass() {
    k = k < L ? L : 2 * L;
  }
  function pick(id: string) {
    chosen = id;
    k = 0;
  }
  const rowState = (i: number) => ({
    p1: i < done1,
    p2: i < done2,
    now: (phase === 1 && k === i + 1) || (phase === 2 && k - L === i + 1),
  });
</script>

<Widget title="The assembler, in two passes" subtitle="Addresses and labels first, then the bytes" {n} {caption} kind="Assembler" onreset={() => (k = 0)}>
  {#snippet controls()}
    <label class="pick ui">
      <span>Program</span>
      <select value={chosen} onchange={(e) => pick(e.currentTarget.value)}>
        {#each CHOICES as c (c.id)}<option value={c.id}>{c.title}</option>{/each}
      </select>
    </label>
    <div class="btns ui">
      <Button size="sm" onclick={back} disabled={k === 0}>Back</Button>
      <Button size="sm" variant="primary" onclick={step} disabled={k === 2 * L}>Step</Button>
      <Button size="sm" onclick={finishPass} disabled={k === 2 * L}>Finish {k < L ? 'pass 1' : 'pass 2'}</Button>
    </div>
    <span class="ph ui" aria-live="polite">{k === 0 ? 'ready' : k === 2 * L ? 'done' : `pass ${phase}`}</span>
  {/snippet}

  <div class="ap">
    <div class="listing" role="table" aria-label="Assembly listing">
      <div class="row head ui" role="row"><span role="columnheader">addr</span><span role="columnheader">bytes</span><span role="columnheader">source</span></div>
      {#each t.rows as r, i (i)}
        {@const s = rowState(i)}
        <div class="row" class:now={s.now} class:pending={!s.p1} role="row">
          <span class="ad" role="cell">{s.p1 && r.address !== undefined ? hex2(r.address) : ''}</span>
          <span class="by" role="cell"
            >{#if s.p1}{#each r.bytes as b, j (j)}<span class="b" class:hole={!s.p2 && r.holes.includes(j)} class:filled={s.p2 && r.holes.includes(j)}>{!s.p2 && r.holes.includes(j) ? '??' : hex2(b)}</span>{/each}{/if}</span
          >
          <span class="src" role="cell">{r.source || ' '}</span>
        </div>
      {/each}
    </div>
    <aside class="sym" aria-label="Symbol table">
      <h5 class="ui">Symbol table</h5>
      <table>
        <tbody>
          {#each symbols as s (s.name)}
            <tr class:look={phase === 2 && current?.refs.some((x) => x.name === s.name)}><td>{s.name}</td><td>0x{hex2(s.address)}</td></tr>
          {:else}
            <tr class="empty"><td colspan="2">empty</td></tr>
          {/each}
        </tbody>
      </table>
      <p class="ui note">Built by pass 1; read by pass 2.</p>
    </aside>
  </div>
  <p class="status ui" aria-live="polite">{status}</p>
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
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font-size: 0.84rem;
    padding: 0 0.4rem;
  }
  .btns {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .ph {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--copper-ink);
    align-self: center;
  }
  .ap {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 11rem;
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 640px) {
    .ap {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .listing {
    display: grid;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    background: var(--panel);
  }
  .row {
    display: grid;
    grid-template-columns: 4.2ch 8.5ch minmax(max-content, 1fr);
    gap: 0.6rem;
    padding: 0 0.6rem;
    line-height: 1.5rem;
    white-space: pre;
    border-left: 3px solid transparent;
  }
  .row.head {
    font-family: var(--font-ui);
    font-size: 0.64rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
    border-bottom: 1px solid var(--line);
    background: var(--pn);
  }
  .row.now {
    background: var(--copper-soft);
    border-left-color: var(--copper);
  }
  .row.pending .src {
    color: var(--mute);
  }
  .ad {
    color: var(--copper-ink);
    font-weight: 600;
  }
  .b {
    display: inline-block;
    margin-right: 0.4ch;
  }
  .b.hole {
    color: var(--sig-x);
    font-weight: 700;
  }
  .b.filled {
    color: var(--on-accent);
    background: var(--phosphor);
    border-radius: 3px;
    padding: 0 0.3ch;
    font-weight: 700;
  }
  .sym {
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    padding: 0.5rem 0.7rem;
    background: var(--pn);
  }
  h5 {
    margin: 0 0 0.3rem !important;
    padding: 0 !important;
    border: 0 !important;
    font-size: 0.72rem !important;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  h5::before,
  h5::after {
    display: none !important;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    margin: 0 !important;
  }
  td {
    padding: 0.1rem 0.2rem !important;
    border: 0 !important;
    background: none !important;
  }
  td:last-child {
    text-align: right;
    color: var(--copper-ink);
  }
  tr.look td {
    background: var(--copper-soft) !important;
    font-weight: 700;
  }
  tr.empty td {
    color: var(--mute);
    font-style: italic;
  }
  .note {
    margin: 0.4rem 0 0;
    font-size: 0.7rem;
    color: var(--mute);
  }
  .status {
    margin: 0.7rem 0 0;
    min-height: 2.6em;
    font-size: 0.84rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
