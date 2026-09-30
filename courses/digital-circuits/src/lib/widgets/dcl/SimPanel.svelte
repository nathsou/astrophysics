<!--
  Drives a design in the RTL simulator: switches for 1-bit inputs, number fields (with bit buttons for narrow
  ones) for buses, a clock with Step and Run, and the outputs and registers as LEDs and hex readouts.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { bin, hex, type RtlDriver } from './rtlDriver.svelte';

  let { driver, oninput, ontick, onreset }: {
    driver: RtlDriver;
    /** Called after the reader changed an input. */
    oninput?: (name: string, value: bigint) => void;
    ontick?: () => void;
    onreset?: () => void;
  } = $props();

  let running = $state(false);
  let rate = $state(4);
  let timer: ReturnType<typeof setInterval> | undefined;

  function stop() {
    running = false;
    if (timer) clearInterval(timer);
    timer = undefined;
  }
  function tick() {
    driver.tick();
    ontick?.();
  }
  function toggleRun() {
    if (running) return stop();
    running = true;
    timer = setInterval(tick, 1000 / rate);
  }
  $effect(() => {
    // Change of speed while running.
    const r = rate;
    if (running) {
      if (timer) clearInterval(timer);
      timer = setInterval(tick, 1000 / r);
    }
  });
  onDestroy(stop);

  function set(name: string, v: bigint) {
    driver.set(name, v);
    oninput?.(name, driver.values[name] ?? v);
  }

  /** Reads a number the reader typed: decimal, 0x hex, 0b binary. */
  function parse(text: string): bigint | undefined {
    const t = text.trim().replace(/_/g, '');
    if (!/^(0x[0-9a-f]+|0b[01]+|[0-9]+)$/i.test(t)) return undefined;
    try {
      return BigInt(t);
    } catch {
      return undefined;
    }
  }
  function commit(name: string, width: number, ev: Event) {
    const el = ev.currentTarget as HTMLInputElement;
    const v = parse(el.value);
    if (v === undefined) {
      el.value = String(driver.values[name] ?? 0n);
      return;
    }
    set(name, v & ((1n << BigInt(width)) - 1n));
    el.value = String(driver.values[name] ?? 0n);
  }
  const clock = $derived(driver.inputs.find((p) => p.clock));
  const data = $derived(driver.inputs.filter((p) => !p.clock));
</script>

