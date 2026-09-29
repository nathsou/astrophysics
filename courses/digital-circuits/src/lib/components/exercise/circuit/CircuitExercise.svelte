<!--
  The shell of the circuit exercises (build, debug, golf): a palette of the allowed parts, the editing canvas,
  a live "try it" panel on the digital engine, Check, and the result with the counterexample. Passing a
  build exercise for a part stores the circuit in the reader's parts bin.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { base } from '$app/paths';
  import ExerciseFrame from '../ExerciseFrame.svelte';
  import Schematic from '$lib/bench/Schematic.svelte';
  import Glyph from '$lib/bench/editor/Glyph.svelte';
  import ParamField from '$lib/bench/editor/ParamField.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { progress } from '$lib/state/progress.svelte';
  import { partsBin } from '$lib/partsbin/store.svelte';
  import { PARTS, getPart } from '$lib/partsbin/parts';
  import { getDef, allDefs, withDefaults } from '$lib/sim/netlist/catalog';
  import type { Circuit } from '$lib/sim/netlist/types';
  import { CircuitBench, findClock } from '$lib/sim/check';
  import { isCircuit } from '$lib/partsbin/store-core';
  import { EditorState } from './editor.svelte';
  import BuildCanvas from './BuildCanvas.svelte';
  import { allowedTypes, golfScore, runCheck, startCircuit, tableFor, type BuildInput, type Outcome } from './spec';

  let { spec, kind }: { spec: BuildInput; kind: 'Build' | 'Debug' | 'Golf' } = $props();

  const uid = $props.id();
  const part = $derived(spec.part ? getPart(spec.part) : undefined);
  const parts = $derived(partsBin.resolver());
  const start = untrack(() => startCircuit(spec));
  const saved = untrack(() => {
    const d = progress.draft<unknown>(spec.id, null);
    return isCircuit(d) ? d : null;
  });
  const editor = new EditorState(saved ?? start, { parts: untrack(() => partsBin.resolver()), locked: (c) => c.type === 'port' && !spec.start });
  onMount(() => {
    partsBin.load();
    progress.load();
  });

  // ── The palette ────────────────────────────────────────────────────────────
  const palette = $derived.by(() => {
    const out: { type: string; name: string; title: string }[] = [];
    for (const t of allowedTypes(spec)) {
      if (t === 'part:*') {
        for (const p of PARTS) if (p.status === 'reference' && p.id !== spec.part && (!part || p.chapter < part.chapter)) out.push({ type: `part:${p.id}`, name: p.name, title: p.description });
      } else if (t.startsWith('part:')) {
        const p = getPart(t.slice(5));
        if (p) out.push({ type: t, name: p.name, title: p.description });
      } else {
        const d = getDef(t);
        if (d) out.push({ type: t, name: d.name.replace(/ \(inverter\)| gate/i, ''), title: d.description ?? d.name });
      }
    }
    // Wires need something to attach to: offer a net label as well.
    return out;
  });
  const previews = new Map<string, Circuit>();
  const preview = (type: string): Circuit => {
    let c = previews.get(type);
    if (!c) previews.set(type, (c = { version: 1, components: [{ id: 'X', type, x: 0, y: 0, label: '' }], wires: [] }));
    return c;
  };

  /** Click: the next click on the canvas places the part. Enter or Space (no pointer): put one down at once. */
  function choose(ev: MouseEvent, type: string) {
    if (ev.detail === 0) {
      editor.place(type);
      editor.placing = null;
    } else editor.placing = editor.placing === type ? null : type;
  }

  // ── Check ──────────────────────────────────────────────────────────────────
  let outcome = $state.raw<Outcome | null>(null);
  let attempts = $state(0);
  let checking = $state(false);
  let addedToBin = $state(false);
  let staleOutcome = $state(false);
  let best = $state<number | undefined>(untrack(() => (kind === 'Golf' ? progress.draft<number | undefined>(`${spec.id}#best`, undefined) : undefined)));
  const table = $derived(tableFor(spec, parts));
  const score = $derived(outcome?.cost ? golfScore(spec, outcome.cost) : undefined);

  async function check() {
    checking = true;
    // Let the button show its state before the simulation blocks the thread.
    await new Promise((r) => setTimeout(r, 30));
    const r = runCheck(spec, editor.circuit, parts);
    outcome = r;
    staleOutcome = false;
    attempts++;
    checking = false;
    if (r.pass) {
      progress.markSolved(spec.id);
      if (spec.part && part) {
        partsBin.set(spec.part, $state.snapshot(editor.circuit) as Circuit, { gates: r.cost?.gates, transistors: r.cost?.transistors, depth: r.cost?.depth, from: spec.id });
        addedToBin = true;
      }
      if (kind === 'Golf' && r.cost) {
        const s = golfScore(spec, r.cost);
        if (s && (best === undefined || s.strokes < best)) {
          best = s.strokes;
          progress.saveDraft(`${spec.id}#best`, best);
        }
      }
    }
  }

  // Edits make the last verdict stale; drafts are saved as the reader works.
  let draftTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    void editor.revision;
    untrack(() => {
      if (outcome) staleOutcome = true;
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => progress.saveDraft(spec.id, $state.snapshot(editor.circuit)), 500);
    });
  });

  function resetToStart() {
    editor.reset(start);
    outcome = null;
    addedToBin = false;
  }

  // ── Trying it live ─────────────────────────────────────────────────────────
  let bench = $state.raw<CircuitBench | null>(null);
  let benchError = $state('');
  let values = $state<Record<string, number>>({});
  let tick = $state(0);
  let buildTimer: ReturnType<typeof setTimeout> | undefined;
  const engineKind = $derived(editor.circuit.engine ?? spec.spec?.engine ?? part?.engine ?? 'digital');
  const hasSwitches = $derived(editor.circuit.components.some((c) => ['toggle', 'button', 'switch', 'spdt', 'pushbutton'].includes(c.type)));
  $effect(() => {
    void editor.revision;
    void parts;
    untrack(() => {
      clearTimeout(buildTimer);
      buildTimer = setTimeout(rebuild, 120);
    });
    return () => clearTimeout(buildTimer);
  });
  function rebuild() {
    const c = editor.circuit;
    if (!c.components.length) {
      bench = null;
      benchError = '';
      return;
    }
    try {
      const b = new CircuitBench(c, { parts, engine: engineKind, settleSeconds: engineKind === 'digital' ? undefined : spec.spec?.settle ?? 0.05 });
      const v: Record<string, number> = {};
      for (const n of b.inputs) {
        v[n] = values[n] ?? 0;
        b.set(n, v[n]);
      }
      b.settle();
      values = v;
      bench = b;
      benchError = b.errors()[0] ?? '';
      tick++;
    } catch (e) {
      bench = null;
      benchError = e instanceof Error ? e.message : String(e);
    }
  }
  function toggle(name: string) {
    if (!bench) return;
    values[name] = values[name] ? 0 : 1;
    bench.set(name, values[name]!);
    bench.settle();
    tick++;
  }
  const clockName = $derived(bench ? findClock(bench.inputs) : undefined);
  function pulse() {
    if (!bench || !clockName) return;
    bench.set(clockName, 1);
    bench.settle();
    tick++;
    bench.set(clockName, 0);
    bench.settle();
    values[clockName] = 0;
    tick++;
  }
  const outs = $derived.by(() => {
    void tick;
    return bench ? bench.outputs.map((n) => ({ name: n, v: bench!.get(n) })) : [];
  });
  const glyph = ['0', '1', 'X', 'Z'];

  // Run analogue and switch-level circuits in real time (LEDs, RC circuits), while the exercise is on screen.
  let root: HTMLElement | undefined = $state();
  let visible = $state(false);
  onMount(() => {
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting), { rootMargin: '100px' });
    if (root) io.observe(root);
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      const b = bench;
      if (visible && b && b.kind !== 'digital' && dt > 0) {
        try {
          b.engine.advance(dt);
        } catch {
          /* the engine reports its own problems */
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  });

  // ── Selection details (parameters, swapping) ───────────────────────────────
  const selected = $derived.by(() => {
    const id = [...editor.selection.ids][0];
    return editor.selection.ids.size === 1 ? editor.circuit.components.find((c) => c.id === id) : undefined;
  });
  const selectedDef = $derived(selected ? getDef(selected.type) : undefined);
  const editableParams = $derived(selectedDef?.params?.filter((p) => !['delay', 'clkToQ', 'setup', 'hold', 'tau', 'init'].includes(p.key) || kind === 'Debug') ?? []);
  const swaps = $derived.by(() => {
    if (!selected || !selectedDef) return [];
    const same = allowedTypes(spec).filter((t) => t !== selected.type && !t.startsWith('part:') && getDef(t)?.category === selectedDef.category);
    return same.map((t) => ({ type: t, name: getDef(t)!.name.replace(/ gate.*/i, '') }));
  });
  let swapNote = $state('');
  function swap(type: string) {
    if (!selected) return;
    swapNote = editor.swapType(selected.id, type) ? '' : 'That part has different pins, so it cannot replace this one in place. Delete it and place the other.';
  }

  // Keyboard-only wiring.
  let pinA = $state('');
  let pinB = $state('');
  let wireNote = $state('');
  const pinList = $derived(editor.pins());
  function connectPins() {
    wireNote = pinA && pinB ? (editor.connect(pinA, pinB) ? `Connected ${pinA} to ${pinB}.` : 'Those pins are already connected, or the same pin.') : 'Choose two pins.';
  }

  let showSolution = $state(false);
  const wireName = (i: number): string => {
    const w = editor.circuit.wires[i]!;
    const at = (p: [number, number]) => pinList.find((x) => x.x === p[0] && x.y === p[1])?.ref ?? `(${p[0]}, ${p[1]})`;
    return `${at(w.points[0]!)} to ${at(w.points[w.points.length - 1]!)}`;
  };
  const cx = $derived(outcome?.seq?.counterexample);
