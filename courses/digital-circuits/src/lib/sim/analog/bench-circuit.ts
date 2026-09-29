import { circuit } from './test-helpers';

/** The 50-node mixed circuit of the performance benchmark (and of the profiling tests). */
export function mixed50() {
  const c = circuit();
  c.add('VCC', 'rail', { v: 'vcc' }, { voltage: 5 });
  c.add('G', 'siggen', { '-': 'gnd', '+': 'in' }, { waveform: 'square', frequency: 1000, rise: 1e-6 });
  // A 20-stage RC ladder.
  for (let i = 1; i <= 20; i++) {
    c.add(`R${i}`, 'resistor', { '1': i === 1 ? 'in' : `n${i - 1}`, '2': `n${i}` }, { resistance: 1000 + 100 * i });
    c.add(`C${i}`, 'capacitor', { '1': `n${i}`, '2': 'gnd' }, { capacitance: 1e-8 * (1 + (i % 3)) });
  }
  // Diode clamp and an LED.
  c.add('D1', 'diode', { A: 'n5', K: 'gnd' });
  c.add('RL1', 'resistor', { '1': 'n10', '2': 'l1' }, { resistance: 220 });
  c.add('LED1', 'led', { A: 'l1', K: 'gnd' }, { color: 'green' });
  // An NPN switch lighting an LED.
  c.add('RB1', 'resistor', { '1': 'n3', '2': 'b1' }, { resistance: 10000 });
  c.add('Q1', 'npn', { B: 'b1', C: 'c1', E: 'gnd' });
  c.add('RC1', 'resistor', { '1': 'vcc', '2': 'c1l' }, { resistance: 330 });
  c.add('LED2', 'led', { A: 'c1l', K: 'c1' }, { color: 'red' });
  // Four CMOS inverters in a chain.
  for (let i = 1; i <= 4; i++) {
    const inp = i === 1 ? 'n2' : `inv${i - 1}`;
    c.add(`MP${i}`, 'pmos', { G: inp, S: 'vcc', D: `inv${i}` });
    c.add(`MN${i}`, 'nmos', { G: inp, D: `inv${i}`, S: 'gnd' });
  }
  // Behavioural NAND chain.
  for (let i = 1; i <= 5; i++) c.add(`U${i}`, 'nand', { A: i === 1 ? 'n4' : `g${i - 1}`, B: 'n1', Y: `g${i}` });
  // Comparator against a potentiometer.
  c.add('P', 'potentiometer', { A: 'gnd', B: 'vcc', W: 'ref' });
  c.add('K1', 'comparator', { '+': 'n6', '-': 'ref', Y: 'cmp' });
  c.add('RK', 'resistor', { '1': 'cmp', '2': 'gnd' }, { resistance: 10000 });
  // A lamp on a switch.
  c.add('SW', 'switch', { '1': 'vcc', '2': 'lamp' }, { closed: true });
  c.add('LMP', 'lamp', { '1': 'lamp', '2': 'gnd' }, { ratedVoltage: 5, ratedPower: 0.5 });
  // A relay driven by a transistor, with its flyback diode.
  c.add('RB2', 'resistor', { '1': 'g5', '2': 'b2' }, { resistance: 4700 });
  c.add('Q2', 'npn', { B: 'b2', C: 'coil', E: 'gnd' });
  c.add('K', 'relay', { A: 'vcc', B: 'coil', NO: 'kno', COM: 'vcc' });
  c.add('DK', 'diode', { A: 'coil', K: 'vcc' });
  c.add('RNO', 'resistor', { '1': 'kno', '2': 'gnd' });
  // A 3 × 3 resistor mesh fed by a battery.
  c.add('B', 'battery', { '-': 'gnd', '+': 'm0_0' }, { voltage: 9 });
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      if (x < 2) c.add(`MX${x}${y}`, 'resistor', { '1': `m${x}_${y}`, '2': `m${x + 1}_${y}` }, { resistance: 470 });
      if (y < 2) c.add(`MY${x}${y}`, 'resistor', { '1': `m${x}_${y}`, '2': `m${x}_${y + 1}` }, { resistance: 680 });
    }
  }
  c.add('RM', 'resistor', { '1': 'm2_2', '2': 'gnd' }, { resistance: 1000 });
  return c.build();
}
