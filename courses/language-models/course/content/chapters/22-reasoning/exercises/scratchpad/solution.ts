/**
 * The scratchpad for a + b (both below 10⁶): each column from the right as `x+y+carry=sum`, joined by commas,
 * then `>` and the answer. For example 348105 + 920377 gives
 * 5+7+0=12,0+7+1=8,1+3+0=4,8+0+0=8,4+2+0=6,3+9+0=12>1268482
 */
export function scratchpad(a: number, b: number): string {
  const da = String(a).padStart(6, '0').split('').reverse();
  const db = String(b).padStart(6, '0').split('').reverse();
  const steps: string[] = [];
  let carry = 0;
  for (let i = 0; i < 6; i++) {
    const s = Number(da[i]) + Number(db[i]) + carry;
    steps.push(`${da[i]}+${db[i]}+${carry}=${s}`);
    carry = Math.floor(s / 10);
  }
  return `${steps.join(',')}>${a + b}`;
}
