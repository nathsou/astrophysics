// Example Kiln programs used throughout the course (and by the test-suite).

export interface Example {
  id: string;
  title: string;
  blurb: string;
  src: string;
  expect?: string;
}

export const EXAMPLES: Example[] = [
  {
    id: 'sum',
    title: 'Sum of squares',
    blurb: 'A single loop: the smallest program with a back edge, a phi, and a live range that spans the loop.',
    src: `fn main() {
  let s = 0;
  let i = 0;
  while i < 10 {
    s = s + i * i;
    i = i + 1;
  }
  print(s);
  return 0;
}
`,
    expect: '285\n',
  },
  {
    id: 'fib',
    title: 'Recursive Fibonacci',
    blurb: 'Calls, the calling convention, callee-saved registers and a stack frame.',
    src: `fn fib(n) {
  if n < 2 {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}

fn main() {
  print(fib(20));
  return 0;
}
`,
    expect: '6765\n',
  },
  {
    id: 'gcd',
    title: "Euclid's GCD",
    blurb: 'A loop whose phis swap values — the classic "swap problem" for SSA destruction.',
    src: `fn gcd(a, b) {
  while b != 0 {
    let t = a % b;
    a = b;
    b = t;
  }
  return a;
}

fn main() {
  print(gcd(1071, 462));
  print(gcd(270, 192));
  return 0;
}
`,
    expect: '21\n6\n',
  },
  {
    id: 'max',
    title: 'Branches and select',
    blurb: 'A diamond in the CFG. At -O2 it becomes a branch-free select (if-conversion).',
    src: `fn max(a, b) {
  let m = 0;
  if a > b {
    m = a;
  } else {
    m = b;
  }
  return m;
}

fn clamp(x, lo, hi) {
  return max(lo, 0 - max(0 - x, 0 - hi));
}

fn main() {
  print(max(3, 7));
  print(clamp(15, 0, 10));
  print(clamp(-4, 0, 10));
  return 0;
}
`,
    expect: '7\n10\n0\n',
  },
  {
    id: 'sieve',
    title: 'Sieve of Eratosthenes',
    blurb: 'A global array, nested loops, loads and stores: addressing modes and relocations.',
    src: `global composite[100];

fn main() {
  let count = 0;
  for i in 2..100 {
    if composite[i] == 0 {
      count += 1;
      let j = i * i;
      while j < 100 {
        composite[j] = 1;
        j += i;
      }
    }
  }
  print(count);
  return count;
}
`,
    expect: '25\n',
  },
  {
    id: 'sort',
    title: 'Insertion sort',
    blurb: 'A local array on the stack, passed by address. Nested loops and short-circuit &&.',
    src: `fn sort(a, n) {
  for i in 1..n {
    let x = a[i];
    let j = i - 1;
    while j >= 0 && a[j] > x {
      a[j + 1] = a[j];
      j -= 1;
    }
    a[j + 1] = x;
  }
  return 0;
}

fn main() {
  let v[8];
  let seed = 7;
  for k in 0..8 {
    seed = (seed * 1103515245 + 12345) % 1000;
    v[k] = seed;
  }
  sort(v, 8);
  for k in 0..8 {
    print(v[k]);
  }
  return 0;
}
`,
  },
  {
    id: 'pressure',
    title: 'Register pressure',
    blurb: 'Many values live at once. Shrink the register file and watch the allocator spill.',
    src: `fn mix(a, b, c, d) {
  let e = a * b;
  let f = c * d;
  let g = a + c;
  let h = b + d;
  let i = e ^ f;
  let j = g * h;
  let k = e + f + g + h;
  let l = i - j;
  return (e + f) * (g - h) + i * j + k * l;
}

fn main() {
  print(mix(3, 5, 7, 11));
  return 0;
}
`,
  },
  {
    id: 'collatz',
    title: 'Collatz steps',
    blurb: 'Division, remainders and data-dependent control flow; a nice target for scheduling.',
    src: `fn steps(n) {
  let c = 0;
  while n != 1 {
    if n % 2 == 0 {
      n = n / 2;
    } else {
      n = 3 * n + 1;
    }
    c += 1;
  }
  return c;
}

fn main() {
  let best = 0;
  let arg = 0;
  for n in 1..300 {
    let s = steps(n);
    if s > best {
      best = s;
      arg = n;
    }
  }
  print(arg);
  print(best);
  return 0;
}
`,
    expect: '231\n127\n',
  },
  {
    id: 'args',
    title: 'Many arguments',
    blurb: 'More arguments than argument registers: the rest go on the stack.',
    src: `fn weighted(a, b, c, d, e, f, g, h, i, j) {
  return a + 2*b + 3*c + 4*d + 5*e + 6*f + 7*g + 8*h + 9*i + 10*j;
}

fn main() {
  print(weighted(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
  return 0;
}
`,
    expect: '385\n',
  },
  {
    id: 'bits',
    title: 'Bit tricks',
    blurb: 'Large constants, shifts and bitwise operations: constant materialisation and immediates.',
    src: `fn popcount(x) {
  let c = 0;
  while x != 0 {
    x = x & (x - 1);
    c += 1;
  }
  return c;
}

fn main() {
  let h = 0x9E3779B97F4A7C15;
  let v = 12345678;
  for i in 0..4 {
    v = (v ^ (v >> 7)) * h;
  }
  print(popcount(v));
  print(v & 0xFFFF);
  print(1 << 40);
  return 0;
}
`,
  },
  {
    id: 'rotate',
    title: 'Rotating values',
    blurb: 'Loop-carried values that permute each iteration: the phis form a cycle, so SSA destruction needs a temporary.',
    src: `fn rotate(n) {
  let x = 1;
  let y = 2;
  let z = 3;
  while n > 0 {
    let t = x;
    x = y;
    y = z;
    z = t;
    n -= 1;
  }
  return x * 100 + y * 10 + z;
}

fn main() {
  print(rotate(4));
  print(rotate(5));
  return 0;
}
`,
    expect: '231\n312\n',
  },
  {
    id: 'hello',
    title: 'Hello, putchar',
    blurb: 'Character output through the runtime library, one system call at a time.',
    src: `fn puts(s0, s1, s2, s3, s4) {
  putchar(s0); putchar(s1); putchar(s2); putchar(s3); putchar(s4);
  return 0;
}

fn main() {
  puts('h', 'e', 'l', 'l', 'o');
  putchar('\\n');
  return 0;
}
`,
    expect: 'hello\n',
  },
];

export const exampleById = (id: string) => EXAMPLES.find((e) => e.id === id)!;
