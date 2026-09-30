<!--
  The counter lab: a ripple counter and a synchronous counter, run on the digital engine, on a logic analyser
  with the word decoded above the bits. Step through one count at a time: the ripple counter shows wrong numbers
  on the way, the synchronous one does not. A decoder watching for one count fires falsely on the ripple counter.
  Each output can be heard: every stage is an octave below the last.

    ::counter-lab{n="18.6" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Strip, { type BusSpan, type Row } from '../../17-the-clock/widgets/Strip.svelte';
  import { DEFAULT_COUNTER, octaves, rippleTransients, run, type Kind } from './counters';
  import { Tones } from './tones';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  let kind: Kind = $state('ripple');
  let clkToQ = $state(DEFAULT_COUNTER.clkToQ);
  let step = $state(7);
  let watch = $state(DEFAULT_COUNTER.watch);
  const BITS = 4;
  const period = DEFAULT_COUNTER.period;

  const r = $derived(run({ ...DEFAULT_COUNTER, kind, clkToQ, watch, period, bits: BITS, cycles: 34 }));
  const mod = 1 << BITS;
  // The window: from a quarter period before the edge that takes the count from `step` to `step + 1`.
  const edge = $derived(r.edges[step] ?? r.edges[0]!);
  const from = $derived(edge - period * 0.3);
  const to = $derived(from + period * 3);

  const label = (v: number) => (v < 0 ? 'X' : v.toString(10));
  // A value is a wrong one when it is neither the count before the last edge nor the count after it.
  const bus: BusSpan[] = $derived(
    r.word.map(([a, z, v]) => {
      const n = r.edges.filter((e) => e <= a + 1e-6).length;
      const cur = n % mod;
      const prev = (n - 1 + mod) % mod;
      return { from: a, to: z, label: label(v), tone: v < 0 ? ('x' as const) : v === cur || v === prev ? ('ok' as const) : ('bad' as const) };
    }),
  );
  const rows: Row[] = $derived([
    { name: 'CLK', segs: r.clk },
    ...Array.from({ length: BITS }, (_, i) => ({ name: `Q${i}`, segs: r.bits[i]! })).reverse(),
    { name: 'count', bus },
    ...(watch >= 0 ? [{ name: `is ${watch}`, segs: r.hit } satisfies Row] : []),
  ]);

  const wrong = $derived(r.transients.filter((s) => s[0] >= edge - 1 && s[1] <= edge + period).map((s) => s[2]));
  const predictedWrong = $derived(kind === 'ripple' ? rippleTransients(step, BITS) : []);
  const spurious = $derived(r.hitPulses - r.hitLegit);
  const settleText = $derived(kind === 'ripple' ? `${BITS} × ${clkToQ} ns = ${BITS * clkToQ} ns` : `${clkToQ} ns`);
  const worst = $derived(kind === 'ripple' ? BITS * clkToQ : clkToQ);

  // Sound: every output an octave below the one before, starting from a 1760 Hz clock.
  const freqs = octaves(1760, BITS);
  const names = ['CLK', ...Array.from({ length: BITS }, (_, i) => `Q${i}`)];
  const notes = ['A6', 'A5', 'A4', 'A3', 'A2'];
  let on = $state<boolean[]>(names.map(() => false));
  let audio: Tones | undefined;
  let hasSound = $state(false);
  let playing = $state(false);
  let root: HTMLElement | undefined = $state();

  onMount(() => {
    hasSound = Tones.supported();
    audio = new Tones();
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) halt();
    });
    if (root) io.observe(root);
    const vis = () => document.hidden && halt();
    document.addEventListener('visibilitychange', vis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', vis);
      audio?.stop();
    };
  });
  function halt() {
    audio?.stop();
    playing = false;
  }
  async function toggleSound() {
    if (playing) return halt();
    await audio?.start(freqs);
    on.forEach((v, i) => audio?.enable(i, v));
    playing = true;
  }
  function flip(i: number) {
    on[i] = !on[i];
    if (playing) audio?.enable(i, on[i]!);
  }
  function reset() {
    kind = 'ripple';
    clkToQ = DEFAULT_COUNTER.clkToQ;
    step = 7;
    watch = DEFAULT_COUNTER.watch;
    on = names.map(() => false);
    halt();
  }
</script>

