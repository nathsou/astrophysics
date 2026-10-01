import { expect, test } from 'vitest';
import * as u from '../units/index.ts';
import * as c from './constants.ts';

test('local constants agree with hep/units', () => {
  expect(c.HBARC_GEV_FM).toBe(u.HBARC_GEV_FM);
  expect(c.HBARC_MEV_FM).toBe(u.HBARC_MEV_FM);
  expect(c.HBAR_GEV_S).toBe(u.HBAR_GEV_S);
  expect(c.G_F).toBe(u.G_F);
});
