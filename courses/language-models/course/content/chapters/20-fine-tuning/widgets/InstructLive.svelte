<!--
  The instruction-tuned CourseGPT (LoRA, rank 16, merged) in the browser: give it a name and three words.
-->
<script lang="ts">
  import { mulberry32, sampleIndex } from '@lm/core';
  import { minP, softmaxT } from '@lm/core/sample';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { loadInstructModel, runnerFor, type CourseGpt } from '$lib/models/coursegpt';

  let m = $state<CourseGpt | null>(null);
  let status = $state<'idle' | 'loading' | 'running' | 'error'>('idle');
  let error = $state('');
  let progress = $state(0);
  let name = $state('Mia');
  let words = $state('kite, river, sandwich');
  let story = $state('');

  const instruction = $derived(`Write a story about ${name.trim()} that uses the words: ${words.split(',').map((w) => w.trim()).filter(Boolean).join(', ')}.\nStory: `);
  const used = $derived(words.split(',').map((w) => w.trim()).filter(Boolean).map((w) => ({ w, ok: new RegExp(`\\b${w.replace(/[^\w]/g, '')}\\b`, 'i').test(story) })));

  async function write() {
    status = 'loading';
    try {
      m ??= await loadInstructModel((f) => (progress = f));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      status = 'error';
      return;
    }
    status = 'running';
    story = '';
    const run = await runnerFor(m);
    const cache = run.cache();
    const ids = [m.eot, ...m.tok.encode(instruction)];
    const rng = mulberry32(Date.now() & 0xffffffff);
    let l = run.forward(cache, ids);
    const out: number[] = [];
    for (let i = 0; i < 300 && ids.length + out.length < cache.capacity; i++) {
      const z = await l.read();
      l.dispose();
      const id = sampleIndex(minP(softmaxT(z, 0.8), 0.05), rng());
      if (id === m.eot) break;
      out.push(id);
      story = m.tok.decode(out);
      l = run.forward(cache, [id]);
    }
    cache.dispose();
    status = 'idle';
  }
</script>

<Widget title="Your instruction" subtitle="The instruction-tuned CourseGPT (LoRA rank 16, merged into the weights) running in your browser. Choose a name and some words; the story should use them.">
  {#snippet controls()}
    <Button variant="primary" onclick={write} disabled={status === 'loading' || status === 'running'}>{status === 'loading' ? `Loading… ${(progress * 100).toFixed(0)}%` : status === 'running' ? 'Writing…' : 'Write the story'}</Button>
  {/snippet}
  <div class="fields ui">
    <label>Name <input bind:value={name} spellcheck="false" /></label>
    <label>Words <input class="w" bind:value={words} spellcheck="false" /></label>
  </div>
  <pre class="ins">{instruction}</pre>
  {#if status === 'error'}<p class="muted">{error}</p>{/if}
  {#if story}
    <p class="story">{story}</p>
    <p class="check ui">{#each used as u (u.w)}<span class:ok={u.ok}>{u.ok ? '✓' : '✗'} {u.w}</span>{/each}<span class:ok={story.includes(name.trim())}>{story.includes(name.trim()) ? '✓' : '✗'} {name}</span></p>
  {/if}
</Widget>

<style>
  .fields {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  input {
    font-size: 0.9rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--rule-strong);
    border-radius: 5px;
    background: var(--surface);
    color: var(--ink);
    width: 8rem;
  }
  input.w {
    width: 16rem;
  }
  .ins {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--ink-2);
    background: var(--surface-2);
    padding: 0.4rem 0.6rem;
    border-radius: 5px;
    white-space: pre-wrap;
  }
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .story {
    font-size: 0.92rem;
    white-space: pre-wrap;
  }
  .check {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    font-size: 0.8rem;
    color: var(--critical);
  }
  .check .ok {
    color: var(--good);
  }
</style>
