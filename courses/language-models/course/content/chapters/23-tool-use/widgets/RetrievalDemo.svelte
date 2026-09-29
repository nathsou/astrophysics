<!--
  Retrieval over Tiny Shakespeare: every speech is a document, represented by TF-IDF word weights; a query is
  matched by cosine similarity (the learner's topK). A retrieval-augmented model would receive the top passages
  in its prompt.
-->
<script lang="ts">
  import { base } from '$app/paths';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { impl } from '$lib/exercise/impl.svelte';

  function reference(query: number[], docs: number[][], k: number): number[] {
    const norm = (v: number[]) => Math.sqrt(v.reduce((a, x) => a + x * x, 0));
    const q = norm(query);
    const scores = docs.map((d) => {
      const n = norm(d) * q;
      return n === 0 ? 0 : d.reduce((a, x, i) => a + x * query[i]!, 0) / n;
    });
    return scores.map((_, i) => i).sort((a, b) => scores[b]! - scores[a]! || a - b).slice(0, k);
  }
  const topK = $derived(impl.get('tool.topk', reference));
  const mine = $derived(impl.isMine('tool.topk'));

  interface Doc {
    speaker: string;
    text: string;
    tf: Map<string, number>;
  }
  let docs = $state.raw<Doc[]>([]);
  let idf = $state.raw(new Map<string, number>());
  let status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
  let query = $state('the crown and the death of a king');
  let results = $state.raw<{ doc: Doc; score: number }[]>([]);

  const words = (s: string) => s.toLowerCase().match(/[a-z']+/g) ?? [];

  async function load() {
    status = 'loading';
    try {
      const text = await (await fetch(`${base}/data/tinyshakespeare.txt`)).text();
      const out: Doc[] = [];
      for (const block of text.split(/\n\s*\n/)) {
        const [speaker, ...lines] = block.trim().split('\n');
        const body = lines.join(' ');
        if (!speaker?.endsWith(':') || words(body).length < 12) continue;
        const tf = new Map<string, number>();
        for (const w of words(body)) tf.set(w, (tf.get(w) ?? 0) + 1);
        out.push({ speaker: speaker.slice(0, -1), text: lines.join('\n'), tf });
      }
      const df = new Map<string, number>();
      for (const d of out) for (const w of d.tf.keys()) df.set(w, (df.get(w) ?? 0) + 1);
      idf = new Map([...df].map(([w, n]) => [w, Math.log(out.length / n)]));
      docs = out;
      status = 'ready';
      search();
    } catch {
      status = 'error';
    }
  }

  function search() {
    const qw = [...new Set(words(query))].filter((w) => idf.has(w));
    if (!qw.length) return (results = []);
    // Exact cosine similarity in a small space: one dimension per query word, plus one that holds the norm of
    // everything else in the document (it adds to the document's length but never matches the query).
    const vec = (tf: Map<string, number>) => {
      const v = qw.map((w) => (tf.get(w) ?? 0) * idf.get(w)!);
      let rest = 0;
      for (const [w, c] of tf) if (!qw.includes(w)) rest += (c * idf.get(w)!) ** 2;
      return [...v, Math.sqrt(rest)];
    };
    const qv = [...qw.map((w) => idf.get(w)!), 0];
    const candidates = docs.filter((d) => qw.some((w) => d.tf.has(w)));
    const vs = candidates.map((d) => vec(d.tf));
    let ids: number[];
    try {
      ids = topK(qv, vs, 3);
    } catch {
      ids = reference(qv, vs, 3);
    }
    const cos = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0) / (Math.hypot(...a) * Math.hypot(...b) || 1);
    results = ids.filter((i) => candidates[i]).map((i) => ({ doc: candidates[i]!, score: cos(qv, vs[i]!) }));
  }
</script>

<Widget
  title="Retrieval"
  subtitle="Each of Tiny Shakespeare’s speeches is a document. Words are weighted by TF-IDF — frequent in the speech, rare in the play — and the three speeches closest to the query by cosine similarity are retrieved."
  onreset={() => {
    query = 'the crown and the death of a king';
    if (status === 'ready') search();
  }}
>
  {#snippet controls()}
    <input class="q ui" bind:value={query} onkeydown={(e) => e.key === 'Enter' && status === 'ready' && search()} aria-label="Query" />
    <Button variant="primary" onclick={() => (status === 'ready' ? search() : load())} disabled={status === 'loading'}>{status === 'loading' ? 'Indexing…' : 'Search'}</Button>
  {/snippet}

  {#if mine}<p class="mine ui">Using your topK().</p>{/if}
  {#if status === 'idle'}
    <p class="muted ui">Search to index the play ({'≈'}1 MB of text).</p>
  {:else if status === 'error'}
    <p class="muted ui">Could not load Tiny Shakespeare.</p>
  {:else if status === 'ready'}
    <p class="muted ui">{docs.length.toLocaleString('en-GB')} speeches indexed. {results.length ? '' : 'No speech shares a word with the query.'}</p>
    {#each results as r, i (i)}
      <div class="hit">
        <p class="head ui"><strong>{r.doc.speaker}</strong> <span class="num">cosine {r.score.toFixed(3)}</span></p>
        <p class="text">{r.doc.text}</p>
      </div>
    {/each}
  {/if}
</Widget>

<style>
  .q {
    flex: 1 1 16rem;
    font-size: 0.9rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
  }
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
    margin: 0 0 0.4rem;
  }
  .hit {
    margin-top: 0.6rem;
    padding: 0.5rem 0.7rem;
    background: var(--surface-2);
    border-radius: 6px;
  }
  .head {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0 0 0.25rem;
    display: flex;
    justify-content: space-between;
  }
  .text {
    font-size: 0.85rem;
    white-space: pre-wrap;
    margin: 0;
    max-height: 8rem;
    overflow-y: auto;
  }
</style>
