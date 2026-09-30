<!--
  The LFSR sequence wheel: choose the length and which bits feed the XOR, and see every state of the register laid
  out as wheels, one per cycle. Maximal taps make one wheel of 2ⁿ − 1 states (and the lock-up state on its own);
  other taps break the states into several shorter wheels.

    ::lfsr-wheel{n="18.9" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { bin, cycles, firstPoor, maximalTaps, next, polynomial, stream, wheel } from './lfsr';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  let bits = $state(4);
  let taps = $state(maximalTaps(4));
  let cur = $state(1);
  let playing = $state(false);
  let reduced = $state(false);
  let root: HTMLElement | undefined = $state();

  const top = $derived(1 << (bits - 1));
  const cyc = $derived(cycles(bits, taps));
  const maximal = $derived(cyc[0]!.length === (1 << bits) - 1);
  const home = $derived(cyc.findIndex((c) => c.includes(cur)));
  const out = $derived(stream(bits, taps, cur, 40));
  const shown = $derived(cyc.slice(0, 6));
  const hidden = $derived(cyc.length - shown.length);

  function setBits(v: number) {
    bits = v;
    taps = maximalTaps(v);
    cur = 1;
  }
  function flipTap(i: number) {
    if (i === bits - 1) return;
    taps ^= 1 << i;
    if (!(taps & top)) taps |= top;
    cur = cur || 1;
  }
  function step() {
    cur = next(cur, bits, taps);
  }
  const lengths = $derived(cyc.map((c) => c.length));
  const summary = $derived.by(() => {
    if (maximal) return `One cycle of ${lengths[0]} states, so the output repeats every ${lengths[0]} steps, and the all-zero state on its own.`;
    const counts = new Map<number, number>();
    for (const l of lengths) counts.set(l, (counts.get(l) ?? 0) + 1);
    const parts = [...counts].map(([l, k]) => (k > 1 ? `${k} × ${l}` : `${l}`));
    return `Not maximal: ${lengths.length} separate cycles (${parts.join(', ')}). Which one you are on depends on where you started.`;
  });

  // Auto-play: a few steps a second, only while on screen and when motion is welcome.
  onMount(() => {
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let visible = true;
    const io = new IntersectionObserver((es) => {
      visible = es.some((e) => e.isIntersecting);
      if (!visible) playing = false;
    });
    if (root) io.observe(root);
    const timer = setInterval(() => {
      if (playing && visible && !document.hidden) step();
    }, 160);
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
  });

  const W = 150;
  const wheels = $derived(
    shown.map((c) => {
      const L = c.length;
      const r = L === 1 ? 0 : Math.min(58, 14 + 4.2 * Math.sqrt(L));
      const dot = L > 100 ? 1.6 : L > 40 ? 2.2 : 3.2;
      return { c, pts: wheel(L, W / 2, W / 2, r), dot, label: L <= 16 };
    }),
  );
  function reset() {
    setBits(4);
    playing = false;
  }
</script>

<div bind:this={root}>
  <Widget title="LFSR sequence wheel" subtitle="Which taps make the longest cycle?" {caption} n={fig} onreset={reset}>
    {#snippet controls()}
      <Segmented size="sm" label="Bits" value={bits} onchange={setBits} options={[3, 4, 5, 6, 7, 8].map((v) => ({ value: v, label: `${v} bits` }))} />
      <div class="btns">
        <Button size="sm" onclick={() => (taps = maximalTaps(bits))}>Maximal taps</Button>
        <Button size="sm" onclick={() => (taps = firstPoor(bits))}>A poor choice</Button>
      </div>
    {/snippet}

    <div class="w">
      <div class="reg ui" role="group" aria-label="The shift register, {bits} bits. Press a bit to add or remove its tap.">
        <span class="fb" aria-hidden="true">⊕</span>
        {#each Array.from({ length: bits }, (_, k) => bits - 1 - k) as i (i)}
          <button type="button" class="bit" class:tap={(taps >> i) & 1} class:locked={i === bits - 1} class:one={(cur >> i) & 1} aria-pressed={!!((taps >> i) & 1)} disabled={i === bits - 1} onclick={() => flipTap(i)} title={i === bits - 1 ? 'The top bit is always a tap' : 'Press to add or remove this tap'}>
            <b>{(cur >> i) & 1}</b>
            <small>{(taps >> i) & 1 ? 'tap' : ''}</small>
          </button>
        {/each}
        <span class="shift" aria-hidden="true">← shifts left</span>
      </div>
      <p class="poly ui">Feedback: <code>{polynomial(bits, taps)}</code> — the next bit entering on the right is the XOR of the tapped bits ({[...Array(bits).keys()].filter((i) => (taps >> i) & 1).reverse().map((i) => `bit ${i}`).join(', ')}).</p>

      <div class="controls ui">
        <Button size="sm" onclick={step}>Step</Button>
        <Button size="sm" onclick={() => (playing = !playing)} disabled={reduced} aria-pressed={playing}>{playing ? 'Stop' : 'Play'}</Button>
        <Button size="sm" onclick={() => (cur = 1)}>Back to 00…01</Button>
        <span class="now">State <code>{bin(cur, bits)}</code> = {cur}</span>
      </div>

      <div class="wheels" role="img" aria-label="The state graph: {summary}">
        {#each wheels as w, k (k)}
          <figure class="wheel" class:home={k === home}>
            <svg viewBox="0 0 {W} {W}" width="100%" aria-hidden="true">
              {#if w.c.length > 1}<circle class="ring" cx={W / 2} cy={W / 2} r={Math.hypot(w.pts[0]![0] - W / 2, w.pts[0]![1] - W / 2)} />{/if}
              {#each w.c as s, j (s)}
                <circle class="dot" class:now={s === cur} cx={w.pts[j]![0]} cy={w.pts[j]![1]} r={s === cur ? w.dot + 2.2 : w.dot} />
                {#if w.label && w.c.length > 1}
                  {@const p = w.pts[j]!}
                  {@const dx = p[0] - W / 2}
                  {@const dy = p[1] - W / 2}
                  <text class="lab" x={W / 2 + dx * 1.24} y={W / 2 + dy * 1.24 + 3} text-anchor="middle">{s}</text>
                {/if}
              {/each}
              {#if w.c.length === 1}<text class="lab big" x={W / 2} y={W / 2 - 8} text-anchor="middle">{bin(w.c[0]!, bits)}</text>{/if}
            </svg>
            <figcaption>{w.c.length} state{w.c.length === 1 ? '' : 's'}{w.c.length === 1 && w.c[0] === 0 ? ' (lock-up)' : ''}</figcaption>
          </figure>
        {/each}
        {#if hidden > 0}<p class="more ui">…and {hidden} more short cycle{hidden === 1 ? '' : 's'}.</p>{/if}
      </div>

      <p class="says ui" class:ok={maximal} class:bad={!maximal}><b>{maximal ? 'Maximal.' : 'Not maximal.'}</b> {summary}</p>
      <p class="stream ui"><span>Output (the bit that falls off the top), from this state</span><code>{out.join('')}</code></p>
    </div>
  </Widget>
</div>

<style>
  .w {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .btns {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .reg {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-wrap: wrap;
  }
  .fb {
    font-size: 1.3rem;
    color: var(--copper-ink);
    margin-right: 0.2rem;
  }
  .bit {
    display: grid;
    place-items: center;
    width: 2.6rem;
    height: 3.1rem;
    border: 1.5px solid var(--wire);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font: inherit;
    cursor: pointer;
  }
  .bit b {
    font-family: var(--font-mono);
    font-size: 1.05rem;
  }
  .bit.one {
    background: var(--sig-high-glow);
  }
  .bit small {
    font-size: 0.62rem;
    color: var(--copper-ink);
    height: 0.8rem;
  }
  .bit.tap {
    border-color: var(--copper);
    border-width: 2.5px;
  }
  .bit.locked {
    cursor: default;
    opacity: 1;
  }
  .bit:focus-visible {
    outline: 2px solid var(--copper);
    outline-offset: 2px;
  }
  .shift {
    font-size: 0.72rem;
    color: var(--mute);
    margin-left: 0.4rem;
  }
  .poly,
  .stream {
    margin: 0;
    font-size: 0.82rem;
  }
  .stream {
    display: grid;
    gap: 0.15rem;
  }
  .stream span {
    font-size: 0.72rem;
    color: var(--mute);
  }
  .stream code {
    font-size: 0.78rem;
    overflow-wrap: anywhere;
    letter-spacing: 0.06em;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
  .now {
    font-size: 0.84rem;
    margin-left: 0.4rem;
  }
  .wheels {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: 0.6rem;
  }
  .wheel {
    margin: 0;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.3rem;
    background: var(--panel);
    text-align: center;
  }
  .wheel.home {
    border-color: var(--copper);
    box-shadow: 0 0 0 1px var(--copper);
  }
  figcaption {
    font-size: 0.72rem;
    color: var(--mute);
    font-family: var(--font-ui);
  }
  .ring {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .dot {
    fill: var(--sig-low);
  }
  .dot.now {
    fill: var(--sig-high);
    stroke: var(--fg);
    stroke-width: 1.2;
  }
  .lab {
    font-family: var(--font-mono);
    font-size: 7px;
    fill: var(--mute);
  }
  .lab.big {
    font-size: 11px;
    fill: var(--fg);
  }
  .more {
    align-self: center;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .says {
    margin: 0;
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    font-size: 0.86rem;
    line-height: 1.45;
    border: 1px solid var(--line);
  }
  .says.ok {
    background: var(--ok-soft);
    border-color: var(--ok);
  }
  .says.bad {
    background: var(--bad-soft);
    border-color: var(--bad);
  }
</style>
