<!--
  A real JEDEC file, line by line. The file is what the course's fitter writes for the design you pick
  (`fitGal22v10Equations(…).jedec()`); hover or focus a line for what it is, and click a bit of a fuse line to
  flip that fuse. Either the file is rewritten (both checksums follow the change) or it is edited by hand, with
  the old checksums left in, which a programmer refuses: that is what the checksums are for.

    ::jedec-anatomy{n="26.5" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { FUSE_COUNT } from '$lib/pld/devices/gal22v10';
  import { DESIGNS, accepted, checksums, explain, fitDesign, flipped, fuseText, lines, render, withStaleChecksums, type Line } from './jedec-anatomy';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let designId = $state('traffic-light');
  const first = fitDesign('traffic-light');
  let fit = $state.raw(first);
  let fuses = $state.raw<Uint8Array>(Uint8Array.from(first.fuses));
  let text = $state(first.jedec());
  let hand = $state(false);
  let active = $state(0);
  let hover = $state('');
  let target = $state('0');

  function choose(id: string) {
    designId = id;
    fit = fitDesign(id);
    fuses = Uint8Array.from(fit.fuses);
    text = fit.jedec();
    active = 0;
    hover = '';
  }

  const ls = $derived(lines(text));
  const sums = $derived(checksums(text, fuses));
  const ok = $derived(text ? accepted(text) : true);
  const changed = $derived(fuses.some((v, i) => v !== fit.fuses[i]));
  const line = $derived(ls[Math.min(active, ls.length - 1)] as Line | undefined);
  const info = $derived(line ? explain(line, fit, fuses) : null);
  const h4 = (x: number | undefined) => (x === undefined ? '----' : x.toString(16).toUpperCase().padStart(4, '0'));

  function flip(i: number) {
    if (!Number.isInteger(i) || i < 0 || i >= FUSE_COUNT) return;
    const next = flipped(fuses, i);
    text = hand ? withStaleChecksums(fit, text, next) : render(fit, next);
    fuses = next;
    hover = fuseText(fit, next, i);
  }
  function onBit(e: MouseEvent) {
    const t = (e.target as HTMLElement).closest('[data-f]') as HTMLElement | null;
    if (t) flip(Number(t.dataset.f));
  }
  function onOver(e: PointerEvent) {
    const t = (e.target as HTMLElement).closest('[data-f]') as HTMLElement | null;
    if (t) hover = fuseText(fit, fuses, Number(t.dataset.f));
  }
  function reset() {
    choose(designId);
    hand = false;
  }
  const show = (t: string) => t.replace('\x02', 'STX').replace('\x03', 'ETX ');
</script>

<Widget {n} title="A JEDEC file, line by line" subtitle={fit.design.title} {caption} onreset={reset}>
  {#snippet controls()}
    <Segmented label="Design" value={designId} onchange={choose} options={DESIGNS.map((d) => ({ value: d.id, label: d.label }))} />
    <Segmented label="When I flip a fuse" value={hand ? 'hand' : 'fix'} onchange={(v) => (hand = v === 'hand')} options={[{ value: 'fix', label: 'Rewrite the file', title: 'The fuse lines and both checksums are regenerated' }, { value: 'hand', label: 'Edit by hand', title: 'Only the bit changes; the old checksums stay in the file' }]} />
  {/snippet}

  <div class="ja">
    <!-- Bits are clicked with the mouse; the keyboard route to the same action is the "Flip fuse number" form beside the file. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <div class="file" role="list" aria-label="The JEDEC file" onclick={onBit} onpointerover={onOver}>
      {#each ls as l (l.index)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="ln {l.kind}"
          class:active={l.index === active}
          role="listitem"
          tabindex="0"
          aria-label={`Line ${l.index + 1}: ${l.kind === 'array' || l.kind === 'config' || l.kind === 'signature' ? `fuse field from ${l.start}` : show(l.text)}`}
          onfocus={() => (active = l.index)}
          onpointerenter={() => (active = l.index)}
        >
          {#if l.start !== undefined}
            <span class="tag">*L{String(l.start).padStart(4, '0')}</span>
            <span class="bits">
              {#each l.text.slice(l.text.indexOf(' ') + 1).split('') as b, k (k)}
                <span class="b" class:one={b === '1'} class:gap={k % 2 === 0 && k > 0 && l.kind === 'array'} data-f={l.start + k}>{b}</span>
              {/each}
            </span>
          {:else}
            <span class="tag">{show(l.text)}</span>
          {/if}
        </div>
      {/each}
    </div>

    <div class="side">
      {#if info}
        <div class="info" aria-live="polite">
          <h4 class="ui">{info.title}</h4>
          {#each info.body as p, i (i)}<p class="ui">{p}</p>{/each}
        </div>
      {/if}
      <p class="hover ui" aria-live="polite">{hover || 'Hover over a bit of a fuse line for the fuse it is; click it to flip it.'}</p>

      <div class="sums ui" class:bad={!ok}>
        <div><span>Fuse checksum</span><b>{h4(sums?.writtenFuse)}</b><i>{sums && sums.fuse === sums.writtenFuse ? 'matches' : `fuses say ${h4(sums?.fuse)}`}</i></div>
        <div><span>Transmission checksum</span><b>{h4(sums?.writtenTransmission)}</b><i>{sums && sums.transmission === sums.writtenTransmission ? 'matches' : `file says ${h4(sums?.transmission)}`}</i></div>
        <div class="verdict">{ok ? (changed ? 'A programmer accepts this file. It is not the fitter’s: a fuse differs.' : 'A programmer accepts this file.') : 'A programmer refuses this file: a checksum is wrong.'}</div>
      </div>

      <form
        class="by-number ui"
        onsubmit={(e) => {
          e.preventDefault();
          flip(Number(target));
        }}
      >
        <label>Flip fuse number <input type="number" min="0" max={FUSE_COUNT - 1} bind:value={target} inputmode="numeric" /></label>
        <button type="submit"><Icon name="bolt" size={13} /> Flip</button>
      </form>
    </div>
  </div>
</Widget>

<style>
  .ja {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 0.9rem;
    padding: 0.8rem 0.9rem 1rem;
    align-items: start;
  }
  @media (max-width: 46rem) {
    .ja {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .file {
    max-height: 25rem;
    overflow: auto;
    background: var(--pn);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.35rem 0;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    line-height: 1.55;
  }
  .ln {
    display: flex;
    gap: 0.6rem;
    padding: 0 0.6rem;
    white-space: nowrap;
    width: max-content;
    min-width: 100%;
    border-left: 3px solid transparent;
    outline: none;
  }
  .ln.active {
    background: var(--copper-soft);
    border-left-color: var(--copper);
  }
  .ln:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .tag {
    color: var(--ink-2);
    font-weight: 600;
  }
  .ln.header .tag,
  .ln.stx .tag,
  .ln.etx .tag {
    font-weight: 400;
    color: var(--mute);
  }
  .bits {
    display: inline-flex;
  }
  .b {
    color: var(--mute);
    cursor: pointer;
    padding: 0 0.5px;
  }
  .b.gap {
    margin-left: 0.32em;
  }
  .b.one {
    color: var(--fg);
    font-weight: 600;
  }
  .b:hover {
    background: var(--sig-high);
    color: var(--panel);
  }
  .side {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
  }
  .info {
    border-left: 3px solid var(--copper);
    padding: 0.1rem 0 0.1rem 0.7rem;
  }
  .info h4 {
    margin: 0 0 0.3rem;
    font-size: 0.9rem;
    font-family: var(--font-mono);
  }
  .info p {
    margin: 0 0 0.4rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .hover {
    margin: 0;
    font-size: 0.78rem;
    color: var(--mute);
    min-height: 2.4em;
  }
  .sums {
    display: grid;
    gap: 0.25rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    padding: 0.5rem 0.7rem;
    font-size: 0.8rem;
  }
  .sums div {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
  }
  .sums span {
    flex: 1;
    color: var(--ink-2);
  }
  .sums b {
    font-family: var(--font-mono);
  }
  .sums i {
    font-style: normal;
    color: var(--ok);
    min-width: 7.5em;
    text-align: right;
  }
  .sums.bad i {
    color: var(--bad);
  }
  .sums .verdict {
    display: block;
    color: var(--ok);
    font-weight: 600;
    margin-top: 0.15rem;
  }
  .sums.bad .verdict {
    color: var(--bad);
  }
  .by-number {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
    font-size: 0.8rem;
  }
  .by-number input {
    width: 5.5rem;
    font: inherit;
    font-family: var(--font-mono);
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    background: var(--panel);
    color: var(--fg);
  }
  .by-number button {
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
    padding: 0.25rem 0.7rem;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel);
    color: var(--fg);
    font: inherit;
    cursor: pointer;
  }
  .by-number button:focus-visible,
  .by-number input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
