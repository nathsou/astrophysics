<!--
  The devices of the Octet board, wired to an OctetComputer: eight LEDs, eight switches, four push buttons, two
  hexadecimal 7-segment digits, an 8 × 8 LED matrix and a text console. Used by the computer of Chapter 23 and
  by the I/O board of Chapter 24. The parent bumps `tick` whenever the machine has run, so the devices redraw.
-->
<script lang="ts" module>
  export type Device = 'leds' | 'switches' | 'buttons' | 'hex' | 'console' | 'matrix';
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import { HEX_SEGMENTS, segmentPaths } from '$lib/bench/symbols/sevenseg';
  import type { OctetComputer } from './computer';

  let { computer, tick, show = ['leds', 'switches', 'buttons', 'hex'] }: { computer: OctetComputer; tick: number; show?: Device[] } = $props();

  const board = untrack(() => computer.board);
  let switches = $state(board.switches);
  let buttons = $state(board.buttons);
  let typed = $state('');

  const leds = $derived((void tick, computer.board.leds));
  const hex = $derived((void tick, computer.board.hex & 0xff));
  const matrix = $derived((void tick, [...computer.board.matrix]));
  const consoleText = $derived((void tick, computer.board.consoleText));
  const waiting = $derived((void tick, computer.board.consoleInput.length));

  function flip(bit: number) {
    switches ^= 1 << bit;
    computer.board.switches = switches;
  }
  function press(n: number, down: boolean) {
    buttons = down ? buttons | (1 << n) : buttons & ~(1 << n);
    computer.board.buttons = buttons;
  }
  function send(ev: SubmitEvent) {
    ev.preventDefault();
    computer.board.type(typed + '\n');
    typed = '';
  }

  // Seven-segment geometry, as in the bench's display.
  const CW = 38;
  const CH = 64;
  const PATHS = segmentPaths(4, 4, CW - 12, CH - 8, 7);
  const bits = [7, 6, 5, 4, 3, 2, 1, 0];
</script>

