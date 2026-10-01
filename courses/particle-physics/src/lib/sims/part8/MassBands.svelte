<!--
  The effective Majorana mass m_ββ of neutrinoless double-beta decay against the lightest neutrino mass, for both mass orderings, over all Majorana phases,
  with the limits of the day as lines. Nothing here is measured: the bands follow from the oscillation parameters (hep/oscillations).

    ::mass-bands{n="31.5" caption="…"}    Props: `n`, `caption`, `title`.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import LinePlot from './LinePlot.svelte';
  import { defaultParams, neutrinoMasses, majoranaRange, sumOfMasses, GLOBAL_FIT_APPROX } from '$lib/hep/oscillations';
  import { logspace, sig } from './format';

  let { n, caption, title = 'The effective Majorana mass and the neutrino mass scale' }: { n?: string | number; caption?: string; title?: string } = $props();

  let showNormal = $state(true);
  let showInverted = $state(true);
  const ml = logspace(1e-4, 1, 70);
  const pN = defaultParams('normal');
  const pI = defaultParams('inverted');
  const DM3L_NO = GLOBAL_FIT_APPROX.dm3l, DM3L_IO = 2.48e-3;
  const band = (ordering: 'normal' | 'inverted') => {
    const p = ordering === 'normal' ? pN : pI;
    const dm = ordering === 'normal' ? DM3L_NO : DM3L_IO;
    const lo: number[] = [], hi: number[] = [];
    for (const m of ml) {
      const r = majoranaRange(neutrinoMasses(m, p.dm21, dm, ordering), p, 40);
      lo.push(Math.max(r.min, 1e-6));
      hi.push(r.max);
    }
    return { lo, hi };
  };
  const bn = band('normal');
  const bi = band('inverted');
  /** The lightest mass at which Σ m_i reaches a given sum, for an ordering (bisection on a log scale). */
  function lightestForSum(sum: number, ordering: 'normal' | 'inverted'): number {
    const dm = ordering === 'normal' ? DM3L_NO : DM3L_IO;
    let lo = 0, hi = 1;
    for (let i = 0; i < 80; i++) {
      const mid = 0.5 * (lo + hi);
      if (sumOfMasses(neutrinoMasses(mid, pN.dm21, dm, ordering)) > sum) hi = mid;
      else lo = mid;
    }
    return 0.5 * (lo + hi);
  }
  const cosmo = lightestForSum(0.12, 'normal');
  const bands = $derived([
    ...(showNormal ? [{ x: ml, lo: bn.lo, hi: bn.hi, color: 'var(--series-1)', opacity: 0.35, label: 'normal ordering' }] : []),
    ...(showInverted ? [{ x: ml, lo: bi.lo, hi: bi.hi, color: 'var(--series-2)', opacity: 0.35, label: 'inverted ordering' }] : []),
  ]);
</script>

<Widget {title} {n} {caption} kind="Explore">
  {#snippet controls()}
    <Toggle bind:checked={showNormal} label="Normal ordering" />
    <Toggle bind:checked={showInverted} label="Inverted ordering" />
  {/snippet}
  <LinePlot
    {bands}
    x={{ type: 'log', domain: [1e-4, 1], label: 'lightest neutrino mass [eV]', tickValues: [1e-4, 1e-3, 1e-2, 1e-1, 1] }}
    y={{ type: 'log', domain: [1e-4, 1], label: 'effective Majorana mass m_ββ [eV]', tickValues: [1e-4, 1e-3, 1e-2, 1e-1, 1] }}
    vmarks={[
      { value: 0.45, label: 'KATRIN < 0.45 eV (m_β)', color: 'var(--series-7)' },
      { value: cosmo, label: 'Σm < 0.12 eV', color: 'var(--series-5)', row: 1 },
    ]}
    hmarks={[
      { value: 0.156, label: 'KamLAND-Zen limits', color: 'var(--series-7)', left: true },
      { value: 0.036, color: 'var(--series-7)' },
    ]}
    height={330}
    label="The range of the effective Majorana mass of neutrinoless double-beta decay against the lightest neutrino mass for the two mass orderings, with experimental limits"
    format={(v) => sig(v, 3)}
    legend={true}
  />
  <p class="ui out" aria-live="polite">
    For the normal ordering m_ββ can vanish through a cancellation between the three terms; for the inverted ordering it cannot fall below about 0.015–0.02 eV. The Σm line is the lightest mass at which the three masses add up to 0.12 eV (normal ordering), a model-dependent cosmological bound. If neutrinos are Dirac particles, m_ββ is zero and no band applies.
  </p>
</Widget>

<style>
  .out {
    margin: 0.5rem 0 0;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
</style>
