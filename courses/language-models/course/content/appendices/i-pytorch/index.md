---
number: I
title: PyTorch primer
summary: PyTorch for readers who have built the course's own library — tensors, strides and broadcasting, autograd, modules and optimisers, devices and precision, compilation, and saving weights — each mapped to the TypeScript we wrote, with the pitfalls that catch newcomers.
duration: About 1 hour
---

From Chapter 14 onwards the course trains models with PyTorch, and the Python lab has used it since Chapter 4. If you have worked through Part II, you already know how PyTorch works inside: you built a tensor library with strides and broadcasting (Chapter 4), reverse-mode automatic differentiation (Chapter 6), modules and optimisers (Chapters 5 and 7), and a GPU backend (Chapter 8). This appendix maps each piece to its PyTorch equivalent, so you can read and write the lab code fluently, and lists the pitfalls that most often cause silent bugs.

To follow along, install the lab (`cd training && uv sync --extra torch`) and start `uv run python`.

## Tensors

A PyTorch tensor is what `Tensor` in `@lm/core/tensor` is: a flat block of memory (the *storage*), a shape, strides and an offset (Chapter 4).

| `@lm/core` (TypeScript) | PyTorch |
|---|---|
| `Tensor.from([[1, 2], [3, 4]])` | `torch.tensor([[1., 2.], [3., 4.]])` |
| `Tensor.zeros([2, 3])`, `Tensor.randn([2, 3], { rng })` | `torch.zeros(2, 3)`, `torch.randn(2, 3, generator=g)` |
| `t.shape`, `t.strides`, `t.isContiguous()` | `t.shape`, `t.stride()`, `t.is_contiguous()` |
| `t.view(6)`, `t.reshape(3, 2)`, `t.T`, `t.permute(1, 0)` | `t.view(6)`, `t.reshape(3, 2)`, `t.T`, `t.permute(1, 0)` |
| `a.add(b)`, `a.mul(2)`, `a.matmul(b)` | `a + b`, `a * 2`, `a @ b` |
| `t.sum(1, true)`, `t.softmax(-1)`, `t.max(0)` | `t.sum(1, keepdim=True)`, `t.softmax(-1)`, `t.max(0)` |
| `t.item()`, `t.toArray()` | `t.item()`, `t.tolist()` |

As in our library, `view`, `permute`, `transpose` and slicing return **views** that share storage, and `reshape` copies only when it must. Broadcasting follows the same rules as Chapter 4: align shapes from the right, and stretch dimensions of size 1.

```python
import torch
x = torch.arange(6.).reshape(2, 3)   # [[0, 1, 2], [3, 4, 5]]
y = x.T                              # a view: shape (3, 2), strides (1, 3)
y[0, 1] = 100.                       # writes into x's storage: x[1, 0] is now 100
x + torch.tensor([10., 20., 30.])    # broadcasting (2, 3) + (3,)
```

Two differences from our library matter. PyTorch tensors have a **dtype** (`torch.float32` by default; `torch.int64` for indices; `torch.bfloat16`, `torch.float16`) and a **device** (`"cpu"`, `"cuda"`, `"mps"`). Operations require their inputs to share a device, and mixed dtypes are promoted by fixed rules.

## Autograd

PyTorch’s autograd is the reverse-mode differentiation of Chapter 6. A tensor with `requires_grad=True` records every operation applied to it into a graph; `loss.backward()` walks the graph in reverse topological order, applies each operation’s backward function, and **accumulates** gradients into the `.grad` of every leaf tensor.

| `@lm/core` | PyTorch |
|---|---|
| `Tensor.randn([3], { requiresGrad: true })` | `torch.randn(3, requires_grad=True)` |
| `loss.backward()` | `loss.backward()` |
| `w.grad` | `w.grad` |
| `w.zeroGrad()` | `w.grad = None` (or `opt.zero_grad()`) |
| `noGrad(() => …)` | `with torch.no_grad(): …` |
| `t.detach()` | `t.detach()` |

```python
w = torch.tensor([1., 2.], requires_grad=True)
loss = (w ** 2).sum()                # records pow and sum
loss.backward()
w.grad                               # tensor([2., 4.])
```

The graph is built fresh on every forward pass and freed after `backward()`, which is why ordinary Python control flow — loops, conditions — works inside a model. `torch.autograd.gradcheck` compares analytical gradients with finite differences, like the gradient checks of Chapter 6.

## Modules and optimisers

`torch.nn.Module` is our `Module`: an object that owns parameters and defines `forward`. PyTorch finds parameters automatically — any `nn.Parameter` or sub-module assigned as an attribute is registered — and names them by their attribute path (`blocks.3.attn.q`), which is how `state_dict()` and our browser-compatible names (Chapter 11) work.

