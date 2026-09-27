---
number: 6
title: Automatic differentiation
summary: How a library computes the gradient of any program you write — computational graphs, the chain rule, reverse-mode back-propagation and forward-mode dual numbers — built first for scalars, then for tensors.
duration: About 3 hours, including the lab
prerequisites: [learning-as-optimisation, calculus]
builds:
  - Scalar autograd engine
  - Forward-mode dual numbers
  - Tensor backward rules (VJPs)
---

In Chapter 5 we derived the gradient of the neural bigram model by hand: softmax, then cross-entropy, then a row lookup. Three steps, one line of calculus each. CourseGPT has dozens of layers, each made of matrix multiplies, normalisations, attention and non-linearities — millions of operations per training step. Nobody derives that gradient by hand. Instead, the tensor library records what the program computed and differentiates it **automatically**, exactly, at a cost comparable to running the program once.

This chapter opens up that machinery. The idea is simple: the chain rule, applied systematically to a graph of operations. The implementation is about fifty lines. It is the single most important algorithm in deep learning.

## Three ways to differentiate a program

| Method | How | Accuracy | Cost for $P$ parameters |
|---|---|---|---|
| **Symbolic** | Manipulate the formula, as a computer-algebra system does | exact | expressions can blow up exponentially (“expression swell”) |
| **Numerical** | Finite differences, $\frac{f(\theta + \varepsilon) - f(\theta - \varepsilon)}{2\varepsilon}$ | approximate | $2P$ evaluations of $f$ |
| **Automatic** | Apply the chain rule to the operations the program actually executed | exact up to rounding | about 2–3 evaluations of $f$ |

Numerical differentiation is still indispensable for *checking* gradients — you implemented it in Chapter 5 — but it is hopeless for training. It needs two evaluations per parameter, and its accuracy depends delicately on the step size:

::fd-error

## Computational graphs and the chain rule

Any computation can be written as a **computational graph**: each node is an intermediate value, produced by a primitive operation (add, multiply, tanh…) from its parent nodes. For a single path, the chain rule multiplies local derivatives: if $L = f(g(x))$ then $\frac{dL}{dx} = f'(g(x))\,g'(x)$. When a value influences the output along several paths, its derivative is the **sum over paths**:

