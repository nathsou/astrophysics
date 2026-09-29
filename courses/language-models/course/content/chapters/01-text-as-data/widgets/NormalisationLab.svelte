<script lang="ts">
  import * as T from '@lm/core/text';
  import Widget from '$lib/components/ui/Widget.svelte';

  const PRESETS = [
    { label: 'é two ways', text: 'café / café' },
    { label: 'Ligature', text: 'ﬁnancial' },
    { label: 'Full-width', text: 'ＧＰＴ－４' },
    { label: 'Circled', text: '① ② ③' },
    { label: 'Ångström', text: 'Å vs Å' },
    { label: 'Superscript', text: 'x² + y³' },
    { label: 'Hangul', text: '한국어' },
  ];
  const FORMS = ['NFC', 'NFD', 'NFKC', 'NFKD'] as const;
  const EXPLAIN: Record<(typeof FORMS)[number], string> = {
    NFC: 'Canonical composition: combine base + accent into one code point where one exists. The web’s default.',
    NFD: 'Canonical decomposition: split precomposed characters into base + combining marks.',
    NFKC: 'Compatibility composition: also folds “same meaning, different look” (ligatures, full-width, circled, superscripts).',
    NFKD: 'Compatibility decomposition: NFKC’s folding, fully decomposed.',
  };

  let input = $state(PRESETS[0]!.text);
  const rows = $derived([
    { name: 'Original', text: input, note: 'Exactly what was typed or pasted.' },
    ...FORMS.map((f) => ({ name: f, text: input.normalize(f), note: EXPLAIN[f] })),
  ]);
</script>

<Widget
  title="Same text, different code points"
  subtitle="Unicode normalisation rewrites strings into a canonical form. Strings that look identical can differ byte-for-byte — and a tokeniser only ever sees bytes."
  onreset={() => (input = PRESETS[0]!.text)}
>
  {#snippet controls()}
    <label class="field">
      <span>Text</span>
      <input bind:value={input} spellcheck="false" aria-label="Text to normalise" />
    </label>
    <div class="presets" role="group" aria-label="Examples">
      {#each PRESETS as p (p.label)}<button class="chip" class:on={p.text === input} onclick={() => (input = p.text)}>{p.label}</button>{/each}
    </div>
  {/snippet}

  <table>
    <thead>
      <tr><th>Form</th><th>Rendered</th><th>Code points</th><th class="r">Bytes</th><th>Same as original?</th></tr>
    </thead>
    <tbody>
      {#each rows as r (r.name)}
        {@const cps = T.codePoints(r.text)}
        <tr>
          <th scope="row" title={r.note}>{r.name}</th>
          <td class="render">{r.text}</td>
          <td class="cps">
            {#each cps.slice(0, 18) as cp, i (i)}<span class="cp" class:mark={/\p{M}/u.test(String.fromCodePoint(cp))}>{cp.toString(16).toUpperCase().padStart(4, '0')}</span>{/each}{#if cps.length > 18}<span class="more">+{cps.length - 18}</span>{/if}
          </td>
          <td class="r num">{T.utf8Encode(r.text).length}</td>
          <td>{r.name === 'Original' ? '—' : r.text === input ? 'identical' : 'different'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="foot">Hover a form’s name for what it does. Shaded code points are combining marks.</p>
</Widget>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.78rem;
    color: var(--ink-2);
    flex: 1 1 14rem;
  }
  .field input {
    font-size: 1.05rem;
    font-family: var(--font-body);
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .chip {
    border: 1px solid var(--border-control);
    background: var(--surface);
    border-radius: 99px;
    padding: 0.2rem 0.6rem;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--ink-2);
  }
  .chip.on {
    background: var(--accent-soft);
    border-color: var(--accent-2);
    color: var(--accent-ink);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.45rem 0.5rem;
    border-bottom: 1px solid var(--rule);
    vertical-align: middle;
  }
  thead th {
    color: var(--ink-2);
    font-weight: 600;
    border-bottom-color: var(--rule-strong);
  }
  tbody th {
    font-weight: 650;
    cursor: help;
  }
  .render {
    font-family: var(--font-body);
    font-size: 1.15rem;
    white-space: nowrap;
  }
  .cps {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }
  .cp {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 0.05rem 0.25rem;
    border-radius: 3px;
    background: var(--surface-2);
  }
  .cp.mark {
    background: color-mix(in srgb, var(--series-2) 22%, var(--surface));
  }
  .more {
    font-size: 0.7rem;
    color: var(--ink-3);
  }
  .r {
    text-align: right;
  }
  .foot {
    margin: 0.6rem 0 0;
    font-size: 0.75rem;
    color: var(--ink-3);
  }
</style>
