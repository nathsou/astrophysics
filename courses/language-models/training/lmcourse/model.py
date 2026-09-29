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
    # Chapter 18: the changes that turned GPT-2's block into Llama's. The defaults are GPT-2's.
    norm_type: str = "layer"  # "layer" (LayerNorm) or "rms" (RMSNorm)
    mlp_type: str = "gelu"  # "gelu", or "swiglu" (a gated MLP, hidden width ⅔ larger-ratio for equal parameters)
    pos: str = "learned"  # "learned" position embeddings, or "rope" (rotary embeddings in attention)
    kv_heads: int = 0  # grouped-query attention: key/value heads shared by groups of query heads (0: one per head)
    rope_base: float = 10000.0

    @property
    def swiglu_hidden(self) -> int:
        """SwiGLU has three matrices, so its hidden width is ⅔ of the GELU MLP's for the same parameter count
        (rounded to a multiple of 64, as Llama does)."""
        return max(64, round(2 * self.mlp_ratio * self.width / 3 / 64) * 64)


class RMSNorm(nn.Module):
    """x / rms(x) · g: LayerNorm without the mean subtraction and the bias (Zhang and Sennrich, 2019)."""

    def __init__(self, width: int) -> None:
        super().__init__()
        self.g = nn.Parameter(torch.ones(width))

    def forward(self, x):
        return F.rms_norm(x, (x.shape[-1],), self.g, 1e-5)


def rope_tables(T: int, d: int, base: float, device) -> tuple[torch.Tensor, torch.Tensor]:
    """cos and sin of position × frequency, (T, d/2): frequency i is base^(−2i/d)."""
    freqs = base ** (-torch.arange(0, d, 2, device=device, dtype=torch.float32) / d)
    angles = torch.arange(T, device=device, dtype=torch.float32)[:, None] * freqs[None]
    return angles.cos(), angles.sin()


def apply_rope(x: torch.Tensor, cos: torch.Tensor, sin: torch.Tensor) -> torch.Tensor:
    """Rotate each pair (x_i, x_{i + d/2}) of every head by its position's angle (the "rotate half" layout)."""
    x1, x2 = x.float().chunk(2, dim=-1)
    return torch.cat([x1 * cos - x2 * sin, x1 * sin + x2 * cos], dim=-1).type_as(x)


