"""Chapter 10 lab: attention in PyTorch.

    uv run lmc ch10 lm --layers 2           # attention-only character model on TinyShakespeare
    uv run lmc ch10 recall --pairs 16       # associative recall: attention vs LSTM
    uv run lmc ch10 speed                   # the cost of attention grows as T²; an RNN's as T, but serially
"""

from __future__ import annotations

import math
import time

from . import data


def _device():
    import torch

    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def _sync(dev) -> None:
    import torch

    if dev.type == "cuda":
        torch.cuda.synchronize()
    elif dev.type == "mps":
        torch.mps.synchronize()


def make_attention_model(vocab: int, context: int, width: int, heads: int, layers: int):
    """Embeddings, then `layers` blocks of x ← x + MultiHeadAttention(x), then a linear read-out."""
    import torch
    import torch.nn.functional as F
    from torch import nn

    class SelfAttention(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.qkv = nn.Linear(width, 3 * width, bias=False)
            self.out = nn.Linear(width, width, bias=False)

        def forward(self, x):
            B, T, C = x.shape
            q, k, v = self.qkv(x).split(C, dim=2)
            q, k, v = (t.view(B, T, heads, C // heads).transpose(1, 2) for t in (q, k, v))
            # Fused scaled dot-product attention; the manual version is in `manual_attention` below.
            y = F.scaled_dot_product_attention(q, k, v, is_causal=True)
            return self.out(y.transpose(1, 2).reshape(B, T, C))

    class AttentionLM(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.tok = nn.Embedding(vocab, width)
            self.pos = nn.Embedding(context, width)
            self.blocks = nn.ModuleList(SelfAttention() for _ in range(layers))
            self.head = nn.Linear(width, vocab)

        def forward(self, idx):
            x = self.tok(idx) + self.pos(torch.arange(idx.shape[1], device=idx.device))
            for block in self.blocks:
                x = x + block(x)
            return self.head(x)

    return AttentionLM()


def manual_attention(q, k, v):
    """softmax(q kᵀ / √d + causal mask) v, written out (compare with F.scaled_dot_product_attention)."""
    import torch

    T, d = q.shape[-2], q.shape[-1]
    scores = q @ k.transpose(-2, -1) / math.sqrt(d)
    mask = torch.triu(torch.ones(T, T, dtype=torch.bool, device=q.device), diagonal=1)
    return scores.masked_fill(mask, float("-inf")).softmax(-1) @ v


def lm(layers: int = 2, steps: int = 3000, context: int = 128, width: int = 128, heads: int = 4) -> None:
    import torch
    import torch.nn.functional as F

    torch.manual_seed(1)
    dev = _device()
    text = data.load_text("shakespeare")
    chars = sorted(set(text))
    ids = torch.tensor([chars.index(c) for c in text])
    split = int(len(ids) * 0.9)
    train, val = ids[:split], ids[split:]
    model = make_attention_model(len(chars), context, width, heads, layers).to(dev)
    opt = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=0.0)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=3e-3, total_steps=steps, pct_start=0.03)
    print(f"Attention-only LM: {layers} layer(s), {sum(p.numel() for p in model.parameters()):,} parameters, on {dev}")
    t0 = time.time()
    for step in range(1, steps + 1):
        starts = torch.randint(len(train) - context - 1, (32,))
        x = torch.stack([train[s : s + context] for s in starts]).to(dev)
        y = torch.stack([train[s + 1 : s + context + 1] for s in starts]).to(dev)
        loss = F.cross_entropy(model(x).view(-1, len(chars)), y.view(-1))
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        sched.step()
        if step % 1000 == 0:
            print(f"  step {step}: train {loss.item() / math.log(2):.3f} bits/char ({time.time() - t0:.0f}s)")
    model.eval()
    n = (len(val) - 1) // context
    x = val[: n * context].view(n, context).to(dev)
    y = val[1 : n * context + 1].view(n, context).to(dev)
    with torch.no_grad():
        total = sum(
            F.cross_entropy(model(x[i : i + 64]).view(-1, len(chars)), y[i : i + 64].reshape(-1), reduction="sum").item()
            for i in range(0, n, 64)
        )
    print(f"Validation (windows of {context}): {total / (n * context) / math.log(2):.3f} bits/char")


def recall(pairs: int = 16, steps: int = 3000) -> None:
    """Associative recall: n key–value pairs, then '?' and a key; predict its value."""
    import torch
    import torch.nn.functional as F
    from torch import nn

    torch.manual_seed(1)
    dev = _device()
    K, VALUES = 26, 10
    V, T = K + VALUES + 1, 2 * pairs + 2

    def batch(B: int):
        keys = torch.rand(B, K).argsort(dim=1)[:, :pairs]
        vals = K + torch.randint(VALUES, (B, pairs))
        x = torch.stack([keys, vals], dim=2).view(B, 2 * pairs)
        q = torch.randint(pairs, (B,))
        x = torch.cat([x, torch.full((B, 1), K + VALUES), keys[torch.arange(B), q][:, None]], dim=1)
        return x.to(dev), vals[torch.arange(B), q].to(dev)

    class Lstm(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.emb, self.rnn, self.out = nn.Embedding(V, 128), nn.LSTM(128, 128, batch_first=True), nn.Linear(128, V)

        def forward(self, x):
            return self.out(self.rnn(self.emb(x))[0][:, -1])

    attn = make_attention_model(V, T, 64, 4, 2)
    models = {"attention": attn, "lstm": Lstm()}
    test_x, test_y = batch(1024)
    for name, model in models.items():
        model.to(dev)
        opt = torch.optim.Adam(model.parameters(), lr=3e-3)
        for step in range(1, steps + 1):
            x, y = batch(128)
            logits = model(x)
            logits = logits[:, -1] if logits.dim() == 3 else logits
            loss = F.cross_entropy(logits, y)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            if step % (steps // 6) == 0 or step == steps:
                with torch.no_grad():
                    out = model(test_x)
                    out = out[:, -1] if out.dim() == 3 else out
                    acc = (out.argmax(-1) == test_y).float().mean().item()
                print(f"  {name:>9}, {pairs} pairs, step {step:>5}: accuracy {acc:.1%}")


def speed() -> None:
    import torch
    from torch import nn

    dev = _device()
    print(f"Forward + backward time on {dev}, batch 8, width 256")
    attn_block = make_attention_model(65, 4096, 256, 4, 1).to(dev)
    rnn = nn.LSTM(256, 256, batch_first=True).to(dev)
    for T in (128, 512, 1024, 2048, 4096):
        x = torch.randint(65, (8, T), device=dev)
        e = torch.randn(8, T, 256, device=dev, requires_grad=True)

        def time_it(fn):
            fn()
            _sync(dev)
            t0 = time.perf_counter()
            for _ in range(5):
                fn()
            _sync(dev)
            return (time.perf_counter() - t0) / 5 * 1000

        a = time_it(lambda x=x: attn_block(x).sum().backward())
        r = time_it(lambda e=e: rnn(e)[0].sum().backward())
        mib = 8 * 4 * T * T * 4 / 2**20
        print(f"  T = {T:>5}: attention layer {a:7.1f} ms   LSTM {r:7.1f} ms   (attention matrix: {mib:6.0f} MiB)")
    # Check the manual implementation against PyTorch's fused kernel.
    q, k, v = (torch.randn(2, 4, 64, 32, device=dev) for _ in range(3))
    diff = (manual_attention(q, k, v) - torch.nn.functional.scaled_dot_product_attention(q, k, v, is_causal=True)).abs().max()
    print(f"manual vs fused attention: max difference {diff.item():.1e}")
