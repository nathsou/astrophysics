---
number: 5
title: Learning as optimisation
summary: Replace counting with learning. Define a loss, follow its gradient downhill, and train a neural bigram model in your browser that rediscovers Chapter 2’s table of counts — the template for training every model that follows.
duration: About 2½ hours, including the lab
prerequisites: [n-gram-models, tensors, calculus]
builds:
  - Softmax cross-entropy gradient
  - Gradient descent and SGD
  - Numerical gradient checking
  - Neural bigram model
---

Chapter 2 built a bigram model by counting: $P(w \mid x) = c(x, w) / c(x)$. That worked because we could solve for the best parameters in closed form. For every model from here on — an MLP, an RNN, a Transformer — there is no such formula. Instead, we write down how wrong the model is (a **loss**), work out which way to nudge each parameter to make it less wrong (the **gradient**), and nudge, repeatedly. This is **gradient descent**, and almost all of deep learning is gradient descent on a cleverly designed function.

This chapter introduces the method on the simplest possible model, a bigram model rebuilt as a neural network. Because we already know the right answer from Chapter 2, we can watch gradient descent find it.

## A bigram model with parameters

Give the model a $V \times V$ matrix of real numbers $W$. To predict the character after $x$, take row $x$ of $W$ as a vector of **logits** (unnormalised scores), and turn them into probabilities with the softmax from Chapter 4:

:::equation{#model caption="The neural bigram model: a lookup of logits followed by a softmax."}
$$
P_W(\,\cdot \mid x) \;=\; \softmax\big(\term{Wx}{W_x}\big),
\qquad P_W(w \mid x) = \frac{e^{W_{x w}}}{\sum_{w'} e^{W_{x w'}}}
$$
:::

```terms
Wx:
  label: "$W_x$ — the row of logits for context $x$"
  what: "Row $x$ of the parameter matrix $W$: one real-valued score per possible next character."
  why: Logits can be any real numbers, which makes them easy to optimise freely; softmax then guarantees a valid distribution.
  effect: "Adding the same constant to a whole row changes nothing (softmax is shift-invariant). Making one entry larger than the rest makes that character more likely, exponentially."
```

Looking up row $x$ is the same as multiplying a one-hot vector (a 1 in position $x$, 0 elsewhere) by $W$. Neural networks do this with an **embedding lookup** (Chapter 7), which gathers rows directly instead of multiplying by zeros.

## A loss to minimise

How good is a particular $W$? Exactly as in Chapter 2: the average surprisal of the training data, i.e. the cross-entropy. For $N$ training pairs $(x_i, y_i)$ of a character and the one that followed it:

