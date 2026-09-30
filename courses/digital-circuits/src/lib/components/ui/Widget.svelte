<!--
  The frame around every interactive figure: an instrument panel with a title strip (kind, number, title,
  subtitle, action buttons), an optional controls row, the body, and a caption.
    <Widget title="…" n="6.2" controls={…} actions={…} fullscreen onreset={…}>…</Widget>
  `actions` is the slot for "Open on the bench" / "Open in the Studio" buttons (use the `.w-action` class
  for the same look). `fullscreen` adds a button that shows the figure full screen. `grid` puts the
  engineering grid behind the body (for schematics). Widgets are "wide" by default so they can use the
  margin column on large screens.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let {
    title,
    subtitle,
    caption,
    wide = true,
    controls,
    actions,
    children,
    onreset,
    kind = 'Interactive',
    n,
    fullscreen = false,
    grid = false,
    live = true,
  }: {
    title: string;
    subtitle?: string;
    caption?: string;
    wide?: boolean;
    controls?: Snippet;
    /** Extra buttons in the title strip, e.g. "Open on the bench". */
    actions?: Snippet;
    children: Snippet;
    onreset?: () => void;
    kind?: string;
    /** Figure number, e.g. "6.2". */
    n?: string | number;
    fullscreen?: boolean;
    grid?: boolean;
    /** Show the power LED (a live figure). */
    live?: boolean;
  } = $props();

  let el = $state<HTMLElement | undefined>();
  let isFull = $state(false);

  async function toggleFull() {
    if (!el) return;
    try {
      if (document.fullscreenElement === el) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* fullscreen refused (iframe, iOS): ignore */
    }
  }
</script>

<svelte:document onfullscreenchange={() => (isFull = !!el && document.fullscreenElement === el)} />

<figure class="widget" class:wide class:is-full={isFull} bind:this={el}>
  <header class="strip ui">
    <div class="titles">
      <span class="kind">
        {#if live}<span class="led" aria-hidden="true"></span>{/if}
        {#if n}<span class="fig">Fig. {n}</span>{/if}
        <span>{kind}</span>
      </span>
      <h4>{title}</h4>
      {#if subtitle}<p class="sub">{subtitle}</p>{/if}
    </div>
    {#if actions || onreset || fullscreen}
      <div class="tools">
        {@render actions?.()}
        {#if fullscreen}
          <button class="w-icon" onclick={toggleFull} title={isFull ? 'Exit full screen' : 'Full screen'} aria-label={isFull ? 'Exit full screen' : 'Show full screen'} aria-pressed={isFull}>
            <Icon name={isFull ? 'close' : 'fullscreen'} size={15} />
          </button>
        {/if}
        {#if onreset}
          <button class="w-icon" onclick={onreset} title="Reset" aria-label="Reset widget"><Icon name="reset" size={15} /></button>
        {/if}
      </div>
    {/if}
  </header>
  {#if controls}<div class="controls ui">{@render controls()}</div>{/if}
  <div class="body" class:grid-paper={grid}>{@render children()}</div>
  {#if caption}<figcaption class="ui">{caption}</figcaption>{/if}
</figure>

<style>
  .widget {
    --strip: light-dark(#ebe4d6, #131c29);
    margin: 2.5rem 0;
    background: var(--panel);
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    min-width: 0;
  }
  .strip {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    padding: 0.75rem 1.1rem 0.7rem 1.1rem;
    background: linear-gradient(to bottom, color-mix(in srgb, var(--strip) 70%, var(--panel)), var(--strip));
    border-bottom: 1px solid var(--line-strong);
  }
  .titles {
    min-width: 0;
  }
  .kind {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 500;
    color: var(--mute);
  }
  .fig {
    color: var(--copper-ink);
    font-weight: 600;
  }
  /* Power LED. */
  .led {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--phosphor);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--phosphor) 18%, transparent), 0 0 7px var(--phosphor-glow);
  }
  h4 {
    margin: 0.2rem 0 0 !important;
    padding: 0 !important;
    border: 0 !important;
    font-family: var(--font-display) !important;
    font-size: 1.12rem !important;
    font-weight: 600 !important;
    letter-spacing: -0.012em !important;
    line-height: 1.2 !important;
    color: var(--fg);
  }
  h4::before,
  h4::after {
    display: none !important;
  }
  .sub {
    margin: 0.25rem 0 0 !important;
    font-size: 0.86rem;
    color: var(--ink-2);
    line-height: 1.45;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 0.4rem;
    flex: none;
    max-width: 55%;
  }
  .w-icon,
  .tools :global(.w-action) {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    height: 1.9rem;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    border-radius: 6px;
    cursor: pointer;
    font-family: var(--font-ui);
    font-size: 0.8rem;
    font-weight: 500;
    text-decoration: none;
    white-space: nowrap;
    transition: background-color 120ms, border-color 120ms, color 120ms;
  }
  .w-icon {
    width: 1.9rem;
    justify-content: center;
    padding: 0;
  }
  .tools :global(.w-action) {
    padding: 0 0.7rem;
  }
  .w-icon:hover,
  .tools :global(.w-action:hover) {
    border-color: var(--copper);
    color: var(--copper-ink);
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.75rem 1.5rem;
    padding: 0.7rem 1.1rem 0.8rem;
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--strip) 35%, var(--panel));
  }
  .body {
    padding: 1rem 1.1rem 1.1rem;
    font-family: var(--font-ui);
    font-size: 0.92rem;
    background-color: var(--panel);
  }
  figcaption {
    padding: 0.65rem 1.1rem 0.8rem;
    border-top: 1px solid var(--line);
    font-size: 0.84rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
  .is-full {
    margin: 0;
    border-radius: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
  }
  .is-full .body {
    flex: 1;
  }
  @media (max-width: 560px) {
    .strip {
      flex-direction: column;
      padding: 0.7rem 0.9rem;
    }
    .tools {
      max-width: none;
      justify-content: flex-start;
    }
    .controls,
    .body,
    figcaption {
      padding-left: 0.9rem;
      padding-right: 0.9rem;
    }
  }
</style>
