---
number: E
title: Information theory
summary: Entropy, conditional entropy, mutual information, cross-entropy and KL divergence — the quantities behind every loss function in this course — with the source coding theorem that ties prediction to compression.
duration: About 1½ hours
---

Language modelling is applied information theory. A model’s loss is a cross-entropy. Its quality is quoted as a perplexity. Fine-tuning with human feedback is constrained by a KL divergence. And the best argument that prediction *is* understanding comes from the link between modelling and compression. This appendix collects those ideas in one place, with more rigour than the chapters, which introduce them as needed (Chapters 1, 2 and 21).

## Surprisal and entropy

Let $X$ be a discrete random variable with distribution $p$. The **surprisal** (self-information) of an outcome and the **entropy** of the distribution are

:::equation{#e-entropy caption="Surprisal of an outcome, and entropy as expected surprisal."}
$$
I(x) = -\log_2 p(x), \qquad \term{H}{H(X)} = \mathbb{E}_{x \sim p}\big[I(x)\big] = -\sum_x p(x)\log_2 p(x).
$$
:::

```terms
H:
  label: "$H(X)$ — entropy"
  what: The average surprisal of $X$ — equivalently, the average number of yes/no questions needed to identify its value with the best questioning strategy.
  why: Shannon showed it is essentially the only measure of uncertainty that is continuous, maximal for uniform distributions, and additive over independent choices.
  effect: 0 for a certain outcome; $\log_2 n$ for $n$ equally likely outcomes; somewhere in between for everything else.
```

Three properties do most of the work:

1. **Non-negativity.** $H(X) \ge 0$, with equality exactly when $X$ is certain.
2. **Maximum at uniform.** For $n$ outcomes, $H(X) \le \log_2 n$, with equality only for the uniform distribution. (Proof: Gibbs’ inequality below, with $q$ uniform.)
3. **Concavity.** Mixing distributions never decreases entropy: $H(\lambda p + (1-\lambda) p') \ge \lambda H(p) + (1-\lambda) H(p')$.

The base of the logarithm only sets the unit. Base 2 gives **bits**, base $e$ gives **nats**, and $1\ \text{nat} = 1/\ln 2 \approx 1.443$ bits. Machine-learning code works in nats because it uses the natural logarithm; papers usually report bits per character or per byte. Chapter 1’s entropy explorer lets you see both.

## Two variables: joint, conditional and mutual information

For a pair of variables with joint distribution $p(x, y)$, the **joint entropy** $H(X, Y)$ is the entropy of the pair. The **conditional entropy** is the uncertainty that remains in $Y$ once $X$ is known, averaged over $X$:

:::equation{#e-conditional caption="Conditional entropy and the chain rule."}
$$
H(Y \mid X) = \sum_x p(x)\, H(Y \mid X = x) = -\sum_{x,y} p(x, y) \log_2 p(y \mid x),
\qquad
H(X, Y) = H(X) + H(Y \mid X).
$$
:::

The chain rule says uncertainty about a pair can be resolved one variable at a time. It is the information-theoretic twin of the probability chain rule that defines language models. Applied to a sequence, $H(x_1, \ldots, x_T) = \sum_t H(x_t \mid x_{<t})$: the entropy of a text is the sum of the per-symbol conditional entropies, which is what a language model estimates.

The **mutual information** is how much knowing one variable reduces uncertainty about the other:

:::equation{#e-mi caption="Mutual information: shared uncertainty, and a divergence from independence."}
$$
I(X; Y) = H(X) - H(X \mid Y) = H(X) + H(Y) - H(X, Y) = \sum_{x,y} p(x,y) \log_2 \frac{p(x,y)}{p(x)\,p(y)}.
$$
:::

It is symmetric, non-negative, and zero exactly when $X$ and $Y$ are independent. For language, the mutual information between a symbol and its context is exactly the gap between the unigram entropy (about 4.1 bits per letter) and the conditional entropy given context (about 1 bit). Shannon’s guessing game in Chapter 1 measures it.

::joint-entropy

**Conditioning reduces entropy on average**: $H(Y \mid X) \le H(Y)$. Knowing more never hurts *on average*, though a particular observation can increase uncertainty. This is why longer contexts help language models, until estimation error takes over (Chapter 2).

## Cross-entropy and KL divergence

Now suppose data come from $p$ but we describe them with a model $q$. The **cross-entropy** is the average surprisal under the model; the **Kullback–Leibler divergence** is the excess over the best achievable:

:::equation{#e-kl caption="Cross-entropy decomposes into the entropy of the data plus the KL divergence of the model from it."}
$$
H(p, q) = -\sum_x p(x) \log q(x) \;=\; H(p) + \term{KL}{D_{\mathrm{KL}}(p \,\|\, q)},
\qquad
D_{\mathrm{KL}}(p \,\|\, q) = \sum_x p(x) \log \frac{p(x)}{q(x)}.
$$
:::

```terms
KL:
  label: "$D_{\\mathrm{KL}}(p \\,\\|\\, q)$ — KL divergence"
  what: The expected number of extra bits (or nats) paid for coding data from $p$ with a code optimised for $q$.
  why: It measures how far the model is from the truth — in the direction that matters for prediction.
  effect: Zero if and only if $q = p$. Infinite if $q$ gives zero probability to anything $p$ can produce — Chapter 2’s unsmoothed MLE.
```

:::details[Gibbs’ inequality: why D_KL ≥ 0]
Because $\log$ is concave, Jensen’s inequality gives $\mathbb{E}[\log Z] \le \log \mathbb{E}[Z]$. Take $Z = q(x)/p(x)$ with $x \sim p$:

$$
-D_{\mathrm{KL}}(p \,\|\, q) = \sum_x p(x) \log \frac{q(x)}{p(x)} \;\le\; \log \sum_x p(x) \frac{q(x)}{p(x)} = \log \sum_x q(x) \le \log 1 = 0.
$$

Equality in Jensen requires $q(x)/p(x)$ to be constant, i.e. $q = p$. With $q$ uniform over $n$ outcomes this gives $H(p) \le \log n$, the second property of entropy above.
:::

### Why cross-entropy is *the* loss

Given training samples $x_1, \ldots, x_N$, the empirical distribution $\hat p$ puts mass $1/N$ on each. Maximising the log-likelihood of a model $q_\theta$ is then the same as minimising cross-entropy against $\hat p$, which is the same as minimising the KL divergence from $\hat p$:

$$
\argmax_\theta \frac{1}{N}\sum_{i} \log q_\theta(x_i)
\;=\; \argmin_\theta H(\hat p, q_\theta)
\;=\; \argmin_\theta D_{\mathrm{KL}}(\hat p \,\|\, q_\theta),
$$

since $H(\hat p)$ does not depend on $\theta$. Every language model in this course, from Chapter 2’s counts to CourseGPT, is trained this way. The validation cross-entropy estimates $H(p, q)$ for the true distribution of text, and because $D_{\mathrm{KL}} \ge 0$ it is an upper bound on the true entropy of language.

### The direction matters

KL divergence is not a distance: $D_{\mathrm{KL}}(p\|q) \ne D_{\mathrm{KL}}(q\|p)$ in general, and the difference has practical consequences. When $q$ is too simple to match $p$, the two directions give very different compromises:

::kl-asymmetry

Forward KL $D_{\mathrm{KL}}(p\|q)$ is what maximum likelihood minimises. It punishes $q$ severely for assigning low probability anywhere $p$ has mass, which pushes models to *cover* everything — one reason pre-trained models sometimes generate oddities from the tail of the data. Reverse KL $D_{\mathrm{KL}}(q\|p)$ appears when a model is optimised against a fixed reference, as in RLHF’s penalty for drifting from the pre-trained model (Chapter 21) and in variational inference. It lets $q$ ignore parts of $p$, and so tends to be *mode-seeking*.

## Coding: why prediction is compression

A **prefix-free code** assigns each symbol a binary codeword such that no codeword is a prefix of another, so a stream of codewords can be decoded without separators. Codeword lengths $\ell(x)$ are achievable by some prefix code if and only if they satisfy the **Kraft inequality** $\sum_x 2^{-\ell(x)} \le 1$. Minimising the expected length $\sum_x p(x)\ell(x)$ subject to Kraft gives $\ell(x) = -\log_2 p(x)$, the surprisal. Rounding up to whole bits yields Shannon’s **source coding theorem** for symbol codes:

:::equation{#e-source caption="Source coding theorem: the best average codeword length is within one bit of the entropy."}
$$
H(X) \;\le\; \term{Lbar}{\bar L} \;<\; H(X) + 1.
$$
:::

```terms
Lbar:
  label: "$\\bar L$ — average code length"
  what: The expected number of bits per symbol of the best prefix-free code, $\sum_x p(x)\,\ell(x)$.
  why: Entropy is a hard floor — no lossless code beats it on average — and an optimal code gets within one bit of it.
  effect: Coding blocks of $k$ symbols at a time shrinks the overhead to under $1/k$ bits per symbol; arithmetic coding effectively takes $k$ to the whole message.
```

::huffman-code

**Arithmetic coding** removes the rounding by coding the whole message as one number. It needs the probability of each symbol *given everything before it*: exactly what a language model provides. A model with cross-entropy $H$ bits per symbol on some text can therefore compress that text to about $H$ bits per symbol, plus a couple of bits in total. Compression and prediction are the same problem. Large language models turn out to be strong general-purpose compressors, even of images and audio :cite[deletang2024], and the Hutter Prize for compressing Wikipedia has long been framed as a test of machine intelligence.

## Summary

| Quantity | Definition | In this course |
|---|---|---|
| Surprisal | $-\log p(x)$ | per-token loss; Chapter 2’s surprisal view |
| Entropy $H(p)$ | $\mathbb{E}_p[-\log p]$ | uncertainty of a distribution; Chapter 1 |
| Conditional entropy $H(Y\mid X)$ | $\mathbb{E}[-\log p(y\mid x)]$ | what a context-aware model can reach |
| Mutual information $I(X;Y)$ | $H(Y) - H(Y\mid X)$ | how much context helps |
| Cross-entropy $H(p,q)$ | $\mathbb{E}_p[-\log q]$ | the training loss of every model |
| Perplexity | $2^{H(p,q)}$ | the headline metric; Chapter 2 |
| KL divergence $D_{\mathrm{KL}}(p\|q)$ | $H(p,q) - H(p)$ | model error; RLHF penalty (Chapter 21); distillation |

## Further reading

- Thomas Cover and Joy Thomas, *Elements of Information Theory*, chapters 2 and 5 :cite[cover2006]. The standard reference.
- David MacKay, *Information Theory, Inference, and Learning Algorithms* :cite[mackay2003]. Free online, with an unusually clear treatment of arithmetic coding and its connection to modelling.
- Claude Shannon, *A Mathematical Theory of Communication* :cite[shannon1948]. Still very readable.
