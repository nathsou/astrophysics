<!--
  Pseudo-data minus the fitted background, with the fitted signal on top: the usual lower panel of a peak search. The points have the √N error of the
  *data* in each bin (not of the difference), which is what HepHist's error bars cannot show, so this is drawn on Plot directly.
-->
<script lang="ts">
  import Plot from '$lib/charts/Plot.svelte';
  import { OBSERVABLES, type ObservableSummary, type FitSummary } from '$lib/hep/pipeline/index.ts';

  let { obs, fit, height = 210 }: { obs: ObservableSummary; fit: FitSummary; height?: number } = $props();
  const def = $derived(OBSERVABLES[obs.name]!);
  const data = $derived(obs.pseudo ?? obs.total);
  const bkg = $derived(fit.components['bkg'] ?? []);
  const sigFit = $derived(fit.components['sig'] ?? []);
  const centre = (i: number) => 0.5 * (obs.edges[i]! + obs.edges[i + 1]!);
  const pts = $derived(
    data.counts.map((c, i) => ({ x: centre(i), y: c - (bkg[i] ?? 0), e: Math.max(1, Math.sqrt(Math.max(c, 1))), inRange: centre(i) >= fit.range[0] && centre(i) <= fit.range[1] })).filter((p) => p.inRange),
  );
  const ylim = $derived.by((): [number, number] => {
    let lo = 0, hi = 1;
    for (const p of pts) {
      lo = Math.min(lo, p.y - p.e);
      hi = Math.max(hi, p.y + p.e);
    }
    for (const v of sigFit) hi = Math.max(hi, v);
    return [lo * 1.1, hi * 1.1];
  });
  const stepPath = (sx: (v: number) => number, sy: (v: number) => number): string => {
    let d = '';
    sigFit.forEach((v, i) => {
      if (centre(i) < fit.range[0] || centre(i) > fit.range[1]) return;
      const x0 = sx(obs.edges[i]!), x1 = sx(obs.edges[i + 1]!), y = sy(v);
      d += d === '' ? `M${x0},${y}` : `L${x0},${y}`;
      d += `L${x1},${y}`;
    });
    return d;
  };
</script>

<Plot
  x={{ domain: [obs.edges[0]!, obs.edges[obs.edges.length - 1]!], label: `${def.label}${def.unit ? ` [${def.unit}]` : ''}` }}
  y={{ domain: ylim, label: 'data − background' }}
  {height}
  crosshair={false}
  label="Pseudo-data minus the fitted background in each bin, with error bars, and the fitted signal peak: the excess over the smooth background."
>
  {#snippet marks({ sx, sy })}
    <line x1={sx(obs.edges[0]!)} x2={sx(obs.edges[obs.edges.length - 1]!)} y1={sy(0)} y2={sy(0)} stroke="var(--mute)" stroke-dasharray="4 3" />
    <path d={stepPath(sx, sy)} fill="none" stroke="var(--series-7)" stroke-width="1.6" />
    {#each pts as p}
      <line x1={sx(p.x)} x2={sx(p.x)} y1={sy(p.y - p.e)} y2={sy(p.y + p.e)} stroke="var(--fg)" stroke-width="1" />
      <circle cx={sx(p.x)} cy={sy(p.y)} r="2.4" fill="var(--fg)" />
    {/each}
  {/snippet}
</Plot>
