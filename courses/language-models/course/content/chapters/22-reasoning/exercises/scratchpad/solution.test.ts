import { expect, test } from '@lm/test';
import { scratchpad } from './solution.ts';

test('the worked example', () => {
  expect(scratchpad(348105, 920377)).toBe('5+7+0=12,0+7+1=8,1+3+0=4,8+0+0=8,4+2+0=6,3+9+0=12>1268482');
});

test('short numbers are padded with zeros', () => {
  expect(scratchpad(7, 5)).toBe('7+5+0=12,0+0+1=1,0+0+0=0,0+0+0=0,0+0+0=0,0+0+0=0>12');
});

test('a carry that ripples through every column', () => {
  expect(scratchpad(999999, 1)).toBe('9+1+0=10,9+0+1=10,9+0+1=10,9+0+1=10,9+0+1=10,9+0+1=10>1000000');
});
