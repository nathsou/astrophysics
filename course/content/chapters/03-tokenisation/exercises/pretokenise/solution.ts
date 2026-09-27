export const PATTERN = String.raw`'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+`;

export function pretokenise(text: string): string[] {
  return text.match(new RegExp(PATTERN, 'gu')) ?? [];
}
