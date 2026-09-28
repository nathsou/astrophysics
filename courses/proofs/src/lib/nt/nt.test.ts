import { describe, expect, test } from 'vitest';
import { egcd, factor, isPrime, jacobi, modPow, totient, continuedFraction, convergents, twoSquares, divisors, primesUpTo } from './index';

describe('number theory', () => {
  test('Bézout', () => {
    const [g, x, y] = egcd(240n, 46n);
    expect(g).toBe(2n);
    expect(240n * x + 46n * y).toBe(2n);
  });
  test('primality and factorisation', () => {
    expect(isPrime(2n ** 61n - 1n)).toBe(true);
    expect(isPrime(561n)).toBe(false);
    expect([...factor(30031n)]).toEqual([[59n, 1], [509n, 1]]);
    expect([...factor(2n ** 32n + 1n)]).toEqual([[641n, 1], [6700417n, 1]]);
    expect(totient(36n)).toBe(12n);
    expect(divisors(12n)).toEqual([1n, 2n, 3n, 4n, 6n, 12n]);
    expect(primesUpTo(30)).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
  });
  test('Fermat and Carmichael', () => {
    expect(modPow(2n, 560n, 561n)).toBe(1n);
    expect(modPow(3n, 12n, 13n)).toBe(1n);
  });
  test('Legendre symbols', () => {
    expect(jacobi(2n, 7n)).toBe(1);
    expect(jacobi(3n, 7n)).toBe(-1);
    expect(jacobi(5n, 11n)).toBe(1);
  });
  test('continued fractions', () => {
    expect(continuedFraction(355n, 113n)).toEqual([3n, 7n, 16n]);
    expect(convergents([3, 7, 15, 1]).map(([p, q]) => `${p}/${q}`)).toEqual(['3/1', '22/7', '333/106', '355/113']);
  });
  test('two squares', () => {
    expect(twoSquares(13n)).toEqual([2n, 3n]);
    expect(twoSquares(7n)).toBeNull();
  });
});

describe('smallest prime factor', () => {
  test('Euclid numbers', async () => {
    const { smallestPrimeFactor } = await import('./index');
    expect(smallestPrimeFactor(30031n)).toBe(59n);
    expect(smallestPrimeFactor(2n * 3n * 7n * 43n + 1n)).toBe(13n);
    expect(smallestPrimeFactor(38709183810571n)).toBe(38709183810571n);
  });
});
