<!--
  Boundary scan on a two-chip board. Click a net to give it a fault (open joint, short to ground, short to supply),
  then run the interconnect test: chip U1 drives a pattern through its boundary-scan cells (EXTEST), chip U2 captures
  what arrives (SAMPLE). Driven by the course's JTAG code.

    ::boundary-scan{n="27.6" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { FAULTS, FAULT_TEXT, NETS, RECV_PIN0, SEND_PIN0, idcodeHex, runInterconnectTest, type Fault, type ScanResult } from './boundary-scan';

  let { n, caption, faults: start = '' }: { n?: string | number; caption?: string; faults?: string } = $props();

  // "3:open,5:stuck0" as an initial board.
  const parse = (t: string): Fault[] => {
    const f: Fault[] = new Array<Fault>(NETS).fill('ok');
    for (const part of t.split(',').filter(Boolean)) {
      const [k, v] = part.split(':');
      if (k !== undefined && v !== undefined && FAULTS.includes(v as Fault)) f[Number(k)] = v as Fault;
    }
    return f;
  };
  // svelte-ignore state_referenced_locally
  let faults = $state<Fault[]>(parse(start));
  let result = $state.raw<ScanResult | null>(null);

  const glyph: Record<Fault, string> = { ok: '', open: 'open', stuck0: 'GND', stuck1: '+V' };
  function cycle(k: number) {
    const i = FAULTS.indexOf(faults[k]!);
    faults = faults.map((f, j) => (j === k ? FAULTS[(i + 1) % FAULTS.length]! : f));
    result = null;
  }
  function run() {
    result = runInterconnectTest(Object.fromEntries(faults.map((f, k) => [k, f])));
  }
  function reset() {
    faults = parse(start);
    result = null;
  }
  const injected = $derived(faults.flatMap((f, k) => (f === 'ok' ? [] : [k])));
</script>

<Widget {n} title="Boundary scan" subtitle="Find a broken net without touching it" {caption} onreset={reset}>
  <div class="bs ui">
    <div class="board" role="group" aria-label="Nets between chip U1 and chip U2">
      <div class="chipbox"><b>U1</b><span>drives (EXTEST)</span></div>
      <div class="nets">
        {#each faults as f, k (k)}
          <div class="net">
            <span class="pin">IO{SEND_PIN0 + k}</span>
            <button type="button" class="wire" class:open={f === 'open'} class:g={f === 'stuck0'} class:v={f === 'stuck1'} onclick={() => cycle(k)} aria-label="Net N{k}: {FAULT_TEXT[f]}. Click to change the fault." title="{FAULT_TEXT[f]}: click to change">
              <i class="l"></i><span class="g1">{glyph[f]}</span><i class="l r"></i><em>N{k}</em>
            </button>
            <span class="pin">IO{RECV_PIN0 + k}</span>
            <span class="verd" class:bad={result && result.verdicts[k] !== 'ok'} class:good={result && result.verdicts[k] === 'ok'}>
              {#if result}{result.verdicts[k]}{/if}
            </span>
          </div>
        {/each}
      </div>
      <div class="chipbox"><b>U2</b><span>captures (SAMPLE)</span></div>
    </div>

    <div class="bar">
      <button type="button" class="go" onclick={run}>Run the interconnect test</button>
      <span class="hint">{injected.length ? `Faults on ${injected.map((k) => 'N' + k).join(', ')}.` : 'The board is good. Click a net to break it.'}</span>
    </div>

    {#if result}
      <div class="res" aria-live="polite">
        <p class="sum">
          {#if result.bad.length}<b class="badt">Found {result.bad.length} faulty net{result.bad.length === 1 ? '' : 's'}: {result.bad.map((k) => 'N' + k).join(', ')}.</b>{:else}<b class="okt">All eight nets deliver every pattern.</b>{/if}
          {result.steps.length} patterns, {result.cycles.toLocaleString('en-GB')} TCK cycles on the two chips. IDCODEs read first: U1 <code>{idcodeHex(result.idcodes[0])}</code>, U2 <code>{idcodeHex(result.idcodes[1])}</code>.
        </p>
        <div class="scroll">
          <table>
            <caption class="sr">What U2 captured for each pattern U1 drove. A red cell is a bit that did not arrive.</caption>
            <thead><tr><th scope="col">pattern</th>{#each Array.from({ length: NETS }, (_, k) => k) as k (k)}<th scope="col">N{k}</th>{/each}</tr></thead>
            <tbody>
              {#each result.steps as s (s.label)}
                <tr>
                  <th scope="row">{s.label}</th>
                  {#each s.seen as v, k (k)}
                    <td class:sent1={s.sent[k] === 1} class:wrong={v !== s.sent[k]} title="sent {s.sent[k]}, captured {v}">{v}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </div>
</Widget>

<style>
  .bs {
    display: grid;
    gap: 0.7rem;
    padding: 0.9rem 1rem 1rem;
  }
  .board {
    display: grid;
    grid-template-columns: 4.6rem minmax(0, 1fr) 4.6rem;
    gap: 0.4rem;
    align-items: stretch;
  }
  .chipbox {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 0.2rem;
    text-align: center;
    border: 2px solid var(--line-strong);
    border-radius: 6px;
    background: var(--pn);
    font-size: 0.7rem;
    color: var(--mute);
    padding: 0.3rem;
  }
  .chipbox b {
    font-family: var(--font-mono);
    font-size: 1rem;
    color: var(--fg);
  }
  .nets {
    display: grid;
    gap: 3px;
  }
  .net {
    display: grid;
    grid-template-columns: 3rem minmax(0, 1fr) 3rem 5.4rem;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.72rem;
  }
  .pin {
    font-family: var(--font-mono);
    color: var(--mute);
  }
  .wire {
    position: relative;
    display: flex;
    align-items: center;
    height: 1.7rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 5px;
    cursor: pointer;
    padding: 0 0.2rem;
    color: var(--fg);
  }
  .wire:hover {
    border-color: var(--copper);
  }
  .wire .l {
    flex: 1;
    height: 3px;
    background: var(--wire);
    border-radius: 2px;
  }
  .wire .g1 {
    min-width: 2.4rem;
    text-align: center;
    font-weight: 700;
    font-family: var(--font-mono);
    font-size: 0.7rem;
  }
  .wire em {
    position: absolute;
    left: 0.5rem;
    top: -0.4rem;
    font-style: normal;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--mute);
    background: var(--panel);
    padding: 0 0.2rem;
  }
  .wire.open .l {
    background: var(--sig-z);
    background: repeating-linear-gradient(90deg, var(--sig-z) 0 4px, transparent 4px 8px);
  }
  .wire.open .g1 {
    color: var(--bad);
  }
  .wire.g .g1 {
    color: var(--sig-low);
  }
  .wire.v .g1 {
    color: var(--sig-high);
  }
  .verd {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--mute);
  }
  .verd.bad {
    color: var(--bad);
    font-weight: 700;
  }
  .verd.good {
    color: var(--ok);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }
  .go {
    padding: 0.35rem 0.9rem;
    border-radius: 7px;
    border: 1px solid var(--copper);
    background: var(--copper-soft);
    color: var(--copper-ink);
    font: inherit;
    font-size: 0.86rem;
    font-weight: 600;
    cursor: pointer;
  }
  .go:hover {
    background: var(--copper);
    color: var(--panel);
  }
  .hint {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .sum {
    margin: 0 0 0.4rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .okt {
    color: var(--ok);
  }
  .badt {
    color: var(--bad);
  }
  code {
    font-family: var(--font-mono);
    color: var(--copper-ink);
  }
  .scroll {
    max-height: 15rem;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }
  th,
  td {
    padding: 0.1rem 0.35rem;
    text-align: center;
  }
  thead th {
    position: sticky;
    top: 0;
    background: var(--pn);
    color: var(--mute);
  }
  tbody th {
    text-align: left;
    color: var(--mute);
    font-weight: 400;
    white-space: nowrap;
  }
  td {
    border-left: 1px solid var(--line);
  }
  td.sent1 {
    background: var(--maybe-soft);
  }
  td.wrong {
    background: var(--bad-soft);
    color: var(--bad);
    font-weight: 700;
    outline: 1px solid var(--bad);
    outline-offset: -1px;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @media (max-width: 560px) {
    .board {
      grid-template-columns: 2.6rem minmax(0, 1fr) 2.6rem;
    }
    .chipbox span {
      display: none;
    }
    .net {
      grid-template-columns: 2.4rem minmax(0, 1fr) 2.4rem;
    }
    .verd {
      grid-column: 1 / -1;
      margin-top: -0.2rem;
      padding-left: 2.4rem;
    }
  }
</style>
