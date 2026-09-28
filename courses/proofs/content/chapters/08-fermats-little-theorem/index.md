---
number: 8
title: Fermat’s little theorem
summary: Fermat claimed it in a letter and never showed anyone the proof. We give three — by counting necklaces, by the binomial theorem and by shuffling remainders — then use the theorem to test primes, meet the numbers that fool the test, and build a working (if tiny) RSA cipher.
duration: About 2½ hours
prerequisites: [unique-factorisation, induction]
theorems: [Fermat’s little theorem, Euler’s theorem, Correctness of RSA]
techniques: [congruences, counting orbits, binomial coefficients, bijection]
---

On 18 October 1640 Pierre de Fermat wrote to his friend Bernard Frénicle de Bessy about a pattern he had found in powers. Take any prime $p$ and any whole number $a$. Then $a^p - a$ is divisible by $p$. For example, $2^7 - 2 = 126 = 7 \times 18$, and $3^5 - 3 = 240 = 5 \times 48$. He added that he would send the proof, “if I did not fear it being too long”.:cite[weil-nt]

He never sent it. The first proof we know of was written by Leibniz around 1683 and left unpublished; the first published proof is Euler's, from 1736. Since then the theorem has become one of the most-proved results in mathematics — and, three centuries after Fermat, the engine of the encryption that protects the internet.

## Congruences

Gauss introduced a notation in 1801 that makes statements like Fermat's easy to write and to manipulate.

:::definition
Let $n \ge 1$. Integers $a$ and $b$ are **congruent modulo $n$**, written $a \equiv b \pmod n$, if $n$ divides $a - b$ — equivalently, if $a$ and $b$ leave the same remainder on division by $n$.
:::

A clock works modulo $12$: nine hours after $8$ o'clock it is $5$ o'clock, because $8 + 9 = 17 \equiv 5 \pmod{12}$. Congruences behave like equations for addition, subtraction and multiplication: if $a \equiv b$ and $c \equiv d \pmod n$, then $a + c \equiv b + d$, and $ac \equiv bd$, because $ac - bd = a(c - d) + d(a - b)$. You can therefore replace any number by its remainder at any point in a calculation. **Division** is the exception: $2 \cdot 3 \equiv 2 \cdot 0 \pmod 6$, but $3 \not\equiv 0$. We can cancel a factor $c$ only when $\gcd(c, n) = 1$ — by the generalised Euclid lemma of Chapter 6.

:::theorem{name="Fermat’s little theorem" who="Pierre de Fermat" year=1640}
If $p$ is a prime, then for every integer $a$,
$$a^p \equiv a \pmod p .$$
Equivalently, if $p \nmid a$, then $a^{p-1} \equiv 1 \pmod p$.
:::

The two forms are equivalent: $a^p - a = a(a^{p-1} - 1)$, and when $p \nmid a$, Euclid's lemma says $p$ divides the product exactly when it divides $a^{p-1} - 1$. (When $p \mid a$ the first form is trivially true.)

```blanks
title: Warming up
prompt: Compute these using the theorem, without large powers.
text: |
  1. $2^{10} \bmod 11 = $ [[a]]  (since $11$ is prime and $11 \nmid 2$).

  2. $3^{100} \bmod 7$: since $3^6 \equiv 1$ and $100 = 16 \times 6 + 4$, we get $3^{100} \equiv 3^4 = 81 \equiv$ [[b]] $\pmod 7$.

  3. $5^{2025} \bmod 13$: $2025 = 168 \times 12 + $ [[c]], so $5^{2025} \equiv 5^{9} \pmod{13}$, and $5^2 \equiv -1$, so $5^9 = 5 \cdot (5^2)^4 \equiv$ [[d]] $\pmod{13}$.
blanks:
  a: { answer: '1' }
  b: { answer: '4' }
  c: { answer: '9' }
  d: { answer: '5' }
```

## First proof: counting necklaces

Here is a proof that needs no algebra at all, found by Solomon Golomb in 1956.:cite[golomb1956] It proves $p \mid a^p - a$ for positive $a$ by counting something in two ways.

Make necklaces with $p$ beads, each bead one of $a$ colours. A *string* of beads (with a marked starting point) can be chosen in $a^p$ ways. A *necklace* is a string up to rotation: two strings are the same necklace if one can be turned into the other. How many strings make up each necklace?

::necklaces

