"""The course's GPT, in PyTorch (Chapter 11 onwards; CourseGPT in Chapter 14).

It is the same architecture as the browser's `Gpt` class (`@lm/core/gpu`), parameter for parameter:

    x = tok[ids] + pos[positions]
    for each block:  x = x + Attention(LN₁(x));  x = x + W₂ · GELU(W₁ · LN₂(x))
    logits = LN_f(x) · tokᵀ              (output layer tied to the token embedding)

No biases on linear layers, GELU in GPT-2's tanh form, GPT-2's initialisation. Parameter names
match the browser's (`h0.attn.q`, `h0.mlp.fc`, …), so checkpoints move between the two
(`state_for_browser`). Linear weights are stored (in, out), as in the browser, and applied as x @ W.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import torch
import torch.nn.functional as F
from torch import nn


@dataclass
class GPTConfig:
    vocab: int = 65
    context: int = 128
    width: int = 128
    layers: int = 2
    heads: int = 4
    mlp_ratio: int = 4
    dropout: float = 0.0
    mlp: bool = True
    norm: bool = True


class LayerNorm(nn.Module):
    def __init__(self, width: int) -> None:
        super().__init__()
        self.g = nn.Parameter(torch.ones(width))
        self.b = nn.Parameter(torch.zeros(width))

    def forward(self, x):
        return F.layer_norm(x, (x.shape[-1],), self.g, self.b, 1e-5)


class Block(nn.Module):
    def __init__(self, cfg: GPTConfig) -> None:
        super().__init__()
        C, std, resid = cfg.width, 0.02, 0.02 / math.sqrt(2 * cfg.layers)
        self.cfg = cfg
        self.ln1 = LayerNorm(C) if cfg.norm else None
        self.attn = nn.ParameterDict(
            {k: nn.Parameter(torch.randn(C, C) * (resid if k == "o" else std)) for k in "qkvo"}
        )
        if cfg.mlp:
            self.ln2 = LayerNorm(C) if cfg.norm else None
            self.mlp = nn.ParameterDict(
                {
                    "fc": nn.Parameter(torch.randn(C, cfg.mlp_ratio * C) * std),
                    "proj": nn.Parameter(torch.randn(cfg.mlp_ratio * C, C) * resid),
                }
            )
        self.drop = nn.Dropout(cfg.dropout)

    def forward(self, x):
        B, T, C = x.shape
        h, d = self.cfg.heads, C // self.cfg.heads
        a = self.ln1(x) if self.ln1 is not None else x
        q, k, v = ((a @ self.attn[n]).view(B, T, h, d).transpose(1, 2) for n in "qkv")
        y = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        x = x + self.drop(y.transpose(1, 2).reshape(B, T, C) @ self.attn["o"])
        if self.cfg.mlp:
            m = self.ln2(x) if self.ln2 is not None else x
            x = x + self.drop(F.gelu(m @ self.mlp["fc"], approximate="tanh") @ self.mlp["proj"])
        return x


class GPT(nn.Module):
    def __init__(self, cfg: GPTConfig) -> None:
        super().__init__()
        self.cfg = cfg
        self.tok = nn.Parameter(torch.randn(cfg.vocab, cfg.width) * 0.02)
        self.pos = nn.Parameter(torch.randn(cfg.context, cfg.width) * 0.02)
        self.blocks = nn.ModuleList(Block(cfg) for _ in range(cfg.layers))
        self.lnf = LayerNorm(cfg.width) if cfg.norm else None
        self.drop = nn.Dropout(cfg.dropout)

    def forward(self, ids, targets=None):
        T = ids.shape[1]
        x = self.drop(self.tok[ids] + self.pos[:T])
        for block in self.blocks:
            x = block(x)
        if self.lnf is not None:
            x = self.lnf(x)
        logits = x @ self.tok.t()
        if targets is None:
            return logits, None
        return logits, F.cross_entropy(logits.view(-1, logits.shape[-1]), targets.reshape(-1))

    def optimizer(self, lr: float, weight_decay: float = 0.1, betas=(0.9, 0.99)) -> torch.optim.AdamW:
        """AdamW with weight decay on matrices only (not norms or position embeddings), as in the browser."""
        decay, no_decay = [], []
        for name, p in self.named_parameters():
            (no_decay if name.endswith((".g", ".b")) or name == "pos" else decay).append(p)
        groups = [{"params": decay, "weight_decay": weight_decay}, {"params": no_decay, "weight_decay": 0.0}]
        return torch.optim.AdamW(groups, lr=lr, betas=betas, fused=torch.cuda.is_available())

    def num_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters())

    def state_for_browser(self) -> dict[str, torch.Tensor]:
        """Parameters under the browser's names: h{i}.attn.q, h{i}.ln1.g, lnf.b, tok, pos, …"""
        return {_browser_name(n): p.detach().float().cpu().contiguous() for n, p in self.named_parameters()}

    @torch.no_grad()
    def generate(self, ids, steps: int, temperature: float = 0.8, top_k: int | None = None):
        for _ in range(steps):
            logits, _ = self(ids[:, -self.cfg.context :])
            logits = logits[:, -1] / temperature
            if top_k:
                v, _ = torch.topk(logits, top_k)
                logits[logits < v[:, [-1]]] = -float("inf")
            ids = torch.cat([ids, torch.multinomial(logits.softmax(-1), 1)], dim=1)
        return ids


def _browser_name(name: str) -> str:
    """blocks.3.attn.q → h3.attn.q;  blocks.0.ln1.g → h0.ln1.g;  tok, pos, lnf.g unchanged."""
    if name.startswith("blocks."):
        _, i, rest = name.split(".", 2)
        return f"h{i}.{rest}"
    return name
