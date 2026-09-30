<!--
  A protocol analyser for the three serial buses of the chapter. A transmitter with its own settings drives the wires; a
  receiver, with settings of its own that can be made to disagree, decodes what it sees, and the boxes under the waveforms
  are what it makes of them. The transmitters and decoders are protocols.ts; the settings are lab.ts.

    ::serial-lab{protocol="uart" n="24.7" caption="…"}      protocol: uart, spi or i2c
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import TraceView from './TraceView.svelte';
  import { registerProtocolDecoders } from './protocols';
  import { i2cLab, spiLab, uartLab, UART_FORMATS, type UartFormat } from './lab';

  let { protocol = 'uart', n, caption }: { protocol?: 'uart' | 'spi' | 'i2c' | string; n?: string | number; caption?: string } = $props();

  onMount(registerProtocolDecoders); // the bench's analyser can then decode these buses too

  let tab = $state<'uart' | 'spi' | 'i2c'>(untrack(() => (protocol === 'spi' || protocol === 'i2c' ? protocol : 'uart')));

  // UART
  let uText = $state('Hi!');
  let uBaud = $state(9600);
  let uFormat = $state<UartFormat>('8N1');
  let uRxBaud = $state(9600);
  let uRxFormat = $state<UartFormat>('8N1');
  // SPI
  let sMosi = $state('A5 3C');
  let sMiso = $state('00 FF');
  let sClock = $state(1e6);
  let sMode = $state<0 | 1 | 2 | 3>(0);
  let sRxMode = $state<0 | 1 | 2 | 3>(0);
  let sMsb = $state(true);
  // I²C
  let iAddress = $state('48');
  let iRead = $state(false);
  let iBytes = $state('3A 01');
  let iClock = $state(100e3);
  let iAbsent = $state(false);

  const result = $derived(
    tab === 'uart'
      ? uartLab({ text: uText, baud: uBaud, format: uFormat, receiverBaud: uRxBaud, receiverFormat: uRxFormat })
      : tab === 'spi'
        ? spiLab({ mosi: sMosi, miso: sMiso, clockHz: sClock, mode: sMode, receiverMode: sRxMode, msbFirst: sMsb })
        : i2cLab({ address: parseInt(iAddress, 16) || 0, read: iRead, bytes: iBytes, sclHz: iClock, absent: iAbsent }),
  );
  const formats = Object.keys(UART_FORMATS) as UartFormat[];
  const wires = $derived(tab === 'uart' ? 'one wire each way, and a ground' : tab === 'spi' ? 'four wires: clock, data out, data in, chip select' : 'two wires, shared by every device on the bus');
  function reset() {
    uText = 'Hi!';
    uBaud = 9600;
    uFormat = uRxFormat = '8N1';
    uRxBaud = 9600;
    sMosi = 'A5 3C';
    sMiso = '00 FF';
    sClock = 1e6;
    sMode = sRxMode = 0;
    sMsb = true;
    iAddress = '48';
    iRead = false;
    iBytes = '3A 01';
    iClock = 100e3;
    iAbsent = false;
  }
</script>

