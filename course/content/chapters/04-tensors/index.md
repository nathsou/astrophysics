---
number: 4
title: Tensors
summary: Every neural network is arithmetic on arrays. Build the tensor — shape, strides, views, broadcasting, reductions and matrix multiplication — that the rest of the course runs on, and learn why memory layout decides speed.
duration: About 3 hours, including the lab
prerequisites: [n-gram-models, linear-algebra]
builds:
  - Strided tensor with views
  - Broadcasting
  - Reductions and a stable softmax
  - Matrix multiplication
---

Part I built language models from tables of counts. From here on, every model is a **neural network**: a function made of simple arithmetic on large arrays of numbers, with millions of adjustable parameters. Before we can build one, we need the data structure it is made of. In machine learning it is called a **tensor** — an $n$-dimensional array of numbers, together with the operations that act on it.:sidenote[Mathematicians and physicists mean something more specific by “tensor” — a multilinear map with particular transformation rules. In deep learning the word just means “n-dimensional array”.]

This chapter builds the tensor library used in every later chapter, including by CourseGPT’s in-browser inference engine. It is small enough to read in an afternoon, yet it follows the same design as PyTorch. Every operation and gradient is tested against PyTorch itself. The ideas matter more than the code. **Strides** explain why some operations are free and others copy data. **Broadcasting** explains most shape bugs. **Memory layout** explains why the same arithmetic can run at very different speeds.

## What is a tensor?

A tensor has a **shape**: the size of each of its dimensions (also called *axes*). A single number is a 0-d tensor with shape `[]`, a vector of length 5 has shape `[5]`, a 3×4 matrix has shape `[3, 4]`, and so on. Language models use a handful of conventional shapes, named by what each axis means:

| Symbol | Axis | CourseGPT |
|---|---|---|
| $B$ | batch — independent sequences processed together | 32–64 |
| $T$ | time — positions in a sequence (the context length) | 256 |
| $C$ | channels — the width of each position’s vector | 384 |
| $H$ | attention heads | 6 |
| $V$ | vocabulary size | 8,192 |

A batch of token ids has shape $(B, T)$. After the embedding layer (Chapter 7) it becomes $(B, T, C)$, one vector per position. The final layer produces **logits** of shape $(B, T, V)$, a score for every vocabulary item at every position. Memory is the product of the dimensions times four bytes (for 32-bit floats):

