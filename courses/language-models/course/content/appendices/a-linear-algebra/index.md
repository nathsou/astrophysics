---
number: A
title: Linear algebra
summary: The linear algebra a language model is made of — vectors and dot products, matrices as transformations, the four views of matrix multiplication, rank and low-rank structure, eigenvectors, the singular value decomposition and principal component analysis — with the conventions the course uses in code.
duration: About 2 hours
---

A language model is, to a first approximation, a long chain of matrix multiplications with a few simple functions in between. Tokens become vectors (embeddings). Every layer multiplies vectors by learned matrices. Attention compares vectors with dot products. And the tools we use to look inside a trained model — projections, principal components, low-rank structure — are linear algebra too. This appendix covers what the course uses, with the geometric picture behind each idea. For a full treatment, Gilbert Strang’s textbook is the classic :cite[strang2016]. Grant Sanderson’s *Essence of Linear Algebra* videos are the best way to build intuition :cite[sanderson2016].

## Vectors

A **vector** $\mathbf x \in \mathbb R^d$ is a list of $d$ real numbers. It can be read in two ways, and both are useful. It is a *point* (or an arrow from the origin) in $d$-dimensional space; an embedding places each token somewhere in that space. It is also simply an *array*, `Float32Array(d)` in our code. Vectors add element-wise and scale by numbers, and every other operation in this appendix is built from those two.

The **dot product** multiplies matching entries and adds them up. It has an algebraic definition and a geometric meaning:

