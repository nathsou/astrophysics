<!--
  Golomb's necklace proof of Fermat's little theorem. All strings of length n in a colours, grouped
  into rotation classes (necklaces). When n = p is prime, every class has size p except the a
  single-colour ones — so p divides aᵖ − a.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let a = $state(2);
  let n = $state(5);
  const COLOURS = ['var(--byrne-red)', 'var(--byrne-blue)', 'var(--byrne-yellow)', 'var(--series-3)'];
  const isPrime = (k: number) => k > 1 && Array.from({ length: k - 2 }, (_, i) => i + 2).every((d) => k % d !== 0);

  const classes = $derived.by(() => {
    const total = a ** n;
    if (total > 4096) return null;
    const seen = new Set<string>();
    const out: string[][] = [];
    for (let m = 0; m < total; m++) {
      const s = m.toString(a).padStart(n, '0');
      if (seen.has(s)) continue;
      const orbit: string[] = [];
      for (let r = 0; r < n; r++) {
        const t = s.slice(r) + s.slice(0, r);
        if (!orbit.includes(t)) orbit.push(t);
        seen.add(t);
      }
      out.push(orbit);
    }
    return out.sort((x, y) => x.length - y.length);
  });
  const sizes = $derived(classes ? [...new Set(classes.map((c) => c.length))].sort((x, y) => x - y) : []);
  const R = 17;
  const bead = (k: number) => {
    const t = (k / n) * 2 * Math.PI - Math.PI / 2;
    return { x: 22 + R * Math.cos(t), y: 22 + R * Math.sin(t) };
  };
</script>

<Widget title="Counting necklaces" subtitle="All strings of n beads in a colours, grouped by rotation. Each necklace is drawn once; the number under it counts the strings (rotations) it stands for." onreset={() => ((a = 2), (n = 5))}>
  {#snippet controls()}
    <label class="ctl">colours a = <strong>{a}</strong> <input type="range" min="2" max="4" bind:value={a} /></label>
    <label class="ctl">beads n = <strong>{n}</strong> <input type="range" min="2" max="8" bind:value={n} /></label>
  {/snippet}
  {#if !classes}
    <p class="warn">{a}<sup>{n}</sup> = {a ** n} strings is too many to draw; try fewer beads or colours.</p>
  {:else}
    <div class="necks">
      {#each classes as c, i (i)}
        <div class="neck" class:mono={c.length === 1} title="{c.length} rotation{c.length > 1 ? 's' : ''}: {c.join(', ')}">
          <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
            <circle cx="22" cy="22" r={R} class="string" />
            {#each c[0]!.split('') as ch, k (k)}
              {@const b = bead(k)}
              <circle cx={b.x} cy={b.y} r="5" fill={COLOURS[Number(ch)]} class="bead" />
            {/each}
          </svg>
          <span class="n num">×{c.length}</span>
        </div>
      {/each}
    </div>
    <div class="tally ui num">
      <p>{a}<sup>{n}</sup> = {a ** n} strings form <strong>{classes.length}</strong> necklaces with {sizes.map((s) => `${classes!.filter((c) => c.length === s).length} of size ${s}`).join(', ')}.</p>
      {#if isPrime(n)}
        <p class="ok">n = {n} is prime: apart from the {a} one-colour necklaces, every necklace has exactly {n} rotations. So {a}<sup>{n}</sup> − {a} = {a ** n - a} = {n} × {(a ** n - a) / n}.</p>
      {:else}
        <p class="bad">n = {n} is not prime: some necklaces have fewer than {n} distinct rotations (sizes {sizes.filter((s) => s !== 1 && s !== n).join(', ') || '—'}), and {a}<sup>{n}</sup> − {a} = {a ** n - a} {(a ** n - a) % n === 0 ? 'happens to be' : 'is not'} divisible by {n}.</p>
      {/if}
    </div>
  {/if}
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .necks {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    max-height: 22rem;
    overflow-y: auto;
  }
  .neck {
    display: grid;
    justify-items: center;
    padding: 0.2rem 0.3rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--page);
    animation: in 0.3s ease-out;
  }
  .neck.mono {
    border-color: var(--accent);
  }
  @keyframes in {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
  }
  .string {
    fill: none;
    stroke: var(--ink-3);
  }
  .bead {
    stroke: var(--byrne-ink);
    stroke-width: 0.8;
  }
  .n {
    font-size: 0.7rem;
    color: var(--ink-2);
  }
  .tally {
    font-size: 0.85rem;
    margin-top: 0.6rem;
  }
  .tally p {
    margin: 0.25rem 0;
  }
  .ok {
    color: var(--ok);
    font-weight: 600;
  }
  .bad {
    color: var(--maybe);
    font-weight: 600;
  }
  .warn {
    color: var(--maybe);
  }
</style>