:::equation{#bytes caption="Memory of a float32 tensor: four bytes per element."}
$$
\text{bytes} \;=\; 4 \times \term{Bs}{B} \times \term{Ts}{T} \times \term{Cs}{C} \quad\text{for an activation of shape } (B, T, C)
$$
:::

```terms
Bs:
  label: "$B$ — batch size"
  what: How many independent sequences are processed in one step.
  why: Processing many sequences at once keeps the hardware busy and averages the gradient over more examples (Chapter 12).
  effect: Every activation grows linearly with $B$. Memory, not arithmetic, usually limits it.
  param: { key: shape.B, min: 1, max: 128, step: 1, value: 32 }
Ts:
  label: "$T$ — sequence length"
  what: The number of positions (tokens) in each sequence — the context window.
  effect: Most activations grow linearly with $T$, but attention scores grow with $T^2$ — the main obstacle to long contexts (Chapters 10 and 16).
  param: { key: shape.T, min: 16, max: 4096, step: 16, value: 256, log: true }
Cs:
  label: "$C$ — model width"
  what: The length of the vector that represents each position inside the model (also called $d_{\text{model}}$).
  effect: Wider models are more expressive; parameter count grows roughly as $C^2$.
  param: { key: shape.C, min: 64, max: 4096, step: 64, value: 384, log: true }
```

::shape-calculator

With CourseGPT’s settings, the logits tensor is bigger than all the others. Increase $T$ and the attention scores catch up quickly, since they grow as $T^2$. Keep these two facts in mind. They explain a good deal of engineering in Part IV, from fused cross-entropy (Chapter 12) to FlashAttention (Chapter 14).

## Memory layout: strides

Memory is one-dimensional. A tensor’s elements are stored in a single flat buffer, and the tensor records *how to find* element $(i_0, i_1, \ldots)$ in it. The recipe is a list of **strides** — how many buffer positions to skip for one step along each dimension — and an **offset**:

:::equation{#offset caption="The address of a tensor element: an offset plus one stride per index."}
$$
\operatorname{addr}(i_0, \ldots, i_{n-1}) \;=\; \term{o}{o} \;+\; \sum_{k=0}^{n-1} \term{ik}{i_k}\, \term{sk}{s_k}
$$
:::

```terms
o:
  label: "$o$ — offset"
  what: Where the tensor’s first element sits in the buffer.
  why: A slice starting partway through a dimension begins partway through the buffer — no copy needed.
ik:
  label: "$i_k$ — index along dimension $k$"
  what: Which element you want along dimension $k$, from $0$ to $d_k - 1$.
sk:
  label: "$s_k$ — stride of dimension $k$"
  what: How many buffer positions separate neighbouring elements along dimension $k$.
  why: Strides turn any multi-dimensional index into a flat address with one multiply–add per dimension.
  effect: "A stride of 0 repeats the same element (broadcasting); swapping two strides transposes; a stride of 2 skips every other element."
```

For a freshly created tensor the strides are **row-major** (also called C-order): the last index moves fastest. So $s_{n-1} = 1$, and each earlier stride is the product of all later sizes: $s_k = s_{k+1}\,d_{k+1}$. A $2 \times 3 \times 4$ tensor has strides $(12, 4, 1)$.

::stride-explorer

::exercise{id="strides"}

## Views versus copies

Because a tensor is just (buffer, offset, shape, strides), many operations can produce a new tensor that shares the old one’s buffer. It has the same numbers in the same memory, but a different recipe for reading them. These are **views**, and they cost almost nothing:

- **Transpose and permute** reorder the (size, stride) pairs.
- **Slicing** moves the offset and shrinks a size. A step (`::2`) multiplies a stride.
- **Expanding** (broadcasting) sets strides to 0.
- **Reshaping** a *contiguous* tensor recomputes row-major strides for the new shape.

Some things cannot be expressed as a view. The main example is reshaping a tensor whose elements are not in row-major order in memory, such as a transposed matrix: no single set of strides reads it in the new order. Then `reshape` first makes a **contiguous copy**. PyTorch’s `view()` refuses instead of copying, so you notice. Our library follows the same convention.

::exercise{id="views"}

:::breakit
1. In the explorer, a slice and the original share storage. What happens to `x` if you write into a slice of it? In our library: `const s = x.slice(1, 1, 3); s.set(100, 0, 0, 0)` — then look at `x`. This **aliasing** is a feature (in-place updates of parameters) and a notorious source of bugs.
2. What would it mean to write into an *expanded* tensor, where several logical elements share one storage cell? (PyTorch refuses. Why?)
3. Transpose a matrix and pass it to code that assumes contiguous memory (such as the matmul exercise below). What goes wrong, and how would you detect it?
:::

## Broadcasting

Adding a bias vector of shape $(C)$ to activations of shape $(B, T, C)$ should obviously mean “add it to every position”. **Broadcasting** makes that precise, with a rule borrowed from NumPy. Align the shapes on the right. Treat missing leading dimensions as size 1. Then each pair of sizes must be equal, or one of them must be 1. A size-1 dimension is stretched to match — virtually, with stride 0, never by copying.

:::equation{#broadcast caption="The broadcast size of each aligned pair of dimensions."}
$$
d^{\text{out}}_k \;=\; \begin{cases} d^A_k & \text{if } d^B_k = 1 \text{ or } d^A_k = d^B_k \\ d^B_k & \text{if } d^A_k = 1 \\ \text{error} & \text{otherwise} \end{cases}
$$
:::

::broadcast-viz

::exercise{id="broadcast"}

:::warning
Broadcasting is the most common source of *silent* shape bugs. Adding a tensor of shape $(N)$ to one of shape $(N, 1)$ does not raise an error. It broadcasts both to $(N, N)$ and quietly returns $N^2$ numbers where you expected $N$. If a loss is suddenly the wrong magnitude or a model will not train, print the shapes first.
:::

## Element-wise operations and reductions

Most tensor operations fall into three families:

- **Element-wise** operations apply a function to each element — `exp`, `tanh`, `relu` — or to each aligned pair of elements after broadcasting — `add`, `mul`. The output has the broadcast shape.
- **Reductions** combine elements along one or more dimensions — `sum`, `mean`, `max`, `logsumexp` — and remove that dimension from the shape. Or, with `keepdim`, they keep it with size 1 so the result still broadcasts against the input.
- **Contractions** such as matrix multiplication, which multiply and sum at the same time.

**Softmax** combines all three. It turns a vector of scores into a probability distribution, and it is how every model in this course produces $P(x_t \mid x_{<t})$ from its logits:

:::equation{#softmax caption="Softmax, computed stably by subtracting the maximum score first."}
$$
\operatorname{softmax}(\mathbf{z})_j \;=\; \frac{e^{z_j - \term{zmax}{m}}}{\sum_k e^{z_k - m}},
\qquad m = \max_k z_k
$$
:::

```terms
zmax:
  label: "$m$ — the row maximum"
  what: The largest score in the vector being normalised.
  why: Softmax is unchanged by subtracting the same constant from every score (it cancels in the ratio). Subtracting the maximum makes the largest exponent $e^0 = 1$, so nothing can overflow.
  effect: Without it, a logit of 1000 makes `exp` return infinity and the result NaN — a classic failure when training goes unstable.
```

::reduction-viz

::exercise{id="softmax"}

## Matrix multiplication

The single most important operation in a neural network is matrix multiplication. Almost all of a Transformer’s computation is matrix multiplies (Chapter 11), and hardware is judged by how fast it does them.

:::equation{#matmul caption="Matrix multiplication: each output is a dot product of a row and a column."}
$$
\term{Cij}{C_{ij}} \;=\; \sum_{k=1}^{\term{Kd}{K}} A_{ik}\, B_{kj},
\qquad \text{FLOPs} = 2\,\term{Md}{M}\,\term{Nd}{N}\,K
$$
:::

```terms
Cij:
  label: "$C_{ij}$ — one output"
  what: The entry in row $i$, column $j$ of the product $C = AB$.
  why: It is the dot product of row $i$ of $A$ with column $j$ of $B$. In a network, this is one neuron’s weighted sum of its inputs.
Kd:
  label: "$K$ — the shared dimension"
  what: The number of columns of $A$, which must equal the number of rows of $B$. It is summed away.
  effect: Mismatched $K$ is the classic shape error — “mat1 and mat2 shapes cannot be multiplied”.
Md:
  label: "$M$ — rows of the output"
  what: 'For a layer applied to activations, $M = B \times T$: every position of every sequence is a row.'
Nd:
  label: "$N$ — columns of the output"
  what: The layer’s output width.
  effect: "The cost 2MNK counts one multiply and one add per term. A GPT forward pass costs about 2 FLOPs per parameter per token for exactly this reason (Chapter 17)."
```

There are two equally valid ways to picture it, and they correspond to different loop orders:

::matmul-viz

**Batched** matrix multiplication treats all but the last two dimensions as a batch, and those batch dimensions broadcast. $(B, T, C) \cdot (C, N)$ applies one weight matrix to every position of every sequence, giving $(B, T, N)$. $(B, H, T, d) \cdot (B, H, d, T)$ computes attention scores for every head of every sequence at once (Chapter 10).

::exercise{id="matmul"}

### Why loop order changes the speed

Your implementation and the textbook formula perform exactly the same $2MNK$ floating-point operations. Once the matrices no longer fit in the processor’s caches, they differ several-fold in speed, because modern processors are limited less by arithmetic than by **moving data**. Memory is read in *cache lines* of 64 bytes (16 floats) at a time, and a read that misses the cache costs hundreds of arithmetic operations’ worth of time. The textbook $i$-$j$-$k$ order walks down a *column* of $B$ in its inner loop. With row-major storage, every step jumps $N$ floats and lands on a new cache line. The $i$-$k$-$j$ order walks along *rows*, using every float of every cache line it loads.

::matmul-bench

The distinction between computation and data movement runs through the rest of the course. Chapter 8 makes it quantitative with the **roofline model**, and uses shared memory on the GPU to reuse each loaded value many times. FlashAttention (Chapter 14) is the same idea applied to attention.

:::history{year=1962 title="From APL to PyTorch" people="Kenneth Iverson; the BLAS authors; Travis Oliphant; Ronan Collobert, Soumith Chintala, Adam Paszke and others"}
The idea of programming with whole arrays rather than loops goes back to Kenneth Iverson’s *A Programming Language* (1962) :cite[iverson1962], whose notation operated on vectors and matrices directly. For performance, numerical computing standardised on the **BLAS** (Basic Linear Algebra Subprograms, 1979), a fixed interface for vector and matrix kernels that hardware vendors optimise to this day :cite[lawson1979]. Python gained arrays with Numeric (1995) and then NumPy (2006), which fixed the modern conventions: strided views, broadcasting and dtypes :cite[harris2020]. Deep learning libraries grew on top. Torch (2002) :cite[collobert2002] was followed by Theano, TensorFlow and, in 2017, PyTorch :cite[paszke2019], whose eager, NumPy-like tensors with automatic differentiation are the model for this chapter’s library.
:::

## The course tensor library

Everything in this chapter is implemented in `packages/core/src/tensor/`. The API deliberately mirrors PyTorch, so what you learn transfers directly when we switch to PyTorch in Chapter 14:

| Course library | PyTorch | Notes |
|---|---|---|
| `Tensor.from([[1, 2], [3, 4]])` | `torch.tensor([[1, 2], [3, 4]])` | float32 only |
| `Tensor.randn([3, 4], { rng })` | `torch.randn(3, 4, generator=g)` | seeded, reproducible |
| `x.shape`, `x.strides`, `x.offset` | `x.shape`, `x.stride()`, `x.storage_offset()` | |
| `x.reshape(2, -1)`, `x.permute(1, 0)`, `x.T` | same | views where possible |
| `x.slice(1, 0, 4)` | `x[:, 0:4]` | a view |
| `x.add(y)`, `x.mul(2)`, `x.exp()` | `x + y`, `x * 2`, `x.exp()` | broadcasting |
| `x.sum(-1, true)`, `x.max(1)` | `x.sum(-1, keepdim=True)`, `x.max(1).values` | |
| `x.matmul(w)` | `x @ w` | batched, broadcasting |
| `x.softmax(-1)`, `nn.crossEntropy(z, y)` | `x.softmax(-1)`, `F.cross_entropy(z, y)` | |

You may have noticed operations recording something called a `node`, and tensors with a `requiresGrad` flag. That is **automatic differentiation**, the machinery that lets a network learn. Chapter 5 shows why we need gradients; Chapter 6 opens up how the library computes them.

The library is tested operation by operation against PyTorch. `training/lmcourse/fixtures.py` runs 34 operations, from broadcasting adds to a small MLP’s loss, in PyTorch, recording outputs and gradients. `packages/core/src/tensor/parity.test.ts` checks our library reproduces them. For a side-by-side view of strides in NumPy and PyTorch:

```bash
cd training
uv run lmc ch04
```

:::exercises
1. **Sliding windows for free.** Given token ids of shape $(N)$, construct an $(N - n + 1, n)$ tensor whose rows are all the n-grams, as a *view* with strides $(1, 1)$. No copying! Use it to recount Chapter 2’s n-grams, and explain why writing into this view would be dangerous.
2. **`cat` and `stack`.** Add `Tensor.cat(tensors, dim)` and `Tensor.stack(tensors, dim)` to the library, with gradients. (You will need them for Chapter 7; peek at how `slice` handles its backward pass.)
3. **Pretty printing.** Improve `toString()` so large tensors elide rows as well as columns, like PyTorch.
:::

:::challenge
1. **`einsum`.** Implement `einsum('bij,bjk->bik', a, b)` for arbitrary index strings by permuting, reshaping and calling `matmul` (the approach NumPy and PyTorch take for two operands). Most of the tensor contractions in Part III can be written as one `einsum`.
2. **A blocked CPU matmul.** Split the matrices into tiles that fit in cache and multiply tile by tile. How close can you get to your CPU’s peak? Compare with the i-k-j kernel in the benchmark above, then read Goto and van de Geijn’s paper :cite[goto2008] to see how far this goes.
3. **Float16.** Add a `Float16Array`-backed dtype, now supported in modern JavaScript engines. Which operations lose accuracy, and where does a model need float32 to be safe? (Chapter 14 covers mixed precision.)
:::

## Check your understanding

```quiz
q: "A contiguous tensor has shape (2, 3, 4). What are its strides, and what is the offset of element [1, 0, 2]?"
options:
  - text: "strides (12, 4, 1), offset 14"
    correct: true
    why: "1·12 + 0·4 + 2·1 = 14."
  - text: "strides (1, 2, 6), offset 7"
    why: That is column-major (Fortran) order, where the first index moves fastest.
  - text: "strides (4, 3, 2), offset 6"
    why: Strides are products of the *later* sizes, not the sizes themselves.
```

```quiz
q: "Which of these produces a copy of the data rather than a view?"
options:
  - text: "x.transpose(0, 1)"
    why: A transpose only swaps strides.
  - text: "x.transpose(0, 1).reshape(-1)"
    correct: true
    why: The transposed tensor is not contiguous, so flattening it needs its elements rearranged in memory.
  - text: "x.slice(0, 2, 5)"
    why: Slicing moves the offset and shrinks a size — a view.
```

```quiz
q: "What is the shape of a + b if a has shape (8, 1, 6) and b has shape (7, 1)?"
options:
  - text: "(8, 7, 6)"
    correct: true
    why: "Right-aligned: (8, 1, 6) and (_, 7, 1). Pairs are 8/1 → 8, 1/7 → 7, 6/1 → 6."
  - text: "(8, 7, 1)"
    why: The last pair is 6 against 1, which broadcasts to 6.
  - text: "It is an error."
    why: Every aligned pair either matches or contains a 1.
```

## Further reading

- Charles R. Harris et al., *Array programming with NumPy* :cite[harris2020]. The design of strided arrays and broadcasting, from the people who standardised them.
- Edward Z. Yang, *PyTorch internals* :cite[yang2019]. A tour of how PyTorch represents tensors, strides and dispatch — the production version of this chapter.
- Kazushige Goto and Robert van de Geijn, *Anatomy of High-Performance Matrix Multiplication* :cite[goto2008]. How fast matrix multiplication really works on CPUs.