Play with a prime number of beads, then with $4$ or $6$. When $p$ is prime, every necklace is either a single colour all round — there are $a$ of those — or has exactly $p$ different rotations. The $a^p - a$ strings that are not single-coloured therefore fall into groups of exactly $p$, so $p$ divides $a^p - a$.

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Rotating a string of prime length $p$ gives $p$ different strings unless all the beads are the same colour. So the multicoloured strings come in packs of $p$.
:::
:::level[Proof]
Let $s$ be a string of length $p$ and let $R$ rotate a string by one place, so $R^p(s) = s$. Let $k \ge 1$ be the smallest number with $R^k(s) = s$. Dividing, $p = qk + r$ with $0 \le r < k$; then $s = R^p(s) = R^r(R^{qk}(s)) = R^r(s)$, so $r = 0$ by minimality, and $k$ divides $p$. Since $p$ is prime, $k = 1$ or $k = p$.

If $k = 1$, then $R(s) = s$, so every bead equals the next: $s$ is single-coloured. Otherwise $k = p$, and $s, R(s), \ldots, R^{p-1}(s)$ are $p$ different strings, all giving the same necklace.

So the $a^p - a$ multicoloured strings are partitioned into necklace classes of exactly $p$ strings each, and $p$ divides $a^p - a$. The case of $a \le 0$ follows, since $(-a)^p - (-a) = -(a^p - a)$ for odd $p$, and $a^2 - a$ is always even.
:::
::::

The heart of the proof — the size of an orbit divides the size of the group acting — is a special case of a theorem of Lagrange from group theory, and counting orbits in this way is a technique you will meet again.

## Second proof: the binomial theorem

Euler's own proof, the first to be published, is an induction on $a$. It rests on a pleasant fact about Pascal's triangle.

:::lemma
If $p$ is prime and $0 < k < p$, then $p$ divides $\binom pk$.
:::

