<!--
  A Stern–Gerlach cartoon. Atoms with spin s are sent through a magnet with a field that changes with position; a classical little magnet
  would be deflected by any amount, but a quantum spin lands in one of 2s + 1 beams. Then a second magnet, tilted by θ, measures the atoms of
  one beam again: a spin-½ atom prepared "up" is found up with probability cos²(θ/2).

  A simulation of the textbook rules with a seeded generator, not a reproduction of the 1922 apparatus (which used silver atoms and a
  photographic plate).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { rng } from '$lib/hep/random';
  import { classicalDeflections, firstMagnet, probUp, projections, secondMagnet } from '$lib/sims/part1/spin';

  let { n, caption, title = 'A Stern–Gerlach cartoon' }: { n?: string | number; caption?: string; title?: string } = $props();

  let twoS = $state(1);
  let kind = $state<'quantum' | 'classical'>('quantum');
  let theta = $state(90);
  let seed = $state(1);
  const N = 4000;

  const first = $derived(firstMagnet(rng(seed), N, twoS));
  const classical = $derived.by(() => {
    const d = classicalDeflections(rng(seed + 1000), N);
    const nb = 21;
    const c = new Array<number>(nb).fill(0);
    for (const v of d) c[Math.min(nb - 1, Math.floor(((v + 1) / 2) * nb))]!++;
    return c;
  });
  const second = $derived(secondMagnet(rng(seed + 7), N, (theta * Math.PI) / 180));
  const ms = $derived(projections(twoS));
  const spinLabel = (x: number) => (x === 0 ? '0' : x % 1 === 0 ? `${x > 0 ? '+' : '−'}${Math.abs(x)}` : `${x > 0 ? '+' : '−'}${Math.abs(x) * 2}/2`);

  const H = 210;
  const yOf = (m: number) => H / 2 - (m / (twoS / 2)) * 70;
  const barMax = $derived(kind === 'quantum' ? Math.max(...first) : Math.max(...classical));
</script>