</script>

<ExerciseFrame id={spec.id} {kind} title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []}>
  <div class="ex" bind:this={root}>
    <div class="palette ui" role="group" aria-label="Parts you can place">
      {#each palette as p (p.type)}
        <button type="button" class="part" class:on={editor.placing === p.type} aria-pressed={editor.placing === p.type} title={p.title} onclick={(ev) => choose(ev, p.type)}>
          <span class="thumb" aria-hidden="true"><Schematic circuit={preview(p.type)} {parts} scale={0.55} interactive={false} live={false} /></span>
          <span class="pname">{p.name}</span>
        </button>
      {/each}
    </div>

    <div class="tools ui" role="toolbar" aria-label="Editing tools">
      <button type="button" onclick={editor.rotate} disabled={!editor.selection.ids.size} title="Rotate (R)"><Glyph name="rotate" size={15} /><span>Rotate</span></button>
      <button type="button" onclick={editor.remove} disabled={!editor.selection.ids.size && !editor.selection.wires.size} title="Delete (Delete)"><Glyph name="trash" size={15} /><span>Delete</span></button>
      <button type="button" onclick={editor.undo} disabled={!editor.canUndo} title="Undo (Ctrl+Z)"><Glyph name="undo" size={15} /><span>Undo</span></button>
      <button type="button" onclick={editor.redo} disabled={!editor.canRedo} title="Redo (Ctrl+Shift+Z)"><Glyph name="redo" size={15} /><span>Redo</span></button>
      <button type="button" onclick={resetToStart} title="Go back to the starting circuit"><Glyph name="reset" size={15} /><span>Start again</span></button>
    </div>

    <BuildCanvas {editor} {parts} engine={bench?.engine ?? null} label={spec.title ?? 'Circuit editor'} />

    {#if selected}
      <div class="inspect ui" aria-live="polite">
        <strong>{selected.id}</strong>
        <span class="muted">{selectedDef?.name ?? selected.type}</span>
        {#if swaps.length}
          <label class="swap"
            >Change to
            <select onchange={(e) => (swap(e.currentTarget.value), (e.currentTarget.value = ''))}>
              <option value="">…</option>
              {#each swaps as s (s.type)}<option value={s.type}>{s.name}</option>{/each}
            </select></label
          >
        {/if}
        {#each editableParams as def (def.key)}
          <ParamField {def} value={withDefaults(selectedDef!, selected.params)[def.key]!} onchange={(v) => editor.setParam(selected!.id, def.key, v)} />
        {/each}
        {#if swapNote}<p class="note">{swapNote}</p>{/if}
      </div>
    {/if}

    <details class="precise ui">
      <summary>Edit without a pointer: parts, pins and wires as lists</summary>
      <div class="cols">
        <fieldset>
          <legend>Parts on the canvas</legend>
          <ul>
            {#each editor.circuit.components as c (c.id)}
              <li>
                <button type="button" class:on={editor.selection.ids.has(c.id)} aria-pressed={editor.selection.ids.has(c.id)} onclick={() => editor.select([c.id])}>{c.id}<span class="muted">&nbsp;{c.type.replace(/^part:/, '')}</span></button>
              </li>
            {/each}
          </ul>
          <p class="hint">Select a part, then use Rotate, Delete or the arrow keys on the canvas.</p>
        </fieldset>
        <fieldset>
          <legend>Connect two pins</legend>
          <label for="{uid}-a">From</label>
          <select id="{uid}-a" bind:value={pinA}>
            <option value="">Choose a pin…</option>
            {#each pinList as p (p.ref)}<option value={p.ref}>{p.label}</option>{/each}
          </select>
          <label for="{uid}-b">To</label>
          <select id="{uid}-b" bind:value={pinB}>
            <option value="">Choose a pin…</option>
            {#each pinList as p (p.ref)}<option value={p.ref}>{p.label}</option>{/each}
          </select>
          <button type="button" class="go" onclick={connectPins}>Connect</button>
          <p class="hint" role="status">{wireNote}</p>
        </fieldset>
        <fieldset>
          <legend>Wires</legend>
          <ul>
            {#each editor.circuit.wires as _, i (i)}
              <li>
                <button type="button" class:on={editor.selection.wires.has(i)} aria-pressed={editor.selection.wires.has(i)} onclick={() => editor.select([], [i])}>{wireName(i)}</button>
              </li>
            {:else}
              <li class="muted">No wires yet.</li>
            {/each}
          </ul>
        </fieldset>
      </div>
    </details>

    {#if bench && bench.inputs.length}
      <div class="try ui" aria-label="Try the circuit">
        <span class="lab">Try it</span>
        <div class="row">
          {#each bench.inputs as n (n)}
            <button type="button" class="sw" class:on={values[n]} role="switch" aria-checked={!!values[n]} aria-label="Input {n}" onclick={() => toggle(n)}><span class="nm">{n}</span><span class="v num">{values[n] ? 1 : 0}</span></button>
          {/each}
          {#if clockName}<button type="button" class="pulse" onclick={pulse} title="Send one clock pulse (0 → 1 → 0)"><Glyph name="wave" size={15} /> Pulse {clockName}</button>{/if}
        </div>
        <span class="arrow" aria-hidden="true">→</span>
        <div class="row" aria-live="polite">
          {#each outs as o (o.name)}
            <span class="led" class:hi={o.v === 1} class:x={o.v > 1} title="Output {o.name}"><span class="nm">{o.name}</span><span class="v num">{glyph[o.v]}</span></span>
          {/each}
        </div>
      </div>
    {:else if !bench && editor.circuit.components.some((c) => c.type !== 'port')}
      <p class="muted ui small">{benchError ? `The circuit does not run yet: ${benchError}` : ''}</p>
    {/if}
    {#if benchError && bench}<p class="warn ui small">{benchError}</p>{/if}

    <div class="checkrow ui">
      <button type="button" class="check" onclick={check} disabled={checking}><Icon name="check" size={15} /> {checking ? 'Checking…' : 'Check'}</button>
      {#if outcome?.cost || bench}
        <span class="cost num" aria-label="Size of the circuit">
          {#if outcome?.cost}{outcome.cost.gates} gate{outcome.cost.gates === 1 ? '' : 's'} · about {outcome.cost.transistors} transistors · depth {outcome.cost.depth}{/if}
          {#if spec.budget?.gates !== undefined} · budget {spec.budget.gates} gates{/if}
        </span>
      {/if}
      {#if kind === 'Golf' && spec.par !== undefined}<span class="par">Par {spec.par} {spec.metric ?? 'gates'}{#if best !== undefined} · best {best > 0 ? '+' : ''}{best}{/if}</span>{/if}
    </div>

    <div class="result ui" role="status" aria-live="polite">
      {#if outcome}
        <div class="verdict" class:ok={outcome.pass} class:bad={!outcome.pass}>
          <strong>{outcome.pass ? '✓' : '✗'} {outcome.headline}</strong>
          {#if staleOutcome}<span class="stale">(you have changed the circuit since)</span>{/if}
        </div>
        {#if outcome.pass && kind === 'Golf' && score}
          <p class="score"><strong>{score.name}</strong>: {score.value} {score.metric} against a par of {score.par} ({score.strokes > 0 ? '+' : ''}{score.strokes}).</p>
        {/if}
        {#each outcome.problems as p (p)}<p class="prob">{p}</p>{/each}
        {#each outcome.violations as v (v)}<p class="prob">{v}</p>{/each}

        {#if outcome.comb && outcome.comb.failures.length}
          {#if table && outcome.comb.rows}
            <table class="tt num" aria-label="Truth table with your circuit's result on each row">
              <thead><tr>{#each table.inputs as n (n)}<th>{n}</th>{/each}<th class="gap"></th>{#each table.outputs as n (n)}<th>{n}</th>{/each}<th class="gap"></th><th>Yours</th></tr></thead>
              <tbody>
                {#each table.rows as r, i (i)}
                  {@const f = outcome.comb.failures.find((x) => x.index === i)}
                  <tr class:fail={outcome.comb.rows[i] === 'fail'} class:skip={outcome.comb.rows[i] === 'skip'}>
                    {#each r.inputs as v, k (k)}<td>{v}</td>{/each}<td class="gap"></td>
                    {#each r.outputs as v, k (k)}<td class:wrong={f?.wrong.includes(table.outputs[k]!)}>{v ?? '–'}</td>{/each}<td class="gap"></td>
                    <td>{#if f}{table.outputs.map((n) => `${n}=${f.got[n]}`).join(' ')}{:else if outcome.comb.rows[i] === 'pass'}✓{:else}–{/if}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {:else}
            <ul class="fails">
              {#each outcome.comb.failures as f (f.index)}
                <li>
                  With <code>{Object.entries(f.inputs).map(([k, v]) => `${k}=${v}`).join(' ')}</code>: {f.wrong.map((n) => `${n} should be ${f.expected[n]}, but is ${f.got[n]}`).join('; ')}.
                </li>
              {/each}
            </ul>
          {/if}
          <p class="muted small">{outcome.comb.failCount} of {outcome.comb.total} {outcome.comb.sampled ? 'sampled ' : ''}input combinations are wrong.</p>
        {:else if outcome.comb?.pass}
          <p class="muted small">All {outcome.comb.total} {outcome.comb.sampled ? 'sampled ' : ''}input combinations give the right answer.</p>
        {/if}

        {#if cx}
          <div class="seq">
            <p>The circuit and the specification part company at cycle {cx.cycle + 1}, {cx.phase}: {cx.wrong.map((n) => `${n} should be ${cx.expected[n]}, but is ${cx.got[n]}`).join('; ')}.</p>
            <div class="scroll">
              <table class="tt num" aria-label="The input sequence that shows the difference">
                <thead><tr><th>cycle</th>{#each Object.keys(cx.sequence[0] ?? {}) as n (n)}<th>{n}</th>{/each}</tr></thead>
                <tbody>
                  {#each cx.sequence as row, i (i)}
                    <tr class:fail={i === cx.cycle}><td>{i + 1}</td>{#each Object.values(row) as v, k (k)}<td>{v}</td>{/each}</tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {:else if outcome.seq?.pass}
          <p class="muted small">{outcome.seq.proven ? `Checked against every input sequence (${outcome.seq.states} states explored) and ${outcome.seq.cycles} random cycles.` : `Checked over ${outcome.seq.cycles} clock cycles of directed and random input.`}</p>
        {/if}

        {#if outcome.scenarios?.failures.length}
          <ul class="fails">
            {#each outcome.scenarios.failures as f (f.scenario + f.target)}
              <li>{f.scenario}: <code>{f.target}</code> should be {f.expected}, but is {f.got}.</li>
            {/each}
          </ul>
        {/if}

        {#if outcome.pass && spec.explain}<div class="explain">{@html spec.explain}</div>{/if}
      {:else}
        <p class="muted small">
          {#if kind === 'Debug'}Find what is wrong, fix it, then press Check.{:else}Build it, try it with the switches, then press Check.{/if}
        </p>
      {/if}
    </div>

    {#if addedToBin && part}
      <div class="bin" role="status">
        <span class="binthumb" aria-hidden="true"><Schematic circuit={{ version: 1, components: [{ id: 'X', type: `part:${part.id}`, x: 0, y: 0, label: '' }], wires: [] }} {parts} scale={0.9} interactive={false} live={false} /></span>
        <div>
          <p class="bt">{part.name} is now in your parts bin</p>
          <p class="bs">
            {#if part.substitutable}Later chapters will build with your version{partsBin.useMine ? '' : ' once you switch “use my parts” on'}.{:else}It is transistor-level, so circuits built from gates keep using a single gate in its place.{/if}
            <a href="{base}/parts/#{part.id}">Open the parts bin</a>
          </p>
        </div>
      </div>
    {/if}

    {#if spec.solution}
      <div class="sol ui">
        <button type="button" onclick={() => (showSolution = !showSolution)} aria-expanded={showSolution}><Icon name="eye" size={14} /> {showSolution ? 'Hide the solution' : 'Show a solution'}</button>
        {#if showSolution}
          <div class="solbody">
            <Schematic circuit={spec.solution} {parts} scale={1} interactive={false} live={false} label="A solution" />
            <button type="button" onclick={() => spec.solution && editor.reset(spec.solution)}>Load it into the editor</button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</ExerciseFrame>

<style>
  .ex {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
  }
  .ui {
    font-family: var(--font-ui);
  }
  .palette {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .part {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.15rem 0.6rem 0.15rem 0.3rem;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--surface);
    color: var(--ink);
    font-size: 0.8rem;
    cursor: pointer;
    min-height: 2.2rem;
  }
  .part:hover,
  .part.on {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .part.on {
    background: var(--copper-soft);
  }
  .thumb {
    display: inline-grid;
    place-items: center;
    width: 2.4rem;
    height: 1.7rem;
    overflow: hidden;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .tools button,
  .go,
  .sol button,
  .solbody button {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 0.25rem 0.6rem;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--ink);
    cursor: pointer;
    min-height: 2rem;
  }
  .tools button:hover:not(:disabled),
  .go:hover,
  .sol button:hover,
  .solbody button:hover {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .tools button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .inspect {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    font-size: 0.82rem;
  }
  .inspect .swap select,
  .precise select {
    font: inherit;
    padding: 0.2rem 0.3rem;
    background: var(--surface);
    color: var(--ink);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
  }
  .muted {
    color: var(--ink-3);
  }
  .small {
    font-size: 0.8rem;
    margin: 0.25rem 0;
  }
  .note,
  .warn {
    color: var(--warn, var(--bad));
    margin: 0;
    font-size: 0.8rem;
  }
  .precise {
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 0.3rem 0.7rem;
    font-size: 0.82rem;
    background: var(--surface);
  }
  .precise summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--ink-2);
  }
  .cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.6rem;
    margin-top: 0.5rem;
  }
  fieldset {
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    margin: 0;
    padding: 0.4rem 0.6rem 0.6rem;
    min-width: 0;
    display: grid;
    gap: 0.25rem;
    align-content: start;
  }
  legend {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-3);
    padding: 0 0.3rem;
  }
  fieldset ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  fieldset li {
    margin: 0;
  }
  fieldset li button {
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 6px;
    padding: 0.15rem 0.5rem;
    font: inherit;
    font-size: 0.78rem;
    color: var(--ink);
    cursor: pointer;
  }
  fieldset li button.on {
    border-color: var(--focus);
    background: color-mix(in srgb, var(--focus) 12%, transparent);
  }
  .hint {
    margin: 0;
    color: var(--ink-3);
    font-size: 0.76rem;
  }
  .try {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.8rem;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }
  .lab {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--ink-3);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: center;
  }
  .sw,
  .led,
  .pulse {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 2.2rem;
    padding: 0.1rem 0.55rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
    font-size: 0.8rem;
  }
  .sw {
    cursor: pointer;
  }
  .sw.on {
    border-color: var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) 18%, var(--surface));
  }
  .sw:focus-visible,
  .pulse:focus-visible,
  .check:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .pulse {
    cursor: pointer;
  }
  .nm {
    font-weight: 700;
  }
  .v {
    min-width: 0.7rem;
    text-align: center;
    font-weight: 700;
  }
  .led.hi {
    border-color: var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) 30%, var(--surface));
    box-shadow: 0 0 8px var(--sig-high-glow, transparent);
  }
  .led.x {
    border-color: var(--sig-x);
    color: var(--sig-x);
  }
  .arrow {
    color: var(--ink-3);
  }
  .checkrow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--copper);
    background: var(--copper-soft);
    color: var(--copper-ink);
    border-radius: var(--radius-sm);
    padding: 0.35rem 1rem;
    font: inherit;
    font-weight: 700;
    min-height: 2.4rem;
    cursor: pointer;
  }
  .check:hover:not(:disabled) {
    background: var(--copper);
    color: var(--on-accent, #fff);
  }
  .cost,
  .par {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .verdict {
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-sm);
    border-left: 3px solid var(--line-strong);
    font-size: 0.9rem;
  }
  .verdict.ok {
    border-color: var(--ok);
    background: var(--ok-soft);
    color: var(--ink);
  }
  .verdict.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .stale {
    color: var(--ink-3);
    font-size: 0.78rem;
    margin-left: 0.5rem;
  }
  .prob,
  .score {
    margin: 0.3rem 0;
    font-size: 0.85rem;
  }
  .tt {
    border-collapse: collapse;
    font-size: 0.8rem;
    margin: 0.4rem 0;
  }
  .tt th,
  .tt td {
    padding: 0.1rem 0.5rem;
    text-align: center;
    border-bottom: 1px solid var(--line);
  }
  .tt th {
    color: var(--ink-3);
    font-weight: 700;
  }
  .tt .gap {
    width: 0.5rem;
    padding: 0;
    border-bottom-color: transparent;
  }
  .tt tr.fail td:not(.gap) {
    background: var(--bad-soft);
  }
  .tt td.wrong {
    color: var(--bad);
    font-weight: 800;
  }
  .tt tr.skip {
    color: var(--ink-3);
  }
  .scroll {
    overflow-x: auto;
  }
  .fails {
    margin: 0.3rem 0;
    padding-left: 1.2rem;
    font-size: 0.85rem;
  }
  .explain {
    margin-top: 0.5rem;
    padding: 0.5rem 0.8rem 0.1rem;
    border-left: 3px solid var(--ok);
    background: var(--surface-2);
    font-family: var(--font-body);
    font-size: 0.98rem;
  }
  .bin {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.6rem 0.9rem;
    border: 1px solid var(--ok);
    border-radius: var(--radius-sm);
    background: linear-gradient(90deg, var(--ok-soft), transparent);
    animation: bin-in 0.5s ease-out;
  }
  .binthumb {
    flex: none;
    display: grid;
    place-items: center;
    min-width: 5rem;
    padding: 0.3rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--surface);
  }
  .bt {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.05rem;
  }
  .bs {
    margin: 0.15rem 0 0;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  @keyframes bin-in {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.98);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .bin {
      animation: none;
    }
  }
  .solbody {
    display: grid;
    gap: 0.5rem;
    justify-items: start;
    margin-top: 0.5rem;
    max-width: 100%;
    overflow-x: auto;
  }
  @media (max-width: 520px) {
    .tools button span {
      display: none;
    }
    .bin {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
