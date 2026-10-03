<script lang="ts">
  /**
   * The pinyin chart: initials down the side, finals across the top. Every cell is a real
   * syllable; tap it to hear it in all its tones, each with a real character.
   */
  import { charsFor, knownSyllables } from '$lib/zh/readings';
  import { mark, type Tone } from '$lib/zh/pinyin';
  import { lookup } from '$lib/zh/lexicon';
  import { speech } from '$lib/audio/speech.svelte';

  let { finals = 'a,o,e,i,u,ü,ai,ei,ao,ou,an,en,ang,eng,ong', initials = 'b,p,m,f,d,t,n,l,g,k,h,j,q,x,zh,ch,sh,r,z,c,s' }: { finals?: string; initials?: string } = $props();
  const F = $derived(finals.split(','));
  const I = $derived(['', ...initials.split(',')]);
  const known = knownSyllables();

  /** The written syllable for an initial + final, following pinyin spelling rules. */
  function spell(i: string, f: string): string {
    if (!i) {
      if (f === 'i') return 'yi';
      if (f === 'u') return 'wu';
      if (f === 'ü') return 'yu';
      return f;
    }
    if ('jqx'.includes(i) && f.startsWith('ü')) return i + 'u' + f.slice(1);
    return i + f;
  }
  const key = (s: string) => s.replace('ü', 'v');
  const exists = (s: string) => known.has(s.replace('ü', 'ü'));

  let open = $state<string | null>(null);
  const tones = $derived(
    open
      ? ([1, 2, 3, 4] as Tone[]).map((t) => {
          const ch = charsFor(open!, t)[0];
          return { t, py: mark(open!, t), ch, g: ch ? lookup(ch)?.g : undefined };
        })
      : [],
  );

  function pick(s: string) {
    open = s;
    const first = ([1, 2, 3, 4] as Tone[]).map((t) => charsFor(s, t)[0]).find(Boolean);
    if (first) void speech.say(first);
  }
</script>

<figure class="chart">
  <div class="scroll">
    <table>
      <thead>
        <tr><th></th>{#each F as f (f)}<th class="ui">{f}</th>{/each}</tr>
      </thead>
      <tbody>
        {#each I as i (i)}
          <tr>
            <th class="ui">{i || '–'}</th>
            {#each F as f (f)}
              {@const s = spell(i, f)}
              <td>
                {#if exists(s)}
                  <button class:on={open === s} onclick={() => pick(s)} data-k={key(s)}>{s}</button>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if open}
    <div class="tones ui" aria-live="polite">
      {#each tones as x (x.t)}
        <button class="tone t{x.t}" disabled={!x.ch} onclick={() => x.ch && speech.say(x.ch)}>
          <span class="py">{x.py}</span>
          {#if x.ch}<span class="ch zh-font">{x.ch}</span><span class="g">{x.g ?? ''}</span>{:else}<span class="g">no common word</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
  <figcaption class="ui">Each cell is a syllable with a common character in this course. Mandarin has only about 400 syllables, against thousands in English. Tap one to hear it, then tap a tone.</figcaption>
</figure>

<style>
  .chart {
    margin: 1.6rem 0;
  }
  .scroll {
    overflow-x: auto;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--panel);
    max-height: 26rem;
  }
  table {
    border-collapse: collapse;
    font-family: var(--font-py);
    font-size: 0.82rem;
  }
  th {
    position: sticky;
    background: var(--pn);
    color: var(--accent-ink);
    font-weight: 700;
    padding: 0.3rem 0.45rem;
    z-index: 1;
  }
  thead th {
    top: 0;
  }
  tbody th {
    left: 0;
  }
  td {
    padding: 1px;
    border-bottom: 1px solid var(--line);
  }
  td button {
    border: none;
    background: none;
    padding: 0.25rem 0.35rem;
    border-radius: 6px;
    cursor: pointer;
    color: var(--fg);
    font: inherit;
    white-space: nowrap;
  }
  td button:hover {
    background: var(--accent-soft);
  }
  td button.on {
    background: var(--accent);
    color: #fff;
  }
  .tones {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.4rem;
    margin-top: 0.6rem;
  }
  .tone {
    display: grid;
    justify-items: center;
    padding: 0.4rem;
    border-radius: 12px;
    border: 1.5px solid var(--line);
    background: var(--panel);
    cursor: pointer;
    color: var(--fg);
  }
  .tone:hover:not(:disabled) {
    border-color: var(--tone);
  }
  .tone:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .py {
    font-weight: 700;
    color: var(--tone);
    font-size: 1.05rem;
  }
  .ch {
    font-size: 1.5rem;
    line-height: 1.2;
  }
  .g {
    font-size: 0.72rem;
    color: var(--mute);
    text-align: center;
    line-height: 1.25;
  }
  figcaption {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--mute);
  }
  @media (max-width: 520px) {
    .tones {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
