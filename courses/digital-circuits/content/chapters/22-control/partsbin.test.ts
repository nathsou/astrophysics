import { describe, expect, test } from 'vitest';
import { getPart } from '$lib/partsbin/parts';
import { DATAPATH_LINES } from '../21-datapath/hardware/control-word';

/** The parts bin lists Octet's control unit; its pins must be the ones that this chapter builds. */
describe('the control-unit part of the parts bin', () => {
  const part = getPart('control-unit')!;
  const names = (dir: 'in' | 'out') => part.pins.filter((p) => p.dir === dir).map((p) => p.name);

  test('has the inputs of the control unit: the clock, reset, IR and the four flags', () => {
    expect(names('in')).toEqual(['CLK', 'RST', ...Array.from({ length: 8 }, (_, i) => `IR${i}`), 'Z', 'C', 'N', 'V']);
  });

  test('drives the 24 datapath control lines, HALT and BUSWIN', () => {
    expect(names('out')).toEqual([...DATAPATH_LINES, 'HALT', 'BUSWIN']);
  });
});
