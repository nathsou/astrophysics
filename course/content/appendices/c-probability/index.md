---
number: C
title: Probability
summary: The probability a language model is built on — random variables, joint and conditional distributions, the chain rule that turns text into next-token prediction, Bayes’ rule, expectation and variance, the distributions the course uses, sampling methods, the law of large numbers and the central limit theorem, and maximum-likelihood estimation.
duration: About 1½ hours
---

A language model is a probability distribution over text. It is trained by maximising the probability it gives to real text, evaluated by the same quantity, and used by sampling from it. This appendix collects the probability behind those three activities. The chapters introduce each idea when it is first needed; here they are in one place, with slightly more care. Blitzstein and Hwang’s textbook is an excellent full course :cite[blitzstein2019].

## Random variables and distributions

A **random variable** $X$ is a quantity whose value is uncertain: the next character of a text, the token a model samples, the loss on a random minibatch. A **discrete** random variable takes values in a countable set, such as a vocabulary, and is described by its **probability mass function** $p(x) = P(X = x)$. The probabilities are non-negative and sum to one. A **continuous** random variable, such as an initial weight, is described by a **probability density** $p(x)$ that integrates to one. For continuous variables, probabilities are areas under the density, $P(a \le X \le b) = \int_a^b p(x)\,dx$, and $p(x)$ itself can exceed 1.

The **cumulative distribution function** $F(x) = P(X \le x)$ works for both kinds. It rises from 0 to 1, and it is the key to sampling (below).

## Joint, marginal and conditional

With two random variables — say the previous character $X$ and the next one $Y$ — the **joint distribution** $p(x, y)$ gives the probability of each pair. Summing out one variable gives the **marginal** $p(x) = \sum_y p(x, y)$. Restricting to cases where $X = x$ and renormalising gives the **conditional** distribution:

