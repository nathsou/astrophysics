/**
 * Below these a meter reads exactly zero: the solver's leakage conductances (gmin, an open contact's 1 TΩ)
 * leave picoamps and picovolts on an open circuit, which a real meter would not resolve. The meters' `state().value`
 * (behavioural.ts) and every text that reads a meter (bench/summary.ts) share them, so that what is announced is what is
 * displayed. In their own module so that the bench can use them without loading the analog models.
 */
export const VOLTMETER_FLOOR = 1e-6;
export const AMMETER_FLOOR = 1e-9;

/** A meter's reading: exactly 0 when smaller (strictly) than the floor. */
export const floored = (value: number, floor: number): number => (Math.abs(value) < floor ? 0 : value);
