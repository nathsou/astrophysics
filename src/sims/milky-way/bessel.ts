// Modified Bessel functions I0, I1, K0, K1 via the classic Abramowitz & Stegun 9.8
// polynomial/rational approximations (double precision, max relative error ~1e-7).
// Needed for the Freeman (1970) exponential-disk rotation-curve formula, which has no
// elementary closed form. Valid for x > 0.

export function besselI0(x: number): number {
  const ax = Math.abs(x);
  if (ax < 3.75) {
    const t = (x / 3.75) ** 2;
    return 1 + t * (3.5156229 + t * (3.0899424 + t * (1.2067492 + t * (0.2659732 + t * (0.0360768 + t * 0.0045813)))));
  }
  const t = 3.75 / ax;
  const poly =
    0.39894228 +
    t * (0.01328592 + t * (0.00225319 + t * (-0.00157565 + t * (0.00916281 + t * (-0.02057706 + t * (0.02635537 + t * (-0.01647633 + t * 0.00392377)))))));
  return (Math.exp(ax) / Math.sqrt(ax)) * poly;
}

export function besselI1(x: number): number {
  const ax = Math.abs(x);
  let result: number;
  if (ax < 3.75) {
    const t = (x / 3.75) ** 2;
    result = ax * (0.5 + t * (0.87890594 + t * (0.51498869 + t * (0.15084934 + t * (0.02658733 + t * (0.00301532 + t * 0.00032411))))));
  } else {
    const t = 3.75 / ax;
    const poly =
      0.39894228 +
      t * (-0.03988024 + t * (-0.00362018 + t * (0.00163801 + t * (-0.01031555 + t * (0.02282967 + t * (-0.02895312 + t * (0.01787654 + t * -0.00420059)))))));
    result = (Math.exp(ax) / Math.sqrt(ax)) * poly;
  }
  return x < 0 ? -result : result;
}

export function besselK0(x: number): number {
  if (x <= 2) {
    const t = (x / 2) ** 2;
    const poly = -0.57721566 + t * (0.42278420 + t * (0.23069756 + t * (0.03488590 + t * (0.00262698 + t * (0.00010750 + t * 0.0000074)))));
    return -Math.log(x / 2) * besselI0(x) + poly;
  }
  const t = 2 / x;
  const poly = 1.25331414 + t * (-0.07832358 + t * (0.02189568 + t * (-0.01062446 + t * (0.00587872 + t * (-0.0025154 + t * 0.00053208)))));
  return (Math.exp(-x) / Math.sqrt(x)) * poly;
}

export function besselK1(x: number): number {
  if (x <= 2) {
    const t = (x / 2) ** 2;
    const poly = 1 + t * (0.15443144 + t * (-0.67278579 + t * (-0.18156897 + t * (-0.01919402 + t * (-0.00110404 + t * -0.00004686)))));
    return Math.log(x / 2) * besselI1(x) + poly / x;
  }
  const t = 2 / x;
  const poly = 1.25331414 + t * (0.23498619 + t * (-0.0365562 + t * (0.01504268 + t * (-0.00780353 + t * (0.00325614 + t * -0.00068245)))));
  return (Math.exp(-x) / Math.sqrt(x)) * poly;
}
