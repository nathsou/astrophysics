/**
 * Small text helpers for the feynman components.
 */
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Turn the plain-text particle symbols of the diagram library ("ν_e", "ν̄_μ", "K_S") into HTML with real subscripts.
 * The input is escaped first, so it can be any generated sentence.
 */
export function withSubscripts(text: string): string {
  return esc(text).replace(/([A-Za-zα-ωΑ-Ω̄])_([A-Za-zα-ω]{1,2})(?![A-Za-zα-ω])/g, '$1<sub>$2</sub>');
}