```python
from torch import nn
import torch.nn.functional as F

class Mlp(nn.Module):
    def __init__(self, d: int, h: int):
        super().__init__()
        self.fc = nn.Linear(d, h)            # weight stored (h, d): computes x @ W.T + b
        self.proj = nn.Linear(h, d)

    def forward(self, x):
        return self.proj(F.gelu(self.fc(x)))

model = Mlp(64, 256)
opt = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=0.1)
for x, y in batches:                          # the training loop of Chapter 12
    loss = F.mse_loss(model(x), y)
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step()
    opt.zero_grad(set_to_none=True)
```

Note that `nn.Linear` stores its weight as (outputs, inputs) and computes $x W^\top$, the transpose of our layout. The course’s `lmcourse/model.py` therefore uses plain parameters in our (inputs, outputs) layout, so checkpoints move between PyTorch and the browser unchanged (Chapter 14).

`model.train()` and `model.eval()` switch the behaviour of dropout (and of batch normalisation, which the course does not use). They do *not* turn off gradient tracking; that is `torch.no_grad()`, or the stricter and faster `torch.inference_mode()`.

## Devices and precision

Moving work to a GPU means moving the tensors: `model.to("cuda")` moves every parameter, and each batch must be moved too. The lab picks the device once:

```python
dev = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
x = x.to(dev, non_blocking=True)           # asynchronous copy from pinned host memory
```

GPU work is **asynchronous**. PyTorch queues each kernel and returns at once (like `GpuContext` in Chapter 8), so Python runs ahead of the GPU. Anything that needs a result on the CPU — `.item()`, `print(t)`, `.tolist()`, `.cpu()` — waits for the queue to drain. Time GPU code only after `torch.cuda.synchronize()`, and avoid such calls inside the training loop (Chapter 14).

Mixed precision is a context manager (Chapter 14):

```python
with torch.autocast("cuda", dtype=torch.bfloat16):
    logits, loss = model(x, y)               # matmuls in bf16, softmax and losses in float32
loss.backward()                               # outside autocast; gradients match the float32 weights
```

`torch.set_float32_matmul_precision("high")` lets float32 matrix products use TF32 tensor cores.

## Compilation and kernels

`torch.compile(model)` returns a compiled wrapper that shares the model’s parameters (Chapter 14). It captures the Python code into graphs, fuses element-wise operations into generated Triton kernels, and falls back to ordinary Python at graph breaks. The first calls are slow (compilation), and new input shapes trigger recompilation. `F.scaled_dot_product_attention` dispatches to FlashAttention when it can. For custom kernels, Triton lets you write GPU code in Python (Chapter 8’s lab), and `torch.utils.cpp_extension` compiles CUDA C++.

## Saving and loading

A model’s `state_dict()` maps parameter names to tensors. `torch.save` writes it with Python’s pickle, which can execute arbitrary code when loaded — so load only files you trust, and pass `weights_only=True` when you only need tensors. The course exports weights with **safetensors** instead (Chapter 12), which stores only tensors and a JSON header and is read by our browser code directly:

```python
from safetensors.torch import save_file, load_file
save_file(model.state_for_browser(), "model.safetensors", metadata={"config": "…"})
state = load_file("model.safetensors")
```

## Pitfalls

- **Forgetting to zero gradients.** `backward()` adds to `.grad`. Without `opt.zero_grad()` each step uses the sum of all previous gradients. (Gradient accumulation, Chapter 12, relies on exactly this, deliberately.)
- **In-place operations on tensors autograd needs.** `x += 1` or `x.relu_()` on a tensor saved for the backward pass makes `backward()` fail with an error about a modified tensor. Write `x = x + 1` instead.
- **Evaluating in training mode.** Dropout left on during evaluation makes validation loss noisy and too high. Call `model.eval()` and go back with `model.train()`.
- **Shapes that broadcast by accident.** `(B, 1) - (B,)` is `(B, B)`, not `(B, 1)`. Losses computed on accidentally broadcast tensors run without error and train badly. Check shapes with assertions.
- **Integer division and dtypes.** Indices must be `torch.long` for embedding lookups and `cross_entropy` targets; `torch.tensor([1, 2]) / 2` is a float tensor.
- **Device mismatches.** A tensor created inside `forward` with `torch.zeros(n)` lives on the CPU. Create it with `device=x.device`, or register it as a buffer.
- **Non-determinism.** GPU reductions may sum in different orders from run to run. Seeds (`torch.manual_seed`) make runs repeatable only up to such rounding; parity tests need tolerances (Chapter 14).

## Further reading

- The PyTorch documentation’s tutorials, especially *Autograd mechanics* and *Automatic mixed precision*.
- Adam Paszke and colleagues, *PyTorch: An Imperative Style, High-Performance Deep Learning Library* :cite[paszke2019].
- Jason Ansel and colleagues, *PyTorch 2* :cite[ansel2024], on `torch.compile`.
