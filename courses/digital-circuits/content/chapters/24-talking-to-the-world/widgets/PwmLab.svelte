<!--
  Pulse-width modulation: a 0/5 V pulse train of chosen duty cycle and frequency, an RC low-pass filter (1 kΩ and a capacitor
  of your choice), and what comes out. The analogue engine solves the circuit each time you move a control (pwm.ts). An LED
  driven by the pulses looks as bright as their average, which is what the filtered voltage is.

    ::pwm-lab{n="24.6" caption="…"}
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import TraceView from './TraceView.svelte';
  import { FILTER_R, rippleEstimate, runPwm, type PwmRun } from './pwm';
  import { makeSignal, setLevel } from './protocols';

  let { n, caption, duty: startDuty = 25 }: { n?: string | number; caption?: string; duty?: number } = $props();

  let duty = $state(untrack(() => startDuty));
  let frequency = $state(1000);
  let capacitance = $state(1e-5);
  let from = $state<'settled' | 'start'>('settled');

  let run = $state.raw<PwmRun | undefined>(undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const compute = () => (run = runPwm({ duty: duty / 100, frequency, capacitance, from }));
  compute();
  function later() {
    clearTimeout(timer);
    timer = setTimeout(compute, 50);
  }
  const pick = (setter: () => void) => {
    setter();
    later();
  };

  const signal = $derived.by(() => {
    if (!run) return undefined;
    const s = makeSignal(run.pwm[0] ?? 0, [], 0);
    for (let i = 1; i < run.t.length; i++) setLevel(s, run.t[i]!, run.pwm[i]!);
    return s;
  });
  const fmtC = (c: number) => (c >= 1e-6 ? `${c * 1e6} µF` : `${c * 1e9} nF`);
  const tau = $derived(FILTER_R * capacitance);
  const fmtT = (s: number) => (s >= 1e-3 ? `${+(s * 1e3).toPrecision(3)} ms` : `${+(s * 1e6).toPrecision(3)} µs`);
  const ledLevel = $derived(duty / 100);
  const estimate = $derived(rippleEstimate(duty / 100, frequency, tau));
</script>

<Widget title="Dimming with pulses" subtitle="Duty cycle in, average voltage out" {n} {caption} kind="PWM" onreset={() => pick(() => ((duty = startDuty), (frequency = 1000), (capacitance = 1e-5), (from = 'settled')))}>
  {#snippet controls()}
    <Slider label="Duty cycle" bind:value={duty} min={0} max={100} step={1} format={(v) => `${Math.round(v)} %`} oninput={later} />
    <Segmented label="Frequency" size="sm" options={[{ value: 100, label: '100 Hz' }, { value: 1000, label: '1 kHz' }, { value: 10000, label: '10 kHz' }]} bind:value={frequency} onchange={later} />
    <Segmented label="Filter capacitor" size="sm" options={[{ value: 1e-6, label: '1 µF' }, { value: 1e-5, label: '10 µF' }]} bind:value={capacitance} onchange={later} />
    <Segmented label="View" size="sm" options={[{ value: 'settled', label: 'Settled' }, { value: 'start', label: 'From power-on' }]} bind:value={from} onchange={later} />
  {/snippet}

  <div class="pl">
    {#if run && signal}
      <TraceView
        t1={run.window}
        label="PWM waveform and filtered voltage"
        channels={[
          { name: 'PWM', signal, tone: 5 },
          { name: 'OUT', analog: { t: run.t, v: run.out, min: 0, max: 5, unit: ' V' }, tone: 1 },
        ]}
        rowHeight={58}
      />
      <div class="read ui">
        <div class="led" aria-hidden="true">
          <span class="bulb" style="--level:{ledLevel}"></span>
          <span class="cap">an LED on the pulses looks {Math.round(ledLevel * 100)} % as bright as on 5 V</span>
        </div>
        <dl>
          <dt>average</dt>
          <dd>{run.mean.toFixed(2)} V <span class="dim">(5 V × {duty} % = {(0.05 * duty).toFixed(2)} V)</span></dd>
          <dt>ripple</dt>
          <dd>{run.ripple < 0.01 ? '< 0.01' : run.ripple.toFixed(2)} V peak to peak {#if estimate < 1.5 && from === 'settled'}<span class="dim">(estimate 5·D(1−D)/(fτ) = {estimate.toFixed(3)} V)</span>{/if}</dd>
          <dt>time constant</dt>
          <dd>τ = 1 kΩ × {fmtC(capacitance)} = {fmtT(tau)}; the period is {fmtT(1 / frequency)}</dd>
        </dl>
      </div>
    {/if}
  </div>
</Widget>

<style>
  .pl {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .read {
    display: grid;
    gap: 0.8rem 1.5rem;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
  }
  @media (max-width: 560px) {
    .read {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .led {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    max-width: 15rem;
  }
  .bulb {
    flex: none;
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 50%;
    border: 2px solid var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) calc(var(--level) * 100%), var(--panel));
    box-shadow: 0 0 calc(var(--level) * 16px) var(--sig-high-glow);
  }
  .cap {
    font-size: 0.76rem;
    color: var(--mute);
    line-height: 1.4;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.2rem 0.8rem;
    margin: 0;
    font-size: 0.84rem;
    color: var(--ink-2);
  }
  dt {
    color: var(--mute);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding-top: 0.15rem;
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.82rem;
  }
  .dim {
    font-family: var(--font-ui);
    color: var(--mute);
    font-size: 0.76rem;
  }
</style>
