<!--
  A sampling playground on CourseGPT: every decoding setting of the chapter, generated text coloured
  by how probable the model found each token, and each step's distribution on click — the raw one
  and the one actually sampled from after penalties, temperature and truncation.
-->
<script lang="ts">
  import { mulberry32, sampleIndex } from '@lm/core';
  import { minP, repetitionPenalty, softmaxT, topK, topP } from '@lm/core/sample';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { impl } from '$lib/exercise/impl.svelte';
  import { loadCourseGpt, nextLogits, type CourseGpt } from '$lib/models/coursegpt';
  import { show } from '../data';

  interface Step {
    id: number;
    text: string;
    /** Probability of the chosen token under the raw model (T = 1). */
    raw: number;
    top: { id: number; text: string; raw: number; used: number }[];
    kept: number;
  }

  interface Settings {
    T: number;
    k: number;
    p: number;
    m: number;
    rep: number;
  }
  const PRESETS: Record<string, { label: string; s: Settings }> = {
    greedy: { label: 'Greedy', s: { T: 0, k: 0, p: 1, m: 0, rep: 1 } },
    pure: { label: 'Pure sampling', s: { T: 1, k: 0, p: 1, m: 0, rep: 1 } },
    hot: { label: 'T = 1.5', s: { T: 1.5, k: 0, p: 1, m: 0, rep: 1 } },
    nucleus: { label: 'Top-p 0.9', s: { T: 1, k: 0, p: 0.9, m: 0, rep: 1 } },
    minp: { label: 'T = 1.5, min-p 0.1', s: { T: 1.5, k: 0, p: 1, m: 0.1, rep: 1 } },
  };

  let m = $state<CourseGpt | null>(null);
  let status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
  let progress = $state(0);
  let error = $state('');
  let prompt = $state('One day, Tom went to the park. He saw a big');
  let s = $state<Settings>({ ...PRESETS.nucleus!.s });
  let preset = $state<string>('nucleus');
  let steps = $state<Step[]>([]);
  let selected = $state<number | null>(null);
  let running = $state(false);
  let seed = $state(1);
  let stop = false;

  const fns = $derived({ topK: impl.get('sample.topK', topK), topP: impl.get('sample.topP', topP), minP: impl.get('sample.minP', minP), rep: impl.get('sample.repetitionPenalty', repetitionPenalty) });

  async function load() {
    status = 'loading';
    try {
      m = await loadCourseGpt((f) => (progress = f));
      status = 'ready';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      status = 'error';
    }
  }

  function choose(key: string) {
    preset = key;
    s = { ...PRESETS[key]!.s };
  }

  async function generate(n: number) {
    if (!m || running) return;
    running = true;
    stop = false;
    const rng = mulberry32(seed * 7919 + steps.length);
    const ids = [m.eot, ...m.tok.encode(prompt), ...steps.map((x) => x.id)];
    for (let i = 0; i < n && !stop; i++) {
      const z = await nextLogits(m, ids);
      const raw = softmaxT(z, 1);
      let used = softmaxT(s.rep !== 1 ? fns.rep(z, ids, s.rep) : z, s.T);
      if (s.T > 0) {
        if (s.k > 0) used = fns.topK(used, s.k);
        if (s.p < 1) used = fns.topP(used, s.p);
        if (s.m > 0) used = fns.minP(used, s.m);
      }
      const id = sampleIndex(used, rng());
      const order = Array.from(raw.keys()).sort((a, b) => raw[b]! - raw[a]!).slice(0, 10);
      if (!order.includes(id)) order[9] = id;
      let kept = 0;
      for (let j = 0; j < used.length; j++) if (used[j]! > 0) kept++;
      const text = id === m.eot ? '<|endoftext|>' : m.tok.decode([id]);
      steps = [...steps, { id, text, raw: raw[id]!, top: order.map((j) => ({ id: j, text: j === m!.eot ? '<|endoftext|>' : m!.tok.decode([j]), raw: raw[j]!, used: used[j]! })), kept }];
      ids.push(id);
      if (id === m.eot) break;
    }
    running = false;
  }

  function clear() {
    steps = [];
    selected = null;
    seed++;
  }

  // Colour: how surprising each token was to the model (−log₂ p), from blue (expected) to red (surprising).
  const colour = (p: number) => {
    const bits = Math.min(10, -Math.log2(Math.max(p, 1e-9)));
    return `color-mix(in srgb, var(--series-2) ${Math.round(bits * 10)}%, var(--series-1))`;
  };
  const sel = $derived(selected !== null ? steps[selected] : null);
  const meanBits = $derived(steps.length ? steps.reduce((a, x) => a - Math.log2(x.raw), 0) / steps.length : NaN);
</script>

<Widget
  title="Sampling playground"
  subtitle="CourseGPT continues your prompt with the settings below. Each token’s underline shows how surprising the model found it (blue: expected, red: surprising). Click a token to see the distribution it was drawn from."
  onreset={() => {
    choose('nucleus');
    clear();
  }}
