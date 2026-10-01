<!--
  The accessible alternative to the pictures: every object of the event as a list of buttons, grouped. Focusing an entry
  highlights it in all views (the same as hovering); pressing it selects it. Long groups are paged.
-->
<script lang="ts">
  import { listObjects, type DisplayScene, type ObjectCat } from './scene.ts';
  import { linkLabel } from './inspect.ts';
  import KindSwatch from './KindSwatch.svelte';

  let {
    scene,
    activeKey,
    onfocusobject,
    onselect,
  }: {
    scene: DisplayScene;
    /** The selected object's key. */
    activeKey: string | null;
    /** Keyboard focus moved to an entry (null when it leaves). */
    onfocusobject?: (id: number | null) => void;
    onselect?: (id: number) => void;
  } = $props();

  const PAGE = 60;
  const groups: { cat: ObjectCat; title: string }[] = [
    { cat: 'object', title: 'Reconstructed objects' },
    { cat: 'met', title: 'Missing transverse momentum' },
    { cat: 'vertex', title: 'Vertices' },
    { cat: 'track', title: 'Tracks' },
    { cat: 'cluster', title: 'Calorimeter clusters' },
    { cat: 'tower', title: 'Calorimeter towers' },
    { cat: 'truth', title: 'Truth particles' },
  ];
  let open = $state<Record<string, boolean>>({ object: true });
  let shown = $state<Record<string, number>>({});
  const lists = $derived(groups.map((g) => ({ ...g, items: listObjects(scene, g.cat) })).filter((g) => g.items.length));
  const total = $derived(scene.objects.length);
</script>

<details class="olist ui">
  <summary>Object list: all {total} objects, for keyboard and screen-reader use</summary>
  {#each lists as g (g.cat)}
    <details
      class="grp"
      open={open[g.cat] ?? false}
      ontoggle={(e) => (open[g.cat] = (e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>{g.title} <span class="n">{g.items.length}</span></summary>
      {#if open[g.cat]}
        <ul>
          {#each g.items.slice(0, shown[g.cat] ?? PAGE) as o (o.id)}
            <li>
              <button
                type="button"
                aria-pressed={activeKey === o.key}
                class:on={activeKey === o.key}
                onfocus={() => onfocusobject?.(o.id)}
                onblur={() => onfocusobject?.(null)}
                onmouseenter={() => onfocusobject?.(o.id)}
                onmouseleave={() => onfocusobject?.(null)}
                onclick={() => onselect?.(o.id)}
              >
                {#if o.kind}<KindSwatch kind={o.kind} width={30} height={12} />{/if}
                <span>{linkLabel(scene, o.id)} · η {o.eta.toFixed(2)} · φ {o.phi.toFixed(2)}</span>
              </button>
            </li>
          {/each}
        </ul>
        {#if g.items.length > (shown[g.cat] ?? PAGE)}
          <button type="button" class="more" onclick={() => (shown[g.cat] = (shown[g.cat] ?? PAGE) + 200)}>Show {Math.min(200, g.items.length - (shown[g.cat] ?? PAGE))} more of {g.items.length - (shown[g.cat] ?? PAGE)} remaining</button>
        {/if}
      {/if}
    </details>
  {/each}
</details>

<style>
  .olist {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.4rem 0.7rem;
    background: var(--panel);
    font-size: 0.82rem;
  }
  summary {
    cursor: pointer;
    color: var(--ink-2);
    padding: 0.2rem 0;
  }
  .grp {
    margin: 0.2rem 0 0.2rem 0.6rem;
  }
  .n {
    color: var(--mute);
    font-family: var(--font-mono);
    font-size: 0.74rem;
    margin-left: 0.3rem;
  }
  ul {
    list-style: none;
    margin: 0.2rem 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr));
    gap: 0.15rem 0.6rem;
  }
  li button,
  .more {
    width: 100%;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    text-align: left;
    border: 1px solid transparent;
    background: transparent;
    color: var(--fg);
    border-radius: 5px;
    padding: 0.15rem 0.4rem;
    font: inherit;
    font-size: 0.78rem;
    cursor: pointer;
  }
  .more {
    width: auto;
    border-color: var(--line-strong);
    margin: 0.2rem 0 0.4rem;
  }
  li button:hover,
  li button:focus-visible {
    border-color: var(--track);
    background: var(--track-soft);
  }
  li button.on {
    border-color: var(--track);
    font-weight: 600;
  }
</style>
