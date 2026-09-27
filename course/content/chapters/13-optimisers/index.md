---
number: 13
title: Optimisers
summary: Why plain gradient descent struggles with the loss surfaces of neural networks, and the ideas that fix it — momentum, per-parameter adaptive step sizes (RMSProp, Adam), decoupled weight decay (AdamW), and orthogonalised updates (Muon). Each is derived, implemented, raced on toy landscapes and then compared on our Transformer.
duration: About 2½ hours
prerequisites: [training-loop, calculus]
builds:
  - SGD with momentum, Adam and AdamW (CPU and GPU)
  - Muon with Newton–Schulz orthogonalisation (GPU)
  - An optimiser comparison on a real model
---

Since Chapter 5 we have updated weights by stepping against the gradient, $\mathbf w \leftarrow \mathbf w - \eta\, \mathbf g$. Since Chapter 9 we have quietly used **Adam** instead, because it trained our networks several times faster. This chapter explains why.

The short answer is that a neural network’s loss surface is badly shaped for plain gradient descent. It curves sharply in some directions and gently in others; its gradients are noisy; and different parameters live on wildly different scales. Every successful optimiser corrects for one or more of these. We build the main ones in order of history, each fixing a flaw in the last: momentum, adaptive step sizes, decoupled weight decay, and Muon, a 2024 optimiser that treats weight matrices as matrices.

## The trouble with gradient descent

Appendix B showed the key fact. On a quadratic with curvature $\lambda$, gradient descent is stable only if $\eta < 2/\lambda$. A real loss has many directions at once, with curvatures $\lambda_1 \ge \lambda_2 \ge \ldots$ given by the Hessian’s eigenvalues. The sharpest direction sets the largest usable learning rate, $\eta < 2/\lambda_{\max}$. Along the flattest direction, the loss then shrinks by a factor of only about $1 - 2\lambda_{\min}/\lambda_{\max}$ per step.

The ratio $\kappa = \lambda_{\max}/\lambda_{\min}$ is the **condition number**. With $\kappa = 1000$, gradient descent needs thousands of steps to make progress along the flat directions, while it zig-zags across the steep ones. Neural networks are notoriously ill-conditioned, and their gradients are noisy estimates from minibatches on top of that.

::optimiser-race

Try the *narrow valley*, whose curvatures differ 25-fold. SGD crawls along the valley floor, because a learning rate small enough for the steep walls is tiny for the gentle floor. Double its learning rate (scale ×2) and it diverges across the walls. The optimisers below all do better, for different reasons.

## Momentum

The first fix is to give the optimiser inertia. **Heavy-ball momentum** :cite[polyak1964] keeps a running **velocity**, a decaying sum of past gradients, and steps along it:

