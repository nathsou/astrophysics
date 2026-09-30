<!--
  A bouncing push button and the DCL standard library's Debouncer, side by side. The button's waveform is
  drawn every 0.1 ms; the debouncer, a real DCL module run on the RTL simulator, samples it every millisecond
  and changes its output only after the input has held for the window.

    ::debounce-lab{n="17.9" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Strip, { type Mark, type Row } from './Strip.svelte';
  import { button, debounce, edges, RES, segsOf } from './bounce';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  let window = $state(6);
  let bounce = $state(4);
  let seed = $state(3);

  const b = $derived(button(seed, bounce));
  const c = $derived(debounce(b, window));
  const rows: Row[] = $derived([
    { name: 'button', segs: segsOf(b.raw, 1 / RES) },
    { name: 'seen', segs: segsOf(c.synced, 1) },
    { name: 'clean', segs: segsOf(c.clean, 1) },
  ]);
  const rawEdges = $derived(edges(b.raw));
  const cleanEdges = $derived(edges(c.clean));
  const risen = $derived(c.clean.findIndex((v) => v === 1));
  const marks: Mark[] = $derived(risen >= 0 ? [{ t: risen, symbol: '▲', tone: cleanEdges === 2 ? 'ok' : 'bad', title: `The clean output rises at ${risen} ms` }] : []);
  const good = $derived(cleanEdges === 2);

  function again() {
    seed += 1;
  }
  function reset() {
    window = 6;
    bounce = 4;
    seed = 3;
  }
</script>

<Widget title="Debouncing" subtitle="The Debouncer of the standard library, on a bouncing button" {caption} n={fig} onreset={reset}>
  {#snippet controls()}
    <div class="ctl">
      <Slider label="Window" bind:value={window} min={2} max={20} step={1} format={(v) => `${v} ms (${v} clock cycles at 1 kHz)`} />
      <Slider label="Contact bounce" bind:value={bounce} min={0.5} max={8} step={0.5} format={(v) => `${v.toFixed(1)} ms`} />
    </div>
  {/snippet}

  <div class="w">
    <Strip {rows} {marks} from={0} to={b.length} unit="ms" label="The push button's waveform, what the debouncer's synchroniser sees at each millisecond, and the clean output." />
    <p class="says ui" class:ok={good} class:bad={!good} role="status">
      <b>{good ? 'One press, one release.' : `${cleanEdges} edges got through.`}</b>
      The button changed level {rawEdges} times; the clean output changed {cleanEdges}{risen >= 0 ? `, and rose ${risen - b.pressAt} ms after the press` : ''}.
      {#if !good}The window is shorter than the bounce, so a quiet moment inside the chatter counted as a new steady value.{/if}
    </p>
    <div class="btns ui"><Button size="sm" onclick={again}>Press again (new bounce)</Button></div>
  </div>
</Widget>

<style>
  .ctl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.4rem 1.2rem;
    width: 100%;
  }
  .w {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .says {
    margin: 0;
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    font-size: 0.86rem;
    line-height: 1.45;
  }
  .says.ok {
    background: var(--ok-soft);
    border: 1px solid var(--ok);
  }
  .says.bad {
    background: var(--bad-soft);
    border: 1px solid var(--bad);
  }
  .btns {
    display: flex;
    gap: 0.4rem;
  }
</style>
