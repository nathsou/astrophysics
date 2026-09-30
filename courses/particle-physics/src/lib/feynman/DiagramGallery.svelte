<!--
  All the diagrams of a process, with the order in the couplings and a short description of each:

    ::diagram-gallery{process="e+ e- > e+ e-" forces="qed" n="15.3" caption="…"}

  Tree diagrams by default. `loops` lists the one-loop diagrams of a small process instead (e.g. `process="e+ e- > mu+ mu-" loops forces="qed"`).
  A process with no tree diagram that is in the loop-induced registry (gg → H) shows its leading loop diagrams and says why.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import DiagramSvg from './DiagramSvg.svelte';
  import { withSubscripts } from './fmt';
  import { renderDiagram } from './render';
  import {
    amplitudeOrderLabel, describeDiagram, diagramOrder, enumerateOneLoopDiagrams, enumerateTreeDiagrams, loopInducedEntry, orderLabel, processSymbols, rankDiagrams,
    tryParseProcess, vertexRules, symmetryFactor, identicalParticleFactor, type Diagram, type Force, type LoopOptions,
  } from '$lib/hep/diagrams';

  let {
    process,
    forces,
    loops = false,
    rank = false,
    n,
    caption,
    title,
    width = 300,
    height = 200,
    mono = false,
  }: {
    process: string;
    forces?: string;
    /** List one-loop diagrams instead of tree diagrams. */
    loops?: boolean;
    /** Sort by the coupling-only rate estimate. */
    rank?: boolean;
    n?: string | number;
    caption?: string;
    title?: string;
    width?: number;
    height?: number;
    mono?: boolean;
  } = $props();

  const parsed = $derived(tryParseProcess(process));
  const options = $derived<LoopOptions>(forces ? { forces: forces.split(/[,\s]+/).filter(Boolean) as Force[] } : {});

  const result = $derived.by(() => {
    if (!parsed.ok) return { list: [] as Diagram[], note: '', error: parsed.error, loopInduced: false };
    const { initial, final } = parsed.process;
    if (loops) return { list: enumerateOneLoopDiagrams(initial, final, options), note: '', error: '', loopInduced: false };
    const trees = enumerateTreeDiagrams(initial, final, options);
    if (trees.length) return { list: rank ? rankDiagrams(trees).map((r) => r.diagram) : trees, note: '', error: '', loopInduced: false };
    const e = loopInducedEntry(initial, final);
    if (e) return { list: enumerateOneLoopDiagrams(initial, final, e.options), note: e.description, error: '', loopInduced: true };
    return { list: [] as Diagram[], note: '', error: '', loopInduced: false };
  });

  const cards = $derived(
    result.list.map((d) => {
      const o = diagramOrder(d, { forces: [...(options.forces ?? ['qed', 'qcd', 'weak', 'higgs', 'fermi'])] });
      const rules = [...vertexRules(d).values()].map((r) => r.name);
      const counts = new Map<string, number>();
      for (const r of rules) counts.set(r, (counts.get(r) ?? 0) + 1);
      return {
        d,
        model: renderDiagram(d, { width, height, mono, fontSize: 14 }),
        desc: describeDiagram(d),
        order: o,
        vertices: [...counts.entries()].map(([k, c]) => (c > 1 ? `${k} ×${c}` : k)).join(', '),
        sym: symmetryFactor(d),
      };
    }),
  );
  const heading = $derived(title ?? (parsed.ok ? `${loops || result.loopInduced ? 'One-loop' : 'Tree'} diagrams: ${processSymbols(parsed.process)}` : 'Diagrams'));
  const ident = $derived(parsed.ok ? identicalParticleFactor(parsed.process.final) : 1);
</script>

<Widget title={heading} {n} {caption} kind="Diagrams" live={false}>
  {#if result.error}
    <p class="ui err" role="alert">{result.error}</p>
  {:else if !cards.length}
    <p class="ui">This process has no diagram with these interactions at this order.</p>
  {:else}
    <p class="ui summary" aria-live="polite">
      {cards.length} diagram{cards.length === 1 ? '' : 's'}{#if !loops && !result.loopInduced}{' '}at tree level{/if}.
      {#if ident !== 1}Identical particles in the final state: the rate carries a factor 1/{Math.round(1 / ident)}.{/if}
    </p>
    {#if result.note}<p class="ui note">{result.note}</p>{/if}
    <ol class="grid">
      {#each cards as c, i (i)}
        <li class="card">
          <DiagramSvg model={c.model} title="Diagram {i + 1}: {c.desc}" />
          <div class="meta ui">
            <strong>{@html withSubscripts(`${i + 1}. ${c.desc}`)}</strong>
            <span class="order">Order <b>{orderLabel(c.order)}</b> in the rate (amplitude {amplitudeOrderLabel(c.order)})</span>
            {#if c.vertices}<span class="vert">Vertices: {c.vertices}</span>{/if}
            {#if c.sym !== 1}<span class="vert">Symmetry factor {c.sym === 0.5 ? '1/2' : c.sym.toFixed(3)}</span>{/if}
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</Widget>

<style>
  .grid {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 270px), 1fr));
    gap: 0.9rem;
  }
  .card {
    border: 1px solid var(--line, #d5d1c5);
    border-radius: var(--radius-sm, 5px);
    background: var(--panel, #fbfaf6);
    padding: 0.5rem 0.6rem 0.6rem;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.78rem;
    color: var(--ink-2, #3d4550);
    text-transform: none;
    letter-spacing: 0;
  }
  .meta strong {
    color: var(--ink, #1c2127);
    font-size: 0.85rem;
  }
  .summary,
  .note {
    font-size: 0.85rem;
    margin: 0 0 0.4rem;
  }
  .note {
    color: var(--ink-2, #3d4550);
    font-family: var(--font-body);
    font-size: 0.95rem;
  }
  .err {
    color: var(--bad, #b8322a);
  }
</style>
