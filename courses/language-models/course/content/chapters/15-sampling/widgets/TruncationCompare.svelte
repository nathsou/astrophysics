<!--
  One truncation rule, three contexts: which tokens top-k, top-p and min-p keep when CourseGPT is sure
  of the next token, fairly sure, and unsure. Uses the learner's implementations once their exercise
  passes.
-->
<script lang="ts">
  import { minP, softmaxT, topK, topP } from '@lm/core/sample';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { impl } from '$lib/exercise/impl.svelte';
  import { DATA, expand, show } from '../data';

  type Rule = 'topK' | 'topP' | 'minP';
  const dists = (DATA.distributions ?? []).filter((d) => d.key !== 'after');
  let rule = $state<Rule>('topK');
  let k = $state(40);
  let pTop = $state(0.9);
  let ratio = $state(0.1);
  let T = $state(1);

  const fns = $derived({
    topK: impl.get('sample.topK', topK),
    topP: impl.get('sample.topP', topP),
    minP: impl.get('sample.minP', minP),
  });
  const mine = $derived(impl.isMine(`sample.${rule}`));
  const SHOW = 24;
  const panels = $derived(
    dists.map((d) => {
      const { logits, labels } = expand(d);
      const p = softmaxT(logits, T);
      let q: Float64Array;
      try {
        q = rule === 'topK' ? fns.topK(p, k) : rule === 'topP' ? fns.topP(p, pTop) : fns.minP(p, ratio);
      } catch {
        q = p;
      }
      let kept = 0, mass = 0;
      for (let i = 0; i < p.length; i++) if (q[i]! > 0) (kept++, (mass += p[i]!));
      const max = p[0]!;
      return { d, labels, p, q, kept, mass, max };
    }),
  );
  const pct = (x: number) => `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`;
</script>

<Widget
  title="Which tokens survive truncation?"
  subtitle="The same rule applied to three of CourseGPT’s next-token distributions: nearly certain, fairly sure, and unsure. Coloured bars are kept (and renormalised); grey bars are cut. Each chart shows the 24 most probable tokens."
  onreset={() => {
    rule = 'topK';
    k = 40;
    pTop = 0.9;
    ratio = 0.1;
    T = 1;
  }}
>
  {#snippet controls()}
    <Segmented label="Rule" size="sm" options={[{ value: 'topK', label: 'top-k' }, { value: 'topP', label: 'top-p' }, { value: 'minP', label: 'min-p' }]} bind:value={rule} />
    <div class="sl">
      {#if rule === 'topK'}
        <Slider label="k" min={1} max={100} step={1} value={k} oninput={(v) => (k = Math.round(v))} format={(v) => String(Math.round(v))} />
      {:else if rule === 'topP'}
        <Slider label="p" min={0.05} max={1} step={0.01} value={pTop} oninput={(v) => (pTop = v)} />
      {:else}
        <Slider label="min-p ratio" min={0} max={0.5} step={0.01} value={ratio} oninput={(v) => (ratio = v)} />
      {/if}
    </div>
    <div class="sl"><Slider label="Temperature" min={0.3} max={2.5} step={0.05} value={T} oninput={(v) => (T = v)} /></div>
  {/snippet}

  {#if !panels.length}
    <p class="muted">Run <code>uv run lmc ch15 distributions</code> and <code>uv run lmc ch15 summary</code>.</p>
  {:else}
    {#if mine}<p class="mine ui">Using your implementation of {rule === 'topK' ? 'top-k' : rule === 'topP' ? 'top-p' : 'min-p'}.</p>{/if}
    <div class="grid">
      {#each panels as panel (panel.d.key)}
        <div class="panel">
          <p class="prompt">…{panel.d.prompt.split(' ').slice(-5).join(' ')}<span class="cursor">▍</span></p>
          <div class="chart" role="img" aria-label="Kept and cut tokens">
            {#each Array.from({ length: SHOW }, (_, i) => i) as i (i)}
              <div class="col" title="{show(panel.labels[i]!)}: {pct(panel.p[i]!)}">
                <div class="b" class:cut={!(panel.q[i]! > 0)} style:height="{Math.max(1, (panel.p[i]! / panel.max) * 100)}%"></div>
              </div>
            {/each}
          </div>
          <div class="labels">{#each Array.from({ length: 5 }, (_, i) => i) as i (i)}<span class:cut={!(panel.q[i]! > 0)}>{show(panel.labels[i]!)}</span>{/each}…</div>
          <p class="stat ui">kept <strong class="num">{panel.kept.toLocaleString('en-GB')}</strong> token{panel.kept === 1 ? '' : 's'}, <strong class="num">{pct(panel.mass)}</strong> of the probability</p>
        </div>
      {/each}
    </div>
    <p class="note ui">
      {#if rule === 'topK'}
        A fixed k cannot suit all three: after “Once upon a” it keeps {k} tokens where only one is plausible, while after “a big” the model spreads its bets far beyond them.
      {:else if rule === 'topP'}
        Top-p adapts: one token when the model is sure, many when it is not. But at high temperature the flattened tail fills the nucleus with junk — raise T and watch the count explode in the unsure context.
      {:else}
        Min-p scales the cut to the top token’s probability, so it adapts like top-p, and it stays strict at high temperature: the tail’s tokens are all far below a tenth of the leader.
      {/if}
    </p>
  {/if}
</Widget>

<style>
  .sl {
    flex: 1 1 11rem;
  }
  .muted {
    color: var(--ink-3);
  }
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
  }
  @media (max-width: 720px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .panel {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.5rem 0.6rem;
    background: var(--surface);
  }
  .prompt {
    font-size: 0.8rem;
    margin: 0 0 0.4rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cursor {
    color: var(--accent-2);
  }
  .chart {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 90px;
    border-bottom: 1px solid var(--rule);
  }
  .col {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: flex-end;
  }
  .b {
    width: 100%;
    background: var(--series-1);
    border-radius: 2px 2px 0 0;
  }
  .b.cut {
    background: var(--ink-3);
    opacity: 0.35;
  }
  .labels {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--ink-2);
    margin-top: 0.25rem;
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }
  .labels .cut {
    color: var(--ink-3);
    text-decoration: line-through;
  }
  .stat {
    font-size: 0.75rem;
    color: var(--ink-2);
    margin: 0.3rem 0 0;
  }
  .stat strong {
    color: var(--ink);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
    margin: 0.7rem 0 0;
  }
</style>
