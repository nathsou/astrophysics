<!--
  Zagier's one-sentence proof, as windmills (after Alexander Spivak). A solution of x² + 4yz = p is
  a windmill: a central x × x square with four y × z blades. Two involutions pair the windmills up:
  the "flip" (x, y, z) ↦ (x, z, y), and Zagier's map, which redraws the same outline around a
  different central square. Zagier's map has exactly one fixed point, so the number of windmills is
  odd — so the flip has a fixed point too, and a fixed point of the flip is p = x² + (2y)².
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  const PRIMES = [5, 13, 17, 29, 37, 41, 53, 61, 73, 89, 97, 101, 109, 113];
  let p = $state(29);
  let mode = $state<'zagier' | 'flip'>('zagier');
  let hover = $state<string | null>(null);

  type T = [number, number, number];
  const key = (t: T) => t.join(',');
  const triples = $derived.by(() => {
    const out: T[] = [];
    for (let x = 1; x * x < p; x += 2)
      for (let y = 1; 4 * y <= p - x * x; y++) {
        const r = p - x * x;
        if (r % (4 * y) === 0) out.push([x, y, r / (4 * y)]);
      }
    return out;
  });

  function zagier([x, y, z]: T): T {
    if (x < y - z) return [x + 2 * z, z, y - x - z];
    if (x < 2 * y) return [2 * y - x, y, x - y + z];
    return [x - 2 * y, x - y + z, y];
  }
  const flip = ([x, y, z]: T): T => [x, z, y];
  const partner = (t: T) => (mode === 'zagier' ? zagier(t) : flip(t));

  const groups = $derived.by(() => {
    const seen = new Set<string>();
    const pairs: T[][] = [];
    for (const t of triples) {
      if (seen.has(key(t))) continue;
      const u = partner(t);
      seen.add(key(t));
      seen.add(key(u));
      pairs.push(key(u) === key(t) ? [t] : [t, u]);
    }
    return pairs.sort((a, b) => a.length - b.length);
  });
  const fixed = $derived(groups.filter((g) => g.length === 1).map((g) => g[0]!));

  /** Polygons for the windmill: central square and four blades, centred at the origin. */
  function shapes([x, y, z]: T) {
    const h = x / 2;
    const blade0: [number, number][] = [
      [-h, -h - z],
      [-h + y, -h - z],
      [-h + y, -h],
      [-h, -h],
    ];
    const rot = (pts: [number, number][], k: number) =>
      pts.map(([u, v]) => {
        let [a, b] = [u, v];
        for (let i = 0; i < k; i++) [a, b] = [-b, a];
        return [a, b] as [number, number];
      });
    return {
      square: [
        [-h, -h],
        [h, -h],
        [h, h],
        [-h, h],
      ] as [number, number][],
      blades: [0, 1, 2, 3].map((k) => rot(blade0, k)),
      extent: h + Math.max(y, z) + 0.5,
    };
  }
  // One scale for all windmills of the same p, so that paired outlines can be compared by eye.
  const maxExtent = $derived(Math.max(...triples.map((t) => shapes(t).extent)));
  const pts = (ps: [number, number][], s: number) => ps.map(([u, v]) => `${(u * s).toFixed(2)},${(-v * s).toFixed(2)}`).join(' ');
</script>

<Widget title="Windmills" subtitle="Each solution of x² + 4yz = p (x odd) is a windmill: a central square of side x and four y × z blades, total area p. Choose how to pair them up." onreset={() => ((p = 29), (mode = 'zagier'))}>
  {#snippet controls()}
    <label class="ctl">p = <select bind:value={p}>{#each PRIMES as q (q)}<option value={q}>{q}</option>{/each}</select></label>
    <div class="modes">
      <button class:on={mode === 'zagier'} onclick={() => (mode = 'zagier')}>Zagier’s pairing</button>
      <button class:on={mode === 'flip'} onclick={() => (mode = 'flip')}>Flip the blades</button>
    </div>
    <span class="count num">{triples.length} windmills — an odd number</span>
  {/snippet}
  <div class="groups">
    {#each groups as g, i (i)}
      <div class="group" class:single={g.length === 1}>
        {#each g as t (key(t))}
          {@const sh = shapes(t)}
          {@const s = 36 / maxExtent}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="wm" onmouseenter={() => (hover = key(t))} onmouseleave={() => (hover = null)} class:hl={hover === key(t)}>
            <svg viewBox="-38 -38 76 76" width="84" height="84" aria-label="Windmill x={t[0]}, y={t[1]}, z={t[2]}">
              {#each sh.blades as b, k (k)}<polygon points={pts(b, s)} class="blade" style:--k={k} />{/each}
              <polygon points={pts(sh.square, s)} class="sq" />
            </svg>
            <span class="lab num">({t.join(', ')})</span>
          </div>
        {/each}
        {#if g.length === 1}<span class="fix">fixed</span>{/if}
      </div>
    {/each}
  </div>
  <p class="note">
    {#if mode === 'zagier'}
      Zagier’s map pairs windmills with the same outline. Exactly one windmill — (1, 1, {(p - 1) / 4}) — is paired with itself, so the total is odd.
    {:else}
      Flipping swaps y and z. A windmill is fixed when y = z: its blades are squares, and then
      {#each fixed as f, i (i)}{#if i}, {/if}<strong>{p} = {f[0]}² + {2 * f[1]}²</strong>{/each}.
    {/if}
  </p>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
  }
  select {
    font: inherit;
    padding: 0.1rem 0.3rem;
    border-radius: 5px;
    border: 1px solid var(--rule-strong);
    background: var(--page);
    color: var(--ink);
  }
  .modes {
    display: flex;
    gap: 0.25rem;
  }
  .modes button {
    font: inherit;
    font-size: 0.8rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.2rem 0.7rem;
    cursor: pointer;
  }
  .modes button.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .count {
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .groups {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  .group {
    position: relative;
    display: flex;
    gap: 0.2rem;
    padding: 0.3rem;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--page);
    animation: in 0.35s ease-out;
  }
  .group.single {
    border: 2px solid var(--accent);
  }
  @keyframes in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  .wm {
    display: grid;
    justify-items: center;
    border-radius: 6px;
  }
  .wm.hl {
    background: var(--surface-2);
  }
  .blade {
    fill: color-mix(in srgb, var(--byrne-blue) calc(55% + var(--k) * 10%), var(--surface));
    stroke: var(--byrne-ink);
    stroke-width: 0.8;
  }
  .sq {
    fill: var(--byrne-red);
    stroke: var(--byrne-ink);
    stroke-width: 0.8;
  }
  .lab {
    font-size: 0.68rem;
    color: var(--ink-2);
  }
  .fix {
    position: absolute;
    top: -0.55rem;
    right: 0.4rem;
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: var(--accent);
    color: var(--on-accent);
    border-radius: 99px;
    padding: 0 0.4rem;
  }
  .note {
    font-size: 0.85rem;
    margin: 0.7rem 0 0;
    color: var(--ink-2);
  }
</style>
