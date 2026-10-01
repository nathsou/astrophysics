<!--
  The inspector card: kind, pT, η, φ, charge, mass and links for the hovered or selected object. For a reconstructed object
  it lists the truth particle it matches and the tracks and clusters it was built from; for a truth particle its mothers,
  daughters and the reconstructed objects that matched it. Links select the linked object.
-->
<script lang="ts">
  import { inspect, linkLabel } from './inspect.ts';
  import type { DisplayScene } from './scene.ts';
  import KindSwatch from './KindSwatch.svelte';

  let {
    scene,
    activeId,
    pinned = false,
    onselect,
    onpreview,
    onclear,
  }: {
    scene: DisplayScene;
    /** The object shown: the hovered one, else the selected one. */
    activeId: number | null;
    /** Whether the object is selected (not just hovered). */
    pinned?: boolean;
    onselect?: (id: number) => void;
    onpreview?: (id: number | null) => void;
    onclear?: () => void;
  } = $props();

  const info = $derived(activeId === null ? null : inspect(scene, activeId));
</script>

<aside class="inspector ui" aria-label="Inspector" aria-live="polite">
  {#if info}
    <header>
      {#if info.kind}<KindSwatch kind={info.kind} />{:else if info.calo}<span class="calo" class:em={info.calo === 'ecal'} aria-hidden="true"></span>{/if}
      <div class="t">
        <h5>{info.title}</h5>
        <p class="sub">{info.subtitle}{pinned ? '' : ' · hover (click to keep)'}</p>
      </div>
      {#if pinned && onclear}<button type="button" class="x" onclick={onclear} aria-label="Clear the selection" title="Clear the selection">×</button>{/if}
    </header>
    <div class="body">
      <dl>
        {#each info.rows as r}
          <dt title={r.title}>{r.label}</dt>
          <dd>{r.value}</dd>
        {/each}
      </dl>
      <div class="links">
        {#each info.groups as g}
          <div class="grp">
            <h6>{g.label}</h6>
            <div class="chips">
              {#each g.ids as id (id)}
                <button type="button" class="chip" onclick={() => onselect?.(id)} onmouseenter={() => onpreview?.(id)} onmouseleave={() => onpreview?.(null)} onfocus={() => onpreview?.(id)} onblur={() => onpreview?.(null)}>{linkLabel(scene, id)}</button>
              {/each}
              {#if g.more}<span class="more">+{g.more} more</span>{/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <p class="hint">
      Hover over a track, tower, jet or hit, or click it, to see what it is. Or choose one from the object list below. Click the background or press Escape to clear.
    </p>
  {/if}
</aside>

<style>
  .inspector {
    container-type: inline-size;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--panel);
    padding: 0.7rem 0.85rem;
    font-size: 0.82rem;
    min-width: 0;
    min-height: 7rem;
  }
  header {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    margin-bottom: 0.5rem;
  }
  .t {
    flex: 1;
    min-width: 0;
  }
  h5 {
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    font-family: var(--font-display) !important;
    font-size: 1rem !important;
    line-height: 1.25 !important;
    text-transform: none !important;
    letter-spacing: 0 !important;
    color: var(--fg);
  }
  h5::before,
  h5::after {
    display: none !important;
  }
  .sub {
    margin: 0.15rem 0 0 !important;
    font-size: 0.74rem;
    color: var(--mute);
  }
  .x {
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    border-radius: 5px;
    width: 1.6rem;
    height: 1.6rem;
    cursor: pointer;
    line-height: 1;
    font-size: 1rem;
  }
  .calo {
    width: 14px;
    height: 14px;
    margin-top: 2px;
    border: 2px solid var(--p-calo-had);
    background: color-mix(in srgb, var(--p-calo-had) 40%, transparent);
    flex: none;
  }
  .calo.em {
    border-color: var(--p-calo-em);
    background: color-mix(in srgb, var(--p-calo-em) 40%, transparent);
  }
  dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 0.15rem 0.9rem;
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  dt {
    color: var(--mute);
    text-transform: none;
    letter-spacing: 0;
    cursor: help;
  }
  dd {
    margin: 0;
    color: var(--fg);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    overflow-wrap: anywhere;
  }
  .grp {
    margin-top: 0.6rem;
  }
  h6 {
    margin: 0 0 0.25rem !important;
    font-size: 0.7rem !important;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
  }
  .chip {
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    border-radius: 999px;
    padding: 0.12rem 0.6rem;
    font-size: 0.74rem;
    cursor: pointer;
    font-family: inherit;
  }
  .chip:hover,
  .chip:focus-visible {
    border-color: var(--track);
    color: var(--track-ink);
  }
  .more {
    color: var(--mute);
    font-size: 0.74rem;
  }
  @container (min-width: 640px) {
    .body {
      display: grid;
      grid-template-columns: minmax(14rem, 24rem) minmax(0, 1fr);
      gap: 0.4rem 2rem;
      align-items: start;
    }
    .links .grp:first-child {
      margin-top: 0;
    }
  }
  .hint {
    margin: 0;
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
