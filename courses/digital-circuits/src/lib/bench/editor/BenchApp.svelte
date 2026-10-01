<!--
  The bench page: toolbar, parts palette, canvas, inspector and instrument dock, status bar. On a narrow
  screen the palette and the dock become bottom sheets. The Bench (bench.svelte.ts) holds all the state.
-->
<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { base } from '$app/paths';
  import { replaceState } from '$app/navigation';
  import { nav } from '$lib/state/nav.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import Toggle from '../../components/ui/Toggle.svelte';
  import { formatSI, formatSpeed } from '../format';
  import { decodeShare, readShareHash } from '../share';
  import { Bench } from './bench.svelte';
  import Canvas from './Canvas.svelte';
  import Glyph, { type GlyphName } from './Glyph.svelte';
  import Inspector from './Inspector.svelte';
  import Menu from './Menu.svelte';
  import Palette from './Palette.svelte';
  import { EXAMPLES } from './examples';
  import { SPEED_MAX_INDEX, SPEED_MIN_INDEX, speedAt, speedIndex } from './sim';
  import InstrumentCard from '../instruments/InstrumentCard.svelte';
  import Multimeter from '../instruments/Multimeter.svelte';
  import Scope from '../instruments/Scope.svelte';
  import LogicAnalyser from '../instruments/LogicAnalyser.svelte';
  import LogicProbe from '../instruments/LogicProbe.svelte';
  import Supply from '../instruments/Supply.svelte';
  import Generator from '../instruments/Generator.svelte';
  import { KIND_BLURB, KIND_TITLES, type InstrumentKind } from '../instruments/kinds';

  const bench = new Bench();
  let canvas: Canvas | undefined = $state();
  let helpDialog: HTMLDialogElement | undefined = $state();
  let fileInput: HTMLInputElement | undefined = $state();

  // ── Layout: palette and dock, and their bottom-sheet form on a phone ───────
  let narrow = $state(false);
  let paletteOpen = $state(true);
  let sheet = $state<'parts' | 'dock' | null>(null);
  let dockWidth = $state(380);
  let resizing = false;
  const DOCK_KEY = 'dc-bench-dock';

  onMount(() => {
    const mq = matchMedia('(max-width: 760px)');
    narrow = mq.matches;
    const onMq = () => (narrow = mq.matches);
    mq.addEventListener('change', onMq);
    try {
      const w = Number(localStorage.getItem(DOCK_KEY));
      if (w >= 300 && w <= 900) dockWidth = w;
    } catch {
      /* storage unavailable */
    }
    return () => mq.removeEventListener('change', onMq);
  });
  function saveDock() {
    try {
      localStorage.setItem(DOCK_KEY, String(Math.round(dockWidth)));
    } catch {
      /* storage unavailable */
    }
  }
  const maxDock = () => Math.max(320, Math.min(760, window.innerWidth * 0.6));
  function resizeDown(ev: PointerEvent) {
    resizing = true;
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
  }
  function resizeMove(ev: PointerEvent) {
    if (!resizing) return;
    dockWidth = Math.max(300, Math.min(maxDock(), window.innerWidth - ev.clientX));
  }
  function resizeUp() {
    if (resizing) saveDock();
    resizing = false;
  }
  function resizeKey(ev: KeyboardEvent) {
    const d = ev.key === 'ArrowLeft' ? 24 : ev.key === 'ArrowRight' ? -24 : 0;
    if (!d) return;
    ev.preventDefault();
    dockWidth = Math.max(300, Math.min(maxDock(), dockWidth + d));
    saveDock();
  }

  // A pick on a phone: get the sheet out of the way, and bring it back afterwards.
  let reopenDock = false;
  $effect(() => {
    const picking = !!bench.pick;
    untrack(() => {
      if (!narrow) return;
      if (picking && sheet === 'dock') {
        sheet = null;
        reopenDock = true;
      } else if (!picking && reopenDock) {
        reopenDock = false;
        sheet = 'dock';
      }
    });
  });

  // ── Loading, autosaving, the frame loop ───────────────────────────────────
  let ready = $state(false);

  async function loadFromHash(): Promise<boolean> {
    const payload = readShareHash(location.hash);
    if (!payload) return false;
    try {
      const p = await decodeShare(payload);
      bench.load(p.circuit, p.extras);
      bench.say('Opened the shared circuit');
      // The circuit is on the bench now (and autosaved): keep the address short.
      replaceState(location.pathname + location.search, {});
      return true;
    } catch (e) {
      bench.say(e instanceof Error ? e.message : String(e), 'error');
      return false;
    }
  }

  onMount(() => {
    // Development hook for scripted checks.
    if (import.meta.env.DEV) (window as unknown as { __bench: Bench }).__bench = bench;
    nav.pageTitle = 'The bench';
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    // The bench covers the course sidebar and footer; keep them out of the tab order and away from screen readers.
    const footer = document.querySelector('footer.foot');
    footer?.setAttribute('inert', '');
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      bench.tick(dt);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!raf && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const vis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', vis);
    const onHash = () => void loadFromHash();
    window.addEventListener('hashchange', onHash);
    // Save the last edits when the page is left, without waiting for the debounce.
    const flush = () => ready && bench.autosave();
    window.addEventListener('pagehide', flush);
    void (async () => {
      if (!(await loadFromHash())) bench.restoreDraft();
      ready = true;
    })();
    start();
    return () => {
      stop();
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('pagehide', flush);
      flush();
      document.documentElement.style.overflow = prevOverflow;
      footer?.removeAttribute('inert');
      document.querySelector('.sidebar')?.removeAttribute('inert');
      nav.pageTitle = null;
      bench.stop();
    };
  });

  // The shared disclosure keeps the sidebar usable only while it is shown.
  $effect(() => {
    const open = nav.sidebarOpen;
    const el = document.querySelector('.sidebar');
    if (open) el?.removeAttribute('inert');
    else el?.setAttribute('inert', '');
  });

  // Autosave shortly after the circuit or the instruments change.
  $effect(() => {
    if (!ready) return;
    void bench.circuit;
    void JSON.stringify($state.snapshot(bench.instruments));
    void [bench.speed, bench.autoSpeed, bench.mode, bench.showCurrent];
    const t = setTimeout(() => bench.autosave(), 500);
    return () => clearTimeout(t);
  });

  // ── Actions ───────────────────────────────────────────────────────────────
  const dirty = () => bench.history.past.length > 0 && !bench.empty;
  const confirmReplace = () => !dirty() || confirm('Replace the circuit on the bench? Your changes will be lost (Undo will not bring them back).');

  function openExample(circuit: (typeof EXAMPLES)[number]['circuit'], close: () => void) {
    close();
    if (!confirmReplace()) return;
    bench.load(circuit);
    bench.say(`Opened “${circuit.title ?? 'example'}”`);
  }
  function newCircuit() {
    if (!confirmReplace()) return;
    bench.newCircuit();
  }
  async function share() {
    try {
      const url = await bench.shareLink();
      try {
        await navigator.clipboard.writeText(url);
        bench.say(`Link copied (${url.length.toLocaleString('en-GB')} characters)`);
      } catch {
        window.prompt('Copy this link', url);
      }
    } catch (e) {
      bench.say(e instanceof Error ? e.message : String(e), 'error');
    }
  }
  function exportJson() {
    const text = bench.exportJson();
    const name = (bench.circuit.title || 'circuit').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'circuit';
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.json` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    bench.say(`Saved ${name}.json`);
  }
  async function importFile(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      if (!confirmReplace()) return;
      bench.importText(text);
      bench.say(`Opened ${file.name}`);
    } catch (e) {
      bench.say(e instanceof Error ? e.message : String(e), 'error');
    }
  }

  const speedIdx = $derived(speedIndex(bench.effectiveSpeed));
  const following = $derived(bench.autoSpeed && !!bench.timeSpan);
  const status = $derived.by(() => {
    if (bench.error) return { text: bench.error, level: 'error' as const };
    const m = bench.messages.at(-1);
    if (m) return { text: m.text, level: m.level };
    if (bench.lagging) return { text: 'The circuit is faster than the browser can simulate: running slower than the speed you asked for.', level: 'warning' as const };
    if (bench.problems.length) return { text: `The ${bench.engineKind} engine cannot simulate ${bench.problems.slice(0, 3).join(', ')}${bench.problems.length > 3 ? '…' : ''}.`, level: 'warning' as const };
    if (bench.sim === 'edit') return { text: bench.empty ? 'Ready. Choose a part to begin.' : 'Editing. Press Run (Ctrl+Enter) to simulate.', level: 'info' as const };
    return { text: bench.sim === 'running' ? 'Running.' : 'Paused.', level: 'info' as const };
  });

  const KIND_ICON: Record<InstrumentKind, GlyphName> = { multimeter: 'meter', scope: 'wave', analyser: 'logic', logicprobe: 'lamp' };
  const KINDS: InstrumentKind[] = ['multimeter', 'scope', 'analyser', 'logicprobe'];
  let dockBody: HTMLDivElement | undefined = $state();
  async function addInstrument(kind: InstrumentKind) {
    const inst = bench.addInstrument(kind);
    if (narrow) sheet = 'dock';
    await tick();
    dockBody?.querySelector(`[data-instrument="${inst.id}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  let sourceCollapsed = $state<Record<string, boolean>>({});
  const ENGINES: { value: 'analog' | 'switch' | 'digital'; label: string; title: string }[] = [
    { value: 'analog', label: 'Analog', title: 'Voltages and currents' },
    { value: 'switch', label: 'Switch', title: 'Transistors as switches' },
    { value: 'digital', label: 'Digital', title: 'Logic values' },
  ];
</script>

{#snippet tool(icon: GlyphName, label: string, onclick: () => void, o: { disabled?: boolean; on?: boolean; key?: string; text?: string } = {})}
  <button type="button" class="tb" class:on={o.on} disabled={o.disabled} {onclick} aria-label={label} aria-pressed={o.on} title={o.key ? `${label} (${o.key})` : label}>
    <Glyph name={icon} size={18} />
    {#if o.text}<span class="tx">{o.text}</span>{/if}
  </button>
{/snippet}

<svelte:head>
  <title>The bench — Digital Circuits</title>
  <meta name="description" content="A sandbox for drawing circuits and measuring them with a multimeter, oscilloscope and logic analyser." />
</svelte:head>

<div class="bench" data-sim={bench.sim}>
  <h1 class="visually-hidden">The bench</h1>
  <!-- Toolbar -->
  <div class="toolbar ui" role="toolbar" aria-label="Bench tools">
    <div class="grp g-parts">
      <button type="button" class="tb wide" class:on={narrow ? sheet === 'parts' : paletteOpen} onclick={() => (narrow ? (sheet = sheet === 'parts' ? null : 'parts') : (paletteOpen = !paletteOpen))} aria-pressed={narrow ? sheet === 'parts' : paletteOpen} title="Parts palette">
        <Glyph name="parts" size={18} /><span class="tx">Parts</span>
      </button>
    </div>

    <div class="grp g-file">
      {@render tool('file', 'New circuit', newCircuit)}
      <Menu icon="folder" label="Examples" title="Open an example circuit">
        {#snippet children(close)}
          <ul class="examples">
            {#each EXAMPLES as ex (ex.key)}
              <li>
                <button type="button" onclick={() => openExample(ex.circuit, close)}>
                  <span class="t">{ex.title}</span>
                  <span class="e">{ex.engine}</span>
                </button>
              </li>
            {:else}
              <li class="none">No examples yet.</li>
            {/each}
          </ul>
        {/snippet}
      </Menu>
      {@render tool('upload', 'Import a JSON circuit', () => fileInput?.click())}
      {@render tool('download', 'Export as JSON', exportJson)}
      {@render tool('share', 'Copy a share link', share)}
      <input bind:this={fileInput} type="file" accept=".json,application/json" onchange={importFile} hidden />
    </div>

    <div class="grp g-edit">
      {@render tool('undo', 'Undo', () => bench.undo(), { disabled: !bench.canUndo, key: 'Ctrl+Z' })}
      {@render tool('redo', 'Redo', () => bench.redo(), { disabled: !bench.canRedo, key: 'Ctrl+Shift+Z' })}
      <span class="sep"></span>
      {@render tool('select', 'Select and move', () => (bench.tool = 'select'), { on: bench.tool === 'select', key: 'V' })}
      {@render tool('wire', 'Draw wires', () => (bench.tool = bench.tool === 'wire' ? 'select' : 'wire'), { on: bench.tool === 'wire', key: 'W' })}
    </div>

    <div class="grp g-sim">
      <span class="engine-tb">
        <Segmented size="sm" label="Simulation engine" options={ENGINES} value={bench.engineKind} onchange={(k) => bench.setEngineKind(k)} />
      </span>
      <button type="button" class="tb run" class:on={bench.sim === 'running'} onclick={() => bench.toggleRun()} aria-label={bench.sim === 'running' ? 'Pause' : 'Run'} title="{bench.sim === 'running' ? 'Pause' : 'Run'} (Ctrl+Enter)">
        <Glyph name={bench.sim === 'running' ? 'pause' : 'play'} size={18} /><span class="tx">{bench.sim === 'running' ? 'Pause' : bench.sim === 'paused' ? 'Resume' : 'Run'}</span>
      </button>
      {@render tool('stop', 'Stop and edit', () => bench.stop(), { disabled: bench.sim === 'edit' })}
      {@render tool('step', 'Step: a twentieth of a second at this speed', () => void bench.step())}
      {@render tool('reset', 'Reset to time zero', () => void bench.reset(), { disabled: bench.sim === 'edit' })}
      <Menu label={formatSpeed(bench.effectiveSpeed)} title="Simulation speed: simulated time per real second">
        {#snippet children()}
          <div class="speedmenu">
            <label class="speed">
              <span class="cap label-caps">Speed</span>
              <input
                type="range"
                min={SPEED_MIN_INDEX}
                max={SPEED_MAX_INDEX}
                step="1"
                value={speedIdx}
                disabled={following}
                oninput={(ev) => bench.setSpeed(speedAt(Number(ev.currentTarget.value)))}
                aria-valuetext="{formatSpeed(bench.effectiveSpeed)} of simulated time per second"
              />
              <output class="num">{formatSpeed(bench.effectiveSpeed)}</output>
            </label>
            <p class="hint">Simulated time per second of real time. Slow it down to watch fast circuits; speed it up to wait for slow ones.</p>
            {#if bench.timeSpan}
              <Toggle label="Follow the instrument's time scale" bind:checked={bench.autoSpeed} />
            {/if}
          </div>
        {/snippet}
      </Menu>
    </div>

    <div class="grp g-view">
      <Menu icon="eye" label="View" title="Wire colours, current dots" align="right" compact>
        {#snippet children()}
          <div class="viewmenu">
            <span class="cap label-caps">Wire colours</span>
            <Segmented
              size="sm"
              label="Wire colours"
              options={[
                { value: 'voltage', label: 'Volts' },
                { value: 'logic', label: 'Logic' },
                { value: 'plain', label: 'Ink' },
              ]}
              bind:value={bench.mode}
            />
            <Toggle label="Current dots (analog)" bind:checked={bench.showCurrent} />
            <div class="only-narrow">
              <span class="cap label-caps">Simulation engine</span>
              <Segmented size="sm" label="Simulation engine" options={ENGINES} value={bench.engineKind} onchange={(k) => bench.setEngineKind(k)} />
            </div>
            <button type="button" class="linkish" onclick={() => bench.fit()}>Fit circuit to view</button>
          </div>
        {/snippet}
      </Menu>
      {@render tool('panel', 'Instruments and inspector', () => (narrow ? (sheet = sheet === 'dock' ? null : 'dock') : undefined), { on: sheet === 'dock' })}
      {@render tool('help', 'Keyboard shortcuts and help', () => helpDialog?.showModal(), { key: '?' })}
    </div>
  </div>

  <!-- Work area -->
  <div class="work" class:sheet-open={narrow && sheet !== null} style:--dock-w="{dockWidth}px">
    <aside class="side palette" class:open={sheet === 'parts'} class:hidden={!narrow && !paletteOpen} aria-label="Parts palette">
      <div class="sheet-head ui">
        <span>Parts</span>
        <button type="button" onclick={() => (sheet = null)} aria-label="Close"><Glyph name="close" size={16} /></button>
      </div>
      <Palette {bench} onplace={(type) => canvas?.placeAtCentre(type)} onpicked={() => narrow && (sheet = null)} />
    </aside>

    <div class="stage">
      <Canvas {bench} bind:this={canvas} onhelp={() => helpDialog?.showModal()} />
      {#if narrow && sheet === null && !bench.pick}
        <button type="button" class="fab ui" onclick={() => (sheet = 'dock')} aria-label="Open the inspector and instruments">
          <Glyph name="panel" size={18} />
          <span>{bench.selectedComponents.length === 1 && !bench.selection.wires.size ? bench.selectedComponents[0]!.id : bench.instruments.length ? 'Instruments' : 'Inspector'}</span>
        </button>
      {/if}
    </div>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div class="resizer" role="separator" aria-orientation="vertical" aria-label="Resize the instrument panel" aria-valuenow={Math.round(dockWidth)} aria-valuemin={300} aria-valuemax={760} tabindex="0" onpointerdown={resizeDown} onpointermove={resizeMove} onpointerup={resizeUp} onpointercancel={resizeUp} onkeydown={resizeKey}></div>

    <aside class="side dock" class:open={sheet === 'dock'} aria-label="Inspector and instruments">
      <div class="sheet-head ui">
        <span>Inspector and instruments</span>
        <button type="button" onclick={() => (sheet = null)} aria-label="Close"><Glyph name="close" size={16} /></button>
      </div>
      <div class="dock-body" bind:this={dockBody}>
        <InstrumentCard title="Inspector" icon="select" subtitle={bench.selection.ids.size === 1 ? 'part' : 'selection'}>
          <Inspector {bench} />
        </InstrumentCard>

        {#each bench.instruments as inst (inst.id)}
          <InstrumentCard id={inst.id} title={KIND_TITLES[inst.kind]} icon={KIND_ICON[inst.kind]} subtitle={inst.id} bind:collapsed={inst.collapsed} onclose={() => bench.removeInstrument(inst.id)}>
            {#if inst.kind === 'multimeter'}<Multimeter {bench} {inst} />
            {:else if inst.kind === 'scope'}<Scope {bench} {inst} />
            {:else if inst.kind === 'analyser'}<LogicAnalyser {bench} {inst} />
            {:else}<LogicProbe {bench} {inst} />{/if}
          </InstrumentCard>
        {/each}

        {#each bench.sources as comp (comp.id)}
          <InstrumentCard
            title={comp.id}
            icon={comp.type === 'supply' ? 'bolt' : 'wave'}
            subtitle={comp.type === 'supply' ? 'Bench supply' : 'Function generator'}
            bind:collapsed={sourceCollapsed[comp.id]}
          >
            {#if comp.type === 'supply'}<Supply {bench} {comp} />{:else}<Generator {bench} {comp} />{/if}
          </InstrumentCard>
        {/each}

        <section class="add" aria-label="Add an instrument">
          <h3 class="label-caps">Add an instrument</h3>
          <div class="tiles">
            {#each KINDS as kind (kind)}
              <button type="button" onclick={() => addInstrument(kind)}>
                <Glyph name={KIND_ICON[kind]} size={20} />
                <span class="n">{KIND_TITLES[kind]}</span>
                <span class="b">{KIND_BLURB[kind]}</span>
              </button>
            {/each}
          </div>
        </section>
      </div>
    </aside>
  </div>

  <!-- Status bar -->
  <div class="statusbar ui" role="status">
    <span class="msg {status.level}">{status.text}</span>
    <span class="chips">
      <span class="chip">{bench.engineKind}</span>
      <span class="chip state" data-s={bench.sim}>{bench.sim === 'edit' ? 'editing' : bench.sim}</span>
      {#if bench.engine}<span class="chip num">t = {formatSI(bench.simTime, 's', 3)}</span>{/if}
      {#if bench.cursor}<span class="chip num hide-narrow">{bench.cursor[0]}, {bench.cursor[1]}</span>{/if}
    </span>
  </div>

  {#if bench.notice}
    {#key bench.notice.id}
      <div class="toast ui {bench.notice.level}" role="status">{bench.notice.text}</div>
    {/key}
  {/if}

  <dialog bind:this={helpDialog} class="help ui" aria-labelledby="help-title">
    <form method="dialog">
      <header>
        <h2 id="help-title">The bench</h2>
        <button type="submit" aria-label="Close help"><Glyph name="close" size={18} /></button>
      </header>
      <p class="lead">Draw a circuit, press Run, and measure it. Everything happens in your browser; the circuit is autosaved and can be shared as a link.</p>
      <div class="cols">
        <section>
          <h3>Mouse and touch</h3>
          <dl>
            <dt>Click a part</dt><dd>Select it. Shift adds to the selection.</dd>
            <dt>Drag a part</dt><dd>Move it; its wires follow.</dd>
            <dt>Drag from a pin</dt><dd>Draw a wire. Click to turn a corner; click a pin or wire to finish.</dd>
            <dt>Drag a wire</dt><dd>Slide that segment sideways.</dd>
            <dt>Drag the background</dt><dd>Select everything inside the box.</dd>
            <dt>Space + drag, middle button, or two fingers</dt><dd>Pan.</dd>
            <dt>Wheel or pinch</dt><dd>Zoom.</dd>
            <dt>Right-click</dt><dd>Cancel what you are doing.</dd>
          </dl>
        </section>
        <section>
          <h3>Keyboard</h3>
          <dl>
            <dt><kbd>R</kbd> · <kbd>F</kbd></dt><dd>Rotate · flip left–right (<kbd>Shift</kbd>+<kbd>F</kbd> top–bottom)</dd>
            <dt><kbd>Del</kbd></dt><dd>Delete the selection</dd>
            <dt><kbd>Ctrl</kbd>+<kbd>D</kbd> · <kbd>C</kbd> · <kbd>X</kbd> · <kbd>V</kbd></dt><dd>Duplicate · copy · cut · paste</dd>
            <dt><kbd>Ctrl</kbd>+<kbd>Z</kbd> · <kbd>Shift</kbd>+<kbd>Z</kbd></dt><dd>Undo · redo</dd>
            <dt><kbd>Ctrl</kbd>+<kbd>A</kbd></dt><dd>Select all</dd>
            <dt><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd></dt><dd>Move the selection one grid step (<kbd>Shift</kbd>: five); pan when nothing is selected</dd>
            <dt><kbd>W</kbd> · <kbd>V</kbd> · <kbd>Esc</kbd></dt><dd>Wire tool · select tool · cancel</dd>
            <dt><kbd>Tab</kbd> · <kbd>Enter</kbd></dt><dd>While wiring: change the bend · end the wire here</dd>
            <dt><kbd>+</kbd> <kbd>−</kbd> <kbd>0</kbd></dt><dd>Zoom in · out · fit to view</dd>
            <dt><kbd>Ctrl</kbd>+<kbd>Enter</kbd></dt><dd>Run or pause</dd>
          </dl>
        </section>
      </div>
      <p class="tip">Open the instrument panel and add a multimeter, oscilloscope, logic analyser or logic probe. Each has probe sockets: click one, then click a pin or wire on the schematic. Bench supplies and function generators you place get their own front panels.</p>
    </form>
  </dialog>
</div>

<style>
  .bench {
    position: fixed;
    inset: calc(3.5rem + var(--course-nav-height)) 0 0 0;
    z-index: 30;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-columns: minmax(0, 1fr);
    background: var(--bg);
    color: var(--fg);
    font-family: var(--font-ui);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  @media (min-width: 1100px) {
    :global(:root:not([data-sidebar='collapsed'])) .bench {
      left: var(--sidebar-w);
    }
  }

  /* Toolbar */
  .toolbar {
    --strip: light-dark(#e8e0d0, #131c29);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.45rem;
    padding: 0.35rem 0.5rem;
    background: linear-gradient(to bottom, color-mix(in srgb, light-dark(#ebe4d6, #131c29) 70%, var(--panel)), light-dark(#ebe4d6, #131c29));
    border-bottom: 1px solid var(--line-strong);
    min-height: 3rem;
  }
  .grp {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    flex: none;
  }
  .g-sim {
    gap: 0.2rem;
  }
  .g-view {
    margin-left: auto;
  }
  .sep {
    width: 1px;
    height: 1.4rem;
    margin: 0 0.3rem;
    background: var(--line-strong);
  }
  .tb {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    height: 2.1rem;
    min-width: 2.1rem;
    padding: 0 0.5rem;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: 7px;
    background: none;
    color: var(--ink-2);
    font: inherit;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background-color 120ms, border-color 120ms, color 120ms;
  }
  .tb:hover:not(:disabled) {
    background: var(--panel);
    border-color: var(--line);
    color: var(--fg);
  }
  .tb:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .tb.on {
    background: var(--panel);
    border-color: var(--line-strong);
    color: var(--fg);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sig-high) 60%, transparent);
  }
  .tb.run {
    padding: 0 0.85rem 0 0.7rem;
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
    box-shadow: var(--shadow);
  }
  .tb.run:hover:not(:disabled) {
    background: var(--accent-ink);
    border-color: var(--accent-ink);
    color: var(--on-accent);
  }
  .tb.run.on {
    background: var(--panel);
    color: var(--fg);
    border-color: var(--phosphor);
    box-shadow: 0 0 0 1px var(--phosphor), 0 0 10px -2px var(--phosphor-glow);
  }
  .speedmenu {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.55rem 0.6rem;
    width: 17rem;
  }
  .speed {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.6rem;
  }
  .speed input {
    min-width: 0;
    accent-color: var(--copper);
  }
  .speed output {
    min-width: 4.2rem;
    text-align: right;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    color: var(--fg);
  }
  .speedmenu .cap {
    font-size: 0.64rem;
    color: var(--mute);
  }
  .hint {
    margin: 0;
    font-size: 0.76rem;
    line-height: 1.45;
    color: var(--mute);
  }
  .examples {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .examples button {
    display: flex;
    width: 100%;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0.65rem;
    border: 0;
    border-radius: 7px;
    background: none;
    color: var(--fg);
    font: inherit;
    font-size: 0.86rem;
    text-align: left;
    cursor: pointer;
  }
  .examples button:hover {
    background: var(--pn);
  }
  .examples .e {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .examples .none {
    padding: 0.6rem;
    color: var(--mute);
  }
  .viewmenu {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.7rem;
    padding: 0.5rem 0.55rem;
  }
  .cap {
    font-size: 0.64rem;
    color: var(--mute);
  }
  .only-narrow {
    display: none;
    flex-direction: column;
    gap: 0.35rem;
  }
  .linkish {
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 0.84rem;
    text-decoration: underline;
    text-underline-offset: 0.2em;
    cursor: pointer;
  }

  /* Work area */
  .work {
    display: flex;
    min-height: 0;
    min-width: 0;
  }
  .side {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--panel);
  }
  .palette {
    flex: 0 0 16.5rem;
    border-right: 1px solid var(--line-strong);
  }
  .palette.hidden {
    display: none;
  }
  .stage {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }
  .resizer {
    flex: 0 0 7px;
    margin-left: -3px;
    margin-right: -3px;
    z-index: 3;
    cursor: col-resize;
    background: transparent;
    position: relative;
    touch-action: none;
  }
  .resizer::after {
    content: '';
    position: absolute;
    left: 3px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--line-strong);
    transition: background-color 120ms, width 120ms;
  }
  .resizer:hover::after,
  .resizer:focus-visible::after {
    background: var(--copper);
    width: 3px;
    left: 2px;
  }
  .dock {
    flex: 0 0 var(--dock-w);
    border-left: 0;
    background: color-mix(in srgb, var(--pn) 55%, var(--bg));
  }
  .dock-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    scrollbar-width: thin;
  }
  .dock-body > :global(*) {
    flex: none;
  }
  .sheet-head {
    display: none;
  }
  .add h3 {
    margin: 0.4rem 0 0.5rem;
    font-size: 0.64rem;
    color: var(--mute);
  }
  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  .tiles button {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    column-gap: 0.55rem;
    align-items: center;
    padding: 0.55rem 0.7rem;
    border: 1px dashed var(--line-strong);
    border-radius: 9px;
    background: var(--panel);
    color: var(--ink-2);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .tiles button:hover {
    border-style: solid;
    border-color: var(--copper);
    color: var(--fg);
  }
  .tiles :global(svg) {
    grid-row: span 2;
    color: var(--copper-ink);
  }
  .tiles .n {
    font-size: 0.84rem;
    font-weight: 600;
    color: var(--fg);
  }
  .tiles .b {
    font-size: 0.7rem;
    color: var(--mute);
    line-height: 1.3;
  }

  .fab {
    position: absolute;
    left: 0.75rem;
    bottom: 0.75rem;
    z-index: 4;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    height: 2.6rem;
    padding: 0 1rem 0 0.8rem;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--panel);
    color: var(--fg);
    font: inherit;
    font-size: 0.86rem;
    font-weight: 600;
    box-shadow: var(--shadow-lg);
    cursor: pointer;
  }

  /* Status bar */
  .statusbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.28rem 0.8rem;
    border-top: 1px solid var(--line-strong);
    background: var(--panel);
    font-size: 0.76rem;
    min-height: 1.9rem;
  }
  .msg {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ink-2);
  }
  .msg.warning {
    color: var(--maybe);
  }
  .msg.error {
    color: var(--bad);
    font-weight: 600;
  }
  .chips {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex: none;
  }
  .chip {
    padding: 0.05rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--bg);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--ink-2);
  }
  .chip.state[data-s='running'] {
    color: var(--phosphor-ink);
    border-color: color-mix(in srgb, var(--phosphor) 50%, var(--line));
  }
  .toast {
    position: absolute;
    left: 50%;
    bottom: 2.6rem;
    transform: translateX(-50%);
    max-width: min(32rem, calc(100% - 2rem));
    padding: 0.5rem 1rem;
    border-radius: 999px;
    background: var(--fg);
    color: var(--bg);
    font-size: 0.84rem;
    box-shadow: var(--shadow-lg);
    animation: toast-in 180ms ease-out;
    z-index: 50;
  }
  .toast.error {
    background: var(--bad);
    color: #fff;
  }
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translate(-50%, 8px);
    }
  }

  /* Help */
  .help {
    width: min(46rem, calc(100% - 2rem));
    max-height: calc(100% - 2rem);
    padding: 0;
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    background: var(--panel);
    color: var(--fg);
    box-shadow: var(--shadow-lg);
  }
  .help::backdrop {
    background: rgb(10 15 23 / 0.5);
  }
  .help form {
    padding: 1.2rem 1.5rem 1.4rem;
  }
  .help header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .help h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.3rem;
    letter-spacing: -0.015em;
  }
  .help header button {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: none;
    color: var(--ink-2);
    cursor: pointer;
  }
  .help .lead {
    margin: 0.4rem 0 1rem;
    color: var(--ink-2);
    font-size: 0.9rem;
  }
  .cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
    gap: 1.2rem 2rem;
  }
  .help h3 {
    margin: 0 0 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .help dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.4rem 0.9rem;
    margin: 0;
    font-size: 0.82rem;
  }
  .help dt {
    font-weight: 600;
  }
  .help dd {
    margin: 0;
    color: var(--ink-2);
  }
  .help .tip {
    margin: 1.1rem 0 0;
    padding: 0.7rem 0.9rem;
    border-radius: 8px;
    background: var(--copper-soft);
    font-size: 0.84rem;
    line-height: 1.5;
  }
  kbd {
    font-family: var(--font-mono);
    font-size: 0.74em;
    padding: 0.05rem 0.35rem;
    border: 1px solid var(--line-strong);
    border-bottom-width: 2px;
    border-radius: 4px;
    background: var(--pn);
  }

  /* Narrower screens drop the words next to icons, then wrap onto a second row. */
  @media (max-width: 1420px) {
    .tb .tx {
      display: none;
    }
    .tb.wide .tx,
    .tb.run .tx {
      display: inline;
    }
  }
  @media (max-width: 760px) {
    .toolbar {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      gap: 0.25rem 0.5rem;
      padding: 0.3rem 0.5rem;
    }
    .toolbar::-webkit-scrollbar {
      display: none;
    }
    /* A shadow at the right edge says there is more to scroll to; it goes away at the end. */
    .toolbar {
      background:
        linear-gradient(to left, var(--strip) 30%, transparent) right / 1.6rem 100% no-repeat local,
        linear-gradient(to left, color-mix(in srgb, var(--fg) 22%, transparent), transparent) right / 0.9rem 100% no-repeat scroll,
        var(--strip);
    }
    .engine-tb {
      display: none;
    }
    .only-narrow {
      display: flex;
    }
    .g-parts {
      order: 0;
    }
    .g-sim {
      order: 1;
    }
    .g-edit {
      order: 2;
    }
    .g-file {
      order: 3;
    }
    .g-view {
      order: 4;
      margin-left: 0;
    }
    .work {
      position: relative;
      --sheet-h: min(56vh, 32rem);
    }
    /* An open sheet takes the bottom of the screen; the canvas keeps the rest, so the circuit stays in view. */
    .work.sheet-open .stage {
      margin-bottom: var(--sheet-h);
    }
    .side {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 36;
      flex: none;
      width: auto;
      height: var(--sheet-h);
      border: 0;
      border-top: 1px solid var(--line-strong);
      border-radius: 14px 14px 0 0;
      box-shadow: 0 -12px 40px -12px rgb(0 0 0 / 0.5);
      transform: translateY(105%);
      visibility: hidden;
      transition: transform 220ms ease, visibility 0s linear 220ms;
    }
    .side.open {
      transform: none;
      visibility: visible;
      transition: transform 220ms ease;
    }
    .palette.hidden {
      display: flex;
    }
    .sheet-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.55rem 0.9rem;
      border-bottom: 1px solid var(--line);
      font-weight: 600;
      font-size: 0.92rem;
    }
    .sheet-head button {
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: none;
      color: var(--ink-2);
    }
    .resizer {
      display: none;
    }
    .statusbar .hide-narrow {
      display: none;
    }
    .tiles {
      grid-template-columns: 1fr;
    }
    .help form {
      padding: 1rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .side,
    .toast {
      transition: none;
      animation: none;
    }
  }
</style>
