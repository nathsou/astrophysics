<!--
  The FSM designer. Draw a state machine as a bubble diagram (or load one), choose Moore or Mealy and a state
  encoding, and get the logic: the next-state and output equations, the gate count of each encoding, the
  machine clocked with input switches, and the equivalent DCL (an enum and a `match`).

  Everything can be done without dragging: buttons and forms add, rename, reorder and delete states and
  arrows; a bubble takes the arrow keys to move it. The logic lives in fsm.ts, synth.ts, dcl.ts, layout.ts,
  edit.ts and run.ts, all tested.

    ::fsm-designer{preset="traffic" n="19.4" caption="…"}
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { highlightDclHtml } from '$lib/hdl/editor/highlightHtml';
  import { allInputs, guardText, hasErrors, mealyToMoore, mooreToMealy, stateTable, step, validate, type Fsm, type FsmTransition } from './fsm';
  import { PRESETS, presetById, BLANK } from './presets';
  import { ENCODINGS, codeText, compareEncodings, type Encoding } from './synth';
  import { toDcl } from './dcl';
  import { toCircuit } from './netlist';
  import LiveDag from '../../11-boolean-algebra/widgets/LiveDag.svelte';
  import { clock, outputsNow, resetCode, type Cycle } from './run';
  import { R, W, clampPt, defaultPositions, edges, fitView, heightFor, type Pt, type ViewBox } from './layout';
  import * as ed from './edit';
  import type { CompileResult } from './compile';

  let { preset = 'traffic', encoding = 'binary', tab: firstTab = 'states', n: fig, caption }: { preset?: string; encoding?: Encoding; tab?: string; n?: string | number; caption?: string } = $props();

  const first = untrack(() => presetById(preset));
  let presetId = $state<string>(untrack(() => presetById(preset).id));
  let fsm = $state.raw<Fsm>(structuredClone(first.fsm));
  let enc = $state<Encoding>(untrack(() => encoding));
  let tab = $state(untrack(() => firstTab));
  let note = $state(first.note);
  let pos = $state.raw<Record<string, Pt>>({});
  let sel = $state<string | null>(null);
  let toSel = $state<string | null>(null);
  let newArrow = $state<FsmTransition>(ed.defaultTransition(structuredClone(first.fsm)));
  let newPattern = $state<string[]>([]);

  // ── The derived design ──────────────────────────────────────────────────────
  const problems = $derived(validate(fsm));
  const broken = $derived(hasErrors(problems));
  const designs = $derived(broken ? null : compareEncodings(fsm));
  const design = $derived(designs ? designs[enc] : null);
  const dcl = $derived(broken ? '' : toDcl(fsm, enc));
  const circuit = $derived(design ? toCircuit(design, { title: `${fsm.title}, ${enc} codes` }) : null);
  const positions = $derived.by(() => {
    const base = defaultPositions(fsm.states.map((s) => s.name));
    for (const s of fsm.states) if (pos[s.name]) base[s.name] = pos[s.name]!;
    return base;
  });
  const drawn = $derived(edges(fsm, positions));
  const H = $derived(heightFor(fsm.states.length));
  const fitted = $derived(fitView(positions, drawn, H));
  // While a bubble is being dragged the view stays put, or it would move under the pointer.
  let frozen = $state.raw<ViewBox | null>(null);
  const view = $derived(frozen ?? fitted);
  const table = $derived(broken ? [] : stateTable(fsm));
  const bestTotal = $derived(designs ? Math.min(...ENCODINGS.map((e) => designs[e.id].cost.total)) : 0);
  const worstTotal = $derived(designs ? Math.max(...ENCODINGS.map((e) => designs[e.id].cost.total)) : 1);

  // ── Running ─────────────────────────────────────────────────────────────────
  let inputs = $state<number[]>([]);
  let code = $state(0);
  let cycle = $state(0);
  let history = $state.raw<Cycle[]>([]);
  let via = $state<number | null>(null);
  let running = $state(false);
  let rate = $state(2);
  let visible = true;
  let root: HTMLElement | undefined = $state();

  const stateName = $derived(design ? (Object.keys(design.codes.code).find((k) => design.codes.code[k] === code) ?? '?') : '?');
  const outNow = $derived(design ? outputsNow(design, code, inputs.length === fsm.inputs.length ? inputs : fsm.inputs.map(() => 0)) : '');
  const lastAgrees = $derived(history.length ? history[history.length - 1]!.agrees : true);

  function resetRun() {
    running = false;
    cycle = 0;
    history = [];
    via = null;
    code = design ? resetCode(design) : 0;
    if (inputs.length !== fsm.inputs.length) inputs = fsm.inputs.map(() => 0);
  }
  // Any change to the machine or its code starts the run again.
  $effect(() => {
    void design;
    untrack(resetRun);
  });

  function tick() {
    if (!design) return;
    const v = inputs.length === fsm.inputs.length ? inputs : fsm.inputs.map(() => 0);
    const c = clock(design, code, v, cycle + 1);
    const s = step(fsm, c.state, v);
    via = s.via ? fsm.transitions.indexOf(s.via) : null;
    code = c.nextCode;
    cycle = c.n;
    history = [...history.slice(-7), c];
  }
  function flip(i: number) {
    inputs = inputs.map((b, k) => (k === i ? 1 - b : b));
  }

  onMount(() => {
    if (!root) return;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(root);
    return () => io.disconnect();
  });
  // Clock at the chosen rate while running, on screen and with the tab in front.
  $effect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (visible && !document.hidden) tick();
    }, 1000 / rate);
    return () => clearInterval(id);
  });

  // ── Editing ─────────────────────────────────────────────────────────────────
  function apply(next: Fsm) {
    if (next === fsm) return;
    fsm = next;
    // Forget positions of states that no longer exist.
    const names = new Set(next.states.map((s) => s.name));
    pos = Object.fromEntries(Object.entries(pos).filter(([k]) => names.has(k)));
    if (sel && !names.has(sel)) sel = null;
    if (toSel && !names.has(toSel)) toSel = null;
    if (!names.has(newArrow.from) || !names.has(newArrow.to)) newArrow = ed.defaultTransition(next);
    syncPattern();
  }
  function syncPattern() {
    newPattern = fsm.inputs.map((_, i) => newArrow.when[i] ?? '-');
  }
  syncPattern();

  function load(id: string) {
    const p = presetId === id && id !== 'blank' ? presetById(id) : id === 'blank' ? { id: 'blank', fsm: BLANK, note: 'A blank machine with two states. Add states in the States tab, arrows in the Arrows tab, and watch the logic change.' } : presetById(id);
    presetId = p.id;
    fsm = structuredClone(p.fsm);
    pos = {};
    sel = null;
    note = p.note;
    newArrow = ed.defaultTransition(fsm);
    syncPattern();
  }
  function setKind(k: 'moore' | 'mealy') {
    if (k === fsm.kind) return;
    pos = {};
    fsm = k === 'moore' ? mealyToMoore(fsm) : mooreToMealy(fsm);
    newArrow = ed.defaultTransition(fsm);
    sel = null;
    syncPattern();
  }
  function rename(from: string, to: string) {
    const next = ed.renameState(fsm, from, to);
    if (next === fsm) return false;
    if (pos[from]) pos = { ...Object.fromEntries(Object.entries(pos).filter(([k]) => k !== from)), [to.trim()]: pos[from]! };
    if (sel === from) sel = to.trim();
    if (newArrow.from === from) newArrow = { ...newArrow, from: to.trim() };
    if (newArrow.to === from) newArrow = { ...newArrow, to: to.trim() };
    fsm = next;
    return true;
  }
  function addArrow() {
    const t: FsmTransition = { ...newArrow, when: newPattern.join('') };
    apply(ed.addTransition(fsm, t));
  }
  const cyc = (c: string): string => (c === '-' ? '1' : c === '1' ? '0' : '-');

  // ── The diagram: drag and keyboard ──────────────────────────────────────────
  let svg: SVGSVGElement | undefined = $state();
  let drag: { name: string; dx: number; dy: number; moved: boolean } | null = null;
  function toCanvas(ev: PointerEvent): Pt {
    const r = svg!.getBoundingClientRect();
    return { x: view.x + ((ev.clientX - r.left) / r.width) * view.w, y: view.y + ((ev.clientY - r.top) / r.height) * view.h };
  }
  function down(ev: PointerEvent, name: string) {
    const p = toCanvas(ev);
    const at = positions[name]!;
    drag = { name, dx: at.x - p.x, dy: at.y - p.y, moved: false };
    frozen = view;
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
  }
  function move(ev: PointerEvent) {
    if (!drag) return;
    const p = toCanvas(ev);
    drag.moved = true;
    pos = { ...pos, [drag.name]: clampPt({ x: p.x + drag.dx, y: p.y + drag.dy }, H) };
  }
  function up(name: string) {
    if (drag && !drag.moved) pick(name);
    drag = null;
    frozen = null;
  }
  function pick(name: string) {
    if (sel && sel !== name && tab === 'arrows') {
      toSel = name;
      newArrow = { ...newArrow, from: sel, to: name };
      return;
    }
    sel = name;
    toSel = null;
    newArrow = { ...newArrow, from: name };
  }
  function key(ev: KeyboardEvent, name: string) {
    const step = ev.shiftKey ? 24 : 8;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (d[ev.key]) {
      ev.preventDefault();
      const at = positions[name]!;
      pos = { ...pos, [name]: clampPt({ x: at.x + d[ev.key]![0], y: at.y + d[ev.key]![1] }, H) };
    } else if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      pick(name);
    }
  }

  const tabs = [
    { id: 'states', label: 'States' },
    { id: 'arrows', label: 'Arrows' },
    { id: 'ports', label: 'Ports' },
    { id: 'logic', label: 'Logic' },
    { id: 'circuit', label: 'Circuit' },
    { id: 'cost', label: 'Cost' },
    { id: 'dcl', label: 'DCL' },
  ];
  function tabKey(ev: KeyboardEvent) {
    const i = tabs.findIndex((t) => t.id === tab);
    if (ev.key === 'ArrowRight') tab = tabs[(i + 1) % tabs.length]!.id;
    else if (ev.key === 'ArrowLeft') tab = tabs[(i + tabs.length - 1) % tabs.length]!.id;
    else return;
    ev.preventDefault();
    queueMicrotask(() => root?.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus());
  }

  // ── The compiler, on request ────────────────────────────────────────────────
  let compiled = $state<CompileResult | null>(null);
  let compiling = $state(false);
  $effect(() => {
    void dcl;
    compiled = null;
  });
  async function compile() {
    compiling = true;
    const m = await import('./compile');
    compiled = m.compileStats(dcl, fsm);
    compiling = false;
  }
  let copied = $state(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(dcl);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      /* clipboard refused */
    }
  }

  const bits = (s: string) => [...s].map((c) => c === '1');
  const uid = $props.id();
  const pct = (v: number) => `${Math.round((100 * v) / Math.max(1, worstTotal))}%`;
  const arrowClass = (i: number[]) => (via !== null && i.includes(via) ? 'taken' : '');
  const inputNames = $derived(fsm.inputs);
