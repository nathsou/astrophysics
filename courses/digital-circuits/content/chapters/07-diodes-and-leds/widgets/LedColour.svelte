<!--
  Colour against bandgap: the LED explorer of Chapter 7.

  Slide the bandgap of the semiconductor from 1.2 to 3.2 eV. The photon energy, the wavelength E = hc/λ,
  the colour it looks like, and the real material nearest to that gap follow, and a live LED circuit
  (5 V, 330 Ω, the analog engine) takes the closest colour the engine knows, so you can read its forward
  voltage and current off the meters. Buttons jump to four real materials.

  The physics and the colour tables are in ./led.ts (tested); the circuit is built and run like the
  ones of `::circuit`, through the bench's Schematic. Paused off-screen.

    ::led-colour{n="7.4" caption="…"}
-->
<script lang="ts">
  import '$lib/sim/netlist/catalog';
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Schematic from '$lib/bench/Schematic.svelte';
  import { createEngine } from '$lib/bench/engines';
  import { flatten } from '$lib/sim/netlist/flatten';
  import { formatReadout } from '$lib/bench/format';
  import type { Engine } from '$lib/sim/engine';
  import type { Circuit } from '$lib/sim/netlist/types';
  import { MATERIALS, colourBand, nearestMaterial, spectrumPosition, spectrumRgb, spectrumStops, wavelengthNm } from './led';

  let { title = 'Colour follows the bandgap', caption, n }: { title?: string; caption?: string; n?: string | number } = $props();

  let gap = $state(1.9);
  const nm = $derived(wavelengthNm(gap));
  const band = $derived(colourBand(gap));
  const rgb = $derived(spectrumRgb(nm));
  const material = $derived(nearestMaterial(gap));
  const invisible = $derived(rgb === null);
  const css = $derived(rgb ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` : 'transparent');
  const near = $derived(Math.abs(material.gap - gap) <= 0.08);

  const preset = $derived(MATERIALS.find((m) => Math.abs(m.gap - gap) < 0.005)?.formula ?? '');

  const BASE: Circuit = {
    version: 1,
    title: 'An LED with its resistor',
    engine: 'analog',
    components: [
      { id: 'P0', type: 'rail', x: 4, y: 2, params: { voltage: 5 } },
      { id: 'R1', type: 'resistor', x: 4, y: 2, rot: 90, params: { resistance: 330 }, label: '330 Ω' },
      { id: 'D1', type: 'led', x: 4, y: 6, rot: 90, params: { color: 'red' }, label: 'LED' },
      { id: 'A1', type: 'ammeter', x: 4, y: 10, rot: 90, label: 'I' },
      { id: 'G1', type: 'ground', x: 4, y: 14 },
      { id: 'V1', type: 'voltmeter', x: 12, y: 10, rot: 270, label: 'Vf' },
    ],
    wires: [{ points: [[4, 6], [12, 6]] }, { points: [[4, 10], [12, 10]] }],
  } as unknown as Circuit;

  // The LED's colour is a parameter of the drawn circuit (so the symbol glows in it) and of the engine.
  const shown = $derived<Circuit>({
    ...BASE,
    components: BASE.components.map((c) => (c.id === 'D1' ? { ...c, params: { ...(c.params ?? {}), color: band.led } } : c)),
  });

  let engine: Engine | null = $state(null);
  let schematic: Schematic | undefined = $state();
  let root: HTMLDivElement | undefined = $state();
  let vf = $state('–');
  let ma = $state('–');
  let error = $state('');

  function read() {
    const e = engine;
    if (!e) return;
    vf = formatReadout(Number(e.state('V1').value), 'V');
    ma = formatReadout(Number(e.state('A1').value), 'A');
  }

  $effect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    try {
      createEngine('analog', flatten(untrack(() => shown))).then(
        (e) => {
          if (cancelled) return;
          e.setParam('D1', 'color', untrack(() => band.led));
          e.settle();
          engine = e;
          read();
        },
        (err: unknown) => !cancelled && (error = String(err)),
      );
    } catch (err) {
      error = String(err);
    }
    return () => {
      cancelled = true;
      engine = null;
    };
  });

  // A change of colour changes the LED type in the running engine.
  $effect(() => {
    const led = band.led;
    untrack(() => {
      if (!engine) return;
      engine.setParam('D1', 'color', led);
      engine.settle();
      schematic?.frame(0);
      read();
    });
  });

  onMount(() => {
    let raf = 0;
    let last = 0;
    let visible = false;
    const loop = (t: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      try {
        engine?.advance(dt);
      } catch {
        /* the engine reports problems in its messages */
      }
      schematic?.frame(dt);
      read();
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) start();
    });
    if (root) io.observe(root);
    const vis = () => !document.hidden && visible && start();
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
    };
  });

  const status = $derived(
    `Bandgap ${gap.toFixed(2)} electron-volts: photons of ${Math.round(nm)} nanometres, ${invisible ? 'invisible (' + band.name + ')' : band.name}. Nearest material ${material.name}. The LED circuit uses a ${band.led} LED.`,
  );
</script>

<Widget {title} {caption} {n} kind="Interactive" onreset={() => (gap = 1.9)}>
  {#snippet controls()}
    <Slider bind:value={gap} min={1.2} max={3.2} step={0.01} label="Bandgap of the semiconductor" format={(v) => `${v.toFixed(2)} eV`} />
    <Segmented
      label="Real materials"
      size="sm"
      value={preset}
      onchange={(v) => {
        const m = MATERIALS.find((x) => x.formula === v);
        if (m) gap = m.gap;
      }}
      options={MATERIALS.map((m) => ({ value: m.formula, label: m.formula, title: `${m.name}: ${m.gap} eV` }))}
    />
  {/snippet}

  <div class="lc" bind:this={root}>
    <div class="top">
      <div class="lamp" class:dark={invisible} style:--c={css} aria-hidden="true">
        <span class="bulb"></span>
        {#if invisible}<span class="ir">invisible</span>{/if}
      </div>
      <dl class="read ui">
        <div>
          <dt>Photon energy</dt>
          <dd class="big">{gap.toFixed(2)} eV</dd>
        </div>
        <div>
          <dt>Wavelength λ = hc ÷ E</dt>
          <dd class="big">{Math.round(nm)} nm</dd>
          <dd class="sub">1240 ÷ {gap.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Colour</dt>
          <dd class="big">{band.name}</dd>
        </div>
        <div class="mat">
          <dt>Nearest real material</dt>
          <dd class="big">{material.formula}</dd>
          <dd class="sub">{near ? `${material.name} (${material.gap} eV): ${material.emits}` : `${material.name} is the closest, at ${material.gap} eV`}</dd>
        </div>
      </dl>
    </div>

    <div class="bar" role="img" aria-label="The spectrum from 350 to 900 nanometres, with a marker at {Math.round(nm)} nanometres">
      <div class="spectrum" style:background={spectrumStops()}></div>
      <div class="mark" style:left="{spectrumPosition(nm) * 100}%"></div>
      <div class="ticks ui">
        <span style:left="{spectrumPosition(400) * 100}%">400</span>
        <span style:left="{spectrumPosition(500) * 100}%">500</span>
        <span style:left="{spectrumPosition(600) * 100}%">600</span>
        <span style:left="{spectrumPosition(700) * 100}%">700</span>
        <span style:left="{spectrumPosition(800) * 100}%">800</span>
        <span style:left="{spectrumPosition(880) * 100}%">nm</span>
      </div>
    </div>

    <div class="bottom">
      <div class="circuit">
        <Schematic bind:this={schematic} circuit={shown} {engine} mode="voltage" showCurrent running live={false} scale={1.3} />
      </div>
      <dl class="meters ui">
        <div>
          <dt>Forward voltage</dt>
          <dd class="big">{vf}</dd>
          <dd class="sub">of the {band.led} LED in the simulator</dd>
        </div>
        <div>
          <dt>Current</dt>
          <dd class="big">{ma}</dd>
          <dd class="sub">(5 V − Vf) ÷ 330 Ω</dd>
        </div>
      </dl>
    </div>
    {#if error}<p class="err ui" role="status">{error}</p>{/if}
    <p class="sr-only" role="status" aria-live="polite">{status}</p>
  </div>
</Widget>

<style>
  .lc {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    min-width: 0;
  }
  .top {
    display: grid;
    grid-template-columns: 8.5rem minmax(0, 1fr);
    gap: 1rem 1.25rem;
    align-items: center;
  }
  @media (max-width: 34rem) {
    .top {
      grid-template-columns: minmax(0, 1fr);
      justify-items: center;
    }
  }
  .lamp {
    position: relative;
    width: 8rem;
    height: 8rem;
    display: grid;
    place-items: center;
  }
  .bulb {
    width: 5.2rem;
    height: 5.2rem;
    border-radius: 50%;
    background: radial-gradient(circle at 38% 35%, color-mix(in srgb, var(--c) 55%, white), var(--c) 62%);
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--c) 40%, var(--panel)),
      0 0 34px 10px color-mix(in srgb, var(--c) 55%, transparent);
    transition: background 120ms, box-shadow 120ms;
  }
  .lamp.dark .bulb {
    background: color-mix(in srgb, var(--fg) 14%, var(--panel));
    box-shadow: 0 0 0 2px var(--line-strong);
    border: 2px dashed var(--mute);
  }
  .ir {
    position: absolute;
    bottom: -0.1rem;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  .read {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
    gap: 0.5rem;
    margin: 0;
    width: 100%;
  }
  .read > div,
  .meters > div {
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--pn);
    min-width: 0;
  }
  .mat {
    grid-column: 1 / -1;
  }
  dt {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  dd {
    margin: 0;
  }
  .big {
    font-family: var(--font-mono);
    font-size: 1.02rem;
    font-weight: 500;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }
  .sub {
    font-size: 0.78rem;
    line-height: 1.4;
    color: var(--ink-2);
  }
  .bar {
    position: relative;
    padding-bottom: 1.3rem;
  }
  .spectrum {
    height: 1.1rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
  }
  .mark {
    position: absolute;
    top: -0.35rem;
    width: 0;
    height: 1.85rem;
    border-left: 3px solid var(--fg);
    transform: translateX(-1.5px);
    filter: drop-shadow(0 0 2px var(--panel));
  }
  .ticks {
    position: absolute;
    left: 0;
    right: 0;
    top: 1.25rem;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    color: var(--mute);
  }
  .ticks span {
    position: absolute;
    transform: translateX(-50%);
  }
  .bottom {
    display: grid;
    grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
    gap: 0.9rem 1.25rem;
    align-items: center;
  }
  @media (max-width: 34rem) {
    .bottom {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .circuit {
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--panel);
    overflow: hidden;
  }
  .meters {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
    margin: 0;
  }
  .err {
    margin: 0;
    color: var(--bad);
    font-size: 0.82rem;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
