<!--
  The gate compiler: type a Boolean expression and get the transistors of the static CMOS gate that computes
  it: the pull-down network of nMOS transistors, its dual pull-up network of pMOS transistors, the count, and
  a check of every input row on the switch-level engine. The drawing is the one the abstraction dial uses; the
  toggles on its left are live, and so are the rows of the truth table (click one to set the inputs to it).

    ::gate-compiler{n="9.5" initial="!(A*(B+C))" caption="…"}
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Schematic from '$lib/bench/Schematic.svelte';
  import { buildModel } from '$lib/bench/model';
  import { conduction } from '$lib/bench/dial';
  import { flatten } from '$lib/sim/netlist/flatten';
  import { createSwitchEngine, type SwitchEngine } from '$lib/sim/switch';
  import type { Circuit, ParamValue } from '$lib/sim/netlist/types';
  import { transistorsOf } from '$lib/sim/expand/cells';
  import { compile, ExprError, rows, show, showNet, signalLabel, totalWidth, widths, gateSignals, type Compiled } from './compiler';
  import { gateCircuit, mainStageConduction, verify } from './gate';

  let {
    n,
    caption,
    initial = '!(A*(B+C))',
    title = 'Gate compiler',
  }: { n?: string | number; caption?: string; initial?: string; title?: string } = $props();

  const PRESETS: { label: string; src: string; hint: string }[] = [
    { label: 'NOT', src: '!A', hint: 'The inverter' },
    { label: 'NAND', src: '!(A*B)', hint: 'Two inputs, series pull-down' },
    { label: 'NOR', src: '!(A+B)', hint: 'Two inputs, parallel pull-down' },
    { label: 'AOI', src: '!(A*B+C)', hint: 'And-or-invert: a complex gate' },
    { label: '¬(A·(B+C))', src: '!(A*(B+C))', hint: 'The chapter’s example' },
    { label: 'AND', src: 'A*B', hint: 'Not inverting: needs two stages' },
    { label: 'XOR', src: 'A^B', hint: 'Needs A′ and B′ as well' },
    { label: 'Carry', src: '!(A*B + C*(A+B))', hint: 'The carry of a full adder, inverted' },
  ];

  const KEYS = [
    { s: '¬', t: 'NOT' },
    { s: '·', t: 'AND' },
    { s: '+', t: 'OR' },
    { s: '⊕', t: 'XOR' },
    { s: '(', t: 'Open bracket' },
    { s: ')', t: 'Close bracket' },
  ];

  let text = $state(untrack(() => initial));
  let showWidths = $state(false);
  let input: HTMLInputElement | undefined = $state();

  // The reader's switch settings survive a change of expression (kept out of the reactive graph on purpose:
  // flipping a toggle must not rebuild the drawing).
  const setting: Record<string, number> = {};
  let cur = $state<Record<string, number>>({});

  const result = $derived.by((): { ok: true; c: Compiled } | { ok: false; error: string; at?: number } => {
    try {
      return { ok: true, c: compile(text) };
    } catch (e) {
      if (e instanceof ExprError) return { ok: false, error: e.message, at: e.at };
      throw e;
    }
  });
  // Keep showing the last good gate while the expression is being edited.
  let last: Compiled | undefined = $state.raw(untrack(() => (result.ok ? result.c : undefined)));
  $effect(() => {
    if (result.ok) last = result.c;
  });
  const c = $derived(result.ok ? result.c : last);

  const view = $derived.by(() => {
    if (!c) return undefined;
    const g = gateCircuit(c);
    const check = verify(c, g);
    const w = widths(c.cell);
    const sigs = gateSignals(c.cell);
    const relabel = (circuit: Circuit): Circuit => ({
      ...circuit,
      components: circuit.components.map((p) => {
        const i = g.transistors.indexOf(p.id);
        if (i >= 0) return { ...p, label: showWidths ? `${signalLabel(sigs[i]!)} ×${w[i]}` : signalLabel(sigs[i]!) };
        if (g.toggles.includes(p.id)) return { ...p, params: { ...p.params, on: untrack(() => setting[p.id] === 1) } };
        return p;
      }),
    });
    const specs = transistorsOf(c.cell);
    return {
      g,
      drawn: relabel(g.drawn),
      circuit: relabel(g.circuit),
      check,
      rows: rows(c),
      p: specs.filter((t) => t.p).length,
      nn: specs.filter((t) => !t.p).length,
      width: totalWidth(c.cell),
      ids: relabel(g.drawn).components.map((p) => p.id),
    };
  });

  let engine: SwitchEngine | null = $state.raw(null);
  let schematic: Schematic | undefined = $state();
  let root: HTMLDivElement | undefined = $state();
  let stageWidth = $state(0);
  // Draw at a scale that fits the figure, but never so small that the labels stop being legible; below that it scrolls.
  const drawScale = $derived.by(() => {
    if (!view || !stageWidth) return 1.35;
    const vb = buildModel(view.drawn).viewBox;
    return Math.max(0.85, Math.min(1.35, (stageWidth - 8) / Math.max(1, vb.x1 - vb.x0)));
  });

  $effect(() => {
    const v = view;
    if (!v || typeof window === 'undefined') return;
    let e: SwitchEngine | null = null;
    try {
      e = createSwitchEngine(flatten(v.circuit));
      e.settle();
    } catch {
      e = null;
    }
    engine = e;
    cur = Object.fromEntries((c?.inputs ?? []).map((k) => [k, setting[k] ?? 0]));
    void tick().then(refresh);
  });

  function refresh() {
    schematic?.frame(0);
    const e = engine;
    const v = view;
    if (!e || !v || !root) return;
    for (const g of root.querySelectorAll<SVGGElement>('g.comp[data-cid]')) {
      const id = v.ids[Number(g.dataset.cid)];
      if (!id || !v.g.transistors.includes(id)) continue;
      let k = 'x';
      try {
        k = conduction(e.state(id));
      } catch {
        /* no state yet */
      }
      if (g.dataset.cond !== k) g.dataset.cond = k;
    }
  }

  function apply(id: string, on: boolean) {
    setting[id] = on ? 1 : 0;
    cur = { ...cur, [id]: on ? 1 : 0 };
    engine?.setParam(id, 'on', on);
  }

  // A click on a toggle in the drawing (the engine has already been told).
  function onparam(id?: string, key?: string, value?: ParamValue) {
    if (id === undefined || key !== 'on') return;
    setting[id] = value ? 1 : 0;
    cur = { ...cur, [id]: value ? 1 : 0 };
    engine?.settle();
    refresh();
  }

  function pick(bits: number[]) {
    if (!c) return;
    c.inputs.forEach((k, i) => apply(k, bits[i] === 1));
    engine?.settle();
    refresh();
    // The drawing's toggle knobs follow the engine on the next frame.
  }

  function preset(src: string) {
    text = src;
    input?.focus();
  }

  function insert(s: string) {
    const el = input;
    if (!el) {
      text += s;
      return;
    }
    const a = el.selectionStart ?? text.length;
    const b = el.selectionEnd ?? a;
    text = text.slice(0, a) + s + text.slice(b);
    void tick().then(() => {
      el.focus();
      el.setSelectionRange(a + s.length, a + s.length);
    });
  }

  const rowIndex = $derived(c ? c.inputs.reduce((acc, k) => acc * 2 + (cur[k] ?? 0), 0) : 0);
  const now = $derived(view && c ? { row: view.rows[rowIndex]!, res: view.check.rows[rowIndex]!, cond: mainStageConduction(c, view.rows[rowIndex]!.env) } : undefined);
  const lastRow = $derived(result.ok ? undefined : result);
  /** The expression as typed, with the symbols of the book. */
  const pretty = (src: string) =>
    src
      .replace(/^\s*[Yy]\s*=\s*/, '')
      .replace(/[!~]/g, '¬')
      .replace(/[*&.]/g, '·')
      .replace(/\^/g, ' ⊕ ')
      .replace(/\|/g, ' + ')
      .replace(/\s*\+\s*/g, ' + ')
      .replace(/\s+/g, ' ')
      .trim();
  const bitsText = (b: number[]) => b.join(' ');
  const gateWord = (nn: number, pp: number) => `${pp + nn} transistors (${pp} pMOS, ${nn} nMOS)`;
