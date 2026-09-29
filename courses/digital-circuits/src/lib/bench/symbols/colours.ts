/**
 * Emitted-light colours of LEDs and indicators. These are the colours of real light, so they are the
 * same in both themes (they are not design tokens).
 */
export const LED_COLOURS: Record<string, { lit: string; glow: string }> = {
  infrared: { lit: '#b0306a', glow: '#d04a8a' },
  red: { lit: '#ff3b2f', glow: '#ff5a3c' },
  amber: { lit: '#ffa21a', glow: '#ffb640' },
  yellow: { lit: '#ffe03a', glow: '#fff07a' },
  green: { lit: '#2fd35a', glow: '#5cf07e' },
  blue: { lit: '#3a7bff', glow: '#6aa0ff' },
  white: { lit: '#f4f7ff', glow: '#ffffff' },
};

/** Warm glow of an incandescent filament. */
export const FILAMENT = { core: '#fff6d0', mid: '#ffc94a', edge: '#ff9a1a' };
