---
number: F
title: Optimisation
summary: The theory behind training — minima and saddle points, convexity, why the condition number governs gradient descent and how momentum improves it, stochastic gradients and batch size, second-order methods and preconditioning, the edge of stability, and constrained optimisation with Lagrange multipliers.
duration: About 1½ hours
---

Every model in this course is trained by minimising a loss with some form of gradient descent (Chapters 5 and 13). This appendix collects the optimisation theory behind those chapters: what kind of point we are looking for, why some problems are easy and others hard, what momentum and adaptive methods buy, how noise from minibatches changes the picture, and how to optimise under a constraint — the tool Chapter 2 used to derive n-gram probabilities.

## Minima, saddles and convexity

We minimise a loss $L(\mathbf w)$ over parameters $\mathbf w \in \mathbb R^n$. At a minimum the gradient vanishes, $\nabla L = 0$: such a point is **stationary**. Appendix B’s second-order Taylor expansion tells us what kind:

:::equation{#f-taylor caption="Near a stationary point, the loss is governed by the Hessian."}
$$
L(\mathbf w^* + \boldsymbol\delta) \approx L(\mathbf w^*) + \tfrac12\, \boldsymbol\delta^\top \term{H}{H}\, \boldsymbol\delta
$$
:::

```terms
H:
  label: "$H$ — the Hessian"
  what: The matrix of second derivatives ∂²L / ∂wᵢ∂wⱼ, symmetric, with real eigenvalues λ₁ ≥ … ≥ λₙ (the curvatures along its eigenvectors).
  why: If every eigenvalue is positive the point is a local minimum; if every one is negative, a maximum; if they have both signs, a saddle point, a minimum along some directions and a maximum along others.
```

In a high-dimensional space, saddle points vastly outnumber minima: a random stationary point needs *every one* of millions of curvatures to be positive to be a minimum. Dauphin and colleagues argued that saddles and long flat plateaus, not bad local minima, are what slows neural-network training :cite[dauphin2014]. Gradient noise helps to escape them, since a saddle is unstable along its negative-curvature directions.

A function is **convex** if the straight line between any two points of its graph lies on or above the graph. Convex functions have no bad local minima: every stationary point is a global minimum. Linear regression with squared error is convex, and so is the neural bigram model of Chapter 5, whose loss is a cross-entropy of a *linear* function of the parameters (the logits). As soon as there is a hidden layer (Chapter 7), convexity is lost: permuting hidden units gives equally good but different solutions, so the minima cannot form a single convex set. Yet large networks train reliably. Part of the explanation is that in very high dimensions the local minima gradient descent finds tend to be nearly as good as each other, and are often connected by paths along which the loss stays low.

## Gradient descent and the condition number

The quadratic $L(\mathbf w) = \tfrac12\, \mathbf w^\top H \mathbf w$ is the local picture of any smooth loss near a minimum, and gradient descent on it can be solved exactly. The gradient is $H\mathbf w$, so a step is $\mathbf w \leftarrow (I - \eta H)\mathbf w$. Along the eigenvector with curvature $\lambda_i$, the component is multiplied by $1 - \eta\lambda_i$ at every step. It shrinks only if $\lvert 1 - \eta\lambda_i \rvert < 1$, so the step size must satisfy $\eta < 2/\lambda_{\max}$.

The slowest direction is then the flattest one. Choosing $\eta$ to balance the steepest and the flattest directions, $\eta = 2/(\lambda_{\max} + \lambda_{\min})$, gives the best worst-case rate:

:::equation{#f-rate caption="The convergence rate of gradient descent on a quadratic, with the best step size, and with the best heavy-ball momentum."}
$$
\lVert \mathbf w_t \rVert \le \left(\frac{\term{kappa}{\kappa} - 1}{\kappa + 1}\right)^{t} \lVert \mathbf w_0 \rVert, \qquad \text{with momentum:} \quad \left(\frac{\sqrt\kappa - 1}{\sqrt\kappa + 1}\right)^{t}
$$
:::

```terms
kappa:
  label: "$\\kappa = \\lambda_{\\max} / \\lambda_{\\min}$ — the condition number"
  what: How much more sharply the loss curves in its steepest direction than in its flattest.
  why: For large κ the rate (κ − 1)/(κ + 1) ≈ 1 − 2/κ, so the number of steps to shrink the error by a fixed factor grows like κ. Momentum improves this to √κ, a huge saving when κ is in the thousands.
```

::quadratic-descent

**Momentum** (Chapter 13) achieves the $\sqrt\kappa$ rate :cite[polyak1964]. The velocity accumulates along the flat directions, where successive gradients agree, and cancels along the steep ones, where they alternate in sign. Nesterov’s variant attains a rate governed by $\sqrt\kappa$ on every smooth, strongly convex function, not only on quadratics, and no method that uses only gradients can do better in general :cite[nesterov1983].

## Stochastic gradients

Neural networks are trained on minibatches. The minibatch gradient $\mathbf g_B$ is an unbiased estimate of the full gradient: its expectation is $\nabla L$, and its variance shrinks as $1/B$ for a batch of $B$ independent examples. So a step with a small batch is noisy but cheap, and a step with a large batch is accurate but expensive.

With a fixed step size, noise keeps stochastic gradient descent (SGD) bouncing around the minimum in a region whose size is proportional to $\eta$ times the gradient variance. To converge exactly, the step size must shrink, but not too fast. The classic conditions of Robbins and Monro :cite[robbins1951] are $\sum_t \eta_t = \infty$ (the steps can still travel any distance) and $\sum_t \eta_t^2 < \infty$ (the accumulated noise stays bounded), met for example by $\eta_t \propto 1/t$. The decaying learning-rate schedules of Chapter 12 are the practical version: a high rate to travel fast, then a low one to settle.

How large should the batch be? Doubling it halves the variance, which is worth as much as halving the step size, so the learning rate can roughly double — the **linear scaling rule** :cite[goyal2017]. That works until the noise is no longer the limiting factor. Beyond a **critical batch size**, larger batches waste computation, and the critical size can be estimated from the ratio of the gradient’s variance to its squared size :cite[mccandlish2018]. It grows during training, as the gradient signal gets smaller relative to the noise, which is why large models often increase their batch size as they train.

## Second-order methods and preconditioning

On the quadratic, Newton’s method, $\mathbf w \leftarrow \mathbf w - H^{-1}\nabla L$, reaches the minimum in one step whatever the condition number, because multiplying by $H^{-1}$ undoes the unequal curvatures. For a network with $n$ parameters, $H$ has $n^2$ entries and inverting it costs $O(n^3)$, which is out of the question for millions of parameters. Instead we **precondition**: multiply the gradient by a cheap approximation $P \approx H^{-1}$.

- A **diagonal** preconditioner rescales each parameter separately. Adam’s division by $\sqrt{\hat v}$ (Chapter 13) is one, built from gradient magnitudes rather than curvature.
- **Quasi-Newton** methods such as L-BFGS build a low-rank approximation of $H^{-1}$ from recent gradient differences; they excel on smooth, deterministic problems and struggle with minibatch noise :cite[nocedal2006].
- The **natural gradient** preconditions with the inverse Fisher information matrix, which makes the update independent of how the model is parameterised :cite[amari1998]. Shampoo and Muon (Chapter 13) can be seen as practical, per-matrix approximations in the same spirit.

## The edge of stability

The quadratic theory says gradient descent is stable only while $\eta < 2/\lambda_{\max}$. Neural-network losses are not quadratic, and their curvature changes during training. Cohen and colleagues observed that full-batch gradient descent on neural networks behaves in a surprising way :cite[cohen2021]. The sharpness $\lambda_{\max}$ rises during training until it reaches $2/\eta$, and then *hovers there*: the loss keeps decreasing, non-monotonically, while training sits at the edge of stability. The step size, in other words, partly selects the curvature of the region training ends up in. This is one reason warm-up helps (Chapter 12): early in training the curvature is high, and a small step size lets the network move to flatter regions before the full learning rate is applied.

## Constrained optimisation

Chapter 2 maximised the log-likelihood of an n-gram model, $\sum_w c_w \log p_w$, over probabilities that must sum to 1. Such **equality constraints** $g(\mathbf p) = 0$ are handled with **Lagrange multipliers**. At a constrained optimum, the gradient of the objective has no component along the constraint surface — otherwise moving along the surface would improve it — so it must be perpendicular to the surface, parallel to the constraint’s gradient:

:::equation{#f-lagrange caption="The Lagrange condition for maximising f subject to g = 0."}
$$
\nabla f(\mathbf p^*) = \term{mu}{\mu}\, \nabla g(\mathbf p^*), \qquad g(\mathbf p^*) = 0
$$
:::

```terms
mu:
  label: "$\\mu$ — the Lagrange multiplier"
  what: The factor relating the two gradients at the optimum; one per constraint.
  why: It measures how much the optimal value would improve if the constraint were relaxed slightly — its "price". Equivalently, the optimum is a stationary point of the Lagrangian f − μg over both p and μ.
```

For the n-gram problem, $\nabla f = (c_w / p_w)_w$ and $\nabla g = (1, \ldots, 1)$, so the condition says $c_w / p_w = \mu$ for every $w$. Hence $p_w = c_w / \mu$, and the constraint gives $\mu = N$: the maximum-likelihood estimate is the relative frequency.

::simplex-lagrange

**Inequality constraints**, such as $p_w \ge 0$, lead to the Karush–Kuhn–Tucker (KKT) conditions: each inequality gets a multiplier that must be non-negative, and that is zero unless the constraint is active (holding with equality) at the optimum. Boyd and Vandenberghe’s book is the standard reference :cite[boyd2004]. In deep learning, constraints are more often handled by reparameterisation — a softmax guarantees a valid distribution, so the logits can be optimised freely — or by adding penalties to the loss.

## Further reading

- Léon Bottou, Frank Curtis and Jorge Nocedal, *Optimization Methods for Large-Scale Machine Learning* :cite[bottou2018].
- Jorge Nocedal and Stephen Wright, *Numerical Optimization* :cite[nocedal2006].
- Stephen Boyd and Lieven Vandenberghe, *Convex Optimization* :cite[boyd2004].
- Jeremy Cohen and colleagues, *Gradient Descent on Neural Networks Typically Occurs at the Edge of Stability* :cite[cohen2021].
