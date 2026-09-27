---
number: B
title: Calculus & matrix calculus
summary: Derivatives as local linear approximations, Taylor series and curvature, numerical differentiation, gradients, Jacobians and the multivariate chain rule, and the matrix-calculus results behind backpropagation — including the full derivations of the softmax, cross-entropy and layer-normalisation gradients.
duration: About 2 hours
---

Training a neural network means following derivatives downhill (Chapter 5), and backpropagation computes them automatically (Chapter 6). This appendix supplies the mathematics underneath: what a derivative is, how derivatives compose through the chain rule, and how to take derivatives with respect to whole vectors and matrices. It also gives the full derivations of the gradients the course’s library implements. A reader comfortable with single-variable calculus can skim the first two sections.

## Derivatives

The derivative of $f$ at $x$ is the slope of its graph there:

:::equation{#b-derivative caption="The derivative as a limit, and as the best linear approximation."}
$$
f'(x) = \lim_{h \to 0} \frac{f(x + h) - f(x)}{h}, \qquad f(x + h) \;\approx\; f(x) + \term{fp}{f'(x)}\, \term{hh}{h}
$$
:::

```terms
fp:
  label: "$f'(x)$ — the derivative at $x$"
  what: How fast $f$ changes per unit change of its input, at this point.
  why: It is the single number that makes $f(x) + f'(x)h$ the best straight-line approximation to $f$ near $x$. Gradient descent trusts this approximation for one step at a time.
hh:
  label: "$h$ — a small change in the input"
  what: The step away from $x$. The approximation’s error shrinks like $h^2$ as $h \to 0$ (for a smooth function).
  effect: This is why learning rates must be small enough. A large step leaves the region where the linear approximation holds.
```

The second form is the one to remember. A derivative is a **local linear model** of the function: near $x$, $f$ behaves like a straight line with slope $f'(x)$. Everything else in this appendix generalises that idea to more inputs and outputs.

Derivatives of compositions follow from a few rules: **linearity**, $(af + bg)' = af' + bg'$; the **product rule**, $(fg)' = f'g + fg'$; and above all the **chain rule**, $(f \circ g)'(x) = f'(g(x))\, g'(x)$. The derivatives the course uses most are:

| Function | Derivative | Where it appears |
|---|---|---|
| $x^n$ | $n x^{n-1}$ | squared errors, norms |
| $e^x$ | $e^x$ | softmax |
| $\ln x$ | $1/x$ | log-likelihood, cross-entropy |
| $\tanh x$ | $1 - \tanh^2 x$ | the MLP’s hidden layer (Chapter 7), RNNs (Chapter 9) |
| $\sigma(x) = 1/(1 + e^{-x})$ | $\sigma(x)\,(1 - \sigma(x))$ | LSTM gates (Chapter 9), reward models (Chapter 21) |
| $\operatorname{ReLU}(x) = \max(0, x)$ | $1$ if $x > 0$, else $0$ | MLP blocks |
| $\operatorname{GELU}(x) = x\,\Phi(x)$ | $\Phi(x) + x\,\varphi(x)$ | GPT-2’s MLP blocks (Chapter 11) |
| $\operatorname{softplus}(x) = \ln(1 + e^x)$ | $\sigma(x)$ | DPO’s loss (Chapter 21) |

ReLU has no derivative at exactly $0$. Libraries simply pick $0$ there (a *subgradient*), and since hitting exactly $0$ is rare, it makes no practical difference.

## Taylor series and curvature

Adding higher derivatives improves the local approximation:

