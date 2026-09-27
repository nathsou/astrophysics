"""Dataset download and loading."""

from __future__ import annotations

import shutil
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from .paths import COURSE_STATIC_DATA, DATA


@dataclass(frozen=True)
class Dataset:
    name: str
    url: str
    filename: str
    description: str
    extra: tuple[tuple[str, str], ...] = ()
    """Further (filename, url) pairs downloaded alongside the main file."""


_TINYSTORIES = "https://huggingface.co/datasets/roneneldan/TinyStories/resolve/main"

DATASETS: dict[str, Dataset] = {
    "shakespeare": Dataset(
        name="shakespeare",
        url="https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt",
        filename="tinyshakespeare.txt",
        description="TinyShakespeare (≈1.1 MB), compiled by Andrej Karpathy for char-rnn.",
    ),
    "tinystories": Dataset(
        name="tinystories",
        url=f"{_TINYSTORIES}/TinyStoriesV2-GPT4-train.txt",
        filename="TinyStoriesV2-GPT4-train.txt",
        description="TinyStories V2 (GPT-4 stories only; ≈2.2 GB train, ≈22 MB validation), Eldan & Li 2023.",
        extra=(("TinyStoriesV2-GPT4-valid.txt", f"{_TINYSTORIES}/TinyStoriesV2-GPT4-valid.txt"),),
    ),
}


def path(name: str) -> Path:
    return DATA / DATASETS[name].filename


def download(name: str, force: bool = False) -> Path:
    """Download a dataset into training/data/ (reusing the copy bundled with the site if present)."""
    ds = DATASETS[name]
    for filename, url in ((ds.filename, ds.url), *ds.extra):
        dest = DATA / filename
        if dest.exists() and not force:
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        bundled = COURSE_STATIC_DATA / filename
        if bundled.exists() and not force:
            shutil.copyfile(bundled, dest)
            continue
        _fetch(url, dest)
    return path(name)


def _fetch(url: str, dest: Path) -> None:
    """Stream to a .part file with a progress line, then rename (an interrupted download never looks complete)."""
    part = dest.with_name(dest.name + ".part")
    with urllib.request.urlopen(url) as r, open(part, "wb") as f:
        total = int(r.headers.get("Content-Length") or 0)
        done = 0
        while chunk := r.read(1 << 22):
            f.write(chunk)
            done += len(chunk)
            if total:
                print(f"\r{dest.name}: {done / 1e6:,.0f} / {total / 1e6:,.0f} MB", end="", flush=True)
    if total:
        print()
    part.rename(dest)


def load_text(name: str) -> str:
    return download(name).read_text(encoding="utf-8")
