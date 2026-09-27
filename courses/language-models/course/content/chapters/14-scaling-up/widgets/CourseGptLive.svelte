<!--
  CourseGPT, trained in PyTorch, running on the course's own WebGPU engine (the Gpt class of
  Chapter 11): the next-token distribution for any prompt, and a simple sampling loop.
-->
<script lang="ts">
  import { mulberry32, sampleIndex } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { loadCourseGpt, nextLogits, softmax, type CourseGpt } from '$lib/models/coursegpt';

  let m = $state<CourseGpt | null>(null);
  let status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
  let progress = $state(0);
  let error = $state('');
  let prompt = $state('Once upon a time, there was a little dog named');
  let generated = $state('');
  let temperature = $state(0.8);
  let top = $state<{ text: string; p: number }[]>([]);
  let running = $state(false);
  let msPerToken = $state(NaN);
  let stop = false;

  async function load() {
    status = 'loading';
    try {
      m = await loadCourseGpt((f) => (progress = f));
      status = 'ready';
      await predict();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      status = 'error';
    }
  }

  const context = () => [m!.eot, ...m!.tok.encode(prompt + generated)];

  async function predict() {
    if (!m) return;
    const p = softmax(await nextLogits(m, context()), temperature);
    const idx = Array.from(p.keys()).sort((a, b) => p[b]! - p[a]!).slice(0, 10);
    top = idx.map((i) => ({ text: i === m!.eot ? '⟨end of story⟩' : m!.tok.decode([i]), p: p[i]! }));
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    void prompt;
    void temperature;
    if (status !== 'ready' || running) return;
    clearTimeout(timer);
    timer = setTimeout(() => void predict(), 150);
  });

  async function generate(n = 80) {
    if (!m || running) return;
    running = true;
    stop = false;
    const rng = mulberry32(Date.now() & 0xffffffff);
    const ids = context();
    const start = ids.length;
    const t0 = performance.now();
    for (let i = 0; i < n && !stop; i++) {
      const p = softmax(await nextLogits(m, ids), temperature);
      const id = sampleIndex(p, rng());
      if (id === m.eot) break;
      ids.push(id);
      generated = m.tok.decode(ids.slice(start));
      msPerToken = (performance.now() - t0) / (i + 1);
    }
    running = false;
    await predict();
  }
</script>

<Widget
  title="CourseGPT in your browser"
  subtitle="The weights trained in PyTorch, loaded into the Transformer we wrote in Chapter 11 and run on WebGPU. Type the start of a story: the bars show the model’s next-token distribution."
  onreset={() => {
    prompt = 'Once upon a time, there was a little dog named';
    generated = '';
    temperature = 0.8;
  }}
>
  {#snippet controls()}
    {#if status === 'ready'}
      <Button variant="primary" onclick={() => (running ? (stop = true) : generate())}>{running ? 'Stop' : 'Continue the story'}</Button>
      <Button onclick={() => (generated = '')} disabled={running || !generated}>Clear continuation</Button>
      <div class="sl"><Slider label="Temperature" min={0.1} max={2} step={0.05} value={temperature} oninput={(v) => (temperature = v)} /></div>
    {:else}
      <Button variant="primary" onclick={load} disabled={status === 'loading'}>{status === 'loading' ? `Loading… ${(progress * 100).toFixed(0)}%` : 'Load CourseGPT (≈ 60 MB)'}</Button>
    {/if}
  {/snippet}

  {#if status === 'error'}
    <p class="muted">{error}</p>
  {/if}
  <div class="two">
    <div>
      <textarea bind:value={prompt} rows="3" spellcheck="false" aria-label="Prompt" disabled={running}></textarea>
      {#if generated}<div class="gen"><span class="p">{prompt}</span><span class="g">{generated}</span></div>{/if}
      {#if Number.isFinite(msPerToken)}<p class="muted ui">{msPerToken.toFixed(0)} ms per token, recomputing the whole context each time (Chapter 16 makes this much faster).</p>{/if}
    </div>
    <div class="dist">
      {#if status === 'ready'}
        <div class="head ui">next token, at temperature {temperature.toFixed(2)}</div>
        {#each top as t, i (i)}
          <div class="tok">{JSON.stringify(t.text).slice(1, -1)}</div>
          <div class="track"><div class="bar" style:width="{t.p * 100}%"></div></div>
          <div class="pc num">{(t.p * 100).toFixed(1)}%</div>
        {/each}
      {:else}
        <p class="muted">The model’s top ten next tokens appear here once it is loaded.</p>
      {/if}
    </div>
  </div>
</Widget>

<style>
  .sl {
    flex: 0 1 13rem;
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    gap: 1.2rem;
  }
  @media (max-width: 720px) {
    .two {
      grid-template-columns: 1fr;
    }
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
  .gen {
    margin-top: 0.5rem;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    font-size: 0.92rem;
    white-space: pre-wrap;
  }
  .gen .p {
    color: var(--ink-3);
  }
  .gen .g {
    background: var(--accent-soft);
  }
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .dist {
    display: grid;
    grid-template-columns: minmax(4rem, max-content) minmax(0, 1fr) 3.2rem;
    gap: 0.25rem 0.5rem;
    align-items: center;
    align-content: start;
    font-size: 0.8rem;
  }
  .head {
    grid-column: 1 / -1;
    font-size: 0.72rem;
    color: var(--ink-3);
  }
  .tok {
    font-family: var(--font-mono);
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .track {
    height: 0.9rem;
    background: var(--surface-2);
    border-radius: 3px;
  }
  .bar {
    height: 100%;
    background: var(--series-1);
    border-radius: 3px;
  }
  .pc {
    text-align: right;
    color: var(--ink-2);
  }
</style>
