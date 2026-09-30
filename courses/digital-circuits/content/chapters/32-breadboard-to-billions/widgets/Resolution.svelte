<!--
  Figure 32.3: how small a line a printing machine can draw, from the Rayleigh equation CD = k1 λ / NA. Pick a machine
  and a k1 (the skill of the process: mask tricks, multiple exposures) and read off the half-pitch.

    ::resolution{n="32.3" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { K1_LIMIT, SCANNERS, resolution } from './litho';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let k1 = $state(0.4);
  let sel = $state('arfi');
  const rows = $derived(SCANNERS.map((s) => ({ s, cd: resolution(s.wavelengthNm, s.na, k1) })));
  const cur = $derived(rows.find((r) => r.s.id === sel)!);

  const LO = 4;
  const HI = 500;
  const pos = (nm: number) => (Math.log(nm / LO) / Math.log(HI / LO)) * 100;
  const fmt = (nm: number) => (nm >= 100 ? nm.toFixed(0) : nm >= 10 ? nm.toFixed(1) : nm.toFixed(1));
</script>

<Widget {n} title="How fine can light draw?" subtitle="Half-pitch = k₁ × wavelength ÷ numerical aperture" kind="Interactive" {caption} onreset={() => ((k1 = 0.4), (sel = 'arfi'))}>
  {#snippet controls()}
    <Slider label="k₁ (process skill; 0.25 is the limit)" bind:value={k1} min={K1_LIMIT} max={0.8} step={0.01} format={(v) => v.toFixed(2)} />
  {/snippet}

  <div class="rs">
    <ul class="ui" role="radiogroup" aria-label="Printing machine">
      {#each rows as r (r.s.id)}
        <li>
          <button type="button" role="radio" aria-checked={sel === r.s.id} class:on={sel === r.s.id} onclick={() => (sel = r.s.id)}>
            <span class="name">{r.s.name}<small>{r.s.wavelengthNm} nm, NA {r.s.na} · {r.s.era}</small></span>
            <span class="track" aria-hidden="true">
              <span class="bar" style:width="{pos(r.cd)}%"></span>
              <span class="wl" style:left="{pos(r.s.wavelengthNm)}%" title="wavelength"></span>
            </span>
            <span class="val">{fmt(r.cd)} nm</span>
          </button>
        </li>
      {/each}
    </ul>
    <p class="ui out" aria-live="polite">
      <strong>{cur.s.name}</strong> prints lines <strong>{fmt(cur.cd)} nm</strong> apart at k₁ = {k1.toFixed(2)}: {#if cur.cd < cur.s.wavelengthNm}<strong>{(cur.s.wavelengthNm / cur.cd).toFixed(1)} times finer</strong> than its own wavelength{:else}about as fine as its wavelength{/if}. The bars are on a logarithmic scale; the tick on each is the wavelength.
    </p>
  </div>
</Widget>

<style>
  .rs {
    display: grid;
    gap: 0.8rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }
  li {
    margin: 0;
  }
  button {
    display: grid;
    grid-template-columns: minmax(9rem, 13rem) minmax(0, 1fr) 4.6rem;
    align-items: center;
    gap: 0.4rem 0.8rem;
    width: 100%;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel);
    color: var(--fg);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  button.on {
    border-color: var(--copper);
    background: var(--copper-soft);
  }
  button:focus-visible {
    outline: 2px solid var(--copper);
    outline-offset: 2px;
  }
  .name {
    display: grid;
    font-size: 0.86rem;
    font-weight: 600;
  }
  small {
    font-weight: 400;
    font-size: 0.72rem;
    color: var(--mute);
  }
  .track {
    position: relative;
    height: 0.8rem;
    background: var(--pn);
    border-radius: 2px;
  }
  .bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: var(--series-3);
    border-radius: 2px;
  }
  .on .bar {
    background: var(--copper);
  }
  .wl {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    background: var(--sig-high);
  }
  .val {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    text-align: right;
  }
  .out {
    margin: 0;
    font-size: 0.88rem;
    color: var(--ink-2);
  }
  @media (max-width: 34rem) {
    button {
      grid-template-columns: minmax(0, 1fr) 4.4rem;
    }
    .track {
      grid-column: 1 / -1;
      grid-row: 2;
    }
  }
</style>
