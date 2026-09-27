"""Chapter 1 — text as data. Mirrors packages/core/src/text in TypeScript."""

from __future__ import annotations

import math
import re
from collections import Counter
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

REPLACEMENT = 0xFFFD


def utf8_encode(text: str) -> bytes:
    """UTF-8 encode without str.encode — the same algorithm as the TypeScript exercise."""
    out = bytearray()
    for ch in text:
        cp = ord(ch)
        if 0xD800 <= cp <= 0xDFFF:  # lone surrogate (possible in Python via 'surrogatepass')
            cp = REPLACEMENT
        if cp < 0x80:
            out.append(cp)
        elif cp < 0x800:
            out += bytes([0xC0 | (cp >> 6), 0x80 | (cp & 0x3F)])
        elif cp < 0x10000:
            out += bytes([0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F)])
        else:
            out += bytes(
                [0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F)]
            )
    return bytes(out)


# Letters/digits, optionally joined by apostrophes — the same rule as `words()` in TypeScript.
_WORD = re.compile(r"[^\W_]+(?:['’][^\W\d_]+)*")


def words(text: str) -> list[str]:
    return _WORD.findall(text.lower())


def entropy(counts: Iterable[float], base: float = 2.0) -> float:
    """H = −Σ p log_b p over (unnormalised) counts; zero counts contribute nothing."""
    cs = list(counts)
    total = sum(cs)
    if total == 0:
        return 0.0
    h = -sum((c / total) * math.log(c / total) for c in cs if c > 0)
    return h / math.log(base)


@dataclass
class PowerLawFit:
    s: float
    C: float
    r2: float


def fit_power_law(xs: Sequence[float], ys: Sequence[float]) -> PowerLawFit:
    """Least-squares fit of y = C / x^s on log–log axes (biased; see Clauset et al. 2009)."""
    pts = [(math.log(x), math.log(y)) for x, y in zip(xs, ys) if x > 0 and y > 0]
    n = len(pts)
    sx = sum(p[0] for p in pts)
    sy = sum(p[1] for p in pts)
    sxx = sum(p[0] ** 2 for p in pts)
    sxy = sum(p[0] * p[1] for p in pts)
    slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)
    intercept = (sy - slope * sx) / n
    mean_y = sy / n
    ss_res = sum((y - (intercept + slope * x)) ** 2 for x, y in pts)
    ss_tot = sum((y - mean_y) ** 2 for _, y in pts)
    return PowerLawFit(s=-slope, C=math.exp(intercept), r2=1.0 if ss_tot == 0 else 1 - ss_res / ss_tot)


def ranked(items: Iterable[str]) -> list[tuple[str, int]]:
    """(item, count) sorted by descending count, ties in first-seen order (as in TypeScript)."""
    return sorted(Counter(items).items(), key=lambda kv: -kv[1])


def vocabulary_growth(items: Sequence[str], samples: int = 60) -> list[tuple[int, int]]:
    """Distinct items seen after the first n, at the same log-spaced n as the TypeScript version."""
    n_total = len(items)
    marks = {max(1, round(math.exp(math.log(n_total) * k / samples))) for k in range(samples + 1)}
    seen: set[str] = set()
    out = []
    for i, item in enumerate(items):
        seen.add(item)
        if i + 1 in marks:
            out.append((i + 1, len(seen)))
    return out
