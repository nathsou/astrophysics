<!--
  The key to the colours and line styles of every event display and diagram in the course:
    ::particle-legend{}                      all kinds
    ::particle-legend{kinds="muon,electron,photon" title="How to read the tracks" n="7.1"}
  With a `title` it is framed as a figure. Each kind shows its sample line, its name and what the style means.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import { PARTICLE_KINDS, styleFor, type ParticleClass } from '../theme/particles.ts';
  import KindSwatch from './KindSwatch.svelte';

  let {
    kinds = undefined,
    descriptions = true,
    extras = false,
    title,
    n,
    caption,
  }: {
    /** A list, or a comma-separated string from a Markdown directive; default all. */
    kinds?: ParticleClass[] | string;
    descriptions?: boolean;
    /** Also show the detector encodings: hits, calorimeter towers, jet cone and missing pT. */
    extras?: boolean;
    title?: string;
    n?: string | number;
    caption?: string;
  } = $props();

  const list = $derived.by((): ParticleClass[] => {
    const k = typeof kinds === 'string' ? kinds.split(/[,\s]+/).filter(Boolean) : kinds;
    const valid = (k ?? PARTICLE_KINDS).filter((x): x is ParticleClass => (PARTICLE_KINDS as readonly string[]).includes(x));
    return valid.length ? valid : [...PARTICLE_KINDS];
  });
</script>

{#snippet body()}
  <ul class="legend ui" aria-label="Particle colours and line styles">
    {#each list as k (k)}
      {@const s = styleFor(k)}
      <li>
        <KindSwatch kind={k} />
        <span class="txt">
          <strong>{s.label}</strong>
          {#if descriptions}<span class="d">{s.description}</span>{/if}
        </span>
      </li>
    {/each}
    {#if extras}
      <li>
        <svg class="sw" width="52" height="16" aria-hidden="true"><rect x="8" y="2" width="14" height="12" fill="var(--p-calo-em)" fill-opacity="0.5" stroke="var(--p-calo-em)" /><rect x="28" y="4" width="14" height="10" fill="var(--p-calo-had)" fill-opacity="0.5" stroke="var(--p-calo-had)" /></svg>
        <span class="txt"><strong>Calorimeter towers</strong>{#if descriptions}<span class="d">height proportional to energy; cyan is electromagnetic, orange is hadronic</span>{/if}</span>
      </li>
      <li>
        <svg class="sw" width="52" height="16" aria-hidden="true"><circle cx="10" cy="8" r="1.8" fill="var(--p-hit)" /><circle cx="20" cy="7" r="1.8" fill="var(--p-hit)" /><circle cx="30" cy="9" r="1.8" fill="var(--p-hit)" /><path d="M42 3l5 5-5 5-5-5z" fill="var(--p-muon)" /></svg>
        <span class="txt"><strong>Hits</strong>{#if descriptions}<span class="d">dots in the tracker, diamonds in the muon chambers</span>{/if}</span>
      </li>
    {/if}
  </ul>
{/snippet}

{#if title}
  <Widget {title} {n} {caption} kind="Key" live={false}>{@render body()}</Widget>
{:else}
  {@render body()}
{/if}

<style>
  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
    gap: 0.5rem 1.2rem;
  }
  li {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    min-width: 0;
  }
  .txt {
    display: flex;
    flex-direction: column;
    font-size: 0.82rem;
    line-height: 1.3;
    min-width: 0;
  }
  .d {
    color: var(--ink-2);
    font-size: 0.76rem;
  }
  .sw {
    flex: none;
  }
</style>
