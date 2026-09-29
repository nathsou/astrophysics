<!--
  Measured: CourseGPT before fine-tuning, fully fine-tuned, and with LoRA at three ranks — how often its stories
  obey the instruction, how much it forgot about plain stories, and what each cost to train. With samples.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { DATA } from '../data';

  const E = DATA.evaluate;
  const F = DATA.finetune;
  const keys = ['base', ...Object.keys(DATA.settings)];
  const label = (k: string) => (k === 'base' ? 'CourseGPT, not fine-tuned' : DATA.settings[k]!);
  let sample = $state(E ? Object.keys(E.samples)[1] ?? 'base' : 'base');
  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
  const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} M` : `${(n / 1e3).toFixed(0)} k`);
</script>

<Widget
  title="Teaching CourseGPT to follow instructions"
  subtitle={E ? `${E.n} held-out instructions (a name and three words), one story each at T = 0.7, top-p 0.9. “All” means the story used the name and all three words. Plain-story loss is on validation stories without instructions: a rise means forgetting.` : 'Measured with CourseGPT in PyTorch.'}
  kind="Measured"
>
  {#if !E}
    <p class="muted">Run <code>uv run lmc ch20 finetune</code>, <code>evaluate</code> and <code>summary</code>.</p>
  {:else}
    <table class="res num ui">
      <thead><tr><th></th><th>all</th><th>3 words</th><th>name</th><th>plain-story loss</th><th>trained parameters</th><th>time</th></tr></thead>
      <tbody>
        {#each keys as k (k)}
          {@const r = E.results[k]}
          {#if r}
            <tr>
              <td>{label(k)}</td>
              <td><span class="bar" style:width="{r.all * 4}rem"></span>{pct(r.all)}</td>
              <td>{pct(r.words)}</td>
              <td>{pct(r.name)}</td>
              <td>{r.story_bits.toFixed(3)}{#if k !== 'base' && E.results.base}<span class="d"> ({r.story_bits - E.results.base.story_bits >= 0 ? '+' : ''}{(r.story_bits - E.results.base.story_bits).toFixed(3)})</span>{/if}</td>
              <td>{F?.[k] ? fmt(F[k]!.trainable) : '—'}</td>
              <td>{F?.[k] ? `${Math.round(F[k]!.seconds)} s` : '—'}</td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
    <div class="samples">
      <Segmented label="Model" size="sm" options={keys.filter((k) => E.samples[k]).map((k) => ({ value: k, label: label(k) }))} bind:value={sample} />
      {#each E.samples[sample] ?? [] as s, i (i)}
        <div class="ex">
          <p class="ins">{s.instruction}</p>
          <p class="story">{s.story.slice(0, 600)}{s.story.length > 600 ? '…' : ''}</p>
        </div>
      {/each}
    </div>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .res {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  .res th {
    text-align: left;
    font-size: 0.7rem;
    color: var(--ink-2);
    font-weight: 600;
  }
  .res td {
    border-top: 1px solid var(--rule);
    padding: 0.25rem 0.3rem;
    white-space: nowrap;
  }
  .bar {
    display: inline-block;
    height: 0.6rem;
    background: var(--series-1);
    border-radius: 2px;
    margin-right: 0.3rem;
    vertical-align: middle;
  }
  .d {
    color: var(--ink-3);
  }
  .samples {
    margin-top: 0.9rem;
  }
  .ex {
    border-top: 1px solid var(--rule);
    padding-top: 0.4rem;
    margin-top: 0.5rem;
  }
  .ins {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--ink-2);
    margin: 0;
  }
  .story {
    font-size: 0.86rem;
    margin: 0.25rem 0 0;
    white-space: pre-wrap;
  }
</style>