:::equation{#a-dot caption="The dot product: a sum of products, and a measure of alignment."}
$$
\mathbf x \cdot \mathbf y \;=\; \sum_{i=1}^{d} x_i\, y_i \;=\; \term{norm}{\lVert \mathbf x \rVert}\,\lVert \mathbf y \rVert \cos \term{theta}{\theta}
$$
:::

```terms
norm:
  label: "$\\lVert \\mathbf x \\rVert$ — the length (Euclidean norm) of $\\mathbf x$"
  what: "$\\sqrt{\\mathbf x \\cdot \\mathbf x} = \\sqrt{\\sum_i x_i^2}$, the distance from the origin to the point $\\mathbf x$."
  why: It separates a vector’s size from its direction. Weight decay (Chapter 13) penalises the squared norm of the weights.
theta:
  label: "$\\theta$ — the angle between $\\mathbf x$ and $\\mathbf y$"
  what: The angle between the two arrows, in the plane that contains them.
  effect: "$\\cos\\theta = 1$ when they point the same way, $0$ when perpendicular (orthogonal), $-1$ when opposite."
```

Dividing out the lengths gives the **cosine similarity** $\cos\theta = \mathbf x \cdot \mathbf y / (\lVert \mathbf x \rVert \lVert \mathbf y \rVert)$. This is how Chapter 7 finds a character’s nearest neighbours among the embeddings, and how retrieval systems compare documents (Chapter 23). Attention scores (Chapter 10) are dot products between a *query* and every *key*: large when they align, small or negative when they don’t.

Other **norms** measure size differently. $\lVert \mathbf x \rVert_1 = \sum_i |x_i|$ is the Manhattan length. $\lVert \mathbf x \rVert_\infty = \max_i |x_i|$ is the largest entry, which is what matters for overflow and quantisation (Chapter 16). For a matrix, the **Frobenius norm** $\lVert A \rVert_F = \sqrt{\sum_{ij} A_{ij}^2}$ treats it as one long vector.

The **projection** of $\mathbf x$ onto a unit vector $\mathbf u$ is $(\mathbf x \cdot \mathbf u)\, \mathbf u$: the closest point to $\mathbf x$ on the line through $\mathbf u$. Projection appears everywhere: in PCA below, in the “logit lens” of interpretability (Chapter 26), and in every layer’s output weights, which project a hidden state onto thousands of directions at once.

## Matrices are transformations

A matrix $A \in \mathbb R^{m \times n}$ is a grid of numbers. More usefully, it is a **linear map** from $\mathbb R^n$ to $\mathbb R^m$: $\mathbf x \mapsto A\mathbf x$. “Linear” means that $A(\mathbf x + \mathbf y) = A\mathbf x + A\mathbf y$ and $A(c\mathbf x) = c\,A\mathbf x$. Because of this, a matrix is completely determined by what it does to the basis vectors. The $j$-th column of $A$ is exactly $A\mathbf e_j$, where the vector with a 1 in position $j$ lands. Straight lines stay straight, the origin stays put, and grids stay evenly spaced.

::matrix-transform

The **determinant** $\det A$ of a square matrix is the factor by which it scales areas (volumes, in higher dimensions), with a negative sign if it flips orientation. A determinant of zero means the matrix squashes space into a lower dimension, so some information is lost for good and the matrix has no inverse.

:::note
**Row vectors in code.** Mathematics usually treats $\mathbf x$ as a column and writes $A\mathbf x$. The course’s code, like PyTorch and most deep-learning code, stores a batch of inputs as the *rows* of a matrix $X$ of shape (batch, features) and writes $XW$, with $W$ of shape (in, out). The two conventions are transposes of each other: $XW = (W^\top X^\top)^\top$. So in code, the $j$-th *row* of $W$ is where the $j$-th input feature goes. (PyTorch’s `nn.Linear` stores its weight as (out, in) and computes $XW^\top$, a third arrangement of the same thing.)
:::

## Matrix multiplication, four ways

The product $C = AB$ of an $(m \times k)$ and a $(k \times n)$ matrix is the composition of the two maps: first $B$, then $A$. Its entries are $C_{ij} = \sum_{t} A_{it} B_{tj}$. The same product can be read in four ways, and each view explains something in the course:

1. **Dot products.** $C_{ij}$ is the dot product of row $i$ of $A$ with column $j$ of $B$. Attention scores $QK^\top$ are all query–key dot products at once.
2. **Combinations of columns.** Column $j$ of $C$ is a weighted sum of $A$’s columns, with weights from column $j$ of $B$. An attention layer’s output is a weighted sum of value vectors in this sense.
3. **Combinations of rows.** Row $i$ of $C$ is a weighted sum of $B$’s rows, with weights from row $i$ of $A$. Multiplying a one-hot row vector by an embedding matrix picks out one row — which is why an embedding lookup *is* a matrix product, just computed efficiently.
4. **A sum of outer products.** $C = \sum_t \mathbf a_{:t}\, \mathbf b_{t:}$, one rank-one matrix per index $t$. This is the view behind low-rank methods such as LoRA (Chapter 20), and behind the tiled kernels of Chapter 8, which accumulate one slice of $t$ at a time.

Computing $C$ takes $mnk$ multiply–adds, or $2mnk$ floating-point operations. This count is the unit of cost in every scaling calculation in the course (Chapters 14 and 17). Multiplication is **associative**, $(AB)C = A(BC)$, but the two orders can cost very different amounts. It is **not commutative**: $AB \ne BA$ in general. Transposition reverses the order: $(AB)^\top = B^\top A^\top$. That rule is why the backward pass of $Y = XW$ involves $W^\top$ and $X^\top$ (Chapter 6).

## Special matrices

| Matrix | Definition | Where it appears |
|---|---|---|
| Identity $I$ | $I\mathbf x = \mathbf x$ | residual connections: $\mathbf x + f(\mathbf x) = (I + f)(\mathbf x)$ (Chapter 11) |
| Diagonal | only $A_{ii} \ne 0$; scales each coordinate | LayerNorm’s $\gamma$; Adam’s per-parameter step sizes |
| Orthogonal $Q$ | $Q^\top Q = I$; preserves lengths and angles | rotations; rotary position embeddings (Chapter 18) |
| Symmetric | $A = A^\top$ | covariance matrices; Hessians (Appendix B) |
| Lower-triangular | $A_{ij} = 0$ for $j > i$ | the causal attention mask (Chapter 10) |
| Permutation | reorders coordinates | sorting; routing tokens to experts (Chapter 19) |
| Rank one | $\mathbf u \mathbf v^\top$ | the building block of low-rank updates |

## Rank and low-rank structure

The **rank** of a matrix is the number of linearly independent columns — equivalently, of rows. It is also the dimension of the space the map’s outputs can fill. An $m \times n$ matrix has rank at most $\min(m, n)$, and a product has rank at most the smaller rank of its factors: $\operatorname{rank}(AB) \le \min(\operatorname{rank} A, \operatorname{rank} B)$.

That inequality has practical consequences. A matrix $W = AB$ with $A \in \mathbb R^{m \times r}$ and $B \in \mathbb R^{r \times n}$ has rank at most $r$, but it needs only $r(m + n)$ parameters instead of $mn$. Attention heads are built like this: each head’s query–key product $W_Q W_K^\top$ has rank at most the head dimension. LoRA (Chapter 20) fine-tunes a model by learning low-rank *updates* $\Delta W = AB$. And the softmax output layer limits what a language model can express: its logits for all contexts form a matrix of rank at most $d$. Yang and colleagues named this limit the *softmax bottleneck* :cite[yang2018].

## Eigenvectors

An **eigenvector** of a square matrix $A$ is a direction that $A$ only stretches, without rotating: $A\mathbf v = \lambda \mathbf v$. The factor $\lambda$ is its **eigenvalue**. In the widget above, the dashed green lines are the eigenvectors: points on them stay on them. A rotation has no real eigenvectors (every direction turns), and a shear has only one.

Symmetric matrices are the well-behaved case, and they are the case that matters most here. The **spectral theorem** says that a real symmetric matrix has real eigenvalues and a full set of mutually orthogonal eigenvectors:

:::equation{#a-spectral caption="The spectral theorem: a symmetric matrix is a rotation, a scaling along perpendicular axes, and the rotation back."}
$$
A = A^\top \quad\Longrightarrow\quad A = \term{Qe}{Q}\, \term{Lam}{\Lambda}\, Q^\top
$$
:::

```terms
Qe:
  label: "$Q$ — the eigenvectors, as the columns of an orthogonal matrix"
  what: "Its columns are unit-length eigenvectors of $A$, mutually perpendicular, so $Q^\\top Q = I$."
Lam:
  label: "$\\Lambda$ — the eigenvalues, on a diagonal"
  what: "$\\Lambda = \\operatorname{diag}(\\lambda_1, \\ldots, \\lambda_n)$. Along eigenvector $i$, $A$ just multiplies by $\\lambda_i$."
  why: In this basis the matrix is diagonal, so powers, inverses and square roots of $A$ act on each $\\lambda_i$ separately.
```

The largest eigenvalue can be found without any library by **power iteration**: start from a random vector and repeatedly multiply by $A$ and normalise. Each multiplication amplifies the component along the top eigenvector by $\lambda_1$, relative to $\lambda_2$ for the next, so the vector turns towards the top eigenvector at a rate set by $|\lambda_2 / \lambda_1|$. Subtracting $\lambda_1 \mathbf v_1 \mathbf v_1^\top$ (**deflation**) and repeating finds the next one. This is how the Chapter 7 exercise computes PCA. The same idea appears in optimisation: the largest eigenvalue of the loss’s Hessian limits the usable learning rate (Appendix B).

## The singular value decomposition

Every matrix — rectangular, not symmetric, even rank-deficient — can be written as a rotation, a scaling and another rotation:

:::equation{#a-svd caption="The singular value decomposition."}
$$
A = \term{Us}{U}\, \term{Sig}{\Sigma}\, \term{Vs}{V}^\top, \qquad A \in \mathbb R^{m \times n},\ U \in \mathbb R^{m \times r},\ \Sigma = \operatorname{diag}(\sigma_1 \ge \sigma_2 \ge \dots \ge \sigma_r \ge 0),\ V \in \mathbb R^{n \times r}
$$
:::

```terms
Us:
  label: "$U$ — left singular vectors"
  what: "Orthonormal columns in the output space: the directions $A$ maps onto."
Sig:
  label: "$\\Sigma$ — the singular values"
  what: "How much $A$ stretches along each pair of directions, largest first. The number of non-zero $\\sigma_i$ is the rank."
  why: They measure how much each direction matters. Sharply decaying singular values mean the matrix is close to low-rank.
Vs:
  label: "$V$ — right singular vectors"
  what: "Orthonormal columns in the input space: the directions $A$ reads from. $A\\mathbf v_i = \\sigma_i \\mathbf u_i$."
```

Geometrically, $A$ sends the unit sphere to an ellipsoid with semi-axes $\sigma_i \mathbf u_i$. The singular values of a 2 × 2 matrix are the half-lengths of the ellipse in the transformation widget above. The SVD also gives the best possible compression of a matrix. Keeping only the top $k$ terms, $A_k = \sum_{i \le k} \sigma_i \mathbf u_i \mathbf v_i^\top$, gives the closest rank-$k$ matrix to $A$ in Frobenius norm. This is the **Eckart–Young theorem** :cite[eckart1936], and the error is exactly the part left out: $\lVert A - A_k \rVert_F^2 = \sum_{i > k} \sigma_i^2$.

::svd-compress

Trained weight matrices usually have slowly decaying singular values: they are not low-rank. The *updates* made during fine-tuning often are, which is why LoRA works (Chapter 20). The library’s `svd` (in `@lm/core`) uses one-sided Jacobi rotations: it rotates pairs of columns until they are all orthogonal. It is simple, accurate, and fast enough for the matrices we visualise.

## Principal component analysis

Given $N$ data points in $\mathbb R^d$ — say, the 65 character embeddings of Chapter 7 — **principal component analysis** (PCA) finds the directions along which they vary most :cite[pearson1901,hotelling1933]. Centre the data by subtracting the mean, stack the points as the rows of $X$, and form the **covariance matrix**:

:::equation{#a-cov caption="The covariance matrix of centred data, and its eigen-decomposition."}
$$
\Sigma_X = \frac{1}{N - 1} X^\top X \;=\; Q\, \Lambda\, Q^\top
$$
:::

$\Sigma_X$ is symmetric, so the spectral theorem applies. Its eigenvectors are the **principal components**, and each eigenvalue $\lambda_i$ is the variance of the data along its component. Projecting onto the top $k$ components, $X Q_{:, 1:k}$, keeps the fraction $\sum_{i \le k} \lambda_i / \sum_i \lambda_i$ of the total variance — more than any other $k$-dimensional projection. PCA is the SVD in disguise: if $X = U S V^\top$, the principal components are the columns of $V$ and $\lambda_i = s_i^2 / (N - 1)$.

::pca-scatter

Two cautions when reading PCA plots of embeddings. First, the top two components of a 384-dimensional embedding space often explain only a few per cent of the variance. What looks like a clean picture is a thin slice. Second, PCA only finds *linear* structure along directions of high variance. Interpretability research (Chapter 26) looks for directions that are meaningful, which need not be the ones with the most variance.

## Tensors

A **tensor**, in deep-learning usage, is simply an array with any number of dimensions. A batch of sequences of embeddings has shape (batch, time, channels); attention scores have shape (batch, heads, time, time). Chapter 4 builds tensors from strided views over flat storage. The linear algebra in this appendix applies along any two chosen dimensions, with the others treated as a batch. A **batched matrix multiplication** $(B, m, k) \times (B, k, n) \to (B, m, n)$ performs $B$ independent products. **Einstein summation** notation writes such operations compactly by naming the indices: `einsum('bmk,bkn->bmn', A, B)` sums over the repeated index $k$. Chapter 10 uses it to describe multi-head attention.

## Floating point, briefly

Everything above assumes exact real numbers; computers use floating point. A float32 has a 24-bit significand, about 7 decimal digits of precision, and a range of about $10^{\pm 38}$. Sums of many products therefore carry rounding error that grows with their length, and the *order* of summation changes the last few digits (Chapter 8). Lower precisions — bfloat16 and float16 in training, 8-bit and 4-bit formats for inference — trade precision for speed and memory (Chapters 14 and 16). David Goldberg’s essay is the standard introduction :cite[goldberg1991].

## Further reading

- Gilbert Strang, *Introduction to Linear Algebra* :cite[strang2016].
- Grant Sanderson (3Blue1Brown), *Essence of Linear Algebra* :cite[sanderson2016]. Fifteen short videos that make the geometry visible.
- Lloyd N. Trefethen and David Bau, *Numerical Linear Algebra* :cite[trefethen1997]. How these computations are actually done, and how they go wrong.
