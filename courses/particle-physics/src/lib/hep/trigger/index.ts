/**
 * Stage 5: the trigger. Level-1 (coarse towers and muon stubs, a fixed 4 µs latency, 40 MHz in and about 100 kHz out), the HLT
 * (fast reconstruction, about 1 kHz out), menus with thresholds and prescales, rate estimation from weighted samples, bandwidth
 * and dead time, turn-on curves, and toy samples for the course's trigger game. See README.md.
 *
 * Hook for the reader's code: `trigger.l1Decision`.
 */
export * from './level1.ts';
export * from './hlt.ts';
export * from './menu.ts';
export * from './turnon.ts';
export * from './toy.ts';
export * from './game.ts';
