<!--
  By hand: the controls next to the chip view. A goal with a live check (the decoded bits are simulated for every
  input), the logic cell under the selection (type its function, or set bits and flags), the routing multiplexer
  under the last click (choose what drives it), and the pad settings. Everything edits a `FabricConfig`.
-->
<script lang="ts">
  import { NK } from '../../../pld/devices/vfpga';
  import { describeBit, padOffset, readLc } from '../../../pld/devices/vfpga-config';
  import { LUT_NAMES, LutExpressionError, hex4, lutExpression, truthFromExpression } from '../../fpga/lut';
  import type { FpgaSession } from '../../fpga/session.svelte';
  import Icon from '../../../components/ui/Icon.svelte';
  import RecoveredView from './RecoveredView.svelte';

  let { session, recovered = true, compact = false }: { session: FpgaSession; recovered?: boolean; compact?: boolean } = $props();

  const hm = $derived(session.hand);
  const dev = $derived(hm.device);
  const goal = $derived(hm.goal);
  const check = $derived(hm.check);
  const bits = $derived(hm.bits);
  const sel = $derived(session.selected);
  const cell = $derived(sel?.kind === 'cell' ? sel : null);
  const cfg = $derived(cell ? readLc(dev, bits, cell.x, cell.y, cell.k) : null);
  const node = $derived(hm.node);
  const nodeKind = $derived(node === null ? -1 : dev.nodeKind[node]!);
  const choices = $derived(node === null ? [] : (void hm.tick, hm.hand.muxChoices(node)));
  const pad = $derived(node !== null && (nodeKind === NK.PADI || nodeKind === NK.PADO) ? dev.padAt(dev.nodeX[node]!, dev.nodeY[node]!, dev.nodeIdx[node]!) : -1);
  const padOut = $derived(pad >= 0 ? bits[padOffset(dev, pad)] === 1 : false);
  const padPull = $derived(pad >= 0 ? bits[padOffset(dev, pad) + 1] === 1 : false);
  const bitSel = $derived(sel?.kind === 'bit' ? sel.index : null);
  const bitInfo = $derived(bitSel !== null ? describeBit(dev, bitSel, bits) : null);

  let expr = $state('');
  let exprError = $state('');
  $effect(() => {
    // The box shows the function of the selected cell, unless it is being edited.
    if (cfg && document.activeElement?.id !== 'lut-expr') expr = lutExpression(cfg.lut);
  });
  function applyExpr() {
    if (!cell) return;
    try {
      const t = truthFromExpression(expr);
      exprError = '';
      hm.edit((h) => h.setLut(cell.x, cell.y, cell.k, t));
    } catch (e) {
      exprError = e instanceof LutExpressionError ? e.message : String(e);
    }
  }
  const flags = [
    ['ff', 'flip-flop'],
    ['ceEn', 'clock enable'],
    ['srEn', 'set/reset'],
    ['srVal', 'set (not reset)'],
    ['srAsync', 'asynchronous'],
    ['init', 'starts at 1'],
    ['carryChain', 'carry from previous'],
    ['i3Carry', 'I3 = carry'],
  ] as const;
  const pads = $derived(goal ? [...goal.inputs, goal.output] : []);
</script>

