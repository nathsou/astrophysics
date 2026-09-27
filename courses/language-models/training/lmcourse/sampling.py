"""Chapter 15 — decoding, in PyTorch, batched. Mirrors packages/core/src/sample (same rules, same order):

    penalties on the logits → temperature → softmax → top-k → top-p → min-p → sample

Truncation works on logits here, setting discarded tokens to −∞, which is equivalent to zeroing
their probabilities and renormalising.
"""

from __future__ import annotations

from dataclasses import dataclass

import torch


@dataclass
class Sampler:
    temperature: float = 1.0  # 0: greedy
    top_k: int = 0  # 0: off
    top_p: float = 1.0  # 1: off
    min_p: float = 0.0  # 0: off
    repetition_penalty: float = 1.0  # 1: off

    def label(self) -> str:
        parts = ["greedy" if self.temperature == 0 else f"T {self.temperature:g}"]
        if self.top_k:
            parts.append(f"top-k {self.top_k}")
        if self.top_p < 1:
            parts.append(f"top-p {self.top_p:g}")
        if self.min_p:
            parts.append(f"min-p {self.min_p:g}")
        if self.repetition_penalty != 1:
            parts.append(f"rep. penalty {self.repetition_penalty:g}")
        return ", ".join(parts)


def top_k(logits: torch.Tensor, k: int) -> torch.Tensor:
    """Keep the k largest logits in each row (and any tied with the k-th)."""
    kth = torch.topk(logits, k, dim=-1).values[..., -1:]
    return logits.masked_fill(logits < kth, -float("inf"))


def top_p(logits: torch.Tensor, p: float) -> torch.Tensor:
    """Keep the smallest set of most probable tokens whose probability reaches p."""
    sorted_logits, idx = torch.sort(logits, descending=True, dim=-1)
    probs = sorted_logits.softmax(-1)
    before = probs.cumsum(-1) - probs  # mass of the more probable tokens
    remove = before >= p
    return logits.masked_fill(remove.scatter(-1, idx, remove), -float("inf"))


def min_p(logits: torch.Tensor, ratio: float) -> torch.Tensor:
    """Keep tokens at least `ratio` times as probable as the most probable one."""
    probs = logits.softmax(-1)
    return logits.masked_fill(probs < ratio * probs.max(-1, keepdim=True).values, -float("inf"))


def repetition_penalty(logits: torch.Tensor, history: torch.Tensor, theta: float) -> torch.Tensor:
    """CTRL's penalty on every token present in each row's history."""
    seen = torch.gather(logits, -1, history)
    seen = torch.where(seen > 0, seen / theta, seen * theta)
    return logits.scatter(-1, history, seen)


def prepare(logits: torch.Tensor, history: torch.Tensor, s: Sampler) -> torch.Tensor:
    """The (log-space) distribution each row is sampled from."""
    z = logits if logits.dtype == torch.float64 else logits.float()  # bf16 logits are upcast
    if s.repetition_penalty != 1:
        z = repetition_penalty(z, history, s.repetition_penalty)
    if s.temperature > 0:
        z = z / s.temperature
    if s.top_k:
        z = top_k(z, s.top_k)
    if s.top_p < 1:
        z = top_p(z, s.top_p)
    if s.min_p:
        z = min_p(z, s.min_p)
    return z


@torch.no_grad()
def generate(model, ids: torch.Tensor, steps: int, s: Sampler, generator: torch.Generator | None = None) -> torch.Tensor:
    """Continue each row of `ids` (all the same length) by `steps` tokens."""
    for _ in range(steps):
        logits, _ = model(ids[:, -model.cfg.context :])
        z = prepare(logits[:, -1], ids, s)
        nxt = z.argmax(-1, keepdim=True) if s.temperature == 0 else torch.multinomial(z.softmax(-1), 1, generator=generator)
        ids = torch.cat([ids, nxt], dim=1)
    return ids


@torch.no_grad()
def beam_search(model, prompt: torch.Tensor, steps: int, width: int) -> torch.Tensor:
    """Beam search from one prompt (1-D tensor); returns the most probable continuation found."""
    beams = prompt[None]
    scores = torch.zeros(1, device=prompt.device)
    for _ in range(steps):
        logits, _ = model(beams[:, -model.cfg.context :])
        lp = logits[:, -1].float().log_softmax(-1) + scores[:, None]
        scores, flat = lp.flatten().topk(width)
        V = lp.shape[-1]
        beams = torch.cat([beams[flat // V], (flat % V)[:, None]], dim=1)
    return beams[0]
