import { expect, test } from '@lm/test';
import { isPrefix, type Part } from './solution.ts';

const P: Part[] = [{ lit: '{"name": "' }, { cls: 'letters', min: 1, max: 10 }, { lit: '", "age": ' }, { cls: 'digits', min: 1, max: 2 }, { lit: '}' }];

test('prefixes of a valid match', () => {
  expect(isPrefix(P, '')).toBe(true);
  expect(isPrefix(P, '{"na')).toBe(true);
  expect(isPrefix(P, '{"name": "Lily')).toBe(true);
  expect(isPrefix(P, '{"name": "Lily", "age": 4}')).toBe(true);
});

test('violations', () => {
  expect(isPrefix(P, '{"nam3')).toBe(false);
  expect(isPrefix(P, '{"name": ""')).toBe(false); // the name needs at least one letter
  expect(isPrefix(P, '{"name": "Lily", "age": 123')).toBe(false); // at most two digits
  expect(isPrefix(P, '{"name": "Lily", "age": 4} and')).toBe(false);
});