<Widget title="Serial protocols" subtitle="Transmit, then decode" {n} {caption} kind="Analyser" onreset={reset}>
  {#snippet controls()}
    <Segmented
      label="Protocol"
      options={[
        { value: 'uart', label: 'UART' },
        { value: 'spi', label: 'SPI' },
        { value: 'i2c', label: 'I²C' },
      ]}
      bind:value={tab}
    />
  {/snippet}

  <div class="sl">
    <div class="forms ui">
      {#if tab === 'uart'}
        <fieldset>
          <legend>Transmitter</legend>
          <label class="f wide"><span>Message</span><input type="text" bind:value={uText} maxlength="12" autocomplete="off" spellcheck="false" /></label>
          <label class="f"><span>Baud</span>
            <select bind:value={uBaud}>{#each [300, 1200, 9600, 115200] as b (b)}<option value={b}>{b}</option>{/each}</select>
          </label>
          <label class="f"><span>Format</span>
            <select bind:value={uFormat}>{#each formats as f (f)}<option value={f}>{f}</option>{/each}</select>
          </label>
        </fieldset>
        <fieldset>
          <legend>Receiver</legend>
          <label class="f"><span>Baud</span>
            <select bind:value={uRxBaud}>
              <option value={0}>find it</option>
              {#each [300, 1200, 4800, 9600, 19200, 115200] as b (b)}<option value={b}>{b}</option>{/each}
            </select>
          </label>
          <label class="f"><span>Format</span>
            <select bind:value={uRxFormat}>{#each formats as f (f)}<option value={f}>{f}</option>{/each}</select>
          </label>
        </fieldset>
      {:else if tab === 'spi'}
        <fieldset>
          <legend>Controller</legend>
          <label class="f wide"><span>MOSI bytes (hex)</span><input type="text" bind:value={sMosi} autocomplete="off" spellcheck="false" /></label>
          <label class="f wide"><span>MISO bytes (hex)</span><input type="text" bind:value={sMiso} autocomplete="off" spellcheck="false" /></label>
          <label class="f"><span>Mode</span>
            <select bind:value={sMode}>{#each [0, 1, 2, 3] as m (m)}<option value={m}>{m}</option>{/each}</select>
          </label>
          <label class="f"><span>Clock</span>
            <select bind:value={sClock}><option value={1e5}>100 kHz</option><option value={1e6}>1 MHz</option><option value={1e7}>10 MHz</option></select>
          </label>
          <label class="f chk"><input type="checkbox" bind:checked={sMsb} /><span>MSB first</span></label>
        </fieldset>
        <fieldset>
          <legend>Receiver</legend>
          <label class="f"><span>Mode</span>
            <select bind:value={sRxMode}>{#each [0, 1, 2, 3] as m (m)}<option value={m}>{m}</option>{/each}</select>
          </label>
        </fieldset>
      {:else}
        <fieldset>
          <legend>Controller</legend>
          <label class="f"><span>Address (hex)</span><input type="text" bind:value={iAddress} maxlength="2" size="3" autocomplete="off" spellcheck="false" /></label>
          <label class="f"><span>Direction</span>
            <select value={iRead ? 'r' : 'w'} onchange={(e) => (iRead = e.currentTarget.value === 'r')}><option value="w">write</option><option value="r">read</option></select>
          </label>
          <label class="f wide"><span>Data bytes (hex)</span><input type="text" bind:value={iBytes} autocomplete="off" spellcheck="false" /></label>
          <label class="f"><span>SCL</span>
            <select bind:value={iClock}><option value={1e5}>100 kHz</option><option value={4e5}>400 kHz</option></select>
          </label>
        </fieldset>
        <fieldset>
          <legend>Device</legend>
          <label class="f chk"><input type="checkbox" checked={!iAbsent} onchange={(e) => (iAbsent = !e.currentTarget.checked)} /><span>present on the bus</span></label>
        </fieldset>
      {/if}
    </div>

    <TraceView channels={result.channels} decoded={result.decoded} t0={0} t1={result.end} label="{tab.toUpperCase()} waveforms and decoded bytes" />

    <p class="sum ui" class:ok={result.ok} class:bad={!result.ok} aria-live="polite">
      <span class="badge">{result.ok ? 'agreed' : 'differs'}</span>
      {result.summary}
    </p>
    <p class="wires ui">{tab === 'uart' ? 'UART' : tab === 'spi' ? 'SPI' : 'I²C'} uses {wires}.</p>
  </div>
</Widget>

<style>
  .sl {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .forms {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1rem;
  }
  fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.9rem;
    align-items: flex-end;
    margin: 0;
    padding: 0.5rem 0.7rem 0.6rem;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    min-width: 0;
  }
  legend {
    padding: 0 0.3rem;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  .f {
    display: grid;
    gap: 0.15rem;
    font-size: 0.72rem;
    color: var(--mute);
    min-width: 0;
  }
  .f.wide {
    flex: 1 1 9rem;
  }
  .f.chk {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    color: var(--ink-2);
    height: 2rem;
  }
  input[type='text'],
  select {
    height: 2rem;
    min-width: 0;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font-family: var(--font-mono);
    font-size: 0.84rem;
    padding: 0 0.45rem;
  }
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .sum {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-2);
    line-height: 1.5;
    padding: 0.4rem 0.7rem;
    border-radius: 6px;
    border-left: 3px solid var(--line-strong);
  }
  .sum.ok {
    border-left-color: var(--ok);
    background: var(--ok-soft);
  }
  .sum.bad {
    border-left-color: var(--bad);
    background: var(--bad-soft);
  }
  .badge {
    display: inline-block;
    margin-right: 0.4rem;
    padding: 0 0.4rem;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: 1px solid currentColor;
  }
  .ok .badge {
    color: var(--ok);
  }
  .bad .badge {
    color: var(--bad);
  }
  .wires {
    margin: 0;
    font-size: 0.78rem;
    color: var(--mute);
  }
</style>
