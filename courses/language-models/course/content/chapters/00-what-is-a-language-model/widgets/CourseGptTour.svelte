<!--
  A first look at CourseGPT: text becomes tokens, the model turns them into a probability for every
  possible next token, one is picked and appended, and the loop repeats. Runs the real model on WebGPU
  when it can; otherwise replays a recording of the same loop.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { impl } from '$lib/exercise/impl.svelte';
  import { hasWebGPU } from '$lib/gpu/device';
  import { loadCourseGpt, nextLogits, softmax, type CourseGpt } from '$lib/models/coursegpt';
  import tour from '../tour.json';

  interface Choice {
    text: string;
    id: number;
    p: number;
  }

  let m = $state<CourseGpt | null>(null);
  let mode = $state<'recorded' | 'loading' | 'live'>('recorded');
  let progress = $state(0);
  let prompt = $state(tour.prompt);
  let generated = $state<string[]>([]);
  let top = $state<Choice[]>([]);
  let running = $state(false);
  let canLive = $state(false);

  const greedy = (probs: number[]) => probs.indexOf(Math.max(...probs));
  // The recording follows greedy choices, so only the live model can use another picking rule.
  const pick = $derived(mode === 'live' ? impl.get('tour.pick', greedy) : greedy);
  const mine = $derived(impl.isMine('tour.pick'));
  const show = (t: string) => (t === '<|endoftext|>' ? '⟨end of story⟩' : t.replaceAll('\n', '↵'));

  onMount(() => {
    canLive = hasWebGPU();
    showRecorded();
  });

  function showRecorded() {
    const step = tour.steps[generated.length];
    top = step ? step.top.map(([text, p], i) => ({ text: String(text), id: i, p: Number(p) })) : [];
  }

  async function goLive() {
    mode = 'loading';
    try {
      m = await loadCourseGpt((f) => (progress = f));
      mode = 'live';
      generated = [];
      await predict();
    } catch {
      mode = 'recorded';
      canLive = false;
    }
  }

  const ids = () => [m!.eot, ...m!.tok.encode(prompt + generated.join(''))];
  const tokens = $derived(mode === 'live' && m ? m.tok.encode(prompt).map((i) => ({ text: m!.tok.decode([i]), id: i })) : tour.prompt_tokens.map(([text, id]) => ({ text: String(text), id: Number(id) })));

  async function predict() {
    if (!m) return;
    const p = softmax(await nextLogits(m, ids()));
    const order = Array.from(p.keys()).sort((a, b) => p[b]! - p[a]!).slice(0, 10);
    top = order.map((i) => ({ text: i === m!.eot ? '<|endoftext|>' : m!.tok.decode([i]), id: i, p: p[i]! }));
  }

  async function step() {
    if (!top.length) return;
    const choice = top[pick(top.map((t) => t.p))] ?? top[0]!;
    generated = [...generated, choice.text];
    if (mode === 'live') await predict();
    else showRecorded();
  }

  async function auto() {
    running = true;
    for (let i = 0; i < 20 && running && top.length && !generated.includes('<|endoftext|>'); i++) {
      await step();
      if (mode === 'recorded') await new Promise((r) => setTimeout(r, 250));
    }
    running = false;
  }

  async function reset() {
    generated = [];
    if (mode === 'live') await predict();
    else showRecorded();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  function edit(v: string) {
    prompt = v;
    generated = [];
    clearTimeout(timer);
    timer = setTimeout(() => void predict(), 200);
  }
</script>

<Widget
  title="How CourseGPT writes"
  subtitle="Text becomes tokens; the model gives every possible next token a probability; one is picked and appended; repeat. This is the whole of text generation."
  onreset={reset}
>
  {#snippet controls()}
    <Button variant="primary" onclick={step} disabled={running || !top.length}>Pick the next token</Button>
    <Button onclick={() => (running ? (running = false) : auto())} disabled={!top.length}>{running ? 'Stop' : 'Keep going'}</Button>
    <Button onclick={reset} disabled={running || !generated.length}>Start again</Button>
    {#if mode !== 'live' && canLive}
      <Button onclick={goLive} disabled={mode === 'loading'}>{mode === 'loading' ? `Loading… ${(progress * 100).toFixed(0)}%` : 'Run the real model here (≈ 60 MB)'}</Button>
    {/if}
  {/snippet}

  <div class="stage">
    <div class="step"><span class="n">1</span>Your text, cut into tokens (each has a number, its id)</div>
    {#if mode === 'live'}
      <input class="prompt" value={prompt} oninput={(e) => edit(e.currentTarget.value)} spellcheck="false" aria-label="Prompt" />
    {/if}
    <div class="tokens">
      {#each tokens as t, i (i)}<span class="tk" title="id {t.id}">{show(t.text)}<sub>{t.id}</sub></span>{/each}
      {#each generated as g, i (i)}<span class="tk new">{show(g)}</span>{/each}
    </div>

    <div class="step"><span class="n">2</span>CourseGPT’s probabilities for the next token (the ten most likely of 8,192)</div>
    <div class="bars">
      {#each top as t, i (i)}
        <div class="tok" class:chosen={i === pick(top.map((x) => x.p))}>{show(t.text)}</div>
        <div class="track"><div class="bar" style:width="{t.p * 100}%"></div></div>
        <div class="pc num">{(t.p * 100).toFixed(1)}%</div>
      {/each}
    </div>

    <div class="step"><span class="n">3</span>The story so far</div>
    <p class="story"><span class="p">{prompt}</span>{generated.map((g) => (g === '<|endoftext|>' ? ' ⟨the end⟩' : g)).join('')}</p>
    <p class="muted ui">
      {mode === 'live' ? 'Running CourseGPT live on your GPU.' : 'A recording of CourseGPT on this prompt; with WebGPU you can run the real model and change the prompt.'}
      {mine && mode === 'live' ? ' Picking with your own function.' : ' Picking the most probable token each time (greedy decoding).'}
    </p>
  </div>
</Widget>

<style>
  .stage {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .step {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--ink-2);
    margin-top: 0.3rem;
  }
  .n {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.3rem;
    height: 1.3rem;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent-ink);
    margin-right: 0.4rem;
  }
  .prompt {
    width: 100%;
    font-size: 0.9rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
  }
  .tokens {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 2px;
  }
  .tk {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    white-space: pre;
    padding: 0.12rem 0.3rem;
    border-radius: 4px;
    background: color-mix(in srgb, var(--accent-2) 14%, var(--surface));
  }
  .tk sub {
    font-size: 0.6rem;
    color: var(--ink-3);
    margin-left: 0.15rem;
  }
  .tk.new {
    background: color-mix(in srgb, var(--good) 22%, var(--surface));
  }
  .bars {
    display: grid;
    grid-template-columns: minmax(5rem, max-content) minmax(0, 1fr) 3.4rem;
    gap: 0.2rem 0.5rem;
    align-items: center;
    font-size: 0.8rem;
    max-width: 40rem;
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
  .story {
    font-size: 0.95rem;
    margin: 0;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
  }
  .story .p {
    color: var(--ink-3);
  }
  .muted {
    color: var(--ink-3);
    font-size: 0.76rem;
    margin: 0;
  }
</style>
