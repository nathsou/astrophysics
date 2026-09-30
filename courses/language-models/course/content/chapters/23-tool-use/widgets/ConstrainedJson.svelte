<!--
  Constrained decoding with CourseGPT. At every step, tokens that would break the pattern are masked out (the
  learner's isPrefix decides), and the model samples among the rest. Two patterns: a story opening, which
  CourseGPT fills well, and a JSON object, which it has never seen — and where each value follows a quote, so the
  tokens it knows words by (" Lily", with a leading space) are not allowed.
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { loadCourseGpt, runnerFor, type CourseGpt } from '$lib/models/coursegpt';
  import { impl } from '$lib/exercise/impl.svelte';

  type Part = { lit: string } | { cls: 'letters' | 'digits' | 'lower'; min: number; max: number };
  const CLASSES = { letters: /[A-Za-z]/, digits: /[0-9]/, lower: /[a-z]/ };
  function reference(pattern: Part[], s: string): boolean {
    let i = 0;
    for (const part of pattern) {
      if ('lit' in part) {
        for (const c of part.lit) {
          if (i === s.length) return true;
          if (s[i++] !== c) return false;
        }
      } else {
        let n = 0;
        while (i < s.length && n < part.max && CLASSES[part.cls].test(s[i]!)) i++, n++;
        if (i === s.length) return true;
        if (n < part.min) return false;
      }
    }
    return i === s.length;
  }
  /** A complete match: every part consumed, with nothing left over. */
  function matches(pattern: Part[], s: string): boolean {
    let i = 0;
    for (const part of pattern) {
      if ('lit' in part) {
        if (!s.startsWith(part.lit, i)) return false;
        i += part.lit.length;
      } else {
        let n = 0;
        while (i < s.length && n < part.max && CLASSES[part.cls].test(s[i]!)) i++, n++;
        if (n < part.min) return false;
      }
    }
    return i === s.length;
  }
  const isPrefix = $derived(impl.get('tool.prefix', reference));
  const mine = $derived(impl.isMine('tool.prefix'));

  const word = (cls: 'letters' | 'lower'): Part => ({ cls, min: 1, max: 12 });
  const FORMATS: Record<'story' | 'json', { pattern: Part[]; shown: string }> = {
    story: {
      pattern: [{ lit: 'Once upon a time, there was a little ' }, word('lower'), { lit: ' named ' }, word('letters'), { lit: '. ' }, word('letters'), { lit: ' loved to ' }, word('lower'), { lit: ' in the ' }, word('lower'), { lit: '.' }],
      shown: 'Once upon a time, there was a little <lower> named <letters>. <letters> loved to <lower> in the <lower>.',
    },
    json: {
      pattern: [{ lit: '{"animal": "' }, word('lower'), { lit: '", "name": "' }, word('letters'), { lit: '", "colour": "' }, word('lower'), { lit: '"}' }],
      shown: '{"animal": "<lower>", "name": "<letters>", "colour": "<lower>"}',
    },
  };
  let format = $state<'story' | 'json'>('story');
  const PATTERN = $derived(FORMATS[format].pattern);

  let m = $state<CourseGpt | null>(null);
  let status = $state<'idle' | 'loading' | 'running' | 'error'>('idle');
  let error = $state('');
  let progress = $state(0);
  let constrained = $state('');
  let free = $state('');
  let allowedLog = $state<number[]>([]);
  let vocab: string[] | null = null;

  async function load(): Promise<CourseGpt | null> {
    status = 'loading';
    try {
      m ??= await loadCourseGpt((f) => (progress = f));
      vocab ??= Array.from({ length: m.cfg.vocab }, (_, id) => (id === m!.eot ? '' : m!.tok.decode([id])));
      return m;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      status = 'error';
      return null;
    }
  }

  async function generate(withPattern: boolean) {
    const model = await load();
    if (!model || !vocab) return;
    status = 'running';
    const rng = mulberry32(Date.now() & 0xffffffff);
    const runner = await runnerFor(model);
    const cache = runner.cache();
    let l = runner.forward(cache, [model.eot]);
    let text = '';
    const log: number[] = [];
    if (withPattern) constrained = '';
    else free = '';
    for (let step = 0; step < 64; step++) {
      const z = await l.read();
      l.dispose();
      // Sample at temperature 0.8 among the allowed tokens (all tokens, unconstrained).
      const ok: number[] = [];
      for (let id = 0; id < z.length; id++) {
        if (id === model.eot || !vocab[id]) continue;
        let fits = true;
        if (withPattern) {
          try {
            fits = isPrefix(PATTERN, text + vocab[id]!);
          } catch {
            fits = reference(PATTERN, text + vocab[id]!);
          }
        }
        if (fits) ok.push(id);
      }
      if (!ok.length) break;
      let max = -Infinity;
      for (const id of ok) max = Math.max(max, z[id]! / 0.8);
      const w = ok.map((id) => Math.exp(z[id]! / 0.8 - max));
      let u = rng() * w.reduce((a, b) => a + b, 0);
      let pick = ok[ok.length - 1]!;
      for (let i = 0; i < ok.length; i++) if ((u -= w[i]!) <= 0) {
        pick = ok[i]!;
        break;
      }
      log.push(ok.length);
      text += vocab[pick]!;
      if (withPattern) {
        constrained = text;
        allowedLog = [...log];
        if (matches(PATTERN, text)) break;
      } else {
        free = text;
        if (text.includes('\n')) break;
      }
      l = runner.forward(cache, [pick]);
    }
    cache.dispose();
    status = 'idle';
  }
</script>

<Widget
  title="Decoding to a pattern"
  subtitle="CourseGPT writes from the start of a story, sampling at temperature 0.8. Constrained, every token that would break the pattern is removed before it samples: the output always matches, and the model fills in the blanks."
  onreset={() => {
    format = 'story';
    constrained = free = '';
    allowedLog = [];
  }}
>
  {#snippet controls()}
    <Segmented label="Pattern" size="sm" options={[{ value: 'story', label: 'Story template' }, { value: 'json', label: 'JSON' }]} bind:value={format} />
    <Button onclick={() => generate(false)} disabled={status === 'loading' || status === 'running'}>Unconstrained</Button>
    <Button variant="primary" onclick={() => generate(true)} disabled={status === 'loading' || status === 'running'}>{status === 'loading' ? `Loading… ${(progress * 100).toFixed(0)}%` : 'Constrained'}</Button>
  {/snippet}

  {#if mine}<p class="mine ui">Using your isPrefix().</p>{/if}
  <p class="pattern ui">Pattern: <code>{FORMATS[format].shown}</code></p>
  {#if status === 'error'}<p class="muted">{error}</p>{/if}
  <dl class="outs ui">
    <dt>Unconstrained</dt>
    <dd>{free || '…'}</dd>
    <dt>Constrained</dt>
    <dd><code>{constrained || '…'}</code></dd>
  </dl>
  {#if allowedLog.length}
    <p class="note ui">Tokens allowed at each step (of {m?.cfg.vocab.toLocaleString('en-GB')}): {allowedLog.map((n) => n.toLocaleString('en-GB')).join(' · ')}</p>
  {/if}
</Widget>

<style>
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .pattern {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0 0 0.6rem;
  }
  .outs {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 0.4rem 0.8rem;
    font-size: 0.85rem;
    margin: 0;
  }
  dt {
    color: var(--ink-2);
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .note {
    font-size: 0.75rem;
    color: var(--ink-3);
    margin: 0.6rem 0 0;
    overflow-wrap: anywhere;
  }
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
</style>
