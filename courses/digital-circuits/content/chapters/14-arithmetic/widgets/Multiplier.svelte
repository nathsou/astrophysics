<!--
  Shift-and-add multiplication, one step at a time: long multiplication in binary. For each bit of the multiplier, from the
  right, add the multiplicand shifted into place if the bit is 1 (and nothing if it is 0). The running product is
  what an accumulator register would hold. The steps are in multiply.ts.

    ::multiplier{n="14.7" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { prefersReducedMotion } from '$lib/theme/signals';
  import { additions, arrayCost, steps } from './multiply';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  const N = 4;
  let a = $state(13);
  let b = $state(11);
  let done = $state(0);
  let playing = $state(false);
  let reduced = $state(false);
  let root: HTMLDivElement | undefined = $state();

  const all = $derived(steps(a, b, N));
  const final = $derived(all[N - 1]!.after);
  const shown = $derived(done > 0 ? all[done - 1]!.after : 0);
  const bin = (v: number, w: number) => v.toString(2).padStart(w, '0');
  const W = 2 * N;
  const cost = arrayCost(N);

  function next() {
    if (done < N) done++;
  }
  function back() {
    if (done > 0) done--;
  }
  function play() {
    if (done >= N) done = 0;
    playing = !playing;
  }
  function change() {
    done = 0;
    playing = false;
  }
  function reset() {
    a = 13;
    b = 11;
    change();
  }

  onMount(() => {
    reduced = prefersReducedMotion();
    if (!root) return;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(root);
    const timer = setInterval(() => {
      if (playing && visible && !document.hidden) {
        if (done < N) done++;
        else playing = false;
      }
    }, 1100);
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
  });
</script>

<Widget title="Multiplication by shift and add" subtitle="Long multiplication, in binary" {caption} n={fig} onreset={reset}>
  {#snippet controls()}
    <Slider label="Multiplicand" bind:value={a} min={0} max={15} step={1} format={(v) => `${Math.round(v)} = ${bin(Math.round(v), N)}`} oninput={change} />
    <Slider label="Multiplier" bind:value={b} min={0} max={15} step={1} format={(v) => `${Math.round(v)} = ${bin(Math.round(v), N)}`} oninput={change} />
  {/snippet}

  <div class="mu" bind:this={root}>
    <div class="sheet" role="table" aria-label="Binary long multiplication of {a} by {b}">
      <div class="lines">
        <div class="line top" role="row"><span class="txt">{' '.repeat(W - N)}{bin(a, N)}</span><span class="note">multiplicand {a}</span></div>
        <div class="line" role="row"><span class="txt">×{' '.repeat(W - N - 1)}{bin(b, N)}</span><span class="note">multiplier {b}</span></div>
        <div class="rule"></div>
        {#each all as s, i (i)}
          {@const on = i < done}
          <div class="line step" class:on class:cur={i === done - 1} class:one={s.bit === 1} role="row">
            <span class="txt">{on ? ' '.repeat(W - N - s.index) + (s.bit ? bin(a, N) : '0'.repeat(N)) + ' '.repeat(s.index) : ' '.repeat(W)}</span>
            <span class="note">{on ? (s.bit ? `bit ${s.index} is 1: add ${a} shifted left ${s.index}` : `bit ${s.index} is 0: add nothing`) : `bit ${s.index}`}</span>
          </div>
        {/each}
        <div class="rule"></div>
        <div class="line total" role="row"><span class="txt">{bin(shown, W)}</span><span class="note">running product {shown}{done === N ? (shown === a * b ? ` = ${a} × ${b}` : '') : ''}</span></div>
      </div>
    </div>

    <div class="ctl ui">
      <Button size="sm" onclick={back} disabled={done === 0}>Back</Button>
      <Button size="sm" variant="primary" onclick={next} disabled={done === N}>Next step</Button>
      <Button size="sm" onclick={play} disabled={reduced} title={reduced ? 'Automatic stepping is off because you asked your system for reduced motion' : undefined}>{playing ? 'Pause' : 'Run'}</Button>
      <span class="prog" role="status">Step {done} of {N}{done === N ? `: ${a} × ${b} = ${final}` : ''}</span>
    </div>
    <p class="hw ui">
      {additions(b, N)} of the {N} steps added something{additions(b, N) === 0 ? ' (multiplying by 0)' : ''}. In hardware this is a loop: one adder, a register for the product and a shift each step ({N} clock cycles for {N} bits). An <em>array multiplier</em> does all the steps at once, with {cost.ands} AND gates for the bit products and {cost.fullAdders} full adders to add them: no loop, a lot more silicon.
    </p>
  </div>
</Widget>

<style>
  .mu {
    display: grid;
    gap: 0.8rem;
  }
  .sheet {
    justify-self: center;
    max-width: 100%;
    overflow-x: auto;
  }
  .lines {
    display: grid;
    gap: 2px;
    font-family: var(--font-mono);
    font-size: 0.98rem;
    min-width: max-content;
  }
  .line {
    display: grid;
    grid-template-columns: 9ch minmax(0, 1fr);
    gap: 1.2rem;
    align-items: baseline;
    padding: 1px 6px;
    border-radius: 4px;
  }
  .txt {
    white-space: pre;
    letter-spacing: 0.08em;
  }
  .note {
    font-family: var(--font-ui);
    font-size: 0.78rem;
    color: var(--mute);
    white-space: nowrap;
  }
  .rule {
    height: 0;
    border-top: 2px solid var(--wire);
    width: 10ch;
    margin: 2px 6px;
  }
  .step:not(.on) .txt {
    color: var(--mute);
  }
  .step.on.one .txt {
    color: var(--sig-high);
    font-weight: 700;
  }
  .step.on:not(.one) .txt {
    color: var(--sig-low);
  }
  .step.cur {
    background: var(--copper-soft);
    box-shadow: inset 0 0 0 1px var(--copper);
  }
  .total .txt {
    font-weight: 700;
    color: var(--fg);
  }
  .ctl {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    justify-content: center;
  }
  .prog {
    font-size: 0.84rem;
    color: var(--ink-2);
    margin-left: 0.4rem;
  }
  .hw {
    margin: 0;
    font-size: 0.82rem;
    color: var(--mute);
    line-height: 1.55;
  }
</style>
