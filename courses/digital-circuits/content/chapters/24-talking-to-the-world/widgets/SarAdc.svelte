<!--
  A successive-approximation ADC at work. The analogue half (an R-2R ladder, a comparator and the unknown input) is the
  analogue engine solving a real netlist every time the search sets a bit (sar.ts); the search is the register that keeps or
  drops each bit from the top. Step through it, or let it run.

    ::sar-adc{n="24.9" caption="…"}
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { SarBench, VREF, idealCode, search } from './sar';

  let { n, caption, vin: startVin = 3.5, bits: startBits = 4 }: { n?: string | number; caption?: string; vin?: number; bits?: number } = $props();

  let bits = $state<4 | 8>(untrack(() => (startBits === 8 ? 8 : 4)));
  let vin = $state(untrack(() => startVin));
  let k = $state(0);
  let playing = $state(false);
  let root: HTMLDivElement | undefined = $state();
  const benches = new Map<number, SarBench>();
  const bench = (b: number) => {
    let x = benches.get(b);
    if (!x) benches.set(b, (x = new SarBench(b)));
    return x;
  };

  const steps = $derived.by(() => {
    const be = bench(bits);
    be.setVin(vin);
    return search(bits, (c) => be.setCode(c));
  });
  const lsb = $derived(VREF / (1 << bits));
  const done = $derived(k >= bits);
  const result = $derived(k === 0 ? 0 : steps[k - 1]!.result);
  const expected = $derived(idealCode(vin, bits));
  const cur = $derived(k > 0 ? steps[k - 1] : undefined);
  const bin = (v: number) => v.toString(2).padStart(bits, '0');

  function next() {
    if (k < bits) k++;
  }
  function reset() {
    k = 0;
    playing = false;
  }
  function play() {
    if (done) k = 0;
    playing = !playing;
  }
  onMount(() => {
    let visible = true;
    const io = root ? new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting)) : undefined;
    if (root) io!.observe(root);
    const timer = setInterval(() => {
      if (!playing || !visible || document.hidden) return;
      if (k < bits) k++;
      else playing = false;
    }, 900);
    return () => {
      clearInterval(timer);
      io?.disconnect();
    };
  });

  // The chart.
  const W = 420;
  const H = 190;
  const PAD = { l: 40, r: 12, t: 12, b: 36 };
  const X = (i: number) => PAD.l + (i / bits) * (W - PAD.l - PAD.r);
  const Y = (v: number) => H - PAD.b - (v / VREF) * (H - PAD.t - PAD.b);
  const path = $derived(steps.slice(0, k).map((s, i) => `${i ? 'L' : 'M'}${X(i + 1).toFixed(1)} ${Y(s.vdac).toFixed(1)}`).join(' '));
</script>

