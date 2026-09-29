<!--
  Measured: the logit lens on CourseGPT. Each cell is the token the model would predict next if the residual
  stream at that layer went straight to the output; shading is its probability.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { DATA, show } from '../data';

  const L = DATA.lens;
  let prompt = $state(0);
  let hover = $state<{ layer: number; pos: number } | null>(null);
  const P = $derived(L?.prompts[prompt]);
  const start = $derived(Math.max(1, (P?.tokens.length ?? 0) - 14)); // the last 14 positions
</script>

<Widget
  title="The logit lens"
  subtitle="For the last positions of a prompt: at each layer (bottom: the embeddings; top: the output), the token the residual stream would predict if it were read out there. Darker is more confident. Hover for the top three."
  kind="Measured"
>
  {#snippet controls()}
    {#if L}<Segmented label="Prompt" size="sm" options={L.prompts.map((_, i) => ({ value: i, label: `Prompt ${i + 1}` }))} bind:value={prompt} />{/if}
  {/snippet}
  {#if L && P}
    <div class="wrap">
      <table class="ui">
        <tbody>
          {#each [...P.lens.keys()].reverse() as layer (layer)}
            <tr>
              <th>{layer === 0 ? 'embed' : layer === P.lens.length - 1 ? `${layer} (out)` : layer}</th>
              {#each P.lens[layer]!.slice(start) as top, j (j)}
                {@const [tok, p] = top[0]!}
                {@const right = P.tokens[start + j + 1]}
                <td
                  style:background="color-mix(in srgb, var(--series-1) {Math.round(p * 85)}%, var(--surface))"
                  class:hit={right !== undefined && tok === right}
                  onpointerenter={() => (hover = { layer, pos: start + j })}
                  onpointerleave={() => (hover = null)}
                >{show(tok)}</td>
              {/each}
            </tr>
          {/each}
          <tr class="input"><th>input</th>{#each P.tokens.slice(start) as t, j (j)}<td>{show(t)}</td>{/each}</tr>
        </tbody>
      </table>
    </div>
    <p class="note ui">
      {#if hover}
        After “{show(P.tokens[hover.pos]!)}” at layer {hover.layer}: {P.lens[hover.layer]![hover.pos]!.map(([t, p]) => `${show(t)} ${(p * 100).toFixed(0)}%`).join(', ')}.
      {:else}
        Outlined cells predict the token that actually comes next. Averaged over validation text, each layer’s top token agrees with the output’s {L.agree.map((a) => `${(a * 100).toFixed(0)}%`).join(' → ')} of the time.
      {/if}
    </p>
  {:else}
    <p class="muted">Run <code>uv run lmc ch26 lens</code> and <code>uv run lmc ch26 summary</code>.</p>
  {/if}
</Widget>

<style>
  .wrap {
    overflow-x: auto;
  }
  table {
    border-collapse: separate;
    border-spacing: 2px;
    font-size: 0.7rem;
  }
  th {
    font-weight: 500;
    color: var(--ink-3);
    text-align: right;
    padding-right: 0.4rem;
    white-space: nowrap;
  }
  td {
    padding: 0.2rem 0.3rem;
    border-radius: 3px;
    white-space: nowrap;
    max-width: 5.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--ink);
    font-family: var(--font-mono);
  }
  td.hit {
    outline: 1.5px solid var(--good);
  }
  .input td {
    background: none;
    font-weight: 600;
    border-top: 1px solid var(--rule);
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
    min-height: 2.4em;
  }
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
</style>
