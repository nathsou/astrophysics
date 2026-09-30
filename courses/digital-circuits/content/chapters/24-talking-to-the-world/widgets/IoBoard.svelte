<!--
  The Octet I/O board with a logic analyser clipped to its pins. Programs run on the reference interpreter at a clock of your
  choice; the analyser shows the last few milliseconds of the pins (LED 0, the PWM pin, the DAC, the button), and decodes the
  UART frames that the software UART puts on LED 0. Switches, a bouncing button and an analogue input let you talk back.

    ::io-board{program="uart" n="24.10" caption="…"}
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Devices, { type Device } from '../../23-running-programs/widgets/Devices.svelte';
  import TraceView from './TraceView.svelte';
  import { IoBoard } from './board';
  import { BOARD_PROGRAMS, boardProgram } from './programs';
  import { decodeUart, frameText, hexByte, registerProtocolDecoders } from './protocols';
  import type { DecodedRow, TraceChannel } from './trace';

  let { program = 'uart', title = 'The I/O board and its analyser', subtitle = 'Software talking to pins', n, caption, rate = 3 }: { program?: string; title?: string; subtitle?: string; n?: string | number; caption?: string; rate?: number } = $props();

  const RATES = [1e3, 1e4, 1e5, 1e6, 1e7];
  const rateLabel = (i: number) => {
    const r = RATES[Math.round(i)] ?? 1e6;
    return r >= 1e6 ? `${r / 1e6} MHz${r === 1e6 ? ' (real time)' : ''}` : `${r / 1e3} kHz`;
  };

  const first = untrack(() => boardProgram(program));
  const board = new IoBoard(first.source);
  const computer = board.computer;
  let chosen = $state(first.id);
  let source = $state(first.source);
  let rateIndex = $state(untrack(() => rate));
  let running = $state(false);
  let tick = $state(0);
  let note = $state('');
  let bounce = $state(true);
  let volts = $state(2.5);
  let zoom = $state(1);
  let btn = $state(0);
  let root: HTMLDivElement | undefined = $state();
  let visible = true;

  const meta = $derived(BOARD_PROGRAMS.find((p) => p.id === chosen) ?? first);
  const devices = $derived(meta.devices.filter((d) => d !== 'buttons') as Device[]);
  const usesButtons = $derived(meta.devices.includes('buttons'));
  const windowS = $derived((meta.windowMs / 1000) * zoom);

  // What the analyser and the board show now (recomputed every frame the machine has run).
  interface View {
    channels: TraceChannel[];
    decoded: DecodedRow[];
    text: string;
    pwm: number;
    dac: number;
    cycles: number;
    seconds: number;
  }
  function view(): View {
    void tick;
    const ch: TraceChannel[] = [];
    const rows: DecodedRow[] = [];
    let text = '';
    const W = windowS;
    const end = computer.machine.cycles;
    if (meta.show.includes('tx')) ch.push({ name: 'LED0 · TX', signal: board.led(0, W), tone: 5 });
    if (meta.show.includes('pwm')) ch.push({ name: 'PWM pin', signal: board.pwm(W), tone: 5 });
    if (meta.show.includes('dac')) {
      const d = board.dac(W);
      ch.push({ name: 'DAC', analog: { ...d, min: 0, max: 5, unit: ' V' }, tone: 1 });
      if (meta.id === 'sar') ch.push({ name: 'Vin', analog: { t: [0, W], v: [board.adcVolts, board.adcVolts], min: 0, max: 5, unit: ' V' }, tone: 4 });
    }
    if (meta.show.includes('leds') && usesButtons) ch.push({ name: 'BTN0 pin', signal: board.button(W), tone: 3 });
    if (meta.uartBit) {
      const baud = board.clockHz / meta.uartBit;
      const shown = decodeUart(board.led(0, W), { baud });
      rows.push({ name: `UART ${Math.round(baud)}`, notes: shown.map((f) => ({ t0: f.t0, t1: f.t1, text: f.framingError ? 'ERR' : hexByte(f.byte), error: f.framingError })) });
      // The terminal reads everything since the start, not just the window.
      text = frameText(decodeUart(board.led(0, Math.max(W, end / board.clockHz)), { baud }));
    }
    return { channels: ch, decoded: rows, text, pwm: computer.board.pwm, dac: computer.board.dac, cycles: end, seconds: end / board.clockHz };
  }
  const v = $derived(view());

  function refresh() {
    tick++;
  }

  // The clock.
  let budget = 0;
  let last = 0;
  let raf = 0;
  function frame(t: number) {
    raf = requestAnimationFrame(frame);
    if (!running || !visible || document.hidden) {
      last = t;
      return;
    }
    const dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
    last = t;
    budget += dt * RATES[Math.round(rateIndex)]!;
    const cycles = Math.floor(budget);
    if (cycles < 1) return;
    budget -= cycles;
    const r = computer.run(cycles);
    if (r.reason === 'halted') {
      running = false;
      note = `Halted after ${(computer.machine.cycles / board.clockHz) * 1e3 < 1 ? Math.round(computer.machine.cycles) + ' cycles' : ((computer.machine.cycles / board.clockHz) * 1e3).toFixed(2) + ' ms of board time'}.`;
    }
    refresh();
  }
  onMount(() => {
    registerProtocolDecoders(); // the bench's analyser can then decode these buses too
    let io: IntersectionObserver | undefined;
    if (root) {
      io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
      io.observe(root);
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  });

  function toggle() {
    if (computer.halted) return;
    if (!computer.ok) {
      note = 'Fix the errors in the source first.';
      return;
    }
    note = '';
    running = !running;
  }
  function step() {
    running = false;
    computer.stepInstruction();
    refresh();
  }
  function reset() {
    running = false;
    budget = 0;
    note = '';
    board.reset();
    refresh();
  }
  function pick(id: string) {
    chosen = id;
    const p = boardProgram(id);
    source = p.source;
    computer.setSource(source);
    zoom = 1;
    reset();
  }
  function edit() {
    computer.setSource(source);
    if (computer.machine.cycles === 0 && computer.ok) computer.load();
    refresh();
  }
  function press(k: number, down: boolean) {
    board.bouncy = bounce;
    board.press(k, down);
    btn = down ? btn | (1 << k) : btn & ~(1 << k);
    refresh();
  }
  $effect(() => {
    board.adcVolts = volts;
    untrack(refresh);
  });
  const errors = $derived((void tick, computer.diagnostics.filter((d) => d.severity === 'error')));
  const ms = (s: number) => (s * 1e3 < 10 ? (s * 1e3).toFixed(2) : (s * 1e3).toFixed(1));
  const bulb = $derived(v.pwm / 256);
  const code = $derived(Math.min(255, Math.floor((volts / 5) * 256)));
</script>

<Widget {title} {subtitle} {n} {caption} kind="Board" onreset={reset}>
  {#snippet controls()}
    <label class="pick ui">
      <span>Program</span>
      <select value={chosen} onchange={(e) => pick(e.currentTarget.value)}>
        {#each BOARD_PROGRAMS as p (p.id)}<option value={p.id}>{p.title}</option>{/each}
      </select>
    </label>
    <div class="run ui">
      <Button size="sm" variant="primary" onclick={toggle} disabled={computer.halted} aria-pressed={running}>{running ? 'Pause' : 'Run'}</Button>
      <Button size="sm" onclick={step} disabled={computer.halted}>Step</Button>
      <Button size="sm" onclick={reset}>Reset</Button>
    </div>
    <div class="speed"><Slider label="Clock speed" bind:value={rateIndex} min={0} max={RATES.length - 1} step={1} format={rateLabel} /></div>
  {/snippet}

  <div class="io" bind:this={root}>
    <p class="sum ui">{meta.summary} <span class="time">board time {ms(v.seconds)} ms · {v.cycles} cycles{note ? ' · ' + note : ''}</span></p>

    <div class="cols">
      <div class="left">
        {#if devices.length}<Devices {computer} {tick} show={devices} />{/if}

        <div class="extras">
          {#if usesButtons}
            <div class="ex">
              <span class="nm">BTN0 · BTN1</span>
              <div class="btns">
                {#each [0, 1] as k (k)}
                  <button
                    type="button"
                    class="pb"
                    class:down={!!(btn & (1 << k))}
                    aria-pressed={!!(btn & (1 << k))}
                    onpointerdown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      press(k, true);
                    }}
                    onpointerup={() => press(k, false)}
                    onpointercancel={() => press(k, false)}
                    onkeydown={(e) => {
                      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                        e.preventDefault();
                        press(k, true);
                      }
                    }}
                    onkeyup={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') press(k, false);
                    }}
                    onblur={() => btn & (1 << k) && press(k, false)}>BTN{k}</button
                  >
                {/each}
              </div>
              <label class="chk ui"><input type="checkbox" bind:checked={bounce} /> BTN0 bounces</label>
            </div>
          {/if}

          {#if meta.show.includes('pwm')}
            <div class="ex">
              <span class="nm">PWM LED</span>
              <span class="bulb" style="--level:{bulb}" role="img" aria-label="PWM LED at {Math.round(bulb * 100)} percent"></span>
              <span class="cap ui">duty {v.pwm}/256 = {Math.round(bulb * 100)} %</span>
            </div>
          {/if}

          {#if meta.show.includes('dac') || meta.id === 'sar'}
            <div class="ex">
              <span class="nm">DAC out</span>
              <span class="meter" role="img" aria-label="DAC output {(v.dac * 5 / 256).toFixed(2)} volts"><span style="width:{(v.dac / 255) * 100}%"></span></span>
              <span class="cap ui">{v.dac} → {((v.dac * 5) / 256).toFixed(2)} V</span>
            </div>
          {/if}

          {#if meta.id === 'sar'}
            <div class="ex wide">
              <Slider label="Analogue input" bind:value={volts} min={0} max={5} step={0.01} format={(x) => `${x.toFixed(2)} V → ${Math.min(255, Math.floor((x / 5) * 256))}`} />
              <span class="cap ui">Change it, press Reset, then Run: the program finds {code}.</span>
            </div>
          {/if}
        </div>
      </div>

      <div class="right">
        <div class="an">
          <div class="anhead ui">
            <span class="nm">Logic analyser · last {ms(windowS)} ms</span>
            <span class="zoom">
              <button type="button" class:on={zoom === 0.5} onclick={() => (zoom = 0.5)} aria-pressed={zoom === 0.5}>½×</button>
              <button type="button" class:on={zoom === 1} onclick={() => (zoom = 1)} aria-pressed={zoom === 1}>1×</button>
              <button type="button" class:on={zoom === 2} onclick={() => (zoom = 2)} aria-pressed={zoom === 2}>2×</button>
              <button type="button" class:on={zoom === 4} onclick={() => (zoom = 4)} aria-pressed={zoom === 4}>4×</button>
            </span>
          </div>
          <TraceView channels={v.channels} decoded={v.decoded} t0={0} t1={windowS} label="Pins of the board" rowHeight={meta.show.includes('dac') ? 54 : 32} />
        </div>
        {#if meta.uartBit}
          <div class="term">
            <span class="nm">UART terminal, decoded from LED 0</span>
            <pre aria-live="polite">{v.text || ' '}</pre>
          </div>
        {/if}
      </div>
    </div>

    <details class="src">
      <summary class="ui">Program source ({computer.program.size} bytes)</summary>
      <textarea bind:value={source} oninput={edit} spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" aria-label="Octet assembly source of the program on the board" rows={Math.min(22, source.split('\n').length + 1)}></textarea>
      {#if errors.length}<p class="err ui">Line {errors[0]!.line}: {errors[0]!.message}</p>{/if}
      <p class="cap ui">Edit the program and press Reset to run your version.</p>
    </details>
  </div>
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
    max-width: 100%;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font-size: 0.84rem;
    padding: 0 0.4rem;
  }
  .run {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .speed {
    flex: 1 1 11rem;
    min-width: 10rem;
    max-width: 18rem;
  }
  .io {
    container-type: inline-size;
    display: grid;
    gap: 0.9rem;
    min-width: 0;
  }
  .sum {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .time {
    display: block;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--mute);
    margin-top: 0.15rem;
  }
  .cols {
    display: grid;
    gap: 1.1rem;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
  }
  @container (min-width: 820px) {
    .cols {
      grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    }
  }
  .left,
  .right {
    display: grid;
    gap: 0.9rem;
    align-content: start;
    min-width: 0;
  }
  .extras {
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem 1.4rem;
    align-items: flex-start;
  }
  .ex {
    display: grid;
    gap: 0.3rem;
    justify-items: start;
  }
  .ex.wide {
    flex: 1 1 100%;
  }
  .nm {
    font-family: var(--font-mono);
    font-size: 0.64rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .btns {
    display: flex;
    gap: 6px;
  }
  .pb {
    min-width: 3.4rem;
    height: 2.2rem;
    border: 1.5px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    cursor: pointer;
    user-select: none;
    touch-action: none;
  }
  .pb.down {
    background: var(--sig-high);
    border-color: var(--sig-high);
    color: var(--on-accent);
    transform: translateY(1px);
  }
  .pb:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .chk {
    font-size: 0.78rem;
    color: var(--ink-2);
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }
  .bulb {
    width: 2.8rem;
    height: 2.8rem;
    border-radius: 50%;
    border: 2px solid var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) calc(var(--level) * 100%), var(--panel));
    box-shadow: 0 0 calc(var(--level) * 18px) var(--sig-high-glow);
  }
  .meter {
    display: block;
    width: 9rem;
    height: 0.8rem;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: var(--panel);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--series-1);
  }
  .cap {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--mute);
    margin: 0;
  }
  .an,
  .term {
    min-width: 0;
  }
  .anhead {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.3rem;
  }
  .zoom {
    display: inline-flex;
    gap: 2px;
  }
  .zoom button {
    min-width: 2rem;
    height: 1.6rem;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--ink-2);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    cursor: pointer;
  }
  .zoom button:first-child {
    border-radius: 5px 0 0 5px;
  }
  .zoom button:last-child {
    border-radius: 0 5px 5px 0;
  }
  .zoom button.on {
    background: var(--sig-high);
    border-color: var(--sig-high);
    color: var(--on-accent);
  }
  .term pre {
    margin: 0.3rem 0 0;
    min-height: 2.4rem;
    padding: 0.4rem 0.7rem;
    background: var(--scope-bg);
    color: var(--phosphor);
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.9rem;
    white-space: pre-wrap;
  }
  .src summary {
    cursor: pointer;
    font-size: 0.84rem;
    color: var(--ink-2);
  }
  .src textarea {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 0.5rem;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--panel);
    color: var(--fg);
    font-family: var(--font-mono);
    font-size: 0.76rem;
    line-height: 1.45;
    white-space: pre;
    overflow: auto;
  }
  .err {
    margin: 0.3rem 0 0;
    color: var(--bad);
    font-size: 0.8rem;
  }
</style>