</script>

<Widget title="FSM designer" n={fig} {caption} kind="Interactive" fullscreen onreset={() => load(presetId)}>
  {#snippet controls()}
    <Segmented
      size="sm"
      label="Example machine"
      value={presetId}
      onchange={load}
      options={[...PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: 'blank', label: 'Blank' }]}
    />
    <Segmented size="sm" label="Machine type" value={fsm.kind} onchange={setKind} options={[{ value: 'moore', label: 'Moore', title: 'Outputs depend on the state alone' }, { value: 'mealy', label: 'Mealy', title: 'Outputs depend on the state and the inputs' }]} />
    <Segmented size="sm" label="State encoding" value={enc} onchange={(v) => (enc = v)} options={ENCODINGS.map((e) => ({ value: e.id, label: e.label, title: e.blurb }))} />
  {/snippet}

  <div class="fd ui" bind:this={root}>
    <p class="note">{note}</p>

    <div class="cols">
      <div class="left">
        <!-- The diagram -->
        <svg bind:this={svg} class="diagram" viewBox="{view.x} {view.y} {view.w} {view.h}" role="group" aria-label="State diagram of {fsm.title}: {fsm.states.length} states and {fsm.transitions.length} arrows. Each state can be focused; the arrow keys move it.">
          <defs>
            <marker id="{uid}-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" class="head" /></marker>
            <marker id="{uid}-t" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" class="head taken" /></marker>
          </defs>
          {#each drawn as e (e.key)}
            {@const hot = via !== null && e.arrows.includes(via)}
            <g class="edge {arrowClass(e.arrows)}">
              <path d={e.d} class="curve" class:taken={hot} marker-end="url(#{uid}-{hot ? 't' : 'a'})" />
              <text class="lab" x={e.label.x} y={e.label.y - ((e.lines.length - 1) * 7.5)} text-anchor="middle">
                {#each e.lines as line, i (i)}<tspan x={e.label.x} dy={i === 0 ? 0 : 15}>{line}</tspan>{/each}
              </text>
            </g>
          {/each}
          {#each fsm.states as s, i (s.name)}
            {@const p = positions[s.name]!}
            {@const now = !broken && s.name === stateName}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <g
              class="bubble"
              class:now
              class:sel={sel === s.name}
              transform="translate({p.x} {p.y})"
              role="button"
              tabindex="0"
              aria-label="State {s.name}{i === 0 ? ', reset state' : ''}{fsm.kind === 'moore' ? `, outputs ${fsm.outputs.filter((_, k) => s.out[k] === '1').join(' ') || 'none'}` : ''}{now ? ', current state' : ''}. Arrow keys move it, Enter selects it."
              onpointerdown={(ev) => down(ev, s.name)}
              onpointermove={move}
              onpointerup={() => up(s.name)}
              onpointercancel={() => {
                drag = null;
                frozen = null;
              }}
              onkeydown={(ev) => key(ev, s.name)}
            >
              {#if i === 0}<path class="start" d="M{-R - 30} {-R - 8} L{-R * 0.78} {-R * 0.62}" marker-end="url(#{uid}-a)" />{/if}
              <circle r={R} class="disc" />
              {#if fsm.kind === 'moore' && s.out.includes('1')}<circle r={R - 5} class="inner" />{/if}
              <text class="nm" y={fsm.kind === 'moore' ? -3 : 5} text-anchor="middle">{s.name.length > 10 ? s.name.slice(0, 9) + '…' : s.name}</text>
              {#if fsm.kind === 'moore'}<text class="mo" y="13" text-anchor="middle">{s.out}</text>{/if}
              {#if design}<text class="cd" y={R + 13} text-anchor="middle">{codeText(design.codes.code[s.name]!, design.codes.bits).slice(0, 12)}</text>{/if}
            </g>
          {/each}
        </svg>
        <p class="legend">
          {#if fsm.kind === 'moore'}Bubble: name, and the output bits <span class="mono">({fsm.outputs.join(' ')})</span> shown while in that state.{:else}Arrow label: inputs{#if fsm.inputs.length > 1} <span class="mono">({fsm.inputs.join(' ')})</span>, each 1, 0 or - for either,{/if} then <span class="mono">/</span> and the output bits <span class="mono">({fsm.outputs.join(' ')})</span> shown while the arrow is taken.{/if}
          {#if fsm.kind === 'moore' && fsm.inputs.length > 1}Arrow label: the inputs <span class="mono">({fsm.inputs.join(' ')})</span>, each 1, 0 or - for either.{/if}
          Below each bubble: its {enc === 'onehot' ? 'one-hot' : enc} code. The first state is the reset state.
        </p>

        <!-- The simulation -->
        <div class="sim" role="group" aria-label="Run the machine">
          <div class="row">
            {#each inputNames as name, i (name + i)}
              <button type="button" class="sw" class:on={inputs[i] === 1} role="switch" aria-checked={inputs[i] === 1} onclick={() => flip(i)}>
                <span class="knob" aria-hidden="true"></span>{name} = {inputs[i] ?? 0}
              </button>
            {/each}
            <Button size="sm" variant="primary" onclick={tick} disabled={broken}>Clock edge</Button>
            <Button size="sm" onclick={() => (running = !running)} disabled={broken}>{running ? 'Pause' : 'Run'}</Button>
            <Segmented size="sm" label="Clock rate" value={rate} onchange={(v) => (rate = v)} options={[{ value: 1, label: '1 Hz' }, { value: 2, label: '2 Hz' }, { value: 4, label: '4 Hz' }]} />
            <Button size="sm" variant="ghost" onclick={resetRun}>Reset</Button>
          </div>
          {#if design}
            <div class="now-row" role="status" aria-live="polite">
              <span class="chip"><b>State</b> {stateName}</span>
              <span class="chip flops" title="The flip-flops hold the code"><b>Flip-flops</b> {#each design.codes.names as q, i (q)}<span class="bit" class:hi={(code >> (design.codes.bits - 1 - i)) & 1}>{q.replace('Q_', '')}={(code >> (design.codes.bits - 1 - i)) & 1}</span>{/each}</span>
              {#each fsm.outputs as o, k (o)}
                <span class="led" class:on={outNow[k] === '1'}><i aria-hidden="true"></i>{o}<span class="sr">{outNow[k] === '1' ? ' on' : ' off'}</span></span>
              {/each}
              <span class="chip cycle">edge {cycle}</span>
              <span class="ok" class:bad={!lastAgrees} title="The equations are evaluated at every edge and compared with the diagram">{lastAgrees ? '✓ logic = diagram' : '✗ logic ≠ diagram'}</span>
            </div>
            {#if history.length}
              <div class="hist" aria-label="Last clock edges">
                <table>
                  <thead><tr><th>edge</th><th>{fsm.inputs.join(' ') || '·'}</th><th>state</th><th>outputs</th><th>next</th></tr></thead>
                  <tbody>
                    {#each history.slice(-5) as h (h.n)}
                      <tr><td>{h.n}</td><td>{h.inputs.join(' ')}</td><td>{h.state}</td><td>{h.out}</td><td>{h.next}</td></tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          {/if}
        </div>
      </div>

      <div class="right">
        <div class="tabs" role="tablist" aria-label="Designer panels" tabindex="-1" onkeydown={tabKey}>
          {#each tabs as t (t.id)}
            <button type="button" role="tab" id="{uid}-tab-{t.id}" aria-selected={tab === t.id} aria-controls="{uid}-panel" tabindex={tab === t.id ? 0 : -1} class:on={tab === t.id} onclick={() => (tab = t.id)}>{t.label}</button>
          {/each}
        </div>

        <div class="panel" id="{uid}-panel" role="tabpanel" aria-labelledby="{uid}-tab-{tab}">
          {#if problems.length && tab !== 'ports'}
            <ul class="problems" role="status">
              {#each problems as p, i (i)}<li class={p.level}>{p.level === 'error' ? 'Error: ' : 'Note: '}{p.text}</li>{/each}
            </ul>
          {/if}

          {#if tab === 'states'}
            <ul class="rows">
              {#each fsm.states as s, i (i)}
                <li class="state-row">
                  <input class="name" value={s.name} aria-label="Name of state {i + 1}" onchange={(ev) => { if (!rename(s.name, ev.currentTarget.value)) ev.currentTarget.value = s.name; }} />
                  {#if fsm.kind === 'moore'}
                    <span class="outs" role="group" aria-label="Outputs while in {s.name}">
                      {#each fsm.outputs as o, k (o)}
                        <label class="cb"><input type="checkbox" checked={s.out[k] === '1'} onchange={(ev) => apply(ed.setStateOutput(fsm, s.name, k, ev.currentTarget.checked))} />{o}</label>
                      {/each}
                    </span>
                  {/if}
                  <span class="btns">
                    <button type="button" class="ib" title="Move up (changes the codes)" aria-label="Move {s.name} up" disabled={i === 0} onclick={() => apply(ed.moveState(fsm, s.name, -1))}>↑</button>
                    <button type="button" class="ib" title="Move down" aria-label="Move {s.name} down" disabled={i === fsm.states.length - 1} onclick={() => apply(ed.moveState(fsm, s.name, 1))}>↓</button>
                    <button type="button" class="ib" title={i === 0 ? 'The reset state' : 'Make this the reset state'} aria-label={i === 0 ? `${s.name} is the reset state` : `Make ${s.name} the reset state`} disabled={i === 0} onclick={() => apply(ed.makeReset(fsm, s.name))}>⏻</button>
                    <button type="button" class="ib del" title="Delete this state and its arrows" aria-label="Delete state {s.name}" disabled={fsm.states.length <= 2} onclick={() => apply(ed.removeState(fsm, s.name))}>×</button>
                  </span>
                </li>
              {/each}
            </ul>
            <div class="add"><Button size="sm" onclick={() => apply(ed.addState(fsm))} disabled={fsm.states.length >= 12}>Add a state</Button><span class="hint">The list order is the order of the binary and Gray codes; ⏻ marks the reset state, which goes first.</span></div>
          {:else if tab === 'arrows'}
            <ul class="rows">
              {#each fsm.transitions as t, i (i)}
                <li class="arrow-row" class:hot={via === i}>
                  <span class="desc"><b>{t.from}</b> → <b>{t.to}</b>{#if fsm.inputs.length}, when <code>{guardText(t.when, fsm.inputs)}</code>{/if}</span>
                  {#if fsm.kind === 'mealy'}
                    <span class="outs" role="group" aria-label="Outputs of arrow {i + 1}">
                      {#each fsm.outputs as o, k (o)}<label class="cb"><input type="checkbox" checked={t.out?.[k] === '1'} onchange={(ev) => apply(ed.setTransitionOutput(fsm, i, k, ev.currentTarget.checked))} />{o}</label>{/each}
                    </span>
                  {/if}
                  <button type="button" class="ib del" title="Delete this arrow" aria-label="Delete arrow from {t.from} to {t.to}{t.when ? ` when ${guardText(t.when, fsm.inputs)}` : ''}" onclick={() => apply(ed.removeTransition(fsm, i))}>×</button>
                </li>
              {:else}
                <li class="none">No arrows: every state stays where it is.</li>
              {/each}
            </ul>
            <form class="form" onsubmit={(ev) => { ev.preventDefault(); addArrow(); }} aria-label="Add an arrow">
              <label>From
                <select bind:value={newArrow.from} onchange={() => (sel = newArrow.from)}>{#each fsm.states as s (s.name)}<option>{s.name}</option>{/each}</select>
              </label>
              <label>To
                <select bind:value={newArrow.to}>{#each fsm.states as s (s.name)}<option>{s.name}</option>{/each}</select>
              </label>
              {#each fsm.inputs as name, i (name + i)}
                <label>{name}
                  <select value={newPattern[i] ?? '-'} onchange={(ev) => (newPattern = newPattern.map((c, k) => (k === i ? ev.currentTarget.value : c)))}>
                    <option value="-">either</option><option value="1">1</option><option value="0">0</option>
                  </select>
                </label>
              {/each}
              {#if fsm.kind === 'mealy'}
                <span class="outs" role="group" aria-label="Outputs of the new arrow">
                  {#each fsm.outputs as o, k (o)}<label class="cb"><input type="checkbox" checked={newArrow.out?.[k] === '1'} onchange={(ev) => { const cur = (newArrow.out ?? '0'.repeat(fsm.outputs.length)).split(''); cur[k] = ev.currentTarget.checked ? '1' : '0'; newArrow = { ...newArrow, out: cur.join('') }; }} />{o}</label>{/each}
                </span>
              {/if}
              <Button size="sm" variant="primary" type="submit">Add arrow</Button>
            </form>
            <p class="hint">Click a bubble to make it the From state; with this tab open, click a second bubble to set To. An input combination with no arrow leaves the machine in its state{fsm.kind === 'mealy' ? ', with the outputs at 0' : ''}.</p>
          {:else if tab === 'ports'}
            <div class="ports">
              <h5>Inputs <span class="hint">(at most 3)</span></h5>
              <ul class="rows">
                {#each fsm.inputs as name, i (i)}
                  <li class="state-row">
                    <input class="name" value={name} aria-label="Name of input {i + 1}" onchange={(ev) => apply(ed.renameInput(fsm, i, ev.currentTarget.value))} />
                    <button type="button" class="ib del" aria-label="Delete input {name}" onclick={() => apply(ed.removeInput(fsm, i))}>×</button>
                  </li>
                {/each}
              </ul>
              <div class="add"><Button size="sm" onclick={() => apply(ed.addInput(fsm, ''))} disabled={fsm.inputs.length >= 3}>Add an input</Button></div>
              <h5>Outputs <span class="hint">(at most 5)</span></h5>
              <ul class="rows">
                {#each fsm.outputs as name, i (i)}
                  <li class="state-row">
                    <input class="name" value={name} aria-label="Name of output {i + 1}" onchange={(ev) => apply(ed.renameOutput(fsm, i, ev.currentTarget.value))} />
                    <button type="button" class="ib del" aria-label="Delete output {name}" disabled={fsm.outputs.length <= 1} onclick={() => apply(ed.removeOutput(fsm, i))}>×</button>
                  </li>
                {/each}
              </ul>
              <div class="add"><Button size="sm" onclick={() => apply(ed.addOutput(fsm, ''))} disabled={fsm.outputs.length >= 5}>Add an output</Button></div>
              {#if problems.length}<ul class="problems" role="status">{#each problems as p, i (i)}<li class={p.level}>{p.level === 'error' ? 'Error: ' : 'Note: '}{p.text}</li>{/each}</ul>{/if}
            </div>
          {:else if tab === 'logic'}
            {#if design}
              <p class="sum"><b>{design.codes.bits}</b> flip-flop{design.codes.bits === 1 ? '' : 's'} <span class="mono">({design.codes.names.map((q) => q.replace('Q_', '')).join(' ')})</span>, reset to <span class="mono">{codeText(design.codes.code[fsm.states[0]!.name]!, design.codes.bits)}</span>. Each <span class="mono">D_…</span> is what its flip-flop loads at the next edge.</p>
              <ul class="eqs">
                {#each design.functions as f, i (f)}<li><span class="lhs">{f}</span> = <span class="rhs">{design.equations[i]}</span></li>{/each}
              </ul>
              <details>
                <summary>The state table</summary>
                <div class="scroll">
                  <table class="tt">
                    <thead><tr><th>state</th><th>code</th><th>{fsm.inputs.join(' ') || '·'}</th><th>next</th><th>{fsm.outputs.join(' ')}</th></tr></thead>
                    <tbody>
                      {#each table as r, i (i)}
                        <tr class:imp={r.implicit}><td>{r.state}</td><td class="mono">{codeText(design.codes.code[r.state]!, design.codes.bits)}</td><td class="mono">{r.when.replace(/-/g, '–')}</td><td>{r.next}</td><td class="mono">{r.out}</td></tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
                <p class="hint">Grey rows are input combinations with no arrow: the machine stays.</p>
              </details>
            {:else}<p class="none">Fix the errors above to get the logic.</p>{/if}
          {:else if tab === 'circuit'}
            {#if circuit}
              <p class="hint">The gates of the equations, and a D flip-flop for each state bit. This circuit runs on its own: flip the input switches and press the clock button (the lamps beside the flip-flops show the state bits). The named flags are wires: <span class="mono">Q…</span> comes back from a flip-flop, <span class="mono">D_…</span> goes into one.</p>
              <LiveDag {circuit} scale={1.1} label="Circuit of {fsm.title} with {enc} state codes" />
            {:else}<p class="none">Fix the errors above to get the circuit.</p>{/if}
          {:else if tab === 'cost'}
            {#if designs}
              <table class="cost">
                <thead><tr><th>code</th><th title="Flip-flops">FF</th><th title="AND, OR and NOT gates">AND·OR·NOT</th><th title="Gates in total">gates</th><th title="Widest AND gate">widest</th><th title="Rough count of 4-input lookup tables">LUT4</th><th title="Flip-flops plus gates">total</th></tr></thead>
                <tbody>
                  {#each ENCODINGS as e (e.id)}
                    {@const c = designs[e.id].cost}
                    <tr class:sel={enc === e.id} class:best={c.total === bestTotal}>
                      <th scope="row"><button type="button" onclick={() => (enc = e.id)} aria-pressed={enc === e.id}>{e.label}</button></th>
                      <td>{c.flipFlops}</td><td>{c.and}·{c.or}·{c.not}</td><td><b>{c.gates}</b></td><td>{c.widest}</td><td>{c.luts}</td>
                      <td class="bar"><span class="fill" style:width={pct(c.total)}></span><b>{c.total}</b></td>
                    </tr>
                  {/each}
                </tbody>
              </table>
              <p class="hint">Two-level logic, minimised with the don't-cares of the unused codes (Chapter 12); terms are shared between functions when that saves gates. Click a row to choose that encoding. <b>widest</b> is the largest AND gate, a measure of speed; <b>LUT4</b> is a rough count for an FPGA (Chapter 28).</p>
            {:else}<p class="none">Fix the errors above to compare the encodings.</p>{/if}
          {:else if tab === 'dcl'}
            {#if dcl}
              <div class="code" aria-label="DCL source">{@html highlightDclHtml(dcl)}</div>
              <div class="add">
                <Button size="sm" onclick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
                <Button size="sm" onclick={compile} disabled={compiling}>{compiling ? 'Compiling…' : 'Compile it'}</Button>
              </div>
              {#if compiled}
                <p class="hint" role="status">{#if compiled.ok}The DCL compiler lowers this to <b>{compiled.flipFlops}</b> flip-flops and <b>{compiled.gates}</b> gates (depth {compiled.depth}), without minimising: it turns each <code>match</code> into decoders and AND–OR gates.{:else}It did not compile: {compiled.problems.join('; ')}{/if}</p>
              {/if}
              <p class="hint">The encoding is one attribute on the <code>enum</code>: none for binary, <code>@gray</code> or <code>@onehot</code>. Change the encoding above and only that line changes.</p>
            {:else}<p class="none">Fix the errors above to get the code.</p>{/if}
          {/if}
        </div>
      </div>
    </div>
  </div>
</Widget>

<style>
  .fd {
    display: grid;
    gap: 0.75rem;
    padding: 0.9rem 1rem 1rem;
    min-width: 0;
  }
  .note {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: 1rem 1.3rem;
    align-items: start;
  }
  @media (max-width: 60rem) {
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .left,
  .right {
    min-width: 0;
    display: grid;
    gap: 0.6rem;
  }
  .diagram {
    width: 100%;
    height: auto;
    display: block;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    touch-action: none;
    user-select: none;
    font-family: var(--font-mono);
  }
  .head {
    fill: var(--wire);
  }
  .head.taken {
    fill: var(--sig-high);
  }
  .curve {
    fill: none;
    stroke: var(--wire);
    stroke-width: 1.6;
  }
  .curve.taken {
    stroke: var(--sig-high);
    stroke-width: 2.6;
  }
  .lab {
    font-size: 13px;
    fill: var(--ink-2);
    paint-order: stroke;
    stroke: var(--panel);
    stroke-width: 4px;
    stroke-linejoin: round;
  }
  .bubble {
    cursor: grab;
    outline: none;
  }
  .disc {
    fill: var(--panel);
    stroke: var(--wire);
    stroke-width: 1.8;
  }
  .inner {
    fill: none;
    stroke: var(--sig-high);
    stroke-width: 1.4;
    stroke-dasharray: 3 3;
  }
  .bubble.now .disc {
    fill: color-mix(in srgb, var(--sig-high) 24%, var(--panel));
    stroke: var(--sig-high);
    stroke-width: 3;
  }
  .bubble.sel .disc {
    stroke: var(--accent);
    stroke-width: 3;
  }
  .bubble:focus-visible .disc {
    stroke: var(--focus);
    stroke-width: 3.5;
  }
  .nm {
    font-size: 13px;
    font-weight: 700;
    fill: var(--fg);
    pointer-events: none;
  }
  .mo {
    font-size: 11px;
    fill: var(--mute);
    pointer-events: none;
  }
  .cd {
    font-size: 11px;
    fill: var(--mute);
    pointer-events: none;
  }
  .start {
    fill: none;
    stroke: var(--wire);
    stroke-width: 1.6;
  }
  .legend,
  .hint {
    margin: 0;
    font-size: 0.78rem;
    color: var(--mute);
    line-height: 1.45;
  }
  .mono,
  code {
    font-family: var(--font-mono);
    font-size: 0.92em;
  }
  .sim {
    display: grid;
    gap: 0.55rem;
    padding: 0.6rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--pn);
  }
  .row,
  .now-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.55rem;
    align-items: center;
  }
  .sw {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid var(--line-strong);
    border-radius: 99px;
    background: var(--panel);
    padding: 0.2rem 0.7rem 0.2rem 0.3rem;
    font: inherit;
    font-size: 0.82rem;
    font-family: var(--font-mono);
    color: var(--ink-2);
    cursor: pointer;
    min-height: 1.9rem;
  }
  .sw .knob {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--sig-low);
    transition: background-color 120ms;
  }
  .sw.on {
    color: var(--fg);
    border-color: var(--sig-high);
    box-shadow: 0 0 8px -3px var(--sig-high-glow);
  }
  .sw.on .knob {
    background: var(--sig-high);
  }
  .sw:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .chip {
    font-size: 0.8rem;
    padding: 0.15rem 0.5rem;
    border-radius: 6px;
    background: var(--panel);
    border: 1px solid var(--line);
    color: var(--ink-2);
    font-family: var(--font-mono);
  }
  .chip b {
    color: var(--mute);
    font-weight: 500;
    margin-right: 0.3rem;
  }
  .bit {
    margin-right: 0.4rem;
    color: var(--sig-low);
  }
  .bit.hi {
    color: var(--sig-high);
    font-weight: 700;
  }
  .led {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    font-family: var(--font-mono);
    color: var(--ink-2);
  }
  .led i {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--surface-3);
    box-shadow: inset 0 0 0 1px var(--line-strong);
  }
  .led.on i {
    background: var(--sig-high);
    box-shadow: 0 0 8px var(--sig-high-glow), inset 0 0 0 1px var(--sig-high);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .ok {
    font-size: 0.78rem;
    color: var(--phosphor);
    font-weight: 600;
  }
  .ok.bad {
    color: var(--sig-x);
  }
  .hist {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    font-size: 0.78rem;
    width: 100%;
  }
  th,
  td {
    padding: 0.18rem 0.35rem;
    text-align: left;
    border-bottom: 1px solid var(--line);
    font-family: var(--font-mono);
    white-space: nowrap;
  }
  th {
    color: var(--mute);
    font-weight: 500;
    font-size: 0.72rem;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    border-bottom: 1px solid var(--line-strong);
  }
  .tabs button {
    border: 1px solid transparent;
    border-bottom: 0;
    background: transparent;
    padding: 0.35rem 0.7rem;
    font: inherit;
    font-size: 0.82rem;
    color: var(--ink-2);
    cursor: pointer;
    border-radius: 6px 6px 0 0;
    min-height: 2rem;
  }
  .tabs button.on {
    background: var(--panel);
    color: var(--fg);
    font-weight: 600;
    border-color: var(--line-strong);
    margin-bottom: -1px;
    box-shadow: inset 0 2px 0 var(--sig-high);
  }
  .tabs button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .panel {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }
  .state-row,
  .arrow-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 0.6rem;
    padding: 0.25rem 0.4rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--panel);
  }
  .arrow-row.hot {
    border-color: var(--sig-high);
  }
  .arrow-row .desc {
    flex: 1 1 10rem;
    font-size: 0.82rem;
  }
  .name {
    font: inherit;
    font-family: var(--font-mono);
    font-size: 0.84rem;
    width: 8.5rem;
    max-width: 100%;
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    background: var(--bg);
    color: var(--fg);
  }
  .outs {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.15rem 0.6rem;
  }
  .cb {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.78rem;
    font-family: var(--font-mono);
    color: var(--ink-2);
    min-height: 1.6rem;
  }
  .btns {
    margin-left: auto;
    display: inline-flex;
    gap: 2px;
  }
  .ib {
    width: 1.9rem;
    height: 1.9rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
    font-size: 0.9rem;
    line-height: 1;
  }
  .ib:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .ib:hover:not(:disabled) {
    border-color: var(--copper);
  }
  .ib.del:hover:not(:disabled) {
    border-color: var(--sig-x);
    color: var(--sig-x);
  }
  .ib:focus-visible,
  select:focus-visible,
  .name:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .add {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .form {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.6rem;
    align-items: end;
    padding: 0.5rem;
    border: 1px dashed var(--line-strong);
    border-radius: 8px;
  }
  .form label {
    display: grid;
    gap: 0.15rem;
    font-size: 0.72rem;
    color: var(--mute);
    font-family: var(--font-mono);
  }
  select {
    font: inherit;
    font-size: 0.82rem;
    padding: 0.25rem 0.3rem;
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    background: var(--bg);
    color: var(--fg);
    min-height: 1.9rem;
    max-width: 8.5rem;
  }
  h5 {
    margin: 0.4rem 0 0.2rem;
    font-size: 0.8rem;
    font-family: var(--font-display);
  }
  .problems {
    list-style: none;
    margin: 0;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    background: color-mix(in srgb, var(--sig-x) 8%, var(--panel));
    border: 1px solid color-mix(in srgb, var(--sig-x) 35%, var(--line));
    font-size: 0.8rem;
  }
  .problems li.warning {
    color: var(--ink-2);
  }
  .none {
    margin: 0;
    color: var(--mute);
    font-size: 0.82rem;
  }
  .sum {
    margin: 0;
    font-size: 0.84rem;
    line-height: 1.5;
  }
  .eqs {
    list-style: none;
    margin: 0;
    padding: 0.5rem 0.6rem;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 8px;
    display: grid;
    gap: 0.25rem;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    overflow-x: auto;
  }
  .eqs li {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .lhs {
    color: var(--copper-ink);
    font-weight: 600;
  }
  details summary {
    cursor: pointer;
    font-size: 0.82rem;
  }
  .scroll {
    overflow-x: auto;
  }
  .tt .imp td {
    color: var(--mute);
  }
  .cost th[scope='row'] button {
    font: inherit;
    font-size: 0.8rem;
    background: none;
    border: 0;
    padding: 0.1rem 0;
    cursor: pointer;
    color: var(--fg);
    text-decoration: underline dotted;
  }
  .cost tr.sel {
    background: color-mix(in srgb, var(--sig-high) 10%, transparent);
  }
  .cost td.bar {
    position: relative;
    min-width: 3.6rem;
  }
  .cost .fill {
    position: absolute;
    left: 0;
    top: 3px;
    bottom: 3px;
    background: color-mix(in srgb, var(--sig-low) 30%, transparent);
    border-radius: 3px;
  }
  .cost tr.best .fill {
    background: color-mix(in srgb, var(--phosphor) 40%, transparent);
  }
  .cost td.bar b {
    position: relative;
    padding-left: 0.3rem;
  }
  .cost {
    display: block;
    overflow-x: auto;
  }
  .cost th,
  .cost td {
    padding: 0.15rem 0.22rem;
    font-size: 0.7rem;
  }
  @media (min-width: 40rem) {
    .cost th,
    .cost td {
      padding: 0.18rem 0.4rem;
      font-size: 0.78rem;
    }
  }
  .code {
    max-height: 22rem;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--pn);
    padding: 0.5rem 0.7rem;
    font-size: 0.76rem;
  }
  .code :global(pre) {
    margin: 0;
    background: none;
    border: 0;
    padding: 0;
    box-shadow: none;
  }
  .code :global(code) {
    font-size: inherit;
  }
</style>
