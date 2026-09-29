<script lang="ts" module>
  // Icons for the bench's tools (24 × 24, stroke 1.75), in the style of ui/Icon.svelte.
  export const GLYPHS = {
    undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
    select: 'M5 3l14 7-6 2-2 6z',
    wire: 'M4 19h5V6h11M4 19h.01M20 6h.01',
    rotate: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5',
    flip: 'M12 3v18M8 7 3 12l5 5zM16 7l5 5-5 5z',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
    duplicate: 'M9 9h11v11H9zM5 15H4V4h11v1',
    play: 'M7 4l13 8-13 8z',
    pause: 'M8 5v14M16 5v14',
    stop: 'M6 6h12v12H6z',
    step: 'M5 5l10 7-10 7zM18 5v14',
    reset: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
    fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
    share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13',
    download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
    upload: 'M12 21V9M7 14l5-5 5 5M4 3h16',
    folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    file: 'M6 3h8l4 4v14H6zM14 3v4h4',
    help: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    parts: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    panel: 'M3 4h18v16H3zM15 4v16',
    chevron: 'M6 9l6 6 6-6',
    close: 'M18 6 6 18M6 6l12 12',
    check: 'M20 6 9 17l-5-5',
    probe: 'M3 21l5-5M8 16l2 2 9-9-2-2zM14 5l5 5M17 3l4 4',
    bench: 'M3 4h18v13H3zM8 21h8M12 17v4M6 13h2.5l1.5-5 3 8 1.5-5H18',
    meter: 'M4 5h16v14H4zM8 9h8M8 15h2M12 15h4',
    wave: 'M2 16h4V8h6v8h6V8h4',
    logic: 'M3 6h4M3 12h4M3 18h4M7 4v4h5M7 10v4h9M7 16v4h4M12 6h4v-2M16 12h5M11 18h6',
    lamp: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1',
    dots: 'M5 12h.01M12 12h.01M19 12h.01',
    cursor: 'M12 3v18M3 12h18',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
  } as const;
  export type GlyphName = keyof typeof GLYPHS;
</script>

<script lang="ts">
  let { name, size = 18 }: { name: GlyphName; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={GLYPHS[name]} />
</svg>
