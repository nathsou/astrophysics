<!--
  The ε–N definition of a limit as a game: the Sceptic sets the width ε of a band around L; the
  Prover answers with N; every term from the N-th on must lie inside the band.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Tex from '$lib/components/exercise/Tex.svelte';

  interface Seq {
    name: string;
    tex: string;
    a: (n: number) => number;
    L: number;
    Ltex: string;
    strategy: ((eps: number) => number) | null;
    note: string;
  }
  const SEQS: Seq[] = [
    { name: '1/n', tex: 'a_n = \\tfrac1n', a: (n) => 1 / n, L: 0, Ltex: '0', strategy: (e) => Math.floor(1 / e) + 1, note: 'Strategy: N = ⌊1/ε⌋ + 1, since 1/n ≤ 1/N < ε.' },
    { name: '(−1)ⁿ/n', tex: 'a_n = \\tfrac{(-1)^n}{n}', a: (n) => (-1) ** n / n, L: 0, Ltex: '0', strategy: (e) => Math.floor(1 / e) + 1, note: 'The terms jump from side to side, but |aₙ| = 1/n, so the same N works.' },
    { name: 'n/(n+1)', tex: 'a_n = \\tfrac{n}{n+1}', a: (n) => n / (n + 1), L: 1, Ltex: '1', strategy: (e) => Math.max(1, Math.ceil(1 / e)), note: '|aₙ − 1| = 1/(n+1) < ε once n ≥ 1/ε.' },
    { name: 'sin(n)/n', tex: 'a_n = \\tfrac{\\sin n}{n}', a: (n) => Math.sin(n) / n, L: 0, Ltex: '0', strategy: (e) => Math.floor(1 / e) + 1, note: '|sin n| ≤ 1, so |aₙ| ≤ 1/n: squeeze.' },
    {
      name: '(1 + 1/n)ⁿ',
      tex: 'a_n = \\left(1 + \\tfrac1n\\right)^n',
      a: (n) => (1 + 1 / n) ** n,
      L: Math.E,
      Ltex: 'e',
      strategy: (e) => {
        let n = 1;
        while (Math.E - (1 + 1 / n) ** n >= e && n < 1e6) n++;
        return n;
      },
      note: 'Increasing towards e (Chapter 17), so the first term within ε of e works as N.',
    },
    { name: '(−1)ⁿ', tex: 'a_n = (-1)^n', a: (n) => (-1) ** n, L: 0, Ltex: 'L', strategy: null, note: 'Divergent: for ε = ½ no band of width 1 contains both 1 and −1, so no N works — whatever L you choose.' },
  ];

  let which = $state(0);
  let logEps = $state(-1);
  let N = $state(5);
  let L = $state(0);
  const S = $derived(SEQS[which]!);
  const eps = $derived(10 ** logEps);
  $effect(() => {
    L = SEQS[which]!.L;
  });
  const nMax = $derived(Math.min(4000, Math.max(40, Math.ceil(N * 1.8))));
  const escapes = $derived.by(() => {
    const out: number[] = [];
    for (let n = N; n <= nMax; n++) if (Math.abs(S.a(n) - L) >= eps) out.push(n);
    return out;
  });
  const W = 640;
  const H = 240;
  const yRange = $derived.by(() => {
    let lo = L - 1.2 * eps;
    let hi = L + 1.2 * eps;
    for (let n = 1; n <= Math.min(nMax, 60); n++) {
      lo = Math.min(lo, S.a(n));
      hi = Math.max(hi, S.a(n));
    }
    const pad = (hi - lo) * 0.08;
    return [lo - pad, hi + pad] as const;
  });
  const X = (n: number) => 40 + ((n - 1) / (nMax - 1)) * (W - 55);
  const Y = (v: number) => H - 20 - ((v - yRange[0]) / (yRange[1] - yRange[0])) * (H - 35);
  const points = $derived(Array.from({ length: nMax }, (_, i) => i + 1).filter((n) => nMax <= 400 || n % Math.ceil(nMax / 400) === 0 || n >= N - 2));
</script>

