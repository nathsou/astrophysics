import { expect, test } from '@lm/test';
import { toolStep } from './solution.ts';

test('a completed call is evaluated', () => {
  expect(toolStep('[12+345=')).toBe('357]');
  expect(toolStep('[12+345=357][357+6789=')).toBe('7146]');
});

test('no call, an unfinished call, or a closed one: the model continues', () => {
  expect(toolStep('12+345=')).toBe(null);
  expect(toolStep('[12+34')).toBe(null);
  expect(toolStep('[12+345=357]')).toBe(null);
});

test('a malformed call is closed without a result', () => {
  expect(toolStep('[12++=')).toBe(']');
});