:::proof
$\binom pk = \dfrac{p!}{k!\,(p-k)!}$, so $p! = \binom pk \cdot k! \cdot (p-k)!$. The prime $p$ divides the left side. It does not divide $k!$ or $(p - k)!$, since these are products of numbers smaller than $p$ (Euclid's lemma). So by Euclid's lemma again, $p$ divides $\binom pk$.
:::

Look at row $7$ of Pascal's triangle: $1, 7, 21, 35, 35, 21, 7, 1$. Every entry except the ends is a multiple of $7$. Row $6$ ($1, 6, 15, 20, 15, 6, 1$) shows why primality matters.

By the binomial theorem, then, $(a + 1)^p = a^p + \binom p1 a^{p-1} + \cdots + \binom p{p-1} a + 1 \equiv a^p + 1 \pmod p$ — the so-called *freshman's dream*, which is false over the integers but true modulo a prime.

:::proof[Proof of Fermat's little theorem by induction]
For $a = 0$, $0^p \equiv 0$. If $a^p \equiv a$, then $(a+1)^p \equiv a^p + 1 \equiv a + 1 \pmod p$. So the theorem holds for all $a \ge 0$, and negative $a$ follow as before.
:::

## Third proof: shuffling remainders

The third proof, published by James Ivory in 1806, is the one that generalises. Look at the multiplication table modulo a prime.

::mod-table

Each row of the table modulo $7$ — the multiples $a, 2a, \ldots, 6a$ reduced modulo $7$ — is a rearrangement of $1, 2, \ldots, 6$. That is the whole proof.

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Multiplying the non-zero remainders by $a$ just shuffles them. So the product of all of them is unchanged by multiplying each by $a$ — and that multiplies the product by $a^{p-1}$.
:::
:::level[Proof]
Let $p \nmid a$. The numbers $a, 2a, \ldots, (p-1)a$ are not divisible by $p$ (Euclid's lemma), and no two are congruent: if $ia \equiv ja$ then $p \mid (i - j)a$, so $p \mid i - j$, and since $|i - j| < p$, $i = j$. So their remainders are $p - 1$ different non-zero remainders — that is, $1, 2, \ldots, p - 1$ in some order. Multiplying them all together,
$$a \cdot 2a \cdots (p-1)a \equiv 1 \cdot 2 \cdots (p-1) \pmod p, \quad\text{that is,}\quad a^{p-1}\,(p-1)! \equiv (p-1)! \pmod p .$$
Since $p \nmid (p-1)!$, we may cancel it, leaving $a^{p-1} \equiv 1 \pmod p$.
:::
::::

Try a composite $n$ in the table. Rows with $\gcd(a, n) = 1$ are still rearrangements — but only of the remainders *coprime to $n$*. Euler saw that the same argument then proves more.

:::theorem{name="Euler’s theorem" who="Leonhard Euler" year=1763}
If $\gcd(a, n) = 1$, then $a^{\varphi(n)} \equiv 1 \pmod n$, where $\varphi(n)$ is the number of integers in $1, \ldots, n$ that are coprime to $n$.
:::

For a prime, $\varphi(p) = p - 1$ and this is Fermat's theorem. For $n = pq$ with distinct primes, $\varphi(n) = (p-1)(q-1)$ — which we will need in a moment.

## Testing primes, and the numbers that lie

Fermat's theorem gives a fast way to show that a number is **not** prime without finding a factor. If $2^{n-1} \not\equiv 1 \pmod n$, then $n$ cannot be prime. Powers modulo $n$ are quick to compute by repeated squaring, even for numbers with hundreds of digits.

It is tempting to believe the converse: that if $2^{n-1} \equiv 1 \pmod n$, then $n$ is prime. This “Chinese hypothesis” (it has nothing to do with China) survived until 1820, when Pierre Sarrus noticed that $2^{340} \equiv 1 \pmod{341}$, though $341 = 11 \times 31$.

::fermat-test

Using more bases helps: $341$ is caught by base $3$. But some composite numbers pass the test for *every* base coprime to them. The smallest is $561 = 3 \cdot 11 \cdot 17$. Such numbers are called **Carmichael numbers**, after Robert Carmichael, who found the first examples in 1910; Alwin Korselt had characterised them in 1899 without finding one. In 1994 William Alford, Andrew Granville and Carl Pomerance proved that there are infinitely many.:cite[agp1994] Modern primality tests, like the Miller–Rabin test used by this very course's number-theory library, add a small twist that no composite number can survive for most bases.

```bug
title: The converse
prompt: 'Here is a “proof” that $n$ is prime whenever $2^{n-1} \equiv 1 \pmod n$. Which step fails?'
lines:
  - Suppose $2^{n-1} \equiv 1 \pmod n$.
  - Fermat's little theorem says that if $n$ is prime then $2^{n-1} \equiv 1 \pmod n$.
  - Our $n$ satisfies the conclusion of Fermat's theorem.
  - Therefore $n$ satisfies its hypothesis: $n$ is prime.
wrong: 3
why: This is **affirming the consequent** (Chapter 1): from $P \to Q$ and $Q$ it does not follow that $P$. The counterexample $n = 341$ shows the conclusion can be false.
```

## A cipher from a theorem

In 1977 Ron Rivest, Adi Shamir and Leonard Adleman at MIT published a way to encrypt messages in which the key for *encrypting* can be made public, while only its owner can *decrypt*.:cite[rsa1977] It rests on Euler's theorem and on one practical fact: multiplying two large primes is easy, but factoring their product seems to be impossibly hard.

The owner chooses primes $p, q$, publishes $n = pq$ and an exponent $e$ coprime to $\varphi(n) = (p-1)(q-1)$, and keeps secret the number $d$ with $ed \equiv 1 \pmod{\varphi(n)}$, found by the extended Euclidean algorithm of Chapter 6. A message $m$ (a number less than $n$) is encrypted as $c = m^e \bmod n$ and decrypted as $c^d \bmod n$.

::toy-rsa

:::theorem{name="RSA decrypts correctly"}
Let $n = pq$ with $p \ne q$ primes, and $ed \equiv 1 \pmod{(p-1)(q-1)}$. Then $m^{ed} \equiv m \pmod n$ for every integer $m$.
:::

::::zoom{levels="Idea, Proof"}
:::level[Idea]
Write $ed = 1 + k(p-1)(q-1)$. Modulo $p$, Fermat's theorem kills the $(p-1)$th powers, so $m^{ed} \equiv m$. The same holds modulo $q$, and a number divisible by both $p$ and $q$ is divisible by $pq$.
:::
:::level[Proof]
Write $ed = 1 + k(p-1)(q-1)$ with $k \ge 0$. We show $p \mid m^{ed} - m$. If $p \mid m$, both terms are divisible by $p$. Otherwise, by Fermat's theorem $m^{p-1} \equiv 1 \pmod p$, so
$$m^{ed} = m \cdot \left(m^{p-1}\right)^{k(q-1)} \equiv m \cdot 1 = m \pmod p .$$
In the same way $q \mid m^{ed} - m$. Since $p$ and $q$ are distinct primes, $pq$ divides $m^{ed} - m$ (by Euclid's lemma, as $q \mid m^{ed} - m = p \cdot t$ and $q \nmid p$ gives $q \mid t$).
:::
::::

Real RSA uses primes with hundreds of digits and never encrypts letters one at a time (identical letters would give identical ciphertexts, as you can see above). But the mathematics is exactly this.

:::history{year=1977 title="Public keys, secret history" people="Whitfield Diffie, Martin Hellman, Ron Rivest, Adi Shamir, Leonard Adleman, Clifford Cocks"}
In 1976 Whitfield Diffie and Martin Hellman proposed the idea of public-key cryptography without a practical way to do it; RSA supplied one the following year. In 1997 the British intelligence agency GCHQ revealed that one of its mathematicians, Clifford Cocks, had invented essentially the same system in 1973 — in about half an hour, after hearing the problem — but it had remained classified. Fermat, who wrote to Frénicle for pleasure, could not have imagined that his theorem would one day protect every online payment.
:::

:::bio{name="Solomon Golomb" born=1932 died=2016 place="Baltimore, Pasadena and Los Angeles"}
A mathematician and engineer who worked at NASA's Jet Propulsion Laboratory and then the University of Southern California. His theory of *shift-register sequences* — pseudo-random sequences generated by simple feedback circuits — underlies deep-space radar and the spread-spectrum signals of mobile phones and GPS; it has been called the most-used piece of mathematics in history. He also invented polyominoes (Chapter 5), which inspired the game *Tetris*, and found the necklace proof of this chapter while still a student. He loved puzzles and wrote a puzzle column for decades.
:::

## Exercises

```prove
title: Why rows are shuffled
prompt: 'Let $p$ be prime and $p \nmid a$. Prove that the numbers $a, 2a, 3a, \ldots, (p-1)a$ leave different remainders on division by $p$, and that none of them leaves remainder $0$.'
hints:
  - For the first part, suppose $ia \equiv ja \pmod p$ with $1 \le i < j \le p-1$. What divides what?
  - Use Euclid's lemma.
rubric:
  - You showed no $ka$ is divisible by $p$ (Euclid's lemma, as $p \nmid k$ and $p \nmid a$).
  - 'You supposed $ia \equiv ja$ and deduced $p \mid (j - i)a$, hence $p \mid j - i$.'
  - 'You used $0 < j - i < p$ to get a contradiction (or $i = j$).'
solution: |
  If $p \mid ka$ with $1 \le k \le p - 1$, then by Euclid's lemma $p \mid k$ or $p \mid a$; neither holds, since $0 < k < p$. So no remainder is $0$. Now suppose $ia \equiv ja \pmod p$ with $1 \le i < j \le p - 1$. Then $p \mid (j - i)a$, and since $p \nmid a$, Euclid's lemma gives $p \mid j - i$. But $0 < j - i < p$, a contradiction. So the remainders are all different.
```

```quiz
q: 'Your computer finds that $a^{n-1} \equiv 1 \pmod n$ for $50$ randomly chosen bases $a$ coprime to $n$. What can you conclude?'
options:
  - text: $n$ is prime.
    why: If $n$ is a Carmichael number, every coprime base passes.
  - text: $n$ is prime or a Carmichael number (or you were very unlucky).
    correct: true
    why: For a composite non-Carmichael $n$, at least half of the coprime bases are witnesses, so fifty passes would be astonishing. Carmichael numbers are exactly the ones this test can't catch — which is why real tests use Miller–Rabin.
  - text: Nothing at all.
    why: You have learned a lot — just not a proof.
```

:::challenge
**Wilson's theorem.** Prove that if $p$ is prime then $(p - 1)! \equiv -1 \pmod p$. (*Hint:* pair each number $1 \le a \le p - 1$ with its inverse modulo $p$ — the $b$ with $ab \equiv 1$. Which numbers are their own inverses?) Then prove the converse: if $n > 1$ and $(n-1)! \equiv -1 \pmod n$, then $n$ is prime. This gives a primality test that is correct — and completely useless in practice. Why?
:::

## Further reading

- Solomon Golomb, “Combinatorial proof of Fermat's ‘little’ theorem” — a one-page paper.:cite[golomb1956]
- W. R. Alford, Andrew Granville and Carl Pomerance, “There are infinitely many Carmichael numbers”.:cite[agp1994]
- Simon Singh, *The Code Book* — the history of cryptography, including the secret history of public keys.:cite[singh-code]