>
  {#snippet controls()}
    {#if status === 'ready'}
      <Button variant="primary" onclick={() => (running ? (stop = true) : generate(60))}>{running ? 'Stop' : steps.length ? 'Continue' : 'Generate'}</Button>
      <Button onclick={() => generate(1)} disabled={running}>One token</Button>
      <Button onclick={clear} disabled={running || !steps.length}>Clear</Button>
    {:else}
      <Button variant="primary" onclick={load} disabled={status === 'loading'}>{status === 'loading' ? `Loading… ${(progress * 100).toFixed(0)}%` : 'Load CourseGPT (≈ 60 MB)'}</Button>
    {/if}
    <Segmented label="Preset" size="sm" options={Object.entries(PRESETS).map(([value, x]) => ({ value, label: x.label }))} value={preset} onchange={choose} />
  {/snippet}

  <div class="settings">
    <Slider label="Temperature (0 = greedy)" min={0} max={2} step={0.05} value={s.T} oninput={(v) => ((s.T = v), (preset = ''))} />
    <Slider label="Top-k (0 = off)" min={0} max={100} step={1} value={s.k} oninput={(v) => ((s.k = Math.round(v)), (preset = ''))} format={(v) => String(Math.round(v))} />
    <Slider label="Top-p (1 = off)" min={0.1} max={1} step={0.01} value={s.p} oninput={(v) => ((s.p = v), (preset = ''))} />
    <Slider label="Min-p (0 = off)" min={0} max={0.5} step={0.01} value={s.m} oninput={(v) => ((s.m = v), (preset = ''))} />
    <Slider label="Repetition penalty (1 = off)" min={1} max={2} step={0.05} value={s.rep} oninput={(v) => ((s.rep = v), (preset = ''))} />
  </div>

  {#if status === 'error'}<p class="muted">{error}</p>{/if}
  <textarea bind:value={prompt} rows="2" spellcheck="false" aria-label="Prompt" disabled={running || steps.length > 0}></textarea>
  {#if steps.length}
    <div class="out">
      <span class="p">{prompt}</span>{#each steps as st, i (i)}<button class="t" class:sel={selected === i} style:--u={colour(st.raw)} onclick={() => (selected = selected === i ? null : i)}>{st.text === '<|endoftext|>' ? ' ⟨end of story⟩' : st.text}</button>{/each}
    </div>
    <p class="muted ui">{steps.length} tokens · average surprise {meanBits.toFixed(2)} bits per token under the model</p>
  {/if}
  {#if sel}
    <div class="detail">
      <p class="ui head">Step {selected! + 1}: drew <code>{show(sel.text)}</code>, which the model gave {(sel.raw * 100).toFixed(2)}%. The sampler kept {sel.kept.toLocaleString('en-GB')} of 8,192 tokens.</p>
      <div class="bars">
        <span class="h">token</span><span class="h">model (T = 1)</span><span class="h">sampled from</span>
        {#each sel.top as t (t.id)}
          <div class="tok" class:chosen={t.id === sel.id}>{show(t.text)}</div>
          <div class="track"><div class="bar raw" style:width="{t.raw * 100}%"></div><span class="num">{(t.raw * 100).toFixed(1)}%</span></div>
          <div class="track"><div class="bar" class:cut={t.used === 0} style:width="{t.used * 100}%"></div><span class="num">{t.used === 0 ? 'cut' : `${(t.used * 100).toFixed(1)}%`}</span></div>
        {/each}
      </div>
    </div>
  {/if}
</Widget>

<style>
  .settings {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.4rem 1rem;
    margin-bottom: 0.7rem;
  }
  .muted {
    color: var(--ink-3);
    font-size: 0.78rem;
  }
  textarea {
    width: 100%;
    font-family: var(--font-body);
    font-size: 0.92rem;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
    resize: vertical;
  }
  .out {
    margin-top: 0.5rem;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    font-size: 0.92rem;
    line-height: 1.7;
    white-space: pre-wrap;
  }
  .p {
    color: var(--ink-3);
  }
  .t {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    white-space: pre-wrap;
    cursor: pointer;
    text-decoration: underline 3px var(--u);
    text-underline-offset: 4px;
  }
  .t.sel,
  .t:hover {
    background: var(--accent-soft);
  }
  .detail {
    margin-top: 0.7rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--rule);
  }
  .head {
    font-size: 0.8rem;
    margin: 0 0 0.5rem;
  }
  .bars {
    display: grid;
    grid-template-columns: minmax(4rem, max-content) minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.2rem 0.6rem;
    align-items: center;
    font-size: 0.78rem;
  }
  .h {
    font-size: 0.7rem;
    color: var(--ink-3);
  }
  .tok {
    font-family: var(--font-mono);
    white-space: pre;
  }
  .tok.chosen {
    font-weight: 700;
    color: var(--accent-ink);
  }
  .track {
    position: relative;
    height: 0.95rem;
    background: var(--surface-2);
    border-radius: 3px;
  }
  .track span {
    position: absolute;
    right: 0.3rem;
    top: 0;
    font-size: 0.68rem;
    line-height: 0.95rem;
    color: var(--ink-2);
  }
  .bar {
    height: 100%;
    background: var(--series-1);
    border-radius: 3px;
  }
  .bar.raw {
    background: var(--ink-3);
    opacity: 0.6;
  }
  .bar.cut {
    width: 0;
  }
</style>
