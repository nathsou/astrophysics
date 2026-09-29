<script lang="ts">
  import * as T from '@lm/core/text';
  import { impl } from '$lib/exercise/impl.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';

  const PRESETS: { label: string; text: string }[] = [
    { label: 'ASCII', text: 'Hello!' },
    { label: 'Accents', text: 'naïve café' },
    { label: 'Combining', text: 'café vs café' },
    { label: 'CJK', text: '日本語' },
    { label: 'Emoji', text: '🙂👍🏽' },
    { label: 'Family', text: '👩‍👩‍👧‍👦' },
    { label: 'Maths', text: '𝔘𝔫𝔦𝔠𝔬𝔡𝔢 ∑' },
  ];

  let input = $state('naïve café 🙂');
  let hover = $state<number | null>(null);

  const encode = $derived(impl.get('text.utf8Encode', T.utf8Encode));
  const mine = $derived(impl.isMine('text.utf8Encode'));

  // Names for invisible / combining code points so they can be seen.
  const SPECIAL: Record<number, string> = { 0x20: '␣', 0x0a: '↵', 0x09: '⇥', 0x200d: 'ZWJ', 0xfe0f: 'VS16', 0xfe0e: 'VS15', 0x00a0: 'NBSP' };
  const isCombining = (cp: number) => /\p{M}/u.test(String.fromCodePoint(cp));
  const shown = (cp: number) => SPECIAL[cp] ?? (isCombining(cp) ? '◌' + String.fromCodePoint(cp) : cp >= 0x1f3fb && cp <= 0x1f3ff ? 'skin' : String.fromCodePoint(cp));

  type ByteKind = 'ascii' | 'lead' | 'cont';
  const kindOf = (b: number): ByteKind => (b < 0x80 ? 'ascii' : b >= 0xc0 ? 'lead' : 'cont');

  const model = $derived.by(() => {
    let error: string | null = null;
    const groups = T.graphemes(input).map((g) => ({
      g,
      cps: T.codePoints(g).map((cp) => {
        let bytes: number[] = [];
        try {
          bytes = [...encode(String.fromCodePoint(cp))];
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
        return { cp, bytes, u16: T.utf16Units(String.fromCodePoint(cp)) };
      }),
    }));
    const cps = groups.reduce((n, g) => n + g.cps.length, 0);
    const bytes = groups.reduce((n, g) => n + g.cps.reduce((m, c) => m + c.bytes.length, 0), 0);
    return { groups, cps, bytes, error };
  });

  const hex = (b: number, w = 2) => b.toString(16).toUpperCase().padStart(w, '0');
</script>

<Widget
  title="Inside a string"
  subtitle="Type anything. Each column is one user-perceived character (grapheme); below it are the code points it is made of, their UTF-8 bytes, and the UTF-16 code units JavaScript uses internally."
  onreset={() => (input = 'naïve café 🙂')}
>
  {#snippet controls()}
    <label class="field">
      <span>Text</span>
      <input bind:value={input} spellcheck="false" aria-label="Text to inspect" />
    </label>
    <div class="presets" role="group" aria-label="Examples">
      {#each PRESETS as p (p.label)}
        <button class="chip" class:on={input === p.text} onclick={() => (input = p.text)}>{p.label}</button>
      {/each}
    </div>
  {/snippet}

  <div class="stats">
    <span><strong class="num">{model.groups.length}</strong> graphemes</span>
    <span><strong class="num">{model.cps}</strong> code points</span>
    <span><strong class="num">{model.bytes}</strong> UTF-8 bytes</span>
    <span><strong class="num">{input.length}</strong> UTF-16 units <code>.length</code></span>
    {#if mine}<span class="mine">encoded by <em>your</em> utf8Encode</span>{/if}
  </div>
  {#if model.error}<p class="error">Your utf8Encode threw: {model.error}</p>{/if}

  <div class="strip" role="group" aria-label="Breakdown of the text">
    <div class="rowhead" aria-hidden="true">
      <span class="h-g">Grapheme</span>
      <span class="h-cp">Code point</span>
      <span class="h-b">UTF-8</span>
      <span class="h-u">UTF-16</span>
    </div>
    {#each model.groups as grp, gi (gi)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="group" class:hl={hover === gi} onpointerenter={() => (hover = gi)} onpointerleave={() => (hover = null)} role="group" aria-label="Grapheme {grp.g}">
        <div class="glyph">{grp.g === ' ' ? '␣' : grp.g === '\n' ? '↵' : grp.g}</div>
        <div class="cps">
          {#each grp.cps as c, ci (ci)}
            <div class="cp">
              <div class="cp-char">{shown(c.cp)}</div>
              <div class="cp-code num">{T.formatCodePoint(c.cp)}</div>
              <div class="bytes">
                {#each c.bytes as b, bi (bi)}<span class="byte {kindOf(b)} num" title="{b.toString(2).padStart(8, '0')} ({kindOf(b) === 'cont' ? 'continuation' : kindOf(b)} byte)">{hex(b)}</span>{/each}
              </div>
              <div class="units">
                {#each c.u16 as u, ui (ui)}<span class="unit num" class:surrogate={u >= 0xd800 && u <= 0xdfff}>{hex(u, 4)}</span>{/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="legend">
    <span><i class="sw ascii"></i>ASCII byte <code>0xxxxxxx</code></span>
    <span><i class="sw lead"></i>lead byte <code>11xxxxxx</code></span>
    <span><i class="sw cont"></i>continuation <code>10xxxxxx</code></span>
    <span><i class="sw surr"></i>UTF-16 surrogate</span>
  </div>
</Widget>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.78rem;
    color: var(--ink-2);
    flex: 1 1 16rem;
  }
  .field input {
    font: inherit;
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
  .chip:hover {
    border-color: var(--rule-strong);
    color: var(--ink);
  }
  .chip.on {
    background: var(--accent-soft);
    border-color: var(--accent-2);
    color: var(--accent-ink);
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.25rem;
    font-size: 0.82rem;
    color: var(--ink-2);
    margin-bottom: 0.75rem;
  }
  .stats strong {
    color: var(--ink);
    font-size: 1rem;
  }
  .mine {
    color: var(--ink);
    background: color-mix(in srgb, var(--good) 14%, transparent);
    padding: 0 0.5rem;
    border-radius: 99px;
  }
  .error {
    color: var(--critical);
    font-size: 0.82rem;
  }
  .strip {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 0.5rem;
    scrollbar-width: thin;
  }
  .rowhead {
    position: sticky;
    left: 0;
    z-index: 1;
    display: grid;
    grid-template-rows: 3.2rem 2.6rem auto auto;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-3);
    background: var(--chart-surface);
    padding-right: 0.5rem;
    min-width: 5.5rem;
  }
  .rowhead span {
    display: flex;
    align-items: center;
  }
  .h-b,
  .h-u {
    min-height: 1.9rem;
  }
  .group {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    transition: border-color 120ms, box-shadow 120ms;
  }
  .group.hl {
    border-color: var(--accent-2);
    box-shadow: 0 0 0 2px var(--term-hl);
  }
  .glyph {
    height: 3.2rem;
    display: grid;
    place-items: center;
    font-family: var(--font-body);
    font-size: 1.7rem;
    border-bottom: 1px solid var(--rule);
    padding: 0 0.5rem;
  }
  .cps {
    display: flex;
  }
  .cp {
    display: grid;
    grid-template-rows: 1.3rem 1.3rem auto auto;
    justify-items: center;
    padding: 0.2rem 0.35rem 0.35rem;
    min-width: 3.4rem;
  }
  .cp + .cp {
    border-left: 1px dashed var(--rule);
  }
  .cp-char {
    font-size: 0.95rem;
  }
  .cp-code {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--ink-2);
  }
  .bytes,
  .units {
    display: flex;
    gap: 2px;
    margin-top: 0.35rem;
    min-height: 1.5rem;
  }
  .byte,
  .unit {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
    background: var(--surface-2);
    border-bottom: 3px solid var(--sw);
  }
  .ascii {
    --sw: var(--series-1);
  }
  .lead {
    --sw: var(--series-2);
  }
  .cont {
    --sw: var(--series-3);
  }
  .unit {
    --sw: var(--axis);
  }
  .unit.surrogate,
  .surr {
    --sw: var(--series-7);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.2rem;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--ink-2);
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .sw {
    display: inline-block;
    width: 12px;
    height: 4px;
    border-radius: 2px;
    background: var(--sw);
  }
  code {
    font-size: 0.7rem;
  }
</style>
