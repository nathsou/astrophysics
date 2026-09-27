<!--
  What does a hidden unit track? Run the trained network over validation text, colour each character
  by one unit's activation, and search the units for ones that correlate with simple features.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { rnn } from '../trainer.svelte';

  const START = 20_000, STATS_LEN = 3000, SHOW = 700;
  type Feature = { label: string; f: (text: string, t: number) => number };
  const lineStart = (s: string, t: number) => s.lastIndexOf('\n', t - 1) + 1;
  const FEATURES: Record<string, Feature> = {
    position: { label: 'Position in line', f: (s, t) => Math.min(1, (t - lineStart(s, t)) / 50) },
    word: { label: 'Inside a word', f: (s, t) => (/[A-Za-z']/.test(s[t]!) ? 1 : 0) },
    speaker: { label: 'Speaker name', f: (s, t) => (/^[A-Z ]+:?$/.test(s.slice(lineStart(s, t), t + 1)) && s[t] !== '\n' ? 1 : 0) },
    vowel: { label: 'Vowel', f: (s, t) => (/[aeiouAEIOU]/.test(s[t]!) ? 1 : 0) },
    space: { label: 'After a space', f: (s, t) => (s[t] === ' ' ? 1 : 0) },
  };

  let feature = $state<keyof typeof FEATURES>('position');
  let which = $state<'h' | 'c'>('h');
  let unit = $state(0);
  let traced = $state.raw<{ text: string; h: Float32Array; c: Float32Array | null; H: number; step: number } | null>(null);
  let busy = $state(false);

  async function trace() {
    busy = true;
    const model = await rnn.cpuModel();
    const ids = rnn.val.subarray(START, START + STATS_LEN);
    const text = Array.from(ids, (i) => rnn.vocab.chars[i]).join('');
    const r = model.trace(ids);
    traced = { text, h: r.h, c: r.c, H: model.H, step: rnn.step };
    if (which === 'c' && !r.c) which = 'h';
    unit = best?.unit ?? 0;
    busy = false;
  }

  const acts = $derived(traced ? (which === 'c' && traced.c ? traced.c : traced.h) : null);
  /** Pearson correlation of every unit with the chosen feature. */
  const corr = $derived.by(() => {
    if (!traced || !acts) return null;
    const { text, H } = traced;
    const T = text.length;
    const f = Float64Array.from({ length: T }, (_, t) => FEATURES[feature]!.f(text, t));
    const fm = f.reduce((a, b) => a + b, 0) / T;
    const fs = Math.sqrt(f.reduce((a, b) => a + (b - fm) ** 2, 0)) || 1;
    return Array.from({ length: H }, (_, j) => {
      let m = 0;
      for (let t = 0; t < T; t++) m += acts[t * H + j]! / T;
      let num = 0, den = 0;
      for (let t = 0; t < T; t++) {
        const a = acts[t * H + j]! - m;
        num += a * (f[t]! - fm);
        den += a * a;
      }
      return num / (Math.sqrt(den) * fs || 1);
    });
  });
  const best = $derived(corr ? corr.reduce((b, r, j) => (Math.abs(r) > Math.abs(b.r) ? { unit: j, r } : b), { unit: 0, r: 0 }) : null);
  const scale = $derived.by(() => {
    if (!traced || !acts) return 1;
    let m = 1e-6;
    for (let t = 0; t < SHOW; t++) m = Math.max(m, Math.abs(acts[t * traced.H + unit]!));
    return m;
  });
  const bg = (v: number) => {
    const a = Math.min(1, Math.abs(v) / scale);
    return `color-mix(in srgb, ${v > 0 ? 'var(--series-2)' : 'var(--series-1)'} ${(a * 70).toFixed(0)}%, transparent)`;
  };
</script>

<Widget
  title="What are the hidden units doing?"
  subtitle="Run the trained network over {STATS_LEN.toLocaleString('en-GB')} characters of validation text, then colour each character by one unit’s activation (orange positive, blue negative). Pick a feature to find the unit that correlates with it best."
>
  {#snippet controls()}
    <Button variant="primary" onclick={trace} disabled={busy || rnn.status !== 'ready'}>{traced ? 'Re-run on current weights' : 'Run the network'}</Button>
    <Segmented label="Feature" size="sm" options={Object.entries(FEATURES).map(([k, v]) => ({ value: k, label: v.label }))} bind:value={feature} onchange={() => best && (unit = best.unit)} />
    {#if traced?.c}
      <Segmented label="State" size="sm" options={[{ value: 'h', label: 'hidden h' }, { value: 'c', label: 'cell c' }] as { value: 'h' | 'c'; label: string }[]} bind:value={which} />
    {/if}
  {/snippet}

  {#if rnn.status === 'unsupported'}
    <p class="muted">Needs WebGPU for training (see above).</p>
  {:else if !traced}
    <p class="muted">Train the network above (a few hundred steps is enough to see structure; the full run is best), then run it over the text.</p>
  {:else}
    <div class="row ui">
      <div class="ctl"><Slider label="unit" min={0} max={traced.H - 1} step={1} value={unit} oninput={(v) => (unit = Math.round(v))} format={(v) => String(Math.round(v))} /></div>
      <p class="info num">
        {#if best}Best unit for “{FEATURES[feature]!.label.toLowerCase()}”: <button class="link" onclick={() => (unit = best!.unit)}>#{best.unit}</button> (r = {best.r.toFixed(2)}).{/if}
        Unit {unit}: r = {corr![unit]!.toFixed(2)}. Weights from step {traced.step.toLocaleString('en-GB')}.
      </p>
    </div>
    <div class="text" aria-label="Validation text coloured by unit {unit}">
      {#each Array.from(traced.text.slice(0, SHOW)) as ch, t (t)}{#if ch === '\n'}<span class="nl" style:background={bg(acts![t * traced.H + unit]!)}>↵</span><br />{:else}<span style:background={bg(acts![t * traced.H + unit]!)}>{ch}</span>{/if}{/each}
    </div>
    <p class="note ui">
      Most units respond to a mixture of things and resist a one-word description. A few are strikingly clean. Karpathy, Johnson and Fei-Fei found LSTM cells that track position in the line, whether the text is inside quotes, and the depth of nested brackets in code. Correlation with a hand-picked feature is only a first look; Chapter 26 does this properly.
    </p>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    align-items: center;
    margin-bottom: 0.6rem;
  }
  .ctl {
    flex: 0 1 14rem;
  }
  .info {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0;
  }
  .link {
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
  .text {
    font: 0.82rem/1.55 var(--font-mono);
    background: var(--surface-2);
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    max-height: 20rem;
    overflow-y: auto;
    white-space: pre-wrap;
  }
  .text span {
    border-radius: 2px;
  }
  .nl {
    color: var(--ink-3);
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
</style>