</script>

<Widget {n} {title} subtitle="From a Boolean expression to CMOS transistors" kind="Lab bench" {caption} onreset={() => { text = initial; showWidths = false; for (const k of Object.keys(setting)) delete setting[k]; }} fullscreen>
  {#snippet controls()}
    <div class="expr ui">
      <label for="gc-expr">Y&nbsp;=</label>
      <input
        id="gc-expr"
        bind:this={input}
        bind:value={text}
        type="text"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        aria-invalid={!result.ok}
        aria-describedby="gc-msg"
        placeholder="!(A*(B+C))"
      />
      <span class="keys" role="group" aria-label="Insert a symbol">
        {#each KEYS as k (k.s)}
          <button type="button" title={k.t} aria-label={k.t} onclick={() => insert(k.s)}>{k.s}</button>
        {/each}
      </span>
    </div>
    <Toggle label="Show widths" bind:checked={showWidths} />
  {/snippet}

  <div class="gc" bind:this={root}>
    <div class="presets ui" role="group" aria-label="Examples">
      {#each PRESETS as p (p.src)}
        <button type="button" class="chip" title={p.hint} aria-pressed={text.replace(/\s/g, '') === p.src.replace(/\s/g, '')} onclick={() => preset(p.src)}>{p.label}</button>
      {/each}
    </div>

    <p id="gc-msg" class="msg ui {result.ok ? 'ok' : 'err'}" role="status" aria-live="polite">
      {#if !result.ok}
        <b>Not yet a gate.</b> {result.error}
        {#if result.at !== undefined && text.length > 0}<span class="where">at “{text.slice(0, result.at)}<u>{text[result.at] ?? '…'}</u>{text.slice(result.at + 1)}”</span>{/if}
        {#if c}<span class="still">Showing the last good gate, Y = {pretty(c.source)}.</span>{/if}
      {:else if view && c}
        <b>Y = {pretty(c.source)}</b>: {gateWord(view.nn, view.p)}.
        {#if c.strategy === 'inverted'}
          One stage can only invert, so this is a stage that makes ¬Y followed by an inverter: {c.transistors} transistors, where a single stage with inverted inputs would need {c.alternative.transistors}.
        {:else if c.helpers > 0}
          {c.helpers} of them are inverters that make the complements A′, B′ of the inputs.
        {/if}
      {/if}
    </p>

    {#if view && c}
      <div class="stage" bind:clientWidth={stageWidth}>
        {#key view.circuit}
          <Schematic bind:this={schematic} circuit={view.drawn} {engine} mode="logic" live={false} scale={drawScale} {onparam} label="Transistor network of Y = {show(c.expr)}" />
        {/key}
      </div>
      <p class="key ui" aria-hidden="true">
        <span><i class="sw on"></i>conducting</span><span><i class="sw off"></i>off</span>
        <span class="rail">+5 V above the pMOS, ground below the nMOS</span>
      </p>

      <div class="cols">
        <div class="ui left">
          <dl class="nets">
            <div>
              <dt>Pull-down (nMOS) conducts when</dt>
              <dd>{showNet(c.pdn)}</dd>
            </div>
            <div>
              <dt>Pull-up (pMOS), the dual, conducts when</dt>
              <dd>{showNet(c.pun, true)}</dd>
            </div>
            {#if showWidths}
              <div>
                <dt>Total width for equal drive</dt>
                <dd>{view.width} <span class="dim">(an inverter: 3)</span></dd>
              </div>
            {/if}
          </dl>
          <p class="verdict {view.check.ok && view.check.clean ? 'ok' : 'err'}" role="status">
            {#if view.check.ok && view.check.clean}
              <b>Checked:</b> all {view.rows.length} input rows, on the switch-level engine, give the value of the expression, and in none of them are the pull-up and pull-down on together.
            {:else}
              <b>Mismatch:</b> {view.check.rows.filter((r) => !r.ok).length} rows disagree with the expression. This is a bug in the compiler; please report it.
            {/if}
          </p>
          {#if now}
            <p class="now" aria-live="polite">
              With {c.inputs.map((k) => `${k} = ${cur[k] ?? 0}`).join(', ')}, the
              {now.cond.down ? 'pull-down network conducts and connects Y to ground, so Y = 0' : now.cond.up ? 'pull-up network conducts and connects Y to +5 V, so Y = 1' : 'no network conducts'}.
            </p>
          {/if}
        </div>

        <div class="right ui">
          <div class="tablewrap" tabindex="-1">
            <table aria-label="Truth table: choose a row to set the inputs">
              <thead>
                <tr>
                  <th scope="col">{c.inputs.join(' ')}</th>
                  <th scope="col">Y</th>
                  <th scope="col">Conducts</th>
                </tr>
              </thead>
              <tbody>
                {#each view.rows as r, i (i)}
                  {@const res = view.check.rows[i]!}
                  {@const cd = mainStageConduction(c, r.env)}
                  <tr class:cur={i === rowIndex}>
                    <th scope="row">
                      <button type="button" aria-pressed={i === rowIndex} aria-label="Set inputs {c.inputs.map((k, j) => `${k} = ${r.bits[j]}`).join(', ')}" onclick={() => pick(r.bits)}>{bitsText(r.bits)}</button>
                    </th>
                    <td class:hi={res.got === 1} class:bad={!res.ok}>{res.got === 1 ? 1 : res.got === 0 ? 0 : res.got === 2 ? 'X' : 'Z'}</td>
                    <td class="how">{cd.down ? 'pull-down ↓' : cd.up ? 'pull-up ↑' : '—'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {:else if lastRow}
      <p class="ui hint">Type an expression such as <code>!(A*(B+C))</code> or pick an example above.</p>
    {/if}
  </div>
</Widget>

<style>
  .gc {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    min-width: 0;
    --cond-on: light-dark(#0d8a3c, #63e08a);
    --cond-off: light-dark(#9a9488, #6e6a63);
    --cond-x: var(--sig-x, #d6332b);
  }
  .gc :global(.sch g.comp[data-cond='on']) {
    --_ink: var(--cond-on);
    filter: drop-shadow(0 0 2.5px color-mix(in srgb, var(--cond-on) 60%, transparent));
  }
  .gc :global(.sch g.comp[data-cond='off']) {
    --_ink: var(--cond-off);
  }
  .gc :global(.sch g.comp[data-cond='x']) {
    --_ink: var(--cond-x);
  }
  .expr {
    display: flex;
    flex: 1 1 100%;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.6rem;
  }
  .expr label {
    font-family: var(--font-mono);
    font-size: 1rem;
    color: var(--ink-2);
  }
  .expr input {
    flex: 1 1 12rem;
    min-width: 0;
    font: inherit;
    font-family: var(--font-mono);
    font-size: 1rem;
    padding: 0.35rem 0.6rem;
    color: var(--fg);
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
  }
  .expr input[aria-invalid='true'] {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .expr input:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .keys {
    display: inline-flex;
    gap: 2px;
  }
  .keys button,
  .chip {
    font-family: var(--font-mono);
    font-size: 0.86rem;
    color: var(--ink-2);
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    padding: 0.28rem 0.6rem;
    min-width: 2rem;
    cursor: pointer;
  }
  .keys button:hover,
  .chip:hover {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .chip[aria-pressed='true'] {
    background: var(--copper-soft);
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .msg {
    margin: 0;
    font-size: 0.86rem;
    line-height: 1.45;
    padding: 0.45rem 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--pn);
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }
  .msg.ok b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .msg.err {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .msg .where {
    display: block;
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
  .msg u {
    text-decoration-color: var(--bad);
    text-decoration-thickness: 2px;
  }
  .msg .still {
    display: block;
    color: var(--mute);
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 0.9rem 1.2rem;
    align-items: start;
  }
  @media (max-width: 52rem) {
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .left {
    min-width: 0;
    display: grid;
    gap: 0.6rem;
  }
  .stage {
    overflow-x: auto;
    display: flex;
    justify-content: center;
  }
  .stage :global(.sch-wrap),
  .stage :global(.sch) {
    max-width: none;
  }
  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1rem;
    margin: 0;
    font-size: 0.74rem;
    color: var(--ink-3, var(--mute));
  }
  .key span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .key .sw {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    background: var(--cond-off);
  }
  .key .sw.on {
    background: var(--cond-on);
  }
  .nets {
    margin: 0 0 0.6rem;
    display: grid;
    gap: 0.4rem;
  }
  .nets dt {
    font-size: 0.74rem;
    color: var(--mute);
  }
  .nets dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.95rem;
    color: var(--fg);
    overflow-wrap: anywhere;
  }
  .dim {
    color: var(--mute);
    font-size: 0.8rem;
  }
  .tablewrap {
    max-height: 17rem;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .tablewrap table {
    margin: 0;
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: 0.84rem;
  }
  thead th {
    position: sticky;
    top: 0;
    background: var(--pn);
    color: var(--mute);
    font-weight: 500;
    text-align: left;
    padding: 0.3rem 0.55rem;
    border-bottom: 1px solid var(--line);
  }
  tbody th,
  tbody td {
    padding: 0;
    text-align: left;
    font-weight: 400;
    border-bottom: 1px solid var(--line);
  }
  tbody td {
    padding: 0 0.55rem;
  }
  tbody button {
    all: unset;
    box-sizing: border-box;
    display: block;
    width: 100%;
    padding: 0.28rem 0.55rem;
    cursor: pointer;
    letter-spacing: 0.06em;
  }
  tbody button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  tbody tr:hover {
    background: var(--copper-soft);
  }
  tr.cur {
    background: var(--copper-soft);
    box-shadow: inset 3px 0 0 var(--copper);
  }
  td.hi {
    color: var(--sig-high);
    font-weight: 700;
  }
  td.bad {
    color: var(--bad);
  }
  td.how {
    color: var(--mute);
    font-size: 0.78rem;
    white-space: nowrap;
  }
  .verdict,
  .now,
  .hint {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.45;
    color: var(--ink-2);
  }
  .verdict.ok b {
    color: var(--ok);
  }
  .verdict.err {
    color: var(--bad);
  }
</style>
