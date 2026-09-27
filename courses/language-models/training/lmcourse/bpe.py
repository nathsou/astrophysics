"""Chapter 3 — byte-level BPE. Mirrors packages/core/src/tokenise/bpe.ts exactly (same pattern,
same tie-breaking), so a tokeniser trained in Python is identical to one trained in the browser.
CourseGPT's tokeniser (Chapter 14) is trained with this module."""

from __future__ import annotations

import heapq
import json
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, field
from itertools import pairwise
from pathlib import Path

import regex

GPT2_PATTERN = r"""'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""
COURSE_PATTERN = r"""'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}{1,3}| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""

Pair = tuple[int, int]


def pretokenise(text: str, pattern: str = COURSE_PATTERN) -> list[str]:
    return regex.findall(pattern, text)


def apply_merges(ids: list[int], ranks: dict[Pair, int]) -> list[int]:
    """Repeatedly merge the lowest-ranked adjacent pair (all its occurrences, left to right)."""
    seq = ids
    while len(seq) >= 2:
        best = min((ranks.get(p, 1 << 60) for p in pairwise(seq)), default=1 << 60)
        if best == 1 << 60:
            break
        a, b = _pair_of(ranks, best)
        out: list[int] = []
        i = 0
        while i < len(seq):
            if i + 1 < len(seq) and seq[i] == a and seq[i + 1] == b:
                out.append(256 + best)
                i += 2
            else:
                out.append(seq[i])
                i += 1
        seq = out
    return seq


_INVERSE: dict[int, list[Pair]] = {}


def _pair_of(ranks: dict[Pair, int], rank: int) -> Pair:
    inv = _INVERSE.get(id(ranks))
    if inv is None or len(inv) != len(ranks):
        inv = [(0, 0)] * len(ranks)
        for p, r in ranks.items():
            inv[r] = p
        _INVERSE[id(ranks)] = inv
    return inv[rank]


@dataclass
class BpeTokeniser:
    pattern: str
    merges: list[Pair]
    special: dict[str, int] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.ranks = {tuple(p): i for i, p in enumerate(self.merges)}
        self.vocab: list[bytes] = [bytes([b]) for b in range(256)]
        for a, b in self.merges:
            self.vocab.append(self.vocab[a] + self.vocab[b])
        self._regex = regex.compile(self.pattern)
        self._cache: dict[str, list[int]] = {}

    @property
    def vocab_size(self) -> int:
        return 256 + len(self.merges) + len(self.special)

    def encode_chunk(self, chunk: str) -> list[int]:
        ids = self._cache.get(chunk)
        if ids is None:
            ids = apply_merges(list(chunk.encode("utf-8")), self.ranks)
            self._cache[chunk] = ids
        return ids

    def encode(self, text: str, allow_special: bool = False) -> list[int]:
        pieces = [text]
        if allow_special and self.special:
            pieces = regex.split("(" + "|".join(regex.escape(s) for s in self.special) + ")", text)
        out: list[int] = []
        for piece in pieces:
            if allow_special and piece in self.special:
                out.append(self.special[piece])
                continue
            for m in self._regex.findall(piece):
                out.extend(self.encode_chunk(m))
        return out

    def token_bytes(self, i: int) -> bytes:
        if i < len(self.vocab):
            return self.vocab[i]
        return next(s for s, j in self.special.items() if j == i).encode("utf-8")

    def decode(self, ids: list[int]) -> str:
        return b"".join(self.token_bytes(i) for i in ids).decode("utf-8", errors="replace")

    def to_json(self) -> dict:
        return {"pattern": self.pattern, "merges": [list(p) for p in self.merges], "special": self.special}

    def save(self, path: Path) -> None:
        path.write_text(json.dumps(self.to_json()))

    @classmethod
    def load(cls, path: Path) -> BpeTokeniser:
        d = json.loads(path.read_text())
        return cls(d["pattern"], [tuple(p) for p in d["merges"]], d["special"])


class BpeTrainer:
    """Incremental trainer. Ties: highest count, then smallest first id, then smallest second id.
    `text` may be a list of documents, whose chunks are counted together (no chunk spans two)."""

    def __init__(self, text: str | Iterable[str], pattern: str = COURSE_PATTERN):
        self.pattern = pattern
        chunks: Counter[str] = Counter()
        for doc in [text] if isinstance(text, str) else text:
            chunks.update(pretokenise(doc, pattern))
        self.words: list[list[int]] = [list(c.encode("utf-8")) for c in chunks]
        self.freq: list[int] = list(chunks.values())
        self.counts: Counter[Pair] = Counter()
        self.where: dict[Pair, set[int]] = {}
        self.merges: list[Pair] = []
        self.total_tokens = 0
        for wi, w in enumerate(self.words):
            self.total_tokens += len(w) * self.freq[wi]
            self._add(wi, +1, None)
        self.total_bytes = self.total_tokens
        self.heap = [(-c, a, b) for (a, b), c in self.counts.items()]
        heapq.heapify(self.heap)

    def _add(self, wi: int, sign: int, touched: set[Pair] | None) -> None:
        w, f = self.words[wi], self.freq[wi]
        for p in pairwise(w):
            c = self.counts[p] + sign * f
            if c == 0:
                del self.counts[p]
            else:
                self.counts[p] = c
            if sign > 0:
                self.where.setdefault(p, set()).add(wi)
            if touched is not None:
                touched.add(p)

    def step(self) -> tuple[Pair, int] | None:
        while self.heap:
            negc, a, b = heapq.heappop(self.heap)
            if self.counts.get((a, b)) == -negc:
                break
        else:
            return None
        pair, count, new = (a, b), -negc, 256 + len(self.merges)
        touched: set[Pair] = set()
        for wi in list(self.where.pop(pair, ())):
            w = self.words[wi]
            if not any(x == a and y == b for x, y in pairwise(w)):
                continue
            self._add(wi, -1, touched)
            out, i = [], 0
            while i < len(w):
                if i + 1 < len(w) and w[i] == a and w[i + 1] == b:
                    out.append(new)
                    i += 2
                else:
                    out.append(w[i])
                    i += 1
            self.total_tokens -= (len(w) - len(out)) * self.freq[wi]
            self.words[wi] = out
            self._add(wi, +1, touched)
        self.where.pop(pair, None)
        for p in touched:
            c = self.counts.get(p)
            if c:
                heapq.heappush(self.heap, (-c, p[0], p[1]))
        self.merges.append(pair)
        return pair, count

    def tokeniser(self, special: list[str] | None = None) -> BpeTokeniser:
        base = 256 + len(self.merges)
        return BpeTokeniser(self.pattern, list(self.merges), {s: base + i for i, s in enumerate(special or [])})


def train(text: str, num_merges: int, pattern: str = COURSE_PATTERN, special: list[str] | None = None) -> BpeTokeniser:
    t = BpeTrainer(text, pattern)
    while len(t.merges) < num_merges and t.step():
        pass
    return t.tokeniser(special)
