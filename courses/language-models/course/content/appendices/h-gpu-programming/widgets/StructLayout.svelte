<!--
  WGSL struct layout calculator: pick field types and an address space, and see where each field
  lands in memory — including the padding the alignment rules insert.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { TYPES, layoutStruct, type AddressSpace } from './layout';

  const NAMES = ['a', 'b', 'c', 'd', 'e', 'f'];
  const DEFAULT = ['f32', 'vec3f', 'f32', 'vec2f'];
  let types = $state([...DEFAULT]);
  let space = $state<AddressSpace>('uniform');
  let hovered = $state<number | null>(null);

  const layout = $derived(layoutStruct(types.map((t, i) => ({ name: NAMES[i]!, type: t })), space));
  const words = $derived(layout.size / 4);
  const owner = $derived.by(() => {
    const own = new Array<number>(words).fill(-1);
    layout.fields.forEach((f, i) => {
      for (let w = f.offset / 4; w < (f.offset + f.size) / 4; w++) own[w] = i;
    });
    return own;
  });
  const hasVec3 = $derived(types.some((t) => t.includes('vec3')));
  const payload = $derived(
    layout.fields.reduce((a, f) => {
      const m = /array<(\w+), (\d+)>/.exec(f.type);
      if (!m) return a + (f.type === 'vec3f' ? 12 : f.size);
      const el = m[1] === 'vec3f' ? 12 : 4;
      return a + el * Number(m[2]);
    }, 0),
  );
  const color = (i: number) => `var(--series-${(i % 6) + 1})`;
</script>

<Widget
  title="Where do the bytes go?"
  subtitle="WGSL aligns each field to its type’s alignment, so the host must write values at the right byte offsets. Change the types and the address space."
  onreset={() => {
    types = [...DEFAULT];
    space = 'uniform';
  }}
>
  {#snippet controls()}
    <Segmented label="Address space" size="sm" options={[{ value: 'uniform', label: 'var<uniform>' }, { value: 'storage', label: 'var<storage>' }] as { value: AddressSpace; label: string }[]} bind:value={space} />
    <Button size="sm" onclick={() => types.length < NAMES.length && types.push('f32')} disabled={types.length >= NAMES.length}>Add field</Button>
    <Button size="sm" onclick={() => types.length > 1 && types.pop()} disabled={types.length <= 1}>Remove field</Button>
  {/snippet}

  <div class="cols">
    <div class="code ui">
      <pre>struct S &lbrace;
{#each types as _, i (i)}  <span class="sw" style:background={color(i)}></span><span class="fname">{NAMES[i]}</span>: <select bind:value={types[i]} aria-label="Type of field {NAMES[i]}">{#each TYPES as t (t)}<option value={t}>{t}</option>{/each}</select>,
{/each}&rbrace;</pre>
      <table class="offsets num">
        <thead><tr><th>field</th><th>align</th><th>offset</th><th>size</th><th>f32 index</th></tr></thead>
        <tbody>
          {#each layout.fields as f, i (f.name)}
            <tr class:hl={hovered === i} onpointerenter={() => (hovered = i)} onpointerleave={() => (hovered = null)}>
              <td><span class="sw" style:background={color(i)}></span>{f.name}</td>
              <td>{f.align}</td>
              <td>{f.offset}{#if f.padBefore}<span class="pad"> (+{f.padBefore} pad)</span>{/if}</td>
              <td>{f.size}{#if f.stride}<span class="pad"> (stride {f.stride})</span>{/if}</td>
              <td>{f.offset / 4}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div>
      <div class="bytes" role="img" aria-label="Memory layout: {layout.size} bytes, of which {payload} hold data">
        {#each { length: Math.ceil(words / 4) } as _, row (row)}
          <div class="row">
            <span class="addr num">{row * 16}</span>
            {#each { length: 4 } as _, c (c)}
              {@const w = row * 4 + c}
              {#if w < words}
                {@const o = owner[w]!}
                <span
                  class="word"
                  class:padw={o === -1}
                  class:hl={o !== -1 && hovered === o}
                  style:background={o === -1 ? undefined : color(o)}
                  onpointerenter={() => (hovered = o === -1 ? null : o)}
                  onpointerleave={() => (hovered = null)}
                  role="presentation">{o === -1 ? '' : NAMES[o]}</span
                >
              {:else}
                <span class="word none"></span>
              {/if}
            {/each}
          </div>
        {/each}
      </div>
      <p class="summary ui">
        <strong class="num">{layout.size}</strong> bytes (struct alignment {layout.align}); <strong class="num">{payload}</strong> hold data, {layout.size - payload} are padding.
        {#if hasVec3}Each <code>vec3f</code> occupies 16 bytes in arrays, and a lone one leaves a 4-byte hole unless a scalar follows it.{/if}
      </p>
    </div>
  </div>
</Widget>

<style>
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.5rem;
  }
  @media (max-width: 700px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  pre {
    margin: 0 0 0.8rem;
    font-size: 0.82rem;
    background: var(--surface-2);
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    line-height: 1.9;
  }
  select {
    font: inherit;
    font-size: 0.8rem;
    background: var(--surface);
    color: var(--ink);
    border: 1px solid var(--border-control);
    border-radius: 4px;
    padding: 0 0.2rem;
  }
  .fname {
    font-weight: 700;
  }
  .offsets {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.76rem;
  }
  .offsets th {
    text-align: left;
    color: var(--ink-2);
    font-weight: 600;
    padding: 0.15rem 0.3rem;
  }
  .offsets td {
    border-top: 1px solid var(--rule);
    padding: 0.15rem 0.3rem;
  }
  .offsets tr.hl td {
    background: var(--surface-2);
  }
  .pad {
    color: var(--ink-3);
  }
  .sw {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 2px;
    margin-right: 0.35rem;
  }
  .bytes {
    display: grid;
    gap: 3px;
  }
  .row {
    display: grid;
    grid-template-columns: 2.2rem repeat(4, 1fr);
    gap: 3px;
    align-items: center;
  }
  .addr {
    font-size: 0.68rem;
    color: var(--ink-3);
    text-align: right;
    padding-right: 0.3rem;
  }
  .word {
    height: 1.6rem;
    border-radius: 3px;
    color: var(--on-accent);
    font: 700 0.72rem var(--font-mono);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .word.padw {
    background: repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 4px, var(--border) 4px, var(--border) 5px);
  }
  .word.none {
    background: transparent;
  }
  .word.hl {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }
  .summary {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
</style>
