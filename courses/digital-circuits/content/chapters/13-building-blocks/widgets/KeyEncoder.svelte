<!--
  An eight-key keyboard wired to two encoders. The plain encoder ORs together the numbers of the keys that are
  down, so two keys at once give a third number; the priority encoder reports the highest key. Press keys
  (click, or Space and Enter; they stay down until pressed again) and compare. The logic is in encode.ts, which
  the chapter's circuit test checks against the engine's encoder blocks for all 256 patterns.

    ::key-encoder{n="13.5" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { codeBits, encode, encoderIsRight, pressed, priorityEncode } from './encode';

  let { n: fig, caption }: { n?: string | number; caption?: string } = $props();

  let keys = $state<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const down = $derived(pressed(keys));
  const plain = $derived(encode(keys));
  const prio = $derived(priorityEncode(keys));
  const wrong = $derived(!encoderIsRight(keys));

  const toggle = (i: number) => (keys = keys.map((k, j) => (j === i ? 1 - k : k)));
  const clear = () => (keys = [0, 0, 0, 0, 0, 0, 0, 0]);
  const list = $derived(down.length ? down.join(' and ') : 'none');
  const say = (e: { code: number; valid: number }) => (e.valid ? `${e.code}` : 'no key');
</script>

<Widget title="Which key is down?" subtitle="A plain encoder against a priority encoder" {caption} n={fig} onreset={clear}>
  <div class="ke">
    <div class="keys" role="group" aria-label="Eight keys, numbered 0 to 7">
      {#each keys as k, i (i)}
        <button type="button" class="key" class:down={k} aria-pressed={!!k} onclick={() => toggle(i)} aria-label="Key {i}">
          <span class="cap">{i}</span>
        </button>
      {/each}
    </div>
    <p class="hint ui">Keys down: <b>{list}</b>. A key stays down until you press it again.</p>

    <div class="pair">
      {#each [{ name: 'Encoder', sub: 'ORs the numbers of the keys down', e: plain, bad: wrong }, { name: 'Priority encoder', sub: 'the highest key wins', e: prio, bad: false }] as p (p.name)}
        <section class="enc ui" class:bad={p.bad} aria-label="{p.name}: output {say(p.e)}">
          <h5>{p.name}</h5>
          <p class="sub">{p.sub}</p>
          <div class="out" aria-hidden="true">
            {#each [2, 1, 0] as b (b)}
              {@const on = codeBits(p.e.code, 3)[b]}
              <span class="bit" class:on><i>A{b}</i>{on}</span>
            {/each}
            <span class="bit v" class:on={p.e.valid}><i>V</i>{p.e.valid}</span>
          </div>
          <p class="num" role="status">
            {#if p.e.valid}says key <b>{p.e.code}</b>{:else}says <b>no key</b>{/if}
            {#if p.bad}<span class="warn">Wrong: keys {list} are down, and it can name only one.</span>{/if}
          </p>
        </section>
      {/each}
    </div>
    <div class="row"><Button size="sm" onclick={clear}>Release all keys</Button></div>
  </div>
</Widget>

<style>
  .ke {
    display: grid;
    gap: 0.8rem;
  }
  .keys {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 6px;
    max-width: 30rem;
    margin: 0 auto;
    width: 100%;
  }
  .key {
    position: relative;
    aspect-ratio: 1 / 1.15;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    background: var(--panel);
    box-shadow: 0 3px 0 var(--line-strong);
    color: var(--fg);
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 1.05rem;
    cursor: pointer;
    transition:
      transform 0.06s,
      box-shadow 0.06s;
    padding: 0;
  }
  .key .cap {
    display: block;
  }
  .key.down {
    transform: translateY(3px);
    box-shadow: 0 0 0 var(--line-strong);
    border-color: var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) 18%, var(--panel));
    color: var(--sig-high);
  }
  .key:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .hint {
    margin: 0;
    text-align: center;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  .hint b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8rem;
  }
  @media (max-width: 34rem) {
    .pair {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .enc {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.7rem 0.8rem;
    background: var(--pn);
  }
  .enc.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  h5 {
    margin: 0;
    font-size: 0.95rem;
  }
  .sub {
    margin: 0.1rem 0 0.6rem;
    font-size: 0.78rem;
    color: var(--mute);
  }
  .out {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .bit {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    min-width: 2.3rem;
    padding: 0.2rem 0.3rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 1rem;
    color: var(--sig-low);
    background: var(--panel);
  }
  .bit i {
    font-style: normal;
    font-weight: 500;
    font-size: 0.66rem;
    color: var(--mute);
  }
  .bit.on {
    color: var(--sig-high);
    border-color: var(--sig-high);
    background: color-mix(in srgb, var(--sig-high) 14%, var(--panel));
    box-shadow: 0 0 8px var(--sig-high-glow);
  }
  .bit.v {
    margin-left: 0.4rem;
  }
  .num {
    margin: 0.6rem 0 0;
    font-size: 0.9rem;
    color: var(--ink-2);
    min-height: 2.8em;
  }
  .num b {
    font-family: var(--font-mono);
    font-size: 1.05rem;
    color: var(--fg);
  }
  .warn {
    display: block;
    color: var(--bad);
    font-size: 0.8rem;
    margin-top: 0.15rem;
  }
  .row {
    display: flex;
    justify-content: center;
  }
  @media (prefers-reduced-motion: reduce) {
    .key {
      transition: none;
    }
  }
</style>
