import { describe, expect, it } from 'vitest';
import { decodeState, encodeState } from './state-hash';

describe('state hash', () => {
  it('round-trips an example', () => {
    const h = encodeState({ device: 'gal22v10', example: 'traffic-light', views: ['source', 'chip'] });
    expect(h).toBe('#d=gal22v10&e=traffic-light&v=source,chip');
    expect(decodeState(h)).toEqual({ device: 'gal22v10', example: 'traffic-light', views: ['source', 'chip'] });
  });
  it('round-trips a custom source with unicode', () => {
    const source = '# @title Café “test”\nY = A & !B | C\n';
    const h = encodeState({ device: 'cpld32', source });
    expect(h.split('s=')[1]).not.toMatch(/[+/=]/);
    expect(decodeState(h)?.source).toBe(source);
  });
  it('ignores garbage', () => {
    expect(decodeState('')).toBeNull();
    expect(decodeState('#x=1')).toBeNull();
    expect(decodeState('#d=pla&s=%%%')?.source).toBeUndefined();
  });
});
