<!--
  How a dispatch maps threads to data: n elements, workgroups of a fixed size, one thread per
  element. Hover a thread to see the built-in ids WGSL gives it and the element it computes.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';

  let n = $state(37);
  let size = $state(8);
  let hovered = $state<number | null>(null);

  const groups = $derived(Math.ceil(n / size));
  const threads = $derived(groups * size);
  const idle = $derived(threads - n);
  const h = $derived(hovered ?? Math.min(n - 1, size + 2));
  const wg = $derived(Math.floor(h / size));
  const local = $derived(h % size);
  const color = (g: number) => (g % 2 === 0 ? 'var(--series-1)' : 'var(--series-3)');
</script>

<Widget
  title="From a dispatch to threads to data"
  subtitle="The host asks for ⌈n / size⌉ workgroups; the GPU runs every thread of every group. Hover a thread to see its built-in ids."
  onreset={() => {
    n = 37;
    size = 8;
  }}
>
  {#snippet controls()}
    <div class="ctl"><Slider label="elements n" min={1} max={100} step={1} value={n} oninput={(v) => (n = v)} format={(v) => String(v)} /></div>
    <div class="grp">
      <span class="lbl">@workgroup_size</span>
      <Segmented label="Workgroup size" size="sm" options={[4, 8, 16, 32].map((v) => ({ value: v, label: String(v) }))} bind:value={size} />
    </div>
  {/snippet}

  <p class="summary ui">
    <code>dispatchWorkgroups({groups})</code> → {groups} × {size} = <strong>{threads}</strong> threads for {n} elements
    {#if idle}· <span class="idle-note">{idle} idle (they fail the bounds check and return)</span>{/if}
  </p>

  <div class="groups" role="list" aria-label="Workgroups and their threads">
    {#each { length: groups } as _, g (g)}
      <div class="wg" role="listitem" style:--c={color(g)}>
        <span class="wlabel">workgroup {g}</span>
        <div class="threads" style:grid-template-columns="repeat({Math.min(size, 8)}, 1.6rem)">
          {#each { length: size } as _, l (l)}
            {@const i = g * size + l}
            <button
              class="t"
              class:idle={i >= n}
              class:hl={i === h}
              aria-label="Thread {i}{i >= n ? ' (idle)' : ''}"
              onpointerenter={() => (hovered = i)}
              onpointerleave={() => (hovered = null)}
              onfocus={() => (hovered = i)}
            >{i}</button>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="detail ui">
    <pre class="code"><span class="c">// thread {h} of this dispatch</span>
workgroup_id.x         = {wg}
local_invocation_id.x  = {local}
global_invocation_id.x = {wg} × {size} + {local} = <strong>{h}</strong>
{#if h < n}out[{h}] = f(a[{h}]);{:else}if ({h} >= n) &lbrace; return; &rbrace;   <span class="c">// past the end: idle</span>{/if}</pre>
    <p class="note">
      Threads of one workgroup run on the same compute unit and can share fast <em>workgroup memory</em> and synchronise with
      barriers. Threads in different workgroups cannot — they may not even run at the same time.
    </p>
  </div>
</Widget>

<style>
  .ctl {
    flex: 0 1 14rem;
  }
  .grp {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .lbl {
    font-size: 0.72rem;
    color: var(--ink-2);
    font-family: var(--font-mono);
  }
  .summary {
    font-size: 0.85rem;
    margin: 0 0 0.8rem;
    color: var(--ink-2);
  }
  .summary strong {
    color: var(--ink);
  }
  .idle-note {
    color: var(--ink-3);
  }
  .groups {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .wg {
    border: 1.5px solid color-mix(in srgb, var(--c) 55%, transparent);
    background: color-mix(in srgb, var(--c) 7%, transparent);
    border-radius: 6px;
    padding: 0.25rem 0.35rem 0.35rem;
  }
  .wlabel {
    display: block;
    font-size: 0.64rem;
    color: var(--ink-2);
    margin-bottom: 0.2rem;
    font-family: var(--font-ui);
  }
  .threads {
    display: grid;
    gap: 2px;
  }
  .t {
    height: 1.6rem;
    border: 0;
    border-radius: 3px;
    background: color-mix(in srgb, var(--c) 70%, var(--surface));
    color: var(--on-accent);
    font: 600 0.62rem var(--font-mono);
    cursor: default;
    padding: 0;
  }
  .t.idle {
    background: transparent;
    border: 1px dashed var(--ink-3);
    color: var(--ink-3);
  }
  .t.hl {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }
  .detail {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 1rem;
    margin-top: 1rem;
    align-items: start;
  }
  @media (max-width: 700px) {
    .detail {
      grid-template-columns: 1fr;
    }
  }
  .code {
    margin: 0;
    font-size: 0.78rem;
    background: var(--surface-2);
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    overflow-x: auto;
  }
  .c {
    color: var(--ink-3);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0;
  }
</style>