<Widget title="A binary search with a comparator" subtitle="Successive approximation" {n} {caption} kind="ADC" onreset={reset}>
  {#snippet controls()}
    <Slider label="Input voltage" bind:value={vin} min={0} max={5} step={0.01} format={(v) => `${v.toFixed(2)} V`} oninput={reset} />
    <Segmented
      label="Resolution"
      size="sm"
      options={[
        { value: 4, label: '4 bits' },
        { value: 8, label: '8 bits' },
      ]}
      bind:value={bits}
      onchange={reset}
    />
    <div class="btns ui">
      <Button size="sm" variant="primary" onclick={next} disabled={done}>Next step</Button>
      <Button size="sm" onclick={play}>{playing ? 'Pause' : 'Run'}</Button>
      <Button size="sm" onclick={reset}>Reset</Button>
    </div>
  {/snippet}

  <div class="sa" bind:this={root}>
    <div class="reg" role="img" aria-label="Result register: {bin(result)}">
      {#each Array(bits) as _, i (i)}
        {@const bit = bits - 1 - i}
        {@const decided = i < k}
        {@const trying = i === k && !done}
        <span class="cell" class:decided class:trying class:one={decided && !!(result & (1 << bit))}>
          <span class="b">{decided ? (result >> bit) & 1 : trying ? '?' : '·'}</span>
          <span class="w">{1 << bit}</span>
        </span>
      {/each}
      <span class="eq ui">= <b>{result}</b> of {1 << bits}</span>
    </div>

    <svg viewBox="0 0 {W} {H}" class="chart" role="img" aria-label="DAC voltage at each step against the input voltage">
      {#each [0, 1, 2, 3, 4, 5] as v (v)}
        <line class="grid" x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} />
        <text class="tk" x={PAD.l - 6} y={Y(v) + 3} text-anchor="end">{v} V</text>
      {/each}
      {#each Array(bits) as _, i (i)}
        <text class="tk" x={X(i + 1)} y={H - PAD.b + 13} text-anchor="middle">{i + 1}</text>
      {/each}
      <text class="tk" x={(PAD.l + W - PAD.r) / 2} y={H - 4} text-anchor="middle">comparison number</text>
      <line class="vin" x1={PAD.l} x2={W - PAD.r} y1={Y(vin)} y2={Y(vin)} />
      <text class="vl" x={W - PAD.r - 2} y={Y(vin) - 4} text-anchor="end">Vin {vin.toFixed(2)} V</text>
      <path class="stair" d={path} />
      {#each steps.slice(0, k) as s, i (i)}
        <circle class="pt" class:up={s.above} cx={X(i + 1)} cy={Y(s.vdac)} r="5.5" />
        <text class="pl" x={X(i + 1)} y={Y(s.vdac) + (s.above ? 16 : -9)} text-anchor="middle">{s.above ? 'keep' : 'drop'}</text>
      {/each}
      {#if !done}
        <circle class="pt ghost" cx={X(k + 1)} cy={Y(steps[k]!.vdac)} r="5.5" />
      {/if}
    </svg>

    <p class="say ui" aria-live="polite">
      {#if k === 0}
        The register is empty. The first trial is the top bit alone: {bin(steps[0]!.trial)}, which puts {steps[0]!.vdac.toFixed(3)} V on the DAC, half of full scale.
      {:else if cur}
        Step {k}: try bit {cur.bit} (register {bin(cur.trial)}): the DAC makes {cur.vdac.toFixed(3)} V. Vin, {vin.toFixed(2)} V, is {cur.above ? 'above' : 'below'} it, so the comparator says {cur.above ? '1: keep the bit' : '0: drop the bit'}.
        {#if done}
          Done in {bits} comparisons: <b>{bin(result)}</b> = {result}, so {(result * lsb).toFixed(3)} V ≤ Vin &lt; {((result + 1) * lsb).toFixed(3)} V.{result === expected ? '' : ' (The comparator’s millivolt of hysteresis put Vin on the wrong side of a step edge.)'}
        {/if}
      {/if}
    </p>
    <p class="cmp ui">A converter that counted up until the DAC passed Vin would need up to {(1 << bits) - 1} comparisons; the search needs {bits}. Each extra bit of resolution costs one more comparison, not twice as many.</p>
  </div>
</Widget>

<style>
  .btns {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    align-items: flex-end;
  }
  .sa {
    display: grid;
    gap: 0.7rem;
    min-width: 0;
  }
  .reg {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }
  .cell {
    display: grid;
    justify-items: center;
    width: 2.1rem;
    padding: 0.2rem 0 0.15rem;
    border: 1.5px dashed var(--line-strong);
    border-radius: 6px;
    font-family: var(--font-mono);
  }
  .cell .b {
    font-size: 1.15rem;
    font-weight: 700;
    line-height: 1.3;
    color: var(--mute);
  }
  .cell .w {
    font-size: 0.6rem;
    color: var(--mute);
  }
  .cell.decided {
    border-style: solid;
    border-color: var(--series-3);
  }
  .cell.one {
    background: color-mix(in srgb, var(--series-3) 20%, var(--panel));
  }
  .cell.decided .b {
    color: var(--fg);
  }
  .cell.trying {
    border-style: solid;
    border-color: var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) 18%, var(--panel));
  }
  .cell.trying .b {
    color: var(--sig-high);
  }
  .eq {
    margin-left: 0.6rem;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .chart {
    width: 100%;
    max-width: 34rem;
    height: auto;
    justify-self: center;
  }
  .grid {
    stroke: var(--line);
  }
  .tk {
    font-family: var(--font-mono);
    font-size: 9.5px;
    fill: var(--mute);
  }
  .vin {
    stroke: var(--sig-current);
    stroke-width: 2;
    stroke-dasharray: 6 4;
  }
  .vl {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: var(--sig-current);
  }
  .stair {
    fill: none;
    stroke: var(--wire);
    stroke-width: 1.5;
  }
  .pt {
    fill: var(--sig-x);
    stroke: var(--panel);
    stroke-width: 1.5;
  }
  .pt.up {
    fill: var(--series-3);
  }
  .pt.ghost {
    fill: none;
    stroke: var(--sig-high);
    stroke-width: 2;
    stroke-dasharray: 3 2;
  }
  .pl {
    font-family: var(--font-mono);
    font-size: 9.5px;
    fill: var(--ink-2);
  }
  .say {
    margin: 0;
    min-height: 3.2em;
    font-size: 0.86rem;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .cmp {
    margin: 0;
    font-size: 0.78rem;
    color: var(--mute);
  }
</style>