:::equation{#chain caption="The multivariate chain rule on a graph: sum over the children of v."}
$$
\frac{\partial L}{\partial \term{v}{v}} \;=\; \sum_{\term{c}{c}\, \in\, \operatorname{children}(v)} \term{gc}{\frac{\partial L}{\partial c}} \; \term{loc}{\frac{\partial c}{\partial v}}
$$
:::

```terms
v:
  label: "$v$ — any intermediate value"
  what: A node of the computational graph — an input, a parameter, or the result of an operation.
c:
  label: "$c$ — a child of $v$"
  what: A node computed directly from $v$ (among other inputs).
  why: The loss depends on $v$ only through its children, so its sensitivity is assembled from theirs.
gc:
  label: "$\\partial L / \\partial c$ — the child's gradient (its *adjoint*)"
  what: How much the loss changes per unit change in the child.
  why: If we process nodes from the output backwards, every child's adjoint is already known when we reach $v$.
loc:
  label: "$\\partial c / \\partial v$ — local derivative"
  what: The derivative of one primitive operation with respect to one of its inputs, e.g. $\partial(uv)/\partial u = v$ or $\partial \tanh(u)/\partial u = 1 - \tanh^2 u$.
  why: Each primitive only needs to know its own derivative. The graph takes care of composing them.
  effect: A local derivative near zero (a saturated tanh, a negative ReLU input) blocks gradient flow through that edge — the root of the vanishing-gradient problem (Chapters 7 and 9).
```

Step through it yourself. Pick an expression, drag the inputs, compute values forwards, then gradients backwards, and hover any node to see the chain rule written out with numbers:

::graph-viz

The *Used twice* example is the one that trips people up. $x$ feeds both the multiplication and the addition, so its gradient is a sum of two contributions, $2x + 1$. An implementation that *assigns* gradients instead of *accumulating* them gets this wrong.

## Reverse mode: back-propagation

The chain rule on a graph suggests an algorithm. Evaluate the graph forwards, storing every intermediate value. Then visit the nodes in **reverse topological order** — the output first, and every node only after all of its children. Along the way, accumulate each node’s adjoint $\bar v = \partial L / \partial v$:

1. **Forward pass.** Compute every node, recording its inputs and the operation that produced it (the “tape”).
2. **Seed.** Set $\bar L = 1$: the loss changes one-for-one with itself.
3. **Backward pass.** For each node $c$ in reverse topological order, and each parent $v$ of $c$: add $\bar c \cdot \partial c / \partial v$ into $\bar v$.

This is **reverse-mode automatic differentiation**. Applied to neural networks it is called **back-propagation**. One backward pass gives the derivative of a single output (the loss) with respect to *every* input and parameter at once, for a small constant multiple of the cost of the forward pass. Differentiating a program is essentially no harder than running it — the fact that makes training networks with billions of parameters possible.

::exercise{id="value-engine"}

:::breakit
In your engine, change one `+=` in a `backwardFn` to `=`. Which tests fail, and which expressions in the graph widget above would give wrong gradients? Now reverse the topological order in `backward()` (walk it forwards instead). What goes wrong, and why does the order matter even though every node is eventually visited?
:::

## Forward mode: dual numbers

There is a second way to organise the same chain rule. Instead of propagating *adjoints* backwards from the output, propagate **tangents** forwards from one input. The tangent $\dot v = \partial v / \partial x$ records how much each node changes per unit change in a chosen input $x$:

:::equation{#forward caption="Forward mode: tangents flow from the inputs, parent by parent."}
$$
\dot v \;=\; \sum_{p \,\in\, \operatorname{parents}(v)} \frac{\partial v}{\partial p}\, \dot p,
\qquad \dot x = 1
$$
:::

An elegant implementation uses **dual numbers**, $a + b\varepsilon$ with $\varepsilon^2 = 0$. Arithmetic on them carries value and derivative together: $(a + b\varepsilon)(c + d\varepsilon) = ac + (ad + bc)\varepsilon$ is exactly the product rule. Evaluate $f$ on $x + 1\varepsilon$ and the $\varepsilon$ coefficient of the result is $f'(x)$.

::exercise{id="dual-numbers"}

Which mode should a library use? For a function with $n$ inputs and $m$ outputs, forward mode needs one pass *per input* to get all derivatives, while reverse mode needs one pass *per output*:

| | Forward mode (tangents) | Reverse mode (adjoints) |
|---|---|---|
| One pass computes | a Jacobian–vector product $J\mathbf u$ | a vector–Jacobian product $\mathbf u^\top J$ |
| Passes for the full Jacobian | $n$ (one per input) | $m$ (one per output) |
| Extra memory | none — no tape | all intermediate values |
| Neural network training | $n$ = millions of parameters, so millions of passes | $m$ = 1 loss, so **one pass** |

Training has one scalar loss and a vast number of parameters, so reverse mode wins overwhelmingly — at the price of storing the forward pass’s intermediate values. Forward mode still has uses, such as combining the two to compute Hessian–vector products cheaply.

## From scalars to tensors

The scalar engine creates a node for every single multiplication. A matrix multiply of two $1000 \times 1000$ matrices would create a billion nodes. Real libraries, including ours, work at the level of **tensor operations**: one node per operation, whose backward rule is a **vector–Jacobian product (VJP)** mapping the output’s gradient tensor to each input’s gradient tensor. The Jacobian itself — which for a $1000\times1000$ matmul has $10^{12}$ entries — is never formed. The important rules:

:::equation{#vjp-matmul caption="The backward pass of matrix multiplication: two more matrix multiplications."}
$$
C = AB \quad\Longrightarrow\quad \term{dA}{\bar A} = \bar C\, B^{\top}, \qquad \bar B = A^{\top} \bar C
$$
:::

```terms
dA:
  label: "$\\bar A$ — gradient with respect to $A$"
  what: "$\\partial L / \\partial A$, a matrix of the same shape as $A$."
  why: "Each $A_{ik}$ affects the whole of row $i$ of $C$, with weights $B_{kj}$ — summing over $j$ gives $\\sum_j \\bar C_{ij} B_{kj}$, which is $(\\bar C B^\\top)_{ik}$."
  effect: The backward pass of a matmul costs two matmuls, which is why a training step costs roughly three times a forward pass (Chapter 17).
```

- **Element-wise** operations multiply the incoming gradient element-wise by the local derivative: $\bar x = \bar y \odot f'(x)$.
- **Broadcasting** copies values, so its backward pass **sums**: a bias added to every row receives the sum of all the rows’ gradients.
- **Sums and means** are the reverse: their backward pass broadcasts the gradient back to the input’s shape.
- **Reshapes, transposes and slices** move gradients back to where the values came from.
- **Softmax**: $\bar{\mathbf x} = \mathbf y \odot (\bar{\mathbf y} - \langle \bar{\mathbf y}, \mathbf y\rangle)$ — derived in Appendix B.

::exercise{id="matmul-backward"}

::exercise{id="unbroadcast"}

Here is the heart of the course library’s implementation — the tensor-level version of your `backward()`:

```ts title="packages/core/src/tensor/tensor.ts (simplified excerpt)"
backward(grad?: Tensor): void {
  const order: Tensor[] = [];                   // topological order by depth-first search
  const seen = new Set<Tensor>();
  const visit = (t: Tensor) => {
    if (seen.has(t)) return;
    seen.add(t);
    for (const p of t.node?.parents ?? []) if (p.requiresGrad) visit(p);
    order.push(t);
  };
  visit(this);

  const grads = new Map<Tensor, Tensor>([[this, grad ?? Tensor.ones(this.shape)]]);
  noGrad(() => {                                // the backward pass itself is not recorded
    for (let i = order.length - 1; i >= 0; i--) {
      const t = order[i]!;
      const g = grads.get(t);
      if (!g) continue;
      if (!t.node) {                            // a leaf (parameter): accumulate into .grad
        t.grad = t.grad ? t.grad.add(g) : g;
        continue;
      }
      const parentGrads = t.node.backward(g);   // the operation's VJP
      t.node.parents.forEach((p, j) => {
        const gp = parentGrads[j];
        if (gp && p.requiresGrad) grads.set(p, grads.has(p) ? grads.get(p)!.add(gp) : gp);
      });
    }
  });
}
```

Every operation in `tensor.ts` and `nn.ts` records its parents and a VJP closure. The repository’s parity tests check the gradients against PyTorch’s in 34 cases, from a broadcast add to the loss of a small MLP.

## Memory: the price of reverse mode

Reverse mode needs the forward pass’s intermediate values — the tanh outputs, the softmax probabilities, the inputs to every matmul — to evaluate local derivatives on the way back. So training a network needs far more memory than running it. For CourseGPT’s settings, the stored activations for one batch exceed the size of the model several times over. Two standard remedies appear later in the course. **Activation checkpointing** stores only some intermediate values and recomputes the rest during the backward pass, trading about a third more compute for much less memory (Chapter 14). **Fused kernels** such as the course library’s `crossEntropy` avoid storing large intermediates altogether: its backward pass needs only the softmax probabilities, not a stored `log` and one-hot tensor.

:::history{year=1970 title="Who invented back-propagation?" people="Robert Wengert; Seppo Linnainmaa; Paul Werbos; David Rumelhart, Geoffrey Hinton and Ronald Williams"}
Automatic differentiation was invented several times. Robert Wengert described the forward mode in 1964 :cite[wengert1964]. The reverse mode — the modern algorithm, including its efficiency argument — appeared in Seppo Linnainmaa’s 1970 master’s thesis in Helsinki, as a way to estimate accumulated rounding errors, and was published in 1976 :cite[linnainmaa1976]. Paul Werbos proposed using it to train neural networks in his 1974 PhD thesis and developed the idea in the early 1980s :cite[werbos1982]. It reached a wide audience in 1986, when David Rumelhart, Geoffrey Hinton and Ronald Williams showed in *Nature* that back-propagation lets networks learn useful internal representations :cite[rumelhart1986]. Andreas Griewank’s textbook gives the history and theory of the field :cite[griewank2008]. Libraries that differentiate arbitrary programs in the host language — autograd for NumPy :cite[maclaurin2015], then PyTorch and JAX — are what made today’s rapid experimentation possible.
:::

## Lab: the graph in PyTorch

PyTorch builds the same graph as our library. You can walk it through each tensor’s `grad_fn`:

```bash
cd training
uv run lmc ch06
```

It prints the backward graph of $\tanh(wx + b)$ — `TanhBackward0 → AddBackward0 → MulBackward0 → AccumulateGrad` — and checks the gradients against the values in the graph widget above.

:::exercises
1. **More operations.** Add `relu`, `div` and `log` to your `Value` engine, and use it to reproduce the *Logistic loss* example in the graph widget.
2. **A neural network from scalars.** Build a two-layer MLP out of `Value`s (a `Neuron` class with weights and bias, a `Layer`, an `MLP`) and train it with SGD to classify the four XOR points. Count how many `Value` nodes one forward pass creates — and why tensor-level autograd matters.
3. **Detect in-place hazards.** Our library does not notice if you modify a tensor’s storage after it was used in the forward pass (for example, an SGD update before calling `backward()`). Add a version counter to tensors, increment it on in-place writes, and make `backward()` raise an error if a saved input changed — as PyTorch does.
:::

:::challenge
1. **Higher-order gradients.** Our backward pass runs under `noGrad`, so gradients are not themselves differentiable. Remove that restriction (build the backward computations as a graph too) and compute a second derivative of $\tanh$. What does this cost in memory?
2. **Hessian–vector products.** Compute $H\mathbf v$ for the loss of a small network by forward-over-reverse: push dual numbers through your back-propagation code. Compare with finite differences of the gradient.
3. **Checkpointing.** Implement `checkpoint(fn)`: run `fn` in `noGrad` during the forward pass, then re-run it with gradients during backward. Measure the memory saved on a deep stack of layers.
:::

## Check your understanding

```quiz
q: "For y = x·x + x at x = 3, why does an autograd engine that assigns (=) rather than accumulates (+=) gradients get dy/dx wrong?"
options:
  - text: The multiplication rule is applied incorrectly.
    why: Each local derivative is fine; the problem is combining them.
  - text: "x has two paths to y (through x·x and directly), and its gradient must be the sum of both contributions; assignment keeps only the last one."
    correct: true
    why: The multivariate chain rule sums over children. The correct answer is 2x + 1 = 7.
  - text: The topological order is wrong.
    why: Order matters, but it is not what breaks here.
```

```quiz
q: "A function has 3 inputs and 10,000 outputs. Which mode computes its full Jacobian with fewer passes?"
options:
  - text: "Forward mode: 3 passes."
    correct: true
    why: Forward mode needs one pass per input; reverse mode would need one per output (10,000).
  - text: "Reverse mode: 1 pass."
    why: One reverse pass gives the gradient of one output. There are 10,000 outputs.
  - text: They are the same.
    why: Their costs scale with different dimensions.
```

```quiz
q: "In the forward pass a bias of shape (C) is added to activations of shape (B, T, C). What is the gradient of the loss with respect to the bias?"
options:
  - text: The incoming gradient, reshaped to (C).
    why: It has B·T·C elements; the bias has only C.
  - text: "The incoming gradient summed over the B and T dimensions."
    correct: true
    why: The bias was broadcast (copied) to every position, so each position's gradient contributes to it.
  - text: The mean of the incoming gradient over B and T.
    why: A copy's gradient is a sum, not a mean. (If the loss itself is a mean, that division is already in the incoming gradient.)
```

## Further reading

- Atılım Güneş Baydin, Barak Pearlmutter, Alexey Radul and Jeffrey Siskind, *Automatic differentiation in machine learning: a survey* :cite[baydin2018]. The best single overview.
- Andrej Karpathy, *micrograd* :cite[karpathy2020micrograd]. The ~100-line scalar engine that inspired this chapter’s exercise.
- Christopher Olah, *Calculus on Computational Graphs: Backpropagation* :cite[olah2015]. A short, visual explanation of forward versus reverse mode.