<div class="devices">
  {#if show.includes('leds')}
    <div class="dev">
      <span class="name">LEDS <code>0xF8</code></span>
      <div class="row" role="img" aria-label="LEDs: {leds.toString(2).padStart(8, '0')}">
        {#each bits as b (b)}
          <span class="led" class:on={!!(leds & (1 << b))}></span>
        {/each}
      </div>
      <div class="row lbl" aria-hidden="true">{#each bits as b (b)}<span>{b}</span>{/each}</div>
    </div>
  {/if}

  {#if show.includes('switches')}
    <div class="dev">
      <span class="name">SWITCHES <code>0xF9</code></span>
      <div class="row">
        {#each bits as b (b)}
          <button type="button" class="sw" class:on={!!(switches & (1 << b))} role="switch" aria-checked={!!(switches & (1 << b))} aria-label="Switch {b}" onclick={() => flip(b)}></button>
        {/each}
      </div>
      <div class="row lbl" aria-hidden="true">{#each bits as b (b)}<span>{b}</span>{/each}</div>
    </div>
  {/if}

  {#if show.includes('buttons')}
    <div class="dev">
      <span class="name">BUTTONS <code>0xFA</code></span>
      <div class="row btns">
        {#each [0, 1, 2, 3] as n (n)}
          <button
            type="button"
            class="btn"
            class:down={!!(buttons & (1 << n))}
            aria-pressed={!!(buttons & (1 << n))}
            onpointerdown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              press(n, true);
            }}
            onpointerup={() => press(n, false)}
            onpointercancel={() => press(n, false)}
            onkeydown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault();
                press(n, true);
              }
            }}
            onkeyup={(e) => {
              if (e.key === ' ' || e.key === 'Enter') press(n, false);
            }}
            onblur={() => press(n, false)}>BTN{n}</button
          >
        {/each}
      </div>
    </div>
  {/if}

  {#if show.includes('hex')}
    <div class="dev">
      <span class="name">HEX <code>0xFB</code></span>
      <svg class="seg" viewBox="0 0 {2 * CW} {CH}" role="img" aria-label="Hexadecimal display: {hex.toString(16).toUpperCase().padStart(2, '0')}">
        {#each [hex >> 4, hex & 15] as digit, i (i)}
          <g transform="translate({i * CW} 0) skewX(-4)">
            {#each PATHS as d, s (s)}
              <path {d} class="s" class:on={!!(HEX_SEGMENTS[digit]! & (1 << s))} />
            {/each}
          </g>
        {/each}
      </svg>
    </div>
  {/if}

  {#if show.includes('matrix')}
    <div class="dev">
      <span class="name">MATRIX <code>0xF0–0xF7</code></span>
      <div class="matrix" role="img" aria-label="8 by 8 LED matrix">
        {#each matrix as row, y (y)}
          {#each bits as b (b)}
            <span class="px" class:on={!!(row & (1 << b))}></span>
          {/each}
        {/each}
      </div>
    </div>
  {/if}

  {#if show.includes('console')}
    <div class="dev con">
      <span class="name">CONSOLE <code>0xFC</code></span>
      <pre class="screen" aria-live="off" aria-label="Console output">{consoleText || ' '}</pre>
      <form onsubmit={send}>
        <input type="text" bind:value={typed} aria-label="Type to the console" placeholder="type here, then Enter" autocomplete="off" spellcheck="false" />
        <span class="wait">{waiting ? `${waiting} waiting` : ''}</span>
      </form>
    </div>
  {/if}
</div>

<style>
  .devices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem 1.6rem;
    align-items: flex-start;
  }
  .dev {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
  }
  .name {
    font-family: var(--font-mono);
    font-size: 0.64rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .name code {
    font-size: inherit;
    letter-spacing: 0;
    background: none;
    padding: 0;
    color: var(--mute);
    text-transform: none;
  }
  .row {
    display: flex;
    gap: 5px;
  }
  .lbl span {
    width: 1.35rem;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.6rem;
    color: var(--mute);
  }
  .led {
    width: 1.35rem;
    height: 1.35rem;
    border-radius: 50%;
    border: 1.5px solid var(--sig-low);
    background: color-mix(in srgb, var(--sig-low) 14%, var(--panel));
  }
  .led.on {
    border-color: var(--sig-high);
    background: var(--sig-high);
    box-shadow: 0 0 9px var(--sig-high-glow);
  }
  .sw {
    width: 1.35rem;
    height: 2rem;
    padding: 0;
    border: 1.5px solid var(--line-strong);
    border-radius: 4px;
    background: linear-gradient(to bottom, var(--surface-3), var(--panel));
    cursor: pointer;
    position: relative;
  }
  .sw::after {
    content: '';
    position: absolute;
    left: 2px;
    right: 2px;
    height: 45%;
    top: 50%;
    border-radius: 3px;
    background: var(--sig-low);
    transition: top 100ms, background-color 100ms;
  }
  .sw.on::after {
    top: 3px;
    background: var(--sig-high);
  }
  .sw:focus-visible,
  .btn:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .btns {
    gap: 6px;
  }
  .btn {
    min-width: 2.7rem;
    height: 2rem;
    border: 1.5px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    cursor: pointer;
    user-select: none;
    touch-action: none;
  }
  .btn.down {
    background: var(--sig-high);
    border-color: var(--sig-high);
    color: var(--on-accent);
    transform: translateY(1px);
  }
  .seg {
    height: 3.2rem;
    width: auto;
    display: block;
    --lit: var(--phosphor);
  }
  .s {
    fill: var(--lit);
    opacity: 0.1;
  }
  .s.on {
    opacity: 1;
    filter: drop-shadow(0 0 3px var(--phosphor-glow));
  }
  .matrix {
    display: grid;
    grid-template-columns: repeat(8, 0.95rem);
    gap: 3px;
    padding: 5px;
    background: var(--scope-bg);
    border-radius: 6px;
  }
  .px {
    width: 0.95rem;
    height: 0.95rem;
    border-radius: 50%;
    background: color-mix(in srgb, var(--sig-x) 16%, var(--scope-bg));
  }
  .px.on {
    background: var(--sig-x);
    box-shadow: 0 0 6px color-mix(in srgb, var(--sig-x) 70%, transparent);
  }
  .con {
    flex: 1 1 16rem;
  }
  .screen {
    margin: 0;
    min-height: 4.6rem;
    max-height: 8rem;
    overflow: auto;
    padding: 0.4rem 0.6rem;
    background: var(--scope-bg);
    color: var(--phosphor);
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    line-height: 1.35;
    white-space: pre-wrap;
    word-break: break-all;
  }
  form {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  input {
    flex: 1;
    min-width: 0;
    height: 1.9rem;
    padding: 0 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .wait {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--mute);
    white-space: nowrap;
  }
</style>
