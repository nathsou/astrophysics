<!--
  The tool-using model of this chapter, in the browser: 4 layers, width 256, trained on three-term sums of up to
  6 digits. With the calculator attached, the runtime (the learner's toolStep) writes each call's result; without
  it, the model must write the results itself — which it was never trained to do.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { loadCalculatorModel, runnerFor, type CharModel } from '$lib/models/coursegpt';
  import { impl } from '$lib/exercise/impl.svelte';

  function reference(text: string): string | null {
    const open = text.lastIndexOf('[');
    if (open < 0 || text.indexOf(']', open) >= 0 || !text.endsWith('=')) return null;
    const terms = text.slice(open + 1, -1).split('+');
    if (terms.some((t) => !/^\d+$/.test(t))) return ']';
    return `${terms.reduce((a, t) => a + Number(t), 0)}]`;
  }
  const toolStep = $derived(impl.get('tool.step', reference));
  const mine = $derived(impl.isMine('tool.step'));

  let m = $state<CharModel | null>(null);
  let status = $state<'idle' | 'loading' | 'running' | 'error'>('idle');
  let error = $state('');
  let progress = $state(0);
  let terms = $state(['4821', '97', '30512']);
  let useTool = $state(true);
  // The completion, as runs of characters written by the model or by the tool.
  let pieces = $state<{ text: string; tool: boolean }[]>([]);

  const valid = $derived(terms.every((t) => /^\d{1,9}$/.test(t)));
  const prompt = $derived(terms.join('+') + '=');
  const truth = $derived(terms.reduce((a, t) => a + Number(t || 0), 0));
  const written = $derived(pieces.map((p) => p.text).join(''));
  const answer = $derived.by(() => {
    const tail = written.split('>').at(-1) ?? '';
    return written.includes('>') && /^\d+$/.test(tail) ? Number(tail) : null;
  });

  async function run() {
    status = 'loading';
    try {
      m ??= await loadCalculatorModel((f) => (progress = f));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      status = 'error';
      return;
    }
    status = 'running';
    pieces = [];
    const stoi = new Map([...m.chars].map((c, i) => [c, i]));
    const runner = await runnerFor(m);
    const cache = runner.cache();
    let l = runner.forward(cache, [...'\n' + prompt].map((c) => stoi.get(c)!));
    let text = '';
    const push = (s: string, tool: boolean) => {
      text += s;
      const last = pieces.at(-1);
      if (last && last.tool === tool) pieces = [...pieces.slice(0, -1), { text: last.text + s, tool }];
      else pieces = [...pieces, { text: s, tool }];
    };
    for (let step = 0; step < 120 && 1 + prompt.length + text.length < cache.capacity; step++) {
      const z = await l.read();
      l.dispose();
      let best = 0;
      for (let i = 1; i < z.length; i++) if (z[i]! > z[best]!) best = i;
      const c = m.chars[best]!;
      if (c === '\n') break;
      push(c, false);
      let feed = [best];
      if (useTool) {
        let out: string | null = null;
        try {
          out = toolStep(text);
        } catch {
          out = reference(text);
        }
        if (out) {
          push(out, true);
          feed = [...feed, ...[...out].map((ch) => stoi.get(ch) ?? stoi.get(']')!)];
        }
      }
      if (1 + prompt.length + text.length >= cache.capacity) break;
      l = runner.forward(cache, feed);
    }
    cache.dispose();
    status = 'idle';
  }
</script>

<Widget
  title="A model with a calculator"
  subtitle="A 4-layer model trained to add three numbers by writing calculator calls. Tool output is highlighted: the model never predicts it. Try numbers longer than the 6 digits it was trained on, and switch the calculator off."
  onreset={() => {
    terms = ['4821', '97', '30512'];
    useTool = true;
    pieces = [];
  }}
>
  {#snippet controls()}
    <Button variant="primary" onclick={run} disabled={!valid || status === 'loading' || status === 'running'}>{status === 'loading' ? `Loading… ${(progress * 100).toFixed(0)}%` : status === 'running' ? 'Running…' : 'Run'}</Button>
    <Toggle label="Calculator attached" bind:checked={useTool} />
  {/snippet}

  {#if mine}<p class="mine ui">Using your toolStep().</p>{/if}
  <div class="terms ui">
    {#each terms as _, i (i)}
      {#if i}<span class="plus">+</span>{/if}
      <input class="num" bind:value={terms[i]} inputmode="numeric" maxlength="9" aria-label="Term {i + 1}" />
    {/each}
  </div>
  {#if status === 'error'}<p class="muted">{error}</p>{/if}
  {#if pieces.length}
    <p class="trace num">{prompt}{#each pieces as p, i (i)}<span class:tool={p.tool}>{p.text}</span>{/each}</p>
    <p class="verdict ui" class:ok={answer === truth}>{answer === null ? 'No final answer.' : answer === truth ? `Correct: ${truth}.` : `Wrong: the sum is ${truth}.`}</p>
  {/if}
</Widget>

<style>
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .terms {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
  .terms input {
    width: 7.5rem;
    font-size: 0.95rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
  }
  .plus {
    color: var(--ink-3);
  }
  .trace {
    font-size: 1rem;
    overflow-wrap: anywhere;
    margin: 0.8rem 0 0.3rem;
  }
  .tool {
    background: var(--accent-soft, var(--surface-2));
    color: var(--accent-ink);
    border-radius: 3px;
    padding: 0 1px;
  }
  .verdict {
    font-size: 0.82rem;
    color: var(--critical);
    margin: 0;
  }
  .verdict.ok {
    color: var(--good);
  }
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
</style>
