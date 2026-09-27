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


DATASETS: dict[str, Dataset] = {
    "shakespeare": Dataset(
        name="shakespeare",
        url="https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt",
        filename="tinyshakespeare.txt",
        description="TinyShakespeare (≈1.1 MB), compiled by Andrej Karpathy for char-rnn.",
    ),
}


def path(name: str) -> Path:
    return DATA / DATASETS[name].filename


def download(name: str, force: bool = False) -> Path:
    """Download a dataset into training/data/ (reusing the copy bundled with the site if present)."""
    ds = DATASETS[name]
    dest = path(name)
    if dest.exists() and not force:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    bundled = COURSE_STATIC_DATA / ds.filename
    if bundled.exists() and not force:
        shutil.copyfile(bundled, dest)
        return dest
    with urllib.request.urlopen(ds.url) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)
    return dest


def load_text(name: str) -> str:
    return download(name).read_text(encoding="utf-8")