{#if !driver.ready}
  <p class="empty ui">{driver.error || 'Fix the errors in the source to simulate it.'}</p>
{:else}
  <div class="sim ui">
    {#if clock || driver.registers.length}
      <div class="clockbar">
        {#if clock}
          <button class="btn primary" type="button" onclick={tick} title="One rising edge of {clock.name}">Step clock</button>
          <button class="btn" type="button" onclick={toggleRun} aria-pressed={running}>{running ? 'Pause' : 'Run'}</button>
          <label class="rate">
            <span class="sr">Clock speed</span>
            <select bind:value={rate} aria-label="Clock speed">
              <option value={1}>1 Hz</option>
              <option value={4}>4 Hz</option>
              <option value={16}>16 Hz</option>
            </select>
          </label>
        {/if}
        <button class="btn" type="button" onclick={() => { stop(); driver.reset(); onreset?.(); }}>Reset</button>
        <span class="cycle" aria-live="off">cycle {driver.cycle}</span>
      </div>
    {/if}

    {#if data.length}
      <section aria-label="Inputs">
        <h5>Inputs</h5>
        <ul>
          {#each data as p (p.name)}
            {@const v = driver.values[p.name] ?? 0n}
            <li>
              <span class="name">{p.name}<small>{p.width === 1 ? 'bit' : `bits<${p.width}>`}</small></span>
              {#if p.width === 1}
                <button class="sw" type="button" role="switch" aria-checked={v === 1n} aria-label={p.name} onclick={() => set(p.name, v === 1n ? 0n : 1n)}>
                  <span class="track"><span class="thumb"></span></span>
                  <span class="val">{v}</span>
                </button>
              {:else}
                <span class="bus">
                  <input
                    class="num"
                    type="text"
                    inputmode="numeric"
                    value={String(v)}
                    aria-label="{p.name} (decimal, 0x… or 0b…)"
                    onchange={(ev) => commit(p.name, p.width, ev)}
                    onkeydown={(ev) => ev.key === 'Enter' && (ev.currentTarget as HTMLInputElement).blur()}
                  />
                  <span class="hexv">{hex(v, p.width)}</span>
                  {#if p.width <= 8}
                    <span class="bits" role="group" aria-label="{p.name} bits">
                      {#each Array.from({ length: p.width }, (_, i) => p.width - 1 - i) as i (i)}
                        <button type="button" class="bit" class:on={((v >> BigInt(i)) & 1n) === 1n} aria-pressed={((v >> BigInt(i)) & 1n) === 1n} aria-label="{p.name} bit {i}" onclick={() => set(p.name, v ^ (1n << BigInt(i)))}>{(v >> BigInt(i)) & 1n}</button>
                      {/each}
                    </span>
                  {/if}
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section aria-label="Outputs">
      <h5>Outputs</h5>
      <ul>
        {#each driver.outputs as p (p.name)}
          {@const v = driver.values[p.name] ?? 0n}
          <li>
            <span class="name">{p.name}<small>{p.width === 1 ? 'bit' : `bits<${p.width}>`}</small></span>
            {#if p.width === 1}
              <span class="led" class:on={v === 1n} role="img" aria-label="{p.name} is {v}"></span>
              <span class="val">{v}</span>
            {:else}
              <span class="readout" aria-label="{p.name} is {v}">{hex(v, p.width)}</span>
              <span class="dec">{v}</span>
              <span class="binv">{bin(v, p.width)}</span>
            {/if}
          </li>
        {/each}
      </ul>
    </section>

    {#if driver.registers.length}
      <section aria-label="Registers">
        <h5>Registers</h5>
        <ul class="regs">
          {#each driver.registers as r (r.name)}
            {@const v = driver.values[r.name] ?? 0n}
            <li>
              <span class="name">{r.name}<small>{r.width === 1 ? 'bit' : `bits<${r.width}>`}</small></span>
              <span class="readout small">{r.width === 1 ? String(v) : hex(v, r.width)}</span>
              {#if r.width > 1}<span class="dec">{v}</span>{/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>
{/if}

<style>
  .sim {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.9rem;
    font-size: 0.86rem;
  }
  .empty {
    color: var(--mute);
    margin: 0.5rem 0;
    font-size: 0.86rem;
  }
  h5 {
    margin: 0 0 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--mute);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.4rem;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.8rem;
    min-height: 1.9rem;
  }
  .name {
    display: inline-flex;
    align-items: baseline;
    gap: 0.4rem;
    min-width: 6.5rem;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    color: var(--fg);
  }
  .name small {
    font-size: 0.66rem;
    color: var(--mute);
  }
  .clockbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.5rem;
    padding-bottom: 0.7rem;
    border-bottom: 1px solid var(--line);
  }
  .btn {
    height: 1.9rem;
    padding: 0 0.75rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
  }
  .btn:hover {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
  }
  .btn.primary:hover {
    background: var(--accent-ink);
    border-color: var(--accent-ink);
    color: var(--on-accent);
  }
  .btn[aria-pressed='true'] {
    background: var(--copper-soft);
    border-color: var(--copper);
  }
  .btn:focus-visible,
  .sw:focus-visible,
  .bit:focus-visible,
  .num:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  select {
    height: 1.9rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font: inherit;
    font-size: 0.8rem;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .cycle {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--mute);
    font-variant-numeric: tabular-nums;
  }
  /* A slide switch: on is HIGH (amber), off is LOW (slate). */
  .sw {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border: 0;
    background: transparent;
    padding: 0.15rem;
    cursor: pointer;
    color: var(--fg);
    font: inherit;
  }
  .track {
    width: 36px;
    height: 20px;
    border-radius: 99px;
    background: var(--surface-3);
    border: 1px solid var(--line-strong);
    position: relative;
    transition: background-color 150ms, border-color 150ms;
  }
  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--panel);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.35);
    transition: transform 150ms;
  }
  .sw[aria-checked='true'] .track {
    background: var(--sig-high);
    border-color: var(--sig-high);
    box-shadow: 0 0 8px var(--sig-high-glow);
  }
  .sw[aria-checked='true'] .thumb {
    transform: translateX(16px);
  }
  .val,
  .dec,
  .hexv {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }
  .bus {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.7rem;
  }
  .num {
    width: 7.2rem;
    height: 1.9rem;
    padding: 0 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font-family: var(--font-mono);
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
  }
  .bits {
    display: inline-flex;
    gap: 2px;
  }
  .bit {
    width: 1.5rem;
    height: 1.9rem;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: var(--surface-3);
    color: var(--ink-2);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    cursor: pointer;
    padding: 0;
  }
  .bit.on {
    background: var(--sig-high);
    border-color: var(--sig-high);
    color: #1a1204;
    box-shadow: 0 0 6px var(--sig-high-glow);
  }
  .led {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--surface-3);
    border: 1px solid var(--line-strong);
    transition: background-color 120ms, box-shadow 120ms;
  }
  .led.on {
    background: var(--phosphor);
    border-color: var(--phosphor);
    box-shadow: 0 0 9px var(--phosphor-glow), 0 0 2px var(--phosphor);
  }
  .readout {
    min-width: 2.6rem;
    padding: 0.1rem 0.55rem;
    border-radius: 5px;
    background: var(--scope-bg);
    color: var(--phosphor);
    font-family: var(--font-mono);
    font-size: 1.05rem;
    font-weight: 500;
    text-align: center;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 0 8px var(--phosphor-glow);
  }
  .readout.small {
    font-size: 0.86rem;
  }
  .binv {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--mute);
    letter-spacing: 0.06em;
  }
</style>