:::equation{#momentum caption="Momentum: step along an exponentially weighted sum of past gradients."}
$$
\mathbf v_t = \term{beta}{\beta}\, \mathbf v_{t-1} + \mathbf g_t, \qquad \mathbf w_t = \mathbf w_{t-1} - \eta\, \mathbf v_t
$$
:::

```terms
beta:
  label: "$\\beta$ — the momentum coefficient"
  what: How much of the previous velocity is kept at each step; 0.9 is typical. A gradient’s influence decays by a factor of β per step, lasting about 1/(1 − β) steps.
  why: Components of the gradient that point the same way step after step (along the valley floor) add up, up to 1/(1 − β) = 10 times their size. Components that alternate in sign (across the valley) cancel out.
  effect: Larger β means more smoothing and more speed along consistent directions, but also more overshoot, since the optimiser takes longer to turn.
```

Along the valley floor the gradient keeps the same sign, so the velocity builds up to $1/(1-\beta)$ times a single step. Across the valley the gradient alternates, and the velocity largely cancels. Momentum therefore accelerates exactly where plain gradient descent is slow. It also averages away some minibatch noise. **Nesterov momentum** :cite[nesterov1983] evaluates the gradient at the point the momentum is about to carry the weights to, which corrects overshoot a little sooner. Sutskever and colleagues showed that well-tuned momentum was essential for training deep networks :cite[sutskever2013].

::exercise{id="momentum"}

## Adaptive step sizes: AdaGrad, RMSProp and Adam

Momentum does not solve the problem of scale. If one parameter’s gradients are typically a thousand times larger than another’s, a single learning rate is too big for one or too small for the other. In a Transformer, embedding rows for rare tokens, LayerNorm gains and attention matrices all have gradients of very different sizes.

**Adaptive** methods give every parameter its own step size, by dividing its gradient by a running estimate of that gradient’s typical magnitude. AdaGrad :cite[duchi2011] used the sum of all past squared gradients. RMSProp :cite[tieleman2012] used an exponential moving average instead, so the estimate tracks the recent past. **Adam** :cite[kingma2015] combines RMSProp’s normalisation with momentum, and corrects both averages for starting at zero:

:::equation{#adam caption="Adam: momentum on the gradient, normalised by the root-mean-square of recent gradients, with bias correction."}
$$
\begin{aligned}
\mathbf m_t &= \beta_1 \mathbf m_{t-1} + (1 - \beta_1)\, \mathbf g_t, \qquad \mathbf v_t = \beta_2 \mathbf v_{t-1} + (1 - \beta_2)\, \mathbf g_t^2 \\
\hat{\mathbf m}_t &= \frac{\mathbf m_t}{1 - \beta_1^t}, \qquad \hat{\mathbf v}_t = \frac{\mathbf v_t}{1 - \beta_2^t}, \qquad \mathbf w_t = \mathbf w_{t-1} - \eta\, \frac{\hat{\mathbf m}_t}{\term{rms}{\sqrt{\hat{\mathbf v}_t}} + \term{eps}{\epsilon}}
\end{aligned}
$$
:::

```terms
rms:
  label: "$\\sqrt{\\hat{\\mathbf v}_t}$ — each parameter’s recent gradient size"
  what: The root-mean-square of the parameter’s recent gradients (β₂ = 0.999 averages over about a thousand steps; LLM training often uses 0.95–0.99 to react faster).
  why: Dividing by it makes the step size roughly the same for every parameter — about η — whatever the scale of its gradients. The learning rate becomes a step size in parameter units.
  effect: Parameters with consistently small gradients take full-size steps too, which is exactly what rarely updated embedding rows need.
eps:
  label: "$\\epsilon$ — a small constant"
  what: Typically 10⁻⁸. It prevents division by zero and caps the step size for parameters whose gradients are almost exactly zero.
```

The **bias correction** matters at the start. Both averages begin at zero, so for the first few steps they badly underestimate the gradient’s size. Dividing by $1 - \beta^t$ undoes this. At step 1, $\hat{\mathbf m}_1 = \mathbf g_1$ and $\hat{\mathbf v}_1 = \mathbf g_1^2$, so the first update is exactly $\eta\, \operatorname{sign}(\mathbf g_1)$.

Adam is not a cure for everything. Its per-parameter normalisation is diagonal: it rescales each coordinate independently but cannot rotate. In the valley widget, whose axes happen to be aligned with the coordinates, it is superb. On the Rosenbrock banana, whose valley curves diagonally, the advantage shrinks. Still, Adam’s combination of speed, robustness to scale and forgiveness of learning-rate choice made it the default for Transformers from the start.

::exercise{id="adam"}

## Weight decay, done properly: AdamW

**Weight decay** shrinks every weight a little at each step, $\mathbf w \leftarrow (1 - \eta\lambda)\,\mathbf w$. This keeps weights small, which acts as a regulariser — a Gaussian prior on the weights, in Bayesian terms (Appendix C). For plain gradient descent it is the same as adding $\frac{\lambda}{2}\lVert\mathbf w\rVert^2$ to the loss, **L2 regularisation**, because that term’s gradient is $\lambda\mathbf w$.

For Adam the two are *not* the same, and the difference matters. With L2 regularisation, the decay term $\lambda \mathbf w$ is added to the gradient and then divided by $\sqrt{\hat{\mathbf v}}$ along with it. Parameters with large gradients therefore receive very little decay, and parameters with small gradients receive a lot: the regularisation is distorted by the very normalisation that makes Adam work. Loshchilov and Hutter proposed **decoupling** the two :cite[loshchilov2019]. Take the Adam step on the loss gradient alone, then decay every weight directly:

:::equation{#adamw caption="AdamW: the Adam step, then weight decay applied directly to the weights."}
$$
\mathbf w_t \;=\; \mathbf w_{t-1} \;-\; \eta\, \frac{\hat{\mathbf m}_t}{\sqrt{\hat{\mathbf v}_t} + \epsilon} \;-\; \eta\, \term{lam}{\lambda}\, \mathbf w_{t-1}
$$
:::

```terms
lam:
  label: "$\\lambda$ — the weight-decay coefficient"
  what: The fraction of each weight removed per unit of learning rate; 0.1 is typical for Transformers.
  why: Decoupled from the gradient normalisation, it shrinks every weight at the same relative rate.
  effect: It is usually not applied to biases, LayerNorm gains or (in our models) position embeddings, whose natural sizes should not be pulled towards zero.
```

**AdamW** is what almost every large language model is trained with. It is what `GpuAdamW` in `@lm/core/gpu` and `model.optimizer()` in the PyTorch lab implement. Both exempt norm gains and position embeddings from decay.

::exercise{id="adamw"}

## Muon: treating matrices as matrices

Adam treats a weight matrix as a bag of independent numbers. But a matrix is a linear map (Appendix A), and its gradient has structure: it is usually dominated by a few directions, a few large singular values, with everything else tiny. A step along the gradient therefore changes the map almost entirely in those few directions and hardly at all in the rest.

**Muon** :cite[jordan2024muon] (MomentUm Orthogonalized by Newton–Schulz) takes the momentum-averaged gradient $G = U \Sigma V^\top$ and replaces it with $U V^\top$. That is the same singular directions, but with every singular value set to 1, so every direction moves by the same amount. Computing an SVD at every step would be too slow. Instead, Muon runs a few iterations of a matrix polynomial that pushes singular values towards 1, using nothing but matrix products — what GPUs do best:

:::equation{#newton-schulz caption="The quintic Newton–Schulz iteration used by Muon, applied five times."}
$$
X_0 = \frac{G}{\lVert G \rVert_F}, \qquad X_{k+1} = a X_k + b\, (X_k X_k^\top) X_k + c\, (X_k X_k^\top)^2 X_k, \qquad (a, b, c) = (3.4445,\ -4.7750,\ 2.0315)
$$
:::

Because each term is $X$ times a polynomial in $X X^\top$, the iteration keeps the singular vectors and applies the scalar polynomial $p(s) = as + bs^3 + cs^5$ to each singular value. The coefficients are chosen so that five iterations take anything in $(0, 1]$ to roughly 1.

::muon-spectrum

::exercise{id="newton-schulz"}

Muon is used only for the 2-D weight matrices inside the blocks. Embeddings, output layers and norm gains still use AdamW, since orthogonalising a lookup table makes no sense. It has set records in small-scale training speed runs, and it has been scaled to large language models :cite[liu2025muon]. Bernstein and Newhouse explain it, and Adam, as steepest descent under different choices of norm :cite[bernstein2024]. Second-order methods such as Shampoo :cite[gupta2018] pursue the same goal — undoing the loss surface’s bad conditioning — by estimating curvature matrices, at higher cost.

## On a real model

The toy landscapes are suggestive, but what matters is our Transformer. The widget trains Chapter 11’s two-layer model with each optimiser for 1,500 steps, each at a learning rate tuned for it, with the same schedule and data:

::optimiser-comparison

On an Apple M4 Pro the four finish at:

| Optimiser | Learning rate | Validation bits/char after 1,500 steps |
|---|---|---|
| SGD with momentum | 0.3 (1.0 is no better) | 2.70 |
| Adam | 0.003 | 2.35 |
| AdamW (λ = 0.1) | 0.003 | 2.36 |
| Muon for the matrices, AdamW for the rest | 0.02 / 0.003 | **2.23** |

Three lessons. First, the adaptive methods leave SGD far behind; even tuned, SGD with momentum is not competitive on Transformers. Second, over a run this short, weight decay makes no measurable difference, because its effect accumulates slowly — the gap between 2.35 and 2.36 is within the noise of Chapter 12. Third, Muon is clearly ahead: after 1,500 steps it matches what AdamW reaches after 3,000 (Chapter 11). Each Muon step costs a little more, five small matrix products per weight matrix, but on this model it is still a large net gain.

:::history{year=2014 title="Adam" people="Diederik Kingma and Jimmy Ba"}
Adam was introduced in a 2014 preprint :cite[kingma2015] that became one of the most cited papers in machine learning. It was not the first adaptive method. AdaGrad (2011) had shown that per-parameter step sizes help with sparse features, and Geoffrey Hinton had described RMSProp in a 2012 online lecture, never formally published. Adam’s contribution was the robust combination of the two, with bias correction and sensible defaults, and it simply worked, on almost everything, with little tuning.

For language models, AdamW’s decoupled weight decay (2017, published 2019) :cite[loshchilov2019] became the standard, usually with $\beta_2$ lowered to 0.95 for stability in very large runs. It held that position largely unchallenged for a decade, until Muon (2024) and other matrix-aware optimisers began to show consistent gains.
:::

:::breakit
- In the race, choose the saddle point and set SGD’s learning rate low. How long does it take to escape? Now add gradient noise: why does noise *help* here?
- Set Adam’s $\epsilon$ to 1 (in your exercise, then in the race by editing `optimisers.ts`). What does Adam turn into?
- Train the comparison model with SGD at learning rate 3. What does the loss do in the first 200 steps, and what does clipping at 1 save you from?
:::

## Lab: optimisers in PyTorch

The PyTorch lab trains with `torch.optim.AdamW` through `model.optimizer()` (Chapter 11). PyTorch 2.14 also ships Muon as `torch.optim.Muon`. To try it on char-GPT, give it the blocks’ 2-D matrices and AdamW the rest, in the same split as the browser:

```python
matrices = [p for n, p in model.named_parameters() if n.startswith("blocks.") and p.ndim == 2]
others = [p for n, p in model.named_parameters() if not (n.startswith("blocks.") and p.ndim == 2)]
optimisers = [torch.optim.Muon(matrices, lr=0.02, momentum=0.95), torch.optim.AdamW(others, lr=3e-3)]
```

:::exercises
1. **Momentum in the race.** Add Nesterov momentum to `optimisers.ts` and compare it with heavy-ball momentum on the Rosenbrock banana at the same learning rate.
2. **β₂.** Train the comparison model with Adam at $\beta_2 = 0.999$, $0.99$ and $0.95$. Which is most stable at a high learning rate? Why would a smaller $\beta_2$ help with sudden gradient spikes?
3. **Decay or not?** Train char-GPT with AdamW at $\lambda = 0$, $0.1$ and $1$. What happens to validation loss and to the size of the weights?
4. **Learning-rate sensitivity.** For AdamW and SGD, train at five learning rates spanning a factor of 30 and plot the final loss against the learning rate. Which optimiser is more forgiving?
:::

:::challenge
1. **Shampoo, small.** Implement a basic Shampoo optimiser for one weight matrix: precondition the gradient with $L^{-1/4} G R^{-1/4}$, where $L$ and $R$ are running sums of $GG^\top$ and $G^\top G$. Compare it with Muon on the comparison model.
2. **A learning-rate finder.** Increase the learning rate exponentially from $10^{-6}$ to 1 over 300 steps and plot the loss. Where is the best learning rate relative to the point where the loss explodes?
3. **Schedule-free.** Read about schedule-free AdamW (Defazio et al., 2024) and implement it in the browser trainer. Does it match the cosine schedule without knowing the run length?
:::

## Check your understanding

```quiz
q: "Why does momentum speed up progress along a narrow valley?"
options:
  - text: "Gradient components along the valley have a consistent sign and accumulate in the velocity, while components across it alternate and cancel."
    correct: true
    why: The effective step along consistent directions grows up to 1/(1 − β) times.
  - text: It lowers the learning rate automatically.
    why: It effectively raises the step along consistent directions.
  - text: It computes the second derivative.
    why: Momentum uses only gradients.
```

```quiz
q: "What is the size of Adam's very first update to a parameter with gradient g₁?"
options:
  - text: "η · sign(g₁): after bias correction, m̂ = g₁ and v̂ = g₁², so the ratio is ±1."
    correct: true
    why: The step size is set by η, not by the gradient's magnitude.
  - text: "η · g₁, as for SGD."
    why: Adam divides by the gradient's root-mean-square.
  - text: "Almost zero, because m starts at zero."
    why: That is what bias correction prevents.
```

```quiz
q: "Why is L2 regularisation not the same as weight decay under Adam?"
options:
  - text: "The L2 term's gradient λw is divided by √v̂ along with the loss gradient, so weights with large gradients are barely decayed."
    correct: true
    why: AdamW applies the decay directly to the weights, after the normalised step.
  - text: They are the same; AdamW is just faster.
    why: They differ precisely because of Adam's normalisation.
  - text: L2 regularisation applies only to biases.
    why: It applies to whatever weights it is added for.
```

```quiz
q: "What does Muon's Newton–Schulz iteration do to the update matrix?"
options:
  - text: "It keeps the singular vectors and pushes every singular value towards 1, so all directions of the update have similar size."
    correct: true
    why: An odd matrix polynomial in X acts on singular values only.
  - text: It computes the exact inverse Hessian.
    why: It uses no curvature information; it orthogonalises the momentum.
  - text: It normalises each row of the matrix.
    why: That would change the singular vectors.
```

## Further reading

- Diederik Kingma and Jimmy Ba, *Adam: A Method for Stochastic Optimization* :cite[kingma2015].
- Ilya Loshchilov and Frank Hutter, *Decoupled Weight Decay Regularization* :cite[loshchilov2019].
- Keller Jordan and colleagues, *Muon* :cite[jordan2024muon], and Jeremy Bernstein and Laker Newhouse, *Old Optimizer, New Norm* :cite[bernstein2024].
- Léon Bottou, Frank Curtis and Jorge Nocedal, *Optimization Methods for Large-Scale Machine Learning* :cite[bottou2018]. The theory, thoroughly.
