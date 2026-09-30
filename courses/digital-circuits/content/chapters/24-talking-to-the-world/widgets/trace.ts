import type { Annotation } from '$lib/bench/instruments/decoders';
import type { Signal } from './protocols';

export interface TraceChannel {
  name: string;
  signal?: Signal;
  /** An analogue trace instead of a digital one: sample times and values, drawn between `min` and `max`. */
  analog?: { t: number[]; v: number[]; min: number; max: number; unit?: string };
  /** Colour: 1 to 6, the series colours. */
  tone?: number;
}

export interface DecodedRow {
  name: string;
  notes: Annotation[];
}
