/**
 * Hook for protocol decoders in the logic analyser (UART, SPI and I²C arrive with Chapter 24). A decoder
 * reads the recorded levels of some channels and returns annotations, which the analyser draws as a row
 * of labelled boxes under the waveforms. Nothing is registered yet; the analyser lists what is.
 */

export interface DecoderInput {
  /** Sample times (s), ascending. */
  times: ArrayLike<number>;
  /** Logic values 0, 1, 2 (X), 3 (Z) per channel, aligned with `times`. */
  channels: ArrayLike<number>[];
  /** Channel names, in the same order. */
  names: string[];
}

export interface Annotation {
  t0: number;
  t1: number;
  /** Text in the box ("0x41", "START", "ACK"). */
  text: string;
  /** True for framing errors. */
  error?: boolean;
}

export interface Decoder {
  id: string;
  name: string;
  /** What the channels mean, in order: ["RX"], ["SCK", "MOSI", "MISO", "CS"]. */
  channels: string[];
  decode(input: DecoderInput): Annotation[];
}

const registry = new Map<string, Decoder>();

export function registerDecoder(decoder: Decoder): void {
  registry.set(decoder.id, decoder);
}

export const getDecoder = (id: string | undefined): Decoder | undefined => (id ? registry.get(id) : undefined);
export const decoders = (): Decoder[] => [...registry.values()];
