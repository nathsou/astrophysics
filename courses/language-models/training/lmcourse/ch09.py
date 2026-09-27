"""Chapter 9 lab: character-level recurrent networks on TinyShakespeare in PyTorch.

    uv run lmc ch09                              # LSTM, 1 × 256, as in the browser
    uv run lmc ch09 --cell rnn                   # vanilla (Elman) RNN
    uv run lmc ch09 --layers 2 --hidden 512 --dropout 0.2 --steps 10000   # Karpathy-style char-rnn

Training is "stateful": the batch is B parallel streams through the text, and each stream's hidden
state is carried (detached) from one chunk of T characters to the next — truncated backpropagation
through time. Evaluation runs the same way over the whole validation split.
"""

from __future__ import annotations

import math
import time

from . import data

KNESER_NEY_BITS = 2.22


def _device(name: str):
    import torch

    if name != "auto":
        return torch.device(name)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def main(
    cell: str = "lstm",
    hidden: int = 256,
    layers: int = 1,
    steps: int = 2000,
    batch: int = 64,
    bptt: int = 64,
    lr: float = 3e-3,
    dropout: float = 0.0,
    clip: float = 1.0,
    device: str = "auto",
) -> None:
    try:
        import torch
        import torch.nn.functional as F
        from torch import nn
    except ImportError:
        print("This lab needs PyTorch: uv sync --extra torch")
        return
    torch.manual_seed(1)
    dev = _device(device)
    text = data.load_text("shakespeare")
    chars = sorted(set(text))
    index = {c: i for i, c in enumerate(chars)}
    ids = torch.tensor([index[c] for c in text], dtype=torch.long)
    split = int(len(ids) * 0.9)
    train, val = ids[:split], ids[split:]
    V = len(chars)

    class CharRNN(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.embed = nn.Embedding(V, hidden)
            rnn = {"lstm": nn.LSTM, "gru": nn.GRU, "rnn": nn.RNN}[cell]
            self.rnn = rnn(hidden, hidden, num_layers=layers, dropout=dropout if layers > 1 else 0.0)
            self.drop = nn.Dropout(dropout)
            self.out = nn.Linear(hidden, V)

        def forward(self, x, state):
            y, state = self.rnn(self.drop(self.embed(x)), state)
            return self.out(self.drop(y)), state

    model = CharRNN().to(dev)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, steps)
    params = sum(p.numel() for p in model.parameters())
    print(f"{cell.upper()} {layers} × {hidden}, {params:,} parameters, T = {bptt}, B = {batch}, Adam {lr}, on {dev}")

    def streams(src, b):
        """Reshape a 1-D id sequence into b parallel streams: (length, b), time-major."""
        n = (len(src) - 1) // b
        return src[: n * b].view(b, n).t().contiguous(), src[1 : n * b + 1].view(b, n).t().contiguous()

    def detach(state):
        return tuple(s.detach() for s in state) if isinstance(state, tuple) else state.detach()

    X, Y = (t.to(dev) for t in streams(train, batch))
    state, pos, t0 = None, 0, time.time()
    for step in range(1, steps + 1):
        if pos + bptt > len(X):
            pos, state = 0, None
        x, y = X[pos : pos + bptt], Y[pos : pos + bptt]
        pos += bptt
        model.train()
        logits, state = model(x, state)
        state = detach(state)
        loss = F.cross_entropy(logits.reshape(-1, V), y.reshape(-1))
        opt.zero_grad(set_to_none=True)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), clip)
        opt.step()
        sched.step()
        if step % 500 == 0 or step == steps:
            print(f"  step {step:>6}: train {loss.item() / math.log(2):.3f} bits/char ({time.time() - t0:.0f}s)")

    model.eval()
    Xv, Yv = (t.to(dev) for t in streams(val, 128))
    total, count, state = 0.0, 0, None
    with torch.no_grad():
        for p in range(0, len(Xv), 256):
            logits, state = model(Xv[p : p + 256], state)
            total += F.cross_entropy(logits.reshape(-1, V), Yv[p : p + 256].reshape(-1), reduction="sum").item()
            count += Yv[p : p + 256].numel()
    bits = total / count / math.log(2)
    verdict = "beats" if bits < KNESER_NEY_BITS else "does not beat"
    print(f"\nFull validation split: {bits:.3f} bits/char — {verdict} Kneser–Ney ({KNESER_NEY_BITS})")
