<!--
  Huffman coding: build the optimal prefix code for a distribution and compare its average length
  with the entropy — Shannon's source coding theorem in action.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { focus } from '$lib/state/params.svelte';

  const PRESETS: Record<string, [string, number][]> = {
    'Four symbols': [['a', 0.5], ['b', 0.25], ['c', 0.125], ['d', 0.125]],
    Skewed: [['a', 0.7], ['b', 0.15], ['c', 0.1], ['d', 0.05]],
    Uniform: [['a', 0.25], ['b', 0.25], ['c', 0.25], ['d', 0.25]],
    'English letters': [
      ['␣', 0.18], ['e', 0.1], ['t', 0.075], ['o', 0.07], ['a', 0.065], ['h', 0.055], ['s', 0.054], ['r', 0.052],
      ['n', 0.052], ['i', 0.049], ['l', 0.036], ['d', 0.033], ['u', 0.03], ['m', 0.025], ['y', 0.02], ['other', 0.104],
    ],
  };
  let preset = $state('Skewed');
  const dist = $derived(PRESETS[preset]!);

  type Node = { p: number; sym?: string; kids?: [Node, Node] };

  /** Standard Huffman construction: repeatedly join the two least probable nodes. */
  function huffman(items: [string, number][]): Map<string, string> {
    let nodes: Node[] = items.map(([sym, p]) => ({ p, sym }));
    while (nodes.length > 1) {
      nodes.sort((a, b) => a.p - b.p);
      const [a, b] = [nodes[0]!, nodes[1]!];
      nodes = [{ p: a.p + b.p, kids: [a, b] }, ...nodes.slice(2)];
    }
    const codes = new Map<string, string>();
    const walk = (n: Node, prefix: string) => {
      if (n.sym !== undefined) codes.set(n.sym, prefix || '0');
      else {
        walk(n.kids![0], prefix + '0');
        walk(n.kids![1], prefix + '1');
      }
    };
    if (nodes[0]) walk(nodes[0], '');
    return codes;
  }

  const codes = $derived(huffman(dist));
  const H = $derived(-dist.reduce((a, [, p]) => a + p * Math.log2(p), 0));
  const L = $derived(dist.reduce((a, [s, p]) => a + p * codes.get(s)!.length, 0));
</script>

<Widget
  title="Huffman coding: close to the entropy, never below it"
  subtitle="The optimal prefix-free code gives frequent symbols short codewords. Its average length L always satisfies H ≤ L < H + 1."
>
  {#snippet controls()}
    <div class="presets">
      {#each Object.keys(PRESETS) as name (name)}<button class="chip" class:on={preset === name} onclick={() => (preset = name)}>{name}</button>{/each}
    </div>
  {/snippet}

  <div class="summary">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span onpointerenter={() => focus.set('Lbar', 'huffman')} onpointerleave={() => focus.set(null)}>Average code length <strong class="num">{L.toFixed(3)}</strong> bits</span>
    <span>Entropy <strong class="num">{H.toFixed(3)}</strong> bits</span>
    <span>Overhead <strong class="num">{(L - H).toFixed(3)}</strong> bits/symbol</span>
  </div>
  <table>
    <thead><tr><th>Symbol</th><th class="r">p</th><th class="r">−log₂ p</th><th>Codeword</th><th class="r">Length</th></tr></thead>
    <tbody>
      {#each dist as [s, p] (s)}
        <tr>
          <td><code>{s}</code></td>
          <td class="r num">{p.toFixed(3)}</td>
          <td class="r num">{(-Math.log2(p)).toFixed(2)}</td>
          <td><code class="cw">{codes.get(s)}</code></td>
          <td class="r num">{codes.get(s)!.length}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="foot">Codeword lengths track the surprisal −log₂ p, rounded to whole bits. The rounding is where the overhead comes from; arithmetic coding removes it by coding whole sequences at once.</p>
</Widget>

<style>
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .chip {
    border: 1px solid var(--border-control);
    background: var(--surface);
    border-radius: 99px;
    padding: 0.2rem 0.6rem;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--ink-2);
  }
  .chip.on {
    background: var(--accent-soft);
    border-color: var(--accent-2);
    color: var(--accent-ink);
  }
  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.5rem;
    font-size: 0.85rem;
    color: var(--ink-2);
    margin-bottom: 0.6rem;
  }
  .summary strong {
    color: var(--ink);
    font-size: 1.05rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  th,
  td {
    padding: 0.3rem 0.5rem;
    border-bottom: 1px solid var(--rule);
    text-align: left;
  }
  .r {
    text-align: right;
  }
  .cw {
    letter-spacing: 0.08em;
  }
  .foot {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
</style>
