<script lang="ts" module>
  // Small stroke icon set (24×24, 1.75 stroke), drawn for the course.
  export const ICONS = {
    note: 'M12 8h.01M11 12h1v4h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    info: 'M12 8h.01M11 12h1v4h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    tip: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z',
    warning: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    lab: 'M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7.5 15h9',
    breakit: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z',
    challenge: 'M8 21l4-9 4 9M3 21h18M12 3l2 4-2 1-2-1 2-4zM5 21l4-7M19 21l-4-7',
    exercises: 'M4 20h4L18.5 9.5a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4',
    definition: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
    key: 'M12 2l2.9 6.9L22 9.3l-5.4 4.8L18.2 21 12 17.3 5.8 21l1.6-6.9L2 9.3l7.1-.4L12 2z',
    question: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    aside: 'M4 6h16M4 12h10M4 18h7',
    history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
    sun: 'M12 3v1M12 20v1M4.2 4.2l.7.7M19.1 19.1l.7.7M3 12h1M20 12h1M4.2 19.8l.7-.7M19.1 4.9l.7-.7M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
    menu: 'M4 6h16M4 12h16M4 18h16',
    close: 'M18 6 6 18M6 6l12 12',
    chevron: 'M9 18l6-6-6-6',
    check: 'M20 6 9 17l-5-5',
    play: 'M6 4l14 8-14 8V4z',
    reset: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    pin: 'M12 17v5M9 3h6l-1 7 4 3v2H6v-2l4-3-1-7z',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    gpu: 'M4 7h16v10H4zM8 11h2v2H8zM14 11h2v2h-2zM7 7V4M12 7V4M17 7V4M7 20v-3M12 20v-3M17 20v-3',
    download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
    upload: 'M12 21V9M7 14l5-5 5 5M4 3h16',
    table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14',
    book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z',
    external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  } as const;
  export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
  let { name, size = 18, label }: { name: IconName; size?: number; label?: string } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  <path d={ICONS[name]} />
</svg>
