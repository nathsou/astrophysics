"""Chapter 7 lab: Bengio's MLP language model on TinyShakespeare in PyTorch.

    uv run lmc ch07                                   # SGD, one hidden layer (as in the browser)
    uv run lmc ch07 --optimizer adamw --layers 2      # a preview of Chapter 13: beats Kneser–Ney
"""

from __future__ import annotations

import math
import time

from . import data

KNESER_NEY_BITS = 2.22  # Chapter 2's best n-gram model on the full validation split


def main(
    n: int = 8, d: int = 24, h: int = 512, layers: int = 1, steps: int = 30_000, batch: int = 256,
    optimizer: str = "sgd", lr: float | None = None, device: str = "cpu",
) -> None:
    try:
        import torch
        import torch.nn.functional as F
        from torch import nn
    except ImportError:
        print("This lab needs PyTorch: uv sync --extra torch")
        return
    torch.manual_seed(1)
    text = data.load_text("shakespeare")
    chars = sorted(set(text))
    index = {c: i for i, c in enumerate(chars)}
    ids = torch.tensor([index[c] for c in text], device=device)
    split = int(len(ids) * 0.9)
    train, val = ids[:split], ids[split:]
    V = len(chars)

    mods: list[nn.Module] = [nn.Embedding(V, d), nn.Flatten(), nn.Linear(n * d, h), nn.Tanh()]
    for _ in range(layers - 1):
        mods += [nn.Linear(h, h), nn.Tanh()]
    mods.append(nn.Linear(h, V))
    model = nn.Sequential(*mods).to(device)
    with torch.no_grad():
        model[-1].weight.mul_(0.1)  # near-uniform initial predictions (loss ≈ ln V)
    lr = lr if lr is not None else (0.3 if optimizer == "sgd" else 1e-3)
    opt = (
        torch.optim.SGD(model.parameters(), lr=lr)
        if optimizer == "sgd"
        else torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)
    )
    params = sum(p.numel() for p in model.parameters())
    print(f"MLP: context {n}, embedding {d}, {layers}×{h} hidden, {params:,} parameters, {optimizer}, lr {lr}")

    offsets = torch.arange(n, device=device)

    def contexts(src, positions):
        return src[positions[:, None] - n + offsets], src[positions]

    t0 = time.time()
    for step in range(steps):
        pos = torch.randint(n, len(train), (batch,), device=device)
        X, Y = contexts(train, pos)
        loss = F.cross_entropy(model(X), Y)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()
        if step == int(steps * 0.7):  # a single learning-rate drop for the final stretch
            for g in opt.param_groups:
                g["lr"] *= 0.1
        if step % 5000 == 0:
            print(f"  step {step:>6}: train {loss.item() / math.log(2):.3f} bits/char ({time.time() - t0:.0f}s)")

    model.eval()
    with torch.no_grad():
        total, count = 0.0, 0
        for start in range(n, len(val), 8192):
            pos = torch.arange(start, min(start + 8192, len(val)), device=device)
            X, Y = contexts(val, pos)
            total += F.cross_entropy(model(X), Y, reduction="sum").item()
            count += len(pos)
    bits = total / count / math.log(2)
    verdict = "beats" if bits < KNESER_NEY_BITS else "does not yet beat"
    print(f"\nFull validation split: {bits:.3f} bits/char — {verdict} Kneser–Ney ({KNESER_NEY_BITS})")
