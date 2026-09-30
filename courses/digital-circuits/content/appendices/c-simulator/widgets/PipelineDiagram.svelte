<!--
  The pipelines of Appendix C, from pipelines.ts, as lanes of boxes:

    ::pipeline-diagram{id="simulator"}      (also "toolchain" and "plds")

  A box has what the stage does and the file that implements it. Alternatives that receive the same input are
  stacked. Kinds are told apart by border and fill, and by the words in the box, not by colour alone.
-->
<script lang="ts">
  import '../../a-reference/widgets/appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import { PIPELINES, type Step } from './pipelines';

  let { id = 'simulator', n, caption }: { id?: 'simulator' | 'toolchain' | 'plds'; n?: string | number; caption?: string } = $props();

  const pipe = $derived(PIPELINES.find((p) => p.id === id) ?? PIPELINES[0]!);
  const kindWord = { data: 'data', stage: 'code', engine: 'engine' } as const;
</script>

{#snippet card(s: Step)}
  <div class="card {s.kind}">
    <span class="kind">{kindWord[s.kind]}</span>
    <strong>{s.label}</strong>
    <span class="note">{s.note}</span>
    {#if s.path}<code class="path">{s.path.replace(/^src\/lib\//, '')}</code>{/if}
  </div>
{/snippet}

<Widget title={pipe.title} {n} kind="Diagram" live={false} caption={caption ?? pipe.caption}>
  <div class="lanes">
    {#each pipe.lanes as lane (lane.title)}
      <section aria-label={lane.title}>
        <h5>{lane.title}</h5>
        <ol class="lane">
          {#each lane.steps as step, i (i)}
            <li>
              {#if Array.isArray(step)}
                <div class="stack">
                  {#each step as s (s.label)}{@render card(s)}{/each}
                </div>
              {:else}
                {@render card(step)}
              {/if}
            </li>
          {/each}
        </ol>
      </section>
    {/each}
  </div>
</Widget>

<style>
  .lanes {
    display: grid;
    gap: 1.1rem;
    padding: 0.9rem;
  }
  h5 {
    margin: 0 0 0.4rem;
    font-family: var(--font-ui);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .lane {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.3rem;
    align-items: center;
  }
  li {
    position: relative;
    display: flex;
    align-items: center;
  }
  li:not(:last-child)::after {
    content: '→';
    position: absolute;
    right: -1.1rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--copper);
    font-family: var(--font-ui);
    font-size: 0.95rem;
  }
  .stack {
    display: grid;
    gap: 0.35rem;
    padding-left: 0.5rem;
    border-left: 2px solid var(--copper);
  }
  .card {
    display: grid;
    gap: 0.1rem;
    width: 10.6rem;
    padding: 0.4rem 0.55rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--copper-soft);
    font-family: var(--font-ui);
    font-size: 0.74rem;
    line-height: 1.3;
    color: var(--ink-2);
  }
  .card.data {
    background: var(--panel);
    border-style: dashed;
  }
  .card.engine {
    background: var(--ok-soft);
    border-color: var(--phosphor);
  }
  .card strong {
    font-size: 0.8rem;
    color: var(--fg);
  }
  .kind {
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .path {
    font-family: var(--font-mono);
    font-size: 0.64rem;
    color: var(--mute);
    overflow-wrap: anywhere;
  }
  @media (max-width: 40rem) {
    .card {
      width: 15rem;
      max-width: calc(100vw - 5rem);
    }
  }
</style>