:::equation{#loss caption="The training loss: mean negative log-likelihood (cross-entropy) of the next character."}
$$
\term{L}{\mathcal{L}}(W) \;=\; -\frac{1}{N} \sum_{i=1}^{N} \log P_W(y_i \mid x_i)
$$
:::

```terms
L:
  label: "$\\mathcal{L}(W)$ — the loss"
  what: A single number measuring how badly the model with parameters $W$ predicts the training data, in nats.
  why: Minimising it is maximum-likelihood estimation. It is the same cross-entropy we used to *evaluate* models in Chapter 2, now used to *train* one.
  effect: With $W = 0$ every prediction is uniform and $\mathcal{L} = \ln 65 \approx 4.17$ nats. A perfect predictor would reach 0; the counted bigram model reaches about 2.5.
```

For this particular model we can prove that the minimum is exactly the counted bigram table. With unlimited training the optimal $W$ satisfies $\softmax(W_x) = c(x, \cdot)/c(x)$, the MLE from Chapter 2, up to a constant per row. So gradient descent has a known destination, and we can check that it gets there.

## Which way is downhill? The gradient

The **gradient** $\nabla \mathcal{L}(W)$ is the vector of partial derivatives $\partial \mathcal{L} / \partial W_{jk}$. It points in the direction in which the loss increases fastest, so its negative points downhill. (Appendix B reviews derivatives and the chain rule.) For softmax followed by cross-entropy, the derivative with respect to the logits has a strikingly simple form:

:::equation{#ce-grad caption="The gradient of softmax cross-entropy with respect to the logits: predicted minus actual."}
$$
\term{dz}{\frac{\partial\, \ell}{\partial z_j}} \;=\; \term{pj}{p_j} \;-\; \term{yj}{\mathbb{1}[j = y]},
\qquad \ell = -\log \softmax(\mathbf z)_y
$$
:::

```terms
pj:
  label: "$p_j$ — predicted probability"
  what: The model’s current probability for option $j$, i.e. $\softmax(\mathbf z)_j$.
yj:
  label: "$\\mathbb{1}[j = y]$ — the target indicator"
  what: 1 for the option that actually occurred, 0 for all others (a one-hot vector).
  why: Together, $\mathbf p - \mathbf y$ is the error of the prediction.
  effect: The correct option’s logit is pushed up by $1 - p_y$ (how much probability it was missing); every other logit is pushed down by exactly the probability it wrongly took.
dz:
  label: "$\\partial \\ell / \\partial z_j$ — gradient of the loss with respect to logit $j$"
  what: How fast the loss changes as logit $j$ increases.
```

:::details[Derivation]
Write $\ell = -z_y + \log \sum_k e^{z_k}$. The derivative of the first term with respect to $z_j$ is $-\mathbb{1}[j = y]$. For the second, the chain rule gives $\frac{1}{\sum_k e^{z_k}} \cdot e^{z_j} = p_j$. Adding them: $\partial \ell / \partial z_j = p_j - \mathbb{1}[j=y]$. Averaging over a batch divides by the batch size, and each example only affects the row $W_{x_i}$ it looked up. That is all the calculus the neural bigram model needs.
:::

::softmax-gradient

::exercise{id="ce-grad"}

## Gradient descent

Now follow the gradient downhill in small steps:

:::equation{#gd caption="Gradient descent: step against the gradient, scaled by the learning rate."}
$$
\theta_{t+1} \;=\; \theta_t \;-\; \term{eta}{\eta}\, \nabla_\theta \mathcal{L}(\theta_t)
$$
:::

```terms
eta:
  label: "$\\eta$ — learning rate"
  what: The step size — how far to move along the negative gradient each iteration.
  why: The gradient only describes the loss *locally*; a small step is guaranteed to go downhill, a large one may overshoot.
  effect: Too small and training crawls; too large and it overshoots, oscillates or diverges to infinity. For a quadratic bowl, the limit is $\eta < 2/\lambda_{\max}$, where $\lambda_{\max}$ is the largest curvature. Try it in the figure below.
  param: { key: gd.lr, min: 0.0001, max: 2, step: 0.0001, value: 0.15, log: true }
```

Why does it work? Near $\theta$, the loss is approximately linear: $\mathcal{L}(\theta - \eta\mathbf g) \approx \mathcal{L}(\theta) - \eta\,\|\mathbf g\|^2$, which is lower for small enough $\eta > 0$. The second-order term $\tfrac{\eta^2}{2}\,\mathbf g^\top H \mathbf g$, where $H$ is the matrix of second derivatives (the curvature), is what limits the step size. When the curvature differs a lot between directions (an **ill-conditioned** problem), no single learning rate suits every direction. Gradient descent then zig-zags across the steep direction while crawling along the shallow one. Much of Chapter 13 — momentum, Adam — exists to fix that.

::loss-landscape

::exercise{id="gradient-descent"}

## Stochastic gradient descent

The true gradient averages over all $N$ training examples — a million character pairs here, and trillions of tokens for a frontier model. Computing it for every step would be absurdly expensive. Instead, estimate it from a random **minibatch** of $B$ examples:

:::equation{#sgd caption="The minibatch gradient is an unbiased but noisy estimate of the full gradient."}
$$
\hat{\mathbf g} \;=\; \frac{1}{\term{Bb}{B}} \sum_{i \in \text{batch}} \nabla_\theta\, \ell_i(\theta),
\qquad \mathbb{E}\big[\hat{\mathbf g}\big] = \nabla_\theta \mathcal{L}(\theta),
\qquad \operatorname{Var}\big[\hat{\mathbf g}\big] \propto \frac{1}{B}
$$
:::

```terms
Bb:
  label: "$B$ — batch size"
  what: How many randomly chosen training examples are averaged for each gradient estimate.
  why: The estimate is correct on average (unbiased), so following it still descends the loss — just less directly.
  effect: Larger batches give less noisy steps but cost more per step. Noise is not all bad — it helps escape shallow regions — and batch size interacts with the learning rate (Chapters 12 and 13).
```

This is **stochastic gradient descent** (SGD). With it we can train on data far too large to look at in one go, and it is how every model in this course is trained. Now for the real thing: the neural bigram model on TinyShakespeare, trained in your browser. Its gradient comes from the library’s automatic differentiation (Chapter 6) — or from your hand-written step once you have done the exercise below.

::neural-bigram

Things to try:

- **Watch the destination.** After a few thousand steps, the learned matrix on the left looks just like the counted table on the right, and validation loss settles at about 3.6 bits per character, the same as the counted bigram. Gradient descent has rediscovered counting.
- **Break the learning rate.** Push η to 200 and the loss jumps around or blows up. Drop it to 0.5 and progress crawls.
- **Change the batch size.** $B = 16$ makes the training curve noisy; $B = 2048$ makes each step smooth but more expensive.

::exercise{id="numerical-grad"}

::exercise{id="bigram-step"}

## Regularisation is smoothing

What happens to a character pair that never occurs in training? Its logit receives a small negative gradient every time its row is used, and keeps drifting down forever. Given enough steps, the model assigns it a vanishing probability — Chapter 2’s zero-probability problem, arriving slowly. The fix is the same idea as smoothing: add a penalty that keeps parameters small, pulling each row towards uniform.

:::equation{#l2 caption="L2 regularisation (weight decay): penalise large weights."}
$$
\mathcal{L}_\lambda(W) \;=\; \mathcal{L}(W) \;+\; \term{lam}{\lambda}\,\frac{1}{V^2}\sum_{j,k} W_{jk}^2
$$
:::

```terms
lam:
  label: "$\\lambda$ — regularisation strength"
  what: How strongly large weights are penalised.
  why: "A bigram row of all zeros is the uniform distribution, so pulling weights towards zero pulls predictions towards uniform — exactly what add-k smoothing did with counts. In Bayesian terms, L2 regularisation is a Gaussian prior on the weights."
  effect: "Too little and rare events get vanishing probability; too much and every prediction is flattened. Its gradient $2\\lambda W / V^2$ shrinks every weight a little each step — hence the name *weight decay*."
```

With a million characters of training data the bigram table is well determined, and regularisation only hurts, just as a large $k$ did for add-k. Switch the widget to the first 10,000 characters and it becomes essential. Without it, validation loss climbs as the model memorises its small sample. With $\lambda \approx 0.1$ it stays about a quarter of a bit lower. The trade-off between fitting the training data and staying simple enough to generalise will follow us through the course.

:::breakit
1. Set λ = 0, train on 10k characters, and leave it running. Why does validation loss get worse while training loss keeps improving?
2. In your `bigramStep`, forget to divide by $B$. What effective learning rate are you now using, and why does it depend on the batch size?
3. Initialise $W$ with large random values (say standard deviation 10) instead of zeros. How long does it take to recover, and why? (Chapter 7 is about exactly this.)
:::

:::history{year=1847 title="Steepest descent, from astronomy to learning machines" people="Augustin-Louis Cauchy; Herbert Robbins and Sutton Monro; Bernard Widrow and Marcian Hoff"}
Cauchy proposed the method of steepest descent in 1847 to solve the systems of equations that arose in computing the orbits of celestial bodies :cite[cauchy1847]. The stochastic version has its own theory. Herbert Robbins and Sutton Monro showed in 1951 that following noisy, unbiased gradient estimates converges if the step sizes shrink at the right rate :cite[robbins1951]. Within a decade the idea was training machines. Bernard Widrow and Marcian Hoff’s *least mean squares* rule (1960) updated the weights of their ADALINE after every single example — stochastic gradient descent in all but name :cite[widrow1960]. The name **softmax** came later. John Bridle introduced it in 1990 for the output of neural classifiers :cite[bridle1990], though the function itself is the Boltzmann distribution of statistical mechanics.
:::

## Lab: the same model in PyTorch

The widget uses our own tensor library. Here is the same experiment in PyTorch, which Chapter 14 adopts for large-scale training. The code maps line for line:

```python title="training/lmcourse/ch05.py (excerpt)"
W = torch.zeros(V, V, requires_grad=True)
for step in range(steps):
    idx = torch.randint(0, len(train) - 1, (batch,))
    x, y = train[idx], train[idx + 1]
    loss = F.cross_entropy(W[x], y)       # row lookup, softmax, −log p
    W.grad = None
    loss.backward()                       # autograd fills W.grad
    with torch.no_grad():
        W -= lr * W.grad                  # the gradient descent step
```

```bash
cd training
uv sync --extra torch
uv run lmc ch05
```

It prints the validation loss of the trained model next to the counted bigram model’s. They agree to within a few hundredths of a bit: about 3.61 against 3.57. The remaining gap closes with more steps or a decaying learning rate (exercise 2 below).

:::exercises
1. **Momentum preview.** Modify your gradient descent to keep a running average of past gradients, $\mathbf v \leftarrow \beta \mathbf v + \mathbf g$, and step along $\mathbf v$. Run it on the ill-conditioned bowl. Why does it help? (Chapter 13 develops this properly.)
2. **Learning-rate schedule.** Start with a large η and halve it every 2,000 steps. Does the neural bigram reach a lower loss than with any fixed η?
3. **Trigram by gradient descent.** Extend the model to a $V^2 \times V$ matrix indexed by the previous *two* characters. Train it, and compare with Chapter 2’s trigram models. What goes wrong with rare contexts, and how does λ help?
:::

:::challenge
1. **Closed form versus gradient descent.** Prove that the minimiser of the unregularised loss satisfies $\softmax(W_x) = c(x,\cdot)/c(x)$ for every row that occurs in training. What happens to rows that never occur?
2. **Exact Hessian.** The Hessian of cross-entropy with respect to one row of logits is $\operatorname{diag}(\mathbf p) - \mathbf p \mathbf p^\top$. Derive it, find its largest eigenvalue, and use it to predict the largest stable learning rate for the neural bigram model. Check your prediction in the widget.
:::

## Check your understanding

```quiz
q: "The model predicts p = (0.7, 0.2, 0.1) and the correct answer is the second option. What is the gradient of the loss with respect to the logits?"
options:
  - text: "(0.7, −0.8, 0.1)"
    correct: true
    why: "p − y = (0.7 − 0, 0.2 − 1, 0.1 − 0)."
  - text: "(−0.7, 0.8, −0.1)"
    why: That is the negative gradient — the direction a descent step moves in.
  - text: "(0, −1, 0)"
    why: That is −y alone; the predicted probabilities matter too.
```

```quiz
q: "Why do we train with minibatches rather than the full-dataset gradient?"
options:
  - text: The minibatch gradient is more accurate.
    why: It is noisier; it is only correct on average.
  - text: "Each step is far cheaper, and because the minibatch gradient is unbiased, many cheap noisy steps make more progress than a few exact ones."
    correct: true
    why: With huge datasets, an exact gradient per step would make training impossibly slow.
  - text: Full-batch gradient descent cannot converge.
    why: It converges fine for smooth problems — just too slowly per unit of computation.
```

## Further reading

- Michael Nielsen, *Neural Networks and Deep Learning*, chapters 1–2 :cite[nielsen2015]. A gentle, free introduction to gradient descent for networks.
- Léon Bottou, Frank Curtis and Jorge Nocedal, *Optimization Methods for Large-Scale Machine Learning* :cite[bottou2018]. Why SGD works, rigorously; sections 3–4 are the relevant ones.
