<!--
  A ripple-carry adder settling, in slow motion. The adder holds 1111 + 0000 = 15; switch the carry-in to 1 and the carry
  has to travel through every stage. The waveforms are the carries, the sum word underneath is what the outputs read
  at each moment, and for a while it is a number nobody asked for.

    ::ripple-settle{n="15.4"}
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import TimingDiagram from '$lib/bench/TimingDiagram.svelte';
  import type { Recorder } from '$lib/sim/engine';
  import { makeAdder, readWord, rest, sequence, type Adder } from './ripple';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let bits = $state(4);
  let adder: Adder | undefined = $state.raw();
  let scope: TimingDiagram | undefined = $state();
  let root: HTMLDivElement | undefined = $state();
  let word: number | undefined = $state(undefined);
  let seen: { at: number; value: number }[] = $state([]);
  let carry = $state(false);
  let running = $state(false);
  let started = $state(false);
  let rec: Recorder | undefined;
  let t0 = 0;
  let raf = 0;
  let reduced = false;
  let visible = true;

  const expected = $derived(2 ** bits - 1 + (carry ? 1 : 0));
  const span = $derived(adder ? (adder.tpd + 8) * 1e-9 : 27e-9);
  const width = $derived(bits + 1);

  async function setup() {
    cancelAnimationFrame(raf);
    running = false;
    started = false;
    carry = false;
    seen = [];
    const a = makeAdder(bits);
    rec = a.engine.watch(a.word);
    adder = a;
    // The timing diagram starts recording (at t = 0) when it gets the engine; then the adder settles.
    await tick();
    if (adder !== a) return;
    rest(a);
    word = readWord(a);
    scope?.frame();
  }

  onMount(() => {
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    if (root) io.observe(root);
    void setup();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  });

  function go() {
    const a = adder;
    if (!a || running) return;
    carry = !carry;
    started = true;
    t0 = a.engine.time;
    a.engine.setParam('cin', 'on', carry);
    const total = (a.tpd + 4) * 1e-9;
    if (reduced) {
      a.engine.advance(total);
      finish();
      return;
    }
    running = true;
    const speed = ((a.tpd + 6) * 1e-9) / 4.5;
    let last = 0;
    const step = (t: number) => {
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      if (visible) {
        a.engine.advance(dt * speed);
        word = readWord(a);
        scope?.frame();
      }
      if (a.engine.time - t0 >= total) return finish();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function finish() {
    const a = adder;
    if (!a || !rec) return;
    running = false;
    word = readWord(a);
    scope?.frame();
    seen = sequence(rec.times(), rec.values(), t0);
  }

  const bitsOf = (v: number | undefined) => Array.from({ length: width }, (_, i) => (v === undefined ? undefined : Math.floor(v / 2 ** (width - 1 - i)) % 2));
  const names = $derived(Array.from({ length: width }, (_, i) => (i === 0 ? 'C' : `S${width - 1 - i}`)));
  const settle = $derived(seen.length ? Math.round((seen[seen.length - 1]!.at - t0) * 1e9) : 0);
</script>

<Widget {n} title="Ripple in slow motion" subtitle="The answer is not ready until the carry has arrived" kind="Lab bench" {caption} onreset={setup} live={false}>
  {#snippet controls()}
    <Segmented label="Adder width" size="sm" bind:value={bits} options={[{ value: 4, label: '4 bits' }, { value: 8, label: '8 bits' }]} onchange={() => void setup()} />
    <Button size="sm" variant="primary" onclick={go} disabled={running || !adder}>{running ? 'Rippling…' : carry ? 'Set carry-in back to 0' : 'Set carry-in to 1'}</Button>
  {/snippet}

  <div class="rs" bind:this={root}>
    <p class="sum ui">
      <span class="lab">{'1'.repeat(bits)} + 0 + carry-in {carry ? 1 : 0}, should be {expected}</span>
    </p>
    {#if adder}
      <TimingDiagram bind:this={scope} engine={adder.engine} traces={adder.traces} window={span} live={false} rowHeight={bits > 4 ? 20 : 26} label="The carry-in, the carries between the stages and the top sum bit of a {bits}-bit ripple-carry adder" />
    {:else}
      <div class="blank" aria-busy="true"></div>
    {/if}

    <div class="read ui" role="status" aria-live="off">
      <div class="leds" aria-hidden="true">
        {#each bitsOf(word) as b, i (i)}
          <span class="led" class:on={b === 1} class:x={b === undefined}><small>{names[i]}</small>{b === undefined ? '?' : b}</span>
        {/each}
      </div>
      <div class="num" class:bad={started && !running && word !== expected} class:wait={running && word !== expected}>
        <span class="v">{word ?? '?'}</span>
        <span class="t">{#if !started}the outputs read {word}{:else if running && word !== expected}wrong for now: {expected} is coming{:else if word === expected}settled: {expected}{:else}{word}{/if}</span>
      </div>
    </div>
    {#if seen.length > 1}
      <p class="seq ui">
        In the {settle} ns after the flip, the outputs read <strong>{seen.map((s) => s.value).join(' → ')}</strong>. {seen.length - 2 > 0 ? `Only the last of them is the answer; the ${seen.length - 2} in between are numbers that nobody asked for.` : ''}
      </p>
    {/if}
  </div>
</Widget>

<style>
  .rs {
    display: grid;
    gap: 0.7rem;
    min-width: 0;
  }
  .sum {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .lab {
    font-family: var(--font-mono);
    color: var(--fg);
    font-weight: 600;
  }
  .read {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem 1.6rem;
    align-items: center;
  }
  .leds {
    display: flex;
    gap: 0.3rem;
  }
  .led {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    min-width: 1.7rem;
    padding: 0.2rem 0.25rem;
    border-radius: 5px;
    border: 1px solid var(--line-strong);
    background: var(--surface-3, var(--panel));
    color: var(--ink-2);
    font-family: var(--font-mono);
    font-size: 0.9rem;
    font-weight: 600;
  }
  .led small {
    font-size: 0.6rem;
    font-weight: 500;
    color: var(--mute);
  }
  .led.on {
    background: color-mix(in srgb, var(--sig-high) 30%, var(--panel));
    border-color: var(--sig-high);
    color: var(--fg);
  }
  .led.x {
    border-color: var(--sig-x);
  }
  .num {
    display: flex;
    align-items: baseline;
    gap: 0.7rem;
  }
  .num .v {
    font-family: var(--font-mono);
    font-size: 1.7rem;
    font-weight: 700;
    min-width: 2.4ch;
    color: var(--fg);
  }
  .num .t {
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .num.wait .v,
  .num.bad .v {
    color: var(--bad);
  }
  .seq {
    margin: 0;
    font-size: 0.84rem;
    color: var(--ink-2);
  }
  .blank {
    height: 10rem;
  }
</style>