:::equation{#b-taylor caption="Taylor’s approximation to second order."}
$$
f(x + h) \;=\; f(x) + f'(x)\, h + \tfrac{1}{2} \term{fpp}{f''(x)}\, h^2 + O(h^3)
$$
:::

```terms
fpp:
  label: "$f''(x)$ — the second derivative (curvature)"
  what: How fast the slope itself changes. Positive means the graph curves upwards (like a bowl), negative downwards.
  why: Curvature decides how far a gradient step can safely go. In a sharply curved valley, a step that is fine on flat ground overshoots.
```

::derivative-explorer

Curvature explains the learning-rate limit that every chapter runs into. Take the simplest loss with curvature $\lambda > 0$, $L(w) = \frac{\lambda}{2} w^2$, and one gradient-descent step with learning rate $\eta$: $w \leftarrow w - \eta \lambda w = (1 - \eta\lambda)\, w$. Repeating it converges only if $|1 - \eta\lambda| < 1$, that is, if $\eta < 2/\lambda$. With $\eta$ between $1/\lambda$ and $2/\lambda$ the iterates oscillate but shrink; above $2/\lambda$ they grow without bound. A real loss has many directions with different curvatures, and the sharpest one — the largest eigenvalue of the Hessian, defined below — sets the limit for all of them. Optimisers such as Adam (Chapter 13) exist largely to cope with curvature that varies wildly between directions.

## Numerical derivatives

The limit definition suggests computing derivatives numerically, with a small $h$. The **central difference** $\big(f(x + h) - f(x - h)\big) / 2h$ is much better than the one-sided version: the $h^2$ terms of the two Taylor expansions cancel, so its error falls like $h^2$ rather than $h$. The widget’s second chart shows the catch. Making $h$ too small makes things *worse*, because $f(x + h)$ and $f(x - h)$ agree in almost every digit, and their difference is dominated by rounding error. In float64 the best $h$ for central differences is around $10^{-5}$; in float32 it is around $10^{-2}$ to $10^{-3}$, and even then only three or four digits are right.

This is why **gradient checking** — comparing backpropagated gradients with numerical ones, as Chapter 6’s tests do — uses float64, central differences and a moderate $h$, and compares with a relative tolerance.

## Gradients

A function $f: \mathbb R^n \to \mathbb R$ of many inputs — a loss as a function of all the weights — has a **partial derivative** with respect to each input, taken while holding the others fixed. Collected into a vector, they form the **gradient**:

:::equation{#b-gradient caption="The gradient, and the first-order approximation it gives."}
$$
\nabla f(\mathbf x) = \Big(\tfrac{\partial f}{\partial x_1}, \ldots, \tfrac{\partial f}{\partial x_n}\Big), \qquad f(\mathbf x + \mathbf h) \;\approx\; f(\mathbf x) + \nabla f(\mathbf x) \cdot \mathbf h
$$
:::

The approximation says that the change in $f$ is the dot product of the gradient with the step. By the geometry of dot products (Appendix A), it is largest when the step points *along* the gradient, so the gradient points in the direction of steepest increase and $-\nabla f$ in the direction of steepest decrease. It is zero for steps perpendicular to the gradient, so the gradient is perpendicular to the contour lines of $f$. Chapter 5’s loss-landscape widget shows both facts.

The second derivatives form the **Hessian** matrix $H_{ij} = \partial^2 f / \partial x_i \partial x_j$, which is symmetric for smooth functions. The second-order approximation is $f(\mathbf x + \mathbf h) \approx f(\mathbf x) + \nabla f \cdot \mathbf h + \frac{1}{2}\mathbf h^\top H \mathbf h$. Its eigenvectors are the principal directions of curvature, and its eigenvalues their curvatures. For a network with millions of parameters the Hessian is far too big to store, but products $H\mathbf v$ can be computed at about the cost of two gradients, which is how its top eigenvalue is estimated in practice.

## Jacobians and the chain rule

For a function with vector outputs, $\mathbf f: \mathbb R^n \to \mathbb R^m$, the derivative is a matrix, the **Jacobian** $J_{ij} = \partial f_i / \partial x_j$. It is the best linear approximation: $\mathbf f(\mathbf x + \mathbf h) \approx \mathbf f(\mathbf x) + J\mathbf h$. The chain rule then says that the Jacobian of a composition is the product of the Jacobians:

:::equation{#b-chain caption="The multivariate chain rule: Jacobians multiply."}
$$
\mathbf y = \mathbf f(\mathbf g(\mathbf x)) \quad\Longrightarrow\quad \frac{\partial \mathbf y}{\partial \mathbf x} \;=\; \term{Jf}{\frac{\partial \mathbf f}{\partial \mathbf g}}\; \term{Jg}{\frac{\partial \mathbf g}{\partial \mathbf x}}
$$
:::

```terms
Jf:
  label: "$\\partial \\mathbf f / \\partial \\mathbf g$ — the Jacobian of the outer function"
  what: An $m \times k$ matrix of how each output of $\\mathbf f$ responds to each of its $k$ inputs, evaluated at $\\mathbf g(\\mathbf x)$.
Jg:
  label: "$\\partial \\mathbf g / \\partial \\mathbf x$ — the Jacobian of the inner function"
  what: A $k \\times n$ matrix.
  why: "Composition of maps is multiplication of their linear approximations: the same fact as “matrix multiplication is composition” in Appendix A."
```

A network is a long composition, so its derivative is a long product of Jacobians. For a scalar loss $L$, the product has a single row, $\partial L / \partial \mathbf x = \frac{\partial L}{\partial \mathbf y_K} J_K J_{K-1} \cdots J_1$. The order of evaluation matters enormously. Evaluated from the left, each step multiplies a *row vector* by a Jacobian — a **vector–Jacobian product** (VJP), costing about as much as the forward computation. This is **reverse mode**, or backpropagation. Evaluated from the right, each step multiplies a Jacobian by a matrix with $n$ columns, $n$ times the work. That is **forward mode**, which is efficient only when there are few inputs and many outputs :cite[baydin2018,griewank2008].

Reverse mode never needs to build a Jacobian. Each operation only needs a rule that maps the gradient of its output, $\bar{\mathbf y} = \partial L / \partial \mathbf y$, to the gradient of its input, $\bar{\mathbf x} = \bar{\mathbf y}\, J$. This is exactly the `backward` function each operation records in Chapter 6. The rest of this appendix derives those rules.

## Matrix calculus

**Convention.** For a scalar loss $L$ and a variable $X$ of any shape, $\bar X = \partial L / \partial X$ has *the same shape as $X$*, with $\bar X_{ij} = \partial L / \partial X_{ij}$. Gradients can then be added to parameters, and shapes are a built-in check on every derivation.

**Technique.** Index notation always works: write the operation with explicit sums, differentiate one entry, and recognise the result as a matrix expression. Take $Y = XW$ with $X$ of shape $(B, n)$ and $W$ of shape $(n, m)$, so that $Y_{bj} = \sum_i X_{bi} W_{ij}$. Then

$$
\frac{\partial L}{\partial W_{ij}} = \sum_{b, j'} \frac{\partial L}{\partial Y_{bj'}} \frac{\partial Y_{bj'}}{\partial W_{ij}} = \sum_b \bar Y_{bj} X_{bi} = (X^\top \bar Y)_{ij},
$$

and in the same way $\bar X = \bar Y W^\top$. Checking shapes confirms both: $X^\top \bar Y$ is $(n, B)(B, m) = (n, m)$, like $W$.

The results the course’s library uses:

| Forward | Backward (given $\bar Y$) | Notes |
|---|---|---|
| $Y = XW$ | $\bar X = \bar Y W^\top$, $\ \bar W = X^\top \bar Y$ | the linear layer; two matmuls |
| $Y = X + \mathbf b$ (broadcast over rows) | $\bar X = \bar Y$, $\ \bar{\mathbf b} = \sum_{\text{rows}} \bar Y$ | broadcasting ↔ summing |
| $Y = f(X)$ element-wise | $\bar X = \bar Y \odot f'(X)$ | $\odot$ is element-wise product |
| $Y = X \odot Z$ | $\bar X = \bar Y \odot Z$, $\ \bar Z = \bar Y \odot X$ | |
| $s = \sum_{ij} X_{ij}$ | $\bar X = \bar s\, \mathbf 1$ | reductions ↔ broadcasting |
| $Y = X^\top$, reshape, slice | move $\bar Y$ back to where the values came from | no arithmetic |
| $Y = \text{rows } \mathbf i \text{ of } C$ (embedding) | $\bar C_{v} = \sum_{t : i_t = v} \bar Y_t$ | scatter-add (Chapter 7) |

A useful sanity check: summation and broadcasting are each other’s transposes, and so are gathering and scatter-adding. Whatever an operation does to *values* in the forward pass, its backward pass does the transpose to *gradients*.

## Softmax

Now the derivation Chapter 6 promised. Softmax maps logits $\mathbf x \in \mathbb R^V$ to probabilities $y_i = e^{x_i} / \sum_k e^{x_k}$. Differentiating the quotient:

- for $j = i$: $\ \dfrac{\partial y_i}{\partial x_i} = \dfrac{e^{x_i} \sum_k e^{x_k} - e^{x_i} e^{x_i}}{(\sum_k e^{x_k})^2} = y_i - y_i^2$;
- for $j \ne i$: $\ \dfrac{\partial y_i}{\partial x_j} = \dfrac{-e^{x_i} e^{x_j}}{(\sum_k e^{x_k})^2} = -y_i y_j$.

Both cases fit in one formula, and the vector–Jacobian product follows:

:::equation{#b-softmax caption="The softmax Jacobian, and the backward rule that avoids building it."}
$$
\frac{\partial y_i}{\partial x_j} = y_i\,(\delta_{ij} - y_j), \qquad \bar x_j = \sum_i \bar y_i\, y_i (\delta_{ij} - y_j) = y_j \Big( \bar y_j - \term{inner}{\textstyle\sum_i \bar y_i y_i} \Big)
$$
:::

```terms
inner:
  label: "$\\langle \\bar{\\mathbf y}, \\mathbf y \\rangle$ — the upstream gradient averaged under the output distribution"
  what: "One number per row: $\\sum_i \\bar y_i y_i$."
  why: Subtracting it from $\\bar{\\mathbf y}$ removes the component that would change all probabilities together, which is impossible since they must sum to one.
  effect: "So $\\bar{\\mathbf x} = \\mathbf y \\odot (\\bar{\\mathbf y} - \\langle \\bar{\\mathbf y}, \\mathbf y\\rangle)$ costs $O(V)$ instead of the $O(V^2)$ of a Jacobian — the difference between feasible and not for a 50,000-token vocabulary."
```

Here $\delta_{ij}$ is 1 when $i = j$ and 0 otherwise. In vector form, $\bar{\mathbf x} = \mathbf y \odot (\bar{\mathbf y} - \langle \bar{\mathbf y}, \mathbf y \rangle)$.

**With cross-entropy.** The loss for target class $t$ is $L = -\ln y_t$, so $\bar y_i = -1/y_t$ for $i = t$ and $0$ otherwise. Then $\langle \bar{\mathbf y}, \mathbf y \rangle = -1$, and

$$
\bar x_j = y_j\,\big(\bar y_j + 1\big) = \begin{cases} y_t\,(1 - 1/y_t) = y_t - 1 & j = t \\ y_j & j \ne t \end{cases} \qquad\Longrightarrow\qquad \bar{\mathbf x} = \mathbf y - \mathbf e_t.
$$

The gradient of cross-entropy with respect to the logits is *predicted probabilities minus the one-hot target*. It is bounded, cheap, and numerically benign, which is why every library fuses the two operations (Chapter 5).

::softmax-jacobian

**Log-sum-exp.** The same calculation shows that the gradient of $\operatorname{LSE}(\mathbf x) = \ln \sum_k e^{x_k}$ is $\operatorname{softmax}(\mathbf x)$. Since $\ln y_t = x_t - \operatorname{LSE}(\mathbf x)$, the result above follows again in one line.

## Layer normalisation

LayerNorm (Chapter 7) standardises each row $\mathbf x \in \mathbb R^d$: $\mu = \frac{1}{d}\sum_i x_i$, $\sigma^2 = \frac{1}{d}\sum_i (x_i - \mu)^2$, $\hat x_i = (x_i - \mu)/\sqrt{\sigma^2 + \epsilon}$, and $y_i = \gamma_i \hat x_i + \beta_i$. The parameter gradients are simple: $\bar{\boldsymbol\gamma} = \sum_{\text{rows}} \bar{\mathbf y} \odot \hat{\mathbf x}$ and $\bar{\boldsymbol\beta} = \sum_{\text{rows}} \bar{\mathbf y}$. For the input, let $\mathbf g = \bar{\mathbf y} \odot \boldsymbol\gamma$ be the gradient reaching $\hat{\mathbf x}$, and $s = \sqrt{\sigma^2 + \epsilon}$. Both $\mu$ and $\sigma$ depend on every $x_i$, so the chain rule contributes three terms. They collect into

:::equation{#b-layernorm caption="The LayerNorm input gradient: centre the incoming gradient, and remove its component along x̂."}
$$
\bar{\mathbf x} \;=\; \frac{1}{s}\Big( \mathbf g \;-\; \overline{\mathbf g}\,\mathbf 1 \;-\; \hat{\mathbf x}\;\overline{\mathbf g \odot \hat{\mathbf x}} \Big), \qquad \overline{\mathbf v} = \tfrac{1}{d}\textstyle\sum_i v_i
$$
:::

The form makes sense. Adding a constant to every $x_i$ changes nothing after normalisation, so $\bar{\mathbf x}$ must have zero mean. Scaling $\mathbf x$ changes nothing either, so $\bar{\mathbf x}$ must be orthogonal to $\hat{\mathbf x}$. The two subtracted terms enforce exactly those constraints. The course’s library composes LayerNorm from primitive operations and lets autograd find this gradient; a fused kernel (Chapter 12) implements the formula directly.

## Integrals, briefly

Integrals appear in the course mainly as **expectations** of continuous random variables, $\mathbb E[f(X)] = \int f(x)\, p(x)\, dx$ (Appendix C). One integral is worth knowing by heart: the Gaussian, $\int_{-\infty}^{\infty} e^{-x^2/2}\, dx = \sqrt{2\pi}$, which sets the normalising constant of the normal distribution. In practice we almost never integrate analytically. We estimate expectations by averaging over samples (Monte Carlo), and a minibatch loss is exactly such an estimate of the expected loss.

## Further reading

- Terence Parr and Jeremy Howard, *The Matrix Calculus You Need for Deep Learning* :cite[parr2018]. A gentle, complete treatment in the notation of this appendix.
- Kaare Brandt Petersen and Michael Syskind Pedersen, *The Matrix Cookbook* :cite[petersen2012]. The reference for identities.
- Atılım Güneş Baydin and colleagues, *Automatic Differentiation in Machine Learning: a Survey* :cite[baydin2018].
- Jan Magnus and Heinz Neudecker, *Matrix Differential Calculus* :cite[magnus2019]. The rigorous version, via differentials.