:::equation{#c-conditional caption="Conditional probability: the joint, renormalised to the cases where X = x."}
$$
p(y \mid x) = \frac{\term{joint}{p(x, y)}}{\term{marg}{p(x)}}
$$
:::

```terms
joint:
  label: "$p(x, y)$ — the joint probability"
  what: The probability that $X = x$ *and* $Y = y$ together. For a bigram model, the fraction of adjacent character pairs that are $(x, y)$.
marg:
  label: "$p(x)$ — the marginal probability of the condition"
  what: The probability that $X = x$ at all, obtained by summing the joint over every $y$.
  why: Dividing by it renormalises, so that the conditional probabilities of all $y$ sum to one.
```

A bigram model (Chapter 2) is exactly a table of conditionals $p(y \mid x)$, estimated from counts as $\text{count}(x, y) / \text{count}(x)$. Rearranging the definition gives the **product rule**, $p(x, y) = p(x)\, p(y \mid x)$. Applied repeatedly to a whole sequence, it gives the **chain rule of probability**, the equation the whole course rests on:

:::equation{#c-chain caption="The chain rule of probability: any distribution over sequences factorises into next-token predictions."}
$$
p(x_1, x_2, \ldots, x_T) \;=\; \prod_{t=1}^{T} p(x_t \mid x_1, \ldots, x_{t-1})
$$
:::

No assumption is involved: every distribution over sequences can be written this way. A language model chooses to *parameterise* the conditionals, one next-token distribution per context, and the models of Chapters 2–11 differ only in how. An n-gram model truncates the context. An MLP reads a fixed window. A Transformer reads everything that came before.

Two variables are **independent** if $p(x, y) = p(x)\,p(y)$, or equivalently $p(y \mid x) = p(y)$: knowing one tells you nothing about the other. A unigram model assumes that consecutive tokens are independent. That is exactly why it is so poor, and why Shannon’s and Markov’s demonstrations that letters are *not* independent mattered (Chapter 1).

## Bayes’ rule

Writing the product rule both ways round, $p(x)\,p(y \mid x) = p(y)\,p(x \mid y)$, gives **Bayes’ rule**:

:::equation{#c-bayes caption="Bayes’ rule: reversing a conditional."}
$$
p(x \mid y) = \frac{p(y \mid x)\; p(x)}{p(y)}
$$
:::

It turns a model of how data arise from causes into an inference about causes from data. In this course it appears in three places. **Smoothing as a prior:** add-$k$ smoothing (Chapter 2) is what Bayesian inference gives when the unknown next-token probabilities have a symmetric Dirichlet prior, as MacKay explains :cite[mackay2003]. **Weight decay as a prior:** minimising loss plus $\frac{\lambda}{2}\lVert \mathbf w \rVert^2$ finds the most probable weights under a Gaussian prior (Chapter 13). **Preferences:** the best policy under RLHF’s objective (Chapter 21) is the original model’s distribution reweighted by $e^{r/\beta}$ — Bayes’ rule, with the exponentiated reward playing the part of a likelihood.

## Expectation and variance

The **expectation** of a random variable is its probability-weighted average, $\mathbb E[X] = \sum_x x\, p(x)$, or $\int x\, p(x)\, dx$ in the continuous case. More generally, $\mathbb E[f(X)] = \sum_x f(x)\,p(x)$. The most important property is **linearity**: $\mathbb E[aX + bY] = a\,\mathbb E[X] + b\,\mathbb E[Y]$, whether or not $X$ and $Y$ are independent. Cross-entropy, the course’s loss, is an expectation: the average surprisal $\mathbb E_{x \sim p}[-\log q(x)]$ (Appendix E).

The **variance** measures spread around the mean, $\operatorname{Var}(X) = \mathbb E\big[(X - \mathbb E X)^2\big] = \mathbb E[X^2] - (\mathbb E X)^2$. Its square root is the **standard deviation** $\sigma$. Variances add for independent variables, $\operatorname{Var}(X + Y) = \operatorname{Var}X + \operatorname{Var}Y$, and scale with the square of a constant, $\operatorname{Var}(aX) = a^2 \operatorname{Var}X$. These two facts give the most useful result in this appendix: the average of $n$ independent draws has variance $\sigma^2 / n$, so its **standard error** is

:::equation{#c-stderr caption="The standard error of an average of n independent samples."}
$$
\operatorname{sd}\!\Big(\frac{1}{n}\sum_{i=1}^n X_i\Big) \;=\; \frac{\term{sig}{\sigma}}{\sqrt{\term{nn}{n}}}
$$
:::

```terms
sig:
  label: "$\\sigma$ — the standard deviation of one sample"
  what: How much a single draw typically differs from the mean. For per-token losses it is large; some tokens are easy, some very surprising.
nn:
  label: "$n$ — the number of samples averaged"
  what: For a minibatch loss, the number of tokens in the batch.
  effect: Quadrupling the batch halves the noise in the loss and its gradient. That is why noise falls only slowly with batch size, and why very large batches give diminishing returns (Chapter 17).
```

The same formula appears throughout the course. It governs the noise of minibatch gradients (Chapter 5) and the error bars on a benchmark score measured on $n$ questions (Chapter 25). It also explains why initialisation divides weights by $\sqrt{\text{fan-in}}$ (Chapter 7): a sum of $n$ independent terms has a standard deviation $\sqrt n$ times one term’s.

The **covariance** $\operatorname{Cov}(X, Y) = \mathbb E[(X - \mathbb E X)(Y - \mathbb E Y)]$ measures how two variables move together. Normalised by both standard deviations, it becomes the **correlation**, between −1 and 1. For a random vector, the covariances of all pairs form the **covariance matrix**, whose eigenvectors are the principal components (Appendix A).

## Distributions the course uses

| Distribution | Values | Probability | Mean, variance | Where it appears |
|---|---|---|---|---|
| Bernoulli($p$) | $\{0, 1\}$ | $P(1) = p$ | $p$, $p(1 - p)$ | “is the answer correct?”; dropout masks |
| Categorical($\boldsymbol\pi$) | $\{1, \ldots, V\}$ | $P(k) = \pi_k$ | — | **every next-token prediction** |
| Binomial($n, p$) | $\{0, \ldots, n\}$ | $\binom{n}{k} p^k (1 - p)^{n - k}$ | $np$, $np(1 - p)$ | accuracy on $n$ benchmark questions |
| Multinomial | count vectors | products of categoricals | — | n-gram counts (Chapter 2) |
| Uniform($a, b$) | $[a, b]$ | density $1/(b - a)$ | $\frac{a+b}{2}$, $\frac{(b-a)^2}{12}$ | the random numbers behind all sampling |
| Normal($\mu, \sigma^2$) | $\mathbb R$ | $\frac{1}{\sigma\sqrt{2\pi}} e^{-(x - \mu)^2 / 2\sigma^2}$ | $\mu$, $\sigma^2$ | weight initialisation; noise; the CLT |
| Gumbel(0, 1) | $\mathbb R$ | CDF $e^{-e^{-x}}$ | $\approx 0.577$, $\pi^2/6$ | the Gumbel-max sampling trick |
| Zipf($s$) | ranks $1, 2, \ldots$ | $\propto k^{-s}$ | — | word frequencies (Chapter 1) |

A language model’s output is a **categorical distribution** over the vocabulary, produced by a softmax. Its logits are log-probabilities up to an additive constant, and $\ln \pi_k = z_k - \ln \sum_j e^{z_j}$. Working with log-probabilities, and computing $\ln \sum e^{z}$ stably by subtracting the maximum, avoids underflow: the probability of a whole sentence is a product of hundreds of numbers below one (Chapter 4).

## Sampling

Everything random in the course is built from one primitive: a pseudo-random number $u$ that is uniform on $[0, 1)$ (the library’s `mulberry32`). The **inverse-CDF method** turns $u$ into a draw from any distribution: return the smallest $x$ with $F(x) > u$. Since $P(u < F(x)) = F(x)$, the result has exactly the right distribution. For a categorical distribution, lay the probabilities end to end along $[0, 1)$ and see which interval $u$ lands in. This is `sampleIndex` in `@lm/core`, used by every text generator in the course.

::categorical-sampler

**Temperature** divides the logits by $T$ before the softmax. $T < 1$ sharpens the distribution towards the most likely token, and $T \to 0$ becomes greedy decoding (the argmax). $T > 1$ flattens it towards uniform. Chapter 15 covers this and the other decoding strategies: top-$k$, top-$p$ and min-$p$.

Two other methods are worth knowing. The **Gumbel-max trick** adds independent Gumbel noise $g_k = -\ln(-\ln u_k)$ to each logit and takes the argmax. The result is an exact sample from $\operatorname{softmax}(\mathbf z)$ :cite[gumbel1954,maddison2014], which is useful on GPUs, where an argmax parallelises more easily than a cumulative sum. The **Box–Muller transform** turns two uniforms into two independent standard normals, $\sqrt{-2\ln u_1}\,(\cos 2\pi u_2, \sin 2\pi u_2)$, and is how `Tensor.randn` initialises weights.

## The law of large numbers and the central limit theorem

Averages of many independent samples behave predictably, and this is what makes learning from data possible. The **law of large numbers** says that the average of $n$ draws converges to the expectation as $n \to \infty$. Empirical frequencies converge to probabilities, and a minibatch loss converges to the expected loss. The **central limit theorem** says more: whatever the distribution of a single draw (with finite variance), the average of $n$ draws is approximately normally distributed, with mean $\mu$ and standard deviation $\sigma / \sqrt n$.

::clt-demo

In practice this means that averaged quantities — minibatch gradients, validation losses, benchmark accuracies — come with Gaussian error bars of width $\sigma/\sqrt n$, which can be estimated from the data themselves. A difference of 0.5 percentage points between two models on a 1,000-question benchmark is well inside the noise. The standard error of an accuracy near 70% is $\sqrt{0.7 \times 0.3 / 1000} \approx 1.4$ points. Chapter 25 returns to this.

## Maximum likelihood

Given data $x_1, \ldots, x_N$ and a model $q_\theta$ with parameters $\theta$, the **likelihood** is the probability the model assigns to the data, $\prod_i q_\theta(x_i)$. **Maximum-likelihood estimation** chooses the parameters that make it largest. In practice we minimise the average **negative log-likelihood** instead, which has the same minimiser, turns the product into a sum, and avoids underflow:

:::equation{#c-mle caption="Maximum likelihood is minimum average negative log-likelihood — the cross-entropy loss."}
$$
\hat\theta \;=\; \argmax_\theta \prod_{i=1}^N q_\theta(x_i) \;=\; \argmin_\theta\; \term{nll}{-\frac{1}{N}\sum_{i=1}^N \log q_\theta(x_i)}
$$
:::

```terms
nll:
  label: "The average negative log-likelihood"
  what: The mean surprisal of the data under the model. For a language model, the average of −log q(next token | context) over all positions.
  why: As N grows, it converges to the cross-entropy between the data distribution and the model (Appendix E), which is minimised exactly when the model matches the data.
  effect: It is the training loss of every model in this course, from bigram counts to CourseGPT.
```

For a categorical distribution, maximum likelihood gives the empirical frequencies: that is why n-gram models count (Chapter 2). For neural models there is no closed form, and we minimise the same objective by gradient descent (Chapter 5). The weakness of maximum likelihood is overfitting. It gives zero probability to anything unseen, which is the problem smoothing (Chapter 2) and regularisation (Chapters 12–13) exist to fix.

## Further reading

- Joseph K. Blitzstein and Jessica Hwang, *Introduction to Probability* :cite[blitzstein2019]. Clear, rigorous and full of good examples; free online.
- David MacKay, *Information Theory, Inference, and Learning Algorithms* :cite[mackay2003]. Probability as the language of inference, with language-modelling examples.
- Christopher Bishop, *Pattern Recognition and Machine Learning* :cite[bishop2006], chapters 1–2. Probability for machine learning, including Bayesian treatments of the models above.