<Widget {title} subtitle="Spin shows up as a small, whole number of beams" {n} {caption} kind="Simulation" onreset={() => { twoS = 1; kind = 'quantum'; theta = 90; seed = 1; }}>
  {#snippet controls()}
    <Segmented label="Spin of the atoms" size="sm" bind:value={twoS} options={[{ value: 1, label: 'spin ½' }, { value: 2, label: 'spin 1' }, { value: 3, label: 'spin 3/2' }]} />
    <Segmented label="What the atoms are" size="sm" bind:value={kind} options={[{ value: 'quantum', label: 'Quantum spins' }, { value: 'classical', label: 'Classical little magnets' }]} />
  {/snippet}

  <div class="cols">
    <div>
      <h5 class="ui">First magnet: {N.toLocaleString('en-GB')} atoms, random orientations</h5>
      <svg viewBox="0 0 420 {H}" role="img" aria-label={kind === 'quantum' ? `Atoms of spin ${twoS / 2} split into ${twoS + 1} beams` : 'Classical magnets are spread continuously over the screen'}>
        <rect x="150" y="20" width="70" height="{H / 2 - 28}" rx="4" fill="var(--bad)" opacity="0.25" stroke="var(--bad)" />
        <text x="185" y="{H / 2 - 28}" text-anchor="middle" font-size="12" fill="var(--bad)">N</text>
        <rect x="150" y="{H / 2 + 8}" width="70" height="{H / 2 - 28}" rx="4" fill="var(--volt-neg)" opacity="0.25" stroke="var(--volt-neg)" />
        <text x="185" y="{H / 2 + 32}" text-anchor="middle" font-size="12" fill="var(--volt-neg)">S</text>
        <circle cx="30" cy="{H / 2}" r="6" fill="var(--ink-2)" />
        <text x="30" y="{H / 2 + 22}" text-anchor="middle" font-size="10" fill="var(--mute)">oven</text>
        <line x1="36" x2="150" y1={H / 2} y2={H / 2} stroke="var(--ink-3)" stroke-width="2" />
        {#if kind === 'quantum'}
          {#each ms as m, i}
            <path d="M150 {H / 2} L220 {H / 2} L330 {yOf(m)}" fill="none" stroke="var(--sig-high)" stroke-width="2.4" opacity="0.9" />
            <rect x="330" y={yOf(m) - 3} width={(first[i]! / barMax) * 70} height="6" fill="var(--sig-high)" />
            <text x="334" y={yOf(m) - 7} font-size="10" fill="var(--ink-2)">m = {spinLabel(m)}  ({first[i]})</text>
          {/each}
        {:else}
          <path d="M150 {H / 2} L220 {H / 2} L330 {H / 2 - 70} M220 {H / 2} L330 {H / 2 + 70}" fill="none" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="3 3" opacity="0.6" />
          {#each classical as c, i}
            {@const y = H / 2 + 70 - (i / 20) * 140}
            <rect x="330" y={y - 3.2} width={(c / barMax) * 70} height="6.4" fill="var(--series-1)" opacity="0.8" />
          {/each}
          <text x="334" y="14" font-size="10" fill="var(--ink-2)">a smear, not beams</text>
        {/if}
        <line x1="330" x2="330" y1="10" y2={H - 10} stroke="var(--line-strong)" />
      </svg>
      <p class="ui small" aria-live="polite">
        {#if kind === 'quantum'}Observed: {twoS + 1} beams, for spin {twoS / 2}, each with about 1/{twoS + 1} of the atoms: {first.join(', ')}. The number of beams is 2<em>s</em> + 1.{:else}A classical magnet can point anywhere, so its deflection is continuous. The 1922 experiment saw separated beams instead.{/if}
      </p>
    </div>

    <div>
      <h5 class="ui">Second magnet, tilted by θ (spin ½ only)</h5>
      <Slider bind:value={theta} min={0} max={180} step={1} label="Tilt θ of the second magnet" format={(v) => `${v.toFixed(0)}°`} />
      {#if twoS === 1}
        <div class="bars ui" role="img" aria-label="Found up: {second.up} of {N}; found down: {second.down}">
          <div class="brow"><span>up</span><span class="bt"><i style:width="{(second.up / N) * 100}%" style="background:var(--sig-high)"></i><b style:left="{probUp((theta * Math.PI) / 180) * 100}%"></b></span><span class="bv">{second.up}</span></div>
          <div class="brow"><span>down</span><span class="bt"><i style:width="{(second.down / N) * 100}%" style="background:var(--series-1)"></i><b style:left="{(1 - probUp((theta * Math.PI) / 180)) * 100}%"></b></span><span class="bv">{second.down}</span></div>
        </div>
        <p class="ui small" aria-live="polite">Atoms prepared up along z, then measured along an axis tilted by {theta}°: the quantum rule is cos²(θ/2) = {(probUp((theta * Math.PI) / 180) * 100).toFixed(1)} % up (tick). Seen: {((second.up / N) * 100).toFixed(1)} %. At 90° it is half and half, although the atoms were prepared: a spin has a definite value along one axis only.</p>
      {:else}
        <p class="ui small">Choose spin ½ to see the second measurement.</p>
      {/if}
      <Button size="sm" onclick={() => (seed += 1)}>New seed ({seed})</Button>
    </div>
  </div>
</Widget>

<style>
  .cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
    gap: 1.2rem;
    align-items: start;
  }
  h5 {
    margin: 0 0 0.4rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--ink-2);
  }
  svg {
    width: 100%;
    height: auto;
    background: var(--chart-surface);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .small {
    font-size: 0.78rem;
    color: var(--ink-2);
    line-height: 1.45;
    margin: 0.4rem 0 0.6rem;
  }
  .bars {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-top: 0.6rem;
  }
  .brow {
    display: grid;
    grid-template-columns: 3rem 1fr 3.5rem;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.8rem;
  }
  .bt {
    position: relative;
    height: 1rem;
    background: var(--pn);
    border-radius: 3px;
  }
  .bt i {
    display: block;
    height: 100%;
    border-radius: 3px;
  }
  .bt b {
    position: absolute;
    top: -3px;
    width: 2px;
    height: calc(100% + 6px);
    background: var(--fg);
  }
</style>
