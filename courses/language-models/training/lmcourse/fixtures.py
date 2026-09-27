"""Reference fixtures from PyTorch for the TypeScript tensor library (Chapters 4–7).

Each case records its inputs, the forward output, a random upstream weight W, and the gradients of
loss = (output · W).sum() (or of the output itself when it is a scalar). Run:

    uv run --extra torch python -m lmcourse.fixtures
"""

from __future__ import annotations

import json
from collections.abc import Callable

import torch
import torch.nn.functional as F

from .paths import FIXTURES

torch.manual_seed(0)


def t(*shape: int, positive: bool = False) -> torch.Tensor:
    x = torch.randn(*shape, dtype=torch.float64)
    return (x.abs() + 0.5 if positive else x).requires_grad_(True)


def case(name: str, fn: Callable[..., torch.Tensor], *inputs: torch.Tensor, **meta) -> dict:
    out = fn(*inputs)
    if out.numel() == 1 and out.dim() == 0:
        w = torch.ones(())
        loss = out
    else:
        w = torch.randn(out.shape, dtype=torch.float64)
        loss = (out * w).sum()
    grads = torch.autograd.grad(loss, inputs, allow_unused=True)
    enc = lambda x: {"shape": list(x.shape), "data": x.detach().flatten().tolist()}
    return {
        "name": name,
        "inputs": [enc(x) for x in inputs],
        "out": enc(out),
        "upstream": enc(w),
        "grads": [enc(g) if g is not None else None for g in grads],
        **meta,
    }


def main() -> None:
    ids = torch.tensor([3, 0, 6, 3, 2])
    cases = [
        case("add_broadcast", lambda a, b: a + b, t(3, 1, 4), t(2, 4)),
        case("sub", lambda a, b: a - b, t(2, 3), t(3)),
        case("mul_broadcast", lambda a, b: a * b, t(2, 3), t(3)),
        case("div", lambda a, b: a / b, t(2, 3), t(2, 1, positive=True)),
        case("pow3", lambda a: a**3, t(2, 3)),
        case("exp", torch.exp, t(2, 3)),
        case("log", torch.log, t(2, 3, positive=True)),
        case("sqrt", torch.sqrt, t(2, 3, positive=True)),
        case("tanh", torch.tanh, t(2, 3)),
        case("sigmoid", torch.sigmoid, t(2, 3)),
        case("relu", torch.relu, t(3, 4)),
        case("gelu", lambda a: F.gelu(a, approximate="tanh"), t(3, 4)),
        case("sum_all", lambda a: a.sum(), t(2, 3, 4)),
        case("sum_dim1", lambda a: a.sum(1), t(2, 3, 4)),
        case("sum_dims02_keep", lambda a: a.sum((0, 2), keepdim=True), t(2, 3, 4)),
        case("mean_last", lambda a: a.mean(-1), t(2, 3, 4)),
        case("max_dim1", lambda a: a.max(1).values, t(2, 5, 3)),
        case("logsumexp_last", lambda a: a.logsumexp(-1), t(3, 6)),
        case("softmax_last", lambda a: a.softmax(-1), t(3, 6)),
        case("softmax_dim0", lambda a: a.softmax(0), t(4, 3)),
        case("log_softmax_last", lambda a: a.log_softmax(-1), t(3, 6)),
        case("matmul_2d", lambda a, b: a @ b, t(3, 4), t(4, 5)),
        case("matmul_batched", lambda a, b: a @ b, t(2, 3, 4), t(4, 5)),
        case("matmul_broadcast_batch", lambda a, b: a @ b, t(2, 1, 3, 4), t(3, 4, 2)),
        case("matmul_vec_mat", lambda a, b: a @ b, t(4), t(4, 5)),
        case("matmul_mat_vec", lambda a, b: a @ b, t(3, 4), t(4)),
        case("transpose_matmul", lambda a, b: a.T @ b, t(4, 3), t(4, 5)),
        case("permute_reshape", lambda a: a.permute(2, 0, 1).reshape(4, 6) * 2, t(2, 3, 4)),
        case("slice_mul", lambda a: a[:, 1:3] * a[:, 0:2], t(3, 4)),
        case("expand_add", lambda a, b: a.expand(3, 4) + b, t(1, 4), t(3, 4)),
        case("cross_entropy", lambda z: F.cross_entropy(z, ids), t(5, 7), targets=ids.tolist()),
        case("embedding", lambda w: F.embedding(ids, w), t(7, 3), ids=ids.tolist()),
        case(
            "layer_norm",
            lambda x, g, b: F.layer_norm(x, (5,), g, b, eps=1e-5),
            t(3, 5),
            t(5),
            t(5),
        ),
        case(
            "mlp_loss",
            lambda x, w1, b1, w2: F.cross_entropy(torch.tanh(x @ w1 + b1) @ w2, ids),
            t(5, 4),
            t(4, 6),
            t(6),
            t(6, 7),
            targets=ids.tolist(),
        ),
    ]
    FIXTURES.mkdir(parents=True, exist_ok=True)
    out = FIXTURES / "tensor_ops.json"
    out.write_text(json.dumps({"torch": torch.__version__, "cases": cases}) + "\n")
    print(f"wrote {len(cases)} cases to {out}")


if __name__ == "__main__":
    main()
