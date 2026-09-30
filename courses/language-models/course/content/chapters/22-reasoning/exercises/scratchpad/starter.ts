/**
 * The scratchpad for a + b (both below 10⁶): each column from the right as `x+y+carry=sum`, joined by commas,
 * then `>` and the answer. For example 348105 + 920377 gives
 * 5+7+0=12,0+7+1=8,1+3+0=4,8+0+0=8,4+2+0=6,3+9+0=12>1268482
 */
export function scratchpad(a: number, b: number): string {
  // TODO
  return `>${a + b}`;
}
