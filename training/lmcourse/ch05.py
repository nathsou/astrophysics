"""Chapter 5 lab: the neural bigram model trained by SGD in PyTorch, compared with counting."""

from __future__ import annotations

import math

from . import data


def main(steps: int = 8000, batch: int = 256, lr: float = 20.0) -> None:
    try:
        import torch
        import torch.nn.functional as F
    except ImportError:
        print("This lab needs PyTorch: uv sync --extra torch")
        return
    text = data.load_text("shakespeare")
    chars = sorted(set(text))
    V = len(chars)
    index = {c: i for i, c in enumerate(chars)}
    ids = torch.tensor([index[c] for c in text])
    split = int(len(ids) * 0.9)
    train, val = ids[:split], ids[split:]
    g = torch.Generator().manual_seed(1)

    W = torch.zeros(V, V, requires_grad=True)
    for step in range(steps):
        idx = torch.randint(0, len(train) - 1, (batch,), generator=g)
        x, y = train[idx], train[idx + 1]
        loss = F.cross_entropy(W[x], y)  # row lookup, softmax, −log p
        W.grad = None
        loss.backward()  # autograd fills W.grad
        with torch.no_grad():
            W -= lr * W.grad  # the gradient descent step
        if step % 2000 == 0:
            print(f"  step {step:>5}: training loss {loss.item():.3f} nats")

    with torch.no_grad():
        n = min(50_000, len(val) - 1)
        neural = F.cross_entropy(W[val[:n]], val[1 : n + 1]).item()
        counts = torch.zeros(V, V)
        counts.index_put_((train[:-1], train[1:]), torch.ones(len(train) - 1), accumulate=True)
        p = (counts + 0.01) / (counts + 0.01).sum(1, keepdim=True)
        counted = -p[val[:n], val[1 : n + 1]].log().mean().item()
    print(f"\nValidation cross-entropy (first {n:,} bigrams)")
    print(f"  neural bigram, SGD: {neural:.4f} nats = {neural / math.log(2):.4f} bits")
    print(f"  counted bigram:     {counted:.4f} nats = {counted / math.log(2):.4f} bits")