def make_norm(cfg: GPTConfig, width: int) -> nn.Module | None:
    if not cfg.norm:
        return None
    return RMSNorm(width) if cfg.norm_type == "rms" else LayerNorm(width)


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
        d = C // cfg.heads
        kv = (cfg.kv_heads or cfg.heads) * d  # width of the keys and values
        self.ln1 = make_norm(cfg, C)
        self.attn = nn.ParameterDict({
            "q": nn.Parameter(torch.randn(C, C) * std),
            "k": nn.Parameter(torch.randn(C, kv) * std),
            "v": nn.Parameter(torch.randn(C, kv) * std),
            "o": nn.Parameter(torch.randn(C, C) * resid),
        })
        if cfg.mlp:
            self.ln2 = make_norm(cfg, C)
            if cfg.mlp_type == "swiglu":
                H = cfg.swiglu_hidden
                self.mlp = nn.ParameterDict({
                    "gate": nn.Parameter(torch.randn(C, H) * std),
                    "fc": nn.Parameter(torch.randn(C, H) * std),
                    "proj": nn.Parameter(torch.randn(H, C) * resid),
                })
            else:
                self.mlp = nn.ParameterDict({
                    "fc": nn.Parameter(torch.randn(C, cfg.mlp_ratio * C) * std),
                    "proj": nn.Parameter(torch.randn(cfg.mlp_ratio * C, C) * resid),
                })
        self.drop = nn.Dropout(cfg.dropout)

    def forward(self, x, rope=None):
        B, T, C = x.shape
        h, d = self.cfg.heads, C // self.cfg.heads
        hkv = self.cfg.kv_heads or h
        a = self.ln1(x) if self.ln1 is not None else x
        q = (a @ self.attn["q"]).view(B, T, h, d).transpose(1, 2)
        k = (a @ self.attn["k"]).view(B, T, hkv, d).transpose(1, 2)
        v = (a @ self.attn["v"]).view(B, T, hkv, d).transpose(1, 2)
        if rope is not None:
            q, k = apply_rope(q, *rope), apply_rope(k, *rope)
        if hkv != h:  # each key/value head serves a group of h / hkv query heads
            k, v = k.repeat_interleave(h // hkv, dim=1), v.repeat_interleave(h // hkv, dim=1)
        y = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        x = x + self.drop(y.transpose(1, 2).reshape(B, T, C) @ self.attn["o"])
        if self.cfg.mlp:
            m = self.ln2(x) if self.ln2 is not None else x
            if self.cfg.mlp_type == "swiglu":
                u = F.silu(m @ self.mlp["gate"]) * (m @ self.mlp["fc"])
            else:
                u = F.gelu(m @ self.mlp["fc"], approximate="tanh")
            x = x + self.drop(u @ self.mlp["proj"])
        return x


class GPT(nn.Module):
    def __init__(self, cfg: GPTConfig) -> None:
        super().__init__()
        self.cfg = cfg
        self.tok = nn.Parameter(torch.randn(cfg.vocab, cfg.width) * 0.02)
        if cfg.pos == "learned":
            self.pos = nn.Parameter(torch.randn(cfg.context, cfg.width) * 0.02)
        self.blocks = nn.ModuleList(Block(cfg) for _ in range(cfg.layers))
        self.lnf = make_norm(cfg, cfg.width)
        self.drop = nn.Dropout(cfg.dropout)

    def forward(self, ids, targets=None):
        T = ids.shape[1]
        rope = None
        if self.cfg.pos == "rope":
            # Rotary positions work at any length, including beyond the training context.
            rope = rope_tables(T, self.cfg.width // self.cfg.heads, self.cfg.rope_base, ids.device)
            x = self.drop(self.tok[ids])
        else:
            x = self.drop(self.tok[ids] + self.pos[:T])
        for block in self.blocks:
            x = block(x, rope)
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

    def muon_optimizers(
        self, muon_lr: float, adam_lr: float, weight_decay: float = 0.1, betas=(0.9, 0.99)
    ) -> list[torch.optim.Optimizer]:
        """Muon for the blocks' 2-D matrices, AdamW for embeddings and norms (Chapter 13's split)."""
        matrices = [p for n, p in self.named_parameters() if n.startswith("blocks.") and p.ndim == 2]
        ids = {id(p) for p in matrices}
        decay, no_decay = [], []
        for name, p in self.named_parameters():
            if id(p) not in ids:
                (no_decay if name.endswith((".g", ".b")) or name == "pos" else decay).append(p)
        groups = [{"params": decay, "weight_decay": weight_decay}, {"params": no_decay, "weight_decay": 0.0}]
        return [
            torch.optim.Muon(matrices, lr=muon_lr, weight_decay=weight_decay, momentum=0.95),
            torch.optim.AdamW(groups, lr=adam_lr, betas=betas, fused=torch.cuda.is_available()),
        ]

    def num_parameters(self) -> int:
        return sum(p.numel() for p in self.parameters())

    def state_for_browser(self) -> dict[str, torch.Tensor]:
        """Parameters under the browser's names: h{i}.attn.q, h{i}.ln1.g, lnf.b, tok, pos, …"""
        return {_browser_name(n): p.detach().float().cpu().contiguous() for n, p in self.named_parameters()}

    @torch.no_grad()
    def generate(self, ids, steps: int, temperature: float = 0.8, top_k: int | None = None, generator=None):
        for _ in range(steps):
            logits, _ = self(ids[:, -self.cfg.context :])
            logits = logits[:, -1].float() / temperature
            if top_k:
                v, _ = torch.topk(logits, top_k)
                logits[logits < v[:, [-1]]] = -float("inf")
            ids = torch.cat([ids, torch.multinomial(logits.softmax(-1), 1, generator=generator)], dim=1)
        return ids


def _browser_name(name: str) -> str:
    """blocks.3.attn.q → h3.attn.q;  blocks.0.ln1.g → h0.ln1.g;  tok, pos, lnf.g unchanged."""
    if name.startswith("blocks."):
        _, i, rest = name.split(".", 2)
        return f"h{i}.{rest}"
    return name