<Widget title="The ε–N game" subtitle="The Sceptic picks ε (the band). The Prover picks N (the line). The Prover wins if every term from the N-th on stays inside the band — for as far as the eye can see, and, with a proof, for ever." onreset={() => ((logEps = -1), (N = 5))}>
  {#snippet controls()}
    <label class="ctl">sequence <select bind:value={which}>{#each SEQS as s, i (i)}<option value={i}>{s.name}</option>{/each}</select></label>
    <label class="ctl">ε = <strong class="num">{eps.toPrecision(2)}</strong> <input type="range" min="-3" max="0" step="0.01" bind:value={logEps} /></label>
    <label class="ctl">N = <input type="number" min="1" max="3000" bind:value={N} /></label>
    {#if S.strategy}<button onclick={() => (N = S.strategy!(eps))}>Prover’s strategy</button>{:else}<label class="ctl">L = <input type="number" step="0.1" bind:value={L} /></label>{/if}
  {/snippet}
  <p class="def"><Tex tex={`${S.tex}, \\qquad \\lim_{n\\to\\infty} a_n = ${S.Ltex}?`} /></p>
  <svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="Terms of the sequence with a band of width epsilon around the limit">
    <rect x="40" y={Y(L + eps)} width={W - 55} height={Math.max(1, Y(L - eps) - Y(L + eps))} class="band" />
    <line x1="40" x2={W - 15} y1={Y(L)} y2={Y(L)} class="lim" />
    <rect x={X(N)} y="10" width={W - 15 - X(N)} height={H - 30} class="tail" />
    <line x1={X(N)} x2={X(N)} y1="10" y2={H - 20} class="nline" />
    <text x={X(N) + 4} y="22" class="lab">N = {N}</text>
    {#each points as n (n)}
      {@const v = S.a(n)}
      {@const out = n >= N && Math.abs(v - L) >= eps}
      <circle cx={X(n)} cy={Y(v)} r={nMax > 200 ? 1.6 : 3} class:out class:after={n >= N} />
    {/each}
    <text x="34" y={Y(L) + 4} class="lab end">{S.Ltex}</text>
    <text x={W - 15} y={H - 6} class="lab end">n = {nMax}</text>
  </svg>
  <p class="verdict" class:ok={!escapes.length} class:bad={escapes.length > 0}>
    {#if !escapes.length}✓ Every term from n = {N} to {nMax} is within ε = {eps.toPrecision(2)} of {S.Ltex}.{:else}✗ {escapes.length} term{escapes.length > 1 ? 's' : ''} after N escape the band (first at n = {escapes[0]}).{/if}
  </p>
  <p class="note">{S.note}</p>
</Widget>

<style>
  .ctl {
    display: flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.85rem;
  }
  select,
  input[type='number'] {
    font: inherit;
    font-size: 0.82rem;
    padding: 0.1rem 0.3rem;
    width: 5.5rem;
    border-radius: 5px;
    border: 1px solid var(--rule-strong);
    background: var(--page);
    color: var(--ink);
  }
  select {
    width: auto;
  }
  button {
    font: inherit;
    font-size: 0.8rem;
    border: 1px solid var(--accent);
    background: var(--surface-2);
    color: var(--ink);
    border-radius: 6px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
  }
  .def {
    text-align: center;
    margin: 0 0 0.3rem;
  }
  .band {
    fill: color-mix(in srgb, var(--byrne-blue) 16%, transparent);
  }
  .lim {
    stroke: var(--byrne-blue);
    stroke-dasharray: 5 4;
  }
  .tail {
    fill: color-mix(in srgb, var(--byrne-yellow) 8%, transparent);
  }
  .nline {
    stroke: var(--byrne-yellow);
    stroke-width: 2;
  }
  circle {
    fill: var(--ink-3);
  }
  circle.after {
    fill: var(--byrne-blue);
  }
  circle.out {
    fill: var(--byrne-red);
  }
  .lab {
    font-size: 11px;
    fill: var(--ink-2);
    font-family: var(--font-ui);
  }
  .lab.end {
    text-anchor: end;
  }
  .verdict {
    margin: 0.2rem 0 0;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .ok {
    color: var(--ok);
  }
  .bad {
    color: var(--bad);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.2rem 0 0;
  }
</style>
