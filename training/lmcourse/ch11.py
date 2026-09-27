"""Chapter 11 lab: the Transformer on TinyShakespeare, in PyTorch.

uv run lmc ch11                          # the browser's model: 2 layers, width 128 (≈ 2.2 bits/char)
uv run lmc ch11 --no-mlp --no-norm       # attention only
uv run lmc ch11 --no-norm                # + MLP
uv run lmc ch11 --layers 6 --width 384 --context 256 --dropout 0.2 --steps 5000 --lr 1e-3   # bigger
"""

from __future__ import annotations

import math
import time

from . import data


def main(
    layers: int = 2,
    width: int = 128,
    heads: int = 4,
    context: int = 128,
    batch: int = 32,
    steps: int = 3000,
    lr: float = 3e-3,
    dropout: float = 0.0,
    mlp: bool = True,
    norm: bool = True,
) -> None:
    try:
        import torch
    except ImportError:
        print("This lab needs PyTorch: uv sync --extra torch")
        return
    from .model import GPT, GPTConfig

    torch.manual_seed(1)
    dev = torch.device(
        "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    )
    text = data.load_text("shakespeare")
    chars = sorted(set(text))
    index = {c: i for i, c in enumerate(chars)}
    ids = torch.tensor([index[c] for c in text])
    split = int(len(ids) * 0.9)
    train, val = ids[:split], ids[split:]

    cfg = GPTConfig(
        vocab=len(chars),
        context=context,
        width=width,
        layers=layers,
        heads=heads,
        dropout=dropout,
        mlp=mlp,
        norm=norm,
    )
    model = GPT(cfg).to(dev)
    opt = model.optimizer(lr)
    warmup, min_ratio = 100, 0.1

    def lr_at(step: int) -> float:
        if step < warmup:
            return lr * (step + 1) / warmup
        progress = min(1.0, (step - warmup) / max(1, steps - warmup))
        return lr * (min_ratio + (1 - min_ratio) * 0.5 * (1 + math.cos(math.pi * progress)))

    print(
        f"GPT: {layers} layers, width {width}, context {context}, mlp={mlp}, norm={norm}: {model.num_parameters():,} parameters on {dev}"
    )
    t0 = time.time()
    for step in range(steps):
        starts = torch.randint(len(train) - context - 1, (batch,))
        x = torch.stack([train[s : s + context] for s in starts]).to(dev)
        y = torch.stack([train[s + 1 : s + context + 1] for s in starts]).to(dev)
        for g in opt.param_groups:
            g["lr"] = lr_at(step)
        model.train()
        _, loss = model(x, y)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        if (step + 1) % 1000 == 0:
            print(
                f"  step {step + 1}: train {loss.item() / math.log(2):.3f} bits/char ({time.time() - t0:.0f}s)"
            )

    model.eval()
    n = (len(val) - 1) // context
    xv = val[: n * context].view(n, context).to(dev)
    yv = val[1 : n * context + 1].view(n, context).to(dev)
    total = 0.0
    with torch.no_grad():
        for i in range(0, n, 64):
            logits, _ = model(xv[i : i + 64])
            total += torch.nn.functional.cross_entropy(
                logits.reshape(-1, len(chars)), yv[i : i + 64].reshape(-1), reduction="sum"
            ).item()
    print(f"Validation (windows of {context}): {total / (n * context) / math.log(2):.3f} bits/char")
    prompt = torch.tensor([[index[c] for c in "ROMEO:\n"]], device=dev)
    print("\n" + "".join(chars[i] for i in model.generate(prompt, 300)[0].tolist()))
