<script lang="ts">
  /** A small set of line icons, drawn on a 24-unit grid. */
  let { name, size = 18 }: { name: string; size?: number } = $props();
  const PATHS: Record<string, string> = {
    play: 'M8 5.5v13l10.5-6.5z',
    speaker: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
    slow: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 10.5h4M16 13.5h4',
    mic: 'M12 3.5a3 3 0 0 1 3 3V12a3 3 0 0 1-6 0V6.5a3 3 0 0 1 3-3zM6 11.5a6 6 0 0 0 12 0M12 17.5V21',
    stop: 'M7 7h10v10H7z',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    x: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
    sun: 'M12 4V2.5M12 21.5V20M4 12H2.5M21.5 12H20M6.3 6.3 5.2 5.2M18.8 18.8l-1.1-1.1M6.3 17.7l-1.1 1.1M18.8 5.2l-1.1 1.1M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
    cards: 'M7 4.5h11a1.5 1.5 0 0 1 1.5 1.5v12M4.5 7.5h11A1.5 1.5 0 0 1 17 9v10.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 19.5V9a1.5 1.5 0 0 1 1.5-1.5z',
    game: 'M7 8h10a4 4 0 0 1 4 4v1.5a3.5 3.5 0 0 1-6.3 2.1L13.5 14h-3l-1.2 1.6A3.5 3.5 0 0 1 3 13.5V12a4 4 0 0 1 4-4zM8 10.5v3M6.5 12h3M16 11h.01M17.5 13h.01',
    book: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13z',
    exam: 'M7 3.5h10A1.5 1.5 0 0 1 18.5 5v14.5A1.5 1.5 0 0 1 17 21H7a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 7 3.5zM9 8.5h6M9 12h6M9 15.5h3.5',
    settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
    plus: 'M12 5v14M5 12h14',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    back: 'M19 12H5M11 6l-6 6 6 6',
    refresh: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4',
    sparkle: 'M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
    brush: 'M14.5 4.5l5 5-8.5 8.5-5-5zM6 13l5 5-2.5 2.5A3 3 0 0 1 4 18a3 3 0 0 0-1-2.5z',
    flame: 'M12 21a6 6 0 0 0 6-6c0-4.5-4-6.5-4.5-11-3 2-4.5 5-4.5 7.5-1-.5-2-1.5-2-3-1.5 1.5-1 4.5-1 6.5a6 6 0 0 0 6 6z',
    eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    shuffle: 'M4 7h3.5c5 0 5 10 10 10H20M4 17h3.5c1.8 0 2.9-1.3 3.7-3M14 7.8C14.8 7.3 15.9 7 17.5 7H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5',
    lightbulb: 'M9 18.5h6M10 21h4M12 3.5a6 6 0 0 0-3.5 10.9V16.5h7v-2.1A6 6 0 0 0 12 3.5z',
    chat: 'M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5z',
    map: 'M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5L3.5 20zM9 4v13.5M15 6.5V20',
  };
</script>

<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class:filled={name === 'play' || name === 'stop'}>
  <path d={PATHS[name] ?? ''} />
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
  .filled path {
    fill: currentColor;
  }
</style>