<div class="hand ui" class:compact>
  {#if goal}
    <section class="goal" class:done={check?.ok}>
      <h5>Goal <span class:ok={check?.ok}>{check?.ok ? 'reached' : 'not yet'}</span></h5>
      <p>{goal.text}</p>
      {#if check}
        <table class="tt" aria-label="Goal check">
          <thead><tr>{#each goal.inputs as i (i)}<th>{i}</th>{/each}<th>{goal.output} now</th><th>wanted</th><th></th></tr></thead>
          <tbody>
            {#each check.rows as r, i (i)}
              <tr class:bad={!r.ok}>
                {#each r.inputs as v, j (j)}<td>{v ? 1 : 0}</td>{/each}
                <td>{r.got === 'x' ? 'x' : r.got === 'z' ? 'Z' : r.got}</td>
                <td>{r.want ? 1 : 0}</td>
                <td>{r.ok ? '✓' : '✗'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#each check.problems as p, i (i)}<p class="prob">{p}</p>{/each}
      {/if}
      <div class="btns">
        <button type="button" class="b" onclick={() => hm.undo()} disabled={!hm.canUndo}>Undo</button>
        <button type="button" class="b" onclick={() => hm.redo()} disabled={!hm.canRedo}>Redo</button>
        <button type="button" class="b" onclick={() => hm.clear()}><Icon name="reset" size={12} /> Clear</button>
        <button type="button" class="b" onclick={() => hm.showSolution()} title="Loads a working configuration">Show a solution</button>
      </div>
      <p class="hint">{goal.hint} Pads {pads.join(', ')} are on the top edge.</p>
    </section>
  {/if}

  <section>
    <h5>Logic cell {cell ? `(${cell.x}, ${cell.y}, ${cell.k})` : ''}</h5>
    {#if cell && cfg}
      <label class="fn">
        <span>Output as a function of {LUT_NAMES.join(', ')}</span>
        <input id="lut-expr" type="text" bind:value={expr} onchange={applyExpr} onkeydown={(ev) => ev.key === 'Enter' && applyExpr()} spellcheck="false" autocomplete="off" aria-invalid={!!exprError} placeholder="I0 ^ I1" />
      </label>
      {#if exprError}<p class="prob">{exprError}</p>{/if}
      <p class="mono">truth table {hex4(cfg.lut)} · click the bits on the chip at logic-cell zoom, or type a function</p>
      <div class="flags">
        {#each flags as [key, label] (key)}
          <label><input type="checkbox" checked={!!cfg[key]} onchange={(ev) => hm.edit((h) => h.setFlag(cell.x, cell.y, cell.k, key, (ev.currentTarget as HTMLInputElement).checked))} /> {label}</label>
        {/each}
      </div>
    {:else}
      <p class="hint">Click a logic cell on the chip (zoom in to a tile) to set its truth table.</p>
    {/if}
  </section>

  <section>
    <h5>Routing {node !== null ? `· ${dev.nodeName(node)}` : ''}</h5>
    {#if node === null}
      <p class="hint">Zoom in to a tile and click a pin (a LUT input, a pad) or a wire, then choose what drives it.</p>
    {:else}
      {#if pad >= 0}
        <div class="pad">
          <strong>Pad P{pad}</strong>
          <label><input type="checkbox" checked={padOut} onchange={(ev) => hm.edit((h) => h.setPad(pad, (ev.currentTarget as HTMLInputElement).checked, padPull))} /> drives the pin (output)</label>
          <label><input type="checkbox" checked={padPull} onchange={(ev) => hm.edit((h) => h.setPad(pad, padOut, (ev.currentTarget as HTMLInputElement).checked))} /> pull-up</label>
        </div>
      {/if}
      {#if choices.length}
        <p class="mono">Driven by one of {choices.length} inputs (a multiplexer with {dev.cfgWidth[node]} select bits):</p>
        <ul class="choices">
          <li><label><input type="radio" name="mux" checked={!choices.some((c) => c.selected)} onchange={() => hm.edit((h) => h.select(node, -1))} /> nothing</label></li>
          {#each choices as c (c.node)}
            <li>
              <label>
                <input type="radio" name="mux" checked={c.selected} onchange={() => hm.edit((h) => h.select(node, c.node))} />
                <span class="code">{c.code.toString(2).padStart(dev.cfgWidth[node]!, '0')}</span>
                {c.name}
              </label>
            </li>
          {/each}
        </ul>
      {:else if pad < 0}
        <p class="hint">{dev.nodeName(node)} is an output: it has no multiplexer. Click the pin or wire it drives.</p>
      {/if}
    {/if}
  </section>

  {#if bitInfo}
    <section>
      <h5>Bit {bitSel}</h5>
      <p>{bitInfo.text}</p>
      <button type="button" class="b" onclick={() => hm.edit((h) => h.flip(bitSel!))} title="Invert this one configuration bit, as a cosmic ray would">Flip this bit</button>
    </section>
  {/if}

  {#if recovered}
    <section>
      <h5>The logic these bits make</h5>
      <RecoveredView {session} device={dev} {bits} />
    </section>
  {/if}
</div>

<style>
  .hand {
    padding: 0.5rem 0.8rem 1rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    overflow: auto;
    height: 100%;
    background: var(--panel);
  }
  section {
    margin-bottom: 0.9rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--line);
  }
  section:last-child {
    border: 0;
  }
  h5 {
    margin: 0.1rem 0 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.64rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--copper-ink);
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    overflow-wrap: anywhere;
  }
  h5 span {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    color: var(--mute);
  }
  h5 span.ok {
    color: var(--ok);
    font-weight: 700;
  }
  p {
    margin: 0.25rem 0;
  }
  .hint {
    color: var(--mute);
    font-size: 0.74rem;
  }
  .mono {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--mute);
  }
  .prob {
    color: var(--bad);
    font-size: 0.76rem;
  }
  .goal.done {
    border-left: 3px solid var(--ok);
    padding-left: 0.6rem;
  }
  .tt {
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    margin: 0.3rem 0;
  }
  .tt th,
  .tt td {
    padding: 0.12rem 0.6rem;
    text-align: center;
    border-bottom: 1px solid var(--line);
  }
  .tt tr.bad td {
    color: var(--bad);
  }
  .btns {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-top: 0.4rem;
  }
  .b {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
    font: inherit;
    font-size: 0.76rem;
    cursor: pointer;
  }
  .b:hover:not(:disabled) {
    border-color: var(--copper);
  }
  .b:disabled {
    opacity: 0.45;
  }
  .fn {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.72rem;
  }
  .fn input {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    padding: 0.25rem 0.45rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--fg);
  }
  .fn input[aria-invalid='true'] {
    border-color: var(--bad);
  }
  .flags {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.15rem 0.6rem;
    margin-top: 0.3rem;
  }
  .flags label,
  .pad label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .pad {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    margin-bottom: 0.3rem;
  }
  .choices {
    list-style: none;
    margin: 0.3rem 0 0;
    padding: 0;
    max-height: 13rem;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .choices li label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.12rem 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    cursor: pointer;
  }
  .choices li label:hover {
    background: var(--term-hl);
  }
  .code {
    color: var(--mute);
  }
</style>
