/** Small formatting helpers shared by the Part III figures. */
const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
/** 10 raised to an integer power, with Unicode superscripts: 10⁻⁶. */
export const pow10Label = (v: number): string => {
  const k = Math.round(Math.log10(v));
  if (k === 0) return '1';
  return '10' + String(k).split('').map((c) => SUP[c] ?? c).join('');
};