<div bind:this={root}>
  <Widget title="Counter lab" subtitle="A ripple counter and a synchronous counter, read on a logic analyser" {caption} n={fig} onreset={reset}>
    {#snippet controls()}
      <Segmented
        size="sm"
        label="Counter"
        value={kind}
        onchange={(v: Kind) => (kind = v)}
        options={[
          { value: 'ripple', label: 'Ripple' },
          { value: 'sync', label: 'Synchronous' },
        ]}
      />
      <div class="ctl">
        <Slider label="Step from count" bind:value={step} min={0} max={15} step={1} format={(v) => `${v} to ${(v + 1) % 16}`} />
        <Slider label="Clock to Q of each flip-flop" bind:value={clkToQ} min={2} max={30} step={1} format={(v) => `${v} ns`} />
        <Slider label="Decoder watches for" bind:value={watch} min={-1} max={15} step={1} format={(v) => (v < 0 ? 'nothing' : `count ${v}`)} />
      </div>
    {/snippet}

    <div class="w">
      <Strip {rows} {from} {to} label="Logic analyser: the clock, the four counter bits, the value of the word they make, and a decoder output. Values drawn red are counts the counter never meant to show." />

      <div class="read ui">
        <div class="num"><span>Settled after</span><b>{settleText}</b></div>
        <div class="num" class:bad={wrong.length > 0}><span>Wrong values at this step</span><b>{wrong.length ? wrong.join(', ') : 'none'}</b></div>
        {#if watch >= 0}
          <div class="num" class:bad={spurious > 0}>
            <span>Decoder over 34 clocks</span>
            <b>{r.hitPulses} pulses, {r.hitLegit} right</b>
          </div>
        {/if}
      </div>

      {#if kind === 'ripple' && worst >= period}
        <p class="says ui bad" role="status"><b>Too fast for its own ripple.</b> The carry needs {worst} ns to run down the chain and the clock period is {period} ns, so the count is never valid.</p>
      {:else if predictedWrong.length && kind === 'ripple'}
        <p class="says ui" role="status">Each stage has to wait for the one before it. The count goes {step} → {predictedWrong.join(' → ')} → {(step + 1) % 16}, and every wrong value lasts one clock-to-Q.</p>
      {:else}
        <p class="says ui ok" role="status">{kind === 'sync' ? 'Every flip-flop sees the same clock edge, so all the bits that change do so together.' : 'This step flips only one bit, so the ripple has nothing to ripple through. Try 7 to 8.'}</p>
      {/if}

      <div class="listen ui">
        <span class="lh">Listen</span>
        {#each names as nm, i (nm)}
          <button type="button" class="chip" class:on={on[i]} aria-pressed={on[i]} onclick={() => flip(i)} title="{nm}: {freqs[i]} Hz, note {notes[i]}">
            <b>{nm}</b><small>{freqs[i]} Hz</small>
          </button>
        {/each}
        <button type="button" class="play" onclick={toggleSound} disabled={!hasSound} aria-pressed={playing}>{playing ? 'Stop sound' : 'Start sound'}</button>
      </div>
      <p class="fine ui">The clock here is {freqs[0]} Hz so that you can hear it; the flip-flops are as fast as the engine says. Switch several voices on to hear the octave ladder: each output is exactly half the frequency of the one before, whichever counter you use.</p>
    </div>
  </Widget>
</div>

<style>
  .ctl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 0.4rem 1.2rem;
    width: 100%;
  }
  .w {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .read {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 0.5rem;
  }
  .num {
    display: grid;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--panel);
  }
  .num span {
    font-size: 0.7rem;
    color: var(--mute);
  }
  .num b {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    color: var(--fg);
  }
  .num.bad b {
    color: var(--bad);
  }
  .says {
    margin: 0;
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    font-size: 0.86rem;
    line-height: 1.45;
    border: 1px solid var(--line);
    background: var(--panel);
  }
  .says.ok {
    background: var(--ok-soft);
    border-color: var(--ok);
  }
  .says.bad {
    background: var(--bad-soft);
    border-color: var(--bad);
  }
  .listen {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
  .lh {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
    margin-right: 0.2rem;
  }
  .chip,
  .play {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    min-width: 4.2rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--line-strong);
    border-radius: 7px;
    background: var(--panel);
    color: var(--fg);
    font: inherit;
    cursor: pointer;
    line-height: 1.2;
  }
  .chip small {
    font-size: 0.66rem;
    color: var(--mute);
  }
  .chip.on {
    background: var(--copper-soft);
    border-color: var(--copper);
  }
  .play {
    flex-direction: row;
    min-height: 2.2rem;
    background: var(--copper-soft);
    border-color: var(--copper);
    font-weight: 600;
    font-size: 0.86rem;
    margin-left: auto;
  }
  .play:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .fine {
    margin: 0;
    font-size: 0.74rem;
    color: var(--mute);
  }
  .chip:focus-visible,
  .play:focus-visible {
    outline: 2px solid var(--copper);
    outline-offset: 2px;
  }
</style>
