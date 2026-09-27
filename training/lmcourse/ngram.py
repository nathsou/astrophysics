"""Chapter 2 — n-gram language models. Mirrors packages/core/src/ngram in TypeScript.

The TypeScript version packs n-grams into sorted typed arrays for speed in the browser; here we use
plain dictionaries of tuples, which is slower but reads exactly like the maths.
"""

from __future__ import annotations

import math
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class Smoothing:
    kind: str  # "mle" | "addk" | "interp" | "kn"
    k: float = 0.0
    lam: float = 0.0
    d: float = 0.0


class NGramStats:
    """Counts of every k-gram for k = 1…max_order, plus per-context totals."""

    def __init__(self, ids: Sequence[int], vocab_size: int, max_order: int):
        self.V = vocab_size
        self.max_order = max_order
        self.tables: list[Counter[tuple[int, ...]]] = [Counter()]
        for k in range(1, max_order + 1):
            self.tables.append(Counter(tuple(ids[t : t + k]) for t in range(len(ids) - k + 1)))
        self._ctx: dict[tuple[int, bool], dict[tuple[int, ...], tuple[float, int]]] = {}
        self._cont: dict[int, Counter[tuple[int, ...]]] = {}

    def continuation(self, k: int) -> Counter[tuple[int, ...]]:
        """N₁₊(• g) for each k-gram g: how many distinct tokens precede it."""
        if k not in self._cont:
            self._cont[k] = Counter(g[1:] for g in self.tables[k + 1])
        return self._cont[k]

    def table(self, k: int, continuation: bool) -> Counter[tuple[int, ...]]:
        return self.continuation(k) if continuation else self.tables[k]

    def context_stats(self, k: int, continuation: bool) -> dict[tuple[int, ...], tuple[float, int]]:
        """context → (Σ_w count(context w), number of distinct w)."""
        key = (k, continuation)
        if key not in self._ctx:
            stats: dict[tuple[int, ...], list[float]] = {}
            for g, c in self.table(k, continuation).items():
                s = stats.setdefault(g[:-1], [0.0, 0])
                s[0] += c
                s[1] += 1
            self._ctx[key] = {h: (s[0], int(s[1])) for h, s in stats.items()}
        return self._ctx[key]


class NGramModel:
    def __init__(self, stats: NGramStats, order: int, smoothing: Smoothing):
        assert order <= stats.max_order
        self.stats = stats
        self.order = order
        self.smoothing = smoothing
        self.context_length = order - 1

    def prob(self, context: Sequence[int], nxt: int) -> float:
        s, V = self.smoothing, self.stats.V
        top = min(self.order, len(context) + 1)

        def ctx(j: int) -> tuple[int, ...]:
            return tuple(context[len(context) - (j - 1) :]) if j > 1 else ()

        if s.kind in ("mle", "addk"):
            h = ctx(top)
            tot, _ = self.stats.context_stats(top, False).get(h, (0.0, 0))
            k = s.k if s.kind == "addk" else 0.0
            if tot + k * V == 0:
                return 1 / V
            return (self.stats.tables[top].get(h + (nxt,), 0) + k) / (tot + k * V)

        p = 1 / V
        for j in range(1, top + 1):
            cont = s.kind == "kn" and j < top
            h = ctx(j)
            tot, types = self.stats.context_stats(j, cont).get(h, (0.0, 0))
            if tot == 0:
                continue
            c = self.stats.table(j, cont).get(h + (nxt,), 0)
            if s.kind == "interp":
                p = s.lam * (c / tot) + (1 - s.lam) * p
            else:
                p = max(c - s.d, 0) / tot + (s.d * types / tot) * p
        return p


def cross_entropy_bits(model: NGramModel, ids: Sequence[int], start: int) -> float:
    """Average −log₂ P(ids[t] | preceding context) for t ≥ start; inf if any P is 0."""
    total = 0.0
    n = 0
    L = model.context_length
    for t in range(start, len(ids)):
        p = model.prob(ids[max(0, t - L) : t], ids[t])
        if p <= 0:
            return math.inf
        total -= math.log2(p)
        n += 1
    return total / n
