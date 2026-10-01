<!--
  U(1), SU(2) and SU(3) as matrix groups (Chapter 17): generators, commutators and group elements, computed numerically.

    ::gauge-groups{n="17.2" caption="…"}

  Pick a group. The generators T_a are shown as matrices. Pick two of them and the commutator [T_a, T_b] is computed and
  decomposed into the generators again: i f_abc T_c. Then build two finite group elements exp(iθT_a) and exp(iφT_b), check
  that they are unitary with determinant 1, and measure how far the order of multiplication matters.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import {
    commutatorTerms,
    dagger,
    det,
    element,
    generators,
    identity,
    mul,
    normF,
    sub,
    type CMat,
    type GroupName,
  } from './groups';

  let { n, caption, title = 'Groups of matrices and their generators' }: { n?: string | number; caption?: string; title?: string } = $props();

  let group = $state<GroupName>('SU2');
  let a = $state(0);
  let b = $state(1);
  let theta = $state(1.6);
  let phi = $state(1.2);

  const T = $derived(generators(group));
  const N = $derived(T.length);
  const ia = $derived(Math.min(a, N - 1));
  const ib = $derived(Math.min(b, N - 1));
  const terms = $derived(commutatorTerms(group, ia, ib));
  const dim = $derived(T[0]!.length);

  const basis = (k: number, v: number) => Array.from({ length: N }, (_, i) => (i === k ? v : 0));
  const U = $derived(element(group, basis(ia, theta)));
  const V = $derived(element(group, basis(ib, phi)));
  const unitarity = $derived(normF(sub(mul(dagger(U), U), identity(dim))));
  const dU = $derived(det(U));
  const order = $derived(normF(sub(mul(U, V), mul(V, U))));

  const fmtC = (x: [number, number]) => {
    const r = Math.abs(x[0]) < 5e-4 ? 0 : x[0];
    const i = Math.abs(x[1]) < 5e-4 ? 0 : x[1];
    if (i === 0) return r === 0 ? '0' : r.toFixed(2).replace(/\.?0+$/, '');
    if (r === 0) return `${i === 1 ? '' : i === -1 ? '−' : i.toFixed(2).replace(/\.?0+$/, '')}i`;
    return `${r.toFixed(2)}${i > 0 ? '+' : '−'}${Math.abs(i).toFixed(2)}i`;
  };
  const names: Record<GroupName, string[]> = {
    U1: ['charge'],
    SU2: ['T₁', 'T₂', 'T₃'],
    SU3: ['T₁', 'T₂', 'T₃', 'T₄', 'T₅', 'T₆', 'T₇', 'T₈'],
  };
  const gauge: Record<GroupName, string> = { U1: '1 photon', SU2: '3 gauge bosons', SU3: '8 gluons' };
</script>

<Widget {title} {n} {caption} kind="Explore">
  {#snippet controls()}
    <Segmented
      label="Group"
      size="sm"
      bind:value={group}
      options={[
        { value: 'U1', label: 'U(1)' },
        { value: 'SU2', label: 'SU(2)' },
        { value: 'SU3', label: 'SU(3)' },
      ]}
    />
    {#if N > 1}
      <Slider bind:value={a} min={0} max={N - 1} step={1} label="First generator T_a, a =" format={(v) => `${v + 1}`} />
      <Slider bind:value={b} min={0} max={N - 1} step={1} label="Second generator T_b, b =" format={(v) => `${v + 1}`} />
    {/if}
    <Slider bind:value={theta} min={0} max={6.28} step={0.02} label="Angle θ of exp(iθ T_a)" />
    <Slider bind:value={phi} min={0} max={6.28} step={0.02} label="Angle φ of exp(iφ T_b)" />
  {/snippet}

  <p class="lead ui">
    {dim}×{dim} matrices, {N} generator{N > 1 ? 's' : ''} ({group === 'U1' ? 'one phase' : `n² − 1 with n = ${dim}`}); gauging the symmetry needs <strong>{gauge[group]}</strong>.
  </p>

  <div class="mats">
    {#each T as t, k}
      <figure class:sel={k === ia || k === ib}>
        <figcaption class="ui">{names[group][k]}{group !== 'U1' ? ` = ${group === 'SU2' ? 'σ' : 'λ'}${k + 1}/2` : ''}</figcaption>
        <table class="ui m" aria-label="Generator {names[group][k]}">
          <tbody>
            {#each t as row}
              <tr>
                {#each row as x}
                  <td>{fmtC(x)}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </figure>
    {/each}
  </div>

  <div class="panels ui">
    <div>
      <h4>Commutator</h4>
      {#if N === 1}
        <p>One generator commutes with itself: [T, T] = 0. The group is <em>abelian</em>: the order of two transformations never matters, and the photon carries no charge.</p>
      {:else if ia === ib}
        <p>[T<sub>{ia + 1}</sub>, T<sub>{ia + 1}</sub>] = 0. Choose two different generators.</p>
      {:else if terms.length === 0}
        <p>[T<sub>{ia + 1}</sub>, T<sub>{ib + 1}</sub>] = 0: these two commute.</p>
      {:else}
        <p>
          [T<sub>{ia + 1}</sub>, T<sub>{ib + 1}</sub>] =
          {#each terms as t, k}{k ? ' + ' : ''}i·({t.f.toFixed(3).replace(/\.?0+$/, '')}) T<sub>{t.c + 1}</sub>{/each}
        </p>
        <p class="sub">Computed from the matrices above. The coefficients are the structure constants f<sub>abc</sub>; they are the same in every representation.</p>
      {/if}
    </div>
    <div aria-live="polite">
      <h4>Finite transformations</h4>
      <p>‖U†U − 1‖ = {unitarity.toExponential(1)}</p>
      <p>det U = {fmtC(dU)}</p>
      <p>‖UV − VU‖ = <strong>{order < 1e-12 ? '0' : order.toFixed(3)}</strong> <span class="sub">({order < 1e-9 ? 'the order does not matter' : 'the order matters'})</span></p>
      <p class="sub">U = exp(iθT<sub>{ia + 1}</sub>), V = exp(iφT<sub>{ib + 1}</sub>).</p>
    </div>
  </div>
</Widget>

<style>
  .lead {
    margin: 0 0 0.6rem;
    font-size: 0.9rem;
  }
  .mats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  figure {
    margin: 0;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--panel);
  }
  figure.sel {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  figcaption {
    font-size: 0.72rem;
    color: var(--ink-2);
    margin-bottom: 0.15rem;
    text-transform: none;
    letter-spacing: 0;
  }
  .m {
    border-collapse: collapse;
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
  }
  .m td {
    padding: 0.05rem 0.3rem;
    text-align: center;
    min-width: 1.6rem;
    text-transform: none;
    letter-spacing: 0;
  }
  .panels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1rem;
    margin-top: 0.8rem;
  }
  h4 {
    margin: 0 0 0.3rem;
    font-size: 0.8rem;
    text-transform: none;
    letter-spacing: 0;
    color: var(--ink-2);
  }
  p {
    margin: 0.15rem 0;
    font-size: 0.86rem;
  }
  .sub {
    font-size: 0.76rem;
    color: var(--ink-2);
  }
</style>
